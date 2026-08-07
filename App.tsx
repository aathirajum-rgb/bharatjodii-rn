import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_900Black,
  useFonts,
} from '@expo-google-fonts/poppins'
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
import { loadLangFonts } from './constants/fonts'

// Keep native splash visible until SplashAnimationScreen mounts and calls hideAsync()
SplashScreen.preventAutoHideAsync()

function makeDeviceId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// Mirrors what the old native app injected into the WebView URL on launch.
// Must run before any API call so buildCommonParams reads correct values.
async function initializeAppConfig(): Promise<void> {
  const appType = String(Constants.expoConfig?.extra?.appType ?? process.env.EXPO_PUBLIC_APP_TYPE ?? '115')
  const version = APP_VERSION

  // Persist a stable device ID on first install; reuse on subsequent launches
  let deviceId = await getItem('DEVICEID')
  if (!deviceId) {
    deviceId = makeDeviceId()
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
  await loadLangFonts(lang)
}

export default function App() {
  useOTAUpdate()
  const [appReady, setAppReady] = useState(false)
  const [fontTimeout, setFontTimeout] = useState(false)

  // Load Poppins — all weights used across the Figma design.
  // Keys match themes/typography.ts FontFamilies.english so every component
  // that sets fontFamily: 'Poppins-Regular' etc. gets the real typeface.
  const [fontsLoaded, fontsError] = useFonts({
    'Poppins-Regular':  Poppins_400Regular,
    'Poppins-Medium':   Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold':     Poppins_700Bold,
    'Poppins-Black':    Poppins_900Black,
  })

  useEffect(() => {
    const cleanup = setupNotificationHandlers()
    return cleanup
  }, [])

  useEffect(() => {
    // Config must finish before AuthProvider mounts and reads storage.
    // Catch any failure so the app never gets stuck on a black screen.
    initializeAppConfig()
      .catch(() => {})
      .finally(() => setAppReady(true))
  }, [])

  useEffect(() => {
    // Safety net: if Poppins hasn't loaded in 3 s (error or hung), proceed anyway.
    // The system fallback font renders until Poppins resolves on the next launch.
    const t = setTimeout(() => setFontTimeout(true), 3000)
    return () => clearTimeout(t)
  }, [])

  // Wait for app config. For fonts: proceed if loaded, errored, or timed out.
  const fontsReady = fontsLoaded || !!fontsError || fontTimeout
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
