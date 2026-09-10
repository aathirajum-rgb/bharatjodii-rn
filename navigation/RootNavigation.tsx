import {
  NavigationContainer,
  getPathFromState as defaultGetPathFromState,
  getStateFromPath as defaultGetStateFromPath,
  type LinkingOptions,
} from '@react-navigation/native'
import * as Linking from 'expo-linking'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, BackHandler, Platform, View } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { useExitConfirm } from '../hooks/useExitConfirm'
import ExitConfirmSheet from '../components/exit-confirm/ExitConfirmSheet'
import WebRouteFadeOverlay from '../components/web-route-fade/WebRouteFadeOverlay'
import type { ProfileDeactivateInfo } from '../components/auth/ProfileDeactivatedModal'
import { refreshSession } from '../service/homeService'
import { getItem, setItem } from '../service/storageService'
import { getLinkingPrefixes, handleResolverURL } from '../service/deepLinkService'
import { handleBack, navigationRef } from '../utils/navigationRef'
import AppStack, { type AppStackParamList } from './AppStack'
import AuthStack, { type AuthStackParamList } from './AuthStack'

// ─── Web hash-based URL routing ───────────────────────────────────────────────
// Target format: https://stgmobile.jodii.app/jodii/#/daily-recommendations?frm_page=login
//
// IMPORTANT: NavigationContainer's own built-in web linking already writes to
// the browser URL on every navigation (history.pushState), driven by
// getPathFromState below. Do NOT also call history.pushState/replaceState
// manually anywhere else (e.g. from onStateChange) — an earlier version of
// this file did both, and the two writers raced, producing a mangled URL
// like "/daily-recommendations?frm_page=login#/daily-recommendations?frm_page=login"
// (RN's own plain-path write, immediately followed/preceded by a second,
// independent hash write). getPathFromState/getStateFromPath are the single,
// supported extension point for this — there must be exactly one writer.
//
// The server (nginx) serves everything from a fixed docroot at /jodii/ and
// cannot be reconfigured with SPA fallback rewrite rules. Since browsers never
// send the URL fragment (#...) to the server, the pathname must ALWAYS stay
// exactly the base path ("/jodii/") — every route change may only ever change
// the hash. That's what getPathFromState enforces below: whatever plain path
// React Navigation would normally have written (e.g. "/daily-recommendations")
// is folded into the hash instead, never left in the pathname.

function getHashRoute(): string {
  // window.location.hash includes the leading '#'. "#/daily-recommendations..." -> "/daily-recommendations..."
  const hash = window.location.hash
  return hash.startsWith('#/') ? hash.slice(1) : '/'
}

// ─── Deep-link config ─────────────────────────────────────────────────────────
// getLinkingPrefixes() resolves this build's own flavor domain (each build
// only declares an App Links / Associated Domains intent filter for its OWN
// domain, app.config.js: `f.domain`) — see deepLinkService.ts for the per-
// flavor resolution, shared with its `dl?page_id=` resolver-link parsing.
// Native-only — see the NOTE further down for why web doesn't use these.

const WEB_BASE_PATH = '/jodii/';

// Typed against AppStackParamList (not left inferred) so TS's conditional
// PathConfigMap type recognizes MainTabs' value as NavigatorScreenParams and
// allows the nested `screens` map below — without this it only sees the
// untyped default ParamListBase and rejects nested screens entirely.
const linking: LinkingOptions<AppStackParamList & AuthStackParamList> = {
  prefixes: Platform.OS === 'web' ? [] : getLinkingPrefixes(),
  config: {
    screens: {
      // Auth screens
      login:             'login',
      otp:               'otp',
      // App screens
      // Home/Matches/Activity/MessagerList live inside MainTabs' own
      // Tab.Navigator now — nesting this config to match lets React
      // Navigation build the correct nested state straight from the URL.
      MainTabs: {
        screens: {
          Home:         'home',
          Matches:      'matches',
          Activity:     'activity',
          MessagerList: 'messager-list',
        },
      },
      Permissions:       'permissions',
      Gallery:           'gallery',
      recharge:          'recharge',
      renewal:           'renewal',
      'payment-success': 'payment-success',
      'payment-failed':  'payment-failed',
      ComponentShowcase: 'components',
      LanguageSelection: 'language-selection',
      // Semantic deep-link paths (share/marketing links the app itself
      // generates) — screen names verified against AppStack.tsx's actual
      // registered Stack.Screen names, not copied from the ENavigation enum
      // (several enum values don't match, e.g. 'notification' vs 'Notification').
      viewProfile:            'viewprofile/:matriId',
      Notification:           'notification',
      'verify-id':            'verify-id',
      'selfie-verification':  'selfie-verification',
      'photo-mismatch-selfie': 'photo-mismatch-selfie',
      'my-membership':        'my-membership',
      'daily-recommendations': 'daily-recommendations',
      'addphoto-intermediate': 'addphoto-intermediate',
      BlockerPage:            'blocker-page',
      Validation:             'validation',
      DiscoverMatches:        'discover-matches',
      'star-matching':        'star-matching',
      'chat-window':          'chat-window/:partnerId',
      Menu:                   'menu',
      Biodata:                'biodata',
      Settings:               'settings',
      PhonePrivacy:           'phone-privacy',
      EditProfile:            'edit-profile',
      EditProfileReligious:   'edit-profile-religious',
      EditProfileProfessional: 'edit-profile-professional',
      EditProfileBasic:       'edit-profile-basic',
      EditProfileLifestyle:   'edit-profile-lifestyle',
      EditProfileFamily:      'edit-profile-family',
      EditProfileProperty:    'edit-profile-property',
      EditProfileAgeHeight:   'edit-profile-age-height',
      EditProfileMarital:     'edit-profile-marital',
      EditProfileHoroscope:   'edit-profile-horoscope',
      DeleteProfile:          'delete-profile',
      DeleteProfileMrgReason: 'delete-profile-mrg-reason',
      DeleteProfileHide:      'delete-profile-hide',
      DeleteProfileUnsatisfactory: 'delete-profile-unsatisfactory',
      DeleteProfileWebsiteName: 'delete-profile-website-name',
      DeleteProfileShareDetails: 'delete-profile-share-details',
      DeleteProfileUploadPhoto: 'delete-profile-upload-photo',
      DeleteProfileSuccess:   'delete-profile-success',
      SuccessStories:         'success-stories',
      HelpCenter:             'help-center',
      Search:                 'search',
      Faq:                    'faq',
      IgnoredProfiles:        'ignored-profiles',
      ViewLater:              'view-later',
      SearchById:             'search-by-id',
      ExternalPage:           'external-page',
      'payment-options':      'payment-options',
      'card-payment':         'card-payment',
      'upi-address':          'upi-address',
      'net-banking':          'net-banking',
      'hosted-checkout':      'hosted-checkout',
      'more-payment-options': 'more-payment-options',
      'neft-rtgs':            'neft-rtgs',
      'pay-at-store':         'pay-at-store',
      'doorstep-collection':  'doorstep-collection',
      dashboard:              'dashboard',
      onboarding:             'onboarding',
    },
  },
  // NOTE: getInitialURL/subscribe below are NATIVE-ONLY. On web, React
  // Navigation's own useLinking.js (see node_modules/@react-navigation/native/
  // lib/module/useLinking.js) never calls either of these — it reads
  // `window.location.pathname + window.location.search` directly for the
  // initial state and on every popstate. That's exactly why web routing here
  // is driven entirely by getStateFromPath/getPathFromState below instead
  // (the only extension points useLinking.js actually calls on web).
  async getInitialURL() {
    if (Platform.OS === 'web') return undefined
    const url = await Linking.getInitialURL()
    if (url && (await handleResolverURL(url))) return null
    return url
  },
  subscribe(listener: (url: string) => void) {
    if (Platform.OS === 'web') return () => {}

    const sub = Linking.addEventListener('url', ({ url }) => {
      handleResolverURL(url).then(handled => { if (!handled) listener(url) })
    })
    return () => sub.remove()
  },
  // Called by useLinking.js with `path = location.pathname + location.search`
  // (see note above) — on web that's ALWAYS just the fixed base path (e.g.
  // "/jodii/"), since the pathname never changes. So on web we ignore the
  // given `path` entirely and derive the real route from the URL fragment
  // instead — the only place the actual route ever lives.
  getStateFromPath(path: string, options: any) {
    if (Platform.OS === 'web') {
      return defaultGetStateFromPath(getHashRoute(), options)
    }
    return defaultGetStateFromPath(path, options)
  },
  // The SINGLE writer of the browser URL on web: useLinking.js calls this on
  // every navigation and passes the result straight to
  // history.pushState/replaceState verbatim (see createMemoryHistory.js).
  // Folding the plain path into the hash here — instead of writing it
  // anywhere else — is what keeps the pathname pinned to the base path.
  getPathFromState(state: any, options: any) {
    const path = defaultGetPathFromState(state, options)
    if (Platform.OS === 'web') {
      return `${getWebBasePath()}#${path}`
    }
    return path
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
 function getWebBasePath(): string {
  return WEB_BASE_PATH;
}
export default function RootNavigation() {
  const { isAuthenticated, loading, handleDeactivation } = useAuth()

  // Top-of-stack route KEY (not name) of the ROOT navigator (AppStack or
  // AuthStack — whichever is currently mounted directly under
  // NavigationContainer), used only to drive WebRouteFadeOverlay below.
  // Deliberately NOT the deepest focused route: MainTabs is one entry in
  // this state regardless of which tab is active inside it, so switching
  // Home/Matches/Activity/Messages never changes this entry's key and never
  // triggers the fade. Using `key` rather than `name` matters for the
  // registration wizard: every onboarding step is the SAME route name
  // ('onboarding', see AppStack.tsx) pushed again with a different `pageNo`
  // param (navigation.push('onboarding', { pageNo })) — `name` would stay
  // "onboarding" for the whole wizard and never fire, but `push()` always
  // creates a fresh route `key` per step, so comparing `key` correctly
  // detects each step as its own transition.
  const [topRouteKey, setTopRouteKey] = useState<string | undefined>(undefined)

  // onStateChange fires on every screen navigation — equivalent to canActivate.
  // Browser URL syncing on web is handled entirely by linking's
  // getPathFromState/getStateFromPath above — nothing to do for it here.
  const handleStateChange = useCallback(() => {
    guardCheck(isAuthenticated, handleDeactivation)
    if (Platform.OS === 'web') {
      const rootState = navigationRef.getRootState()
      const topRoute = rootState?.routes[rootState.index]
      setTopRouteKey(topRoute?.key)
    }
  }, [isAuthenticated, handleDeactivation])

  // Registers the "Do you want to exit?" alert as handleBack()'s root
  // fallback, only for the authenticated app — AuthStack's root (Splash/
  // Login) keeps the OS default back behavior, same as before this hook
  // moved here from being wired into a single screen (MatchesScreen).
  const exitConfirm = useExitConfirm(isAuthenticated)

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
    <>
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        onStateChange={handleStateChange}
      >
        {isAuthenticated ? <AppStack /> : <AuthStack />}
      </NavigationContainer>
      <ExitConfirmSheet
        visible={exitConfirm.visible}
        onYes={exitConfirm.onYes}
        onNo={exitConfirm.onNo}
      />
      <WebRouteFadeOverlay routeKey={topRouteKey} />
    </>
  )
}
