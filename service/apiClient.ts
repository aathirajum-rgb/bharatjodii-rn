import axios, { AxiosRequestConfig } from 'axios'
import { getItem, setItem, getMultiple, setMultiple, removeMultiple } from './storageService'
import { StorageKeys } from '../constants/storage.keys'
import { AUTH_ONLY_ENDPOINTS, APPTYPE_ONLY_ENDPOINTS, MEDIA_ENDPOINTS, Endpoints } from './api.endpoints'

// ─────────────────────────────────────────────────────────────
//  LOGOUT CALLBACK
//  AuthProvider registers this so ERRCODE 23 can flip the
//  navigation stack to AuthStack without importing React here.
// ─────────────────────────────────────────────────────────────

let _onLogout: (() => void) | null = null

export function registerLogoutCallback(fn: () => void): void {
  _onLogout = fn
}

// ─────────────────────────────────────────────────────────────
//  AXIOS INSTANCE
// ─────────────────────────────────────────────────────────────

const client = axios.create({
  headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
  timeout: 30000,
})

// ─────────────────────────────────────────────────────────────
//  BUILD COMMON PARAMS
//  Angular appended APPTYPE, LANG, ATN, RTN to every request.
//  Extracted into one place instead of 3 duplicate blocks.
// ─────────────────────────────────────────────────────────────

async function buildCommonParams(url: string): Promise<string> {
  const [appType, lang, atn, rtn] = await Promise.all([
    getItem(StorageKeys.Auth.APP_TYPE),
    getItem(StorageKeys.Auth.LANG),
    getItem(StorageKeys.Auth.TOKEN),
    getItem(StorageKeys.Auth.REFRESH_TOKEN),
  ])

  const type  = appType ?? '115'
  const l     = lang    ?? 'en'
  const token = atn     ?? ''
  const rToken= rtn     ?? ''

  const isApptypeOnly   = APPTYPE_ONLY_ENDPOINTS.includes(url)
  const isAuthOnly      = AUTH_ONLY_ENDPOINTS.includes(url)
  const isRegInsert     = url.includes('registration/insert')
  const isSwitchLanguage = url === Endpoints.auth.switchLanguage

  // Angular httpservice.service.ts:237-244 matches:
  //   initialfetch      → &APPTYPE only (LANG already in params, no ATN/RTN)
  //   switchlanguage    → &APPTYPE&ATN&RTN (LANG already in params — this
  //                        endpoint's own caller always sends its own LANG;
  //                        appending it again here double-sends the param,
  //                        which the server has been observed to reject with
  //                        a generic "technical difficulties" ERRCODE 1)
  //   login/otp         → &APPTYPE&LANG (no ATN/RTN)
  //   everything else   → &APPTYPE&LANG&ATN&RTN
  if (isApptypeOnly || isRegInsert) return `&APPTYPE=${type}`
  if (isSwitchLanguage)             return `&APPTYPE=${type}&ATN=${token}&RTN=${rToken}`
  if (isAuthOnly)                   return `&APPTYPE=${type}&LANG=${l}`
  return `&APPTYPE=${type}&LANG=${l}&ATN=${token}&RTN=${rToken}`
}

// ─────────────────────────────────────────────────────────────
//  ERRCODE HANDLER
//  Angular had this same block copy-pasted in POST, GET, upload.
//  Now lives in exactly one place.
// ─────────────────────────────────────────────────────────────

type ApiResult = Record<string, any>

async function handleErrCode(
  errCode: number | string,
  newRtn: string | undefined,
  retry: () => Promise<ApiResult>,
): Promise<ApiResult | null> {

  const code = Number(errCode)

  if (code === 22 || code === 61) {
    // Token soft-expired — server sends new RTN, retry once
    if (newRtn) await setItem(StorageKeys.Auth.REFRESH_TOKEN, newRtn)
    return retry()
  }

  if (code === 23) {
    // Both tokens invalid — force logout
    // await clearSession()
    return null
  }

  return null
}

// ─────────────────────────────────────────────────────────────
//  ERROR RESPONSE SHAPE
// ─────────────────────────────────────────────────────────────

function errorResponse(moduleName: string): ApiResult {
  return {
    ERRCODE: '2',
    RESPONSECODE: '500',
    modulename: moduleName,
    message: 'No internet or server error. Please try again.',
  }
}

// ─────────────────────────────────────────────────────────────
//  API CALL  (POST / GET)
// ─────────────────────────────────────────────────────────────

export async function apiCall(
  url: string,
  method: 'POST' | 'GET',
  params: string,
  _retrying = false,
): Promise<ApiResult> {
  try {
    const common    = await buildCommonParams(url)
    const fullParams = params + common

    const userId = await getItem(StorageKeys.Auth.USER_ID)
    const isMedia = MEDIA_ENDPOINTS.includes(url)

    let reqUrl = url
    if (method === 'POST' && userId && !isMedia) {
      reqUrl = `${url}?ID=${userId}`
    }

    const config: AxiosRequestConfig = {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    }

    const res: ApiResult = method === 'POST'
      ? (await client.post(reqUrl, fullParams, config)).data
      : (await client.get(`${reqUrl}?${fullParams}`, config)).data

    if (!res) return errorResponse(url)

    // Some endpoints (confirmed: nbpromotion) send RESPONSECODE/ERRCODE as
    // JSON numbers rather than strings, but every service in this codebase
    // compares them as strings ('1', '0') — normalize once here instead of
    // patching every call site. String(x) on an already-string value is a
    // no-op, so this can't affect endpoints that already send strings.
    if (res['RESPONSECODE'] !== undefined) res['RESPONSECODE'] = String(res['RESPONSECODE'])
    if (res['ERRCODE']      !== undefined) res['ERRCODE']      = String(res['ERRCODE'])

    const errCode = res['ERRCODE']
    if (errCode === '22' || errCode === '61' || errCode === '23') {
      if (_retrying) return errorResponse(url) // prevent infinite retry
      const result = await handleErrCode(errCode, res['RTN'], () =>
        apiCall(url, method, params, true),
      )
      return result ?? res
    }

    return res
  } catch {
    return errorResponse(url)
  }
}

// ─────────────────────────────────────────────────────────────
//  UPLOAD FILE  (multipart/form-data)
// ─────────────────────────────────────────────────────────────

export async function uploadFile(
  url: string,
  formData: FormData,
  _retrying = false,
): Promise<ApiResult> {
  try {
    const [atn, rtn, appType, lang] = await Promise.all([
      getItem(StorageKeys.Auth.TOKEN),
      getItem(StorageKeys.Auth.REFRESH_TOKEN),
      getItem(StorageKeys.Auth.APP_TYPE),
      getItem(StorageKeys.Auth.LANG),
    ])

    // Media endpoints (image CDN) use a fixed APPTYPE=600; main API uses the app's own type
    const resolvedAppType = MEDIA_ENDPOINTS.includes(url) ? '600' : (appType ?? '115')

    // Only append common fields on the first attempt — retries reuse the same
    // FormData object and FormData.append() accumulates duplicates.
    if (!_retrying) {
      formData.append('ATN',        atn              ?? '')
      formData.append('RTN',        rtn              ?? '')
      formData.append('APPTYPE',    resolvedAppType)
      formData.append('LANG',       lang             ?? 'en')
      formData.append('OUTPUTTYPE', '1')
    }

    // Pass Content-Type: undefined so React Native's native XHR layer sets the
    // correct multipart/form-data boundary — the axios instance default
    // (application/x-www-form-urlencoded) would otherwise override it.
    const res: ApiResult = (await client.post(url, formData, {
      headers: { 'Content-Type': undefined },
    })).data

    if (!res) return errorResponse(url)

    const errCode = res['ERRCODE']
    if (errCode === 22 || errCode === 61 || errCode === 23) {
      if (_retrying) return errorResponse(url)
      const result = await handleErrCode(errCode, res['RTN'], () =>
        uploadFile(url, formData, true),
      )
      return result ?? res
    }

    return res
  } catch {
    return errorResponse(url)
  }
}

// ─────────────────────────────────────────────────────────────
//  SESSION CLEAR  (logout)
//  Preserves non-user keys so app settings survive logout.
//  Angular's deleteAllLocalStorage() — cleaned up here.
// ─────────────────────────────────────────────────────────────

const PRESERVE_KEYS = [
  'SEARCHLOGINCOUNT',
  'SHOWAPPRATINGDATE',
  'SHOWAPPRATINGCOUNT',
  StorageKeys.Payment.UPI_APPS,
  StorageKeys.App.APP_VERSION,
  StorageKeys.Auth.APP_TYPE,
  'LANG_SELECTED',
  StorageKeys.Auth.LANG,
  'MOBILENO',
  StorageKeys.User.MEMBER_CODE,
  StorageKeys.Auth.WEB_LOGIN,
] as const

export async function clearSession(): Promise<void> {
  const preserved = await getMultiple([...PRESERVE_KEYS])
  const entries: Record<string, string> = {}

  for (const key of PRESERVE_KEYS) {
    if (preserved[key] != null) entries[key] = preserved[key] as string
  }

  // Remove known user session keys instead of wiping everything
  await removeMultiple([
    StorageKeys.Auth.TOKEN,
    StorageKeys.Auth.REFRESH_TOKEN,
    StorageKeys.Auth.USER_ID,
    StorageKeys.User.NAME,
    StorageKeys.User.GENDER,
    StorageKeys.User.PHOTO_URL,
    StorageKeys.User.MEMBERSHIP_TYPE,
    StorageKeys.User.LOGIN_GENDER,
    StorageKeys.User.TIME_CREATED,
    StorageKeys.User.DATE_OF_BIRTH,
    StorageKeys.User.LAST_LOGIN,
    StorageKeys.User.CREATED_BY,
    StorageKeys.User.MOTHER_TONGUE,
    StorageKeys.User.OCCUPATION,
    StorageKeys.User.INCOME,
    StorageKeys.User.BROTHERS,
    StorageKeys.User.SISTERS,
    StorageKeys.User.FAMILY_PROPERTY,
    StorageKeys.Profile.PHOTO_PRIVACY,
    StorageKeys.Profile.MOBILE_PRIVACY,
    StorageKeys.Profile.PHOTO_STATUS_ARRAY,
    StorageKeys.Profile.PROFILE_VERIFIED,
    StorageKeys.Profile.HOROSCOPE_AVAILABLE,
    StorageKeys.Profile.STAR,
    StorageKeys.Profile.RAASI,
    StorageKeys.Profile.DOSHAM,
    StorageKeys.Profile.NRI_WHATSAPP,
    StorageKeys.Profile.NON_IDV_USER_TYPE,
    StorageKeys.Verification.EKYC_STATUS,
    StorageKeys.Verification.PHONE_VERIFIED,
    StorageKeys.Verification.ID_PROOF_UPDATE,
    StorageKeys.Verification.TRUECALL_VERIFY,
    StorageKeys.Verification.ID_VERIFY_CS_NUMBER,
    StorageKeys.Verification.SIGNZY_KEY,
    StorageKeys.Verification.DEFERRED_ID_USER,
    // Onboarding-in-progress cache (registrationService.ts's REG_STORE_KEY /
    // resetRegValues()) and the post-login field cache (SESSION_STORE_KEY) —
    // left uncleared, these leak a previous user's answers (e.g. NAME) as
    // prefill into the next signup's onboarding screens on the same device.
    'REGISTRATION_VALUES',
    'REGISTERURL',
    'USER_SESSION',
  ])

  if (Object.keys(entries).length > 0) {
    await setMultiple(entries)
  }

  // Notify AuthContext → switches navigator to AuthStack
  _onLogout?.()
}

// ─────────────────────────────────────────────────────────────
//  FETCH USER IP  (used for token generation)
// ─────────────────────────────────────────────────────────────

export async function fetchUserIp(): Promise<string | null> {
  try {
    const res = await client.get('https://api.ipify.org/?format=json')
    const ip: string = res.data?.ip ?? null
    if (ip) await setItem('USERIP', ip)
    return ip
  } catch {
    return null
  }
}
