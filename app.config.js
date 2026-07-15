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
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'READ_MEDIA_IMAGES',
      'READ_MEDIA_VIDEO',
      'READ_EXTERNAL_STORAGE',
      'CAMERA',
      'RECORD_AUDIO',
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
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'We need your location to show nearby matches.',
      NSPhotoLibraryUsageDescription: 'We need access to your photos to let you upload a profile picture.',
      NSCameraUsageDescription: 'We need camera access to take profile photos.',
      NSMicrophoneUsageDescription: 'We need microphone access for voice messages.',
    },
  },
  web: {
    ...config.web,
    name: f.appName,
    shortName: f.appName,
    description: `${f.appName} App`,
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
    'expo-image',
    'expo-splash-screen',
    'expo-video',
    ['expo-camera', { barcodeScannerEnabled: false }],
  ],
});
