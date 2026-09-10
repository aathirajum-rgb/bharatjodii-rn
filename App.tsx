import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { enableFreeze } from 'react-native-screens'
import './i18n'
import i18n from './i18n'
import { APP_VERSION } from './constants/appVersion'
import { StorageKeys } from './constants/storage.keys'
import { AuthProvider } from './contexts/AuthContext'
import { NetworkProvider } from './contexts/NetworkContext'
import { ErrorBoundary } from './components/error-boundary/ErrorBoundary'
import { initCrashLogger } from './utils/crashLogger'
import { useOTAUpdate } from './hooks/useOTAUpdate'
import { useNativeAppUpdate } from './hooks/useNativeAppUpdate'
import RootNavigation from './navigation/RootNavigation'
import { setupNotificationHandlers } from './service/notificationService'
import { initAnalytics } from './service/analyticsService'
import { getItem, setItem } from './service/storageService'
import { loadFonts } from './src/config/fonts'

// Keep native splash visible until SplashAnimationScreen mounts and calls hideAsync()
SplashScreen.preventAutoHideAsync()

// As early as possible, before anything else can throw.
initCrashLogger()

// Lets native-stack/bottom-tabs suspend re-renders of screens that are
// mounted but not visible (backgrounded tab, pushed-under stack screen) —
// per-screen `freezeOnBlur` options below only take effect once this has
// run. No-op on web (react-native-screens' isNativePlatformSupported check).
enableFreeze()

function makeRandomDeviceId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// Legacy native Android app sent Settings.Secure.ANDROID_ID as DEVICEID. This
// RN app ships under the exact same applicationId ('jodii.app'), so matching
// that scheme (rather than a freshly-generated random UUID) preserves device
// continuity for anyone upgrading from the old native APK — the backend's
// existing DEVICEID/REGISTERID pairing for that device keeps resolving to the
// same DEVICEID. No iOS equivalent existed in the legacy (Android-only) app,
// so iOS keeps the random-UUID-persisted-on-first-launch approach.
async function makeDeviceId(): Promise<string> {
  if (Platform.OS === 'android') {
    try {
      const { getAndroidId } = await import('expo-application')
      const androidId = getAndroidId()
      if (androidId) return androidId
    } catch {
      // fall through to random UUID
    }
  }
  return makeRandomDeviceId()
}

// Legacy: the old native Android app constructed this string itself (Java
// Build.* fields) and injected it into the WebView's localStorage — see
// registerFieldsFromNative() in the Angular shell's index.html. Nothing in
// this RN port ever built a replacement, so DEVICEDETAIL has been sent blank
// on every API call since the rewrite — confirmed as the cause of a backend
// SQL error ("Unknown column 'undefined'") on login/switchlanguage/v1, whose
// server-side code apparently parses individual fields out of this string.
// Format matches the legacy shape exactly: `{KEY=value, KEY=value, ...}`
// (not JSON — no quotes), so the backend's existing parser keeps working.
// WEBVERSION/WEBVIEWVERSION/WEBPACKAGE/OP_NAME are WebView/carrier-specific
// fields with no native-app equivalent and are intentionally omitted rather
// than faked.
async function buildDeviceDetail(deviceId: string): Promise<string> {
  const Device = await import('expo-device')
  const Application = await import('expo-application')

  const fields: Record<string, string> = {
    DEVICEID: deviceId,
    DEVICE: Device.designName ?? '',
    MODEL: Device.modelName ?? '',
    RELEASE: Device.osVersion ?? '',
    BRAND: Device.brand ?? '',
    APP_VERSION_NAME: Application.nativeApplicationVersion ?? APP_VERSION,
    APP_VERSION: String(Application.nativeBuildVersion ?? ''),
  }

  return `{${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(', ')}}`
}

// Mirrors what the old native app injected into the WebView URL on launch.
// Must run before any API call so buildCommonParams reads correct values.
// Returns the resolved language so the caller can kick off font loading —
// font loading is NOT awaited here, so a slow/hung CDN can never block config
// readiness (only the splash-screen gate below waits on fonts, with its own
// timeout).
async function initializeAppConfig(): Promise<string> {
  const appType = String(Constants.expoConfig?.extra?.appType ?? process.env.EXPO_PUBLIC_APP_TYPE ?? '115')
  const version = APP_VERSION

  // Persist a stable device ID on first install; reuse on subsequent launches
  let deviceId = await getItem('DEVICEID')
  if (!deviceId) {
    deviceId = await makeDeviceId()
    await setItem('DEVICEID', deviceId)
  }

  // Populate once; APP_VERSION_NAME/APP_VERSION inside it are static per
  // install anyway, so there's nothing to refresh on later launches.
  if (!(await getItem('DEVICEDETAIL'))) {
    await setItem('DEVICEDETAIL', await buildDeviceDetail(deviceId))
  }

  await Promise.all([
    setItem(StorageKeys.Auth.APP_TYPE, appType),
    setItem(StorageKeys.Auth.WEB_LOGIN, '0'),
    setItem('APPVERSION', version),
    setItem('GLASSBOXFLAG', '0'),
  ])

  let lang = await getItem(StorageKeys.Auth.LANG)
  if (!lang) {
    lang = 'en'
    await setItem(StorageKeys.Auth.LANG, lang)
  }
  await i18n.changeLanguage(lang)
  return lang
}

export default function App() {
  useOTAUpdate()
  useNativeAppUpdate()
  const [appReady, setAppReady] = useState(false)
  const [fontsReady, setFontsReady] = useState(false)

  useEffect(() => {
    const cleanup = setupNotificationHandlers()
    return cleanup
  }, [])

  // Fire-and-forget, non-blocking — mirrors Android's Application.onCreate()
  // timing without gating splash/appReady on it (analytics must never delay launch).
  useEffect(() => {
    initAnalytics()
  }, [])

  useEffect(() => {
    let cancelled = false

    // Config must finish before AuthProvider mounts and reads storage.
    // Catch any failure so the app never gets stuck on a black screen.
    initializeAppConfig()
      .then(lang => {
        // Fire-and-forget: loadFonts already catches its own errors and never
        // throws, but it isn't awaited here so a genuine network hang can't
        // also stall appReady — only the timeout below gates on it.
        loadFonts(lang).finally(() => {
          if (!cancelled) setFontsReady(true)
        })
      })
      .catch(() => {
        if (!cancelled) setFontsReady(true)
      })
      .finally(() => {
        if (!cancelled) setAppReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // Safety net: CDN font fetches can hang outright (not just error) — never
    // let a slow/broken font host keep the user stuck on the splash screen.
    const t = setTimeout(() => setFontsReady(true), 5000)
    return () => clearTimeout(t)
  }, [])

  if (!appReady || !fontsReady) return null

  return (
    // Required by react-native-gesture-handler (used by the Matches photo carousel) —
    // must sit as close to the actual app root as possible, or gestures anywhere in
    // the tree silently fail to be recognized.
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {/* Set once, centrally — dark icons on the app's white headers by default.
              Screens with a dark/colored top area (e.g. Splash, LanguageSelection)
              mount their own <StatusBar> to override; expo-status-bar restores this
              root setting automatically once that screen unmounts. */}
          <StatusBar style="dark" />
          <NetworkProvider>
            <AuthProvider>
              <RootNavigation />
            </AuthProvider>
          </NetworkProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}
