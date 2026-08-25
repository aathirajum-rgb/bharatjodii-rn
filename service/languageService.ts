// Language service — migrated from Angular language-change.service.ts.
// Angular showed an Ionic modal; in RN the component renders a bottom sheet.
// The appNativeEvent 'change_language' bridge is replaced by a direct storage write.

import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem, removeItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { getRegistrationArrays } from './registrationService'

// ─── Language selection ───────────────────────────────────────────────────────

// Angular: language-change.service.ts's submitLanguage() (line 31-69). Note it
// has NO "same language → bail out" guard — LANG and LANG_SELECTED are always
// written, and the array lists are always force-refreshed, so a first-run
// selection of the default language still persists and still populates.
export async function submitLanguage(currentLang: string, selectedLang: string): Promise<any> {
  // Angular: common.removeStorageBasedOnLanguageChangeEvent() — clears the
  // language-dependent caches (REGISTRATIONARRAYS is not in that list; it gets
  // overwritten by the forced re-fetch below instead).
  await Promise.all([
    removeItem('FILTERDATALIST'),
    removeItem(SK.App.PP_SET_DATA),
    removeItem('DOMAINLANG'),
  ])

  await setItem('PREVLANGUAGE', currentLang)
  await setItem(SK.Auth.LANG, selectedLang)
  await setItem('LANG_SELECTED', '1')

  // Angular: this.common.getDynamicPopulateArrayList(1) — the `1` is hitApi,
  // i.e. force. It re-fetches `type=all&LANG=<new lang>` and overwrites
  // REGISTRATIONARRAYS, which is what every registration option list
  // (mother tongue, caste, height, DOB month names, home-town yes/no, …)
  // reads from.
  return Promise.all([
    getRegistrationArrays(true),
    getDynamicPopulateArrayList(selectedLang, true),
  ])
}

// ─── Dynamic list fetch ───────────────────────────────────────────────────────
// POST initialfetch → returns all dropdown arrays keyed by language.
// Cached in storage; force=true bypasses cache.

export async function getDynamicPopulateArrayList(lang?: string, force = false): Promise<any> {
  const activeLang = lang ?? (await getItem(SK.Auth.LANG)) ?? 'en'

  if (!force) {
    const cached = await getItem(`DOMAINLANG_${activeLang}`)
    if (cached) return JSON.parse(cached)
  }

  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const params = `ID=${userId}&LANG=${activeLang}&TYPE=initialfetch`
  const result = await apiCall(Endpoints.registration.initialFetch, 'POST', params)

  if (result?.RESPONSECODE == 1 && result?.ERRCODE == 0) {
    const data = result.RESPONSE
    await setItem(`DOMAINLANG_${activeLang}`, JSON.stringify(data))
    await setItem('DOMAINLANG', JSON.stringify(data))
    return data
  }

  return null
}

export async function getCurrentLanguage(): Promise<string> {
  return (await getItem(SK.Auth.LANG)) ?? 'en'
}
