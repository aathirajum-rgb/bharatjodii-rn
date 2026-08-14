// Angular: pages/notification/notification.page.ts — the in-app notification
// list screen (NOT push notifications — that's service/notificationService.ts,
// a separate, pre-existing file this must not collide with). Pure data-shaping
// logic lives here; NotificationScreen.tsx owns the socket wiring
// (emitNotificationDetails/onNotificationList/emitReadNotification — all
// already built in service/socketService.ts, nothing new needed there) and
// rendering.
//
// SCOPE: getUrl()'s ~90-case notification-type → destination router is
// deferred entirely to a follow-up pass — getNotificationRedirect() below
// only implements the cases pointing at screens that already exist in this
// port; everything else falls back to Matches, exactly matching Angular's
// own `default: url = '/matches'` for unhandled cases (not a shortcut this
// port invented).
import { CDN_SVG, CDN_LOTTIE } from '../constants/cdn'
import { getOppGenderAvatarUrl } from '../utils/avatar'
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem } from './storageService'
import { StorageKeys } from '../constants/storage.keys'
import { redirectToViewProfile } from './buttonService'
import { navigate, resetTo } from '../utils/navigationRef'
import { emitReadNotification } from './socketService'
import { ENavigation } from '../types/enums/navigation.enum'
import { paymentTrack, redirectToIntermediatePage } from './paymentService'
import { loadDrProfiles } from './drService'
import { getRegistrationArrays } from './registrationService'
import {
  getPastingTime, computeNotificationBucketBoundaries, classifyNotificationBucket,
} from '../adapters/notification.adapter'
export { parseRichNotificationText, type RichTextSegment } from '../adapters/notification.adapter'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationItem {
  ngrpid:           string
  notificationtype: number
  senderid:         string
  readstatus:       number         // 0 = unread
  title1:           string
  avatarUrl:        string         // parsed from notificationdetails[0]
  detailText:       string         // parsed from notificationdetails[1]
  image?:           string | undefined
  ctaLabel?:        string | undefined
  getTime:          string         // "Now" / "5m" / "2h" / "" (Angular: empty past 1 day)
  dateadded:        Date
}

export interface GroupedNotifications {
  today:     NotificationItem[]
  yesterday: NotificationItem[]
  thisWeek:  NotificationItem[]
  lastWeek:  NotificationItem[]
  isEmpty:   boolean   // true only when the raw list itself was empty (Angular:
                        // NotificationList.length === 0) — items older than the
                        // last-week window are silently dropped, same as source,
                        // and that does NOT count as "empty".
}

const ICON_LIKED = `${CDN_SVG}liked-pink-notification.svg`
const ICON_EYE   = `${CDN_SVG}eye-notification.svg`
export const NOTIFICATION_EMPTY_ANIM  = `${CDN_LOTTIE}notification-empty.json`
// Angular's actual asset filename has this typo ("loding") — kept verbatim,
// not "fixed", since renaming it here wouldn't match what the CDN serves.
export const NOTIFICATION_LOADING_ANIM = `${CDN_LOTTIE}notification-loding-screen.json`

// Angular: [1].includes(type) → liked-pink overlay; [2].includes(type) → eye overlay.
export function getOverlayIcon(notificationType: number): string | null {
  if (notificationType === 1) return ICON_LIKED
  if (notificationType === 2) return ICON_EYE
  return null
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

// Angular: parseNotificationDetail() — "img~text" format; falls back to a
// default avatar + the whole raw string as text when there's no '~'.
export async function parseNotificationDetail(raw: string | undefined): Promise<{ avatarUrl: string; text: string }> {
  const value = raw ?? ''
  if (value.includes('~')) {
    const [avatarUrl, text] = value.split('~')
    return { avatarUrl: avatarUrl ?? '', text: text ?? '' }
  }
  return { avatarUrl: await getOppGenderAvatarUrl(), text: value }
}

// Angular: title1/notificationdetails[1] are both bound with [innerHTML] —
// live payloads wrap the sender's name in <span class='name-notification'>
// (bold, notification.page.scss) — see parseRichNotificationText() in
// adapters/notification.adapter.ts (re-exported above) for how that's parsed
// into boldable segments for RN's <Text>, which doesn't interpret HTML.

// Angular: common.ts checkPhotoLimit() — true while the login user's current
// PHOTOCOUNT is still under REGISTRATIONARRAYS.MAXPHOTOADD (server-configured
// per-account photo cap). Both are already tracked in this port: PHOTOCOUNT
// via profileService.ts/buttonService.ts, REGISTRATIONARRAYS via
// registrationService.ts's getRegistrationArrays() (cache-then-fetch, same
// initialfetch endpoint Angular's own inline fallback branch calls).
async function checkPhotoLimit(): Promise<boolean> {
  const photoCount = Number((await getItem('PHOTOCOUNT')) ?? '0')
  const registrationArrays = await getRegistrationArrays()
  const maxPhotoLimit = Number(registrationArrays['MAXPHOTOADD'] ?? 0)
  return photoCount < maxPhotoLimit
}

// Angular: addCTAContent() — only these type groups ever get a CTACONTENT
// value; types 6/7 set differently-named fields the template never reads
// (VIEWPHOTO_CTA/VIEWHOROSCOPE_CTA, dead code in the real app too — not an
// omission here), so they render with no CTA button at all, same as source.
// Type 11 additionally requires checkPhotoLimit() in the template's *ngIf
// (notification.page.html lines 96/104) — every other CTA type has no such
// gate, only this one.
async function getCtaLabel(notificationType: number, t: (key: string) => string): Promise<string | undefined> {
  if ([1, 2, 3].includes(notificationType)) return t('NOTIFICATION.VIEWPROFILE_CTA')
  if (notificationType === 11) {
    return (await checkPhotoLimit()) ? t('NOTIFICATION.ADDPHOTO_CTA') : undefined
  }
  if ([4, 21, 47, 48].includes(notificationType)) return t('NOTIFICATION.ADDPHOTO_CTA')
  if ([5, 24].includes(notificationType)) return t('NOTIFICATION.ADDHOROSCOPE_CTA')
  return undefined
}

// ─── Grouping ─────────────────────────────────────────────────────────────────
// Day-of-month bucket boundaries + per-item classification now live in
// adapters/notification.adapter.ts (computeNotificationBucketBoundaries()/
// classifyNotificationBucket()) — pure, testable in isolation. Anything older
// than "last week" falls through every bucket and is silently dropped, same
// as Angular's source (not a bug introduced here).

export async function groupNotifications(
  rawList: Record<string, any>[],
  t: (key: string) => string,
): Promise<GroupedNotifications> {
  if (rawList.length === 0) {
    return { today: [], yesterday: [], thisWeek: [], lastWeek: [], isEmpty: true }
  }

  const boundaries = computeNotificationBucketBoundaries()

  const today: NotificationItem[] = []
  const yesterday: NotificationItem[] = []
  const thisWeek: NotificationItem[] = []
  const lastWeek: NotificationItem[] = []

  for (const raw of rawList) {
    const notificationType = Number(raw['notificationtype'])
    const dateaddedMs = Number(raw['dateadded']) || 0
    const bucket = classifyNotificationBucket(dateaddedMs, boundaries)
    const { avatarUrl, text } = await parseNotificationDetail(raw['notificationdetails'])

    const item: NotificationItem = {
      ngrpid:           String(raw['ngrpid'] ?? ''),
      notificationtype: notificationType,
      senderid:         String(raw['senderid'] ?? ''),
      readstatus:       Number(raw['readstatus'] ?? 1),
      title1:           String(raw['title1'] ?? ''),
      avatarUrl,
      detailText:       text,
      image:            raw['image'] || undefined,
      ctaLabel:         await getCtaLabel(notificationType, t),
      getTime:          getPastingTime(dateaddedMs),
      dateadded:        new Date(dateaddedMs),
    }

    if (bucket === 'today')          today.push(item)
    else if (bucket === 'yesterday') yesterday.push(item)
    else if (bucket === 'thisWeek')  thisWeek.push(item)
    else if (bucket === 'lastWeek')  lastWeek.push(item)
  }

  return { today, yesterday, thisWeek, lastWeek, isEmpty: false }
}

// ─── Redirect (Phase 1 — scoped subset only, see file header) ────────────────

export type NotificationRedirect =
  | { screen: 'Matches' }
  | { screen: 'Activity' }
  | { screen: 'Search' }
  | { screen: 'verify-id' }
  | { screen: 'my-membership' }
  | { screen: 'onboarding'; params: { pageNo: string; standalone: true } }
  | { screen: 'addphoto-intermediate'; params: { page: 'CONGRATS' | 'photorejection' } }
  | { screen: 'HelpCenter' }

// Angular: getUrl() — only the cases pointing at screens this port already
// has are implemented; every other type (including the huge FAQ-video/
// payment-promo/editform/addphoto-intermediate blocks) falls back to Matches,
// same as Angular's own default case for anything its switch doesn't handle.
export function getNotificationRedirect(notificationType: number): NotificationRedirect {
  if ([12, 27, 29, 35, 69].includes(notificationType)) return { screen: 'verify-id' }
  if (notificationType === 105) return { screen: 'my-membership' }
  if ([78, 79].includes(notificationType)) return { screen: 'Search' }
  if (notificationType === 80) return { screen: 'Activity' }
  // Angular: case 5/24 → 'editform/22' (its own editform-page numbering for
  // horoscope). This port's onboarding stepper uses a different numbering for
  // the same field — pageNo '29', the exact target drService.ts's
  // handleAfterDr() case '5' and HomeScreen.tsx's HOROSCOPE complete-profile
  // card already resolve to for this identical action.
  if ([5, 24].includes(notificationType)) {
    return { screen: 'onboarding', params: { pageNo: '29', standalone: true } }
  }
  // Angular: case 9 ('FEMALE FREE SUCCESS') — plain push to
  // addphoto-intermediate/CONGRATS, the exact same target
  // pageLandingService.ts's own case "23" already resolves to for the
  // identical screen (different Angular numbering, same destination).
  if (notificationType === 9) {
    return { screen: 'addphoto-intermediate', params: { page: 'CONGRATS' } }
  }
  // Angular: case 23 ('photo rejected') — real condition checks a
  // PHOTOSTATUSARRAY this port never tracks anywhere; simplified to the
  // unconditional target, matching drService.ts's handleAfterDr() case '57'
  // simplification for the identical underlying screen.
  if (notificationType === 23) {
    return { screen: 'addphoto-intermediate', params: { page: 'photorejection' } }
  }
  // Angular: cases 84-92 open a MODAL, never a navigation — either an FAQ
  // video player for a specific faqtype (FAQVIDEOFLAG=='1', reading a
  // REGISTRATIONARRAYS flag this port doesn't parse anywhere) or a generic
  // "Get Help" popup (customer-care number + report-profile action)
  // otherwise. Neither modal exists in this port; both branches collapse to
  // the closest already-registered destination serving the same "get help"
  // intent — HelpCenterScreen (screens/help-center/HelpCenterScreen.tsx) —
  // rather than a new video-modal/report-modal build, which is out of scope
  // for this routing pass.
  if ([84, 85, 86, 87, 88, 89, 90, 91, 92].includes(notificationType)) {
    return { screen: 'HelpCenter' }
  }
  return { screen: 'Matches' }
}

// ─── Type 56 — Signzy ID verification ────────────────────────────────────────
// Angular: SIGNZYKEY=='1' → '/login/mobile-no-form' (a login-flow mobile
// re-entry screen this port never built — same documented-gap fallback to
// Matches pageLandingService.ts's own cases 12/17/53 use for their own
// missing screens); anything else → '/verify-id', the exact registered
// target types 12/27/29/35/69 already resolve to.
async function getSignzyRedirect(): Promise<NotificationRedirect> {
  const signzyKey = await getItem(StorageKeys.Verification.SIGNZY_KEY)
  if (signzyKey === '1') return { screen: 'Matches' }
  return { screen: 'verify-id' }
}

// ─── Types 1/2/3 — liked you / viewed you / viewed your number ──────────────
// Angular: callingListAPI() — fetch the module's full list, find the sender
// within it and move them to the front (or prepend them if not present),
// then open ViewProfile there with the rest of the list available for
// prev/next swipe. Angular persists this via matriIdDBset() + localStorage;
// this port's equivalent is redirectToViewProfile()'s `profileIds` array
// (already built, used by every other screen with a prev/next profile
// chain — MatchesScreen.tsx, HomeScreen.tsx, etc.), so no new caching
// mechanism was needed here.

type SenderListModule = 'likedyou' | 'viewedyou' | 'whoviewednumber'

// Angular: getUrl()'s params per case — whoviewednumber omits SKIPED=1, the
// other two include it; all three use START=0&LIMIT=20&BANNERFLAG=0.
async function fetchSenderPrependedProfileIds(
  module: SenderListModule,
  senderId: string,
): Promise<string[] | null> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const endpoint = module === 'likedyou' ? Endpoints.listing.likedYou
    : module === 'viewedyou' ? Endpoints.listing.viewedYou
    : Endpoints.listing.whoViewedNumber
  const skipedParam = module === 'whoviewednumber' ? '' : '&SKIPED=1'
  const params = `ID=${userId ?? ''}&START=0&LIMIT=20&BANNERFLAG=0${skipedParam}`

  const res = await apiCall(endpoint, 'POST', params)
  // Angular: API failure or an empty RESPONSE both fall through to a direct
  // single-profile navigation (no swipe list) — null covers both here.
  if (String(res?.['RESPONSECODE']) !== '1' || String(res?.['ERRCODE']) !== '0') return null
  const list: Record<string, any>[] = Array.isArray(res['RESPONSE']) ? res['RESPONSE'] : []
  if (list.length === 0) return null

  const ids = list.map(p => String(p['MATRIID'])).filter(Boolean)
  const senderIndex = ids.indexOf(senderId)
  if (senderIndex > -1) ids.splice(senderIndex, 1)
  ids.unshift(senderId)
  return ids
}

// ─── Types 4/11/21/47/48/50/51/68 — pending-photo gate ──────────────────────
// Angular: getUrl()'s case block for these 8 types shadows the outer `url`
// with a block-local `let url`, so the function's real return value stays ''
// for all of them — reDirectRespectivePage's PI_PHOTOSTATUS=='P' guard (keyed
// off that same outer url) is therefore dead code here, never fires. The
// actual behavior is entirely inside the case block itself: call the plain
// matches list (LIKED=1&VIEWED=0&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1) to
// see whether any match is already waiting, and branch on TOTAL.
const PHOTO_PENDING_TYPES = [4, 11, 21, 47, 48, 50, 51, 68]

async function fetchPendingMatchesTotal(): Promise<number | null> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&START=0&LIMIT=20&LIKED=1&VIEWED=0&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1`
  const res = await apiCall(Endpoints.listing.matches, 'POST', params)
  if (String(res?.['RESPONSECODE']) !== '1' || String(res?.['ERRCODE']) !== '0') return null
  return Number(res['TOTAL'] ?? 0)
}

// Angular: the paymentTrack(46) + SPECIALOFFERBOTTOMSHEET + redirectToIntermediatePage
// trio repeats verbatim across case 10's RPAYFLAG=='1' branch and the entire
// payment-promo case group below — pulled out once rather than duplicated.
async function runPaymentPromoRedirect(): Promise<void> {
  await paymentTrack(46)
  await setItem('SPECIALOFFERBOTTOMSHEET', '1')
  await redirectToIntermediatePage('notification')
}

// ─── Type 10 — payment failure ───────────────────────────────────────────────
// Angular: PAYPROMO=='0' → no navigation at all (notification tap is a no-op
// beyond marking read); otherwise branches on RPAYFLAG (Razorpay-in-progress
// flag, misleadingly named checkBrowserPayment() in source): '1' → the
// generic recharge/renewal intermediate page (redirectToIntermediatePage(),
// same call pageLandingService.ts's cases 6/10/15/16/26/32 already use);
// anything else → the dedicated payment-failed detail screen, via the exact
// PAYMENT_FAILED/PAYMENTFAILTYPE cache-then-navigate precedent
// pageLandingService.ts's own case "18" already established for that screen.
async function handlePaymentFailureNotification(): Promise<void> {
  const payPromo = await getItem(StorageKeys.Payment.PAY_PROMO)
  if (!payPromo || payPromo === '0') return

  const rpayFlag = await getItem(StorageKeys.Payment.RPAY_FLAG)
  if (rpayFlag === '1') {
    await runPaymentPromoRedirect()
  } else {
    await setItem('PAYMENT_FAILED', '1')
    await setItem('PAYMENTFAILTYPE', '1')
    navigate(ENavigation.PAYMENT_FAILED)
  }
}

// ─── Types 28/32/34/36/38/44-46/49/57/58/64/71/73/104 — payment-promo nudges ─
// Angular: every one of these types shares one case block — url always stays
// '' (the commented-out '/recharge/payment-promotion' target was abandoned),
// and PAYPROMO!='0' is the only gate: same runPaymentPromoRedirect() as case
// 10's RPAYFLAG branch, no RPAYFLAG check here at all, and no fallback
// navigation whatsoever when PAYPROMO=='0' — the tap is a pure no-op.
const PAYMENT_PROMO_TYPES = [28, 32, 34, 36, 38, 44, 45, 46, 49, 57, 58, 64, 71, 73, 104]

async function handlePaymentPromoNotification(): Promise<void> {
  const payPromo = await getItem(StorageKeys.Payment.PAY_PROMO)
  if (!payPromo || payPromo === '0') return
  await runPaymentPromoRedirect()
}

// ─── Types 61/62 — nearby matches / star matches ────────────────────────────
// Angular: callingListAPI() with module 'nearbymatches'/'starmatches' — same
// function types 1/2/3 use, but these notifications have no reliable sender
// to prepend (oppositeUserId parses to NaN when senderid is blank, which it
// always is for a curated-list promo rather than a personal like/view), so
// unlike types 1/2/3 there's nothing to reorder: open the list's first
// profile with the rest available to swipe. On failure or an empty list,
// Angular explicitly replaces to /matches (`replaceUrl: true`, the one place
// in this whole switch that does) rather than the plain push its other
// fallbacks use — kept as the one resetTo() in this file for that reason.
async function fetchModuleProfileIds(endpoint: string): Promise<string[] | null> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&START=0&LIMIT=20&LIKED=1&VIEWED=1&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1`
  const res = await apiCall(endpoint, 'POST', params)
  if (String(res?.['RESPONSECODE']) !== '1' || String(res?.['ERRCODE']) !== '0') return null
  const list: Record<string, any>[] = Array.isArray(res['RESPONSE']) ? res['RESPONSE'] : []
  if (list.length === 0) return null
  return list.map(p => String(p['MATRIID'])).filter(Boolean)
}

async function handleCuratedListNotification(endpoint: string): Promise<void> {
  const ids = await fetchModuleProfileIds(endpoint)
  if (ids && ids.length > 0) {
    await redirectToViewProfile('', ids[0]!, 'notification', ids)
  } else {
    resetTo(ENavigation.MATCHES)
  }
}

// ─── Main entry point — call this on notification tap ───────────────────────
// Marks the notification read, then either opens ViewProfile (types 1/2/3,
// with the sender's list for swiping), runs the pending-photo gate (types
// 4/11/21/47/48/50/51/68), or navigates via getNotificationRedirect
// (everything else, Phase 1 scope per file header).
export async function handleNotificationPress(item: NotificationItem): Promise<void> {
  emitReadNotification(item.ngrpid)

  // Angular: oppositeUserId parsing — senderid can be a comma-separated list;
  // only the first id is ever used.
  const senderId = item.senderid.includes(',') ? item.senderid.split(',')[0]! : item.senderid

  if ([1, 2, 3].includes(item.notificationtype) && senderId) {
    const module: SenderListModule =
      item.notificationtype === 1 ? 'likedyou' :
      item.notificationtype === 2 ? 'viewedyou' : 'whoviewednumber'
    const profileIds = await fetchSenderPrependedProfileIds(module, senderId)
    await redirectToViewProfile('', senderId, 'notification', profileIds ?? undefined)
    return
  }

  // Angular: case 6/7 ('viewphoto'/'viewhoro') — their own callingListAPI()
  // calls are commented out in source (dead code), so the real, live
  // behavior is a direct single-profile navigation with no swipe list; the
  // module name in the URL (':module/viewprofile/:id') is otherwise only
  // used as an fromModule/analytics tag (viewprofile.page.ts's
  // notifyLandingModule list), not tied to any distinct on-screen behavior.
  if ([6, 7].includes(item.notificationtype) && senderId) {
    await redirectToViewProfile('', senderId, 'notification')
    return
  }

  if (item.notificationtype === 10) {
    await handlePaymentFailureNotification()
    return
  }

  if (PAYMENT_PROMO_TYPES.includes(item.notificationtype)) {
    await handlePaymentPromoNotification()
    return
  }

  if (item.notificationtype === 56) {
    const redirect = await getSignzyRedirect()
    navigate(redirect.screen, 'params' in redirect ? redirect.params : undefined)
    return
  }

  // Angular: case 59 — drService.loadDrProfiles(nbId, 'dailyrecommendations',
  // 'matches'), the exact function+args this port's own drService.ts already
  // exports and uses elsewhere (login landing, DR screen exhaustion).
  if (item.notificationtype === 59) {
    const userId = await getItem(StorageKeys.Auth.USER_ID)
    await loadDrProfiles(userId ?? '', 'dailyrecommendations', ENavigation.MATCHES)
    return
  }

  // Angular: case 60 — filterService.reDirectFromExplore() with a hardcoded
  // PHOTO/"With photos" explore-category object; the RN equivalent is the
  // same navigate('Matches', {exploreType, exploreLabel}) HomeScreen.tsx's
  // own explore-category tiles already use (HomeScreen.tsx:1362).
  if (item.notificationtype === 60) {
    navigate(ENavigation.MATCHES, { exploreType: 'PHOTO', exploreLabel: 'With photos' })
    return
  }

  if ([61, 62].includes(item.notificationtype)) {
    const endpoint = item.notificationtype === 61 ? Endpoints.listing.nearbyMatches : Endpoints.listing.starMatches
    await handleCuratedListNotification(endpoint)
    return
  }

  // Angular: case 63 ('Female Free Promotion') — clears the free-contact
  // popup flag, then the exact same add-photo target (editform/20) the
  // pending-photo gate's own "no matches waiting" branch already resolves to.
  if (item.notificationtype === 63) {
    await setItem('FREE_CONTECT_POPUP', '0')
    navigate(ENavigation.ONBOARDING, { pageNo: '20', standalone: true })
    return
  }

  if (PHOTO_PENDING_TYPES.includes(item.notificationtype)) {
    const total = await fetchPendingMatchesTotal()
    if (total !== null && total > 0) {
      navigate(ENavigation.ADD_PHOTO_INTERMEDIATE, { page: 'ADDPHOTO' })
    } else {
      navigate(ENavigation.ONBOARDING, { pageNo: '20', standalone: true })
    }
    return
  }

  const redirect = getNotificationRedirect(item.notificationtype)
  navigate(redirect.screen, 'params' in redirect ? redirect.params : undefined)
}
