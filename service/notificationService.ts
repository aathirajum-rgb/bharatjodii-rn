// Notification service — replaces Angular's FCM web push (analytics.service.ts)
// and ports the legacy native Android app's FirebaseInstantMessagingService.
//
// Remote push transport is owned end-to-end by @react-native-firebase/messaging
// (raw native FCM token, foreground/background/killed delivery) + @notifee/
// react-native (rich display: dynamic channel, BigPicture, grouping, action
// button) — NOT expo-notifications, whose JS listeners don't reliably run when
// the app is killed for the data-only messages this backend sends. expo-
// notifications is kept only for its permission-prompt UI and for local (chat)
// notifications/badge, which is unrelated to remote push.
//
// The token is persisted under the literal key 'REGISTERID' — the same key
// homeService.ts's refreshSession() and registrationService.ts's autoLogin/
// partialReg already read and send on every auth call. There is no dedicated
// register-device endpoint (confirmed absent on the legacy backend); riding
// the token along on those existing calls IS the registration step.
//
// expo-notifications remote push was removed from Expo Go in SDK 53, and
// @react-native-firebase/*/@notifee don't work in Expo Go at all — every
// function here is a no-op when running inside Expo Go. They're also a no-op
// on web: @react-native-firebase/messaging is native-only (no web shim), and
// this app never calls the web Firebase SDK's own firebase.initializeApp(),
// so getMessaging() there always throws "No Firebase App '[DEFAULT]' has
// been created".
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { Linking, Platform } from 'react-native'
import { getItem, setItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { resetTo, waitForNavigationReady } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

// @react-native-firebase/messaging is a native-only module — there's no web
// shim, and nothing in this app ever calls the web Firebase SDK's own
// firebase.initializeApp(), so getMessaging() on web always throws "No
// Firebase App '[DEFAULT]' has been created". Every function below that
// touches it must skip on web the same way it already skips in Expo Go.
const supportsFirebaseMessaging = !isExpoGo && Platform.OS !== 'web'

// ─── Legacy push payload shape ─────────────────────────────────────────────────
// Legacy: FirebaseInstantMessagingService.onMessageReceived() reads ONE data
// field, `payload`, a JSON string with these fields. `messagetype` is a
// DIFFERENT numbering scheme than the in-app Socket.IO inbox's
// `notificationtype` (service/inAppNotificationService.ts) — the two must
// never be assumed to share codes without confirming case-by-case.

export interface PushNotificationPayload {
  receiverid?:      string
  messagetype?:     number | string
  senderid?:        string
  photo?:           string
  firebaseaction?:  string
  weblandingtype?:  number | string
  weblink?:         string
  title?:           string
  message?:         string
  title2?:          string
  cta?:             string
  channelname?:     string
  customersupport?: string
}

function parsePayload(data: { [key: string]: string | object } | undefined): PushNotificationPayload | null {
  const raw = data?.payload
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const DEFAULT_CHANNEL_ID = 'System Alerts'
const NOTIFICATION_GROUP_ID = 'com.jodii.NOTIFICATION_GROUP'

// Legacy: dropped if the push isn't addressed to the currently logged-in user
// (receiverid vs the stored matri ID) — avoids showing another user's push on
// a shared/re-logged-in device.
async function passesReceiverFilter(payload: PushNotificationPayload): Promise<boolean> {
  if (!payload.receiverid) return true
  const loginId = await getItem(SK.Auth.USER_ID)
  return !loginId || payload.receiverid === loginId
}

async function displayPushNotification(payload: PushNotificationPayload): Promise<void> {
  const { default: notifee, AndroidImportance, AndroidStyle } = await import('@notifee/react-native')

  const channelId = payload.channelname || DEFAULT_CHANNEL_ID
  await notifee.createChannel({ id: channelId, name: channelId, importance: AndroidImportance.HIGH })

  await notifee.displayNotification({
    title: payload.title,
    body: payload.message,
    data: payload as Record<string, string>,
    android: {
      channelId,
      groupId: NOTIFICATION_GROUP_ID,
      pressAction: { id: 'default' },
      style: payload.photo
        ? { type: AndroidStyle.BIGPICTURE, picture: payload.photo }
        : { type: AndroidStyle.BIGTEXT, text: payload.title2 || payload.message || '' },
      ...(payload.cta ? { actions: [{ title: payload.cta, pressAction: { id: 'default' } }] } : {}),
    },
  })
}

async function handleRemoteMessage(data: { [key: string]: string | object } | undefined): Promise<void> {
  const payload = parsePayload(data)
  if (!payload) return
  if (!(await passesReceiverFilter(payload))) return
  await displayPushNotification(payload)
}

// ─── Permission + token ───────────────────────────────────────────────────────

export async function requestPermissionAndGetToken(): Promise<string | null> {
  if (isExpoGo) return null

  const Notifications = await import('expo-notifications')
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    await setItem('NALLOW', '0')
    return null
  }

  await setItem('NALLOW', '1')

  if (!supportsFirebaseMessaging) return null

  try {
    const { getMessaging, getToken, onTokenRefresh } = await import('@react-native-firebase/messaging')
    const messaging = getMessaging()
    const token = await getToken(messaging)
    await setItem('REGISTERID', token)

    // Legacy: onNewToken — persist on rotation. No direct API call here either;
    // the new value rides along on whichever auth call runs next.
    onTokenRefresh(messaging, async (newToken: string) => {
      await setItem('REGISTERID', newToken)
    })

    return token
  } catch {
    return null
  }
}

// Registered once from index.ts, before registerRootComponent — must run at
// module-load time (not from a React component) to survive the headless
// invocation when the app is killed on Android.
export function registerBackgroundHandler(): void {
  if (!supportsFirebaseMessaging) return

  import('@react-native-firebase/messaging').then(({ getMessaging, setBackgroundMessageHandler }) => {
    setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
      await handleRemoteMessage(remoteMessage.data)
    })
  })
}

// ─── Notification tap → navigation ────────────────────────────────────────────
// Legacy: HomeScreenActivity.performPushNotifyLanding() — only the concretely
// evidenced cases (dialer, web landing) are ported here. The full messagetype
// switch (photo-flow types 21/39/401/47/48/23 etc.) needs a dedicated
// follow-up pass once each case's target screen is confirmed against this
// port's actual screens — guessing numeric-code mappings without that
// confirmation would silently misroute real notifications, so unmapped types
// fall back to Matches, the same safe-default convention
// getNotificationRedirect() (service/inAppNotificationService.ts) already uses.
const DIALER_MESSAGE_TYPE = '58'

export function routePushNotificationTap(payload: PushNotificationPayload): void {
  const msgType = payload.messagetype != null ? String(payload.messagetype) : ''

  if (msgType === DIALER_MESSAGE_TYPE && payload.customersupport) {
    Linking.openURL(`tel:${payload.customersupport}`)
    return
  }

  const landingType = payload.weblandingtype != null ? String(payload.weblandingtype) : '0'
  if ((landingType === '1' || landingType === '2') && payload.weblink) {
    // Legacy landingType 2 opened an in-app PaymentWebviewActivity; this port's
    // only webview screen (HostedCheckoutWebViewScreen) is checkout-session-
    // specific and can't render an arbitrary URL, so both landing types open
    // the system browser until/unless a generic in-app webview screen exists.
    Linking.openURL(payload.weblink)
    return
  }

  resetTo(ENavigation.MATCHES)
}

async function onNotificationTap(
  remoteMessage: import('@react-native-firebase/messaging').RemoteMessage | null,
): Promise<void> {
  const payload = remoteMessage?.data ? parsePayload(remoteMessage.data) : null
  if (!payload) return
  // A cold-start tap races AppStack mounting in the same render pass as the
  // auth-state flip — same guard AuthContext.tsx already uses post-login.
  const ready = await waitForNavigationReady()
  if (ready) routePushNotificationTap(payload)
}

// ─── Local notification (chat messages) ──────────────────────────────────────

export async function scheduleLocalNotification(msgData: any): Promise<void> {
  if (isExpoGo || !msgData) return

  const Notifications = await import('expo-notifications')
  await Notifications.scheduleNotificationAsync({
    content: {
      title: msgData.SENDERNAME ?? 'New message',
      body:  msgData.MSG        ?? '',
      data:  { type: 'chat', ...msgData },
    },
    trigger: null,
  })
}

// ─── Foreground + tap-entry-point setup ───────────────────────────────────────
// Call once at app startup (in App.tsx). No-op in Expo Go and on web.

export function setupNotificationHandlers(
  _onNotificationReceived?: (notification: any) => void,
  _onNotificationResponse?: (response: any) => void,
): () => void {
  if (!supportsFirebaseMessaging) return () => {}

  // expo-notifications: local (chat) notification display only — remote push
  // foreground/tap handling below is owned by @react-native-firebase/messaging.
  import('expo-notifications').then(Notifications => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound:  true,
        shouldSetBadge:   true,
        shouldShowBanner: true,
        shouldShowList:   true,
      }),
    })
  })

  let unsubscribeForeground = () => {}
  let unsubscribeOpenedApp = () => {}

  import('@react-native-firebase/messaging').then(({
    getMessaging, onMessage, onNotificationOpenedApp, getInitialNotification,
  }) => {
    const messaging = getMessaging()

    // Foreground: legacy onMessageReceived always ran regardless of app state
    // (data-only payload) — this is the foreground half; setBackgroundMessageHandler
    // (registerBackgroundHandler, called from index.ts) covers background/killed.
    unsubscribeForeground = onMessage(messaging, async remoteMessage => {
      await handleRemoteMessage(remoteMessage.data)
    })

    // App was backgrounded, then the notification was tapped.
    unsubscribeOpenedApp = onNotificationOpenedApp(messaging, onNotificationTap)

    // App was killed, then cold-started by tapping the notification.
    getInitialNotification(messaging).then(onNotificationTap)
  })

  return () => {
    unsubscribeForeground()
    unsubscribeOpenedApp()
  }
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export async function setBadgeCount(count: number): Promise<void> {
  if (isExpoGo) return
  const Notifications = await import('expo-notifications')
  await Notifications.setBadgeCountAsync(count)
}

export async function clearBadge(): Promise<void> {
  if (isExpoGo) return
  const Notifications = await import('expo-notifications')
  await Notifications.setBadgeCountAsync(0)
}
