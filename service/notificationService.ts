// Notification service — replaces Angular's FCM web push (analytics.service.ts).
// In RN, push is handled by expo-notifications (already in package).
// The Angular "getFcmToken" appNativeEvent bridge is replaced by direct Expo APIs.

import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'

// ─── Permission + token ───────────────────────────────────────────────────────

export async function requestPermissionAndGetToken(): Promise<string | null> {
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

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync()
    const token     = tokenData.data
    await setItem('PUSH_TOKEN', token)
    await registerTokenWithServer(token)
    return token
  } catch {
    return null
  }
}

async function registerTokenWithServer(token: string): Promise<void> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  if (!userId) return

  const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID'
  const params   = `ID=${userId}&TOKEN=${token}&PLATFORM=${platform}&TYPE=registertoken`
  await apiCall(Endpoints.notify.registerToken, 'POST', params)
}

// ─── Local notification (chat messages) ──────────────────────────────────────
// Replaces Angular's 'Chat_Notification' appNativeEvent bridge.

export async function scheduleLocalNotification(msgData: any): Promise<void> {
  if (!msgData) return

  await Notifications.scheduleNotificationAsync({
    content: {
      title: msgData.SENDERNAME ?? 'New message',
      body:  msgData.MSG        ?? '',
      data:  { type: 'chat', ...msgData },
    },
    trigger: null,
  })
}

// ─── Foreground handler setup ─────────────────────────────────────────────────
// Call once at app startup (in App.tsx).

export function setupNotificationHandlers(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void,
): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert:   true,
      shouldPlaySound:   true,
      shouldSetBadge:    true,
      shouldShowBanner:  true,
      shouldShowList:    true,
    }),
  })

  const foregroundSub = Notifications.addNotificationReceivedListener(n => {
    onNotificationReceived?.(n)
  })

  const responseSub = Notifications.addNotificationResponseReceivedListener(r => {
    onNotificationResponse?.(r)
  })

  return () => {
    foregroundSub.remove()
    responseSub.remove()
  }
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count)
}

export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0)
}
