// ViewProfile API — migrated from Angular viewprofile.page.ts's getProfileAPI().
// Angular: params = 'ID='+NBID+'&VIEWEDID='+viewid+'&MEMBERSHIPTYPE='+ENTRYTYPE+'&LASTLOGIN='+lastLogin
// (viewprofile.page.ts:955-977), hitting the same endpoint this app already calls
// for biodata (service/biodataService.ts uses TYPE=BIODATA on the same URL).

import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { getSession } from './registrationService'

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
// caller). Uses the existing communication/viewedtrack endpoint already wired for
// other listing screens' "mark as viewed" flows.
export async function markProfileViewed(matriId: string): Promise<void> {
  const userId = await getItem(SK.Auth.USER_ID)
  await apiCall(Endpoints.profile.viewedTrack, 'POST', `ID=${userId ?? ''}&VIEWEDID=${matriId}`)
}
