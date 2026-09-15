// react-native-web's Alert.alert() is a complete no-op (see
// node_modules/react-native-web/src/exports/Alert/index.js — `static alert()
// {}`), so on web every `Alert.alert(...)` call in this app — hundreds of
// them, across nearly every screen — silently shows nothing at all. This
// module patches Alert.alert on web to route through a tiny pub-sub instead,
// rendered by <WebAlertHost/> (mounted once, near the app root in App.tsx).
// Native (iOS/Android) is completely untouched — Alert.alert there already
// works and this file's patch is gated to Platform.OS === 'web' only.
import { Alert, Platform } from 'react-native'

export type WebAlertButtonStyle = 'default' | 'cancel' | 'destructive'

export type WebAlertButton = {
  text?: string | undefined
  onPress?: ((value?: string) => any) | undefined
  style?: WebAlertButtonStyle | undefined
}

export type WebAlertOptions = {
  cancelable?: boolean | undefined
  onDismiss?: (() => void) | undefined
}

export type WebAlertRequest = {
  title: string
  message?: string
  buttons: WebAlertButton[]
  options?: WebAlertOptions
}

type Listener = (queue: WebAlertRequest[]) => void

// Alerts can in principle fire back-to-back (e.g. two errors in quick
// succession) — queued rather than dropped, same as the OS does natively.
let queue: WebAlertRequest[] = []
let listener: Listener | null = null

function notify() {
  listener?.(queue)
}

export function pushWebAlert(request: WebAlertRequest) {
  queue = [...queue, request]
  notify()
}

export function popWebAlert() {
  queue = queue.slice(1)
  notify()
}

export function subscribeWebAlerts(cb: Listener): () => void {
  listener = cb
  cb(queue)
  return () => {
    if (listener === cb) listener = null
  }
}

if (Platform.OS === 'web') {
  Alert.alert = (title, message, buttons, options) => {
    // Matches Alert.alert's own native default (Alert.js's Android branch):
    // no buttons given → a single "OK" button.
    const normalizedButtons: WebAlertButton[] =
      buttons && buttons.length > 0 ? (buttons as WebAlertButton[]) : [{ text: 'OK' }]
    pushWebAlert({
      title: title ?? '',
      ...(message != null ? { message } : {}),
      buttons: normalizedButtons,
      ...(options ? { options } : {}),
    })
  }
}
