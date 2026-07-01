import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { getItem } from '../service/storageService'
import { StorageKeys } from '../constants/storage.keys'
import { registerLogoutCallback } from '../service/apiClient'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  isAuthenticated: boolean
  userId: string | null
  loading: boolean
  isNewUser: boolean   // true → AppStack starts at onboarding; false → starts at Home
}

interface AuthContextValue extends AuthState {
  loginUpdate: (userId: string, goToOnboarding?: boolean) => void
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
  })

  // Stable ref so registerLogoutCallback never captures a stale closure
  const logoutRef = useRef<() => void>(() => {})

  async function checkAuth() {
    const [token, userId] = await Promise.all([
      getItem(StorageKeys.Auth.TOKEN),
      getItem(StorageKeys.Auth.USER_ID),
    ])
    setState({
      isAuthenticated: !!token,
      userId: userId ?? null,
      loading: false,
      isNewUser: false,     // returning user → go straight to Home
    })
  }

  function loginUpdate(userId: string, goToOnboarding = true) {
    setState({
      isAuthenticated: true,
      userId,
      loading: false,
      isNewUser: goToOnboarding,
    })
  }

  function logoutUpdate() {
    setState({
      isAuthenticated: false,
      userId: null,
      loading: false,
      isNewUser: false,
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
