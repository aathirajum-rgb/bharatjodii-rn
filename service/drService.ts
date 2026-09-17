import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem, getJson, setJson, removeItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { resetTo } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'
import { redirectToIntermediatePage, paymentTrack } from './paymentService'
import { fetchMatches } from './homeService'
import { getSessionValue } from './registrationService'

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

// ─── navigateToMatchesAfterRegistration ──────────────────────────────────────
// Angular: registration.service.ts's navigateToMatches() — "this use only for
// registration flow". registration-revamp.component.ts reaches it via
// navigateToMyProfile() on EVERY completed-onboarding exit (the `nextUrl ==
// '/myprofile'` branch after Dosham, and the viewprofile branch), and it is the
// only reason a just-registered member sees Daily recommendations at all.
//
// The ordering the whole post-registration experience depends on —
//   DR (when today has profiles) -> Matches -> bulk-like modal -> welcome payment
// — is NOT sequenced here. This function only ARMS it:
//   - PAYWALLTYPE '1~2' (pay-wall.service.ts's own map: STARTDAY -> intermediate
//     page type '12', the welcome payment page) makes enablePaywall() fire when
//     Matches finally calls it — which MatchesScreen does only after the
//     bulk-like modal resolves, so the payment page always lands last.
//   - 'bulklikechk' was already armed at insert time (registrationService.ts's
//     own handleRegistrationSuccess() equivalent) and is consumed, once, on the
//     next Matches load.
//   - loadDrProfiles() below decides DR-vs-Matches for the first hop.
//
// Angular keeps this in registration.service.ts; it lives here purely to keep the
// module graph acyclic — drService -> paymentService -> registrationService is an
// existing edge, so registrationService -> drService would close a cycle.

export async function navigateToMatchesAfterRegistration(): Promise<void> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''

  // Angular reads PAYMENTWALL, defaults it to {'PAYWALLFLAG':'0'} when absent,
  // then overwrites both fields and writes the OBJECT back (never an array).
  const stored = await getJson<any>(SK.Payment.PAYMENT_WALL)
  const current = (Array.isArray(stored) ? stored[0] : stored) ?? { PAYWALLFLAG: '0' }
  await setJson(SK.Payment.PAYMENT_WALL, { ...current, PAYWALLTYPE: '1~2', PAYWALLFLAG: '1' })

  // Registration is over — the resume-into-onboarding pointer must not survive it
  // (AuthContext and pageLandingService both resume onto REGISTERURL on cold start).
  await removeItem('REGISTERURL')
  await setItem('LASTAPPLOGINAT', new Date().toISOString())

  // Angular: loadDrProfiles(id, 'dailyrecommendations', 'matches', common, 'registration')
  // — 'registration' collapses to frm_page 'matches' inside loadDrProfiles (its own
  // getFromPage()=='registration' ? 'matches' mapping), and 'matches' is the
  // fallback used when today has no DR profiles left.
  await loadDrProfiles(userId, 'registration', ENavigation.MATCHES)
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

// Angular: payment.service.ts's checkBrowserPayment() — despite the name it is
// just `RPAYFLAG == '1'`, i.e. a Razorpay checkout is already mid-flight. Same
// flag, same meaning as inAppNotificationService.ts's own payment-failure
// branch, which is this port's established precedent for reading it.
async function checkBrowserPayment(): Promise<boolean> {
  return (await getItem(SK.Payment.RPAY_FLAG)) === '1'
}

// Angular: dr.service.ts's redirectPaymentPage() — reDirectPage(packId,
// 'notify', S&FPROMOTION ?? '7', '1', true). The promotion type is NOT
// forwarded here: RechargeScreen already falls back to that exact
// `S&FPROMOTION ?? '7'` default when it is given no override, so passing it
// would be the same request with an extra read. replace=true matches Angular's
// own replaceUrl — this stands in for the (already closed) DR screen.
async function redirectPaymentPage(): Promise<void> {
  await redirectToIntermediatePage('notify', undefined, undefined, true)
}

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

    // Angular: dr.service.ts case "18" (paymentfailure) branches on
    // checkBrowserPayment(); this port collapsed both arms into the generic
    // redirect, so the dedicated payment-failed screen was unreachable from
    // here. Only the RPAYFLAG=='1' arm is the generic intermediate page — every
    // other case is the payment-failed detail screen, cached exactly the way
    // pageLandingService.ts's own case "18" already does it.
    case '18':
      if (await checkBrowserPayment()) {
        // Angular: `if (frmPage != '') FUNC.setPaymentPageType('1')`.
        // handleAfterDr is only ever reached with frmPage=='login'
        // (loadDrProfiles' own guard above), so the condition is always true.
        await setItem('PAYMENTPAGETYPE', '1')
        await redirectPaymentPage()
      } else {
        await Promise.all([
          setItem('PAYMENT_FAILED', '1'),
          setItem('PAYMENTFAILTYPE', '1'),
        ])
        resetTo(ENavigation.PAYMENT_FAILED)
      }
      break

    // Angular: cases "28"/"32" run paymentTrack(46) and setPaymentPageType('1')
    // BEFORE redirecting — neither was ported, so the promo page opened
    // untracked and without its intermediate-page theme flag.
    case '28':
    case '32':
      await paymentTrack(46)
      await setItem('PAYMENTPAGETYPE', '1')
      await redirectPaymentPage()
      break

    // Angular: case "27" — the ADDPHOTO intermediate is only shown when the
    // member actually has matches to show behind it (callingListAPI() → TOTAL
    // > 0). With none, Angular falls back to the plain add-photo edit form
    // (editform-pushnotify/20), the same target case "24" uses. This port
    // showed the intermediate unconditionally.
    case '27': {
      let total = 0
      try {
        total = (await fetchMatches(0, 20)).totalCount
      } catch {
        total = 0
      }
      if (total > 0) {
        resetTo(ENavigation.ADD_PHOTO_INTERMEDIATE, { page: 'ADDPHOTO' })
      } else {
        resetTo(ENavigation.ONBOARDING, { pageNo: '20', standalone: true })
      }
      break
    }

    // Angular: case "57" — the photo-rejection intermediate is gated on
    // PHOTOSTATUSARRAY ((MULTIREJECTED 'Y'|'N') && STATUS=='R'); anything else
    // lands on plain Matches. This port ignored the gate entirely, so a member
    // with no rejected photo was still sent to the rejection screen (which, not
    // being ported yet, drops them on Gallery — see
    // AddPhotoIntermediateScreen.tsx's own header note).
    case '57': {
      const raw = await getSessionValue(SK.Profile.PHOTO_STATUS_ARRAY)
      // Angular keeps this as a JSON STRING in localStorage and parses it;
      // storeWebURLData() stashes whatever the server sent into the session
      // blob, so it can arrive here already parsed.
      let status: any = raw
      if (typeof raw === 'string') {
        try { status = JSON.parse(raw) } catch { status = null }
      }
      const isRejected =
        (status?.MULTIREJECTED === 'Y' || status?.MULTIREJECTED === 'N') &&
        status?.STATUS === 'R'
      if (isRejected) {
        resetTo(ENavigation.ADD_PHOTO_INTERMEDIATE, { page: 'photorejection' })
      } else {
        resetTo(ENavigation.MATCHES)
      }
      break
    }

    case '59':
    case '60':
      resetTo(ENavigation.ADD_PHOTO_INTERMEDIATE, { page: 'ADDPHOTOPUBLISH' })
      break

    // Angular's default re-enters loadDrProfiles(nbId, 'dailyrecommendations',
    // 'matches') — but handleAfterDr is only reached when DR came back empty,
    // so that re-entry resolves to the same plain Matches landing. Kept as the
    // direct landing rather than a redundant second DR fetch.
    case '7':
    default:
      resetTo(ENavigation.MATCHES)
  }
}
