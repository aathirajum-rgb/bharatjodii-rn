// Angular: safety-tips.component.ts's getChatContent() — POSTs to the shared
// "initialfetch" module (registrationform/v1) with `type=saftytips` (note:
// Angular's own literal typo, kept as-is since it's the real param the live
// backend expects — "safetytips" would silently return nothing) plus the
// user's current LANG/ccode, and reads back RESPONSE.SAFETYTIPS. This is
// genuinely live, per-language backend content — Angular's own repo has NO
// local translation fallback for any of these strings in any of its 11
// locale files, confirmed by direct source inspection — so this fetches the
// same way rather than hardcoding a guessed translation into en.json (which
// this port initially did, wrongly, before being corrected).
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'

export interface SafetyTip {
  title:   string
  content: string
}

export interface SafetyTipsContent {
  header:  string
  header1: string
  tips:    SafetyTip[]   // up to 5, in TIP1..TIP5 order; empty entries filtered out
}

export async function fetchSafetyTipsContent(): Promise<SafetyTipsContent | null> {
  const ccode = (await getItem(SK.User.COUNTRY_CODE)) ?? '91'
  const lang  = (await getItem(SK.Auth.LANG)) ?? 'en'
  const paramStr = `type=saftytips&LANG=${lang}&ccode=${ccode}`
  const res = await apiCall(Endpoints.registration.initialFetch, 'POST', paramStr)
  if (res?.ERRCODE !== '0' || !res?.RESPONSE) return null

  const raw = res.RESPONSE.SAFETYTIPS
  if (!raw || typeof raw !== 'object') return null

  const tips: SafetyTip[] = []
  for (let i = 1; i <= 5; i++) {
    const entry = raw[String(i)]
    if (entry?.TITLE || entry?.CONTENT) {
      tips.push({ title: entry.TITLE ?? '', content: entry.CONTENT ?? '' })
    }
  }

  return {
    header:  raw.HEADER ?? '',
    header1: raw.HEADER1 ?? '',
    tips,
  }
}
