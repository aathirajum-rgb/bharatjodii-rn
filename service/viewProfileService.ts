// ViewProfile API — migrated from Angular viewprofile.page.ts's getProfileAPI().
// Angular: params = 'ID='+NBID+'&VIEWEDID='+viewid+'&MEMBERSHIPTYPE='+ENTRYTYPE+'&LASTLOGIN='+lastLogin
// (viewprofile.page.ts:955-977), hitting the same endpoint this app already calls
// for biodata (service/biodataService.ts uses TYPE=BIODATA on the same URL).

import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { getSession } from './registrationService'
import { stripAgeUnit, pickListingPhoto } from '../adapters/profileListing.adapter'

// TEMP DEBUG — remove once the real API's response envelope is confirmed live.
// Lets ViewProfileScreen show exactly what came back when adapting fails, instead
// of guessing at the response shape from Angular source alone.
let _lastRawResult: any = null
export function _debugLastViewProfileResult(): any {
  return _lastRawResult
}

export async function getViewProfile(matriId: string): Promise<Record<string, any> | null> {
  const [userId, entryType, session] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem(SK.Auth.ENTRY_TYPE),
    getSession(),
  ])
  const lastLogin = session?.['LASTLOGIN'] ?? ''
  const params = `ID=${userId ?? ''}&VIEWEDID=${matriId}&MEMBERSHIPTYPE=${entryType ?? ''}&LASTLOGIN=${lastLogin}`

  const result = await apiCall(Endpoints.profile.view, 'POST', params)
  _lastRawResult = result
  if (__DEV__) console.log('DBG_VIEWPROFILE_RAW', JSON.stringify(result))

  // Confirmed live (2026-07-10 debug capture): this endpoint returns RESPONSECODE/
  // ERRCODE as numbers (1/0), not the string '1'/'0' most other endpoints in this
  // app use — loose equality here is intentional, not a typo. The payload is a
  // top-level sibling key REPONSE (the real API's typo, confirmed against Angular's
  // own `data.vpdata.REPONSE` access) — there is no RESPONSE wrapper on this call.
  if (result?.RESPONSECODE == 1 && result?.ERRCODE == 0) {
    const payload = result.REPONSE
    return payload && typeof payload === 'object' ? payload : null
  }
  return null
}

// Angular: communicationService.viewedTrackProfile() — marks a profile as viewed
// once it's actually rendered (skipped for same-gender/own-profile, handled by the
// caller). Confirmed against api-params-functions.ts's viewedtrack/viewedtrackDR
// cases: param is PARTNERID (not VIEWEDID), and DR views additionally send
// TYPE=DR (Angular picks viewedtrackDR vs viewedtrack based on the DR route).
export async function markProfileViewed(matriId: string, isDr = false): Promise<void> {
  const [userId, gender, entryType] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem(SK.User.LOGIN_GENDER),
    getItem(SK.Auth.ENTRY_TYPE),
  ])
  const params = `ID=${userId ?? ''}&PARTNERID=${matriId}&LOGINGENDER=${gender ?? ''}&ENTRYTYPE=${entryType ?? ''}`
    + (isDr ? '&TYPE=DR' : '')
  await apiCall(Endpoints.profile.viewedTrack, 'POST', params)
}

// Angular: viewprofile.page.ts:761-768 — fired once per profile-view page load
// (only when PHOTOAVAILABLE=='Y'), fire-and-forget, no loading UI. Returns the
// full-resolution photo URLs, which albumView() (:1318-1357) swaps in for the
// main carousel's thumbnail array — but only if this already resolved
// (`if (this.enlargePhoto) { this.userPhotos = this.enlargePhoto }`); on
// failure/still-pending it silently keeps showing the thumbnails already
// loaded from the main view/profile/v1 response. Same fallback shape here:
// callers should use this result if present, else keep using profile.photos.
// (Angular's separate album-view.page.ts also called this endpoint, but it's
// dead code — unreachable from any template — confirmed not to be ported.)
export async function getEnlargedPhotos(partnerId: string): Promise<string[] | null> {
  const [userId, entryType, gender] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem(SK.Auth.ENTRY_TYPE),
    getItem(SK.User.LOGIN_GENDER),
  ])
  const params = `ID=${userId ?? ''}&PARTNERID=${partnerId}&ENTRYTYPE=${entryType ?? ''}&LOGINGENDER=${gender ?? ''}`
  const result = await apiCall(Endpoints.communication.enlargePhoto, 'POST', params)
  const ok = (result?.RESPONSECODE === '1' || result?.RESPONSECODE == 1)
    && (result?.ERRCODE === '0' || result?.ERRCODE == 0)
  if (!ok) return null
  const photoDet: Array<{ IMAGE?: string }> = result?.RESPONSE?.PHOTODET ?? []
  const urls = photoDet.map(p => p.IMAGE).filter((u): u is string => !!u)
  return urls.length > 0 ? urls : null
}

// Feature 6 — Angular: Nbcommon.getBioDataLink() (services/common.ts:1807-1830):
// `${DOMAIN}biodata/v1?MATRIID=&LANG=&ATN=&RTN=&THEME=`. Endpoints.profile.bioData
// is already `${api}biodata/v1` on the same confirmed domain (EnvConfig.api ===
// Angular's `${ENVIRONMENT}_DOMAIN`), so only the query params need building here.
export async function getBioDataLink(matriId: string): Promise<string> {
  const [atn, rtn, lang, themeId] = await Promise.all([
    getItem(SK.Auth.TOKEN),
    getItem(SK.Auth.REFRESH_TOKEN),
    getItem(SK.Auth.LANG),
    getItem(SK.App.BIODATA_THEME_ID),
  ])
  const params = `MATRIID=${matriId}&LANG=${lang ?? 'en'}&ATN=${atn ?? ''}&RTN=${rtn ?? ''}&THEME=${themeId ?? '1'}`
  return `${Endpoints.profile.bioData}?${params}`
}

// ─── Biodata theming + QR ───────────────────────────────────────────────────────
// Angular: download-biodata.component.ts getuserBioData() — the SAME viewprofile
// endpoint as getViewProfile(), but with TYPE=BIODATA, additionally returns
// BIODATATHEME (5 color/background variants used to skin the biodata preview:
// {VALUE, BGCOLOR, TOP_IMG}) and a top-level QRCODE image URL (biodata-page.html:
// `[src]="userBioData?.QRCODE"` — a server-rendered QR image, not client-drawn).
// Kept as its own call rather than adding TYPE=BIODATA to getViewProfile() itself
// — that function also prefetches OTHER people's profiles and neighbor profiles
// for the prev/next swipe, none of which have any use for this data.
//
// BOTTOM_IMG (also present in BIODATATHEME) is deliberately NOT read here —
// confirmed dead in Angular's own template (download-biodata.component.html:473
// `<!-- <ion-img *ngIf="theme?.BOTTOM_IMG" ... -->`, commented out, never
// rendered), so there's nothing to port.

export interface BiodataTheme {
  value:   string
  bgColor: string
  topImg:  string
}

export interface BiodataExtras {
  themes:     BiodataTheme[]
  qrCodeUrl?: string | undefined
}

function resolveThemeImageUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`
}

export async function getBiodataExtras(matriId: string): Promise<BiodataExtras> {
  const userId = await getItem(SK.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&VIEWEDID=${matriId}&TYPE=BIODATA`
  const result = await apiCall(Endpoints.profile.view, 'POST', params)
  if (!(result?.RESPONSECODE == 1 && result?.ERRCODE == 0)) return { themes: [] }

  const payload = result?.REPONSE
  const list = payload?.BIODATATHEME
  const themes: BiodataTheme[] = Array.isArray(list)
    ? list
      .map((theme: any) => ({
        value:   String(theme?.VALUE ?? ''),
        bgColor: theme?.BGCOLOR ? String(theme.BGCOLOR) : '#011443',
        topImg:  resolveThemeImageUrl(String(theme?.TOP_IMG ?? '')),
      }))
      .filter((theme: BiodataTheme) => theme.value !== '')
    : []

  return { themes, qrCodeUrl: payload?.QRCODE || undefined }
}

export async function saveBiodataThemeId(themeValue: string): Promise<void> {
  await setItem(SK.App.BIODATA_THEME_ID, themeValue)
}

// ─── Horoscope view ──────────────────────────────────────────────────────────────
// Angular: viewprofile.page.ts:1518-1529 (viewHoro, inside callNative('view_horoscope')).
// (Angular also has a requestHoro() — its only UI trigger is commented out of the
// template, so it's unreachable dead code there; no React equivalent is kept here
// either, see ViewProfileScreen.tsx's horoscope section-visibility gate.)

// Angular opens the horoscope via a native-webview bridge event
// (appNativeEvent({event_name:'view_horoscope', URL})) — the real native Android/
// iOS apps handle that event themselves in-app (not visible in the web-only
// Angular repo); ViewProfileScreen.tsx's handleViewHoroscope() mirrors that:
// web keeps Linking.openURL (new tab, matching index.html's own web fallback),
// native opens in-app (in-app browser, or the photo viewer for an image URL).
export async function viewHoroscope(partnerId: string, profileVerified: boolean): Promise<string | null> {
  const userId = await getItem(SK.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&VIEWEDID=${partnerId}&PROFILEVERIFIED=${profileVerified ? '1' : '0'}`
  const result = await apiCall(Endpoints.profile.viewHoro, 'POST', params)
  const ok = result?.RESPONSECODE === '1' || result?.RESPONSECODE == 1
  return ok ? (result?.RESPONSE?.HOROSCOPEURL ?? null) : null
}

// ─── Star matching ("View details" full report) ────────────────────────────────
// Angular: viewprofile.page.ts:1880-1913 (getStarMatch, paid users only — free
// users see a static teaser instead, unchanged/already correct elsewhere on this
// screen) and star-matching.component.ts (the report screen this feeds).
//
// Confirmed live (debug capture against a real profile pair): STAR/RAASI params
// are the LOGGED-IN VIEWER's own numeric codes (Angular: ppSetData.PI_STAR/
// PI_RAASI, e.g. "9"/"3") — NOT the viewed profile's star/raasi text. The server
// looks up the viewed profile's side itself from VIEWEDID. Sending the viewed
// profile's display text (e.g. "Vishakam") here, as an earlier version of this
// function did, gets ERRMSG:"INVALID RAASI OR STAR" back (with RESPONSECODE/
// ERRCODE still reading as success, so that failure mode is otherwise silent).
//
// This endpoint also uses the same REPONSE-typo envelope as view/profile/v1
// (Angular checks `resultData['REPONSE']`, not 'RESPONSE') — reading the plain
// 'RESPONSE' key here always came back empty regardless of whether the request
// itself succeeded.
export interface StarMatchResult {
  displayText:   string    // Angular's poruthamPercentage/poruthamPercentageNorth — a ready-to-render string ("5.5/10" South, DHASA_PERCENTAGE North), not a number to reformat
  percentage:    number    // SUMMARY.PORUTHAM_PERCENTAGE (e.g. "55%") parsed to a plain 0-100 number — for the detail screen's star-count/progress-bar visuals only, not the headline text
  isNorth:       boolean
  raw:           Record<string, any>   // full REPONSE — handed to StarMatchingScreen via navigation state, same as Angular's starMatchResponse
  ownStar?:      string  | undefined
  ownRaasi?:     string  | undefined
  partnerStar?:  string  | undefined
  partnerRaasi?: string  | undefined
}

export async function getStarMatch(
  partnerId: string, ownStar: string, ownRaasi: string, motherTongue: string,
): Promise<StarMatchResult | null> {
  const userId = await getItem(SK.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&VIEWEDID=${partnerId}&STAR=${ownStar}&RAASI=${ownRaasi}&MOTHERTONGUE=${motherTongue}`
  const result = await apiCall(Endpoints.profile.starMatch, 'POST', params)
  const ok = (result?.RESPONSECODE === '1' || result?.RESPONSECODE == 1)
    && (result?.ERRCODE === '0' || result?.ERRCODE == 0)
  const res = result?.REPONSE
  // Angular: viewprofile.page.ts:1893/1901 — presence of REPONSE means success
  // (starAndraasiflag=true); an ERRMSG (e.g. invalid star/raasi) means failure
  // (starAndraasiflag=false), even though RESPONSECODE/ERRCODE alone still say "ok".
  if (!ok || !res) return null

  const isNorth = String(res['TYPE'] ?? '').toLowerCase().includes('north')
  const displayText = isNorth
    ? String(res['PREDICTION']?.['DHASA_PERCENTAGE'] ?? '')
    : String(res['SUMMARY']?.['PORUTHAM_RATIO'] ?? '')
  const percentage = Number(String(res['SUMMARY']?.['PORUTHAM_PERCENTAGE'] ?? '').replace('%', ''))
  return {
    displayText,
    percentage: Number.isFinite(percentage) ? percentage : 0,
    isNorth,
    raw: res,
    ownStar:      res['USERPROFILE']?.['STAR']    ?? undefined,
    ownRaasi:     res['USERPROFILE']?.['RAASI']   ?? undefined,
    partnerStar:  res['PARTNERPROFILE']?.['STAR']  ?? undefined,
    partnerRaasi: res['PARTNERPROFILE']?.['RAASI'] ?? undefined,
  }
}

// ─── Similar profiles ("Other profiles like X") ────────────────────────────────
// Angular: viewprofile.page.ts:1384 — 'viewsimilar' POST with ID/STLIMIT/ENDLIMIT/
// VIEWEDID. Confirmed live (debug capture): this call alone often returns only 1-2
// results — Angular's own fallback (viewprofile.page.ts:1408-1417) kicks in exactly
// here, re-querying the plain 'matches' listing (same shape fetchMatches/
// fetchExplore already use) and fully REPLACING similarProfiles with that broader
// result set when the primary call comes back too sparse (TOTALFOUND<=2). Skipped
// entirely on Daily-Recommendation landings in Angular — not applicable yet, no DR
// mode built.

export interface SimilarProfileCard {
  matriId:          string
  name:             string
  age?:             string | undefined
  education?:       string | undefined
  photoUri?:        string | undefined
  isPhotoAvailable: boolean
}

// TEMP DEBUG — remove once the fallback's real behavior is confirmed live.
let _lastSimilarDebug: any = null
export function _debugLastSimilarProfilesResult(): any {
  return _lastSimilarDebug
}

function toSimilarCard(p: Record<string, any>): SimilarProfileCard {
  return {
    matriId:          String(p['MATRIID'] ?? p['MATRID'] ?? p['NBID'] ?? ''),
    name:             p['NAME'] ?? '',
    age:              p['AGE'] ? stripAgeUnit(p['AGE']) : undefined,
    education:        p['EDUCATION'] || undefined,
    // pickListingPhoto() covers PHOTO[0].IMAGE/THUMBIMG (same as the matches-listing
    // mappers); PROFILEIMG is this endpoint's own extra fallback on top of that.
    photoUri:         pickListingPhoto(p) || p['PROFILEIMG'] || undefined,
    // Angular / homeService.ts's own toProfile() mapper for this exact raw shape:
    // PHOTOAVAILABLE=='Y' ALONE decides it — no OR-fallback to "PHOTO array has an
    // entry". The listing API sends a placeholder/default silhouette PHOTO entry
    // even for members with no real photo, so that fallback was wrongly treating
    // the placeholder as a real photo (rendered as a flat gray image instead of the
    // WhatsApp-request overlay it should show).
    isPhotoAvailable: p['PHOTOAVAILABLE'] === 'Y',
  }
}

export async function getSimilarProfiles(matriId: string): Promise<SimilarProfileCard[]> {
  const userId = await getItem(SK.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&STLIMIT=0&ENDLIMIT=10&VIEWEDID=${matriId}`
  const result = await apiCall(Endpoints.profile.similar, 'POST', params)

  const ok = (result?.RESPONSECODE === '1' || result?.RESPONSECODE == 1)
    && (result?.ERRCODE === '0' || result?.ERRCODE == 0)

  const raw = ok
    ? (result?.RESPONSE?.MATCHES ?? result?.RESPONSE?.REPONSE?.MATCHES
        ?? (Array.isArray(result?.RESPONSE) ? result.RESPONSE : []) ?? [])
    : []
  const rawArr = Array.isArray(raw) ? raw : []
  const primary = rawArr
    .filter((p: any) => p && !p['BANNERSLOT'])
    .map(toSimilarCard)
    .filter(p => p.matriId)

  if (primary.length > 2) {
    _lastSimilarDebug = { source: 'primary', primaryCount: primary.length }
    return primary
  }

  // Angular: falls back to the plain matches listing — 'ID='+NBID+'&START=0&LIMIT=10
  // &LIKED=1&VIEWED=1&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1&BANNERFLAG=0' — and
  // fully replaces similarProfiles with this broader result (not merged with primary).
  const fallbackParams = `ID=${userId ?? ''}&START=0&LIMIT=10&LIKED=1&VIEWED=1&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1&BANNERFLAG=0`
  const fallbackResult = await apiCall(Endpoints.listing.matches, 'POST', fallbackParams)
  const fallbackOk = (fallbackResult?.RESPONSECODE === '1' || fallbackResult?.RESPONSECODE == 1)
    && (fallbackResult?.ERRCODE === '0' || fallbackResult?.ERRCODE == 0)
  const fallbackRaw = fallbackOk && Array.isArray(fallbackResult?.RESPONSE) ? fallbackResult.RESPONSE : []
  const fallback = fallbackRaw
    .filter((p: any) => p && !p['BANNERSLOT'])
    .map(toSimilarCard)
    .filter((p: SimilarProfileCard) => p.matriId)

  _lastSimilarDebug = {
    source: 'fallback', primaryCount: primary.length, fallbackCount: fallback.length,
  }
  if (__DEV__) console.log('DBG_SIMILARPROFILES', JSON.stringify(_lastSimilarDebug))

  return fallback.length > 0 ? fallback : primary
}
