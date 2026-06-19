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

export function currentRoute(): string | undefined {
  return navigationRef.getCurrentRoute()?.name
}
