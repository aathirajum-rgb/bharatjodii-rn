import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { getItem } from '../service/storageService'
import { StorageKeys } from '../constants/storage.keys'
import { registerLogoutCallback } from '../service/apiClient'
import { getSessionValue } from '../service/registrationService'
import { loadDrProfiles } from '../service/drService'
import { refreshSession } from '../service/homeService'
import { handlePageLanding } from '../service/pageLandingService'
import { waitForNavigationReady, resetTo } from '../utils/navigationRef'
import { requestPermissionAndGetToken } from '../service/notificationService'
import { getInitialWebviewHandoff, applyWebviewHandoff } from '../service/webviewHandoffService'
import { ENavigation } from '../types/enums/navigation.enum'

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

  async function checkAuth() {
    // Native-app / deep-link handoff — #/webview/:type/:param/:page_id/:token
    // (or the 5-segment buildparam.REGISTER=='1' fresh-registration variant).
    // Checked first, before the normal stored-token path: a fresh browser tab
    // arriving this way has nothing in storage yet for the check below to find.
    if (Platform.OS === 'web') {
      const handoff = getInitialWebviewHandoff()
      if (handoff) {
        try {
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
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
              await handlePageLanding(result.pageId, result.userId)
            }
          }
          return
        }
        // No usable user resolved (malformed/partial handoff) — fall through
        // to the normal stored-token check below instead of stranding the user.
      }
    }

    const [token, userId] = await Promise.all([
      getItem(StorageKeys.Auth.TOKEN),
      getItem(StorageKeys.Auth.USER_ID),
    ])
    const initialRoute = token ? await resolveInitialRoute(false) : 'Matches'
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

      const ready = await waitForNavigationReady()
      if (ready) {
        const { pageId } = await refreshSession()
        await handlePageLanding(pageId, userId)
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
        if (pageId) {
          // Real page_id available (OTP-verify's own WEBVIEWURL) — full dispatch.
          await handlePageLanding(pageId, userId)
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
      initialRoute: 'Matches',
    })
  }

  useEffect(() => {
    logoutRef.current = logoutUpdate
    registerLogoutCallback(() => logoutRef.current())
    checkAuth()
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, loginUpdate, logoutUpdate }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
