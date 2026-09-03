import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { toListingResult, type ListingResult } from './homeService'
import { getSession } from './registrationService'

// Angular: activityService.callActivityApi — a switch that picks an endpoint and builds params.
// Migrated as a single function; UI components call it directly with a type string.

type ActivityType =
  | 'likedyou' | 'whoLikedYou'
  | 'viewedyou' | 'whoViewedYou'
  | 'likesent'
  | 'whoviewednumber' | 'whoseviewednumber'
  | 'viewedbyme' | 'viewinglater'
  | 'photoreqreceived' | 'photoreqsent'
  | 'hororeqreceived'  | 'hororeqsent'

interface ActivityConfig {
  endpoint: string
  params: (id: string, start: number, limit: number) => string
}

const BASE = (id: string, s: number, l: number) => `ID=${id}&START=${s}&LIMIT=${l}&BANNERFLAG=0`
// Angular: activity.component.ts's changeTab() — likedyou, likesent, viewedyou AND
// viewedbyme all append &SKIPED=1 (only the request/photo-horoscope tabs use plain BASE).
const SKIPPED_PARAMS = (id: string, s: number, l: number) => `${BASE(id, s, l)}&SKIPED=1`

const ACTIVITY_MAP: Record<string, ActivityConfig> = {
  likedyou:          { endpoint: Endpoints.listing.likedYou,          params: SKIPPED_PARAMS },
  whoLikedYou:       { endpoint: Endpoints.listing.likedYou,          params: SKIPPED_PARAMS },
  viewedyou:         { endpoint: Endpoints.listing.viewedYou,         params: SKIPPED_PARAMS },
  whoViewedYou:      { endpoint: Endpoints.listing.viewedYou,         params: SKIPPED_PARAMS },
  likesent:          { endpoint: Endpoints.listing.likedByMe,         params: SKIPPED_PARAMS },
  whoviewednumber:   { endpoint: Endpoints.listing.whoViewedNumber,   params: (id, s, l) => `${BASE(id, s, l)}&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1` },
  whoseviewednumber: { endpoint: Endpoints.listing.whoseViewedNumber, params: (id, s, l) => `${BASE(id, s, l)}&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1` },
  viewedbyme:        { endpoint: Endpoints.listing.viewedByMe,        params: SKIPPED_PARAMS },
  // Angular: apiType 'viewinglater' → httpservice's listing/viewlater/v1, the ONLY
  // activity tab that always carries &LASTLOGIN (appended by callActivityApi below).
  viewinglater:      { endpoint: Endpoints.listing.viewLater,         params: SKIPPED_PARAMS },
  photoreqreceived:  { endpoint: Endpoints.listing.addYourPhotoList,  params: BASE },
  photoreqsent:      { endpoint: Endpoints.listing.requestedMoreDet,  params: (id, s, l) => `${BASE(id, s, l)}&REQUESTTYPE=1` },
  hororeqreceived:   { endpoint: Endpoints.listing.addYourHoroList,   params: BASE },
  hororeqsent:       { endpoint: Endpoints.listing.requestedMoreDet,  params: (id, s, l) => `${BASE(id, s, l)}&REQUESTTYPE=2` },
}

// Angular appends &LASTLOGIN=<last login> for the "new since your last visit"
// tabs: always for viewinglater, and for likedyou/viewedyou only when that tab
// still carries an unread newcount (changeTab()'s `newcount > 0` branch).
const LAST_LOGIN_ALWAYS  = ['viewinglater']
const LAST_LOGIN_ON_NEW  = ['likedyou', 'whoLikedYou', 'viewedyou', 'whoViewedYou']

export async function callActivityApi(
  type: ActivityType | string,
  matriId: string,
  start = 0,
  limit = 20,
  hasNewCount = false,
): Promise<any> {
  const config = ACTIVITY_MAP[type]
  if (!config) return null
  let params = config.params(matriId, start, limit)
  if (LAST_LOGIN_ALWAYS.includes(type) || (hasNewCount && LAST_LOGIN_ON_NEW.includes(type))) {
    const session = await getSession()
    params += `&LASTLOGIN=${session['LASTLOGIN'] ?? ''}`
  }
  return apiCall(config.endpoint, 'POST', params)
}

// ActivityScreen's liked-profile tabs ('likedyou'/'likesent'), its viewed-list
// tabs ('viewedyou'/'viewedbyme'/'viewinglater') and MessagerListScreen's
// phone-view tabs ('whoseviewednumber'/'whoviewednumber') all need the same
// SwiperItem-shaped data MatchesScreen consumes (so they can reuse
// MatchCard-family components as-is) — this pipes the raw RESPONSE/TOTAL
// envelope through the exact same mapper homeService.ts's own listing fetchers
// use, rather than a second hand-rolled raw-field adapter.
export type ActivityListingType =
  | 'likedyou' | 'likesent' | 'viewedyou' | 'viewedbyme' | 'viewinglater'
  | 'whoseviewednumber' | 'whoviewednumber'

export async function fetchActivityListingPage(
  type: ActivityListingType,
  matriId: string,
  start = 0,
  limit = 20,
  hasNewCount = false,
): Promise<ListingResult> {
  const res = await callActivityApi(type, matriId, start, limit, hasNewCount)
  return toListingResult(res ?? {})
}
