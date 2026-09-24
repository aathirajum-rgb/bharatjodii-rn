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
import { mapRenewalBenefits, mapMembershipPlan } from '../adapters/payment.adapter'
import { getIosProductIdsParam } from './iapService'

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
  // Angular: PAYCONFIG.GOOGLEPAY.AUTOPAYFLAG — payment.service.ts:371-373
  // forces PAYSOURCE back to '1' (Razorpay) for a recurring/autopay-mandate
  // registration when this isn't '1', since PayU can't handle that specific
  // account's autopay setup even though it's the account's normal gateway.
  PAYU_AUTOPAY_FLAG?: string
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
  // Angular: payment-mode.page.ts/recharge.page.ts/upi-payment.page.ts
  // isEmiFlow() — EMIPRODUCTID.includes(productid), computed once in
  // getMembershipPlans() below rather than re-deriving it per screen.
  isEmi?:            boolean | undefined
  // App Store product identifier for this plan (e.g. "com.matrimony.jodii_3INR")
  // — see service/iapService.ts. No backend field for this exists yet
  // (getMembershipPlans() never sets it); RechargeScreen's iOS branch checks
  // for its presence and shows an error instead of guessing a SKU, since a
  // wrong guess here means charging the wrong Apple product.
  iosProductId?:     string | undefined
}

// Angular: botton-sheet.config.ts AUTO_RENEWAL_BENEFITS — static fallback shown
// in the retention bottom sheet when unchecking "Renew my membership on expiry".
// Real endpoint (nbpromotion) can override via packagesData.AUTORENEWALBENEFITS;
// merged in getAutoRenewalBenefits() below.
export interface AutoRenewalBenefit {
  icon:  string
  value: string
  info?: boolean  // Figma: trailing (i) marker on the "carry forward" row
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
    { icon: RENEWAL_TICK, value: 'Carry forward of unused contacts*', info: true },
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
    benefits: mapRenewalBenefits(api.BENEFITS, RENEWAL_TICK),
  }
}

// ─── Storage key constants ─────────────────────────────────────────────────────

const PAYMENT_CACHE_KEYS = {
  // v2: the pre-fix cache holds responses fetched with the wrong nbmenu
  // params (TYPE=MENU), which came back without MENUDISCOUNT. Those entries
  // never expire, so any device that cached one would keep the "₹1200 OFF"
  // chip hidden forever — the renamed key retires them.
  MENU_PROMO:              'MENU_PROMO_V2',
  MENU_PROMO_LANG:         'MENU_PROMO_V2_LANG',
  PAYCONFIG:               'PAYCONFIG',
  HERO_BANNER:             'HERO_BANNER',
  HERO_BANNER_LANG:        'HERO_BANNER_LANG',
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
  // Angular: payment.service.ts's reDirectPage() takes its own replaceURL
  // param, defaulting to false at most call sites but explicitly passed
  // `true` from dr.service.ts's redirectPaymentPage() — i.e. when this is
  // reached AFTER a screen already shown via replaceUrl (like DR), the
  // payment screen should replace it too, not stack on top. Defaults to
  // false here to keep every existing call site's push behavior unchanged.
  replace = false,
): Promise<void> {
  const renewalFlag = String((await getSessionValue('PAYRENEWALFLAG')) ?? '')
  const renewalKey  = String((await getSessionValue('RENEWALENABLEKEY')) ?? '')

  const goToRenewal =
    renewalFlag === '1' &&
    renewalKey  === '1' &&
    fromPage !== 'renewal'

  const destination = goToRenewal ? ENavigation.RENEWAL : ENavigation.RECHARGE
  const params = { from: fromPage, paymentId, type }
  if (replace) resetTo(destination, params)
  else navigate(destination, params)
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
    benefits: mapRenewalBenefits(r.BENEFITS, RENEWAL_TICK),
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

// ─── My Membership — auto-renewal toggle + refund ─────────────────────────────
// Angular: menu-contacts.page.ts toggleAutoRenewal()/tapHereRefund() →
// payment.service.ts updateAutoRenewal()/requestAutopayRefund().
// VALUE='1' = turn auto-renewal on, VALUE='2' = confirmed cancellation.

export async function updateAutoRenewal(value: '1' | '2'): Promise<boolean> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const result = await apiCall(Endpoints.auth.autoRenewalUpdate, 'POST', `ID=${userId}&TYPE=&VALUE=${value}`)
  return String(result?.RESPONSECODE) === '1'
}

export async function requestAutopayRefund(): Promise<{ accepted: boolean; usedContacts?: string }> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const result = await apiCall(Endpoints.payment.autopayRefund, 'POST', `ID=${userId}&TYPE=3`)
  const accepted = String(result?.RESPONSECODE) === '1' && String(result?.ERRCODE) === '0'
  return { accepted, usedContacts: result?.RESPONSE?.phoneNumbersUsed ?? result?.phoneNumbersUsed }
}

// Angular: footer.component.ts's bottom-nav "Membership"/"Upgrade" tab press —
// paid members ('P') go straight to their membership status page; everyone
// else fires the paymentTrack(31) beacon and lands on the plan-selection
// screen (fromTab:true, same contract RechargeScreen.tsx already reads to
// show its tab-bar chrome instead of a back arrow). Every screen with an
// AppFooter/MatchesDesktopNav should route tab index 3 through this single
// function rather than hardcoding navigate('recharge') — that hardcoding was
// the bug that sent paid members back to the payment flow instead of
// 'my-membership'.
export async function openMembershipTab(): Promise<void> {
  const entryType = String((await getSessionValue('ENTRYTYPE')) ?? '')
  if (entryType === 'P') {
    // Angular: footer.component.ts:207 passes router state header:3 for
    // 'my-membership' (1 for other footer targets), and menu-contacts.page.ts:95
    // turns [1,3] into BACK_ICON:'0' — no back arrow — while the template's
    // *ngIf="[1,3].includes(header)" is what renders the tab bar. Both hang off
    // "did this come from the footer", which fromTab carries here.
    navigate(ENavigation.MY_MEMBERSHIP, { fromTab: true })
  } else {
    await paymentTrack('31')
    navigate(ENavigation.RECHARGE, { fromTab: true })
  }
}

// ─── Payment config (PAYCONFIG) ────────────────────────────────────────────────
// POST nbpaybanner → decrypt Google Pay salt → return filtered payment methods.

// Bumped whenever a field is added that a previously-cached PAYCONFIG object
// wouldn't have — without this, getPaymentConfig() would keep returning an
// indefinitely-cached pre-update object (this cache has no TTL and is never
// cleared elsewhere) missing PAYSOURCE/PAYU_MERCHANT_KEY forever on any
// device that already cached a config before those fields existed, silently
// defeating the PayU routing in initPayUNative() for upgraded installs.
// v3 added PAYU_AUTOPAY_FLAG.
const PAYCONFIG_CACHE_VERSION = 3

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
    // TEMP: verify AES decrypt round-trips correctly — remove after checking.
    if (__DEV__) {
      console.log('[PaymentConfig] decrypt check — ciphertext:', payConfig.RAZORPAY.keyId,
        '→ decrypted:', payConfig.RAZORPAY_KEY_ID || '(EMPTY — decryption failed)')
    }
  }

  // RAZORPAY.keySecret and GOOGLEPAY.saltkey are secrets the backend should
  // never send to a client at all — neither is read anywhere in this app
  // (only .keyId/.Key/.AUTOPAYFLAG are). Since they're never decrypted here,
  // strip them before this object is cached so the encrypted ciphertext
  // doesn't sit indefinitely in unencrypted device storage.
  if (payConfig?.RAZORPAY) delete payConfig.RAZORPAY.keySecret
  if (payConfig?.GOOGLEPAY) delete payConfig.GOOGLEPAY.saltkey

  // PAYSOURCE=='2' silently routes the whole UPI flow through PayU instead of
  // Razorpay for this account — see initPayUNative(). GOOGLEPAY.Key is PayU's
  // merchant key, passed through as-is (matching the old Android app).
  if (payConfig?.PAYSOURCE != null) {
    payConfig.PAYSOURCE = String(payConfig.PAYSOURCE)
  }
  if (payConfig?.GOOGLEPAY?.Key) {
    payConfig.PAYU_MERCHANT_KEY = payConfig.GOOGLEPAY.Key
  }
  if (payConfig?.GOOGLEPAY?.AUTOPAYFLAG != null) {
    payConfig.PAYU_AUTOPAY_FLAG = String(payConfig.GOOGLEPAY.AUTOPAYFLAG)
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
    const list = result.RESPONSE?.list ?? []
    return list
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

// Angular: book-appointment.page.ts bookAppoint() — the actual submit call
// for "Pay at our store": confirms a visit slot at the chosen store.
// visitingDate is 'YYYY-MM-DD', fromTime is 'HH:mm:ss'. PayAtStoreScreen.tsx
// previously stopped at browsing stores — this is the missing booking step.
export interface StoreAppointmentParams {
  packageId:     string
  branchAddress: string
  visitingDate:  string
  fromTime:      string
}

export async function submitStoreAppointment(params: StoreAppointmentParams): Promise<boolean> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const qs =
    `ID=${userId}&productId=${params.packageId}&branchAddress=${encodeURIComponent(params.branchAddress)}` +
    `&visitingDate=${encodeURIComponent(params.visitingDate)}&fromTime=${encodeURIComponent(params.fromTime)}`
  const result = await apiCall(Endpoints.payment.payAtStore, 'POST', qs)
  return result?.ERRCODE === '0'
}

// Angular: book-appointment.page.ts bookAppoint()'s onSuccess routing —
// female members always land on Matches; male members go there too only once
// fully verified (EKYC done + phone verified), otherwise to the verification
// gate. Angular's male "EKYC done but phone not verified" sub-case targets a
// dedicated '/mobileverify-inter/18' screen that has no RN equivalent yet —
// falls back to 'verify-id' (the closest existing verification screen)
// instead of navigating to a route that doesn't exist; revisit if/when that
// screen is ported.
export async function getPostBookingDestination(): Promise<'Matches' | 'verify-id'> {
  const gender = String((await getItem(SK.User.LOGIN_GENDER)) ?? '')
  if (gender === 'F') return 'Matches'

  const ekycStatus     = String((await getItem(SK.Verification.EKYC_STATUS)) ?? '')
  const phoneVerified  = String((await getItem(SK.Verification.PHONE_VERIFIED)) ?? '')
  return ekycStatus === '1' && phoneVerified !== '0' ? 'Matches' : 'verify-id'
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

// ─── Share-a-payment-link (family/friend can pay remotely) ───────────────────
// Angular: promotions.component.ts confirmationPopUP() — a second "someone
// else can pay for me" option alongside the QR flow above (getQRPaymentData).
// The success response carries no link/URL for the client to share
// (confirmed via promotions.component.spec.ts's own mock: RESPONSE:{} on
// success) — the backend handles delivering the payment request on its own
// once confirmed; the client only needs to show a confirmation.
export async function generatePaymentLink(packageId: string, amount: string | number): Promise<boolean> {
  const [userId, name] = await Promise.all([getItem(SK.Auth.USER_ID), getItem(SK.User.NAME)])
  const params = `name=${encodeURIComponent(name ?? '')}&amount=${amount}&productId=${packageId}&ID=${userId ?? ''}`
  const result = await apiCall(Endpoints.payment.upiPayLink, 'POST', params)
  return String(result?.RESPONSECODE) === '1' && String(result?.ERRCODE) === '0'
}

// ─── Hero banner ──────────────────────────────────────────────────────────────

// Cache is scoped to the language it was fetched with (HERO_BANNER_LANG), same
// as getRegistrationArrays()'s REGISTRATIONARRAYS_LANG — this cache has no TTL
// (unlike homeService.ts's 45s per-section cache), so without the language
// check a banner fetched once would keep showing that language's TITLE/BODY/CTA
// text forever, through every later language switch, until something else
// happened to pass force=true.
//
// The cache key is also scoped to `bannerType` — this endpoint's response
// shape genuinely differs per type (BANNERTYPE=1's payment-failed fields vs
// the default call's BANNERBG/BRIDEBGCOLOR/TITLE/BODY), so a bare/type-less
// call and a `bannerType=1` call are NOT interchangeable data. Before this,
// both shared ONE cache slot: MatchesScreen.tsx/ViewProfileScreen.tsx's own
// getHeroBannerDetails(true, 1) calls (force=true, so they always fetch AND
// always overwrite the shared slot) would silently poison it with the
// payment-failed response — so the NEXT plain getHeroBannerDetails(false) on
// Home (force=false, reads the cache) came back with that wrong-type response
// instead of making its own request, and its BANNERBG/BRIDEBGCOLOR read as
// undefined even though the server's real default-banner response carried a
// perfectly good color. Simply visiting Matches or ViewProfile before Home
// was enough to trigger this — no payment-failed state needed on Home itself.
function heroBannerCacheKey(bannerType?: number): string {
  return `${PAYMENT_CACHE_KEYS.HERO_BANNER}:${bannerType ?? 'default'}`
}

export async function getHeroBannerDetails(force = false, bannerType?: number): Promise<any> {
  const lang = (await getItem(SK.Auth.LANG)) ?? 'en'
  const cacheKey = heroBannerCacheKey(bannerType)
  if (!force) {
    const cachedLang = await getItem(PAYMENT_CACHE_KEYS.HERO_BANNER_LANG)
    const cached = cachedLang === lang ? await getJson(cacheKey) : null
    if (cached) return cached
  }
  const userId    = (await getItem(SK.Auth.USER_ID)) ?? ''
  const bannerQs  = bannerType != null ? `&BANNERTYPE=${bannerType}` : ''
  // iOS-only — see getIosProductIdsParam() in iapService.ts.
  const iosProductIds = await getIosProductIdsParam()
  const result = await apiCall(
    Endpoints.payment.payBanner, 'POST',
    `ID=${userId}&TYPE=MYHOME${bannerQs}&IOSPRODUCTIDS=${iosProductIds}`,
  )
  if (result?.RESPONSECODE === '1') {
    await setJson(cacheKey, result.RESPONSE)
    await setItem(PAYMENT_CACHE_KEYS.HERO_BANNER_LANG, lang)
    return result.RESPONSE
  }
  return null
}

// Angular derives AUTOUPIFLAG from a separate native "which installed apps
// support an autopay intent" list (AUTOUPIAPPS, from
// Razorpay.getAppsWhichSupportAutoPayIntent() — HomeScreenActivity.java's
// passUPIAppsToWebview()) — collapsed to a single '0'/'1' the backend uses to
// decide whether to include autopay/renewal promo content at all (traced
// through claimNow()/getHeroBannerDetails()/getPromotionDetails()/
// getMenuPromo() — it never picks or filters a specific app). Approximated
// here with the on-device UPI-app detection already wired for targeted
// checkout (getUpiAppList()) rather than adding a second native bridge call —
// every UPI app RN can detect (GPay/PhonePe/Paytm) supports autopay intents
// in practice, so "has any UPI app" is a reasonable stand-in for "has an
// autopay-capable app".
async function getAutoUpiFlag(): Promise<string> {
  if (Platform.OS !== 'android') return '0'
  const apps = await getUpiAppList()
  return apps.length > 0 ? '1' : '0'
}

// ─── Menu promo ───────────────────────────────────────────────────────────────

// Same language-scoping as getHeroBannerDetails above — this cache has no TTL,
// so a stale-language MENUDISCOUNT/badge text would otherwise persist across
// every later language switch.
export async function getMenuPromo(forceRefresh = false): Promise<any> {
  const lang = (await getItem(SK.Auth.LANG)) ?? 'en'
  if (!forceRefresh) {
    const cachedLang = await getItem(PAYMENT_CACHE_KEYS.MENU_PROMO_LANG)
    const cached = cachedLang === lang ? await getJson(PAYMENT_CACHE_KEYS.MENU_PROMO) : null
    if (cached) return cached
  }
  // Angular: payment.service.ts:631-648 getMenuPromo() — the real nbmenu
  // contract is ID/RENEWALFLAG/AUTOUPIFLAG/PAYAPITYPE, plus COMMONKEY only
  // when RENEWALPROMOKEY is '1' or '2'. This previously sent `TYPE=MENU`,
  // which is not a parameter this endpoint takes at all — the numeric arg in
  // Angular is a local force-refresh flag, never a request field — so the
  // response came back without MENUDISCOUNT and the "₹1200 OFF" chip over the
  // Membership tab never rendered.
  const [userId, renewalKey, renewalPromo, autoUpiFlag, iosProductIds] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getSessionValue('RENEWALENABLEKEY'),
    getSessionValue('RENEWALPROMOKEY'),
    getAutoUpiFlag(),
    getIosProductIdsParam(),
  ])
  let params =
    `ID=${userId ?? ''}&RENEWALFLAG=${renewalKey ?? '0'}&AUTOUPIFLAG=${autoUpiFlag}&PAYAPITYPE=2` +
    `&IOSPRODUCTIDS=${iosProductIds}`
  if (['1', '2'].includes(String(renewalPromo ?? ''))) params += `&COMMONKEY=${renewalPromo}`

  const result = await apiCall(Endpoints.payment.nbMenu, 'POST', params)
  // Angular checks ERRCODE == 0 here, not RESPONSECODE — nbmenu returns the
  // former, so the old check could reject a valid response outright.
  if ((String(result?.ERRCODE) === '0' || result?.RESPONSECODE === '1') && result?.RESPONSE) {
    const content = { ...result.RESPONSE }
    // Angular: payment.service.ts:664 — IMAGEPATH comes back as a bare
    // filename and is prefixed to a full CDN URL before being cached.
    if (content.IMAGEPATH) content.IMAGEPATH = CDN_SVG + content.IMAGEPATH
    await setJson(PAYMENT_CACHE_KEYS.MENU_PROMO, content)
    await setItem(PAYMENT_CACHE_KEYS.MENU_PROMO_LANG, lang)
    return content
  }
  return null
}

// ─── Upgrade payment promo (free-user Call/WhatsApp/Message paywall sheet) ────
// Angular: button.component.ts's paymentPromoPopUp() → payment/nbcustomer/v1,
// whose RESPONSE feeds bottom-sheet.component's `action == 'paymentPromo'`
// block (TITLE, CONTENT, SUBCONTENT + a BENEFITS list of icon/value/lockicon
// rows, and a CTA that routes to the intermediate payment page with
// PAYMENTID/type). Angular shows this bottom sheet only for a FREE member
// (FUNC.getEnteryType() == 'F'); a paid member with no PROMOTYPE gets the
// modal-popup variant instead.

export interface PaymentPromoBenefit {
  icon:      string
  value:     string
  lockIcon?: string
}

export interface UpgradePaymentPromo {
  title:      string
  content:    string
  subContent: string
  benefits:   PaymentPromoBenefit[]
  ctaLabel:   string
  paymentId:  string
  type:       string
  promoType:  string
}

export async function fetchUpgradePaymentPromo(profileName = ''): Promise<UpgradePaymentPromo | null> {
  const [userId, renewalKey, renewalPromo, entryType, autoUpiFlag, iosProductIds] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getSessionValue('RENEWALENABLEKEY'),
    getSessionValue('RENEWALPROMOKEY'),
    getSessionValue('ENTRYTYPE'),
    getAutoUpiFlag(),
    getIosProductIdsParam(),
  ])

  // PAGETYPE=NEW selects the new bottom-sheet content shape — TITLE +
  // "Paid membership benefits:" SUBCONTENT + per-perk BENEFITS rows carrying
  // their own `icon`/`lockicon` (draft.page.ts:667, the page this sheet is
  // developed against, sends exactly this). Without it the endpoint returns the
  // older package-summary copy ("Pay now and enjoy the below benefits", plan
  // rows with no icons), which is what this screen was rendering.
  let params =
    `ID=${userId ?? ''}&RENEWALFLAG=${renewalKey ?? '0'}&AUTOUPIFLAG=${autoUpiFlag}` +
    `&name=${encodeURIComponent(profileName)}&PAGETYPE=NEW&IOSPRODUCTIDS=${iosProductIds}`
  if (String(entryType ?? '') === 'P') params += '&profileCount=0'
  if (['1', '2'].includes(String(renewalPromo ?? ''))) params += `&COMMONKEY=${renewalPromo}`

  const result = await apiCall(Endpoints.payment.customer, 'POST', params)
  if (String(result?.ERRCODE) !== '0' || !result?.RESPONSE) return null

  const r = result.RESPONSE
  const benefits: PaymentPromoBenefit[] = Array.isArray(r.BENEFITS)
    ? r.BENEFITS.map((b: Record<string, any>) => ({
        icon:  String(b['icon'] ?? ''),
        value: String(b['value'] ?? ''),
        ...(b['lockicon'] ? { lockIcon: String(b['lockicon']) } : {}),
      }))
    : []

  return {
    title:      String(r.TITLE      ?? ''),
    content:    String(r.CONTENT    ?? ''),
    subContent: String(r.SUBCONTENT ?? ''),
    benefits,
    ctaLabel:   String(r.CTA ?? ''),
    // Angular: `PAYMENTID` is passed straight through to redirectToIntermediatePage.
    paymentId:  String(r.PAYMENTID ?? ''),
    type:       String(r.type ?? r.TYPE ?? ''),
    promoType:  String(r.PROMOTYPE ?? ''),
  }
}

// ─── Promotion details ────────────────────────────────────────────────────────

export async function getPromotionDetails(promotionId: string): Promise<any> {
  const [userId, appVersion, renewalFlag, autoUpiFlag, iosProductIds] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem('APPVERSION'),
    getSessionValue('RENEWALENABLEKEY'),
    getAutoUpiFlag(),
    getIosProductIdsParam(),
  ])
  const ipCountryCode = (await getSessionValue('IPCOUNTRYCODE')) ?? 'IN'
  // Angular: payment.service.ts getPromotionDetails() — param is TYPE, not
  // PROMOTIONID (fixed here; the previous name would never have matched the
  // real nbpromotion contract). Defaults confirmed against Angular source:
  // IPCOUNTRYCODE→'IN', PAYAPITYPE→'2', RENEWALFLAG→'0'.
  // IOSPRODUCTIDS is iOS-only — see getIosProductIdsParam() in iapService.ts.
  const params =
    `ID=${userId ?? ''}&TYPE=${promotionId}&APPVERSION=${appVersion ?? ''}` +
    `&IPCOUNTRYCODE=${ipCountryCode}&AUTOUPIFLAG=${autoUpiFlag}&PAYAPITYPE=2` +
    `&RENEWALFLAG=${renewalFlag ?? '0'}&IOSPRODUCTIDS=${iosProductIds}`
  const result = await apiCall(Endpoints.payment.nbPromotion, 'POST', params)
  if (result?.RESPONSECODE !== '1') return null
  // Angular: recharge.page.ts:379-383 reads resultData['NUMBER'] and
  // resultData['WSNUMBER'] from the TOP LEVEL of the response — siblings of
  // RESPONSE, not fields inside it. Returning bare RESPONSE dropped them, so
  // the "Need help?" number was always empty and its row never rendered.
  return { ...result.RESPONSE, NUMBER: result.NUMBER, WSNUMBER: result.WSNUMBER }
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
  benefits:       MembershipBenefit[] // [0] = Call/WhatsApp matches, [1] = Message matches, [2] = horoscope access
  tag?:           string | undefined  // '1' = most-sold badge
  splprodflag?:   string | undefined  // '1' = "only for you" badge
  pkgcost?:       string | undefined
  PACKAGEDURATION?: string | undefined
  autopayflag?:   string | undefined
  // Angular: payment-mode.page.ts/recharge.page.ts/upi-payment.page.ts
  // isEmiFlow() — EMIPRODUCTID.includes(productid), computed once in
  // getMembershipPlans() below rather than re-deriving it per screen.
  isEmi?:         boolean | undefined
  // App Store product identifier for this plan (e.g. "com.matrimony.jodii_3INR")
  // — see service/iapService.ts. No backend field for this exists yet
  // (getMembershipPlans() never sets it); RechargeScreen's iOS branch checks
  // for its presence and shows an error instead of guessing a SKU, since a
  // wrong guess here means charging the wrong Apple product.
  iosProductId?:  string | undefined
}

export interface MembershipPlansData {
  title:            string
  plans:            MembershipPlan[]     // INTERMEDIATEPACK-filtered subset shown on the main screen
  allPlans:         MembershipPlan[]     // full, unfiltered promotion.CONTENT — Angular's "View other packages" sheet shows this
  viewAllText?:     string | undefined   // e.g. "View other packages" — button label; hidden if absent
  // Angular: recharge.page.html:143 passes [TOPSELLTEXT]="promotion?.TOPSELLTEXT"
  // into benefits-card, which renders it via [innerHTML] as the "Most Sold"
  // badge. It is API copy, not a fixed string — the template's own literal
  // reads "most popular" and is only ever the pre-bind placeholder.
  topSellText?:     string | undefined
  defaultProductId: string
  payCtaTemplate:   string  // e.g. "Pay ₹<367>" — the literal substring '₹<367>' gets replaced with the amount
  helpline:         string
  // Angular: recharge.page.html:151 — promotion.AADIPROMO.NOTE, shown only
  // when promotion.PROMOTYPE == '20' (the seasonal "Aadi offer" campaign).
  // AADIPROMO is a campaign-named field on the backend, not a generic key —
  // a future campaign may introduce a differently-named sibling object
  // rather than reusing this one.
  offerBannerText?: string | undefined
  // Angular: promotions.component.ts — a server-driven "apply this coupon"
  // banner (NOT a user-typed code field). COUPONFLAG '0' hides the banner
  // entirely; '1'/'3' auto-apply it on load (see RechargeScreen.tsx's mount
  // effect). couponCode is JODIICOUPON.COUPONCODE.split('~')[1] (e.g.
  // "JODII20"); couponApplyLabel/couponAppliedLabel are JODIICOUPON.CTA/CTA1.
  couponFlag?:            string | undefined
  couponCode?:            string | undefined
  couponApplyLabel?:      string | undefined
  couponAppliedLabel?:    string | undefined
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

// The post-registration welcome payment page must ask nbpromotion for TYPE=7,
// whatever S&FPROMOTION happens to hold for the rest of the app (the server can
// set it to '8'/'9'/'11' via registrationService.ts's session seed, and Angular
// would otherwise forward the intermediate-page type '12' straight through as
// the promotionId — recharge.page.ts:132-140 + payment.service.ts:113).
export const WELCOME_PROMOTION_TYPE = '7'

// `promotionIdOverride` is Angular's navigation-state promotionId
// (recharge.page.ts:132-140), which takes precedence over the S&FPROMOTION
// default on line 75 of that file. Passed by the welcome payment page only —
// every other caller omits it and keeps the stored default.
export async function getMembershipPlans(promotionIdOverride?: string): Promise<MembershipPlansData | null> {
  const promotionId = promotionIdOverride ?? String((await getSessionValue('S&FPROMOTION')) ?? '7')
  const promotion = await getPromotionDetails(promotionId)
  if (!promotion) return null

  const intermediatePack: string = promotion.INTERMEDIATEPACK ?? ''
  const allPlans: MembershipPlan[] = (promotion.CONTENT ?? []).map(mapMembershipPlan)
  const plans = intermediatePack
    ? allPlans.filter(p => intermediatePack.includes(p.productid))
    : allPlans

  // Angular: payment-mode.page.ts/recharge.page.ts/promotions.component.ts —
  // EMIPRODUCTID is a '~'-joined string of package ids on the promotion
  // payload; those packages must checkout as a forced-recurring, UPI-only
  // autopay mandate (see isEmiFlow() in those pages, and PaymentOptionsScreen
  // here). Computed once here so every plan carries its own isEmi flag.
  const emiProductIds = typeof promotion.EMIPRODUCTID === 'string' && promotion.EMIPRODUCTID
    ? promotion.EMIPRODUCTID.split('~')
    : []
  for (const plan of allPlans) plan.isEmi = emiProductIds.includes(plan.productid)

  // Angular: recharge.page.ts / payment-mode.page.ts persist NUMBER to
  // localStorage('RECHARGEHELPLINE') here so every downstream payment screen
  // (payment-mode, more-payment-option, netbanking, ...) can read it without
  // re-fetching nbpromotion — same contract, ported to AsyncStorage.
  if (promotion.NUMBER) await setItem(SK.Payment.RECHARGE_HELPLINE, String(promotion.NUMBER))
  // Angular: recharge.page.ts:103 seeds needHelpContact from that same cached
  // key, so a response without NUMBER still shows the last known number
  // rather than dropping the "Need help?" row entirely.
  const helpline = String(promotion.NUMBER ?? (await getItem(SK.Payment.RECHARGE_HELPLINE)) ?? '')

  // Angular: promotions.component.ts — couponObj = promotion.JODIICOUPON;
  // couponCode = couponObj.COUPONCODE.split('~') (index [1] is the display
  // code, e.g. "JODII20" — index [0] is unused elsewhere in that file).
  const jodiiCoupon = promotion.JODIICOUPON
  const couponCodeParts = typeof jodiiCoupon?.COUPONCODE === 'string' ? jodiiCoupon.COUPONCODE.split('~') : []

  return {
    title:            promotion.TITLE2 ?? 'Membership plans',
    plans,
    allPlans,
    // Angular: recharge.page.ts:721-723 isShowViewAllPack() gates the "View
    // other packages" CTA on promotion.CONTENT.length > 3 — with only 3 (or
    // fewer) packages there's nothing extra to reveal. That count check was
    // dropped in this port, so the CTA showed whenever VIEWALLTEXT was
    // present regardless of package count (QA #27). Gated here so both
    // RechargeScreen and RechargeDesktopLayout, which just render
    // data.viewAllText as-is, pick up the fix for free.
    viewAllText:      allPlans.length > 3 ? promotion.VIEWALLTEXT : undefined,
    topSellText:      promotion.TOPSELLTEXT,
    defaultProductId: promotion.DEFAULTPRODUCTID ?? plans[0]?.productid ?? '',
    payCtaTemplate:   promotion.CTA3 ?? 'Pay ₹<367>',
    helpline,
    offerBannerText:  promotion.PROMOTYPE === '20' ? promotion.AADIPROMO?.NOTE : undefined,
    couponFlag:         promotion.COUPONFLAG,
    couponCode:         couponCodeParts[1],
    couponApplyLabel:   jodiiCoupon?.CTA,
    couponAppliedLabel: jodiiCoupon?.CTA1,
  }
}

// Angular: clickedApply()/undoCouponApply() both clear the cached menu promo
// (localStorage.removeItem('MENU_PROMO')) so the "₹X OFF" chip elsewhere in
// the app picks up the coupon's new discount on next fetch, instead of
// serving a stale cached value.
export async function invalidateMenuPromoCache(): Promise<void> {
  await removeItem(PAYMENT_CACHE_KEYS.MENU_PROMO)
}

// ─── Checkout ─────────────────────────────────────────────────────────────────
// Angular: payment.service.ts getCheckoutdetails() (the only function that
// actually POSTs to nbpaymentcheckout) — real param names are lowercase
// method/productId/ID/name/appVersion, NOT PACKAGEID/PAYTYPE/TYPE (those
// never existed in the real API and silently failed on every method: GPay,
// PhonePe, manual UPI, card, netbanking all route through this one call).

// IMPORTANT: only valid for methods the backend actually treats as a real
// order-creation call — confirmed working for 'upi' (app-targeted intent
// flow) via a live device trace. Netbanking, card, and manually-typed UPI
// VPA are NOT valid here — see getHostedCheckoutRequest() below, which
// those three route through instead.
// iOS-only extra fields for nbpaymentcheckout — confirmed via a live capture:
// IOSPRODUCTID (the Apple SKU), PAYMENTGATEWAY=APPLESTORE, IPADDRESS, CN
// (country code) and ONLINECHARGE (the raw decimal charge amount, e.g.
// "3599.00" — no currency symbol) are all present alongside the usual
// ID/productId/APPTYPE fields that apiCall()/buildCommonParams() already add.
export interface IosCheckoutDetails {
  iosProductId: string
  onlineCharge: string
}

export async function getCheckoutDetails(
  packageId: string,
  method: string,
  renewOnExpiry = false,
  iosDetails?: IosCheckoutDetails,
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
  if (iosDetails) {
    const [userIp, ipCountryCode] = await Promise.all([
      getItem('USERIP'),
      getSessionValue('IPCOUNTRYCODE'),
    ])
    params +=
      `&IOSPRODUCTID=${iosDetails.iosProductId}&PAYMENTGATEWAY=APPLESTORE` +
      `&IPADDRESS=${userIp ?? ''}&CN=${ipCountryCode ?? 'IN'}&ONLINECHARGE=${iosDetails.onlineCharge}`
  }
  const result = await apiCall(Endpoints.payment.checkout, 'POST', params)
  // Confirmed via a real captured response — this endpoint is FLAT, unlike
  // most others: orderId/amount/customerId/MOBILENO/recurring sit as
  // top-level siblings of RESPONSECODE/ERRCODE/RESPONSE, and RESPONSE itself
  // is just a plain status STRING here ("Successfully get a order details"),
  // not a nested payload object. Returning result.RESPONSE (a string) was
  // the actual root cause of the Razorpay-side payment failures — every
  // field read off "checkout" downstream (orderId, amount, MOBILENO) was
  // silently undefined.
  if (result?.RESPONSECODE === '1' || result?.RESPONSECODE === 1) {
    // The APPTYPE==701 (iOS) branch of nbPaymentCheckout — confirmed against
    // backend source (nbvpnode's nbPaymentCheckout) — returns the order id
    // nested/uppercase (RESPONSE.ORDERID) instead of this endpoint's usual
    // flat/lowercase orderId. Normalize it here so callers (iapService.ts's
    // useHandlePurchase) don't need to know which shape they got.
    if (!result.orderId && result.RESPONSE?.ORDERID) result.orderId = result.RESPONSE.ORDERID
    return result
  }
  const reason = typeof result?.RESPONSE === 'string'
    ? result.RESPONSE
    : (result?.RESPONSE?.MSG ?? result?.RESPONSE?.ERRMESSAGE ?? result?.RESULT?.ERRMESSAGE)
  throw new Error(reason || 'Could not initiate payment. Please try again.')
}

// ─── Hosted checkout (WebView) — Netbanking / Card / manual-VPA UPI ──────────
// Angular: netbanking.page.ts GoToPayment() / pay-using-credit-debit.page.ts /
// upi-payment.page.ts manual-VPA path — nbpaymentcheckout is NOT a JSON
// order-creation API for these three methods. It's a hosted-webview
// endpoint: POST this exact form body, render whatever HTML comes back in a
// WebView (a bank/card hosted page), and wait for that page's own JS to call
// back into a bridge shaped {"event_name":"payment_status","status":...,
// "message":...} — see HostedCheckoutWebViewScreen.tsx. Confirmed via a live
// device trace: calling this with method=netbanking through the JSON-order
// path (getCheckoutDetails) returns exactly this HTML/bridge-callback shape
// instead of an order, matching the old native Android app's
// PaymentWebviewActivity design exactly (not a bug to "fix" with different
// params — it's the intended contract for these methods).

export interface HostedCheckoutRequest {
  uri:  string
  body: string
}

export interface HostedCheckoutCard {
  number:      string
  expiryMonth: string
  expiryYear:  string
  cvv:         string
}

export async function getHostedCheckoutRequest(
  packageId: string,
  amount: number,
  method: 'netbanking' | 'card' | 'upi',
  bank?: string,
  card?: HostedCheckoutCard,
): Promise<HostedCheckoutRequest | null> {
  const [userId, userName, appType, lang, atn, rtn] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem(SK.User.NAME),
    getItem(SK.Auth.APP_TYPE),
    getItem(SK.Auth.LANG),
    getItem(SK.Auth.TOKEN),
    getItem(SK.Auth.REFRESH_TOKEN),
  ])
  if (!userId) return null

  const name = userName ?? ''
  const fields: Record<string, string> = {
    name,
    amount: String(amount),
    method,
    // Angular sends this for every method sharing this code path, not just
    // card — replicated as-is rather than "cleaned up" for netbanking.
    cardHolderName: name,
    // Angular: netbanking.page.ts GoToPayment() — the exact fallback string
    // used when a real browser user agent isn't available (RN has none).
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.4430.93',
    APPTYPE:   appType ?? '115',
    productId: packageId,
    ID:        userId,
    LANG:      lang ?? 'en',
    ATN:       atn ?? '',
    RTN:       rtn ?? '',
  }
  if (bank) fields.bank = bank
  // Angular: pay-using-credit-debit.page.ts loadPaymentView() — these four
  // are sent as plain form fields to the SAME hosted-webview endpoint (not
  // through any Razorpay SDK); the backend's card code path 500s without
  // them (confirmed live — a Node stack trace surfaced when they were
  // missing).
  if (card) {
    fields.cardNumber       = card.number
    fields.cardExpiryMonth  = card.expiryMonth
    fields.cardExpiryYear   = card.expiryYear
    fields.cardCvv          = card.cvv
  }

  const body = Object.entries(fields)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')

  return { uri: Endpoints.payment.checkout, body }
}

// ─── Web hosted checkout (browser only) — real form POST, new tab ───────────
// react-native-webview has no web build, so the native WebView rendering of
// the {uri, body} pair above (HostedCheckoutWebViewScreen.tsx) doesn't work
// on web. A real browser <form> POST is the direct equivalent — it navigates
// a new tab straight to the same bank/gateway hosted page with the exact
// same fields, matching what the WebView does under the hood. The caller is
// responsible for polling checkPaymentStatus() in the original tab afterwards
// (see PaymentFailedScreen.tsx's existing 'pending' poll for the pattern) —
// there's no cross-origin way to read the new tab's outcome directly.
export function submitHostedCheckoutFormOnWeb(request: HostedCheckoutRequest): void {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = request.uri
  form.target = '_blank'
  form.style.display = 'none'

  for (const pair of request.body.split('&')) {
    if (!pair) continue
    const [key, value] = pair.split('=')
    const input = document.createElement('input')
    input.type  = 'hidden'
    input.name  = decodeURIComponent(key ?? '')
    input.value = decodeURIComponent((value ?? '').replace(/\+/g, ' '))
    form.appendChild(input)
  }

  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)
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
      name:        'BharatJodii Matrimony',
      prefill: {
        contact: checkoutDetail.MOBILENO ?? '',
        email:   'bharatjodii@matrimony.com',
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
      name:     'BharatJodii Matrimony',
      method:   { upi: true },
      'upi.vpa': upiDetails.VPA ?? '',
      theme: { color: '#C62828' },
    })
    return { success: true, response }
  } catch (error: any) {
    return { success: false, response: error }
  }
}

// ─── Web checkout (browser only) — Razorpay Standard Checkout JS SDK ─────────
// react-native-razorpay has no web build (single native-only entry point,
// confirmed against its package.json) — this is the browser sibling of
// initUPIPayment() above, using Razorpay's own hosted checkout.js script
// instead of the native bridge. Same options shape, same
// Promise<{success, response}> contract, so call sites only need to branch
// on Platform.OS to pick this over the native function.

let razorpayScriptPromise: Promise<void> | null = null

function loadRazorpayCheckoutScript(): Promise<void> {
  if (razorpayScriptPromise) return razorpayScriptPromise
  razorpayScriptPromise = new Promise((resolve, reject) => {
    if ((window as any).Razorpay) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Razorpay checkout script'))
    document.body.appendChild(script)
  })
  return razorpayScriptPromise
}

export async function initRazorpayWebCheckout(
  upiDetails: any,
  saltKey: string,
): Promise<{ success: boolean; response: any }> {
  try {
    await loadRazorpayCheckoutScript()
    return await new Promise(resolve => {
      const razorpay = new (window as any).Razorpay({
        key:       saltKey,
        amount:    upiDetails.amount,
        currency:  'INR',
        order_id:  upiDetails.orderId ?? '',
        name:      'BharatJodii Matrimony',
        method:    { upi: true },
        'upi.vpa': upiDetails.VPA ?? '',
        theme:     { color: '#C62828' },
        handler:   (response: any) => resolve({ success: true, response }),
        modal: {
          // Same "user cancelled" shape the native bridges' back-press/
          // AppState-timeout paths resolve with (see initRazorpayNative()).
          ondismiss: () => resolve({ success: false, response: { code: 0, description: 'Payment cancelled' } }),
        },
      })
      razorpay.on('payment.failed', (resp: any) => resolve({ success: false, response: resp?.error ?? resp }))
      razorpay.open()
    })
  } catch (error: any) {
    return { success: false, response: error }
  }
}

// ─── Web checkout — app-targeted UPI (GPay/PhonePe/Paytm) ────────────────────
// Angular: payment.service.ts initCustomPayment() — the actual production
// path when tapping a specific UPI app row on the web/PWA build (traced via
// callNativeForUPIPayment(): the PAYSOURCE=='1' + FUNC.isPwaApp() branch
// calls getCheckoutdetails(...,'upi',...) → initCustomPayment(), never the
// native appNativeEvent bridge). Uses Razorpay JS SDK's "Custom Checkout"
// createPayment(options, {app}) API, which redirects straight into the named
// app's own UPI deep link — the web equivalent of the native bridges'
// upiAppPackageName targeting (see initRazorpayNative/initPayUNative above).
// Angular also has a separate, unused handleIOSPayment()/getIOSUPIApps() pair
// that hand-rolls raw tez://\/phonepe:// scheme redirects — confirmed dead
// code (no caller anywhere but its own spec test) and NOT ported here;
// createPayment(options, {app}) already does this internally.
// PAYSOURCE=='2' (PayU) has no web/PWA path at all in Angular either — that
// branch unconditionally fires appNativeEvent with no isPwaApp() check, i.e.
// PayU-via-GPay simply isn't available outside the native app. Callers here
// should only reach this function for the PAYSOURCE=='1' case; PAYSOURCE=='2'
// on web should fall back to the generic initRazorpayWebCheckout below.
const RAZORPAY_WEB_APP_IDS: Record<string, string> = {
  PAY_GPAY:    'gpay',
  PAY_PHONEPE: 'phonepe',
  PAY_PAYTM:   'paytm',
}

export function razorpayWebAppId(key: string): string | undefined {
  return RAZORPAY_WEB_APP_IDS[key]
}

// Angular: triggerWithUserGesture() — createPayment()'s app-intent redirect
// needs a real, synchronous user-gesture context; by the time this runs we're
// several `await`s past the original button press, which some mobile
// browsers no longer treat as "trusted" for a location redirect. A synthetic
// click on a real, invisible DOM button re-establishes one immediately before
// the call, matching Angular's own workaround exactly.
function triggerWithUserGesture(callback: () => void): void {
  const btn = document.createElement('button')
  btn.style.cssText = 'position:fixed;opacity:0;pointer-events:none;z-index:99999;top:0;left:0;width:100%;height:100%;'
  document.body.appendChild(btn)
  btn.addEventListener('click', () => {
    callback()
    document.body.removeChild(btn)
  }, { once: true })
  btn.click()
}

export async function initRazorpayWebUpiAppPayment(
  checkoutDetail: any,
  appId: string,
  appLabel: string,
  saltKey: string,
): Promise<{ success: boolean; response: any }> {
  try {
    await loadRazorpayCheckoutScript()
    return await new Promise(resolve => {
      const razorpay = new (window as any).Razorpay({ key: saltKey })
      const options: Record<string, any> = {
        amount:   checkoutDetail.amount,
        currency: 'INR',
        method:   'upi',
        contact:  checkoutDetail.MOBILENO ?? '',
        email:    'bharatjodii@matrimony.com',
        order_id: checkoutDetail.orderId ?? '',
      }
      // Angular: initCustomPayment() — recurring/customer_id are only added
      // for an autopay-mandate order (RENEWALFLAG-driven), matching the
      // native bridges' own `recurring`/`customerId` handling.
      if (checkoutDetail.recurring === '1') {
        options.recurring   = 1
        options.customer_id = checkoutDetail.customerId
      }
      razorpay.on('payment.success', (response: any) => resolve({ success: true, response }))
      // Angular: rzp.on('payment.error', ...) — 'intent_no_apps_error' means
      // the named app isn't installed/reachable; Angular shows a plain toast
      // for this case rather than routing through the normal payment-failed
      // retry flow (showPaymentNoappError(), never showPaymentFailure()).
      razorpay.on('payment.error', (resp: any) => {
        if (resp?.error?.reason === 'intent_no_apps_error') {
          resolve({
            success: false,
            response: { code: 0, description: `${appLabel} app is not available on your mobile.`, noAppAvailable: true },
          })
        } else {
          resolve({ success: false, response: resp?.error ?? resp })
        }
      })
      triggerWithUserGesture(() => razorpay.createPayment(options, { app: appId }))
    })
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

// Angular DOES have installed-UPI-app detection in the old hybrid webview —
// HomeScreenActivity.java's passUPIAppsToWebview() calls
// Razorpay.getAppsWhichSupportUpi() natively and hands the list to
// index.html's sendUPIAppsList(), which stores it as localStorage['UPIAPPS']
// (JSON [{AppName,AppPkgName}]) for payment-mode.page.ts's loadUPIApp() to
// read — this mirrors that on-device detection step; getServerFilteredUpiApps()
// below mirrors the round-trip through nbapplicationpay that Angular does
// with this same list before trusting any of it.
export function getUpiAppList(): Promise<UpiAppInfo[]> {
  if (!RazorpayBridge || !razorpayBridgeEmitter) return Promise.resolve([])
  return new Promise(resolve => {
    let settled = false
    const settle = (apps: UpiAppInfo[]) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      sub.remove()
      resolve(apps)
    }
    const sub = razorpayBridgeEmitter.addListener('RazorpayUpiApps', (result: { apps?: UpiAppInfo[] }) => {
      settle(result?.apps ?? [])
    })
    // getMenuPromo() (via getAutoUpiFlag()) now calls this on every plain
    // Home-screen load, awaited inline — if the native 'RazorpayUpiApps'
    // event never fires (missing Android 11+ <queries> package-visibility
    // entry, an SDK-internal failure, etc.) this Promise previously hung
    // forever with no timeout and no try/catch around the native call,
    // freezing whatever screen awaited it. A stuck detection list is far
    // less harmful than a stuck screen, so fail safe to [] instead.
    const timer = setTimeout(() => settle([]), 4000)
    try {
      RazorpayBridge.getAppsWhichSupportUpi()
    } catch {
      settle([])
    }
  })
}

// Angular: payment-mode.page.ts loadUPIApp()/allnbapplicationpay() — sends
// the device-detected UPI app list to the backend and uses ONLY the
// server-returned METHODOFPAY subset to decide which apps are actually
// usable (isGPay/isPhonePe/isPaytm all derive from this response, never from
// the raw on-device list directly) — a merchant/region-level filter beyond
// "is it installed" that getUpiAppList() alone can't apply.
export async function getServerFilteredUpiApps(installedApps: UpiAppInfo[]): Promise<UpiAppInfo[]> {
  if (installedApps.length === 0) return []
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const paymentApp = JSON.stringify(
    installedApps.map(app => ({ AppName: app.appName, AppPkgName: app.packageName })),
  )
  const params = `ID=${userId}&paymentApp=${encodeURIComponent(paymentApp)}`
  const result = await apiCall(Endpoints.payment.applicationPay, 'POST', params)
  if (result?.ERRCODE !== '0' || !Array.isArray(result?.RESPONSE?.METHODOFPAY)) return []
  return result.RESPONSE.METHODOFPAY.map((item: any) => ({
    appName:     String(item?.AppName ?? ''),
    packageName: String(item?.AppPkgName ?? ''),
  }))
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
  const options: NativeCheckoutOptions = { ...rawOptions, email: rawOptions.email || 'bharatjodii@matrimony.com' }

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
    const failureSub = payUBridgeEmitter.addListener('PayUPaymentFailure', data => {
      // NaN-safe, matching normalizeNativeFailure()'s Razorpay path below —
      // `Number(data?.errorCode) || 1` treated a legitimate errorCode of 0 as
      // falsy and silently remapped it to 1, indistinguishable from a real
      // "unknown error" code.
      const numericCode = Number(data?.errorCode)
      settle({
        success: false,
        response: {
          code:        Number.isNaN(numericCode) ? 1 : numericCode,
          description: data?.errorMessage || 'Payment could not be completed.',
        },
      })
    })
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
    const nativeOptions = si ? {
      ...rest,
      si:                true,
      siBillingAmount:   si.billingAmount,
      siBillingCurrency: si.billingCurrency,
      siBillingCycle:    si.billingCycle,
      siBillingInterval: si.billingInterval,
      siPaymentStartDate: si.paymentStartDate,
      siPaymentEndDate:   si.paymentEndDate,
    } : rest
    try {
      PayUBridge.openCheckout(nativeOptions)
    } catch (err: any) {
      if (__DEV__) console.error('[PayU] openCheckout threw:', err?.message, err?.stack)
      settle({ success: false, response: { code: 0, description: err?.message || 'PayU bridge threw' } })
    }
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

// ─── Payment failed detail (rich retry sheet) ──────────────────────────────
// Angular: payment-failed.page.ts nbpaymentfaileddet() — PAGETYPE is entirely
// server-decided (confirmed: the client only ever sends ID/ORDERID/TYPE/
// APPVERSION, never a renewal/autopay signal); the client just renders
// whichever PAGETYPE comes back. '0' = plain payment-method radio-picker +
// single Retry button; '4'/'5' = auto-renewal promo variant (discount/timer/
// bonus-contacts breakdown) — '1'/'2' aren't ported yet, callers should treat
// any unrecognized PAGETYPE as '0'.
export interface PaymentFailedDetail {
  pageType:               string
  title?:                 string | undefined   // PAYFAILEDTITLE — real dynamic promo copy, not a fixed string
  content?:               string | undefined   // PAYFAILEDCONTENT
  packageName?:           string | undefined
  packageDuration?:       string | undefined
  packageCost?:           string | undefined   // bare number, no ₹ — Angular prepends it at render time
  totalAmt?:              string | undefined
  paidAmt?:               string | undefined
  discountAmt?:           string | undefined
  discountTitle?:         string | undefined
  extraDiscountTitle?:    string | undefined
  profileCount?:          string | undefined
  extraContact?:          string | undefined
  timerEndMs?:            number | undefined
  paymentMethods:         PaymentMethodItem[]
  otherPaymentModesLabel?: string | undefined
}

function resolveTimerEnd(offEndTime?: string | number): number | undefined {
  if (offEndTime == null || offEndTime === '') return undefined
  const asNum = Number(offEndTime)
  // Angular's looksLikeDate()/toMs() sniff — small numbers are seconds-from-
  // now, large ones (>10-digit) are already an absolute epoch in ms.
  if (!isNaN(asNum) && asNum > 0) return asNum > 10_000_000_000 ? asNum : Date.now() + asNum * 1000
  const parsed = Date.parse(String(offEndTime))
  return isNaN(parsed) ? undefined : parsed
}

// The API's *TITLE/*CONTENT fields are meant for Angular's [innerHTML] — RN
// has no innerHTML, so strip tags rather than let literal markup show up.
// Exported since several *TEXT/*CONTENT-style fields across the payment and
// membership APIs carry the same inline markup (e.g. MEMBERSHIPDETAILS.
// packexpirytext's "<span>...</span>"-wrapped date, confirmed via a live
// account showing the raw tags in MenuContactsScreen.tsx before this fix).
export function stripHtml(value?: string): string | undefined {
  if (!value) return value
  return value.replace(/<[^>]+>/g, '').trim()
}

export async function getPaymentFailedDetail(orderId: string): Promise<PaymentFailedDetail | null> {
  const [userId, appVersion] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem('APPVERSION'),
  ])
  const params = `ID=${userId ?? ''}&ORDERID=${orderId}&TYPE=POPUP&APPVERSION=${appVersion ?? ''}`
  const result = await apiCall(Endpoints.payment.failedDetails, 'POST', params)
  if (result?.ERRCODE !== '0' || !result?.RESPONSE) return null

  const r = result.RESPONSE
  return {
    pageType:           String(r.PAGETYPE ?? '0'),
    title:              stripHtml(r.PAYFAILEDTITLE),
    content:            stripHtml(r.PAYFAILEDCONTENT),
    packageName:        r.PACKAGENAME,
    packageDuration:    r.PACKAGEDURATION,
    packageCost:        r.PACKAGECOST,
    totalAmt:           r.TOTALAMT,
    paidAmt:            r.PAIDAMT,
    discountAmt:        r.DISCOUNTAMT,
    discountTitle:      r.DISCOUNTTITLE,
    extraDiscountTitle: r.EXTRADISCOUNTTITLE,
    profileCount:       r.PROFILECOUNT,
    extraContact:       r.EXTRACONTACT,
    timerEndMs:         resolveTimerEnd(r.OFFEDTIME),
    paymentMethods:     Array.isArray(r.PAYMENTMETHODS) ? r.PAYMENTMETHODS : [],
    otherPaymentModesLabel: r.OTHERPAYMENTMODES,
  }
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
