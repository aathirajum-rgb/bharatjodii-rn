import { createNavigationContainerRef, ParamListBase } from '@react-navigation/native'

export const navigationRef = createNavigationContainerRef<ParamListBase>()

// RootNavigation.tsx keeps ONE <NavigationContainer> mounted and only swaps
// its child between AuthStack/AppStack on login/logout — isReady() reports
// the CONTAINER is mounted, which is already true before that swap (it was
// ready while showing the old stack), not that the NEW stack's screens are
// registered yet. A navigate()/resetTo() dispatched right after the
// isAuthenticated flip (loginUpdate → handlePageLanding, etc.) can race
// ahead of AppStack actually mounting, hitting "was not handled by any
// navigator" for a screen (e.g. EditProfileAgeHeight) that only exists on
// the stack still in the middle of swapping in. Polling for the route name
// itself, not just isReady(), closes that race for every caller here.
function isRouteKnown(name: string): boolean {
  if (!navigationRef.isReady()) return false
  return !!navigationRef.getRootState()?.routeNames?.includes(name)
}

function dispatchWhenRouteReady(dispatch: () => void, name: string, timeoutMs = 2000): void {
  if (isRouteKnown(name)) { dispatch(); return }
  const start = Date.now()
  const attempt = () => {
    if (isRouteKnown(name)) { dispatch(); return }
    if (Date.now() - start >= timeoutMs) {
      // Timed out waiting for that specific route — still attempt the
      // dispatch if the container itself is at least ready, so a genuinely
      // unknown screen name surfaces React Navigation's own dev warning
      // instead of silently vanishing.
      if (navigationRef.isReady()) dispatch()
      return
    }
    setTimeout(attempt, 50)
  }
  setTimeout(attempt, 50)
}

export function navigate(name: string, params?: Record<string, unknown>): void {
  dispatchWhenRouteReady(() => navigationRef.navigate(name, params), name)
}

// Root fallback for handleBack() below — invoked only once there is truly no
// screen left to pop (e.g. RootNavigation registers the Android "Do you want
// to exit?" confirmation here). Returns true if it handled the event.
type RootBackHandler = () => boolean
let rootBackHandler: RootBackHandler | null = null

export function registerRootBackHandler(handler: RootBackHandler | null): void {
  rootBackHandler = handler
}

// Single source of truth for "go back one step" — the Android hardware back
// button and every custom back icon/button in the app call this SAME
// function, so the two can never diverge. React Navigation's own per-
// navigator route stack already IS the navigation history (correctly nested
// through tabs/drawers/stacks/modals), so this just pops it; only once
// canGoBack() is false does it defer to the registered root behavior.
export function handleBack(): boolean {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack()
    return true
  }
  return rootBackHandler ? rootBackHandler() : false
}

// Replaces router with replaceUrl:true — clears back stack
export function resetTo(name: string, params?: Record<string, unknown>): void {
  dispatchWhenRouteReady(
    () => navigationRef.reset({ index: 0, routes: [{ name, params }] }),
    name,
  )
}

// Waits until the NavigationContainer has mounted and navigationRef.isReady()
// is true. Needed right after a login-state flip: AppStack mounts in the same
// render pass as isAuthenticated flipping true, so a navigate()/resetTo() call
// made synchronously in that same tick would silently no-op (isReady() still
// false) rather than throw — there's no error to catch, so callers that need
// to navigate right after login must await this first.
export async function waitForNavigationReady(timeoutMs = 3000): Promise<boolean> {
  if (navigationRef.isReady()) return true
  const start = Date.now()
  return new Promise(resolve => {
    const check = () => {
      if (navigationRef.isReady()) { resolve(true); return }
      if (Date.now() - start >= timeoutMs) { resolve(false); return }
      setTimeout(check, 50)
    }
    check()
  })
}
