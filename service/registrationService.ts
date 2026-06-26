// Registration service — migrated from Angular registration.service.ts (971 lines).
// Critical: storeWebURLData parses the WEBVIEWURL login payload that the backend
// embeds user session data in. The URL format is:
//   https://...#/login/<JSON_BASE64>/2
// In RN we call this same API and parse the same payload — no WebView needed.

import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { navigate } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'
import { setAppsFlyerUserId } from './analyticsService'

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
  const params = `ID=${userId}&TYPE=autologin`
  const result = await apiCall(Endpoints.auth.autoLogin, 'POST', params)

  if (result?.RESPONSECODE != 1 || result?.ERRCODE != 0) return

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
  const ccode   = await getItem(SK.User.COUNTRY_CODE) ?? '91'
  const lang    = await getItem(SK.Auth.LANG) ?? 'en'
  const apptype = await getItem(SK.Auth.APP_TYPE) ?? '115'
  const paramStr = `type=all&ccode=${ccode}&LANG=${lang}&APPTYPE=${apptype}`
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
  const ccode   = await getItem(SK.User.COUNTRY_CODE) ?? '91'
  const lang    = await getItem(SK.Auth.LANG) ?? 'en'
  const apptype = await getItem(SK.Auth.APP_TYPE) ?? '115'
  const paramStr = `type=all&ccode=${ccode}&LANG=${lang}&APPTYPE=${apptype}`
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
  const ccode   = await getItem(SK.User.COUNTRY_CODE) ?? '91'
  const lang    = await getItem(SK.Auth.LANG) ?? 'en'
  const apptype = await getItem(SK.Auth.APP_TYPE) ?? '115'
  const paramStr = `type=all&ccode=${ccode}&LANG=${lang}&APPTYPE=${apptype}`
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
async function getRegistrationArrays(): Promise<Record<string, any>> {
  const cached = await getItem('REGISTRATIONARRAYS')
  if (cached) {
    try { return JSON.parse(cached) } catch {}
  }
  const ccode   = await getItem(SK.User.COUNTRY_CODE) ?? '91'
  const lang    = await getItem(SK.Auth.LANG) ?? 'en'
  const apptype = await getItem(SK.Auth.APP_TYPE) ?? '115'
  const paramStr = `type=all&ccode=${ccode}&LANG=${lang}&APPTYPE=${apptype}`
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

export async function storeWebURLData(data: Record<string, any>): Promise<void> {
  const ops: Promise<void>[] = []

  if (data.ATN)              ops.push(setItem(SK.Auth.TOKEN,              data.ATN))
  if (data.RTN)              ops.push(setItem(SK.Auth.REFRESH_TOKEN,      data.RTN))
  if (data.MATRIID)          ops.push(setItem(SK.Auth.USER_ID,            String(data.MATRIID)))
  if (data.GENDER)           ops.push(setItem(SK.User.LOGIN_GENDER,       data.GENDER))
  if (data.CCODE) {
    ops.push(setItem('CCODE',                 data.CCODE))
    ops.push(setItem(SK.User.MEMBER_CODE,     data.CCODE))
  }
  if (data.MEMBERSHIPTYPE)   ops.push(setItem(SK.Auth.ENTRY_TYPE,         data.MEMBERSHIPTYPE))
  if (data.MOTHERTOUNGE) {
    ops.push(setItem('MOTHERTOUNGE',     data.MOTHERTOUNGE))
    ops.push(setItem('MOTHERTONGUE',     data.MOTHERTOUNGE))
  }
  if (data.FEMALEFREECONACT) ops.push(setItem(SK.Promotions.FEMALE_FREE_CONTACT, JSON.stringify(data.FEMALEFREECONACT)))
  if (data.PAYMENTWALL)      ops.push(setItem(SK.Payment.PAYMENT_WALL,    JSON.stringify(data.PAYMENTWALL)))
  if (data['S&FPROMOTION'])  ops.push(setItem(SK.Promotions.SF_PROMOTION, JSON.stringify(data['S&FPROMOTION'])))
  if (data.NONIDVUTYPE)      ops.push(setItem('NONIDVUTYPE',              JSON.stringify(data.NONIDVUTYPE)))
  if (data.PHOTOSTATUSARRAY) ops.push(setItem('PHOTOSTATUSARRAY',         JSON.stringify(data.PHOTOSTATUSARRAY)))

  // Use !== undefined so falsy values (0, "") are still written — matches Angular behaviour
  const SCALAR_KEYS = [
    'RENEWALENABLEKEY', 'PAYRENEWALFLAG', 'PAYMENTPACKAGE', 'NEWPPCALL', 'APPVERSION',
    // Profile data
    'NAME', 'PHOTOURL', 'LOGINCOUNT', 'DATEOFBIRTH', 'CREATEDBY', 'RELIGIONKEY',
    'PHONEVERIFIED', 'LASTLOGIN', 'FREETRAILVALIDDAY', 'RENEWALDAY',
    // Flags (stored as "0"/"1" strings — same as Angular localStorage)
    'NALLOW', 'FEMALEFREEPROMO', 'PROFILEPUBLISHEDFLAG', 'PROFILEPUBLISHEDTYPE',
    'PAYPROMO', 'PROFILEVERIFIED', 'DEFERREDIDUSER', 'LOGINTYPE', 'NRIWHATSAPP',
    'IPCOUNTRYCODE', 'AIVFLAG', 'SHORTLISTENABLE', 'SURVEYPOPUP',
    'GLASSBOXFLAG', 'UPIFLAG', 'RPAYFLAG', 'DRNEXT',
  ]
  SCALAR_KEYS.forEach(k => { if (data[k] !== undefined) ops.push(setItem(k, String(data[k]))) })

  await Promise.all(ops)

  // AppsFlyer user ID binding (once ATN is stored)
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

// ─── Registration update ──────────────────────────────────────────────────────

export async function callRegistrationAPI(params: Record<string, any>): Promise<any> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const paramStr = `ID=${userId}&` + Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
  return apiCall(Endpoints.registration.update, 'POST', paramStr)
}

export async function callPartialRegistrationAPI(params: Record<string, any>): Promise<any> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const paramStr = `ID=${userId}&` + Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
  return apiCall(Endpoints.registration.partialUpdate, 'POST', paramStr)
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
