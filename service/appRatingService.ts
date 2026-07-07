// "Rate our app" popup — Angular: services/app-rating.service.ts (passiveRatingPopup,
// checkLoginEligiable, checkRatingCount). Ported with one scoped simplification: Angular's
// eligibility thresholds vary based on "days since profile created > 15" (isGreater), but no
// profile-creation-date field is currently available anywhere in this port's session/registration
// data — so the >15-day thresholds are used unconditionally instead of branching on account age.
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import type { ComCountEntry } from './homeService'

const DAY_MS = 24 * 60 * 60 * 1000

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime()
  if (Number.isNaN(then)) return Infinity
  return (Date.now() - then) / DAY_MS
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function countFor(comCount: ComCountEntry[], type: string): number {
  const entry = comCount.find(c => c.comtype === type)
  return Number(entry?.totalCount ?? 0)
}

// Angular: checkLoginEligiable — every Nth like/view triggers a popup action.
function loginEligibleAction(gender: string, likeCount: number, vpCount: number): '0' | '4' | '5' {
  if (gender === 'M') {
    if (likeCount >= 1) return '4'
    if (vpCount >= 5)   return '5'
  } else {
    if (likeCount >= 10) return '4'
    if (vpCount >= 30)   return '5'
  }
  return '0'
}

export async function shouldShowRatingPopup(comCount: ComCountEntry[]): Promise<boolean> {
  const [gender, ratingValue, ratingDate, showRatingDate] = await Promise.all([
    getItem(SK.User.LOGIN_GENDER),
    getItem('APPRATINGVALUE'),
    getItem('APPRATINGDATE'),
    getItem('SHOWAPPRATINGDATE'),
  ])

  // Permanently dismissed states — never show again.
  if (ratingValue === '4' || ratingValue === '5') return false

  const likeCount = countFor(comCount, 'likedyou')
  const vpCount    = countFor(comCount, 'viewedyou')
  const action     = loginEligibleAction(gender ?? 'M', likeCount, vpCount)

  if (action !== '0') {
    if (!showRatingDate || daysSince(showRatingDate) >= 8) return true
    if (['1', '2', '3'].includes(ratingValue ?? '') && ratingDate && daysSince(ratingDate) > 30) return true
    return false
  }

  // Time-based fallback: never rated, never shown, 14+ days since... well, since account was
  // last checked. We don't have a login-history timestamp either, so this gate is effectively
  // "never shown yet" (showRatingDate empty) rather than Angular's 14-day rolling window.
  return (ratingValue ?? '0') === '0' && !showRatingDate
}

export async function markRatingPopupShown(): Promise<void> {
  await setItem('SHOWAPPRATINGDATE', todayISO())
}

// Angular: communication/rating/v1. Exact param names weren't confirmed against the live
// Angular request (not captured in this port's research pass) — ID/RATING/FEEDBACK is the
// best inference from this app's other communication/* endpoints' param conventions.
export async function submitRating(stars: number, feedback?: string): Promise<boolean> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const params = `ID=${userId}&RATING=${stars}&FEEDBACK=${encodeURIComponent(feedback ?? '')}`
  const result = await apiCall(Endpoints.communication.appRatingUpdate, 'POST', params)
  const ok = result?.RESPONSECODE == 1 && result?.ERRCODE == 0
  if (ok) {
    await Promise.all([
      setItem('APPRATINGVALUE', String(stars)),
      setItem('APPRATINGDATE', todayISO()),
    ])
  }
  return ok
}
