import * as SplashScreen from 'expo-splash-screen'
import Constants from 'expo-constants'
import { useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import './i18n'
import i18n from './i18n'
import { AuthProvider } from './contexts/AuthContext'
import RootNavigation from './navigation/RootNavigation'
import { setupNotificationHandlers } from './service/notificationService'
import { getItem, setItem } from './service/storageService'
import { StorageKeys } from './constants/storage.keys'
import { useOTAUpdate } from './hooks/useOTAUpdate'

// Keep native splash visible until SplashAnimationScreen mounts and calls hideAsync()
SplashScreen.preventAutoHideAsync()

// Mirrors what the old native app injected into the WebView URL on launch.
// Must run before any API call so buildCommonParams reads correct values.
async function initializeAppConfig(): Promise<void> {
  const appType = Constants.expoConfig?.extra?.appType ?? process.env.EXPO_PUBLIC_APP_TYPE ?? '115'
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

  useEffect(() => {
    const cleanup = setupNotificationHandlers()
    return cleanup
  }, [])

  useEffect(() => {
    // Config must finish before AuthProvider mounts and reads storage
    initializeAppConfig().then(() => setAppReady(true))
  }, [])

  if (!appReady) return null

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
