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
//  - Empty and loading states render Angular's own Lottie animations
//    (profiles-you-removed.json / like-list-loding-screen.json) through the
//    shared CdnLottie component, same as NotificationScreen's empty/loading
//    states. Both platforms animate: native via lottie-react-native, web via
//    @lottiefiles/dotlottie-react (CdnLottie.web.tsx used to render an empty
//    box — that was the cause of the blank gap above the caption on web, and it
//    is fixed). The infinite-scroll footer keeps a plain spinner, matching Angular's
//    own <ion-infinite-scroll-content loadingSpinner="circular">.

import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native'

import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Colors } from '../../constants/colors'
import { CDN_LOTTIE, CDN_REACT, CDN_REACT_LOTTIE } from '../../constants/cdn'
import { StorageKeys } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import {
  fetchIgnoredProfiles, fetchBlockedProfiles, type IgnoredProfile, type IgnoredProfilesPage,
} from '../../service/ignoredProfilesService'
import { unblockProfile } from '../../service/communicationService'
import { handleBack } from '../../utils/navigationRef'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import CdnLottie from '../../components/CdnLottie'
import Toast, { type ToastRequest } from '../../components/toast/Toast'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import IgnoredProfilesDesktopScreen from './IgnoredProfilesDesktopScreen'
import { FontSize } from '../../src/theme/fonts'

const DEFAULT_PHOTO_MALE   = CDN_REACT + '/ignore_profile_male.svg'
const DEFAULT_PHOTO_FEMALE = CDN_REACT + '/ignore_profile_female.svg'

// Angular: menu-profiles.page.html's two <lottie-player> blocks —
//   empty   -> assets/jodii-lottie-files/profiles-you-removed.json
//   loading -> assets/jodii-lottie-files/like-list-loding-screen.json
//
// The empty-state animation now comes from this app's OWN uploaded copy under
// react/lottie-files (verified byte-identical to Angular's original).
//
// The loading one has NOT been uploaded there yet, so it still points at
// Angular's jodii-lottie-files folder — move it over and switch the constant
// when it is.
const LOTTIE_EMPTY   = CDN_REACT_LOTTIE + 'deleted_profile_empty.json'
const LOTTIE_LOADING = CDN_LOTTIE + 'like-list-loding-screen.json'
// Source animation is a 512x512 square. RN sizes are unitless NUMBERS -- a
// "380px" string is a type error and renders nothing. 380 is the cap; on
// narrower phones lottieSize() shrinks it to fit inside the 32pt side padding.
const LOTTIE_MAX = 380
const lottieSize = (viewportWidth: number) =>
  Math.min(LOTTIE_MAX, Math.max(0, viewportWidth - 64))

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
  const isDesktop = useIsDesktopWeb()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  // Read at render time (not module level) so it tracks rotation and split view.
  const { width: viewportWidth } = useWindowDimensions()
  const lottiePx = lottieSize(viewportWidth)

  const [activeTab,   setActiveTab]   = useState<Tab>('dontshow')
  const [profiles,    setProfiles]    = useState<IgnoredProfile[]>([])
  const [totalCount,  setTotalCount]  = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [toastRequest, setToastRequest] = useState<ToastRequest | null>(null)

  const tabRef      = useRef<Tab>('dontshow')
  const startRef    = useRef(0)
  const fetchingRef = useRef(false)
  // Monotonic request id — see load(). Guards against a stale response from a
  // superseded tab switch / re-focus overwriting the current tab's list.
  const reqIdRef    = useRef(0)
  const avatarRef   = useRef(DEFAULT_PHOTO_FEMALE)   // opposite-gender fallback, like ActivityScreen

  const load = useCallback(async (reset: boolean) => {
    // A reset — tab switch or screen focus — must NEVER be dropped: it
    // supersedes whatever is in flight. Previously the `fetchingRef` lock
    // rejected it, and because that bail-out sat ABOVE the try/finally,
    // setLoading(false) never ran. switchTab() had already cleared the list and
    // set loading true, so tapping the other tab while the first fetch was
    // still running left the screen stuck on the loading animation forever —
    // and un-recoverable, since `if (tab === activeTab) return` makes a second
    // tap on the same tab a no-op. Only an APPEND can be a redundant duplicate.
    if (!reset && fetchingRef.current) return
    fetchingRef.current = true
    if (reset) startRef.current = 0

    // Generation counter: only the newest request may commit results or clear
    // the loading flags. Replaces the old `tab !== tabRef.current` check, which
    // only caught tab switches and not a re-focus firing a second reset.
    const reqId = ++reqIdRef.current
    const tab = tabRef.current
    const fetchPage: (start: number, limit: number) => Promise<IgnoredProfilesPage> =
      tab === 'dontshow' ? fetchIgnoredProfiles : fetchBlockedProfiles

    try {
      const [female, page] = await Promise.all([
        reset ? getItem(StorageKeys.User.LOGIN_GENDER).then(g => g === '0') : Promise.resolve(null),
        fetchPage(startRef.current, LIMIT),
      ])
      if (reqId !== reqIdRef.current) return   // superseded by a newer load
      if (female !== null) avatarRef.current = female ? DEFAULT_PHOTO_MALE : DEFAULT_PHOTO_FEMALE

      setProfiles(prev => (reset ? page.items : [...prev, ...page.items]))
      setTotalCount(page.totalCount)
      // Advance by what actually arrived, not by a flat LIMIT — a short page
      // would otherwise skip records on the next request.
      startRef.current += page.items.length
    } finally {
      // A superseded request must not clear the flags out from under the newer
      // one that replaced it.
      if (reqId === reqIdRef.current) {
        fetchingRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
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

  // Desktop (Figma "Jodii Desktop - Registration" nodes 659:8567/735:31320)
  // needs the full MatchCardDesktop treatment (badges, Call/WhatsApp, "View
  // full profile") this screen's own IgnoredProfile shape can't drive — see
  // IgnoredProfilesDesktopScreen.tsx's header comment. Standalone screen with
  // its own state, same split EditProfileScreen.tsx uses. Checked after (not
  // before) the hooks above, matching that same precedent — isDesktop can
  // flip live on browser resize, so every hook here must run unconditionally.
  if (isDesktop) {
    return <IgnoredProfilesDesktopScreen navigation={navigation} />
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.headerWrap}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
            <CdnSvg uri={CDN_REACT + '/menu_back_arrow.svg'} width={24} height={24} />
          </Pressable>
          {/* Angular: getTitle() returns PROFILES.DONT_SHOW ("Profiles marked
              as Don't Show") for both tabs on this screen — only the separate
              'viewinglater' tab, which isn't part of this screen, uses a
              different key. MENU.IGNORED_PROFILES ("Ignored Profiles") is the
              menu ROW's label, not the page title. */}
          <Text style={s.headerTitle} numberOfLines={1}>{t('PROFILES.DONT_SHOW')}</Text>
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
        // Angular: the !contentLoaded row with like-list-loding-screen.json.
        <View style={s.center}>
          <CdnLottie uri={LOTTIE_LOADING} width={lottiePx} height={lottiePx} />
        </View>
      ) : profiles.length === 0 ? (
        // Angular: the no-content row — profiles-you-removed.json ABOVE the
        // per-tab caption (NORESULT_1 / NORESULT_22), which carries `pt-48
        // heading4-medium-16`, i.e. 48pt clear of the animation at 16px medium.
        <View style={s.center}>
          <CdnLottie uri={LOTTIE_EMPTY} width={lottiePx} height={lottiePx} />
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, marginBottom : 100 },
  // Angular's caption is `pt-48 heading4-medium-16` — 48pt clear of the
  // animation, 16px medium (not the 14px secondary-grey this had).
  emptyText: {
    fontSize: FontSize.font16, fontWeight: '500', color: '#333333',
    textAlign: 'center', lineHeight: 24, marginTop: 48,
  },

  headerWrap: {
    backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  header: { height: 56, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  headerTitle: { flex: 1, fontSize: FontSize.font16, fontWeight: '500', color: '#333333', marginLeft: 6, marginRight: 16 },

  // Angular: menu-profiles.page.html's `.messages-top-block` row plus
  // menu-profiles.page.scss:
  //   .messages-top-block      { border-bottom: 1px solid #e2e8f0;
  //                              margin-top: 12px; background-color: #fff }
  //   .messages-top-block ion-col { padding-bottom: 8px !important }
  //   .received-awaiting-active-border { border-bottom: 2px solid #B50033 }
  // The two <ion-col>s are size="5.8" with offset="0.4" on the second, i.e. two
  // equal ~48.3% halves that fill the row, each with its label CENTRED
  // (justify-content-center / text-align-center).
  //
  // This port had content-width tabs left-aligned with gap 20, so the labels
  // bunched at the left and the active underline only spanned the text rather
  // than the tab.
  tabsRow: {
    flexDirection: 'row', paddingHorizontal: 16, marginTop: 12,
    backgroundColor: Colors.white,
    // #e2e8f0 exactly — Colors.borderSubtle (#e6e6e6) is a warmer grey.
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    // Stands in for Angular's 0.4-of-12 column offset: at a 360pt screen the
    // row's content is 328 wide, so that offset is ~11pt and each tab ~158.5 —
    // flex: 1 either side of a 12pt gap gives 158. Visually identical.
    gap: 12,
  },
  // flex: 1 => the two equal halves; the underline therefore spans the whole
  // tab, which is what Angular puts the border on (the col, not the label).
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 8 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#B50033' },
  // Inactive: body2-regular-14 + black. Active: body1-medium-14 + #B50033.
  // Both line-height 18. Angular sets no letter-spacing — the 0.42 here was
  // invented.
  tabText: { fontSize: FontSize.font14, fontWeight: '400', lineHeight: 18, color: Colors.black },
  tabTextActive: { fontWeight: '500', color: '#B50033' },

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
  name: { fontSize: FontSize.font16, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6 },
  subText: { fontSize: FontSize.font14, color: Colors.black, lineHeight: 20 },
  deletedText: { fontSize: FontSize.font13, color: Colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
  linkBtn: { marginTop: 8, alignSelf: 'flex-start' },
  linkText: { fontSize: FontSize.font14, color: Colors.link, fontWeight: '500' },
})
