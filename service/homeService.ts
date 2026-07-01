import { apiCall } from './apiClient'
import { getItem } from './storageService'
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
  totalCount: number
  newCount: number
}

export const EMPTY_LISTING: ListingResult = { items: [], totalCount: 0, newCount: 0 }

// ─── Profile mapper ───────────────────────────────────────────────────────────

function toProfile(p: Record<string, any>): SwiperItem {
  return {
    profileId:           p['NBID']                ?? p['ID'],
    name:                p['NAME'],
    age:                 p['AGE']   ? `${p['AGE']} Yrs` : undefined,
    height:              p['HEIGHT'],
    education:           p['EDUCATION'],
    location:            p['LOCATION']             ?? p['CITY'],
    profileImg:          p['THUMBIMG'],
    isPhotoAvailable:    p['PHOTOSTATUS']  === '1',
    isPhotoProtect:      p['PHOTOPRIVACY'] === '1',
    isNewlyJoined:       p['ISNEWLYJOINED'] === '1',
    likedStatus:         p['LIKEDSTATUS'] as SwiperItem['likedStatus'],
    isNewLabel:          p['ISNEWLABEL']  === '1',
    labelContent:        p['LABELCONTENT'],
    likedViewedDateText: p['LIKEDVIEWEDDATETEXT'] ?? p['VIEWEDDATETEXT'] ?? p['LIKEDDATETEXT'],
    // Angular: FUNC.IsPaidMember — profile is paid if ENTRYTYPE is not free ('B'/'F')
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
  const raw = res['LIST'] ?? res['LISTDATA'] ?? []
  return {
    items:      Array.isArray(raw) ? raw.map(toProfile) : [],
    totalCount: Number(res['TOTALCOUNT'] ?? res['LISTCOUNT'] ?? 0),
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
// OTP verification gives Level-1 tokens (valid only for registration/onboarding APIs).
// Listing, communication, and payment APIs require Level-2 tokens.
// autoLogin upgrades the session: sends the existing token to the server and receives
// a new WEBVIEWURL payload with fresh Level-2 ATN/RTN stored via parseAndStoreWebViewURL.
// Call this once at the top of the home screen load, before any listing API calls.

export async function refreshSession(): Promise<void> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  if (!userId) return
  const result = await apiCall(Endpoints.auth.autoLogin, 'POST', `ID=${userId}&TYPE=autologin`)
  if (result?.RESPONSECODE == 1 && result?.RESPONSE?.WEBVIEWURL) {
    await parseAndStoreWebViewURL(result.RESPONSE.WEBVIEWURL)
  }
}

// ─── Notification count ───────────────────────────────────────────────────────

export async function fetchNotifCount(): Promise<number> {
  const res = await apiCall(Endpoints.communication.notificationCount, 'POST', '')
  return Number(res['NEWCOUNT'] ?? 0)
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

// ─── All Matches ──────────────────────────────────────────────────────────────
// Angular: callMatchesApi() param string (matches default route)
// START/LIMIT instead of PAGENO — Angular never sends PAGENO for this endpoint

export async function fetchMatches(start = 0, limit = 20): Promise<ListingResult> {
  // Angular: webview.page.ts stores LOGINCOUNT from backend WEBVIEWURL JSON
  // In React it goes into USER_SESSION blob via storeWebURLData — read via getSession()
  const session    = await getSession()
  const loginCount = session['LOGINCOUNT'] ?? '0'
  const params = [
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
  const res = await apiCall(Endpoints.listing.matches, 'POST', params)
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
