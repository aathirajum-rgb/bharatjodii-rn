// Notification service — replaces Angular's FCM web push (analytics.service.ts).
// In RN, push is handled by expo-notifications (already in package).
// expo-notifications remote push was removed from Expo Go in SDK 53 — all
// functions here are no-ops when running inside Expo Go.

import Constants, { ExecutionEnvironment } from 'expo-constants'
import { Platform } from 'react-native'
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

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

// ─── Foreground handler setup ─────────────────────────────────────────────────
// Call once at app startup (in App.tsx). No-op in Expo Go.

export function setupNotificationHandlers(
  _onNotificationReceived?: (notification: any) => void,
  _onNotificationResponse?: (response: any) => void,
): () => void {
  if (isExpoGo) return () => {}

  // Dynamic import to avoid the static import crashing Expo Go on module load
  import('expo-notifications').then(Notifications => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert:   true,
        shouldPlaySound:   true,
        shouldSetBadge:    true,
        shouldShowBanner:  true,
        shouldShowList:    true,
      }),
    })
  })

  return () => {}
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
