// Payment service — migrated from Angular payment.service.ts (1112 lines).
// Razorpay web SDK (DOM) → react-native-razorpay (native)
// Safari trusted gesture trick → removed (not needed in RN)

import RazorpayCheckout from 'react-native-razorpay'
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem, getJson, setJson, removeItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { getSessionValue } from './registrationService'
import { navigate, resetTo } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'
import { decrypt } from './encryptionService'
import { logAppsFlyer } from './analyticsService'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IPaymentConfig {
  PAYCONFIG?: any
  PAYMENTMETHODS?: any[]
  GPAY_SALT_KEY?: string
}

// ─── Storage key constants ─────────────────────────────────────────────────────

const PAYMENT_CACHE_KEYS = {
  MENU_PROMO:              'MENU_PROMO',
  PAYCONFIG:               'PAYCONFIG',
  HERO_BANNER:             'HERO_BANNER',
  PAYMENT_FAILED:          'PAYMENT_FAILED',
  PAYMENT_FAILED_EXPIRED:  'PAYMENT_FAILED_EXPIRED',
  PAYMENTFAILTYPE:         'PAYMENTFAILTYPE',
  PAYMENTFAILURE_STICKY:   'PAYMENTFAILURE_STICKY_UNTIL',
  PAYMENT_FAILED_PKG_ID:   'PAYMENT_FAILED_PACKAGEID',
  PAYMENT_FAILED_STICKY:   'PAYMENT_FAILED',
}

// ─── Routing ──────────────────────────────────────────────────────────────────

export async function redirectToIntermediatePage(
  fromPage = '',
  paymentId?: string,
  type?: string,
): Promise<void> {
  const renewalFlag = String((await getSessionValue('PAYRENEWALFLAG')) ?? '')
  const renewalKey  = String((await getSessionValue('RENEWALENABLEKEY')) ?? '')

  const goToRenewal =
    renewalFlag === '1' &&
    renewalKey  === '1' &&
    fromPage !== 'renewal'

  const destination = goToRenewal ? ENavigation.RENEWAL : ENavigation.RECHARGE
  navigate(destination, { from: fromPage, paymentId, type })
}

export async function redirectToMembershipPage(fromPage = '', replaceStack = false): Promise<void> {
  const entryType = String((await getSessionValue('ENTRYTYPE')) ?? '')
  const target    = entryType === 'P' ? ENavigation.MY_MEMBERSHIP : ENavigation.RECHARGE

  if (replaceStack) resetTo(target, { from: fromPage })
  else navigate(target, { from: fromPage })
}

// ─── Payment config (PAYCONFIG) ────────────────────────────────────────────────
// POST nbpaybanner → decrypt Google Pay salt → return filtered payment methods.

export async function getPaymentConfig(mode = 'CHECKOUT'): Promise<IPaymentConfig> {
  const cached = await getJson<IPaymentConfig>(PAYMENT_CACHE_KEYS.PAYCONFIG)
  if (cached) return cached

  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const params = `ID=${userId}&TYPE=${mode}`
  const result = await apiCall(Endpoints.payment.payBanner, 'POST', params)

  if (result?.RESPONSECODE !== '1' || result?.ERRCODE !== '0') return {}

  const payConfig = result.RESPONSE

  if (payConfig?.GPAY_SALT_KEY) {
    payConfig.GPAY_SALT_KEY = decrypt(payConfig.GPAY_SALT_KEY)
  }

  // Keep only active/available payment methods
  if (Array.isArray(payConfig?.PAYMENTMETHODS)) {
    payConfig.PAYMENTMETHODS = payConfig.PAYMENTMETHODS.filter(
      (m: any) => m.STATUS === '1' || m.STATUS === 1,
    )
  }

  await setJson(PAYMENT_CACHE_KEYS.PAYCONFIG, payConfig)
  return payConfig
}

// ─── Recharge packages ───────────────────────────────────────────────────────

export async function getRechargePackages(): Promise<any[]> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const result = await apiCall(Endpoints.payment.recharge, 'POST', `ID=${userId}&TYPE=RECHARGE`)
  if (result?.RESPONSECODE === '1' && result?.ERRCODE === '0') {
    return result.RESPONSE?.PACKAGES ?? result.RESPONSE ?? []
  }
  return []
}

// ─── Hero banner ──────────────────────────────────────────────────────────────

export async function getHeroBannerDetails(force = false, bannerType?: number): Promise<any> {
  if (!force) {
    const cached = await getJson(PAYMENT_CACHE_KEYS.HERO_BANNER)
    if (cached) return cached
  }
  const userId    = (await getItem(SK.Auth.USER_ID)) ?? ''
  const bannerQs  = bannerType != null ? `&BANNERTYPE=${bannerType}` : ''
  const result = await apiCall(Endpoints.payment.payBanner, 'POST', `ID=${userId}&TYPE=MYHOME${bannerQs}`)
  if (result?.RESPONSECODE === '1') {
    await setJson(PAYMENT_CACHE_KEYS.HERO_BANNER, result.RESPONSE)
    return result.RESPONSE
  }
  return null
}

// ─── Menu promo ───────────────────────────────────────────────────────────────

export async function getMenuPromo(type = 'MENU'): Promise<any> {
  const cached = await getJson(PAYMENT_CACHE_KEYS.MENU_PROMO)
  if (cached) return cached
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const result = await apiCall(Endpoints.payment.nbMenu, 'POST', `ID=${userId}&TYPE=${type}`)
  if (result?.RESPONSECODE === '1') {
    await setJson(PAYMENT_CACHE_KEYS.MENU_PROMO, result.RESPONSE)
    return result.RESPONSE
  }
  return null
}

// ─── Promotion details ────────────────────────────────────────────────────────

export async function getPromotionDetails(promotionId: string): Promise<any> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const result = await apiCall(Endpoints.payment.nbPromotion, 'POST', `ID=${userId}&PROMOTIONID=${promotionId}`)
  return result?.RESPONSECODE === '1' ? result.RESPONSE : null
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

export async function getCheckoutDetails(
  packageId: string,
  method: string,
  type = '',
): Promise<any> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const params = `ID=${userId}&PACKAGEID=${packageId}&PAYTYPE=${method}&TYPE=${type}`
  const result = await apiCall(Endpoints.payment.checkout, 'POST', params)
  return result?.RESPONSECODE === '1' ? result.RESPONSE : null
}

// ─── Check available offer ────────────────────────────────────────────────────

export async function checkAvailOffer(packageId: string): Promise<any> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  return apiCall(Endpoints.payment.payBanner, 'POST', `ID=${userId}&PACKAGEID=${packageId}&TYPE=CHECKOUT`)
}

// ─── Claim subscription offer ─────────────────────────────────────────────────

export async function claimNow(packId: string, type: string): Promise<any> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  return apiCall(Endpoints.payment.payOfferCheck, 'POST', `ID=${userId}&PACKID=${packId}&TYPE=${type}`)
}

// ─── Razorpay initiation ──────────────────────────────────────────────────────

export async function initRazorpayPayment(
  checkoutDetail: any,
  method: string,
  saltKey: string,
): Promise<{ success: boolean; response: any }> {
  try {
    const response = await RazorpayCheckout.open({
      key:         saltKey,
      amount:      checkoutDetail.AMOUNT,
      currency:    'INR',
      order_id:    checkoutDetail.ORDERID ?? '',
      name:        'Jodii Matrimony',
      description: checkoutDetail.DESCRIPTION ?? '',
      prefill: {
        contact: checkoutDetail.MOBILE ?? '',
        email:   checkoutDetail.EMAIL  ?? '',
        name:    checkoutDetail.NAME   ?? '',
      },
      method: { [method.toLowerCase()]: true },
      theme: { color: '#C62828' },
    })
    return { success: true, response }
  } catch (error: any) {
    return { success: false, response: error }
  }
}

export async function initUPIPayment(
  upiDetails: any,
  saltKey: string,
): Promise<{ success: boolean; response: any }> {
  try {
    const response = await RazorpayCheckout.open({
      key:      saltKey,
      amount:   upiDetails.AMOUNT,
      currency: 'INR',
      order_id: upiDetails.ORDERID ?? '',
      name:     'Jodii Matrimony',
      method:   { upi: true },
      'upi.vpa': upiDetails.VPA ?? '',
      theme: { color: '#C62828' },
    })
    return { success: true, response }
  } catch (error: any) {
    return { success: false, response: error }
  }
}

// ─── Payment status ───────────────────────────────────────────────────────────

export async function checkPaymentStatus(param: Record<string, any>): Promise<any> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const paramStr = Object.entries({ ID: userId, ...param })
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  return apiCall(Endpoints.payment.pendingPayment, 'POST', paramStr)
}

// ─── Payment failure / success state ─────────────────────────────────────────

export async function handlePaymentSuccess(): Promise<void> {
  await clearPaymentFailedState()
  logAppsFlyer('af_purchase', [{ key: 'af_order_id', value: Date.now() }])
  navigate(ENavigation.PAYMENT_SUCCESS)
}

export async function recordPaymentFailure(_packagesData: any, selectedData: any): Promise<void> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  await apiCall(Endpoints.payment.paymentFailed, 'POST', `ID=${userId}&PACKAGEID=${selectedData?.PACKAGEID}`)
  await setItem(PAYMENT_CACHE_KEYS.PAYMENT_FAILED_STICKY, '1')
  await setItem(PAYMENT_CACHE_KEYS.PAYMENT_FAILED_PKG_ID, selectedData?.PACKAGEID ?? '')
}

export async function clearPaymentFailedState(): Promise<void> {
  await Promise.all([
    removeItem(PAYMENT_CACHE_KEYS.MENU_PROMO),
    removeItem(PAYMENT_CACHE_KEYS.PAYMENT_FAILED),
    removeItem(PAYMENT_CACHE_KEYS.PAYMENTFAILTYPE),
    removeItem(PAYMENT_CACHE_KEYS.PAYMENT_FAILED_EXPIRED),
    removeItem(PAYMENT_CACHE_KEYS.PAYMENTFAILURE_STICKY),
    removeItem(PAYMENT_CACHE_KEYS.PAYMENT_FAILED_PKG_ID),
    removeItem(PAYMENT_CACHE_KEYS.PAYMENT_FAILED_STICKY),
  ])
}

export async function setPaymentFailedContext(data: Record<string, any>): Promise<void> {
  await setJson('PAYMENT_FAILED_CONTEXT', data)
}

export async function getPaymentFailedContext(): Promise<any> {
  return getJson('PAYMENT_FAILED_CONTEXT')
}

// ─── Paywall update ───────────────────────────────────────────────────────────

export async function updatePaywall(type: string): Promise<void> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  await apiCall(Endpoints.payment.paywallUpdate, 'POST', `ID=${userId}&TYPE=${type}`)
  await setItem('PAYWALLTYPE', '0')
}
