// Native iOS StoreKit In-App Purchase integration.
//
// Ported from the luv-rn app's Inapppurchase.swift + IAPContext.tsx +
// PaymentServices.ts + usePendingPurchase.ts (same NativeModules.Inapppurchase
// surface — see plugins/withIosStoreKitBridge.js for the native module and
// plugins/ios-native-src/inapppurchase/ for its source). Android/web keep
// using Razorpay/PayU (paymentService.ts) — everything in this file is
// iOS-only; every exported function/hook is a no-op (or throws, where a
// return value is required) on other platforms.
//
// jodii's backend is REST (not luv-rn's GraphQL/Apollo), so the wire format
// here differs from the reference app even though the native module and the
// overall flow (fetch catalog → fetch StoreKit products → generate order id →
// native purchase → verify receipt with backend) are the same shape.
//
// KNOWN GAP: there is no backend endpoint yet for iOS receipt verification /
// membership activation (nothing like luv-rn's IosVerifyAndActivateMembership
// mutation exists in this app's REST API) — confirmed absent anywhere in the
// codebase. verifyAndActivateIosMembership() below throws until that contract
// is available; wire the real endpoint in there once backend provides it.
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
import { getCheckoutDetails, handlePaymentSuccess, recordPaymentFailure, type SelectedPackage } from './paymentService'

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

export interface IosPackageCatalogEntry {
  ProductId: string
  Price: string
  LocalPrice: string
}

// Merged view: StoreKit's own localized price (what Apple will actually
// charge, in the device's App Store storefront) plus the backend's catalog
// entry for that same ProductId (so the checkout UI can cross-check/display
// the backend-quoted price too).
export interface IosIapProduct extends IosStoreKitProduct {
  backendPrice?: string | undefined
}

// ─── Package catalog (backend) ──────────────────────────────────────────────
// GET .../iospayment/iospackagelogin/{userId} — the App Store product IDs
// this account is allowed to buy, with backend-formatted prices. This decides
// *which* SKUs to ask StoreKit about; it is not itself a StoreKit call.
export async function fetchIosPackages(): Promise<IosPackageCatalogEntry[]> {
  const userId = await getItem(SK.Auth.USER_ID)
  if (!userId) return []

  const cn = (await getSessionValue('IPCOUNTRYCODE')) ?? 'IN'
  const params = `CN=${cn}&ID=${userId}`
  const result = await apiCall(`${Endpoints.payment.iosPackageLogin}/${userId}`, 'GET', params)
  return Array.isArray(result?.ProductArray) ? result.ProductArray : []
}

// ─── Product context (StoreKit products merged with the backend catalog) ───

interface IAPContextState {
  products: IosIapProduct[]
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
      const productIds = catalog.map(entry => entry.ProductId)
      if (productIds.length === 0) {
        setState({ products: [], loading: false })
        return
      }

      const storeKitProducts: IosStoreKitProduct[] = await Inapppurchase.fetchProducts(productIds)
      const backendPriceById = new Map(catalog.map(entry => [entry.ProductId, entry.Price]))

      const merged: IosIapProduct[] = storeKitProducts.map(product => ({
        ...product,
        backendPrice: backendPriceById.get(product.id),
      }))
      setState({ products: merged, loading: false })
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

// ─── Backend verification (PENDING — see file header) ──────────────────────

// TODO(backend contract pending): no REST endpoint exists yet for iOS receipt
// verification / membership activation. Once backend provides one (mirroring
// luv-rn's IosVerifyAndActivateMembership shape — orderId + the base64 App
// Store receipt), replace this body with the real apiCall(...) and drop the
// throw. Everything upstream (handlePurchase, usePendingPurchase) already
// treats a thrown/rejected call here as an ordinary payment failure, so
// wiring the real endpoint in is a drop-in change.
async function verifyAndActivateIosMembership(_encryptedReceiptData: string, _orderId: string): Promise<boolean> {
  throw new Error('iOS receipt verification endpoint not implemented yet — backend contract pending.')
}

// ─── Purchase flow ──────────────────────────────────────────────────────────

// Same order-id-generation call Android's Razorpay flow uses
// (getCheckoutDetails → nbpaymentcheckout). No iOS-specific `method` value has
// been confirmed with backend yet — getCheckoutDetails' own comment warns
// this endpoint is only confirmed to behave as a real order-creation call for
// 'upi'; treat this constant as provisional until backend confirms it.
const IOS_CHECKOUT_METHOD = 'ios'

interface LastPurchaseAttempt {
  iosProductId: string
  selectedPackage: SelectedPackage
}

export function useHandlePurchase() {
  const [purchasing, setPurchasing] = useState(false)
  const lastAttempt = useRef<LastPurchaseAttempt | null>(null)

  const handlePurchase = async (iosProductId: string, selectedPackage: SelectedPackage) => {
    if (!isIos()) return
    lastAttempt.current = { iosProductId, selectedPackage }
    setPurchasing(true)
    try {
      const checkout = await getCheckoutDetails(selectedPackage.PACKAGEID, IOS_CHECKOUT_METHOD)
      const orderId = String(checkout?.orderId ?? '')
      if (!orderId) throw new Error('Could not generate an order ID for this purchase.')

      const result = await Inapppurchase.purchaseProduct(iosProductId, orderId)
      const verified = await verifyAndActivateIosMembership(result?.productId, orderId)

      if (verified) {
        logAppsFlyer('af_purchase', [{ key: 'af_order_id', value: orderId }])
        await handlePaymentSuccess()
      } else {
        await failPurchase(selectedPackage, 'pending')
      }
    } catch (err: any) {
      // SKError.paymentCancelled surfaces here as a rejected promise — treat
      // a user-cancelled sheet as a silent no-op, not a "failure" screen.
      if (err?.code === 'E_PURCHASE_CANCELLED') {
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
// If the app is killed/backgrounded between StoreKit finishing a transaction
// and the JS promise resolving, Inapppurchase.swift stashes the receipt in
// UserDefaults instead of losing it. Mount this once near the app root (see
// App.tsx) — on every launch it asks the native side to replay any such
// stashed transaction via the "pendingPurchase" event.
export function usePendingPurchase() {
  useEffect(() => {
    if (!isIos() || !IAPEventEmitter) return

    const emitter = new NativeEventEmitter(IAPEventEmitter)
    const sub = emitter.addListener('pendingPurchase', async ({ receipt, orderId }: { receipt: string; productId: string; orderId: string }) => {
      try {
        const verified = await verifyAndActivateIosMembership(receipt, orderId)
        if (verified) {
          logAppsFlyer('af_purchase', [{ key: 'af_order_id', value: orderId }])
          await handlePaymentSuccess()
        }
        // No selectedPackage is available for a recovered transaction (the
        // app may have been killed before it was ever persisted) — unlike
        // handlePurchase's failure path, there's nothing useful to show a
        // "retry" screen for here, so a failed recovery is logged, not surfaced.
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
export async function restoreIosPurchases(): Promise<{ status: string; message?: string; data?: string }> {
  if (!isIos()) return { status: 'Failed', message: 'iOS only' }
  return Inapppurchase.restorePurchases()
}
