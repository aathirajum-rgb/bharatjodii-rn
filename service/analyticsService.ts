// Analytics service — replaces Angular's Firebase web SDK + appNativeEvent bridge.
// In RN we are the native app, so the WebView→Native bridge (appNativeEvent) is gone.
// Firebase: stub until @react-native-firebase/analytics is installed.
// AppsFlyer: stub until react-native-appsflyer is installed.

export interface IAnalyticsEvent {
  category: string
  action: string
  label?: string
}

// ─── Firebase stubs ───────────────────────────────────────────────────────────
// TODO: replace bodies with @react-native-firebase/analytics calls once installed

function _logFirebaseEvent(name: string, params?: Record<string, any>): void {
  if (__DEV__) console.log('[GA Event]', name, params)
  // analytics().logEvent(name, params)
}

function _logFirebaseScreen(screenName: string): void {
  if (__DEV__) console.log('[GA Screen]', screenName)
  // analytics().logScreenView({ screen_name: screenName, screen_class: screenName })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function logEvent(event: IAnalyticsEvent): void {
  _logFirebaseEvent(event.category, { action: event.action, label: event.label ?? '' })
}

export function logScreen(screenName: string): void {
  _logFirebaseScreen(screenName)
}

export function logAppsFlyer(
  eventName: string,
  values: Array<{ key: string; value: any }> = [],
): void {
  const params: Record<string, any> = {}
  values.forEach(({ key, value }) => { params[key] = value })
  if (__DEV__) console.log('[AppsFlyer]', eventName, params)
  // appsFlyer.logEvent(eventName, params)
}

export function setAppsFlyerUserId(matriId: string): void {
  if (__DEV__) console.log('[AppsFlyer User]', matriId)
  // appsFlyer.setAppUserId(matriId)
}

// ─── Unified event dispatcher ─────────────────────────────────────────────────
// Replaces Angular's triggerAppNativeEvent(). Handles every event_name the
// Angular bridge used, mapping them to the correct native RN action.

export interface INativeEvent {
  event_name: string
  [key: string]: any
}

export function dispatchNativeEvent(event: INativeEvent): void {
  if (!event?.event_name) return

  switch (event.event_name) {
    case 'eventGATrack':
      _logFirebaseEvent(event.eventCategory ?? '', {
        action: event.eventAction,
        label:  event.lable ?? event.label,
      })
      break

    case 'screenGATrack':
      _logFirebaseScreen(event.screenName ?? '')
      break

    case 'apps_flyer':
      logAppsFlyer(event.data ?? '', event.values ?? [])
      break

    case 'apps_flyer_userid':
      setAppsFlyerUserId(event.matriid ?? '')
      break

    // login_data is parsed by registrationService.storeWebURLData — no bridge needed
    case 'login_data':
      if (__DEV__) console.log('[login_data received]')
      break

    // Language change is handled directly in languageService
    case 'change_language':
      if (__DEV__) console.log('[change_language]', event.lang)
      break

    // FCM token refresh is handled by notificationService
    case 'getFcmToken':
      if (__DEV__) console.log('[getFcmToken requested]')
      break

    // Logout is handled by the auth store / clearSession in apiClient
    case 'logout':
      if (__DEV__) console.log('[logout event]')
      break

    // Chat push: handed to notificationService.scheduleLocalNotification
    case 'Chat_Notification':
      if (__DEV__) console.log('[Chat_Notification]', event.result)
      break

    // page_rendered: used by payment SDK setup — handled in paymentService
    case 'page_rendered':
      if (__DEV__) console.log('[page_rendered]', event.page_name)
      break

    default:
      if (__DEV__) console.log('[NativeEvent unhandled]', event)
  }
}
