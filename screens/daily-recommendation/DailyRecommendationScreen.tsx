// Angular: pages/daily-recommendation/daily-recommendation.component.ts(+.html+.scss)
// Tinder-style swipeable card stack of today's Daily Recommendation profiles.
// Profiles are fetched once per calendar day (drService.ts's DR_DATE/DR_PROFILES
// cache) and swiped Like / Don't-show / View-later — either by dragging the top
// card or tapping the reused Matches card's own CTA row. A one-time scripted
// tutorial (AsyncStorage 'showDRSwipes') plays 1.75s after the cards first
// render. When the stack empties, an end-card (Lottie + progress bar) shows for
// 7s before auto-navigating away.
//
// Card UI is the exact same `MatchCard` component Matches uses (Angular: both
// pages render the shared app-matches-card) — reused directly rather than
// rebuilding badges/CTA rows/photo-swiper a second time. Only the stacking,
// gestures, tutorial, and end-card are genuinely new here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import LottieView from 'lottie-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing,
} from 'react-native-reanimated'

import CdnSvg from '../../components/cdn-svg/CdnSvg'
import BottomSheet, { type BottomSheetData } from '../../components/bottom-sheet/BottomSheet'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import DailyRecommendationDesktopLayout from './DailyRecommendationDesktopLayout'
import { MatchCard } from '../matches/MatchesScreen'
import { matchProfileAdapter } from '../../adapters/matches.adapter'
import type { MatchProfile } from '../../types/interfaces/matches.interface'
import {
  callingDailyRecommendationAPI, handleAfterDr, updateDrProfiles,
} from '../../service/drService'
import { toProfile, fetchAndStorePPSetData, fetchMatches } from '../../service/homeService'
import { communicationBtnOnClick, type CommActionResult } from '../../service/communicationService'
import { checkAddPhotoPromotion } from '../../service/buttonService'
import { markProfileViewed } from '../../service/viewProfileService'
import { getSessionValue, getRegistrationArrays } from '../../service/registrationService'
import { paymentTrack } from '../../service/paymentService'
import { handleFooterTabPress } from '../../utils/footerTabPress'
import { getItem, setItem, getJson } from '../../service/storageService'
import { navigate, resetTo } from '../../utils/navigationRef'
import { ENavigation } from '../../types/enums/navigation.enum'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { CDN_SVG, CDN_LOTTIE } from '../../constants/cdn'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'

const { width: SW } = Dimensions.get('window')

// Angular: SWIPE_THRESHOLD = 100 (px, deltaX)
const SWIPE_THRESHOLD = 100
// Angular's handlePan() uses ×2 (translateX(deltaX*2) etc) — a web-drag value
// that reads as too twitchy on native touch. Deliberate deviation from
// Angular here, at the user's request: lower multiplier so the card tracks
// the finger closer to 1:1 instead of racing ahead of it.
const DRAG_MULTIPLIER = 1.2
// Angular showDRSwipes(): moveOutWidth = document.documentElement.clientWidth * 0.2
const TUTORIAL_OUT_X = SW * 0.2
// Angular enableEmitFunction(): moveOutWidth = clientWidth*1.5, mouseWidth = clientWidth*0.2
const FLYOFF_OUT_X = SW * 1.5
const FLYOFF_OUT_Y = SW * 0.2
// Angular's setTopNextCard() returns rem — no RN unit equivalent; converts assuming
// the browser default root font-size (16px), never overridden anywhere in this app's
// global CSS (confirmed: no `html { font-size }` override in theme/variables.scss).
const REM_PX = 16
// Angular: daily-recommendation.component.ts's ngOnInit() sets
// photoHeight = (scrWidth - 56) + 'px' — 24px shorter than Matches' own
// (scrWidth - 32), which is what the reused MatchCard defaults to. Passed
// down as MatchCard's `photoHeight` override below.
const DR_PHOTO_H = SW - 56

type SwipeAction = 'like' | 'viewlater' | 'skip'

type DrProfile = MatchProfile

const LOTTIE = {
  loader:    `${CDN_LOTTIE}loader.json`,
  success:   `${CDN_SVG}revamp/animation/success-dr-animation.json`,
  swipeRight:`${CDN_SVG}revamp/animation/dr-left-to-right.json`,
  swipeLeft: `${CDN_SVG}revamp/animation/swipe-right-to-left.json`,
}

// Angular: setTopNextCard(index) — scale/translateY stack offset, adjusted by
// whether the adjacent card is a paid member (paid cards render a "Paid Member"
// badge row below the photo, changing the card's visible height, so the peek
// offset compensates to keep the stacked edge consistent).
function stackOffsetRem(index: number, profiles: DrProfile[]): number {
  let val = index * -1.85
  if (index === 1) {
    const first = profiles[0]?.isPaidMember ?? false
    const second = profiles[1]?.isPaidMember ?? false
    val = first && !second ? -3.35 : !first && second ? -0.625 : -1.75
  }
  if (index === 2) {
    const first = profiles[0]?.isPaidMember ?? false
    const third = profiles[2]?.isPaidMember ?? false
    val = first && !third ? -5.05 : !first && third ? -0.1625 : -3.51
  }
  return val
}

// Angular: daily-recommendation.component.scss's .base-container —
// `--background: linear-gradient(180deg, #fff0f4 0%, #fff 100%), #fff`.
// Exported so DailyRecommendationDesktopLayout.tsx can reuse the exact same
// gradient — the Figma desktop screenshot shows the same pale-pink-to-white
// wash behind its content, not the flat grey background other desktop
// screens (Home/Matches/EditProfile) use.
export function ScreenBackground({ children }: { children: React.ReactNode }) {
  const { LinearGradient } = require('expo-linear-gradient')
  return (
    <LinearGradient
      colors={['#fff0f4', '#ffffff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradientFill}
    >
      {children}
    </LinearGradient>
  )
}

function toBottomSheetData(call: Record<string, any> | undefined): BottomSheetData {
  return {
    title:    call?.TITLE,
    content:  call?.CONTENT,
    ctaLabel: call?.CTA,
    image:    call?.IMG,
    showClose: true,
  }
}

export default function DailyRecommendationScreen({ navigation, route }: { navigation: any; route?: any }) {
  const { t, i18n } = useTranslation()
  const isDesktop = useIsDesktopWeb()
  // Angular: frm_page defaults to 'matches', overridden by the queryParams the
  // component was navigated with (drService.ts's loadDrProfiles sends this).
  const frmPage = (route?.params?.frm_page as string | undefined) ?? 'matches'

  const [profiles, setProfiles] = useState<DrProfile[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [contentLoaded, setContentLoaded] = useState(false)
  const [showEndCard, setShowEndCard] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const [showRightSwipe, setShowRightSwipe] = useState(false)
  const [showLeftSwipe, setShowLeftSwipe] = useState(false)
  const [photoPopupSheet, setPhotoPopupSheet] = useState<BottomSheetData | null>(null)
  const [limitSheet, setLimitSheet] = useState<{ visible: boolean; body?: string | undefined }>({ visible: false })
  // Message icon's non-success outcomes (verify-id / raw error) — 'jodimessages'
  // never produces a 'female_free' result (see communicationService.ts's
  // handleChat), so unlike MatchesScreen's own phoneInfoSheet this only ever
  // needs the generic BottomSheetData shape, no per-kind switch.
  const [messageInfoSheet, setMessageInfoSheet] = useState<BottomSheetData | null>(null)
  // Angular: matches-card.component's own swipeStatusText — 'Like' always maps to
  // the left-positioned green stamp, 'ViewLater'/'Skip' to the right-positioned
  // pink one (matches-card.component.scss's .swipe-text-overlay/.skip-background
  // — a fixed per-ACTION position, not one that follows the drag direction/finger).
  // Drag only ever commits 'like'/'viewlater' (never 'skip' — confirmed: handlePan's
  // swipeDirection is only ever those two), so the left stamp defaults to "View
  // Later" and is only overridden to "Skip" for the Don't-show button tap.
  const [leftStampKind, setLeftStampKind] = useState<'viewlater' | 'skip'>('viewlater')

  // Angular: this.showPhotoPromotion, computed once from getPPSETData() — gates
  // ONLY the drag-release Like path (handlePanEnd), not button taps (those go
  // through buttonService.checkAddPhotoPromotion() instead — a different, wider
  // gate, checked live per-tap below rather than cached).
  const showPhotoPromotionRef = useRef(false)

  // Kept in sync via effect (not assigned directly in the render body) so
  // gesture/async callbacks below can read the latest values without going
  // stale, without mutating a ref mid-render.
  const profilesRef = useRef(profiles)
  const totalCountRef = useRef(totalCount)
  useEffect(() => { profilesRef.current = profiles }, [profiles])
  useEffect(() => { totalCountRef.current = totalCount }, [totalCount])

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const autoNavTimerRef      = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const tutorialTimer1Ref    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const tutorialTimer2Ref    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const buttonFlyTimerRef    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const nextVpTargetRef      = useRef<string | null>(null)
  // runTutorial()'s getItem().then() below has its own async gap after the
  // 1750ms delay that schedules it — if the screen unmounts during that gap,
  // this is the only thing left to stop it from setting state and creating
  // fresh timers that clearAllTimers()'s cleanup (already run by then) can
  // never clear.
  const mountedRef = useRef(true)

  // Top card's live transform — a single source of truth, matching Angular's own
  // approach of repeatedly overwriting ONE `transform` style rather than layering
  // drag/tutorial/commit transforms together (only one is ever active at a time).
  const cardX = useSharedValue(0)
  const cardY = useSharedValue(0)
  const cardRotate = useSharedValue(0) // degrees

  // ─── Header ───────────────────────────────────────────────────────────────
  // Angular: getHeaderText() — "Daily recommendations (i/total)"
  const headerText = `${t('DAILYRECOMMENDATIONS.DAILY_RECOMMENDATIONS')} (${currentIndex}/${totalCount})`

  // ─── navigatteToPaywall() equivalent — used by the close icon and by the
  // end-card's login-with-no-fallback-profile branch ──────────────────────────
  const navigateAway = useCallback(async () => {
    if (frmPage === 'login') {
      const pageId = (await getItem('LANDPAGEID')) ?? ''
      await handleAfterDr(pageId)
    } else {
      // Angular: navigatteToPaywall()'s else branch does
      // router.navigate(['/' + frm_page]) — a raw lowercase route path,
      // matched fine against Angular's own lowercase routing table. React
      // Navigation's registered screen name is capitalized ('Matches'), so
      // passing the literal 'matches' (the only real value drService.ts's
      // loadDrProfiles() ever sends besides 'login') straight to resetTo()
      // silently no-oped — nothing registered under that exact lowercase
      // name. This is why the close (X) icon appeared to do nothing.
      const target = ['dailyrecommendations', 'registration', 'matches'].includes(frmPage)
        ? ENavigation.MATCHES
        : frmPage
      resetTo(target)
    }
  }, [frmPage])

  const clearAllTimers = useCallback(() => {
    clearInterval(progressIntervalRef.current)
    clearTimeout(autoNavTimerRef.current)
    clearTimeout(tutorialTimer1Ref.current)
    clearTimeout(tutorialTimer2Ref.current)
    clearTimeout(buttonFlyTimerRef.current)
  }, [])

  // Angular: closeDRCards() — close-icon tap
  const handleClose = useCallback(() => {
    clearAllTimers()
    navigateAway()
  }, [clearAllTimers, navigateAway])

  // ─── End card (Angular: showDREndCard()) ────────────────────────────────────
  // Angular: callingListAPI(...).then(...) is fire-and-forget — the progress
  // bar AND the 7s timer start IMMEDIATELY, not gated on this fetch resolving.
  // A previous pass here `await`ed fetchMatches before starting either timer,
  // so the whole 7s sequence didn't even begin until that request finished —
  // on a slow network, the end-card could sit well past 7s with the progress
  // bar stuck at 0% the whole time it waited. Fixed to match Angular's actual
  // race: whichever profile is available when the 7s timeout fires is used
  // (nextVpTargetRef may still be null then — same as Angular's `profile` var).
  const startEndCardSequence = useCallback(() => {
    nextVpTargetRef.current = null
    fetchMatches(0, 1).then(result => {
      nextVpTargetRef.current = result.items[0]?.profileId ?? null
    }).catch(() => {
      nextVpTargetRef.current = null
    })

    // Angular: progress += 1.5 every 100ms
    let progress = 0
    progressIntervalRef.current = setInterval(() => {
      if (progress < 100) {
        progress += 1.5
        setProgressPct(Math.min(progress, 100))
      }
    }, 100)

    // Angular: setInerval — single 7s timeout that navigates away. Angular
    // reads NOTIFYVP_LASTID at fire-time too (not upfront), so a fallback
    // written during this 7s window is still picked up.
    autoNavTimerRef.current = setTimeout(async () => {
      clearAllTimers()
      const nextId = nextVpTargetRef.current ?? (await getItem('NOTIFYVP_LASTID'))
      if (frmPage === 'login' && !nextId) {
        navigateAway()
      } else {
        navigate(ENavigation.VIEW_PROFILE, { matriId: nextId ?? '', fromPage: 'matches' })
      }
    }, 7000)
  }, [clearAllTimers, frmPage, navigateAway])

  // ─── Tutorial (Angular: showDRSwipes()) ─────────────────────────────────────
  const runTutorial = useCallback(() => {
    getItem('showDRSwipes').then(v => {
      if (!mountedRef.current) return
      if (v !== '1') return
      setShowRightSwipe(true)
      setShowLeftSwipe(false)
      const ease = Easing.out(Easing.ease)
      cardX.value = withTiming(TUTORIAL_OUT_X, { duration: 1400, easing: ease })
      cardY.value = withTiming(45, { duration: 1400, easing: ease })
      cardRotate.value = withTiming(15, { duration: 1400, easing: ease })

      tutorialTimer1Ref.current = setTimeout(() => {
        setShowRightSwipe(false)
        setShowLeftSwipe(true)
        cardX.value = withTiming(-TUTORIAL_OUT_X, { duration: 1400, easing: ease })
        cardY.value = withTiming(45, { duration: 1400, easing: ease })
        cardRotate.value = withTiming(-15, { duration: 1400, easing: ease })

        tutorialTimer2Ref.current = setTimeout(() => {
          setShowRightSwipe(false)
          setShowLeftSwipe(false)
          cardX.value = 0
          cardY.value = 0
          cardRotate.value = 0
        }, 2000)
      }, 2000)

      // Angular sets this immediately (not after the animation finishes) — the
      // tutorial is a fire-and-forget visual, the flag flips right away.
      setItem('showDRSwipes', '2')
    })
  }, [cardX, cardY, cardRotate])

  // ─── Initial load (Angular: constructor's callingDailyRecommendationAPI) ───
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const [userId, entryType] = await Promise.all([
        getItem(SK.Auth.USER_ID),
        getSessionValue('ENTRYTYPE'),
      ])
      if (cancelled) return

      const raw = await callingDailyRecommendationAPI(userId ?? '')
      if (cancelled) return

      const adapted: DrProfile[] = raw.map(r => matchProfileAdapter.adapt(toProfile(r)))
      setProfiles(adapted)

      const cachedCount = (await getJson<any[]>('DR_COUNT'))?.length ?? 0
      setTotalCount(cachedCount)
      setCurrentIndex(cachedCount > 0 ? 1 : 0)
      const noProfiles = cachedCount === 0
      setShowEndCard(noProfiles)
      setContentLoaded(true)
      if (noProfiles) startEndCardSequence()

      // Angular: getPPSETData() — showPhotoPromotion gate for drag-release Like
      const ppSetData = await fetchAndStorePPSetData()
      if (!cancelled) {
        showPhotoPromotionRef.current =
          String(ppSetData?.PROFILEPUBLISHEDFLAG) === '0' &&
          ['1', '2'].includes(String(ppSetData?.PROFILEPUBLISHEDTYPE)) &&
          entryType === 'F'
      }

      // Angular: setTimeout(() => showDRSwipes(), 1750)
      setTimeout(() => { if (!cancelled) runTutorial() }, 1750)
    })()

    // Angular: calltrackApi() — one-time "first landed on DR" tracking ping
    ;(async () => {
      const already = await getItem('FIRSTLAND_DR')
      if (!already) {
        await paymentTrack('116')
        await setItem('FIRSTLAND_DR', '1')
      }
    })()

    return () => {
      cancelled = true
      mountedRef.current = false
      clearAllTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Add-photo promotion sheet (shared by both gates — same 'photoPopUp'
  // content/shape, only the triggering condition differs) ─────────────────────
  const openPhotoPromotionSheet = useCallback(async () => {
    const reg = await getRegistrationArrays()
    setPhotoPopupSheet(toBottomSheetData(reg?.PHOTOPUBLISHED?.Call))
  }, [])

  // ─── Message icon (Angular: matches-card.component.html's message icon →
  // clickingOnBtn(..., 'jodimessages', ...) → communication.service.ts's
  // jodimessages branch). The icon itself sits in the card's name row —
  // unconditional on like-state — but MatchCard only renders it when
  // `onMessage` is actually passed, so it needs wiring here just like
  // MatchesScreen's own handleMessage(). Mirrors that handler's mapping.
  const handleMessage = useCallback(async (profile: DrProfile) => {
    try {
      const result = await communicationBtnOnClick('dailyrecommendations', 'jodimessages', { MATRIID: profile.profileId })
      if (result.type === 'payment_promo') {
        navigation.navigate('recharge')
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
        setMessageInfoSheet({
          title:     String(cfg.TITLE ?? (result.photoUpload ? 'Add your photo to continue' : 'Verify your profile')),
          content:   String(cfg.CONTENT ?? (result.photoUpload ? 'Please add your photo to view phone numbers.' : 'Please complete ID verification to view phone numbers.')),
          ctaLabel:  cta,
          showClose: true,
        })
      } else if (result.type === 'error') {
        setMessageInfoSheet({ content: result.message, ctaLabel: t('GENERAL.OK_CTA', 'OK'), showClose: true })
      }
      // result.type === 'api_success' — handleChat() already navigated to chat-window.
    } catch (e) {
      if (__DEV__) console.error('[DailyRecommendation] message error:', e)
    }
  }, [navigation, t])

  // ─── Shift to next card (Angular: handleShift()) ────────────────────────────
  const shiftToNextProfile = useCallback((shifted: DrProfile) => {
    markProfileViewed(shifted.profileId, true).catch(() => {})
    // Angular: handleShift() — this.profiles.shift() is IMMEDIATELY followed by
    // setStorageValue('DR_PROFILES', JSON.stringify(this.profiles)), persisting
    // the trimmed list back to storage on every single swipe. This was missing
    // here — shiftToNextProfile only ever updated React state, never the
    // AsyncStorage cache, so callingDailyRecommendationAPI()'s cache-hit check
    // (`cached?.length`) still saw the FULL, un-trimmed list on the next app
    // open the same day and re-served every profile, already-swiped or not.
    updateDrProfiles(shifted.profileId).catch(() => {})
    // `shifted` is always the current top card at every call site — drop it.
    // willEmpty is read from the ref (still the pre-shift value here) rather
    // than inside the setProfiles updater — updaters must stay pure, and
    // starting timers/intervals as a side effect there risked a double-fire
    // under React's dev-mode double-invocation.
    const willEmpty = profilesRef.current.length <= 1
    setProfiles(prev => prev.slice(1))
    if (willEmpty) {
      setShowEndCard(true)
      startEndCardSequence()
    }
    setCurrentIndex(prev => (prev < totalCountRef.current ? prev + 1 : prev))
    cardX.value = 0
    cardY.value = 0
    cardRotate.value = 0
  }, [cardX, cardY, cardRotate, startEndCardSequence])

  // Angular: restoreDRCard() — puts the swiped card back on ERRCODE:11 (daily
  // like-limit reached). Only reachable from the drag-gesture path here (see
  // commitButtonSwipe's own comment on why the button path handles this
  // differently).
  const restoreCard = useCallback((profile: DrProfile) => {
    setProfiles(prev => [profile, ...prev])
    setCurrentIndex(prev => (prev > 1 ? prev - 1 : prev))
    cardX.value = 0
    cardY.value = 0
    cardRotate.value = 0
  }, [cardX, cardY, cardRotate])

  // ─── Drag-gesture commit (Angular: handlePanEnd, action ∈ {like, viewlater}) ─
  const commitDragSwipe = useCallback((direction: 'like' | 'viewlater') => {
    const top = profilesRef.current[0]
    if (!top) return

    // Angular: `if (showPhotoPromotion && swipeDirection == 'Like')` — snap back,
    // show the sheet, do NOT commit. Confirmed this gate is drag-only (button
    // taps use buttonService.checkAddPhotoPromotion() instead — see below).
    if (direction === 'like' && showPhotoPromotionRef.current) {
      cardX.value = withTiming(0, { duration: 500 })
      cardY.value = withTiming(0, { duration: 500 })
      cardRotate.value = withTiming(0, { duration: 500 })
      openPhotoPromotionSheet()
      return
    }

    // Angular: fly the card the rest of the way off-screen continuing its drag
    // trajectory — Angular's own drag-release code only ever REMOVES the drag
    // transform (a same-tick DOM node destroy race, not a real fly-off; see
    // code comments in the source). This continues the swipe visually instead,
    // matching the "fly-off animation" requirement and the button-tap path's
    // own clean fly-off, rather than reproducing that race.
    const dir = direction === 'like' ? 1 : -1
    cardX.value = withTiming(dir * FLYOFF_OUT_X, { duration: 300, easing: Easing.out(Easing.ease) })
    cardY.value = withTiming(cardY.value + 80, { duration: 300 })
    cardRotate.value = withTiming(dir * 30, { duration: 300 })

    // Angular: communicationBtnOnClick fired, then handleShift() runs immediately
    // (optimistic — doesn't wait for the response).
    const resultPromise = communicationBtnOnClick('dailyrecommendations', direction, { MATRIID: top.profileId })
    shiftToNextProfile(top)

    if (direction === 'like') {
      resultPromise.then((result: CommActionResult) => {
        if (result.type === 'like_limit_exceeded') {
          restoreCard(top)
          setLimitSheet({ visible: true, body: result.body })
        }
      })
    }
  }, [cardX, cardY, cardRotate, openPhotoPromotionSheet, shiftToNextProfile, restoreCard])

  // ─── Button-tap commit (Angular: matches-card→button.service.ts's
  // clickOnLike/clickDontShowUser/clickOnViewLater → communicationBtnOnClick,
  // THEN — only once that response comes back — matches-card.component's
  // drCardBtnEventEmit fires and DR's enableEmitFunction() runs the fly-off +
  // 800ms-delayed shift. Unlike the drag path, this is NOT optimistic.) ───────
  const commitButtonSwipe = useCallback(async (action: SwipeAction) => {
    const top = profilesRef.current[0]
    if (!top) return

    // Angular button.service.ts's clickingOnBtn(): checkAddPhotoPromotion() gates
    // Like AND Don't-show taps (a wider condition than DR's own showPhotoPromotion
    // above) — View-later has no such gate at all.
    if ((action === 'like' || action === 'skip') && await checkAddPhotoPromotion()) {
      openPhotoPromotionSheet()
      return
    }

    // Angular: clickingOnBtn() sets swipeStatusText to 'ViewLater' or 'Skip'
    // right before the API call — the button-tap path knows its own action
    // explicitly, unlike the drag path which only ever infers Like/ViewLater
    // from translationX's sign.
    if (action === 'skip') setLeftStampKind('skip')
    else if (action === 'viewlater') setLeftStampKind('viewlater')

    const result = await communicationBtnOnClick('dailyrecommendations', action, { MATRIID: top.profileId })

    if (action === 'like' && result.type === 'like_limit_exceeded') {
      // Deliberate improvement over Angular's own source here: Angular's real
      // event order (drCardBtnEventEmit fires unconditionally alongside
      // onLimitExceedPopupClosed, both driven by the same already-set
      // oppProfileInfo.action) races an 800ms-delayed shift against a restore
      // that has nothing to restore yet, and ends up flying the card off
      // anyway even though the like failed. Keeping the card in place when the
      // like demonstrably failed is the behavior a user actually expects.
      setLimitSheet({ visible: true, body: result.body })
      return
    }

    // Angular enableEmitFunction(): like/dislike → right+up+rotate(-30); other
    // actions (skip/next/dontshow/viewlater) → left+up+rotate(30). 1.2s fly-off,
    // shift fires 800ms in (not on animation-complete).
    const dir = action === 'like' ? 1 : -1
    cardX.value = withTiming(dir * FLYOFF_OUT_X, { duration: 1200, easing: Easing.out(Easing.ease) })
    cardY.value = withTiming(-FLYOFF_OUT_Y, { duration: 1200, easing: Easing.out(Easing.ease) })
    cardRotate.value = withTiming(dir * -30, { duration: 1200, easing: Easing.out(Easing.ease) })

    buttonFlyTimerRef.current = setTimeout(() => {
      shiftToNextProfile(top)
    }, 800)
  }, [cardX, cardY, cardRotate, openPhotoPromotionSheet, shiftToNextProfile])

  // ─── Drag gesture (Angular: handlePan/handlePanEnd) ─────────────────────────
  // Angular registers the gesture unconditionally in ngAfterViewInit — real
  // conflicts with the tutorial's own scripted transform are avoided here by
  // disabling the real gesture for the ~4.4s the tutorial runs, which Angular's
  // own source doesn't need to worry about (it manipulates the DOM style
  // directly rather than sharing a gesture-driven value).
  const tutorialRunning = showRightSwipe || showLeftSwipe

  const panGesture = useMemo(() => Gesture.Pan()
    .enabled(!tutorialRunning)
    .onUpdate((e) => {
      'worklet'
      // Angular handlePan(): translateX(deltaX*2) translateY(deltaY*2) rotate((deltaX*2)/10 deg)
      // — DRAG_MULTIPLIER replaces that *2 (see its own comment above).
      cardX.value = e.translationX * DRAG_MULTIPLIER
      cardY.value = e.translationY * DRAG_MULTIPLIER
      cardRotate.value = (e.translationX * DRAG_MULTIPLIER) / 10
    })
    .onEnd((e) => {
      'worklet'
      if (Math.abs(e.translationX) < SWIPE_THRESHOLD) {
        cardX.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) })
        cardY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) })
        cardRotate.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) })
      } else {
        const direction = e.translationX > 0 ? 'like' : 'viewlater'
        runOnJS(commitDragSwipe)(direction)
      }
    }), [cardX, cardY, cardRotate, commitDragSwipe, tutorialRunning])

  const topCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cardX.value },
      { translateY: cardY.value },
      { rotate: `${cardRotate.value}deg` },
    ],
  }))

  const likeStampStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(cardX.value / SWIPE_THRESHOLD, 1)),
  }))
  const viewLaterStampStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(-cardX.value / SWIPE_THRESHOLD, 1)),
  }))

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const visible = profiles.slice(0, 3)
  // Contact-gating values the reused MatchCard needs — DR's own top-level task
  // spec doesn't call for Call/WhatsApp on this screen's flow, but MatchCard
  // always renders those CTA affordances as part of its after-like state, so it
  // still needs real values here rather than placeholders.
  const [gating, setGating] = useState({ oppGender: 'F' as 'M' | 'F', ownEntryType: '', femaleFreeEligible: false, indNumbersLeft: '0' })
  useEffect(() => {
    (async () => {
      const [lg, entryType, femaleFreeRaw, contactDetail] = await Promise.all([
        getItem(SK.User.LOGIN_GENDER),
        getSessionValue('ENTRYTYPE'),
        getSessionValue('FEMALEFREECONACT'),
        getJson<Record<string, any>>('CONTACT_DETAIL'),
      ])
      const loginGender: 'M' | 'F' = lg === 'M' ? 'M' : 'F'
      setGating({
        oppGender: loginGender === 'F' ? 'M' : 'F',
        ownEntryType: entryType ?? '',
        femaleFreeEligible: String((femaleFreeRaw as any)?.FLAG) === '1' && loginGender === 'F' && String((femaleFreeRaw as any)?.Left ?? '0') !== '0',
        indNumbersLeft: String(contactDetail?.IndNumbersLeft ?? '0'),
      })
    })()
  }, [])

  function renderStackedCard(profile: DrProfile, index: number) {
    const scale = 1 - index * 0.05
    const translateY = stackOffsetRem(index, profiles) * REM_PX
    return (
      <View
        key={profile.profileId}
        style={[styles.cardSlot, { transform: [{ scale }, { translateY }] }]}
        pointerEvents="none"
      >
        <MatchCard
          profile={profile}
          oppGender={gating.oppGender}
          ownEntryType={gating.ownEntryType}
          femaleFreeEligible={gating.femaleFreeEligible}
          indNumbersLeft={gating.indNumbersLeft}
          onPress={() => {}}
          onLike={() => {}}
          onDontShow={() => {}}
          onViewLater={() => {}}
          onCall={() => {}}
          onWhatsApp={() => {}}
          onMessage={() => {}}
          singlePhoto
          hideVerifiedBadge
          photoHeight={DR_PHOTO_H}
        />
      </View>
    )
  }

  function renderTopCard(profile: DrProfile) {
    return (
      <GestureDetector key={profile.profileId} gesture={panGesture}>
        <Animated.View style={[styles.cardSlot, topCardStyle]}>
          <MatchCard
            profile={profile}
            oppGender={gating.oppGender}
            ownEntryType={gating.ownEntryType}
            femaleFreeEligible={gating.femaleFreeEligible}
            indNumbersLeft={gating.indNumbersLeft}
            onPress={() => navigate(ENavigation.VIEW_PROFILE, { matriId: profile.profileId, fromPage: 'dailyrecommendations' })}
            onLike={() => commitButtonSwipe('like')}
            onDontShow={() => commitButtonSwipe('skip')}
            onViewLater={() => commitButtonSwipe('viewlater')}
            onCall={() => {}}
            onWhatsApp={() => {}}
            onMessage={() => handleMessage(profile)}
            singlePhoto
            hideVerifiedBadge
            photoHeight={DR_PHOTO_H}
          />
          <Animated.View style={[styles.stamp, styles.stampLike, likeStampStyle]} pointerEvents="none">
            <Text style={styles.stampText}>{t('GENERAL.LIKE_CTA').replace('#HER_HIM#', '').trim()}</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampSkip, viewLaterStampStyle]} pointerEvents="none">
            <Text style={styles.stampText}>
              {leftStampKind === 'skip' ? t('DAILYRECOMMENDATIONS.SKIP') : t('GENERAL.VIEWLATER')}
            </Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    )
  }

  // ── Desktop web layout (Figma "Jodii Desktop") ──────────────────────────────
  // Wide browser window only — mobile/native/narrow-web keep the JSX below,
  // untouched, sharing all the same state/handlers defined above. No drag/
  // tutorial/fly-off here — Figma's desktop card has no swipe affordance, just
  // the three action buttons, so the parent's mobile-only gesture state
  // (cardX/cardY/panGesture/tutorial overlay) simply isn't used on this path.
  if (isDesktop) {
    return (
      <>
        <DailyRecommendationDesktopLayout
          langCode={i18n.language}
          onTabPress={tab => handleFooterTabPress(navigation, tab)}
          onLanguagePress={() => navigation.navigate('LanguageSelection')}
          oppGender={gating.oppGender}
          contentLoaded={contentLoaded}
          profiles={profiles}
          currentIndex={currentIndex}
          totalCount={totalCount}
          showEndCard={showEndCard}
          progressPct={progressPct}
          onClose={handleClose}
          onLike={() => commitButtonSwipe('like')}
          onDontShow={() => commitButtonSwipe('skip')}
          onViewLater={() => commitButtonSwipe('viewlater')}
          onViewProfile={p => navigate(ENavigation.VIEW_PROFILE, { matriId: p.profileId, fromPage: 'dailyrecommendations' })}
        />

        <BottomSheet
          visible={!!photoPopupSheet}
          type="photoPopUp"
          data={photoPopupSheet ?? undefined}
          onClose={() => setPhotoPopupSheet(null)}
          onPrimaryPress={() => setPhotoPopupSheet(null)}
        />

        <BottomSheet
          visible={limitSheet.visible}
          type="limitReachInfo"
          data={{
            title:    t('MATCHES.LIMIT_REACHED'),
            content:  limitSheet.body ?? t('MATCHES.LIMIT_REACHED_SUB'),
            image:    `${CDN_SVG}revamp/alert-circle.svg`,
            ctaLabel: t('GENERAL.GOT_IT'),
            showClose: true,
          }}
          onClose={() => setLimitSheet({ visible: false })}
          onPrimaryPress={() => setLimitSheet({ visible: false })}
        />
      </>
    )
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {!contentLoaded ? (
          <View style={styles.loaderContainer}>
            <LottieView source={{ uri: LOTTIE.loader }} autoPlay loop style={styles.loaderLottie} />
          </View>
        ) : (
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.headerText} numberOfLines={1}>{headerText}</Text>
              <Pressable onPress={handleClose} hitSlop={8}>
                {/* Angular: .close-icon { font-size: 6.7vw; } — ~27px on a
                    typical 400px-wide phone, not 22. */}
                <CdnSvg uri={`${CDN_SVG}revamp/close-icon.svg`} width={27} height={27} />
              </Pressable>
            </View>

            <View style={styles.cardStack}>
              {[2, 1, 0].map(i => {
                const profile = visible[i]
                if (!profile) return null
                return i === 0 ? renderTopCard(profile) : renderStackedCard(profile, i)
              })}

              {showEndCard && (
                <View style={styles.endCard}>
                  <LottieView source={{ uri: LOTTIE.success }} autoPlay loop style={styles.endLottie} />
                  <Text style={styles.endTitle}>{t('DAILYRECOMMENDATIONS.END_CARD_TXT_1')}</Text>
                  <Text style={styles.endSub}>{t('DAILYRECOMMENDATIONS.END_CARD_TXT_2')}</Text>
                  {/* Angular: .progress-bar (daily-recommendation.component
                      .scss:132-138) fills with linear-gradient(90deg, #fff,
                      #B50033) — it fades in from white on the left to the
                      brand red at the leading edge, not the flat block of
                      colour this port drew. */}
                  <View style={styles.progressTrack}>
                    <LinearGradient
                      colors={['#ffffff', '#B50033']}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={[styles.progressFill, { width: `${progressPct}%` }]}
                    />
                  </View>
                </View>
              )}
            </View>

            {(showRightSwipe || showLeftSwipe) && (
              <View style={styles.tooltipOverlay}>
                {showRightSwipe && (
                  <View style={styles.tooltipContent}>
                    <LottieView source={{ uri: LOTTIE.swipeRight }} autoPlay loop style={styles.tooltipLottie} />
                    <Text style={styles.tooltipText}>{t('DAILYRECOMMENDATIONS.SWIPE_RIGHT')}</Text>
                  </View>
                )}
                {showLeftSwipe && (
                  <View style={styles.tooltipContent}>
                    <LottieView source={{ uri: LOTTIE.swipeLeft }} autoPlay loop style={styles.tooltipLottie} />
                    <Text style={styles.tooltipText}>{t('DAILYRECOMMENDATIONS.SWIPE_LEFT')}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        <BottomSheet
          visible={!!photoPopupSheet}
          type="photoPopUp"
          data={photoPopupSheet ?? undefined}
          onClose={() => setPhotoPopupSheet(null)}
          onPrimaryPress={() => setPhotoPopupSheet(null)}
        />

        <BottomSheet
          visible={limitSheet.visible}
          type="limitReachInfo"
          data={{
            title:    t('MATCHES.LIMIT_REACHED'),
            content:  limitSheet.body ?? t('MATCHES.LIMIT_REACHED_SUB'),
            image:    `${CDN_SVG}revamp/alert-circle.svg`,
            ctaLabel: t('GENERAL.GOT_IT'),
            showClose: true,
          }}
          onClose={() => setLimitSheet({ visible: false })}
          onPrimaryPress={() => setLimitSheet({ visible: false })}
        />

        <BottomSheet
          visible={!!messageInfoSheet}
          type="profileValidation"
          data={messageInfoSheet ?? undefined}
          onClose={() => setMessageInfoSheet(null)}
          onPrimaryPress={() => setMessageInfoSheet(null)}
        />
      </SafeAreaView>
    </ScreenBackground>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradientFill: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderLottie: {
    width: 80,
    height: 80,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  // Angular: .custom-header span is `heading4-medium-16` — font16, Poppins-
  // Medium, weight 500. No color class on it, so it inherits Ionic's default
  // black (#000000), not textPrimary (#111111).
  headerText: {
    fontFamily: Fonts.poppinsMedium,
    fontSize:   FontSize.font16,
    fontWeight: '500',
    color:      Colors.black,
    flexShrink: 1,
  },
  cardStack: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cardSlot: {
    position: 'absolute',
    width:    SW - 32,
  },
  // Angular: matches-card.component.scss's .swipe-text-overlay/.skip-background —
  // a solid-fill badge, fixed per-action position (not one that follows the drag
  // direction/finger): Like is always the left/green one, ViewLater/Skip always
  // the right/pink one.
  stamp: {
    position:          'absolute',
    top:               15,
    paddingHorizontal: 10,
    paddingVertical:   10,
    borderRadius:      12,
  },
  stampLike: {
    left:            24,
    backgroundColor: '#029664',
  },
  stampSkip: {
    right:           24,
    backgroundColor: '#DE2A68',
  },
  // Angular: matches-card.component.html's swipe-text-overlay label is
  // `heading2-semibold-18` — font18, Poppins-SemiBold, weight 600, white
  // (already correct here) — only the font family was missing.
  stampText: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   FontSize.font18,
    fontWeight: '600',
    color:      '#FFFFFF',
  },
  // Angular: .viewed-all-banner (daily-recommendation.component.scss:78-88)
  // — border-radius 20, 1px solid #ccc, background #fff, padding 24px 16px
  // 48px. Everything matched except the border colour: #ccc is Colors.borderLight
  // (#cccccc), not Colors.border (#dddddd).
  endCard: {
    width:             '100%',
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       Colors.borderLight,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 16,
    paddingTop:        24,
    paddingBottom:     48,
    alignItems:        'center',
    overflow:          'hidden',
  },
  endLottie: {
    height: 140,
    width:  140,
  },
  // Angular: .note-one is `heading3-semibold-16` — font16, Poppins-SemiBold,
  // weight 600. No color class, so it inherits black, not textPrimary.
  endTitle: {
    marginTop:  16,
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   FontSize.font16,
    fontWeight: '600',
    color:      Colors.black,
    textAlign:  'center',
  },
  // Angular: .note-two is `body2-regular-14` — font14, Poppins-Regular,
  // weight 400. No color class, so it inherits black, not textSecondary.
  endSub: {
    marginTop:  20,
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   FontSize.font14,
    color:      Colors.black,
    textAlign:  'center',
  },
  progressTrack: {
    position:        'absolute',
    left:             0,
    right:            0,
    bottom:           0,
    height:           10,
    width:            '100%',
    backgroundColor:  Colors.surface,
  },
  // Angular: height 100%, border-radius 10, gradient fill (applied inline via
  // LinearGradient above — RN styles can't express a gradient background).
  progressFill: {
    height:       '100%',
    borderRadius: 10,
  },
  tooltipOverlay: {
    position:          'absolute',
    left:               0,
    right:              0,
    bottom:             0,
    flexDirection:      'row',
    justifyContent:     'center',
    paddingVertical:    30,
    backgroundColor:    'rgba(255,255,255,0.95)',
  },
  tooltipContent: {
    alignItems: 'center',
  },
  tooltipLottie: {
    width:  80,
    height: 80,
  },
  // Angular: the SWIPE_RIGHT/SWIPE_LEFT tooltip label is
  // `heading2-semibold-18 ... black-color` — font18 (not 16), Poppins-
  // SemiBold, weight 600, explicit black.
  tooltipText: {
    marginTop:  4,
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   FontSize.font18,
    fontWeight: '600',
    color:      Colors.black,
    textAlign:  'center',
  },
})
