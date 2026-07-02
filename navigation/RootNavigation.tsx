import { NavigationContainer } from '@react-navigation/native'
import * as Linking from 'expo-linking'
import { useCallback } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { refreshSession } from '../service/homeService'
import { getItem, setItem } from '../service/storageService'
import { navigationRef } from '../utils/navigationRef'
import AppStack from './AppStack'
import AuthStack from './AuthStack'

// ─── Deep-link config ─────────────────────────────────────────────────────────

function getLinkingPrefixes() {
  const base = ['https://jodii.app', 'https://tamil.jodii.app', 'https://malayalam.jodii.app']
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

async function guardCheck(isAuthenticated: boolean) {
  if (!isAuthenticated) return
  const lastAt    = await getItem('LASTAPPLOGINAT')
  const diffHours = lastAt ? Math.abs(Date.now() - Date.parse(lastAt)) / 3600000 : 999
  if (diffHours >= 1) {
    await refreshSession()
    await setItem('LASTAPPLOGINAT', new Date().toISOString())
  }
}

export default function RootNavigation() {
  const { isAuthenticated, loading } = useAuth()

  // onStateChange fires on every screen navigation — equivalent to canActivate
  const handleStateChange = useCallback(() => {
    guardCheck(isAuthenticated)
  }, [isAuthenticated])

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
