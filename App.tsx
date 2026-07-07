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
import './i18n'
import i18n from './i18n'
import { StorageKeys } from './constants/storage.keys'
import { AuthProvider } from './contexts/AuthContext'
import { useOTAUpdate } from './hooks/useOTAUpdate'
import RootNavigation from './navigation/RootNavigation'
import { setupNotificationHandlers } from './service/notificationService'
import { getItem, setItem } from './service/storageService'

// Keep native splash visible until SplashAnimationScreen mounts and calls hideAsync()
SplashScreen.preventAutoHideAsync()

// Mirrors what the old native app injected into the WebView URL on launch.
// Must run before any API call so buildCommonParams reads correct values.
async function initializeAppConfig(): Promise<void> {
  const appType = String(Constants.expoConfig?.extra?.appType ?? process.env.EXPO_PUBLIC_APP_TYPE ?? '115')
  const version = Constants.expoConfig?.version ?? '1.0.0'

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
}

export default function App() {
  useOTAUpdate()
  const [appReady, setAppReady] = useState(false)

  // Load Poppins — all weights used across the Figma design.
  // Keys match themes/typography.ts FontFamilies.english so every component
  // that sets fontFamily: 'Poppins-Regular' etc. gets the real typeface.
  const [fontsLoaded] = useFonts({
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
    // Config must finish before AuthProvider mounts and reads storage
    initializeAppConfig().then(() => setAppReady(true))
  }, [])

  // Wait for both app config AND fonts before rendering anything
  if (!appReady || !fontsLoaded) return null

  return (
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
  )
}
