import { NavigationContainer } from '@react-navigation/native'
import Constants from 'expo-constants'
import * as Linking from 'expo-linking'
import { useCallback, useEffect } from 'react'
import { ActivityIndicator, BackHandler, Platform, View } from 'react-native'
import FLAVORS from '../constants/flavorConfig'
import { useAuth } from '../contexts/AuthContext'
import { useExitConfirm } from '../hooks/useExitConfirm'
import type { ProfileDeactivateInfo } from '../components/auth/ProfileDeactivatedModal'
import { refreshSession } from '../service/homeService'
import { getItem, setItem } from '../service/storageService'
import { handleBack, navigationRef } from '../utils/navigationRef'
import AppStack from './AppStack'
import AuthStack from './AuthStack'

// ─── Deep-link config ─────────────────────────────────────────────────────────
// Each build only declares an App Links / Associated Domains intent filter for
// its OWN flavor's domain (app.config.js: `f.domain`) — so only that domain can
// ever arrive here verified. Resolving it from flavorConfig via the current
// build's `appFlavor` (also injected by app.config.js) covers all 55 flavors
// instead of a fixed 3-domain list that only worked for jodii/tamil/malayalam.

function getLinkingPrefixes() {
  const appFlavor = Constants.expoConfig?.extra?.appFlavor ?? 'jodii'
  const domain    = (FLAVORS as Record<string, { domain: string }>)[appFlavor]?.domain ?? FLAVORS.jodii.domain
  const base = [`https://${domain}`]
  try { base.unshift(Linking.createURL('/')) } catch {}
  return base
}

const linking = {
  prefixes: getLinkingPrefixes(),
  config: {
    screens: {
      // Auth screens
      login:             'login',
      otp:               'otp',
      // App screens
      Home:              'home',
      Permissions:       'permissions',
      Gallery:           'gallery',
      recharge:          'recharge',
      'payment-success': 'payment-success',
      ComponentShowcase: 'components',
    },
  },
}

// ─── Root navigation ──────────────────────────────────────────────────────────

// ─── Auth guard ───────────────────────────────────────────────────────────────
// Mirrors Angular's AuthGuardUser.canActivate() in authguarduser.service.ts.
// Fires on EVERY screen navigation. Calls refreshSession() only if ≥1 hour has
// passed since the last autologin — same condition as Angular's _diffHours >= 1.

async function guardCheck(
  isAuthenticated: boolean,
  handleDeactivation: (info: ProfileDeactivateInfo) => Promise<void>,
) {
  if (!isAuthenticated) return
  const lastAt    = await getItem('LASTAPPLOGINAT')
  const diffHours = lastAt ? Math.abs(Date.now() - Date.parse(lastAt)) / 3600000 : 999
  if (diffHours >= 1) {
    const { deactivateInfo } = await refreshSession()
    if (deactivateInfo) {
      await handleDeactivation(deactivateInfo)
      return   // session already cleared — don't stamp a fresh LASTAPPLOGINAT
    }
    await setItem('LASTAPPLOGINAT', new Date().toISOString())
  }
}

export default function RootNavigation() {
  const { isAuthenticated, loading, handleDeactivation } = useAuth()

  // onStateChange fires on every screen navigation — equivalent to canActivate
  const handleStateChange = useCallback(() => {
    guardCheck(isAuthenticated, handleDeactivation)
  }, [isAuthenticated, handleDeactivation])

  // Registers the "Do you want to exit?" alert as handleBack()'s root
  // fallback, only for the authenticated app — AuthStack's root (Splash/
  // Login) keeps the OS default back behavior, same as before this hook
  // moved here from being wired into a single screen (MatchesScreen).
  useExitConfirm(isAuthenticated)

  // Single Android hardware-back listener for the whole app — the ONLY one,
  // registered once here rather than per-screen, so it can never race or
  // double-fire against another. It calls the exact same handleBack() that
  // every custom back icon/button in the app calls (AppHeader, etc.), so
  // hardware back and UI back can never diverge. A screen that needs to
  // intercept hardware back for its own reason (e.g. HostedCheckoutWebViewScreen
  // treating back as "cancel payment") still can — its own listener, being
  // registered later/deeper while focused, runs first and can swallow the
  // event before this one ever sees it.
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBack)
    return () => sub.remove()
  }, [])

  // Blank while we check AsyncStorage — prevents a flash of the wrong stack
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking} onStateChange={handleStateChange}>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  )
}
