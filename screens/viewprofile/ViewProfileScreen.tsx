// ViewProfile screen — Angular: pages/viewprofile/viewprofile.page.ts/.html.
// Phase 1 (core profile view): photo, badges, name/ID, Like/ViewLater/DontShow or
// after-like CTA row, Call/WhatsApp, and all detail sections (display-only for
// horoscope — no request/upload actions yet). Deferred to later passes: pinch-zoom
// photo gestures, prev/next profile swipe + cache, Daily-Recommendation mode,
// horoscope request/upload, similar-profiles carousel, report-profile popover,
// self-preview/edit-profile mode, and GAM ads (no RN equivalent, dropped for good).
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Dimensions, FlatList, Linking,
  NativeScrollEvent, NativeSyntheticEvent,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { LANG_LABELS } from '../../components/matches-header/MatchesHeader'
import {
  WhatsAppIcon, WhatsAppUnlockButton, CallIcon, CloseIcon, ViewLaterIcon, LikeIcon,
  showLikeCTA, showAfterLikeCTA, disableDontShow, disableViewLater, HtmlText,
  getBlurPhotoUri, NEWLY_JOINED_STAR_URI, ProfileBadge, PhotoSwiper,
  getAfterLikeCtaLabel, getAfterLikeCtaIcon, getAfterLikeContentText, showContactsLeftBanner, showFreeBadge,
  type AfterLikeCtx,
} from '../../components/matches/matchesCard.shared'
import WhatsAppPaywallModal from '../../components/matches/WhatsAppPaywallModal'
import StickyBanner from '../../components/sticky-banner/StickyBanner'
import MembershipBanner from '../../components/matches/MembershipBanner'
import PhotoViewerModal from '../../components/matches/PhotoViewerModal'
import PhotoViewerModalDesktop from '../../components/matches/PhotoViewerModalDesktop'
import ReportProfileModal from '../../components/matches/ReportProfileModal'
import ContactDetailsSheet from '../../components/matches/ContactDetailsSheet'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import ViewProfileDesktopLayout from './ViewProfileDesktopLayout'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import {
  getViewProfile, markProfileViewed, getSimilarProfiles, viewHoroscope, getStarMatch,
  getBioDataLink, getEnlargedPhotos,
  _debugLastViewProfileResult,
  type SimilarProfileCard, type StarMatchResult,
} from '../../service/viewProfileService'
import { ENavigation } from '../../types/enums/navigation.enum'
import { navigate as navigateGlobal } from '../../utils/navigationRef'
import { viewProfileAdapter } from '../../adapters/viewProfile.adapter'
import { communicationBtnOnClick, fetchContactDetails } from '../../service/communicationService'
import { getHeroBannerDetails } from '../../service/paymentService'
import { fetchMenuPromo } from '../../service/homeService'
import { getItem, getJson } from '../../service/storageService'
import { getSessionValue, getRegistrationArrays } from '../../service/registrationService'
import { redirectToViewProfile } from '../../service/buttonService'
import { shouldShowCoachMark, markCoachMarkShown } from '../../service/coachMarkService'
import { StorageKeys } from '../../constants/storage.keys'
import { Colors } from '../../constants/colors'
import { CDN_SVG, CDN_REACT } from '../../constants/cdn'
import i18n from '../../i18n'
import type { ViewProfileModel } from '../../types/interfaces/viewProfile.interface'

// Angular's real back button is Ionic's bundled `icon="arrow-back"` (ships in the
// app's own JS bundle, not a network fetch) — this app's own established equivalent
// for that same "local back-arrow icon" slot is a CDN-hosted SVG fetched via
// CdnSvg, already used this exact way by AppHeader.tsx (registration/login screens).
const BACK_ICON_URI = CDN_REACT + '/arrowleft.svg'

// Angular: viewprofile.page.html — one <img> per detail row, under assets/images/svg/
// (most under a viewprofile/ subfolder, two — children/physical-status — are not).
// Exported so ViewProfileDesktopLayout's own detail rows (different inline layout,
// same icon set) don't need a second copy of these CDN paths.
export const ICON = {
  createdFor:     CDN_SVG + 'viewprofile/profile-created-icon.svg',
  age:            CDN_SVG + 'viewprofile/age-icon.svg',
  height:         CDN_SVG + 'viewprofile/height-icon.svg',
  maritalStatus:  CDN_SVG + 'viewprofile/marital-status-icon.svg',
  children:       CDN_SVG + 'revamp-child.svg',
  physicalStatus: CDN_SVG + 'physical-status.svg',
  motherTongue:   CDN_SVG + 'viewprofile/language-icon.svg',
  location:       CDN_SVG + 'viewprofile/hometown-vp.svg',
  education:      CDN_SVG + 'viewprofile/education-icon.svg',
  occupation:     CDN_SVG + 'viewprofile/occupation-icon.svg',
  salary:         CDN_SVG + 'viewprofile/salary-icon.svg',
  caste:          CDN_SVG + 'viewprofile/caste-icon.svg',
  raasi:          CDN_SVG + 'viewprofile/raasi-icon.svg',
  star:           CDN_SVG + 'viewprofile/star-icon.svg',
  dosham:         CDN_SVG + 'viewprofile/dosham-icon.svg',
  drinking:       CDN_SVG + 'viewprofile/drinking-habit-icon.svg',
  smoking:        CDN_SVG + 'viewprofile/smoking-habit-icon.svg',
  eating:         CDN_SVG + 'viewprofile/eating-habit-icon.svg',
  brother:        CDN_SVG + 'viewprofile/brother-icon.svg',
  sister:         CDN_SVG + 'viewprofile/sister-icon.svg',
  property:       CDN_SVG + 'viewprofile/property-details-icon.svg',
  vehicle:        CDN_SVG + 'viewprofile/vehicle-details-icon.svg',
  horoscope:      CDN_SVG + 'viewprofile/horoscope-icon.svg',
}

// Angular: viewprofile.page.html's photo swiper is sized to scrWidth (viewport
// width) with NO explicit height override — i.e. a flat, full-bleed SQUARE photo,
// not the rounded/cropped rectangle Matches cards use.
const SCREEN_WIDTH = Dimensions.get('window').width
const PHOTO_HEIGHT = SCREEN_WIDTH

// Angular: "Other profiles like X" is <app-swiper> — Swiper.js with its navigation
// module (arrow buttons) + per-card snapping, not a freely-scrolling list. One
// swipe/arrow-tap advances exactly one card width, revealing the next card peeking
// at the edge (not a single full-bleed slide like the photo swiper). Confirmed
// against src/app/core/config/home.config.ts's `similarprofiles` swiper config:
// `{ slidesPerView: 1.628, spaceBetween: 16, freeMode: true }` — a FRACTIONAL
// slidesPerView, not a fixed card width, is what makes ~1 card fill the screen
// plus a partial peek of the next (a fixed 140px card let 3 fit on wider screens,
// which is the bug this replaced — confirmed against a real screenshot).
const SIMILAR_CARD_GAP   = 16
const SIMILAR_CARD_WIDTH = Math.round(SCREEN_WIDTH / 1.628)
const SIMILAR_CARD_STRIDE = SIMILAR_CARD_WIDTH + SIMILAR_CARD_GAP

// Angular: none/1/many/"more than 5" text variants for brothers/sisters counts.
// Angular: viewprofile.page.html:1014-1053 — BROTHERS/SISTERS are NOT a literal
// headcount, they're a special code: 1-4 are literal counts, but 5 means "more
// than 5" and 6 means "none" (zero is apparently never sent as a literal 0).
// Treating 6 as "n > 5" (as an earlier version of this did) inverted the
// "No Brothers"/"More than 5 brothers" labels for exactly those two codes.
export function familyCountText(
  count: string | undefined,
  t: (key: string) => string,
  keys: { none: string; one: string; many: string; moreThan: string },
): string {
  const n = Number(count)
  if (!count || Number.isNaN(n)) return ''
  if (n === 6) return t(keys.none)
  if (n === 5) return t(keys.moreThan)
  if (n === 1) return `1 ${t(keys.one)}`
  return `${n} ${t(keys.many)}`
}

// ─── Small presentational helpers ──────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>
}

// Angular: each row is icon + (label directly ABOVE value, not side-by-side), with
// a border-bottom on every row except the last one in its section
// (viewprofile.page.html — border-bottom-global omitted on each section's final row).
function DetailRow({
  icon, label, value, isLast,
}: { icon: string; label: string; value?: string | undefined; isLast?: boolean }) {
  if (!value) return null
  return (
    <View style={[s.detailRow, !isLast && s.detailRowBorder]}>
      <View style={s.detailIconCol}>
        <CdnSvg uri={icon} width={20} height={20} />
      </View>
      <View style={s.detailTextCol}>
        <Text style={s.detailLabel}>{label}</Text>
        {/* Angular binds several of these via [innerHTML] (e.g. HEIGHTCATEGORY carries
            a literal <span class="height-revamp-text-small">...</span>) — a plain Text
            would show the raw tag text; HtmlText strips/renders it properly. */}
        <HtmlText html={value} style={s.detailValue} />
      </View>
    </View>
  )
}

// Angular: app-swiper's similar-profiles card — when the profile has no photo, an
// `app-photo-request` overlay shows GENERAL.REQUEST_ADD_PHOTO_WHATSAPP ("Contact and
// Get #HER_HIS# Photos on WhatsApp") + a WhatsApp CTA on top of the blurred placeholder
// (photo-new.component.html:76-93). No name/other text on the card itself.
export function SimilarProfileCardItem({
  card, oppGender, t, onPress, size,
}: {
  card: SimilarProfileCard; oppGender: 'M' | 'F'; t: (key: string) => string; onPress: () => void
  // Mobile omits this and gets s.similarCard's own SIMILAR_CARD_WIDTH (derived
  // from Dimensions.get('window').width). Desktop MUST pass an explicit size —
  // on web that same Dimensions call returns the full browser width, which
  // silently rendered a card hundreds of pixels wider/taller than its 180×180
  // grid slot; wrapping it in an overflow:hidden box only clipped a corner of
  // that oversized card instead of actually resizing it (the extreme-zoom /
  // missing-caption bug a real screenshot caught).
  size?: number | undefined
}) {
  return (
    <Pressable style={[s.similarCard, size ? { width: size, height: size } : null]} onPress={onPress}>
      {card.isPhotoAvailable && card.photoUri ? (
        <>
          <Image source={{ uri: card.photoUri }} style={s.similarCardImg} contentFit="cover" />
          {/* Angular: app-profile-card caption — name, age, education over a bottom
              gradient scrim, shown only for cards that actually have a photo
              (confirmed against screenshot — no-photo/WhatsApp-request cards carry
              no caption at all). */}
          {!!card.name && (
            <View style={s.similarCardCaption} pointerEvents="none">
              <Text style={s.similarCardName} numberOfLines={1}>{card.name}</Text>
              {(card.age || card.education) && (
                <Text style={s.similarCardMeta} numberOfLines={1}>
                  {[card.age && `${card.age} years`, card.education].filter(Boolean).join(', ')}
                </Text>
              )}
            </View>
          )}
        </>
      ) : (
        <>
          <CdnSvg uri={getBlurPhotoUri(oppGender)} width="100%" height="100%" />
          <View style={s.similarCardOverlay}>
            <Text style={s.similarCardOverlayText}>
              {t('GENERAL.REQUEST_ADD_PHOTO_WHATSAPP').replace('#HER_HIS#', t(`PRONOUN.${oppGender}.hisher`))}
            </Text>
            {/* Angular: --ion-color-whatsapp-bg = linear-gradient(180deg, #4AC14B 0%,
                #06853A 100%) (theme/variables.scss:63, button-revamp.component.scss:264) —
                a gradient, not the flat WhatsApp-brand green (#25D366) this used before. */}
            <LinearGradient
              colors={['#4AC14B', '#06853A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={s.similarCardWaBtn}
            >
              <WhatsAppIcon width={16} height={16} />
              <Text style={s.similarCardWaBtnText}>{t('GENERAL.WHATSAPP')}</Text>
            </LinearGradient>
          </View>
        </>
      )}
    </Pressable>
  )
}

// ─── Screen ─────────────────────────────────────────────────────────────────────

export default function ViewProfileScreen({ navigation, route }: { navigation: any; route: any }) {
  const { t } = useTranslation()
  const isDesktop = useIsDesktopWeb()
  // Feature 2 (prev/next profile swipe): matriId is now state, not a plain const —
  // navigating to a neighbor profile just swaps this and lets the existing load
  // effect (keyed on it) re-run, instead of a real navigation/screen remount.
  const [matriId, setMatriId] = useState(route?.params?.matriId ?? '')
  const fromPage = route?.params?.fromPage ?? 'matches'
  // Feature 6: self-preview mode — viewing your own profile. Angular:
  // `this.viewedid == this.NBID` (viewprofile.page.ts:414-426) — a plain id
  // comparison against the logged-in user's own id.
  const [ownUserId, setOwnUserId] = useState('')
  const ownProfile = !!ownUserId && ownUserId === matriId
  // Feature 3 — Angular: checkDRCardLanding() gates on the DR route + this
  // exact frm_page value (confirmed: EQueryModuleName.dailyRecommendation ===
  // 'dailyrecommendations'). Disables prev/next entirely and skips similar-
  // profiles/membership-banner, regardless of paid/free status.
  const isDrMode = fromPage === 'dailyrecommendations'
  // Angular's prev/next-swipe cache is keyed off the list the user came from —
  // RN equivalent: the ordered id list is passed as a nav param (see
  // redirectToViewProfile's profileIds param / MatchesScreen's call sites).
  // Angular hides the prev/next arrows entirely for own-profile too
  // (viewprofile.page.html:1497 — `*ngIf="... && !ownProfile"`).
  const profileIds: string[] = route?.params?.profileIds ?? []
  const profileIndex = profileIds.indexOf(matriId)
  const hasPrevProfile = !isDrMode && !ownProfile && profileIndex > 0
  const hasNextProfile = !isDrMode && !ownProfile && profileIndex >= 0 && profileIndex < profileIds.length - 1
  // In-memory one-ahead/one-behind prefetch (not persisted — Angular's
  // localStorage-backed cache is more than this screen needs) so swiping to a
  // neighbor already fetched shows instantly instead of a loading flash.
  const prefetchCache = useRef<Map<string, Record<string, any>>>(new Map())
  // Desktop-only Previous/Next avatar+name preview (see the neighbor-prefetch
  // effect below) — mobile's chevrons only need hasPrevProfile/hasNextProfile.
  const [neighborPreviews, setNeighborPreviews] = useState<Record<string, { name: string; photoUri?: string }>>({})

  const [profile, setProfile] = useState<ViewProfileModel | null>(null)
  const [loading, setLoading] = useState(true)
  // Prev/Next just swaps matriId, re-running the load effect below — without this,
  // every chevron tap set `loading` true again, which tears down the ENTIRE screen
  // (header/nav included, see the `if (loading) return ...` below) for a spinner
  // flash, even though the neighbor's data is usually already prefetched. Only the
  // very first load (arriving fresh from Matches) should show that full-screen state.
  const isFirstLoadRef = useRef(true)
  const [loginGender, setLoginGender] = useState<'M' | 'F'>('F')
  const [ownEntryType, setOwnEntryType] = useState('')
  const [femaleFreeEligible, setFemaleFreeEligible] = useState(false)
  const [indNumbersLeft, setIndNumbersLeft] = useState('0')
  const [whatsappPaywallOpen, setWhatsappPaywallOpen] = useState(false)
  // ── Contact-reveal flow (Angular button.component.ts's two-step confirm →
  // phoneviewed API → Contact Details sheet) — mirrors MatchesScreen.tsx's own
  // fix for the exact same gap: this previously skipped straight to dialing on
  // 'show_contact' with no confirmation step, and silently dropped every other
  // phoneviewed branch (protected number, view limits, ID-verify gate,
  // female-free flow) instead of surfacing anything for them. ──
  const [contactConfirm, setContactConfirm] = useState<'call' | 'whatsapp' | null>(null)
  const [contactDetails, setContactDetails] = useState<{
    name: string; mobile?: string | undefined; whatsappNumber?: string | undefined
    showCounter?: boolean | undefined; viewedCount?: string | undefined; remainingCount?: string | undefined
  } | null>(null)
  // Angular button.component.ts:551-579 — the CONFIRMATION popup's own quota
  // footer line ("You have viewed contact numbers of #VAR# profiles. #VAR1#
  // remaining till #VAR2#"), read purely from the local CONTACT_DETAIL cache.
  const [contactQuota, setContactQuota] = useState({ viewed: '0', left: '', expiry: '' })
  // The other phoneviewed/pre-flight scenarios (communicationService.ts's
  // showContactDetails + showCallOrWhatsApp's verify_id/female_free gates) —
  // all mutually exclusive with each other and with contactDetails, so one slot works.
  type PhoneInfoSheet =
    | { kind: 'phone_protected' }
    | { kind: 'under_validation'; message: string }
    | { kind: 'phone_limit_exceeded'; body: string; cta: string }
    | { kind: 'fup_limit'; header: string; body: string; cta: string; cta1: string }
    | { kind: 'profile_validation'; title: string; content: string; cta: string; image?: string | undefined }
    | { kind: 'phone_number_left' }
    | { kind: 'verify_id'; title: string; content: string; ctaLabel: string }
    | { kind: 'female_free_photo_add' }
    | { kind: 'female_free_photo_pending' }
    | { kind: 'female_free_photo_fail' }
    | { kind: 'female_free_call_verification' }
    | { kind: 'female_free_limit_over' }
  const [phoneInfoSheet, setPhoneInfoSheet] = useState<PhoneInfoSheet | null>(null)
  const [paymentStickyInfo, setPaymentStickyInfo] = useState<{ content: string; ctaLabel: string; deadlineMs: number } | null>(null)
  const [stickyDismissed, setStickyDismissed] = useState(false)
  // Angular: the header transforms once the photo scrolls out of view — plain
  // floating back+language pill over the photo becomes a solid white bar with
  // Name/Call/language/3-dot-menu (confirmed live against the real app, not the
  // dead CSS classes an earlier code-only pass had wrongly ruled out).
  const [scrolled, setScrolled] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [similarProfiles, setSimilarProfiles] = useState<SimilarProfileCard[]>([])
  const [menuPromo, setMenuPromo] = useState<any>(null)
  // Angular: getStarMatch() (viewprofile.page.ts:1880-1913) — called proactively
  // once the profile loads (paid viewers only), not on click. null = not fetched
  // yet OR the API call failed (Angular's starAndraasiflag=false) — either way the
  // teaser row stays hidden, matching Angular exactly.
  const [starMatch, setStarMatch] = useState<StarMatchResult | null>(null)
  // Angular: loginHoroAvail mirrors localStorage.HOROSCOPEAVAILABLE — the LOGGED-IN
  // user's own horoscope-availability flag ('1'/'0'), not the viewed profile's.
  const [loginHoroAvail, setLoginHoroAvail] = useState('0')
  // Angular: the top CTA row is `position: sticky; bottom: 0` (viewprofile.page.scss
  // .sticky-btm) — it rides along pinned to the screen bottom for as long as the
  // detail sections keep scrolling past underneath it, and only stops once the
  // SECOND (plain, non-sticky) CTA copy — right before Similar Profiles — reaches
  // that same on-screen position naturally. RN has no bottom-sticky-until-displaced
  // primitive, so this approximates it: render the top CTA as a floating bottom
  // overlay until scroll reaches the second CTA's own measured position, then hide
  // the overlay so the second (inline, already-visible) CTA takes over seamlessly.
  const [scrollY, setScrollY] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [cta2Y, setCta2Y] = useState<number | null>(null)
  const [similarIndex, setSimilarIndex] = useState(0)
  const similarListRef = useRef<FlatList<SimilarProfileCard>>(null)
  // Angular's albumView()/goToalbum() (viewprofile.page.ts:1318-1372) + the
  // pinch/pan HostListeners (:2359-2490) collapse into one full-screen modal here.
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false)
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0)
  // Angular: viewprofile.page.ts:761-768 — full-resolution photo URLs, fetched
  // once per profile-view page load, swapped in for the thumbnail array only
  // once opened for viewing (see PhotoViewerModal's images prop below); falls
  // back to profile.photos (thumbnails) if this hasn't resolved yet or failed.
  const [enlargedPhotos, setEnlargedPhotos] = useState<string[] | null>(null)
  // Feature 8: one-time "tap to move to next profile" coach-mark.
  const [showCoachMark, setShowCoachMark] = useState(false)
  // Feature 5: report-profile reasons-picker modal.
  const [reportModalOpen, setReportModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (isFirstLoadRef.current) setLoading(true)
      isFirstLoadRef.current = false
      // Angular: common.ts's getContactDetails(), called on every profile-view
      // page load — populates CONTACT_DETAIL BEFORE it's read just below, so
      // the confirm sheet's quota footer (contactQuota) has real numbers
      // instead of whatever was last cached (or nothing, on a fresh session).
      await fetchContactDetails().catch(() => {})
      const [lg, entryType, femaleFreeRaw, contactDetail, horoAvail, userId] = await Promise.all([
        getItem(StorageKeys.User.LOGIN_GENDER),
        getSessionValue('ENTRYTYPE'),
        getSessionValue('FEMALEFREECONACT'),
        getJson<Record<string, any>>('CONTACT_DETAIL'),
        getSessionValue('HOROSCOPEAVAILABLE'),
        getItem(StorageKeys.Auth.USER_ID),
      ])
      if (cancelled) return
      setOwnUserId(userId ?? '')
      const gender = lg === 'M' ? 'M' : 'F'
      setLoginGender(gender)
      setOwnEntryType(entryType ?? '')
      const femaleFree: any = femaleFreeRaw
      setFemaleFreeEligible(String(femaleFree?.FLAG) === '1' && gender === 'F' && String(femaleFree?.Left ?? '0') !== '0')
      setIndNumbersLeft(String(contactDetail?.IndNumbersLeft ?? '0'))
      setContactQuota({
        viewed: String(contactDetail?.phoneNumbersViewed ?? '0'),
        left:   String(contactDetail?.phoneNumbersLeft ?? ''),
        expiry: String(contactDetail?.expiryTextValue ?? ''),
      })
      setLoginHoroAvail(String(horoAvail ?? '0'))

      const cached = prefetchCache.current.get(matriId)
      const raw = cached ?? await getViewProfile(matriId)
      prefetchCache.current.delete(matriId)
      if (cancelled) return
      if (raw) {
        const adapted = viewProfileAdapter.adapt(raw)
        setProfile(adapted)
        setEnlargedPhotos(null)
        // Angular: getStarMatch() (viewprofile.page.ts:1880-1913) — paid viewers
        // only, fired once the profile's loaded so the inline teaser can show the
        // real ratio immediately, not just on "View details" click. Needs the
        // VIEWER's own star/raasi codes (ppSetData.PI_STAR/PI_RAASI), not the
        // viewed profile's — see viewProfileService.ts's getStarMatch comment.
        setStarMatch(null)
        if (entryType === 'P' && adapted.hasStarMatchInputs) {
          getJson<Record<string, any>>(StorageKeys.App.PP_SET_DATA).then(pp => {
            if (cancelled) return
            const ownStar  = pp?.['PI_STAR']
            const ownRaasi = pp?.['PI_RAASI']
            if (!ownStar || !ownRaasi) return
            getStarMatch(matriId, String(ownStar), String(ownRaasi), String(pp?.['PI_MOTHERTONGUE'] ?? ''))
              .then(result => { if (!cancelled) setStarMatch(result) })
              .catch(() => {})
          }).catch(() => {})
        }
        // Angular: viewprofile.page.ts:761 — gated on PHOTOAVAILABLE=='Y', fired
        // once per page load, fire-and-forget (no loading UI, no .catch in
        // Angular either — matched here with a silent .catch for RN hygiene).
        if (adapted.isPhotoAvailable) {
          // Fetching the URLs only tells the app WHERE the full-resolution photos
          // are — it doesn't download the actual image bytes. Without prefetching,
          // that download only starts the moment the viewer opens, which is why
          // tapping the photo felt slow even though this API call had long since
          // finished. Prefetching here warms expo-image's cache in the background
          // while the user is still reading the profile, so by the time they tap
          // the photo, PhotoViewerModal's <Image> resolves from cache instantly.
          getEnlargedPhotos(matriId).then(urls => {
            if (cancelled) return
            setEnlargedPhotos(urls)
            if (urls && urls.length > 0) Image.prefetch(urls).catch(() => {})
          }).catch(() => {})
        }
        // Angular: assignProfileDtl() skips viewedtrack for same-gender/own-profile views.
        if (adapted.gender !== gender && adapted.profileId !== '') {
          markProfileViewed(matriId, isDrMode).catch(() => {})
        }
        // Angular: skipped for same-gender/own-profile (viewprofile.page.ts:530-534),
        // and — Feature 3 — also skipped entirely in DR mode (Angular: "Hide the
        // 'Other profiles like X' section in DR page only"). Both fetched eagerly
        // here rather than Angular's on-first-scroll/onViewDidEnter lazy triggers,
        // a reasonable simplification since neither call is expensive.
        if (adapted.gender !== gender && !isDrMode) {
          getSimilarProfiles(matriId).then(list => { if (!cancelled) setSimilarProfiles(list) }).catch(() => {})
          fetchMenuPromo().then(promo => { if (!cancelled) setMenuPromo(promo) }).catch(() => {})
        }
        // Feature 2 prefetch: warm the immediate prev/next neighbor(s) now so
        // tapping a chevron swaps instantly instead of showing a loading flash.
        // Goes two hops deep (not just ±1) so the Previous/Next buttons' OWN
        // neighbor-preview avatar (which looks one profile further out than
        // whichever profile is current) is already cached by the time the user
        // actually lands there — with only ±1, landing on idx+1 needs idx+2's
        // preview immediately for its "Next" button, which hadn't been fetched
        // yet and popped in a moment later once the request finished, reading
        // as a flicker. Skipped in DR mode, which has no prev/next affordance at all.
        const idx = profileIds.indexOf(matriId)
        const neighborIds = isDrMode ? [] : [
          profileIds[idx - 2], profileIds[idx - 1], profileIds[idx + 1], profileIds[idx + 2],
        ].filter(
          (id): id is string => !!id && !prefetchCache.current.has(id),
        )
        neighborIds.forEach(id => {
          getViewProfile(id).then(res => {
            if (!res) return
            prefetchCache.current.set(id, res)
            // Desktop-only: the Previous/Next buttons show a small avatar+name for
            // the neighbor profile (Figma "Jodii Desktop" node 86:2167) — reuses
            // this same prefetch, just also keeping the adapted name/photo around
            // for display instead of only caching the raw response.
            const preview = viewProfileAdapter.adapt(res)
            setNeighborPreviews(prev => ({ ...prev, [id]: { name: preview.name, photoUri: preview.photos[0] } }))
            // Same photo URI backs both the small neighbor-button avatar AND the
            // next hero card's main picture — without warming it here, tapping
            // the chevron swapped `profile` instantly (data prefetched above) but
            // the <Image> itself had never been fetched, so it went blank and
            // popped in once the network request finished, which read as a flicker.
            if (preview.photos[0]) Image.prefetch(preview.photos[0]).catch(() => {})
          }).catch(() => {})
        })
      }
      setLoading(false)

      // Angular: getContactsData() — payment-failed sticky bar (matches.page.ts:2254-2310).
      if (!cancelled && (await getItem('PAYMENTFAILTYPE')) === '1') {
        const banner  = await getHeroBannerDetails(true, 1)
        const content = banner?.PAYMENTFAILEDCONTENT
        const cta     = banner?.PAYMENTFAILEDCTA
        if (!cancelled && content && cta) {
          const startMs = Date.parse(banner?.OFFSTTIME ?? '')
          const endMs   = Date.parse(banner?.OFFEDTIME ?? '')
          const deadlineMs = !Number.isNaN(startMs) && !Number.isNaN(endMs)
            ? Date.now() + Math.max(0, endMs - startMs)
            : Date.now() + 10 * 60 * 1000
          setPaymentStickyInfo({ content, ctaLabel: cta, deadlineMs })
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [matriId])

  // Feature 8: show the coach-mark once ever, only when there's actually a
  // neighbor profile to tap to (no point advertising the arrows otherwise),
  // and never on a same-gender view (which hides the arrows entirely anyway).
  useEffect(() => {
    if (!profile || profile.gender === loginGender) return
    if (!hasPrevProfile && !hasNextProfile) return
    let cancelled = false
    shouldShowCoachMark().then(should => { if (!cancelled && should) setShowCoachMark(true) })
    return () => { cancelled = true }
  }, [profile, loginGender, hasPrevProfile, hasNextProfile])

  function dismissCoachMark() {
    setShowCoachMark(false)
    markCoachMarkShown().catch(() => {})
  }

  const insets = useSafeAreaInsets()

  // Feature 2 prev/next-profile navigation. Angular does this via a swipe
  // gesture on the photo, but PhotoSwiper already owns a horizontal pan on
  // that exact surface for browsing this profile's OWN photos — competing
  // gestures there is a documented Angular bug class (swiping a photo card
  // accidentally triggering profile navigation), so this uses tap chevrons
  // instead, reusing PhotoSwiper's own dark-circle/white-chevron arrow style.
  function goToPrev() {
    if (!hasPrevProfile) return
    setMatriId(profileIds[profileIndex - 1])
  }
  function goToNext() {
    if (!hasNextProfile) return
    setMatriId(profileIds[profileIndex + 1])
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y
    // Angular: `(this.scrWidth - 64) <= offset` (viewprofile.page.ts:1428-1441) —
    // the header switches to name+call+3-dot once scrolled ~one photo-height
    // (scrWidth, same as PHOTO_HEIGHT here) minus 64px, not a fixed constant.
    const isScrolled = y > PHOTO_HEIGHT - 64
    setScrolled(isScrolled)
    if (!isScrolled) setShowMenu(false)
    setScrollY(y)
  }

  // ── Actions — same communicationBtnOnClick plumbing Matches uses ─────────────

  async function handleLike() {
    if (!profile) return
    setProfile(prev => prev && { ...prev, likedStatus: '1' })
    try {
      const result = await communicationBtnOnClick(fromPage, 'like', { MATRIID: profile.profileId })
      if (result.type === 'error') setProfile(prev => prev && { ...prev, likedStatus: '0' })
    } catch { /* keep optimistic state */ }
  }

  async function handleDontShow() {
    if (!profile) return
    try {
      await communicationBtnOnClick(fromPage, 'skip', { MATRIID: profile.profileId })
      navigation.goBack()
    } catch { /* ignore */ }
  }

  async function handleViewLater() {
    if (!profile) return
    try {
      await communicationBtnOnClick(fromPage, 'viewlater', { MATRIID: profile.profileId })
      navigation.goBack()
    } catch { /* ignore */ }
  }

  // Angular button.component.ts's showContactDetails() always confirms first
  // ("You can view #HISHER# number and call or WhatsApp #HIMHER#...") — this
  // previously skipped straight to communicationBtnOnClick and dialed whatever
  // it returned, with no confirmation step at all (same fix as MatchesScreen.tsx).
  function handleCall() {
    if (!profile) return
    setContactConfirm('call')
  }

  function handleWhatsApp() {
    if (!profile) return
    setContactConfirm('whatsapp')
  }

  function handleContactConfirmClose() {
    setContactConfirm(null)
  }

  // Angular button.component.ts:551-583 — the confirmation popup's TostMsg is
  // built from VIEWPHONECONFIRM (the question) + VIEWPHONEDETAIL (the quota
  // footer) concatenated into ONE body, not two separate texts.
  function getContactConfirmContent(): string {
    if (!profile) return ''
    const question = t('VIEWPROFILE.VIEWPHONECONFIRM')
      .replace('#HISHER#', t(`PRONOUN.${profile.gender}.hisher`))
      .replace('#HIMHER#', t(`PRONOUN.${profile.gender}.himher`))
    const quota = t('VIEWPROFILE.VIEWPHONEDETAIL')
      .replace('#VAR#', contactQuota.viewed)
      .replace('#VAR1#', contactQuota.left)
      .replace('#VAR2#', contactQuota.expiry)
    return `${question}\n\n${quota}`
  }

  async function handleContactConfirmYes() {
    if (!profile || !contactConfirm) return
    const action = contactConfirm
    setContactConfirm(null)
    try {
      const result = await communicationBtnOnClick(fromPage, action, { MATRIID: profile.profileId })
      if (result.type === 'show_contact') {
        // Angular's Contact Details popup shows Name/Mobile/WhatsApp/Call
        // together regardless of which CTA was tapped — not one-or-the-other.
        setContactDetails({
          name:           profile.name,
          mobile:         result.mobile,
          whatsappNumber: result.whatsappNumber,
          showCounter:    result.showCounter,
          viewedCount:    result.viewedCount,
          remainingCount: result.remainingCount,
        })
        if (result.viewedCount !== undefined || result.remainingCount !== undefined) {
          setContactQuota(prev => ({
            ...prev,
            viewed: result.viewedCount ?? prev.viewed,
            left:   result.remainingCount ?? prev.left,
          }))
        }
      } else if (result.type === 'payment_promo') {
        if (action === 'whatsapp') {
          setWhatsappPaywallOpen(true)
        } else {
          navigation.navigate('recharge')
        }
      } else if (result.type === 'phone_protected') {
        setPhoneInfoSheet({ kind: 'phone_protected' })
      } else if (result.type === 'under_validation') {
        setPhoneInfoSheet({ kind: 'under_validation', message: result.message })
      } else if (result.type === 'phone_limit_exceeded') {
        setPhoneInfoSheet({ kind: 'phone_limit_exceeded', body: result.body, cta: result.cta })
      } else if (result.type === 'fup_limit') {
        setPhoneInfoSheet({ kind: 'fup_limit', header: result.header, body: result.body, cta: result.cta, cta1: result.cta1 })
      } else if (result.type === 'profile_validation') {
        setPhoneInfoSheet({ kind: 'profile_validation', title: result.title, content: result.content, cta: result.cta, image: result.image })
      } else if (result.type === 'phone_number_left') {
        setPhoneInfoSheet({ kind: 'phone_number_left' })
      } else if (result.type === 'verify_id') {
        // Angular communication.service.ts's navigateToVerify() — content is
        // server-driven from REGISTRATIONARRAYS.PROFILEVERIFYPAID.Shortlist, and
        // the support-number placeholder `##CSNUM##` only ever appears in CTA.
        const arrays = await getRegistrationArrays()
        const cfg = arrays?.PROFILEVERIFYPAID?.Shortlist ?? {}
        let cta = String(cfg.CTA ?? 'OK')
        if (cta.includes('##CSNUM##')) {
          const callNum = (await getItem('VERIFIEDBYCALLNUM')) ?? ''
          cta = cta.replace(/##CSNUM##/g, callNum).replace('+91', '')
        }
        setPhoneInfoSheet({
          kind:     'verify_id',
          title:    String(cfg.TITLE ?? 'Verify your profile'),
          content:  String(cfg.CONTENT ?? 'Please complete ID verification to view phone numbers.'),
          ctaLabel: cta,
        })
      } else if (result.type === 'female_free') {
        const kindByAction: Record<string, PhoneInfoSheet['kind'] | undefined> = {
          'femaleFree-PhotoAdd':     'female_free_photo_add',
          'femaleFree-PhotoPending': 'female_free_photo_pending',
          'femaleFree-PhotoFail':    'female_free_photo_fail',
          'callVerification':        'female_free_call_verification',
          'femaleFree-LimitOver':    'female_free_limit_over',
        }
        const kind = kindByAction[result.action]
        if (kind) setPhoneInfoSheet({ kind } as PhoneInfoSheet)
      }
      // 'error' — silently drops, same as this screen's other action handlers
      // (handleDontShow/handleViewLater) already do; no toast system here yet.
    } catch (e) {
      if (__DEV__) console.error('[ViewProfile] contact-reveal error:', e)
    }
  }

  function handleContactDetailsClose() {
    setContactDetails(null)
  }

  function handleContactDetailsCall() {
    if (contactDetails?.mobile) Linking.openURL(`tel:${contactDetails.mobile}`)
    setContactDetails(null)
  }

  function handleContactDetailsWhatsApp() {
    if (contactDetails?.whatsappNumber) {
      const num = contactDetails.whatsappNumber.replace(/\D/g, '')
      if (num) Linking.openURL(`https://wa.me/${num}`)
    }
    setContactDetails(null)
  }

  function handlePhoneInfoClose() {
    setPhoneInfoSheet(null)
  }

  // Maps each of the 6 phoneviewed scenarios (besides success) plus the
  // female-free variants onto the generic BottomSheet's flexible data shape —
  // mirrors MatchesScreen.tsx's getPhoneInfoSheetData() exactly.
  function getPhoneInfoSheetData(): {
    image?: string | undefined; title?: string | undefined; content?: string | undefined
    ctaLabel?: string | undefined; linkCtaLabel?: string | undefined; orCtaText?: string | undefined
    secondaryCtaLabel?: string | undefined; showSecondaryCta?: boolean | undefined; sideBySideCtas?: boolean | undefined
  } {
    if (!phoneInfoSheet) return {}
    const gender = profile?.gender ?? 'F'
    switch (phoneInfoSheet.kind) {
      case 'phone_protected':
        return {
          image:   CDN_SVG + 'protected-phoneno.svg',
          title:   t('GENERAL.PROTECT_NUMBER').replace(/<br\s*\/?>/gi, ' '),
          content: `${t('GENERAL.PROTECT_NUMBER_SUB')}\n\n${t('GENERAL.PROTECT_NUMBER_NOTE')}`,
          ctaLabel: t('GENERAL.OK_CTA', 'OK'),
        }
      case 'under_validation':
        return { content: phoneInfoSheet.message }
      case 'phone_limit_exceeded':
        return {
          image:    CDN_SVG + 'reached-limit-phone-number-img.svg',
          content:  phoneInfoSheet.body,
          ctaLabel: phoneInfoSheet.cta,
        }
      case 'fup_limit':
        return {
          image:        CDN_SVG + 'maximum-limit-reached-img.svg',
          title:        phoneInfoSheet.header,
          content:      phoneInfoSheet.body,
          ctaLabel:     phoneInfoSheet.cta,
          orCtaText:    t('GENERAL.OR', 'OR'),
          linkCtaLabel: phoneInfoSheet.cta1,
        }
      case 'profile_validation':
        return {
          image:    phoneInfoSheet.image,
          title:    phoneInfoSheet.title,
          content:  phoneInfoSheet.content,
          ctaLabel: phoneInfoSheet.cta,
        }
      case 'phone_number_left':
        return {
          title:    t('GENERAL.SORRY', 'Sorry'),
          content:  'Full renewal verification isn’t available in this app yet — please try again from a different profile for now.',
          ctaLabel: t('GENERAL.OK_CTA', 'OK'),
        }
      case 'verify_id':
        return {
          title:    phoneInfoSheet.title,
          content:  phoneInfoSheet.content,
          ctaLabel: phoneInfoSheet.ctaLabel,
        }
      case 'female_free_photo_pending':
        return {
          title:    'Your photo is under validation!',
          content:  'This may take up to 2 hours. You can view phone numbers after that',
          ctaLabel: t('GENERAL.OK_CTA', 'OK'),
        }
      case 'female_free_photo_add':
        return {
          title:    `Add your photo to get 5 free contacts or get a paid membership to view ${t(`PRONOUN.${gender}.hisher`)} phone number`,
          ctaLabel: 'Become a paid member',
          secondaryCtaLabel: 'Add photo now',
          showSecondaryCta:  true,
        }
      case 'female_free_photo_fail':
        return {
          title:    `Add your photo to get 5 free contacts or get a paid membership to view ${t(`PRONOUN.${gender}.hisher`)} phone number`,
          ctaLabel: 'Become a paid member',
          secondaryCtaLabel: 'Add photo now',
          showSecondaryCta:  true,
        }
      case 'female_free_call_verification':
        return {
          title:    `Contact us to get 5 more free contacts or get a paid membership to view ${t(`PRONOUN.${gender}.hisher`)} phone number`,
          ctaLabel: 'Become a paid member',
          secondaryCtaLabel: 'Call now',
          showSecondaryCta:  true,
        }
      case 'female_free_limit_over':
        return {
          title:    'You have reached the maximum free phone number views limit!',
          content:  'Become a paid member to view more phone numbers of matches',
          ctaLabel: 'Become paid member',
        }
    }
  }

  function handlePhoneInfoPrimaryPress() {
    const kind = phoneInfoSheet?.kind
    setPhoneInfoSheet(null)
    if (kind === 'female_free_photo_add' || kind === 'female_free_photo_fail'
      || kind === 'female_free_call_verification' || kind === 'female_free_limit_over') {
      navigation.navigate('recharge')
    }
    // fup_limit's primary CTA is "Complete full verification" → Angular
    // navigates to /fup-verify, which isn't built — closing is the honest
    // behavior until that screen exists, rather than pretending to navigate.
  }

  function handlePhoneInfoSecondaryPress() {
    const kind = phoneInfoSheet?.kind
    setPhoneInfoSheet(null)
    if (kind === 'female_free_photo_add' || kind === 'female_free_photo_fail') {
      navigation.navigate('Gallery')
    }
    // "Call now" (female_free_call_verification) would dial app support in
    // Angular — no confirmed support number source exists in this port yet,
    // so this honestly just closes rather than pretending to place a call.
  }

  function handleWhatsappPaywallPayNow() {
    setWhatsappPaywallOpen(false)
    navigation.navigate('recharge')
  }

  function handleStickyPress() {
    navigation.navigate('recharge')
  }

  // Angular: clickOnViewProfile('similarprofiles', MATRIID) — opens that profile's
  // own View Profile page (app-swiper.component.ts:392-437).
  function handleSimilarProfilePress(card: SimilarProfileCard) {
    redirectToViewProfile('', card.matriId, 'similarprofiles')
  }

  function handleMembershipBannerPress() {
    navigation.navigate('recharge')
  }

  // ── Horoscope actions — Angular: viewprofile.page.ts callNative('view_horoscope')/
  // goToEdit('22'). (requestHoro() also exists in Angular but its only UI trigger is
  // commented out of the template — dead code, never reachable — so it has no React
  // equivalent here either; see the section-visibility gate below.) ────────────────

  function handleAddHoroscope() {
    // Angular: goToEdit(pageNo) → router.navigate(['editform-vp/'+pageNo]).
    // Reuses the exact same (currently unregistered, pre-existing) navigation
    // call biodataService.ts's goToEditScreen() already makes for this same
    // page — not a new gap introduced here.
    navigateGlobal(ENavigation.EDIT_FORM, { pageNo: 22, frm_page: 'viewprofile' })
  }

  async function handleViewHoroscope() {
    if (!profile) return
    if (ownEntryType !== 'P') {
      // Angular: paymentPromoPopUp() for free users — mirrors the existing
      // paid-gate pattern already used for the star-match "View details" teaser.
      navigation.navigate('recharge')
      return
    }
    const url = await viewHoroscope(profile.profileId, profile.isIdVerified)
    if (url) Linking.openURL(url)
  }

  // ── Feature 6 self-preview actions — Angular: clickAddMoreDetails('27'|'28')
  // (viewprofile.page.ts:2502-2523), same EDIT_FORM pageNo mapping biodataService.ts's
  // PI_BROTHERS/PI_SISTERS(28) and PI_PROPERTY(21) fields already use ─────────────

  function handleAddFamilyDetails() {
    navigateGlobal(ENavigation.EDIT_FORM, { pageNo: 28, frm_page: 'viewprofile' })
  }

  function handleAddPropertyDetails() {
    navigateGlobal(ENavigation.EDIT_FORM, { pageNo: 21, frm_page: 'viewprofile' })
  }

  // Angular: a plain `<a [href]="getBioDataLink()" download>` — Linking.openURL
  // is the RN analog (triggers the OS download/share sheet for a direct file URL).
  async function handleDownloadBiodata() {
    if (!profile) return
    const url = await getBioDataLink(profile.profileId)
    Linking.openURL(url)
  }

  // Angular: redirectiontoStarMatchReport() — paid-only; passes the already-fetched
  // result via router state to skip a redundant API call on the report screen.
  // starMatch is only non-null once the proactive fetch (profile-load effect)
  // succeeds, which is also the only state that makes this row clickable at all.
  function handleViewStarMatchDetails() {
    if (!profile || !starMatch) return
    navigation.navigate('star-matching', {
      partnerId: profile.profileId,
      partnerName: profile.name,
      partnerPhoto: profile.photos[0],
      ownRaasi: starMatch.ownRaasi,
      ownStar: starMatch.ownStar,
      partnerRaasi: starMatch.partnerRaasi ?? profile.raasi,
      partnerStar: starMatch.partnerStar ?? profile.star,
      displayText: starMatch.displayText,
      percentage: starMatch.percentage,
      isNorth: starMatch.isNorth,
    })
  }

  // Arrow-button navigation for the Similar Profiles carousel — mirrors the exact
  // same "advance by one card, clamp at the ends" behavior Swiper.js's navigation
  // module gives Angular's <app-swiper>.
  function scrollSimilarBy(delta: number) {
    const nextIndex = Math.max(0, Math.min(similarProfiles.length - 1, similarIndex + delta))
    similarListRef.current?.scrollToOffset({ offset: nextIndex * SIMILAR_CARD_STRIDE, animated: true })
    setSimilarIndex(nextIndex)
  }

  function onSimilarScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setSimilarIndex(Math.round(e.nativeEvent.contentOffset.x / SIMILAR_CARD_STRIDE))
  }

  // Feature 5 — Angular: pages/report-profile (routed page there; a modal here).
  // Opens the full reasons-picker form instead of a direct confirm+submit.
  function handleReportProfile() {
    setShowMenu(false)
    setReportModalOpen(true)
  }

  function handleReportSubmitted() {
    setReportModalOpen(false)
    navigation.goBack()
  }

  // ── Loading / not-found ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={s.loaderScreen}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    )
  }
  if (!profile) {
    // TEMP DEBUG — shows the raw API response so we can see exactly why adapting
    // failed (bad matriId param, RESPONSECODE/ERRCODE mismatch, or an unexpected
    // response envelope shape) without needing a dev console. Remove once confirmed.
    return (
      <SafeAreaView style={s.loaderScreen}>
        <Text style={s.notFoundText}>Unable to load this profile.</Text>
        <Pressable style={s.backBtnInline} onPress={() => navigation.goBack()}>
          <Text style={s.backBtnInlineText}>{'‹ Back'}</Text>
        </Pressable>
        <ScrollView style={s.debugBox}>
          <Text style={s.debugLabel}>DEBUG matriId: {JSON.stringify(matriId)}</Text>
          <Text style={s.debugLabel}>DEBUG raw response:</Text>
          <Text style={s.debugText}>{JSON.stringify(_debugLastViewProfileResult(), null, 2)}</Text>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const oppGender = profile.gender
  // Angular: sameGender hides Call/WhatsApp/Like entirely.
  const sameGender = profile.gender === loginGender
  const hasReligiousInfo = !!(profile.caste || profile.raasi || profile.star || (profile.dosham && profile.dosham.length > 0))

  const ctaCtx: AfterLikeCtx = {
    entryType:   ownEntryType,
    likedStatus: profile.likedStatus,
    phoneViewed: profile.phoneViewed,
    femaleFreeEligible,
    indNumbersLeft,
    oppGender,
  }

  const activeSticky = !stickyDismissed && paymentStickyInfo

  // Angular duplicates this exact CTA markup TWICE — once right after the name/ID
  // row (`position: sticky; bottom: 0` — stays pinned to the screen bottom through
  // the whole detail-sections scroll), once again after all detail sections, right
  // before Similar Profiles (plain inline, not sticky — confirmed against real
  // screenshots: more content visibly continues below it in the same shot). The
  // floating-overlay-until-displaced rendering for the FIRST copy lives further
  // down (topCtaVisible); this helper builds the shared JSX both copies use.
  function renderCtaBlock() {
    // TS can't narrow `profile` through this closure — re-guard explicitly (the
    // caller only ever invokes this after the outer `if (!profile) return` above).
    if (!profile || sameGender) return null
    return (
      <View style={s.ctaBlock}>
        {/* Same layout/design as Matches' own MatchCard CTA (MatchesScreen.tsx) —
            Row 1: Don't show + View later (flex:1 each); Row 2: Like, full width. */}
        {showLikeCTA(profile.likedStatus) && (
          <View style={s.ctaSection}>
            <View style={s.ctaSecRow}>
              <Pressable
                style={[s.ctaDontShow, disableDontShow(profile.dontShowStatus) && s.ctaDisabled]}
                onPress={handleDontShow}
                disabled={disableDontShow(profile.dontShowStatus)}
              >
                <CloseIcon width={24} height={24} />
                <Text style={s.ctaDontShowText}>{t('GENERAL.DONTSHOWCTA')}</Text>
              </Pressable>
              <Pressable
                style={[s.ctaViewLater, disableViewLater(profile.viewLaterStatus) && s.ctaDisabled]}
                onPress={handleViewLater}
                disabled={disableViewLater(profile.viewLaterStatus)}
              >
                <ViewLaterIcon width={24} height={24} />
                <Text style={s.ctaViewLaterText}>{t('GENERAL.VIEWLATER')}</Text>
              </Pressable>
            </View>
            <Pressable style={s.ctaLike} onPress={handleLike}>
              <LikeIcon width={24} height={24} />
              <Text style={s.ctaLikeText}>{t('GENERAL.LIKE_CTA').replace('#HER_HIM#', '').trim()}</Text>
            </Pressable>
          </View>
        )}

        {showAfterLikeCTA(profile.likedStatus) && (
          <View style={s.afterLikeRow}>
            <View style={s.afterLikeTopRow}>
              <Text style={s.afterLikeText}>{getAfterLikeContentText(ctaCtx, t)}</Text>
              <View style={s.ctaSendInterestWrap}>
                {showFreeBadge(ctaCtx) && (
                  <View style={s.freeBadge} pointerEvents="none">
                    <Text style={s.freeBadgeText}>{t('GENERAL.FREE')}</Text>
                  </View>
                )}
                <Pressable style={s.ctaSendInterest} onPress={handleCall}>
                  <CdnSvg uri={getAfterLikeCtaIcon(ctaCtx)} width={16} height={16} />
                  <Text style={s.ctaSendInterestText}>{getAfterLikeCtaLabel(ctaCtx, t)}</Text>
                </Pressable>
              </View>
            </View>
            {showContactsLeftBanner(ctaCtx) && (
              <Text style={s.contactsLeftText}>{t('VIEWPROFILE.CONTACT_SEEN_INFO')}</Text>
            )}
          </View>
        )}
      </View>
    )
  }

  // Feature 6 — replaces renderCtaBlock() entirely for own-profile views
  // (Angular: viewprofile.page.html:1262-1281 swaps the whole Like/Contact CTA
  // grid for this single "Download Biodata for FREE" button when profilePreview/
  // ownProfile). Angular duplicates its normal CTA for the sticky-until-displaced
  // effect; that nuance doesn't apply here since this is a plain one-off download
  // action, not a Like/Contact flow — rendered once, inline, not floating.
  function renderBiodataCta() {
    if (!ownProfile) return null
    return (
      <Pressable style={s.biodataCta} onPress={handleDownloadBiodata}>
        <Text style={s.biodataCtaText}>{t('BIO_DATA.BIODATA_DOWNLOAD_FREE')}</Text>
      </Pressable>
    )
  }

  // Floating top-CTA overlay stays visible until the scroll position reaches where
  // the second (plain, inline) CTA copy naturally sits — approximating Angular's
  // sticky-until-displaced behavior. Visible by default (cta2Y===null) until that
  // second block's onLayout has actually reported a position.
  const topCtaVisible = cta2Y === null || scrollY + viewportHeight < cta2Y

  // Desktop/laptop web gets the Figma "Jodii Desktop" two-column layout (see
  // ViewProfileDesktopLayout.tsx); native iOS/Android and narrow mobile-web keep
  // the mobile JSX below completely untouched — same isDesktop early-return
  // split MatchesScreen.tsx already uses for MatchesDesktopLayout.
  if (isDesktop) {
    const prevId = hasPrevProfile ? profileIds[profileIndex - 1] : undefined
    const nextId = hasNextProfile ? profileIds[profileIndex + 1] : undefined
    return (
      <View style={s.screen}>
        <ViewProfileDesktopLayout
          profile={profile}
          oppGender={oppGender}
          sameGender={sameGender}
          ownProfile={ownProfile}
          loginGender={loginGender}
          hasReligiousInfo={hasReligiousInfo}
          ownEntryType={ownEntryType}
          femaleFreeEligible={femaleFreeEligible}
          indNumbersLeft={indNumbersLeft}
          loginHoroAvail={loginHoroAvail}
          starMatch={starMatch}
          similarProfiles={similarProfiles}
          menuPromo={menuPromo}
          hasPrevProfile={hasPrevProfile}
          hasNextProfile={hasNextProfile}
          profileIndex={profileIndex}
          totalProfiles={profileIds.length}
          prevPreview={prevId ? neighborPreviews[prevId] : undefined}
          nextPreview={nextId ? neighborPreviews[nextId] : undefined}
          langCode={i18n.language}
          onBack={() => navigation.goBack()}
          onGoToPrev={goToPrev}
          onGoToNext={goToNext}
          onLanguagePress={() => navigation.navigate('LanguageSelection')}
          onLike={handleLike}
          onDontShow={handleDontShow}
          onViewLater={handleViewLater}
          onCall={handleCall}
          onWhatsApp={handleWhatsApp}
          onOpenPhotoViewer={i => { setPhotoViewerIndex(i); setPhotoViewerOpen(true) }}
          onSimilarProfilePress={handleSimilarProfilePress}
          onMembershipBannerPress={handleMembershipBannerPress}
          onAddHoroscope={handleAddHoroscope}
          onViewHoroscope={handleViewHoroscope}
          onAddFamilyDetails={handleAddFamilyDetails}
          onAddPropertyDetails={handleAddPropertyDetails}
          onDownloadBiodata={handleDownloadBiodata}
          onViewStarMatchDetails={handleViewStarMatchDetails}
          onReportProfile={handleReportProfile}
        />

        <WhatsAppPaywallModal
          visible={whatsappPaywallOpen}
          profile={profile}
          oppGender={oppGender}
          onClose={() => setWhatsappPaywallOpen(false)}
          onPayNow={handleWhatsappPaywallPayNow}
        />

        {/* Angular button.component.ts's two-step contact reveal: confirm → phoneviewed
            API → Contact Details sheet — see handleCall/handleWhatsApp above. */}
        <BottomSheet
          visible={!!contactConfirm}
          type="viewPhoneConfirm"
          data={{
            content: getContactConfirmContent(),
            ctaLabel: t('ACCOUNT.YES', 'Yes'),
          }}
          onClose={handleContactConfirmClose}
          onPrimaryPress={handleContactConfirmYes}
        />
        <ContactDetailsSheet
          visible={!!contactDetails}
          name={contactDetails?.name ?? ''}
          mobile={contactDetails?.mobile}
          whatsappNumber={contactDetails?.whatsappNumber}
          showCounter={contactDetails?.showCounter}
          viewedCount={contactDetails?.viewedCount}
          remainingCount={contactDetails?.remainingCount}
          onClose={handleContactDetailsClose}
          onCall={handleContactDetailsCall}
          onWhatsApp={handleContactDetailsWhatsApp}
        />
        {/* The other 6 phoneviewed scenarios (protected number / under validation /
            limit exceeded / FUP limit / profile validation / phone-number-left) plus
            the female-free variants — see getPhoneInfoSheetData() for the mapping. */}
        <BottomSheet
          visible={!!phoneInfoSheet}
          type="phonePrivacyInfo"
          data={getPhoneInfoSheetData()}
          onClose={handlePhoneInfoClose}
          onPrimaryPress={handlePhoneInfoPrimaryPress}
          onSecondaryPress={handlePhoneInfoSecondaryPress}
          onLinkPress={handlePhoneInfoClose}
        />

        <PhotoViewerModalDesktop
          visible={photoViewerOpen}
          images={enlargedPhotos && enlargedPhotos.length > 0 ? enlargedPhotos : profile.photos}
          initialIndex={photoViewerIndex}
          onClose={() => setPhotoViewerOpen(false)}
        />

        <ReportProfileModal
          visible={reportModalOpen}
          partnerId={profile.profileId}
          partnerName={profile.name}
          onClose={() => setReportModalOpen(false)}
          onSubmitted={handleReportSubmitted}
        />
      </View>
    )
  }

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />

      {/* ── Header — a SEPARATE solid white bar above the photo (not floating over
          it) — confirmed against the real app's screenshots. Rest state: back +
          language pill. Once scrolled past the photo: back + Name + Call + language
          + a 3-dot report/don't-show menu. */}
      <View style={[s.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={s.headerBackBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <CdnSvg uri={BACK_ICON_URI} width={22} height={22} />
        </Pressable>

        {scrolled && (
          <>
            <Text style={s.headerName} numberOfLines={1}>
              {ownProfile ? t('VIEWPROFILE.PROFILE_PREVIEW') : profile.name}
            </Text>
            {!sameGender && (
              <Pressable style={s.headerIconBtn} onPress={handleCall} hitSlop={8}>
                <CallIcon width={20} height={21} />
              </Pressable>
            )}
          </>
        )}
        {!scrolled && <View style={s.headerSpacer} />}

        <Pressable
          style={[s.langPill, scrolled && s.langPillCompact]}
          onPress={() => navigation.navigate('LanguageSelection')}
          hitSlop={8}
        >
          <CdnSvg uri={CDN_SVG + 'revamp/lang-change-img.svg'} width={18} height={18} />
          <Text style={s.langPillText} numberOfLines={1}>
            {LANG_LABELS[i18n.language] ?? 'English'}
          </Text>
        </Pressable>

        {scrolled && !ownProfile && (
          <View>
            <Pressable style={s.headerIconBtn} onPress={() => setShowMenu(v => !v)} hitSlop={8}>
              <Text style={s.menuDots}>⋮</Text>
            </Pressable>
            {showMenu && (
              <View style={s.menuDropdown}>
                <Pressable
                  style={s.menuItem}
                  onPress={() => { setShowMenu(false); handleDontShow() }}
                >
                  <Text style={s.menuItemText}>{t('MATCHES.MORE_OPT_1')}</Text>
                </Pressable>
                <Pressable style={s.menuItem} onPress={handleReportProfile}>
                  <Text style={[s.menuItemText, s.menuItemDanger]}>{t('MATCHES.MORE_OPT_2')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>

      <ScrollView
        style={s.scrollView}
        onLayout={e => setViewportHeight(e.nativeEvent.layout.height)}
        onScroll={onScroll}
        scrollEventThrottle={32}
        /* No extra fixed buffer here — Angular's page just ends flush after its last
           section (breather card's own border-bottom is the visual end-cap); a fixed
           +32 padding left a dead white gap below MembershipBanner. insets.bottom
           alone still covers the safe-area/home-indicator clearance that's needed. */
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom }]}
      >
        {/* ── Photo ──────────────────────────────────────────────────────────── */}
        {/* Angular: prev/next-profile arrows sit in a sibling div AFTER the photo/
            ion-content, positioned `top: calc(100vw + 32px)` — i.e. just below the
            square (100vw-tall) photo, not overlaid on top of it. photoWrap is the
            positioning ancestor that reproduces that (viewprofile.page.html:1495-1512,
            .scss:512,523). */}
        <View style={s.photoWrap}>
          <View style={s.photoBox}>
            {profile.isPhotoAvailable && !profile.isPhotoProtect && profile.photos.length > 0 ? (
              <PhotoSwiper
                images={profile.photos}
                width={SCREEN_WIDTH}
                height={PHOTO_HEIGHT}
                onPress={i => { setPhotoViewerIndex(i); setPhotoViewerOpen(true) }}
              />
            ) : (
              <View>
                <CdnSvg uri={getBlurPhotoUri(oppGender)} width="100%" height={PHOTO_HEIGHT} />
                {!sameGender && (
                  <View style={s.photoOverlay}>
                    <View style={s.overlayCard}>
                      <Text style={s.overlayText}>
                        {t('GENERAL.REQUEST_ADD_PHOTO_WHATSAPP').replace('#HER_HIS#', t(`PRONOUN.${oppGender}.hisher`))}
                      </Text>
                      <WhatsAppUnlockButton label={t('GENERAL.WHATSAPP')} onPress={handleWhatsApp} />
                    </View>
                  </View>
                )}
              </View>
            )}
            {/* Figma (363:10859): top+bottom dark gradient over the photo — improves
                legibility of the badges/dots overlaid on it, absent from the older
                plain-photo version this screen started with. */}
            <LinearGradient
              colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
              locations={[0, 0.2, 0.8, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {profile.isNewlyJoined && !ownProfile && (
              <View style={s.newBadge} pointerEvents="none">
                <CdnSvg uri={NEWLY_JOINED_STAR_URI} width={14} height={14} />
                <Text style={s.newBadgeText}>{t('MATCHES.NEW')}</Text>
              </View>
            )}
            {showCoachMark && (
              <Pressable style={s.coachMarkOverlay} onPress={dismissCoachMark}>
                <View style={s.coachMarkCard}>
                  <Text style={s.coachMarkText}>{t('VIEWPROFILE.GUIDEMOVENEXT')}</Text>
                  <Text style={s.coachMarkDismiss}>{t('GENERAL.OK_PENDING')}</Text>
                </View>
              </Pressable>
            )}
          </View>
          {hasPrevProfile && (
            <Pressable style={[s.profileArrowBtn, s.profileArrowLeft]} onPress={goToPrev} hitSlop={8}>
              <Text style={s.profileArrowText}>{'‹'}</Text>
            </Pressable>
          )}
          {hasNextProfile && (
            <Pressable style={[s.profileArrowBtn, s.profileArrowRight]} onPress={goToNext} hitSlop={8}>
              <Text style={s.profileArrowText}>{'›'}</Text>
            </Pressable>
          )}
        </View>

        {/* ── Info card ──────────────────────────────────────────────────────── */}
        <View style={s.infoCard}>
          <View style={s.badgeRow}>
            {profile.isPaidMember && <ProfileBadge variant="paid" text={t('MENU.PAID_BADGE')} />}
            {profile.isIdVerified && loginGender === 'F' && (
              <ProfileBadge variant="verified" text={t('MATCHES.VERIFIED_ID')} />
            )}
          </View>

          {/* Angular: viewprofile.page.html:460-496 — Call/WhatsApp icon buttons sit
              inline beside the name (confirmed against a real screenshot; the earlier
              Figma-only "Contact details" card below was dead markup in Angular's own
              template — a comment with no content between it and Professional
              details — so it's been removed rather than kept as an extra copy). */}
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{profile.name}</Text>
            {!sameGender && (
              <View style={s.nameIconsRow}>
                <Pressable style={s.nameIconBtn} onPress={handleCall} hitSlop={8}>
                  <CallIcon width={24} height={24} />
                </Pressable>
                <Pressable style={s.nameIconBtn} onPress={handleWhatsApp} hitSlop={8}>
                  <WhatsAppIcon width={24} height={24} />
                </Pressable>
              </View>
            )}
          </View>
          <Text style={s.jodiId}>{t('EDITPROFILE.JODIIID')} : {profile.profileId}</Text>

          {/* !! coerces to a real boolean — the adapter's `?? undefined` doesn't
              catch a raw API value of "" (empty but present, not null/undefined),
              and `'' && <Text/>` evaluates to '' itself: a bare empty-string text
              node landing directly under this View, which is exactly what React
              Native Web's "Unexpected text node ... cannot be a child of a <View>"
              warning is about. */}
          {!!profile.likedMsg && <Text style={s.likedMsg}>{profile.likedMsg}</Text>}

          {/* The top CTA is NOT rendered inline here — Angular's copy of it is
              `position: sticky; bottom: 0`, so it rides pinned to the screen bottom
              through the whole detail-sections scroll instead of sitting inline
              right here. Rendered as a floating overlay below (see topCtaVisible). */}

          {/* ── Basic details ────────────────────────────────────────────────── */}
          <SectionHeader title={t('VIEWPROFILE.BASIC_DETAILS')} />
          <DetailRow icon={ICON.createdFor} label={t('VIEWPROFILE.CREATEDFOR')} value={profile.profileFor} />
          <DetailRow icon={ICON.age} label={t('VIEWPROFILE.AGEIS')} value={profile.age ? `${profile.age} ${t('VIEWPROFILE.YEARS')}` : undefined} />
          <DetailRow icon={ICON.height} label={t('VIEWPROFILE.HEIGHT')} value={profile.height} />
          <DetailRow icon={ICON.maritalStatus} label={t('REG.MARITAL_STATUS')} value={profile.maritalStatus} />
          <DetailRow icon={ICON.children} label={t('VIEWPROFILE.NOOFCHILDREN')} value={profile.noOfChildren} />
          <DetailRow icon={ICON.physicalStatus} label={t('REG.PHYSICAL_STATUS')} value={profile.physicalStatus} />
          <DetailRow icon={ICON.motherTongue} label={t('VIEWPROFILE.MOTHERTONGUE')} value={profile.motherTongue} />
          <DetailRow icon={ICON.location} label={t('VIEWPROFILE.CURRENTLOCATION')} value={profile.location} isLast />

          {/* ── Professional details ─────────────────────────────────────────── */}
          {(profile.education || profile.occupation || profile.income) && (
            <>
              <SectionHeader title={t('VIEWPROFILE.PROFESS_DETAILS')} />
              <DetailRow icon={ICON.education} label={t('VIEWPROFILE.EDUCATION')} value={profile.education} />
              <DetailRow icon={ICON.occupation} label={t('VIEWPROFILE.OCCUPATION')} value={profile.occupation} />
              <DetailRow icon={ICON.salary} label={t('VIEWPROFILE.MONTHLYINCOME')} value={profile.income} isLast />
            </>
          )}

          {/* ── Religious details ────────────────────────────────────────────── */}
          {hasReligiousInfo && (
            <>
              <SectionHeader title={t('VIEWPROFILE.RELIGIOUSDETAIL')} />
              {/* Angular combines Religion/Caste/Subcaste into a SINGLE row under one
                  "Caste" label + caste-icon.svg — not three separate rows. */}
              <DetailRow
                icon={ICON.caste}
                label={t('VIEWPROFILE.CASTE')}
                value={[profile.religion, profile.caste, profile.subCaste].filter(Boolean).join(', ') || undefined}
              />
              <DetailRow icon={ICON.raasi} label={t('VIEWPROFILE.RAASIIS')} value={profile.raasi} />
              <DetailRow icon={ICON.star} label={t('VIEWPROFILE.STARIS')} value={profile.star} />
              <DetailRow icon={ICON.dosham} label={t('VIEWPROFILE.DOSHAMIS')} value={profile.dosham?.join(', ')} isLast />
              {/* Star-match porutham teaser — paid VIEWERS (ownEntryType, not the
                  viewed profile's own paid status) with both raasi+star see the
                  real ratio (proactively fetched above) plus a "View details" link
                  into the full report; free viewers see a static fake-ratio teaser
                  (Angular's own paywall-teaser trick — always "9/10", never a real
                  API call). Angular: viewprofile.page.html:769-815 — the headline is
                  the ratio/percentage text plus STARMATCHING.STAR_MATCHING_TXT, NOT
                  VIEWPROFILE.HOROCOMPATIBILITY (that key is for a different screen —
                  using it here was a mismatch from an earlier pass). For paid
                  viewers, a null starMatch (still loading, or the API call failed —
                  Angular's starAndraasiflag=false) hides the row entirely, same as Angular. */}
              {profile.hasStarMatchInputs && (
                ownEntryType === 'P' ? (
                  starMatch && (
                    <Pressable onPress={handleViewStarMatchDetails}>
                      <Text style={s.starMatchText}>
                        {starMatch.displayText}{t('STARMATCHING.STAR_MATCHING_TXT')}
                      </Text>
                      <Text style={s.starMatchTeaser}>{t('VIEWPROFILE.PAID_MEMBER_REPORT')}</Text>
                    </Pressable>
                  )
                ) : (
                  <Pressable onPress={() => navigation.navigate('recharge')}>
                    <Text style={s.starMatchText}>9/10{t('STARMATCHING.STAR_MATCHING_TXT')}</Text>
                    <Text style={s.starMatchTeaser}>{t('VIEWPROFILE.FREE_MEMBER_REPORT')}</Text>
                  </Pressable>
                )
              )}
            </>
          )}

          {/* ── Horoscope details — Angular orders this right after Religious
              details, before Life style (confirmed against real screenshots).
              Angular's full visibility gate (viewprofile.page.html:821) is
              `SHOWHORO=='1' && ((HOROSCOPEAVAILABLE=='Y' && loginHoroAvail=='1')
              || loginHoroAvail=='0')` — i.e. if you've already added your OWN
              horoscope but this profile hasn't added theirs, the whole section
              is hidden (there's no "request" UI live in Angular to fall back
              to for that combination — confirmed dead/commented-out code). */}
          {profile.showHoroSection && !sameGender &&
           ((profile.horoscopeAvailable && loginHoroAvail === '1') || loginHoroAvail === '0') ? (
            <>
              <SectionHeader title={t('VIEWPROFILE.HORO_DETAILS')} />
              <View style={s.detailRow}>
                <View style={s.detailIconCol}>
                  <CdnSvg uri={ICON.horoscope} width={20} height={20} />
                </View>
                <View style={s.detailTextCol}>
                  <Text style={s.detailLabel}>{t('VIEWPROFILE.HOROSCOPE')}</Text>
                  {loginHoroAvail === '0' ? (
                    <>
                      <Text style={s.detailValue}>
                        {t('VIEWPROFILE.ADDYOURHORO').replace('#HIMHER#', t(`PRONOUN.${oppGender}.himhers`))}
                      </Text>
                      <Pressable onPress={handleAddHoroscope}>
                        <Text style={s.horoActionLink}>{t('GENERAL.ADD_HOROSCOPE')}</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable onPress={handleViewHoroscope}>
                      <Text style={s.horoActionLink}>{t('GENERAL.VIEW_HOROSCOPE')}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </>
          ) : ownProfile && loginHoroAvail !== '1' && (
            // Feature 6 — Angular's own onboarding "add horoscope" prompt for own-
            // profile empty sections (viewprofile.page.html:901-902), simplified:
            // Angular gates this on a separate OnboardScreen (/myprofile route)
            // flag this port has no route for yet, so ownProfile stands in for it.
            <>
              <SectionHeader title={t('VIEWPROFILE.HORO_DETAILS')} />
              <Pressable style={s.addDetailPrompt} onPress={handleAddHoroscope}>
                <CdnSvg uri={ICON.horoscope} width={20} height={20} />
                <Text style={s.addDetailPromptText}>{t('GENERAL.ADD_HOROSCOPE')}</Text>
              </Pressable>
            </>
          )}

          {/* ── Life style ────────────────────────────────────────────────────── */}
          {(profile.drinking || profile.smoking || profile.eatingHabits) && (
            <>
              <SectionHeader title={t('VIEWPROFILE.LIFE_STYLE')} />
              <DetailRow icon={ICON.drinking} label={t('VIEWPROFILE.DRINKINGHABIT')} value={profile.drinking} />
              <DetailRow icon={ICON.smoking} label={t('VIEWPROFILE.SMOKINGHABIT')} value={profile.smoking} />
              <DetailRow icon={ICON.eating} label={t('VIEWPROFILE.EATINGHABIT')} value={profile.eatingHabits} isLast />
            </>
          )}

          {/* ── Family details ────────────────────────────────────────────────── */}
          {(profile.brothers !== undefined || profile.sisters !== undefined) ? (
            <>
              <SectionHeader title={t('VIEWPROFILE.FAMILYDETAIL')} />
              <DetailRow
                icon={ICON.brother}
                label={t('VIEWPROFILE.BROTHERS')}
                value={familyCountText(profile.brothers, t, {
                  none: 'VIEWPROFILE.NOBROTHERS', one: 'VIEWPROFILE.BROTHER',
                  many: 'VIEWPROFILE.BROTHERSS', moreThan: 'VIEWPROFILE.MORETHANBROTHER',
                })}
              />
              <DetailRow
                icon={ICON.sister}
                label={t('VIEWPROFILE.SISTERS')}
                value={familyCountText(profile.sisters, t, {
                  none: 'VIEWPROFILE.NOSISTERS', one: 'VIEWPROFILE.SISTER',
                  many: 'VIEWPROFILE.SISTERSS', moreThan: 'VIEWPROFILE.MORETHANSISTER',
                })}
                isLast
              />
            </>
          ) : ownProfile && (
            <>
              <SectionHeader title={t('VIEWPROFILE.FAMILYDETAIL')} />
              <Pressable style={s.addDetailPrompt} onPress={handleAddFamilyDetails}>
                <CdnSvg uri={ICON.brother} width={20} height={20} />
                <Text style={s.addDetailPromptText}>{t('GENERAL.ADD_FAMILY_DETAILS')}</Text>
              </Pressable>
            </>
          )}

          {/* ── Property details ──────────────────────────────────────────────── */}
          {(profile.property.length > 0 || profile.vehicle.length > 0) ? (
            <>
              <SectionHeader title={t('VIEWPROFILE.PROPERTY_DETAILS')} />
              <DetailRow
                icon={ICON.property}
                label={t('VIEWPROFILE.PROPERTY_DETAILS')}
                value={profile.property.map(p => p.label).join(', ') || undefined}
              />
              <DetailRow
                icon={ICON.vehicle}
                label={t('VIEWPROFILE.OWN_VEHICLE')}
                value={profile.vehicle.map(v => v.label).join(', ') || undefined}
                isLast
              />
            </>
          ) : ownProfile && (
            <>
              <SectionHeader title={t('VIEWPROFILE.PROPERTY_DETAILS')} />
              <Pressable style={s.addDetailPrompt} onPress={handleAddPropertyDetails}>
                <CdnSvg uri={ICON.property} width={20} height={20} />
                <Text style={s.addDetailPromptText}>{t('BIO_DATA.ADD_PROPERTY_DETAILS')}</Text>
              </Pressable>
            </>
          )}

        </View>

        {/* Second CTA — Angular repeats this exact block right after Property
            details, before Similar Profiles (confirmed against real screenshots).
            A direct ScrollView-content sibling (own horizontal padding, not
            infoCard's) so onLayout's `y` lands in the same coordinate space as
            onScroll's contentOffset.y — needed to know when to hide the floating
            top CTA below. */}
        <View style={s.ctaBlockOuter} onLayout={e => setCta2Y(e.nativeEvent.layout.y)}>
          {ownProfile ? renderBiodataCta() : renderCtaBlock()}
        </View>

        {/* ── Other profiles like X — Angular: app-swiper similarprofiles carousel.
            Renders outside infoCard's padding — the card row bleeds to the screen
            edges, only the header text lines up with the rest of the padded content.
            Angular: app-swiper.component.html:1-2 — the whole grid (header+cards) is
            `.similar-profile-bg` (linear-gradient(136deg, #E6F5F0 0%, transparent 100%))
            with `pt-32` above the header — not a plain white background with no gap. */}
        {similarProfiles.length > 0 && (
          <LinearGradient
            colors={['#E6F5F0', 'rgba(230,245,240,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.similarSection}
          >
            <Text style={s.similarHeader}>
              {t('VIEWPROFILE.SIMILARPROFILES').replace('#NAME#', profile.name)}
            </Text>
            <View>
              <FlatList
                ref={similarListRef}
                data={similarProfiles}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={SIMILAR_CARD_STRIDE}
                decelerationRate="fast"
                onScroll={onSimilarScroll}
                scrollEventThrottle={32}
                keyExtractor={item => item.matriId}
                contentContainerStyle={s.similarListContent}
                renderItem={({ item }) => (
                  <SimilarProfileCardItem
                    card={item}
                    oppGender={oppGender}
                    t={t}
                    onPress={() => handleSimilarProfilePress(item)}
                  />
                )}
              />
              {/* Angular: <app-swiper>'s navigation-module arrows — same dark
                  circular button look as the photo swiper's desktop arrows. */}
              {similarIndex > 0 && (
                <Pressable style={[s.similarArrowBtn, s.similarArrowLeft]} onPress={() => scrollSimilarBy(-1)} hitSlop={8}>
                  <Text style={s.similarArrowText}>{'‹'}</Text>
                </Pressable>
              )}
              {similarIndex < similarProfiles.length - 1 && (
                <Pressable style={[s.similarArrowBtn, s.similarArrowRight]} onPress={() => scrollSimilarBy(1)} hitSlop={8}>
                  <Text style={s.similarArrowText}>{'›'}</Text>
                </Pressable>
              )}
            </View>
          </LinearGradient>
        )}

        {/* ── "Become a paid member" promo — Angular: app-breather BANNERSLOT 1001,
            same component/data source Matches already uses (MembershipBanner). */}
        {!sameGender && menuPromo?.MATCHESSLOT && (
          <MembershipBanner data={menuPromo.MATCHESSLOT} onPress={handleMembershipBannerPress} />
        )}
      </ScrollView>

      {/* Floating top CTA — see topCtaVisible comment above for why this exists
          instead of rendering inline. */}
      {topCtaVisible && (
        <View style={[s.floatingCtaBar, { paddingBottom: 12 + insets.bottom }]}>
          {renderCtaBlock()}
        </View>
      )}

      {activeSticky && (
        <StickyBanner
          text={activeSticky.content}
          ctaLabel={activeSticky.ctaLabel}
          onPress={handleStickyPress}
          onClose={() => setStickyDismissed(true)}
          countdownDeadlineMs={activeSticky.deadlineMs}
        />
      )}

      <WhatsAppPaywallModal
        visible={whatsappPaywallOpen}
        profile={profile}
        oppGender={oppGender}
        onClose={() => setWhatsappPaywallOpen(false)}
        onPayNow={handleWhatsappPaywallPayNow}
      />

      <BottomSheet
        visible={!!contactConfirm}
        type="viewPhoneConfirm"
        data={{
          content: getContactConfirmContent(),
          ctaLabel: t('ACCOUNT.YES', 'Yes'),
        }}
        onClose={handleContactConfirmClose}
        onPrimaryPress={handleContactConfirmYes}
      />
      <ContactDetailsSheet
        visible={!!contactDetails}
        name={contactDetails?.name ?? ''}
        mobile={contactDetails?.mobile}
        whatsappNumber={contactDetails?.whatsappNumber}
        showCounter={contactDetails?.showCounter}
        viewedCount={contactDetails?.viewedCount}
        remainingCount={contactDetails?.remainingCount}
        onClose={handleContactDetailsClose}
        onCall={handleContactDetailsCall}
        onWhatsApp={handleContactDetailsWhatsApp}
      />
      <BottomSheet
        visible={!!phoneInfoSheet}
        type="phonePrivacyInfo"
        data={getPhoneInfoSheetData()}
        onClose={handlePhoneInfoClose}
        onPrimaryPress={handlePhoneInfoPrimaryPress}
        onSecondaryPress={handlePhoneInfoSecondaryPress}
        onLinkPress={handlePhoneInfoClose}
      />

      <PhotoViewerModal
        visible={photoViewerOpen}
        images={enlargedPhotos && enlargedPhotos.length > 0 ? enlargedPhotos : profile.photos}
        initialIndex={photoViewerIndex}
        onClose={() => setPhotoViewerOpen(false)}
        renderFooter={ownProfile ? renderBiodataCta : renderCtaBlock}
      />

      <ReportProfileModal
        visible={reportModalOpen}
        partnerId={profile.profileId}
        partnerName={profile.name}
        onClose={() => setReportModalOpen(false)}
        onSubmitted={handleReportSubmitted}
      />
    </View>
  )
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: Colors.background },
  loaderScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: Colors.background },
  notFoundText: { fontFamily: 'Poppins-Medium', fontWeight: '500', fontSize: 14, color: Colors.textSecondary },
  backBtnInline:     { paddingHorizontal: 16, paddingVertical: 8 },
  backBtnInlineText: { fontFamily: 'Poppins-Medium', fontWeight: '500', fontSize: 14, color: Colors.link },
  debugBox:   { maxHeight: 300, width: '100%', paddingHorizontal: 16 },
  debugLabel: { fontFamily: 'Poppins-SemiBold', fontWeight: '600', fontSize: 12, color: Colors.primary, marginTop: 8 },
  debugText:  { fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 11, color: Colors.textSecondary },

  scrollView:    { flex: 1 },
  scrollContent: {},

  // photoWrap is the positioning ancestor for the prev/next-profile arrows (see
  // the JSX comment above) — sized only by photoBox (its one in-flow child);
  // the arrows are absolutely positioned past that height on purpose, exactly
  // like Angular's own `top: calc(100vw + 32px)` overlapping into the content below.
  photoWrap: { position: 'relative' },
  // Flat, full-bleed square — Angular has no border-radius on this photo (unlike
  // the rounded Matches-card photo), confirmed against viewprofile.page.scss.
  photoBox: { width: SCREEN_WIDTH, height: PHOTO_HEIGHT, backgroundColor: Colors.divider },
  newBadge: {
    position: 'absolute', top: 0, left: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryDark, height: 24,
    paddingLeft: 8, paddingRight: 12, borderBottomRightRadius: 10, gap: 4,
  },
  newBadgeText: { fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 12, color: Colors.white },
  // Feature 2 prev/next-profile chevrons — same dark-circle/white-chevron style
  // as PhotoSwiper's own desktop arrow fallback (matchesCard.shared.tsx). Angular:
  // viewprofile.page.scss:512,523 `top: calc(100vw + 32px)` — just below the square
  // (100vw-tall) photo, not overlaid on it (confirmed: these are the prev/next-
  // PROFILE arrows, a separate sibling element from the photo swiper's own arrows).
  profileArrowBtn: {
    position: 'absolute', top: PHOTO_HEIGHT + 32,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  profileArrowLeft:  { left: 8 },
  profileArrowRight: { right: 8 },
  profileArrowText: { color: Colors.white, fontSize: 20, lineHeight: 20 },
  // Feature 8 coach-mark — a dismiss-anywhere dark scrim over the photo, one
  // time ever, pointing at the tap-chevron affordance just below the photo.
  coachMarkOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 3,
  },
  coachMarkCard: {
    backgroundColor: Colors.white, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    alignItems: 'center', gap: 12, maxWidth: '80%',
  },
  coachMarkText: {
    fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 14, color: Colors.black, textAlign: 'center',
  },
  coachMarkDismiss: {
    fontFamily: 'Poppins-SemiBold', fontWeight: '600', fontSize: 14, color: Colors.primaryDark,
  },
  photoOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center',
  },
  overlayCard: {
    backgroundColor: Colors.scrimStrong, marginHorizontal: 24, padding: 16,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.overlayBorder,
    alignItems: 'center', gap: 16,
  },
  overlayText: {
    fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 12, color: Colors.white,
    textAlign: 'center', lineHeight: 17,
  },

  // Angular: .details-section { background:#fff } — plain white, flush against the
  // photo, no radius/negative-margin "floating card" effect and no elevation/shadow.
  infoCard: {
    backgroundColor:   Colors.surface,
    paddingHorizontal: 24,
    paddingTop:        16,
    paddingBottom:     8,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },

  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Angular: heading1-semibold-22 black-color
  name:    { flex: 1, fontFamily: 'Poppins-SemiBold', fontWeight: '600', fontSize: 22, color: Colors.black },
  // Angular: body2-regular-14 black-color
  jodiId:  { fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 14, color: Colors.black, marginTop: 4 },
  likedMsg: { fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 12, color: Colors.likedStripText, marginTop: 6 },

  // Angular: viewprofile.page.html:469-489 — Call/WhatsApp icon buttons beside the name.
  nameIconsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  nameIconBtn: { alignItems: 'center', justifyContent: 'center' },

  // Angular: .button-banner — regular inline content (NOT position:fixed/sticky —
  // confirmed against real screenshots showing more content, incl. a second copy of
  // this exact block, both above and below it in the normal scroll flow).
  ctaBlock: { marginTop: 16 },
  // Second CTA's own wrapper — matches infoCard's horizontal padding since it now
  // sits outside infoCard (see the onLayout comment at its call site).
  ctaBlockOuter: { paddingHorizontal: 24 },
  // Floating top-CTA overlay — Angular: .sticky-btm { position:sticky; bottom:0;
  // background:#fff }, .button-banner's shadow. Pinned to the screen bottom, shown/
  // hidden via topCtaVisible rather than true CSS position:sticky (no RN equivalent
  // for "sticky within a scroll region until the next in-flow sticky candidate
  // arrives").
  floatingCtaBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.surface, paddingHorizontal: 24, paddingTop: 12,
    shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },

  // Same design as Matches' own MatchCard CTA (MatchesScreen.tsx ctaSection/
  // ctaSecRow/ctaDontShow/ctaViewLater/ctaLike) — Row 1: Don't show + View later,
  // each flex:1, 44px/8px-radius/1px-#545454-border/white bg. Row 2: Like, full
  // width, primaryDark bg, Poppins-SemiBold white text, 24×24 icons throughout.
  ctaSection: { gap: 12 },
  ctaSecRow: { flexDirection: 'row', gap: 12 },
  ctaDontShow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: '#545454', borderRadius: 8,
  },
  ctaDontShowText: { fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 14, color: '#545454' },
  ctaViewLater: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: '#545454', borderRadius: 8,
  },
  ctaViewLaterText: { fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 14, color: '#545454' },
  ctaDisabled: { opacity: 0.4 },
  ctaLike: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryDark, borderRadius: 8, gap: 6,
  },
  ctaLikeText: { fontFamily: 'Poppins-SemiBold', fontWeight: '600', fontSize: 14, color: Colors.white },

  // Feature 6 — same pill styling as ctaLike, standing in for the normal
  // Like/Contact CTA when viewing your own profile.
  biodataCta: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryDark, borderRadius: 8, marginTop: 16,
  },
  biodataCtaText: { fontFamily: 'Poppins-SemiBold', fontWeight: '600', fontSize: 14, color: Colors.white },

  afterLikeRow: {
    backgroundColor: Colors.afterLikeBg, borderRadius: 8, borderWidth: 1,
    borderColor: Colors.afterLikeBorder, paddingHorizontal: 14, paddingVertical: 10,
  },
  afterLikeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  afterLikeText:   { flex: 1, fontFamily: 'Poppins-Medium', fontWeight: '500', fontSize: 13, color: Colors.black },
  ctaSendInterestWrap: { position: 'relative', flexShrink: 0 },
  ctaSendInterest: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, backgroundColor: Colors.primaryDark, borderRadius: 8, paddingHorizontal: 16,
  },
  ctaSendInterestText: { fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 14, color: Colors.white },
  freeBadge: {
    position: 'absolute', top: -10, right: 8, zIndex: 1,
    backgroundColor: Colors.badgeNewBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  freeBadgeText: { fontFamily: 'Poppins-SemiBold', fontWeight: '600', fontSize: 10, color: Colors.badgeNewText },
  contactsLeftText: {
    fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 11, color: Colors.textSecondary, textAlign: 'center', marginTop: 8,
  },

  // Angular: heading1-semibold-20 black-color, line-height:16, mt-24 mb-4
  sectionHeader: {
    fontFamily: 'Poppins-SemiBold', fontWeight: '600', fontSize: 20, color: Colors.black,
    marginTop: 24, marginBottom: 4,
  },
  // Angular: icon column (ion-col size="1") + text column (size="11", pl-12) —
  // label directly above value (not side-by-side), pt-20/pb-20 vertical padding,
  // border-bottom rgba(204,204,204,0.5) on every row except a section's last.
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 20 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(204,204,204,0.5)' },
  detailIconCol: { width: 20, flexShrink: 0 },
  detailTextCol: { flex: 1, paddingLeft: 12 },
  detailLabel: { fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 14, color: Colors.black },
  detailValue: { fontFamily: 'Poppins-Medium', fontWeight: '500', fontSize: 14, color: Colors.black, marginTop: 8 },

  starMatchText:   { fontFamily: 'Poppins-Medium', fontWeight: '500', fontSize: 13, color: Colors.textDark, marginTop: 8 },
  starMatchTeaser: { fontFamily: 'Poppins-Medium', fontWeight: '500', fontSize: 13, color: Colors.link, marginTop: 8 },

  horoActionLink:    { fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 14, color: Colors.link, marginTop: 8 },
  // Feature 6 — own-profile "add missing section" prompts, replacing a section
  // that would otherwise render nothing when its data is empty.
  addDetailPrompt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  addDetailPromptText: { fontFamily: 'Poppins-Medium', fontWeight: '500', fontSize: 14, color: Colors.link },

  // Angular: app-swiper.component.html:2 — `ion-row class="pt-32 ... pb-24"` — header
  // text aligned with the rest of the padded content, but the card row itself bleeds
  // to the screen edges.
  similarSection: { paddingTop: 32, paddingBottom: 24 },
  similarHeader: {
    fontFamily: 'Poppins-SemiBold', fontWeight: '600', fontSize: 20, color: Colors.black,
    marginBottom: 12, paddingHorizontal: 24,
  },
  similarListContent: { paddingHorizontal: 24, gap: SIMILAR_CARD_GAP },
  // Angular: profile-card.component.scss's `.card-ht2` (vmin-based, equal
  // width/height) — a SQUARE card, not the 140x180 rectangle this used to be.
  similarCard: {
    width: SIMILAR_CARD_WIDTH, height: SIMILAR_CARD_WIDTH, borderRadius: 12, overflow: 'hidden',
    backgroundColor: Colors.divider,
  },
  similarCardImg: { width: '100%', height: '100%' },
  similarCardOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.scrimStrong, padding: 10, gap: 8,
  },
  similarCardOverlayText: {
    fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 11, color: Colors.white, textAlign: 'center', lineHeight: 15,
  },
  similarCardWaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
  },
  similarCardWaBtnText: { fontFamily: 'Poppins-Medium', fontWeight: '500', fontSize: 12, color: Colors.white },
  similarCardCaption: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 8,
  },
  similarCardName: { fontFamily: 'Poppins-SemiBold', fontWeight: '600', fontSize: 13, color: Colors.white },
  similarCardMeta: { fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 11, color: Colors.white, marginTop: 2 },
  similarArrowBtn: {
    position: 'absolute', top: '50%', marginTop: -16,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  similarArrowLeft:  { left: 8 },
  similarArrowRight: { right: 8 },
  similarArrowText: { color: Colors.white, fontSize: 20, lineHeight: 20 },

  // Header — a SEPARATE solid white bar in normal flow above the photo (never
  // overlaying it) — confirmed against the real app's screenshots. Content swaps
  // (back+language only, vs. back+Name+Call+language+3-dot) once scrolled.
  headerBar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  headerBackBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { flex: 1 },
  // Angular: `.vp-profile-name` (global.scss:22188-22192) — font16 (~16px),
  // Poppins-Medium, `--gray-color1` (#1f1e1b) — not SemiBold/pure-black.
  headerName: { flex: 1, fontFamily: 'Poppins-Medium', fontWeight: '500', fontSize: 16, color: '#1f1e1b' },
  headerIconBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  menuDots: { fontSize: 20, lineHeight: 20, color: '#333333', fontWeight: '700' },

  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#000000', borderRadius: 8,
    paddingLeft: 8, paddingRight: 12, paddingVertical: 4,
    backgroundColor: Colors.white, maxWidth: 120,
  },
  langPillCompact: { maxWidth: 84, paddingRight: 8 },
  langPillText: { fontFamily: 'Poppins-Medium', fontWeight: '500', fontSize: 12, color: '#000000' },

  menuDropdown: {
    position: 'absolute', top: 34, right: 0, minWidth: 200,
    backgroundColor: Colors.white, borderRadius: 8, paddingVertical: 4,
    shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6, zIndex: 10,
  },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  menuItemText: { fontFamily: 'Poppins-Regular', fontWeight: '400', fontSize: 14, color: Colors.textDark },
  menuItemDanger: { color: Colors.primary },
})
