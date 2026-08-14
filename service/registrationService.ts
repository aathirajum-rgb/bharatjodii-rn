// Registration service — migrated from Angular registration.service.ts (971 lines).
// Critical: storeWebURLData parses the WEBVIEWURL login payload that the backend
// embeds user session data in. The URL format is:
//   https://...#/login/<JSON_BASE64>/2
// In RN we call this same API and parse the same payload — no WebView needed.

import { apiCall, fetchUserIp } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { navigate } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'
import { setAppsFlyerUserId } from './analyticsService'
import { fetchEditProfileInfo, type EditProfileInfo } from './editProfileService'

// ─── Registration value store ─────────────────────────────────────────────────
// Single AsyncStorage object for all onboarding field values.
// Replaces N individual setItem/getItem calls per screen with one read + one write.

const REG_STORE_KEY = 'REGISTRATION_VALUES'

export async function getRegValues(): Promise<Record<string, string>> {
  const raw = await getItem(REG_STORE_KEY)
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

export async function getRegValue(key: string): Promise<string | null> {
  const rv = await getRegValues()
  return rv[key] != null ? String(rv[key]) : null
}

export async function setRegValue(key: string, value: string): Promise<void> {
  const rv = await getRegValues()
  rv[key] = value
  await setItem(REG_STORE_KEY, JSON.stringify(rv))
}

export async function setRegValues(updates: Record<string, string>): Promise<void> {
  const rv = await getRegValues()
  Object.assign(rv, updates)
  await setItem(REG_STORE_KEY, JSON.stringify(rv))
}

// ─── User session store ───────────────────────────────────────────────────────
// Single AsyncStorage object for all post-login session values.
// Replaces 30+ individual keys from storeWebURLData with one JSON blob.

const SESSION_STORE_KEY = 'USER_SESSION'

export async function getSession(): Promise<Record<string, any>> {
  const raw = await getItem(SESSION_STORE_KEY)
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

export async function getSessionValue(key: string): Promise<any> {
  const sd = await getSession()
  return sd[key] ?? null
}

export async function setSessionValue(key: string, value: any): Promise<void> {
  const sd = await getSession()
  sd[key] = value
  await setItem(SESSION_STORE_KEY, JSON.stringify(sd))
}

export async function setSessionValues(updates: Record<string, any>): Promise<void> {
  const sd = await getSession()
  Object.assign(sd, updates)
  await setItem(SESSION_STORE_KEY, JSON.stringify(sd))
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(_moduleName: string, params: Record<string, any>): Promise<any> {
  const paramStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
  return apiCall(Endpoints.auth.login, 'POST', paramStr)
}

export async function verifyOTP(_moduleName: string, otpValues: Record<string, any>): Promise<any> {
  const paramStr = Object.entries(otpValues).map(([k, v]) => `${k}=${v}`).join('&')
  return apiCall(Endpoints.auth.verifyOtp, 'POST', paramStr)
}

export async function resendOTP(_moduleName: string, params: Record<string, any>): Promise<any> {
  const atLimit = await checkResendOTPLimit()
  if (atLimit) return { RESPONSECODE: '0', ERRCODE: 'OTP_LIMIT', ERRORMESSAGE: 'Daily OTP limit reached' }
  const paramStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
  const result = await apiCall(Endpoints.auth.resendOtp, 'POST', paramStr)
  if (result?.RESPONSECODE === '1') await incrementOTPCount()
  return result
}

export async function callTrueCallerVerification(params: Record<string, any>): Promise<any> {
  const paramStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
  return apiCall(Endpoints.auth.loginTruecaller, 'POST', paramStr)
}

// ─── Auto-login (post-registration flow) ─────────────────────────────────────

export async function autoLogin(
  userId: string,
  _skipParse = false,
  onboardingFlow = false,
): Promise<void> {
  const [
    cachedIp,
    deviceDetail,
    appVersion,
    mcode,
    registerId,
    deviceId,
    nallow,
  ] = await Promise.all([
    getItem('USERIP'),
    getItem('DEVICEDETAIL'),
    getItem(SK.App.APP_VERSION),
    getItem(SK.User.MEMBER_CODE),
    getItem('REGISTERID'),
    getItem('DEVICEID'),
    getItem(SK.App.NALLOW),
  ])

  // Fetch live IP if not already cached (CLIENTIP is required by the server)
  const ipAddress = cachedIp ?? (await fetchUserIp()) ?? ''

  const params = [
    `ID=${userId}`,
    `CLIENTIP=${ipAddress}`,
    `DEVICEDETAIL=${deviceDetail   ?? ''}`,
    `APPVERSION=${appVersion       ?? '7.4'}`,
    `FROMPAGE=REGISTER`,
    `MCODE=${mcode                 ?? '91'}`,
    `REGISTERID=${registerId       ?? ''}`,
    `DEVICEID=${deviceId           ?? ''}`,
    `NALLOW=${nallow               ?? '0'}`,
    'NEWREG=1',
  ].join('&')

  const result = await apiCall(Endpoints.auth.autoLogin, 'POST', params)

  if (result?.ERRCODE != 0 && result?.ERRCODE !== '0') return

  // Store fresh tokens from top-level response
  if (result.ATN) await setItem(SK.Auth.TOKEN,         result.ATN)
  if (result.RTN) await setItem(SK.Auth.REFRESH_TOKEN, result.RTN)

  const responseData = result.RESPONSE
  if (responseData?.WEBVIEWURL) {
    await parseAndStoreWebViewURL(responseData.WEBVIEWURL)
  }

  if (onboardingFlow) {
    const nextPage = responseData?.NEXTPAGE ?? '0'
    navigate(ENavigation.ONBOARDING, { pageNo: nextPage })
  }
}

// ─── WEBVIEWURL parser — heart of the login flow ──────────────────────────────
// Server embeds full user session as JSON inside the webview URL.
// URL format: https://...#/webview/login/{ ...user JSON... }/28
// That trailing "/28" is Angular's ActivatedRoute :page_id param — webview.page.ts's
// pageLandingFunc() switches on it to decide post-login/post-autologin routing
// (see service/pageLandingService.ts). Returns it so callers driving that same
// decision (refreshSession() on every app open) don't have to re-parse the URL.

export async function parseAndStoreWebViewURL(webViewUrl: string): Promise<string | undefined> {
  try {
    const loginSegment = webViewUrl.split('login/')[1]
    if (!loginSegment) return undefined
    // Locate the outermost JSON object by first { and last }
    // Splitting on '/2' was fragile — the JSON itself can contain '/2'
    const jsonStart = loginSegment.indexOf('{')
    const jsonEnd   = loginSegment.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return undefined
    const jsonStr = loginSegment.slice(jsonStart, jsonEnd + 1)
    const data    = JSON.parse(jsonStr)
    await storeWebURLData(data)
    return loginSegment.slice(jsonEnd + 1).match(/\d+/)?.[0]
  } catch (e) {
    if (__DEV__) console.error('[parseWebViewURL]', e)
    return undefined
  }
}

// ─── Registration onboarding ──────────────────────────────────────────────────

// Fetches PROFILECREATEDBY options from the initialfetch API.
// Maps the server object {"1":"Myself","4":"Son's",...} to a typed array.
// Excludes key "2" (Parents) which is not shown in the revamped UI.
export async function fetchProfileCreatedByOptions(): Promise<Array<{ key: string; label: string }>> {
  const ccode    = await getItem(SK.User.COUNTRY_CODE) ?? '91'
  const lang     = await getItem(SK.Auth.LANG) ?? 'en'
  const paramStr = `type=all&ccode=${ccode}&LANG=${lang}`
  const res = await apiCall(Endpoints.registration.initialFetch, 'POST', paramStr)
  const raw = res?.RESPONSE?.PROFILECREATEDBY
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return (Object.entries(raw) as [string, string][])
      .filter(([key]) => key !== '2')   // exclude 'Parents' — not in revamp UI
      .map(([key, label]) => ({ key, label }))
  }
  return []
}

export type GenderOption = {
  key: string        // '1' = Male, '0' = Female
  label: string      // display label in current language
  img: string        // unselected avatar URL  (API: IMG)
  imgActive: string  // selected avatar URL    (API: IMG-ACTIVE)
}

// Fetches gender options for the given createdBy from the initialfetch API.
// GENDERARRAY[createdBy] contains [{ key, value, IMG, IMG-ACTIVE }] per Angular.
export async function fetchGenderOptions(createdBy: string): Promise<GenderOption[]> {
  const ccode    = await getItem(SK.User.COUNTRY_CODE) ?? '91'
  const lang     = await getItem(SK.Auth.LANG) ?? 'en'
  const paramStr = `type=all&ccode=${ccode}&LANG=${lang}`
  const res = await apiCall(Endpoints.registration.initialFetch, 'POST', paramStr)
  const genderArray = res?.RESPONSE?.GENDERARRAY
  const list: any[] = genderArray?.[createdBy] ?? genderArray?.['1'] ?? []
  if (!Array.isArray(list)) return []
  // Raw API field names: KEY, VALUE, IMG, IMG-ACTIVE
  // (Angular mappingArray renames KEY→key, VALUE→value before using; IMG/IMG-ACTIVE stay unchanged)
  return list
    .map((item: any) => ({
      key:       String(item['KEY'] ?? item['key'] ?? ''),
      label:     String(item['VALUE'] ?? item['value'] ?? ''),
      img:       item['IMG'] ?? '',
      imgActive: item['IMG-ACTIVE'] ?? '',
    }))
    .filter(o => o.key !== '')
}

// Fetches marital status options from initialfetch API.
// GENDER='0' → MARITALSTATUSFEMALE, GENDER='1' → MARITALSTATUSMALE (Angular logic).
// Raw response is an object {"1":"Never Married","2":"Divorced",...} → converted to array.
export async function fetchMaritalStatusOptions(
  gender: string,
): Promise<Array<{ key: string; label: string }>> {
  const ccode    = await getItem(SK.User.COUNTRY_CODE) ?? '91'
  const lang     = await getItem(SK.Auth.LANG) ?? 'en'
  const paramStr = `type=all&ccode=${ccode}&LANG=${lang}`
  const res = await apiCall(Endpoints.registration.initialFetch, 'POST', paramStr)
  const raw = gender === '0'
    ? res?.RESPONSE?.MARITALSTATUSFEMALE
    : res?.RESPONSE?.MARITALSTATUSMALE
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.entries(raw).map(([key, value]) => ({ key, label: String(value) }))
  }
  return []
}

// No dedicated options endpoint for "number of children" — same small closed
// set every marital-status-history flow uses (Angular form-fields). Shared
// constant so PersonalReligiousDesktopStep.tsx and Edit Profile's marital
// screen don't each hardcode their own copy.
export const CHILDREN_OPTIONS: Array<{ key: string; label: string }> = [
  { key: '1', label: '1 child' }, { key: '2', label: '2 children' },
  { key: '3', label: '3 children' }, { key: '4', label: '4+ children' },
]

// Reads REGISTRATIONARRAYS from cache (AsyncStorage) or fetches fresh from API and saves.
// Angular stores the full initialfetch response under this key — mirrors that pattern.
export async function getRegistrationArrays(): Promise<Record<string, any>> {
  const cached = await getItem('REGISTRATIONARRAYS')
  if (cached) {
    try { return JSON.parse(cached) } catch {}
  }
  const ccode    = await getItem(SK.User.COUNTRY_CODE) ?? '91'
  const lang     = await getItem(SK.Auth.LANG) ?? 'en'
  const paramStr = `type=all&ccode=${ccode}&LANG=${lang}`
  const res = await apiCall(Endpoints.registration.initialFetch, 'POST', paramStr)
  const data = res?.RESPONSE ?? {}
  if (res?.RESPONSE) await setItem('REGISTRATIONARRAYS', JSON.stringify(res.RESPONSE))
  return data
}

// Fetches mother tongue options from MOTHERTONGUES key in registrationArrays.
// Angular: profileMotherTongues = apiResponse["MOTHERTONGUES"] — array of {MKEY, VALUE}.
// VALUE may contain HTML (stripped on display).
export async function fetchMotherTongueOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.MOTHERTONGUES
  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => ({
        key:   String(item.MKEY  ?? item.KEY   ?? item.key   ?? ''),
        label: String(item.VALUE ?? item.value ?? ''),
      }))
      .filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: String(value) }))
  }
  return []
}

// Fetches eating habit options from EATINGHABITS key in registrationArrays.
// Angular: profileEatingHabits = apiResponse["EATINGHABITS"] — plain object {key: label}.
export async function fetchEatingHabitOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.EATINGHABITS
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.KEY   ?? item.key   ?? ''),
      label: String(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: String(value) }))
  }
  return []
}

// Angular: registration.page.ts:1334-1338 — profileDrinkingHabits/profileSmokingHabits
// come from the same initialfetch response as EATINGHABITS (apiResponse["DRINKINGHABITS"]/
// ["SMOKINGHABITS"]), not a hardcoded list. Mirrors fetchEatingHabitOptions() exactly.

export async function fetchDrinkingHabitOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.DRINKINGHABITS
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.KEY   ?? item.key   ?? ''),
      label: String(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: String(value) }))
  }
  return []
}

export async function fetchSmokingHabitOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.SMOKINGHABITS
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.KEY   ?? item.key   ?? ''),
      label: String(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: String(value) }))
  }
  return []
}

// Fetches gothram options for the given caste (or the registration flow's
// current CASTE reg-value when omitted — preserves the original zero-arg
// call sites: GothraScreen.tsx, PersonalReligiousDesktopStep.tsx).
// Angular: type=gothra&caste=${CASTE}&LANG=${lang} → RESPONSE.GOTHRAM (plain object)
// Key '998' = "All except your gothra" — excluded from registration list.
// Returns [] when response is "no gothram" string.
//
// Cache is scoped by caste (GOTHRAM_CASTE alongside GOTHRAM) — without this,
// a cached list from a previously-viewed caste (e.g. Edit Profile's Religious
// screen, where caste can change on the same screen) would be silently reused
// for a different caste.
export async function fetchGothraOptions(caste?: string): Promise<Array<{ key: string; label: string }>> {
  const toList = (raw: any): Array<{ key: string; label: string }> => {
    if (raw === 'no gothram' || !raw) return []
    if (Array.isArray(raw)) {
      return raw.map((item: any) => ({
        key:   String(item.KEY ?? item.key ?? ''),
        label: String(item.VALUE ?? item.value ?? ''),
      })).filter((o: { key: string }) => o.key !== '' && o.key !== '998')
    }
    if (typeof raw === 'object') {
      return Object.entries(raw)
        .filter(([key]) => key !== '998')
        .map(([key, value]) => ({ key, label: String(value) }))
    }
    return []
  }

  const casteId = caste ?? (await getRegValue('CASTE')) ?? ''

  // Check cache (Angular stores under GOTHRAM inside REGISTRATIONARRAYS) —
  // only trust it if it was cached for this same caste.
  const arrays = await getRegistrationArrays()
  if (arrays?.GOTHRAM_CASTE === casteId && arrays.GOTHRAM && arrays.GOTHRAM !== 'no gothram') {
    const cached = toList(arrays.GOTHRAM)
    if (cached.length > 0) return cached
  }

  // Fetch fresh — must send caste + lang (same as Angular: type=gothra&caste=X&LANG=en)
  const lang  = (await getItem(SK.Auth.LANG)) ?? 'en'
  const res   = await apiCall(
    Endpoints.registration.initialFetch,
    'POST',
    `type=gothra&caste=${casteId}&LANG=${lang}`,
  )
  // Angular: responseData["GOTHRAM"] — gothra API returns at root level
  const gothram = res?.GOTHRAM ?? res?.RESPONSE?.GOTHRAM

  if (gothram !== undefined) {
    // Cache it so re-entry is instant
    const updated = { ...arrays, GOTHRAM: gothram, GOTHRAM_CASTE: casteId }
    await setItem('REGISTRATIONARRAYS', JSON.stringify(updated))
    return toList(gothram)
  }
  return []
}

// Whether gothram applies to the given caste — Angular reads
// REGISTRATIONARRAYS.GOTHRAAVAILCASTE and checks membership. Factored out of
// getNextPageAfterCaste() so Edit Profile's Religious screen can reuse the
// exact same signal to decide whether to show the Gothram field.
async function gothraAppliesToCaste(caste: string): Promise<boolean> {
  const arrays          = await getRegistrationArrays()
  const gothraAvailList = arrays?.GOTHRAAVAILCASTE
  if (!gothraAvailList) return true                   // no list → assume gothra available
  if (!Array.isArray(gothraAvailList)) return true
  return gothraAvailList.map(String).includes(String(caste))
}

export async function isGothraApplicableForCaste(caste: string): Promise<boolean> {
  return gothraAppliesToCaste(caste)
}

// Fetches caste list for a given religion.
// Angular: type=caste&religion=X&mothertongue=X → RESPONSE.CASTE (plain object or array)
// Called immediately when user selects a religion (mirrors Angular APIMODULENAME['RELIGION'] = 'CASTE').
// Clears stale CASTE/SUBCASTE/GOTHRAM from cache, then pre-fetches the new caste list
// so CasteScreen finds it in cache and loads instantly.
export async function prefetchCasteForReligion(religion: string, mothertongue: string): Promise<void> {
  try {
    const cached = await getItem('REGISTRATIONARRAYS')
    if (cached) {
      const arrays = JSON.parse(cached)
      delete arrays.CASTE
      delete arrays.SUBCASTE
      delete arrays.GOTHRAM
      await setItem('REGISTRATIONARRAYS', JSON.stringify(arrays))
    }
    await fetchCasteOptions(religion, mothertongue)
  } catch {
    // fire-and-forget — ignore failures
  }
}

// Checks REGISTRATIONARRAYS.CASTE cache first; fetches fresh if missing.
export async function fetchCasteOptions(
  religion: string,
  mothertongue: string,
): Promise<Array<{ key: string; label: string }>> {
  const arrays = await getRegistrationArrays()
  const toList = (raw: any) => {
    if (Array.isArray(raw)) {
      return raw.map((item: any) => ({
        key:   String(item.KEY ?? item.key ?? ''),
        label: String(item.VALUE ?? item.value ?? ''),
      })).filter((o: { key: string }) => o.key !== '')
    }
    if (raw && typeof raw === 'object') {
      return Object.entries(raw).map(([key, value]) => ({ key, label: String(value) }))
    }
    return []
  }

  if (arrays?.CASTE) return toList(arrays.CASTE)

  const lang     = (await getItem(SK.Auth.LANG)) ?? 'en'
  const paramStr = `type=caste&religion=${religion}&mothertongue=${mothertongue}&LANG=${lang}`
  const res      = await apiCall(Endpoints.registration.initialFetch, 'POST', paramStr)
  // Angular: responseData["CASTE"] — caste API returns at root level, not inside RESPONSE
  const casteData = res?.CASTE ?? res?.RESPONSE?.CASTE
  const list      = toList(casteData)

  if (casteData) {
    const updated = { ...arrays, CASTE: casteData }
    await setItem('REGISTRATIONARRAYS', JSON.stringify(updated))
  }
  return list
}

// Fetches subcaste list for a given religion + caste.
// Angular: type=subcaste&religion=X&caste=X&mothertongue=X → RESPONSE.SUBCASTE (plain object)
// Always fetches fresh (subcaste is caste-specific; cache invalidates when caste changes).
export async function fetchSubcasteOptions(
  religion: string,
  caste: string,
  mothertongue: string,
): Promise<Array<{ key: string; label: string }>> {
  const lang     = (await getItem(SK.Auth.LANG)) ?? 'en'
  const paramStr = `type=subcaste&religion=${religion}&caste=${caste}&mothertongue=${mothertongue}&LANG=${lang}`
  const res      = await apiCall(Endpoints.registration.initialFetch, 'POST', paramStr)
  // Angular: responseData["SUBCASTE"] — subcaste API returns at root level
  const raw      = res?.SUBCASTE ?? res?.RESPONSE?.SUBCASTE

  const toList = (r: any) => {
    if (Array.isArray(r)) {
      return r.map((item: any) => ({
        key:   String(item.KEY ?? item.key ?? ''),
        label: String(item.VALUE ?? item.value ?? ''),
      })).filter((o: { key: string }) => o.key !== '')
    }
    if (r && typeof r === 'object') {
      return Object.entries(r).map(([key, value]) => ({ key, label: String(value) }))
    }
    return []
  }

  const list = toList(raw)

  // Cache subcaste (used on back-navigation)
  const arrays = await getRegistrationArrays()
  await setItem('REGISTRATIONARRAYS', JSON.stringify({ ...arrays, SUBCASTE: raw ?? '' }))

  return list
}

// After caste is selected, determine whether the Gothra page (16) is needed.
// Angular reads REGISTRATIONARRAYS.GOTHRAAVAILCASTE — if the array includes selectedCaste,
// go to page 16; if the array is missing, default to page 16 (gothra available).
export async function getNextPageAfterCaste(selectedCaste: string): Promise<string> {
  return (await gothraAppliesToCaste(selectedCaste)) ? '16' : '20'
}

// Fetches religion options from REGISTRATIONARRAYS.RELIGION.
// Angular uses | keyvalue pipe on the plain object → { key: "1", value: "Hindu" }.
// API returns either a plain object {"1":"Hindu",...} or an array [{KEY,VALUE}].
export async function fetchReligionOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.RELIGION
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.KEY   ?? item.key   ?? ''),
      label: String(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: String(value) }))
  }
  return []
}

// Fetches physical status options from REGISTRATIONARRAYS.PHYSICALSTATUS.
// Used by the Search/Filter screen only — no onboarding screen collects this field.
export async function fetchPhysicalStatusOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.PHYSICALSTATUS
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.KEY   ?? item.key   ?? ''),
      label: String(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: String(value) }))
  }
  return []
}

// Fetches the Division list (Angular's caste substitute shown when RELIGION === '2' / Islam)
// from REGISTRATIONARRAYS.DIVISION. Used by the Search/Filter screen only.
export async function fetchDivisionOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.DIVISION
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.KEY   ?? item.key   ?? ''),
      label: String(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: String(value) }))
  }
  return []
}

// Fetches monthly income options from REGISTRATIONARRAYS.MONTHLYINCOME
// Angular: apiResponse["MONTHLYINCOME"] → array of { CKEY, VALUE }
export async function fetchMonthlyIncomeOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.MONTHLYINCOME
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.CKEY  ?? item.key   ?? ''),
      label: String(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: String(value) }))
  }
  return []
}

// Fetches NRI income options for non-Indian users.
// Angular: type=NRIINCOME&country=<COUNTRY_key> → { MONTHLYINCOME, NRIINCOME, CURRENCYTYPE }
// Checks REGISTRATIONARRAYS cache first; only calls API if NRIINCOME missing.
export async function fetchNriIncomeData(country: string): Promise<{
  indianList:   Array<{ key: string; label: string }>
  nriList:      Array<{ key: string; label: string }>
  currencyType: string
}> {
  const arrays = await getRegistrationArrays()
  const toList = (raw: any) => {
    if (Array.isArray(raw)) {
      return raw.map((item: any) => ({
        key:   String(item.CKEY  ?? item.key   ?? ''),
        label: String(item.VALUE ?? item.value ?? ''),
      })).filter((o: { key: string }) => o.key !== '')
    }
    if (raw && typeof raw === 'object') {
      return Object.entries(raw).map(([key, value]) => ({ key, label: String(value) }))
    }
    return []
  }

  // Use cache if available
  if (arrays?.NRIINCOME) {
    return {
      indianList:   toList(arrays.MONTHLYINCOME),
      nriList:      toList(arrays.NRIINCOME),
      currencyType: String(arrays.CURRENCYTYPE ?? ''),
    }
  }

  // API fetch
  const lang     = (await getItem(SK.Auth.LANG)) ?? 'en'
  const res      = await apiCall(Endpoints.registration.initialFetch, 'POST', `type=NRIINCOME&country=${country}&LANG=${lang}`)
  const indianList   = toList(res?.RESPONSE?.MONTHLYINCOME)
  const nriList      = toList(res?.RESPONSE?.NRIINCOME)
  const currencyType = String(res?.RESPONSE?.CURRENCYTYPE ?? '')

  // Cache result
  if (res?.RESPONSE) {
    const updated = { ...arrays }
    if (res.RESPONSE.NRIINCOME)    updated.NRIINCOME    = res.RESPONSE.NRIINCOME
    if (res.RESPONSE.CURRENCYTYPE) updated.CURRENCYTYPE  = currencyType
    if (res.RESPONSE.MONTHLYINCOME) updated.MONTHLYINCOME = res.RESPONSE.MONTHLYINCOME
    await setItem('REGISTRATIONARRAYS', JSON.stringify(updated))
  }

  return { indianList, nriList, currencyType }
}

// Fetches occupation options from REGISTRATIONARRAYS.OCCUPATION
// Angular: apiResponse["OCCUPATION"] → array of { OCCKEY, VALUE }
export async function fetchOccupationOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.OCCUPATION
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.OCCKEY ?? item.key   ?? ''),
      label: String(item.VALUE  ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: String(value) }))
  }
  return []
}

// Fetches qualification options from REGISTRATIONARRAYS.EDUCATION
// Angular: apiResponse["EDUCATION"] → array of { EDUKEY, VALUE }
export async function fetchQualificationOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.EDUCATION
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.EDUKEY ?? item.key   ?? ''),
      label: String(item.VALUE  ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: String(value) }))
  }
  return []
}

// Fetches height CATEGORY options (Below average / Average / Above average / Tall)
// Angular: apiResponse["HEIGHTMALE"] / ["HEIGHTFEMALE"] — labels contain HTML (strips on return).
export async function fetchHeightCategoryOptions(
  gender: string,
): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = gender === '0' ? data?.HEIGHTFEMALE : data?.HEIGHTMALE
  const toEntry = (key: string, rawLabel: string) => ({
    key,
    label: String(rawLabel),   // raw HTML — HeightScreen strips it for display
  })
  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => toEntry(
        String(item.KEY ?? item.key ?? ''),
        String(item.VALUE ?? item.value ?? ''),
      ))
      .filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => toEntry(key, String(value)))
  }
  return []
}

// Group display names for the exact height side panel — mirrors Angular's REG.SHORT / REG.MEDIUM / REG.TALL
const HEIGHT_GROUP_LABELS: Record<string, string> = {
  'Short':         'Short',
  'Average Heigth': 'Average Height', // API typo preserved as key
  'Tall':          'Tall',
}

export type HeightGroup = {
  title: string
  data:  Array<{ key: string; label: string }>
}

// Fetches exact heights grouped by Short / Average Heigth / Tall for the side panel SectionList.
// Angular: apiResponse["HEIGHT"]["Male"] / ["Female"] — each group is a plain object {key: label}.
// Angular uses `| keyvalue` pipe + isShowFt: true (label already includes ft/inch from API).
export async function fetchExactHeightGrouped(gender: string): Promise<HeightGroup[]> {
  const data    = await getRegistrationArrays()
  const grouped = gender === '0' ? data?.HEIGHT?.Female : data?.HEIGHT?.Male
  if (!grouped || typeof grouped !== 'object') return []

  const ORDER = ['Short', 'Average Heigth', 'Tall']
  const keys  = [...ORDER, ...Object.keys(grouped).filter(k => !ORDER.includes(k))]
  const result: HeightGroup[] = []

  keys.forEach(k => {
    const group = grouped[k]
    if (!group || typeof group !== 'object') return
    const items: Array<{ key: string; label: string }> = []
    if (Array.isArray(group)) {
      group.forEach((item: any) => {
        const key   = String(item.KEY   ?? item.key   ?? '')
        const label = String(item.VALUE ?? item.value ?? '')
        if (key) items.push({ key, label })
      })
    } else {
      Object.entries(group).forEach(([key, value]) => {
        if (key) items.push({ key, label: String(value) })
      })
    }
    if (items.length) {
      result.push({ title: HEIGHT_GROUP_LABELS[k] ?? k, data: items })
    }
  })
  return result
}

// Flat list (kept for backward compatibility / other uses)
export async function fetchExactHeightOptions(
  gender: string,
): Promise<Array<{ key: string; label: string }>> {
  const groups = await fetchExactHeightGrouped(gender)
  return groups.flatMap(g => g.data)
}

// ─── Location (page 9) ────────────────────────────────────────────────────────

// Angular `loadStateList(motherTongue)` — called after mother tongue is selected.
// Fetches type=MOTHERTONGUE&MOTHERTONGUE=<key> and stores result as STATEOBJ in
// REGISTRATIONARRAYS. Must be called from MotherTongueScreen before navigating to page 9.
export async function loadAndStoreStatesForMotherTongue(motherTongueKey: string): Promise<void> {
  const lang     = (await getItem(SK.Auth.LANG)) ?? 'en'
  const paramStr = `type=MOTHERTONGUE&MOTHERTONGUE=${motherTongueKey}&LANG=${lang}`
  const res      = await apiCall(Endpoints.registration.initialFetch, 'POST', paramStr)
  if (!res?.RESPONSE) return

  // Store as STATEOBJ in REGISTRATIONARRAYS (mirrors Angular localStorage write)
  const cached = await getItem('REGISTRATIONARRAYS')
  const arrays: Record<string, any> = cached ? JSON.parse(cached) : {}
  arrays.STATEOBJ = res.RESPONSE
  await setItem('REGISTRATIONARRAYS', JSON.stringify(arrays))
}

// State list for Indian flow.
// Angular reads STATEOBJ from REGISTRATIONARRAYS (populated by type=MOTHERTONGUE call above).
// Falls back to type=state&country=98 if STATEOBJ is missing.
export async function fetchStates(): Promise<Array<{ key: string; label: string }>> {
  const arrays = await getRegistrationArrays()

  // Primary: STATEOBJ is an array of {STATEID, STATE} set by loadAndStoreStatesForMotherTongue
  const stateObj = arrays?.STATEOBJ
  let items: Array<{ key: string; label: string }> = []

  if (Array.isArray(stateObj) && stateObj.length > 0) {
    items = stateObj
      .map((s: any) => ({ key: String(s.STATEID ?? s.key ?? ''), label: String(s.STATE ?? s.value ?? '') }))
      .filter(o => o.key !== '')
  }

  // Secondary: STATE key in REGISTRATIONARRAYS (from type=all)
  if (items.length === 0) {
    const stateRaw = arrays?.STATE
    if (Array.isArray(stateRaw) && stateRaw.length > 0) {
      items = stateRaw
        .map((s: any) => ({ key: String(s.STATEID ?? ''), label: String(s.STATE ?? '') }))
        .filter(o => o.key !== '')
    } else if (stateRaw && typeof stateRaw === 'object') {
      items = Object.entries(stateRaw).map(([key, value]) => ({ key, label: String(value) }))
    }
  }

  // Fallback: direct API call type=state&country=98 (covers edge cases)
  if (items.length === 0) {
    const lang  = (await getItem(SK.Auth.LANG)) ?? 'en'
    const res   = await apiCall(Endpoints.registration.initialFetch, 'POST', `type=state&country=98&state=&LANG=${lang}`)
    const rawArr = res?.RESPONSE?.STATEOBJ
    const rawObj = res?.RESPONSE?.STATE?.[0]
    if (Array.isArray(rawArr) && rawArr.length > 0) {
      items = rawArr.map((s: any) => ({ key: String(s.STATEID ?? ''), label: String(s.STATE ?? '') })).filter(o => o.key !== '')
    } else if (rawObj && typeof rawObj === 'object') {
      items = Object.entries(rawObj).map(([key, value]) => ({ key, label: String(value) }))
    }
  }

  return items.sort((a, b) => a.label.localeCompare(b.label))
}

// Country list for NRI flow — Angular caches this as COUNTRYLIST inside the shared
// type=all bootstrap response (same call getRegistrationArrays() already makes/caches).
export async function fetchCountries(): Promise<Array<{ key: string; label: string }>> {
  const arrays = await getRegistrationArrays()

  const raw = arrays?.COUNTRYLIST
  let items: Array<{ key: string; label: string }> = []

  if (Array.isArray(raw) && raw.length > 0) {
    items = raw
      .map((c: any) => ({ key: String(c.COUNTRYID ?? c.key ?? ''), label: String(c.COUNTRY ?? c.value ?? '') }))
      .filter(o => o.key !== '')
  }

  return items.sort((a, b) => a.label.localeCompare(b.label))
}

// State list for a given (non-Indian) country — NRI flow.
// Angular checkIsNRIUser() branch: type=state&country=<COUNTRYID> (vs the domestic
// fetchStates() fallback below, which hardcodes country=98 for India).
export async function fetchNriStates(countryId: string): Promise<Array<{ key: string; label: string }>> {
  const lang     = (await getItem(SK.Auth.LANG)) ?? 'en'
  const paramStr = `type=state&country=${countryId}&state=&LANG=${lang}`
  const res      = await apiCall(Endpoints.registration.initialFetch, 'POST', paramStr)

  const rawArr = res?.RESPONSE?.STATEOBJ
  const rawObj = res?.RESPONSE?.STATE?.[0]
  let items: Array<{ key: string; label: string }> = []

  if (Array.isArray(rawArr) && rawArr.length > 0) {
    items = rawArr.map((s: any) => ({ key: String(s.STATEID ?? ''), label: String(s.STATE ?? '') })).filter(o => o.key !== '')
  } else if (rawObj && typeof rawObj === 'object') {
    items = Object.entries(rawObj).map(([key, value]) => ({ key, label: String(value) }))
  }

  return items.sort((a, b) => a.label.localeCompare(b.label))
}

// City list for a state: type=city&country=&state=<STATEID>
// API returns CITYOBJ array [{key, value}] OR CITY[0] plain object {cityId: cityName}
export async function fetchCities(stateId: string): Promise<Array<{ key: string; label: string }>> {
  const lang     = (await getItem(SK.Auth.LANG)) ?? 'en'
  const paramStr = `type=city&country=&state=${stateId}&LANG=${lang}`
  const res      = await apiCall(Endpoints.registration.initialFetch, 'POST', paramStr)

  const rawArr   = res?.RESPONSE?.CITYOBJ   // preferred: array of {key, value}
  const rawObj   = res?.RESPONSE?.CITY?.[0] // fallback: plain object {cityId: cityName}

  let items: Array<{ key: string; label: string }> = []

  if (Array.isArray(rawArr) && rawArr.length > 0) {
    items = rawArr
      .map((c: any) => ({
        key:   String(c.key   ?? c.CITYID ?? c.cityid ?? ''),
        label: String(c.value ?? c.CITY   ?? c.city   ?? ''),
      }))
      .filter(o => o.key !== '')
  } else if (rawObj && typeof rawObj === 'object') {
    items = Object.entries(rawObj).map(([key, value]) => ({ key, label: String(value) }))
  }

  return items
}

// Determines which page follows page 9.
// Angular getRedirectURL(): if countryCode==91 AND MOTHERTONGUE in NATIVEPLACEDOMAIN → page 44
// else page 10 (Education). Default homePlaceDomain = ['2','14','17','41','4','51']
export async function getNextPageAfterLocation(): Promise<string> {
  const arrays      = await getRegistrationArrays()
  // During onboarding MOTHERTONGUE is saved to REGISTRATION_VALUES, not USER_SESSION
  const mothertongue = String((await getRegValue('MOTHERTONGUE')) ?? '')
  const domain: string[] = Array.isArray(arrays?.NATIVEPLACEDOMAIN)
    ? arrays.NATIVEPLACEDOMAIN.map(String)
    : ['2', '14', '17', '41', '4', '51']
  const ccode = (await getItem(SK.User.COUNTRY_CODE)) ?? '91'
  if (ccode === '91' && mothertongue && domain.includes(mothertongue)) {
    return '46'  // page 46 = Yes/No "Is hometown same as current location?"
  }
  return '10'
}

export async function storeWebURLData(data: Record<string, any>): Promise<void> {
  // Auth tokens + IDs stay as individual keys — required by apiClient & AuthContext
  const ops: Promise<void>[] = []
  if (data.ATN)     ops.push(setItem(SK.Auth.TOKEN,         data.ATN))
  if (data.RTN)     ops.push(setItem(SK.Auth.REFRESH_TOKEN, data.RTN))
  if (data.MATRIID) ops.push(setItem(SK.Auth.USER_ID,       String(data.MATRIID)))
  if (data.GENDER)  ops.push(setItem(SK.User.LOGIN_GENDER,  data.GENDER))
  if (data.CCODE) {
    ops.push(setItem('CCODE',             data.CCODE))
    ops.push(setItem(SK.User.MEMBER_CODE, data.CCODE))
  }

  // All session/profile data → single USER_SESSION object
  const session: Record<string, any> = await getSession()

  if (data.MEMBERSHIPTYPE) session.ENTRYTYPE    = data.MEMBERSHIPTYPE
  if (data.MOTHERTOUNGE) {
    session.MOTHERTOUNGE = data.MOTHERTOUNGE
    session.MOTHERTONGUE = data.MOTHERTOUNGE
  }
  // JSON objects stored as parsed values (no double-stringify)
  if (data.FEMALEFREECONACT) session.FEMALEFREECONACT = data.FEMALEFREECONACT
  if (data.PAYMENTWALL)      session.PAYMENTWALL      = data.PAYMENTWALL
  if (data['S&FPROMOTION'])  session['S&FPROMOTION']  = data['S&FPROMOTION']
  if (data.NONIDVUTYPE)      session.NONIDVUTYPE      = data.NONIDVUTYPE
  if (data.PHOTOSTATUSARRAY) session.PHOTOSTATUSARRAY = data.PHOTOSTATUSARRAY

  // Scalar fields — falsy values (0, "") still written to match Angular behaviour
  const SCALAR_KEYS = [
    'RENEWALENABLEKEY', 'PAYRENEWALFLAG', 'PAYMENTPACKAGE', 'NEWPPCALL', 'APPVERSION',
    'NAME', 'PHOTOURL', 'LOGINCOUNT', 'DATEOFBIRTH', 'CREATEDBY', 'RELIGIONKEY',
    'PHONEVERIFIED', 'LASTLOGIN', 'FREETRAILVALIDDAY', 'RENEWALDAY',
    'NALLOW', 'FEMALEFREEPROMO', 'PROFILEPUBLISHEDFLAG', 'PROFILEPUBLISHEDTYPE',
    'PAYPROMO', 'PROFILEVERIFIED', 'DEFERREDIDUSER', 'LOGINTYPE', 'NRIWHATSAPP',
    'IPCOUNTRYCODE', 'AIVFLAG', 'SHORTLISTENABLE', 'SURVEYPOPUP',
    'GLASSBOXFLAG', 'UPIFLAG', 'RPAYFLAG', 'DRNEXT',
    // Angular: config.ts's localvalueArr whitelist — HOROSCOPEAVAILABLE was missing
    // from this list, so the logged-in viewer's own horoscope flag was silently
    // dropped on every login. loginHoroAvail (ViewProfileScreen.tsx) always fell
    // back to '0', so the horoscope section always rendered the "add your own
    // horoscope" prompt regardless of the account's real state.
    'HOROSCOPEAVAILABLE',
    // Angular: webview.page.ts's pageLandingFunc() case "11" — cascades through
    // these six to decide which profile-completion field to prompt for next
    // (pageLandingService.ts). Also missing from this list until now, for the
    // same reason HOROSCOPEAVAILABLE was — never read back anywhere before.
    'FAMILYPROPERTY', 'BROTHERS', 'SISTERS', 'RAASI', 'STAR', 'DOSHAM',
  ]
  SCALAR_KEYS.forEach(k => { if (data[k] !== undefined) session[k] = String(data[k]) })

  ops.push(setItem(SESSION_STORE_KEY, JSON.stringify(session)))
  await Promise.all(ops)

  if (data.MATRIID) setAppsFlyerUserId(String(data.MATRIID))
}

// ─── Registration list data ───────────────────────────────────────────────────

export async function getApiListData(moduleName: string, apiModuleName: string): Promise<any> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const params = `ID=${userId}&MODULENAME=${apiModuleName}`
  const result = await apiCall(Endpoints.registration.listData, 'POST', params)

  if (result?.RESPONSECODE == 1 && result?.ERRCODE == 0) {
    await updateRegistrationArray(moduleName, result.RESPONSE)
    return result.RESPONSE
  }
  return null
}

// Maps API module name → storage key
const REG_ARRAY_MAP: Record<string, string> = {
  state:         'STATEOBJ',
  city:          'CITY',
  caste:         'CASTE',
  subcaste:      'SUBCASTE',
  gothra:        'GOTHRA',
  horostate:     'HOROSTATE',
  horocity:      'HOROCITY',
  homestate:     'HOMESTATE',
  homecity:      'HOMECITY',
  monthlyincome: 'MONTHLYINCOME',
}

export async function updateRegistrationArray(moduleName: string, data: any): Promise<void> {
  const key = REG_ARRAY_MAP[moduleName]
  if (!key) return
  await setItem(key, JSON.stringify(data))
}

// ─── Family details ───────────────────────────────────────────────────────────
// Angular: registration/familyinfo/v1 POST with ID&PROPERTY&BROTHERS&SISTERS
// Empty BROTHERS+SISTERS returns the option arrays; filled values save the data.

function objToOptions(raw: any): Array<{ key: string; label: string }> {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map(item => ({
        key:   String(item.KEY   ?? item.key   ?? item.CKEY ?? ''),
        label: String(item.VALUE ?? item.value ?? item.LABEL ?? item.label ?? ''),
      }))
      .filter(o => o.key)
  }
  if (typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: String(value) }))
  }
  return []
}

// Angular: registration.page.ts's assignArrayData() — profileBrothers/
// profileSisters come from the shared initialfetch response ("BOTHER"/
// "SISTER" keys), same source as every other option list in this file
// (fetchEatingHabitOptions etc.), NOT from the family-info submit endpoint.
// Previously this POSTed blank BROTHERS/SISTERS values to
// Endpoints.registration.updateFamily (the SAVE endpoint) hoping to scrape
// options out of its response — unreliable outside the registration flow,
// which is why Edit Profile's Family screen showed no options at all.
export async function fetchFamilyOptions(): Promise<{
  brothers: Array<{ key: string; label: string }>
  sisters:  Array<{ key: string; label: string }>
}> {
  const data = await getRegistrationArrays()
  return {
    brothers: objToOptions(data?.BOTHER),
    sisters:  objToOptions(data?.SISTER),
  }
}

export async function submitFamilyDetails(brothers: string, sisters: string): Promise<void> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  await apiCall(
    Endpoints.registration.updateFamily,
    'POST',
    `ID=${userId}&PROPERTY=&BROTHERS=${brothers}&SISTERS=${sisters}`,
  )
}

// Angular: registration.page.ts's assignArrayData() — profileProperty comes
// from the shared initialfetch response ("ASSETS" key), the same function
// (and same underlying call) that populates BOTHER/SISTER above. Previously
// this POSTed blank values to Endpoints.registration.updateFamily (the SAVE
// endpoint) instead — same bug as fetchFamilyOptions() had, and for the same
// reason: unreliable outside the registration flow.
export async function fetchPropertyOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  return objToOptions(data?.ASSETS)
}

export async function submitPropertyDetails(properties: string[]): Promise<void> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  await apiCall(
    Endpoints.registration.updateFamily,
    'POST',
    `ID=${userId}&PROPERTY=${properties.join('~')}&BROTHERS=&SISTERS=`,
  )
}

// ─── Horoscope (Star / Raasi / Dosham) ───────────────────────────────────────
// Angular: registration/zodiacinfo/v1 — POST with ID&STAR&RAASI&DOSHAM
// Empty values fetches dropdown options; filled values saves the data.
// Stars filtered by raasi: registrationform/v1 — POST with type=stars&RAASIID=X&LANG=en

export async function fetchRaasiOptions(): Promise<Array<{ key: string; label: string }>> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const lang   = await getItem('LANG') ?? 'en'
  const res    = await apiCall(
    Endpoints.registration.updateReligious,
    'POST',
    `ID=${userId}&STAR=&RAASI=&DOSHAM=`,
  )
  if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0 && res?.RESPONSE?.RAASI) {
    return objToOptions(res.RESPONSE.RAASI)
  }
  // Fallback: fetch from initialfetch endpoint
  const res2 = await apiCall(
    Endpoints.registration.initialFetch,
    'POST',
    `type=raasi&LANG=${lang}`,
  )
  if (res2?.RESPONSECODE == 1 && res2?.ERRCODE == 0 && res2?.RESPONSE) {
    return objToOptions(res2.RESPONSE.RAASI ?? res2.RESPONSE)
  }
  return []
}

export async function fetchStarOptions(raasiId: string): Promise<Array<{ key: string; label: string }>> {
  const lang = await getItem('LANG') ?? 'en'
  const res  = await apiCall(
    Endpoints.registration.initialFetch,
    'POST',
    `type=stars&RAASIID=${raasiId}&LANG=${lang}`,
  )
  if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0 && res?.RESPONSE) {
    return objToOptions(res.RESPONSE)
  }
  return []
}

// `star`/`raasi` params are kept only for signature compatibility with
// existing callers — see below, neither is actually used anymore.
export async function fetchDoshamOptions(
  _star: string,
  _raasi: string,
  motherTongue?: string,
): Promise<{ dosham: Array<{ key: string; label: string }>; doshamHash: Array<{ key: string; label: string }> }> {
  // BOTH the Yes/No list and the specific dosham-*type* breakdown are static
  // reference data from the shared initialfetch cache — Angular:
  // assignArrayData()'s `profileDosham = apiResponse["DOSHAM"]` and the
  // `apiResponse["DOSHAMHASH"]` block right after it (same function, same
  // initialfetch call that populates BOTHER/SISTER/ASSETS). DOSHAMHASH is
  // filtered only by mother tongue (TAMIL vs OTHER) — there is no live,
  // star+raasi-dependent lookup at all. Two earlier fixes wrongly assumed
  // this needed the zodiacinfo endpoint (by loose analogy with
  // fetchRaasiOptions' blank-param call) — direct reading of Angular's
  // source proves both fields live in the initialfetch response instead.
  const registrationArrays = await getRegistrationArrays()
  const dosham = objToOptions(registrationArrays?.DOSHAM)

  const hash = registrationArrays?.DOSHAMHASH
  const filteredHash = hash
    ? ((motherTongue === '47' ? hash.TAMIL : hash.OTHER) ?? hash)
    : {}

  return {
    dosham,
    doshamHash: objToOptions(filteredHash),
  }
}

export async function submitHoroscopeDetails(
  star: string,
  raasi: string,
  dosham: string,
): Promise<void> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  await apiCall(
    Endpoints.registration.updateReligious,
    'POST',
    `ID=${userId}&STAR=${star}&RAASI=${raasi}&DOSHAM=${dosham}`,
  )
}

// ─── Horoscope generation (pages 29/30/31) ────────────────────────────────────
// Angular: HOROSTATE is never independently fetched — it reuses the same Indian
// state list as fetchStates()/NATIVESTATE, defaulting to NATIVESTATE || STATE.
// So there's no fetchHoroStates(); callers should use fetchStates() directly.

export type HoroCity = {
  key:       string  // Angular stores the array INDEX as the value, not an id
  label:     string
  latitude:  string
  longitude: string
  timezone:  string
}

// City list for a horoscope birth-state: ID=<userId>&STATEID=<HOROSTATE>.
// Angular caches the raw response (with LATITUDE/LONGITUDE/TIMEZONE) in
// REGISTRATIONARRAYS.HOROCITY so generateHoroscope() can look coordinates back
// up by index later — mirrored here the same way.
export async function fetchHoroCities(stateId: string): Promise<HoroCity[]> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const res    = await apiCall(Endpoints.registration.getHoroCity, 'POST', `ID=${userId}&STATEID=${stateId}`)

  const raw = res?.RESPONSE
  if (!Array.isArray(raw)) return []

  const items: HoroCity[] = raw.map((c: any, i: number) => ({
    key:       String(i),
    label:     String(c.DISTRICT ?? ''),
    latitude:  String(c.LATITUDE ?? ''),
    longitude: String(c.LONGITUDE ?? ''),
    timezone:  String(c.TIMEZONE ?? ''),
  }))

  const cached = await getItem('REGISTRATIONARRAYS')
  const arrays: Record<string, any> = cached ? JSON.parse(cached) : {}
  arrays.HOROCITY = items
  await setItem('REGISTRATIONARRAYS', JSON.stringify(arrays))

  return items
}

export type GenerateHoroscopeParams = {
  date:     string  // day of month, e.g. "8" or "08"
  month:    string  // 1-12
  year:     string
  hour:     string  // 1-12 (12-hour)
  minute:   string  // 0-59
  meridian: 'AM' | 'PM'
  stateId:  string  // HOROSTATE
  cityKey:  string  // HOROCITY — array index into fetchHoroCities()'s result
}

// Angular generateHoroscope(): builds ID/DATE/MONTH/YEAR/HOUR/MINUTE/SECOND/MERDIAN
// (yes, "MERDIAN" — misspelled param name the backend actually expects, preserved
// verbatim) + STATEID/CITY/LATITUDE/LONGITUDE/ZONE, then calls generatehoro the
// first time or updatehoroinfo on subsequent edits (decided by the session-level
// HOROSCOPEAVAILABLE flag, not the per-registration HOROSCOPEAVAIL reg value).
export async function generateHoroscope(params: GenerateHoroscopeParams): Promise<boolean> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const arrays = await getRegistrationArrays()
  const cities: HoroCity[] = arrays?.HOROCITY ?? []
  const city   = cities[Number(params.cityKey)]

  const dd = params.date.padStart(2, '0')
  const mm = params.month.padStart(2, '0')

  const paramStr =
    `ID=${userId}&DATE=${dd}&MONTH=${mm}&YEAR=${params.year}` +
    `&HOUR=${params.hour}&MINUTE=${params.minute}&SECOND=00&MERDIAN=${params.meridian}` +
    `&STATEID=${params.stateId}&CITY=${params.cityKey}` +
    `&LATITUDE=${city?.latitude ?? ''}&LONGITUDE=${city?.longitude ?? ''}&ZONE=${city?.timezone ?? ''}`

  const horoscopeAvailable = await getItem(SK.Profile.HOROSCOPE_AVAILABLE)
  const endpoint = horoscopeAvailable === '1'
    ? Endpoints.registration.updateHoroInfo
    : Endpoints.registration.generateHoro

  const res = await apiCall(endpoint, 'POST', paramStr)
  const ok  = res?.RESPONSECODE == 1

  if (ok) {
    // Angular toRailwayTime(): 12-hour + meridian → zero-padded 24-hour "HH:MM"
    let hour24 = Number(params.hour) % 12
    if (params.meridian === 'PM') hour24 += 12
    await setRegValue('TIMEOFBIRTH', `${String(hour24).padStart(2, '0')}:${params.minute.padStart(2, '0')}`)
    await setRegValue('HOROSCOPEAVAIL', '1')
    await setItem(SK.Profile.HOROSCOPE_AVAILABLE, '1')
  }

  return ok
}

// ─── Registration update ──────────────────────────────────────────────────────

export async function callRegistrationAPI(params: Record<string, any>): Promise<any> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const paramStr = `ID=${userId}&` + Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
  return apiCall(Endpoints.registration.update, 'POST', paramStr)
}

// ─── Full registration submit ─────────────────────────────────────────────────
// Called at Caste (no gothra) or Gothra step — mirrors Angular's final callRegistrationAPI
// which goes to registration/insert/v1 ("registrationupdate" module in Angular httpservice).
// Angular param name mapping: QUALIFICATION→Education, MCODE→CountryCode, INCOMETYPE→IncomeCurrency.
// NOTE: no ID in this payload — server creates the profile and returns MATRIID.

export async function submitFullRegistration(): Promise<{ matriId?: string; responsecode?: string }> {
  const rv       = await getRegValues()
  const lang     = (await getItem(SK.Auth.LANG))  ?? 'en'
  const cachedIp = await getItem('USERIP')
  const ipAddress = cachedIp ?? (await fetchUserIp()) ?? ''

  // Angular: LANG first, then all profile fields, then IpAddress/phoneverify/DEVICEID/TYPE
  // CountryCode → rv.MCODE (LoginScreen stores country code as MCODE in REGISTRATION_VALUES)
  // Education   → rv.QUALIFICATION (QualificationScreen stores as QUALIFICATION)
  // TYPE=APPSLREG identifies this as a native-app registration (Angular: isPwaApp ? source : 'APPSLREG')
  const params = [
    `LANG=${lang}`,
    `CountryCode=${rv.MCODE ?? '91'}`,
    `MobileNo=${rv.MOBILENO ?? ''}`,
    `ProfileCreatedBy=${rv.CREATEDBY ?? '1'}`,
    `Gender=${rv.GENDER ?? '1'}`,
    `Name=${encodeURIComponent(rv.NAME ?? '')}`,
    `MaritalStatus=${rv.MARITALSTATUS ?? ''}`,
    `noofchildren=${rv.NOOFCHILDREN ?? ''}`,
    `EatingHabits=${rv.EATING ?? ''}`,
    `physicalstatus=${rv.PHYSICALSTATUS ?? '1'}`,
    `Month=${rv.MONTH ?? ''}`,
    `Date=${rv.DATE ?? ''}`,
    `Year=${rv.YEAR ?? ''}`,
    `Age=${rv.AGE ?? ''}`,
    `Height=${rv.HEIGHT ?? ''}`,
    `MotherTongue=${rv.MOTHERTONGUE ?? ''}`,
    `country=${rv.COUNTRY ?? ''}`,
    `City=${rv.CITY ?? ''}`,
    `State=${rv.STATE ?? ''}`,
    `NativeCountry=${rv.NATIVECOUNTRY ?? ''}`,
    `NativeState=${rv.NATIVESTATE ?? ''}`,
    `NativeCity=${rv.NATIVECITY ?? ''}`,
    `HomeState=${rv.HOMESTATE ?? ''}`,
    `HomeCity=${rv.HOMECITY ?? ''}`,
    `Education=${rv.QUALIFICATION ?? ''}`,
    `Occupation=${rv.OCCUPATION ?? ''}`,
    `MonthlyIncome=${rv.INCOME ?? ''}`,
    `IncomeCurrency=${rv.INCOMETYPE ?? ''}`,
    `Religion=${rv.RELIGION ?? ''}`,
    `Caste=${rv.CASTE ?? ''}`,
    `SubCaste=${rv.SUBCASTE ?? ''}`,
    `Gothram=${rv.GOTHRA ?? ''}`,
    `IpAddress=${ipAddress}`,
    `phoneverify=1`,
    `DEVICEID=`,
    `TYPE=APPSLREG`,
  ].join('&')

  // Angular "registrationupdate" module → registration/insert/v1 (creates profile, returns MATRIID)
  const res = await apiCall(Endpoints.registration.insert, 'POST', params)
  const matriId = res?.MATRIID ?? res?.RESPONSE?.MATRIID
  const result: { matriId?: string; responsecode?: string } = {
    responsecode: String(res?.RESPONSECODE ?? ''),
  }
  if (matriId) {
    result.matriId = String(matriId)
    await setItem(SK.Auth.USER_ID, String(matriId))
    // Establish auth session (ATN) via autologin so subsequent endpoints
    // like familyinfo/v1 and starraasi/v1 that require ATN work correctly.
    await autoLogin(String(matriId), false, false)
    // Angular: registration.service.ts's handleRegistrationSuccess() sets this
    // right after a successful registration — MatchesScreen's bulkLike()-equivalent
    // check reads it on the very next Matches load and removes it (one-time use),
    // so the bulk-like prompt only ever appears once, right after registering.
    await setItem('bulklikechk', '1')
  }
  return result
}

// Mirrors Angular's callPartialRegistrationAPI() — sends ALL accumulated reg values
// to partialreg/v1 as a fire-and-forget progress save on each onboarding step.
// Call after setRegValue() and navigate immediately — do NOT await this.
export function callPartialRegistrationAPI(): void {
  _doPartialReg().catch(() => {})  // fully fire-and-forget
}

async function _doPartialReg(): Promise<void> {
  const rv          = await getRegValues()
  const cachedIp2   = await getItem('USERIP')
  const ipAddress   = cachedIp2 ?? (await fetchUserIp()) ?? ''
  const registerId = (await getItem('REGISTERID'))  ?? ''
  const deviceId   = (await getItem('DEVICEID'))    ?? ''
  const appVersion = (await getItem('APPVERSION'))  ?? ''

  // Angular: if occupation==8 (student/no income) → income=99
  //          if religion filled but income empty    → income=99
  let income = rv.MONTHLYINCOME || rv.INCOME || ''
  if (rv.OCCUPATION === '8') income = '99'
  if (rv.RELIGION && !income) income = '99'

  // Angular: country param only sent when STATE is filled
  const country = rv.STATE ? (rv.COUNTRY ?? '') : ''

  const paramStr = [
    `CountryCode=${rv.MCODE           ?? ''}`,
    `MobileNo=${rv.MOBILENO           ?? ''}`,
    `ProfileCreatedBy=${rv.CREATEDBY  ?? ''}`,
    `Gender=${rv.GENDER               ?? ''}`,
    `Name=${encodeURIComponent(rv.NAME ?? '')}`,
    `MaritalStatus=${rv.MARITALSTATUS ?? ''}`,
    `noofchildren=${rv.NOOFCHILDREN   ?? ''}`,
    `EatingHabits=${rv.EATING         ?? rv.EATINGHABITS ?? ''}`,
    `physicalstatus=${rv.PHYSICALSTATUS ?? '1'}`,
    `Year=${rv.YEAR   ?? ''}`,
    `Month=${rv.MONTH ?? ''}`,
    `Date=${rv.DATE   ?? ''}`,
    `Age=${rv.AGE     ?? ''}`,
    `Height=${rv.HEIGHT ?? ''}`,
    `MotherTongue=${rv.MOTHERTONGUE   ?? ''}`,
    `country=${country}`,
    `City=${rv.CITY           ?? ''}`,
    `State=${rv.STATE         ?? ''}`,
    `NativeCountry=${rv.NATIVECOUNTRY ?? ''}`,
    `NativeState=${rv.NATIVESTATE     ?? ''}`,
    `NativeCity=${rv.NATIVECITY       ?? ''}`,
    `HomeState=${rv.HOMESTATE         ?? ''}`,
    `HomeCity=${rv.HOMECITY           ?? ''}`,
    `Education=${rv.QUALIFICATION     ?? ''}`,
    `Occupation=${rv.OCCUPATION       ?? ''}`,
    `MonthlyIncome=${income}`,
    `IncomeCurrency=${rv.INCOMETYPE   ?? rv.INCOMECURRENCY ?? ''}`,
    `Religion=${rv.RELIGION   ?? ''}`,
    `Caste=${rv.CASTE         ?? ''}`,
    `SubCaste=${rv.SUBCASTE   ?? ''}`,
    `Gothram=${rv.GOTHRA      ?? ''}`,
    `IpAddress=${ipAddress}`,
    `DEVICEID=${deviceId}`,
    `REGISTERID=${registerId}`,
    `APPVERSION=${appVersion}`,
  ].join('&')

  await apiCall(Endpoints.registration.partial, 'POST', paramStr)
}

export async function callIntermediatePageUpdateApi(pageId: string): Promise<void> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  await apiCall(Endpoints.registration.intermediateUpdate, 'POST', `ID=${userId}&PAGEID=${pageId}`)
}

// ─── OTP rate limiting ────────────────────────────────────────────────────────

const OTP_DAILY_LIMIT = 5

async function checkResendOTPLimit(): Promise<boolean> {
  const today = new Date().toLocaleDateString('en-GB')
  const storedDate  = await getItem('OTP_RESEND_DATE')
  const storedCount = await getItem('OTP_RESEND_COUNT')

  if (storedDate !== today) {
    await setItem('OTP_RESEND_DATE',  today)
    await setItem('OTP_RESEND_COUNT', '0')
    return false
  }

  return Number(storedCount ?? '0') >= OTP_DAILY_LIMIT
}

async function incrementOTPCount(): Promise<void> {
  const count = Number((await getItem('OTP_RESEND_COUNT')) ?? '0')
  await setItem('OTP_RESEND_COUNT', String(count + 1))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function checkIsNRIUser(countryCode: string): Promise<boolean> {
  return countryCode !== '91' && countryCode !== ''
}

export function getMatchedItem(
  list: Array<{ KEY: string; VALUE: string }>,
  keyToFind: string,
): string {
  return list.find(item => item.KEY === keyToFind)?.VALUE ?? ''
}

// ─── AI profile validation (webview page_id 61) ────────────────────────────────
// Angular: webview.page.ts's handleAiProfileValidation() → registration.service.ts's
// callAiProfileValidation() (GET editprofile/aiprfvalidation/v1) and
// fetchEditFormValuesForValidation() (refreshes REGISTRATIONVALUES from the
// member's current saved profile before validation runs). Both are real, wired
// Angular functions — confirmed by reading registration.service.ts directly;
// an earlier pass here had wrongly assumed they didn't exist.

// Angular: registration.service.ts's callAiProfileValidation(matriId, type) —
// params come from the SAME REGISTRATIONVALUES store getRegValues()/setRegValues()
// already use everywhere else in this file. `type` mirrors Angular's own second
// arg: webview.page.ts's case 61 calls with type=2 (initial check); the
// validation screen's own in-place resubmit calls with the default (1).
export async function callAiProfileValidation(matriId: string, type: number | string = 1): Promise<any> {
  const rv = await getRegValues()
  const ipAddress = (await getItem('USERIP')) ?? (await fetchUserIp()) ?? ''
  const params = [
    `ID=${matriId}`,
    `ProfileCreatedBy=${rv.CREATEDBY ?? ''}`,
    `CountryCode=${rv.COUNTRYCODE ?? ''}`,
    `Gender=${rv.GENDER ?? ''}`,
    `Name=${encodeURIComponent(rv.NAME ?? '')}`,
    `MaritalStatus=${rv.MARITALSTATUS ?? ''}`,
    `noofchildren=${rv.NOOFCHILD ?? rv.NOOFCHILDREN ?? ''}`,
    `EatingHabits=${rv.EATINGHABITS ?? ''}`,
    `physicalstatus=${rv.PHYSICALSTATUS ?? ''}`,
    `Year=${rv.YEAR ?? ''}`,
    `Month=${rv.MONTH ?? ''}`,
    `Date=${rv.DATE ?? ''}`,
    `Age=${rv.AGE ?? ''}`,
    `Height=${rv.HEIGHT ?? ''}`,
    `MotherTongue=${rv.MOTHERTONGUE ?? ''}`,
    `country=${rv.COUNTRY ?? ''}`,
    `City=${rv.CITY ?? ''}`,
    `State=${rv.STATE ?? ''}`,
    `NativeCountry=${rv.NATIVECOUNTRY ?? ''}`,
    `NativeState=${rv.NATIVESTATE ?? ''}`,
    `NativeCity=${rv.NATIVECITY ?? ''}`,
    `HomeState=${rv.HOMESTATE ?? ''}`,
    `HomeCity=${rv.HOMECITY ?? ''}`,
    `Education=${rv.QUALIFICATION ?? ''}`,
    `Occupation=${rv.OCCUPATION ?? ''}`,
    `MonthlyIncome=${rv.MONTHLYINCOME ?? ''}`,
    `IncomeCurrency=${rv.INCOMETYPE ?? ''}`,
    `Religion=${rv.RELIGION ?? ''}`,
    `Caste=${rv.CASTE ?? ''}`,
    `SubCaste=${rv.SUBCASTE ?? ''}`,
    `Gothram=${rv.GOTHRA ?? ''}`,
    `IpAddress=${ipAddress}`,
    `phoneverify=1`,
    `DEVICEID=`,
    `TYPE=${type}`,
  ].join('&')
  return apiCall(Endpoints.profile.aiValidation, 'GET', params)
}

// Angular: registration.service.ts's fetchEditFormValuesForValidation() — pulls the
// member's CURRENT saved profile (the same editprofileinfo API
// editProfileService.ts's fetchEditProfileInfo() already wraps) and writes it into
// REGISTRATIONVALUES so callAiProfileValidation()'s params reflect the live
// profile, not stale onboarding-time values. Field renames match Angular exactly:
// EDUCATION→QUALIFICATION, GOTHRAM→GOTHRA, NOOFCHILDREN written to both
// NOOFCHILD and NOOFCHILDREN (Angular reads either depending on call site).
export async function fetchEditFormValuesForValidation(): Promise<EditProfileInfo | null> {
  const info = await fetchEditProfileInfo()
  if (!info) return null

  const loginGender = (await getItem(SK.User.LOGIN_GENDER)) ?? ''
  let year = '', month = '', date = ''
  if (info.dateOfBirth && info.dateOfBirth !== '0000-00-00') {
    const parts = info.dateOfBirth.split('-')
    year  = parts[0] ?? ''
    month = parts[1] ? String(Number(parts[1])) : ''
    date  = parts[2] ? String(Number(parts[2])) : ''
  }

  await setRegValues({
    GENDER:        loginGender.toUpperCase() === 'F' ? '0' : '1',
    CREATEDBY:     info.createdBy ?? '1',
    NAME:          info.name ?? '',
    MARITALSTATUS: info.maritalStatus ?? '',
    NOOFCHILD:     info.noOfChildren ?? '',
    NOOFCHILDREN:  info.noOfChildren ?? '',
    RELIGION:      info.religion ?? '',
    CASTE:         info.caste ?? '',
    SUBCASTE:      info.subCaste ?? '',
    GOTHRA:        info.gothram ?? '',
    MOTHERTONGUE:  info.motherTongue ?? '',
    QUALIFICATION: info.education ?? '',
    OCCUPATION:    info.occupation ?? '',
    MONTHLYINCOME: info.income ?? '',
    INCOMETYPE:    info.incomeType || 'INR',
    STATE:         info.state ?? '',
    CITY:          info.city ?? '',
    AGE:           info.age ?? '',
    YEAR:          year,
    MONTH:         month,
    DATE:          date,
  })
  return info
}

// Angular: core/config/registration.config.ts's VIOLATIONFIELDMAP — maps the AI
// response's raw violated-field names onto the canonical field keys
// shouldShowField() checks against.
const VIOLATION_FIELD_MAP: Record<string, string> = {
  NAME: 'NAME',
  AGE: 'DOB', DOB: 'DOB', MONTH: 'DOB',
  MARITALSTATUS: 'MARITALSTATUS', MARITALSTATUSFEMALE: 'MARITALSTATUS', MARITALSTATUSMALE: 'MARITALSTATUS',
  NOOFCHILDREN: 'NOOFCHILDREN',
  EDUCATION: 'QUALIFICATION',
  MONTHLYINCOME: 'MONTHLYINCOME',
  MOTHERTONGUES: 'MOTHERTONGUE', APPTYPE: 'MOTHERTONGUE', DOMAIN: 'MOTHERTONGUE',
  OCCUPATION: 'OCCUPATION',
  RELIGION: 'RELIGION',
  CASTE: 'CASTE',
  SUBCASTE: 'SUBCASTE',
  STATE: 'STATE',
}

// Angular: registration.service.ts's c2ViolationFields() — dedupes and maps the
// raw VIOLATIONFIELD list (each item either a plain string or {VALUE: '...'})
// through VIOLATIONFIELDMAP.
export function mapViolationFields(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const mapped = raw
    .map(field => {
      const name = (field && typeof field === 'object' ? (field as any).VALUE : field) ?? ''
      return VIOLATION_FIELD_MAP[String(name).toUpperCase()]
    })
    .filter((v): v is string => !!v)
  return Array.from(new Set(mapped))
}

// Angular: core/config/registration.config.ts's CONFIRM2_EDITABLE_VIOLATION_FIELDS
// — fields the confirm2 screen can actually show an editor for. A violation
// limited to a non-editable field (e.g. NAME) would render an empty page, so
// callers complete registration instead of showing the screen.
export const CONFIRM2_EDITABLE_VIOLATION_FIELDS = [
  'MARITALSTATUS', 'NOOFCHILDREN', 'DOB', 'MOTHERTONGUE', 'STATE', 'CITY',
  'QUALIFICATION', 'OCCUPATION', 'MONTHLYINCOME', 'RELIGION', 'CASTE', 'SUBCASTE', 'GOTHRA',
]

