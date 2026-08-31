import { NavigationContainer } from '@react-navigation/native'
import * as Linking from 'expo-linking'
import { useCallback, useEffect } from 'react'
import { ActivityIndicator, BackHandler, Platform, View } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { useExitConfirm } from '../hooks/useExitConfirm'
import type { ProfileDeactivateInfo } from '../components/auth/ProfileDeactivatedModal'
import { refreshSession } from '../service/homeService'
import { getItem, setItem } from '../service/storageService'
import { getLinkingPrefixes, handleResolverURL } from '../service/deepLinkService'
import { handleBack, navigationRef } from '../utils/navigationRef'
import AppStack from './AppStack'
import AuthStack from './AuthStack'

// ─── Deep-link config ─────────────────────────────────────────────────────────
// getLinkingPrefixes() resolves this build's own flavor domain (each build
// only declares an App Links / Associated Domains intent filter for its OWN
// domain, app.config.js: `f.domain`) — see deepLinkService.ts for the per-
// flavor resolution, shared with its `dl?page_id=` resolver-link parsing.
//
// getInitialURL/subscribe are overridden (React Navigation's documented
// escape hatch for pre-processing links) so a `dl?page_id=` resolver link —
// see deepLinkService.ts's header comment — is fully handled there instead
// of being matched against `config.screens` below, which only knows about
// semantic paths.

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
      // Semantic deep-link paths (share/marketing links the app itself
      // generates) — screen names verified against AppStack.tsx's actual
      // registered Stack.Screen names, not copied from the ENavigation enum
      // (several enum values don't match, e.g. 'notification' vs 'Notification').
      viewProfile:        'viewprofile/:matriId',
      Activity:           'activity',
      Notification:       'notification',
      'verify-id':        'verify-id',
      'my-membership':    'my-membership',
      EditProfile:        'edit-profile',
      Matches:            'matches',
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL()
    if (url && (await handleResolverURL(url))) return null
    return url
  },
  subscribe(listener: (url: string) => void) {
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleResolverURL(url).then(handled => { if (!handled) listener(url) })
    })
    return () => sub.remove()
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
