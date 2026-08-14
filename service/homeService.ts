import { apiCall } from './apiClient'
import { getItem, setItem, setJson } from './storageService'
import { getSession, parseAndStoreWebViewURL } from './registrationService'
import { Endpoints } from './api.endpoints'
import { StorageKeys } from '../constants/storage.keys'
import i18n from '../i18n'
import type { SwiperItem } from '../components/swiper-card/SwiperCard'
import { stripAgeUnit, pickListingPhoto } from '../adapters/profileListing.adapter'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HomeSession {
  userName: string
  lang: string
  membershipType: string
  horoAvailable: boolean
  starAvailable: boolean
}

export interface ExploreCategory {
  id: string
  label: string
  count: number
  imageUrl: string
  // Angular: explore-card.component.ts's backgroundStyle() — a per-category
  // CSS background (solid or gradient) string from the server, e.g.
  // "linear-gradient(113deg, #DCF0FF 1.75%, #FFF 26.84%), #FFF". Falls back
  // to that same default gradient when the server omits it.
  bgColor?: string | undefined
}

export interface HelpVideo {
  id: string
  title: string
  thumbUrl: string
  videoUrl: string
}

// Angular: facetResponce (matches.page.ts:1098-1139) — refinement chips returned
// inline by the explore listing response, e.g. sub-castes/localities found among
// the current FILTERTYPE results. KEY is the raw filter value sent back in QSEARCH,
// VALUE is the display label, COUNT===0 disables the chip (matches-card.component.html
// isn't involved — this is matches.page.html's own facet chip row).
export interface ExploreFacet {
  key:     string
  value:   string
  count:   number
  checked: boolean
}

export interface ListingResult {
  items: SwiperItem[]
  bannerSlots: Array<{ slot: string; insertAfter: number }>
  totalCount: number
  newCount: number
  facets?: ExploreFacet[]
}

export const EMPTY_LISTING: ListingResult = { items: [], bannerSlots: [], totalCount: 0, newCount: 0 }

// ─── Profile mapper ───────────────────────────────────────────────────────────

// Exported so DailyRecommendationScreen can run drService's raw (uncached-envelope)
// profile array through the exact same raw->SwiperItem mapping fetchMatches()/
// fetchDailyRecommendations() below already use, instead of hand-rolling a second one.
export function toProfile(p: Record<string, any>): SwiperItem {
  return {
    // Angular: profile.MATRIID is the primary ID in matches API response
    profileId:           p['MATRIID']  ?? p['NBID']  ?? p['ID'],
    name:                p['NAME'],
    // Some listing endpoints (e.g. pagination/explore) send AGE already suffixed
    // ("27 Yrs"), others send a bare number ("27") — strip any existing unit before
    // appending our own, or a pre-suffixed value doubles up ("27 Yrs" + " Yrs").
    age:                 p['AGE']   ? `${stripAgeUnit(p['AGE'])} Yrs` : undefined,
    // Angular card receives profile.HEIGHTCATEGORY (formatted string like "5'4\"")
    height:              p['HEIGHTCATEGORY'] ?? p['HEIGHT'],
    education:           p['EDUCATION'],
    // Angular: bindBasicView() — NRI profiles show "{NRISTATE}, {NRICOUNTRY}" instead of
    // city/state when both are present; otherwise LOCATION first, then CITY+STATE.
    location:            (p['NRISTATE'] && p['NRICOUNTRY'])
                            ? `${p['NRISTATE']}, ${p['NRICOUNTRY']}`
                            : p['LOCATION'] || [p['CITY'], p['STATE']].filter(Boolean).join(', ') || '',
    profileImg:          pickListingPhoto(p),
    // Full photo array for the multi-photo swiper (Angular: matches-card.component's
    // profileImageArr). Falls back to a single-item array from profileImg/THUMBIMG so
    // callers can always treat `photos` as the source of truth.
    photos: Array.isArray(p['PHOTO']) && p['PHOTO'].length > 0
      ? p['PHOTO'].map((ph: any) => ph?.['IMAGE']).filter(Boolean)
      : [p['THUMBIMG']].filter(Boolean),
    // Angular: IsPhotoAvailable checks PHOTOAVAILABLE == "Y", getPhotoProtect checks PHOTOPROTECTED == 'Y'
    isPhotoAvailable:    p['PHOTOAVAILABLE']  == 'Y',
    isPhotoProtect:      p['PHOTOPROTECTED']  == 'Y',
    isNewlyJoined:       p['ISNEWLYJOINED']   == '1',
    // Angular matches card: profile.LIKED (not LIKEDSTATUS) — fallback for other listing APIs
    likedStatus:         (p['LIKED'] ?? p['LIKEDSTATUS']) as SwiperItem['likedStatus'],
    phoneViewed:         p['PHONEVIEWED'],
    // Angular: FUNC.disableDontShow()/disableViewLater() — '1'/'3' means the action
    // was already taken (from our side, or both sides) on a re-fetched profile.
    dontShowStatus:      p['STATUS'],
    viewLaterStatus:     p['VIEWLATER'],
    isNewLabel:          p['ISNEWLABEL']  === '1',
    labelContent:        p['LABELCONTENT'],
    // COMTEXTDATE — Angular's activity.component.html binds this straight to
    // matches-card's LabelText for BOTH liked tabs. Missing from this fallback
    // chain was the actual root cause of the "liked you on DATE" strip never
    // showing for Activity-sourced profiles at all (the other 3 field names
    // are never sent by the likedyou/likedbyme endpoints).
    likedViewedDateText: p['LIKEDVIEWEDDATETEXT'] ?? p['VIEWEDDATETEXT'] ?? p['LIKEDDATETEXT'] ?? p['COMTEXTDATE'],
    // Angular: FUNC.IsPaidMember — paid if ENTRYTYPE not 'B'/'F'. MEMBERSHIPTYPE is a
    // confirmed alternate name for the same value (registrationService.ts:768 maps it
    // to ENTRYTYPE the same way) — some listing shapes send that one instead.
    isPaidMember:        (p['ENTRYTYPE'] ?? p['MEMBERSHIPTYPE']) !== undefined
                           ? !['B', 'F'].includes(String(p['ENTRYTYPE'] ?? p['MEMBERSHIPTYPE']))
                           : p['PAIDMEMBER'] == '1',
    // Angular: FUNC.IsIDVerifiedMember. IDVERIFIED is a third field name confirmed
    // via live debugging — some listing shapes send that instead of either of the
    // other two.
    isIdVerified:        p['IDVERIFY'] == '1' || p['IDVERIFYSTATUS'] == '1' || p['IDVERIFIED'] == '1',
    occupation:          p['OCCUPATION'],
    // Some listing shapes send MONTHLYINCOME instead of INCOME for the same value
    // (registrationService.ts's own profile mapper already falls back the same way).
    income:              p['INCOME'] ?? p['MONTHLYINCOME'],
    caste:               p['CASTE'],
  }
}

// Exported so other listing screens (e.g. ActivityScreen's liked-profile tabs)
// can parse their own RESPONSE/TOTAL envelope through the same SwiperItem
// mapping instead of hand-rolling a second raw->UI adapter.
export function toListingResult(res: Record<string, any>): ListingResult {
  // Angular matches API: profiles in res['RESPONSE'] (array), count in res['TOTAL']
  // Other listing APIs may use res['LIST'] / res['TOTALCOUNT'] — keep fallbacks
  const raw = res['RESPONSE'] ?? res['LIST'] ?? res['LISTDATA'] ?? []
  const all = Array.isArray(raw) ? raw : []

  const items: SwiperItem[] = []
  const bannerSlots: Array<{ slot: string; insertAfter: number }> = []

  for (const p of all) {
    // STATUS 997/999/1000 = loader / end-of-list / hidden placeholders
    if (p['STATUS'] === '997' || p['STATUS'] === '999' || p['STATUS'] === '1000') continue
    if (p['BANNERSLOT']) {
      // Track banner position as "after N profile items"
      bannerSlots.push({ slot: String(p['BANNERSLOT']), insertAfter: items.length })
      continue
    }
    items.push(toProfile(p))
  }

  const rawFacets = res['FACETRESPONSE']
  const facets: ExploreFacet[] | undefined = Array.isArray(rawFacets)
    ? rawFacets.map((f: Record<string, any>) => ({
        key:     String(f['KEY']   ?? ''),
        value:   String(f['VALUE'] ?? ''),
        count:   Number(f['COUNT'] ?? 0),
        checked: false,
      }))
    : undefined

  return {
    items,
    bannerSlots,
    totalCount: Number(res['TOTAL'] ?? res['TOTALCOUNT'] ?? res['LISTCOUNT'] ?? 0),
    newCount:   Number(res['NEWCOUNT'] ?? 0),
    ...(facets ? { facets } : {}),
  }
}

// ─── Session ──────────────────────────────────────────────────────────────────
// User profile data is stored in a single USER_SESSION JSON blob (see storeWebURLData
// in registrationService.ts) — NOT as individual AsyncStorage keys.
// Only ATN, RTN, NBID, LOGINGENDER, CCODE/MCODE, and LANG are individual keys.

export async function fetchHomeSession(): Promise<HomeSession> {
  const [session, lang] = await Promise.all([
    getSession(),                        // reads USER_SESSION blob
    getItem(StorageKeys.Auth.LANG),      // individual key set by LanguageSelectionScreen
  ])
  return {
    userName:       String(session['NAME']               ?? ''),
    lang:           lang                                 ?? 'en',
    membershipType: String(session['ENTRYTYPE']          ?? ''),  // stored as ENTRYTYPE not MEMBERSHIPTYPE
    horoAvailable:  session['HOROSCOPEAVAILABLE'] === '1',
    starAvailable:  !!session['STAR'],
  }
}

// ─── Session refresh ──────────────────────────────────────────────────────────
// Mirrors Angular's autoLogin(skipParse=1, onboardingFlow=false, hasloadWebUrl=true).
// Angular params: ID&CLIENTIP&DEVICEDETAIL&APPVERSION&MCODE&REGISTERID&DEVICEID&NALLOW&NEWREG=1
// On ERRCODE=="0": store ATN/RTN from top-level response, then parse WEBVIEWURL if present.
// On ERRCODE=="1" && RESPONSECODE=="2": session is fully expired — caller handles.

export interface RefreshSessionResult {
  success: boolean
  // Angular: webview.page.ts's :page_id route param, embedded as the trailing
  // segment of WEBVIEWURL — drives pageLandingService.ts's handlePageLanding().
  // Existing callers here all fire-and-forget (`await refreshSession()`, result
  // unused), so widening this from a plain boolean is safe.
  pageId?: string | undefined
}

export async function refreshSession(): Promise<RefreshSessionResult> {
  const [
    userId,
    ipAddress,
    deviceDetail,
    appVersion,
    mcode,
    registerId,
    deviceId,
    nallow,
  ] = await Promise.all([
    getItem(StorageKeys.Auth.USER_ID),
    getItem('USERIP'),
    getItem('DEVICEDETAIL'),
    getItem(StorageKeys.App.APP_VERSION),
    getItem(StorageKeys.User.MEMBER_CODE),
    getItem('REGISTERID'),
    getItem('DEVICEID'),
    getItem(StorageKeys.App.NALLOW),
  ])

  if (!userId) return { success: false }

  const params = [
    `ID=${userId}`,
    `CLIENTIP=${ipAddress ?? ''}`,
    `DEVICEDETAIL=${deviceDetail ?? ''}`,
    `APPVERSION=${appVersion ?? ''}`,
    `MCODE=${mcode ?? ''}`,
    `REGISTERID=${registerId ?? ''}`,
    `DEVICEID=${deviceId ?? ''}`,
    `NALLOW=${nallow ?? '0'}`,
    'NEWREG=1',
  ].join('&')

  const result = await apiCall(Endpoints.auth.autoLogin, 'POST', params)

  if (result?.ERRCODE === '0' || result?.ERRCODE == 0) {
    // Store tokens from top-level response first (Angular: setLocalStorageUserValue)
    if (result.ATN) await setItem(StorageKeys.Auth.TOKEN,         result.ATN)
    if (result.RTN) await setItem(StorageKeys.Auth.REFRESH_TOKEN, result.RTN)
    // Parse WEBVIEWURL for full session data (user profile, flags, etc.)
    const webViewUrl = result?.RESPONSE?.WEBVIEWURL
    const pageId = webViewUrl ? await parseAndStoreWebViewURL(webViewUrl) : undefined
    return { success: true, pageId }
  }

  if (result?.ERRCODE == 1 && result?.RESPONSECODE == 2) {
    // Both tokens dead — callers should redirect to login
    return { success: false }
  }

  return { success: false }
}

// ─── Notification count ───────────────────────────────────────────────────────
// Angular: ID=<NBID>&LOGINGENDER=<LOGINGENDER>&LASTLOGIN=<LASTLOGIN>&COMFLAG=1
// Response path: res.RESPONSE.NEWCOUNT (NOT top-level res.NEWCOUNT)

export interface ComCountEntry {
  comtype:    string
  newcount:   string
  cardType:   string
  totalCount: string
}

export interface NotifCountResult {
  newCount: number
  comCount: ComCountEntry[]
}

export async function fetchNotifCount(): Promise<NotifCountResult> {
  const [userId, gender, session] = await Promise.all([
    getItem(StorageKeys.Auth.USER_ID),
    getItem(StorageKeys.User.LOGIN_GENDER),
    getSession(),                              // LASTLOGIN lives inside USER_SESSION blob
  ])
  const lastLogin = session['LASTLOGIN'] ?? ''
  const params = `ID=${userId ?? ''}&LOGINGENDER=${gender ?? 'M'}&LASTLOGIN=${lastLogin}&COMFLAG=1`
  const res = await apiCall(Endpoints.communication.notificationCount, 'POST', params)
  if (res?.RESPONSECODE == 1 && res?.ERRCODE == '0') {
    return {
      newCount: Number(res['RESPONSE']?.['NEWCOUNT'] ?? 0),
      comCount: res['RESPONSE']?.['COMCOUNT'] ?? [],
    }
  }
  return { newCount: 0, comCount: [] }
}

// ─── Menu promo (MATCHESSLOT membership banner) ───────────────────────────────
// Angular: paymentService.getMenuPromo(0) → payment/nbmenu/v1
// Returns MATCHESSLOT (festival/membership offer), MANYJOBSPROMO, ASSISTEDPROMO, etc.
// Cached in MENU_PROMO localStorage by Angular — we fetch fresh each session.

export async function fetchMenuPromo(): Promise<any> {
  const id          = await getItem(StorageKeys.Auth.USER_ID)
  const renewalFlag = await getItem('RENEWALENABLEKEY') ?? '0'
  const params = `ID=${id ?? ''}&RENEWALFLAG=${renewalFlag}&AUTOUPIFLAG=0&PAYAPITYPE=7`
  try {
    const res = await apiCall(Endpoints.payment.nbMenu, 'POST', params)
    if (String(res['ERRCODE']) === '0' && res['RESPONSE']) {
      return res['RESPONSE']
    }
  } catch {}
  return null
}

// ─── PP set data (member preference) ─────────────────────────────────────────
// Angular: profileService.getPPSETData(1) → editprofile/getpreference/v1
// Params: ID=&GENDER= (angular: getApiParams(id, 'getmemberPreference'))
// Stores full RESPONSE blob in PPSETDATA (read by communicationService for call/whatsapp)
// Also stores PHOTOCOUNT, PHOTOAVAILABLE, VERIFIEDBYCALLNUM

export async function fetchAndStorePPSetData(): Promise<Record<string, any>> {
  const [userId, gender] = await Promise.all([
    getItem(StorageKeys.Auth.USER_ID),
    getItem(StorageKeys.User.LOGIN_GENDER),
  ])
  const params = `ID=${userId ?? ''}&GENDER=${gender ?? 'M'}`
  const res = await apiCall(Endpoints.profile.getPreference, 'POST', params)
  if (String(res?.RESPONSECODE) === '1' && String(res?.ERRCODE) === '0') {
    const data: Record<string, any> = res.RESPONSE ?? {}
    await setJson(StorageKeys.App.PP_SET_DATA, data)
    return data
  }
  return {}
}

// ─── Complete Your Profile (PCS) cards ────────────────────────────────────────
// Angular: getPPSETData()'s PCS array — each entry with FLAG===1 is an incomplete
// profile-completion card. This is a pure mapper over fetchAndStorePPSetData()'s
// output; the "already completed" filter (HOROSCOPE/PHOTO removal) is gating
// logic and lives in screens/home/homeGating.ts's filterCompleteProfileCards().

export interface CompleteProfileCard {
  type:     'HOROSCOPE' | 'STAR_RAASI' | 'PROPERTY' | 'VEHICLE' | 'FAMILY' | 'IDVERIFY' | 'DIET' | 'HOMETOWN' | 'PHOTO'
  // Angular: complete-profile.component.html reads card?.CONTENT and card?.THUMBIMG
  // directly from each server-returned PCS entry — NOT a client-side label/icon
  // lookup per type (a previous version of this port hardcoded English strings
  // and guessed CDN icon paths here instead, which breaks for every other
  // language and would show non-existent icons).
  label:    string
  imageUrl: string
  // Angular: complete-profile.component.ts's getCTAText(card) — 'Add' for every
  // card except PHOTO/HOROSCOPE, which use their own translation keys (all three
  // happen to read "Add" in English, but can differ in other languages).
  ctaLabel: string
}

const CTA_KEY: Partial<Record<CompleteProfileCard['type'], string>> = {
  PHOTO:     'PROFILES.ADDYOURPHOTO',
  HOROSCOPE: 'PROFILES.ADDYOURHORO',
}

// Angular: getPPSETData()'s PCS array. Field names for TYPE/CONTENT/THUMBIMG and
// whether FLAG is numeric or string are unverified against a live payload —
// mapped defensively with fallbacks.
export function mapCompleteProfileCards(ppSetData: Record<string, any>): CompleteProfileCard[] {
  const raw = ppSetData?.['PCS']
  if (!Array.isArray(raw)) return []
  const cards: CompleteProfileCard[] = []
  const validTypes: CompleteProfileCard['type'][] =
    ['PHOTO', 'HOROSCOPE', 'STAR_RAASI', 'PROPERTY', 'VEHICLE', 'FAMILY', 'IDVERIFY', 'DIET', 'HOMETOWN']
  for (const entry of raw) {
    const flag = entry?.['FLAG']
    if (flag !== 1 && flag !== '1') continue
    const type = String(entry?.['TYPE'] ?? entry?.['NAME'] ?? entry?.['CODE'] ?? '') as CompleteProfileCard['type']
    if (!validTypes.includes(type)) continue
    cards.push({
      type,
      label:    String(entry?.['CONTENT'] ?? ''),
      imageUrl: String(entry?.['THUMBIMG'] ?? ''),
      ctaLabel: i18n.t(CTA_KEY[type] ?? 'HOME.ADD'),
    })
  }
  return cards
}

// ─── Daily recommendations ────────────────────────────────────────────────────
// Angular: drService.callingDailyRecommendationAPI(ID)
// Params: ID&START=0&LIMIT=15&LIKED=1&VIEWED=1&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1&MYHOME=1
// Returns profiles for the swipe-card DR screen (separate route in Angular)

export async function fetchDailyRecommendations(): Promise<SwiperItem[]> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&START=0&LIMIT=15&LIKED=1&VIEWED=1&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1&MYHOME=1`
  const res = await apiCall(Endpoints.listing.dailyRecommendations, 'POST', params)
  if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0) {
    const raw = Array.isArray(res.RESPONSE) ? res.RESPONSE : []
    return raw.map(toProfile)
  }
  return []
}

// ─── Extended matches count ───────────────────────────────────────────────────
// Angular: getExtendedMatchesCount() — called after matches load, START=0&LIMIT=1 to get count only
// Returns 0 if no extended matches or if on a filter page.

export async function fetchExtendedMatchesCount(): Promise<number> {
  const [session, userId] = await Promise.all([
    getSession(),
    getItem(StorageKeys.Auth.USER_ID),
  ])
  const loginCount = session['LOGINCOUNT'] ?? '0'
  const params = [
    `ID=${userId ?? ''}`,
    'START=0',
    'LIMIT=1',
    'LIKED=1',
    'VIEWED=0',
    'REPORTED=1',
    'BLOCKED=1',
    'REMOVED=1',
    'SKIPED=1',
    'BANNERFLAG=0',
    `LOGINCOUNT=${loginCount}`,
  ].join('&')
  const res = await apiCall(Endpoints.listing.extendedMatches, 'POST', params)
  if (res['ERRCODE'] === '0' && Number(res['TOTAL']) > 0) {
    return Number(res['TOTAL'])
  }
  return 0
}

// ─── Extended matches (real fetch, not just the count) ───────────────────────
// Angular: getExtendedMatches() — same endpoint as the count check above, but
// with a real start/limit to actually fetch the extended-matches profiles for
// the "Continue seeing profiles" end-card tap.

export async function fetchExtendedMatches(start = 0, limit = 20): Promise<ListingResult> {
  const [session, userId] = await Promise.all([
    getSession(),
    getItem(StorageKeys.Auth.USER_ID),
  ])
  const loginCount = session['LOGINCOUNT'] ?? '0'
  const params = [
    `ID=${userId ?? ''}`,
    `START=${start}`,
    `LIMIT=${limit}`,
    'LIKED=1',
    'VIEWED=0',
    'REPORTED=1',
    'BLOCKED=1',
    'REMOVED=1',
    'SKIPED=1',
    'BANNERFLAG=0',
    `LOGINCOUNT=${loginCount}`,
  ].join('&')
  const res = await apiCall(Endpoints.listing.extendedMatches, 'POST', params)
  return toListingResult(res)
}

// ─── All Matches ──────────────────────────────────────────────────────────────
// Angular: callMatchesApi() param string (matches default route)
// START/LIMIT instead of PAGENO — Angular never sends PAGENO for this endpoint

// Quick-filter chip fields — Angular: FilterService.getUrlParams() appends these
// three raw flags onto the listing params once any quick-filter chip is active
// (matches.page.ts clickOnFilterChip() / filter.service.ts getUrlParams():115).
// We mirror only these three flags on the existing matches listing endpoint,
// rather than porting the full Search/Filter preference-encoded (SETPP) endpoint
// switch — that's a separate, much larger subsystem outside the Matches screen.
export interface QuickFilters {
  profileCreated?:     boolean
  photoAvailable?:      boolean
  horoscopeAvailable?: boolean
}

export async function fetchMatches(start = 0, limit = 20, quickFilters?: QuickFilters): Promise<ListingResult> {
  const [session, userId, ekycStatus, gender] = await Promise.all([
    getSession(),
    getItem(StorageKeys.Auth.USER_ID),
    getItem('EKYCSTATUS'),
    getItem(StorageKeys.User.LOGIN_GENDER),
  ])
  const loginCount = session['LOGINCOUNT'] ?? '0'
  // Angular: EKYCFLAG=1 only for nonIdVerifyUser (EKYCSTATUS=="0" && LOGINGENDER=="M")
  const nonIdVerifyUser = ekycStatus === '0' && gender === 'M'
  const parts = [
    `ID=${userId ?? ''}`,
    `START=${start}`,
    `LIMIT=${limit}`,
    'LIKED=1',
    'VIEWED=0',
    'REPORTED=1',
    'BLOCKED=1',
    'REMOVED=1',
    'SKIPED=1',
    'BANNERFLAG=1',
    `LOGINCOUNT=${loginCount}`,
    'FREEMATCHFLAG=0',
  ]
  if (nonIdVerifyUser) parts.push('EKYCFLAG=1')
  if (quickFilters?.profileCreated)     parts.push('PROFILECREATED=1')
  if (quickFilters?.photoAvailable)     parts.push('PHOTOAVAILABLE=1')
  if (quickFilters?.horoscopeAvailable) parts.push('HOROSCOPEAVAILABLE=1')
  const res = await apiCall(Endpoints.listing.matches, 'POST', parts.join('&'))
  return toListingResult(res)
}

// ─── Explore by category ───────────────────────────────────────────────────────
// Angular: callMatchesApi() explorePage branch (matches.page.ts:988-1002) — same
// listing shape as fetchMatches, filtered to one category (FILTERTYPE) instead of
// the default feed. qSearch is the pipe-joined facet KEY selection (pillFilter()),
// e.g. narrowing "Graduate and above" further by a sub-caste facet chip.

export async function fetchExplore(filterType: string, start = 0, limit = 20, qSearch = ''): Promise<ListingResult> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const parts = [
    `ID=${userId ?? ''}`,
    `START=${start}`,
    `LIMIT=${limit}`,
    `FILTERTYPE=${filterType}`,
    'LISTTYPE=LIST',
    'LIKED=1',
    'VIEWED=0',
    'REPORTED=1',
    'BLOCKED=1',
    'REMOVED=1',
    'SKIPED=1',
    'BANNERFLAG=1',
  ]
  if (qSearch) parts.push(`QSEARCH=${qSearch}`)
  const res = await apiCall(Endpoints.listing.explore, 'POST', parts.join('&'))
  return toListingResult(res)
}

// ─── Nearby matches ─────────────────────────────────────────────────────────────
// Angular: webview.page.ts's callingListAPI("nearbymatches") — its own dedicated
// endpoint (listing/nearbymatches/v1), not the generic explore/v1 FILTERTYPE
// mechanism fetchExplore() uses. Param shape is callingListAPI's plain
// (non-notify, non-dailyrecommendations) branch: LIMIT=20, no BANNERFLAG/
// LOGINCOUNT/FREEMATCHFLAG (those are fetchMatches()-specific additions).

export async function fetchNearbyMatches(start = 0, limit = 20): Promise<ListingResult> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const parts = [
    `ID=${userId ?? ''}`,
    `START=${start}`,
    `LIMIT=${limit}`,
    'LIKED=1',
    'VIEWED=1',
    'REPORTED=1',
    'BLOCKED=1',
    'REMOVED=1',
    'SKIPED=1',
  ]
  const res = await apiCall(Endpoints.listing.nearbyMatches, 'POST', parts.join('&'))
  return toListingResult(res)
}

// ─── Search / Filter results ────────────────────────────────────────────────────
// Angular: search.component.ts applyFilter()/getMatchesCount() — both hit
// search/searchform/v1, the former for the final "show matches" list, the latter
// (LIMIT=1) purely to read back RESPONSE.TOTAL for the live "Show N matches" CTA.
// `searchParams` is the pre-built query string from filterService.buildSearchParams().

export async function fetchSearchResults(searchParams: string): Promise<ListingResult> {
  const res = await apiCall(Endpoints.search.form, 'POST', searchParams)
  return toListingResult(res)
}

// ─── Profiles who viewed me ───────────────────────────────────────────────────
// Angular: ID,START=0,LIMIT=20,BANNERFLAG=0,MYHOME=1,LASTLOGIN — confirmed live
// against a real staging account; the previous PAGENO=1&TYPE=1 shape returned
// ERRCODE 23 ("ATN and RTN Expire!", a red herring — the real cause is the
// server rejecting the unrecognized param shape) even with a fully valid token.

export async function fetchViewedYou(): Promise<ListingResult> {
  const [userId, session] = await Promise.all([getItem(StorageKeys.Auth.USER_ID), getSession()])
  const params = `ID=${userId ?? ''}&START=0&LIMIT=20&BANNERFLAG=0&MYHOME=1&LASTLOGIN=${session['LASTLOGIN'] ?? ''}`
  const res = await apiCall(Endpoints.listing.viewedYou, 'POST', params)
  return toListingResult(res)
}

// ─── Today's / Daily recommendations ─────────────────────────────────────────
// Angular: ID,START=0,LIMIT=15,LIKED=1,VIEWED=1,REPORTED=1,BLOCKED=1,REMOVED=1,
// SKIPED=1,MYHOME=1 — same shape fetchDailyRecommendations() below already uses;
// this wrapper just returns the ListingResult (with totalCount) shape Home needs.

export async function fetchDailyRec(): Promise<ListingResult> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&START=0&LIMIT=15&LIKED=1&VIEWED=1&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1&MYHOME=1`
  const res = await apiCall(Endpoints.listing.dailyRecommendations, 'POST', params)
  return toListingResult(res)
}

// ─── Newly joined ─────────────────────────────────────────────────────────────
// Angular: same listing/matches/v1 endpoint as All Matches, with NEWMATCHES=1 —
// ID,START=0,LIMIT=30,LIKED=1,VIEWED=1,REPORTED=1,BLOCKED=1,REMOVED=1,SKIPED=1,
// BANNERFLAG=0,LOGINCOUNT,NEWMATCHES=1,MYHOME=1.

export async function fetchNewlyJoined(): Promise<ListingResult> {
  const [userId, session] = await Promise.all([getItem(StorageKeys.Auth.USER_ID), getSession()])
  const loginCount = session['LOGINCOUNT'] ?? '0'
  const parts = [
    `ID=${userId ?? ''}`, 'START=0', 'LIMIT=30', 'LIKED=1', 'VIEWED=1',
    'REPORTED=1', 'BLOCKED=1', 'REMOVED=1', 'SKIPED=1', 'BANNERFLAG=0',
    `LOGINCOUNT=${loginCount}`, 'NEWMATCHES=1', 'MYHOME=1',
  ]
  const res = await apiCall(Endpoints.listing.matches, 'POST', parts.join('&'))
  return toListingResult(res)
}

// ─── Profiles you viewed ──────────────────────────────────────────────────────
// Angular: ID,START=0,LIMIT=10,BANNERFLAG=0,SKIPED=1,MYHOME=1.

export async function fetchViewedByMe(): Promise<ListingResult> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&START=0&LIMIT=10&BANNERFLAG=0&SKIPED=1&MYHOME=1`
  const res = await apiCall(Endpoints.listing.viewedByMe, 'POST', params)
  return toListingResult(res)
}

// ─── Liked by me ──────────────────────────────────────────────────────────────
// Angular: ID,START=0,LIMIT=10,BANNERFLAG=0,SKIPED=1.

export async function fetchLikedByMe(): Promise<ListingResult> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&START=0&LIMIT=10&BANNERFLAG=0&SKIPED=1`
  const res = await apiCall(Endpoints.listing.likedByMe, 'POST', params)
  return toListingResult(res)
}

// ─── Liked you ────────────────────────────────────────────────────────────────
// Angular: ID,START=0,LIMIT=10,BANNERFLAG=0,SKIPED=1.

export async function fetchLikedYou(): Promise<ListingResult> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&START=0&LIMIT=10&BANNERFLAG=0&SKIPED=1`
  const res = await apiCall(Endpoints.listing.likedYou, 'POST', params)
  return toListingResult(res)
}

// ─── Explore categories ───────────────────────────────────────────────────────
// Angular: getExploreMatchesCount() → listing/explorecount/v1. TYPES is built
// from PPSET's DISCOVERKEY — an array of {TYPE, KEY} entries, NOT a ready-made
// string — by common.discoverType(DISCOVERKEY, ['0']): keep entries whose
// TYPE === '0' (the only value Home ever calls with), collect their KEY, join
// with '~'. Response's RESPONSE is an object keyed by arbitrary group names,
// each value an ARRAY of item objects (TITLE/ICON/FILTER/BGCOLOUR/COUNT) —
// confirmed against explore.component.ts's own parsing (flattens every key's
// array together, keeps items with COUNT > 0). This one call is Home's entire
// data source for the section — there's no separate "list categories" call.

function discoverKeyTypes(discoverKey: unknown): string {
  if (!Array.isArray(discoverKey)) return ''
  return discoverKey
    .filter((entry: any) => String(entry?.['TYPE']) === '0')
    .map((entry: any) => entry?.['KEY'])
    .filter(Boolean)
    .join('~')
}

export async function fetchExploreCategories(discoverKey?: unknown): Promise<ExploreCategory[]> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const parts = [
    `ID=${userId ?? ''}`,
    `TYPES=${discoverKeyTypes(discoverKey)}`,
    'START=0', 'LIMIT=1', 'LISTTYPE=COUNT',
    'LIKED=1', 'VIEWED=0', 'REPORTED=1', 'BLOCKED=1', 'REMOVED=1', 'SKIPED=1', 'BANNERFLAG=0',
  ]
  const res = await apiCall(Endpoints.listing.exploreCount, 'POST', parts.join('&'))
  const respObj = res['RESPONSE']
  if (!respObj || typeof respObj !== 'object') return []

  const items: Record<string, any>[] = []
  for (const value of Object.values(respObj)) {
    if (Array.isArray(value)) items.push(...value)
  }
  return items
    .filter(item => Number(item['COUNT']) > 0)
    .map((item, idx) => ({
      // Angular: explore-card.component.html's ACTIVE (non-commented) template
      // reads exploreData.TITLE (count already baked in server-side, no separate
      // count element) and exploreData.ICON (a small icon, not a full tile image).
      id:       item['FILTER'] ?? String(idx),
      label:    String(item['TITLE'] ?? ''),
      count:    Number(item['COUNT'] ?? 0),
      imageUrl: String(item['ICON'] ?? ''),
      bgColor:  item['BGCOLOUR'] ?? undefined,
    }))
}

// ─── Profile-validation-rejected sticky banner ────────────────────────────────
// Angular: common.getProfileValidationData() → registrationform/v1?type=PROFILEVALID,
// shown as a sticky above the footer (PISTATUS in [5,13] — profile rejected/under
// review). Confirmed against common.ts's getProfileValidationData()
// (`type=PROFILEVALID&LANG=...`, no ID param) and bottom-sheet.service.ts's
// assignStickyData()/assignBottomUpData() for the exact response shape:
// RESPONSE.PROSTICKY = {TITLE, CTA, IMG} (the sticky's own content — TITLE is
// the sticky text) and RESPONSE.PROBOTTOM = {TITLE, CONTENT, CTA, IMG, CTAIMG}
// (the bottom sheet shown when the sticky is tapped).

export interface ProfileValidationBanner {
  stickyContent:  string
  stickyImg?:     string | undefined
  bottomTitle:    string
  bottomContent:  string
  bottomImg?:     string | undefined
  bottomCtaLabel: string
}

export async function fetchProfileValidationBanner(): Promise<ProfileValidationBanner | null> {
  const lang = (await getItem(StorageKeys.Auth.LANG)) ?? 'en'
  const res = await apiCall(Endpoints.registration.initialFetch, 'POST', `type=PROFILEVALID&LANG=${lang}`)
  if (String(res?.ERRCODE) !== '0' || !res?.RESPONSE) return null
  const sticky = res.RESPONSE['PROSTICKY'] ?? {}
  const bottom  = res.RESPONSE['PROBOTTOM'] ?? {}
  const stickyContent = sticky['TITLE']
  if (!stickyContent) return null
  return {
    stickyContent:  String(stickyContent),
    stickyImg:      sticky['IMG'] || undefined,
    bottomTitle:    String(bottom['TITLE'] ?? ''),
    bottomContent:  String(bottom['CONTENT'] ?? ''),
    bottomImg:      bottom['IMG'] || undefined,
    bottomCtaLabel: String(bottom['CTA'] ?? ''),
  }
}

// ─── Success Stories ──────────────────────────────────────────────────────────
// Angular: ID,TYPE=5.

export async function fetchSuccessStories(): Promise<SwiperItem[]> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const res = await apiCall(Endpoints.registration.successStory, 'POST', `ID=${userId ?? ''}&TYPE=5`)
  // Angular: response nests the array at RESPONSE.SUCCESSSTORY, not top-level.
  const raw = res['RESPONSE']?.['SUCCESSSTORY'] ?? res['LIST'] ?? res['LISTDATA'] ?? []
  if (!Array.isArray(raw)) return []
  return raw.map((p: Record<string, any>) => {
    // Angular: app-swiper.component.ts's getSuccessStoryName() — "${GroomName}
    // & ${BrideName}", not a single NAME field.
    const groom = p['GroomName'] ?? p['GROOMNAME']
    const bride = p['BrideName'] ?? p['BRIDENAME']
    return {
      profileId:  p['NBID']     ?? p['ID'],
      name:       (groom || bride) ? `${groom ?? ''} & ${bride ?? ''}` : p['NAME'],
      // Angular: profile-card.component.html type==='4' binds [location]="cardContent.DISTRICT".
      location:   p['DISTRICT'] ?? p['LOCATION'] ?? p['CITY'],
      profileImg: p['THUMBIMG'],
      // Angular binds [date]="cardContent?.TimePosted" directly — no "Posted
      // on" prefix added client-side (the server string already includes it).
      date:       p['TimePosted'] ?? p['POSTEDDATE'] ?? p['DATE'] ?? '',
    }
  })
}

// ─── FAQ / Self-help videos (non-English only) ────────────────────────────────
// Angular: ID,TYPE=MYHOME (not a bare TYPE=1 — that was the wrong shape).

export async function fetchFaqVideos(): Promise<HelpVideo[]> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const res = await apiCall(Endpoints.communication.faqVideo, 'POST', `ID=${userId ?? ''}&TYPE=MYHOME`)
  const raw = res['LIST'] ?? res['LISTDATA'] ?? res['RESPONSE'] ?? []
  if (!Array.isArray(raw)) return []
  // Angular: complete-profile.component.html's self-video swiper slide binds
  // completeCard.QUS (caption), completeCard.BGIMG (background image), and
  // completeCard.VIDEO (playback source) — not TITLE/THUMBURL/VIDEOURL.
  return raw.map((item: Record<string, any>, idx: number) => ({
    id:       item['VIDEOID']  ?? item['ID']       ?? String(idx),
    title:    item['QUS']      ?? item['TITLE']    ?? item['NAME']     ?? '',
    thumbUrl: item['BGIMG']    ?? item['THUMBURL'] ?? item['IMAGEURL'] ?? '',
    videoUrl: item['VIDEO']    ?? item['VIDEOURL'] ?? item['URL']      ?? '',
  }))
}

// ─── Customer care ────────────────────────────────────────────────────────────
// Tries AsyncStorage first (populated at login), falls back to nbMenu API.

export async function fetchCustomerCare(): Promise<{ phone: string; whatsapp: string }> {
  const stored = await getItem(StorageKeys.App.CUSTOMER_CARE)
  if (stored) {
    try {
      const data = JSON.parse(stored)
      const phone    = data['PHONE']    ?? data['MOBILE']   ?? data['CSMOBILE'] ?? ''
      const whatsapp = data['WHATSAPP'] ?? data['WAMOBILE'] ?? phone
      if (phone || whatsapp) return { phone, whatsapp }
    } catch { /* fall through to API */ }
  }
  // Same shape confirmed working for getMenuPromo() in paymentService.ts —
  // the previous empty-string params here was almost certainly hitting the
  // same "unrecognized shape" rejection as the other functions fixed above.
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const res = await apiCall(Endpoints.payment.nbMenu, 'POST', `ID=${userId ?? ''}&TYPE=MENU`)
  // Fields may be top-level or nested under RESPONSE depending on this
  // endpoint's actual envelope (unconfirmed) — check both.
  const data = res['RESPONSE'] ?? res
  return {
    phone:    data['CSMOBILE']  ?? data['PHONE']    ?? '',
    whatsapp: data['WAMOBILE']  ?? data['WHATSAPP'] ?? data['CSMOBILE'] ?? '',
  }
}
