// Profile-validation reject/on-hold sticky — Angular: matches.page.ts:2515-2557
// checkProfileStatus(), common.ts:1989-2007 getProfileValidationData(),
// bottom-sheet.service.ts:103-133 assignStickyData()/assignBottomUpData().
// Explicitly commented "First Priority" in Angular's initializeData() — takes
// precedence over every other sticky/popup on this screen.
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, getJson, setJson } from './storageService'
import { getPPSetData } from './profileService'

// JA-171: PISTATUS — 0 Active, 5 Rejected, 13 OnHold
const REJECTED_STATUSES = ['5', '13']

export interface ProfileValidationInfo {
  stickyContent: string
  stickyCta:     string
  stickyImg?:    string | undefined
  sheet: {
    title:   string
    content: string
    cta:     string
    img?:    string | undefined
  }
}

export async function checkProfileValidation(): Promise<ProfileValidationInfo | null> {
  const ppSetData = await getPPSetData(false)
  const piStatus = String(ppSetData?.['PISTATUS'] ?? '0')
  if (!REJECTED_STATUSES.includes(piStatus)) return null

  const data    = await fetchProfileValidationData()
  const sticky  = data?.['PROSTICKY']
  const bottom  = data?.['PROBOTTOM']
  if (!sticky || !bottom) return null

  return {
    stickyContent: String(sticky['TITLE'] ?? ''),
    stickyCta:     String(sticky['CTA']   ?? ''),
    stickyImg:     sticky['IMG'],
    sheet: {
      title:   String(bottom['TITLE']   ?? ''),
      content: String(bottom['CONTENT'] ?? ''),
      cta:     String(bottom['CTA']     ?? ''),
      img:     bottom['IMG'],
    },
  }
}

// Angular: common.ts's getProfileValidationData() — cached in PI_REJECT_OBJ so
// a re-check (e.g. on re-entering Matches) doesn't re-hit the API every time.
async function fetchProfileValidationData(): Promise<Record<string, any> | null> {
  const cached = await getJson<Record<string, any>>('PI_REJECT_OBJ')
  if (cached) return cached

  const lang   = (await getItem('LANG')) ?? 'en'
  const result = await apiCall(Endpoints.registration.initialFetch, 'POST', `type=PROFILEVALID&LANG=${lang}`)
  if (result?.ERRCODE == 0 && result?.RESPONSECODE == 1 && result?.RESPONSE) {
    await setJson('PI_REJECT_OBJ', result.RESPONSE)
    return result.RESPONSE
  }
  return null
}
