// Registration service — migrated from Angular registration.service.ts (971 lines).
// Critical: storeWebURLData parses the WEBVIEWURL login payload that the backend
// embeds user session data in. The URL format is:
//   https://...#/login/<JSON_BASE64>/2
// In RN we call this same API and parse the same payload — no WebView needed.

import { apiCall, fetchUserIp, uploadFile } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem, removeMultiple,getJson } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { navigate } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'
import { setAppsFlyerUserId } from './analyticsService'
import { fetchEditProfileInfo, type EditProfileInfo } from './editProfileService'
import { stripAndDecodeHtml, decodeEntities } from '../utils/htmlEntities'
import {
  NON_SELECTABLE_OPTION_KEYS, QUICK_FILTER_FIELDS, type QuickFilterChip,
} from './filterService'

// The registrationform/v1 (initialfetch) API returns vernacular option labels as
// HTML numeric character references — Tamil "Myself" arrives as the literal text
// "&#x0B8E;&#x0BA9;&#x0B95;&#x0BCD;&#x0B95;&#x0BBE;&#x0B95;", not as UTF-8. Angular decodes these in
// common.ts's decodeEntities() (div.innerHTML → textContent); RN has no DOM, so
// utils/htmlEntities.ts does it in pure JS. Every VALUE read off this API must go
// through label() or the raw entity codes render on screen.
// Some labels (e.g. MOTHERTONGUES) additionally carry HTML tags, which this strips.
const label = (v: unknown): string => stripAndDecodeHtml(String(v ?? ''))

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

// Angular: deleteAllLocalStorage() + removeLocalStorageValue(REGVALUES) — used
// when a fresh-registration deep link (webview handoff buildparam.REGISTER=='1')
// needs to discard any abandoned draft before seeding a new one.
export async function resetRegValues(): Promise<void> {
  await removeMultiple([REG_STORE_KEY, 'REGISTERURL'])
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
      .map(([key, value]) => ({ key, label: label(value) }))
  }
  return []
}

export type GenderOption = {
  key: string        // '1' = Male, '0' = Female
  label: string      // display label in current language
  img: string        // unselected avatar URL  (API: IMG)
  imgActive: string  // selected avatar URL    (API: IMG-ACTIVE)
  text: string       // helper subtext shown under the card once selected (API: TEXT)
}

// Fetches gender options for the given createdBy from the initialfetch API.
// GENDERARRAY[createdBy] contains [{ key, value, IMG, IMG-ACTIVE, TEXT }] per Angular.
export async function fetchGenderOptions(createdBy: string): Promise<GenderOption[]> {
  const ccode    = await getItem(SK.User.COUNTRY_CODE) ?? '91'
  const lang     = await getItem(SK.Auth.LANG) ?? 'en'
  const paramStr = `type=all&ccode=${ccode}&LANG=${lang}`
  const res = await apiCall(Endpoints.registration.initialFetch, 'POST', paramStr)
  const genderArray = res?.RESPONSE?.GENDERARRAY
  const list: any[] = genderArray?.[createdBy] ?? genderArray?.['1'] ?? []
  if (!Array.isArray(list)) return []
  // Raw API field names: KEY, VALUE, IMG, IMG-ACTIVE, TEXT
  // (Angular mappingArray renames KEY→key, VALUE→value before using; IMG/IMG-ACTIVE/TEXT stay unchanged)
  return list
    .map((item: any) => ({
      key:       String(item['KEY'] ?? item['key'] ?? ''),
      label:     label(item['VALUE'] ?? item['value'] ?? ''),
      img:       item['IMG'] ?? '',
      imgActive: item['IMG-ACTIVE'] ?? '',
      // TEXT is display copy too (helper subtext under the selected card), so it
      // needs the same entity decoding as VALUE — IMG/IMG-ACTIVE are URLs, not copy.
      text:      label(item['TEXT'] ?? ''),
    }))
    .filter(o => o.key !== '')
}

// ─── AI name/gender validation ────────────────────────────────────────────────
// Angular: registration.service.ts's isAiValidationEnabled() / validateNameGender(),
// driving the "Please confirm your details below" edit sheet on onboarding 2 & 3.

// Angular: registration.config.ts's SELFGENDER / OTHERGENDER — which CREATEDBY
// values ask for the profile-owner's own gender (page 3) vs. imply it (page 2).
export const SELF_GENDER_KEYS  = ['1', '10', '11']
export const OTHER_GENDER_KEYS = ['4', '5', '8', '9']

export type NameGenderValidation = {
  isNameViolated:  boolean
  isGenderInvalid: boolean
}

// Angular: `localStorage.getItem('AIVFLAG') === '1'` — server-set feature flag,
// stored by storeWebURLData()'s SCALAR_KEYS list from the WEBVIEWURL payload.
//
// AIVFLAG only arrives with that login payload, which lands at OTP-verify or at
// handleRegistrationSuccess(). During a FRESH registration it is therefore still
// absent on onboarding pages 2-3, so a strict `=== '1'` test skips the name/
// gender check for exactly the users it is meant to screen.
//
// So: an explicit value from the server always wins ('0' disables, keeping the
// backend kill-switch intact), and only a genuinely ABSENT flag falls back to
// enabled. Once the session carries AIVFLAG this behaves identically to Angular.
export async function isAiValidationEnabled(): Promise<boolean> {
  const raw = await getSessionValue('AIVFLAG')
  const isAbsent = raw === null || raw === undefined || String(raw).trim() === ''
  return isAbsent ? true : String(raw) === '1'
}

// Angular: validateNameGender() — GET initialfetch?type=AIGENDERVALIDATION…
// Female '0' is sent as 2 (the API's own encoding, not the app's GENDER value).
export async function validateNameGender(name: string, gender: string): Promise<any> {
  const genderVal = (gender === '0' ? 2 : Number(gender)) || 1
  const deviceId  = await getItem('DEVICEID') ?? ''
  const paramStr  = `type=AIGENDERVALIDATION&LANG=en&gender=${genderVal}`
    + `&name=${encodeURIComponent(name)}&DEVICEID=${deviceId}`
  return apiCall(Endpoints.registration.initialFetch, 'GET', paramStr)
}

// Angular: the page-3 validateNameGender() handler. `validation_status` sits
// under NAME.response (falling back to NAME); gender_match and is_neutral are
// siblings under NAMEGENDER.
export function parseNameGenderValidation(res: any): NameGenderValidation {
  const response       = res?.RESPONSE ?? res ?? {}
  const nameValidation = response?.NAME?.response ?? response?.NAME ?? {}
  const nameGender     = response?.NAMEGENDER ?? {}
  return {
    isNameViolated:  [0, 2, '0', '2'].includes(nameValidation?.validation_status),
    isGenderInvalid: nameGender?.gender_match === false || nameGender?.is_neutral === true,
  }
}

// Angular: validateOnboarding2Name() — same payload, but page 2 treats anything
// other than validation_status == 1 as a violation (page 3 only flags 0 and 2),
// and reads `response.response` before the NAME fallbacks.
export function parseNameValidationStrict(res: any): NameGenderValidation {
  const response       = res?.RESPONSE ?? res ?? {}
  const nameValidation = response?.response ?? response?.NAME?.response ?? response?.NAME ?? {}
  const nameGender     = response?.NAMEGENDER ?? {}
  return {
    isNameViolated:  nameValidation?.validation_status != 1,
    isGenderInvalid: nameGender?.gender_match === false || nameGender?.is_neutral === true,
  }
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
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
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

// Fetches "number of children" options from initialfetch API — same
// apiResponse["NOOFCHILDREN"] key Angular's registration.page.ts reads
// (assignArrayData(): this.profileNumberofchild = apiResponse["NOOFCHILDREN"]).
// Raw response is an object {"0":"None","1":"1",...} → converted to array.
export async function fetchNoOfChildrenOptions(): Promise<Array<{ key: string; label: string }>> {
  const ccode    = await getItem(SK.User.COUNTRY_CODE) ?? '91'
  const lang     = await getItem(SK.Auth.LANG) ?? 'en'
  const paramStr = `type=all&ccode=${ccode}&LANG=${lang}`
  const res = await apiCall(Endpoints.registration.initialFetch, 'POST', paramStr)
  const raw = res?.RESPONSE?.NOOFCHILDREN
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
  }
  return []
}

// Reads REGISTRATIONARRAYS from cache (AsyncStorage) or fetches fresh from API and saves.
// Angular stores the full initialfetch response under this key — mirrors that pattern.
// Cache is scoped to the language it was fetched with (REGISTRATIONARRAYS_LANG) so a
// language switch (submitLanguage() in languageService.ts) re-fetches with the new LANG
// instead of silently serving the previous language's data.
export async function getRegistrationArrays(force = false): Promise<Record<string, any>> {
  const lang        = (await getItem(SK.Auth.LANG)) ?? 'en'
  const cachedLang   = await getItem('REGISTRATIONARRAYS_LANG')
  const cached       = await getItem('REGISTRATIONARRAYS')
  // Angular: common.ts's getDynamicPopulateArrayList(hitApi) — hitApi=1 skips
  // the cache entirely and overwrites REGISTRATIONARRAYS with fresh data.
  if (!force && cached && cachedLang === lang) {
    try { return JSON.parse(cached) } catch {}
  }
  const ccode    = await getItem(SK.User.COUNTRY_CODE) ?? '91'
  const paramStr = `type=all&ccode=${ccode}&LANG=${lang}`
  const res = await apiCall(Endpoints.registration.initialFetch, 'POST', paramStr)
  const data = res?.RESPONSE ?? {}
  if (res?.RESPONSE) {
    await setItem('REGISTRATIONARRAYS', JSON.stringify(res.RESPONSE))
    await setItem('REGISTRATIONARRAYS_LANG', lang)
  }
  return data
}

// Angular: common-funtions.ts's check_Paid_Verified_Nophoto() — gates which
// registrationArrays bucket (PHOTOPUBLISHPAID vs PHOTOPUBLISHED) supplies the
// Add Photo page's INTERMEDIATE content. ALL of entryType=='P', ekycStatus=='1',
// gender=='M', PPSETDATA.PI_PHOTOSTATUS in ['P','N','R'], and PAYPFLAG=='1'
// must hold for the paid bucket; otherwise the free bucket is used.
async function isPaidVerifiedNophoto(): Promise<boolean> {
  const [entryType, ekycStatus, gender, ppSet, paidFlag] = await Promise.all([
    getSessionValue('ENTRYTYPE'),
    getItem(SK.Verification.EKYC_STATUS),
    getItem(SK.User.LOGIN_GENDER),
    getJson<Record<string, any>>(SK.App.PP_SET_DATA),
    getItem(SK.Payment.PAY_P_FLAG),
  ])
  const photoStatus = (ppSet as any)?.PI_PHOTOSTATUS ?? ''
  return (
    entryType === 'P' &&
    ekycStatus === '1' &&
    gender === 'M' &&
    ['P', 'N', 'R'].includes(photoStatus) &&
    paidFlag === '1'
  )
}

// Fetches the Add Photo page's dynamic banner copy — Angular:
// add-photo.component.ts's getLanguageContent() reads
// registrationArray = check_Paid_Verified_Nophoto() ? hasArrayData.PHOTOPUBLISHPAID
//                                                    : hasArrayData.PHOTOPUBLISHED
// then add-photo.component.html's promotype==='1' block (the only variant used by
// registration-revamp.component.html, which never binds [promotype]) reads
// INTERMEDIATE.{SUBHEADER, BODY.CONTENT1, BODY.CONTENT2, CTA} off that object.
// All values are server-translated text, so each is run through label() same as
// every other registrationArrays field.
export interface RegistrationIntermediateContent {
  header:    string | null
  subheader: string | null
  content1:  string | null
  content2:  string | null
  cta:       string | null
}

export async function fetchAddPhotoIntermediateContent(): Promise<RegistrationIntermediateContent> {
  const [data, isPaidBucket] = await Promise.all([getRegistrationArrays(), isPaidVerifiedNophoto()])
  const bucket = isPaidBucket ? data?.PHOTOPUBLISHPAID : data?.PHOTOPUBLISHED
  const intermediate = bucket?.INTERMEDIATE
  return {
    // Angular: add-photo.component.ts's bindTitle(INTERMEDIATE) — for the
    // onboarding fromPage (the default branch, neither 'activity' nor
    // 'messages') it returns INTERMEDIATE.HEADER, same server-translated
    // bucket as the rest of this content, not an i18n key.
    header:    intermediate?.HEADER              != null ? label(intermediate.HEADER)             : null,
    subheader: intermediate?.SUBHEADER          != null ? label(intermediate.SUBHEADER)          : null,
    content1:  intermediate?.BODY?.CONTENT1     != null ? label(intermediate.BODY.CONTENT1)      : null,
    content2:  intermediate?.BODY?.CONTENT2     != null ? label(intermediate.BODY.CONTENT2)      : null,
    cta:       intermediate?.CTA                != null ? label(intermediate.CTA)                : null,
  }
}

// Fetches month names from the MONTH key in registrationArrays (server-translated —
// Angular: registration-revamp.component.ts's monthList = FUNC.GetArrayListfrmObj
// (registrationArray['MONTH']), a plain {key: value} object, unsorted). DOBScreen
// previously used a static English MONTHS constant, which is why month names
// never switched language. Falls back to that same static list if the API key is
// ever missing, so the picker is never empty.
export async function fetchMonthOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.MONTH
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
  }
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.KEY ?? item.key ?? ''),
      label: label(item.VALUE ?? item.value ?? ''),
    }))
  }
  return []
}

function dateOrYearToList(raw: any): Array<{ key: string; label: string }> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    // Falls back to the key itself when the value doesn't decode to a usable
    // label (e.g. it's a nested object rather than the flat {key: value} this
    // branch assumes) — years/dates are plain digits, so the key is always a
    // valid label on its own rather than leaving the row blank.
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) || key }))
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => {
        // Confirmed against the live registrationform/v1 API: YEARS arrives as
        // a flat array of raw numbers (e.g. [1956, 1957, ..., 2008]), not
        // objects — so this must be checked before the KEY/VALUE object shape
        // below, otherwise every entry (a bare number has no .KEY/.VALUE)
        // silently resolves to key/label '', rendering as blank, unselectable
        // dropdown rows that all match the empty currentVal and look
        // permanently "selected".
        if (typeof item === 'number' || typeof item === 'string') {
          const key = String(item)
          return { key, label: key }
        }
        // Same {KEY, VALUE} shape as most other option lists in this file, but
        // falls back through the other prefixed key names this API uses
        // elsewhere (MKEY, CKEY, OCCKEY, EDUKEY, ...) in case DATE or some
        // other caller ever arrives under one of those instead of plain KEY.
        const key = String(item.KEY ?? item.key ?? item.YKEY ?? item.DKEY ?? item.YEARKEY ?? item.DATEKEY ?? '')
        const lbl = label(item.VALUE ?? item.value ?? item.LABEL ?? item.label ?? '')
        return { key, label: lbl || key }
      })
      .filter(o => o.key !== '')
  }
  return []
}

// Fetches the day-of-month list from the DATE key in registrationArrays, then
// filters it to the days that exist in the given month/year — same as Angular's
// updateDateList() (registration-revamp.component.ts:861-891), which re-derives
// dateList from registrationArray['DATE'] filtered by daysInMonth on every
// month/year change, rather than generating a fresh 1..31 range client-side.
export async function fetchDateOptions(
  month?: string,
  year?: string,
): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const full = dateOrYearToList(data?.DATE)
  if (full.length === 0) return full

  const m = Number(month)
  if (!m) return full

  let daysInMonth = 31
  if ([4, 6, 9, 11].includes(m)) {
    daysInMonth = 30
  } else if (m === 2) {
    const y = Number(year)
    daysInMonth = y && ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 29 : 28
  }

  return full.filter(o => Number(o.key) <= daysInMonth)
}

// Fetches the birth-year list from the YEARS key in registrationArrays.
// Angular: registration-revamp.component.ts's updateDateLists() (line 844-856)
// — yearList = GetArrayListfrmObj(registrationArray['YEARS']), ordered
// oldest-first, then for GENDER=='1' (male) trims the last 4 entries if the
// gap between now and the newest year is under 21 (male/other minimum age is
// 21, the list's floor is 18).
export async function fetchYearOptions(gender: string): Promise<Array<{ key: string; label: string }>> {
  const data  = await getRegistrationArrays()
  const years = dateOrYearToList(data?.YEARS)
  if (years.length === 0) return years

  if (gender === '1') {
    const newestYear = Number(years[years.length - 1]?.key)
    const yearDif    = new Date().getFullYear() - newestYear
    if (yearDif < 21 && years.length > 4) return years.slice(0, years.length - 4)
  }
  return years
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
        label: label(item.VALUE ?? item.value ?? ''),
      }))
      .filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
  }
  return []
}

// Fetches eating habit options from EATINGHABITS key in registrationArrays.
// Angular: profileEatingHabits = apiResponse["EATINGHABITS"] — plain object {key: label}.
// A parent row plus its children, for the filter's grouped side panels
// (Angular: filter.service.ts's buildParentChild()).
export type OptionGroup = {
  key:     string
  label:   string
  options: Array<{ key: string; label: string }>
}

// Turns either response shape — a {id: name} map or an array of
// {KEY/key/STATEID/CITYID, VALUE/value/STATE/CITY} — into key/label pairs.
function toKeyLabelList(raw: any): Array<{ key: string; label: string }> {
  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => ({
        key:   String(item.key ?? item.KEY ?? item.STATEID ?? item.CITYID ?? ''),
        label: label(item.value ?? item.VALUE ?? item.STATE ?? item.CITY ?? ''),
      }))
      .filter(o => o.key !== '' && o.label !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw)
      .filter(([, value]) => value != null && typeof value !== 'object')
      .map(([key, value]) => ({ key, label: label(value) }))
      .filter(o => o.label !== '')
  }
  return []
}

// States of EVERY given country, grouped under it. Angular asks for all of them
// in one call — `type=state&country=<k1~k2>` (filter-popup.component.ts's
// callAPIPoppulateData) — and the response's STATE is an array PARALLEL to the
// requested countries, which is what buildParentChild()'s `childItems[i]`
// indexes. A flat STATEOBJ carrying a country id is handled too.
export async function fetchStateGroups(
  countries: Array<{ key: string; label: string }>,
): Promise<OptionGroup[]> {
  if (countries.length === 0) return []
  const lang = (await getItem(SK.Auth.LANG)) ?? 'en'
  const keys = countries.map(c => c.key).join('~')
  const res  = await apiCall(
    Endpoints.registration.initialFetch, 'POST',
    `type=state&country=${keys}&state=&LANG=${lang}`,
  )

  const perCountry = res?.RESPONSE?.STATE
  const flat       = res?.RESPONSE?.STATEOBJ

  return countries.map((country, index) => {
    let options = toKeyLabelList(Array.isArray(perCountry) ? perCountry[index] : undefined)
    if (options.length === 0 && Array.isArray(flat)) {
      options = toKeyLabelList(
        flat.filter((s: any) => String(s.COUNTRYID ?? s.COUNTRY ?? s.parentKey ?? '') === country.key),
      )
    }
    // Single country asked for: an unkeyed response is unambiguously its list.
    if (options.length === 0 && countries.length === 1) {
      options = toKeyLabelList(flat ?? (Array.isArray(perCountry) ? perCountry[0] : perCountry))
    }
    return { key: country.key, label: country.label, options }
  })
}

// Districts of EVERY given state, grouped under it — `type=city&state=<s1~s2>`.
// Angular groups these by each city's own STATEID (buildParentChild's CITY
// branch), with the parallel-array shape as the fallback.
export async function fetchCityGroups(
  states: Array<{ key: string; label: string }>,
): Promise<OptionGroup[]> {
  if (states.length === 0) return []
  const lang = (await getItem(SK.Auth.LANG)) ?? 'en'
  const keys = states.map(s => s.key).join('~')
  const res  = await apiCall(
    Endpoints.registration.initialFetch, 'POST',
    `type=city&country=&state=${keys}&LANG=${lang}`,
  )

  const flat     = res?.RESPONSE?.CITYOBJ
  const perState = res?.RESPONSE?.CITY

  return states.map((state, index) => {
    let options: Array<{ key: string; label: string }> = []
    if (Array.isArray(flat)) {
      options = toKeyLabelList(
        flat.filter((c: any) => String(c.STATEID ?? c.stateid ?? c.parentKey ?? '') === state.key),
      )
    }
    if (options.length === 0) {
      options = toKeyLabelList(Array.isArray(perState) ? perState[index] : undefined)
    }
    if (options.length === 0 && states.length === 1) {
      options = toKeyLabelList(flat ?? (Array.isArray(perState) ? perState[0] : perState))
    }
    return { key: state.key, label: state.label, options }
  })
}

// Filter-side country options. Angular's country panel reads
// `filterDataList['COUNTRY']` (filter-popup.component.ts's getArrayData) — the
// initialfetch blob's COUNTRY map, keyed id -> name. COUNTRYLIST is a
// DIFFERENT key: the registration/NRI list of {COUNTRYID, COUNTRY} objects,
// which isn't always present in the cached blob — reading it left the filter's
// country panel empty. COUNTRYLIST stays as a fallback for the shape that has
// it populated, and both shapes are accepted.
export async function fetchFilterCountries(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  for (const raw of [data?.COUNTRY, data?.COUNTRYLIST]) {
    if (Array.isArray(raw)) {
      const items = raw
        .map((item: any) => ({
          key:   String(item.KEY ?? item.key ?? item.COUNTRYID ?? ''),
          label: label(item.VALUE ?? item.value ?? item.COUNTRY ?? ''),
        }))
        .filter(o => o.key !== '' && o.label !== '')
      if (items.length > 0) return items
    } else if (raw && typeof raw === 'object') {
      const items = Object.entries(raw)
        .filter(([, value]) => value != null && typeof value !== 'object')
        .map(([key, value]) => ({ key, label: label(value) }))
        .filter(o => o.label !== '')
      if (items.length > 0) return items
    }
  }
  return []
}

// Filter-side "Profile created" options. Angular reads the SERVER list
// (filter.component.ts's getArrayData('PROFILECREATED') -> filterDataList
// ['PROFILECREATED'], i.e. the initialfetch blob), same as every other filter
// facet. This port previously used four hardcoded English labels with GUESSED
// day-count codes ('7'/'30'/'90'), which the search API can't be expected to
// understand.
export async function fetchProfileCreatedOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.PROFILECREATED
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.KEY   ?? item.key   ?? ''),
      label: label(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
  }
  return []
}

export async function fetchEatingHabitOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.EATINGHABITS
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.KEY   ?? item.key   ?? ''),
      label: label(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
  }
  return []
}

// Fetches the "Is your hometown same as current location?" Yes/No labels
// from the HOMETOWN key in registrationArrays — Angular:
// getArrayList('HOMETOWN', 'HOMETOWN', '46') falls through to
// GetArrayListfrmObj(registrationArray['HOMETOWN']), i.e. the API's own
// {"1":"Yes","2":"No"}-shaped object, not the static GENERAL.YES/GENERAL.NO
// i18n keys (registration-revamp.component.ts:1679).
export async function fetchHomeTownOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.HOMETOWN
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.KEY   ?? item.key   ?? ''),
      label: label(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
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
      label: label(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
  }
  return []
}

export async function fetchSmokingHabitOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.SMOKINGHABITS
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.KEY   ?? item.key   ?? ''),
      label: label(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
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
        label: label(item.VALUE ?? item.value ?? ''),
      })).filter((o: { key: string }) => o.key !== '' && o.key !== '998')
    }
    if (typeof raw === 'object') {
      return Object.entries(raw)
        .filter(([key]) => key !== '998')
        .map(([key, value]) => ({ key, label: label(value) }))
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
        label: label(item.VALUE ?? item.value ?? ''),
      })).filter((o: { key: string }) => o.key !== '')
    }
    if (raw && typeof raw === 'object') {
      return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
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
        label: label(item.VALUE ?? item.value ?? ''),
      })).filter((o: { key: string }) => o.key !== '')
    }
    if (r && typeof r === 'object') {
      return Object.entries(r).map(([key, value]) => ({ key, label: label(value) }))
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

// The Matches header's quick-filter chips, hydrated from the API.
//
// Angular: matches.page.ts's updateQuickFilterList() starts from the static
// filter.config.ts `quickFilterList` skeleton and then overwrites each non-FILTER
// entry from REGISTRATIONARRAYS.QUICKFILTER — the same initialfetch `type=all`
// blob getRegistrationArrays() already caches, fetched with LANG, so the labels
// come back ALREADY LOCALIZED. That is why the template's `| translate` only
// ever resolves the FILTER chip's key: the other three are server strings, not
// i18n keys, and must not be hardcoded on this side.
//
//   QUICKFILTER.<field>.value    -> the chip's label   (`selectedData`)
//   QUICKFILTER.<field>.key      -> the code that means "this chip is on"
//   FILTERSCREEN.<field>['0']    -> label fallback when QUICKFILTER has no value
//
// A field the server omits gets no chip at all, and an empty/absent QUICKFILTER
// drops the whole row — Angular's `if (!isValidparam(quickFilterList)) return`
// leaves the skeleton's untranslated placeholder text on screen instead, which
// is not something worth reproducing.
//
// onValue/offValue encode Angular's two selected-state rules
// (updateQuickFilterList's isSelected block):
//   PROFILECREATED               is on when the stored code EQUALS QUICKFILTER.key
//     — it is an option code ('1' = the "1 Week ago" bucket), not a flag;
//   PHOTOAVAILABLE/HOROSCOPEAVAILABLE are on when it DIFFERS from QUICKFILTER.key
//     — those are booleans whose key is the "off" value ('0').
export async function fetchQuickFilterChips(): Promise<QuickFilterChip[]> {
  const arrays = await getRegistrationArrays()
  const quick  = arrays?.QUICKFILTER
  if (!quick || typeof quick !== 'object' || Object.keys(quick).length === 0) return []
  const screen = arrays?.FILTERSCREEN ?? {}

  return QUICK_FILTER_FIELDS.flatMap((field): QuickFilterChip[] => {
    const entry = quick[field]
    if (!entry) return []

    // `label` here is this file's shared HTML-decoding helper (line 27).
    const text = label(entry.value) || label(screen?.[field]?.['0'])
    if (!text) return []

    const quickKey = String(entry.key ?? '')
    return [{
      key:      field,
      label:    text,
      ...(field === 'PROFILECREATED'
        ? { onValue: quickKey || '1', offValue: '0' }
        : { onValue: '1', offValue: quickKey || '0' }),
    }]
  })
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
      label: label(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
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
      label: label(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
  }
  return []
}

// The Search / Edit-Preferences caste list — the ONE list behind both the Caste
// row and the Division row (Angular: getSearchDataList() maps action 'DIVISION'
// onto searchType 'CASTE', and search.component.ts:100 — "For christian the
// division field is filled from the caste list"). Only the row's LABEL and the
// stored key differ between the two; this is where the options come from.
//
// `type=caste&religion=<key>&mothertongue=<mt>` is religion-scoped, verified
// against the API:
//   religion=1  -> that mother tongue's Hindu castes
//   religion=2  -> the Christian divisions (Roman Catholic, CSI, Protestant, …)
//   religion=1~2-> {} — the endpoint does NOT accept a '~' list here
//   mothertongue=0 or empty -> {} for ANY religion, so the member's own mother
//     tongue is mandatory, not cosmetic
// so a multi-religion selection is fetched one call per religion and merged,
// which is what makes Hindu+Christian list every caste AND every division in
// the single panel titled "Caste".
//
// Angular sends an extra `page=search` on this call. That flag makes the
// endpoint ignore `religion` and `mothertongue` entirely and answer with the
// master list of every caste and division across all religions — so Angular's
// Christian member opens "Division" onto Hindu castes. Dropped deliberately:
// the requirement is a religion-scoped list per selection, and the merge above
// already produces the combined list for the one case that wants it.
//
// Deliberately NOT fetchCasteOptions(): that one short-circuits on the
// REGISTRATIONARRAYS.CASTE blob, the list for the member's OWN religion
// captured during registration, so the filter kept showing that list whatever
// religion the member picked. Here it is always fetched fresh — Angular
// likewise refetches on every religion change rather than caching.
export async function fetchSearchCasteOptions(
  religion: string,
): Promise<Array<{ key: string; label: string }>> {
  // Accepts one key or Angular's '~'-joined selection; '0' is "Any", which has
  // no caste list of its own.
  const religionKeys = religion.split('~').filter(k => k && k !== '0')
  if (religionKeys.length === 0) return []

  const lang = (await getItem(SK.Auth.LANG)) ?? 'en'
  // The MEMBER'S OWN mother tongue — search.component.ts:368 and
  // filter-popup.component.ts:215 both read `localStorage['MOTHERTONGUE'] ||
  // '47'`. The partner-preference MOTHERTONGUE selection is a different value
  // and is '0' until the member sets one, which the endpoint answers with an
  // empty list. ('MOTHERTONGUE' is the key actually populated here; the
  // misspelled 'MOTHERTOUNGE' is the fallback, the order languageService uses.)
  const mothertongue = (await getItem('MOTHERTONGUE'))
    ?? (await getItem(SK.User.MOTHER_TONGUE))
    ?? '47'

  const toList = (raw: any): Array<{ key: string; label: string }> => {
    if (Array.isArray(raw)) {
      // An array of single-entry hashes — Angular folds it into one object
      // (`Object.assign({}, acc, item)` per item); { KEY, VALUE } entries are
      // handled too, as elsewhere in this file.
      return raw.flatMap((item: any) => (
        item && typeof item === 'object' && !('KEY' in item || 'key' in item)
          ? Object.entries(item).map(([key, value]) => ({ key, label: label(value) }))
          : [{ key: String(item?.KEY ?? item?.key ?? ''), label: label(item?.VALUE ?? item?.value ?? '') }]
      )).filter(o => o.key !== '')
    }
    if (raw && typeof raw === 'object') {
      return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
    }
    return []
  }

  const lists = await Promise.all(religionKeys.map(async key => {
    const paramStr = `type=caste&religion=${key}&mothertongue=${mothertongue}&LANG=${lang}`
    const res      = await apiCall(Endpoints.registration.initialFetch, 'POST', paramStr)
    return toList(res?.RESPONSE?.CASTE ?? res?.CASTE)
  }))

  // Merge in selection order, first occurrence wins — the religions overlap on
  // shared codes, and a duplicate key would render as two identical rows the
  // picker can't tell apart. The sentinel codes go too: Angular's
  // getSearchDataList() pushes an option only when its key is absent from that
  // same list, so "Caste no bar" (998) and "Others" (999) are not panel rows.
  const seen = new Set<string>()
  return lists.flat().filter(o =>
    !NON_SELECTABLE_OPTION_KEYS.has(o.key) && (seen.has(o.key) ? false : (seen.add(o.key), true)))
}
// Fetches monthly income options from REGISTRATIONARRAYS.MONTHLYINCOME
// Angular: apiResponse["MONTHLYINCOME"] → array of { CKEY, VALUE }
// The FILTER's income-bracket panel. Angular reads a different list here than
// the one a member picks their own income from: getSearchDataList()'s
// `itemList = this.filterDataList['MONTHLYINCOMERANGE']` for MONTHLYINCOME,
// where the registration/edit screens use MONTHLYINCOME. Falls back to
// MONTHLYINCOME so the panel is never empty if the RANGE key is absent.
export async function fetchIncomeRangeOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  for (const raw of [data?.MONTHLYINCOMERANGE, data?.MONTHLYINCOME]) {
    if (Array.isArray(raw)) {
      const items = raw
        .map((item: any) => ({
          key:   String(item.CKEY ?? item.key ?? item.KEY ?? ''),
          label: label(item.VALUE ?? item.value ?? ''),
        }))
        .filter(o => o.key !== '' && o.label !== '')
      if (items.length > 0) return items
    } else if (raw && typeof raw === 'object') {
      const items = Object.entries(raw)
        .filter(([, value]) => value != null && typeof value !== 'object')
        .map(([key, value]) => ({ key, label: label(value) }))
        .filter(o => o.label !== '')
      if (items.length > 0) return items
    }
  }
  return []
}

export async function fetchMonthlyIncomeOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = data?.MONTHLYINCOME
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      key:   String(item.CKEY  ?? item.key   ?? ''),
      label: label(item.VALUE ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
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
        label: label(item.VALUE ?? item.value ?? ''),
      })).filter((o: { key: string }) => o.key !== '')
    }
    if (raw && typeof raw === 'object') {
      return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
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
      label: label(item.VALUE  ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
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
      label: label(item.VALUE  ?? item.value ?? ''),
    })).filter(o => o.key !== '')
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
  }
  return []
}

// ─── Education Group / Job Detail (JODII-490 equivalent) ─────────────────────
// Angular: registration-revamp.component.ts's isEduDetailEligible()/
// isJobDetailEligible() (registration.config.ts's EDU_DETAIL_KEYS = ['1','2'],
// JOB_DETAIL_HIDE_OCCUPATION = '8'). These are server-driven option codes, not
// client constants — assumed identical here since RN and Angular hit the same
// backend; re-verify against a live qualification/occupation options list if
// they ever diverge.
const EDU_DETAIL_QUALIFICATION_KEYS = ['1', '2']
const JOB_DETAIL_HIDE_OCCUPATION_KEY = '8'

export function isEducationGroupEligible(qualification: string): boolean {
  return EDU_DETAIL_QUALIFICATION_KEYS.includes(String(qualification ?? ''))
}

export function isJobDetailEligible(occupation: string): boolean {
  const occ = String(occupation ?? '')
  return occ !== '' && occ !== JOB_DETAIL_HIDE_OCCUPATION_KEY
}

// Angular: registration-revamp.component.ts's buildEducationDetailGroups()/
// common-funtions.ts's getArrayObj() read REGISTRATIONARRAYS.EDUCATIONDETAILS
// — raw { MASTER: {catKey: {eduKey: label}}, BACHELOR: {...}, COMMON: {...} }
// — plus REGISTRATIONARRAYS.EDUCATIONCATEGORY — { <qualification>: {catKey:
// catTitle} } — both already present in the same type=all bootstrap this file
// caches everywhere else, so (unlike Subcaste) this needs no dedicated network
// call. Returns one section per EDUCATIONCATEGORY entry (e.g. "Engineering/
// Computers", "Arts/Science/Commerce", "Management"), qualification-specific
// group first then the always-appended COMMON group — same order as Angular's
// [...getArrayObj(groupForQual), ...getArrayObj(commonGroup)].
export type EducationGroupSection = {
  title:   string | null
  options: Array<{ key: string; label: string }>
}

export async function fetchEducationGroupOptions(
  qualification: string,
): Promise<EducationGroupSection[]> {
  const data = await getRegistrationArrays()
  const raw  = data?.EDUCATIONDETAILS
  if (!raw || typeof raw !== 'object') return []

  const categoryMap = data?.EDUCATIONCATEGORY?.[qualification] ?? {}

  // Angular: getArrayObj(obj, contObj) — one section per top-level key of
  // `obj` (a category key → its degree map), titled from contObj[catKey].
  const toSections = (grouped: any): EducationGroupSection[] => {
    if (!grouped || typeof grouped !== 'object') return []
    return Object.entries(grouped)
      .filter(([, degrees]) => degrees && typeof degrees === 'object')
      .map(([catKey, degrees]) => ({
        title:   categoryMap[catKey] != null ? label(categoryMap[catKey]) : null,
        options: Object.entries(degrees as Record<string, string>)
          .map(([key, value]) => ({ key, label: label(value) }))
          .filter(o => o.key !== ''),
      }))
  }

  const groupKey = qualification === '1' ? 'MASTER' : qualification === '2' ? 'BACHELOR' : null
  const sections = [
    ...(groupKey ? toSections(raw[groupKey]) : []),
    ...toSections(raw['COMMON']),
  ].filter(s => s.options.length > 0)

  return sections
}

// Flat convenience wrapper over fetchEducationGroupOptions() — used wherever
// a single flat list is enough (e.g. resolving a saved EDUGROUP key's label).
export async function fetchEducationGroupOptionsFlat(
  qualification: string,
): Promise<Array<{ key: string; label: string }>> {
  const sections = await fetchEducationGroupOptions(qualification)
  return sections.flatMap(s => s.options)
}

// Saves or clears EDUGROUP/JOBDETAIL against the live profile.
// Angular: registration.service.ts's updateRegProfileInfo(fieldName, value) →
// POST registration/updprofileinfo/v1 (ID + <fieldKey>=<value>). The response
// carries OCCDETAILSVALID for JOBDETAIL saves ('1' = accepted, anything else =
// rejected); no equivalent flag exists for EDUGROUP saves anywhere in the
// Angular source, so an absent flag is treated as accepted for both fields —
// matches Angular's actual (not necessarily intentional) behavior.
export type FewMoreDetailFieldKey = 'EDUDETAILS' | 'OCCDETAILS'

export async function updateFewMoreDetail(
  fieldKey: FewMoreDetailFieldKey,
  value: string,
): Promise<{ valid: boolean }> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const res = await apiCall(
    Endpoints.registration.updateProfileInfo,
    'POST',
    `ID=${userId}&${fieldKey}=${encodeURIComponent(value)}`,
  )
  const validFlag = res?.RESPONSE?.OCCDETAILSVALID ?? res?.OCCDETAILSVALID
  const valid = validFlag === undefined || validFlag === null || String(validFlag) === '1'
  return { valid }
}

// Job Detail free-text format check.
// Angular: registration-revamp.component.ts's initializeForm() — the shared
// 'name' FormControl (JOBDETAIL reuses TYPE=2's control) is built with
// Validators.required + Validators.minLength(2) + a pattern, but Next is
// actually gated by the extra custom validator symbolsOnlyAllowDotComma()
// (registration-functions.ts), which returns an error until
// control.value.trim().length >= 3 — a stricter floor than minLength(2), and
// the one that wins. The <ion-input minlength="3"> HTML attribute matches
// this real behavior. Empty string is always valid here since the RN screen
// treats the field as optional (skippable via SHOWSKIPBTN, unlike Angular's
// `required` which would otherwise block Next on an empty, untouched field
// too).
export function isValidJobDetailFormat(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return true
  if (trimmed.length < 3) return false
  return /^[\p{L}\p{M}\s.,]*$/u.test(value)
}

// Fetches height CATEGORY options (Below average / Average / Above average / Tall).
// The live API's VALUE actually carries the subtitle wrapped in an HTML tag —
// e.g. `Below average <div class="height-revamp-text-small mt-4 opacity-6"
// slot="end"> Shorter than 5 feet 3 Inches</div>` — which HeightScreen's
// parseCategoryLabel() splits on. Decode entities only (not stripAndDecodeHtml's
// label()) so that tag survives for parseCategoryLabel to find; stripping it
// here would collapse label+subtitle into one plain-text line with no split.
export async function fetchHeightCategoryOptions(
  gender: string,
): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  const raw  = gender === '0' ? data?.NEWHEIGHTFEMALE : data?.NEWHEIGHTMALE
  const toEntry = (key: string, rawLabel: string) => ({
    key,
    label: decodeEntities(rawLabel),
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

export type HeightGroup = {
  title: string
  data:  Array<{ key: string; label: string }>
}

// Fetches exact heights grouped for the side panel SectionList.
// Angular (registration-revamp.component.ts:660-664): reads
// registrationArray['NEWHEIGHT']['Male'|'Female'], grouped via FUNC.getArrayObj()
// (common-funtions.ts:162-176) — each group's title comes from the parallel
// registrationArray['NEWHEIGHT']['Content'] map keyed the same way, and each
// group's values are a plain {key: label} object (label already includes ft/cm).
export async function fetchExactHeightGrouped(gender: string): Promise<HeightGroup[]> {
  const data    = await getRegistrationArrays()
  const root    = data?.NEWHEIGHT
  const grouped = gender === '0' ? root?.Female : root?.Male
  const content = root?.Content
  if (!grouped || typeof grouped !== 'object') return []

  const result: HeightGroup[] = []
  Object.entries(grouped).forEach(([groupKey, group]) => {
    if (!group || typeof group !== 'object') return
    const items: Array<{ key: string; label: string }> = []
    if (Array.isArray(group)) {
      group.forEach((item: any) => {
        const key = String(item.KEY ?? item.key ?? '')
        if (key) items.push({ key, label: label(item.VALUE ?? item.value) })
      })
    } else {
      Object.entries(group).forEach(([key, value]) => {
        if (key) items.push({ key, label: label(value) })
      })
    }
    if (items.length) {
      result.push({ title: label(content?.[groupKey] ?? groupKey), data: items })
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
      .map((s: any) => ({ key: String(s.STATEID ?? s.key ?? ''), label: label(s.STATE ?? s.value ?? '') }))
      .filter(o => o.key !== '')
  }

  // Secondary: STATE key in REGISTRATIONARRAYS (from type=all)
  if (items.length === 0) {
    const stateRaw = arrays?.STATE
    if (Array.isArray(stateRaw) && stateRaw.length > 0) {
      items = stateRaw
        .map((s: any) => ({ key: String(s.STATEID ?? ''), label: label(s.STATE ?? '') }))
        .filter(o => o.key !== '')
    } else if (stateRaw && typeof stateRaw === 'object') {
      items = Object.entries(stateRaw).map(([key, value]) => ({ key, label: label(value) }))
    }
  }

  // Fallback: direct API call type=state&country=98 (covers edge cases)
  if (items.length === 0) {
    const lang  = (await getItem(SK.Auth.LANG)) ?? 'en'
    const res   = await apiCall(Endpoints.registration.initialFetch, 'POST', `type=state&country=98&state=&LANG=${lang}`)
    const rawArr = res?.RESPONSE?.STATEOBJ
    const rawObj = res?.RESPONSE?.STATE?.[0]
    if (Array.isArray(rawArr) && rawArr.length > 0) {
      items = rawArr.map((s: any) => ({ key: String(s.STATEID ?? ''), label: label(s.STATE ?? '') })).filter(o => o.key !== '')
    } else if (rawObj && typeof rawObj === 'object') {
      items = Object.entries(rawObj).map(([key, value]) => ({ key, label: label(value) }))
    }
  }

  // NOTE: no alphabetical sort here — Angular's loadStateList() (common.ts)
  // stores the server response verbatim. The server's
  // type=MOTHERTONGUE&MOTHERTONGUE=<key> response already returns the
  // relevant state first (e.g. Bihar for Angika, Tamil Nadu for Tamil), and
  // a .sort() here was clobbering that ordering (QA #39, #55).
  return items
}

// Country list for NRI flow — Angular caches this as COUNTRYLIST inside the shared
// type=all bootstrap response (same call getRegistrationArrays() already makes/caches).
export async function fetchCountries(): Promise<Array<{ key: string; label: string }>> {
  const arrays = await getRegistrationArrays()

  const raw = arrays?.COUNTRYLIST
  let items: Array<{ key: string; label: string }> = []

  if (Array.isArray(raw) && raw.length > 0) {
    items = raw
      .map((c: any) => ({ key: String(c.COUNTRYID ?? c.key ?? ''), label: label(c.COUNTRY ?? c.value ?? '') }))
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
    items = rawArr.map((s: any) => ({ key: String(s.STATEID ?? ''), label: label(s.STATE ?? '') })).filter(o => o.key !== '')
  } else if (rawObj && typeof rawObj === 'object') {
    items = Object.entries(rawObj).map(([key, value]) => ({ key, label: label(value) }))
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
        label: label(c.value ?? c.CITY   ?? c.city   ?? ''),
      }))
      .filter(o => o.key !== '')
  } else if (rawObj && typeof rawObj === 'object') {
    items = Object.entries(rawObj).map(([key, value]) => ({ key, label: label(value) }))
  }

  return items
}

// Angular: core/config/registration.config.ts's homeTownDomain — the mother
// tongues for which a separate home town is asked. Used as the fallback when
// REGISTRATIONARRAYS.NATIVEPLACEDOMAIN isn't present.
const HOME_TOWN_DOMAIN = ['2', '14', '17', '41', '4', '51']

// The resolved domain list. Angular reads it two ways that come to the same
// thing — edit-profile.page.ts:389 `registrationArray['NATIVEPLACEDOMAIN'] ? …
// : homePlaceDomain`, and registration.service.ts:734 which additionally
// requires a non-empty array. The non-empty check is kept here so a server
// sending `[]` falls back rather than hiding the field for everyone.
//
// Exported as a list, not just a predicate, because the screens where mother
// tongue is editable have to re-evaluate visibility against the live selection
// on every render — an async per-key check can't do that.
export async function fetchHomeTownDomain(): Promise<string[]> {
  const arrays = await getRegistrationArrays()
  return Array.isArray(arrays?.NATIVEPLACEDOMAIN) && arrays.NATIVEPLACEDOMAIN.length
    ? arrays.NATIVEPLACEDOMAIN.map(String)
    : HOME_TOWN_DOMAIN
}

// Angular: isHomeTownVisible() — (homeTownDomain || []).includes(motherTongueKey).
// Used by the validation follow-up sheets to decide whether to ask
// "Is your home town same as current location?" for the chosen mother tongue,
// and by edit-profile to decide whether the Native place / Hometown city
// fields exist at all for this member.
export async function isHomeTownMotherTongue(motherTongueKey: string): Promise<boolean> {
  if (!motherTongueKey) return false
  const domain = await fetchHomeTownDomain()
  return domain.includes(String(motherTongueKey))
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
    : HOME_TOWN_DOMAIN
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

  // Angular registration.service.ts:1521-1533 — the login response's RATING /
  // RATINGDATE are stored under DIFFERENT key names (APPRATINGVALUE /
  // APPRATINGDATE), and TIMECREATED is stored verbatim. All three are flat
  // localStorage keys in Angular because app-rating.service.ts reads them with
  // a raw localStorage.getItem(), not through the session blob — kept flat here
  // for the same reason (appRatingService.ts reads them the same way).
  // Without these the rating gate had no inputs at all: APPRATINGVALUE always
  // read '0' and TIMECREATED was never set, so the "account is 14+ days old"
  // and "already rated 4-5, never ask again" rules could never fire.
  //
  // NOTE: Angular passes RATINGDATE through common.getStorageValuebyKey(), which
  // does localStorage.getItem(<the date string>) — i.e. it looks the date up as
  // if it were a KEY and therefore always yields ''. That is a bug, and
  // reproducing it would permanently disable the 30-day re-ask branch for users
  // who rated 1-3. The real date is stored here instead.
  if (data.RATING !== undefined)      ops.push(setItem(SK.Rating.RATING_VALUE, String(data.RATING)))
  if (data.RATINGDATE !== undefined)  ops.push(setItem(SK.Rating.RATING_DATE,  String(data.RATINGDATE)))
  if (data.TIMECREATED !== undefined) ops.push(setItem(SK.User.TIME_CREATED,   String(data.TIMECREATED)))

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
    // Angular: shared/config.ts's localvalueArr — WAPHOTOFLAG gates the
    // WhatsApp photo-request nudge (common-funtions.ts's whatsAppPhotoFlag()),
    // also missing from this list until now — without it, Home's photo-request
    // overlay had no server-driven eligibility signal to read at all.
    'WAPHOTOFLAG',
    // Angular: shared/config.ts's localvalueArr — matches.page.ts's
    // checkIncomeSheet() reads this to decide whether to prompt an
    // income-not-specified user, also missing from this list until now.
    'INCOME',
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
        label: label(item.VALUE ?? item.value ?? item.LABEL ?? item.label ?? ''),
      }))
      .filter(o => o.key)
  }
  if (typeof raw === 'object') {
    return Object.entries(raw).map(([key, value]) => ({ key, label: label(value) }))
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
// Angular (registration-revamp.component.ts's getRegistrationDynamicArray() →
// common.ts's getDynamicPopulateArrayList()): BOTH RAASI and STAR come from
// the SAME shared type=all/LANG=<lang> bootstrap cache as BOTHER/SISTER/ASSETS/
// DOSHAM (registrationArray['RAASI'] / registrationArray['STAR'], read directly,
// component.ts ~744) — NOT from a separate zodiacinfo or type=raasi/type=stars
// call. Angular's STAR list is also never filtered by the selected raasi: the
// one place a raasi-scoped `type=stars&RAASIID=` call exists (getStarDetail(),
// component.ts:3932) always sends RAASIID blank (fetches the full unfiltered
// list) and only runs once, after horoscope generation succeeds — not as part
// of normal raasi→star selection. A previous version of this file called
// zodiacinfo/v1 (blank STAR/RAASI/DOSHAM) for raasi and a raasi-filtered
// `type=stars&RAASIID=X` call for star — both diverged from Angular's actual
// source and behavior; fixed to mirror getRegistrationArrays()'s shared cache
// exactly, same as fetchFamilyOptions/fetchPropertyOptions/fetchDoshamOptions.

export async function fetchRaasiOptions(): Promise<Array<{ key: string; label: string }>> {
  const data = await getRegistrationArrays()
  return objToOptions(data?.RAASI)
}

// `_raasiId` is accepted but intentionally unused — kept only so every
// existing caller (Edit Profile screens, Search filters, StarRaasiScreen)
// compiles unchanged. Angular never actually filters STAR by raasi (see
// header comment above), so a raasi-scoped signature would misrepresent the
// real behavior even though it's harmless to keep passing one in.
// Angular: initialfetch `type=stars&RAASIID=<raasi>` (api-params-functions.ts's
// stars case / registration.page.ts's getStarDetail) returns just that raasi's
// stars, while `RAASIID=` with no id returns ALL of them — and that all-stars
// answer is exactly what gets written into the blob's STAR key
// (registration-revamp's getStarDetail). So reading the blob for a specific
// raasi handed back all 27 stars: the raasi argument was accepted and ignored.
export async function fetchStarOptions(raasiId?: string): Promise<Array<{ key: string; label: string }>> {
  if (raasiId && raasiId !== '0') {
    const lang = (await getItem(SK.Auth.LANG)) ?? 'en'
    const res  = await apiCall(
      Endpoints.registration.initialFetch, 'POST',
      `type=stars&RAASIID=${raasiId}&LANG=${lang}`,
    )
    const opts = objToOptions(res?.RESPONSE?.STAR ?? res?.RESPONSE)
    // Angular falls back to the already-loaded list when the call fails.
    if (opts.length > 0) return opts
  }
  const data = await getRegistrationArrays()
  return objToOptions(data?.STAR)
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
    label:     label(c.DISTRICT ?? ''),
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

// Angular: Filehandler.openFilePicker('uploadhoroscope', matriId, 'UPLOADPHOTO',
// 'image/*', false) → httpservice.uploadData(), a plain multipart POST to
// nbphoto/uploadhoroscope.php (ID + UPLOADPHOTO). On success, uploadHoroSuccess()
// (registration-revamp.component.ts) sets HOROSCOPEAVAILABLE=1 and moves on —
// mirrored here by flipping the same SK.Profile.HOROSCOPE_AVAILABLE flag
// generateHoroscope() already reads/writes, rather than a second unused key.
export async function uploadHoroscopeFile(fileUri: string): Promise<boolean> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const filename = fileUri.split('/').pop() ?? 'horoscope.jpg'
  const ext      = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
  const mimeType = ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg'

  const formData = new FormData()
  formData.append('ID', userId)
  formData.append('UPLOADPHOTO', { uri: fileUri, name: filename, type: mimeType } as any)

  const res = await uploadFile(Endpoints.media.uploadHoroscope, formData)
  const ok  = res?.RESPONSECODE == 1 || res?.RESPONSECODE == '1'
  if (ok) await setItem(SK.Profile.HOROSCOPE_AVAILABLE, '1')
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

export async function submitFullRegistration(): Promise<{
  matriId?: string
  responsecode?: string
  /** Angular: RESPONSE.AIVALIDATIONTYPE — '1' proceed, '2' confirm sheet, '3' under review. */
  aiValidationType?: string
  /** Angular: RESPONSE.VIOLATIONFIELD — the fields the AI flagged. */
  violationFields?: string[]
}> {
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
    // Angular: callRegistrationAPIFunc()'s updateHeight — HEIGHTCATEGORY, then
    // HEIGHT, then '102' (Average) as the last-resort default.
    `Height=${resolveHeightParam(rv, '102')}`,
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

  // Angular: callInsertApiAndHandleValidation() reads AIVALIDATIONTYPE and
  // VIOLATIONFIELD straight off the INSERT response — no separate
  // aiprfvalidation call happens at this point in the flow.
  const result: {
    matriId?: string; responsecode?: string
    aiValidationType?: string; violationFields?: string[]
  } = {
    responsecode:     String(res?.RESPONSECODE ?? ''),
    aiValidationType: String(res?.RESPONSE?.AIVALIDATIONTYPE ?? '1'),
    violationFields:  mapViolationFields(res?.RESPONSE?.VIOLATIONFIELD),
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

// ─── Height param ─────────────────────────────────────────────────────────────
// Angular sends ONE `Height` param carrying either the banded HEIGHTCATEGORY
// (101-104, the "Below average / Average / Above average / Tall" rows) or the
// exact HEIGHT key — whichever the member picked:
//
//   registration.page.ts:7629 (sendPartialRegistrationData)
//     partialRegHeight = isValidparam(HEIGHTCATEGORY) ? HEIGHTCATEGORY
//                      : isValidparam(HEIGHT)         ? HEIGHT : ''
//   registration.page.ts:6465 (callRegistrationAPIFunc) — same order, but
//     falls back to '102' (Average) instead of ''.
//   form-fields.component.ts:1345 carries its own identical copy.
//
// HeightScreen.tsx writes exactly one of the two and blanks the other, so
// reading rv.HEIGHT alone sent `Height=` empty for every banded answer — the
// selection never reached the server.
//
// `isValidparam(x)` (type 1) and `!isValidparam(x, 3)` are the same predicate:
// '0' and '-' count as unset, not just ''/null/undefined.
function resolveHeightParam(rv: Record<string, string>, fallback = ''): string {
  const isSet = (v: unknown) =>
    v !== undefined && v !== null && v !== '' && v !== '-' &&
    v !== '0' && v !== 'undefined' && v !== 'null'
  if (isSet(rv.HEIGHTCATEGORY)) return rv.HEIGHTCATEGORY
  if (isSet(rv.HEIGHT))         return rv.HEIGHT
  return fallback
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
    // Angular: sendPartialRegistrationData()'s partialRegHeight — HEIGHTCATEGORY,
    // then HEIGHT, then empty.
    `Height=${resolveHeightParam(rv)}`,
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
    // FLAGGED, deliberately NOT given the HEIGHTCATEGORY fallback above: Angular's
    // own aiprofilevalidation branch (core/functions/api-params-functions.ts:194)
    // sends the bare registrationValues["HEIGHT"], unlike its registration and
    // partial-registration payloads. Kept at parity rather than "fixed".
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

// ─── Post-insert AI validation routing ────────────────────────────────────────
// Angular: registration-revamp.component.ts's callInsertApiAndHandleValidation().
// The insert response's AIVALIDATIONTYPE decides what the member sees next:
//   '1' → nothing special, show the normal success sheet
//   '2' → the confirm sheet listing the flagged fields (ValidationScreen)
//   '3' → the "profile under review" screen, then complete
// When AIVFLAG is off Angular skips the branching entirely and completes.
// A type-'2' violation limited to NON-editable fields (e.g. NAME) would render
// an empty confirm screen, so that case completes instead — Angular's
// hasEditableConfirm2Fields() guard.

export type PostInsertAction = 'success' | 'confirm' | 'underReview'

export async function resolvePostInsertAction(
  aiValidationType: string | undefined,
  violationFields: string[] | undefined,
): Promise<PostInsertAction> {
  const type = String(aiValidationType ?? '1')

  // Angular checks the flag FIRST: with AIVFLAG off, every type completes.
  if (!(await isAiValidationEnabled())) return 'success'

  if (type === '2') {
    const hasEditable = (violationFields ?? []).some(f => CONFIRM2_EDITABLE_VIOLATION_FIELDS.includes(f))
    return hasEditable ? 'confirm' : 'success'
  }
  if (type === '3') return 'underReview'
  return 'success'
}

