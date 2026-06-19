import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'

// Angular: activityService.callActivityApi — a switch that picks an endpoint and builds params.
// Migrated as a single function; UI components call it directly with a type string.

type ActivityType =
  | 'likedyou' | 'whoLikedYou'
  | 'viewedyou' | 'whoViewedYou'
  | 'likesent'
  | 'whoviewednumber' | 'whoseviewednumber'
  | 'viewedbyme'
  | 'photoreqreceived' | 'photoreqsent'
  | 'hororeqreceived'  | 'hororeqsent'

interface ActivityConfig {
  endpoint: string
  params: (id: string, start: number, limit: number) => string
}

const BASE = (id: string, s: number, l: number) => `ID=${id}&START=${s}&LIMIT=${l}&BANNERFLAG=0`

const ACTIVITY_MAP: Record<string, ActivityConfig> = {
  likedyou:          { endpoint: Endpoints.listing.likedYou,          params: BASE },
  whoLikedYou:       { endpoint: Endpoints.listing.likedYou,          params: BASE },
  viewedyou:         { endpoint: Endpoints.listing.viewedYou,         params: BASE },
  whoViewedYou:      { endpoint: Endpoints.listing.viewedYou,         params: BASE },
  likesent:          { endpoint: Endpoints.listing.likedByMe,         params: BASE },
  whoviewednumber:   { endpoint: Endpoints.listing.whoViewedNumber,   params: (id, s, l) => `${BASE(id, s, l)}&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1` },
  whoseviewednumber: { endpoint: Endpoints.listing.whoseViewedNumber, params: (id, s, l) => `${BASE(id, s, l)}&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1` },
  viewedbyme:        { endpoint: Endpoints.listing.viewedByMe,        params: BASE },
  photoreqreceived:  { endpoint: Endpoints.listing.addYourPhotoList,  params: BASE },
  photoreqsent:      { endpoint: Endpoints.listing.requestedMoreDet,  params: (id, s, l) => `${BASE(id, s, l)}&REQUESTTYPE=1` },
  hororeqreceived:   { endpoint: Endpoints.listing.addYourHoroList,   params: BASE },
  hororeqsent:       { endpoint: Endpoints.listing.requestedMoreDet,  params: (id, s, l) => `${BASE(id, s, l)}&REQUESTTYPE=2` },
}

export async function callActivityApi(
  type: ActivityType | string,
  matriId: string,
  start = 0,
  limit = 20,
): Promise<any> {
  const config = ACTIVITY_MAP[type]
  if (!config) return null
  return apiCall(config.endpoint, 'POST', config.params(matriId, start, limit))
}
