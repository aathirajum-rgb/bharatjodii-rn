import * as ExpoInAppUpdates from 'expo-in-app-updates';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// Android-native equivalent of Android's original Play Core AppUpdateManager
// (FLEXIBLE type only) — a NEW native binary from the Play Store, not the JS
// bundle. Fully separate from useOTAUpdate.ts's expo-updates check (that one
// only swaps JS/assets within the same installed binary/runtimeVersion); the
// two never share state and can't interfere with each other.
//
// iOS intentionally excluded: the original hybrid app never had an iOS store-
// update prompt to port, and wiring one here would need a real AppStoreID we
// don't have yet — better to add it deliberately later than ship a silently
// broken lookup now.
//
// Fires later than useOTAUpdate's 3s check so the two don't visually stack if
// both are ever available in the same session (Play Store review cycles are
// far slower than OTA pushes, so this is rare in practice).
export function useNativeAppUpdate() {
  useEffect(() => {
    if (__DEV__ || Platform.OS !== 'android') return;

    const timer = setTimeout(() => {
      checkForNativeUpdate();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);
}

async function checkForNativeUpdate() {
  try {
    const { updateAvailable, flexibleAllowed } = await ExpoInAppUpdates.checkForUpdate();
    if (!updateAvailable || !flexibleAllowed) return;

    // false = flexible (matches Android's original FLEXIBLE-only behavior,
    // not immediate) — Play Core shows its own native download/install UI
    // from here on, including the post-download "Install" prompt.
    await ExpoInAppUpdates.startUpdate(false);
  } catch {
    // silently ignore — update check errors are non-fatal
  }
}
