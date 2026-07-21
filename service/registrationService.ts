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
// URL format: https://...#/login/{ ...user JSON... }/2

export async function parseAndStoreWebViewURL(webViewUrl: string): Promise<void> {
  try {
    const loginSegment = webViewUrl.split('login/')[1]
    if (!loginSegment) return
    // Locate the outermost JSON object by first { and last }
    // Splitting on '/2' was fragile — the JSON itself can contain '/2'
    const jsonStart = loginSegment.indexOf('{')
    const jsonEnd   = loginSegment.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return
    const jsonStr = loginSegment.slice(jsonStart, jsonEnd + 1)
    const data    = JSON.parse(jsonStr)
    await storeWebURLData(data)
  } catch (e) {
    if (__DEV__) console.error('[parseWebViewURL]', e)
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

// Fetches gothram options for the selected caste.
// Angular: type=gothra&caste=${CASTE}&LANG=${lang} → RESPONSE.GOTHRAM (plain object)
// Key '998' = "All except your gothra" — excluded from registration list.
// Returns [] when response is "no gothram" string.
export async function fetchGothraOptions(): Promise<Array<{ key: string; label: string }>> {
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

  // Check cache (Angular stores under GOTHRAM inside REGISTRATIONARRAYS)
  const arrays = await getRegistrationArrays()
  if (arrays?.GOTHRAM && arrays.GOTHRAM !== 'no gothram') {
    const cached = toList(arrays.GOTHRAM)
    if (cached.length > 0) return cached
  }

  // Fetch fresh — must send caste + lang (same as Angular: type=gothra&caste=X&LANG=en)
  const caste = (await getRegValue('CASTE')) ?? ''
  const lang  = (await getItem(SK.Auth.LANG)) ?? 'en'
  const res   = await apiCall(
    Endpoints.registration.initialFetch,
    'POST',
    `type=gothra&caste=${caste}&LANG=${lang}`,
  )
  // Angular: responseData["GOTHRAM"] — gothra API returns at root level
  const gothram = res?.GOTHRAM ?? res?.RESPONSE?.GOTHRAM

  if (gothram !== undefined) {
    // Cache it so re-entry is instant
    const updated = { ...arrays, GOTHRAM: gothram }
    await setItem('REGISTRATIONARRAYS', JSON.stringify(updated))
    return toList(gothram)
  }
  return []
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
  const arrays          = await getRegistrationArrays()
  const gothraAvailList = arrays?.GOTHRAAVAILCASTE
  if (!gothraAvailList) return '16'                  // no list → assume gothra available
  if (!Array.isArray(gothraAvailList)) return '16'
  return gothraAvailList.map(String).includes(String(selectedCaste)) ? '16' : '20'
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

export async function fetchFamilyOptions(): Promise<{
  brothers: Array<{ key: string; label: string }>
  sisters:  Array<{ key: string; label: string }>
}> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const res = await apiCall(
    Endpoints.registration.updateFamily,
    'POST',
    `ID=${userId}&PROPERTY=&BROTHERS=&SISTERS=`,
  )
  if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0 && res?.RESPONSE) {
    return {
      brothers: objToOptions(res.RESPONSE.BOTHER),
      sisters:  objToOptions(res.RESPONSE.SISTER),
    }
  }
  return { brothers: [], sisters: [] }
}

export async function submitFamilyDetails(brothers: string, sisters: string): Promise<void> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  await apiCall(
    Endpoints.registration.updateFamily,
    'POST',
    `ID=${userId}&PROPERTY=&BROTHERS=${brothers}&SISTERS=${sisters}`,
  )
}

export async function fetchPropertyOptions(): Promise<Array<{ key: string; label: string }>> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const res = await apiCall(
    Endpoints.registration.updateFamily,
    'POST',
    `ID=${userId}&PROPERTY=&BROTHERS=&SISTERS=`,
  )
  if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0 && res?.RESPONSE) {
    return objToOptions(res.RESPONSE.ASSETS)
  }
  return []
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

export async function fetchDoshamOptions(
  star: string,
  raasi: string,
  motherTongue?: string,
): Promise<{ dosham: Array<{ key: string; label: string }>; doshamHash: Array<{ key: string; label: string }> }> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const res = await apiCall(
    Endpoints.registration.updateReligious,
    'POST',
    `ID=${userId}&STAR=${star}&RAASI=${raasi}&DOSHAM=`,
  )
  if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0 && res?.RESPONSE) {
    const hash = res.RESPONSE.DOSHAMHASH
    // Angular: Tamil mother tongue (key "47") uses TAMIL branch, all others use OTHER
    const filteredHash = hash
      ? ((motherTongue === '47' ? hash.TAMIL : hash.OTHER) ?? hash)
      : {}
    return {
      dosham:     objToOptions(res.RESPONSE.DOSHAM ?? {}),
      doshamHash: objToOptions(filteredHash),
    }
  }
  return { dosham: [], doshamHash: [] }
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

