// "Profile marked as view later" — Angular equivalent: pages/menu-profiles/
// menu-profiles.page.ts (varPageType='2', currentTab='viewinglater'). No
// dedicated screen existed in this port yet (HomeSidebar's own row was a
// TODO no-op) — built fresh for both platforms, following the desktop Figma
// design (UaPAN9aG6MfZf6CRpwXf1L, node 647:14826): a plain single-column list
// of full MatchCard-style rows (badges, Call/WhatsApp, "View full profile"),
// no tabs. Angular's own mobile card for this tab is plainer
// (<app-list-view-card>, no Call/WhatsApp) — Figma's desktop design is
// explicitly richer, so this reuses the same MatchCard/MatchCardDesktop +
// contact-gating machinery ActivityScreen.tsx already established, on both
// platforms, rather than replicating Angular's narrower mobile treatment.
//
// No Like/Don't-show/View-later CTA row and no 3-dot report/remove menu —
// neither appears in the Figma design, and this listing's own profiles never
// carry a likedStatus of '0'-'3' (showLikeCTA/showAfterLikeCTA both stay
// false), so the shared card naturally renders just the simpler shape.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import Toast, { type ToastRequest } from '../../components/toast/Toast'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import ContactDetailsSheet from '../../components/matches/ContactDetailsSheet'
import WhatsAppPaywallModal from '../../components/matches/WhatsAppPaywallModal'
import { MatchCard } from '../matches/MatchesScreen'
import ViewLaterDesktopLayout from './ViewLaterDesktopLayout'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { useContactGating } from '../../hooks/useContactGating'
import { usePhoneInfoSheet } from '../../hooks/usePhoneInfoSheet'
import { matchProfileAdapter } from '../../adapters/matches.adapter'
import { fetchViewLaterProfiles } from '../../service/viewLaterService'
import { communicationBtnOnClick, shouldSkipPhoneConfirm, getContactConfirmContent as getSharedContactConfirmContent } from '../../service/communicationService'
import { redirectToViewProfile } from '../../service/buttonService'
import { handleBack } from '../../utils/navigationRef'
import { getItem } from '../../service/storageService'
import { openMembershipTab } from '../../service/paymentService'
import { StorageKeys } from '../../constants/storage.keys'
import { CDN_REACT } from '../../constants/cdn'
import { Colors } from '../../constants/colors'
import type { MatchProfile } from '../../types/interfaces/matches.interface'
import type { FooterTab } from '../../components/app-footer/AppFooter'

const FROM_PAGE = 'viewinglater'
const LIMIT = 20

type Props = { navigation: any }

export default function ViewLaterScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const isDesktop = useIsDesktopWeb()
  const gating = useContactGating()

  const [profiles,    setProfiles]    = useState<MatchProfile[]>([])
  const [totalCount,  setTotalCount]  = useState(0)
  const [loaded,      setLoaded]      = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [userName,    setUserName]    = useState('')

  useEffect(() => {
    getItem(StorageKeys.User.NAME).then(name => setUserName(name ?? ''))
  }, [])

  const startRef    = useRef(0)
  const fetchingRef = useRef(false)

  const [contactConfirm, setContactConfirm] = useState<{ profile: MatchProfile; action: 'call' | 'whatsapp' } | null>(null)
  const [contactDetails, setContactDetails] = useState<{
    name: string; mobile?: string | undefined; dialNumber?: string | undefined; whatsappNumber?: string | undefined
    showCounter?: boolean | undefined; viewedCount?: string | undefined; totalCount?: string | undefined
    idVerified?: boolean | undefined
  } | null>(null)
  const [whatsappPaywallProfile, setWhatsappPaywallProfile] = useState<MatchProfile | null>(null)
  const [toastRequest, setToastRequest] = useState<ToastRequest | null>(null)
  const phoneInfo = usePhoneInfoSheet()

  function showToast(message: string) {
    setToastRequest({ message, key: Date.now() })
  }

  const load = useCallback(async (reset: boolean) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    if (reset) startRef.current = 0

    try {
      const result = await fetchViewLaterProfiles(startRef.current, LIMIT)
      const adapted = result.items.map(matchProfileAdapter.adapt)
      setProfiles(prev => (reset ? adapted : [...prev, ...adapted]))
      if (reset) setTotalCount(result.totalCount)
      startRef.current += LIMIT
    } finally {
      fetchingRef.current = false
      setLoaded(true)
      setLoadingMore(false)
    }
  }, [])

  // Refetch on focus — a profile un-marked from ViewProfileScreen's own "View
  // later" toggle should disappear from this list on return, same convention
  // IgnoredProfilesScreen.tsx already uses for its own dontshow/blocked tabs.
  useFocusEffect(useCallback(() => { load(true) }, [load]))

  const hasMore = profiles.length < totalCount
  function loadMore() {
    if (loadingMore || !hasMore || !loaded) return
    setLoadingMore(true)
    load(false)
  }

  function handlePress(profile: MatchProfile) {
    redirectToViewProfile('', profile.profileId, FROM_PAGE, profiles.map(p => p.profileId))
  }

  function confirmThenContact(profile: MatchProfile, action: 'call' | 'whatsapp') {
    if (shouldSkipPhoneConfirm(profile.phoneViewed, profile.likedStatus, gating.indNumbersLeft, gating.ownEntryType)) {
      handleContactConfirmYes({ profile, action })
    } else {
      setContactConfirm({ profile, action })
    }
  }

  function getContactConfirmContent(): string {
    if (!contactConfirm) return ''
    return getSharedContactConfirmContent(t, gating.oppGender, gating.contactQuota)
  }

  function handleContactConfirmClose() {
    setContactConfirm(null)
  }

  async function handleContactConfirmYes(override?: { profile: MatchProfile; action: 'call' | 'whatsapp' }) {
    const pending = override ?? contactConfirm
    if (!pending) return
    const { profile, action } = pending
    setContactConfirm(null)
    try {
      const result = await communicationBtnOnClick(FROM_PAGE, action, { MATRIID: profile.profileId })
      if (result.type === 'show_contact') {
        setContactDetails({
          name: profile.name, mobile: result.mobile, dialNumber: result.dialNumber, whatsappNumber: result.whatsappNumber,
          showCounter: result.showCounter, viewedCount: result.viewedCount, totalCount: result.totalCount,
          idVerified: profile.isIdVerified,
        })
      } else if (result.type === 'payment_promo') {
        if (action === 'whatsapp') setWhatsappPaywallProfile(profile)
        else navigation.navigate('recharge')
      } else if (result.type === 'error') {
        showToast(result.message)
      } else {
        await phoneInfo.handleResult(result)
      }
    } catch { /* silent — matches MatchesScreen/ActivityScreen's own convention */ }
  }

  function handleContactDetailsClose() { setContactDetails(null) }
  function handleContactDetailsCall() {
    if (contactDetails?.dialNumber) Linking.openURL(`tel:${contactDetails.dialNumber}`)
  }
  function handleContactDetailsWhatsApp() {
    const num = contactDetails?.whatsappNumber?.replace(/\D/g, '')
    if (num) Linking.openURL(`https://wa.me/${num}`)
  }

  function noop() {}

  const title = totalCount > 0
    ? `${t('GENERAL.VIEWLATER_PROFILES')} (${totalCount})`
    : t('GENERAL.VIEWLATER_PROFILES')

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 3: openMembershipTab(); break
      case 4: navigation.navigate('MessagerList'); break
    }
  }

  const sheets = (
    <>
      <BottomSheet
        visible={!!contactConfirm}
        type="viewPhoneConfirm"
        data={{ content: getContactConfirmContent(), ctaLabel: t('ACCOUNT.YES', 'Yes') }}
        onClose={handleContactConfirmClose}
        onPrimaryPress={handleContactConfirmYes}
      />
      {contactDetails && (
        <ContactDetailsSheet
          visible
          name={contactDetails.name}
          mobile={contactDetails.mobile}
          whatsappNumber={contactDetails.whatsappNumber}
          showCounter={contactDetails.showCounter}
          viewedCount={contactDetails.viewedCount}
          totalCount={contactDetails.totalCount}
          showNotVerifiedNote={!contactDetails.idVerified && gating.loginGender === 'F'}
          onClose={handleContactDetailsClose}
          onCall={handleContactDetailsCall}
          onWhatsApp={handleContactDetailsWhatsApp}
        />
      )}
      <WhatsAppPaywallModal
        visible={!!whatsappPaywallProfile}
        profile={whatsappPaywallProfile}
        oppGender={gating.oppGender}
        onClose={() => setWhatsappPaywallProfile(null)}
        onPayNow={() => { setWhatsappPaywallProfile(null); navigation.navigate('recharge') }}
      />
      <BottomSheet
        visible={!!phoneInfo.sheet}
        type="phonePrivacyInfo"
        data={phoneInfo.getData(t)}
        onClose={phoneInfo.close}
        onPrimaryPress={() => phoneInfo.primaryPress(navigation)}
        onSecondaryPress={() => phoneInfo.secondaryPress(navigation)}
        onLinkPress={phoneInfo.close}
      />
      <Toast request={toastRequest} />
    </>
  )

  if (isDesktop) {
    return (
      <ViewLaterDesktopLayout
        navigation={navigation}
        userName={userName}
        title={title}
        profiles={profiles}
        loaded={loaded}
        loadingMore={loadingMore}
        gating={gating}
        onTabPress={handleTabPress}
        onLoadMore={loadMore}
        onPress={handlePress}
        onCall={p => confirmThenContact(p, 'call')}
        onWhatsApp={p => confirmThenContact(p, 'whatsapp')}
      >
        {sheets}
      </ViewLaterDesktopLayout>
    )
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={CDN_REACT + '/menu_back_arrow.svg'} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
      </View>

      {!loaded ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.primaryDark} size="large" />
        </View>
      ) : profiles.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>{t('PROFILES.NORESULT_2')}</Text>
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={item => item.profileId}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => (
            <MatchCard
              profile={item}
              oppGender={gating.oppGender}
              ownEntryType={gating.ownEntryType}
              femaleFreeEligible={gating.femaleFreeEligible}
              indNumbersLeft={gating.indNumbersLeft}
              onPress={() => handlePress(item)}
              onLike={noop}
              onDontShow={noop}
              onViewLater={noop}
              onCall={() => confirmThenContact(item, 'call')}
              onWhatsApp={() => confirmThenContact(item, 'whatsapp')}
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={s.footerLoader} color={Colors.primaryDark} /> : null}
          showsVerticalScrollIndicator={false}
        />
      )}

      {sheets}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: '#333333', marginLeft: 6, marginRight: 16 },

  listContent: { paddingTop: 16, paddingHorizontal: 16 },
  footerLoader: { paddingVertical: 24 },
})
