// Payment service — migrated from Angular payment.service.ts (1112 lines).
// Razorpay web SDK (DOM) → react-native-razorpay (native)
// Safari trusted gesture trick → removed (not needed in RN)

import RazorpayCheckout from 'react-native-razorpay'
import { NativeModules, NativeEventEmitter, Platform, AppState } from 'react-native'
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { CDN_SVG } from '../constants/cdn'
import { getItem, setItem, getJson, setJson, removeItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { getSessionValue } from './registrationService'
import { navigate, resetTo } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'
import { decrypt } from './encryptionService'
import { logAppsFlyer } from './analyticsService'

// ─── Native Razorpay bridge (Android only) ─────────────────────────────────────
// See android/app/src/main/java/jodii/app/RazorpayBridgeModule.kt +
// RazorpayWebView.kt — ported from a sibling Matrimony.com RN project's
// working Custom Integration SDK bridge. react-native-razorpay's Android
// autolinking is disabled (react-native.config.js) because its SDK
// (com.razorpay:checkout) can't coexist with the customui SDK this bridge
// uses (confirmed duplicate-class conflict) — iOS still uses
// react-native-razorpay via the functions further down this file.
const RazorpayBridge = Platform.OS === 'android' ? NativeModules.RazorpayBridge : null
const razorpayBridgeEmitter = RazorpayBridge ? new NativeEventEmitter(RazorpayBridge) : null

// ─── Native PayU bridge (Android only) ─────────────────────────────────────────
// See android/app/src/main/java/jodii/app/PayUBridgeModule.kt + PayUWebView.kt.
// PayU is a silent, account-wide substitute for the Razorpay UPI flow — the
// old native Android app picked Razorpay vs PayU per-account via
// PAYCONFIG.PAYSOURCE ('1' = Razorpay, '2' = PayU), with no user-visible
// difference. A prior comment in this file claimed PAYCONFIG.GOOGLEPAY never
// exists in practice — confirmed with the team that PAYSOURCE=='2' is live
// for real accounts today, so that assumption was wrong; verify the exact
// GOOGLEPAY.Key field name against a real PAYSOURCE=='2' account response
// before relying on this in production.
const PayUBridge = Platform.OS === 'android' ? NativeModules.PayUBridge : null
const payUBridgeEmitter = PayUBridge ? new NativeEventEmitter(PayUBridge) : null

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IPaymentConfig {
  PAYCONFIG?: any
  PAYMENTMETHODS?: PaymentMethodItem[]
  // Angular: payment.service.ts — decrypt(PAYCONFIG.RAZORPAY.keyId). This is
  // the actual Razorpay SDK key.
  RAZORPAY_KEY_ID?: string
  // Angular: payment.service.ts callNativeForPayment() — hasResponse.QRCODEFLAG,
  // gates whether the "Request a family/friend to pay" QR+WhatsApp block
  // shows at all ('1' = show, anything else = hide).
  QRCODEFLAG?: string
  // Angular: payment.service.ts callNativeForUPIPayment() — decides Razorpay
  // ('1') vs PayU ('2') for the ENTIRE UPI flow, account-wide. See
  // initPayUNative() below.
  PAYSOURCE?: string
  // Angular: PAYCONFIG.GOOGLEPAY.Key — PayU's merchant key (analogous to
  // Razorpay's Key ID; not decrypted, passed to the SDK as-is per the old
  // Android app). Only present/meaningful when PAYSOURCE == '2'.
  PAYU_MERCHANT_KEY?: string
}

// Angular: payment-mode.page.html *ngFor over PAYMENTMETHODS — RECOMMEND ('1'/'0')
// splits the "Recommended" card from "Other payment modes"; AUTOPAY ('1'/'0') picks
// a selectable radio row vs a chevron "navigate away" row. No STATUS field exists
// on this API (confirmed against Angular source) — do not filter on one.
// PAGE_ID splits which screen a row belongs to — confirmed from both real
// pages' templates: payment-mode.page.html filters PAGE_ID==1 (PaymentOptionsScreen,
// this screen), more-payment-option.page.html filters PAGE_ID==2 (NETBANKING/
// NEFT/PAYATSTORE, MorePaymentOptionsScreen) — they are NOT the same list.
export interface PaymentMethodItem {
  KEY:        string
  NAME:       string
  IMG:        string
  SUBTITLE?:  string | undefined
  RECOMMEND:  string
  AUTOPAY:    string
  RAZORFLAG?: string | undefined
  PAGE_ID?:   string | number | undefined
}

// Angular: recharge.page.ts / payment-mode.page.ts selectedData — the chosen
// membership package. `value`/`value1` drive the plan-summary name+duration
// (value1 = value.split('-'), e.g. ["Standard","3 Months"]).
export interface SelectedPackage {
  PACKAGEID:         string
  value:             string
  value1?:           string[] | undefined
  price:             string
  discountamount?:   string | undefined
  extradiscount?:    string | undefined
  extradiscountflag?: string | undefined
  paidamt?:          string | undefined
  autopayflag?:      string | undefined
  recurringdiscount?: string | undefined
}

// Angular: botton-sheet.config.ts AUTO_RENEWAL_BENEFITS — static fallback shown
// in the retention bottom sheet when unchecking "Renew my membership on expiry".
// Real endpoint (nbpromotion) can override via packagesData.AUTORENEWALBENEFITS;
// merged in getAutoRenewalBenefits() below.
export interface AutoRenewalBenefit {
  icon:  string
  value: string
}

export interface AutoRenewalSheetData {
  title:    string
  benefits: AutoRenewalBenefit[]
  ctaLabel: string
}

const RENEWAL_TICK = CDN_SVG + 'green_tick.svg'

const AUTO_RENEWAL_BENEFITS_FALLBACK: AutoRenewalSheetData = {
  title: 'Auto-Renewal Benefits:',
  benefits: [
    { icon: RENEWAL_TICK, value: 'Extra 10% off on renewal' },
    { icon: RENEWAL_TICK, value: 'Carry forward of unused contacts' },
    { icon: RENEWAL_TICK, value: 'Renew at the current price - even if prices go up' },
    { icon: RENEWAL_TICK, value: 'Get full refund even after renewal, if no paid benefits used' },
  ],
  ctaLabel: 'Enable Auto-renewal',
}

export function getAutoRenewalBenefits(packagesData?: any): AutoRenewalSheetData {
  const api = packagesData?.AUTORENEWALBENEFITS
  if (!api?.BENEFITS?.length) return AUTO_RENEWAL_BENEFITS_FALLBACK
  return {
    title:    api.TITLE ?? AUTO_RENEWAL_BENEFITS_FALLBACK.title,
    ctaLabel: api.CTA ?? AUTO_RENEWAL_BENEFITS_FALLBACK.ctaLabel,
    benefits: api.BENEFITS.map((b: any) => ({ icon: RENEWAL_TICK, value: String(b?.value ?? b) })),
  }
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

// ─── UPI Autopay renewal (RenewalScreen) ──────────────────────────────────────
// Angular: payment.service.ts redirectToIntermediatePage()/openRenew() — when
// PAYRENEWALFLAG+RENEWALENABLEKEY are both '1', any Pay/Upgrade tap app-wide
// redirects here instead of the normal recharge flow. The old app auto-fired
// the actual nbupiautopay charge ~3s after showing this screen (Cancel was
// the only opt-out) — this port requires an explicit "Renew Now" tap instead,
// a deliberate UX change, not a parity gap.

export interface RenewalBannerData {
  title:         string
  planName:      string  // Angular CONTENT
  planDuration:  string  // Angular CONTENT1
  paymentLabel:  string  // Angular CONTENT2, e.g. "Paying with"
  paymentMethod: string  // Angular CONTENT3, e.g. "PhonePe"
  benefitsTitle: string
  benefits:      AutoRenewalBenefit[]
  paymentId?:    string | undefined
}

export async function getRenewalBanner(): Promise<RenewalBannerData | null> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const ipCountryCode = (await getSessionValue('IPCOUNTRYCODE')) ?? 'IN'
  const result = await apiCall(
    Endpoints.payment.payBanner, 'POST', `ID=${userId}&TYPE=RENEWAL&COUNTRYCODE=${ipCountryCode}`,
  )
  if (result?.ERRCODE !== '0' || !result?.RESPONSE) return null

  const r = result.RESPONSE

  // Angular: redirectToIntermediatePage() persists these for later screens
  // (e.g. congratulations) to read without refetching.
  await setJson('PAYMENTBENEFIT', { MONTHS: r.MONTHS, CONTACTCOUNT: r.CONTACTCOUNT, PAYMENTID: r.PAYMENTID })

  return {
    title:         r.TITLE ?? 'Renewing membership',
    planName:      r.CONTENT ?? '',
    planDuration:  r.CONTENT1 ?? '',
    paymentLabel:  r.CONTENT2 ?? '',
    paymentMethod: r.CONTENT3 ?? '',
    benefitsTitle: r.BENEFITSTITLE ?? 'Benefits',
    benefits: Array.isArray(r.BENEFITS)
      ? r.BENEFITS.map((b: any) => ({ icon: RENEWAL_TICK, value: String(b?.value ?? b) }))
      : [],
    paymentId: r.PAYMENTID,
  }
}

export interface RenewalChargeResult {
  outcome:  'success' | 'pending' | 'failure'
  message?: string | undefined
}

// Angular: lowerpopup.component.ts reNewProcessing() + payment.service.ts
// openRenew()'s onDidDismiss() handler — ERRCODE/RESPONSECODE combination
// distinguishes success ('1'/'0'), pending ('1'/'5'), and failure (anything
// else with ERRCODE=='1'). Only ID is sent — the server already knows which
// mandate/plan to charge for this member.
export async function submitUpiAutopayRenewal(): Promise<RenewalChargeResult> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const result = await apiCall(Endpoints.payment.upiAutoPay, 'POST', `ID=${userId}`)

  if (result?.ERRCODE === '1' && result?.RESPONSECODE === '0') return { outcome: 'success' }
  if (result?.ERRCODE === '1' && result?.RESPONSECODE === '5') {
    return { outcome: 'pending', message: result?.RESPONSE?.MSG }
  }
  return { outcome: 'failure', message: result?.RESPONSE?.MSG }
}

export async function redirectToMembershipPage(fromPage = '', replaceStack = false): Promise<void> {
  const entryType = String((await getSessionValue('ENTRYTYPE')) ?? '')
  const target    = entryType === 'P' ? ENavigation.MY_MEMBERSHIP : ENavigation.RECHARGE

  if (replaceStack) resetTo(target, { from: fromPage })
  else navigate(target, { from: fromPage })
}

// ─── Payment config (PAYCONFIG) ────────────────────────────────────────────────
// POST nbpaybanner → decrypt Google Pay salt → return filtered payment methods.

// Bumped whenever a field is added that a previously-cached PAYCONFIG object
// wouldn't have — without this, getPaymentConfig() would keep returning an
// indefinitely-cached pre-update object (this cache has no TTL and is never
// cleared elsewhere) missing PAYSOURCE/PAYU_MERCHANT_KEY forever on any
// device that already cached a config before those fields existed, silently
// defeating the PayU routing in initPayUNative() for upgraded installs.
const PAYCONFIG_CACHE_VERSION = 2

// Angular: payment.service.ts callNativeForPayment() — real param is TYPE=PAYCONFIG
// (confirmed against a live network capture); 'CHECKOUT' was never a valid value
// for this endpoint — that's a different call (see checkAvailOffer below).
export async function getPaymentConfig(mode = 'PAYCONFIG'): Promise<IPaymentConfig> {
  const cached = await getJson<IPaymentConfig & { _cacheVersion?: number }>(PAYMENT_CACHE_KEYS.PAYCONFIG)
  if (cached && cached._cacheVersion === PAYCONFIG_CACHE_VERSION) return cached

  const [userId, appVersion, motherTongue] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem('APPVERSION'),
    getSessionValue('MOTHERTONGUE'),
  ])
  const ipCountryCode = (await getSessionValue('IPCOUNTRYCODE')) ?? 'IN'
  const params =
    `ID=${userId ?? ''}&TYPE=${mode}&APPVERSION=${appVersion ?? ''}` +
    `&IPCOUNTRYCODE=${ipCountryCode}&MOTHERTONGUE=${motherTongue ?? ''}`
  const result = await apiCall(Endpoints.payment.payBanner, 'POST', params)

  if (result?.RESPONSECODE !== '1' || result?.ERRCODE !== '0') return {}

  const payConfig = result.RESPONSE

  // Angular: callNativeForUPIPayment() — decrypt(PAYCONFIG.RAZORPAY.keyId) is
  // the real Razorpay SDK key (only the keyId — the "Key ID" — is a public,
  // client-safe credential; RAZORPAY.keySecret is also present in this
  // response and Angular does decrypt+forward it in one legacy native-bridge
  // path, but a secret has no place being used client-side for SDK init, and
  // Razorpay's own SDKs never ask for it — only the real order/charge
  // verification server-side needs it. Not used here.
  if (payConfig?.RAZORPAY?.keyId) {
    payConfig.RAZORPAY_KEY_ID = decrypt(payConfig.RAZORPAY.keyId)
  }

  // PAYSOURCE=='2' silently routes the whole UPI flow through PayU instead of
  // Razorpay for this account — see initPayUNative(). GOOGLEPAY.Key is PayU's
  // merchant key, passed through as-is (matching the old Android app).
  if (payConfig?.PAYSOURCE != null) {
    payConfig.PAYSOURCE = String(payConfig.PAYSOURCE)
  }
  if (payConfig?.GOOGLEPAY?.Key) {
    payConfig.PAYU_MERCHANT_KEY = payConfig.GOOGLEPAY.Key
  }

  // Angular: callNativeForPayment() — PAYMENTMETHODS.filter(item => item.FLAG != 0)
  // The real API sends RECOMMEND/AUTOPAY/RAZORFLAG as JSON numbers (e.g. 1),
  // not strings — coerce to string here so every `=== '1'` comparison
  // downstream (recommended-vs-other split, radio-vs-chevron row style,
  // AUTOPAY_CAPABLE_KEYS routing) actually matches instead of silently
  // treating every method as "other" and falling through to a "coming soon" alert.
  if (Array.isArray(payConfig?.PAYMENTMETHODS)) {
    payConfig.PAYMENTMETHODS = payConfig.PAYMENTMETHODS
      .filter((m: any) => m.FLAG != 0)
      .map((m: any) => ({
        ...m,
        RECOMMEND:  String(m.RECOMMEND ?? '0'),
        AUTOPAY:    String(m.AUTOPAY ?? '0'),
        RAZORFLAG:  m.RAZORFLAG != null ? String(m.RAZORFLAG) : undefined,
      }))
  }

  payConfig._cacheVersion = PAYCONFIG_CACHE_VERSION
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

// ─── Net banking bank list ────────────────────────────────────────────────────
// Angular: netbanking.page.ts loadBanks() — RESPONSE.list, each item:
// { bankName, key, ImagePathOn, ImagePathOff } (confirmed field names from
// netbanking.page.html:52-53,89). No explicit "popular" flag exists on the
// data — Angular's popular-banks grid vs. other-banks list split is purely by
// render position (first few vs. the rest), which this mirrors.

export interface NetBankingItem {
  bankName: string
  key: string
  ImagePathOn?:  string | undefined
  ImagePathOff?: string | undefined
}

export async function getNetBankingList(): Promise<NetBankingItem[]> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const result = await apiCall(Endpoints.payment.netBankingList, 'POST', `ID=${userId}`)
  if (result?.RESPONSECODE === '1' && result?.ERRCODE === '0') {
    return result.RESPONSE?.list ?? []
  }
  return []
}

// ─── NEFT/RTGS/Pay at Bank ────────────────────────────────────────────────────
// Angular: pages/recharge/payusing/payusing.page.ts loadBanks() — a static
// bank-transfer instructions screen (no Razorpay/checkout call at all): pick
// a bank, see its account details, optionally open the branch locator link
// or dial the toll-free number to report the transfer.

export interface PayAtBankItem {
  Bank:          string
  AccNo:         string
  AccName:       string
  IFSCNo:        string
  BranchUrl?:    string | undefined
  ImagePathOn?:  string | undefined
  ImagePathOff?: string | undefined
}

export interface PayAtBankData {
  banks:      PayAtBankItem[]
  tollFreeNo: string
}

export async function getPayAtBankList(): Promise<PayAtBankData> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const result = await apiCall(Endpoints.payment.payAtBankList, 'POST', `ID=${userId}`)
  if (result?.RESPONSECODE === '1' && result?.ERRCODE === '0') {
    return { banks: result.RESPONSE?.list ?? [], tollFreeNo: result.RESPONSE?.tollFreeNo ?? '' }
  }
  return { banks: [], tollFreeNo: '' }
}

// ─── Pay at our stores (branch locator) ───────────────────────────────────────
// Angular: pages/recharge/branch-locator/branch-locator.page.ts — state →
// city → store drill-down, no Razorpay/checkout involved. Field names
// (STATEID/STATE, CITYID/CITY, Title/Address/Phone/OfficeTime) confirmed
// from branch-locator.page.spec.ts mock responses. Angular's ERRCODE-only
// check (no RESPONSECODE) is intentional here — mirrored, not a mistake.

export interface PaymentStateItem {
  STATEID: string | number
  STATE:   string
}

export interface PaymentCityItem {
  CITYID: string | number
  CITY:   string
}

export interface PaymentStoreItem {
  Title:       string
  Address:     string
  Phone?:      { value: string }[] | undefined
  OfficeTime?: string | undefined
}

export async function getPaymentStateList(): Promise<PaymentStateItem[]> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const result = await apiCall(Endpoints.payment.stateList, 'POST', `ID=${userId}`)
  return result?.ERRCODE === '0' ? (result.RESPONSE ?? []) : []
}

export async function getPaymentCityList(stateId: string): Promise<PaymentCityItem[]> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const result = await apiCall(Endpoints.payment.cityList, 'POST', `ID=${userId}&stateId=${stateId}`)
  return result?.ERRCODE === '0' ? (result.RESPONSE ?? []) : []
}

export async function getPaymentStoreList(stateId: string, cityId: string): Promise<PaymentStoreItem[]> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const result = await apiCall(
    Endpoints.payment.storeList, 'POST', `ID=${userId}&stateId=${stateId}&cityId=${cityId}`,
  )
  return result?.ERRCODE === '0' ? (result.RESPONSE ?? []) : []
}

// ─── Free doorstep cash collection ─────────────────────────────────────────────
// Angular: free-doorstep-collection.page.ts postData() — a plain scheduling
// request, not a gateway checkout: no amount is charged here, a
// representative collects cash in person later. addressLine2 is always sent
// empty — Angular's own form never actually renders that field (dead input).
// np=1 is a literal, unexplained constant in the real request (matched
// as-is; no other value was ever seen used for it).

export async function submitDoorstepCollection(packageId: string, addressLine1: string): Promise<boolean> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const params = `np=1&addressLine1=${encodeURIComponent(addressLine1)}&addressLine2=&productId=${packageId}&ID=${userId}`
  const result = await apiCall(Endpoints.payment.doorstepCollection, 'POST', params)
  return result?.RESPONSECODE === '1' && result?.ERRCODE === '0'
}

// ─── QR payment link (Request a family/friend to pay) ─────────────────────────
// Angular: payment.service.ts getQRCode() + more-payment-option.page.ts
// enableQR() — QRIMGCONTENT is the raw data the client renders as a QR code
// on-screen; QRIMG is a SEPARATE server-hosted image URL used only for the
// WhatsApp share attachment (confirmed — Angular's WHATSAPPIMG native-bridge
// field reads from this, not from a client-rendered snapshot of the QR).

export interface QRPaymentData {
  qrValue?:     string
  qrImg?:       string
  qrOrderId?:   string
  upiOrderId?:  string
  whatsappMsg?: string
}

export async function getQRPaymentData(packId: string): Promise<QRPaymentData> {
  const [userId, appVersion, userIp] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem('APPVERSION'),
    getItem('USERIP'),
  ])
  const params = `ID=${userId ?? ''}&PRODUCTID=${packId}&APPVERSION=${appVersion ?? ''}&IPADDRESS=${userIp ?? ''}`
  const result = await apiCall(Endpoints.payment.checkoutQR, 'POST', params)
  if (result?.ERRCODE !== '0') return {}

  const r = result.RESPONSE ?? {}
  return {
    qrValue:     r.QRIMGCONTENT,
    qrImg:       r.QRIMG,
    qrOrderId:   r.QRORDERID,
    upiOrderId:  r.UPIORDERID,
    whatsappMsg: r.WHATSAPPMSG,
  }
}

// Angular: payment.service.ts delayQR() — 2 minutes after the QR is shown,
// check both the QR-flow order and the original UPI order once; if either
// came back successful, treat the whole checkout as paid.
export async function checkQrPaymentOutcome(
  qrOrderId?: string, upiOrderId?: string,
): Promise<'success' | 'failure' | null> {
  const [qrResult, upiResult] = await Promise.all([
    checkPaymentStatus({ razorpay_order_id: qrOrderId ?? '', upi_order_id: '' }),
    checkPaymentStatus({ razorpay_order_id: upiOrderId ?? '', upi_order_id: '' }),
  ])
  const qrStatus  = String(qrResult?.MSG ?? '').toLowerCase()
  const upiStatus = String(upiResult?.MSG ?? '').toLowerCase()
  const status = upiStatus === 'success' ? upiStatus : qrStatus
  return status === 'success' || status === 'failure' ? (status as 'success' | 'failure') : null
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
  const [userId, appVersion, renewalFlag] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem('APPVERSION'),
    getSessionValue('RENEWALENABLEKEY'),
  ])
  const ipCountryCode = (await getSessionValue('IPCOUNTRYCODE')) ?? 'IN'
  // Angular: payment.service.ts getPromotionDetails() — param is TYPE, not
  // PROMOTIONID (fixed here; the previous name would never have matched the
  // real nbpromotion contract). Defaults confirmed against Angular source:
  // IPCOUNTRYCODE→'IN', AUTOUPIFLAG→'0' (no installed-UPI-apps detection in
  // RN, so always '0'), PAYAPITYPE→'2', RENEWALFLAG→'0'.
  const params =
    `ID=${userId ?? ''}&TYPE=${promotionId}&APPVERSION=${appVersion ?? ''}` +
    `&IPCOUNTRYCODE=${ipCountryCode}&AUTOUPIFLAG=0&PAYAPITYPE=2` +
    `&RENEWALFLAG=${renewalFlag ?? '0'}`
  const result = await apiCall(Endpoints.payment.nbPromotion, 'POST', params)
  return result?.RESPONSECODE === '1' ? result.RESPONSE : null
}

export async function getRechargeHelpline(): Promise<string> {
  return (await getItem(SK.Payment.RECHARGE_HELPLINE)) ?? ''
}

// ─── Membership plans (recharge.page.ts — plan-selection list) ───────────────
// Angular: promotionId defaults to session 'S&FPROMOTION', falling back to
// '7' — the same universal default used in every caller across the codebase
// (recharge.page.ts, matches.page.ts, explore.component.ts, etc.), not a guess.

export interface MembershipBenefit {
  icon?:  string | undefined
  value:  string  // may contain a `<span>...</span>` wrapping the match count — see renderBenefitText in RechargeScreen
}

export interface MembershipPlan {
  productid:      string
  value1:         [string, string]  // [type e.g. "Basic", duration e.g. "1 Month"] — derived client-side from `value`, matching Angular (the raw API only sends the combined "Basic - 1 Month" string, no value1 field)
  price:          string   // pre-formatted with ₹ symbol (e.g. "₹1290") — render as-is, don't Number() it
  offerprice?:    string | undefined  // pre-formatted; presence = show strikethrough original price
  paidamt:        string   // pre-formatted final amount to charge
  discountamount?: string | undefined // pre-formatted, e.g. "₹850"
  discounttitle?: string | undefined  // pre-formatted "Save ₹850" from API (trimmed of surrounding whitespace)
  benefits:       MembershipBenefit[] // [0] = Call/WhatsApp matches, [1] = additional matches who liked you
  tag?:           string | undefined  // '1' = most-sold badge
  splprodflag?:   string | undefined  // '1' = "only for you" badge
  pkgcost?:       string | undefined
  PACKAGEDURATION?: string | undefined
  autopayflag?:   string | undefined
}

export interface MembershipPlansData {
  title:            string
  plans:            MembershipPlan[]     // INTERMEDIATEPACK-filtered subset shown on the main screen
  allPlans:         MembershipPlan[]     // full, unfiltered promotion.CONTENT — Angular's "View other packages" sheet shows this
  viewAllText?:     string | undefined   // e.g. "View other packages" — button label; hidden if absent
  defaultProductId: string
  payCtaTemplate:   string  // e.g. "Pay ₹<367>" — the literal substring '₹<367>' gets replaced with the amount
  helpline:         string
  // Angular: recharge.page.html:151 — promotion.AADIPROMO.NOTE, shown only
  // when promotion.PROMOTYPE == '20' (the seasonal "Aadi offer" campaign).
  // AADIPROMO is a campaign-named field on the backend, not a generic key —
  // a future campaign may introduce a differently-named sibling object
  // rather than reusing this one.
  offerBannerText?: string | undefined
}

// Strips a leading currency symbol/commas/whitespace and returns a plain
// number, for arithmetic on API amount fields — which come pre-formatted
// (e.g. "₹1,290") rather than as bare numbers.
export function parseAmount(value?: string | number): number {
  if (typeof value === 'number') return value
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return isNaN(n) ? 0 : n
}

// Angular's displayAmt() doesn't insert thousand separators (confirmed —
// real API amounts like "₹6291" have none), so this doesn't either.
export function formatAmount(value: number): string {
  return `₹${value}`
}

// The final rupee amount to charge, computed client-side from the already-
// loaded package/pricing data — mirrors PaymentOptionsScreen's own display
// math (price minus discount, or paidamt if the API already gives a final
// figure). This is NOT sourced from the checkout/order-generation response —
// confirmed against a working sibling RN project's Razorpay integration
// (rn-hybrid): its order-generation API returns only orderId/receiptId/
// customerId/email/contact, never amount — amount is always computed from
// the client-side package price and passed to the native bridge directly.
export function getFinalAmount(selectedPackage: SelectedPackage): number {
  const priceNum          = parseAmount(selectedPackage.price)
  const discountAmountNum = parseAmount(selectedPackage.discountamount) - parseAmount(selectedPackage.extradiscount)
  return selectedPackage.paidamt ? parseAmount(selectedPackage.paidamt) : priceNum - discountAmountNum
}

// Razorpay (and this app's native bridge) expect amount in the smallest
// currency unit (paise for INR) — Math.round guards against floating-point
// artifacts from rupee arithmetic (e.g. 299.1 * 100 → 29909.999999999996).
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

function mapMembershipPlan(raw: any): MembershipPlan {
  // Angular: recharge.page.ts / benefits-card.component.html read
  // package.value1[0]/[1] directly — Angular must compute this split
  // somewhere before the template renders it, since the raw API response
  // only has a single combined `value` string ("Basic - 1 Month").
  const parts = String(raw?.value ?? '').split('-').map((s: string) => s.trim())
  const value1: [string, string] = [parts[0] ?? '', parts[1] ?? '']

  return {
    ...raw,
    value1,
    discounttitle: typeof raw?.discounttitle === 'string' ? raw.discounttitle.trim() : raw?.discounttitle,
  }
}

export async function getMembershipPlans(): Promise<MembershipPlansData | null> {
  const promotionId = String((await getSessionValue('S&FPROMOTION')) ?? '7')
  const promotion = await getPromotionDetails(promotionId)
  if (!promotion) return null

  const intermediatePack: string = promotion.INTERMEDIATEPACK ?? ''
  const allPlans: MembershipPlan[] = (promotion.CONTENT ?? []).map(mapMembershipPlan)
  const plans = intermediatePack
    ? allPlans.filter(p => intermediatePack.includes(p.productid))
    : allPlans

  // Angular: recharge.page.ts / payment-mode.page.ts persist NUMBER to
  // localStorage('RECHARGEHELPLINE') here so every downstream payment screen
  // (payment-mode, more-payment-option, netbanking, ...) can read it without
  // re-fetching nbpromotion — same contract, ported to AsyncStorage.
  if (promotion.NUMBER) await setItem(SK.Payment.RECHARGE_HELPLINE, String(promotion.NUMBER))

  return {
    title:            promotion.TITLE2 ?? 'Membership plans',
    plans,
    allPlans,
    viewAllText:      promotion.VIEWALLTEXT,
    defaultProductId: promotion.DEFAULTPRODUCTID ?? plans[0]?.productid ?? '',
    payCtaTemplate:   promotion.CTA3 ?? 'Pay ₹<367>',
    helpline:         promotion.NUMBER ?? '',
    offerBannerText:  promotion.PROMOTYPE === '20' ? promotion.AADIPROMO?.NOTE : undefined,
  }
}

// ─── Checkout ─────────────────────────────────────────────────────────────────
// Angular: payment.service.ts getCheckoutdetails() (the only function that
// actually POSTs to nbpaymentcheckout) — real param names are lowercase
// method/productId/ID/name/appVersion, NOT PACKAGEID/PAYTYPE/TYPE (those
// never existed in the real API and silently failed on every method: GPay,
// PhonePe, manual UPI, card, netbanking all route through this one call).

export async function getCheckoutDetails(
  packageId: string,
  method: string,
  renewOnExpiry = false,
): Promise<any> {
  const [userId, userName, appVersion] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem(SK.User.NAME),
    getItem('APPVERSION'),
  ])
  let params =
    `method=${method}&productId=${packageId}&ID=${userId ?? ''}` +
    `&name=${userName ?? ''}&appVersion=${appVersion ?? ''}`
  // Angular: RENEWALFLAG is only ever appended (=1) when the "Renew my
  // membership on expiry" checkbox is checked; never sent as =0.
  if (renewOnExpiry) params += '&RENEWALFLAG=1'
  const result = await apiCall(Endpoints.payment.checkout, 'POST', params)
  // Confirmed via a real captured response — this endpoint is FLAT, unlike
  // most others: orderId/amount/customerId/MOBILENO/recurring sit as
  // top-level siblings of RESPONSECODE/ERRCODE/RESPONSE, and RESPONSE itself
  // is just a plain status STRING here ("Successfully get a order details"),
  // not a nested payload object. Returning result.RESPONSE (a string) was
  // the actual root cause of the Razorpay-side payment failures — every
  // field read off "checkout" downstream (orderId, amount, MOBILENO) was
  // silently undefined.
  if (result?.RESPONSECODE === '1') return result
  const reason = typeof result?.RESPONSE === 'string'
    ? result.RESPONSE
    : (result?.RESPONSE?.MSG ?? result?.RESPONSE?.ERRMESSAGE ?? result?.RESULT?.ERRMESSAGE)
  throw new Error(reason || 'Could not initiate payment. Please try again.')
}

// ─── Analytics tracking ───────────────────────────────────────────────────────
// Angular: common.ts paymentTrack() (~line 987) — fire-and-forget POST to
// nbtrack; the response is never read anywhere in the app. Swallow errors so a
// tracking failure never affects the actual payment flow.

export async function paymentTrack(trackNumber: string | number): Promise<void> {
  try {
    const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
    await apiCall(Endpoints.payment.track, 'POST', `ID=${userId}&trackNumber=${trackNumber}`)
  } catch {
    // fire-and-forget
  }
}

// ─── Check available offer ────────────────────────────────────────────────────
// Angular: PaymentService.checkAvailOffer() (payment.service.ts:152-165) —
// params are TYPE=CHECKOUT&MEMBERSHIPTYPE=<ENTRYTYPE>&PRODUCTID=<packageId>,
// not PACKAGEID (fixed here). Called once at recharge-page load with whatever
// package (if any) is already selected — packageId is legitimately '' on a
// fresh landing, matching a live capture.

export async function checkAvailOffer(packageId = ''): Promise<any> {
  const [userId, entryType] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getSessionValue('ENTRYTYPE'),
  ])
  const params = `ID=${userId ?? ''}&TYPE=CHECKOUT&MEMBERSHIPTYPE=${entryType ?? ''}&PRODUCTID=${packageId}`
  return apiCall(Endpoints.payment.payBanner, 'POST', params)
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
    // Angular: initCustomPayment() reads these flat, camelCase off the raw
    // nbpaymentcheckout response (checkOutdetail.amount/.orderId/.MOBILENO) —
    // not the uppercase names this originally assumed, which don't exist in
    // the real API. Email is hardcoded there too, never read from the response.
    const response = await RazorpayCheckout.open({
      key:         saltKey,
      amount:      checkoutDetail.amount,
      currency:    'INR',
      order_id:    checkoutDetail.orderId ?? '',
      name:        'Jodii Matrimony',
      prefill: {
        contact: checkoutDetail.MOBILENO ?? '',
        email:   'jodii@matrimony.com',
      },
      method: { [method.toLowerCase()]: true },
      // Pre-selects the bank on Razorpay's own netbanking checkout screen —
      // set when checkoutDetail carries a BANK code (NetBankingScreen).
      ...(checkoutDetail.BANK ? { bank: checkoutDetail.BANK } : {}),
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
      amount:   upiDetails.amount,
      currency: 'INR',
      order_id: upiDetails.orderId ?? '',
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

// ─── Native Razorpay Custom Integration bridge (Android only) ────────────────
// Enables what Razorpay's Standard Checkout (react-native-razorpay, used
// above for iOS) cannot: targeting one specific installed UPI app directly
// (instead of Razorpay's own generic app picker) and submitting raw card
// details straight to the SDK. See RazorpayBridgeModule.kt / RazorpayWebView.kt.

export interface UpiAppInfo {
  appName:     string
  packageName: string
}

// Angular has no equivalent (no installed-UPI-app detection in the old
// hybrid webview) — this mirrors the sibling RN project's getUpiAppList().
export function getUpiAppList(): Promise<UpiAppInfo[]> {
  if (!RazorpayBridge || !razorpayBridgeEmitter) return Promise.resolve([])
  return new Promise(resolve => {
    const sub = razorpayBridgeEmitter.addListener('RazorpayUpiApps', (result: { apps?: UpiAppInfo[] }) => {
      sub.remove()
      resolve(result?.apps ?? [])
    })
    RazorpayBridge.getAppsWhichSupportUpi()
  })
}

// Matches a detected UPI app's package name against our PAYMENTMETHODS KEY
// (PAY_GPAY / PAY_PHONEPE / PAY_PAYTM) by app name — Razorpay's
// getAppsWhichSupportUpi() returns whatever's installed, not keyed by our
// own KEY values, so this is a best-effort name match.
const UPI_APP_NAME_HINTS: Record<string, string[]> = {
  PAY_GPAY:    ['google pay', 'gpay', 'tez'],
  PAY_PHONEPE: ['phonepe'],
  PAY_PAYTM:   ['paytm'],
}

export function findUpiPackageName(apps: UpiAppInfo[], key: string): string | undefined {
  const hints = UPI_APP_NAME_HINTS[key]
  if (!hints) return undefined
  const match = apps.find(app => hints.some(hint => app.appName?.toLowerCase().includes(hint)))
  return match?.packageName
}

export interface NativeCheckoutOptions {
  amount:             number   // smallest currency unit (paise) — from checkoutDetail.amount (real API field, confirmed against Angular)
  orderId:            string
  receiptId?:         string | undefined
  email?:             string | undefined
  contact?:           string | undefined
  method:             'upi' | 'card' | 'netbanking'
  razorpayKey:        string
  upiAppPackageName?: string | undefined
  vpa?:               string | undefined
  bank?:              string | undefined
  name?:              string | undefined
  cardNumber?:        string | undefined
  expiryMonth?:       number | undefined
  expiryYear?:        number | undefined
  cvv?:               string | undefined
  recurring?:         boolean | undefined
  customerId?:        string | undefined
}

// RazorpayBridgeModule.kt emits native failures as { errorCode, errorMessage }
// (errorMessage is often a JSON-stringified Razorpay error object, e.g.
// {"error":{"description":"..."}}), NOT the { code, description } shape the
// screens check (that shape matches react-native-razorpay's own iOS error
// format instead) — the mismatch meant a real Android payment failure never
// actually surfaced an alert; `errCode` was always undefined ?? 0, same as
// the deliberate "user cancelled" case. Normalize to { code, description }
// here so every screen's existing `result.response?.description` check works.
function normalizeNativeFailure(data: any): { code: number; description: string } {
  const rawMessage = data?.errorMessage
  let description = 'Payment could not be completed.'
  if (typeof rawMessage === 'string' && rawMessage) {
    try {
      const parsed = JSON.parse(rawMessage)
      description = parsed?.error?.description ?? parsed?.description ?? rawMessage
    } catch {
      description = rawMessage
    }
  }
  const numericCode = Number(data?.errorCode)
  return { code: Number.isNaN(numericCode) ? 1 : numericCode, description }
}

// Safely stringifies a payment result's response object for on-screen
// display — falls back to String() if JSON.stringify fails (e.g. circular
// references), so something always renders instead of "[object Object]".
export function stringifyPaymentResponse(response: any): string {
  try {
    return JSON.stringify(response)
  } catch {
    return String(response)
  }
}

// Raw pass-through to RazorpayBridge.openCheckout(). Resolution comes back
// async via native events (RazorpayPaymentSuccess/Failure/BackPressed), not
// a resolved Promise from openCheckout() itself — see RazorpayBridgeModule.kt.
export function initRazorpayNative(rawOptions: NativeCheckoutOptions): Promise<{ success: boolean; response: any }> {
  if (!RazorpayBridge || !razorpayBridgeEmitter) {
    return Promise.resolve({ success: false, response: { description: 'Native payment bridge unavailable' } })
  }

  // Razorpay's SDK rejects the payload outright ("The email field is
  // required") if email is empty — the real checkout response has no email
  // field to source this from (confirmed via a live capture), so fall back
  // to the same placeholder Angular's payment.service.ts hardcodes.
  const options: NativeCheckoutOptions = { ...rawOptions, email: rawOptions.email || 'jodii@matrimony.com' }

  return new Promise(resolve => {
    let settled = false
    let wentBackground = false

    const settle = (result: { success: boolean; response: any }) => {
      if (settled) return
      settled = true
      successSub.remove()
      failureSub.remove()
      backSub.remove()
      appStateSub.remove()
      resolve(result)
    }

    const successSub = razorpayBridgeEmitter.addListener('RazorpayPaymentSuccess', data => settle({ success: true, response: data }))
    const failureSub = razorpayBridgeEmitter.addListener('RazorpayPaymentFailure', data => settle({ success: false, response: normalizeNativeFailure(data) }))
    const backSub    = razorpayBridgeEmitter.addListener('RazorpayBackPressed', () => settle({ success: false, response: { code: 0, description: 'Payment cancelled' } }))

    // Covers the case where the user is bounced to a UPI app to approve the
    // payment and that app is killed/swiped away without ever handing control
    // back to RazorpayWebView — no success/failure/back event would otherwise
    // ever fire, leaving the caller stuck on a spinner forever. The grace
    // window is deliberately generous since a legitimate callback normally
    // arrives within the same activity-resume tick as the app foregrounding.
    const appStateSub = AppState.addEventListener('change', nextState => {
      if (nextState === 'background' || nextState === 'inactive') {
        wentBackground = true
      } else if (nextState === 'active' && wentBackground) {
        setTimeout(() => settle({ success: false, response: { code: 0, description: 'Payment cancelled' } }), 5000)
      }
    })

    RazorpayBridge.openCheckout(options)
  })
}

// ─── Native PayU bridge (Android only, UPI substitute) ────────────────────────
// Silent per-account substitute for the Razorpay UPI flow — see PAYSOURCE on
// IPaymentConfig. All fields here come from the backend's own order-creation
// response (getCheckoutDetails()), matching the old native Android app's
// GetOrderIdParser contract — nothing PayU-specific is configured natively.

export interface PayUStandingInstruction {
  billingAmount:    string
  billingCurrency:  string
  billingCycle:     string  // 'yearly' | 'monthly' | 'weekly' | 'daily' | 'adhoc' | anything else -> 'once'
  billingInterval:  number
  paymentStartDate: string
  paymentEndDate:   string
}

export interface PayUCheckoutOptions {
  merchantKey:        string
  txnId:              string
  productInfo:        string
  firstName:          string
  email:              string
  amount:              string
  phone:              string
  surl:               string
  furl:               string
  hash:               string
  bankcode:           string
  upiAppPackageName?: string | undefined
  si?:                PayUStandingInstruction | undefined
}

// Raw pass-through to PayUBridge.openCheckout(). Resolution comes back async
// via native events (PayUPaymentSuccess/Failure/BackPressed) — see
// PayUWebView.kt. The success payload carries the raw PayU response JSON
// string + txnId; see verifyPayUPaymentSuccess() for turning that into a
// verified server-side outcome.
export function initPayUNative(options: PayUCheckoutOptions): Promise<{ success: boolean; response: any }> {
  if (!PayUBridge || !payUBridgeEmitter) {
    return Promise.resolve({ success: false, response: { description: 'Native PayU bridge unavailable' } })
  }

  return new Promise(resolve => {
    let settled = false
    let wentBackground = false

    const settle = (result: { success: boolean; response: any }) => {
      if (settled) return
      settled = true
      successSub.remove()
      failureSub.remove()
      backSub.remove()
      appStateSub.remove()
      resolve(result)
    }

    const successSub = payUBridgeEmitter.addListener('PayUPaymentSuccess', data => settle({ success: true, response: data }))
    const failureSub = payUBridgeEmitter.addListener('PayUPaymentFailure', data => settle({
      success: false,
      response: {
        code:        Number(data?.errorCode) || 1,
        description: data?.errorMessage || 'Payment could not be completed.',
      },
    }))
    const backSub = payUBridgeEmitter.addListener('PayUBackPressed', () => settle({ success: false, response: { code: 0, description: 'Payment cancelled' } }))

    // Same rationale as initRazorpayNative()'s AppState fallback — the user
    // may be bounced to a UPI app and never hand control back.
    const appStateSub = AppState.addEventListener('change', nextState => {
      if (nextState === 'background' || nextState === 'inactive') {
        wentBackground = true
      } else if (nextState === 'active' && wentBackground) {
        setTimeout(() => settle({ success: false, response: { code: 0, description: 'Payment cancelled' } }), 5000)
      }
    })

    const { si, ...rest } = options
    PayUBridge.openCheckout(si ? {
      ...rest,
      si:                true,
      siBillingAmount:   si.billingAmount,
      siBillingCurrency: si.billingCurrency,
      siBillingCycle:    si.billingCycle,
      siBillingInterval: si.billingInterval,
      siPaymentStartDate: si.paymentStartDate,
      siPaymentEndDate:   si.paymentEndDate,
    } : rest)
  })
}

// ─── Payment status ───────────────────────────────────────────────────────────

export async function checkPaymentStatus(param: Record<string, any>): Promise<any> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const paramStr = Object.entries({ ID: userId, ...param })
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  return apiCall(Endpoints.payment.pendingPayment, 'POST', paramStr)
}

// Angular: payment.service.ts onPaymentSuccess() — a Razorpay SDK "success"
// callback is a client-side claim, not proof; Angular posted the
// order/payment/signature triple to nbpaymentprocess for server-side
// signature verification before treating a purchase as real. This app's
// native bridge (Android) and react-native-razorpay (iOS) success events
// were never followed by that check — verified purely client-side. The two
// success shapes differ (Android: paymentId/orderId/signature from
// RazorpayWebView.kt; iOS: razorpay_payment_id/razorpay_order_id/
// razorpay_signature from react-native-razorpay), normalized here to the
// same params Angular's working call used.
export async function verifyPaymentSuccess(response: any, orderId?: string): Promise<boolean> {
  const paymentId       = response?.razorpay_payment_id ?? response?.paymentId
  const signature       = response?.razorpay_signature ?? response?.signature
  const razorpayOrderId = response?.razorpay_order_id ?? response?.orderId ?? orderId

  if (!paymentId || !signature || !razorpayOrderId) return false

  const result = await checkPaymentStatus({
    razorpay_order_id:   razorpayOrderId,
    razorpay_payment_id: paymentId,
    razorpay_signature:  signature,
  })
  return String(result?.MSG ?? '').toLowerCase() === 'success'
}

// Android: UPIWebviewActivity.java verifyPayUOrder() — PayU has no
// order/payment/signature triple like Razorpay; instead the raw PayU
// response JSON (returned by PayUWebView.kt's success event) is unpacked and
// its individual fields posted to the same nbpaymentprocess endpoint,
// keyed by txnId as both upi_order_id and razorpay_order_id (matching the
// old app's own field reuse, not a typo here).
export async function verifyPayUPaymentSuccess(payuResultJson: string | undefined, txnId: string | undefined): Promise<boolean> {
  if (!payuResultJson || !txnId) return false

  let result: any
  try {
    result = JSON.parse(payuResultJson)?.result
  } catch {
    return false
  }
  if (!result) return false

  const response = await checkPaymentStatus({
    upi_order_id:      txnId,
    razorpay_order_id: txnId,
    txnid:             result.txnid ?? '',
    hash:              result.hash ?? '',
    mihpayid:          result.mihpayid ?? '',
    status:            result.status ?? '',
    email:             result.email ?? '',
    firstname:         result.firstname ?? '',
    productinfo:       result.productinfo ?? '',
    amount:            result.amount ?? '',
  })
  return String(response?.MSG ?? '').toLowerCase() === 'success'
}

// ─── Payment failure / success state ─────────────────────────────────────────

export async function handlePaymentSuccess(): Promise<void> {
  await clearPaymentFailedState()
  logAppsFlyer('af_purchase', [{ key: 'af_order_id', value: Date.now() }])
  navigate(ENavigation.PAYMENT_SUCCESS)
}

// Angular: payment-mode.page.ts isPayRetryWindowElapsed() — a 1-hour cooldown
// before the user is allowed to re-attempt payment after a failure, to avoid
// hammering the gateway/getting flagged for repeated fraud-looking attempts.
const RETRY_WINDOW_MS = 60 * 60 * 1000

export interface PaymentFailureContext {
  packageId?:    string | undefined
  status:        'failure' | 'pending'
  reason?:       string | undefined
  retryRoute?:   string | undefined
  retryParams?:  any
  retryDeadline: number
}

export async function recordPaymentFailure(
  _packagesData: any,
  selectedData: any,
  extra?: {
    reason?:      string | undefined
    status?:      'failure' | 'pending' | undefined
    retryRoute?:  string | undefined
    retryParams?: any
  },
): Promise<void> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  await apiCall(Endpoints.payment.paymentFailed, 'POST', `ID=${userId}&PACKAGEID=${selectedData?.PACKAGEID}`)
  const retryDeadline = Date.now() + RETRY_WINDOW_MS
  await Promise.all([
    setItem(PAYMENT_CACHE_KEYS.PAYMENT_FAILED_STICKY, '1'),
    setItem(PAYMENT_CACHE_KEYS.PAYMENT_FAILED_PKG_ID, selectedData?.PACKAGEID ?? ''),
    setItem(PAYMENT_CACHE_KEYS.PAYMENTFAILURE_STICKY, String(retryDeadline)),
    setPaymentFailedContext({
      packageId:    selectedData?.PACKAGEID,
      status:       extra?.status ?? 'failure',
      reason:       extra?.reason,
      retryRoute:   extra?.retryRoute,
      retryParams:  extra?.retryParams,
      retryDeadline,
    }),
  ])
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
    removeItem('PAYMENT_FAILED_CONTEXT'),
  ])
}

export async function setPaymentFailedContext(data: PaymentFailureContext): Promise<void> {
  await setJson('PAYMENT_FAILED_CONTEXT', data)
}

export async function getPaymentFailedContext(): Promise<PaymentFailureContext | null> {
  return getJson<PaymentFailureContext>('PAYMENT_FAILED_CONTEXT')
}

// Milliseconds left in the retry cooldown — 0 once elapsed or if there's no
// recorded failure at all.
export async function getRetryRemainingMs(): Promise<number> {
  const context = await getPaymentFailedContext()
  if (!context?.retryDeadline) return 0
  return Math.max(0, context.retryDeadline - Date.now())
}

// ─── Paywall update ───────────────────────────────────────────────────────────

export async function updatePaywall(type: string): Promise<void> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  await apiCall(Endpoints.payment.paywallUpdate, 'POST', `ID=${userId}&TYPE=${type}`)
  await setItem('PAYWALLTYPE', '0')
}
