// Language service — migrated from Angular language-change.service.ts.
// Angular showed an Ionic modal; in RN the component renders a bottom sheet.
// The appNativeEvent 'change_language' bridge is replaced by a direct storage write.

import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem, removeItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { getRegistrationArrays } from './registrationService'
import { getPPSetData } from './profileService'

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

  // Angular: language-change.service.ts:50-53 — ONLY when the language
  // actually changed, LANGUAGEARRAY is cleared and rebuilt (fire-and-forget,
  // not awaited by the caller there either — the pill's own next-open read
  // is what picks up the eventual result, same as here).
  if (currentLang !== selectedLang) {
    await Promise.all([removeItem('LANGUAGEARRAY'), removeItem('LANGUAGEARRAY_MOTHERTONGUE')])
    refreshMotherTongueLanguageArray().catch(() => {})
  }

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

// ─── Mother-tongue language pill (2-or-3-language bottom sheet) ───────────────
// Angular's actual mechanism (verified against language-change.service.ts +
// language-selection.component.ts + common-funtions.ts) is NOT a pure static
// APPTYPE filter — it's a cached, server-scoped array with a patch-in step:
//
//   1. LanguageChangeService.getLanguageArrayApi() (lines 71-102) calls
//      `type=domainlang&mothertongue=<user's registered mother tongue key>`,
//      which returns a small DOMAINLANG array (normally English + the user's
//      one regional language — 2 items).
//   2. If the CURRENTLY ACTIVE language isn't in that array (e.g. the user
//      just picked a 3rd, out-of-domain language via Menu's full-language
//      list), it's looked up in the full LANGSELECTION list and PUSHED onto
//      the array — so a 3rd card can temporarily appear in this "2-language"
//      pill.
//   3. This patched array is persisted to localStorage['LANGUAGEARRAY'] and
//      read back by every future pill-open (getLanguageArrayList()).
//   4. Picking English/the real mother tongue again re-runs step 1-2; since
//      that language IS in the small DOMAINLANG response, no patch-in
//      happens and the array reverts to 2 items — the 3rd language
//      disappears. Picking the 3rd language again re-adds it (sticky).
//
// This is fired-and-forgotten from submitLanguage() (matching Angular, which
// also doesn't await it) — the pill's OWN next-open read is what picks up
// whatever the fetch resolved to, same timing as Angular's async ngOnInit.
export type LangOption = { id: string; native: string; english: string }

const REGIONAL_LANG_META: Record<string, LangOption> = {
  en: { id: 'en', native: 'English',  english: 'English'  },
  tm: { id: 'tm', native: 'தமிழ்',    english: 'Tamil'     },
  tl: { id: 'tl', native: 'తెలుగు',   english: 'Telugu'    },
  ml: { id: 'ml', native: 'മലയാളം',   english: 'Malayalam' },
  kn: { id: 'kn', native: 'ಕನ್ನಡ',    english: 'Kannada'   },
  or: { id: 'or', native: 'ଓଡ଼ିଆ',    english: 'Odia'      },
  bn: { id: 'bn', native: 'বাংলা',     english: 'Bengali'   },
  mt: { id: 'mt', native: 'मराठी',     english: 'Marathi'   },
  gj: { id: 'gj', native: 'ગુજરાતી',  english: 'Gujarati'  },
  hi: { id: 'hi', native: 'हिंदी',     english: 'Hindi'     },
  pa: { id: 'pa', native: 'ਪੰਜਾਬੀ',   english: 'Punjabi'   },
}

// Angular: language-selection.component.ts:84-87 — the hard-coded ultra-
// fallback used whenever the domain array ends up empty (e.g. offline,
// APPTYPE unset — nothing has ever been persisted to LANGUAGEARRAY yet).
const EMPTY_FALLBACK: LangOption[] = [REGIONAL_LANG_META.en, REGIONAL_LANG_META.tm]

// ─── Full language list (Menu's "expandLanguage" popup) ───────────────────────
// Angular: language-selection.component.ts's ngOnInit, actionType != 'mothertongue'
// branch — this.languageArray = CONFIG.languageArray (all 11), then
// getDynamicPopulateArrayList()'s hasArrayData?.LANGSELECTION overwrites it if
// present. Same static-fallback + API-override shape as LanguageSelectionScreen.
// tsx's FALLBACK_LANGUAGES/getRegistrationArrays(), duplicated here (not
// imported from that screen) because that screen is intentionally left
// untouched and pre-login (no user/session yet) — this helper is for the
// logged-in Menu popup instead.
export const FULL_LANGUAGE_LIST: LangOption[] = [
  REGIONAL_LANG_META.en, REGIONAL_LANG_META.tm, REGIONAL_LANG_META.tl, REGIONAL_LANG_META.ml,
  REGIONAL_LANG_META.kn, REGIONAL_LANG_META.mt, REGIONAL_LANG_META.or, REGIONAL_LANG_META.gj,
  REGIONAL_LANG_META.bn, REGIONAL_LANG_META.hi, REGIONAL_LANG_META.pa,
]

export async function getAllLanguages(): Promise<LangOption[]> {
  const data = await getRegistrationArrays().catch(() => null)
  const raw = data?.LANGSELECTION
  if (Array.isArray(raw) && raw.length > 0) {
    const mapped: LangOption[] = raw
      .map((item: any) => ({
        id:      String(item.ID ?? item.id ?? ''),
        native:  String(item.TITLE ?? item.title ?? ''),
        english: String(item.TEXT ?? item.text ?? ''),
      }))
      .filter(l => l.id && l.native && l.english)
    if (mapped.length > 0) return mapped
    return EMPTY_FALLBACK
  }
  return FULL_LANGUAGE_LIST
}

// Angular: language-selection.component.ts's filterLanguage() (lines 148-181)
// — the APPTYPE->regional-language whitelist used to seed the FIRST-EVER
// domain fetch (before any LANGUAGEARRAY exists yet, mirroring ngOnInit's
// synchronous filterLanguage() call racing ahead of the async domain fetch).
const REGIONAL_LANG_BY_APPTYPE: Record<string, string> = {
  '116': 'tm', // Tamil
  '117': 'tl', // Telugu
  '118': 'ml', // Malayalam
  '119': 'kn', // Kannada
  '120': 'or', // Odia
  '121': 'bn', // Bengali
  '122': 'mt', // Marathi
  '123': 'gj', // Gujarati
  '125': 'pa', // Punjabi
}

// Returns the regional language code for the current APPTYPE, or null if the
// domain isn't one of the known regional-language builds (Angular: `else {
// return true }` — no narrowing, every language stays in the list).
async function getRegionalLanguageId(): Promise<string | null> {
  const appType = await getItem(SK.Auth.APP_TYPE)
  return appType ? REGIONAL_LANG_BY_APPTYPE[appType] ?? null : null
}

// Angular: getLangArrayListFromRegArray() (common-funtions.ts:1365-1371) —
// the LANGSELECTION field of REGISTRATIONARRAYS is the source used to look up
// a language's display metadata when patching a missing one into the array.
async function findLanguageMeta(langId: string): Promise<LangOption | null> {
  const raw = await getItem('REGISTRATIONARRAYS')
  const langSelection = raw ? JSON.parse(raw)?.LANGSELECTION : null
  if (Array.isArray(langSelection)) {
    const match = langSelection.find((item: any) => (item.ID ?? item.id) === langId)
    if (match) {
      return { id: langId, native: String(match.TITLE ?? match.title ?? ''), english: String(match.TEXT ?? match.text ?? '') }
    }
  }
  return REGIONAL_LANG_META[langId] ?? null
}

// Angular: LanguageChangeService.getLanguageArrayApi() (lines 71-102) — the
// actual domain-scoped fetch + missing-language patch-in + persist. Called
// fire-and-forget from submitLanguage() whenever the language actually
// changes; also safe to call directly to force a refresh.
export async function refreshMotherTongueLanguageArray(): Promise<void> {
  // Angular: FUNC.getMothertongue() (common-funtions.ts:1351-1354) checks
  // localStorage['MOTHERTONGUE'] FIRST, falling back to the misspelled
  // ['MOTHERTOUNGE'] key only if that's empty. The actively-populated key in
  // this app is the plain 'MOTHERTONGUE' string (profileService.ts's
  // setItem('MOTHERTONGUE', data.PI_MOTHERTONGUE)) — SK.User.MOTHER_TONGUE
  // ('MOTHERTOUNGE') alone is never written anywhere, so checking it first
  // (or only) always missed the real value and fell through to the wrong
  // APPTYPE-keyed static guess.
  let motherTongueKey = (await getItem('MOTHERTONGUE')) ?? (await getItem(SK.User.MOTHER_TONGUE))
  if (!motherTongueKey) {
    // Angular: this value is normally already populated by getPPSETData()
    // having run on whatever landing page loaded first (matches.page.ts's
    // ngOnInit()) — self-heal here for the case where this pill opens before
    // that background fetch resolves (or on a screen that never triggers it).
    await getPPSetData().catch(() => {})
    motherTongueKey = (await getItem('MOTHERTONGUE')) ?? (await getItem(SK.User.MOTHER_TONGUE))
  }
  if (!motherTongueKey) return // Angular: IsValidParam guard — nothing to scope the domain query to yet

  const activeLang = await getCurrentLanguage()
  const params = `type=domainlang&mothertongue=${motherTongueKey}&LANG=${activeLang}`
  const result = await apiCall(Endpoints.registration.initialFetch, 'POST', params)

  if (result?.RESPONSECODE != 1 || result?.ERRCODE != 0) return
  const domainLang = result?.RESPONSE?.DOMAINLANG
  if (!Array.isArray(domainLang) || domainLang.length === 0) return

  const arrayList: LangOption[] = domainLang.map((item: any) => ({
    id: String(item.ID ?? item.id ?? ''), native: String(item.TITLE ?? item.title ?? ''), english: String(item.TEXT ?? item.text ?? ''),
  }))

  // Angular: `index == -1` check — the newly-active language isn't part of
  // the small domain response (e.g. it's a 3rd, out-of-domain pick) -> patch
  // it in so it still shows up as a selectable/selected card next time.
  if (!arrayList.some(l => l.id === activeLang)) {
    const meta = await findLanguageMeta(activeLang)
    if (meta) arrayList.push(meta)
  }

  await setItem('LANGUAGEARRAY', JSON.stringify(arrayList))
  // Tag the cache with the mother-tongue key it was built for — RN has no
  // equivalent of Angular's near-guaranteed "getLanguageArrayApi() already
  // ran this session" assumption, so a stale array from BEFORE the correct
  // mother-tongue key was available (e.g. before getPPSetData() ever ran, or
  // from a build predating this fix) would otherwise be trusted forever with
  // no way to tell it apart from a genuinely fresh one.
  await setItem('LANGUAGEARRAY_MOTHERTONGUE', motherTongueKey)
}

// Angular: FUNC.getLanguageArrayList() (common-funtions.ts:1356-1363) —
// prefers the persisted (possibly 3-item, patched) LANGUAGEARRAY. Angular can
// get away with a synchronous read here because getLanguageArrayApi() has
// almost always already run at least once earlier in the session (any prior
// language switch populates it); this port has no such guarantee — the very
// FIRST time this pill opens in a fresh session, nothing has been persisted
// yet, so this actively runs the real mother-tongue-keyed domain fetch
// (refreshMotherTongueLanguageArray()) before falling back to the
// APPTYPE-keyed static guess, which does NOT know the user's actual
// registered mother tongue and was wrongly showing English+Tamil for every
// user whose APPTYPE isn't one of the known regional-app codes.
export async function getMotherTongueLanguages(): Promise<LangOption[]> {
  const currentMotherTongue = (await getItem('MOTHERTONGUE')) ?? (await getItem(SK.User.MOTHER_TONGUE))
  const [stored, cachedFor] = await Promise.all([getItem('LANGUAGEARRAY'), getItem('LANGUAGEARRAY_MOTHERTONGUE')])
  // Only trust the cache if it was built for the SAME mother tongue as right
  // now — a value cached before the correct mother-tongue key was available
  // (or from before this fix) would otherwise be trusted forever, since it's
  // a non-empty, well-formed array that just happens to be wrong.
  if (stored && currentMotherTongue && cachedFor === currentMotherTongue) {
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {
      // fall through to the fetch/fallback below
    }
  }

  await refreshMotherTongueLanguageArray()
  const fetched = await getItem('LANGUAGEARRAY')
  if (fetched) {
    try {
      const parsed = JSON.parse(fetched)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {
      // fall through to the static fallback below
    }
  }

  // Mother-tongue-keyed fetch didn't resolve (offline, no MOTHER_TONGUE
  // stored yet, etc.) — last resort: the APPTYPE-keyed static guess, then
  // Angular's own hard-coded English+Tamil ultra-fallback.
  const regionalId = await getRegionalLanguageId()
  if (regionalId && REGIONAL_LANG_META[regionalId]) {
    return [REGIONAL_LANG_META.en, REGIONAL_LANG_META[regionalId]]
  }
  return EMPTY_FALLBACK
}
