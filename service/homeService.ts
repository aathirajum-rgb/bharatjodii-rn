import { apiCall } from './apiClient'
import { getItem, setItem, setJson } from './storageService'
import { getSession, parseAndStoreWebViewURL } from './registrationService'
import { Endpoints } from './api.endpoints'
import { StorageKeys } from '../constants/storage.keys'
import type { SwiperItem } from '../components/swiper-card/SwiperCard'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HomeSession {
  userName: string
  lang: string
  membershipType: string
  horoAvailable: boolean
  starAvailable: boolean
}

export interface BannerData {
  show: boolean
  saveAmount: string
  timeRemaining: string
  bannerText: string
}

export interface ExploreCategory {
  id: string
  label: string
  count: number
  imageUrl: string
}

export interface HelpVideo {
  id: string
  title: string
  thumbUrl: string
  videoUrl: string
}

export interface ListingResult {
  items: SwiperItem[]
  bannerSlots: Array<{ slot: string; insertAfter: number }>
  totalCount: number
  newCount: number
}

export const EMPTY_LISTING: ListingResult = { items: [], bannerSlots: [], totalCount: 0, newCount: 0 }

// ─── Profile mapper ───────────────────────────────────────────────────────────

function toProfile(p: Record<string, any>): SwiperItem {
  return {
    // Angular: profile.MATRIID is the primary ID in matches API response
    profileId:           p['MATRIID']  ?? p['NBID']  ?? p['ID'],
    name:                p['NAME'],
    age:                 p['AGE']   ? `${p['AGE']} Yrs` : undefined,
    // Angular card receives profile.HEIGHTCATEGORY (formatted string like "5'4\"")
    height:              p['HEIGHTCATEGORY'] ?? p['HEIGHT'],
    education:           p['EDUCATION'],
    // Angular: bindBasicView — LOCATION first, then CITY+STATE
    location:            p['LOCATION'] || [p['CITY'], p['STATE']].filter(Boolean).join(', ') || '',
    // Angular: FUNC.getPartnerImg() — prefers the full-size PHOTO[0].IMAGE over the
    // low-res THUMBIMG, which looked blurry once stretched to near full card width.
    profileImg:          p['PHOTO']?.[0]?.['IMAGE'] || p['THUMBIMG'],
    // Angular: IsPhotoAvailable checks PHOTOAVAILABLE == "Y", getPhotoProtect checks PHOTOPROTECTED == 'Y'
    isPhotoAvailable:    p['PHOTOAVAILABLE']  == 'Y',
    isPhotoProtect:      p['PHOTOPROTECTED']  == 'Y',
    isNewlyJoined:       p['ISNEWLYJOINED']   == '1',
    // Angular matches card: profile.LIKED (not LIKEDSTATUS) — fallback for other listing APIs
    likedStatus:         (p['LIKED'] ?? p['LIKEDSTATUS']) as SwiperItem['likedStatus'],
    isNewLabel:          p['ISNEWLABEL']  === '1',
    labelContent:        p['LABELCONTENT'],
    likedViewedDateText: p['LIKEDVIEWEDDATETEXT'] ?? p['VIEWEDDATETEXT'] ?? p['LIKEDDATETEXT'],
    // Angular: FUNC.IsPaidMember — paid if ENTRYTYPE not 'B'/'F'
    isPaidMember:        p['ENTRYTYPE'] !== undefined
                           ? !['B', 'F'].includes(String(p['ENTRYTYPE']))
                           : p['PAIDMEMBER'] === '1',
    // Angular: FUNC.IsIDVerifiedMember
    isIdVerified:        p['IDVERIFY'] === '1' || p['IDVERIFYSTATUS'] === '1',
    occupation:          p['OCCUPATION'],
    income:              p['INCOME'],
    caste:               p['CASTE'],
  }
}

function toListingResult(res: Record<string, any>): ListingResult {
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

  return {
    items,
    bannerSlots,
    totalCount: Number(res['TOTAL'] ?? res['TOTALCOUNT'] ?? res['LISTCOUNT'] ?? 0),
    newCount:   Number(res['NEWCOUNT'] ?? 0),
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

export async function refreshSession(): Promise<boolean> {
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

  if (!userId) return false

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
    if (webViewUrl) await parseAndStoreWebViewURL(webViewUrl)
    return true
  }

  if (result?.ERRCODE == 1 && result?.RESPONSECODE == 2) {
    // Both tokens dead — callers should redirect to login
    return false
  }

  return false
}

// ─── Notification count ───────────────────────────────────────────────────────
// Angular: ID=<NBID>&LOGINGENDER=<LOGINGENDER>&LASTLOGIN=<LASTLOGIN>&COMFLAG=1
// Response path: res.RESPONSE.NEWCOUNT (NOT top-level res.NEWCOUNT)

export async function fetchNotifCount(): Promise<number> {
  const [userId, gender, session] = await Promise.all([
    getItem(StorageKeys.Auth.USER_ID),
    getItem(StorageKeys.User.LOGIN_GENDER),
    getSession(),                              // LASTLOGIN lives inside USER_SESSION blob
  ])
  const lastLogin = session['LASTLOGIN'] ?? ''
  const params = `ID=${userId ?? ''}&LOGINGENDER=${gender ?? 'M'}&LASTLOGIN=${lastLogin}&COMFLAG=1`
  const res = await apiCall(Endpoints.communication.notificationCount, 'POST', params)
  if (res?.RESPONSECODE == 1 && res?.ERRCODE == '0') {
    return Number(res['RESPONSE']?.['NEWCOUNT'] ?? 0)
  }
  return 0
}

// ─── Payment banner ───────────────────────────────────────────────────────────

export async function fetchPayBanner(): Promise<BannerData> {
  const res = await apiCall(Endpoints.payment.payBanner, 'POST', '')
  return {
    show:          res['ERRCODE'] === '1' && (res['SHOWBANNER'] === '1' || !!res['SAVEAMOUNT']),
    saveAmount:    res['SAVEAMOUNT']    ?? '',
    timeRemaining: res['TIMEREMAINING'] ?? res['OFFERTIME'] ?? '',
    bannerText:    res['BANNERTEXT']    ?? res['OFFERTEXT'] ?? 'Special Offer!',
  }
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
    return raw.map((p: Record<string, any>) => ({
      profileId:        p['NBID']          ?? p['MATRIID'],
      name:             p['NAME'],
      age:              p['AGE'] ? `${p['AGE']} Yrs` : undefined,
      height:           p['HEIGHT'],
      education:        p['EDUCATION'],
      occupation:       p['OCCUPATION'],
      location:         p['LOCATION'] || [p['CITY'], p['STATE']].filter(Boolean).join(', ') || '',
      // Angular: FUNC.getPartnerImg() — prefers the full-size PHOTO[0].IMAGE over THUMBIMG
      profileImg:       p['PHOTO']?.[0]?.['IMAGE'] || p['THUMBIMG'],
      isPhotoAvailable: p['PHOTOAVAILABLE'] == 'Y',
      isPhotoProtect:   p['PHOTOPROTECTED'] == 'Y',
      likedStatus:      p['LIKEDSTATUS']  as SwiperItem['likedStatus'],
      isPaidMember:     p['ENTRYTYPE'] !== undefined ? !['B', 'F'].includes(String(p['ENTRYTYPE'])) : p['PAIDMEMBER'] === '1',
      isIdVerified:     p['IDVERIFY'] === '1' || p['IDVERIFYSTATUS'] === '1',
      caste:            p['CASTE'],
      income:           p['INCOME'],
    }))
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

// ─── All Matches ──────────────────────────────────────────────────────────────
// Angular: callMatchesApi() param string (matches default route)
// START/LIMIT instead of PAGENO — Angular never sends PAGENO for this endpoint

export async function fetchMatches(start = 0, limit = 20): Promise<ListingResult> {
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
  const res = await apiCall(Endpoints.listing.matches, 'POST', parts.join('&'))
  return toListingResult(res)
}

// ─── Profiles who viewed me ───────────────────────────────────────────────────

export async function fetchViewedYou(): Promise<ListingResult> {
  const res = await apiCall(Endpoints.listing.viewedYou, 'POST', 'PAGENO=1&TYPE=1')
  return toListingResult(res)
}

// ─── Today's / Daily recommendations ─────────────────────────────────────────

export async function fetchDailyRec(): Promise<ListingResult> {
  const res = await apiCall(Endpoints.listing.dailyRecommendations, 'POST', 'PAGENO=1')
  return toListingResult(res)
}

// ─── Newly joined ─────────────────────────────────────────────────────────────

export async function fetchNewlyJoined(): Promise<ListingResult> {
  const res = await apiCall(Endpoints.listing.matches, 'POST', 'PAGENO=1&ISNEWLYJOINED=1')
  return toListingResult(res)
}

// ─── Profiles you viewed ──────────────────────────────────────────────────────

export async function fetchViewedByMe(): Promise<ListingResult> {
  const res = await apiCall(Endpoints.listing.viewedByMe, 'POST', 'PAGENO=1&TYPE=1')
  return toListingResult(res)
}

// ─── Liked by me ──────────────────────────────────────────────────────────────

export async function fetchLikedByMe(): Promise<ListingResult> {
  const res = await apiCall(Endpoints.listing.likedByMe, 'POST', 'PAGENO=1&TYPE=1')
  return toListingResult(res)
}

// ─── Liked you ────────────────────────────────────────────────────────────────

export async function fetchLikedYou(): Promise<ListingResult> {
  const res = await apiCall(Endpoints.listing.likedYou, 'POST', 'PAGENO=1&TYPE=1')
  return toListingResult(res)
}

// ─── Explore categories ───────────────────────────────────────────────────────

export async function fetchExploreCategories(): Promise<ExploreCategory[]> {
  const res = await apiCall(Endpoints.listing.explore, 'POST', 'PAGENO=1')
  const raw = res['LIST'] ?? res['LISTDATA'] ?? []
  if (!Array.isArray(raw)) return []
  return raw.map((item: Record<string, any>, idx: number) => ({
    id:       item['ID']       ?? item['TYPE']   ?? String(idx),
    label:    item['LABEL']    ?? item['TITLE']   ?? '',
    count:    Number(item['COUNT'] ?? 0),
    imageUrl: item['IMAGEURL'] ?? item['IMGURL']  ?? '',
  }))
}

// ─── Success Stories ──────────────────────────────────────────────────────────

export async function fetchSuccessStories(): Promise<SwiperItem[]> {
  const res = await apiCall(Endpoints.registration.successStory, 'POST', 'PAGENO=1')
  const raw = res['LIST'] ?? res['LISTDATA'] ?? []
  if (!Array.isArray(raw)) return []
  return raw.map((p: Record<string, any>) => ({
    profileId:  p['NBID']     ?? p['ID'],
    name:       p['NAME'],
    location:   p['LOCATION'] ?? p['CITY'],
    profileImg: p['THUMBIMG'],
    date:       p['POSTEDDATE'] ? `Posted on ${p['POSTEDDATE']}` : (p['DATE'] ?? ''),
  }))
}

// ─── FAQ / Self-help videos (non-English only) ────────────────────────────────

export async function fetchFaqVideos(): Promise<HelpVideo[]> {
  const res = await apiCall(Endpoints.communication.faqVideo, 'POST', 'TYPE=1')
  const raw = res['LIST'] ?? res['LISTDATA'] ?? []
  if (!Array.isArray(raw)) return []
  return raw.map((item: Record<string, any>, idx: number) => ({
    id:       item['VIDEOID']  ?? item['ID']       ?? String(idx),
    title:    item['TITLE']    ?? item['NAME']      ?? '',
    thumbUrl: item['THUMBURL'] ?? item['IMAGEURL']  ?? '',
    videoUrl: item['VIDEOURL'] ?? item['URL']       ?? '',
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
  const res = await apiCall(Endpoints.payment.nbMenu, 'POST', '')
  return {
    phone:    res['CSMOBILE']  ?? res['PHONE']    ?? '',
    whatsapp: res['WAMOBILE']  ?? res['WHATSAPP'] ?? res['CSMOBILE'] ?? '',
  }
}
