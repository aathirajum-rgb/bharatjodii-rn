// Angular: pages/webview/webview.page.ts's pageLandingFunc() — the server-driven
// post-login/post-autologin routing decision, keyed by a numeric page_id (Angular
// route param :page_id, embedded as the trailing segment of WEBVIEWURL — see
// registrationService.ts's parseAndStoreWebViewURL()).
//
// SCOPED: only page_ids whose Angular target maps to a screen that actually
// exists in this port are handled for real; everything else falls back to
// Matches, matching Angular's own `default: this.router.navigate(["matches"])`.
// Angular's landingType ('notify' for a push-notification tap vs. the default
// real login/autologin landing) isn't modeled here — this only covers the
// non-notify path, since that's the one autologin/refreshSession() drives.
//
// Editform-PCS field-completion prompts — cross-referenced against every
// existing EditProfile* screen's actual saved fields (not guessed from
// numeric coincidence — case 44's Angular target "editform-PCS/3" pointed at
// GenderScreen by onboarding pageNo, but its own comment/NAMEUPIAPI hint says
// Name; the field, not the number, is what's trusted here):
//  - 38 (Country & State), 39 (City), 44 (Name): all three land on
//    EditProfileBasic — BasicDetailsScreen.tsx already saves NAME,
//    MOTHERTONGUE, and STATE+CITY (composite) together on one screen.
//  - 35 (editform-PCS/44, no confirming Angular comment): tentatively also
//    EditProfileBasic, since BasicDetailsScreen additionally saves
//    HOMESTATE+HOMECITY and RN's own onboarding pageNo 44 is HomeTownLocation
//    — plausible, not confirmed the way 38/39/44/45/46/47 are (each has an
//    explicit Angular comment naming its field).
//  - 45 (Education), 46 (Occupation): EditProfileProfessional
//    (ProfessionalDetailsScreen.tsx saves QUALIFICATION + OCCUPATION).
//  - 47 (Age): EditProfileAgeHeight (same screen as case 42's Height).
//  - 11: cascades through FAMILYPROPERTY → BROTHERS → SISTERS → RAASI → STAR
//    → DOSHAM (Angular's own isValidparam() gate — confirmed: excludes '0'
//    as "not set", so an honest "0 brothers" answer still re-prompts, same
//    as Angular) to EditProfileProperty / EditProfileFamily /
//    EditProfileReligious respectively.
//  - 40 (showReligionDetailsSheet — mother tongue/caste/sub-caste/gothram/
//    home town): no religionDetailsSheet BottomSheetType exists to match
//    Angular's inline sheet; approximated with the closest full screen,
//    EditProfileReligious (covers CASTE/GOTHRA/RAASI/STAR/DOSHAM, though not
//    MOTHERTONGUE — that's on EditProfileBasic instead — or SUBCASTE/home
//    town specifically).
//
// Explicitly NOT implemented (no RN screen/backing API exists yet — falls to
// Matches, same as Angular's own unhandled-default outcome). Verified against
// both the Angular source AND the old native Android project
// (jodii android project/android/app/) for each — none of these are handled
// natively either, so there's no shortcut around building the real RN screen:
// (1 was previously assumed unreachable/N/A here — wrong; it's now
// implemented above as "resume abandoned registration.") Still out of scope:
// case 1's OTHER branch (landingType=='notify', routes to
// likedyou/viewedyou/matches by MSGTYPE) — genuinely implementable the same
// way as 22/54/58, but this whole file only drives the login/autologin path,
// not push-notification-tap landings.
//  - 8: notification list screen doesn't exist. Native Android only renders
//       the push into the system tray (FirebaseInstantMessagingService.kt)
//       and forwards taps to the webview — no native list/history screen.
//  - 12: verify-id screen doesn't exist. Native Android's equivalent is a
//       webview-JS-bridge-triggered camera/upload flow (HomeScreenActivity's
//       onWebAppsClick "trustbadge_file*" cases → ImageUploadService.kt), not
//       a real page — would need a fresh RN camera/upload flow to match.
//  - 17: common.checkUpiFlow() — despite the name, this is an "otpless"
//       KYC/address-proof verification call (verifyidproof API), tied to the
//       same ekyc/BLOCKER state as case 12/BlockerScreen.tsx, NOT the
//       Razorpay/PayU payment flow (which paymentService.ts already fully
//       covers). No native Signzy integration found either.
//  - 30: success-story "intermediate" prompt doesn't exist (SuccessStories is
//       a listing screen, a different flow).
//  - 37: my-membership screen doesn't exist ('recharge' is a plausible rough
//       substitute if wanted later, but a paid user's OWN plan-management
//       page is a distinct feature from the upgrade/recharge flow — not
//       assumed equivalent here).
//  - 49: referral screen doesn't exist. Native Android generates the
//       AppsFlyer referral link natively (HomeScreenActivity's
//       appFlyerInstallReferral()) but has no native UI for it either — the
//       display is webview-driven, and RN has no AppsFlyer native module to
//       replicate the link generation.
//  - 53: id-verify-promo screen doesn't exist (its own target, case 12,
//       doesn't either).
//
// cases "23", "55" and "61" ARE implemented below — earlier passes here
// wrongly concluded their backing screens/functions didn't exist:
//  - 23: addphoto-intermediate/CONGRATS — a "free contacts" promo screen,
//    screens/addphoto-intermediate/AddPhotoIntermediateScreen.tsx. That same
//    file also now backs cases 27/59/60's own targets (ADDPHOTO/ADDPHOTOPUBLISH,
//    called from drService.ts's handleAfterDr(), previously a dangling
//    reference to an unregistered screen name) with a safe Gallery-redirect
//    fallback, not a full port — see that file's own header comment.
//  - 55: discover-matches — screens/discover-matches/DiscoverMatchesScreen.tsx,
//    reusing HomeScreen.tsx's own ExploreCategoriesSection grid (the same
//    category-browse UI Home already shows inline) as a standalone screen.
//  - 61: handleAiProfileValidation — callAiProfileValidation/
//    fetchEditFormValuesForValidation are real, wired Angular functions
//    (registration.service.ts), confirmed by reading the source directly.
//    See screens/validation/ValidationScreen.tsx.

import { loadDrProfiles } from './drService'
import { fetchNotifCount, fetchMatches, fetchNearbyMatches } from './homeService'
import { redirectToIntermediatePage, paymentTrack } from './paymentService'
import { getItem, setItem, setJson } from './storageService'
import { getSessionValue, callAiProfileValidation, fetchEditFormValuesForValidation } from './registrationService'
import { resetTo, navigate } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'

// Angular: Nbcommon.isValidparam(data) default (type=1) — excludes 0/'0' as
// "not set", not just undefined/null/''. Confirmed against common.ts's own
// source rather than assumed, since case 11 below depends on this exact
// behavior (an honest "0 brothers" answer is treated as unanswered, same as
// Angular — not "fixed" here).
function isValidParam(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '' && value !== '-' &&
    value !== 0 && value !== '0' && value !== 'undefined' && value !== 'null'
}

// Angular webview.page.ts: cases "2"/"20" call drService.loadDrProfiles() DIRECTLY
// with frmPage='' (no 5th arg) — on an empty DR result, that's a plain Matches
// landing, nothing more (verified: both cases also do
// localStorage.setItem('pageUrl','matches') right beforehand).
const DR_DIRECT_PAGE_IDS = new Set(['2', '20'])

// Cases "5"/"7"/"24"/"27"/"28"/"57"/"59"/"60" all route through the SHARED
// landingPageHandle(), which calls loadDrProfiles(..., frmPage='login') AND
// localStorage.setItem('LANDPAGEID', pageId) beforehand — on an empty DR
// result, frmPage='login' makes drService.loadDrProfiles() call
// handleAfterDr(LANDPAGEID) instead of a plain Matches landing (a further
// per-page_id redirect: e.g. case "7" → verify-id, case "57" → photo-rejection).
// Previously this file passed frmPage='login' to ALL 10 of these page_ids
// uniformly, and drService.ts's loadDrProfiles() never called handleAfterDr at
// all on empty — so every one of these 8 silently fell back to Matches on an
// empty DR result, and DailyRecommendationScreen.tsx's OWN handleAfterDr call
// (navigateAway(), for the exhausted/closed-DR case) was reading a LANDPAGEID
// that was never being set, so it always saw '' too. Fixed in both files.
const DR_SHARED_PAGE_IDS = new Set(['5', '7', '24', '27', '28', '57', '59', '60'])

export async function handlePageLanding(pageId: string | undefined, userId: string): Promise<void> {
  if (!pageId) {
    resetTo(ENavigation.MATCHES)
    return
  }

  if (DR_DIRECT_PAGE_IDS.has(pageId)) {
    await loadDrProfiles(userId, '', ENavigation.MATCHES)
    return
  }

  if (DR_SHARED_PAGE_IDS.has(pageId)) {
    await setItem('LANDPAGEID', pageId)
    // Angular case "28": localStorage.setItem('aadiOffer','1') before, and
    // FUNC.setPaymentPageType('1') after, landingPageHandle()'s loadDrProfiles call.
    if (pageId === '28') await setItem('aadiOffer', '1')
    await loadDrProfiles(userId, 'login', ENavigation.MATCHES)
    if (pageId === '28') await setItem('PAYMENTPAGETYPE', '1')
    return
  }

  switch (pageId) {
    // case "3": edit-profile
    case '3':
      resetTo('EditProfile')
      return

    // case "4": notify/managephoto — Gallery is this port's photo-management
    // screen; the closest real equivalent to Angular's dedicated managephoto route.
    case '4':
      resetTo('Gallery')
      return

    // cases "41"/"42": editform-PCS Marital-status/Height prompts — reuse the
    // existing EditProfileMarital/EditProfileAgeHeight screens (built for an
    // existing user updating one field: correct save endpoint via
    // editProfileService, exits via goBack() rather than advancing a wizard —
    // verified before wiring, see conversation history). navigate (not
    // resetTo, unlike every other case here) — goBack() needs a screen
    // underneath to return to.
    case '41':
      navigate('EditProfileMarital')
      return
    case '42':
      navigate('EditProfileAgeHeight')
      return

    // cases "38"/"39"/"44": Country & State / City / Name — all saved
    // together on EditProfileBasic (BasicDetailsScreen.tsx).
    case '38':
    case '39':
    case '44':
      navigate('EditProfileBasic')
      return

    // case "35": editform-PCS/44, no confirming Angular comment — tentative
    // HomeTown mapping (see header comment above).
    case '35':
      navigate('EditProfileBasic')
      return

    // cases "45"/"46": Education / Occupation — EditProfileProfessional
    // (ProfessionalDetailsScreen.tsx saves QUALIFICATION + OCCUPATION).
    case '45':
    case '46':
      navigate('EditProfileProfessional')
      return

    // case "47": Age — same screen as case 42's Height.
    case '47':
      navigate('EditProfileAgeHeight')
      return

    // case "40": showReligionDetailsSheet() — approximated with the closest
    // full screen (see header comment on the MOTHERTONGUE/SUBCASTE/home-town gap).
    case '40':
      navigate('EditProfileReligious')
      return

    // case "11": cascades through the first unanswered field, in Angular's
    // exact order, to whichever EditProfile* screen owns it.
    case '11': {
      const [familyProperty, brothers, sisters, raasi, star, dosham] = await Promise.all([
        getSessionValue('FAMILYPROPERTY'),
        getSessionValue('BROTHERS'),
        getSessionValue('SISTERS'),
        getSessionValue('RAASI'),
        getSessionValue('STAR'),
        getSessionValue('DOSHAM'),
      ])
      if (!isValidParam(familyProperty)) {
        navigate('EditProfileProperty')
      } else if (!isValidParam(brothers) || !isValidParam(sisters)) {
        navigate('EditProfileFamily')
      } else if (!isValidParam(raasi) || !isValidParam(star) || !isValidParam(dosham)) {
        navigate('EditProfileReligious')
      } else {
        resetTo(ENavigation.MATCHES)
      }
      return
    }

    // cases "9"/"33": activity
    case '9':
    case '33':
      resetTo('Activity')
      return

    // case "13": bynewlyjoined — same explore-by-category mode HelpCenterScreen.tsx
    // already uses, rather than Angular's own separate matches/bynewlyjoined route.
    case '13':
      resetTo(ENavigation.MATCHES, { exploreType: 'NEYLYJOINED', exploreLabel: 'Newly joined' })
      return

    // case "14": search
    case '14':
      resetTo('Search')
      return

    // case "18": recharge/payment-failed
    case '18':
      await setItem('PAYMENT_FAILED', '1')
      await setItem('PAYMENTFAILTYPE', '1')
      resetTo(ENavigation.PAYMENT_FAILED)
      return

    // case "19": own profile view
    case '19':
      resetTo(ENavigation.VIEW_PROFILE, { matriId: userId, fromPage: 'notify' })
      return

    // case "21": star matches — Angular jumps straight into viewing the top-scored
    // profile (callingListAPI('starmatches')); simplified to the listing screen
    // itself rather than replicating that fetch-then-viewprofile jump.
    case '21':
      resetTo('star-matching')
      return

    // case "25": female-free-flow landing — simplified to a plain Matches landing;
    // MatchesScreen doesn't currently consume a femaleFreeFlow param.
    case '25':
      resetTo(ENavigation.MATCHES)
      return

    // case "29": qrcodeCongrats — Angular's recharge/congratulations
    case '29':
      await setItem('PAYSUCCESSLANDING', '1')
      resetTo(ENavigation.PAYMENT_SUCCESS)
      return

    // case "31": renewal promotions
    case '31':
      resetTo(ENavigation.RENEWAL)
      return

    // case "34": FAQ video landing — simplified to plain Matches (no faqVideo
    // banner wiring in MatchesScreen yet).
    case '34':
      resetTo(ENavigation.MATCHES)
      return

    // case "36": chat/messages landing — Angular jumps into one specific chat
    // room (no such screen exists yet); simplified to the chat list.
    case '36':
      resetTo('MessagerList')
      return

    // case "50": hand-picked-matches landing — no dedicated screen; simplified
    // to plain Matches.
    case '50':
      resetTo(ENavigation.MATCHES)
      return

    // case "52": non-ID-verify-user landing — simplified to plain Matches.
    case '52':
      resetTo(ENavigation.MATCHES)
      return

    // case "56": likedbyme-driven landing — genuinely implementable with
    // existing infra (fetchNotifCount is already ported).
    case '56': {
      const { comCount } = await fetchNotifCount()
      const likedbyme = comCount.find(c => c.comtype === 'likedbyme' && Number(c.totalCount) > 0)
      if (likedbyme) {
        resetTo('Activity', { activityType: 'likesent' })
      } else {
        resetTo(ENavigation.MATCHES)
      }
      return
    }

    // cases "6"/"10"/"15"/"16"/"26"/"32": various payment-track-then-redirect
    // landings (Angular: redirectPaymentPage()/reDirectPage()) — RN's
    // redirectToIntermediatePage() is the equivalent, landing on recharge or
    // renewal depending on this account's renewal-flag state. Case "16"
    // simplified: Angular preselects a specific PAYMENTPACKAGE on a dedicated
    // payment-mode route when one was passed; that preselect isn't wired
    // here, only its own fallback path (identical to 6/10/15/26/32) is.
    case '6':
    case '10':
    case '15':
    case '16':
    case '26':
    case '32':
      if (pageId === '6' || pageId === '10' || pageId === '32') await paymentTrack(46)
      if (pageId === '26') await paymentTrack(32)
      await redirectToIntermediatePage('notify')
      return

    // case "43": biodata-intermediate landing — simplified to a plain Matches
    // landing; MatchesScreen doesn't currently consume a bioData param.
    // (Same outcome as the default case below — kept explicit so this page_id
    // isn't confused with the genuinely-unhandled ones.)
    case '43':
      resetTo(ENavigation.MATCHES)
      return

    // case "51": Jodii fraud blocker — screens/verify/BlockerScreen.tsx.
    case '51':
      resetTo('BlockerPage')
      return

    // case "55": discover-matches — plain navigation, no pre-fetch (the screen
    // itself fetches its own category/count data on mount).
    case '55':
      resetTo(ENavigation.DISCOVER_MATCHES)
      return

    // case "23": addphoto-intermediate/CONGRATS — plain navigation, the screen
    // itself reads the free-contact promo details from session storage.
    case '23':
      resetTo(ENavigation.ADD_PHOTO_INTERMEDIATE, { page: 'CONGRATS' })
      return

    // case "1": goToRegistrationPage() — resume an abandoned registration at
    // its last saved step (REGISTERURL, persisted centrally by
    // AppStack.tsx's OnboardingRouter). This IS reachable for an existing
    // autologin'd user: mobile+OTP verified (so token+userId exist) but the
    // onboarding wizard itself was abandoned partway — the backend's own
    // page_id=1 is how it signals "still incomplete." Angular's other two
    // goToRegistrationPage() branches (webLogin=='1' signin bounce; brand-new
    // /registration/1 start) don't apply here since NBID is always valid by
    // the time this dispatch runs — they only matter for a user who's never
    // verified OTP at all, which can't reach this file's dispatch anyway.
    case '1': {
      const registerUrl = await getItem('REGISTERURL')
      if (registerUrl) {
        resetTo(ENavigation.ONBOARDING, { pageNo: registerUrl })
      } else {
        resetTo(ENavigation.MATCHES)
      }
      return
    }

    // case "22": nearbymatches — Angular's callingListAPI("nearbymatches") hits
    // its own dedicated endpoint (not the generic explore/v1 FILTERTYPE
    // mechanism case 13 uses) and jumps straight to the first result's
    // viewprofile (vpUrl = `nearbymatches/viewprofile/${id}`), same shape as
    // cases 54/58 but via fetchNearbyMatches().
    case '22': {
      const result = await fetchNearbyMatches(0, 20)
      const first = result.items[0]
      if (first?.profileId) {
        resetTo(ENavigation.VIEW_PROFILE, { matriId: first.profileId, fromPage: 'nearbymatches' })
      } else {
        resetTo(ENavigation.MATCHES)
      }
      return
    }

    // case "54": JA-88 notification landing (callingListAPI("matches","notify",msgType));
    // case "58": YTBV matches landing (callingListAPI("matches","notify")) — both
    // Angular fetches a matches page and jumps straight into viewing the first
    // profile; case "54"'s msgType only adds an extra query param to that same
    // API call, not a different routing target. Genuinely implementable with
    // existing infra (fetchMatches + the viewProfile screen).
    case '54':
    case '58': {
      const result = await fetchMatches(0, 20)
      const first = result.items[0]
      if (first?.profileId) {
        resetTo(ENavigation.VIEW_PROFILE, { matriId: first.profileId, fromPage: 'notify' })
      } else {
        resetTo(ENavigation.MATCHES)
      }
      return
    }

    // case "61": handleAiProfileValidation() — call the AI check (type=2, per
    // Angular's own webview.page.ts case 61), stash the violated fields for
    // ValidationScreen.tsx to read on mount, refresh REGISTRATIONVALUES from
    // the live profile, then land on /validation — exactly mirroring Angular's
    // own success/failure branching (any failure at any step → Matches).
    case '61': {
      const resp = await callAiProfileValidation(userId, 2)
      if (String(resp?.ERRCODE ?? '') !== '0') {
        resetTo(ENavigation.MATCHES)
        return
      }
      const violationList = resp?.RESPONSE?.VIOLATIONFIELD
      if (violationList) await setJson('VIOLATIONFIELDS', violationList)
      const info = await fetchEditFormValuesForValidation()
      resetTo(info ? ENavigation.VALIDATION : ENavigation.MATCHES)
      return
    }

    default:
      // Angular's own default: this.router.navigate(["matches"]) — also covers
      // every page_id whose real Angular target (verify-id, editform-PCS/*,
      // notification, my-membership, referral, id-verify-promo, chat-window,
      // fraud blocker, AI-profile-validation, etc.) has no RN screen yet.
      resetTo(ENavigation.MATCHES)
  }
}
