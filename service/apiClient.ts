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
    await clearSession()
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

// Every failure (timeout, offline, a real 4xx/5xx, a request-setup error, an
// intentional AbortController cancellation) previously collapsed into the
// exact same generic errorResponse with nothing logged, even in dev — making
// "why does this call always fail" undiagnosable from client-side signals
// alone. Purely additive: return value is unchanged for every caller, this
// only adds dev-only visibility into which of those it actually was.
function logApiError(method: string, url: string, error: any): void {
  if (!__DEV__ || axios.isCancel(error)) return
  if (error?.response) {
    console.error(`[apiClient] ${method} ${url} → HTTP ${error.response.status}:`, error.response.data)
  } else if (error?.request) {
    console.error(`[apiClient] ${method} ${url} → no response (offline/timeout):`, error?.message)
  } else {
    console.error(`[apiClient] ${method} ${url} → request error:`, error?.message)
  }
}

// ─────────────────────────────────────────────────────────────
//  API CALL  (POST / GET)
// ─────────────────────────────────────────────────────────────

// De-dupes identical concurrent requests — e.g. a double-tap on Login/Send-OTP
// firing twice before the first response lands (the UI's own `loading` state
// isn't set until after the tap handler already started). A second call with
// the exact same method+url+params while the first is still in flight gets
// the same in-flight promise instead of firing a duplicate request; once it
// settles, the key is freed immediately so a later legitimate re-request
// (retry after an error, the next iteration of a polling loop) is unaffected.
// Retries and any call carrying an explicit AbortSignal (a caller managing
// its own cancellation/staleness — see SearchScreen's live-count preview) skip
// this entirely: folding them into a shared promise would let one caller's
// abort silently cancel a different caller's request.
const inFlightRequests = new Map<string, Promise<ApiResult>>()

export function apiCall(
  url: string,
  method: 'POST' | 'GET',
  params: string,
  // Optional — lets a caller cancel a superseded in-flight request (e.g. a
  // rapid-refire search/filter query) instead of it running to completion
  // and racing a newer request for which response applies last. No existing
  // caller passes this; every current call site is completely unaffected.
  signal?: AbortSignal,
  _retrying = false,
): Promise<ApiResult> {
  if (_retrying || signal) return doApiCall(url, method, params, signal, _retrying)

  const key = `${method} ${url}?${params}`
  const existing = inFlightRequests.get(key)
  if (existing) return existing

  const promise = doApiCall(url, method, params, signal, _retrying).finally(() => {
    if (inFlightRequests.get(key) === promise) inFlightRequests.delete(key)
  })
  inFlightRequests.set(key, promise)
  return promise
}

async function doApiCall(
  url: string,
  method: 'POST' | 'GET',
  params: string,
  signal?: AbortSignal,
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
      // exactOptionalPropertyTypes forbids an explicit `signal: undefined` —
      // only include the key at all when a real signal was passed.
      ...(signal ? { signal } : {}),
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
        doApiCall(url, method, params, signal, true),
      )
      return result ?? res
    }

    return res
  } catch (error: any) {
    logApiError(method, url, error)
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
  // Optional 0–1 progress callback — no caller passed a 3rd/4th argument
  // before this (verified across the codebase), so this is purely additive.
  // Nothing wired this up before; large photo/video uploads on a slow
  // connection could only ever show a static "uploading…" spinner, never a
  // percentage.
  onProgress?: (fraction: number) => void,
): Promise<ApiResult> {
  try {
    const [atn, rtn, appType, lang] = await Promise.all([
      getItem(StorageKeys.Auth.TOKEN),
      getItem(StorageKeys.Auth.REFRESH_TOKEN),
      getItem(StorageKeys.Auth.APP_TYPE),
      getItem(StorageKeys.Auth.LANG),
    ])

    // Always the app's own real APPTYPE — verified against both legacy
    // references (Angular's httpservice.service.ts uploadData() sends
    // localStorage's real APPTYPE for every module incl. photo uploads;
    // Android's PhotoUploadRepository.kt/ImageUploadService.kt send
    // Constants.APP_TYPE = BuildConfig.appType, same for photo/horoscope
    // uploads). Neither ever hardcodes APPTYPE for media/image-CDN
    // endpoints — the previous `'600'` override here had no such backing and
    // is the confirmed cause of chataudioupd.php returning HTTP 500 for
    // chat attachment uploads (doApiCall()'s plain apiCall() path already
    // never special-cased this either, so this brings uploadFile() in line
    // with it).
    const resolvedAppType = appType ?? '115'

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
      ...(onProgress ? {
        onUploadProgress: (evt: { loaded: number; total?: number }) => {
          if (evt.total) onProgress(evt.loaded / evt.total)
        },
      } : {}),
    })).data

    if (!res) return errorResponse(url)

    // Same RESPONSECODE/ERRCODE numeric-vs-string drift as doApiCall (see the
    // comment there) — normalize before comparing so a string "22"/"61"/"23"
    // from a media endpoint isn't missed by strict equality.
    if (res['RESPONSECODE'] !== undefined) res['RESPONSECODE'] = String(res['RESPONSECODE'])
    if (res['ERRCODE']      !== undefined) res['ERRCODE']      = String(res['ERRCODE'])

    const errCode = res['ERRCODE']
    if (errCode === '22' || errCode === '61' || errCode === '23') {
      if (_retrying) return errorResponse(url)
      const result = await handleErrCode(errCode, res['RTN'], () =>
        uploadFile(url, formData, true, onProgress),
      )
      return result ?? res
    }

    return res
  } catch (error: any) {
    logApiError('POST', url, error)
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
  StorageKeys.User.MEMBER_CODE,
  StorageKeys.Auth.WEB_LOGIN,
] as const

export async function clearSession(): Promise<void> {
  // Everything below is best-effort cleanup — a single failing AsyncStorage/
  // SecureStore call (e.g. deleteItemAsync on a key the OS Keychain/Keystore
  // already dropped) must never leave the user stuck logged in on the same
  // screen. _onLogout in the finally block is what actually flips the
  // navigator to AuthStack, so it has to run no matter what happens above it.
  try {
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
      // profileService.ts's getPPSetData() — cache-first (reads this before ever
      // hitting the network), so leaving these in place after logout serves the
      // PREVIOUS user's paywall/photo/preference state to whoever logs in next
      // on the same device, until something happens to force a fresh fetch.
      StorageKeys.App.PP_SET_DATA,
      StorageKeys.Payment.PAYMENT_WALL,
      'PHOTOCOUNT',
      'PHOTOAVAILABLE',
      'PI_VALIDATION',
      'FAQENABLEFLAG',
      'MOTHERTONGUE',
      'NUMBEROFPAYMENTS',
      'VERIFIEDBYCALLNUM',
      // paymentService.ts's PAYMENT_CACHE_KEYS — a failed-payment sticky state
      // tied to one user's one transaction attempt; must not survive into the
      // next login or they'd land on a "your payment failed" screen for a
      // payment they never made.
      'PAYMENT_FAILED',
      'PAYMENTFAILTYPE',
      'PAYMENT_FAILED_EXPIRED',
      'PAYMENTFAILURE_STICKY_UNTIL',
      'PAYMENT_FAILED_PACKAGEID',
      'PAYMENT_FAILED_CONTEXT',
    ])

    if (Object.keys(entries).length > 0) {
      await setMultiple(entries)
    }
  } catch (error) {
    if (__DEV__) console.warn('[clearSession] storage cleanup failed, logging out anyway', error)
  } finally {
    // Notify AuthContext → switches navigator to AuthStack. Must fire even if
    // the storage cleanup above threw, or the user is stuck looking logged in.
    _onLogout?.()
  }
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
