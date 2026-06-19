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
    const jsonStr = loginSegment.split('/2')[0]
    const data    = JSON.parse(jsonStr)
    await storeWebURLData(data)
  } catch (e) {
    if (__DEV__) console.error('[parseWebViewURL]', e)
  }
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
  if (data.FEMALEFREEPROMO)  ops.push(setItem('FEMALEFREEPROMO',          JSON.stringify(data.FEMALEFREEPROMO)))
  if (data.NONIDVUTYPE)      ops.push(setItem('NONIDVUTYPE',              data.NONIDVUTYPE))
  if (data.PHOTOSTATUSARRAY) ops.push(setItem('PHOTOSTATUSARRAY',         JSON.stringify(data.PHOTOSTATUSARRAY)))
  if (data.PROFILEPUBLISHEDFLAG) ops.push(setItem('PROFILEPUBLISHEDFLAG', data.PROFILEPUBLISHEDFLAG))

  // Remaining known scalar keys stored as-is
  const SCALAR_KEYS = ['RENEWALENABLEKEY', 'PAYRENEWALFLAG', 'PAYMENTPACKAGE', 'NEWPPCALL', 'APPVERSION']
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
