const fs = require('fs');
const path = require('path');
const FLAVORS = require('./constants/flavorConfig');

// Load .env.ota (gitignored) so the OTA manifest URL below isn't hardcoded —
// same loading approach as scripts/deploy-ota.js, kept in sync with it.
const envOtaPath = path.join(__dirname, '.env.ota');
if (fs.existsSync(envOtaPath)) {
  fs.readFileSync(envOtaPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length && !process.env[key.trim()]) process.env[key.trim()] = rest.join('=').trim();
  });
}

const flavor = process.env.APP_FLAVOR || 'jodii';
const f = FLAVORS[flavor] || FLAVORS.jodii;

const appEnv = process.env.EXPO_PUBLIC_APP_ENV || 'dev';
const channelSuffix = process.env.CHANNEL_SUFFIX || 'production';

if (!process.env.OTA_MANIFEST_URL) {
  throw new Error('OTA_MANIFEST_URL is not set — add it to .env.ota (see envs/.env.template for reference).');
}
const otaManifestUrl = process.env.OTA_MANIFEST_URL;

// Mirrors constants/env/env.*.ts's `api` field — app.config.js can't import
// the .ts env files, so this is kept in sync manually. Needed so App Links
// under the API host (e.g. registration/linksms/v1 — see deepLinkService.ts's
// handleApiHostLink) actually reach the app; update both if a host changes.
const API_HOSTS = {
  dev: 'stgoapi.jodii.app',
  stg: 'stgoapi.jodii.app',
  uat: 'stgoapi.jodii.app',
  preprod: 'ppoapi.jodii.app',
  prod: 'oapi.jodii.app',
};
const apiHost = API_HOSTS[appEnv] || API_HOSTS.dev;

module.exports = ({ config }) => ({
  ...config,
  name: f.appName,
  slug: 'jodii',
  scheme: f.scheme,
  icon: f.icon,
  runtimeVersion: '1.0.0',
  updates: {
    url: otaManifestUrl,
    fallbackToCacheTimeout: 0,
    checkAutomatically: 'ON_LOAD',
    requestHeaders: {
      'expo-flavor': flavor,
      'expo-channel-name': `${flavor}-${channelSuffix}`,
    },
  },
  android: {
    ...config.android,
    adaptiveIcon: {
      foregroundImage: f.icon,
      backgroundColor: '#E6F4FE',
    },
    package: f.applicationId,
    predictiveBackGestureEnabled: false,
    // Required so @react-native-firebase/app's own config plugin doesn't throw
    // during prebuild (it hard-requires this field). It copies this single
    // flavor's file to the shared android/app/google-services.json fallback —
    // harmless, since withFirebaseAndroid's per-flavor android/app/src/<flavor>/
    // copies always take precedence in Gradle's google-services resolution.
    googleServicesFile: `./firebase/google-services.${flavor}.json`,
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'READ_MEDIA_IMAGES',
      'READ_MEDIA_VIDEO',
      'READ_EXTERNAL_STORAGE',
      'CAMERA',
      'RECORD_AUDIO',
      'POST_NOTIFICATIONS',
    ],
    // ${appScheme}/${appHost} are Gradle manifest placeholders, NOT resolved
    // here — every flavor shares this one generated AndroidManifest.xml (see
    // withAndroidFlavors.js's productFlavors block), so baking in this one
    // `f.scheme`/`f.domain` directly would ship the SAME scheme/host in every
    // other flavor's APK regardless of which one was actually built,
    // breaking their real App Links. Gradle substitutes the real per-flavor
    // value from each productFlavor's own manifestPlaceholders at build time
    // instead. apiHost is NOT flavor-specific (same per env for every
    // flavor), so it stays a literal value.
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: '${appScheme}' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: '${appHost}' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: apiHost }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  ios: {
    ...config.ios,
    bundleIdentifier: f.applicationId,
    associatedDomains: [`applinks:${f.domain}`, `applinks:${apiHost}`],
    // Unlike android/ (one Gradle tree hosts all 3 flavors via productFlavors),
    // ios/ is regenerated per-flavor by prebuild, so a single active file is correct here.
    googleServicesFile: `./firebase/GoogleService-Info.${flavor}.plist`,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'We need your location to show nearby matches.',
      NSPhotoLibraryUsageDescription: 'We need access to your photos to let you upload a profile picture.',
      NSCameraUsageDescription: 'We need camera access to take profile photos.',
      NSMicrophoneUsageDescription: 'We need microphone access for voice messages.',
      // react-native-razorpay README (FAQ) — required for iOS to detect/launch
      // Google Pay ('tez'), PhonePe, and Paytm during the UPI payment flow.
      // Only takes effect in a standalone build (prebuild/EAS), not Metro/dev.
      LSApplicationQueriesSchemes: ['tez', 'phonepe', 'paytmmp'],
    },
  },
  web: {
    ...config.web,
    name: f.appName,
    shortName: f.appName,
    description: `${f.appName} App`
  },
  extra: {
    appType: f.appType,
    appFlavor: flavor,
    appEnv,
    welcomeText: f.welcomeText,
    playStoreUrl: f.playStoreUrl,
  },
  plugins: [
    './plugins/withAndroidFlavors',
    './plugins/withAndroidBuildCustomizations',
    './plugins/withAndroidManifestHardening',
    './plugins/withFirebaseAndroid',
    './plugins/withFirebaseIOS',
    './plugins/withRazorpayAndroidBridge',
    './plugins/withPayUAndroidBridge',
    'expo-audio',
    'expo-font',
    'expo-image',
    // Stores ATN/RTN (access/refresh token) in the OS Keychain (iOS) /
    // Keystore (Android) instead of AsyncStorage's plain unencrypted file —
    // see service/storageService.ts. faceIDPermission disabled since this app
    // never sets requireAuthentication (no biometric-gated reads), so the
    // Info.plist Face ID usage string the plugin would otherwise add is
    // unused. configureAndroidBackup stays at its default (true), which is
    // the actual point of registering this plugin: it excludes SecureStore's
    // own Android files from Auto Backup — the app's AndroidManifest already
    // has allowBackup=true with no other exclusion rules, so without this the
    // encrypted-but-backed-up value could still round-trip through a backup.
    ['expo-secure-store', { faceIDPermission: false }],
    'expo-splash-screen',
    'expo-status-bar',
    'expo-video',
    'expo-web-browser',
    // Local (chat) notifications + badge only — remote push is owned end-to-end
    // by @react-native-firebase/messaging (see service/notificationService.ts).
    // No custom icon/color yet — needs a monochrome status-bar asset from design.
    'expo-notifications',
    // iOS-only in practice: AppDelegate Firebase init + GoogleService-Info.plist
    // wiring. Its Android mods also run (harmless, see withFirebaseAndroid.js).
    '@react-native-firebase/app',
    ['expo-camera', { barcodeScannerEnabled: false }],
    // NOTE: @infinitered/react-native-mlkit-face-detection is deliberately NOT
    // listed here. It ships no app.plugin.js and no expo config-plugin export —
    // it's a plain native module (autolinking handles it on its own). Adding it
    // to `plugins` makes Expo fall back to requiring its `main` entry
    // (build/index.js, untranspiled JSX) as a plugin function, which crashes
    // `expo start`/prebuild with "PluginError: Unexpected token '<'".
    // See service/photoValidationService.ts for the on-device face-detection
    // usage (photo AI validation pre-upload gate).
    // Default options only (no purchase connector, no backup-rules override) —
    // both are documented no-ops on Android with these defaults. Its iOS half
    // (AppDelegate deep-link injection) is a known no-op on Swift AppDelegates
    // (Expo SDK 52+/RN 0.76+ default, which this project uses) — harmless here
    // since analyticsService.ts deliberately doesn't wire AppsFlyer deep-link/
    // conversion-data listeners (Android-only scope, see useNativeAppUpdate.ts
    // for the same iOS-deferral reasoning).
    'react-native-appsflyer',
  ],
});
