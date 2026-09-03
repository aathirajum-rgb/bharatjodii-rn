// Mobile (non-desktop) presentational body of the ViewProfile screen.
//
// Stage 1 of a planned multi-stage extraction: this is a pure, mechanical move
// of ViewProfileScreen.tsx's main mobile `return (...)` block (plus the five
// render/helper functions only that JSX used) into its own component. Zero
// behavior change — ViewProfileScreen.tsx still owns every piece of state, all
// data loading, and all handlers, and passes them down as props here.
//
// The only things created FRESH inside this component (deliberately NOT props,
// since each mounted instance needs its own copy) are the refs, the Reanimated
// shared values + the worklets built from them, the two Pan gestures, the
// web-only touch-blocking effect, and the refreshCta2Y measure helper/timer.
//
// Module-level constants (ICON, SCREEN_WIDTH, DetailRow, …) are imported from
// ./ViewProfileScreen, mirroring how ViewProfileDesktopLayout.tsx already does.
import { useEffect, useRef, useState } from 'react'
import {
  FlatList, Platform, Pressable, StyleSheet, Text, View, Image as RNImage,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import LottieView from 'lottie-react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
} from 'react-native-reanimated'
import type { EdgeInsets } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { LANG_LABELS } from '../../components/matches-header/MatchesHeader'
import {
  WhatsAppIcon, WhatsAppUnlockButton, CallIcon, MessageIcon, CloseIcon, ViewLaterIcon, LikeIcon,
  showLikeCTA, showAfterLikeCTA, disableDontShow, disableViewLater,
  getBlurPhotoUri, getAvatarFallbackUri, NEWLY_JOINED_STAR_URI, ProfileBadge, PhotoSwiper,
  getAfterLikeCtaLabel, getAfterLikeCtaIcon, getAfterLikeContentText, showContactsLeftBanner, showFreeBadge,
  type AfterLikeCtx,
} from '../../components/matches/matchesCard.shared'
import WhatsAppPaywallModal from '../../components/matches/WhatsAppPaywallModal'
import StickyBanner from '../../components/sticky-banner/StickyBanner'
import MembershipBanner from '../../components/matches/MembershipBanner'
import PhotoViewerModal from '../../components/matches/PhotoViewerModal'
import HoroscopeSvgViewerModal from '../../components/matches/HoroscopeSvgViewerModal'
import ReportProfileModal from '../../components/matches/ReportProfileModal'
import ContactDetailsSheet from '../../components/matches/ContactDetailsSheet'
import Popover, { type PopoverAnchor } from '../../components/popover/Popover'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import {
  ICON, SCREEN_WIDTH, PHOTO_HEIGHT, HEADER_FIXED_HEIGHT, FLOATING_CTA_HEIGHT,
  SIMILAR_CARD_WIDTH, SIMILAR_CARD_GAP, SIMILAR_CARD_STRIDE,
  PROFILE_NAV_LEFT_ARROW_URI, PROFILE_NAV_RIGHT_ARROW_URI,
  PROFILE_NAV_ARROW_WIDTH, PROFILE_NAV_ARROW_HEIGHT,
  BACK_ICON_URI, LINK_ARROW_GIF_URI,
  biodataThemeOverlapMargin, familyCountText, SimilarProfileCardItem, DetailRow, SectionHeader,
} from './ViewProfileScreen'
import type { SimilarProfileCard, StarMatchResult, BiodataTheme } from '../../service/viewProfileService'
import { getContactConfirmContent as getSharedContactConfirmContent } from '../../service/communicationService'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { CDN_SVG, CDN_REACT, CDN_LOTTIE } from '../../constants/cdn'
import type { ViewProfileModel } from '../../types/interfaces/viewProfile.interface'

// Same shape ViewProfileScreen.tsx declares for its phoneInfoSheet slot — the
// other 6 phoneviewed scenarios plus the female-free variants, all mutually
// exclusive, so one slot works.
export type PhoneInfoSheet =
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

export interface ContactDetailsData {
  name: string
  mobile?: string | undefined
  dialNumber?: string | undefined
  whatsappNumber?: string | undefined
  showCounter?: boolean | undefined
  viewedCount?: string | undefined
  totalCount?: string | undefined
}

export interface ViewProfileContentProps {
  // ── Root wrapper ──────────────────────────────────────────────────────────
  wrapperStyle?: any

  // Defaults to TRUE. When false, this whole instance is inert: gestures,
  // presses, scrolling and every modal/sheet/popover are disabled, the
  // StatusBar isn't claimed, and the scroll worklet stops pushing state back
  // up. Used by the prev/next slide transition, which mounts a FROZEN snapshot
  // instance (interactive={false}) alongside the live one — only the live
  // instance should respond to input or own screen-level state.
  interactive?: boolean

  // ── Core data / derived ───────────────────────────────────────────────────
  profile:            ViewProfileModel
  oppGender:          'M' | 'F'
  sameGender:         boolean
  ownProfile:         boolean
  loginGender:        'M' | 'F'
  hasReligiousInfo:   boolean
  showHomeTownRow:    boolean
  ownEntryType:       string
  loginHoroAvail:     string
  showAddHoro:        boolean
  starMatch:          StarMatchResult | null
  similarProfiles:    SimilarProfileCard[]
  menuPromo:          any
  ctaCtx:             AfterLikeCtx
  langCode:           string

  // ── Header / scroll state ─────────────────────────────────────────────────
  scrolled:  boolean
  showMenu:  boolean
  onToggleMenu: () => void
  onSetScrolled: (v: boolean) => void
  onCloseMenu:   () => void

  // ── Photo / theme (own-profile biodata) ───────────────────────────────────
  heroPhotoFailed: boolean
  onHeroPhotoError: () => void
  themes:      BiodataTheme[]
  themeIndex:  number
  onCycleTheme: (direction: 1 | -1) => void
  biodataQrUrl?: string | undefined

  // ── Prev/next profile nav ─────────────────────────────────────────────────
  hasPrevProfile: boolean
  hasNextProfile: boolean
  onGoToPrev: () => void
  onGoToNext: () => void

  // ── Coach mark ────────────────────────────────────────────────────────────
  showCoachMark: boolean
  onDismissCoachMark: () => void

  // ── Verified-badge popover ────────────────────────────────────────────────
  showVerifiedInfo:    boolean
  verifiedInfoAnchor:  PopoverAnchor | null
  onVerifiedInfoPress: (measure: (cb: (x: number, y: number, w: number, h: number) => void) => void, hasNode: boolean) => void
  onCloseVerifiedInfo: () => void

  // ── Floating-CTA hand-off ─────────────────────────────────────────────────
  cta2Visible:      boolean
  onCta2VisibleChange: (v: boolean) => void

  // ── Sticky payment banner ─────────────────────────────────────────────────
  activeSticky: { content: string; ctaLabel: string; deadlineMs: number } | null
  onStickyPress: () => void
  onStickyClose: () => void

  // ── Contact-reveal flow ───────────────────────────────────────────────────
  contactConfirm:  'call' | 'whatsapp' | null
  contactQuota:    { viewed: string; left: string; expiry: string; total: string }
  contactDetails:  ContactDetailsData | null
  phoneInfoSheet:  PhoneInfoSheet | null
  onContactConfirmClose:      () => void
  onContactConfirmYes:        () => void
  onContactDetailsClose:      () => void
  onContactDetailsCall:       () => void
  onContactDetailsWhatsApp:   () => void
  onPhoneInfoClose:           () => void
  onPhoneInfoPrimaryPress:    () => void
  onPhoneInfoSecondaryPress:  () => void

  // ── Photo viewer / horoscope viewers / report modal ───────────────────────
  photoViewerOpen:  boolean
  photoViewerIndex: number
  enlargedPhotos:   string[] | null
  onOpenPhotoViewer: (index: number) => void
  onClosePhotoViewer: () => void
  horoscopeImageUrl: string | null
  horoscopeSvgUrl:   string | null
  onCloseHoroscopeImage: () => void
  onCloseHoroscopeSvg:   () => void
  reportModalOpen: boolean
  onCloseReportModal: () => void
  onReportSubmitted:  () => void

  // ── WhatsApp paywall ──────────────────────────────────────────────────────
  whatsappPaywallOpen: boolean
  onCloseWhatsappPaywall: () => void
  onWhatsappPaywallPayNow: () => void

  // ── Actions ───────────────────────────────────────────────────────────────
  onBack:            () => void
  onLanguagePress:   () => void
  onLike:            () => void
  onDontShow:        () => void
  onViewLater:       () => void
  onCall:            () => void
  onWhatsApp:        () => void
  onMessage:         () => void
  onReportProfile:   () => void
  onAddHoroscope:    () => void
  onViewHoroscope:   () => void
  onAddFamilyDetails:   () => void
  onAddPropertyDetails: () => void
  onDownloadBiodata:    () => void
  onViewStarMatchDetails: () => void
  onMissingDetailsPress:  () => void
  onSimilarProfilePress:  (card: SimilarProfileCard) => void
  onMembershipBannerPress: () => void
  onStarMatchUpsellPress:  () => void

  // ── Misc environment ──────────────────────────────────────────────────────
  t: (key: string, fallback?: any) => string
  insets: EdgeInsets
}

export default function ViewProfileContent(props: ViewProfileContentProps) {
  const {
    interactive = true,
    wrapperStyle,
    profile, oppGender, sameGender, ownProfile, loginGender, hasReligiousInfo, showHomeTownRow,
    ownEntryType, loginHoroAvail, showAddHoro, starMatch, similarProfiles, menuPromo, ctaCtx, langCode,
    scrolled, showMenu, onToggleMenu, onCloseMenu, onSetScrolled,
    heroPhotoFailed, onHeroPhotoError, themes, themeIndex, onCycleTheme, biodataQrUrl,
    hasPrevProfile, hasNextProfile, onGoToPrev, onGoToNext,
    showCoachMark, onDismissCoachMark,
    showVerifiedInfo, verifiedInfoAnchor, onVerifiedInfoPress, onCloseVerifiedInfo,
    cta2Visible, onCta2VisibleChange,
    activeSticky, onStickyPress, onStickyClose,
    contactConfirm, contactQuota, contactDetails, phoneInfoSheet,
    onContactConfirmClose, onContactConfirmYes, onContactDetailsClose, onContactDetailsCall,
    onContactDetailsWhatsApp, onPhoneInfoClose, onPhoneInfoPrimaryPress, onPhoneInfoSecondaryPress,
    photoViewerOpen, photoViewerIndex, enlargedPhotos, onOpenPhotoViewer, onClosePhotoViewer,
    horoscopeImageUrl, horoscopeSvgUrl, onCloseHoroscopeImage, onCloseHoroscopeSvg,
    reportModalOpen, onCloseReportModal, onReportSubmitted,
    whatsappPaywallOpen, onCloseWhatsappPaywall, onWhatsappPaywallPayNow,
    onBack, onLanguagePress, onLike, onDontShow, onViewLater, onCall, onWhatsApp, onMessage,
    onReportProfile, onAddHoroscope, onViewHoroscope, onAddFamilyDetails, onAddPropertyDetails,
    onDownloadBiodata, onViewStarMatchDetails, onMissingDetailsPress, onSimilarProfilePress,
    onMembershipBannerPress, onStarMatchUpsellPress,
    t, insets,
  } = props

  // ── Instance-local refs (see file header — deliberately not props) ─────────
  const verifiedBadgeRef = useRef<View>(null)
  const cta2Ref = useRef<View>(null)

  // One-shot burst overlay played on top of the Like chip on tap — Angular:
  // like-view-profile-post-click.json, played over the LIKEDCTA ion-chip in
  // button.component.html. `onLike` itself is owned by ViewProfileScreen.tsx
  // (passed down as a prop) and optimistically flips likedStatus, so this local
  // wrapper only adds the burst trigger without touching that existing logic.
  const [showLikeBurst, setShowLikeBurst] = useState(false)
  function handleLikePress() {
    setShowLikeBurst(true)
    onLike()
  }
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>()
  const similarListRef = useRef<FlatList<SimilarProfileCard>>(null)

  // ── Instance-local Reanimated shared values + worklets ─────────────────────
  // cta2Y is the real (second, inline) CTA's content-space Y — refreshed
  // occasionally (see refreshCta2Y), not a per-frame concern. The floating top
  // CTA stays visible (opacity 1) until the real CTA's top edge clears the
  // floating bar's own footprint (FLOATING_CTA_HEIGHT + bottom inset).
  const cta2Y = useSharedValue<number | null>(null)
  const scrollYShared = useSharedValue(0)
  const viewportHeightShared = useSharedValue(0)

  const floatingCtaAnimStyle = useAnimatedStyle(() => {
    const y = cta2Y.value
    if (y === null) return { opacity: 1 }
    const clearance = FLOATING_CTA_HEIGHT + insets.bottom
    const realCtaOnScreen = scrollYShared.value + viewportHeightShared.value - clearance > y
    return { opacity: realCtaOnScreen ? 0 : 1 }
  })

  // Worklet — runs on the UI thread, same frame as the scroll itself. Keeps
  // scrollYShared/viewportHeightShared live for floatingCtaAnimStyle, and
  // mirrors the JS-thread bits (scrolled/showMenu header state) via runOnJS.
  const onScroll = useAnimatedScrollHandler(e => {
    // A frozen instance never scrolls, and must never push state back up to
    // the parent (which the live instance owns).
    if (!interactive) return
    const y = e.contentOffset.y
    scrollYShared.value = y
    // Angular: `(this.scrWidth - 64) <= offset` — the header switches to
    // name+call+3-dot once scrolled ~one photo-height minus 64px.
    const isScrolled = y > PHOTO_HEIGHT - 64
    runOnJS(onSetScrolled)(isScrolled)
    if (!isScrolled) runOnJS(onCloseMenu)()
    const cy = cta2Y.value
    if (cy !== null) {
      const clearance = FLOATING_CTA_HEIGHT + insets.bottom
      const realCtaOnScreen = y + viewportHeightShared.value - clearance > cy
      runOnJS(onCta2VisibleChange)(realCtaOnScreen)
    }
  })

  // Refreshes cta2Y whenever content above it might have reflowed (star-match
  // data, similar-profiles/biodata-QR images resolving, etc.), so the worklet's
  // threshold never goes stale.
  function refreshCta2Y() {
    const scrollNode = scrollViewRef.current as unknown as View | null
    const ctaNode = cta2Ref.current
    if (!scrollNode || !ctaNode) return
    scrollNode.measureInWindow((_svX: number, svY: number) => {
      ctaNode.measureInWindow((_ctaX: number, ctaY: number, _ctaW: number, ctaH: number) => {
        // A 0×0/negative reading means the node hasn't actually laid out yet —
        // ignore it rather than clobbering a good value with garbage.
        if (ctaH <= 0) return
        cta2Y.value = ctaY - svY + scrollYShared.value
      })
    })
  }

  // Re-measure once these finish loading — the async data most likely to
  // reflow content above the real CTA after the initial onLayout capture.
  useEffect(() => {
    if (!interactive) return
    const timer = setTimeout(refreshCta2Y, 100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, starMatch, similarProfiles.length])

  // ── Instance-local gestures ───────────────────────────────────────────────
  // Angular: .vpcontent{{viewedid}} gesture (onMove) — a horizontal swipe over
  // the themed top area cycles templates; deltaX>0 (drag right) → PREVIOUS,
  // deltaX<0 (drag left) → NEXT. .enabled(...) is critical, not cosmetic: this
  // same GestureDetector wraps the photo area on OTHER people's profiles too,
  // where PhotoSwiper's own internal pan already owns that surface.
  const themeSwipeGesture = Gesture.Pan()
    .enabled(interactive && ownProfile && themes.length > 1)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onEnd(e => {
      if (e.translationX > 0) runOnJS(onCycleTheme)(-1)
      else if (e.translationX < -0) runOnJS(onCycleTheme)(1)
    })

  // Feature 2 prev/next-profile swipe, covering everything from the info card
  // down to the end of the scroll content (the actual area Angular's gesture is
  // live over, once its own exclusions are accounted for).
  const detailSwipeGesture = Gesture.Pan()
    .enabled(interactive && (hasPrevProfile || hasNextProfile))
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onEnd(e => {
      if (e.translationX > 0) runOnJS(onGoToPrev)()
      else if (e.translationX < 0) runOnJS(onGoToNext)()
    })

  // ── Web-only: block a 2nd finger from driving the similar-profiles carousel ─
  // Angular: Swiper.js only ever tracks a SINGLE pointer. React's synthetic
  // onTouchStart/scrollEnabled toggle loses the race against the browser's own
  // gesture recognizer; a real, non-passive DOM `touchstart` listener calling
  // preventDefault() runs synchronously ahead of it, which is the only way to
  // actually cancel it.
  useEffect(() => {
    if (!interactive) return
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
  }, [interactive])

  // ── Moved helpers ─────────────────────────────────────────────────────────

  // Angular button.component.ts:524-583 — see communicationService.ts's
  // getContactConfirmContent() for the full template-selection logic.
  function getContactConfirmContent(): string {
    if (!profile) return ''
    return getSharedContactConfirmContent(t as any, profile.gender, contactQuota)
  }

  // Maps each of the 6 phoneviewed scenarios (besides success) plus the
  // female-free variants onto the generic BottomSheet's flexible data shape.
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

  // Angular: download-biodata.component.ts redirectToMissingPage() — a single
  // top-of-screen "some details are missing" banner that redirects to whichever
  // field is missing, in this priority order.
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

  // Angular duplicates this exact CTA markup TWICE — once right after the name/ID
  // row (`position: sticky; bottom: 0`), once again after all detail sections,
  // right before Similar Profiles (plain inline, not sticky).
  function renderCtaBlock() {
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
                onPress={onDontShow}
                disabled={!interactive || disableDontShow(profile.dontShowStatus)}
              >
                <CloseIcon width={24} height={24} />
                <Text style={[s.ctaDontShowText, disableDontShow(profile.dontShowStatus) && s.ctaDisabledText]}>
                  {t('GENERAL.DONTSHOWCTA')}
                </Text>
              </Pressable>
              <Pressable
                style={[s.ctaViewLater, disableViewLater(profile.viewLaterStatus) && s.ctaDisabled]}
                onPress={onViewLater}
                disabled={!interactive || disableViewLater(profile.viewLaterStatus)}
              >
                <ViewLaterIcon width={24} height={24} />
                <Text style={[s.ctaViewLaterText, disableViewLater(profile.viewLaterStatus) && s.ctaDisabledText]}>
                  {t('GENERAL.VIEWLATER')}
                </Text>
              </Pressable>
            </View>
            <Pressable style={s.ctaLike} onPress={handleLikePress} disabled={!interactive}>
              <LikeIcon width={24} height={24} />
              <Text style={s.ctaLikeText}>{t('GENERAL.LIKE_CTA').replace('#HER_HIM#', '').trim()}</Text>
            </Pressable>
          </View>
        )}

        {showAfterLikeCTA(profile.likedStatus) && (
          <View style={s.afterLikeRow}>
            <View style={s.afterLikeTopRow}>
              <Text style={s.afterLikeText}>{getAfterLikeContentText(ctaCtx, t as any)}</Text>
              <View style={s.ctaSendInterestWrap}>
                {showFreeBadge(ctaCtx) && (
                  <View style={s.freeBadge} pointerEvents="none">
                    <Text style={s.freeBadgeText}>{t('GENERAL.FREE')}</Text>
                  </View>
                )}
                <Pressable style={s.ctaSendInterest} onPress={onCall} disabled={!interactive}>
                  <CdnSvg uri={getAfterLikeCtaIcon(ctaCtx)} width={16} height={16} />
                  <Text style={s.ctaSendInterestText}>{getAfterLikeCtaLabel(ctaCtx, t as any)}</Text>
                </Pressable>
              </View>
            </View>
            {showContactsLeftBanner(ctaCtx) && (
              <Text style={s.contactsLeftText}>{t('VIEWPROFILE.CONTACT_SEEN_INFO')}</Text>
            )}
          </View>
        )}

        {showLikeBurst && (
          <LottieView
            source={{ uri: CDN_LOTTIE + 'like-view-profile-post-click.json' }}
            autoPlay
            loop={false}
            onAnimationFinish={() => setShowLikeBurst(false)}
            style={s.likeBurst}
          />
        )}
      </View>
    )
  }

  // Feature 6 — replaces renderCtaBlock() entirely for own-profile views.
  function renderBiodataCta() {
    if (!ownProfile) return null
    return (
      <Pressable style={s.biodataCta} onPress={onDownloadBiodata} disabled={!interactive}>
        <Text style={s.biodataCtaText}>{t('BIO_DATA.BIODATA_DOWNLOAD_FREE')}</Text>
      </Pressable>
    )
  }

  // Bridges the parent's handleVerifiedInfoPress (which needs to measure the
  // badge node) to this component's own instance-local badge ref.
  function handleVerifiedInfoPress() {
    const node = verifiedBadgeRef.current
    onVerifiedInfoPress(
      cb => { node?.measureInWindow(cb) },
      !!node,
    )
  }

  return (
    <Animated.View style={[s.screen, wrapperStyle]}>
      {/* Only the LIVE instance claims the status bar — a frozen snapshot
          mounted alongside it must not fight over that global. */}
      {interactive && <StatusBar style="dark" />}

      {/* ── Header — a SEPARATE solid white bar above the photo (not floating over
          it) — confirmed against the real app's screenshots. Rest state: back +
          language pill. Once scrolled past the photo: back + Name + Call + language
          + a 3-dot report/don't-show menu. */}
      <View style={[s.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={s.headerBackBtn} onPress={onBack} hitSlop={8} disabled={!interactive}>
          <CdnSvg uri={BACK_ICON_URI} width={24} height={48} />
        </Pressable>

        {scrolled && (
          <>
            <Text style={s.headerName} numberOfLines={1}>
              {ownProfile ? t('VIEWPROFILE.PROFILE_PREVIEW') : profile.name}
            </Text>
            {/* Angular viewprofile.page.html:41-58 — on scroll (topProfileName) the
                language dropdown is hidden and the header instead carries Name,
                then Message, then Call (18x18 boxes, hitSlop for touch area). */}
            {!sameGender && (
              <>
                <Pressable style={s.headerIconBtnMsg} onPress={onMessage} hitSlop={8} disabled={!interactive}>
                  <MessageIcon width={18} height={18} />
                </Pressable>
                <Pressable style={s.headerIconBtn18} onPress={onCall} hitSlop={8} disabled={!interactive}>
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
              onPress={onLanguagePress}
              hitSlop={8}
              disabled={!interactive}
            >
              <CdnSvg uri={CDN_SVG + 'revamp/lang-change-img.svg'} width={20} height={20} />
              <Text style={s.langPillText} numberOfLines={1}>
                {LANG_LABELS[langCode] ?? 'English'}
              </Text>
            </Pressable>
          </>
        )}

        {scrolled && !ownProfile && (
          <View>
            <Pressable style={s.headerIconBtn} onPress={onToggleMenu} hitSlop={8} disabled={!interactive}>
              <Text style={s.menuDots}>⋮</Text>
            </Pressable>
            {showMenu && (
              <View style={s.menuDropdown}>
                <Pressable
                  style={s.menuItem}
                  onPress={() => { onCloseMenu(); onDontShow() }}
                  disabled={!interactive}
                >
                  <Text style={s.menuItemText}>{t('MATCHES.MORE_OPT_1')}</Text>
                </Pressable>
                <Pressable style={s.menuItem} onPress={onReportProfile} disabled={!interactive}>
                  <Text style={[s.menuItemText, s.menuItemDanger]}>{t('MATCHES.MORE_OPT_2')}</Text>
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
        <Pressable style={s.missingBanner} onPress={onMissingDetailsPress} disabled={!interactive}>
          <Text style={s.missingBannerText}>{t('BIO_DATA.MISSING_DETAILS_TXT')}</Text>
          <View style={s.missingBannerCta}>
            <Text style={s.missingBannerCtaText}>{t('BIO_DATA.ADD_NOW_TXT')}</Text>
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
        scrollEnabled={interactive}
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
            positioning ancestor that reproduces that. */}
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
                // fight the theme-swipe gesture on this exact surface.
                profile.isPhotoAvailable && profile.photos.length > 0 && !heroPhotoFailed ? (
                  <Image
                    source={{ uri: profile.photos[0] }}
                    style={{ width: SCREEN_WIDTH, height: PHOTO_HEIGHT }}
                    contentFit="cover"
                    onError={onHeroPhotoError}
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
                  <CdnSvg uri={getBlurPhotoUri(oppGender)} width="100%" height={PHOTO_HEIGHT} />
                )
              ) : profile.isPhotoAvailable && !profile.isPhotoProtect && profile.photos.length > 0 ? (
                <PhotoSwiper
                  key={profile.profileId}
                  images={profile.photos}
                  width={SCREEN_WIDTH}
                  height={PHOTO_HEIGHT}
                  oppGender={oppGender}
                  onPress={onOpenPhotoViewer}
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
                        <WhatsAppUnlockButton label={t('GENERAL.WHATSAPP')} onPress={onWhatsApp} />
                      </View>
                    </View>
                  )}
                </View>
              )}
            {/* Angular: global.scss:4918-4928 `.top-slider-header-div .swiper-pagination`
                — only a 50px-tall gradient strip pinned to the BOTTOM of the photo
                (behind the pagination dots), not a full top+bottom overlay. */}
            <LinearGradient
              colors={['#00000005', '#000000c4']}
              style={s.photoBottomGradient}
              pointerEvents="none"
            />
            {profile.isNewlyJoined && !ownProfile && (
              <View style={s.newBadge} pointerEvents="none">
                <CdnSvg uri={NEWLY_JOINED_STAR_URI} width={14} height={14} />
                <Text style={s.newBadgeText}>{t('MATCHES.NEW')}</Text>
              </View>
            )}
            {showCoachMark && (
              <Pressable style={s.coachMarkOverlay} onPress={onDismissCoachMark} disabled={!interactive}>
                <View style={s.coachMarkCard}>
                  <Text style={s.coachMarkText}>{t('VIEWPROFILE.GUIDEMOVENEXT')}</Text>
                  <Text style={s.coachMarkDismiss}>{t('GENERAL.OK_PENDING')}</Text>
                </View>
              </Pressable>
            )}
            </View>
          </GestureDetector>
          {/* Feature 6 biodata theming — Angular's biodata-back-arrow-img/
              biodata-next-arrow-img, a tap alternative to the swipe gesture above.
              Only shown once themes have actually loaded (own-profile only). */}
          {ownProfile && themes.length > 1 && (
            <>
              <Pressable style={[s.profileArrowBtn, s.profileArrowLeft]} onPress={() => onCycleTheme(-1)} hitSlop={8} disabled={!interactive}>
                <Text style={s.profileArrowText}>{'‹'}</Text>
              </Pressable>
              <Pressable style={[s.profileArrowBtn, s.profileArrowRight]} onPress={() => onCycleTheme(1)} hitSlop={8} disabled={!interactive}>
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
              inline beside the name. */}
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{profile.name}</Text>
            {/* Confirmed live in the Angular app: the Message/Call/WhatsApp icons
                are hidden for as long as the Verified badge's info tooltip is open
                (the tooltip sits right below the badge, directly over this row). */}
            {!sameGender && !showVerifiedInfo && (
              <View style={s.nameIconsRow}>
                <Pressable style={s.nameIconBtn} onPress={onMessage} hitSlop={8} disabled={!interactive}>
                  <MessageIcon width={24} height={24} />
                </Pressable>
                <Pressable style={s.nameIconBtn} onPress={onCall} hitSlop={8} disabled={!interactive}>
                  <CallIcon width={24} height={24} />
                </Pressable>
                <Pressable style={s.nameIconBtn} onPress={onWhatsApp} hitSlop={8} disabled={!interactive}>
                  <WhatsAppIcon width={24} height={24} />
                </Pressable>
              </View>
            )}
          </View>
          <Text style={s.jodiId}>{t('VIEWPROFILE.ID')} : {profile.profileId}</Text>

          {/* !! coerces to a real boolean — see ViewProfileScreen's original note:
              a raw '' would render as a bare text node under this View. Angular
              also requires (!ownProfile || !sameGender) and LIKED ∈ {'0','5'}. */}
          {!!profile.likedMsg && (!ownProfile || !sameGender) && profile.likedStatus === '0' && (
            <Text style={s.likedMsg}>{profile.likedMsg}</Text>
          )}

          {/* The top CTA is NOT rendered inline here — Angular's copy of it is
              `position: sticky; bottom: 0`. Rendered as a floating overlay below
              (see floatingCtaAnimStyle). */}

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
              "Home location" instead of "Current location". The separate "Hometown"
              row only shows for mother-tongue codes in homePlaceDomain. */}
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
              {/* Star-match porutham teaser — paid VIEWERS (ownEntryType) with both
                  raasi+star see the real ratio (proactively fetched by the parent)
                  plus a "View details" link; free viewers see a static fake-ratio
                  teaser (Angular's own paywall-teaser trick — always "9/10"). */}
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
                      <Pressable style={s.starMatchTextWrap} onPress={onViewStarMatchDetails} disabled={!interactive}>
                        <Text style={s.starMatchText}>
                          <Text style={s.starMatchRating}>{starMatch.displayText}</Text>
                          {t('STARMATCHING.STAR_MATCHING_TXT')}
                        </Text>
                        <View style={s.starMatchLinkRow}>
                          <Text style={s.starMatchTeaser}>{t('VIEWPROFILE.PAID_MEMBER_REPORT')}</Text>
                          <RNImage source={{ uri: LINK_ARROW_GIF_URI }} style={s.starMatchLinkArrow} />
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
                    <Pressable style={s.starMatchTextWrap} onPress={onStarMatchUpsellPress} disabled={!interactive}>
                      {/* Angular: .blur-text-vp-revamp — filter: blur(5px) on the
                          score for free (ENTRYTYPE 'F') members. */}
                      <Text style={s.starMatchText}>
                        <Text style={s.starMatchBlurred}>9/10</Text>{t('STARMATCHING.STAR_MATCHING_TXT')}
                      </Text>
                      <View style={s.starMatchLinkRow}>
                        <Text style={s.starMatchTeaser}>{t('VIEWPROFILE.FREE_MEMBER_REPORT')}</Text>
                        <RNImage source={{ uri: LINK_ARROW_GIF_URI }} style={s.starMatchLinkArrow} />
                      </View>
                    </Pressable>
                  </LinearGradient>
                )
              )}
            </>
          )}

          {/* ── Horoscope details — Angular orders this right after Religious
              details, before Life style. Angular's full visibility gate is
              `SHOWHORO=='1' && ((HOROSCOPEAVAILABLE=='Y' && loginHoroAvail=='1')
              || loginHoroAvail=='0')`. showAddHoro additionally hides the whole
              section for Muslim viewers. */}
          {showAddHoro && profile.showHoroSection && !sameGender &&
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
                      <Pressable onPress={onAddHoroscope} disabled={!interactive}>
                        <Text style={s.horoActionLink}>{t('GENERAL.ADD_HOROSCOPE')}</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable onPress={onViewHoroscope} disabled={!interactive}>
                      <Text style={s.horoActionLink}>{t('GENERAL.VIEW_HOROSCOPE')}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </>
          ) : ownProfile && loginHoroAvail !== '1' && (
            // Feature 6 — Angular's own onboarding "add horoscope" prompt for own-
            // profile empty sections, simplified (ownProfile stands in for the
            // OnboardScreen flag this port has no route for yet).
            <>
              <SectionHeader title={t('VIEWPROFILE.HORO_DETAILS')} />
              <Pressable style={s.addDetailPrompt} onPress={onAddHoroscope} disabled={!interactive}>
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
              <Pressable style={s.addDetailPrompt} onPress={onAddFamilyDetails} disabled={!interactive}>
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
              <Pressable style={s.addDetailPrompt} onPress={onAddPropertyDetails} disabled={!interactive}>
                <CdnSvg uri={ICON.property} width={20} height={20} />
                <Text style={s.addDetailPromptText}>{t('BIO_DATA.ADD_PROPERTY_DETAILS')}</Text>
              </Pressable>
            </>
          )}

          {/* Feature 6 biodata QR — Angular: download-biodata.component.html:451-463.
              A server-rendered QR image (not client-drawn, unlike the payment QR
              feature), letting someone scan it to view this profile publicly. */}
          {ownProfile && !!biodataQrUrl && (
            <View style={s.biodataQrSection}>
              <Image source={{ uri: biodataQrUrl }} style={s.biodataQrImage} contentFit="contain" />
              <Text style={s.biodataQrCaption}>
                {t('BIO_DATA.QR_CODE_TXT').replace('#HISHER#', t(`PRONOUN.${loginGender}.hisher`))}
              </Text>
            </View>
          )}
        </View>

        {/* Second CTA — Angular repeats this exact block right after Property
            details, before Similar Profiles. ref+onLayout feed refreshCta2Y,
            which decides when the floating top CTA above should hand off to this
            one — see its own comment. */}
        <View ref={cta2Ref} style={s.ctaBlockOuter} onLayout={refreshCta2Y}>
          {ownProfile ? renderBiodataCta() : renderCtaBlock()}
        </View>

        {/* ── Other profiles like X — Angular: app-swiper similarprofiles carousel.
            Renders outside infoCard's padding — the card row bleeds to the screen
            edges, only the header text lines up with the rest of the padded content.
            The whole grid is `.similar-profile-bg` (a mint gradient) with `pt-32`
            above the header — not a plain white background with no gap. */}
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
            <FlatList
              ref={similarListRef}
              data={similarProfiles}
              horizontal
              scrollEnabled={interactive}
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
                  onPress={() => onSimilarProfilePress(item)}
                />
              )}
            />
          </LinearGradient>
        )}

        {/* ── "Become a paid member" promo — Angular: app-breather BANNERSLOT 1001,
            same component/data source Matches already uses (MembershipBanner). */}
        {!sameGender && menuPromo?.MATCHESSLOT && (
          <MembershipBanner data={menuPromo.MATCHESSLOT} onPress={onMembershipBannerPress} />
        )}

        </View>
        </GestureDetector>
      </Animated.ScrollView>

      {/* Prev/next-PROFILE arrows — a screen-fixed overlay (sibling of the
          ScrollView, not content inside it) so they stay put at a constant
          screen position instead of scrolling away with the photo. */}
      {hasPrevProfile && (
        <Pressable
          style={[s.profileNavBtn, s.profileNavLeft, { top: insets.top + HEADER_FIXED_HEIGHT + PHOTO_HEIGHT - 35 }]}
          onPress={onGoToPrev}
          hitSlop={8}
          disabled={!interactive}
        >
          <CdnSvg uri={PROFILE_NAV_LEFT_ARROW_URI} width={PROFILE_NAV_ARROW_WIDTH} height={PROFILE_NAV_ARROW_HEIGHT} />
        </Pressable>
      )}
      {hasNextProfile && (
        <Pressable
          style={[s.profileNavBtn, s.profileNavRight, { top: insets.top + HEADER_FIXED_HEIGHT + PHOTO_HEIGHT - 35 }]}
          onPress={onGoToNext}
          hitSlop={8}
          disabled={!interactive}
        >
          <CdnSvg uri={PROFILE_NAV_RIGHT_ARROW_URI} width={PROFILE_NAV_ARROW_WIDTH} height={PROFILE_NAV_ARROW_HEIGHT} />
        </Pressable>
      )}

      {/* Floating top CTA — see cta2Y/floatingCtaAnimStyle's own comment above
          for why this exists and why the hand-off is worklet-driven. Always
          mounted (no conditional unmount) — opacity alone drives visibility. */}
      <Animated.View
        style={[s.floatingCtaBar, { paddingBottom: 12 + insets.bottom }, floatingCtaAnimStyle]}
        pointerEvents={cta2Visible ? 'none' : 'auto'}
      >
        {renderCtaBlock()}
      </Animated.View>

      {activeSticky && (
        <StickyBanner
          text={activeSticky.content}
          ctaLabel={activeSticky.ctaLabel}
          onPress={onStickyPress}
          onClose={onStickyClose}
          countdownDeadlineMs={activeSticky.deadlineMs}
        />
      )}

      <WhatsAppPaywallModal
        visible={interactive && whatsappPaywallOpen}
        profile={profile}
        oppGender={oppGender}
        onClose={onCloseWhatsappPaywall}
        onPayNow={onWhatsappPaywallPayNow}
      />

      <BottomSheet
        visible={interactive && !!contactConfirm}
        type="viewPhoneConfirm"
        data={{
          content: getContactConfirmContent(),
          ctaLabel: t('ACCOUNT.YES', 'Yes'),
        }}
        onClose={onContactConfirmClose}
        onPrimaryPress={onContactConfirmYes}
      />
      <ContactDetailsSheet
        visible={interactive && !!contactDetails}
        name={contactDetails?.name ?? ''}
        mobile={contactDetails?.mobile}
        whatsappNumber={contactDetails?.whatsappNumber}
        showCounter={contactDetails?.showCounter}
        viewedCount={contactDetails?.viewedCount}
        totalCount={contactDetails?.totalCount}
        showNotVerifiedNote={!!profile && !profile.isIdVerified && loginGender === 'F'}
        onClose={onContactDetailsClose}
        onCall={onContactDetailsCall}
        onWhatsApp={onContactDetailsWhatsApp}
      />
      <BottomSheet
        visible={interactive && !!phoneInfoSheet}
        type="phonePrivacyInfo"
        data={getPhoneInfoSheetData()}
        onClose={onPhoneInfoClose}
        onPrimaryPress={onPhoneInfoPrimaryPress}
        onSecondaryPress={onPhoneInfoSecondaryPress}
        onLinkPress={onPhoneInfoClose}
      />
      {/* Angular: viewprofile.page.ts's presentPopover() — Verified badge info tap.
          content is API-supplied (PERSONALINFO.IDDET.BODY), no fallback text in
          Angular either. Angular auto-dismisses after 5s; this also allows a
          manual tap-outside close via Popover's own backdrop. */}
      <Popover
        visible={interactive && showVerifiedInfo}
        type="verifiedPopup"
        content={profile.verifiedInfoText}
        anchor={verifiedInfoAnchor ?? undefined}
        onClose={onCloseVerifiedInfo}
      />

      <PhotoViewerModal
        visible={interactive && photoViewerOpen}
        images={enlargedPhotos && enlargedPhotos.length > 0 ? enlargedPhotos : profile.photos}
        initialIndex={photoViewerIndex}
        onClose={onClosePhotoViewer}
        renderFooter={ownProfile ? renderBiodataCta : renderCtaBlock}
      />

      <ReportProfileModal
        visible={interactive && reportModalOpen}
        partnerId={profile.profileId}
        partnerName={profile.name}
        onClose={onCloseReportModal}
        onSubmitted={onReportSubmitted}
      />

      <PhotoViewerModal
        visible={interactive && !!horoscopeImageUrl}
        images={horoscopeImageUrl ? [horoscopeImageUrl] : []}
        initialIndex={0}
        onClose={onCloseHoroscopeImage}
      />

      <HoroscopeSvgViewerModal
        visible={interactive && !!horoscopeSvgUrl}
        uri={horoscopeSvgUrl}
        onClose={onCloseHoroscopeSvg}
      />
    </Animated.View>
  )
}

// Stage-1 note: this is a COPY of the subset of ViewProfileScreen.tsx's own `s`
// StyleSheet that the moved JSX/helpers use. Some keys are intentionally defined
// in both files for now; a later cleanup stage prunes the parent's copy.
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  scrollView:    { flex: 1 },
  scrollContent: {},
  // Purely a gesture-handler boundary (see detailSwipeGesture) — no layout
  // properties of its own so it doesn't affect the content flow it wraps.
  detailSwipeZone: {},

  // zIndex matters on web for overlapping content (badges, coach mark):
  // photoWrap and infoCard are siblings, and infoCard has no positioning of its
  // own, so without this its opaque background would paint over anything
  // overlapping past photoBox's height.
  photoWrap: { position: 'relative', zIndex: 1 },
  // Flat, full-bleed square — Angular has no border-radius on this photo.
  photoBox: { width: SCREEN_WIDTH, height: PHOTO_HEIGHT, backgroundColor: Colors.divider },
  newBadge: {
    position: 'absolute', top: 0, left: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryDark, height: 24,
    paddingLeft: 8, paddingRight: 12, borderBottomRightRadius: 10, gap: 4,
  },
  newBadgeText: { fontFamily: Fonts.poppinsRegular, fontWeight: '400', fontSize: 12, color: Colors.white },
  // Feature 6 own-profile theme-cycle chevrons (distinct from profileNavBtn below).
  profileArrowBtn: {
    position: 'absolute', top: PHOTO_HEIGHT - 32,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  profileArrowLeft:  { left: 8 },
  profileArrowRight: { right: 8 },
  profileArrowText: { color: Colors.white, fontSize: 20, lineHeight: 20 },
  // Feature 2 prev/next-PROFILE arrows — Angular renders these as image assets
  // (vp-revamp-left-arw.svg / vp-revamp-right-arw.svg). `top` is set inline at
  // the render site since these are now a screen-fixed overlay.
  profileNavBtn: {
    position: 'absolute',
    width: PROFILE_NAV_ARROW_WIDTH, height: PROFILE_NAV_ARROW_HEIGHT,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  profileNavLeft:  { left: 0 },
  profileNavRight: { right: 0 },
  // Feature 8 coach-mark — a dismiss-anywhere dark scrim over the photo.
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
  coachMarkText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontWeight: '400', fontSize: 14, color: Colors.black, textAlign: 'center',
  },
  coachMarkDismiss: {
    fontFamily: Fonts.poppinsSemiBold, fontWeight: '600', fontSize: 14, color: Colors.primaryDark,
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
  overlayCard: {
    backgroundColor: Colors.scrimStrong, marginHorizontal: 24, padding: 16,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.overlayBorder,
    alignItems: 'center', gap: 16,
  },
  overlayText: {
    fontFamily: Fonts.poppinsMedium, fontWeight: '500', fontSize: 13, color: Colors.white,
    textAlign: 'center', lineHeight: 17, width: '70%', alignSelf: 'center',
  },

  // Angular: .details-section { background:#fff } — plain white, flush against
  // the photo, no radius/negative-margin card effect and no elevation/shadow.
  infoCard: {
    backgroundColor:   Colors.surface,
    paddingHorizontal: 24,
    paddingTop:        24,
    paddingBottom:     8,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  // Pinned to an exact 116x28 per a manual UI tweak — overrides ProfileBadge's
  // shared default size only here, via its optional `style` prop.
  verifiedBadgeSize: {
    width: 116, height: 28, minHeight: 0, paddingVertical: 0,
    justifyContent: 'center', overflow: 'hidden',
  },

  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Angular: heading1-semibold-22 black-color
  name:    { flex: 1, fontFamily: Fonts.poppinsSemiBold, fontWeight: '600', fontSize: 24, color: Colors.black },
  // Angular: body2-regular-14 black-color
  jodiId:  { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontWeight: '400', fontSize: 14, color: Colors.black, marginTop: 4, marginBottom: 18 },
  likedMsg: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontWeight: '400', fontSize: 12, color: Colors.likedStripText, marginTop: 6 },

  // Angular: viewprofile.page.html:469-489 — Call/WhatsApp icon buttons beside the name.
  nameIconsRow: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  nameIconBtn: { alignItems: 'center', justifyContent: 'center' },

  // Angular: .button-banner — regular inline content (NOT position:fixed/sticky).
  ctaBlock: { marginTop: 16 },
  // Second CTA's own wrapper — matches infoCard's horizontal padding since it
  // sits outside infoCard. Angular: .sticky-btm { background: #ffffff } — an
  // explicit opaque white card isolating this row from the mint gradient below.
  ctaBlockOuter: {
    paddingHorizontal: 24, paddingVertical: 16, backgroundColor: Colors.surface,
    shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  // Floating top-CTA overlay — Angular: .sticky-btm { position:sticky; bottom:0;
  // background:#fff } + .button-banner's box-shadow 0px 4px 24px rgba(0,0,0,0.25).
  // Opacity driven by floatingCtaAnimStyle (a worklet) rather than CSS sticky.
  floatingCtaBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.surface, paddingHorizontal: 24, paddingTop: 12,
    shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },

  // Same design as Matches' own MatchCard CTA — Row 1: Don't show + View later,
  // each flex:1, 44px/8px-radius/1px-#545454-border/white bg. Row 2: Like, full
  // width, primaryDark bg, Poppins-SemiBold white text, 24×24 icons throughout.
  ctaSection: { gap: 12 },
  ctaSecRow: { flexDirection: 'row', gap: 12 },
  ctaDontShow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: '#545454', borderRadius: 8,
  },
  ctaDontShowText: { fontFamily: Fonts.poppinsRegular, fontWeight: '400', fontSize: 14, color: '#545454' },
  ctaViewLater: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: '#545454', borderRadius: 8,
  },
  ctaViewLaterText: { fontFamily: Fonts.poppinsRegular, fontWeight: '400', fontSize: 14, color: '#545454' },
  // Angular: `ion-button[disabled]` only overrides background (#e6e6e6) and text
  // (#8A8A8A), `opacity: unset !important` — the #545454 border is left untouched.
  ctaDisabled: { backgroundColor: '#e6e6e6' },
  ctaDisabledText: { color: '#8A8A8A' },
  ctaLike: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryDark, borderRadius: 8, gap: 6,
  },
  ctaLikeText: { fontFamily: Fonts.poppinsSemiBold, fontWeight: '600', fontSize: 14, color: Colors.white },
  // One-shot burst overlay for the ctaLike button above — anchored to the
  // bottom of ctaBlock (where the CTA section sits) rather than nested inside
  // the button itself, since showLikeCTA flips false (unmounting the button in
  // favor of showAfterLikeCTA's block) the instant onLike's optimistic
  // likedStatus update lands.
  likeBurst: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 70,
    pointerEvents: 'none',
  },

  // Feature 6 — same pill styling as ctaLike, standing in for the normal
  // Like/Contact CTA when viewing your own profile.
  biodataCta: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryDark, borderRadius: 8, marginTop: 16,
  },
  biodataCtaText: { fontFamily: Fonts.poppinsSemiBold, fontWeight: '600', fontSize: 14, color: Colors.white },

  afterLikeRow: {
    backgroundColor: Colors.afterLikeBg, borderRadius: 8, borderWidth: 1,
    borderColor: Colors.afterLikeBorder, paddingHorizontal: 14, paddingVertical: 10,
  },
  afterLikeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  afterLikeText:   { flex: 1, fontFamily: Fonts.poppinsMedium, fontWeight: '500', fontSize: 13, color: Colors.black },
  ctaSendInterestWrap: { position: 'relative', flexShrink: 0 },
  ctaSendInterest: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, backgroundColor: Colors.primaryDark, borderRadius: 8, paddingHorizontal: 16,
  },
  ctaSendInterestText: { fontFamily: Fonts.poppinsRegular, fontWeight: '400', fontSize: 14, color: Colors.white },
  freeBadge: {
    position: 'absolute', top: -10, right: 8, zIndex: 1,
    backgroundColor: Colors.badgeNewBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  freeBadgeText: { fontFamily: Fonts.poppinsSemiBold, fontWeight: '600', fontSize: 10, color: Colors.badgeNewText },
  contactsLeftText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontWeight: '400', fontSize: 11, color: Colors.textSecondary, textAlign: 'center', marginTop: 8,
  },

  // Angular: icon column + text column — label directly above value, pt-20/pb-20,
  // border-bottom rgba(204,204,204,0.5) on every row except a section's last.
  // (Only the inline Horoscope row below uses these directly here — DetailRow
  // itself is imported from ViewProfileScreen and uses that file's own copy.)
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 20 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(204,204,204,0.5)' },
  detailIconCol: { width: 20, flexShrink: 0 },
  detailTextCol: { flex: 1, paddingLeft: 12 },
  detailLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontWeight: '400', fontSize: 14, color: Colors.black },
  detailValue: { fontFamily: Fonts.poppinsMedium, fontWeight: '500', fontSize: 14, color: Colors.black, marginTop: 8 },

  // Angular: .like-this-profile — border-image gradient approximated with a
  // solid gold top+bottom border matching the gradient's peak color.
  starMatchCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 20, paddingHorizontal: 4,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,192,0,0.4)',
  },
  starMatchTextWrap: { flex: 1 },
  // Only the rating number itself is semibold — the rest of the sentence is regular.
  starMatchText:   { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontWeight: '400', fontSize: 13, color: Colors.textDark },
  starMatchRating: { fontFamily: Fonts.poppinsSemiBold, fontWeight: '600' },
  starMatchTeaser: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontWeight: '400', fontSize: 13, color: Colors.link },
  starMatchLinkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  starMatchLinkArrow: { width: 18, height: 18 },
  // Angular: .blur-text-vp-revamp — filter: blur(5px) on the teaser score for
  // free members. RN's Text has no blur filter; textShadow approximates it.
  starMatchBlurred: {
    fontFamily: Fonts.poppinsSemiBold, fontWeight: '600',
    color: 'transparent',
    textShadowColor: '#333333', textShadowRadius: 5, textShadowOffset: { width: 0, height: 0 },
  },

  horoActionLink:    { fontFamily: Fonts.poppinsRegular, fontWeight: '400', fontSize: 14, color: Colors.link, marginTop: 8 },
  // Feature 6 — own-profile "add missing section" prompts.
  addDetailPrompt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  addDetailPromptText: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontWeight: '500', fontSize: 14, color: Colors.link },

  biodataQrSection: { alignItems: 'center', paddingTop: 24, gap: 16 },
  biodataQrImage: { width: 160, height: 160 },
  biodataQrCaption: {
    fontFamily: Fonts.poppinsMedium, fontWeight: '500', fontSize: 12, color: '#1a1818', textAlign: 'center',
  },

  // Angular: app-swiper.component.html:2 — header text aligned with the rest of
  // the padded content, but the card row itself bleeds to the screen edges.
  similarSection: { paddingTop: 32, paddingBottom: 24 },
  similarHeader: {
    fontFamily: Fonts.poppinsSemiBold, fontWeight: '600', fontSize: 20, color: Colors.black,
    marginBottom: 10, paddingHorizontal: 24,
  },
  // paddingVertical gives each card's shadow room to render.
  similarListContent: { paddingHorizontal: 24, paddingVertical: 12, gap: SIMILAR_CARD_GAP },
  similarCard: {
    width: SIMILAR_CARD_WIDTH, height: SIMILAR_CARD_WIDTH, borderRadius: 12,
    backgroundColor: Colors.divider,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 12,
    elevation: 6,
  },

  // Header — a SEPARATE solid white bar in normal flow above the photo (never
  // overlaying it). Content swaps once scrolled.
  headerBar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  missingBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.selectionBg, paddingHorizontal: 16, paddingVertical: 12,
  },
  missingBannerText: {
    flex: 1, marginRight: 12, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12,
    color: '#1e1e1e', letterSpacing: 0.24,
  },
  missingBannerCta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  missingBannerCtaText: { fontFamily: Fonts.poppinsRegular, fontSize: 12, color: Colors.link },

  // Angular: ion-back-button .default-back — 42x42 per a manual UI tweak.
  headerBackBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { flex: 1 },
  // Angular: `.vp-profile-name` — Poppins-Medium, `--gray-color1` (#1f1e1b).
  headerName: { flex: 1, fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontWeight: '500', fontSize: 18, color: '#1f1e1b' },
  headerIconBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  // Angular: .width-height-18 — box sized exactly to the 18x18 icon (hitSlop
  // covers the touch area instead).
  headerIconBtn18: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  // Angular: message icon (mr-16) — 6px here plus headerBar's own gap:10 = 16px.
  headerIconBtnMsg: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  menuDots: { fontSize: 24, lineHeight:20, color: '#333333', fontWeight: '700' },

  // Angular: dropdown.component.scss .lang-selection — pinned to 108x38.
  langPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1, borderColor: '#000000', borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.white, width: 108, height: 38,
  },
  langPillText: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontWeight: '500', fontSize: 13, color: '#000000' },

  menuDropdown: {
    position: 'absolute', top: 34, right: 0, minWidth: 200,
    backgroundColor: Colors.white, borderRadius: 8, paddingVertical: 4,
    shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6, zIndex: 10,
  },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  menuItemText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontWeight: '400', fontSize: 14, color: Colors.textDark },
  menuItemDanger: { color: Colors.primary },
})
