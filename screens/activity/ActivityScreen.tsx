// Activity screen — Angular: pages/activity/activity.component.ts/.html (route
// `/activity`). This is a 1:1 port of that page, including every mode it can be
// opened in:
//
//   1. ACTIVITY mode (default) — the chip tabs built from
//      core/config/activity.config.ts's ActivityHeaderList filtered to
//      `flag === 1` (i.e. `likedyou` + `likesent` only), REVERSED for a male
//      viewer (setSelectedType()'s `logInGender=='M'` branch), each chip
//      labelled "<name> (totalCount)" with the red unread `newcount` badge that
//      clears once the tab is opened (VIEWEDACTIVITYLIST).
//   2. VIEWED-LIST mode — reached with `{ activityType: 'viewedbyme' | 'viewedyou' }`
//      (Angular: router state / :module route param, e.g. from Home's
//      "Profiles you viewed" / "View later" see-all). isViewedList() swaps the
//      header for a back-button + title bar, hides the 3-dot menus and the
//      liked-strip, and for `viewedbyme` adds the two sub-tabs
//      (ViewedByMeTabs: "Profiles you viewed" / "Profiles you chose to view
//      later") rendering the plainer <app-list-view-card> rows instead of the
//      full match cards.
//
// Everything else on the Angular page is here too: the female-free top banner
// (bindShortlistContent/bindTitle), the illustrated empty states with the
// "Go to matches" CTA, deleted-profile (STATUS 1|2) placeholder rows, the
// add-photo promotion that replaces the whole content area, and the
// profile-validation / autopay payment stickies (checkProfileStatus →
// getContactsData).
//
// Reuses the EXACT same card component MatchesScreen.tsx uses (MatchCard) —
// confirmed against Angular's own source that /matches and /activity both
// render the same `app-matches-card` component, so this isn't just DRY
// cleanup, it matches Angular's real architecture.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, FlatList, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { useFooterBadges } from '../../contexts/FooterBadgesContext'
import LanguagePill from '../../components/language-pill/LanguagePill'
import Toast, { type ToastRequest } from '../../components/toast/Toast'
import AppRatingModal from '../../components/app-rating/AppRatingModal'
import { useAppRating } from '../../hooks/useAppRating'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import CdnSvg, { CdnImage } from '../../components/cdn-svg/CdnSvg'
import StickyBanner from '../../components/sticky-banner/StickyBanner'
import PhotoPromoSticky from '../../components/sticky-banner/PhotoPromoSticky'
import { RIGHT_ARROW_ANIMATION_URI } from '../../components/matches/matchesCard.shared'
import ContactDetailsSheet from '../../components/matches/ContactDetailsSheet'
import ReportProfileModal from '../../components/matches/ReportProfileModal'
import ThreeDotMenu from '../../components/matches/ThreeDotMenu'
import WhatsAppPaywallModal from '../../components/matches/WhatsAppPaywallModal'
import { MatchCard } from '../matches/MatchesScreen'
import ActivityDesktopLayout from './ActivityDesktopLayout'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { useContactGating } from '../../hooks/useContactGating'
import { usePhoneInfoSheet } from '../../hooks/usePhoneInfoSheet'
import { useAddPhotoPicker } from '../../hooks/useAddPhotoPicker'
import WebPhotoInput from '../../components/add-photo/WebPhotoInput'
import AddPhotoVerdictSheets from '../../components/add-photo/AddPhotoVerdictSheets'
import { matchProfileAdapter } from '../../adapters/matches.adapter'
import { fetchActivityListingPage } from '../../service/activityService'
import { communicationBtnOnClick, shouldSkipPhoneConfirm, shouldShowPhoneNoLimit, fetchContactDetails, getContactConfirmContent as getSharedContactConfirmContent } from '../../service/communicationService'
import { redirectToViewProfile } from '../../service/buttonService'
import {
  openMembershipTab, fetchUpgradePaymentPromo, redirectToIntermediatePage,
  type UpgradePaymentPromo,
} from '../../service/paymentService'
import {
  fetchNotifCount, fetchAndStorePPSetData, fetchProfileValidationBanner, fetchCustomerCare,
  type ProfileValidationBanner,
} from '../../service/homeService'
import { getRegistrationArrays, getSessionValue } from '../../service/registrationService'
import { logEvent, logScreen } from '../../service/analyticsService'
import { getItem, getJson, setJson, removeItem } from '../../service/storageService'
import { handleBack } from '../../utils/navigationRef'
import { FEMALE_AVATAR_URL, MALE_AVATAR_URL } from '../../utils/avatar'
import { StorageKeys } from '../../constants/storage.keys'
import { CDN_SVG } from '../../constants/cdn'
import { Colors } from '../../constants/colors'
import i18n from '../../i18n'
import type { MatchProfile } from '../../types/interfaces/matches.interface'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route?: any }

// Angular: ActivityHeaderList entries with flag === 1 — the only two chips the
// activity page itself ever renders.
export type LikedTab = 'likedyou' | 'likesent'
// Angular: ViewedByMeTabs (activity.config.ts).
export type ViewedSubTab = 'viewedbyme' | 'viewinglater'
// Angular: selectedType — includes the two drill-down types the page can be
// opened with even though they have no chip of their own (flag === 0).
export type ActivityType = LikedTab | 'viewedyou' | 'viewedbyme'
// The key an actual listing is cached under: `viewedbyme` splits into its two
// sub-tabs, everything else is its own type.
type ListKey = LikedTab | 'viewedyou' | ViewedSubTab

interface TabData {
  profiles:    MatchProfile[]
  total:       number
  hasMore:     boolean
  loadingMore: boolean
  start:       number
  loaded:      boolean
}

interface CountEntry { newcount: number; totalCount: number }

const LIMIT = 20
const INITIAL_TAB_DATA: TabData = { profiles: [], total: 0, hasMore: true, loadingMore: false, start: 0, loaded: false }

const EMPTY_TAB_DATA: Record<ListKey, TabData> = {
  likedyou:     { ...INITIAL_TAB_DATA },
  likesent:     { ...INITIAL_TAB_DATA },
  viewedyou:    { ...INITIAL_TAB_DATA },
  viewedbyme:   { ...INITIAL_TAB_DATA },
  viewinglater: { ...INITIAL_TAB_DATA },
}

// Angular: ActivityHeaderList order (likedyou before likesent), reversed for a
// male viewer by setSelectedType().
const BASE_TAB_ORDER: LikedTab[] = ['likedyou', 'likesent']
const VIEWED_SUB_TABS: ViewedSubTab[] = ['viewedbyme', 'viewinglater']

// Angular: setCountListValue() matches notificationcount's COMCOUNT entries
// against the header list by comtype; `likedbyme` is the API's own name for the
// `likesent` tab and `viewlater`/`viewinglater` both feed the View-later count
// (isViewLaterComType()).
const COMTYPE_TO_KEY: Record<string, ListKey> = {
  likedyou:     'likedyou',
  likesent:     'likesent',
  likedbyme:    'likesent',
  viewedyou:    'viewedyou',
  viewedbyme:   'viewedbyme',
  viewlater:    'viewinglater',
  viewinglater: 'viewinglater',
}

// Angular renders these content strings with [innerHTML] (they carry
// <span class='font-bold'> / <br> markup) — RN <Text> needs them flattened.
function stripHtml(value: string = ''): string {
  return String(value ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim()
}

// Angular: isDeletedProfile() — STATUS 1 = deleted profile, 2 = skipped/hidden.
// (toProfile() maps the raw STATUS onto dontShowStatus.)
function isDeletedProfile(profile: MatchProfile): boolean {
  return ['1', '2'].includes(String(profile.dontShowStatus ?? ''))
}

// ─── ActivityScreen ───────────────────────────────────────────────────────────

export default function ActivityScreen({ navigation, route }: Props) {
  const { t } = useTranslation()
  const isDesktop = useIsDesktopWeb()
  const gating = useContactGating()

  // Angular: the constructor reads router state ({activityType, selectedSubTab})
  // and ngOnInit reads the :module route param — both land in selectedType.
  const routeType   = route?.params?.activityType as ActivityType | undefined
  const routeSubTab = route?.params?.selectedSubTab as ViewedSubTab | undefined

  const [selectedType,   setSelectedType]   = useState<ActivityType>(routeType ?? 'likesent')
  const [selectedSubTab, setSelectedSubTab] = useState<ViewedSubTab>(routeSubTab ?? 'viewedbyme')
  const [tabOrder,       setTabOrder]       = useState<LikedTab[]>(BASE_TAB_ORDER)
  const [initialLoad,    setInitialLoad]    = useState(true)
  const [tabData,        setTabData]        = useState<Record<ListKey, TabData>>(EMPTY_TAB_DATA)

  const userIdRef = useRef('')

  const isViewedList  = selectedType === 'viewedyou' || selectedType === 'viewedbyme'
  const listKey: ListKey = selectedType === 'viewedbyme' ? selectedSubTab : selectedType

  // Angular: <app-footer *ngIf="!isViewedList()">. The tab bar is global now
  // (MainTabs.tsx persists all 4 tabs), so hiding it while this screen shows
  // its "viewed you"/"viewed by me" drill-down has to go through shared
  // context instead of just not rendering a locally-owned <AppFooter> — and
  // only while THIS screen is actually focused, so switching to another tab
  // doesn't leave the footer hidden everywhere else.
  const { setFooterVisible } = useFooterBadges()
  useFocusEffect(useCallback(() => {
    setFooterVisible(!isViewedList)
    return () => setFooterVisible(true)
  }, [isViewedList, setFooterVisible]))

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
  // Angular: paymentPromoPopUp() → bottom-sheet.component's `paymentPromo` block.
  // A FREE member tapping Call / WhatsApp / Message gets this upgrade sheet
  // (title, content, "Paid membership benefits:" + the locked-perk rows) instead
  // of being sent straight to the payment page.
  const [paymentPromo, setPaymentPromo] = useState<UpgradePaymentPromo | null>(null)
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null)
  // Angular: report-remove-profile.component's own visibility toggle — only
  // one card's dropdown is open at a time.
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [toastRequest, setToastRequest] = useState<ToastRequest | null>(null)
  // The ~10 other phoneviewed/pre-flight results (phone protected, FUP limit,
  // ID-verify prompt, female-free variants, etc.) — see usePhoneInfoSheet.ts.
  const phoneInfo = usePhoneInfoSheet()
  // Web/PWA "Add photo" CTAs — see hooks/useAddPhotoPicker.ts for why this
  // can't just navigate to the native-only 'Gallery' screen.
  const addPhoto = useAddPhotoPicker({
    onRejected: showToast,
    onError: () => showToast('Upload failed. Please try again.'),
  })

  // ── Counts — Angular: common.getNotificationCount(1) → notificationcount API's
  // COMCOUNT array. `totalCount` drives the chip labels/banner count and is
  // decremented client-side on remove/report (updateCount()); `newcount` is the
  // red unread badge, cleared per tab through VIEWEDACTIVITYLIST. ─────────────
  const [counts,     setCounts]     = useState<Partial<Record<ListKey, CountEntry>>>({})
  const [viewedTabs, setViewedTabs] = useState<Record<string, boolean>>({})

  // ── Top banner — Angular: bindShortlistContent(), only for EntryType 'F' ────
  const [regArrays, setRegArrays] = useState<Record<string, any>>({})

  // ── Add-photo promotion — Angular: showPhotoPromotion, which REPLACES the
  // whole ion-content with <app-add-photo> (never in viewed-list mode). ───────
  const [showPhotoPromotion, setShowPhotoPromotion] = useState(false)
  const [photoPromoBanner,   setPhotoPromoBanner]   = useState<Record<string, any> | null>(null)

  // ── Stickies — Angular: checkProfileStatus() picks ONE of these two:
  // PISTATUS 5|13 → profile-validation sticky, else getContactsData()'s
  // paypendingflag autopay sticky. STICKYFLAG suppresses both once dismissed. ─
  const [profileValidationBanner, setProfileValidationBanner] = useState<ProfileValidationBanner | null>(null)
  const [profileValidationSheetVisible, setProfileValidationSheetVisible] = useState(false)
  const [autopaySticky,   setAutopaySticky]   = useState<{ content: string; ctaLabel: string } | null>(null)
  const [stickyDismissed, setStickyDismissed] = useState(false)
  const [customerCare,    setCustomerCare]    = useState({ phone: '', whatsapp: '' })

  function showToast(message: string) {
    setToastRequest({ message, key: Date.now() })
  }

  // Angular fires the ACTIVE "like sent" trigger from the shared
  // communication.service.ts:441, so a like from these lists counts the same
  // as one from the matches card. Only Daily Recommendation is excluded.
  const appRating = useAppRating()

  // ── Data helpers ─────────────────────────────────────────────────────────────

  function updateTab(key: ListKey, patch: Partial<TabData>) {
    setTabData(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  function patchProfile(key: ListKey, profileId: string, patch: Partial<MatchProfile>) {
    setTabData(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        profiles: prev[key].profiles.map(p => p.profileId === profileId ? { ...p, ...patch } : p),
      },
    }))
  }

  // Angular: updateCount() — the removed profile is dropped from the list AND
  // the tab's own totalCount (chip label + banner count) goes down by one.
  function decrementCount(key: ListKey) {
    setCounts(prev => {
      const entry = prev[key]
      if (!entry || entry.totalCount <= 0) return prev
      return { ...prev, [key]: { ...entry, totalCount: entry.totalCount - 1 } }
    })
  }

  function removeProfile(key: ListKey, profileId: string) {
    setTabData(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        profiles: prev[key].profiles.filter(p => p.profileId !== profileId),
        total: Math.max(0, prev[key].total - 1),
      },
    }))
    decrementCount(key)
  }

  // ── API ──────────────────────────────────────────────────────────────────────

  const countsRef = useRef<Partial<Record<ListKey, CountEntry>>>({})
  countsRef.current = counts

  async function loadTab(key: ListKey, start: number, isFirst: boolean) {
    if (isFirst) updateTab(key, { loaded: false })
    else         updateTab(key, { loadingMore: true })

    try {
      // Angular appends &LASTLOGIN only when that tab still carries unread items.
      const hasNewCount = (countsRef.current[key]?.newcount ?? 0) > 0
      const result  = await fetchActivityListingPage(key, userIdRef.current, start, LIMIT, hasNewCount)
      const adapted = result.items.map(matchProfileAdapter.adapt)
      const hasMore = result.items.length >= LIMIT

      setTabData(prev => {
        const existing = prev[key]
        return {
          ...prev,
          [key]: {
            profiles:    isFirst ? adapted : [...existing.profiles, ...adapted],
            total:       isFirst ? result.totalCount : existing.total,
            hasMore,
            loadingMore: false,
            start:       start + LIMIT,
            loaded:      true,
          },
        }
      })

      // Angular: callApi()'s `resultData?.TOTAL > 0` branch keeps profileCount in
      // sync when the notification-count API didn't carry an entry for this tab
      // (true for viewedyou/viewedbyme/viewinglater on most accounts).
      if (isFirst) {
        setCounts(prev => prev[key]
          ? prev
          : { ...prev, [key]: { newcount: 0, totalCount: result.totalCount } })
      }
    } catch {
      updateTab(key, { loaded: true, loadingMore: false })
    }
  }

  // Angular: activity.component.ts's viewedActivitytList — a tab's unread badge
  // is cleared the moment it's actually opened, persisted so it stays cleared
  // across app restarts.
  function markTabViewed(key: ListKey) {
    setViewedTabs(prev => {
      if (prev[key]) return prev
      const next = { ...prev, [key]: true }
      setJson('VIEWEDACTIVITYLIST', next).catch(() => {})
      return next
    })
  }

  // Angular: setCountListValue() — maps COMCOUNT onto the header list.
  const applyComCount = useCallback((comCount: Array<Record<string, any>>) => {
    if (!Array.isArray(comCount) || comCount.length === 0) return
    setCounts(prev => {
      const next = { ...prev }
      for (const entry of comCount) {
        const key = COMTYPE_TO_KEY[String(entry?.['comtype'] ?? '')]
        if (!key) continue
        next[key] = {
          newcount:   Number(entry?.['newcount']   ?? 0) || 0,
          totalCount: Number(entry?.['totalCount'] ?? 0) || 0,
        }
      }
      // Kept in a ref too: loadTab() reads the unread count to decide whether to
      // append &LASTLOGIN, and it runs in the same tick as this state update —
      // before any re-render could refresh the ref below.
      countsRef.current = next
      return next
    })
  }, [])

  // ── Mount ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    logScreen('Activity')
    Promise.all([
      getItem(StorageKeys.Auth.USER_ID),
      getItem(StorageKeys.User.LOGIN_GENDER),
      getJson<Record<string, boolean>>('VIEWEDACTIVITYLIST'),
      fetchNotifCount().catch(() => ({ newCount: 0, comCount: [] })),
    ]).then(async ([id, loginG, viewed, notif]) => {
      userIdRef.current = id ?? ''
      setViewedTabs(viewed ?? {})
      applyComCount(notif.comCount)

      // Angular: setSelectedType() — the male viewer sees the chip list reversed
      // ("Profiles you liked" first), and the default selectedType is the first
      // chip of that (possibly reversed) list.
      const order: LikedTab[] = loginG === 'M' ? [...BASE_TAB_ORDER].reverse() : [...BASE_TAB_ORDER]
      setTabOrder(order)

      const initialType: ActivityType = routeType ?? (order[0] as LikedTab)
      setSelectedType(initialType)

      if (initialType === 'viewedbyme') {
        await loadTab(routeSubTab ?? 'viewedbyme', 0, true)
      } else if (initialType === 'viewedyou') {
        await loadTab('viewedyou', 0, true)
      } else {
        // Both chips are one tap apart, so both listings are primed up-front —
        // switching a chip then never shows a spinner.
        await Promise.all([loadTab('likedyou', 0, true), loadTab('likesent', 0, true)])
      }
      setInitialLoad(false)
      markTabViewed(initialType === 'viewedbyme' ? (routeSubTab ?? 'viewedbyme') : initialType)
    })
  }, [])

  // ── Add-photo promotion + stickies — Angular: ngOnInit()'s getPPSETData(0)
  // and checkProfileStatus(). ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    const emptyRecord = (): Record<string, any> => ({})
    Promise.all([
      getRegistrationArrays().catch(emptyRecord),
      fetchAndStorePPSetData().catch(emptyRecord),
      getSessionValue('ENTRYTYPE').catch(() => ''),
    ])
      .then(async ([reg, ppSetData, entryType]) => {
        if (cancelled) return
        setRegArrays(reg ?? {})

        // Angular: showPhotoPromotion = PROFILEPUBLISHEDFLAG=='0' &&
        // PROFILEPUBLISHEDTYPE in ['1','2'] && ENTRYTYPE=='F'.
        const flagOk = String(ppSetData?.['PROFILEPUBLISHEDFLAG']) === '0'
        const typeOk = ['1', '2'].includes(String(ppSetData?.['PROFILEPUBLISHEDTYPE']))
        const freeOk = entryType === 'F'
        setShowPhotoPromotion(flagOk && typeOk && freeOk)
        setPhotoPromoBanner(reg?.['PHOTOPUBLISHED']?.['Banner'] ?? null)

        // Angular: checkProfileStatus() — profile-validation sticky wins,
        // otherwise the autopay/payment-pending sticky from getContactsData().
        if (['5', '13'].includes(String(ppSetData?.['PISTATUS']))) {
          const banner = await fetchProfileValidationBanner().catch(() => null)
          if (!cancelled && banner) {
            setAutopaySticky(null)
            setProfileValidationBanner(banner)
          }
        } else {
          setProfileValidationBanner(null)
          await fetchContactDetails().catch(() => {})
          if (cancelled) return
          const paymentDetails = (await getJson<Record<string, any>>('CONTACT_DETAIL'))?.['PAYMENTDETAILS']
          if (!cancelled && paymentDetails?.['paypendingflag'] === '1' && paymentDetails?.['status']) {
            setAutopaySticky({ content: String(paymentDetails['status']), ctaLabel: String(paymentDetails['cta2'] ?? '') })
          }
        }
      })

    fetchCustomerCare()
      .then(result => { if (!cancelled && (result.phone || result.whatsapp)) setCustomerCare(result) })
      .catch(() => {})

    return () => { cancelled = true }
  }, [])

  // Angular: bindShortlistContent(selectedType) — recomputed on every changeTab(),
  // and only ever populated for a female-free viewer (EntryType 'F'). The copy is
  // server-driven off REGISTRATIONARRAYS.IDPRCONTENT.ACTIVITY except for the two
  // liked tabs, which use the static LIKE_LIST translations.
  const isFreeEntry = gating.ownEntryType === 'F'
  const topBanner = (() => {
    if (!isFreeEntry) return { title: '', subtitle: '', cta: '' }
    const activity = regArrays?.['IDPRCONTENT']?.['ACTIVITY'] ?? {}
    const title =
      selectedType === 'likedyou'    ? t('LIKE_LIST.LIKEDYOU')
      : selectedType === 'likesent'  ? t('LIKE_LIST.LIKESENT')
      : selectedType === 'viewedyou' ? String(activity['CONTENT19'] ?? '')
      : String(activity['CONTENT17'] ?? '')
    return {
      title,
      subtitle: String(activity['CONTENT16'] ?? ''),
      cta:      String(activity['CTA1'] ?? ''),
    }
  })()

  // Angular: ionViewDidEnter()'s REFRESH_ACTIVITY_COUNT / isFromViewingLaterProfile
  // check — coming back from a profile opened out of these lists re-pulls the
  // counts so the chip labels/badges aren't stale. (Skips the very first focus,
  // already covered by the mount effect above.)
  const firstFocusRef = useRef(true)
  useFocusEffect(useCallback(() => {
    if (firstFocusRef.current) { firstFocusRef.current = false; return }
    getItem('REFRESH_ACTIVITY_COUNT').then(async flag => {
      if (flag !== 'true' && !isViewedList) return
      if (flag === 'true') await removeItem('REFRESH_ACTIVITY_COUNT')
      const notif = await fetchNotifCount().catch(() => ({ newCount: 0, comCount: [] }))
      applyComCount(notif.comCount)
    })
  }, [isViewedList, applyComCount]))

  // Angular: changeLanguage() (activity.component.ts:1442-1459) — tears down and
  // re-fetches so server-rendered/translated content refreshes in the new
  // language. Skips the initial mount (already covered above).
  const mountedLangRef = useRef(i18n.language)
  useEffect(() => {
    if (i18n.language === mountedLangRef.current) return
    mountedLangRef.current = i18n.language
    loadTab(listKey, 0, true)
  }, [i18n.language])

  // ── Tab switching ─────────────────────────────────────────────────────────────

  // Angular: changeTab(type, true, true, index) — resets the list, marks the tab
  // viewed, then re-fires the listing API for it.
  function switchTab(tab: LikedTab) {
    if (tab === selectedType) return
    setSelectedType(tab)
    logEvent({ category: 'activity', action: 'tab_click', label: tab })
    markTabViewed(tab)
    if (!tabData[tab].loaded) loadTab(tab, 0, true)
  }

  // Angular: changeSubTab(type, index) — same reset, but the parent type stays
  // 'viewedbyme' and only the sub-tab (and hence the API) changes.
  function switchSubTab(sub: ViewedSubTab) {
    if (sub === selectedSubTab) return
    setSelectedSubTab(sub)
    logEvent({ category: 'activity', action: 'subtab_click', label: sub })
    markTabViewed(sub)
    if (!tabData[sub].loaded) loadTab(sub, 0, true)
  }

  const handleEndReached = useCallback(() => {
    const d = tabData[listKey]
    if (!d.loadingMore && d.hasMore && d.loaded) loadTab(listKey, d.start, false)
  }, [tabData, listKey])

  // ── Card action handlers ──────────────────────────────────────────────────────
  // Angular: matches-card.component.ts's clickOn*() → communication.service.ts's
  // communicationBtnOnClick() — same dispatcher MatchesScreen.tsx uses, 'activity'
  // as fromPage (Angular's own variant string for this exact screen).

  // Angular: clickOnViewProfile(moduleType, oppositeUserId, status) — a deleted
  // profile only toasts, and the viewedbyme list passes its SUB-tab as the
  // from-page module so the back-navigation lands on the right list.
  function handlePress(profile: MatchProfile) {
    if (isDeletedProfile(profile)) { showMessage(); return }
    const fromPage = selectedType === 'viewedbyme' ? selectedSubTab : selectedType
    const ids = tabData[listKey].profiles.map(p => p.profileId)
    redirectToViewProfile('', profile.profileId, fromPage, ids)
  }

  // Angular: showMessage() — the deleted-profile toast.
  function showMessage() {
    showToast(t('LIKE_LIST.DELETED_PROFILE_TXT'))
  }

  async function handleLike(profile: MatchProfile) {
    patchProfile(listKey, profile.profileId, { likedStatus: '1' })
    try {
      const result = await communicationBtnOnClick('activity', 'like', { MATRIID: profile.profileId })
      if (result.type === 'error') {
        patchProfile(listKey, profile.profileId, { likedStatus: '0' })
        showToast(result.message)
      } else if (result.type === 'api_success' && result.message) {
        showToast(result.message)
      }
      appRating.onLikeSent()
    } catch { /* keep optimistic state — matches MatchesScreen's own silent-catch convention */ }
  }

  async function handleDontShow(profile: MatchProfile) {
    removeProfile(listKey, profile.profileId)
    try {
      await communicationBtnOnClick('activity', 'dontshow', { MATRIID: profile.profileId })
      showToast(t('VIEWPROFILE.SKIP_PROFILE'))
    } catch { /* card already removed client-side, matches Angular's optimistic behavior */ }
  }

  async function handleViewLater(profile: MatchProfile) {
    removeProfile(listKey, profile.profileId)
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
    // Angular communication.service.ts's showCallAndWhatsAppPromo(): the
    // "view phone number?" CONFIRM popup lives inside showContactDetails(),
    // which is only reached when the number can actually be revealed —
    // entryType=='P', this profile's number was already viewed
    // (checkingForShowPhoneNumberFreeUser: PHONEVIEWED '1'|'3'), or the
    // female-free 3-contact promo applies. A FREE member goes straight to
    // paymentPromoPopUp() instead, with no confirm step in between.
    // handleContactConfirmYes() is used rather than showPaymentPromo() directly
    // so the service still owns the decision — its female-free branches
    // (photo pending / call verification / limit over) must keep winning over
    // the paywall for a free female member who qualifies for them.
    // Angular communication.service.ts's showContactDetails() FIRST check — a
    // paid user whose mutual-like AND overall phone-view quotas are both
    // exhausted sees the PHONENOLIMIT sheet instead of the confirm popup.
    if (shouldShowPhoneNoLimit(profile.phoneViewed, profile.likedStatus, gating.indNumbersLeft, gating.contactQuota.left, gating.ownEntryType)) {
      phoneInfo.handleResult({ type: 'female_free', action: 'femaleFree-LimitOver', profile }).catch(() => {})
      return
    }
    const alreadyViewed = ['1', '3'].includes(String(profile.phoneViewed ?? '0'))
    if (gating.ownEntryType !== 'P' && !alreadyViewed) {
      handleContactConfirmYes({ profile, action })
      return
    }
    if (shouldSkipPhoneConfirm(profile.phoneViewed, profile.likedStatus, gating.indNumbersLeft, gating.ownEntryType, profile.phoneProtected)) {
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

  // React Native can only present ONE Modal at a time: opening the Contact
  // Details sheet while the confirm sheet's own Modal is still animating out
  // (BottomSheet unmounts its Modal ~220ms after visible flips to false)
  // silently no-ops — the confirm popup closes and nothing follows it. Angular
  // has no such constraint (both popups are plain DOM overlays stacked by
  // Ionic), so this hand-off delay is a platform requirement of the port, not a
  // behavior change. Only needed when the confirm step was actually on screen;
  // the direct-reveal path (shouldSkipPhoneConfirm) opens nothing first.
  function openAfterConfirmSheet(hadConfirmSheet: boolean, open: () => void) {
    if (!hadConfirmSheet) { open(); return }
    setTimeout(open, 320)
  }

  async function handleContactConfirmYes(override?: { profile: MatchProfile; action: 'call' | 'whatsapp' }) {
    // Only treat the argument as a real override when it carries our payload —
    // a UI callback that forwards its press event would otherwise be taken as
    // one, leaving `profile` undefined (see the note in BottomSheet.tsx).
    const realOverride = override?.profile ? override : undefined
    const pending = realOverride ?? contactConfirm
    if (!pending) return
    const { profile, action } = pending
    const hadConfirmSheet = !realOverride && !!contactConfirm
    setContactConfirm(null)
    try {
      const result = await communicationBtnOnClick('activity', action, { MATRIID: profile.profileId })
      if (result.type === 'show_contact') {
        // Angular's Contact Details popup (modalpopup.component.html's
        // `viewProfileContactNo`) shows Name/Mobile + WhatsApp + Call together
        // regardless of which CTA was tapped — not one or the other.
        openAfterConfirmSheet(hadConfirmSheet, () => setContactDetails({
          name: profile.name, mobile: result.mobile, dialNumber: result.dialNumber, whatsappNumber: result.whatsappNumber,
          showCounter: result.showCounter, viewedCount: result.viewedCount, totalCount: result.totalCount,
          idVerified: profile.isIdVerified,
        }))
      } else if (result.type === 'payment_promo') {
        await showPaymentPromo(profile, action === 'whatsapp')
      } else if (result.type === 'error') {
        showToast(result.message)
      } else {
        // The remaining pre-flight results (phone protected, FUP limit,
        // verify-ID, female-free variants…) all open a sheet of their own, so
        // they need the same hand-off.
        openAfterConfirmSheet(hadConfirmSheet, () => { phoneInfo.handleResult(result).catch(() => {}) })
      }
    } catch (e) {
      // Was a bare silent catch — any throw in here looked exactly like the
      // "confirm popup, then nothing" symptom with no trace of why.
      if (__DEV__) console.error('[Activity] contact error:', e)
    }
  }

  // Angular: matches-card.component's message icon → communicationBtnOnClick's
  // 'jodimessages' action (chatService's handleChat() navigates to the chat
  // window itself on success). The SAME app-matches-card renders on /matches and
  // /activity, so the icon belongs on both lists — MatchesScreen.tsx's own
  // handleMessage(), with this screen's shared phoneInfo sheet covering the
  // verify-id / female-free / FUP pre-flight results.
  async function handleMessage(profile: MatchProfile) {
    try {
      const result = await communicationBtnOnClick('activity', 'jodimessages', { MATRIID: profile.profileId })
      if (result.type === 'payment_promo') {
        await showPaymentPromo(profile, false)
      } else if (result.type === 'error') {
        showToast(result.message)
      } else if (result.type !== 'api_success') {
        // 'api_success' means handleChat() already navigated to the chat window.
        await phoneInfo.handleResult(result)
      }
    } catch { /* silent — matches MatchesScreen's own convention */ }
  }

  // Angular: button.component.ts's paymentPromoPopUp() — every paywalled action
  // (Call, WhatsApp, Message) lands here. A FREE member (ENTRYTYPE 'F') gets the
  // `paymentPromo` bottom sheet built from payment/nbcustomer/v1's content;
  // anyone else falls through to the popup/payment page as before.
  async function showPaymentPromo(profile: MatchProfile, isWhatsApp: boolean) {
    if (gating.ownEntryType !== 'F') {
      if (isWhatsApp) setWhatsappPaywallProfile(profile)
      else navigation.navigate('recharge')
      return
    }
    logEvent({ category: 'PaymentPopupPromo', action: 'activity', label: 'Popup-Served' })
    const promo = await fetchUpgradePaymentPromo(profile.name).catch(() => null)
    // No content served → don't strand the tap on a dead end; fall back to the
    // payment page, which is where the sheet's own CTA goes anyway.
    // Angular routes PROMOTYPE 7/11 to phnoLeftPopup() (the renewal /
    // numbers-left popup) instead of this sheet — that popup isn't built in this
    // port, so those land on the payment page rather than the wrong sheet.
    if (!promo || ['7', '11'].includes(promo.promoType)) { navigation.navigate('recharge'); return }
    setPaymentPromo(promo)
  }

  // Angular: dismissModal('upgradeNow') → paymentService.redirectToIntermediatePage(
  // fromPage, PAYMENTID, type, true).
  function handlePaymentPromoUpgrade() {
    const promo = paymentPromo
    setPaymentPromo(null)
    if (!promo) return
    logEvent({ category: 'PaymentPopupPromo', action: 'activity', label: 'Popup-Clicked' })
    redirectToIntermediatePage('activity', promo.paymentId, promo.type, true)
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

  // Angular: reportProfile() — a reported profile is dropped from the list and
  // the tab's totalCount goes down, exactly like a removed one.
  function handleReportSubmitted() {
    if (reportTarget) removeProfile(listKey, reportTarget.id)
    setReportTarget(null)
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

  // ── Navigation / CTAs ────────────────────────────────────────────────────────

  // Angular: goToMatches() → navigatePage('matches').
  function goToMatches() {
    logEvent({ category: 'Menu', action: 'matches', label: 'Clicked' })
    navigation.navigate('Matches')
  }

  // Angular: goToPayment() → paymentService.redirectToIntermediatePage(url,'','7').
  function goToPayment() {
    logEvent({ category: 'PaymentBannerPromo', action: 'Activity', label: 'Banner-Clicked' })
    navigation.navigate('recharge')
  }

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 3: openMembershipTab(); break
      case 4: navigation.navigate('MessagerList'); break
      // case 2 is this screen — do nothing
    }
  }

  // Angular: stickiyBtnEmit() — 'close' sets STICKYFLAG=1 (hidden for the rest of
  // the session), the payment sticky routes to /my-membership, the
  // profile-validation one opens its bottom sheet.
  const activeSticky: 'profileValidation' | 'autopay' | null =
    stickyDismissed || isViewedList ? null
      : profileValidationBanner ? 'profileValidation'
      : autopaySticky ? 'autopay'
      : null

  function handleStickyPress() {
    if (activeSticky === 'profileValidation') setProfileValidationSheetVisible(true)
    else openMembershipTab()
  }

  function handleStickyClose() { setStickyDismissed(true) }

  function handleProfileValidationCtaPress() {
    setProfileValidationSheetVisible(false)
    if (customerCare.phone) Linking.openURL(`tel:${customerCare.phone}`)
  }

  // ── Computed ──────────────────────────────────────────────────────────────────

  const current = tabData[listKey]
  const isPaid  = !['B', 'F'].includes(gating.ownEntryType)
  // Angular: profileCount — the header-list totalCount for the selected type,
  // falling back to the listing API's own TOTAL.
  const profileCount = counts[listKey]?.totalCount ?? current.total

  function countFor(key: ListKey): number {
    return counts[key]?.totalCount ?? tabData[key].total
  }

  // Angular: (Item?.name | translate) + bindValue(Item?.totalCount,'curlyBraces')
  // — item.name is pageContent['<TYPE>_TITLE'] (setCountListValue()).
  function tabLabel(tab: LikedTab): string {
    const count = countFor(tab)
    const base  = tab === 'likedyou' ? t('LIKE_LIST.LIKEDYOU_TITLE') : t('LIKE_LIST.LIKESENT_TITLE')
    return count > 0 ? `${base} (${count})` : base
  }

  // Angular: ViewedByMeTabs — name keys 'GENERAL.VIEWEDBYME' / 'HOME.VIEWLATER_SUB_TXT'.
  function subTabLabel(sub: ViewedSubTab): string {
    const count = countFor(sub)
    const base  = sub === 'viewedbyme' ? t('GENERAL.VIEWEDBYME') : t('HOME.VIEWLATER_SUB_TXT')
    return count > 0 ? `${base} (${count})` : base
  }

  // Angular: app-chip's countShow — newcount!=0 && tab not yet opened this session/install.
  function tabUnreadCount(tab: ListKey): number {
    return viewedTabs[tab] ? 0 : (counts[tab]?.newcount ?? 0)
  }

  // Angular: getheaderTitle() — the viewed-list back-button header's title.
  // 'viewedbyme' is a plain label; 'viewedyou' runs through updatePluralContent()
  // (#PLURAL# → PROFILES.PLURALMEMBER once the count is > 1).
  function viewedHeaderTitle(): string {
    if (selectedType === 'viewedbyme') return t('GENERAL.VIEWEDBYME')
    const raw = t('HOME.WHO_VIEWED_YOU_HEADER')
    if (!raw.includes('#PLURAL#')) return raw
    return raw.replace('#PLURAL#', profileCount > 1 ? t('PROFILES.PLURALMEMBER') : '')
  }

  // Angular: bindTitle(topBanner.title, profileCount) — "#COUNT#" becomes
  // "<n> match/matches" for en/tm/tl (and the singular Tamil LIKEDYOU_ONE copy),
  // a bare number everywhere else.
  function bannerTitle(): string {
    let title = topBanner.title || (selectedType === 'likedyou' ? t('LIKE_LIST.LIKEDYOU') : t('LIKE_LIST.LIKESENT'))
    const lang  = i18n.language
    const count = profileCount

    if (lang === 'tm' && count === 1 && selectedType === 'likedyou') {
      title = t('LIKE_LIST.LIKEDYOU_ONE')
    }

    let countTxt = count > 0 ? String(count) : ''
    if (['en', 'tm', 'tl'].includes(lang)) {
      const word = selectedType === 'likesent'
        ? t(count === 1 ? 'LIKE_LIST.LIKESENT_MATCH' : 'LIKE_LIST.LIKESENT_MATCHES')
        : t(count === 1 ? 'LIKE_LIST.MATCH' : 'LIKE_LIST.MATCHES')
      countTxt = count > 0 ? `${count} ${word}` : ''
    }

    // Angular only replaces '#COUNT#', but the same count token is authored three
    // ways across the content strings/locale files ('##COUNT#' in the VIEWEDYOU/
    // VIEWEDBYME copy, and a stray '#COUNT' with no closing hash) — matching all
    // three keeps a raw placeholder from ever reaching the screen.
    return stripHtml(title.replace(/##?COUNT#?/g, countTxt))
  }

  const oppAvatar = gating.loginGender === 'F' ? MALE_AVATAR_URL : FEMALE_AVATAR_URL

  // ── Desktop ────────────────────────────────────────────────────────────────────
  // The viewed-list drill-downs are a mobile navigation flow (Angular reaches
  // them through the mobile Home see-all rows); on desktop only the two main
  // chips render, so the desktop layout is used for that mode only.

  // Desktop web is deliberately left as it was — this port's Angular-parity work
  // (gender-ordered chips, server-driven banner copy, the empty-state CTA, the
  // paid-member message CTA) is mobile-only by request.
  if (isDesktop && !isViewedList) {
    return (
      <ActivityDesktopLayout
        activeTab={selectedType as LikedTab}
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
        onGetPaidMembership={goToPayment}
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
        {/* Angular: bottom-sheet.component's `action == 'paymentPromo'` block. */}
        <BottomSheet
          visible={!!paymentPromo}
          type="paymentPromo"
          data={{
            title:      paymentPromo?.title,
            content:    paymentPromo?.content,
            subContent: paymentPromo?.subContent,
            benefits:   paymentPromo?.benefits,
            ctaLabel:   paymentPromo?.ctaLabel || t('GENERAL.BECOME_PAID'),
          }}
          onClose={() => setPaymentPromo(null)}
          onPrimaryPress={handlePaymentPromoUpgrade}
        />
        {reportTarget && (
          <ReportProfileModal
            visible
            partnerId={reportTarget.id}
            partnerName={reportTarget.name}
            onClose={() => setReportTarget(null)}
            onSubmitted={handleReportSubmitted}
          />
        )}
        <BottomSheet
          visible={!!phoneInfo.sheet}
          type="phonePrivacyInfo"
          data={phoneInfo.getData(t)}
          onClose={phoneInfo.close}
          onPrimaryPress={() => phoneInfo.primaryPress(navigation)}
          onSecondaryPress={() => phoneInfo.secondaryPress(addPhoto.openAddPhoto, navigation)}
          onLinkPress={phoneInfo.close}
        />
        <AppRatingModal
          visible={!!appRating.trigger}
          source={appRating.trigger?.source ?? '1'}
          onClose={appRating.close}
        />
        <AppRatingModal
        visible={!!appRating.trigger}
        source={appRating.trigger?.source ?? '1'}
        onClose={appRating.close}
      />
      <Toast request={toastRequest} />
        <WebPhotoInput inputRef={addPhoto.webInputRef} onChange={addPhoto.handleWebFiles} />
        <AddPhotoVerdictSheets addPhoto={addPhoto} />
      </ActivityDesktopLayout>
    )
  }

  // ── Render helpers (mobile) ────────────────────────────────────────────────────

  // Angular: the #deletedProfile ng-template — a 145px-tall plain row with the
  // profile's photo, name and "This profile has been deleted", tapping it toasts.
  function renderDeletedProfile(item: MatchProfile) {
    return (
      <Pressable style={styles.deletedRow} onPress={showMessage}>
        <CdnImage
          uri={item.photos?.[0] || item.profileImg || oppAvatar}
          width={84} height={84} style={styles.deletedImg} resizeMode="cover"
        />
        <View style={styles.deletedTextCol}>
          <Text style={styles.deletedName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.deletedNote}>{t('LIKE_LIST.DELETED_PROFILE_TXT')}</Text>
        </View>
      </Pressable>
    )
  }

  // Angular: <app-list-view-card type="numberviewed"> with bindBasicView() —
  // photo + name + "City • Age" / "Education • Occupation", then the card's own
  // link CTA.
  function renderViewedByMeCard(item: MatchProfile) {
    const line1 = [item.location, item.age].filter(Boolean).join('  •  ')
    const line2 = [item.education, item.occupation].filter(Boolean).join('  •  ')
    return (
      <Pressable style={styles.listCard} onPress={() => handlePress(item)}>
        <CdnImage
          uri={item.photos?.[0] || item.profileImg || oppAvatar}
          width={88} height={88} style={styles.listCardImg} resizeMode="cover"
        />
        <View style={styles.listCardTextCol}>
          <Text style={styles.listCardName} numberOfLines={1}>{item.name}</Text>
          {!!line1 && <Text style={styles.listCardDetail} numberOfLines={1}>{line1}</Text>}
          {!!line2 && <Text style={styles.listCardDetail} numberOfLines={2}>{line2}</Text>}
          {/* Angular: list-view-card.component.html:28-37 — the card renders a
              link CTA whenever `linkBtn` is passed, and activity.component.html
              :232 passes CONFIG.LINK_BTN for this list. Its label falls back to
              BTN_TXT.listCardVPText = CTATXT.VIEWDETAILS ("View profile"), NOT
              MATCHES.VIEW_PROFILE_CTA, and LINK_BTN's iconType is
              forwardAnimation — the same animated arrow the matches card uses.
              This port dropped the link ("no CTAs"), which is the missing piece.

              No onPress of its own: LINK_BTN's buttonType is `viewprofile` and
              the whole card already navigates there, so the link is the
              affordance for the tap target that surrounds it. */}
          <View style={styles.listCardLink}>
            <Text style={styles.listCardLinkText}>{t('CTATXT.VIEWDETAILS')}</Text>
            <Image source={{ uri: RIGHT_ARROW_ANIMATION_URI }} style={styles.listCardLinkArrow} />
          </View>
        </View>
      </Pressable>
    )
  }

  function renderItem({ item }: { item: MatchProfile }) {
    if (isDeletedProfile(item)) return renderDeletedProfile(item)
    if (selectedType === 'viewedbyme') return renderViewedByMeCard(item)

    return (
      <View style={styles.cardWrap}>
        <MatchCard
          profile={item}
          oppGender={gating.oppGender}
          ownEntryType={gating.ownEntryType}
          femaleFreeEligible={gating.femaleFreeEligible}
          indNumbersLeft={gating.indNumbersLeft}
          waPhotoFlag={gating.waPhotoFlag}
          onPress={() => handlePress(item)}
          onLike={() => handleLike(item)}
          onDontShow={() => handleDontShow(item)}
          onViewLater={() => handleViewLater(item)}
          onCall={() => confirmThenContact(item, 'call')}
          onWhatsApp={() => confirmThenContact(item, 'whatsapp')}
          onMessage={() => handleMessage(item)}
          showLikedBadge={!isViewedList}
        />
        {/* Figma: circular dark 3-dot menu, top-right of the photo — Angular's
            IsShowThreeDots = !isViewedList() (Report always, Remove only on the
            "Liked by you" tab). Not part of MatchCard itself (the plain Matches
            list never shows this), so it's overlaid here. */}
        {!isViewedList && (
          <>
            <Pressable style={styles.menuBtn} onPress={() => handleMenuPress(item)} hitSlop={8}>
              <View style={styles.menuDot} />
              <View style={styles.menuDot} />
              <View style={styles.menuDot} />
            </Pressable>
            {openMenuId === item.profileId && (
              <ThreeDotMenu
                showRemove={selectedType === 'likesent'}
                showReport
                onRemove={() => handleRemovePress(item)}
                onReport={() => handleReportPress(item)}
              />
            )}
          </>
        )}
      </View>
    )
  }

  // Angular: the .shortlisted-header row — only for a female-free viewer
  // (EntryType 'F'), never in viewed-list mode, and only when there's content.
  function renderListHeader() {
    if (isViewedList || !isFreeEntry || !topBanner.title || current.profiles.length === 0) return null
    return (
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{bannerTitle()}</Text>
        {!!topBanner.subtitle && <Text style={styles.bannerSub}>{stripHtml(topBanner.subtitle)}</Text>}
        <Pressable style={styles.bannerBtn} onPress={goToPayment}>
          <Text style={styles.bannerBtnLabel}>{stripHtml(topBanner.cta) || t('GENERAL.BECOME_PAID')}</Text>
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

  // Angular: the two "no profiles" blocks — illustration + title + sub-title +
  // the secondary "Go to matches" CTA. `viewedbyme` uses its own pair of icons
  // and copy per sub-tab.
  function renderEmpty() {
    if (!current.loaded) return null

    const isViewedByMe = selectedType === 'viewedbyme'
    const isViewLater  = selectedType === 'viewedbyme' && selectedSubTab === 'viewinglater'

    const icon = isViewedByMe
      ? `${CDN_SVG}${isViewLater ? 'viewlater_icon.svg' : 'viewedyou_icon.svg'}`
      : `${CDN_SVG}liked_profiles_empty.svg`

    const title = isViewedByMe
      ? t(isViewLater ? 'LIKE_LIST.VIEWLATER_CONT' : 'LIKE_LIST.VIEWEDYOU_CONT')
      : t(['likesent', 'viewedbyme'].includes(selectedType) ? 'LIKE_LIST.NOPROFILE_CONT' : 'LIKE_LIST.NOPROFILE_CONT_1')

    const subtitle = isViewedByMe
      ? (isViewLater ? '' : t('LIKE_LIST.VIEWEDYOU_SUBCONT'))
      : t(['likesent', 'viewedbyme'].includes(selectedType) ? 'LIKE_LIST.NOPROFILE_CONT_SUB' : 'LIKE_LIST.NOPROFILE_CONT_1_SUB')

    return (
      <View style={styles.emptyState}>
        <CdnSvg uri={icon} width={160} height={160} />
        <Text style={styles.emptyTitle}>{stripHtml(title)}</Text>
        {!!subtitle && <Text style={styles.emptySubtitle}>{stripHtml(subtitle)}</Text>}
        <Pressable style={styles.emptyCta} onPress={goToMatches}>
          <Text style={styles.emptyCtaLabel}>{t('GENERAL.ACTIVITY_CTA')}</Text>
        </Pressable>
      </View>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>

      {/* ── Header — Angular renders the plain title+language row for the
          activity tabs, and a back-button + title row in viewed-list mode. ── */}
      {isViewedList ? (
        <View style={styles.viewedHeader}>
          <Pressable onPress={() => handleBack()} hitSlop={10} style={styles.backBtn}>
            <CdnSvg uri={`${CDN_SVG}arrow-back-activity.svg`} width={24} height={24} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{viewedHeaderTitle()}</Text>
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('GENERAL.ICON_3')}</Text>
          {/* Angular: *ngIf="FUNC.showLanguageList('activity')" — LANGLIST.activity is true. */}
          <LanguagePill langCode={i18n.language} />
        </View>
      )}

      {showPhotoPromotion && !isViewedList ? (
        /* Angular: <ion-content *ngIf="showPhotoPromotion && !isViewedList()">
           with <app-add-photo fromPage="activity"> — the promotion REPLACES the
           tabs and the listing entirely until a photo is added. */
        <View style={styles.photoPromoWrap}>
          {!!photoPromoBanner?.['BANNERIMG'] && (
            <CdnImage uri={String(photoPromoBanner['BANNERIMG'])} width={220} height={180} />
          )}
          <Text style={styles.photoPromoTitle}>
            {stripHtml(String(photoPromoBanner?.['TITLE'] ?? t('GENERAL.ADD_PHOTO', 'Add your photo')))}
          </Text>
          {!!photoPromoBanner?.['BODY'] && (
            <Text style={styles.photoPromoBody}>{stripHtml(String(photoPromoBanner['BODY']))}</Text>
          )}
          <Pressable style={styles.photoPromoCta} onPress={() => addPhoto.openAddPhoto(navigation)}>
            <Text style={styles.photoPromoCtaLabel}>
              {stripHtml(String(photoPromoBanner?.['CTA'] ?? t('LIKE_LIST.PHOTO_REQ_CTA')))}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* ── Tab chips — the two activity chips, or the viewedbyme sub-tabs ── */}
          {!isViewedList && (
            <View style={styles.tabBarWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
                {tabOrder.map(tab => {
                  const isActive = selectedType === tab
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
          )}

          {selectedType === 'viewedbyme' && (
            <View style={styles.tabBarWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
                {VIEWED_SUB_TABS.map(sub => {
                  const isActive = selectedSubTab === sub
                  return (
                    <Pressable
                      key={sub}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() => switchSubTab(sub)}
                    >
                      <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{subTabLabel(sub)}</Text>
                    </Pressable>
                  )
                })}
              </ScrollView>
            </View>
          )}

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
                // react-native-web's FlatList doesn't support this correctly — same
                // guard MatchesScreen.tsx's own list uses (removeClippedSubviews=
                // {Platform.OS !== 'web'}) to avoid crashing on web.
                removeClippedSubviews={Platform.OS !== 'web'}
              />
            )}
          </View>
        </>
      )}

      {/* ── Payment stickies — Angular: <app-payment-stickey *ngIf="... && !isViewedList()"> ── */}
      {activeSticky === 'profileValidation' && (
        <PhotoPromoSticky
          content={profileValidationBanner!.stickyContent}
          imageUrl={profileValidationBanner!.stickyImg}
          onPress={handleStickyPress}
        />
      )}
      {activeSticky === 'autopay' && (
        <StickyBanner
          text={autopaySticky!.content}
          ctaLabel={autopaySticky!.ctaLabel}
          onPress={handleStickyPress}
          onClose={handleStickyClose}
        />
      )}

      <BottomSheet
        visible={profileValidationSheetVisible}
        type="profileValidation"
        data={{
          title:    profileValidationBanner?.bottomTitle,
          content:  profileValidationBanner?.bottomContent,
          image:    profileValidationBanner?.bottomImg,
          ctaLabel: customerCare.phone || profileValidationBanner?.bottomCtaLabel,
        }}
        onClose={() => setProfileValidationSheetVisible(false)}
        onPrimaryPress={handleProfileValidationCtaPress}
      />
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
      {/* Angular: bottom-sheet.component's `action == 'paymentPromo'` block —
          the free-member upgrade sheet behind Call / WhatsApp / Message. */}
      <BottomSheet
        visible={!!paymentPromo}
        type="paymentPromo"
        data={{
          title:      paymentPromo?.title,
          content:    paymentPromo?.content,
          subContent: paymentPromo?.subContent,
          benefits:   paymentPromo?.benefits,
          ctaLabel:   paymentPromo?.ctaLabel || t('GENERAL.BECOME_PAID'),
        }}
        onClose={() => setPaymentPromo(null)}
        onPrimaryPress={handlePaymentPromoUpgrade}
      />
      {reportTarget && (
        <ReportProfileModal
          visible
          partnerId={reportTarget.id}
          partnerName={reportTarget.name}
          onClose={() => setReportTarget(null)}
          onSubmitted={handleReportSubmitted}
        />
      )}
      <BottomSheet
        visible={!!phoneInfo.sheet}
        type="phonePrivacyInfo"
        data={phoneInfo.getData(t)}
        onClose={phoneInfo.close}
        onPrimaryPress={() => phoneInfo.primaryPress(navigation)}
        onSecondaryPress={() => phoneInfo.secondaryPress(addPhoto.openAddPhoto, navigation)}
        onLinkPress={phoneInfo.close}
      />
      <AppRatingModal
        visible={!!appRating.trigger}
        source={appRating.trigger?.source ?? '1'}
        onClose={appRating.close}
      />
      <Toast request={toastRequest} />
      <WebPhotoInput inputRef={addPhoto.webInputRef} onChange={addPhoto.handleWebFiles} />
      <AddPhotoVerdictSheets addPhoto={addPhoto} />
    </SafeAreaView>
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
  // Angular: the isViewedList() header row — back button + title, no language pill.
  viewedHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider,
  },
  backBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font18, color: Colors.textDark },

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
  // Angular: chip.component.html:3 — `color-1f1e1b body2-regular-14`, the SAME
  // class regardless of selected state (only the chip container's own
  // border/background change, not the label color).
  chipLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.chipLabelText },
  chipLabelActive: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.chipLabelText },
  // Angular: app-chip's countShow badge — small red circle, white count text.
  unreadBadge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  // Angular: chip.component.html:10 — `font-12-all white-color` (global.scss:2276)
  // — Poppins-Regular 12px, not semibold 11px.
  unreadBadgeText: { fontFamily: Fonts.poppinsRegular, fontSize: FontSize.font12, color: Colors.white },

  // ── Card + 3-dot menu overlay ──────────────────────────────────────────────────
  cardWrap: { position: 'relative' },
  menuBtn: {
    position: 'absolute', top: 16, right: 16,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(84,84,84,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  menuDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.white },

  // ── Viewed-by-me / view-later row (Angular: app-list-view-card) ───────────────
  listCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 8,
    marginHorizontal: 16, marginTop: 16, padding: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.divider,
  },
  listCardImg: { borderRadius: 8, backgroundColor: Colors.background },
  listCardTextCol: { flex: 1, gap: 4 },
  // Angular: list-view-card.component.html:14 — without `showCheckbox` (this
  // screen's usage), the name span is `black-color font-14-semibold` — 14px
  // Poppins-Semibold, #000000, not 16px `textDark`.
  listCardName: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font14, color: Colors.black },
  // Angular: list-view-card.component.html:26 — `body3-regular-12`, no color
  // class (inherits #000000 from the row's own `reallyblack` class) — 12px,
  // not 13px/textMedium, and no line-height rule exists for it either.
  listCardDetail: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.black },
  // Angular: the link sits in a `mt-4` wrapper and app-button-revamp gives it
  // `textClassName: 'body3-regular-12 single-line-text'` + textColor `link` — 12px
  // regular, not the 14px the matches card uses for its own View-profile link.
  listCardLink: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  listCardLinkText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.link },
  listCardLinkArrow: { width: 20, height: 16 },

  // ── Deleted profile placeholder (Angular: .delete-div) ──────────────────────
  // CITATION CORRECTED: an earlier note here claimed ".delete-div, fixed 145px".
  // There is no 145 anywhere in activity.component.scss — the real rule
  // (:780-783, duplicated at :666-669) is only
  //   .delete-div { border-bottom: 8px solid #e6e6e6; padding-bottom: 16px }
  // i.e. no height, no radius, no surrounding card outline, and the same 8px
  // grey separator every match card uses.
  //
  // FLAGGED, not changed: this port renders a rounded (8) hairline-bordered
  // card inset 16 on each side with a fixed 145 height instead. Reshaping it to
  // Angular's full-bleed 8px-separator row is a layout change, not a typography
  // fix, so the values are left as they are and only called out here.
  deletedRow: {
    height: 145, flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 16, padding: 12,
    backgroundColor: Colors.surface, borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.divider,
  },
  deletedImg: { borderRadius: 8, backgroundColor: Colors.background },
  deletedTextCol: { flex: 1, gap: 6 },
  // Angular: activity.component.html:249's `heading4-medium-16 pl-12` — no
  // color class, inherits #000000 — not `textDark`.
  deletedName: { fontFamily: Fonts.poppinsMedium, fontSize: FontSize.font16, color: Colors.black },
  // Angular: `.detail-matches` (activity.component.scss:539) — Poppins-Regular
  // 14px (not 13), `var(--gray)` = #666666 (= Colors.textSecondary, not
  // textMedium), line-height 18px.
  deletedNote: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.textSecondary, lineHeight: 18 },

  // ── Unpaid upsell banner ────────────────────────────────────────────────────
  // Angular: `.shortlisted-header` (activity.component.scss:774-778) —
  // background rgba(181, 0, 51, 0.05) and padding 16 both match exactly (it
  // also carries margin-top: 6, supplied by the list layout here). Previously
  // attributed to Figma; it is a real Angular rule.
  banner: { backgroundColor: 'rgba(181, 0, 51, 0.05)', padding: 16, gap: 6 },
  // Angular: `.shortlisted-header` block (activity.component.html:158-177) —
  // title `heading3-semibold-16 black-color` (#000000, not textPrimary).
  bannerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font16, color: Colors.black, lineHeight: 22 },
  // Angular: `body2-regular-14 black-color line-height-20` — #000000, not textMedium.
  bannerSub: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black, lineHeight: 20, marginBottom: 8 },
  // Angular: buttonSize `mediumsemibold`, border `primaryBorder` ->
  // --ion-color-primary (#B50033 = primaryDark, not the brighter primary red).
  bannerBtn: {
    alignSelf: 'flex-start', borderWidth: 1.5, borderColor: Colors.primaryDark, borderRadius: 6,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  // Angular: no ctaFontSize override -> default body2-regular-14 (Poppins-
  // Regular 14px), but `.mediumsemibold span{font-weight:500}` wins over that
  // class's own 400. textColor 'primaryColor' -> --ion-color-primary (primaryDark).
  bannerBtnLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, fontWeight: '500', color: Colors.primaryDark },

  // ── Add-photo promotion (Angular: app-add-photo, fromPage="activity", default
  // promotype='1') ─────────────────────────────────────────────────────────────
  photoPromoWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  // Angular: add-photo.component.html:26 — `heading1-semibold-20 black-color
  // line-height-32` — 20px (not 18), #000000, line-height 32.
  photoPromoTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font20, color: Colors.black, textAlign: 'center', lineHeight: 32 },
  // Angular: promotype='1' renders the SUBHEADER line — `body2-regular-14
  // black-color`, no line-height class — #000000, not textMedium. (Angular
  // also renders two `heading4-medium-16 black-color` bullet points below this
  // that photoPromoBanner's TITLE/BODY/CTA shape has no data for — not fixed
  // here, flagging as a real content-model gap.)
  photoPromoBody: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black, textAlign: 'center' },
  photoPromoCta: {
    marginTop: 8, backgroundColor: Colors.primaryDark, borderRadius: 8,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  // Angular: no buttonSize/ctaFontSize override -> default body2-regular-14 —
  // Poppins-Regular 14px (not Medium 15), white.
  photoPromoCtaLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.white },

  // ── List ──────────────────────────────────────────────────────────────────────
  listContent: { flexGrow: 1, paddingBottom: 16 },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, paddingVertical: 40, gap: 8,
  },
  // Angular: activity.component.html:99+ empty block — `heading3-semibold-16
  // black-color` (#000000, not textPrimary).
  emptyTitle: { marginTop: 8, fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font16, color: Colors.black, textAlign: 'center' },
  // Angular: `body2-regular-14 black-color` (#000000, not textSecondary).
  emptySubtitle: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black, textAlign: 'center', lineHeight: 20 },
  // Angular: SECONDARY_BTN (button.config.ts:50) — border `primaryBorder` ->
  // --ion-color-primary (#B50033 = primaryDark), NOT a red/primary label —
  // textColor is literally `black`.
  emptyCta: {
    marginTop: 16, borderWidth: 1.5, borderColor: Colors.primaryDark, borderRadius: 8,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  // Angular: no buttonSize/ctaFontSize override -> default body2-regular-14 —
  // Poppins-Regular 14px (not Medium 15), textColor black (not primary red).
  emptyCtaLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black },
})
