import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { Alert } from 'react-native';

// Tracks how many times THIS bundle instance has called reloadAsync.
// Resets to 0 on every cold start. If we're already an OTA bundle
// (isEmbeddedLaunch === false), we've already been reloaded once — don't
// reload again until the USER explicitly asks for another update.
let reloadCount = 0;

export function useOTAUpdate() {
  useEffect(() => {
    // Give expo-updates ~3 s to fully commit the current launch and set
    // launchedUpdate in the controller so checkForUpdateAsync() sends the
    // correct expo-current-update-id header.  Calling it immediately (< 1 s
    // after bundle start) is the root cause of the reload loop that marks
    // bundles as failed and reverts to embedded.
    const timer = setTimeout(() => {
      runOTACheck();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);
}

async function runOTACheck() {
  // We already applied an OTA in this session — don't check again
  // until the app cold-starts.  This prevents the reload loop where
  // every reload immediately triggers another download + reload.
  if (reloadCount > 0) return;

  try {
    const check = await Updates.checkForUpdateAsync();
    // TEMP DIAGNOSTIC — remove once the "update shows on some devices but not
    // others" issue is root-caused. Surfaces the "checked OK, nothing to
    // install" case, which otherwise looks identical to a silently swallowed
    // network/DNS failure (no popup either way).
    if (!check.isAvailable) {
      Alert.alert('OTA Debug', `Checked server — no update available.\nchannel: ${Updates.channel}\nruntimeVersion: ${Updates.runtimeVersion}`);
      return;
    }

    Alert.alert(
      'Update Available',
      `A new version is ready to install.\n\n(${check.manifest?.id?.slice(0, 8) ?? 'new'})`,
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Install Now',
          onPress: async () => {
            try {
              await Updates.fetchUpdateAsync();
              reloadCount += 1;
              await Updates.reloadAsync();
            } catch (e: any) {
              Alert.alert('Update Failed', e?.message ?? String(e));
            }
          },
        },
      ]
    );
  } catch (e: any) {
    // TEMP DIAGNOSTIC — was previously a silent no-op, which is why this bug
    // was invisible. Remove this alert once root-caused.
    Alert.alert('OTA Check Failed', `${e?.code ?? ''} ${e?.message ?? String(e)}\nchannel: ${Updates.channel}\nruntimeVersion: ${Updates.runtimeVersion}`);
  }
}

