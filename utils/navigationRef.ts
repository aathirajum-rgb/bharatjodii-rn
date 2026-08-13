import { createNavigationContainerRef, ParamListBase } from '@react-navigation/native'

export const navigationRef = createNavigationContainerRef<ParamListBase>()

export function navigate(name: string, params?: Record<string, unknown>): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params)
  }
}

export function goBack(): void {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack()
  }
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
