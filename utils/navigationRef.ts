import { createNavigationContainerRef, ParamListBase } from '@react-navigation/native'

export const navigationRef = createNavigationContainerRef<ParamListBase>()

export function navigate(name: string, params?: Record<string, unknown>): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params)
  }
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
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name, params }] })
  }
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
