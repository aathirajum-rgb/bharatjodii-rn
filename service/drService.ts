import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem, getJson, setJson, removeItem } from './storageService'
import { navigate, resetTo } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'

const DR_LIMIT = 15

// ─── callingDailyRecommendationAPI ───────────────────────────────────────────
// Caches profiles per calendar day. A date change clears the cache.

export async function callingDailyRecommendationAPI(userId: string): Promise<any[]> {
  const today = new Date().toLocaleDateString('en-GB')

  const drDate = await getItem('DR_DATE')

  if (drDate && drDate !== today) {
    await Promise.all([
      removeItem('DR_DATE'),
      removeItem('DR_PROFILES'),
      removeItem('FIRSTSHORTLISTACTION'),
      removeItem('LASTDRCOUNT'),
    ])
  }

  if (!drDate || drDate !== today) {
    await setItem('DR_DATE', today)
  }

  const cached = await getJson<any[]>('DR_PROFILES')
  if (cached?.length) {
    await setJson('DR_COUNT', cached)
    await removeItem('LASTDRCOUNT')
    return cached
  }

  const params = `ID=${userId}&START=0&LIMIT=${DR_LIMIT}&LIKED=1&VIEWED=1&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1&MYHOME=1`
  const result = await apiCall(Endpoints.listing.dailyRecommendations, 'POST', params)

  if (result?.RESPONSECODE == 1 && result?.ERRCODE == 0 && result?.RESPONSE?.length > 0) {
    const profiles: any[] = result.RESPONSE
    await Promise.all([
      setJson('DR_PROFILES', profiles),
      setJson('DR_COUNT', profiles),
      removeItem('LASTDRCOUNT'),
    ])
    return profiles
  }

  return []
}

// ─── updateDrProfiles ────────────────────────────────────────────────────────
// Called after a user swipes/acts on a profile — removes it from the cache.

export async function updateDrProfiles(oppositeId: string): Promise<void> {
  const cached = await getJson<any[]>('DR_PROFILES')
  if (!cached) return
  const updated = cached.filter((p: any) => String(p.MATRIID) !== String(oppositeId))
  await setJson('DR_PROFILES', updated)
}

// ─── loadDrProfiles ──────────────────────────────────────────────────────────
// Main entry point: fetch → navigate to daily-recommendations or fallback.

export async function loadDrProfiles(
  userId: string,
  fromPage = '',
  fallback: string = ENavigation.MATCHES,
): Promise<void> {
  if (!userId) {
    resetTo(fallback)
    return
  }

  const profiles = await callingDailyRecommendationAPI(userId)

  if (profiles.length > 0) {
    await setItem('DR_SHOWN', new Date().toLocaleDateString('en-GB'))

    const shown = await getItem('showDRSwipes')
    if (!shown) await setItem('showDRSwipes', '1')

    // Angular: router.navigate(['dailyrecommendations'], {..., replaceUrl: true})
    resetTo(ENavigation.DAILY_RECOMMENDATIONS, { frm_page: fromPage === 'login' ? 'login' : 'matches' })
    return
  }

  // Angular: dr.service.ts's loadDrProfiles() — when frmPage=='login' (the
  // landingPageHandle()-driven cases: page_ids 5/7/24/27/28/57/59/60) and
  // there are literally zero DR profiles today, it doesn't just fall back to
  // Matches — it calls handleAfterDr(LANDPAGEID) for a further per-page_id
  // redirect. pageId comes from storage (set by pageLandingService.ts before
  // calling here), matching Angular's own localStorage read rather than a
  // threaded parameter.
  if (fromPage === 'login') {
    const pageId = (await getItem('LANDPAGEID')) ?? ''
    await handleAfterDr(pageId)
    return
  }

  resetTo(fallback)
}

// ─── handleAfterDr ───────────────────────────────────────────────────────────
// Onboarding page routing after no DR profiles remain.
// pageId values come from the server-driven NEXTPAGE in login response.

export async function handleAfterDr(pageId: string | number): Promise<void> {
  const pid = String(pageId)

  switch (pid) {
    case '5':
      navigate(ENavigation.HOROSCOPE)
      break
    case '7':
      navigate(ENavigation.VERIFY_ID)
      break
    case '18':
      navigate(ENavigation.PAYMENT)
      break
    case '20':
    case '24':
      navigate(ENavigation.EDIT_FORM, { pageNo: 20, source: 'pushnotify' })
      break
    case '27':
      navigate(ENavigation.ADD_PHOTO_INTERMEDIATE, { page: 'ADDPHOTO' })
      break
    case '28':
    case '32':
      navigate(ENavigation.PAYMENT)
      break
    case '57':
      navigate(ENavigation.PHOTO_REJECTION)
      break
    case '59':
    case '60':
      navigate(ENavigation.ADD_PHOTO_INTERMEDIATE, { page: 'ADDPHOTOPUBLISH' })
      break
    default:
      navigate(ENavigation.MATCHES)
  }
}
