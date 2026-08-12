// Angular equivalent: pages/menu-profiles/menu-profiles.page.ts (varPageType='2',
// currentTab='viewinglater') — shares the same page component as the "removed by
// me"/"blocked" lists (ignoredProfilesService.ts) but Angular's own mobile card
// for this tab (<app-list-view-card>) is plainer than the matches-card. The
// desktop Figma design for this screen (node 647:14826) shows the full
// MatchCardDesktop treatment instead (badges, Call/WhatsApp, "View full
// profile"), so this reuses homeService.ts's toListingResult() — the same
// SwiperItem/MatchProfile mapper every other rich listing (matches, activity)
// already goes through — rather than ignoredProfilesService.ts's simpler
// IgnoredProfile shape.
import { getItem } from './storageService'
import { StorageKeys } from '../constants/storage.keys'
import { getSession } from './registrationService'
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { toListingResult, type ListingResult } from './homeService'

export async function fetchViewLaterProfiles(start: number, limit: number): Promise<ListingResult> {
  const [userId, session] = await Promise.all([
    getItem(StorageKeys.Auth.USER_ID),
    getSession(),
  ])
  // Angular: callProfilesApi() appends &LASTLOGIN= only for this tab (varPageType=='2').
  const params = `ID=${userId ?? ''}&START=${start}&LIMIT=${limit}&BANNERFLAG=0&LASTLOGIN=${session['LASTLOGIN'] ?? ''}`
  const res = await apiCall(Endpoints.listing.viewLater, 'POST', params)
  return toListingResult(res ?? {})
}
