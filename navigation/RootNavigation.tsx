import { NavigationContainer } from '@react-navigation/native'
import * as Linking from 'expo-linking'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
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

export default function RootNavigation() {
  const { isAuthenticated, loading } = useAuth()

  // Blank while we check AsyncStorage — prevents a flash of the wrong stack
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  )
}
