import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem, getJson, setJson, removeItem } from './storageService'
import { resetTo } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'
import { redirectToIntermediatePage } from './paymentService'

const DR_LIMIT = 15

// ─── callingDailyRecommendationAPI ───────────────────────────────────────────
// Caches profiles per calendar day. A date change clears the cache.

export async function callingDailyRecommendationAPI(userId: string): Promise<any[]> {
  const today = new Date().toLocaleDateString('en-GB')

  const drDate = await getItem('DR_DATE')

  if (drDate && drDate !== today) {
    await Promise.all([
      removeItem('DR_DATE'),
      removeItem('DR_PROFILES'),
      removeItem('FIRSTSHORTLISTACTION'),
      removeItem('LASTDRCOUNT'),
    ])
  }

  if (!drDate || drDate !== today) {
    await setItem('DR_DATE', today)
  }

  const cached = await getJson<any[]>('DR_PROFILES')
  if (cached?.length) {
    await setJson('DR_COUNT', cached)
    await removeItem('LASTDRCOUNT')
    return cached
  }

  const params = `ID=${userId}&START=0&LIMIT=${DR_LIMIT}&LIKED=1&VIEWED=1&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1&MYHOME=1`
  const result = await apiCall(Endpoints.listing.dailyRecommendations, 'POST', params)

  if (result?.RESPONSECODE == 1 && result?.ERRCODE == 0 && result?.RESPONSE?.length > 0) {
    const profiles: any[] = result.RESPONSE
    await Promise.all([
      setJson('DR_PROFILES', profiles),
      setJson('DR_COUNT', profiles),
      removeItem('LASTDRCOUNT'),
    ])
    return profiles
  }

  return []
}

// ─── updateDrProfiles ────────────────────────────────────────────────────────
// Called after a user swipes/acts on a profile — removes it from the cache.

export async function updateDrProfiles(oppositeId: string): Promise<void> {
  const cached = await getJson<any[]>('DR_PROFILES')
  if (!cached) return
  const updated = cached.filter((p: any) => String(p.MATRIID) !== String(oppositeId))
  await setJson('DR_PROFILES', updated)
}

// ─── loadDrProfiles ──────────────────────────────────────────────────────────
// Main entry point: fetch → navigate to daily-recommendations or fallback.

export async function loadDrProfiles(
  userId: string,
  fromPage = '',
  fallback: string = ENavigation.MATCHES,
): Promise<void> {
  if (!userId) {
    resetTo(fallback)
    return
  }

  const profiles = await callingDailyRecommendationAPI(userId)

  if (profiles.length > 0) {
    await setItem('DR_SHOWN', new Date().toLocaleDateString('en-GB'))

    const shown = await getItem('showDRSwipes')
    if (!shown) await setItem('showDRSwipes', '1')

    // Angular: router.navigate(['dailyrecommendations'], {..., replaceUrl: true})
    resetTo(ENavigation.DAILY_RECOMMENDATIONS, { frm_page: fromPage === 'login' ? 'login' : 'matches' })
    return
  }

  // Angular: dr.service.ts's loadDrProfiles() — when frmPage=='login' (the
  // landingPageHandle()-driven cases: page_ids 5/7/24/27/28/57/59/60) and
  // there are literally zero DR profiles today, it doesn't just fall back to
  // Matches — it calls handleAfterDr(LANDPAGEID) for a further per-page_id
  // redirect. pageId comes from storage (set by pageLandingService.ts before
  // calling here), matching Angular's own localStorage read rather than a
  // threaded parameter.
  if (fromPage === 'login') {
    const pageId = (await getItem('LANDPAGEID')) ?? ''
    await handleAfterDr(pageId)
    return
  }

  resetTo(fallback)
}

// ─── handleAfterDr ───────────────────────────────────────────────────────────
// Onboarding page routing after no DR profiles remain.
// pageId values come from the server-driven NEXTPAGE in login response.
//
// Angular's real targets (dr.service.ts's own handleAfterDr, lines 115-207) —
// verified directly, since ENavigation.HOROSCOPE/VERIFY_ID/PAYMENT/EDIT_FORM/
// PHOTO_REJECTION were never actually registered as navigable screens
// anywhere in AppStack.tsx. navigate()/resetTo() silently no-op on an
// unregistered name (no error, no navigation) — from the user's side this
// looked exactly like "the close button doesn't close", because whichever of
// these 5 cases matched their own LANDPAGEID silently did nothing:
//  - "5" (horoscope) / "20"+"24" (add photo, female) → Angular's own targets
//    are a different route family (editform-pushnotify/:page) this port never
//    built. Routed to the closest real onboarding-style single-field editors
//    instead — GenerateHoroscopeScreen / AddPhotoScreen — via the same
//    navigate('onboarding', {pageNo, standalone:true}) pattern
//    HomeScreen.tsx's own complete-profile-card handler already uses for the
//    identical fields.
//  - "18"/"28"/"32" (payment) → Angular's redirectPaymentPage() is the exact
//    same renewal-vs-recharge decision paymentService.ts's
//    redirectToIntermediatePage() already implements (used by
//    pageLandingService.ts's cases 6/10/15/16/26/32) — reused directly rather
//    than a second navigate() to an unregistered 'payment' screen.
//  - "57" (photo rejection) → Angular's own conditional target
//    (/addphoto-intermediate/photorejection, only when PHOTOSTATUSARRAY
//    matches a specific rejection shape, else plain /matches) — routed
//    through the same registered addphoto-intermediate screen case 23 built,
//    which safely falls back to Gallery for any non-CONGRATS page rather than
//    silently failing.
//  - "7" (verify-id) has no real screen anywhere in this port yet (same
//    documented gap as pageLandingService.ts's cases 12/17/53) — falls to the
//    same default Matches landing Angular's own unhandled-case default uses.
//
// ALL of these Angular targets use `replaceUrl: true` (confirmed per-case —
// cases 20/24/27/57/59/60's own router.navigate calls, and dr.service.ts's
// redirectPaymentPage() → payment.service.ts's reDirectPage(..., replaceURL
// param explicitly passed as `true` from here) — this REPLACES whatever
// screen called handleAfterDr() (always DR, reached via its own resetTo)
// rather than stacking on top of it. Every branch below uses resetTo(),
// never navigate(), to match — a previous pass here used navigate() for all
// of them, which left DR reachable underneath via the hardware/gesture back
// action even though it was already closed/exhausted on screen.

export async function handleAfterDr(pageId: string | number): Promise<void> {
  const pid = String(pageId)

  switch (pid) {
    case '5':
      resetTo(ENavigation.ONBOARDING, { pageNo: '29', standalone: true })
      break
    case '20':
    case '24':
      resetTo(ENavigation.ONBOARDING, { pageNo: '20', standalone: true })
      break
    case '18':
    case '28':
    case '32':
      await redirectToIntermediatePage('notify', undefined, undefined, true)
      break
    case '27':
      resetTo(ENavigation.ADD_PHOTO_INTERMEDIATE, { page: 'ADDPHOTO' })
      break
    case '57':
      resetTo(ENavigation.ADD_PHOTO_INTERMEDIATE, { page: 'photorejection' })
      break
    case '59':
    case '60':
      resetTo(ENavigation.ADD_PHOTO_INTERMEDIATE, { page: 'ADDPHOTOPUBLISH' })
      break
    case '7':
    default:
      resetTo(ENavigation.MATCHES)
  }
}
