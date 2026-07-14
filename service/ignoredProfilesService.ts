import { getItem } from './storageService'
import { StorageKeys } from '../constants/storage.keys'
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'

// Angular: menu-profiles.page.ts (varPageType='1', the only live tab —
// "blockprofiles"/"viewinglater" tabs share this page but aren't reachable from
// the live menu). Fetches listing/removedbyme/v1.
//
// NOTE: STATUS here means profile-deletion state (1 = deleted, 2 = viewable) —
// a DIFFERENT meaning than homeService.ts's `dontShowStatus` (which reads the
// same field name on the matches/explore listing shape to mean "has don't-show
// already been toggled"). Kept as its own small mapper rather than reusing
// toProfile()/toListingResult() to avoid conflating the two.

export interface IgnoredProfile {
  matriId:    string
  name:       string
  age?:       string
  city?:      string
  education?: string
  occupation?: string
  thumbImg?:  string
  isDeleted:  boolean   // STATUS == 1
}

export interface IgnoredProfilesPage {
  items:      IgnoredProfile[]
  totalCount: number
}

function toIgnoredProfile(p: Record<string, any>): IgnoredProfile {
  return {
    matriId:    String(p['MATRIID'] ?? ''),
    name:       p['NAME'] ?? '',
    age:        p['AGE'],
    city:       p['CITY'],
    education:  p['EDUCATION'],
    occupation: p['OCCUPATION'],
    thumbImg:   p['THUMBIMG'] || p['PHOTO']?.[0]?.['IMAGE'],
    isDeleted:  String(p['STATUS']) === '1',
  }
}

async function fetchProfilesPage(endpoint: string, start: number, limit: number): Promise<IgnoredProfilesPage> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&START=${start}&LIMIT=${limit}&BANNERFLAG=0`
  const res = await apiCall(endpoint, 'POST', params)

  if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0 && Array.isArray(res?.RESPONSE)) {
    return {
      items:      res.RESPONSE.map(toIgnoredProfile),
      totalCount: Number(res['TOTAL'] ?? 0),
    }
  }
  return { items: [], totalCount: 0 }
}

export function fetchIgnoredProfiles(start: number, limit: number): Promise<IgnoredProfilesPage> {
  return fetchProfilesPage(Endpoints.listing.removedByMe, start, limit)
}

// "Blocked profiles" tab — Angular's menu-profiles.page.ts shares the same page/parser
// for varPageType='1' (dontshow) and the blockprofiles tab, just swapping the endpoint.
export function fetchBlockedProfiles(start: number, limit: number): Promise<IgnoredProfilesPage> {
  return fetchProfilesPage(Endpoints.listing.blockedByMe, start, limit)
}
