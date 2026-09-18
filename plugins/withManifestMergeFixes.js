// Third-party SDKs bundle their own AndroidManifest.xml with default values
// for attributes this app deliberately overrides — Android's manifest merger
// treats any differing value as a hard build error unless the winning
// declaration is marked tools:replace. Two known conflicts:
//
// 1. com.google.firebase.messaging.default_notification_color/_icon —
//    expo-notifications (see app.config.js) sets these; @react-native-firebase/
//    messaging's own bundled manifest sets them to its own defaults (@color/white).
//
// 2. application android:allowBackup/dataExtractionRules/fullBackupContent —
//    withAndroidManifestHardening.js sets allowBackup=false, and
//    expo-secure-store (configureAndroidBackup, see app.config.js) sets the
//    other two — AppsFlyer's bundled manifest sets its own conflicting
//    defaults (allowBackup=true + its own backup/extraction-rules XML).
//
// Config-plugin manifest mods run in *reverse* of their registration order
// in app.config.js's plugins array (each newly-registered mod's action runs
// before calling into the previously-registered one) — so this must be the
// FIRST plugin in that array to guarantee every other plugin's manifest
// change already exists in modResults by the time this one runs.
const { withAndroidManifest } = require('@expo/config-plugins');

const FCM_META_NAMES = [
  'com.google.firebase.messaging.default_notification_color',
  'com.google.firebase.messaging.default_notification_icon',
];

const APPLICATION_ATTRS_TO_REPLACE = [
  'android:allowBackup',
  'android:dataExtractionRules',
  'android:fullBackupContent',
];

module.exports = function withManifestMergeFixes(config) {
  return withAndroidManifest(config, modConfig => {
    const application = modConfig.modResults.manifest.application?.[0];

    const metaData = application?.['meta-data'];
    if (Array.isArray(metaData)) {
      for (const entry of metaData) {
        if (FCM_META_NAMES.includes(entry.$?.['android:name'])) {
          entry.$['tools:replace'] = 'android:resource';
        }
      }
    }

    if (application?.$) {
      const present = APPLICATION_ATTRS_TO_REPLACE.filter(attr => application.$[attr] != null);
      if (present.length) {
        const existing = application.$['tools:replace'];
        const merged = new Set((existing ? existing.split(',') : []).concat(present));
        application.$['tools:replace'] = [...merged].join(',');
      }
    }

    return modConfig;
  });
};
