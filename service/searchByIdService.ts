import { getItem } from './storageService'
import { StorageKeys } from '../constants/storage.keys'
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'

// Angular: pages/matches/search/search.page.ts callMatchesApi() — on the shared
// filter-search page, the ID-lookup widget is a standalone flow in RN (see
// SearchByIdScreen). Endpoint/params/success-condition ported as-is:
//   POST search/searchbyid/v1, body ID=<self>&PARTNERID=<entered>&REPORTED=1&
//   BLOCKED=1&REMOVED=1&SKIPED=1 — a match is exactly one element in RESPONSE.
// Angular doesn't distinguish "wrong ID" from "network/API failure" here (both
// produce a non-length-1 RESPONSE), so this returns null for either case —
// same ambiguity, not fixed silently.

export async function searchProfileById(partnerId: string): Promise<string | null> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&PARTNERID=${partnerId}&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1`
  const res = await apiCall(Endpoints.search.byId, 'POST', params)

  const profiles = Array.isArray(res?.RESPONSE) ? res.RESPONSE : []
  if (profiles.length !== 1) return null

  const matriId = profiles[0]?.['MATRIID']
  return matriId ? String(matriId) : null
}
