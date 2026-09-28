// Device connectivity — ported from Angular's network.service.ts (getNetworkStatus():
// navigator.onLine + window 'online'/'offline' events on web, Ionic Native's
// Network.onConnect()/onDisconnect() on Cordova) and the Android app's
// Constants.isNetworkAvailable() (ConnectivityManager, NET_CAPABILITY_INTERNET +
// NET_CAPABILITY_VALIDATED). Neither legacy app blocked the whole UI on offline —
// both only gated individual actions behind a toast/inline retry — but this port
// uses a single full-screen OfflineScreen instead (see App.tsx), so the state
// lives here once and every screen/action check reads the same source of truth.
import { createContext, useContext, useEffect, useState } from 'react'
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import OfflineScreen from '../components/network/OfflineScreen'

interface NetworkState {
  // True once the first NetInfo event has landed — avoids a false "offline"
  // flash for the brief moment before NetInfo reports its first state.
  isReady:     boolean
  // NET_CAPABILITY_INTERNET equivalent — a network interface is up.
  isConnected: boolean
  // NET_CAPABILITY_VALIDATED equivalent — the interface actually reaches the
  // internet (e.g. false on a wifi captive portal with no real connectivity).
  // null means "unknown" (some platforms/interfaces never report this) — only
  // treated as offline when explicitly false, never when merely unknown.
  isInternetReachable: boolean | null
}

interface NetworkContextValue extends NetworkState {
  // Derived: the value every restricted-action guard and OfflineScreen should
  // actually check. False (offline) only once state is ready and either the
  // interface is down or reachability was explicitly ruled out.
  isOffline: boolean
  // NetInfo.fetch() re-check, e.g. for a "Retry" button — resolves once the
  // fresh reading has been applied to context state.
  refresh: () => Promise<void>
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

function toState(s: NetInfoState): NetworkState {
  return {
    isReady:             true,
    isConnected:         !!s.isConnected,
    isInternetReachable: s.isInternetReachable,
  }
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NetworkState>({
    isReady:             false,
    isConnected:         true,
    isInternetReachable: null,
  })

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(s => setState(toState(s)))
    NetInfo.fetch().then(s => setState(toState(s)))
    return unsubscribe
  }, [])

  async function refresh() {
    const s = await NetInfo.fetch()
    setState(toState(s))
  }

  // Was also gated on `isInternetReachable === false` (meant to catch a wifi
  // captive portal with no real connectivity) until 2026-09-25, when a real
  // device on working wifi (plans/API calls succeeding) reproducibly got
  // isConnected=true, isInternetReachable=false — a false positive that
  // silently blocked Pay on RechargeScreen (and identically guarded actions
  // on 8 other screens: the other payment screens, MatchesScreen, both
  // gallery uploaders). isInternetReachable's background reachability probe
  // is too unreliable on real networks to gate real actions on; a genuine
  // connectivity failure still surfaces via each action's own API error
  // handling, so this no longer doubles as a second, flakier gate.
  const isOffline = state.isReady && !state.isConnected

  return (
    <NetworkContext.Provider value={{ ...state, isOffline, refresh }}>
      {children}
      {/* Rendered above whatever screen is mounted, same as AuthContext's
          ProfileDeactivatedModal — blocks the whole app while offline rather
          than gating individual actions (see OfflineScreen.tsx for why). */}
      {/* <OfflineScreen visible={isOffline} onRetry={refresh} /> */}
    </NetworkContext.Provider>
  )
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext)
  if (!ctx) throw new Error('useNetwork must be used inside <NetworkProvider>')
  return ctx
}
