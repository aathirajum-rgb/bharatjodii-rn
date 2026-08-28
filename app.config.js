const FLAVORS = require('./constants/flavorConfig');

const flavor = process.env.APP_FLAVOR || 'jodii';
const f = FLAVORS[flavor] || FLAVORS.jodii;

const appEnv = process.env.EXPO_PUBLIC_APP_ENV || 'dev';
const channelSuffix = process.env.CHANNEL_SUFFIX || 'production';

module.exports = ({ config }) => ({
  ...config,
  name: f.appName,
  slug: 'jodii',
  scheme: f.scheme,
  icon: f.icon,
  runtimeVersion: '1.0.0',
  updates: {
    url: 'https://stgimg.jodii.app/jodii-ota-server/jodii-ota-server/manifest.php',
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
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: f.scheme }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: f.domain }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  ios: {
    ...config.ios,
    bundleIdentifier: f.applicationId,
    associatedDomains: [`applinks:${f.domain}`],
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
    './plugins/withFirebaseAndroid',
    './plugins/withFirebaseIOS',
    './plugins/withRazorpayAndroidBridge',
    './plugins/withPayUAndroidBridge',
    'expo-audio',
    'expo-font',
    'expo-image',
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
