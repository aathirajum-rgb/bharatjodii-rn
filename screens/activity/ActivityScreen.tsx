// Liked Profile screen — Angular: activity.component.ts/.html (route `/activity`,
// tabs `likedyou`/`likesent`). Figma "2026 - Design Enhancement" nodes 2036:2568
// (paid) / 2036:2719 (unpaid), file NtASk18Qa7um4vjCvfMHEH.
//
// Reuses the EXACT same card component MatchesScreen.tsx uses (MatchCard) —
// confirmed against Angular's own source that /matches and /activity both
// render the same `app-matches-card` component, so this isn't just DRY
// cleanup, it matches Angular's real architecture. MatchCard's existing
// after-like CTA logic (matchesCard.shared.tsx's getAfterLikeContentText/
// getAfterLikeCtaLabel) already produces the exact paid/unpaid copy in both
// Figma frames ("Talk to him/her directly"+"View phone number" vs "To contact
// via Call/WhatsApp"+"Pay Now") and the liked-strip already renders the
// pink "You liked ... on DATE" pill — reusing it gives us that design for free,
// we only need to feed it correctly-adapted data.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import LanguagePill from '../../components/language-pill/LanguagePill'
import Toast, { type ToastRequest } from '../../components/toast/Toast'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import ContactDetailsSheet from '../../components/matches/ContactDetailsSheet'
import ReportProfileModal from '../../components/matches/ReportProfileModal'
import ThreeDotMenu from '../../components/matches/ThreeDotMenu'
import WhatsAppPaywallModal from '../../components/matches/WhatsAppPaywallModal'
import { MatchCard } from '../matches/MatchesScreen'
import ActivityDesktopLayout from './ActivityDesktopLayout'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { useContactGating } from '../../hooks/useContactGating'
import { usePhoneInfoSheet } from '../../hooks/usePhoneInfoSheet'
import { matchProfileAdapter } from '../../adapters/matches.adapter'
import { fetchActivityListingPage } from '../../service/activityService'
import { communicationBtnOnClick, shouldSkipPhoneConfirm, getContactConfirmContent as getSharedContactConfirmContent } from '../../service/communicationService'
import { redirectToViewProfile } from '../../service/buttonService'
import { openMembershipTab } from '../../service/paymentService'
import { fetchNotifCount } from '../../service/homeService'
import { logEvent, logScreen } from '../../service/analyticsService'
import { getItem, getJson, setJson } from '../../service/storageService'
import { StorageKeys } from '../../constants/storage.keys'
import { Colors } from '../../constants/colors'
import i18n from '../../i18n'
import type { MatchProfile } from '../../types/interfaces/matches.interface'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route?: any }
export type LikedTab = 'likedyou' | 'likesent'

interface TabData {
  profiles:    MatchProfile[]
  total:       number
  hasMore:     boolean
  loadingMore: boolean
  start:       number
  loaded:      boolean
}

const LIMIT = 20
const INITIAL_TAB_DATA: TabData = { profiles: [], total: 0, hasMore: true, loadingMore: false, start: 0, loaded: false }

// ─── ActivityScreen ───────────────────────────────────────────────────────────

export default function ActivityScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const isDesktop = useIsDesktopWeb()
  const gating = useContactGating()

  const [activeTab,   setActiveTab]   = useState<LikedTab>('likesent')
  const [initialLoad, setInitialLoad] = useState(true)
  const [tabData, setTabData] = useState<Record<LikedTab, TabData>>({
    likedyou: { ...INITIAL_TAB_DATA },
    likesent: { ...INITIAL_TAB_DATA },
  })

  const userIdRef = useRef('')

  // ── Contact flow state (confirm → communicationBtnOnClick → result) ────────
  // Angular button.component.ts's two-step contact reveal: confirm → phoneviewed
  // API → Contact Details sheet, same as MatchesScreen.tsx.
  const [contactConfirm, setContactConfirm] = useState<{ profile: MatchProfile; action: 'call' | 'whatsapp' } | null>(null)
  const [contactDetails, setContactDetails] = useState<{
    name: string; mobile?: string | undefined; dialNumber?: string | undefined; whatsappNumber?: string | undefined
    showCounter?: boolean | undefined; viewedCount?: string | undefined; totalCount?: string | undefined
    idVerified?: boolean | undefined
  } | null>(null)
  const [whatsappPaywallProfile, setWhatsappPaywallProfile] = useState<MatchProfile | null>(null)
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null)
  // Angular: report-remove-profile.component's own visibility toggle — only
  // one card's dropdown is open at a time.
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [toastRequest, setToastRequest] = useState<ToastRequest | null>(null)
  // The ~10 other phoneviewed/pre-flight results (phone protected, FUP limit,
  // ID-verify prompt, female-free variants, etc.) — see usePhoneInfoSheet.ts.
  const phoneInfo = usePhoneInfoSheet()

  // ── Unread "new" badge per tab — Angular: common.getNotificationCount(1) →
  // notificationcount API's COMCOUNT array, persisted-viewed via localStorage
  // VIEWEDACTIVITYLIST so the badge disappears once a tab's been opened. ──────
  const [newCounts, setNewCounts] = useState<Record<LikedTab, number>>({ likedyou: 0, likesent: 0 })
  const [viewedTabs, setViewedTabs] = useState<Record<string, boolean>>({})

  function showToast(message: string) {
    setToastRequest({ message, key: Date.now() })
  }

  // ── Data helpers ─────────────────────────────────────────────────────────────

  function updateTab(tab: LikedTab, patch: Partial<TabData>) {
    setTabData(prev => ({ ...prev, [tab]: { ...prev[tab], ...patch } }))
  }

  function patchProfile(tab: LikedTab, profileId: string, patch: Partial<MatchProfile>) {
    setTabData(prev => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        profiles: prev[tab].profiles.map(p => p.profileId === profileId ? { ...p, ...patch } : p),
      },
    }))
  }

  function removeProfile(tab: LikedTab, profileId: string) {
    setTabData(prev => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        profiles: prev[tab].profiles.filter(p => p.profileId !== profileId),
        total: Math.max(0, prev[tab].total - 1),
      },
    }))
  }

  // ── API ──────────────────────────────────────────────────────────────────────

  async function loadTab(tab: LikedTab, start: number, isFirst: boolean) {
    if (isFirst) updateTab(tab, { loaded: false })
    else         updateTab(tab, { loadingMore: true })

    try {
      const result = await fetchActivityListingPage(tab, userIdRef.current, start, LIMIT)
      const adapted = result.items.map(matchProfileAdapter.adapt)
      const hasMore = result.items.length >= LIMIT

      setTabData(prev => {
        const existing = prev[tab]
        return {
          ...prev,
          [tab]: {
            profiles:    isFirst ? adapted : [...existing.profiles, ...adapted],
            total:       isFirst ? result.totalCount : existing.total,
            hasMore,
            loadingMore: false,
            start:       start + LIMIT,
            loaded:      true,
          },
        }
      })
    } catch {
      updateTab(tab, { loaded: true, loadingMore: false })
    }
  }

  // Angular: activity.component.ts's viewedActivitytList — a tab's unread badge
  // is cleared the moment it's actually opened, persisted so it stays cleared
  // across app restarts.
  async function markTabViewed(tab: LikedTab) {
    setViewedTabs(prev => {
      if (prev[tab]) return prev
      const next = { ...prev, [tab]: true }
      setJson('VIEWEDACTIVITYLIST', next).catch(() => {})
      return next
    })
  }

  useEffect(() => {
    logScreen('Activity')
    Promise.all([
      getItem(StorageKeys.Auth.USER_ID),
      getItem(StorageKeys.User.LOGIN_GENDER),
      getJson<Record<string, boolean>>('VIEWEDACTIVITYLIST'),
      fetchNotifCount().catch(() => ({ newCount: 0, comCount: [] })),
    ]).then(async ([id, loginG, viewed, notif]) => {
      userIdRef.current = id ?? ''
      const initialTab: LikedTab = loginG === 'F' ? 'likedyou' : 'likesent'
      setActiveTab(initialTab)
      setViewedTabs(viewed ?? {})

      const likedYouEntry = notif.comCount.find(c => c.comtype === 'likedyou')
      const likeSentEntry = notif.comCount.find(c => c.comtype === 'likesent' || c.comtype === 'likedbyme')
      setNewCounts({
        likedyou: Number(likedYouEntry?.newcount ?? 0),
        likesent: Number(likeSentEntry?.newcount ?? 0),
      })

      await Promise.all([
        loadTab('likedyou', 0, true),
        loadTab('likesent', 0, true),
      ])
      setInitialLoad(false)
      markTabViewed(initialTab)
    })
  }, [])

  // Angular: changeLanguage() (activity.component.ts:1442-1459) — tears down and
  // re-fetches so server-rendered/translated content refreshes in the new
  // language. Skips the initial mount (already covered above).
  const mountedLangRef = useRef(i18n.language)
  useEffect(() => {
    if (i18n.language === mountedLangRef.current) return
    mountedLangRef.current = i18n.language
    loadTab('likedyou', 0, true)
    loadTab('likesent', 0, true)
  }, [i18n.language])

  function switchTab(tab: LikedTab) {
    if (tab === activeTab) return
    setActiveTab(tab)
    logEvent({ category: 'activity', action: 'tab_click', label: tab })
    markTabViewed(tab)
    if (!tabData[tab].loaded) loadTab(tab, 0, true)
  }

  const handleEndReached = useCallback(() => {
    const d = tabData[activeTab]
    if (!d.loadingMore && d.hasMore && d.loaded) loadTab(activeTab, d.start, false)
  }, [tabData, activeTab])

  // ── Card action handlers ──────────────────────────────────────────────────────
  // Angular: matches-card.component.ts's clickOn*() → communication.service.ts's
  // communicationBtnOnClick() — same dispatcher MatchesScreen.tsx uses, 'activity'
  // as fromPage (Angular's own variant string for this exact screen).

  function handlePress(profile: MatchProfile) {
    const ids = tabData[activeTab].profiles.map(p => p.profileId)
    redirectToViewProfile('', profile.profileId, 'activity', ids)
  }

  async function handleLike(profile: MatchProfile) {
    patchProfile(activeTab, profile.profileId, { likedStatus: '1' })
    try {
      const result = await communicationBtnOnClick('activity', 'like', { MATRIID: profile.profileId })
      if (result.type === 'error') {
        patchProfile(activeTab, profile.profileId, { likedStatus: '0' })
        showToast(result.message)
      } else if (result.type === 'api_success' && result.message) {
        showToast(result.message)
      }
    } catch { /* keep optimistic state — matches MatchesScreen's own silent-catch convention */ }
  }

  async function handleDontShow(profile: MatchProfile) {
    removeProfile(activeTab, profile.profileId)
    try {
      await communicationBtnOnClick('activity', 'dontshow', { MATRIID: profile.profileId })
      showToast(t('VIEWPROFILE.SKIP_PROFILE'))
    } catch { /* card already removed client-side, matches Angular's optimistic behavior */ }
  }

  async function handleViewLater(profile: MatchProfile) {
    removeProfile(activeTab, profile.profileId)
    try {
      await communicationBtnOnClick('activity', 'viewlater', { MATRIID: profile.profileId })
      showToast(t('GENERAL.PROFILE_LATER'))
    } catch { /* same as above */ }
  }

  // Angular button.component.ts's showContactDetails() (communication.service.ts:
  // 253-271) — the confirm step is only shown when NEITHER direct-reveal
  // condition is met (already viewed this profile before, or mutual-like+paid+
  // quota-left) — not unconditionally. Rendered via the same generic
  // BottomSheet(type="viewPhoneConfirm") MatchesScreen.tsx uses.
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
      const result = await communicationBtnOnClick('activity', action, { MATRIID: profile.profileId })
      if (result.type === 'show_contact') {
        setContactDetails({
          name: profile.name, mobile: result.mobile, dialNumber: result.dialNumber, whatsappNumber: result.whatsappNumber,
          showCounter: result.showCounter, viewedCount: result.viewedCount, totalCount: result.totalCount,
          idVerified: profile.isIdVerified,
        })
      } else if (result.type === 'payment_promo') {
        // Angular: same {type:'payment_promo'} MatchesScreen.tsx handles — WhatsApp
        // gets a confirm modal first ("Pay now" inside it navigates), Call goes
        // straight to recharge.
        if (action === 'whatsapp') setWhatsappPaywallProfile(profile)
        else navigation.navigate('recharge')
      } else if (result.type === 'error') {
        showToast(result.message)
      } else {
        await phoneInfo.handleResult(result)
      }
    } catch { /* silent — matches MatchesScreen's own convention */ }
  }

  function handleContactDetailsClose() { setContactDetails(null) }
  function handleContactDetailsCall() {
    if (contactDetails?.dialNumber) Linking.openURL(`tel:${contactDetails.dialNumber}`)
  }
  function handleContactDetailsWhatsApp() {
    const num = contactDetails?.whatsappNumber?.replace(/\D/g, '')
    if (num) Linking.openURL(`https://wa.me/${num}`)
  }

  // Angular matches-card.component.ts:262-270 clickOnReportProfile() →
  // communicationBtnOnClick('reportprofile') fires a SILENT report/profile/v1
  // hit first; the reasons-picker only opens on that call's success
  // (communication.service.ts:139-141, 485-488) — not a direct open.
  async function handleReportPress(profile: MatchProfile) {
    setOpenMenuId(null)
    try {
      const result = await communicationBtnOnClick('activity', 'reportprofile', { MATRIID: profile.profileId })
      if (result.type === 'report_popup') {
        setReportTarget({ id: profile.profileId, name: profile.name })
      } else if (result.type === 'error') {
        showToast(result.message)
      }
    } catch { /* silent — matches this service's own convention elsewhere */ }
  }

  // Angular: IsShowRemoveProfile — only true on the "Liked by you" tab, you
  // can't remove a profile from "Who liked you". Same dontshow action as the
  // swipe-style Don't Show CTA, just triggered from the 3-dot menu instead.
  function handleRemovePress(profile: MatchProfile) {
    setOpenMenuId(null)
    handleDontShow(profile)
  }

  function handleMenuPress(profile: MatchProfile) {
    setOpenMenuId(prev => prev === profile.profileId ? null : profile.profileId)
  }

  // ── Footer nav ────────────────────────────────────────────────────────────────

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 3: openMembershipTab(); break
      case 4: navigation.navigate('MessagerList'); break
      // case 2 is this screen — do nothing
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────────

  const current  = tabData[activeTab]
  const isPaid   = !['B', 'F'].includes(gating.ownEntryType)

  function tabLabel(tab: LikedTab): string {
    const count = tabData[tab].total
    const base  = tab === 'likedyou' ? t('LIKE_LIST.LIKEDYOU_TITLE') : t('LIKE_LIST.LIKESENT_TITLE')
    return count > 0 ? `${base} (${count})` : base
  }

  // Angular: app-chip's countShow — newcount!=0 && tab not yet opened this session/install.
  function tabUnreadCount(tab: LikedTab): number {
    return viewedTabs[tab] ? 0 : newCounts[tab]
  }

  function bannerTitle(): string {
    const key = activeTab === 'likedyou' ? 'LIKE_LIST.LIKEDYOU' : 'LIKE_LIST.LIKESENT'
    return t(key).replace('#COUNT#', String(current.total))
  }

  // ── Desktop ────────────────────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <ActivityDesktopLayout
        activeTab={activeTab}
        tabLabel={tabLabel}
        tabUnreadCount={tabUnreadCount}
        current={current}
        initialLoad={initialLoad}
        isPaid={isPaid}
        bannerTitle={bannerTitle()}
        gating={gating}
        langCode={i18n.language}
        onSwitchTab={switchTab}
        onLoadMore={handleEndReached}
        onPress={handlePress}
        onLike={handleLike}
        onDontShow={handleDontShow}
        onViewLater={handleViewLater}
        onCall={p => confirmThenContact(p, 'call')}
        onWhatsApp={p => confirmThenContact(p, 'whatsapp')}
        onMenuPress={handleMenuPress}
        openMenuId={openMenuId}
        onRemovePress={handleRemovePress}
        onReportPress={handleReportPress}
        onGetPaidMembership={() => navigation.navigate('recharge')}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
        onTabPress={handleTabPress}
      >
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
        {reportTarget && (
          <ReportProfileModal
            visible
            partnerId={reportTarget.id}
            partnerName={reportTarget.name}
            onClose={() => setReportTarget(null)}
            onSubmitted={() => setReportTarget(null)}
          />
        )}
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
      </ActivityDesktopLayout>
    )
  }

  // ── Render helpers (mobile) ────────────────────────────────────────────────────

  function renderItem({ item }: { item: MatchProfile }) {
    return (
      <View style={styles.cardWrap}>
        <MatchCard
          profile={item}
          oppGender={gating.oppGender}
          ownEntryType={gating.ownEntryType}
          femaleFreeEligible={gating.femaleFreeEligible}
          indNumbersLeft={gating.indNumbersLeft}
          onPress={() => handlePress(item)}
          onLike={() => handleLike(item)}
          onDontShow={() => handleDontShow(item)}
          onViewLater={() => handleViewLater(item)}
          onCall={() => confirmThenContact(item, 'call')}
          onWhatsApp={() => confirmThenContact(item, 'whatsapp')}
          showLikedBadge
        />
        {/* Figma: circular dark 3-dot menu, top-right of the photo — Angular's
            IsShowThreeDots (Report always, Remove only on "Liked by you"). Not
            part of MatchCard itself (plain Matches list never shows this), so
            it's overlaid here rather than added to the shared component. */}
        <Pressable style={styles.menuBtn} onPress={() => handleMenuPress(item)} hitSlop={8}>
          <View style={styles.menuDot} />
          <View style={styles.menuDot} />
          <View style={styles.menuDot} />
        </Pressable>
        {openMenuId === item.profileId && (
          <ThreeDotMenu
            showRemove={activeTab === 'likesent'}
            showReport
            onRemove={() => handleRemovePress(item)}
            onReport={() => handleReportPress(item)}
          />
        )}
      </View>
    )
  }

  function renderListHeader() {
    // Angular: female-free-user upsell banner — Figma shows this for ANY unpaid
    // viewer though (the mock's own "You liked her..." caption implies a male
    // viewer and still shows it), so gating this on ownEntryType rather than
    // Angular's narrower EntryType=='F' condition.
    if (isPaid || current.total === 0) return null
    return (
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{bannerTitle()}</Text>
        <Text style={styles.bannerSub}>{t('VERIFY_ID_DOC.BECOMEPAIDMEMBER')}</Text>
        <Pressable style={styles.bannerBtn} onPress={() => navigation.navigate('recharge')}>
          <Text style={styles.bannerBtnLabel}>{t('GENERAL.BECOME_PAID')}</Text>
        </Pressable>
      </View>
    )
  }

  function renderFooter() {
    if (!current.loadingMore) return null
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    )
  }

  function renderEmpty() {
    if (!current.loaded) return null
    const isLikeSent = activeTab === 'likesent'
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>
          {t(isLikeSent ? 'LIKE_LIST.NOPROFILE_CONT' : 'LIKE_LIST.NOPROFILE_CONT_1')}
        </Text>
        <Text style={styles.emptySubtitle}>
          {t(isLikeSent ? 'LIKE_LIST.NOPROFILE_CONT_SUB' : 'LIKE_LIST.NOPROFILE_CONT_1_SUB')}
        </Text>
      </View>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('GENERAL.ICON_3')}</Text>
        <LanguagePill langCode={i18n.language} />
      </View>

      {/* ── Tab chips ── */}
      <View style={styles.tabBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {(['likedyou', 'likesent'] as LikedTab[]).map(tab => {
            const isActive = activeTab === tab
            const unread = tabUnreadCount(tab)
            return (
              <Pressable
                key={tab}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => switchTab(tab)}
              >
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{tabLabel(tab)}</Text>
                {unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unread}</Text>
                  </View>
                )}
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {/* ── Content ── */}
      <View style={styles.flex1}>
        {initialLoad ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={current.profiles}
            keyExtractor={item => item.profileId}
            renderItem={renderItem}
            ListHeaderComponent={renderListHeader}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.4}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={7}
            removeClippedSubviews
          />
        )}
      </View>

      {/* ── Footer ── */}
      <AppFooter activeTab={2} onTabPress={handleTabPress} />

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
      {reportTarget && (
        <ReportProfileModal
          visible
          partnerId={reportTarget.id}
          partnerName={reportTarget.name}
          onClose={() => setReportTarget(null)}
          onSubmitted={() => { setReportTarget(null); showToast(t('GENERAL.REPORT_SUBMITTED', 'Report submitted')) }}
        />
      )}
      <BottomSheet
        visible={!!phoneInfo.sheet}
        type="phonePrivacyInfo"
        data={phoneInfo.getData(t)}
        onClose={phoneInfo.close}
        onPrimaryPress={() => phoneInfo.primaryPress(navigation)}
        onSecondaryPress={() => phoneInfo.secondaryPress(navigation)}
        onLinkPress={phoneInfo.close}
      />
      <Toast request={toastRequest} bottomOffset={56 + 16} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  flex1:  { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider,
  },
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: Colors.textDark },

  // ── Tab bar — Figma: unselected border #b0b0b0, selected bg/border chip tokens ──
  tabBarWrap: { backgroundColor: Colors.surface },
  tabScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  // Figma: unselected chip border is #b0b0b0 (Colors.inputBorder), not the
  // #8a8a8a used by the language pill above.
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: Colors.inputBorder,
  },
  chipActive: { backgroundColor: Colors.chipSurfaceSelected, borderColor: Colors.chipBorderActive },
  chipLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textDark },
  chipLabelActive: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textDark },
  // Angular: app-chip's countShow badge — small red circle, white count text.
  unreadBadge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  unreadBadgeText: { fontFamily: Fonts.poppinsSemiBold, fontSize: 11, color: Colors.white },

  // ── Card + 3-dot menu overlay ──────────────────────────────────────────────────
  cardWrap: { position: 'relative' },
  menuBtn: {
    position: 'absolute', top: 16, right: 16,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(84,84,84,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  menuDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.white },

  // ── Unpaid upsell banner — Figma: bg rgba(181,0,51,0.05) ─────────────────────
  banner: { backgroundColor: 'rgba(181, 0, 51, 0.05)', padding: 16, gap: 6 },
  bannerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.textPrimary, lineHeight: 22 },
  bannerSub: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textMedium, lineHeight: 20, marginBottom: 8 },
  bannerBtn: {
    alignSelf: 'flex-start', borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 6,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  bannerBtnLabel: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 14, color: Colors.primary },

  // ── List ──────────────────────────────────────────────────────────────────────
  listContent: { flexGrow: 1 },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingTop: 80, gap: 12,
  },
  emptyTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: Colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
})
