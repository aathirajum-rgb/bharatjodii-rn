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
// partialReg already read and send on every auth call, so it still rides
// along passively on those. But there IS a dedicated immediate-push path too:
// Angular's app.component.ts updateRegisterIdFunc() → common.ts
// updateRegisteredID('switchlanguage') fires login/switchlanguage/v1 the
// instant a fresh token is available — a misleadingly-named endpoint (RN's
// actual language switching, languageService.ts, never calls it) that's
// really just a device-registration-info update. That immediate push matters
// here because requestPermissionAndGetToken() runs fire-and-forget alongside
// refreshSession()/autoLogin() (see AuthContext.tsx) — without it, a freshly
// (re)issued token can sit in storage for up to an hour (RootNavigation's
// refreshSession throttle) before the backend ever learns about it, during
// which push silently fails for that device. pushRegisterId() below ports
// that same immediate call.
//
// expo-notifications remote push was removed from Expo Go in SDK 53, and
// @react-native-firebase/*/@notifee don't work in Expo Go at all — every
// function here is a no-op when running inside Expo Go. They're also a no-op
// on web: @react-native-firebase/messaging is native-only (no web shim), and
// this app never calls the web Firebase SDK's own firebase.initializeApp(),
// so getMessaging() there always throws "No Firebase App '[DEFAULT]' has
// been created".
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { Linking, Platform, ToastAndroid } from 'react-native'
import { getItem, setItem } from './storageService'
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { StorageKeys as SK } from '../constants/storage.keys'
import { resetTo, waitForNavigationReady } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'
import { Colors } from '../constants/colors'

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
  // receiverid arrives as a JSON number (e.g. 8860234), while the stored
  // login id is always a string — strict equality between the two silently
  // failed on every real payload, dropping every notification with no error
  // (confirmed: OS permission granted, but no channel/banner ever appeared).
  return !loginId || String(payload.receiverid) === String(loginId)
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
      // BharatJodii rebrand: matches Android's own FCM notification builders,
      // which added this same accent color (app_logo_red) alongside the
      // existing small icon.
      color: Colors.notificationAccent,
      style: payload.photo
        ? { type: AndroidStyle.BIGPICTURE, picture: payload.photo }
        : { type: AndroidStyle.BIGTEXT, text: payload.title2 || payload.message || '' },
      ...(payload.cta ? { actions: [{ title: payload.cta, pressAction: { id: 'default' } }] } : {}),
    },
  })
}

// Debug-only visibility into push setup/delivery, with no debugger attached.
// Not gated on __DEV__ — needed on a signed release/staging build too while
// push is being diagnosed there. Remove (or re-add a __DEV__ gate) once push
// is confirmed working end-to-end on that build.
function showDebugToast(message: string): void {
  if (Platform.OS !== 'android') return
  ToastAndroid.show(message, ToastAndroid.LONG)
}

async function handleRemoteMessage(data: { [key: string]: string | object } | undefined): Promise<void> {
  const raw = data as Record<string, string> | undefined
  showDebugToast(`Push received: ${raw?.title || raw?.message || raw?.payload || 'no payload'}`)
  const payload = parsePayload(data)
  if (!payload) return
  if (!(await passesReceiverFilter(payload))) return
  await displayPushNotification(payload)
}

// ─── Permission + token ───────────────────────────────────────────────────────

// Legacy: Angular's updateRegisteredID('switchlanguage') — pushes the current
// REGISTERID (+ device info) to the backend immediately, independent of the
// login/autologin cadence. Skipped when logged out: the token still rides
// along on the next login/verifyotp call once a user ID exists.
async function pushRegisterId(token: string): Promise<void> {
  const userId = await getItem(SK.Auth.USER_ID)
  if (!userId) return

  const [deviceDetail, appVersion, deviceId, nallow, lang] = await Promise.all([
    getItem('DEVICEDETAIL'),
    getItem(SK.App.APP_VERSION),
    getItem('DEVICEID'),
    getItem(SK.App.NALLOW),
    getItem(SK.Auth.LANG),
  ])

  const params = [
    `ID=${userId}`,
    `REGISTERID=${token}`,
    `DEVICEID=${deviceId ?? ''}`,
    `DEVICEDETAIL=${deviceDetail ?? ''}`,
    `LANG=${lang ?? 'en'}`,
    `APPVERSION=${appVersion ?? ''}`,
    `NALLOW=${nallow ?? '1'}`,
  ].join('&')

  try {
    const result = await apiCall(Endpoints.auth.switchLanguage, 'POST', params)
    showDebugToast(
      `Push: registerId pushed (ERRCODE=${result?.ERRCODE}, RESPONSECODE=${result?.RESPONSECODE}, ` +
      `MSG=${result?.MESSAGE ?? result?.ERRORMESSAGE ?? result?.RESPONSE?.MESSAGE ?? 'n/a'})`,
    )
  } catch (err) {
    // Best-effort — the token still rides along on the next login/autologin call.
    showDebugToast(`Push: registerId push failed — ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function requestPermissionAndGetToken(): Promise<string | null> {
  if (isExpoGo) {
    showDebugToast('Push: skipped — running in Expo Go')
    return null
  }

  let finalStatus: string
  try {
    const Notifications = await import('expo-notifications')
    const { status: existing } = await Notifications.getPermissionsAsync()
    finalStatus = existing

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
  } catch (err) {
    // On web, Notification.requestPermission() rejects when not called from
    // a user gesture (e.g. this fires from checkAuth() at app startup) —
    // degrade gracefully instead of crashing, same as the getToken() failure
    // path below. Logged with console.warn (not the [CRASH] logger's
    // console.error) so the message/stack print as plain text instead of
    // being swallowed into the dev overlay's code-frame-only rendering.
    console.warn('[Push] permission check failed:', err instanceof Error ? (err.stack ?? err.message) : err)
    showDebugToast(`Push: permission check failed — ${err instanceof Error ? err.message : String(err)}`)
    return null
  }

  if (finalStatus !== 'granted') {
    showDebugToast(`Push: permission not granted (${finalStatus})`)
    await setItem('NALLOW', '0')
    return null
  }

  await setItem('NALLOW', '1')

  if (!supportsFirebaseMessaging) {
    showDebugToast(`Push: permission granted, but no messaging support on ${Platform.OS}`)
    return null
  }

  try {
    const { getMessaging, getToken, onTokenRefresh } = await import('@react-native-firebase/messaging')
    const messaging = getMessaging()
    const token = await getToken(messaging)
    await setItem('REGISTERID', token)
    showDebugToast(`Push: token acquired …${token.slice(-12)}`)
    await pushRegisterId(token)

    // Legacy: onNewToken — persist on rotation, then push immediately (same
    // as the initial acquisition above) instead of waiting on the next auth call.
    onTokenRefresh(messaging, async (newToken: string) => {
      await setItem('REGISTERID', newToken)
      showDebugToast(`Push: token refreshed …${newToken.slice(-12)}`)
      await pushRegisterId(newToken)
    })

    return token
  } catch (err) {
    showDebugToast(`Push: getToken failed — ${err instanceof Error ? err.message : String(err)}`)
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
  }).catch(() => {
    // getMessaging() throws synchronously (not just rejects) when no native
    // Firebase app is initialized (e.g. a local build with no
    // GoogleService-Info.plist/google-services.json) — surfaced as an
    // uncaught promise rejection at cold start with no .catch() here.
  })
}

// ─── Notification tap → navigation ────────────────────────────────────────────
// Legacy: two SEPARATE mechanisms decide where a push notification tap lands,
// confirmed by reading the actual Angular/native source rather than guessed
// from messagetype names:
//
// 1) Native path (HomeScreenActivity.performPushNotifyLanding(), only runs
//    when the backend's autologin response says WEBVIEWNOTIFICATION=="0"):
//    hard-codes screens for exactly two groups — msgType 21/39/401/47/48/23
//    (add-photo) and 25 (dial). Every other messagetype falls through to
//    mechanism 2 below.
//
// 2) WebView path (webview.page.ts's pageLandingFunc(), the overwhelmingly
//    common case — WEBVIEWNOTIFICATION=="1"): loads the backend's WEBVIEWURL,
//    whose trailing page_id segment (see registrationService.ts's
//    parseAndStoreWebViewURL()) is what actually decides the destination —
//    for a notification tap the backend always sends page_id "1", and page_id
//    "1"'s own notify-branch does this and NOTHING else:
//      let obj = { '93': 'likedyou', '94': 'viewedyou' };
//      url = obj[msgType] || 'matches';
//    i.e. messagetypes 93 and 94 get a specific landing; EVERY other
//    messagetype (1–400+) just opens Matches, same as a normal app open.
//    An earlier pass here guessed a large messagetype→screen table from the
//    backend's notification-name reference sheet (e.g. payment types→recharge,
//    FAQ types→Faq) — that table doesn't match this verified behavior and was
//    removed. msgType 94 ('viewedyou' — "who viewed your profile") has no
//    dedicated full-list RN screen yet (same gap as HomeDesktopLayout.tsx's
//    own "who viewed me" TODO), so it lands on Home instead, where the "Who
//    viewed you" section already shows real data — not the generic Matches
//    fallback every other/unlisted messagetype gets.
const DIALER_MESSAGE_TYPES = new Set(['25', '58'])

export function routePushNotificationTap(payload: PushNotificationPayload): void {
  const msgType = payload.messagetype != null ? String(payload.messagetype) : ''

  if (DIALER_MESSAGE_TYPES.has(msgType) && payload.customersupport) {
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

  if (msgType === '21' || msgType === '39' || msgType === '401' ||
      msgType === '47' || msgType === '48' || msgType === '23') {
    resetTo('addphoto-intermediate')
    return
  }

  // Legacy: obj = { '93': 'likedyou', '94': 'viewedyou' }.
  if (msgType === '93') {
    resetTo('Activity')
    return
  }
  // 'viewedyou' has no dedicated full-list screen yet (see
  // HomeDesktopLayout.tsx's own "who viewed me" TODO), but the data it would
  // show already has a real, API-backed home for it: HomeScreen's "Who viewed
  // you" swiper section (fetchViewedYou()). Land there instead of the generic
  // Matches fallback so the tap isn't a dead end — revisit once/if a full
  // "who viewed me" list screen is built.
  if (msgType === '94') {
    resetTo(ENavigation.HOME)
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
  }).catch(() => {
    // Same synchronous-throw-from-getMessaging() gap as registerBackgroundHandler()
    // above — no native Firebase app initialized must degrade to a no-op here,
    // not an uncaught rejection every time this runs at app startup.
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
