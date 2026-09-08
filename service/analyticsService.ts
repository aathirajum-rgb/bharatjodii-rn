// Analytics service — replaces Angular's Firebase web SDK + appNativeEvent bridge.
//
// Angular's AnalyticsService.analyticsTrackCall() only relayed events through
// the native WebView bridge (triggerAppNativeEvent/appNativeEvent) when running
// *inside* the old hybrid app on a newer app version; otherwise (PWA/web, or an
// older app version) it called Firebase's web SDK directly — see
// `/Users/navaneethemahavishnu/Documents/Jodi angular/nbpwa/src/app/services/analytics.service.ts`.
// This RN app IS the native layer now, so there's no bridge to relay through —
// we always take the "call Firebase directly" branch, just with the native
// @react-native-firebase/analytics SDK instead of the web one.
//
// AppsFlyer mirrors the Android native app's NBAppApplication.appsFlyerCheck()
// (devKey, INR currency, IMEI/AndroidID collection off, "h0rB" invite OneLink,
// setCustomerUserId) — see the Android source for the exact reference. The
// conversion-data listener is deliberately NOT ported: nothing downstream in
// this RN app consumes that attribution data yet (unlike Android's
// HomeScreenActivity, which fed it to the webview), so wiring it now would
// just be dead data with nowhere to flow. The deep-link listener IS wired
// (see initAnalytics()) — OneLink resolution feeds deepLinkService.ts's
// resolvePageId(), the same page_id landing path App Links/custom-scheme
// links use.
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { Platform } from 'react-native'
import { getItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { resolvePageId } from './deepLinkService'

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

// Both SDKs are native-only (no web shim, no Expo Go support) — same guard
// pattern as notificationService.ts's supportsFirebaseMessaging.
const supportsNativeSDKs = !isExpoGo && Platform.OS !== 'web'

// Untyped (`any`) on purpose: react-native-appsflyer's index.d.ts transitively
// imports its PurchaseConnector model types, which don't compile under this
// project's `exactOptionalPropertyTypes: true` (a pre-existing issue in the
// package's own types, unrelated to anything used here — we never touch
// PurchaseConnector). Statically importing its types at all pulls that whole
// graph in, so both SDKs are loaded via plain `require()` and kept untyped.
let firebaseAnalyticsModule: any = null
let appsFlyerModule: any = null
let appsFlyerInitialized = false

// @react-native-firebase/analytics uses the modular API (getAnalytics/logEvent/
// logScreenView as free functions taking an Analytics instance) — same style
// as notificationService.ts's getMessaging()/getToken(), not a callable default.
function getFirebaseAnalytics() {
  if (!supportsNativeSDKs) return null
  if (!firebaseAnalyticsModule) {
    // Lazy require — native module, must never be touched in Expo Go/web.
    firebaseAnalyticsModule = require('@react-native-firebase/analytics')
  }
  try {
    // Throws SYNCHRONOUSLY (not a rejected promise) when no native Firebase
    // app has been initialized — e.g. a local build with no
    // GoogleService-Info.plist/google-services.json. That throw happened
    // before either caller's own .catch() could attach, surfacing as an
    // uncaught promise rejection on every screen view / event. Analytics
    // must degrade to a no-op here the same as any other analytics failure.
    return firebaseAnalyticsModule.getAnalytics()
  } catch {
    return null
  }
}

function getAppsFlyer(): any {
  if (!supportsNativeSDKs) return null
  if (!appsFlyerModule) {
    appsFlyerModule = require('react-native-appsflyer').default
  }
  return appsFlyerModule
}

// Firebase event/screen names must be letters/digits/underscores only, start
// with a letter, ≤40 chars — mirrors Android AnalyticsManager.kt's regex strip
// of spaces/dashes/dots from the category string used as the event name.
function sanitizeEventName(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40)
  return /^[a-zA-Z]/.test(cleaned) ? cleaned : `e_${cleaned}`.slice(0, 40)
}

export interface IAnalyticsEvent {
  category: string
  action: string
  label?: string
}

// ─── Firebase ─────────────────────────────────────────────────────────────────

function _logFirebaseEvent(name: string, params?: Record<string, any>): void {
  if (__DEV__) console.log('[GA Event]', name, params)
  const analytics = getFirebaseAnalytics()
  if (!analytics || !name) return
  // @react-native-firebase/analytics@26's modular logEvent() discards the
  // native call with `void analytics.logEvent(...)` and has no return
  // statement, so it always yields undefined — chaining .catch() on that (as
  // this used to) throws "Cannot read property 'catch' of undefined"
  // synchronously inside the caller's onPress handler, crashing the JS
  // thread on every tab switch. Nothing here is awaitable, so there's
  // nothing to catch.
  firebaseAnalyticsModule.logEvent(analytics, sanitizeEventName(name), params)
}

function _logFirebaseScreen(screenName: string): void {
  if (__DEV__) console.log('[GA Screen]', screenName)
  const analytics = getFirebaseAnalytics()
  if (!analytics || !screenName) return
  firebaseAnalyticsModule
    .logScreenView(analytics, { screen_name: screenName, screen_class: screenName })
    .catch(() => {})
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function logEvent(event: IAnalyticsEvent): void {
  _logFirebaseEvent(event.category, { action: event.action, label: event.label ?? '' })
}

export function logScreen(screenName: string): void {
  _logFirebaseScreen(screenName)
}

export function logAppsFlyer(
  eventName: string,
  values: Array<{ key: string; value: any }> = [],
): void {
  const params: Record<string, any> = {}
  values.forEach(({ key, value }) => { params[key] = value })
  if (__DEV__) console.log('[AppsFlyer]', eventName, params)
  const appsFlyer = getAppsFlyer()
  if (!appsFlyer || !appsFlyerInitialized || !eventName) return
  appsFlyer.logEvent(eventName, params).catch(() => {})
}

export function setAppsFlyerUserId(matriId: string): void {
  if (__DEV__) console.log('[AppsFlyer User]', matriId)
  const appsFlyer = getAppsFlyer()
  if (!appsFlyer || !appsFlyerInitialized || !matriId) return
  appsFlyer.setCustomerUserId(matriId)
}

// ─── One-time startup init (App.tsx) ──────────────────────────────────────────
// Firebase Analytics needs no explicit init — @react-native-firebase/app auto-
// initializes from the per-flavor google-services.json already in place.
// AppsFlyer does need one, matching Android's Application.onCreate() timing.
export async function initAnalytics(): Promise<void> {
  const appsFlyer = getAppsFlyer()
  if (!appsFlyer) return

  // No devKey configured yet (envs/.env.template's EXPO_PUBLIC_APPSFLYER_DEV_KEY
  // is blank by default) — skip quietly rather than initSdk() with a bad key.
  const devKey = process.env.EXPO_PUBLIC_APPSFLYER_DEV_KEY
  if (!devKey) {
    if (__DEV__) console.log('[AppsFlyer] no devKey configured, skipping init')
    return
  }

  try {
    await appsFlyer.initSdk({
      devKey,
      isDebug: __DEV__,
      onInstallConversionDataListener: false,
      onDeepLinkListener: true,
    })
    appsFlyerInitialized = true

    // OneLink resolution (deferred or direct, "h0rB" invite template below) —
    // marketing configures the OneLink's `deep_link_value` to carry our
    // page_id contract (deepLinkService.ts). Anything else (old marketing
    // links with no page_id, or deepLinkStatus != 'FOUND') is a no-op fallback
    // to the normal registration/Matches landing, same graceful-degradation
    // pattern pageLandingService.ts uses everywhere else.
    appsFlyer.onDeepLink((res: any) => {
      const pageId = res?.deepLinkStatus === 'FOUND' ? res?.data?.deep_link_value : undefined
      if (pageId) resolvePageId(String(pageId))
    })

    appsFlyer.setCurrencyCode('INR')
    appsFlyer.setCollectIMEI(false)
    appsFlyer.setCollectAndroidID(false)
    appsFlyer.setAppInviteOneLinkID('h0rB')

    const matriId = (await getItem(SK.Auth.USER_ID)) || (await getItem('DEVICEID')) || ''
    if (matriId) appsFlyer.setCustomerUserId(matriId)
  } catch {
    // non-fatal — app must work fine with analytics unavailable
  }
}

// ─── Unified event dispatcher ─────────────────────────────────────────────────
// Replaces Angular's triggerAppNativeEvent(). Handles every event_name the
// Angular bridge used, mapping them to the correct native RN action.

export interface INativeEvent {
  event_name: string
  [key: string]: any
}

export function dispatchNativeEvent(event: INativeEvent): void {
  if (!event?.event_name) return

  switch (event.event_name) {
    case 'eventGATrack':
      _logFirebaseEvent(event.eventCategory ?? '', {
        action: event.eventAction,
        label:  event.lable ?? event.label,
      })
      break

    case 'screenGATrack':
      _logFirebaseScreen(event.screenName ?? '')
      break

    case 'apps_flyer':
      logAppsFlyer(event.data ?? '', event.values ?? [])
      break

    case 'apps_flyer_userid':
      setAppsFlyerUserId(event.matriid ?? '')
      break

    // login_data is parsed by registrationService.storeWebURLData — no bridge needed
    case 'login_data':
      if (__DEV__) console.log('[login_data received]')
      break

    // Language change is handled directly in languageService
    case 'change_language':
      if (__DEV__) console.log('[change_language]', event.lang)
      break

    // FCM token refresh is handled by notificationService
    case 'getFcmToken':
      if (__DEV__) console.log('[getFcmToken requested]')
      break

    // Logout is handled by the auth store / clearSession in apiClient
    case 'logout':
      if (__DEV__) console.log('[logout event]')
      break

    // Chat push: handed to notificationService.scheduleLocalNotification
    case 'Chat_Notification':
      if (__DEV__) console.log('[Chat_Notification]', event.result)
      break

    // page_rendered: used by payment SDK setup — handled in paymentService
    case 'page_rendered':
      if (__DEV__) console.log('[page_rendered]', event.page_name)
      break

    default:
      if (__DEV__) console.log('[NativeEvent unhandled]', event)
  }
}
