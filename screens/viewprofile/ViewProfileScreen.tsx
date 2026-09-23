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
  ActivityIndicator, Dimensions, FlatList, Linking, Platform, Alert,
  Pressable, ScrollView, StyleSheet, Text, View, Image as RNImage,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import * as WebBrowser from 'expo-web-browser'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing, runOnJS, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg, { CdnImage } from '../../components/cdn-svg/CdnSvg'
import { LANG_LABELS } from '../../components/matches-header/MatchesHeader'
import {
  WhatsAppIcon, WhatsAppUnlockButton, CallIcon, MessageIcon, CloseIcon, ViewLaterIcon, LikeIcon,
  showLikeCTA, showAfterLikeCTA, disableDontShow, disableViewLater, HtmlText,
  getBlurPhotoUri, getAvatarFallbackUri, NEWLY_JOINED_STAR_URI, ProfileBadge, PhotoSwiper,
  getAfterLikeCtaLabel, getAfterLikeCtaIcon, getAfterLikeContentText, showAfterLikeContentLine,
  showAfterLikeMessageCta, getMessageBtnText,
  showContactsLeftBanner, showFreeBadge,
  type AfterLikeCtx,
} from '../../components/matches/matchesCard.shared'
import StickyBanner from '../../components/sticky-banner/StickyBanner'
import MembershipBanner from '../../components/matches/MembershipBanner'
import PhotoViewerModal from '../../components/matches/PhotoViewerModal'
import PhotoViewerModalDesktop from '../../components/matches/PhotoViewerModalDesktop'
import HoroscopeSvgViewerModal from '../../components/matches/HoroscopeSvgViewerModal'
import ReportProfileModal from '../../components/matches/ReportProfileModal'
import LanguagePillSheet from '../../components/language-pill/LanguagePillSheet'
import ContactDetailsSheet from '../../components/matches/ContactDetailsSheet'
import Toast, { type ToastRequest } from '../../components/toast/Toast'
import AppRatingModal from '../../components/app-rating/AppRatingModal'
import { useAppRating } from '../../hooks/useAppRating'
import Popover, { type PopoverAnchor } from '../../components/popover/Popover'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import ViewProfileDesktopLayout from './ViewProfileDesktopLayout'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { useAddPhotoPicker } from '../../hooks/useAddPhotoPicker'
import WebPhotoInput from '../../components/add-photo/WebPhotoInput'
import AddPhotoVerdictSheets from '../../components/add-photo/AddPhotoVerdictSheets'
import {
  getViewProfile, markProfileViewed, getSimilarProfiles, viewHoroscope, getStarMatch,
  getBioDataLink, getEnlargedPhotos, getBiodataExtras, saveBiodataThemeId,
  _consumeInvalidMatriIdMessage,
  type SimilarProfileCard, type StarMatchResult, type BiodataTheme,
} from '../../service/viewProfileService'
import { viewProfileAdapter } from '../../adapters/viewProfile.adapter'
import { communicationBtnOnClick, fetchContactDetails, shouldSkipPhoneConfirm, shouldShowPhoneNoLimit, getContactConfirmContent as getSharedContactConfirmContent } from '../../service/communicationService'
import {
  getHeroBannerDetails, fetchUpgradePaymentPromo, redirectToIntermediatePage,
  type UpgradePaymentPromo,
} from '../../service/paymentService'
import { handleBack } from '../../utils/navigationRef'
import { fetchMenuPromo } from '../../service/homeService'
import { getItem, getJson } from '../../service/storageService'
import { getSessionValue, getRegistrationArrays } from '../../service/registrationService'
import { ENavigation } from '../../types/enums/navigation.enum'
import { emitVpNeedMoreProfiles, subscribeVpProfileListUpdated } from '../../service/eventBus'
import { shouldShowCoachMark, markCoachMarkShown } from '../../service/coachMarkService'
import { StorageKeys } from '../../constants/storage.keys'
import { Colors } from '../../constants/colors'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { FontSize } from '../../src/theme/fonts'
import { CDN_SVG, CDN_REACT } from '../../constants/cdn'
import i18n from '../../i18n'
import type { ViewProfileModel } from '../../types/interfaces/viewProfile.interface'

// Angular's real back button is Ionic's bundled `icon="arrow-back"` (MD variant —
// a straight-shaft leftward arrow, ships in the app's own JS bundle, not a network
// fetch), 24px, color #333. CDN_REACT + '/arrowleft.svg' 404s on the live CDN
// (confirmed directly — same dead path AppHeader.tsx already found and worked
// around); arrow-back-activity.svg is the app's other, WORKING straight-shaft
// back-arrow asset (already used by ChatScreen.tsx/ReportProfileModal.tsx/
// AttachmentPreviewModal.tsx), and visually the closer match to Angular's glyph
// shape (a shaft + head, not a bare chevron) — used here instead.
const BACK_ICON_URI = CDN_SVG + 'arrow-back-activity.svg'

// Angular: button-revamp.component.html:15-17 — the "View details"/link-style
// button's forward arrow isn't a CSS animation, it's a pre-baked animated GIF
// served straight off the CDN (no local keyframes to reproduce).
const LINK_ARROW_GIF_URI = CDN_SVG + 'revamp/animation/right-arrow-animation.gif'

// Angular: viewprofile.page.html:77-79 — the scrolled header's 3-dot button
// (dot3-revamp.svg), and button.component.html:86's report-profile-img.svg
// shown beside the single "Report this Profile" row it opens.
// Exported so ViewProfileDesktopLayout's own 3-dot menu renders the identical
// icons rather than keeping a second copy of these CDN paths.
export const MENU_DOTS_URI           = CDN_SVG + 'dot3-revamp.svg'
export const REPORT_PROFILE_ICON_URI = CDN_SVG + 'viewprofile/report-profile-img.svg'

// Feature 2 prev/next-PROFILE nav arrows (below the photo, distinct from the
// photo-swiper's own dots/gesture). Angular: viewprofile.page.html:1546-1563,
// <img src="{{nbcommon.ImgDomain() + 'assets/images/svg/vp-revamp-left-arw.svg'}}">
// / vp-revamp-right-arw.svg — same CDN_SVG base this app already uses for every
// other viewprofile icon below. Live CDN asset (checked directly, newer than the
// old Angular source file on disk) is a 60x76 canvas: a solid #333 rounded-pill
// badge (~43px circle) with a soft drop-shadow and a thin white chevron stroke —
// matches the current app screenshot's look. Rendered at 34x43 (same aspect) below.
const PROFILE_NAV_LEFT_ARROW_URI  = CDN_SVG + 'vp-revamp-left-arw.svg'
const PROFILE_NAV_RIGHT_ARROW_URI = CDN_SVG + 'vp-revamp-right-arw.svg'
const PROFILE_NAV_ARROW_WIDTH  = 54
const PROFILE_NAV_ARROW_HEIGHT = 69

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
  // Angular uses a DIFFERENT icon per location row — location-icon.svg for the NRI
  // row, hometown-vp.svg for the plain city/state row, hometown-icon.svg for the
  // separate Hindi/etc-only "Hometown" row (viewprofile.page.html:610/622/642).
  locationNRI:    CDN_SVG + 'viewprofile/location-icon.svg',
  location:       CDN_SVG + 'viewprofile/hometown-vp.svg',
  hometown:       CDN_SVG + 'viewprofile/hometown-icon.svg',
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

// Angular: viewprofile.page.ts:214 — mother-tongue codes for which the separate
// "Hometown" row shows (Hindi and a few others; unrelated to NRI status).
export const HOME_PLACE_DOMAIN = ['2', '14', '17', '41', '4', '51']

// Angular: viewprofile.page.html's photo swiper is sized to scrWidth (viewport
// width) with NO explicit height override — i.e. a flat, full-bleed SQUARE photo,
// not the rounded/cropped rectangle Matches cards use.
const SCREEN_WIDTH = Dimensions.get('window').width
const PHOTO_HEIGHT = SCREEN_WIDTH
const SCREEN_HEIGHT = Dimensions.get('window').height
// s.headerBar's own non-safe-area height: paddingTop's fixed +8, tallest content
// (headerBackBtn, 42px), paddingBottom 10 — mirrors that math so the fixed-position
// prev/next-profile arrows below line up flush with the photo's bottom edge.
const HEADER_FIXED_HEIGHT = 8 + 42 + 10

// Floating top-CTA's own rendered height (Don't-show/View-later row 44 + 12 gap
// + Like row 44, plus floatingCtaBar's own paddingTop:12) — used so the
// visibility hand-off (floatingCtaAnimStyle) requires the real CTA to have
// cleared the floating bar's own footprint, not just touched the bottom edge
// (which would hide the floating bar while the real one is still covered by
// it/below the fold — a gap with no CTA visible at all).
const FLOATING_CTA_HEIGHT = 12 + 44 + 12 + 44

// Feature 6 biodata theming — Angular: download-biodata.component.html:74-75's
// negative-margin-top-*-biodata classes. Each template's photo/details card
// overlaps UP into the themed top image by a different amount — themes 1&2
// pull up 8vh, 3 pulls up 13vh, 4 pulls up 18vh, 5 pulls up only 2vh.
const BIODATA_THEME_OVERLAP_VH: Record<string, number> = { '1': 8, '2': 8, '3': 13, '4': 18, '5': 2 }
function biodataThemeOverlapMargin(themeValue: string): number {
  const vh = BIODATA_THEME_OVERLAP_VH[themeValue] ?? 0
  return -Math.round(SCREEN_HEIGHT * (vh / 100))
}

// Angular: "Other profiles like X" is <app-swiper> — Swiper.js with its navigation
// module (arrow buttons) + per-card snapping, not a freely-scrolling list. One
// swipe/arrow-tap advances exactly one card width, revealing the next card peeking
// at the edge (not a single full-bleed slide like the photo swiper). Confirmed
// against src/app/core/config/home.config.ts's `similarprofiles` swiper config:
// `{ slidesPerView: 1.628, spaceBetween: 16, freeMode: true }` — a FRACTIONAL
// slidesPerView, not a fixed card width, is what makes ~1 card fill the screen
// plus a partial peek of the next (a fixed 140px card let 3 fit on wider screens,
// which is the bug this replaced — confirmed against a real screenshot).
// Angular: CONFIG.similarprofiles (home.config.ts:49-53) — a Swiper with
// `slidesPerView: 1.628, spaceBetween: 16`.
//
// slidesPerView is NOT "screen width over 1.628". Swiper sizes a slide as
//
//   (container - spaceBetween * (slidesPerView - 1)) / slidesPerView
//
// and its container here is the list inset by its own left padding, not the
// whole screen. Dividing the raw width dropped both terms and made every card
// ~19px too wide on a 324px viewport (199 against the 180 Angular draws), which
// is what "the card is too long" looks like.
const SIMILAR_CARD_GAP        = 16
const SIMILAR_SLIDES_PER_VIEW = 1.628
// similarListContent.paddingHorizontal — the slide row starts after it.
const SIMILAR_LIST_PADDING    = 24
const SIMILAR_CARD_WIDTH = Math.round(
  ((SCREEN_WIDTH - SIMILAR_LIST_PADDING) - SIMILAR_CARD_GAP * (SIMILAR_SLIDES_PER_VIEW - 1))
  / SIMILAR_SLIDES_PER_VIEW,
)
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
  const langFonts = useLanguageFonts()
  return <Text style={[s.sectionHeader, { fontFamily: langFonts.semiBold }]}>{title}</Text>
}

// Angular: each row is icon + (label directly ABOVE value, not side-by-side), with
// a border-bottom on every row except the last one in its section
// (viewprofile.page.html — border-bottom-global omitted on each section's final row).
function DetailRow({
  icon, label, value, isLast,
}: { icon: string; label: string; value?: string | undefined; isLast?: boolean }) {
  const langFonts = useLanguageFonts()
  if (!value) return null
  return (
    <View style={[s.detailRow, !isLast && s.detailRowBorder]}>
      <View style={s.detailIconCol}>
        <CdnSvg uri={icon} width={20} height={20} />
      </View>
      <View style={s.detailTextCol}>
        <Text style={[s.detailLabel, { fontFamily: langFonts.regular }]}>{label}</Text>
        {/* Angular binds several of these via [innerHTML] (e.g. HEIGHTCATEGORY carries
            a literal <span class="height-revamp-text-small">...</span>) — a plain Text
            would show the raw tag text; HtmlText strips/renders it properly. */}
        <HtmlText html={value} style={[s.detailValue, { fontFamily: langFonts.medium }]} />
      </View>
    </View>
  )
}

// Angular: app-swiper's similar-profiles card — when the profile has no photo, an
// `app-photo-request` overlay shows GENERAL.REQUEST_ADD_PHOTO_WHATSAPP ("Contact and
// Get #HER_HIS# Photos on WhatsApp") 
// + a WhatsApp CTA on top of the blurred placeholder
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
  const langFonts = useLanguageFonts()

  // Angular: FUNC.getPartnerImg() can never return nothing — PHOTO[0].IMAGE
  // falls back to THUMBIMG and then to getAvatarImg(getOppGenderType()) — and
  // on top of that every profile <img> carries common-funtions.ts's global
  // onImgErrorHandler(), which swaps a FAILED load for that same avatar.
  // This card had neither: a URL the CDN rejects (dead link, S3 AccessDenied,
  // 404) left an empty box, so the card rendered as a flat grey rectangle with
  // only its name/age caption on it. Same failed-load -> CdnSvg avatar pattern
  // PhotoSwiper already uses (expo-image cannot decode a remote .svg, so the
  // silhouette needs CdnSvg rather than an Image source swap).
  const [photoFailed, setPhotoFailed] = useState(false)
  useEffect(() => { setPhotoFailed(false) }, [card.photoUri])

  return (
    <Pressable style={[s.similarCard, size ? { width: size, height: size } : null]} onPress={onPress}>
      <View style={s.similarCardClip}>
        {card.isPhotoAvailable && card.photoUri ? (
          <>
            {photoFailed ? (
              <CdnSvg uri={getAvatarFallbackUri(oppGender)} width="100%" height="100%" cover />
            ) : (
              <Image
                source={{ uri: card.photoUri }}
                style={s.similarCardImg}
                contentFit="cover"
                onError={() => setPhotoFailed(true)}
              />
            )}
            {/* Angular: app-profile-card caption — name, age, education over a bottom
                gradient scrim, shown only for cards that actually have a photo
                (confirmed against screenshot — no-photo/WhatsApp-request cards carry
                no caption at all). */}
            {!!card.name && (
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
                style={s.similarCardCaption}
                pointerEvents="none"
              >
                <Text style={[s.similarCardName, { fontFamily: langFonts.semiBold }]} numberOfLines={1}>{card.name}</Text>
                {(card.age || card.education) && (
                  <Text style={[s.similarCardMeta, { fontFamily: langFonts.regular }]} numberOfLines={2}>
                    {[card.age, card.education].filter(Boolean).join(', ')}
                  </Text>
                )}
              </LinearGradient>
            )}
          </>
        ) : (
          <>
            <CdnImage uri={getBlurPhotoUri(oppGender)} width="100%" height="100%" resizeMode="cover" />
            {/* Angular: app-photo-request — .request-photo-now-vp is a transparent,
                full-bleed, flex-centered wrapper; the actual visible badge is the
                SMALLER, inset .request-photo-vp nested inside it
                (photo-request.component.scss:1-16). Porting the dark background onto
                the full-bleed wrapper (as this did before) made the overlay cover the
                whole card edge-to-edge instead of a compact centered badge. */}
            <View style={s.similarCardOverlay}>
              <View style={s.similarCardOverlayBadge}>
                <Text style={[s.similarCardOverlayText, { fontFamily: langFonts.medium }]}>
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
                  <Text style={[s.similarCardWaBtnText, { fontFamily: langFonts.regular }]}>{t('GENERAL.WHATSAPP')}</Text>
                </LinearGradient>
              </View>
            </View>
          </>
        )}
      </View>
    </Pressable>
  )
}

// ─── Screen ─────────────────────────────────────────────────────────────────────

// How close to the end of the loaded id list the member has to get before the
// list screen is asked for the next page. Angular's own trigger points are
// indices 4, 8 and 17 of each 20 (common.ts:689) — i.e. it always keeps at
// least three profiles of runway ahead of the member.
const VP_PAGING_LOOKAHEAD = 3

export default function ViewProfileScreen({ navigation, route }: { navigation: any; route: any }) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
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
  // Angular: viewprofile.page.ts's removeProfile() SPLICES the acted-on profile
  // out of the VPPREVNEXT list, so the list shrinks as the member skips or
  // view-laters their way through it. The route param is only the STARTING
  // list — it can't stay a bare read, because animateProfileChange() swaps
  // matriId in place rather than re-navigating, so route.params never changes
  // again for the life of this screen.
  const [profileIds, setProfileIds] = useState<string[]>(route?.params?.profileIds ?? [])
  const profileIndex = profileIds.indexOf(matriId)
  // Angular: viewprofile.page.html:1547 gates the arrow block on
  // `(hidetoolBar && !isSwipingRight) && !profilePreview && !ownProfile` — there
  // is NO daily-recommendation exclusion. The one that existed (JODII-210,
  // "hide the left and right navigation arrow button in the DR VP page") was
  // COMMENTED OUT at viewprofile.page.ts:463-469, and the live code right below
  // it has two branches that deliberately ENABLE next inside DR:
  //
  //   len == 1 && url '/dailyrecommendations/viewprofile'  -> nextButtonDisable = false
  //   next.id == '' && url '/dailyrecommendations/...'      -> both = false
  //
  // So DR keeps its arrows; this port was suppressing them on a rule Angular
  // had already withdrawn. isDrMode still gates the things JODII-210 really
  // did drop in DR — the similar-profiles section and the membership banner.
  const hasPrevProfile = !ownProfile && profileIndex > 0
  const hasNextProfile = !ownProfile && profileIndex >= 0 && profileIndex < profileIds.length - 1

  // Ids the member has skipped / view-latered on this screen. The list screen
  // still has them in its own `profiles` state, so without this they would come
  // straight back on the next page append.
  const removedIdsRef = useRef<Set<string>>(new Set())

  // ── Prev/next paging ────────────────────────────────────────────────────────
  // The bug this fixes: profileIds is a snapshot of the list screen's FIRST page
  // (LIMIT=20), so stepping to the 20th profile hit the end of the array and
  // hasNextProfile went false — the Next button vanished with hundreds of
  // matches still unseen.
  //
  // Angular never reaches that state: common.ts:689 tags the profile at index 4,
  // 8 and 17 of every 20-item page with VPNEXTHIT='1', and stepping onto a
  // tagged one fires the next-page fetch (viewprofile.page.ts:1073). By the time
  // the member is at #20 the list is already 40 long. Rather than replicate
  // those three magic indices (they silently mean "a quarter / half / near the
  // end of a 20-page" and break on any other page size), this asks whenever the
  // member gets within LOOKAHEAD of the end — same effect, same generous runway.
  useEffect(() => {
    if (isDrMode || ownProfile) return
    if (profileIndex < 0) return
    if (profileIndex < profileIds.length - VP_PAGING_LOOKAHEAD) return
    emitVpNeedMoreProfiles()
  }, [profileIndex, profileIds.length, isDrMode, ownProfile])

  // The list screen answers with its full, grown id list.
  useEffect(() => subscribeVpProfileListUpdated(incoming => {
    setProfileIds(prev => {
      const seen = new Set(prev)
      const fresh = incoming.filter(id => !seen.has(id) && !removedIdsRef.current.has(id))
      return fresh.length > 0 ? [...prev, ...fresh] : prev
    })
  }), [])
  // In-memory one-ahead/one-behind prefetch (not persisted — Angular's
  // localStorage-backed cache is more than this screen needs) so swiping to a
  // neighbor already fetched shows instantly instead of a loading flash.
  const prefetchCache = useRef<Map<string, Record<string, any>>>(new Map())
  // Desktop-only Previous/Next avatar+name preview (see the neighbor-prefetch
  // effect below) — mobile's chevrons only need hasPrevProfile/hasNextProfile.
  const [neighborPreviews, setNeighborPreviews] = useState<Record<string, { name: string; photoUri?: string }>>({})

  const [profile, setProfile] = useState<ViewProfileModel | null>(null)
  const [invalidMatriIdMessage, setInvalidMatriIdMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Prev/Next just swaps matriId, re-running the load effect below — without this,
  // every chevron tap set `loading` true again, which tears down the ENTIRE screen
  // (header/nav included, see the `if (loading) return ...` below) for a spinner
  // flash, even though the neighbor's data is usually already prefetched. Only the
  // very first load (arriving fresh from Matches) should show that full-screen state.
  const isFirstLoadRef = useRef(true)
  const [loginGender, setLoginGender] = useState<'M' | 'F'>('F')
  // Angular: onImgErrorHandler() — the own-profile hero photo (biodata theming
  // view) is a single static <Image>, not PhotoSwiper, so it needs its own
  // load-failure flag rather than PhotoSwiper's internal per-index tracking.
  const [heroPhotoFailed, setHeroPhotoFailed] = useState(false)
  // NOTE: no like-tap burst animation here, by product decision — a deliberate
  // divergence from Angular, which plays like-view-profile-post-click.json over
  // the LIKEDCTA ion-chip (button.component.html).
  useEffect(() => { setHeroPhotoFailed(false) }, [profile?.profileId])
  const [ownEntryType, setOwnEntryType] = useState('')
  const [femaleFreeEligible, setFemaleFreeEligible] = useState(false)
  const [indNumbersLeft, setIndNumbersLeft] = useState('0')
  // Angular: paymentPromoPopUp() → bottom-sheet.component's `paymentPromo` block —
  // the real upgrade sheet shown for Call/WhatsApp/Message when the viewer is free.
  const [paymentPromo, setPaymentPromo] = useState<UpgradePaymentPromo | null>(null)

  // Angular: the Like/Undo toast comes from button.component.ts, the SHARED
  // button both the matches card and this page render — so liking from here
  // raises the same toaster. This screen had no Toast at all, so every
  // like/undo response message was swallowed.
  const [toastRequest, setToastRequest] = useState<ToastRequest | null>(null)

  // Angular: viewprofile.page.ts:2037 fires the ACTIVE "profiles viewed"
  // trigger from this page, and communication.service.ts:441 the "like sent"
  // one for a like sent from here. Both need a host for the sheet, which in
  // Ionic is the global modal stack and here is this screen.
  const appRating = useAppRating()

  function showToast(message: string, onUndo?: () => void, duration?: number) {
    setToastRequest({ message, key: Date.now(), onUndo, duration })
  }
  // ── Contact-reveal flow (Angular button.component.ts's two-step confirm →
  // phoneviewed API → Contact Details sheet) — mirrors MatchesScreen.tsx's own
  // fix for the exact same gap: this previously skipped straight to dialing on
  // 'show_contact' with no confirmation step, and silently dropped every other
  // phoneviewed branch (protected number, view limits, ID-verify gate,
  // female-free flow) instead of surfacing anything for them. ──
  const [contactConfirm, setContactConfirm] = useState<'call' | 'whatsapp' | null>(null)
  // Angular: viewprofile.page.ts's presentPopover() — tapping the Verified badge's
  // info icon (or anywhere on the badge, same as Angular) shows this small tooltip,
  // anchored right under the tapped badge (Angular: popoverController.create({event})).
  const [showVerifiedInfo, setShowVerifiedInfo] = useState(false)
  const [verifiedInfoAnchor, setVerifiedInfoAnchor] = useState<PopoverAnchor | null>(null)
  const verifiedBadgeRef = useRef<View>(null)
  // Angular: presentPopover()'s own setTimeout(() => popover.dismiss(), 5000) —
  // auto-closes 5s after opening, on top of the normal tap-outside dismiss.
  useEffect(() => {
    if (!showVerifiedInfo) return
    const timer = setTimeout(() => setShowVerifiedInfo(false), 5000)
    return () => clearTimeout(timer)
  }, [showVerifiedInfo])

  function handleVerifiedInfoPress() {
    // react-native-web's measureInWindow can fail silently through a forwardRef
    // chain (Pressable → View → host node) — either current is null, or the
    // callback just never fires. Either way the tooltip must still open
    // (Popover falls back to its own centered position without an anchor)
    // rather than the tap doing nothing at all.
    if (!verifiedBadgeRef.current) {
      setVerifiedInfoAnchor(null)
      setShowVerifiedInfo(true)
      return
    }
    let opened = false
    verifiedBadgeRef.current.measureInWindow((x, y, width, height) => {
      opened = true
      setVerifiedInfoAnchor({ x, y, width, height })
      setShowVerifiedInfo(true)
    })
    setTimeout(() => {
      if (!opened) {
        setVerifiedInfoAnchor(null)
        setShowVerifiedInfo(true)
      }
    }, 100)
  }
  const [contactDetails, setContactDetails] = useState<{
    name: string; mobile?: string | undefined; dialNumber?: string | undefined; whatsappNumber?: string | undefined
    showCounter?: boolean | undefined; viewedCount?: string | undefined; totalCount?: string | undefined
  } | null>(null)
  // Angular button.component.ts:551-579 — the CONFIRMATION popup's own quota
  // footer line, read purely from the local CONTACT_DETAIL cache. `total` =
  // totalProfileCountData — see communicationService.ts's getContactConfirmContent()
  // for why it's kept separate from `viewed` (decides which template to use).
  const [contactQuota, setContactQuota] = useState({ viewed: '0', left: '', expiry: '', total: '' })
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
  // Web/PWA "Add photo" CTA (handlePhoneInfoSecondaryPress below) — see
  // hooks/useAddPhotoPicker.ts for why this can't just navigate to the
  // native-only 'Gallery' screen.
  const addPhoto = useAddPhotoPicker({
    onRejected: (msg) => Alert.alert('Some photos were not added', msg),
    onError: (msg) => Alert.alert('Error', msg),
  })
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
  // Angular's real native Android/iOS apps intercept the view_horoscope bridge
  // event themselves and handle it in-app (confirmed by the team — this repo only
  // has the WEB fallback, index.html's handleNativeEvent, which does
  // window.open(url, '_blank') and is correctly mirrored below for Platform.OS
  // === 'web' only). On native, HOROSCOPEURL is sometimes a plain image instead
  // of a report page — shown in-app via PhotoViewerModal (raster) or
  // HoroscopeSvgViewerModal (svg — expo-image can't decode those on native,
  // same limitation CdnSvg.tsx already documents) rather than a browser.
  const [horoscopeImageUrl, setHoroscopeImageUrl] = useState<string | null>(null)
  const [horoscopeSvgUrl, setHoroscopeSvgUrl] = useState<string | null>(null)
  // Angular: loginHoroAvail mirrors localStorage.HOROSCOPEAVAILABLE — the LOGGED-IN
  // user's own horoscope-availability flag ('1'/'0'), not the viewed profile's.
  const [loginHoroAvail, setLoginHoroAvail] = useState('0')
  // Angular: showAddHoro — see the load effect's comment for what this gates.
  const [showAddHoro, setShowAddHoro] = useState(true)
  // Moved above floatingCtaAnimStyle (which closes over it inside a worklet) —
  // a worklet re-evaluates its captured closure at call time, so declaring
  // insets AFTER this point threw "Cannot access 'insets' before initialization"
  // on first render.
  const insets = useSafeAreaInsets()
  // Angular: prev/next-profile navigation is a full Ionic page transition
  // (app/animations/page-transition.ts:40-71) — 400ms, cubic-bezier(0.4,0,0.2,1).
  // Confirmed against Ionic's actual mechanics (not just the animation curve):
  // navigateForward() mounts the INCOMING page and starts BOTH pages sliding
  // simultaneously in one continuous motion — entering translateX 100%→0,
  // leaving 0→-100% (or the mirror for 'back') — the incoming page is NOT
  // pre-loaded/pre-rendered first; it slides in showing its own loading state
  // if data isn't ready yet (viewprofile.page.html:128,1513 — content grid
  // stays [hidden] until contentLoaded, a spinner shows in its place), and
  // both page elements stay mounted for the full 400ms (only the old one is
  // torn down afterward). 'forward' (next): new page in from the RIGHT, old
  // out to the LEFT. 'back' (prev): new page in from the LEFT, old out to the
  // RIGHT.
  //
  // RN has one component instance, not two mounted pages, so the earlier
  // "slide fully out, THEN swap, THEN slide in" attempt was two sequential
  // animations with a dead gap in between — visibly not smooth, and the swap
  // itself raced React's re-render (stale content flash). The correct
  // single-instance approximation of Ionic's actual behavior above is: swap
  // matriId IMMEDIATELY (same as the incoming page mounting immediately,
  // before its data is ready), snap position to the incoming edge in that same
  // tick, then run ONE continuous slide from that edge to 0 — matching "swap
  // happens immediately, animation is what's gradual," not "animation
  // finishes, then swap."
  const screenSlideX = useSharedValue(0)
  const PAGE_TRANSITION_DURATION = 500
  const pageTransitionEasing = Easing.bezier(0.5, 0, 0.25, 1)
  const screenSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: screenSlideX.value }],
  }))
  function animateProfileChange(direction: 'prev' | 'next', nextId: string) {
    const outTo = direction === 'prev' ? -SCREEN_WIDTH : SCREEN_WIDTH
    screenSlideX.value = outTo
    setMatriId(nextId)
    screenSlideX.value = withTiming(0, { duration: PAGE_TRANSITION_DURATION, easing: pageTransitionEasing })
  }
  // Angular: the top CTA row is `position: sticky; bottom: 0` (viewprofile.page.scss
  // .sticky-btm) — it rides along pinned to the screen bottom for as long as the
  // detail sections keep scrolling past underneath it, and only stops once the
  // SECOND (plain, non-sticky) CTA copy — right before Similar Profiles — reaches
  // that same on-screen position naturally. That hand-off is entirely native —
  // the browser recalculates sticky position every compositor frame, no JS in
  // the loop — which is why it feels perfectly continuous. RN's ScrollView has
  // no position:sticky equivalent, and a JS-thread approach (measureInWindow's
  // async bridge round-trip, or React state driving an Animated.timing fade)
  // always lags a frame or more behind the actual scroll position, reading as
  // a jump/snap instead of a continuous hand-off. Reanimated's worklet-based
  // scroll handler below runs the visibility math on the UI thread, in the
  // same frame as the scroll itself — the closest RN can get to Angular's own
  // mechanism. cta2Y is the real (second, inline) CTA's content-space Y —
  // refreshed occasionally (see refreshCta2Y), not a per-frame concern.
  const cta2Y = useSharedValue<number | null>(null)
  const scrollYShared = useSharedValue(0)
  const viewportHeightShared = useSharedValue(0)
  const cta2Ref = useRef<View>(null)
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>()
  // JS-thread mirror of the worklet's visibility result — only needed for
  // pointerEvents (which isn't animatable/UI-thread), so it doesn't need
  // per-frame precision the way the visual opacity above does.
  const [cta2Visible, setCta2Visible] = useState(false)
  // Floating bar is visible (opacity 1) until the real CTA's top edge clears
  // the floating bar's own footprint (FLOATING_CTA_HEIGHT + bottom inset) —
  // same clearance logic as before, now evaluated synchronously every frame
  // instead of async/debounced, so there's no lag-driven gap OR jump.
  const floatingCtaAnimStyle = useAnimatedStyle(() => {
    const y = cta2Y.value
    if (y === null) return { opacity: 1 }
    const clearance = FLOATING_CTA_HEIGHT + insets.bottom
    const realCtaOnScreen = scrollYShared.value + viewportHeightShared.value - clearance > y
    return { opacity: realCtaOnScreen ? 0 : 1 }
  })
  const similarListRef = useRef<FlatList<SimilarProfileCard>>(null)
  // Angular: Swiper.js's own default touch handling only ever tracks a SINGLE
  // pointer for its swipe gesture — no explicit config for this anywhere in
  // home.config.ts's `similarprofiles` swiper options, it's just Swiper's
  // built-in behavior (confirmed: no multi-touch/pinch swipe support exists in
  // the Angular reference at all). RN's FlatList/ScrollView has no such
  // restriction by default, so a second finger landing mid-drag also drives
  // the carousel.
  //
  // React's synthetic onTouchStart/scrollEnabled toggle (tried first) doesn't
  // actually block this on web: react-native-web's horizontal scroll is a
  // real browser `overflow-x` scroll container, and the browser's native
  // touch-scroll gesture recognizer can already commit to scrolling within
  // the same event before a React state update re-renders scrollEnabled=false
  // — the async state change loses the race. A real, non-passive DOM
  // `touchstart` listener calling preventDefault() the instant a 2nd finger
  // lands runs synchronously ahead of the browser's own gesture recognition,
  // which is the only way to actually cancel it.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    // react-native-web forwards this ref's underlying scroll node directly as
    // a real DOM element (unlike native, where it's an internal component).
    const node = similarListRef.current as unknown as HTMLElement | null
    if (!node || typeof node.addEventListener !== 'function') return
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    node.addEventListener('touchstart', onTouchStart, { passive: false })
    return () => node.removeEventListener('touchstart', onTouchStart)
  }, [])
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
  // Angular: the header language pill here opens LanguageSelectionComponent
  // with actionType='mothertongue' — a 2-language bottom sheet (English +
  // this domain's one regional language), NOT the full-page language list.
  const [showLanguageSheet, setShowLanguageSheet] = useState(false)
  // Feature 6 biodata theming — 5 swipeable color/background templates, own-profile only.
  const [themes, setThemes] = useState<BiodataTheme[]>([])
  const [themeIndex, setThemeIndex] = useState(0)
  // Angular: download-biodata.component.html:451-463 — a server-rendered QR
  // image (userBioData.QRCODE), NOT client-drawn like the payment QR feature.
  const [biodataQrUrl, setBiodataQrUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (isFirstLoadRef.current) setLoading(true)
      isFirstLoadRef.current = false
      setInvalidMatriIdMessage(null)
      // Angular: common.ts's getContactDetails(), called on every profile-view
      // page load — populates CONTACT_DETAIL BEFORE it's read just below, so
      // the confirm sheet's quota footer (contactQuota) has real numbers
      // instead of whatever was last cached (or nothing, on a fresh session).
      await fetchContactDetails().catch(() => {})
      const [lg, entryType, femaleFreeRaw, contactDetail, horoAvail, userId, religionKey] = await Promise.all([
        getItem(StorageKeys.User.LOGIN_GENDER),
        getSessionValue('ENTRYTYPE'),
        getSessionValue('FEMALEFREECONACT'),
        getJson<Record<string, any>>('CONTACT_DETAIL'),
        getSessionValue('HOROSCOPEAVAILABLE'),
        getItem(StorageKeys.Auth.USER_ID),
        getSessionValue('RELIGIONKEY'),
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
        total:  String(contactDetail?.totalProfileCountData ?? ''),
      })
      setLoginHoroAvail(String(horoAvail ?? '0'))
      // Angular: viewprofile.page.ts:2695-2699 — showAddHoro, a per-VIEWER (not
      // per-profile) religion-based feature toggle that hides the entire Horoscope
      // section regardless of data, for viewers whose own RELIGIONKEY is Muslim
      // (codes '3'/'4'/'5' — horoscope matching isn't part of Muslim marriage customs).
      setShowAddHoro(!['3', '4', '5'].includes(String(religionKey ?? '')))

      const cached = prefetchCache.current.get(matriId)
      const raw = cached ?? await getViewProfile(matriId)
      // KEEP the entry rather than deleting it on consume. Deleting it made every
      // Next tap re-request the profile the member had just left: it becomes
      // idx-1 of the new position, the neighbour sweep below sees it missing from
      // the cache, and fetches it again. Combined with the genuinely-new idx+2,
      // that is the two profile/view calls per tap. The window prune further
      // down keeps this from growing without bound.
      if (raw) prefetchCache.current.set(matriId, raw)
      if (cancelled) return
      if (raw) {
        const adapted = viewProfileAdapter.adapt(raw)
        setProfile(adapted)
        setEnlargedPhotos(null)
        // Angular: viewprofile.page.ts:2033-2039 — a profile that actually
        // rendered counts as one "profile seen", unless it is the member
        // looking at their own card or a same-gender one
        // (`!this.ownProfile || !this.sameGender`). Angular also skips it
        // while another modal or the coach mark owns the screen; the coach
        // mark is the one this port has.
        if (!showCoachMark && (!ownProfile || adapted.gender !== loginGender)) {
          appRating.onProfileViewed()
        }
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
        // as a flicker. This used to be skipped in DR mode, on the premise that DR
        // had no prev/next affordance — it does (see hasPrevProfile above), so
        // warming its neighbours keeps its arrows as instant as everywhere else.
        const idx = profileIds.indexOf(matriId)
        const windowIds = [
          profileIds[idx - 2], profileIds[idx - 1], matriId, profileIds[idx + 1], profileIds[idx + 2],
        ].filter((id): id is string => !!id)

        // Now that consumed entries are kept, drop anything that has fallen
        // outside the +/-2 window — otherwise the cache would hold every profile
        // of a long session's worth of stepping.
        const keep = new Set(windowIds)
        prefetchCache.current.forEach((_v, id) => {
          if (!keep.has(id)) prefetchCache.current.delete(id)
        })

        const neighborIds = windowIds.filter(id => id !== matriId && !prefetchCache.current.has(id))
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
      } else {
        // JODII-499: surface the real "Invalid MatriID" message when that's
        // confirmed the cause — the generic fallback below still covers
        // every other failure shape.
        setInvalidMatriIdMessage(_consumeInvalidMatriIdMessage())
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
    // i18n.language: Angular's changeLanguage() (matches.page.ts:3179-3202,
    // mirrored by MatchesScreen.tsx's own mountedLangRef effect) re-fetches the
    // WHOLE page on a language switch because these field values — Marital
    // Status, Physical Status, Mother Tongue, Profile Created For, Home Town,
    // Professional/Religious details, etc. — are returned by the API already
    // localized via the request's own LANG param (service/apiClient.ts's
    // buildCommonParams(), reading StorageKeys.Auth.LANG), not translated
    // client-side. Without re-running this load on language change, only the
    // static i18n labels (via t()) updated — the profile's own data VALUES
    // stayed frozen in whatever language they were first fetched in.
  }, [matriId, i18n.language])

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

  // Feature 6 biodata theming — Angular: download-biodata.component.ts's 5
  // swipeable color/background templates + QR code. Only meaningful in
  // ownProfile mode; fetched once that's known, separately from the main
  // profile load (see getBiodataExtras' comment for why it isn't folded in).
  useEffect(() => {
    if (!ownProfile || !matriId) return
    let cancelled = false
    Promise.all([getBiodataExtras(matriId), getItem(StorageKeys.App.BIODATA_THEME_ID)])
      .then(([extras, savedId]) => {
        if (cancelled) return
        setBiodataQrUrl(extras.qrCodeUrl)
        if (extras.themes.length === 0) return
        setThemes(extras.themes)
        const savedIdx = extras.themes.findIndex(theme => theme.value === savedId)
        setThemeIndex(savedIdx >= 0 ? savedIdx : 0)
      })
    return () => { cancelled = true }
  }, [ownProfile, matriId])

  function cycleTheme(direction: 1 | -1) {
    if (themes.length === 0) return
    const nextIndex = (themeIndex + direction + themes.length) % themes.length
    setThemeIndex(nextIndex)
    saveBiodataThemeId(themes[nextIndex]!.value).catch(() => {})
  }

  // Angular: .vpcontent{{viewedid}} gesture (onMove) — a horizontal swipe over
  // the themed top area cycles templates; deltaX>0 (drag right) goes to the
  // PREVIOUS template, deltaX<0 (drag left) goes NEXT — same direction Angular
  // uses. activeOffsetX/failOffsetY (matching matchesCard.shared.tsx's
  // PhotoSwiper gesture) claim the touch only once horizontal movement clearly
  // dominates, so this can't fight the vertical ScrollView below it.
  // .enabled(...) is critical here, not cosmetic: this same GestureDetector wraps
  // the photo area on OTHER people's profiles too (to avoid duplicating that
  // whole JSX block), where PhotoSwiper's own internal pan gesture already owns
  // that surface — disabled fully steps aside instead of contending with it.
  const themeSwipeGesture = Gesture.Pan()
    .enabled(ownProfile && themes.length > 1)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onEnd(e => {
      if (e.translationX > 0) runOnJS(cycleTheme)(-1)
      else if (e.translationX < -0) runOnJS(cycleTheme)(1)
    })

  function dismissCoachMark() {
    setShowCoachMark(false)
    markCoachMarkShown().catch(() => {})
  }

  // Feature 2 prev/next-profile navigation. Angular's onGesture()/onMove()
  // (viewprofile.page.ts:1166-1174, 998-1010) wires a GestureController pan
  // across the ENTIRE ion-content — mouse-drag on web too, not touch-only —
  // with only a 10px horizontal-delta threshold, excluding the photo swiper
  // (`.disable-swipe`), pagination dots, and the caption/`.information-block`.
  // PhotoSwiper already owns a horizontal pan on the photo surface for
  // browsing this profile's OWN photos — competing gestures there is a
  // documented Angular bug class (swiping a photo card accidentally
  // triggering profile navigation), which is exactly why Angular itself
  // excludes that surface too — so this mirrors that split: tap chevrons
  // (PhotoSwiper's own dark-circle/white-chevron arrow style) over the photo,
  // and detailSwipeGesture below covering everything from the info card down
  // to the end of the scroll content (the actual area Angular's gesture is
  // live over, once its own exclusions are accounted for).
  function goToPrev() {
    if (!hasPrevProfile) return
    animateProfileChange('prev', profileIds[profileIndex - 1]!)
  }
  function goToNext() {
    if (!hasNextProfile) return
    animateProfileChange('next', profileIds[profileIndex + 1]!)
  }
  // activeOffsetX/failOffsetY: same 10px-ish claim pattern as themeSwipeGesture
  // above, so this can't fight the vertical ScrollView it sits inside. Angular:
  // deltaX>0 (drag right) → prev, deltaX<0 (drag left) → next — same mapping
  // goToPrev/goToNext already use for the chevron buttons.
  //
  // NOTE on where this gesture's <GestureDetector> CLOSES: it ends right after
  // the second CTA block, ABOVE the "Other profiles like X" carousel, on purpose.
  //
  // That carousel is a horizontal FlatList with its own scroll gesture. While it
  // sat inside this pan's area, the pan claimed any horizontal movement past
  // 10px, so swiping the carousel navigated to the next PROFILE instead of
  // scrolling it. A gesture relation (Gesture.Native() on the list +
  // requireExternalGestureToFail) did NOT fix it — RNGH does not reliably attach
  // a native handler to a plain RN FlatList that way.
  //
  // Angular solves the same collision structurally, by keeping the surfaces that
  // own a horizontal gesture OUT of its pan's area (`.disable-swipe`, the photo
  // swiper, the pagination dots). Same here: the swipe zone stops above the
  // carousel.
  const detailSwipeGesture = Gesture.Pan()
    .enabled(hasPrevProfile || hasNextProfile)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onEnd(e => {
      if (e.translationX > 0) runOnJS(goToPrev)()
      else if (e.translationX < 0) runOnJS(goToNext)()
    })

  // Worklet — runs on the UI thread, same frame as the scroll itself. Keeps
  // scrollYShared/viewportHeightShared live for floatingCtaAnimStyle's
  // interpolation, and mirrors the JS-thread bits (scrolled/showMenu header
  // state) via runOnJS, same as before. cta2Visible (JS state) only needs to
  // flip at the hand-off moment, not every frame — pointerEvents doesn't need
  // per-frame precision the way the visual opacity does.
  const onScroll = useAnimatedScrollHandler(e => {
    const y = e.contentOffset.y
    scrollYShared.value = y
    // Angular: `(this.scrWidth - 64) <= offset` (viewprofile.page.ts:1428-1441) —
    // the header switches to name+call+3-dot once scrolled ~one photo-height
    // (scrWidth, same as PHOTO_HEIGHT here) minus 64px, not a fixed constant.
    const isScrolled = y > PHOTO_HEIGHT - 64
    runOnJS(setScrolled)(isScrolled)
    if (!isScrolled) runOnJS(setShowMenu)(false)
    const cy = cta2Y.value
    if (cy !== null) {
      const clearance = FLOATING_CTA_HEIGHT + insets.bottom
      const realCtaOnScreen = y + viewportHeightShared.value - clearance > cy
      runOnJS(setCta2Visible)(realCtaOnScreen)
    }
  })

  // Refreshes cta2Y — the real (second, inline) CTA's content-space Y —
  // whenever content above it might have reflowed (star-match data, similar-
  // profiles/biodata-QR images resolving, etc.), so the worklet's threshold
  // never goes stale. This itself doesn't need to be per-frame; it only needs
  // to happen occasionally, since the CTA's real position rarely changes.
  function refreshCta2Y() {
    const scrollNode = scrollViewRef.current as unknown as View | null
    const ctaNode = cta2Ref.current
    if (!scrollNode || !ctaNode) return
    scrollNode.measureInWindow((_svX: number, svY: number) => {
      ctaNode.measureInWindow((_ctaX: number, ctaY: number, _ctaW: number, ctaH: number) => {
        // A 0×0/negative reading means the node hasn't actually laid out yet
        // (e.g. this fired before first paint) — ignore it rather than
        // clobbering a good value with garbage.
        if (ctaH <= 0) return
        cta2Y.value = ctaY - svY + scrollYShared.value
      })
    })
  }

  // Re-measure once these finish loading — the async data most likely to
  // reflow content above the real CTA after the initial onLayout capture.
  useEffect(() => {
    const timer = setTimeout(refreshCta2Y, 100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, starMatch, similarProfiles.length])

  // ── Actions — same communicationBtnOnClick plumbing Matches uses ─────────────

  // Angular button.component.ts:486 showCustomToaster() — its Undo button fires
  // a plain `dislike` call, exactly as MatchesScreen.handleUndoLike() does.
  async function handleUndoLike(profileId: string) {
    setProfile(prev => prev && { ...prev, likedStatus: '0' })
    try {
      await communicationBtnOnClick(fromPage, 'dislike', { MATRIID: profileId })
    } catch (e) {
      if (__DEV__) console.error('[ViewProfile] undo-like error:', e)
    }
  }

  async function handleLike() {
    if (!profile) return
    const profileId = profile.profileId
    setProfile(prev => prev && { ...prev, likedStatus: '1' })
    try {
      const result = await communicationBtnOnClick(fromPage, 'like', { MATRIID: profileId })
      // Angular button.component.ts:454-468 — `like`/`dislike` route their
      // response MSG to showCustomToaster() (with Undo) on BOTH the success
      // and the message-carrying failure path (e.g. "You have already liked").
      // 1500ms is that toast's own duration, not the 2000 default.
      if (result.type === 'error') {
        setProfile(prev => prev && { ...prev, likedStatus: '0' })
        showToast(result.message, () => handleUndoLike(profileId), 1500)
      } else if (result.type === 'api_success' && result.message) {
        showToast(result.message, () => handleUndoLike(profileId), 1500)
      }
      // Angular: communication.service.ts:441 — every like except one sent
      // from Daily Recommendation counts towards the active threshold.
      appRating.onLikeSent()
    } catch { /* keep optimistic state */ }
  }

  // Angular: btnEmitAction()'s dontshow/viewlater branch ends in removeProfile()
  // (viewprofile.page.ts:1818), which relinks the VPPREVNEXT neighbours around
  // the acted-on profile, deletes its entry, and then:
  //
  //   list now empty  -> redirectToFromPage()            (leave for matches/activity)
  //   otherwise       -> nextpreProfile('next') after 300ms  (ADVANCE)
  //
  // This port called handleBack() in BOTH cases, so every skip / view-later
  // bounced the member out to Matches instead of moving to the next profile.
  function removeCurrentAndAdvance() {
    if (!profile) return
    // matriId, NOT profile.profileId. profileIds is built from the LIST the
    // member came from (MatchesScreen passes item.profileId), and matriId is
    // the value taken straight out of it — every other lookup on this screen
    // uses profileIds.indexOf(matriId) for exactly that reason. profile.profileId
    // is re-derived by viewProfile.adapter from the DETAIL response
    // (MATRID ?? MATRIID ?? NBID ?? ID), so it can come back in a different
    // shape; when it did, indexOf returned -1 and this fell into the
    // "not in a list" branch — leaving for Matches on every skip/view-later,
    // which is the exact symptom this was meant to fix.
    const id  = matriId
    const idx = profileIds.indexOf(id)
    const remaining = profileIds.filter(x => x !== id)

    // Angular's `else` of `isValidparam(retrievedObject[viewedid])` — a profile
    // that isn't part of a list at all (DR mode, a deep link, a notification
    // landing) has no next to go to, so it still leaves the page. Same for the
    // last one standing, which is Angular's IsEmptyObject() branch.
    if (idx < 0 || remaining.length === 0) { handleBack(); return }

    // After the splice, whatever sat at idx+1 now sits at idx. Skipping the
    // LAST profile leaves nothing ahead, so step back onto the new last one
    // rather than running off the end.
    const nextId = idx < remaining.length ? remaining[idx]! : remaining[remaining.length - 1]!
    removedIdsRef.current.add(id)
    setProfileIds(remaining)
    // Angular's own 300ms beat before nextpreProfile().
    setTimeout(() => animateProfileChange('next', nextId), 300)
  }

  async function handleDontShow() {
    if (!profile) return
    try {
      await communicationBtnOnClick(fromPage, 'skip', { MATRIID: profile.profileId })
      removeCurrentAndAdvance()
    } catch { /* ignore */ }
  }

  async function handleViewLater() {
    if (!profile) return
    try {
      await communicationBtnOnClick(fromPage, 'viewlater', { MATRIID: profile.profileId })
      removeCurrentAndAdvance()
    } catch { /* ignore */ }
  }

  // Angular button.component.ts's showContactDetails() always confirms first
  // ("You can view #HISHER# number and call or WhatsApp #HIMHER#...") — this
  // previously skipped straight to communicationBtnOnClick and dialed whatever
  // it returned, with no confirmation step at all (same fix as MatchesScreen.tsx).
  // Angular communication.service.ts's showContactDetails() (lines 253-271) —
  // the confirm step is only shown when NEITHER direct-reveal condition is
  // met (already viewed this profile before, or mutual-like+paid+quota-left).
  // Angular communication.service.ts's showContactDetails() FIRST check — a
  // paid user whose mutual-like AND overall phone-view quotas are both
  // exhausted sees the PHONENOLIMIT sheet instead of the confirm popup.
  function checkPhoneNoLimit(): boolean {
    if (!profile) return false
    if (shouldShowPhoneNoLimit(profile.phoneViewed, profile.likedStatus, indNumbersLeft, contactQuota.left, ownEntryType)) {
      setPhoneInfoSheet({ kind: 'female_free_limit_over' })
      return true
    }
    return false
  }

  function handleCall() {
    if (!profile) return
    if (checkPhoneNoLimit()) return
    // Angular: a free member who's never viewed this profile's number goes
    // straight to paymentPromoPopUp(), no confirm step first — see
    // ActivityScreen.tsx's confirmThenContact for the same fix.
    const alreadyViewed = ['1', '3'].includes(String(profile.phoneViewed ?? '0'))
    if (ownEntryType !== 'P' && !alreadyViewed) {
      handleContactConfirmYes('call')
      return
    }
    if (shouldSkipPhoneConfirm(profile.phoneViewed, profile.likedStatus, indNumbersLeft, ownEntryType, profile.phoneProtected)) {
      handleContactConfirmYes('call')
    } else {
      setContactConfirm('call')
    }
  }

  function handleWhatsApp() {
    if (!profile) return
    if (checkPhoneNoLimit()) return
    const alreadyViewed = ['1', '3'].includes(String(profile.phoneViewed ?? '0'))
    if (ownEntryType !== 'P' && !alreadyViewed) {
      handleContactConfirmYes('whatsapp')
      return
    }
    if (shouldSkipPhoneConfirm(profile.phoneViewed, profile.likedStatus, indNumbersLeft, ownEntryType, profile.phoneProtected)) {
      handleContactConfirmYes('whatsapp')
    } else {
      setContactConfirm('whatsapp')
    }
  }

  // Angular: viewprofile.page.html:493-498 — msgImgCta, same clickingOnBtn(...,
  // 'jodimessages') → communication.service.ts branch as MatchesScreen.tsx's
  // handleMessage(). No confirm popup (unlike call/whatsapp) — goes straight
  // through gating: unverified/no-photo paid male → verify_id, free member →
  // payment promo, else → straight into the chat window.
  async function handleMessage() {
    if (!profile) return
    try {
      const result = await communicationBtnOnClick(fromPage, 'jodimessages', { MATRIID: profile.profileId })
      if (result.type === 'payment_promo') {
        await showPaymentPromo(false)
      } else if (result.type === 'verify_id') {
        // photoUpload=true (verified male, no photo yet) reads a DIFFERENT
        // registration-array config than the plain not-yet-verified case —
        // see communicationService.ts's CommActionResult 'verify_id' doc.
        const arrays = await getRegistrationArrays()
        const cfg = (result.photoUpload ? arrays?.PHOTOPUBLISHPAID?.Shortlist : arrays?.PROFILEVERIFYPAID?.Shortlist) ?? {}
        let cta = String(cfg.CTA ?? 'OK')
        if (cta.includes('##CSNUM##')) {
          const callNum = (await getItem('VERIFIEDBYCALLNUM')) ?? ''
          cta = cta.replace(/##CSNUM##/g, callNum).replace('+91', '')
        }
        setPhoneInfoSheet({
          kind:     'verify_id',
          title:    String(cfg.TITLE ?? (result.photoUpload ? 'Add your photo to continue' : 'Verify your profile')),
          content:  String(cfg.CONTENT ?? (result.photoUpload ? 'Please add your photo to view phone numbers.' : 'Please complete ID verification to view phone numbers.')),
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
      // result.type === 'api_success' — communicationBtnOnClick's handleChat()
      // already navigated to chat-window. result.type === 'error' — no toast
      // infra on this screen; swallow, matching this file's existing error handling.
    } catch (e) {
      if (__DEV__) console.error('[ViewProfile] message error:', e)
    }
  }

  function handleContactConfirmClose() {
    setContactConfirm(null)
  }

  // Angular button.component.ts:524-583 — see communicationService.ts's
  // getContactConfirmContent() for the full template-selection logic (shared
  // by all 6 screens that show this popup, so it can't drift out of sync).
  function getContactConfirmContent(): string {
    if (!profile) return ''
    return getSharedContactConfirmContent(t, profile.gender, contactQuota)
  }

  async function handleContactConfirmYes(override?: 'call' | 'whatsapp') {
    const action = override ?? contactConfirm
    if (!profile || !action) return
    setContactConfirm(null)
    try {
      const result = await communicationBtnOnClick(fromPage, action, { MATRIID: profile.profileId })
      if (result.type === 'show_contact') {
        // Angular's Contact Details popup shows Name/Mobile/WhatsApp/Call
        // together regardless of which CTA was tapped — not one-or-the-other.
        setContactDetails({
          name:           profile.name,
          mobile:         result.mobile,
          dialNumber:     result.dialNumber,
          whatsappNumber: result.whatsappNumber,
          showCounter:    result.showCounter,
          viewedCount:    result.viewedCount,
          totalCount:     result.totalCount,
        })
        if (result.viewedCount !== undefined || result.remainingCount !== undefined) {
          setContactQuota(prev => ({
            ...prev,
            viewed: result.viewedCount ?? prev.viewed,
            left:   result.remainingCount ?? prev.left,
          }))
        }
      } else if (result.type === 'payment_promo') {
        await showPaymentPromo(action === 'whatsapp')
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
        // server-driven, from ONE of two registration-array configs depending
        // on which gate fired: PROFILEVERIFYPAID.Shortlist for the plain
        // not-yet-verified case, PHOTOPUBLISHPAID.Shortlist for the
        // verified-but-no-photo case (result.photoUpload — check_Paid_Verified_
        // Nophoto() in Angular). The support-number placeholder `##CSNUM##`
        // only ever appears in CTA.
        const arrays = await getRegistrationArrays()
        const cfg = (result.photoUpload ? arrays?.PHOTOPUBLISHPAID?.Shortlist : arrays?.PROFILEVERIFYPAID?.Shortlist) ?? {}
        let cta = String(cfg.CTA ?? 'OK')
        if (cta.includes('##CSNUM##')) {
          const callNum = (await getItem('VERIFIEDBYCALLNUM')) ?? ''
          cta = cta.replace(/##CSNUM##/g, callNum).replace('+91', '')
        }
        setPhoneInfoSheet({
          kind:     'verify_id',
          title:    String(cfg.TITLE ?? (result.photoUpload ? 'Add your photo to continue' : 'Verify your profile')),
          content:  String(cfg.CONTENT ?? (result.photoUpload ? 'Please add your photo to view phone numbers.' : 'Please complete ID verification to view phone numbers.')),
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
    if (contactDetails?.dialNumber) Linking.openURL(`tel:${contactDetails.dialNumber}`)
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
      addPhoto.openAddPhoto(navigation)
    }
    // "Call now" (female_free_call_verification) would dial app support in
    // Angular — no confirmed support number source exists in this port yet,
    // so this honestly just closes rather than pretending to place a call.
  }

  // Angular: button.component.ts's paymentPromoPopUp() — the real upgrade sheet
  // built from payment/nbcustomer/v1's content, shown for a FREE member.
  async function showPaymentPromo(_isWhatsApp: boolean) {
    if (!profile) return
    if (ownEntryType !== 'F') {
      navigation.navigate('recharge')
      return
    }
    const promo = await fetchUpgradePaymentPromo(profile.name).catch(() => null)
    if (!promo || ['7', '11'].includes(promo.promoType)) { navigation.navigate('recharge'); return }
    setPaymentPromo(promo)
  }

  function handlePaymentPromoUpgrade() {
    const promo = paymentPromo
    setPaymentPromo(null)
    if (!promo) return
    redirectToIntermediatePage(fromPage, promo.paymentId, promo.type, true)
  }

  function handleStickyPress() {
    navigation.navigate('recharge')
  }

  // Angular: clickOnViewProfile('similarprofiles', MATRIID) — opens that profile's
  // own View Profile page (app-swiper.component.ts:392-437).
  // Tapping a card in "Other profiles like X".
  //
  // navigation.push, NOT redirectToViewProfile's navigate(): we are ALREADY on
  // 'viewProfile', and React Navigation's navigate() to the route it is already
  // focused on does not push — it merges params into the current screen. This
  // screen reads matriId into STATE at mount (so it can swap profiles in place
  // for prev/next), so a params merge changes nothing at all and the tap looked
  // completely dead. push() gives the tapped profile its own screen, which is
  // also what Angular does (router.navigate to a fresh viewprofile URL) and
  // keeps Back returning to the profile the member came from.
  function handleSimilarProfilePress(card: SimilarProfileCard) {
    // Angular: nbcommon.matriIdDBset(res['RESPONSE']['MATCHES'], 0, 'similarprofiles')
    // (viewprofile.page.ts:1417) seeds the prev/next cache with the SIMILAR list
    // under its own 'similarprofiles' module key — so inside the opened profile,
    // prev/next and skip/view-later walk the carousel, not the matches list.
    navigation.push(ENavigation.VIEW_PROFILE, {
      matriId:    card.matriId,
      fromPage:   'similarprofiles',
      showRating: false,
      profileIds: similarProfiles.map(c => c.matriId),
    })
  }

  function handleMembershipBannerPress() {
    navigation.navigate('recharge')
  }

  // ── Horoscope actions — Angular: viewprofile.page.ts callNative('view_horoscope')/
  // goToEdit('22'). (requestHoro() also exists in Angular but its only UI trigger is
  // commented out of the template — dead code, never reachable — so it has no React
  // equivalent here either; see the section-visibility gate below.) ────────────────

  function handleAddHoroscope() {
    // Angular: goToEdit(pageNo) → router.navigate(['editform-vp/'+pageNo]) opens a
    // horoscope-generation form. No RN screen builds that yet (confirmed — no
    // enable/generate flow exists anywhere in this port), so this used to
    // navigate to the dead 'editform' route (never registered in AppStack.tsx),
    // which threw a navigation warning on every tap. Graceful stand-in until
    // that screen is built.
    Alert.alert('Add Horoscope', 'This feature is coming soon.')
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
    if (!url) return
    if (Platform.OS === 'web') {
      // Angular: index.html's handleNativeEvent('view_horoscope') does
      // window.open(url, '_blank') — a new tab is correct here, unchanged.
      Linking.openURL(url)
      return
    }
    // Native (Android/iOS): stay in-app instead of handing off to the external
    // OS browser. SVG needs its own viewer (react-native-svg-based, since
    // expo-image can't decode remote SVGs on native); other raster images use
    // the same in-app photo viewer the profile photos use; anything else (a
    // report page/PDF, e.g. .html) opens in an in-app browser tab
    // (SFSafariViewController/Chrome Custom Tabs), not Safari/Chrome itself.
    if (/\.svg(\?|#|$)/i.test(url)) {
      setHoroscopeSvgUrl(url)
    } else if (/\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(url)) {
      setHoroscopeImageUrl(url)
    } else {
      await WebBrowser.openBrowserAsync(url)
    }
  }

  // ── Feature 6 self-preview actions — Angular: clickAddMoreDetails('27'|'28')
  // (viewprofile.page.ts:2502-2523) ───────────────────────────────────────────

  function handleAddFamilyDetails() {
    // Was navigateGlobal(ENavigation.EDIT_FORM, ...) — 'editform' has no matching
    // Stack.Screen (confirmed), so this threw a navigation warning on every tap.
    // EditProfileFamily is the real registered screen covering brothers/sisters.
    navigation.navigate('EditProfileFamily')
  }

  function handleAddPropertyDetails() {
    // Same dead-route fix as handleAddFamilyDetails — EditProfileProperty is the
    // real registered screen covering property/vehicle.
    navigation.navigate('EditProfileProperty')
  }

  // Angular: download-biodata.component.ts redirectToMissingPage() — a single
  // top-of-screen "some details are missing" banner that redirects to whichever
  // field is missing, in this priority order. Angular's own cascade also checks
  // photo/physical-status/gothram/horoscope, but none of those have a real edit
  // destination in this port yet (confirmed — see handleAddHoroscope above), so
  // they're left out here rather than pointing the banner at a dead route.
  function getFirstMissingScreen(p: ViewProfileModel): string | null {
    if (!p.income)      return 'EditProfileProfessional'
    if (!p.eatingHabits) return 'EditProfileLifestyle'
    if (!p.drinking)     return 'EditProfileLifestyle'
    if (!p.smoking)      return 'EditProfileLifestyle'
    if (!p.raasi)        return 'EditProfileReligious'
    if (!p.dosham?.length) return 'EditProfileReligious'
    if (!p.star)         return 'EditProfileReligious'
    if (!p.brothers)     return 'EditProfileFamily'
    if (!p.sisters)      return 'EditProfileFamily'
    if (!p.property.length && !p.vehicle.length) return 'EditProfileProperty'
    return null
  }

  function handleMissingDetailsPress() {
    if (!profile) return
    const screen = getFirstMissingScreen(profile)
    if (screen) navigation.navigate(screen)
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
  // Angular's own-side avatar/name (star-matching.component.ts:83-85) comes from
  // localStorage NAME/PHOTOURL — the LOGGED-IN viewer's own profile photo, not
  // anything tied to this specific viewed profile.
  async function handleViewStarMatchDetails() {
    if (!profile || !starMatch) return
    const [ownName, ownPhoto] = await Promise.all([
      getSessionValue('NAME'),
      getSessionValue('PHOTOURL'),
    ])
    navigation.navigate('star-matching', {
      // React Navigation's web linking serializes route params into the URL —
      // a plain object param naively stringifies to the literal text
      // "[object Object]" there (confirmed live), unlike native where params
      // stay in memory. JSON-stringifying explicitly avoids that; the receiving
      // screen JSON.parses it back.
      data: JSON.stringify(starMatch.raw),
      ownName: ownName || '',
      ownPhoto: ownPhoto || undefined,
      partnerName: profile.name,
      partnerPhoto: profile.photos[0],
    })
  }


  // Feature 5 — Angular: pages/report-profile (routed page there; a modal here).
  // Opens the full reasons-picker form instead of a direct confirm+submit.
  function handleReportProfile() {
    setShowMenu(false)
    setReportModalOpen(true)
  }

  function handleReportSubmitted() {
    setReportModalOpen(false)
    handleBack()
  }

  // ── Loading / not-found ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={s.loaderScreen}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    )
  }
  if (!profile && invalidMatriIdMessage) {
    // JODII-499: the confirmed "Invalid MatriID" case (RESPONSECODE 2, ERRCODE
    // 3) — Angular shows this as a toast; there's nothing else to render on
    // this screen once it's known the id itself is bad, so this replaces the
    // generic TEMP DEBUG fallback below rather than sitting on top of it.
    return (
      <SafeAreaView style={s.loaderScreen}>
        <Text style={[s.notFoundText, { fontFamily: langFonts.medium }]}>{invalidMatriIdMessage}</Text>
        <Pressable style={s.backBtnInline} onPress={() => handleBack()}>
          <Text style={[s.backBtnInlineText, { fontFamily: langFonts.medium }]}>{'‹ Back'}</Text>
        </Pressable>
      </SafeAreaView>
    )
  }
  if (!profile) {
    return (
      <SafeAreaView style={s.loaderScreen}>
        <Text style={[s.notFoundText, { fontFamily: langFonts.medium }]}>Unable to load this profile.</Text>
        <Pressable style={s.backBtnInline} onPress={() => handleBack()}>
          <Text style={[s.backBtnInlineText, { fontFamily: langFonts.medium }]}>{'‹ Back'}</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const oppGender = profile.gender
  // Angular: sameGender hides Call/WhatsApp/Like entirely.
  const sameGender = profile.gender === loginGender
  const hasReligiousInfo = !!(profile.caste || profile.raasi || profile.star || (profile.dosham && profile.dosham.length > 0))
  const showHomeTownRow = !!profile.homeLocation && HOME_PLACE_DOMAIN.includes(profile.motherTongueCode ?? '')

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
  // down (floatingCtaAnimStyle); this helper builds the shared JSX both copies use.
  function renderCtaBlock() {
    // TS can't narrow `profile` through this closure — re-guard explicitly (the
    // caller only ever invokes this after the outer `if (!profile) return` above).
    if (!profile || sameGender) return null
    // Angular: `.bottom-cta-bg` IS the footer — the pink starts at its top edge,
    // with nothing white above it. So in the after-like state this wrapper and
    // its host both give up their top spacing and let the band run flush; the
    // Like-CTA state keeps the original 16.
    return (
      <View style={[s.ctaBlock, showAfterLikeCTA(profile.likedStatus) && s.ctaBlockFlush]}>
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
                <Text style={[s.ctaDontShowText, { fontFamily: langFonts.regular }, disableDontShow(profile.dontShowStatus) && s.ctaDisabledText]}>
                  {t('GENERAL.DONTSHOWCTA')}
                </Text>
              </Pressable>
              <Pressable
                style={[s.ctaViewLater, disableViewLater(profile.viewLaterStatus) && s.ctaDisabled]}
                onPress={handleViewLater}
                disabled={disableViewLater(profile.viewLaterStatus)}
              >
                <ViewLaterIcon width={24} height={24} />
                <Text style={[s.ctaViewLaterText, { fontFamily: langFonts.regular }, disableViewLater(profile.viewLaterStatus) && s.ctaDisabledText]}>
                  {t('GENERAL.VIEWLATER')}
                </Text>
              </Pressable>
            </View>
            <Pressable style={s.ctaLike} onPress={handleLike}>
              <LikeIcon width={24} height={24} />
              <Text style={[s.ctaLikeText, { fontFamily: langFonts.semiBold }]}>{t('GENERAL.LIKE_CTA').replace('#HER_HIM#', '').trim()}</Text>
            </Pressable>
          </View>
        )}

        {/* Angular: viewprofile.page.html:1315-1430 — this is NOT a rounded,
            inset pink card with the text and the CTA side by side. The whole
            sticky grid takes `.bottom-cta-bg` (viewprofile.page.scss:274-282):
            a FULL-WIDTH band, pink at the top fading to white, with a hairline
            top border that fades out towards both ends. Inside it the content
            line is its own CENTRED row (`ion-col ... d-flex
            justify-content-center` + `text-align-center`) and the CTA is a
            separate `hasFullWidth` button underneath — never beside it. */}
        {showAfterLikeCTA(profile.likedStatus) && (
          <LinearGradient
            colors={[Colors.afterLikeBandTop, Colors.white]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.afterLikeBand}
          >
            {/* `border-image: linear-gradient(to right, transparent,
                rgba(245,189,208,1) 50%, transparent)` on a 1px top border —
                a hairline that is pinkest mid-span and gone at either end. */}
            <LinearGradient
              colors={[Colors.afterLikeBorderFade, Colors.afterLikeBorder, Colors.afterLikeBorderFade]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.afterLikeBandTopLine}
              pointerEvents="none"
            />
            {/* Angular: matches-card.component.html:174-176 gates this line on
                `showAfterLikeContent(...) && getEnteryType() != 'P'` — a PAID
                member never sees it, because the contact CTA right below says
                the same thing. showAfterLikeContentLine() carries that whole
                condition; without it "Talk to her directly" (MATCHES.TALK_TEXT_1)
                sat above the button for exactly the members meant to be spared it. */}
            {showAfterLikeContentLine(ctaCtx) && (
              <Text style={[s.afterLikeText, { fontFamily: langFonts.medium }]}>{getAfterLikeContentText(ctaCtx, t)}</Text>
            )}
            <View style={s.ctaSendInterestWrap}>
              {showFreeBadge(ctaCtx) && (
                <View style={s.freeBadge} pointerEvents="none">
                  <Text style={[s.freeBadgeText, { fontFamily: langFonts.medium }]}>{t('GENERAL.FREE')}</Text>
                </View>
              )}
              <Pressable style={s.ctaSendInterest} onPress={handleCall}>
                <CdnSvg uri={getAfterLikeCtaIcon(ctaCtx)} width={16} height={16} />
                <Text style={[s.ctaSendInterestText, { fontFamily: langFonts.regular }]}>{getAfterLikeCtaLabel(ctaCtx, t)}</Text>
              </Pressable>
            </View>
            {/* JODII-499 — viewprofile.page.html:1433-1447: a PAID member gets a
                second "Message him/her" CTA under the primary one
                (`showAfterLikeContent(...) && getEnteryType() == 'P'`), a free
                member gets the Pay Now CTA alone. Same CONFIG.MESSAGE_BTN the
                matches card renders — outlined, brand-red label, message_red.svg
                — so both surfaces stay identical; this screen was missing it. */}
            {showAfterLikeMessageCta(ctaCtx) && (
              <Pressable style={s.ctaMessage} onPress={handleMessage}>
                <CdnSvg uri={CDN_SVG + 'message_red.svg'} width={24} height={24} />
                <Text style={[s.ctaMessageText, { fontFamily: langFonts.medium }]}>
                  {getMessageBtnText(ctaCtx, t)}
                </Text>
              </Pressable>
            )}
            {showContactsLeftBanner(ctaCtx) && (
              <Text style={[s.contactsLeftText, { fontFamily: langFonts.regular }]}>{t('VIEWPROFILE.CONTACT_SEEN_INFO')}</Text>
            )}
          </LinearGradient>
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
        <Text style={[s.biodataCtaText, { fontFamily: langFonts.medium }]}>{t('BIO_DATA.BIODATA_DOWNLOAD_FREE')}</Text>
      </Pressable>
    )
  }

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
          showAddHoro={showAddHoro}
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
          onBack={() => handleBack()}
          onGoToPrev={goToPrev}
          onGoToNext={goToNext}
          onLanguagePress={() => setShowLanguageSheet(true)}
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

        {/* Angular: bottom-sheet.component's `action == 'paymentPromo'` block —
            the same real upgrade sheet Angular shows for Call/WhatsApp/Message. */}
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
          totalCount={contactDetails?.totalCount}
          showNotVerifiedNote={!!profile && !profile.isIdVerified && loginGender === 'F'}
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
        <WebPhotoInput inputRef={addPhoto.webInputRef} onChange={addPhoto.handleWebFiles} />
        <AddPhotoVerdictSheets addPhoto={addPhoto} />

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

        <LanguagePillSheet visible={showLanguageSheet} onClose={() => setShowLanguageSheet(false)} />

        <AppRatingModal
          visible={!!appRating.trigger}
          source={appRating.trigger?.source ?? '1'}
          onClose={appRating.close}
        />

        <Toast request={toastRequest} />
      </View>
    )
  }

  return (
    <Animated.View style={[s.screen, screenSlideStyle]}>
      <StatusBar style="dark" />

      {/* ── Header — a SEPARATE solid white bar above the photo (not floating over
          it) — confirmed against the real app's screenshots. Rest state: back +
          language pill. Once scrolled past the photo: back + Name + Call + language
          + a 3-dot report/don't-show menu. */}
      <View style={[s.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={s.headerBackBtn} onPress={() => handleBack()} hitSlop={8}>
          {/* 24x24, not 24x48 — arrow-back-activity.svg has a square 21x21 viewBox,
              and a 48-tall child inside this 42-tall box overflowed it. */}
          <CdnSvg uri={BACK_ICON_URI} width={24} height={24} />
        </Pressable>

        {scrolled && (
          <>
            <Text style={[s.headerName, { fontFamily: langFonts.medium }]} numberOfLines={1}>
              {ownProfile ? t('VIEWPROFILE.PROFILE_PREVIEW') : profile.name}
            </Text>
            {/* Angular viewprofile.page.html:41-58 — on scroll (topProfileName) the
                language dropdown is hidden (line 66: *ngIf="...&& !topProfileName")
                and the header instead carries Name, then Message, then Call.
                Angular: .width-height-18 (18x18, viewprofile.page.scss:22-25) with
                mr-16 on the message icon only — box sized exactly to the icon, no
                extra hit-area padding baked into the box itself (hitSlop covers
                that instead), so it can't visually wobble against Call/⋮. */}
            {!sameGender && (
              <>
                <Pressable style={s.headerIconBtnMsg} onPress={handleMessage} hitSlop={8}>
                  <MessageIcon width={18} height={18} />
                </Pressable>
                <Pressable style={s.headerIconBtn18} onPress={handleCall} hitSlop={8}>
                  <CallIcon width={18} height={18} />
                </Pressable>
              </>
            )}
          </>
        )}
        {!scrolled && (
          <>
            <View style={s.headerSpacer} />
            <Pressable
              style={s.langPill}
              onPress={() => setShowLanguageSheet(true)}
              hitSlop={8}
            >
              <CdnSvg uri={CDN_SVG + 'revamp/lang-change-img.svg'} width={20} height={20} />
              <Text style={[s.langPillText, { fontFamily: langFonts.medium }]} numberOfLines={1}>
                {LANG_LABELS[i18n.language] ?? 'English'}
              </Text>
            </Pressable>
          </>
        )}

        {/* Angular: viewprofile.page.html:75-81 — the 3-dot only shows alongside
            the scrolled header (topProfileName), and is an <ion-img> of
            dot3-revamp.svg, not a text glyph. Tapping it opens the report block
            (:1564-1568 -> button.component.html:80-98's ViewProfileThreeDotBtn),
            whose ONLY option is "Report this Profile" (MORE_OPT_2) with a
            report-profile icon beside it. There is no "Don't show" entry in
            Angular's 3-dot menu — that lives on the CTA row instead. */}
        {scrolled && !ownProfile && (
          <View>
            <Pressable style={s.headerIconBtn} onPress={() => setShowMenu(v => !v)} hitSlop={8}>
              <CdnSvg uri={MENU_DOTS_URI} width={24} height={24} />
            </Pressable>
            {showMenu && (
              <View style={s.menuDropdown}>
                <Pressable style={s.menuItem} onPress={handleReportProfile}>
                  <CdnSvg uri={REPORT_PROFILE_ICON_URI} width={20} height={20} />
                  <Text style={[s.menuItemText, { fontFamily: langFonts.regular }]}>{t('MATCHES.MORE_OPT_2')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Angular: download-biodata.component.html:26-50 — a single top-of-screen
          "some details are missing" banner, distinct from the per-section inline
          "Add X Details" prompts below. Figma (15156-14105): plain row, message
          left, "Add now" + chevron link right. */}
      {ownProfile && !!profile && !!getFirstMissingScreen(profile) && (
        <Pressable style={s.missingBanner} onPress={handleMissingDetailsPress}>
          <Text style={[s.missingBannerText, { fontFamily: langFonts.regular }]}>{t('BIO_DATA.MISSING_DETAILS_TXT')}</Text>
          <View style={s.missingBannerCta}>
            <Text style={[s.missingBannerCtaText, { fontFamily: langFonts.regular }]}>{t('BIO_DATA.ADD_NOW_TXT')}</Text>
            <CdnSvg uri={CDN_REACT + '/menu_right_arrow.svg'} width={16} height={16} />
          </View>
        </Pressable>
      )}

      <Animated.ScrollView
        ref={scrollViewRef}
        style={s.scrollView}
        onLayout={e => {
          viewportHeightShared.value = e.nativeEvent.layout.height
          refreshCta2Y()
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
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
          <GestureDetector gesture={themeSwipeGesture}>
            <View
              style={[
                s.photoBox,
                ownProfile && themes.length > 0 && { backgroundColor: themes[themeIndex]!.bgColor },
              ]}
            >
              {/* Feature 6 biodata theming — TOP_IMG sits behind the photo as a
                  decorative background, matching Angular's ion-img.TOP_IMG layered
                  under the profile photo/details block. */}
              {ownProfile && themes.length > 0 && (
                <Image
                  source={{ uri: themes[themeIndex]!.topImg }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  pointerEvents="none"
                />
              )}
              {ownProfile ? (
                // Angular's biodata page shows ONE static photo (getPhotoUrl()), never
                // a swipeable gallery — and PhotoSwiper's own horizontal pan would
                // fight the theme-swipe gesture on this exact surface (same conflict
                // class documented below for prev/next-profile navigation).
                profile.isPhotoAvailable && profile.photos.length > 0 && !heroPhotoFailed ? (
                  <Image
                    source={{ uri: profile.photos[0] }}
                    style={{ width: SCREEN_WIDTH, height: PHOTO_HEIGHT }}
                    contentFit="cover"
                    onError={() => setHeroPhotoFailed(true)}
                  />
                ) : profile.isPhotoAvailable && profile.photos.length > 0 && heroPhotoFailed ? (
                  // Native <Image> can't decode a remote .svg (see CdnSvg.tsx) —
                  // the fallback silhouette is one, so it needs CdnSvg. `cover`
                  // matches the real photo's own contentFit="cover" above.
                  <CdnSvg
                    uri={getAvatarFallbackUri(oppGender)}
                    width={SCREEN_WIDTH}
                    height={PHOTO_HEIGHT}
                    cover
                  />
                ) : (
                  <CdnImage uri={getBlurPhotoUri(oppGender)} width="100%" height={PHOTO_HEIGHT} resizeMode="cover" />
                )
              ) : profile.isPhotoAvailable && !profile.isPhotoProtect && profile.photos.length > 0 ? (
                <PhotoSwiper
                  key={profile.profileId}
                  images={profile.photos}
                  width={SCREEN_WIDTH}
                  height={PHOTO_HEIGHT}
                  oppGender={oppGender}
                  onPress={i => { setPhotoViewerIndex(i); setPhotoViewerOpen(true) }}
                />
              ) : (
                <View>
                  <CdnImage uri={getBlurPhotoUri(oppGender)} width="100%" height={PHOTO_HEIGHT} resizeMode="cover" />
                  {!sameGender && (
                    <View style={s.photoOverlay}>
                      <View style={s.overlayCard}>
                        <Text style={[s.overlayText, { fontFamily: langFonts.medium }]}>
                          {t('GENERAL.REQUEST_ADD_PHOTO_WHATSAPP').replace('#HER_HIS#', t(`PRONOUN.${oppGender}.hisher`))}
                        </Text>
                        <WhatsAppUnlockButton label={t('GENERAL.WHATSAPP')} onPress={handleWhatsApp} />
                      </View>
                    </View>
                  )}
                </View>
              )}
            {/* Angular: global.scss:4918-4928 `.top-slider-header-div .swiper-pagination`
                — only a 50px-tall gradient strip pinned to the BOTTOM of the photo
                (behind the pagination dots), not a full top+bottom overlay. The
                earlier Figma-derived full-bleed rgba(0,0,0,0.8) top+bottom gradient
                was darkening the whole photo, which Angular's plain hero image
                doesn't do — replaced with Angular's exact bottom-only gradient. */}
            <LinearGradient
              colors={['#00000005', '#000000c4']}
              style={s.photoBottomGradient}
              pointerEvents="none"
            />
            {profile.isNewlyJoined && !ownProfile && (
              <View style={s.newBadge} pointerEvents="none">
                <CdnSvg uri={NEWLY_JOINED_STAR_URI} width={14} height={14} />
                <Text style={[s.newBadgeText, { fontFamily: langFonts.medium }]}>{t('MATCHES.NEW')}</Text>
              </View>
            )}
          
            </View>
          </GestureDetector>
          {/* Feature 6 biodata theming — Angular's biodata-back-arrow-img/
              biodata-next-arrow-img, a tap alternative to the swipe gesture above.
              Only shown once themes have actually loaded (own-profile only). */}
          {ownProfile && themes.length > 1 && (
            <>
              <Pressable style={[s.profileArrowBtn, s.profileArrowLeft]} onPress={() => cycleTheme(-1)} hitSlop={8}>
                <Text style={s.profileArrowText}>{'‹'}</Text>
              </Pressable>
              <Pressable style={[s.profileArrowBtn, s.profileArrowRight]} onPress={() => cycleTheme(1)} hitSlop={8}>
                <Text style={s.profileArrowText}>{'›'}</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* ── Everything below the photo — Angular's swipe-to-navigate-profile
            gesture is live across this whole area (see detailSwipeGesture's own
            comment above for the exact Angular reference + exclusions). */}
        <GestureDetector gesture={detailSwipeGesture}>
        <View style={s.detailSwipeZone}>

        {/* ── Info card ──────────────────────────────────────────────────────── */}
        <View
          style={[
            s.infoCard,
            // Feature 6 biodata theming — Figma (15156-14157, "Rectangle 15753"):
            // a rounded white card floating with an 8px side margin, overlapping
            // up into the themed top image by the per-template amount above.
            // Angular's regular (non-biodata) view has neither — see infoCard's
            // own comment — so this only applies in ownProfile/biodata mode.
            ownProfile && themes.length > 0 && {
              marginTop: biodataThemeOverlapMargin(themes[themeIndex]!.value),
              marginHorizontal: 8, borderRadius: 16,
            },
          ]}
        >
          <View style={s.badgeRow}>
            {profile.isPaidMember && <ProfileBadge variant="paid" text={t('MENU.PAID_BADGE')} />}
            {profile.isIdVerified && loginGender === 'F' && (
              <ProfileBadge
                ref={verifiedBadgeRef}
                variant="verified"
                text={t('MATCHES.VERIFIED_ID')}
                style={s.verifiedBadgeSize}
                hasInfo
                onInfoPress={handleVerifiedInfoPress}
              />
            )}
          </View>

          {/* Angular: viewprofile.page.html:460-496 — Call/WhatsApp icon buttons sit
              inline beside the name (confirmed against a real screenshot; the earlier
              Figma-only "Contact details" card below was dead markup in Angular's own
              template — a comment with no content between it and Professional
              details — so it's been removed rather than kept as an extra copy). */}
          <View style={s.nameRow}>
            <Text style={[s.name, { fontFamily: langFonts.semiBold }]} numberOfLines={1}>{profile.name}</Text>
            {/* Confirmed live in the Angular app: the Message/Call/WhatsApp icons
                are hidden for as long as the Verified badge's info tooltip is open
                (the tooltip sits right below the badge, directly over this row). */}
            {!sameGender && !showVerifiedInfo && (
              <View style={s.nameIconsRow}>
                <Pressable style={s.nameIconBtn} onPress={handleMessage} hitSlop={8}>
                  <MessageIcon width={24} height={24} />
                </Pressable>
                <Pressable style={s.nameIconBtn} onPress={handleCall} hitSlop={8}>
                  <CallIcon width={24} height={24} />
                </Pressable>
                <Pressable style={s.nameIconBtn} onPress={handleWhatsApp} hitSlop={8}>
                  <WhatsAppIcon width={24} height={24} />
                </Pressable>
              </View>
            )}
          </View>
          <Text style={[s.jodiId, { fontFamily: langFonts.regular }]}>{t('VIEWPROFILE.ID')} : {profile.profileId}</Text>

          {/* !! coerces to a real boolean — the adapter's `?? undefined` doesn't
              catch a raw API value of "" (empty but present, not null/undefined),
              and `'' && <Text/>` evaluates to '' itself: a bare empty-string text
              node landing directly under this View, which is exactly what React
              Native Web's "Unexpected text node ... cannot be a child of a <View>"
              warning is about. Angular: viewprofile.page.html:448-458 also requires
              (!ownProfile || !sameGender) and LIKED ∈ {'0','5') — adapter's
              toLikedStatus() already clamps any raw '5' down to '0', so checking
              for '0' here covers both Angular states. */}
          {!!profile.likedMsg && (!ownProfile || !sameGender) && profile.likedStatus === '0' && (
            <Text style={[s.likedMsg, { fontFamily: langFonts.medium }]}>{profile.likedMsg}</Text>
          )}

          {/* The top CTA is NOT rendered inline here — Angular's copy of it is
              `position: sticky; bottom: 0`, so it rides pinned to the screen bottom
              through the whole detail-sections scroll instead of sitting inline
              right here. Rendered as a floating overlay below (see floatingCtaAnimStyle). */}

          {/* ── Basic details ────────────────────────────────────────────────── */}
          <SectionHeader title={t('VIEWPROFILE.BASIC_DETAILS')} />
          <DetailRow icon={ICON.createdFor} label={t('VIEWPROFILE.CREATEDFOR')} value={profile.profileFor} />
          <DetailRow icon={ICON.age} label={t('VIEWPROFILE.AGEIS')} value={profile.age ? `${profile.age} ${t('VIEWPROFILE.YEARS')}` : undefined} />
          <DetailRow icon={ICON.height} label={t('VIEWPROFILE.HEIGHT')} value={profile.height} />
          <DetailRow icon={ICON.maritalStatus} label={t('REG.MARITAL_STATUS')} value={profile.maritalStatus} />
          <DetailRow icon={ICON.children} label={t('VIEWPROFILE.NOOFCHILDREN')} value={profile.noOfChildren} />
          <DetailRow icon={ICON.physicalStatus} label={t('REG.PHYSICAL_STATUS')} value={profile.physicalStatus} />
          <DetailRow icon={ICON.motherTongue} label={t('VIEWPROFILE.MOTHERTONGUE')} value={profile.motherTongue} />
          {/* Angular: viewprofile.page.html:607-652 — up to three independent rows.
              When the NRI row shows, the city/state row's label switches to
              "Home location" instead of "Current location" (same field, different
              heading). The separate "Hometown" row only shows for mother-tongue
              codes in homePlaceDomain (e.g. Hindi) — unrelated to NRI status. */}
          <DetailRow icon={ICON.locationNRI} label={t('VIEWPROFILE.CURRENTLOCATION')} value={profile.nriLocation} />
          <DetailRow
            icon={ICON.location}
            label={profile.nriLocation ? t('VIEWPROFILE.HOME_LOCATION') : t('VIEWPROFILE.CURRENTLOCATION')}
            value={profile.cityStateLocation}
            isLast={!showHomeTownRow}
          />
          {showHomeTownRow && (
            <DetailRow icon={ICON.hometown} label={t('REG.REG_TITLE_44')} value={profile.homeLocation} isLast />
          )}

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
              {/* Angular: global.scss .like-this-profile — a soft cream/gold highlight
                  band (linear-gradient background + gradient border-image), not a
                  plain-text row. Reproduced as a LinearGradient background; RN has
                  no border-image equivalent so the gold edge is approximated with a
                  matching solid-color top+bottom border. */}
              {profile.hasStarMatchInputs && (
                ownEntryType === 'P' ? (
                  starMatch && (
                    <LinearGradient
                      colors={['rgba(255,255,255,0)', '#FFF9E6', 'rgba(255,255,255,0)']}
                      start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                      locations={[0, 0.5, 1]}
                      style={s.starMatchCard}
                    >
                      <CdnSvg uri={ICON.star} width={20} height={20} />
                      <Pressable style={s.starMatchTextWrap} onPress={handleViewStarMatchDetails}>
                        <Text style={[s.starMatchText, { fontFamily: langFonts.regular }]}>
                          <Text style={[s.starMatchRating, { fontFamily: langFonts.medium }]}>{starMatch.displayText}</Text>
                          {t('STARMATCHING.STAR_MATCHING_TXT')}
                        </Text>
                        <View style={s.starMatchLinkRow}>
                          <Text style={[s.starMatchTeaser, { fontFamily: langFonts.regular }]}>{t('VIEWPROFILE.PAID_MEMBER_REPORT')}</Text>
                          {/* Angular's plain <img> has no object-fit, so the
                              browser default (fill/stretch) applies — the
                              GIF's real native frame is a 1200x1200 SQUARE, and
                              RN Image's own default (resizeMode:'cover') would
                              crop it to fill this non-square box instead of
                              stretching, visibly zooming the arrow in. */}
                          <RNImage source={{ uri: LINK_ARROW_GIF_URI }} style={s.starMatchLinkArrow} resizeMode="stretch" />
                        </View>
                      </Pressable>
                    </LinearGradient>
                  )
                ) : (
                  <LinearGradient
                    colors={['rgba(255,255,255,0)', '#FFF9E6', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                    locations={[0, 0.5, 1]}
                    style={s.starMatchCard}
                  >
                    <CdnSvg uri={ICON.star} width={20} height={20} />
                    <Pressable style={s.starMatchTextWrap} onPress={() => navigation.navigate('recharge')}>
                      {/* Angular: .blur-text-vp-revamp — filter: blur(5px) on the
                          score for free (ENTRYTYPE 'F') members. */}
                      <Text style={[s.starMatchText, { fontFamily: langFonts.regular }]}>
                        <Text style={[s.starMatchBlurred, { fontFamily: langFonts.medium }]}>9/10</Text>{t('STARMATCHING.STAR_MATCHING_TXT')}
                      </Text>
                      <View style={s.starMatchLinkRow}>
                        <Text style={[s.starMatchTeaser, { fontFamily: langFonts.regular }]}>{t('VIEWPROFILE.FREE_MEMBER_REPORT')}</Text>
                        <RNImage source={{ uri: LINK_ARROW_GIF_URI }} style={s.starMatchLinkArrow} resizeMode="stretch" />
                      </View>
                    </Pressable>
                  </LinearGradient>
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
              to for that combination — confirmed dead/commented-out code).
              showAddHoro additionally hides the whole section for Muslim viewers
              (see the load effect's comment). */}
          {showAddHoro && profile.showHoroSection && !sameGender &&
           ((profile.horoscopeAvailable && loginHoroAvail === '1') || loginHoroAvail === '0') ? (
            <>
              <SectionHeader title={t('VIEWPROFILE.HORO_DETAILS')} />
              <View style={s.detailRow}>
                <View style={s.detailIconCol}>
                  <CdnSvg uri={ICON.horoscope} width={20} height={20} />
                </View>
                <View style={s.detailTextCol}>
                  <Text style={[s.detailLabel, { fontFamily: langFonts.regular }]}>{t('VIEWPROFILE.HOROSCOPE')}</Text>
                  {loginHoroAvail === '0' ? (
                    <>
                      <Text style={[s.detailValue, { fontFamily: langFonts.medium }]}>
                        {t('VIEWPROFILE.ADDYOURHORO').replace('#HIMHER#', t(`PRONOUN.${oppGender}.himhers`))}
                      </Text>
                      <Pressable onPress={handleAddHoroscope}>
                        <Text style={[s.horoActionLink, { fontFamily: langFonts.regular }]}>{t('GENERAL.ADD_HOROSCOPE')}</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable onPress={handleViewHoroscope}>
                      <Text style={[s.horoActionLink, { fontFamily: langFonts.regular }]}>{t('GENERAL.VIEW_HOROSCOPE')}</Text>
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
                <Text style={[s.addDetailPromptText, { fontFamily: langFonts.medium }]}>{t('GENERAL.ADD_HOROSCOPE')}</Text>
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
                <Text style={[s.addDetailPromptText, { fontFamily: langFonts.medium }]}>{t('GENERAL.ADD_FAMILY_DETAILS')}</Text>
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
                <Text style={[s.addDetailPromptText, { fontFamily: langFonts.medium }]}>{t('BIO_DATA.ADD_PROPERTY_DETAILS')}</Text>
              </Pressable>
            </>
          )}

          {/* Feature 6 biodata QR — Angular: download-biodata.component.html:451-463.
              A server-rendered QR image (not client-drawn, unlike the payment QR
              feature), letting someone scan it to view this profile publicly. */}
          {ownProfile && !!biodataQrUrl && (
            <View style={s.biodataQrSection}>
              <Image source={{ uri: biodataQrUrl }} style={s.biodataQrImage} contentFit="contain" />
              <Text style={[s.biodataQrCaption, { fontFamily: langFonts.medium }]}>
                {t('BIO_DATA.QR_CODE_TXT').replace('#HISHER#', t(`PRONOUN.${loginGender}.hisher`))}
              </Text>
            </View>
          )}
        </View>

        {/* Second CTA — Angular repeats this exact block right after Property
            details, before Similar Profiles (confirmed against real screenshots).
            ref+onLayout feed refreshCta2Y, which decides when the floating
            top CTA above should hand off to this one — see its own comment. */}
        <View
          ref={cta2Ref}
          style={[s.ctaBlockOuter, !ownProfile && showAfterLikeCTA(profile.likedStatus) && s.ctaHostFlush]}
          onLayout={refreshCta2Y}
        >
          {ownProfile ? renderBiodataCta() : renderCtaBlock()}
        </View>

        </View>
        </GestureDetector>

        {/* ── Below here is OUTSIDE the prev/next-profile swipe zone, on purpose:
            the carousel below owns its own horizontal gesture and the pan would
            swallow it (see detailSwipeGesture's comment). ─────────────────────── */}

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
            <Text style={[s.similarHeader, { fontFamily: langFonts.semiBold }]}>
              {t('VIEWPROFILE.SIMILARPROFILES').replace('#NAME#', profile.name)}
            </Text>
            <FlatList
              ref={similarListRef}
              data={similarProfiles}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={SIMILAR_CARD_STRIDE}
              decelerationRate="fast"
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
          </LinearGradient>
        )}

        {/* ── "Become a paid member" promo — Angular: app-breather BANNERSLOT 1001,
            same component/data source Matches already uses (MembershipBanner). */}
        {!sameGender && menuPromo?.MATCHESSLOT && (
          <MembershipBanner data={menuPromo.MATCHESSLOT} onPress={handleMembershipBannerPress} />
        )}
      </Animated.ScrollView>

      {/* Prev/next-PROFILE arrows — a screen-fixed overlay (sibling of the
          ScrollView, not content inside it) so they stay put at a constant
          screen position instead of scrolling away with the photo, per a
          manual UI tweak. Positioned to land where they did as in-flow content
          (insets.top + HEADER_FIXED_HEIGHT mirrors the header bar's own height
          math; -35 is the same "moved up a bit" offset from before). */}
      {hasPrevProfile && (
        <Pressable
          style={[s.profileNavBtn, s.profileNavLeft, { top: insets.top + HEADER_FIXED_HEIGHT + PHOTO_HEIGHT - 35 }]}
          onPress={goToPrev}
          hitSlop={8}
        >
          <CdnSvg uri={PROFILE_NAV_LEFT_ARROW_URI} width={PROFILE_NAV_ARROW_WIDTH} height={PROFILE_NAV_ARROW_HEIGHT} />
        </Pressable>
      )}
      {hasNextProfile && (
        <Pressable
          style={[s.profileNavBtn, s.profileNavRight, { top: insets.top + HEADER_FIXED_HEIGHT + PHOTO_HEIGHT - 35 }]}
          onPress={goToNext}
          hitSlop={8}
        >
          <CdnSvg uri={PROFILE_NAV_RIGHT_ARROW_URI} width={PROFILE_NAV_ARROW_WIDTH} height={PROFILE_NAV_ARROW_HEIGHT} />
        </Pressable>
      )}

      {/* Floating top CTA — see cta2Y/floatingCtaAnimStyle's own comment above
          for why this exists and why the hand-off is worklet-driven. Always
          mounted (no conditional unmount) — opacity alone drives visibility,
          so there's no mount/unmount pop and no gap between the two CTAs. */}
      <Animated.View
        style={[
          s.floatingCtaBar,
          { paddingBottom: 12 + insets.bottom },
          !ownProfile && showAfterLikeCTA(profile.likedStatus) && s.ctaHostFlush,
          floatingCtaAnimStyle,
        ]}
        pointerEvents={cta2Visible ? 'none' : 'auto'}
      >
        {renderCtaBlock()}
      </Animated.View>

      {activeSticky && (
        <StickyBanner
          text={activeSticky.content}
          ctaLabel={activeSticky.ctaLabel}
          onPress={handleStickyPress}
          onClose={() => setStickyDismissed(true)}
          countdownDeadlineMs={activeSticky.deadlineMs}
        />
      )}

      {/* Angular: bottom-sheet.component's `action == 'paymentPromo'` block —
          the same real upgrade sheet Angular shows for Call/WhatsApp/Message. */}
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
        totalCount={contactDetails?.totalCount}
        showNotVerifiedNote={!!profile && !profile.isIdVerified && loginGender === 'F'}
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
      <WebPhotoInput inputRef={addPhoto.webInputRef} onChange={addPhoto.handleWebFiles} />
      <AddPhotoVerdictSheets addPhoto={addPhoto} />
      {/* Angular: viewprofile.page.ts's presentPopover() — Verified badge info tap.
          content is API-supplied (PERSONALINFO.IDDET.BODY), no fallback text in
          Angular either, so an empty/missing verifiedInfoText just shows an empty
          tooltip rather than fabricating copy. Angular auto-dismisses after 5s;
          this also allows a manual tap-outside close via Popover's own backdrop. */}
      <Popover
        visible={showVerifiedInfo}
        type="verifiedPopup"
        content={profile.verifiedInfoText}
        anchor={verifiedInfoAnchor ?? undefined}
        onClose={() => setShowVerifiedInfo(false)}
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

      <LanguagePillSheet visible={showLanguageSheet} onClose={() => setShowLanguageSheet(false)} />

      <PhotoViewerModal
        visible={!!horoscopeImageUrl}
        images={horoscopeImageUrl ? [horoscopeImageUrl] : []}
        initialIndex={0}
        onClose={() => setHoroscopeImageUrl(null)}
      />

      <HoroscopeSvgViewerModal
        visible={!!horoscopeSvgUrl}
        uri={horoscopeSvgUrl}
        onClose={() => setHoroscopeSvgUrl(null)}
      />

      <AppRatingModal
        visible={!!appRating.trigger}
        source={appRating.trigger?.source ?? '1'}
        onClose={appRating.close}
      />

      <Toast request={toastRequest} />
    </Animated.View>
  )
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: Colors.background },
  loaderScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: Colors.background },
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  notFoundText: { fontWeight: '500', fontSize: FontSize.font14, color: Colors.textSecondary },
  backBtnInline:     { paddingHorizontal: 16, paddingVertical: 8 },
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  backBtnInlineText: { fontWeight: '500', fontSize: FontSize.font14, color: Colors.link },

  scrollView:    { flex: 1 },
  scrollContent: {},
  // Purely a gesture-handler boundary (see detailSwipeGesture) — no layout
  // properties of its own so it doesn't affect the content flow it wraps.
  detailSwipeZone: {},

  // photoWrap used to be the positioning ancestor for the prev/next-profile
  // arrows too — they've since moved to a screen-fixed overlay (a ScrollView
  // sibling, see the JSX render site) so they stay put while scrolling, per a
  // manual UI tweak, instead of being absolutely positioned within this box.
  // zIndex here still matters on web for other overlapping content (badges,
  // coach mark): photoWrap and infoCard are siblings, and infoCard has no
  // positioning of its own, so without this its opaque background would paint
  // over anything overlapping past photoBox's height. Native isn't affected either way.
  photoWrap: { position: 'relative', zIndex: 1 },
  // Flat, full-bleed square — Angular has no border-radius on this photo (unlike
  // the rounded Matches-card photo), confirmed against viewprofile.page.scss.
  photoBox: { width: SCREEN_WIDTH, height: PHOTO_HEIGHT, backgroundColor: Colors.divider },
  newBadge: {
    position: 'absolute', top: 0, left: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryDark, height: 24,
    paddingLeft: 8, paddingRight: 12, borderBottomRightRadius: 10, gap: 4,
  },
  // Angular: badge.component.html — .textcta-medium-12 (font12, Poppins-Medium,
  // weight 500) — NOT Regular/400. fontFamily applied inline (langFonts.medium).
  newBadgeText: { fontWeight: '500', fontSize: FontSize.font12, color: Colors.white },
  // Feature 2 prev/next-profile chevrons — same dark-circle/white-chevron style
  // as PhotoSwiper's own desktop arrow fallback (matchesCard.shared.tsx). Angular:
  // viewprofile.page.scss:512,523 `top: calc(100vw + 32px)` — just below the square
  // (100vw-tall) photo, not overlaid on it (confirmed: these are the prev/next-
  // PROFILE arrows, a separate sibling element from the photo swiper's own arrows).
  profileArrowBtn: {
    position: 'absolute', top: PHOTO_HEIGHT - 32,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  profileArrowLeft:  { left: 8 },
  profileArrowRight: { right: 8 },
  profileArrowText: { color: Colors.white, fontSize: FontSize.font20, lineHeight: 20 },
  // Feature 2 prev/next-PROFILE arrows — Angular renders these as image assets,
  // not a CSS circle: vp-revamp-left-arw.svg / vp-revamp-right-arw.svg, a dark
  // (#333) half-pill flush against the screen edge with a white chevron baked
  // into the graphic (viewprofile.page.scss:497-520, `margin-left/right: -26px`
  // bleeds it off the edge). Kept as its own style (not reusing profileArrowBtn
  // above, which is the unrelated own-profile theme-cycle control) so this one
  // change doesn't affect that other feature.
  // Moved up from the photo's bottom edge per a manual UI tweak (was PHOTO_HEIGHT,
  // on top of the Angular-matched 32px-below placement). `top` is no longer set
  // here — now a screen-fixed overlay (see the ScrollView-sibling render site),
  // so its `top` is computed inline there (insets.top + HEADER_FIXED_HEIGHT +
  // PHOTO_HEIGHT - 35) instead of being relative to photoWrap.
  profileNavBtn: {
    position: 'absolute',
    width: PROFILE_NAV_ARROW_WIDTH, height: PROFILE_NAV_ARROW_HEIGHT,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  profileNavLeft:  { left: 0 },
  profileNavRight: { right: 0 },
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
    alignItems: 'center', gap: 12, maxWidth: '70%',
  },
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  coachMarkText: {
    fontWeight: '400', fontSize: FontSize.font14, color: Colors.black, textAlign: 'center',
  },
  // fontFamily applied inline (langFonts.semiBold) — see Text usage.
  coachMarkDismiss: {
    fontWeight: '600', fontSize: FontSize.font14, color: Colors.primaryDark,
  },
  photoOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center',
  },
  // Angular: global.scss:4918-4928 — 50px-tall gradient strip pinned to the
  // bottom of the photo, behind the swiper pagination dots.
  photoBottomGradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 50,
  },
  // Angular: `.request-photo-vp` — margin 24 each side, padding 8px 16px, 12px
  // radius, 1px rgba(255,255,255,0.4) border. The margin here is 34, NOT that 24:
  // measured against the reference screen (badge 258 wide against 296 for the
  // 24px version, at a scale confirmed by both shots rendering the same 29px-tall
  // button), 24 comes out visibly wider and the caption wraps a word later than
  // the design. Angular's own rule also sets `width: 100%` ON TOP of those
  // margins, which overflows its parent — so what that CSS computes and what the
  // app ships are not the same box, and this follows the shipped one.
  //
  // alignSelf 'stretch' is what makes those margins mean anything: photoOverlay
  // centres its child, so without it this box is sized by its CONTENT and the
  // margins never bind — and overlayText's `width: '70%'` then resolves against
  // an auto-width parent, letting the box grow wider than the margins allow
  // (measured 295px against the reference's 257 at the same scale). Stretching
  // pins it to photo width - 48, and the 70% text gets a definite parent to
  // measure against.
  overlayCard: {
    alignSelf: 'stretch',
    backgroundColor: Colors.scrimStrong, marginHorizontal: 34, padding: 16,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.overlayBorder,
    alignItems: 'center', gap: 16,
  },
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  overlayText: {
    fontWeight: '500', fontSize: FontSize.font13, color: Colors.white,
    textAlign: 'center', lineHeight: 17, width: '70%', alignSelf: 'center',
  },

  // Angular: .details-section { background:#fff } — plain white, flush against the
  // photo, no radius/negative-margin "floating card" effect and no elevation/shadow.
  infoCard: {
    backgroundColor:   Colors.surface,
    paddingHorizontal: 24,
    paddingTop:        24,
    paddingBottom:     8,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  // Pinned to an exact 116x28 per a manual UI tweak — ProfileBadge is shared
  // (also used by MatchesScreen etc.), so this overrides size only here via its
  // optional `style` prop rather than changing the shared component's default.
  // paddingVertical/minHeight: 0 zero out badgeStyles.pill's own paddingVertical:4
  // + minHeight:24 (still merged in ahead of this). overflow: 'hidden' is the
  // hard guarantee — badgeStyles.icon is a 24px-tall absolutely-positioned CdnSvg
  // pinned at top:0 with no height clamp of its own, so without clipping it (and
  // the text's own line-height) can still visually poke past an explicit 28px box.
  verifiedBadgeSize: {
    width: 116, height: 28, minHeight: 0, paddingVertical: 0,
    justifyContent: 'center', 
  },

  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Angular: viewprofile.page.html:489 — heading1-semibold-22 black-color (font22,
  // NOT 24).
  // fontFamily applied inline (langFonts.semiBold) — see Text usage.
  name:    { flex: 1, fontWeight: '600', fontSize: FontSize.font22, color: Colors.black },
  // Angular: body2-regular-14 black-color — fontFamily applied inline (langFonts.regular).
  jodiId:  { fontWeight: '400', fontSize: FontSize.font14, color: Colors.black, marginTop: 4, marginBottom: 18 },
  // Angular: viewprofile.page.html:479 — .black-color body1-medium-14 (font14,
  // Poppins-Medium/weight 500, pure black) — NOT likedStripText pink/Regular/12.
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  likedMsg: { fontWeight: '500', fontSize: FontSize.font14, color: Colors.black, marginTop: 6 },

  // Angular: viewprofile.page.html:469-489 — Call/WhatsApp icon buttons beside the name.
  // Angular: viewprofile.page.html:489-515 — the three icon columns are
  // `size="1.2"/"1.3"` with `offset="0.5"` between them: half a grid column,
  // ~12px at phone widths, NOT the 32 this had. Same 12 the matches card
  // (MatchesScreen.tsx nameRow) already uses for the identical icon trio.
  nameIconsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameIconBtn: { alignItems: 'center', justifyContent: 'center' },

  // Angular: .button-banner — regular inline content (NOT position:fixed/sticky —
  // confirmed against real screenshots showing more content, incl. a second copy of
  // this exact block, both above and below it in the normal scroll flow).
  ctaBlock: { marginTop: 16 },
  // See the after-like band's comment in renderCtaBlock().
  ctaBlockFlush: { marginTop: 0 },
  ctaHostFlush:  { paddingTop: 0 },
  // Second CTA's own wrapper — matches infoCard's horizontal padding since it now
  // sits outside infoCard (see the onLayout comment at its call site). Angular:
  // .sticky-btm { background: #ffffff } — an explicit opaque white card, always
  // present, isolating this row from the greenish .similar-profile-bg gradient
  // section immediately below it. Without this, the gradient shows through here.
  // .button-banner (applied to both CTA instances) also carries its own drop
  // shadow — same values as floatingCtaBar's below.
  ctaBlockOuter: {
    paddingHorizontal: 24, paddingVertical: 16, backgroundColor: Colors.surface,
    shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  // Floating top-CTA overlay — Angular: .sticky-btm { position:sticky; bottom:0;
  // background:#fff }, .button-banner's shadow. Pinned to the screen bottom, opacity
  // driven by floatingCtaAnimStyle (a worklet) rather than true CSS position:sticky
  // (no RN equivalent for "sticky within a scroll region until the next in-flow
  // sticky candidate arrives").
  // Angular: .button-banner (co-applied with .sticky-btm on the same element —
  // global.scss:5033-5055) — box-shadow: 0px 4px 24px 0px rgba(0,0,0,0.25). A
  // downward, all-around soft shadow (24px blur bleeds visibly on top too, not
  // an upward-only shadow) — NOT height:-4 as this had before. .sticky-btm
  // itself contributes no shadow/border of its own, just position+background.
  floatingCtaBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.surface, paddingHorizontal: 24, paddingTop: 12,
    shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 4 },
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
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  //
  // These three labels sit in a `flexDirection:'row'` + `alignItems:'center'`
  // button beside a 24x24 icon, so what gets centred is the Text's LINE BOX, not
  // the glyphs inside it. With no explicit lineHeight, RN sizes that box from the
  // font's own ascent/descent — and on Android adds includeFontPadding space on
  // top — both asymmetric, so the label sat visibly lower than the icon it was
  // meant to line up with. MatchesScreen's identical CTA row already carries this
  // fix (ctaDontShowText/ctaViewLaterText/ctaLikeText there); this one was left
  // behind, which is the whole difference between the two screens.
  //
  // lineHeight 20 is the 14px body line-height used throughout this port
  // (Angular's .line-height-20), includeFontPadding:false drops Android's extra
  // metric padding, textAlignVertical centres the glyphs in what remains. The
  // bare fontWeight goes with it: the family comes from langFonts, and naming a
  // weight on top of it only invites a synthetic one.
  ctaDontShowText: { fontSize: FontSize.font14, color: '#545454', lineHeight: 20, includeFontPadding: false, textAlignVertical: 'center' as const },
  ctaViewLater: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: '#545454', borderRadius: 8,
  },
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  ctaViewLaterText: { fontSize: FontSize.font14, color: '#545454', lineHeight: 20, includeFontPadding: false, textAlignVertical: 'center' as const },
  // Angular: button-revamp.component.scss:13-21 — `ion-button[disabled]` only
  // overrides background (#e6e6e6) and text (#8A8A8A) via `--background`/
  // `--color`, `opacity: unset !important` (explicitly NOT dimmed) — the
  // greyBorder class's own #545454 1px border (setButtonBorder mixin) is left
  // untouched, so the border still shows on a disabled button, same as enabled.
  ctaDisabled: { backgroundColor: '#e6e6e6' },
  ctaDisabledText: { color: '#8A8A8A' },
  ctaLike: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryDark, borderRadius: 8, gap: 6,
  },
  // fontFamily applied inline (langFonts.semiBold) — see Text usage.
  ctaLikeText: { fontSize: FontSize.font14, color: Colors.white, lineHeight: 20, includeFontPadding: false, textAlignVertical: 'center' as const },

  // JODII-499 message CTA — same box as MatchesScreen's ctaMessage: outlined in
  // brand red on white, 44 high, and Angular's `ion-icon.large { margin-right:
  // 3px }` gap between the 24x24 icon and its label.
  //
  // No marginTop here, unlike the matches card's copy of this style: Angular's
  // `mt-12` is already supplied by afterLikeBand's own `gap: 12`, so adding it
  // again put 24px between the two buttons.
  ctaMessage: {
    flexDirection:   'row',
    height:          44,
    backgroundColor: Colors.white,
    borderWidth:     1,
    borderColor:     Colors.primaryDark,
    borderRadius:    8,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             3,
  },
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  ctaMessageText: { fontSize: FontSize.font14, color: Colors.primaryDark },

  // Feature 6 — same pill styling as ctaLike, standing in for the normal
  // Like/Contact CTA when viewing your own profile.
  biodataCta: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryDark, borderRadius: 8, marginTop: 16,
  },
  // Angular: download-biodata.component.html:1304 — .body1-medium-14 white-color
  // (Poppins-Medium, weight 500) — NOT SemiBold/600.
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  biodataCtaText: { fontWeight: '500', fontSize: FontSize.font14, color: Colors.white },

  // Angular: `.bottom-cta-bg` — a full-bleed band, so it has to escape the 24px
  // horizontal padding every host of renderCtaBlock() applies (ctaBlockOuter,
  // floatingCtaBar, and PhotoViewerModal's own footer all use the same 24).
  // Its own insets are Angular's: pl-16/pr-16 around the button, mt-12 above
  // the content line.
  afterLikeBand: {
    marginHorizontal: -24, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 12,
  },
  afterLikeBandTopLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  // Angular: `body1-medium-14 black-color text-align-center` — 14px Medium,
  // centred on its own line (font13 + flex:1 was the side-by-side row layout).
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  afterLikeText:   { fontWeight: '500', fontSize: FontSize.font14, color: Colors.black, textAlign: 'center' },
  // Full width now (Angular `hasFullWidth`) — the Pressable inside stretches to
  // this wrapper, which the freeBadge still anchors to.
  ctaSendInterestWrap: { position: 'relative' },
  ctaSendInterest: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, backgroundColor: Colors.primaryDark, borderRadius: 8, paddingHorizontal: 16,
  },
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  ctaSendInterestText: { fontWeight: '400', fontSize: FontSize.font14, color: Colors.white },
  freeBadge: {
    position: 'absolute', top: -10, right: 8, zIndex: 1,
    backgroundColor: Colors.badgeNewBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  // Angular: viewprofile.page.html:392 — `.free textcta-medium-12 black-color`
  // (font12, Poppins-Medium/weight 500, pure black) — NOT SemiBold/10px/badgeNewText-green.
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  freeBadgeText: { fontWeight: '500', fontSize: FontSize.font12, color: Colors.black },
  // Angular: viewprofile.page.html:428 — `.body3-regular-12 black-color` (font12,
  // Regular, pure black) — NOT font11/textSecondary-grey.
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  contactsLeftText: {
    fontWeight: '400', fontSize: FontSize.font12, color: Colors.black, textAlign: 'center', marginTop: 8,
  },

  // Angular: heading1-semibold-20 line-height-16 black-color, mt-24 mb-4 (every
  // section header in viewprofile.page.html uses this identical class combo).
  // fontFamily applied inline (langFonts.semiBold) — see Text usage.
  //
  // The lineHeight deliberately does NOT follow Angular's 16 — a 20px heading in
  // a 16px line box. In CSS that is harmless: the glyph simply
  // overflows its line box and still paints in full. React Native does NOT
  // behave that way — on Android a lineHeight below the font's natural height
  // CLIPS the glyph, which cut the descenders off every section heading
  // ("Horoscope details", "Life style details", "Family details" all lost the
  // bottom of their p/y). Copying the CSS number across was the mistake; 26
  // (1.3x) is the smallest leading that clears Poppins' descender at font20.
  sectionHeader: {
    fontWeight: '600', fontSize: FontSize.font20, lineHeight: 26, color: Colors.black,
    marginTop: 24, marginBottom: 4,
  },
  // Angular: icon column (ion-col size="1") + text column (size="11", pl-12) —
  // label directly above value (not side-by-side), pt-20/pb-20 vertical padding,
  // border-bottom rgba(204,204,204,0.5) on every row except a section's last.
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 20 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(204,204,204,0.5)' },
  detailIconCol: { width: 20, flexShrink: 0 },
  detailTextCol: { flex: 1, paddingLeft: 12 },
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  detailLabel: { fontWeight: '400', fontSize: FontSize.font14, color: Colors.black },
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  detailValue: { fontWeight: '500', fontSize: FontSize.font14, color: Colors.black, marginTop: 8 },

  // Angular: .like-this-profile — border-image linear-gradient(transparent →
  // rgb(255,192,0) 50% → transparent); RN has no border-image, approximated with
  // a solid gold top+bottom border matching the gradient's peak color.
  starMatchCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 20, paddingHorizontal: 4,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,192,0,0.4)',
  },
  starMatchTextWrap: { flex: 1 },
  // Angular: viewprofile.page.html:813 — the sentence wrapper is `.body2-regular-14
  // black-color` (font14, Regular, pure black) — NOT font13/textDark. Only the
  // rating number itself ("4.5/10") is medium weight (.body1-medium-14 —
  // "medium", not semibold, despite the visual boldness).
  // .body2-regular-14 on the "View details"/"Pay now..." link (app-button-revamp's
  // default ctaFontSize) — also font14/regular, not font13.
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  starMatchText:   { fontWeight: '400', fontSize: FontSize.font14, color: Colors.black },
  // Angular: .body1-medium-14 — Poppins-Medium/weight 500, NOT SemiBold/600.
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  starMatchRating: { fontWeight: '500' },
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  starMatchTeaser: { fontWeight: '400', fontSize: FontSize.font14, color: Colors.link },
  starMatchLinkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  // Angular: button-revamp.component.html:15 — style="width: 24px; height: 20px".
  starMatchLinkArrow: { width: 18, height: 18 },
  // Angular: .blur-text-vp-revamp — filter: blur(5px) on the teaser score for
  // free members. RN's Text has no blur filter; textShadow is the closest
  // visual approximation available without a native blur-view dependency.
  // Same weight as starMatchRating (medium, not semibold) — this is that same
  // score text, just for the free-member (blurred) branch.
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  starMatchBlurred: {
    fontWeight: '500',
    color: 'transparent',
    textShadowColor: '#333333', textShadowRadius: 5, textShadowOffset: { width: 0, height: 0 },
  },

  // fontFamily applied inline (langFonts.regular) — see Text usage.
  horoActionLink:    { fontWeight: '400', fontSize: FontSize.font14, color: Colors.link, marginTop: 8 },
  // Feature 6 — own-profile "add missing section" prompts, replacing a section
  // that would otherwise render nothing when its data is empty.
  addDetailPrompt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  addDetailPromptText: { fontWeight: '500', fontSize: FontSize.font14, color: Colors.link },

  biodataQrSection: { alignItems: 'center', paddingTop: 24, gap: 16 },
  biodataQrImage: { width: 160, height: 160 },
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  biodataQrCaption: {
    fontWeight: '500', fontSize: FontSize.font12, color: '#1a1818', textAlign: 'center',
  },

  // Angular: app-swiper.component.html:2 — `ion-row class="pt-32 ... pb-24"` — header
  // text aligned with the rest of the padded content, but the card row itself bleeds
  // to the screen edges.
  similarSection: { paddingTop: 32, paddingBottom: 24 },
  // Angular: app-swiper.component.html:24 — `.heading2-semibold-18 line-height-24`
  // — NOT heading1-semibold-20 (this is a different, smaller heading class than
  // the in-page section headers above).
  // fontFamily applied inline (langFonts.semiBold) — see Text usage.
  similarHeader: {
    fontWeight: '600', fontSize: FontSize.font18, lineHeight: 24, color: Colors.black,
    marginBottom: 10, paddingHorizontal: 24,
  },
  // paddingVertical gives each card's shadow (shadowRadius:12, extends above AND
  // below the card bounds) room to render — with zero top padding the FlatList's
  // content box hugged the cards' exact height, squeezing/clipping the shadow at
  // the very top edge and making the rounded top corner look cut off.
  similarListContent: { paddingHorizontal: 24, paddingVertical: 12, gap: SIMILAR_CARD_GAP },
  // Angular: profile-card.component.scss's `.card-ht2` (vmin-based, equal
  // width/height) — a SQUARE card, not the 140x180 rectangle this used to be.
  // Angular: .card-type-1 — box-shadow: 0 2px 12px 0 rgba(0,0,0,0.34)
  // (profile-card.component.scss:1-13). This outer wrapper carries ONLY the
  // shadow (no background, no overflow:hidden — clipping would also clip the
  // shadow itself) so it can't spill a visible box into the inter-card gap;
  // similarCardClip below is the one that's actually opaque + rounded + clipped.
  similarCard: {
    width: SIMILAR_CARD_WIDTH, height: SIMILAR_CARD_WIDTH, borderRadius: 12,
    // Matches similarCardClip's own fill — closes the rounded-corner seam where
    // the section's mint gradient background was showing through between this
    // wrapper's square bounds and the clipped child's rounded ones.
    backgroundColor: Colors.divider,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 12,
    elevation: 6,
  },
  similarCardClip: {
    flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.divider,
  },
  similarCardImg: { width: '100%', height: '100%' },
  // Angular: .request-photo-now-vp — transparent, full-bleed, flex-centered
  // wrapper only (no background of its own).
  similarCardOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center',
  },
  // Angular: .request-photo-vp — the actual visible badge, inset 24px from each
  // side, dark translucent background, thin light border, compact/content-sized
  // (not edge-to-edge).
  similarCardOverlayBadge: {
    alignSelf: 'stretch', marginHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12,
    // Angular: `padding: 8px 16px 8px 16px` (photo-request.component.scss:11).
    // A later hand-tweak re-declared paddingLeft/Right as 12, which in RN wins
    // over the shorthand above it — 4px wider content on each side, so the
    // WhatsApp button stretched and the caption fell from three lines to two.
    paddingHorizontal: 16, paddingVertical: 8, gap: 8,
    alignItems: 'center',
    // Angular: `border: 1px solid rgba(255, 255, 255, 0.4)` — missing here, so
    // the badge had no edge against the blurred photo behind it.
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  // Angular: photo-request.component.ts's getFontSize() resolves to
  // EButtonFontSize.semibold12 = 'textcta-medium-12' for this exact context
  // (whatsAppAddPhotoRequestFlag + variant 'similarprofiles' + fromPage
  // 'viewprofile') — font12, Poppins-MEDIUM/weight 500 (the enum's "semibold"
  // name is misleading; the class itself is medium), NOT font11/Regular. No
  // line-height class exists on this text in Angular, so none is set here.
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  similarCardOverlayText: {
    fontWeight: '500', fontSize: FontSize.font12, color: Colors.white, textAlign: 'center',
  },
  similarCardWaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 6, height: 32, width: '100%',
  },
  // Angular: photo-request.component.ts's setCTAFontSize() resolves to
  // EButtonFontSize.regular12 = 'body3-regular-12' for this same context —
  // font12, Poppins-REGULAR/weight 400, NOT Medium/500.
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  similarCardWaBtnText: { fontWeight: '400', fontSize: FontSize.font12, color: Colors.white },
  // Angular: profile-card.component.scss's .information-block — a top-to-bottom
  // black scrim (transparent → solid black), 16px vertical/12px horizontal padding,
  // bottom corners rounded to match the card. Not a flat semi-transparent overlay.
  similarCardCaption: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 12, paddingVertical: 16,
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
  },
  // Angular: profile-card.component.html:16 — .heading3-semibold-16 (Poppins-
  // Semibold, font16, white) — NOT font18.
  // fontFamily applied inline (langFonts.semiBold) — see Text usage.
  similarCardName: { fontWeight: '600', fontSize: FontSize.font16, color: Colors.white },
  // Angular: profile-card.component.html:21 — .body2-regular-14 (Poppins-Regular,
  // font14, white), no margin from name — NOT font16.
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  similarCardMeta: { fontWeight: '400', fontSize: FontSize.font14, color: Colors.white, paddingRight: 50 },

  // Header — a SEPARATE solid white bar in normal flow above the photo (never
  // overlaying it) — confirmed against the real app's screenshots. Content swaps
  // (back+language only, vs. back+Name+Call+language+3-dot) once scrolled.
  headerBar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    // Angular viewprofile.page.html:3 — the header row is `pl-2 pr-16`, i.e. 2px
    // on the left, not 16. A symmetric 16 pushed the back arrow 14px inboard of
    // where the old app puts it, so it no longer lined up with the name beside it
    // (or with the back arrow on every other screen).
    paddingLeft: 2, paddingRight: 16, paddingBottom: 10,
    // The 3-dot's dropdown is absolutely positioned at top:34 — i.e. it hangs
    // BELOW this bar, over the ScrollView that follows it as a sibling. Later
    // siblings paint on top by default, and photoWrap inside that ScrollView
    // carries zIndex:1 of its own, so without lifting the whole header above
    // the content the dropdown rendered behind the photo and looked like the
    // menu simply wasn't opening. elevation covers the same case on Android,
    // where zIndex alone doesn't govern paint order.
    zIndex: 20, elevation: 20,
  },
  missingBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.selectionBg, paddingHorizontal: 16, paddingVertical: 12,
  },
  // Angular: download-biodata.component.html:32 — `.body3-regular-12 color-333333`
  // — NOT #1e1e1e.
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  missingBannerText: {
    flex: 1, marginRight: 12, fontSize: FontSize.font12,
    color: '#333333', letterSpacing: 0.24,
  },
  missingBannerCta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  missingBannerCtaText: { fontSize: FontSize.font12, color: Colors.link },

  // Angular: ion-back-button .default-back — --icon-font-size: 24px. Pinned to
  // an exact 48x48 per a manual UI tweak, then trimmed to 42x42 to bring the
  // header bar's overall height down from ~66px to ~60px.
  headerBackBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { flex: 1 },
  // Angular: `.vp-profile-name` (global.scss:22281-22285) — font16, Poppins-Medium,
  // `--gray-color1` (#1f1e1b) — not SemiBold/pure-black, and NOT font18.
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  // lineHeight 30 is Angular's own `.one-lines-vp-header` (global.scss:9975-9983).
  // includeFontPadding:false matters on Android: the default extra font padding is
  // asymmetric, so the name sat a couple of px below the vertically-centred back
  // arrow beside it even though the row is `alignItems:'center'`.
  headerName: {
    flex: 1, fontWeight: '500', fontSize: FontSize.font16, color: '#1f1e1b',
    lineHeight: 30, includeFontPadding: false, textAlignVertical: 'center' as const,
  },
  headerIconBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  // Angular: .width-height-18 (viewprofile.page.scss:22-25) — box sized exactly
  // to the 18x18 icon, not a bigger 28x28 hit-target box (hitSlop covers touch
  // area instead) — a bigger box than the icon it holds is what made the row's
  // spacing look inconsistent depending on render/measure timing.
  headerIconBtn18: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  // Angular: message icon (mr-16) has 16px to its right, on top of headerBar's
  // own row `gap: 10` — so this adds the remaining 6px to land on 16px total
  // between Message and Call, matching the live app's spacing exactly.
  headerIconBtnMsg: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', marginRight: 6 },

  // Angular: dropdown.component.scss .lang-selection — height: 2.15rem (~34px),
  // border 1px #000, radius 8px. Pinned to an exact 108x38 per a manual UI tweak.
  langPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1, borderColor: '#000000', borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.white, width: 108, height: 38,
  },
  langPillCompact: { width: 108 },
  // Angular: dropdown.component.html:8 — `actionType == 'languageChanges'` uses
  // `.textcta-medium-12` (font12, Medium/500, black) — NOT font13.
  // fontFamily applied inline (langFonts.medium) — see Text usage.
  langPillText: { fontWeight: '500', fontSize: FontSize.font12, color: '#000000' },

  menuDropdown: {
    position: 'absolute', top: 40, right: 8, minWidth: 200,
    backgroundColor: Colors.white, borderRadius: 8, paddingVertical: 4,
    shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    // Must out-rank headerBar's own elevation (20) — a child with a LOWER
    // elevation than its parent gets drawn beneath the parent's background on
    // Android, which would hide the dropdown even though it's mounted.
    elevation: 24, zIndex: 24,
  },
  // Angular: button.component.html:85-90 — an ion-item holding the report icon
  // (mr-4) then the label, both on one row; the label is body2-regular-14
  // black-color, NOT a danger/red colour.
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  menuItemText: { fontWeight: '400', fontSize: FontSize.font14, color: Colors.black },
})
