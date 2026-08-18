// Desktop layout for "Ignored profiles" (Figma "Jodii Desktop - Registration",
// UaPAN9aG6MfZf6CRpwXf1L — node 659:8567 "don't show" tab populated,
// 735:31320 "blocked" tab populated + Unblock menu, 659:14140/659:11626 empty
// states). Same account-sidebar shell as Settings/Edit preferences/Delete
// profile/View later (DesktopPageShell), not ActivityDesktopLayout's top-nav-
// only shell — reached from HomeSidebar, not the footer tabs.
//
// Standalone screen with its OWN state (like EditProfileDesktopScreen.tsx),
// not fed by IgnoredProfilesScreen.tsx — that mobile screen's data shape
// (IgnoredProfile: name/age/city/education/occupation/thumbImg) is
// deliberately narrower than what this richer desktop card needs
// (badges, Call/WhatsApp, Jodi ID, full basic-view line). Confirmed live
// against the real API that both endpoints actually return the full rich
// listing shape — ignoredProfilesService.ts's fetchIgnoredProfilesRich/
// fetchBlockedProfilesRich reuse the same toListingResult()/matchProfileAdapter
// pipeline Matches/Activity/ViewLater already go through, rather than
// changing mobile's own working narrower implementation.
//
// No Like/Don't-show/View-later CTA row and no Report — neither appears in
// the Figma design; only the Blocked tab shows a 3-dot menu, and its single
// item is "Unblock this profile" (ThreeDotMenu.tsx's new showUnblock prop).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import MatchCardDesktop from '../../components/matches/MatchCardDesktop'
import ThreeDotMenu from '../../components/matches/ThreeDotMenu'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import ContactDetailsSheet from '../../components/matches/ContactDetailsSheet'
import WhatsAppPaywallModal from '../../components/matches/WhatsAppPaywallModal'
import Toast, { type ToastRequest } from '../../components/toast/Toast'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { CDN_REACT } from '../../constants/cdn'
import { useContactGating } from '../../hooks/useContactGating'
import { usePhoneInfoSheet } from '../../hooks/usePhoneInfoSheet'
import { fetchIgnoredProfilesRich, fetchBlockedProfilesRich, type RichProfilesPage } from '../../service/ignoredProfilesService'
import { unblockProfile } from '../../service/communicationService'
import { communicationBtnOnClick, shouldSkipPhoneConfirm } from '../../service/communicationService'
import { redirectToViewProfile } from '../../service/buttonService'
import { getItem } from '../../service/storageService'
import { openMembershipTab } from '../../service/paymentService'
import { StorageKeys } from '../../constants/storage.keys'
import { Colors } from '../../constants/colors'
import type { MatchProfile } from '../../types/interfaces/matches.interface'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

// Figma nodes 659:15243 (don't-show empty)/659:13163 (blocked empty) — same
// cloud backdrop behind a tab-specific circular icon (person+X vs person+block).
// No equivalent asset existed anywhere in the old Angular project's assets
// dir, so these were downloaded from Figma and are now CDN-hosted.
const EMPTY_CLOUD       = CDN_REACT + '/ignored-profiles-empty-cloud.svg'
const EMPTY_ICON_DONTSHOW = CDN_REACT + '/ignored-profiles-dontshow-empty-icon.svg'
const EMPTY_ICON_BLOCKED  = CDN_REACT + '/ignored-profiles-blocked-empty-icon.svg'

const LIMIT = 20
// Figma node 606:6239 gives every other MatchCardDesktop caller a 248×248
// photo; this screen's own real frames (659:8567/735:31320) use a smaller
// 160×160 photo instead — confirmed via get_design_context, not a guess.
const PHOTO_SIZE = 160
type Tab = 'dontshow' | 'blocked'

type Props = { navigation: any }

export default function IgnoredProfilesDesktopScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const gating = useContactGating()

  const [activeTab,   setActiveTab]   = useState<Tab>('dontshow')
  const [profiles,    setProfiles]    = useState<MatchProfile[]>([])
  const [totalCount,  setTotalCount]  = useState(0)
  // Figma nodes 659:8567/735:31320: the header title shows a COMBINED count
  // (dontshow + blocked, e.g. "(12)" = 8+4), while each tab chip shows its
  // OWN count simultaneously, regardless of which tab is active — confirmed
  // by cross-checking both frames' mock numbers add up. Needs both tabs'
  // totals known at once, not just whichever is currently loaded.
  const [counts,      setCounts]      = useState<{ dontshow: number; blocked: number }>({ dontshow: 0, blocked: 0 })
  const [loaded,      setLoaded]      = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [userName,    setUserName]    = useState('')
  const [openMenuId,  setOpenMenuId]  = useState<string | null>(null)

  const tabRef      = useRef<Tab>('dontshow')
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

  useEffect(() => {
    getItem(StorageKeys.User.NAME).then(name => setUserName(name ?? ''))
  }, [])

  function fetchPageFor(tab: Tab): (start: number, limit: number) => Promise<RichProfilesPage> {
    return tab === 'dontshow' ? fetchIgnoredProfilesRich : fetchBlockedProfilesRich
  }

  // Lightweight (LIMIT=1) count-only fetch for whichever tab ISN'T the one
  // being loaded in full below — keeps both chips' counts fresh without a
  // second full listing fetch.
  async function loadOtherCount(tab: Tab) {
    try {
      const page = await fetchPageFor(tab)(0, 1)
      setCounts(prev => ({ ...prev, [tab]: page.totalCount }))
    } catch { /* silent — a stale chip count isn't worth surfacing an error for */ }
  }

  const load = useCallback(async (reset: boolean) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    if (reset) startRef.current = 0

    const tab = tabRef.current
    if (reset) loadOtherCount(tab === 'dontshow' ? 'blocked' : 'dontshow')

    try {
      const page = await fetchPageFor(tab)(startRef.current, LIMIT)
      if (tab !== tabRef.current) return   // tab switched again while this was in flight
      setProfiles(prev => (reset ? page.items : [...prev, ...page.items]))
      setTotalCount(page.totalCount)
      setCounts(prev => ({ ...prev, [tab]: page.totalCount }))
      startRef.current += LIMIT
    } finally {
      fetchingRef.current = false
      setLoaded(true)
      setLoadingMore(false)
    }
  }, [])

  // Same convention as the mobile screen: refetch on focus rather than a live
  // event subscription (e.g. un-ignoring from ViewProfileScreen).
  useFocusEffect(useCallback(() => { load(true) }, [load]))

  function switchTab(tab: Tab) {
    if (tab === activeTab) return
    tabRef.current = tab
    setActiveTab(tab)
    setLoaded(false)
    setProfiles([])
    setTotalCount(0)
    setOpenMenuId(null)
    load(true)
  }

  function loadMore() {
    if (loadingMore || profiles.length >= totalCount || !loaded) return
    setLoadingMore(true)
    load(false)
  }

  function handlePress(profile: MatchProfile) {
    redirectToViewProfile('', profile.profileId, 'menu', profiles.map(p => p.profileId))
  }

  function handleMenuPress(profile: MatchProfile) {
    setOpenMenuId(prev => prev === profile.profileId ? null : profile.profileId)
  }

  async function handleUnblock(profile: MatchProfile) {
    setOpenMenuId(null)
    const ok = await unblockProfile(profile.profileId)
    if (ok) {
      setProfiles(prev => prev.filter(p => p.profileId !== profile.profileId))
      setTotalCount(prev => Math.max(0, prev - 1))
      setCounts(prev => ({ ...prev, blocked: Math.max(0, prev.blocked - 1) }))
    }
    showToast(ok ? t('PRIVACY.SUCCESS_TOAST', 'Profile unblocked') : 'Something went wrong. Please try again.')
  }

  // ── Contact flow (Call/WhatsApp) — same confirm → communicationBtnOnClick →
  // result dispatch ActivityScreen.tsx/ViewLaterScreen.tsx already establish. ──

  function confirmThenContact(profile: MatchProfile, action: 'call' | 'whatsapp') {
    if (shouldSkipPhoneConfirm(profile.phoneViewed, profile.likedStatus, gating.indNumbersLeft, gating.ownEntryType)) {
      handleContactConfirmYes({ profile, action })
    } else {
      setContactConfirm({ profile, action })
    }
  }

  function getContactConfirmContent(): string {
    if (!contactConfirm) return ''
    const question = t('VIEWPROFILE.VIEWPHONECONFIRM')
      .replace('#HISHER#', t(`PRONOUN.${gating.oppGender}.hisher`))
      .replace('#HIMHER#', t(`PRONOUN.${gating.oppGender}.himher`))
    const quota = t('VIEWPROFILE.VIEWPHONEDETAIL')
      .replace('#VAR#', gating.contactQuota.viewed)
      .replace('#VAR1#', gating.contactQuota.left)
      .replace('#VAR2#', gating.contactQuota.expiry)
    return `${question}\n\n${quota}`
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
      const result = await communicationBtnOnClick('menu', action, { MATRIID: profile.profileId })
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
    } catch { /* silent — matches this app's established convention */ }
  }

  function handleContactDetailsClose() { setContactDetails(null) }
  function handleContactDetailsCall() {
    if (contactDetails?.dialNumber) Linking.openURL(`tel:${contactDetails.dialNumber}`)
  }
  function handleContactDetailsWhatsApp() {
    const num = contactDetails?.whatsappNumber?.replace(/\D/g, '')
    if (num) Linking.openURL(`https://wa.me/${num}`)
  }

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 3: openMembershipTab(); break
      case 4: navigation.navigate('MessagerList'); break
    }
  }

  function noop() {}

  // Figma nodes 659:8567/735:31320: title's own "(N)" is dontshow+blocked
  // combined (8+4=12 in the mock) — different from Angular mobile's
  // menu-profiles.page.ts getTitle(), which never suffixes this tab's title
  // at all. Desktop's real frame shows this consistently across both tab
  // variants, so it's genuine intended behavior here, not mockup filler.
  const combinedTotal = counts.dontshow + counts.blocked
  const title = combinedTotal > 0 ? `${t('PROFILES.DONT_SHOW')} (${combinedTotal})` : t('PROFILES.DONT_SHOW')

  const emptyText = activeTab === 'dontshow' ? t('PROFILES.NORESULT_1') : t('PROFILES.NORESULT_22')
  const emptyIcon = activeTab === 'dontshow' ? EMPTY_ICON_DONTSHOW : EMPTY_ICON_BLOCKED

  function renderItem({ item }: { item: MatchProfile }) {
    return (
      <MatchCardDesktop
        profile={item}
        oppGender={gating.oppGender}
        ownEntryType={gating.ownEntryType}
        femaleFreeEligible={gating.femaleFreeEligible}
        indNumbersLeft={gating.indNumbersLeft}
        photoSize={PHOTO_SIZE}
        onPress={() => handlePress(item)}
        onLike={noop}
        onDontShow={noop}
        onViewLater={noop}
        onCall={() => confirmThenContact(item, 'call')}
        onWhatsApp={() => confirmThenContact(item, 'whatsapp')}
        menu={activeTab === 'blocked' ? {
          open: openMenuId === item.profileId,
          onPress: () => handleMenuPress(item),
          content: (
            <ThreeDotMenu
              showUnblock
              onUnblock={() => handleUnblock(item)}
              positionStyle={s.menuDropdown}
            />
          ),
        } : undefined}
      />
    )
  }

  return (
    <DesktopPageShell navigation={navigation} userName={userName} activeItem="ignoredProfiles" onTabPress={handleTabPress}>
      <View style={s.header}>
        <Text style={s.title}>{title}</Text>

        <View style={s.tabRow}>
          <Pressable style={[s.chip, activeTab === 'dontshow' && s.chipActive]} onPress={() => switchTab('dontshow')}>
            <Text style={s.chipLabel}>
              {t('PROFILES.DONT_SHOW_TITLE')}{counts.dontshow > 0 ? ` (${counts.dontshow})` : ''}
            </Text>
          </Pressable>
          <Pressable style={[s.chip, activeTab === 'blocked' && s.chipActive]} onPress={() => switchTab('blocked')}>
            <Text style={s.chipLabel}>
              {t('PROFILES.BLOCKED_PROFILES')}{counts.blocked > 0 ? ` (${counts.blocked})` : ''}
            </Text>
          </Pressable>
        </View>
      </View>

      {!loaded ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={item => item.profileId}
          style={s.list}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={Colors.primaryDark} style={s.footerLoader} /> : null}
          ListEmptyComponent={(
            <View style={s.emptyBox}>
              <View style={s.emptyIllustration}>
                <CdnSvg uri={EMPTY_CLOUD} width={195} height={134} style={s.emptyCloud} />
                <CdnSvg uri={emptyIcon} width={72} height={72} style={s.emptyIcon} />
              </View>
              <Text style={s.emptyText}>{emptyText}</Text>
            </View>
          )}
          contentContainerStyle={s.listContent}
        />
      )}

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
    </DesktopPageShell>
  )
}

const s = StyleSheet.create({
  header: { width: 810, marginBottom: 24 },
  title: { fontFamily: Fonts.poppinsSemiBold, fontSize: 22, color: Colors.black },

  tabRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: Colors.inputBorder,
  },
  chipActive: { backgroundColor: Colors.chipSurfaceSelected, borderColor: Colors.chipBorderActive },
  chipLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black },

  list: { width: 810 },
  listContent: { paddingBottom: 32 },
  loadingWrap: { width: 810, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  footerLoader: { marginVertical: 16 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 64, gap: 24 },
  // Figma nodes 659:15243/659:13163: 180×180 box — cloud centered, overflowing
  // slightly wide (195px) and inset from the top; icon a 72×72 circle centered
  // just past the box's vertical middle.
  emptyIllustration: { width: 180, height: 180, position: 'relative' },
  emptyCloud: { position: 'absolute', top: 12, left: 90, marginLeft: -97.5 },
  emptyIcon: { position: 'absolute', top: 90, left: 54 },
  emptyText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black, textAlign: 'center' },

  menuDropdown: { top: 32, right: 0 },
})
