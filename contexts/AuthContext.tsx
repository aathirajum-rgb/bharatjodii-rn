import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { getItem } from '../service/storageService'
import { StorageKeys } from '../constants/storage.keys'
import { registerLogoutCallback } from '../service/apiClient'
import { getSessionValue } from '../service/registrationService'

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
  loginUpdate: (userId: string, goToOnboarding?: boolean) => Promise<void>
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
  }

  async function loginUpdate(userId: string, goToOnboarding = true) {
    const initialRoute = await resolveInitialRoute(goToOnboarding)
    setState({
      isAuthenticated: true,
      userId,
      loading: false,
      isNewUser: goToOnboarding,
      initialRoute,
    })
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
