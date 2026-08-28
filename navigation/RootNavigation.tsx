import { NavigationContainer } from '@react-navigation/native'
import Constants from 'expo-constants'
import * as Linking from 'expo-linking'
import { useCallback } from 'react'
import { ActivityIndicator, View } from 'react-native'
import FLAVORS from '../constants/flavorConfig'
import { useAuth } from '../contexts/AuthContext'
import type { ProfileDeactivateInfo } from '../components/auth/ProfileDeactivatedModal'
import { refreshSession } from '../service/homeService'
import { getItem, setItem } from '../service/storageService'
import { navigationRef } from '../utils/navigationRef'
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
  const base = [`https://${domain}/jodii`]
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
