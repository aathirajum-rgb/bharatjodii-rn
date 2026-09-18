import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { getItem } from '../service/storageService'
import { StorageKeys } from '../constants/storage.keys'
import { registerLogoutCallback, clearSession } from '../service/apiClient'
import { getSessionValue } from '../service/registrationService'
import { loadDrProfiles } from '../service/drService'
import { refreshSession } from '../service/homeService'
import { handlePageLanding } from '../service/pageLandingService'
import { consumePendingDeepLinkPageId } from '../service/deepLinkService'
import { waitForNavigationReady, resetTo } from '../utils/navigationRef'
import { requestPermissionAndGetToken } from '../service/notificationService'
import { getInitialWebviewHandoff, applyWebviewHandoff } from '../service/webviewHandoffService'
import { disconnectSocket } from '../service/socketService'
import { ENavigation } from '../types/enums/navigation.enum'
import ProfileDeactivatedModal, { type ProfileDeactivateInfo } from '../components/auth/ProfileDeactivatedModal'

// ─── Types ────────────────────────────────────────────────────────────────────

// Angular: payment.service.ts reDirectPage() — ENTRYTYPE=='P' (paid) lands on
// /my-membership (not built yet, so left as the Matches default here);
// anything else (free) lands on /recharge. Computed once, alongside isNewUser,
// so AppStack's initialRouteName (evaluated only on first mount) is correct
// from the start — changing it after mount has no effect in React Navigation.
type InitialRoute = 'onboarding' | 'Matches' | 'recharge'

interface AuthState {
  isAuthenticated: boolean
  userId: string | null
  loading: boolean
  isNewUser: boolean   // true → AppStack starts at onboarding; false → starts at Home
  initialRoute: InitialRoute
}

async function resolveInitialRoute(goToOnboarding: boolean): Promise<InitialRoute> {
  if (goToOnboarding) return 'onboarding'
  const entryType = await getSessionValue('ENTRYTYPE')
  return entryType && entryType !== 'P' ? 'recharge' : 'Matches'
}

interface AuthContextValue extends AuthState {
  loginUpdate: (userId: string, goToOnboarding?: boolean, pageId?: string) => Promise<void>
  logoutUpdate: () => void
  // Android: SplashScreenActivity's autologin — deactivation discovered while
  // already "logged in" (session refresh, not the login-submit screen) forces
  // a logout and surfaces this same popup on top of whatever screen the user
  // was on. Exposed so RootNavigation's periodic guardCheck() can report it
  // too, not just this file's own checkAuth().
  handleDeactivation: (info: ProfileDeactivateInfo) => Promise<void>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    userId: null,
    loading: true,
    isNewUser: false,
    initialRoute: 'Matches',
  })

  // Stable ref so registerLogoutCallback never captures a stale closure
  const logoutRef = useRef<() => void>(() => {})
  const [deactivateInfo, setDeactivateInfo] = useState<ProfileDeactivateInfo | null>(null)

  async function handleDeactivation(info: ProfileDeactivateInfo): Promise<void> {
    disconnectSocket()
    await clearSession()   // triggers the registered logout callback (logoutUpdate)
    setDeactivateInfo(info)
  }

  async function checkAuth() {
    console.log('[TRACE] checkAuth: START')
    // Native-app / deep-link handoff — #/webview/:type/:param/:page_id/:token
    // (or the 5-segment buildparam.REGISTER=='1' fresh-registration variant).
    // Checked first, before the normal stored-token path: a fresh browser tab
    // arriving this way has nothing in storage yet for the check below to find.
    if (Platform.OS === 'web') {
      const handoff = getInitialWebviewHandoff()
      if (handoff) {
        try {
          // Always scrub the token-bearing URL fragment, not just in dev —
          // leaving it in production means the token sits visible in the
          // browser's address bar and history indefinitely.
          const newUrl = window.location.pathname + window.location.search
          window.history.replaceState(null, '', newUrl)
        } catch {}
        const result = await applyWebviewHandoff(handoff)
        if (result) {
          const isNewUser = handoff.buildparam?.REGISTER === '1'
          const initialRoute = await resolveInitialRoute(isNewUser)
          setState({ isAuthenticated: true, userId: result.userId, loading: false, isNewUser, initialRoute })
          requestPermissionAndGetToken()
          const ready = await waitForNavigationReady()
          if (ready) {
            if (isNewUser) {
              // Fresh-registration handoff — same as loginUpdate's own
              // goToOnboarding path, this bypasses handlePageLanding's
              // REGISTERURL-resume dispatch entirely: OnboardingRouter's own
              // mount effect (AppStack.tsx) would otherwise immediately
              // overwrite REGISTERURL back to its default pageNo ('1') before
              // handlePageLanding gets a chance to read the '2' we just seeded.
              resetTo(ENavigation.ONBOARDING, { pageNo: '2' })
            } else {
              // Use landing pageId from URL immediately for routing (web-only)
              // e.g., pageId='28' → recharge page
              const storedPageId = Platform.OS === 'web' ? await getItem('WEBVIEW_PAGE_ID') : undefined
              const landingPageId = result.pageId || storedPageId || undefined
              await handlePageLanding(landingPageId, result.userId)
            }
          }
          return
        }
        // No usable user resolved (malformed/partial handoff) — fall through
        // to the normal stored-token check below instead of stranding the user.
      }
    }

    const [token, userId, registerUrl] = await Promise.all([
      getItem(StorageKeys.Auth.TOKEN),
      getItem(StorageKeys.Auth.USER_ID),
      getItem('REGISTERURL'),
    ])

    // Angular: webview.page.ts's goToRegistrationPage() — REGISTERURL wins over
    // "go to signin" even with no token yet. Registration only mints ATN/NBID
    // at the Caste/Gothra step (registrationService.ts's submitFullRegistration
    // → autoLogin); killing the app on any earlier step (Name, DOB, Height, ...)
    // leaves REGISTERURL/REGISTRATION_VALUES intact but no token, so without this
    // branch isAuthenticated would be false and RootNavigation would mount
    // AuthStack, bouncing the user back to the login screen and losing their
    // in-progress registration.
    if (!token && registerUrl) {
      setState({
        isAuthenticated: true,
        userId: null,
        loading: false,
        isNewUser: true,
        initialRoute: 'onboarding',
      })
      const ready = await waitForNavigationReady()
      if (ready) resetTo(ENavigation.ONBOARDING, { pageNo: registerUrl })
      return
    }

    const initialRoute = token ? await resolveInitialRoute(false) : 'matches'
    setState({
      isAuthenticated: !!token,
      userId: userId ?? null,
      loading: false,
      isNewUser: false,     // returning user → go straight to Home (unless free-member redirect below)
      initialRoute,
    })

    // Angular: the native shell calls login/autologin/v1 every time the app is
    // opened (not gated by the 1hr guard in RootNavigation.tsx, which is a
    // separate token-freshness concern for API calls already in-session) and
    // routes via webview.page.ts's pageLandingFunc() on the page_id it returns.
    // initialRoute above is already committed (from cache) so the app doesn't
    // sit on a blank screen waiting on this network round-trip — this can
    // still redirect once the real answer comes back.
    if (token && userId) {
      // Fire-and-forget — matches legacy's own "check every app open" pattern
      // (onNewToken/re-check ran on every launch, not just first login), and
      // must never block getting the user to their landing screen.
      requestPermissionAndGetToken()

      console.log('[TRACE] checkAuth: awaiting waitForNavigationReady')
      const ready = await waitForNavigationReady()
      console.log('[TRACE] checkAuth: navigationReady =', ready)
      if (ready) {
        console.log('[TRACE] checkAuth: awaiting refreshSession')
        const { pageId, deactivateInfo: deactivated } = await refreshSession()
        console.log('[TRACE] checkAuth: refreshSession resolved, pageId =', pageId, 'deactivated =', !!deactivated)
        if (deactivated) {
          await handleDeactivation(deactivated)
        } else {
          // Web-only: check for stored landing pageId from webview URL (e.g., 28 → recharge)
          const storedPageId = Platform.OS === 'web' ? await getItem('WEBVIEW_PAGE_ID') : undefined
          // A deep link tapped before this session-refresh resolved (or while
          // logged out) takes priority over the backend's own suggestion for
          // this one landing decision — see deepLinkService.ts.
          const pendingDeepLinkPageId = await consumePendingDeepLinkPageId()
          const landingPageId = pendingDeepLinkPageId || pageId || storedPageId || undefined
          console.log('[TRACE] checkAuth: awaiting handlePageLanding, landingPageId =', landingPageId)
          await handlePageLanding(landingPageId, userId)
          console.log('[TRACE] checkAuth: handlePageLanding resolved')
        }
      }
    }
  }

  async function loginUpdate(userId: string, goToOnboarding = true, pageId?: string) {
    const initialRoute = await resolveInitialRoute(goToOnboarding)
    setState({
      isAuthenticated: true,
      userId,
      loading: false,
      isNewUser: goToOnboarding,
      initialRoute,
    })

    // Fire-and-forget — never block navigation on the permission prompt/token fetch.
    requestPermissionAndGetToken()

    // Angular: webview.page.ts's pageLandingFunc() — case "1" (goToRegistrationPage,
    // brand-new registration) never calls loadDrProfiles, matched here by skipping
    // this whole block when goToOnboarding.
    if (!goToOnboarding) {
      const ready = await waitForNavigationReady()
      if (ready) {
        // A deep link tapped before login completed takes priority over
        // OTP-verify's own suggested pageId — see deepLinkService.ts.
        const pendingDeepLinkPageId = await consumePendingDeepLinkPageId()
        const landingPageId = pendingDeepLinkPageId || pageId
        if (landingPageId) {
          // Real page_id available (OTP-verify's own WEBVIEWURL, or a pending
          // deep link) — full dispatch.
          await handlePageLanding(landingPageId, userId)
        } else {
          // No page_id captured — fall back to the DR-only check (the dominant
          // real-world outcome for most page_ids anyway; see pageLandingService.ts).
          await loadDrProfiles(userId, 'login', initialRoute)
        }
      }
    }
  }

  function logoutUpdate() {
    setState({
      isAuthenticated: false,
      userId: null,
      loading: false,
      isNewUser: false,
      initialRoute: 'matches',
    })
  }

  useEffect(() => {
    console.log('[TRACE] AuthProvider: mount effect firing')
    logoutRef.current = logoutUpdate
    registerLogoutCallback(() => logoutRef.current())
    checkAuth()
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, loginUpdate, logoutUpdate, handleDeactivation }}>
      {children}
      {/* Rendered above whatever screen is mounted (Auth or App stack) so a
          deactivation discovered mid-session — not just at login-submit — is
          never silently swallowed. */}
      <ProfileDeactivatedModal
        visible={!!deactivateInfo}
        info={deactivateInfo}
        onClose={() => setDeactivateInfo(null)}
      />
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
