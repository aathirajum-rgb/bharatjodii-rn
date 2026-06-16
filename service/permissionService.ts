import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { Camera } from 'expo-camera';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

/** True when running inside Expo Go (not a dev/production build) */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// ─── Shared Types ────────────────────────────────────────────────────────────

/** Result of any permission request: granted / denied / blocked */
export type PermissionResult = 'granted' | 'denied' | 'blocked';

/** Location result — includes coordinates when permission is granted */
export type LocationData = {
  status: PermissionResult;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
};

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Shows an alert with a shortcut to the device Settings when permission is permanently blocked */
function showBlockedAlert(permissionName: string) {
  Alert.alert(
    `${permissionName} Permission Blocked`,
    `${permissionName} access is permanently blocked. Please enable it in your device Settings.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  );
}

// ─── Location ────────────────────────────────────────────────────────────────

/** Location permission + current coordinates. iOS & Android. */
export async function requestLocationWithCoordinates(): Promise<LocationData> {
  const { status: existing } = await Location.getForegroundPermissionsAsync();

  if (existing !== 'granted') {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      const { canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (!canAskAgain) {
        showBlockedAlert('Location');
        return { status: 'blocked' };
      }
      return { status: 'denied' };
    }
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    status: 'granted',
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy ?? undefined,
  };
}

// ─── Push Notification ───────────────────────────────────────────────────────

/** Push notification permission. iOS & Android. Requires a dev build — not supported in Expo Go. */
export async function requestPushNotificationPermission(): Promise<PermissionResult> {
  // expo-notifications crashes in Expo Go (SDK 53+) — remote push was removed
  if (isExpoGo) {
    Alert.alert(
      'Not Supported in Expo Go',
      'Push notifications require a development build.\nRun: npx expo run:android',
    );
    return 'denied';
  }

  const Notifications = await import('expo-notifications');

  const { status: existing } = await Notifications.getPermissionsAsync();

  if (existing === 'granted') return 'granted';

  const { status } = await Notifications.requestPermissionsAsync();

  if (status === 'granted') return 'granted';

  if (status === 'denied') {
    const { canAskAgain } = await Notifications.getPermissionsAsync();
    if (!canAskAgain) {
      showBlockedAlert('Notification');
      return 'blocked';
    }
  }

  return 'denied';
}

// ─── Storage (Media Library) ─────────────────────────────────────────────────

/** Photo & video library access (no audio). iOS & Android. */
export async function requestStoragePermission(): Promise<PermissionResult> {
  // expo-media-library native module doesn't exist on web
  if (Platform.OS === 'web') return 'granted';

  const MediaLibrary = await import('expo-media-library');

  // Pass ['photo', 'video'] so Android 13+ only asks for image/video access.
  // Without this, it also requests READ_MEDIA_AUDIO which we don't need.
  const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);

  if (status === 'granted') return 'granted';

  if (!canAskAgain && status === 'denied') {
    showBlockedAlert('Storage');
    return 'blocked';
  }

  return 'denied';
}

// ─── Microphone ──────────────────────────────────────────────────────────────

/** Microphone / audio recording permission. iOS & Android. */
export async function requestMicrophonePermission(): Promise<PermissionResult> {
  const { granted: existing } = await getRecordingPermissionsAsync();

  if (existing) return 'granted';

  const { granted, canAskAgain, status } = await requestRecordingPermissionsAsync();

  if (granted) return 'granted';

  // Only show "Open Settings" if the user explicitly denied before (status=denied).
  // canAskAgain=false with status=undetermined means RECORD_AUDIO is missing
  // from the native manifest — needs npx expo run:android to take effect.
  if (!canAskAgain && status === 'denied') {
    showBlockedAlert('Microphone');
    return 'blocked';
  }

  return 'denied';
}

// ─── Camera ──────────────────────────────────────────────────────────────────

/** Camera permission for taking photos and videos. iOS & Android. */
export async function requestCameraPermission(): Promise<PermissionResult> {
  const { status: existing } = await Camera.getCameraPermissionsAsync();

  if (existing === 'granted') return 'granted';

  const { status, canAskAgain } = await Camera.requestCameraPermissionsAsync();

  if (status === 'granted') return 'granted';

  if (!canAskAgain) {
    showBlockedAlert('Camera');
    return 'blocked';
  }

  return 'denied';
}

