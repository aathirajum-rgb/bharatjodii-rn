// Angular equivalent: pages/menu-profiles/menu-profiles.page.ts (varPageType='1'),
// which drives both the "dontshow" and "blockprofiles" tabs off the same page
// component — this screen mirrors that by sharing one card/list/pagination
// implementation across both tabs and only swapping the fetch endpoint + CTA.
//
// Known simplifications vs Angular:
//  - Un-ignoring (dontshow tab) happens on ViewProfileScreen (the existing
//    "Don't show" toggle there), same as Angular. Angular removes the item from
//    its local list via a live event-emitter subscription; RN has no equivalent
//    event bus for this, so the list simply refetches from the top whenever this
//    screen regains focus (useFocusEffect) — same end result (list reflects
//    current state), no exit animation.
//  - Unblocking (blocked tab) happens inline here via the "Unblock" CTA, since
//    there's no other screen surface for it yet.
//  - Empty/loading states use a plain spinner + text instead of Angular's Lottie
//    animations (no established pattern for remote-hosted Lottie JSON in RN yet).

import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { StorageKeys } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import {
  fetchIgnoredProfiles, fetchBlockedProfiles, type IgnoredProfile, type IgnoredProfilesPage,
} from '../../service/ignoredProfilesService'
import { unblockProfile } from '../../service/communicationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import Toast, { type ToastRequest } from '../../components/toast/Toast'

const DEFAULT_PHOTO_MALE   = CDN_REACT + '/ignore_profile_male.svg'
const DEFAULT_PHOTO_FEMALE = CDN_REACT + '/ignore_profile_female.svg'

const LIMIT = 20

type Tab = 'dontshow' | 'blocked'

type Props = { navigation: any }

// ─── Card ─────────────────────────────────────────────────────────────────────

function ProfileCard({
  profile, defaultPhoto, tab, onPress, onUnblock,
}: {
  profile: IgnoredProfile
  defaultPhoto: string
  tab: Tab
  onPress: () => void
  onUnblock: () => void
}) {
  const { t } = useTranslation()
  const [imgFailed, setImgFailed] = useState(false)
  const showPhoto = !!profile.thumbImg && !imgFailed

  if (profile.isDeleted) {
    return (
      <View style={c.card}>
        <CdnSvg uri={defaultPhoto} width={102} height={102} style={c.photo} />
        <View style={c.info}>
          <Text style={c.name} numberOfLines={1}>{profile.name}</Text>
          <Text style={c.deletedText}>{t('LIKE_LIST.DELETED_PROFILE_TXT')}</Text>
        </View>
      </View>
    )
  }

  const subLine = [profile.city, profile.age, profile.education, profile.occupation]
    .filter(Boolean).join(' | ')

  return (
    <View style={c.card}>
      {showPhoto && profile.thumbImg ? (
        <Image
          source={{ uri: profile.thumbImg }}
          style={c.photo}
          contentFit="cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <CdnSvg uri={defaultPhoto} width={102} height={102} style={c.photo} />
      )}
      <View style={c.info}>
        <Text style={c.name} numberOfLines={1}>{profile.name}</Text>
        {!!subLine && <Text style={c.subText} numberOfLines={2}>{subLine}</Text>}
        {tab === 'dontshow' ? (
          <Pressable onPress={onPress} style={c.linkBtn} hitSlop={8}>
            <Text style={c.linkText}>{t('NOTIFICATION.VIEW_PROFILE_CTA')}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onUnblock} style={c.linkBtn} hitSlop={8}>
            <Text style={c.linkText}>{t('PROFILES.UNBLOCK')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

// ─── IgnoredProfilesScreen ────────────────────────────────────────────────────

export default function IgnoredProfilesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [activeTab,   setActiveTab]   = useState<Tab>('dontshow')
  const [profiles,    setProfiles]    = useState<IgnoredProfile[]>([])
  const [totalCount,  setTotalCount]  = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [toastRequest, setToastRequest] = useState<ToastRequest | null>(null)

  const tabRef      = useRef<Tab>('dontshow')
  const startRef    = useRef(0)
  const fetchingRef = useRef(false)
  const avatarRef   = useRef(DEFAULT_PHOTO_FEMALE)   // opposite-gender fallback, like ActivityScreen

  const load = useCallback(async (reset: boolean) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    if (reset) startRef.current = 0

    const tab = tabRef.current
    const fetchPage: (start: number, limit: number) => Promise<IgnoredProfilesPage> =
      tab === 'dontshow' ? fetchIgnoredProfiles : fetchBlockedProfiles

    try {
      const [female, page] = await Promise.all([
        reset ? getItem(StorageKeys.User.LOGIN_GENDER).then(g => g === '0') : Promise.resolve(null),
        fetchPage(startRef.current, LIMIT),
      ])
      if (female !== null) avatarRef.current = female ? DEFAULT_PHOTO_MALE : DEFAULT_PHOTO_FEMALE
      if (tab !== tabRef.current) return   // tab switched again while this was in flight

      setProfiles(prev => (reset ? page.items : [...prev, ...page.items]))
      setTotalCount(page.totalCount)
      startRef.current += LIMIT
    } finally {
      fetchingRef.current = false
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Angular removes an un-ignored profile from the list live via an event
  // subscription; RN just refetches on focus (e.g. returning from ViewProfileScreen
  // after toggling "Don't show" there) — see file header note.
  useFocusEffect(
    useCallback(() => {
      load(true)
    }, [load]),
  )

  function switchTab(tab: Tab) {
    if (tab === activeTab) return
    tabRef.current = tab
    setActiveTab(tab)
    setLoading(true)
    setProfiles([])
    setTotalCount(0)
    load(true)
  }

  function loadMore() {
    if (loadingMore || profiles.length >= totalCount) return
    setLoadingMore(true)
    load(false)
  }

  function handlePress(profile: IgnoredProfile) {
    if (profile.isDeleted) {
      setToastRequest({ message: t('LIKE_LIST.DELETED_PROFILE_TXT'), key: Date.now() })
      return
    }
    navigation.navigate('viewProfile', { matriId: profile.matriId, fromPage: 'menu' })
  }

  function handleUnblock(profile: IgnoredProfile) {
    Alert.alert(
      t('PRIVACY.UNBLOCK_HEADER').replace('#NAME#', profile.name),
      t('PRIVACY.UNBLOCK_CONTENT').replace('##HIM_HER##', 'them'),
      [
        { text: t('PRIVACY.UNBLOCK_CTA2'), style: 'cancel' },
        {
          text: t('PRIVACY.UNBLOCK_CTA1'),
          style: 'destructive',
          onPress: async () => {
            const ok = await unblockProfile(profile.matriId)
            if (ok) {
              setProfiles(prev => prev.filter(p => p.matriId !== profile.matriId))
              setTotalCount(prev => Math.max(0, prev - 1))
            }
            setToastRequest({
              message: ok ? 'Profile unblocked' : 'Something went wrong. Please try again.',
              key: Date.now(),
            })
          },
        },
      ],
    )
  }

  const emptyText = activeTab === 'dontshow' ? t('PROFILES.NORESULT_1') : t('PROFILES.NORESULT_22')

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.headerWrap}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
            <CdnSvg uri={CDN_REACT + '/menu_back_arrow.svg'} width={24} height={24} />
          </Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>{t('MENU.IGNORED_PROFILES')}</Text>
        </View>

        <View style={s.tabsRow}>
          <Pressable style={[s.tab, activeTab === 'dontshow' && s.tabActive]} onPress={() => switchTab('dontshow')}>
            <Text style={[s.tabText, activeTab === 'dontshow' && s.tabTextActive]}>
              {t('PROFILES.DONT_SHOW_TITLE')}
            </Text>
          </Pressable>
          <Pressable style={[s.tab, activeTab === 'blocked' && s.tabActive]} onPress={() => switchTab('blocked')}>
            <Text style={[s.tabText, activeTab === 'blocked' && s.tabTextActive]}>
              {t('PROFILES.BLOCKED_PROFILES')}
            </Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.primaryDark} size="large" />
        </View>
      ) : profiles.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(item, i) => `${item.matriId}_${i}`}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 16 }}
          renderItem={({ item }) => (
            <ProfileCard
              profile={item}
              defaultPhoto={avatarRef.current}
              tab={activeTab}
              onPress={() => handlePress(item)}
              onUnblock={() => handleUnblock(item)}
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={s.footerLoader} color={Colors.primaryDark} /> : null}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Toast request={toastRequest} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  headerWrap: {
    backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  header: { height: 56, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: '#333333', marginLeft: 6, marginRight: 16 },

  tabsRow: {
    flexDirection: 'row', gap: 20, paddingHorizontal: 24,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  tab: { paddingVertical: 8 },
  tabActive: { borderBottomWidth: 1.5, borderBottomColor: Colors.primaryDark },
  tabText: { fontSize: 14, color: Colors.black, letterSpacing: 0.42 },
  tabTextActive: { color: Colors.primaryDark, fontWeight: '500' },

  footerLoader: { paddingVertical: 24 },
})

const c = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  photo: { width: 102, height: 102, borderRadius: 4 },
  info: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6 },
  subText: { fontSize: 14, color: Colors.black, lineHeight: 20 },
  deletedText: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
  linkBtn: { marginTop: 8, alignSelf: 'flex-start' },
  linkText: { fontSize: 14, color: Colors.link, fontWeight: '500' },
})
