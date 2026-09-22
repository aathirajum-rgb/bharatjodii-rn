// "Rate our app" popup — Angular: services/app-rating.service.ts
// (passiveRatingPopup / checkLoginEligiable / checkRatingCount / openRatingPopup /
// callRatingAPIFunc / callTrackRatingFunc / reDirectToPlaystore) plus the four
// popup configs in core/config/common.config.ts (App_Rating, Form_Rating,
// PlayStore_Rating, Thanks_Rating).
//
// Split of responsibility: this module owns every *decision* and every piece of
// persisted state; the screen owns the modal's visibility (Angular's
// ModalController has no RN equivalent, and this app has no global modal host).
// A decision comes back as a RatingTrigger, which the screen hands straight to
// <AppRatingModal source=... />.
import Constants from 'expo-constants'
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { paymentTrack } from './paymentService'
import { logEvent, dispatchNativeEvent } from './analyticsService'
import { getItem, setItem, removeMultiple } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { CDN_SVG, CDN_LOTTIE } from '../constants/cdn'
import { APP_VERSION } from '../constants/appVersion'
import type { ComCountEntry } from './homeService'

const DAY_MS = 24 * 60 * 60 * 1000

const DEFAULT_PLAYSTORE_URL = 'https://play.google.com/store/apps/details?id=jodii.app'

// Angular: sessionStorage 'PASSIVERATINGCHECKED' — evaluate the login-time nudge
// once per app session, otherwise every return to Matches re-asks. A module-level
// flag is the RN equivalent (module state dies with the JS runtime, i.e. on app
// restart, exactly like sessionStorage dies with the tab).
let passiveChecked = false

// Angular: isOpenedRationPopup — blocks a second popup while one is on screen.
let ratingPopupOpen = false


// ─── Date helpers ─────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * Angular: getCurrentDateTime() — the stamp written to SHOWAPPRATINGDATE.
 * Angular emits an UNPADDED `YYYY-M-D H:mm:ss`; this pads month/day/hour so the
 * result is a shape Hermes' Date parser accepts (Hermes, unlike V8, does not
 * reliably parse the unpadded form and returns NaN for it — which would make
 * every subsequent daysDiffer() reading meaningless).
 */
export function getCurrentDateTime(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} `
    + `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

// Tolerant parse: our own stamps are 'YYYY-MM-DD HH:mm:ss', but the server's
// TIMECREATED / RATINGDATE can arrive in either that form or full ISO.
function parseDateMs(value: string): number {
  if (!value) return NaN
  const iso = value.includes('T') ? value : value.replace(' ', 'T')
  const t = Date.parse(iso)
  return Number.isNaN(t) ? Date.parse(value) : t
}

/** Angular: daysDiffer() — whole days between two stamps, order-insensitive. */
export function daysDiffer(date1: string, date2: string): number {
  const a = parseDateMs(date1)
  const b = parseDateMs(date2)
  // Angular yields NaN here (every `>` / `<` against it is false). Returning 0
  // keeps the gate driven by the SHOWAPPRATINGDATE-is-empty rule instead of by
  // an unusable date, which is the same net effect without the NaN arithmetic.
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.floor(Math.abs(a - b) / DAY_MS)
}

// Angular: FUNC.IsValidParam — '0' and '-' count as EMPTY, which is load-bearing
// here (APPRATINGVALUE '0' must fall through to the "never rated" default).
function isValidParam(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
    && value !== '-' && value !== 0 && value !== '0'
    && value !== 'undefined' && value !== 'null'
}

function readOr(raw: string | null, fallback: string): string {
  return isValidParam(raw) ? String(raw) : fallback
}

/**
 * Every threshold below splits on gender, and LOGIN_GENDER is not a settled
 * encoding in this port: it is written straight from the login payload's
 * GENDER (registrationService.storeWebURLData), which the webview hands over as
 * 'M'/'F' in some flows and '1'/'0' in others — the same ambiguity
 * SearchScreen.memberGender documents and normalises. A bare `=== 'F'` therefore
 * read a female member as male whenever her gender arrived as '0', and silently
 * applied the male thresholds (3 likes instead of 2, 12 profiles instead of 15).
 *
 * Anything unrecognised stays '' and falls to the male branch, which is what
 * Angular's own `gender === 'F'` does with an empty value.
 */
function normalizeGender(raw: string): 'M' | 'F' | '' {
  if (['F', 'f', '0'].includes(raw)) return 'F'
  if (['M', 'm', '1'].includes(raw)) return 'M'
  return ''
}

function countFor(comCount: ComCountEntry[], type: string): number {
  const entry = comCount.find(c => c.comtype === type)
  return Number(entry?.totalCount ?? 0)
}

// ─── Popup configs ────────────────────────────────────────────────────────────
// Angular: core/config/common.config.ts. Form_Rating is intentionally absent —
// its TITLE/NOTE are never rendered (the ratingForm block draws the API's own
// question text instead), so it carried no information the modal needs.

export type RatingSection = 'Rating' | 'Form' | 'PS-Rating' | 'Thanks-Rating'

export interface RatingSectionConfig {
  section:     RatingSection
  titleKey:    string
  noteKey:     string
  ctaKey:      string
  linkCtaKey:  string
  /** Angular's CLOSE_CTA — whether the floating ✕ is rendered at all. */
  closeCta:    boolean
  /** Angular's HDR_IMG + IMG/ANIMATION — header illustration, if any. */
  image?:      string
  lottie?:     string
}

export const RATING_SECTIONS: Record<RatingSection, RatingSectionConfig> = {
  // App_Rating
  'Rating': {
    section:    'Rating',
    titleKey:   'STAR_RATING.HDR_RATING',
    noteKey:    '',
    ctaKey:     'STAR_RATING.SUBMIT',
    linkCtaKey: '',
    closeCta:   true,
  },
  // Form_Rating — question/options come from the content API, not config.
  'Form': {
    section:    'Form',
    titleKey:   '',
    noteKey:    '',
    ctaKey:     'STAR_RATING.SUBMIT',
    linkCtaKey: '',
    closeCta:   true,
  },
  // PlayStore_Rating
  'PS-Rating': {
    section:    'PS-Rating',
    titleKey:   'STAR_RATING.THANK_YOU',
    noteKey:    'STAR_RATING.PLAY_STORE_CNT',
    ctaKey:     'STAR_RATING.RATE_US',
    linkCtaKey: 'STAR_RATING.SKIP',
    closeCta:   false,
    image:      CDN_SVG + 'thanks-rating.svg',
  },
  // Thanks_Rating
  'Thanks-Rating': {
    section:    'Thanks-Rating',
    titleKey:   'STAR_RATING.RATING_THANK',
    noteKey:    'STAR_RATING.THANK_NOTE',
    ctaKey:     '',
    linkCtaKey: '',
    closeCta:   false,
    lottie:     CDN_LOTTIE + 'success-new.json',
  },
}

/**
 * Angular: bindStarImage() — feedback/yellow-plain.svg when the star is lit,
 * feedback/grey-plain.svg when it is not.
 *
 * Those two CDN files are NOT a yellow star and a grey star. Both are the same
 * yellow (#F6D539) star; the "grey" one simply paints a second copy of the path
 * over it in white with `style="mix-blend-mode:hue"`, and the browser
 * desaturates the yellow underneath to #E6E6E6. react-native-svg implements no
 * blend modes, so on native that overlay lands as plain opaque white and the
 * unlit stars vanish into the white sheet.
 *
 * So the star is drawn inline here — same path, same 46x46 viewBox, taken
 * straight from the CDN asset — with the blend's own computed result as a flat
 * fill. Identical to Angular on web, and it now survives on native.
 */
const STAR_PATH = 'M1.157 17.746c.422-1.176 1.466-1.57 2.617-1.719 2.677-.349 5.347-.755 8.032-1.027 2.244-.227 3.923-.928 4.837-3.287 1.042-2.69 2.49-5.222 3.76-7.823C20.91 2.854 21.54 2.048 22.86 2h.194c1.321.045 1.953.849 2.462 1.884 1.276 2.598 2.73 5.127 3.778 7.814.92 2.357 2.6 3.053 4.846 3.275 2.685.266 5.356.666 8.034 1.008 1.151.148 2.196.538 2.621 1.713.446 1.234-.098 2.188-1.016 3.06-2.392 2.274-4.716 4.621-7.096 6.91-.908.871-1.247 1.797-.99 3.086a212.141 212.141 0 0 1 1.643 9.456c.18 1.171.385 2.49-.818 3.311-1.153.787-2.28.33-3.39-.27-2.774-1.5-5.572-2.954-8.353-4.442-.616-.33-1.191-.491-1.774-.48-.583-.01-1.158.153-1.774.484-2.777 1.495-5.572 2.956-8.342 4.463-1.109.603-2.235 1.062-3.39.277-1.204-.818-1.002-2.137-.826-3.309.477-3.163 1.001-6.321 1.62-9.46.255-1.29-.087-2.214-.996-3.084-2.386-2.282-4.715-4.624-7.114-6.893-.92-.87-1.466-1.822-1.022-3.057z'

function starXml(fill: string): string {
  return `<svg width="46" height="46" viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg">`
    + `<path fill-rule="evenodd" clip-rule="evenodd" d="${STAR_PATH}" fill="${fill}"/></svg>`
}

export const STAR_IMG = {
  filled: starXml('#F6D539'),
  empty:  starXml('#E6E6E6'),
}

/**
 * Angular activeRatingPopup(): the like-triggered popup is deferred by 600ms
 * (`actionNo == '2' ? 600 : 0`) so it does not land on top of the like
 * animation and its undo toast.
 */
export const LIKE_POPUP_DELAY_MS = 600

/** Angular: Thanks-Rating auto-dismiss — setTimeout(dismiss, 3000). */
export const THANKS_AUTO_DISMISS_MS = 3000

// ─── Per-member scoping ───────────────────────────────────────────────────────

// The three values this module WRITES itself. Everything else it touches
// (APPRATINGVALUE / APPRATINGDATE) is written from the login response by
// registrationService.storeWebURLData, so those already describe whoever is
// logged in now and must not be cleared here — doing so would throw away the
// server's "already rated 5" the moment the first trigger ran.
const RATING_LOCAL_KEYS = [
  SK.Rating.VP_COUNT,
  SK.Rating.LIKE_COUNT,
  SK.Rating.SHOWN_DATE,
]

/**
 * Resets the local rating bookkeeping when the logged-in member is not the one
 * it was counted for.
 *
 * Without this, the counters and the "last shown" stamp are device-wide and
 * outlive the account: a freshly created profile inherited a like count of 8
 * from earlier testing, so its 2nd like hit the male "every 3rd" rule (9 % 3)
 * while its 3rd did not, and the inherited SHOWAPPRATINGDATE suppressed the
 * popup for 7 days on top of that. Real members hit the same thing after a
 * logout-and-login as someone else.
 *
 * Runs at the head of both trigger paths, so it cannot be bypassed.
 */
async function ensureRatingOwner(): Promise<void> {
  const [rawUserId, owner] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem(SK.Rating.OWNER),
  ])
  const userId = String(rawUserId ?? '')
  // No session yet: nothing to scope to, and wiping now would clear state that
  // still belongs to the member who is about to be restored.
  if (!userId) return
  if (owner === userId) return

  await removeMultiple(RATING_LOCAL_KEYS)
  await setItem(SK.Rating.OWNER, userId)
}

// ─── Eligibility ──────────────────────────────────────────────────────────────

export interface RatingTrigger {
  /** Angular's actionNo, sent to the server as SOURCE and tracked as 119-123. */
  source: string
  /** Angular's CurrentDate — the stamp to write to SHOWAPPRATINGDATE on open. */
  currentDate: string
  /**
   * Angular activeRatingPopup(): `let timer = (actionNo == '2') ? 600 : 0` — a
   * like-triggered popup waits 600ms so the like animation and its toast are
   * done before the sheet slides over them. Every other trigger opens at once.
   */
  delayMs: number
}

/**
 * Angular: checkEligiable() — the ACTIVE-action thresholds, i.e. things the
 * member does: likes they SEND and profiles they OPEN.
 *
 *              like sent      profiles viewed
 *   male  <15d     3               12
 *   male  >15d     2               10
 *   female <15d    2               15
 *   female >15d    2               18
 *
 * Modulo, not ">=", and that is deliberate on two counts: the counter keeps
 * running across the 15-day boundary ("when the user transitions from LT15 to
 * GT15 the count carries forward"), and once a popup has been shown the next
 * one is another full N actions away — Angular's stand-in for "the count
 * resets", without a reset that could lose actions mid-session.
 *
 * Returns Angular's actionNo: '2' = like sent, '3' = profiles viewed, '0' =
 * not eligible. Like wins when both land on the same action.
 */
export function checkEligiable(
  gender = '', like = 0, vpView = 0, isGTDay = false,
): string {
  const isFemale  = gender === 'F'
  const likeCnt   = isFemale ? 2 : (isGTDay ? 2 : 3)
  const vpViewCnt = isFemale ? (isGTDay ? 18 : 15) : (isGTDay ? 10 : 12)
  const likeAct = (like % likeCnt === 0 && like !== 0) ? '2' : '0'
  const vpAct   = (vpView % vpViewCnt === 0 && vpView !== 0) ? '3' : '0'
  return likeAct !== '0' ? likeAct : vpAct
}

/**
 * Angular: checkLoginEligiable() — fires on the Nth like/view, NOT at "N or
 * more". The modulo is the whole point: `count % N === 0 && count !== 0` is true
 * only on an exact multiple, so a male user with 1 like is eligible once, not on
 * every single Matches visit forever after.
 */
export function checkLoginEligiable(
  gender = '', like = 0, vpView = 0, isGTDay = false,
): string {
  const isFemale = gender === 'F'
  const likeCnt   = isFemale ? (isGTDay ? 15 : 10) : 1
  const vpViewCnt = isFemale ? 30 : (isGTDay ? 10 : 5)
  const likeAct = (like % likeCnt === 0 && like !== 0) ? '4' : '0'
  const vpAct   = (vpView % vpViewCnt === 0 && vpView !== 0) ? '5' : '0'
  return likeAct !== '0' ? likeAct : vpAct
}

/**
 * Angular: checkRatingCount(show, actionNo) — the cooldown gate. Returns the
 * trigger to open with, or null.
 *
 * The three outcomes, in Angular's own terms:
 *   - never rated ('0')        → show whenever SHOWAPPRATINGDATE is empty; once
 *                                shown, stays suppressed for 8 days, then the
 *                                `lastShowDate > 7` reset clears it and it may
 *                                show again.
 *   - rated 1-3                → only re-asked once BOTH the rating and the last
 *                                showing are more than 30 days old.
 *   - rated 4-5                → never again.
 */
export async function checkRatingCount(
  show = false, actionNo = '1', delayMs = 0,
): Promise<RatingTrigger | null> {
  if (!show) return null
  if (ratingPopupOpen) return null   // Angular: isOpenedRationPopup guard

  const currentDate = getCurrentDateTime()
  const [rawShown, rawRatedOn, rawValue] = await Promise.all([
    getItem(SK.Rating.SHOWN_DATE),
    getItem(SK.Rating.RATING_DATE),
    getItem(SK.Rating.RATING_VALUE),
  ])

  let shownDate      = readOr(rawShown, '')
  const ratedOnDate  = readOr(rawRatedOn, currentDate)
  const appRatingVal = readOr(rawValue, '0')

  const ratedDaysAgo = daysDiffer(currentDate, ratedOnDate)
  let shownDaysAgo   = daysDiffer(currentDate, shownDate || currentDate)

  // Angular: an un-rated user's suppression expires after a week — the stamp is
  // treated as if it had never been written, which re-opens the first branch.
  if (shownDaysAgo > 7 && appRatingVal === '0') {
    shownDaysAgo = 0
    shownDate = ''
  }

  const firstAsk = shownDate === '' && shownDaysAgo < 8 && !['4', '5'].includes(appRatingVal)
  const reAsk    = ratedDaysAgo > 30 && shownDaysAgo > 30 && ['1', '2', '3'].includes(appRatingVal)
  const allowed  = firstAsk || reAsk

  return allowed ? { source: actionNo, currentDate, delayMs } : null
}

/**
 * Angular: passiveRatingPopup(countList) — called from matches.page.ts's
 * ionViewDidEnter() with the notification-count response.
 */
export async function passiveRatingPopup(
  comCount: ComCountEntry[],
): Promise<RatingTrigger | null> {
  if (passiveChecked) return null
  passiveChecked = true

  await ensureRatingOwner()

  const currentDate = getCurrentDateTime()
  const [rawCreated, rawGender, rawValue, rawShown] = await Promise.all([
    getItem(SK.User.TIME_CREATED),
    getItem(SK.User.LOGIN_GENDER),
    getItem(SK.Rating.RATING_VALUE),
    getItem(SK.Rating.SHOWN_DATE),
  ])

  const timeCreated  = readOr(rawCreated, currentDate)
  const accountAge   = daysDiffer(currentDate, timeCreated)   // Angular: getDayDiffer()
  const vpCount      = countFor(comCount, 'viewedyou')
  const likeCount    = countFor(comCount, 'likedyou')

  const gender = normalizeGender(readOr(rawGender, ''))
  const action = checkLoginEligiable(gender, likeCount, vpCount, accountAge > 15)
  if (action !== '0') return checkRatingCount(true, action)

  // Fallback nudge: a 14-day-old account that has never rated and has never been
  // asked. Goes straight to the popup in Angular (no checkRatingCount call), but
  // still honours the open-popup guard.
  const appRatingVal = readOr(rawValue, '0')
  const shownDate    = readOr(rawShown, '')
  const fallback = !ratingPopupOpen && accountAge >= 14 && appRatingVal === '0' && shownDate === ''
  if (fallback) return { source: '1', currentDate, delayMs: 0 }
  return null
}

/**
 * Angular: activeRatingPopup(type) — called on every like SENT (outside Daily
 * Recommendation) and every profile OPENED. Bumps that action's running count,
 * asks checkEligiable() whether this is the Nth one, and runs the same cooldown
 * gate the passive path uses.
 *
 * The counters are per-action and persist (RATINGCOUNTVP / RATINGLIKESENT), so
 * they carry across sessions and across the 15-day boundary, which is what the
 * "count is cumulative from day 0 till they hit the target" rule asks for.
 */
export async function activeRatingPopup(type: 'vp' | 'like'): Promise<RatingTrigger | null> {
  await ensureRatingOwner()

  const isVp = type === 'vp'
  const countKey = isVp ? SK.Rating.VP_COUNT : SK.Rating.LIKE_COUNT

  const currentDate = getCurrentDateTime()
  const [rawCount, rawCreated, rawGender] = await Promise.all([
    getItem(countKey),
    getItem(SK.User.TIME_CREATED),
    getItem(SK.User.LOGIN_GENDER),
  ])

  // Angular increments and persists FIRST, then tests — so the count survives
  // even when this action is not the one that opens the popup.
  const count = (Number(rawCount) || 0) + 1
  await setItem(countKey, String(count))

  // Angular: getDayDiffer() — account age from TIMECREATED decides which
  // column of the threshold table applies.
  const accountAge = daysDiffer(currentDate, readOr(rawCreated, currentDate))
  const gender     = normalizeGender(readOr(rawGender, ''))
  const action = isVp
    ? checkEligiable(gender, 0, count, accountAge > 15)
    : checkEligiable(gender, count, 0, accountAge > 15)
  if (action === '0') return null

  return checkRatingCount(true, action, action === '2' ? LIKE_POPUP_DELAY_MS : 0)
}

// ─── Open / close bookkeeping ─────────────────────────────────────────────────

/**
 * Angular: openRatingPopup()'s side effects, performed at present() time —
 * claim the single-popup slot, fire the source's payment track, and stamp
 * SHOWAPPRATINGDATE so the cooldown starts from the moment it was SHOWN (not
 * from whether the user actually rated).
 */
export async function markRatingPopupOpened(trigger: RatingTrigger): Promise<void> {
  ratingPopupOpen = true
  void trackRating(trigger.source)
  await setItem(SK.Rating.SHOWN_DATE, trigger.currentDate)
}

/** Angular: onDidDismiss()'s `isOpenedRationPopup = false`. */
export function markRatingPopupClosed(): void {
  ratingPopupOpen = false
}

/** Angular: callTrackRatingFunc() — source 1-5 maps to payment track 119-123. */
async function trackRating(source: string): Promise<void> {
  const trackBySource: Record<string, string> = {
    '1': '119', '2': '120', '3': '121', '4': '122', '5': '123',
  }
  await paymentTrack(trackBySource[source] ?? '119')
}

// ─── Content API ──────────────────────────────────────────────────────────────

/** One entry of SECOUNDQUS.EXPERIENCE — the emoji + caption shown per star. */
export interface RatingExperience {
  IMG?:   string
  VALUE?: string
}

export interface RatingContent {
  /** SECOUNDQUS.QUS — "Please tell us what went wrong?" */
  question:   string
  /** SECOUNDQUS.OPTIONS — the checkbox list, index-aligned with the OPTIONS param. */
  options:    string[]
  /** SECOUNDQUS.EXPERIENCE — index 0 = 1 star ... index 4 = 5 stars. */
  experience: RatingExperience[]
}

async function withAppVersion(params: string): Promise<string> {
  // Angular: callRatingAPIFunc() appends &APPVERSION to every rating call.
  // buildCommonParams() in apiClient only adds APPTYPE/LANG/ATN/RTN.
  const appVersion = (await getItem(SK.App.APP_VERSION)) ?? APP_VERSION
  return `${params}&APPVERSION=${appVersion}`
}

/** Angular: getContent() — `ID=<NBID>&UPDATE=0&TYPE=new`. */
export async function fetchRatingContent(): Promise<RatingContent | null> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const params = await withAppVersion(`ID=${userId}&UPDATE=0&TYPE=new`)
  const result = await apiCall(Endpoints.communication.appRatingUpdate, 'POST', params)
  if (!(result?.['RESPONSECODE'] == '1' && result?.['ERRCODE'] == '0' && result?.['RESPONSE'])) {
    return null
  }
  const q = result['RESPONSE']?.RATING?.ANSWER?.[0]?.SECOUNDQUS
  if (!q) return null
  return {
    question:   String(q.QUS ?? ''),
    options:    Array.isArray(q.OPTIONS) ? q.OPTIONS.map((o: any) => String(o?.VALUE ?? '')) : [],
    experience: Array.isArray(q.EXPERIENCE) ? q.EXPERIENCE : [],
  }
}

export interface SubmitRatingArgs {
  /** Angular's SOURCE — the actionNo the popup was opened with. */
  source:       string
  /** 1-5. */
  ratingValue:  number
  /** Free-text suggestion box; '' when the user only ticked checkboxes. */
  suggestions?: string
  /** One 0/1 flag per content option, joined with '|' (Angular: checkboxValues). */
  options?:     number[]
}

/**
 * Angular: SubmitRating() — `ID&UPDATE=1&TYPE=2&SOURCE&RATINGVALUE&SUGGESTIONS&
 * OPTIONS=0|1|0|0&QUSNO=6&APPVERSION`. The previous port sent RATING/FEEDBACK,
 * which this endpoint does not read at all.
 */
export async function submitRating({
  source, ratingValue, suggestions = '', options = [],
}: SubmitRatingArgs): Promise<boolean> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  // apiCall sends the param string verbatim as the form body, so free text has
  // to be escaped here or an '&' in a suggestion would split it into two params.
  const encoded = encodeURIComponent(suggestions)
  const params = await withAppVersion(
    `ID=${userId}&UPDATE=1&TYPE=2&SOURCE=${source}&RATINGVALUE=${ratingValue}`
    + `&SUGGESTIONS=${encoded}&OPTIONS=${options.join('|')}&QUSNO=6`,
  )
  const result = await apiCall(Endpoints.communication.appRatingUpdate, 'POST', params)
  const ok = result?.['RESPONSECODE'] == '1' && result?.['ERRCODE'] == '0'

  // Angular's app-rating.service.ts does NOT write these back — it relies on the
  // NEXT login response's RATING/RATINGDATE to reflect what was just submitted.
  // That leaves the gate reading '0' for the rest of the session, so an 8-day-old
  // SHOWAPPRATINGDATE could re-ask a user who already rated. Writing them here
  // (the same thing feedback-csat.component.ts:118 does for its own rating)
  // closes that window; the next login simply overwrites with the server's copy.
  if (ok) {
    await Promise.all([
      setItem(SK.Rating.RATING_VALUE, String(ratingValue)),
      setItem(SK.Rating.RATING_DATE,  getCurrentDateTime()),
    ])
  }
  return ok
}

// ─── Play Store ───────────────────────────────────────────────────────────────

/**
 * Angular: reDirectToPlaystore(hasInApp) — one function, two destinations:
 *
 *   hasInApp && APPVERSION > 4.1 → appNativeEvent 'GooglePlayStoreReview', i.e.
 *       Google's own in-app review sheet, fired the moment the thank-you step
  *       opens (openRatingPopup's dismiss handler calls it alongside
 *       openRatingThanks). The member never leaves the app.
 *   otherwise → appNativeEvent 'playstore_rating' with the flavour's store URL,
 *       fired when the member taps "Rate Us" on that thank-you step.
 *
 * Both go through the native-event dispatcher, so the in-app branch has one
 * place to become real once an in-app-review module is added to the build — see
 * analyticsService's own note on that case. Until then it falls through to the
 * store URL, which is the honest behaviour rather than a silent no-op.
 */
export async function redirectToPlayStore(hasInApp = false): Promise<void> {
  const url = String(Constants.expoConfig?.extra?.['playStoreUrl'] ?? DEFAULT_PLAYSTORE_URL)
  const appVersion = parseFloat(String((await getItem(SK.App.APP_VERSION)) ?? APP_VERSION)) || 0

  // Angular: pushfirebaseEvents("AppRatingPopup", {category, action, label}) —
  // fired on BOTH branches, so the funnel counts the in-app sheet too.
  logEvent({ category: 'AppRatingPopup', action: 'ReviewinPlaystore', label: 'Clicked' })

  if (hasInApp && appVersion > 4.1) {
    dispatchNativeEvent({ event_name: 'GooglePlayStoreReview' })
    return
  }
  dispatchNativeEvent({ event_name: 'playstore_rating', url })
}
