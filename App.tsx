import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import './i18n'
import i18n from './i18n'
import { APP_VERSION } from './constants/appVersion'
import { StorageKeys } from './constants/storage.keys'
import { AuthProvider } from './contexts/AuthContext'
import { useOTAUpdate } from './hooks/useOTAUpdate'
import RootNavigation from './navigation/RootNavigation'
import { setupNotificationHandlers } from './service/notificationService'
import { getItem, setItem } from './service/storageService'
import { loadFonts } from './src/config/fonts'

// Keep native splash visible until SplashAnimationScreen mounts and calls hideAsync()
SplashScreen.preventAutoHideAsync()

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
  const [appReady, setAppReady] = useState(false)
  const [fontsReady, setFontsReady] = useState(false)

  useEffect(() => {
    const cleanup = setupNotificationHandlers()
    return cleanup
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Set once, centrally — dark icons on the app's white headers by default.
            Screens with a dark/colored top area (e.g. Splash, LanguageSelection)
            mount their own <StatusBar> to override; expo-status-bar restores this
            root setting automatically once that screen unmounts. */}
        <StatusBar style="dark" />
        <AuthProvider>
          <RootNavigation />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
