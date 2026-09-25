// Native iOS StoreKit 2 In-App Purchase integration.
//
// Originally ported from the luv-rn app's Inapppurchase.swift + IAPContext.tsx
// + PaymentServices.ts + usePendingPurchase.ts (same NativeModules.Inapppurchase
// surface — see plugins/withIosStoreKitBridge.js for the native module and
// plugins/ios-native-src/inapppurchase/ for its source), then migrated from
// StoreKit 1 (whole-receipt/verifyReceipt) to StoreKit 2 + Apple's App Store
// Server API. Android/web keep using Razorpay/PayU (paymentService.ts) —
// everything in this file is iOS-only; every exported function/hook is a
// no-op (or throws, where a return value is required) on other platforms.
//
// The native module only ever hands JS a bare transaction id (never a
// receipt/JWS blob) — the backend (nbvpnode's JODII-535, src/nbpayment's
// iospayrecval) independently re-fetches and verifies that transaction from
// Apple's servers itself, so the client can't fake a "verified" result. The
// app never decides a purchase succeeded on its own; it only shows/considers
// membership active once this backend call returns SUCCESS or
// ALREADY_PROCESSED, and only finishes the StoreKit transaction at that point
// (see finishTransaction() calls below) — a killed app or dropped network
// call before that leaves the transaction unfinished, so StoreKit redelivers
// it via Transaction.updates on next launch instead of losing it.
import { useEffect, useRef, useState } from 'react'
import { NativeEventEmitter, NativeModules, Platform } from 'react-native'
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { getSessionValue } from './registrationService'
import { navigate } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'
import { logAppsFlyer } from './analyticsService'
import { getCheckoutDetails, handlePaymentSuccess, recordPaymentFailure, type SelectedPackage, type MembershipPlansData } from './paymentService'

const isIos = () => Platform.OS === 'ios'

const { Inapppurchase, IAPEventEmitter } = NativeModules

// ─── Types ──────────────────────────────────────────────────────────────────

export interface IosStoreKitProduct {
  id: string
  title: string
  description: string
  price: string
  localizedPrice: string
  currencyCode: string
  subscriptionUnit?: number
  subscriptionNumberOfUnits?: number
  introPrice?: string
  introDuration?: string
}

// Backend response shape confirmed against the real backend source
// (nbvpnode's src/iospayment/models/iospayLibrary.js iosPackageLogin() /
// src/nbpayment/models/offerLibrary.js iospackage() — both modules return
// the identical shape): { RESPONSE: { PRODUCTIDS: [{PACKKEY, PACKAGEID}] } }.
// No price field anywhere — this call only tells the client which App Store
// SKUs are valid for this account/country; StoreKit itself is the only price
// source (fetchProducts() below).
export interface IosPackageCatalogEntry {
  PACKKEY:    string  // internal membership package id — same id space as MembershipPlan.productid
  PACKAGEID:  string  // App Store SKU, e.g. "com.matrimony.jodii_3INR"
}

// ─── Package catalog (backend) ──────────────────────────────────────────────
// GET .../iospayment/iospackagelogin/{userId} — the App Store product IDs
// this account is allowed to buy. This decides *which* SKUs to ask StoreKit
// about; it is not itself a StoreKit call and carries no price.
export async function fetchIosPackages(): Promise<IosPackageCatalogEntry[]> {
  const userId = await getItem(SK.Auth.USER_ID)
  if (!userId) return []

  const cn = (await getSessionValue('IPCOUNTRYCODE')) ?? 'IN'
  const params = `CN=${cn}&ID=${userId}`
  const result = await apiCall(`${Endpoints.payment.iosPackageLogin}/${userId}`, 'GET', params)
  return Array.isArray(result?.RESPONSE?.PRODUCTIDS) ? result.RESPONSE.PRODUCTIDS : []
}

// ─── IOSPRODUCTIDS param (shared by nbpromotion/nbcustomer/nbmenu/nbpaybanner) ─
// iOS has no UPI/card/netbanking choice — Apple's own payment sheet is the
// only option — so those promo/menu/banner endpoints need to know the App
// Store catalog up front to annotate their plan/promo payloads with the
// right SKU + price. Shape confirmed from a live capture:
// {"<productId>":["<productId>","<price>"], ...}. The price in that map can
// only come from StoreKit (the backend catalog has none — see
// IosPackageCatalogEntry above), so this awaits the same refreshIosProducts()
// merge useIosIap() uses, rather than reading fetchIosPackages() directly.
export async function getIosProductIdsParam(): Promise<string> {
  if (!isIos()) return ''
  await refreshIosProducts()
  if (state.products.length === 0) return ''
  const map: Record<string, [string, string]> = {}
  for (const p of state.products) map[p.id] = [p.id, p.price]
  return JSON.stringify(map)
}

// ─── Membership-plan ↔ Apple SKU join ───────────────────────────────────────
// getMembershipPlans() (paymentService.ts) and fetchIosPackages() above come
// from two separate, unrelated backend endpoints that share no field name —
// plans key off `productid`, the iOS catalog off `PACKKEY` (same id space,
// per IosPackageCatalogEntry's comment above, confirmed against the backend
// source). Nothing previously joined the two, so MembershipPlan.iosProductId
// was always unset and RechargeScreen's iOS branch always hit its "not yet
// available for purchase on iOS" guard. Call this once after
// getMembershipPlans() resolves (see RechargeScreen.tsx's loadData()).
export async function attachIosProductIds(data: MembershipPlansData): Promise<MembershipPlansData> {
  if (!isIos()) return data
  const catalog = await fetchIosPackages()
  if (catalog.length === 0) return data
  const byPackKey = new Map(catalog.map(entry => [entry.PACKKEY, entry.PACKAGEID]))
  const attach = (plan: MembershipPlansData['plans'][number]) => {
    const iosProductId = byPackKey.get(plan.productid)
    return iosProductId ? { ...plan, iosProductId } : plan
  }
  return { ...data, plans: data.plans.map(attach), allPlans: data.allPlans.map(attach) }
}

// ─── Product context (StoreKit products) ────────────────────────────────────

interface IAPContextState {
  products: IosStoreKitProduct[]
  loading: boolean
}

const listeners = new Set<(state: IAPContextState) => void>()
let state: IAPContextState = { products: [], loading: true }

function setState(next: IAPContextState) {
  state = next
  for (const cb of listeners) cb(state)
}

let refreshInFlight: Promise<void> | null = null

// Fetches the backend's package catalog, then asks StoreKit to price exactly
// those product IDs, and merges the two. Safe to call more than once (e.g. on
// pull-to-refresh) — concurrent calls share one in-flight request.
export function refreshIosProducts(): Promise<void> {
  if (!isIos()) return Promise.resolve()
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    setState({ ...state, loading: true })
    try {
      const catalog = await fetchIosPackages()
      const productIds = catalog.map(entry => entry.PACKAGEID)
      if (productIds.length === 0) {
        setState({ products: [], loading: false })
        return
      }

      const storeKitProducts: IosStoreKitProduct[] = await Inapppurchase.fetchProducts(productIds)
      setState({ products: storeKitProducts, loading: false })
    } catch (err) {
      if (__DEV__) console.error('[iapService] refreshIosProducts failed:', err)
      setState({ ...state, loading: false })
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

// Mount once near the app root (see App.tsx) so the catalog is warm by the
// time RechargeScreen needs it. Safe to call from multiple components — all
// instances share the same underlying state.
export function useIosIap(): IAPContextState {
  const [local, setLocal] = useState(state)

  useEffect(() => {
    listeners.add(setLocal)
    if (isIos() && state.products.length === 0 && state.loading) refreshIosProducts()
    return () => { listeners.delete(setLocal) }
  }, [])

  return local
}

// ─── Backend verification ───────────────────────────────────────────────────
// POST payment/iospayrecval/v1 (nbvpnode's src/nbpayment, JODII-535) — sends
// only the transaction id; the backend independently calls Apple's App Store
// Server API to verify it before touching membership at all. Returns true
// for both STATUS SUCCESS and ALREADY_PROCESSED (a retried/replayed call for
// a transaction that already activated membership) — both mean the purchase
// is legitimately done and the StoreKit transaction can be finished.
async function verifyAndActivateIosMembership(transactionId: string, orderId: string): Promise<boolean> {
  const userId = await getItem(SK.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&ORDERID=${orderId}&TRANSACTIONID=${transactionId}`
  const result = await apiCall(Endpoints.payment.iosReceiptValidation, 'POST', params)
  const status = result?.RESPONSE?.STATUS
  return (result?.RESPONSECODE === '1' || result?.RESPONSECODE === 1)
    && (status === 'SUCCESS' || status === 'ALREADY_PROCESSED')
}

// ─── Purchase flow ──────────────────────────────────────────────────────────

// Same order-id-generation call Android's Razorpay flow uses
// (getCheckoutDetails → nbpaymentcheckout). No iOS-specific `method` value has
// been confirmed with backend yet — a live capture of this call showed no
// `method` field at all, only the IOSPRODUCTID/PAYMENTGATEWAY=APPLESTORE/
// IPADDRESS/CN/ONLINECHARGE fields getCheckoutDetails' iosDetails param now
// sends; treat this constant as provisional until backend confirms whether
// it's required, ignored, or actively wrong for the Apple path.
const IOS_CHECKOUT_METHOD = 'ios'

// Strips a pre-formatted price string (currency symbol, commas) down to the
// raw decimal ONLINECHARGE expects, e.g. "₹3,599.00" → "3599.00".
function toRawAmount(formatted: string): string {
  return formatted.replace(/[^0-9.]/g, '')
}

interface LastPurchaseAttempt {
  iosProductId: string
  selectedPackage: SelectedPackage
}

// StoreKit 2 delivers a transaction through BOTH product.purchase()'s direct
// return value AND the Transaction.updates stream that usePendingPurchase()
// listens to (Inapppurchase.swift's updatesTask observes it for the app's
// whole lifetime, starting before any purchase is ever made) — Apple's own
// docs/sample code confirm this isn't restricted to out-of-band transactions.
// Without this guard, every normal purchase gets independently verified,
// finished, and reported to AppsFlyer/navigated to PAYMENT_SUCCESS twice: once
// by handlePurchase() below, once by usePendingPurchase()'s event listener
// reacting to the same transaction a moment later.
//
// Keyed on orderId, not transactionId — Inapppurchase.swift's
// handle(updatedTransaction:) reads its orderId from the same UserDefaults
// key purchaseProduct() writes right before calling StoreKit, so the
// "pendingPurchase" event can in principle reach JS before
// Inapppurchase.purchaseProduct()'s own promise resolves with a
// transactionId. Reserving the orderId here, before that native call even
// starts, closes that window; the transaction id isn't known yet at that point.
const inFlightOrderIds = new Set<string>()

export function useHandlePurchase() {
  const [purchasing, setPurchasing] = useState(false)
  const lastAttempt = useRef<LastPurchaseAttempt | null>(null)

  const handlePurchase = async (iosProductId: string, selectedPackage: SelectedPackage) => {
    if (!isIos()) return
    lastAttempt.current = { iosProductId, selectedPackage }
    setPurchasing(true)
    try {
      // Prefer the StoreKit-quoted raw price (state.products, when the merged
      // catalog has been refreshed) over the backend's pre-formatted display
      // price — it's the amount Apple will actually charge.
      const storeKitProduct = state.products.find(p => p.id === iosProductId)
      const onlineCharge = storeKitProduct?.price
        ?? toRawAmount(selectedPackage.paidamt ?? selectedPackage.price)
      const checkout = await getCheckoutDetails(
        selectedPackage.PACKAGEID, IOS_CHECKOUT_METHOD, false, { iosProductId, onlineCharge },
      )
      const orderId = String(checkout?.orderId ?? '')
      if (!orderId) throw new Error('Could not generate an order ID for this purchase.')

      inFlightOrderIds.add(orderId)
      try {
        const result = await Inapppurchase.purchaseProduct(iosProductId, orderId)
        const transactionId = String(result?.transactionId ?? '')
        const verified = transactionId ? await verifyAndActivateIosMembership(transactionId, orderId) : false

        if (verified) {
          // Only finish the StoreKit transaction once the backend has actually
          // activated membership — see this file's header comment.
          await Inapppurchase.finishTransaction(transactionId)
          logAppsFlyer('af_purchase', [{ key: 'af_order_id', value: orderId }])
          await handlePaymentSuccess()
        } else {
          await failPurchase(selectedPackage, 'pending')
        }
      } finally {
        inFlightOrderIds.delete(orderId)
      }
    } catch (err: any) {
      // SKError.paymentCancelled surfaces here as a rejected promise — treat
      // a user-cancelled sheet as a silent no-op, not a "failure" screen.
      if (err?.code === 'E_PURCHASE_CANCELLED') {
        setPurchasing(false)
        return
      }
      if (err?.code === 'E_PURCHASE_PENDING') {
        await failPurchase(selectedPackage, 'pending', err?.message)
        setPurchasing(false)
        return
      }
      await failPurchase(selectedPackage, 'failure', err?.message)
    } finally {
      setPurchasing(false)
    }
  }

  const retryPurchase = () => {
    const attempt = lastAttempt.current
    if (attempt) handlePurchase(attempt.iosProductId, attempt.selectedPackage)
  }

  return { handlePurchase, retryPurchase, purchasing }
}

async function failPurchase(selectedPackage: SelectedPackage, status: 'failure' | 'pending', reason?: string) {
  await recordPaymentFailure(null, selectedPackage, { status, reason, retryRoute: 'recharge' })
  navigate(ENavigation.PAYMENT_FAILED, { selectedPackage, amountLabel: selectedPackage.price, status, reason, retryRoute: 'recharge' })
}

// ─── Pending-transaction recovery ───────────────────────────────────────────
// StoreKit 2's Transaction.updates stream (started at native module init —
// see Inapppurchase.swift) redelivers any transaction that finished while the
// app was killed/backgrounded/offline before the JS side finished verifying
// it with the backend, via the "pendingPurchase" event. Mount this once near
// the app root (see App.tsx).
export function usePendingPurchase() {
  useEffect(() => {
    if (!isIos() || !IAPEventEmitter) return

    const emitter = new NativeEventEmitter(IAPEventEmitter)
    const sub = emitter.addListener('pendingPurchase', async ({ transactionId, orderId }: { transactionId: string; productId: string; orderId: string }) => {
      // Same order is already being verified/finished by useHandlePurchase()'s
      // direct purchase() await — see inFlightOrderIds' definition above.
      // Skip it here; that path owns it and will finish it once its own
      // backend call resolves.
      if (inFlightOrderIds.has(orderId)) return
      try {
        const verified = await verifyAndActivateIosMembership(transactionId, orderId)
        if (verified) {
          await Inapppurchase.finishTransaction(transactionId)
          logAppsFlyer('af_purchase', [{ key: 'af_order_id', value: orderId }])
          await handlePaymentSuccess()
        }
        // No selectedPackage is available for a recovered transaction (the
        // app may have been killed before it was ever persisted) — unlike
        // handlePurchase's failure path, there's nothing useful to show a
        // "retry" screen for here, so a failed recovery is logged, not surfaced.
        // Deliberately not finished when unverified — it'll be redelivered
        // through this same event on a later launch instead of being lost.
      } catch (err) {
        if (__DEV__) console.error('[iapService] pending purchase recovery failed:', err)
      }
    })

    Inapppurchase?.checkPendingTransactions?.()
    return () => sub.remove()
  }, [])
}

// ─── Restore purchases ──────────────────────────────────────────────────────
// Apple requires a visible "Restore Purchases" affordance somewhere in
// Settings/account UI for non-consumable/subscription IAPs — see
// SettingsScreen.tsx's iOS-only row.
//
// KNOWN GAP: this only reports what StoreKit finds (data: the restored
// productId/transactionId pairs) — it does not re-activate membership.
// Doing that needs a backend decision first: a restored transaction has no
// app-generated OrderId (that only exists from a fresh getCheckoutDetails()
// checkout), and iospayrecval currently requires one to look up the
// ONLINEPAYMENTRESPONSECODE row MembershipUpgrade() credits against.
export async function restoreIosPurchases(): Promise<{ status: string; message?: string; data?: { productId: string; transactionId: string }[] }> {
  if (!isIos()) return { status: 'Failed', message: 'iOS only' }
  return Inapppurchase.restorePurchases()
}
