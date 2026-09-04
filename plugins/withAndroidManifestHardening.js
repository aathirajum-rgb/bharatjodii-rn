// Two AndroidManifest.xml fixes from the 2026-09-03 crash/security audit,
// authored as a plugin (not a one-off hand-edit) so they survive a clean
// `expo prebuild` — see withAndroidBuildCustomizations.js's own header
// comment for why this project treats un-backed hand-edits to generated
// files as fragile.
//
// 1. android:allowBackup="false" — Expo's default template sets this to
//    "true". This app's auth tokens live in expo-secure-store (Keystore-
//    backed, already excluded from Android Auto Backup by that library's own
//    config plugin — see app.config.js), but the rest of the app's session/
//    profile state still lives in AsyncStorage's plain SQLite file, which
//    Auto Backup would otherwise include by default. Hand-crafting a
//    dataExtractionRules/fullBackupContent XML that excludes just that one
//    file requires knowing AsyncStorage's exact internal storage path and
//    can't be verified against a real device build in this environment — a
//    wrong path there is a silent no-op. Turning off Auto Backup entirely is
//    the simpler, unambiguous alternative: this app's meaningful state is
//    server-sourced and re-fetched on login anyway, so losing OS-level
//    backup/restore of local cache/UI-state has low practical cost.
//
// 2. SYSTEM_ALERT_WINDOW permission removed — this isn't a project-specific
//    addition at all: it comes from Expo's own generic base manifest
//    template (@expo/config-plugins' withAndroidBaseMods.js), explicitly
//    commented there as "OPTIONAL PERMISSIONS, REMOVE WHATEVER YOU DO NOT
//    NEED". Confirmed via grep that no dependency in this project's own
//    Android manifests requires it (the only match anywhere under
//    node_modules is react-native-razorpay's own bundled *sample app*,
//    which isn't part of this build). Since it comes from Expo's base
//    template rather than a project hand-edit, simply deleting the line from
//    the checked-in manifest wouldn't stick — the next prebuild would
//    silently re-add it.
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidManifestHardening(config) {
  return withAndroidManifest(config, modConfig => {
    const manifest = modConfig.modResults.manifest;

    const application = manifest.application?.[0];
    if (application) {
      application.$['android:allowBackup'] = 'false';
    }

    if (Array.isArray(manifest['uses-permission'])) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        p => p.$?.['android:name'] !== 'android.permission.SYSTEM_ALERT_WINDOW'
      );
    }

    return modConfig;
  });
};
