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
import { Linking } from 'react-native'
import Constants from 'expo-constants'
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { paymentTrack } from './paymentService'
import { getItem, setItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { CDN, CDN_SVG, CDN_LOTTIE } from '../constants/cdn'
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

/** Angular: bindStarImage() — the two CDN star glyphs the rating row is built from. */
export const STAR_IMG = {
  filled: CDN + 'feedback/yellow-plain.svg',
  empty:  CDN + 'feedback/grey-plain.svg',
}

/** Angular: Thanks-Rating auto-dismiss — setTimeout(dismiss, 3000). */
export const THANKS_AUTO_DISMISS_MS = 3000

// ─── Eligibility ──────────────────────────────────────────────────────────────

export interface RatingTrigger {
  /** Angular's actionNo, sent to the server as SOURCE and tracked as 119-123. */
  source: string
  /** Angular's CurrentDate — the stamp to write to SHOWAPPRATINGDATE on open. */
  currentDate: string
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
  show = false, actionNo = '1',
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

  return (firstAsk || reAsk) ? { source: actionNo, currentDate } : null
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

  const action = checkLoginEligiable(readOr(rawGender, ''), likeCount, vpCount, accountAge > 15)
  if (action !== '0') return checkRatingCount(true, action)

  // Fallback nudge: a 14-day-old account that has never rated and has never been
  // asked. Goes straight to the popup in Angular (no checkRatingCount call), but
  // still honours the open-popup guard.
  const appRatingVal = readOr(rawValue, '0')
  const shownDate    = readOr(rawShown, '')
  if (!ratingPopupOpen && accountAge >= 14 && appRatingVal === '0' && shownDate === '') {
    return { source: '1', currentDate }
  }
  return null
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
 * Angular: reDirectToPlaystore() — fires an appNativeEvent, which on APPVERSION
 * > 4.1 asks the native shell for Google's in-app review sheet and otherwise
 * opens the store URL. This build has no in-app-review module and no native
 * shell to post to, so both paths collapse to opening the flavor's store page.
 */
export async function redirectToPlayStore(): Promise<void> {
  const url = String(Constants.expoConfig?.extra?.['playStoreUrl'] ?? DEFAULT_PLAYSTORE_URL)
  try {
    await Linking.openURL(url)
  } catch (e) {
    if (__DEV__) console.error('[appRatingService] open store error:', e)
  }
}
