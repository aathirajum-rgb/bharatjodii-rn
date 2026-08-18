// Re-applies Firebase/FCM Android config on every prebuild. Without this plugin,
// `expo prebuild --clean` regenerates android/ from scratch and silently drops the
// per-flavor google-services.json files, the Google Services Gradle plugin
// classpath/apply lines — breaking push notifications with no build error (Gradle
// only fails loud if a google-services.json IS present but doesn't match the
// applicationId; a missing file is silently skipped by design, see below).
//
// Only Firebase-project-specific wiring lives here. @react-native-firebase/app,
// @react-native-firebase/messaging, and @notifee/react-native are ordinary
// autolinked npm packages (unlike Razorpay/PayU's hand-written native bridges) —
// they need zero MainApplication.kt/manifest edits of their own.
//
// @react-native-firebase/app's own config plugin ALSO inserts the google-services
// classpath/apply-plugin lines (in its own quoting style, with a pinned version) —
// both plugins are kept in app.config.js because RNFB's iOS mods (AppDelegate
// Firebase init, GoogleService-Info.plist wiring) are needed and can't be used
// standalone. The guards below check for the bare, quote-agnostic dependency
// coordinate string (matching how RNFB's own plugin checks), not this plugin's
// exact formatting, so whichever plugin runs first "wins" and the other no-ops —
// confirmed by reading node_modules/@react-native-firebase/app/plugin/build/android/*.js.
const { withProjectBuildGradle, withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const FLAVORS = require('../constants/flavorConfig');

const GOOGLE_SERVICES_CLASSPATH_COORDINATE = 'com.google.gms:google-services';
const GOOGLE_SERVICES_PLUGIN_ID = 'com.google.gms.google-services';

function withGoogleServicesClasspath(config) {
  return withProjectBuildGradle(config, modConfig => {
    if (!modConfig.modResults.contents.includes(GOOGLE_SERVICES_CLASSPATH_COORDINATE)) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    classpath('${GOOGLE_SERVICES_CLASSPATH_COORDINATE}')`,
      );
    }
    return modConfig;
  });
}

function withGoogleServicesPlugin(config) {
  return withAppBuildGradle(config, modConfig => {
    if (!modConfig.modResults.contents.includes(GOOGLE_SERVICES_PLUGIN_ID)) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        'apply plugin: "com.facebook.react"',
        `apply plugin: "com.facebook.react"\napply plugin: "${GOOGLE_SERVICES_PLUGIN_ID}"`,
      );
    }
    return modConfig;
  });
}

function copyPerFlavorGoogleServices(projectRoot) {
  for (const flavorName of Object.keys(FLAVORS)) {
    const src = path.join(projectRoot, 'firebase', `google-services.${flavorName}.json`);
    if (!fs.existsSync(src)) {
      console.warn(`[withFirebaseAndroid] Missing ${src} — skipping Firebase config for flavor "${flavorName}" (push notifications will not work for this flavor until it's added).`);
      continue;
    }
    const destDir = path.join(projectRoot, 'android', 'app', 'src', flavorName);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, path.join(destDir, 'google-services.json'));
  }
}

module.exports = function withFirebaseAndroid(config) {
  config = withGoogleServicesClasspath(config);
  config = withGoogleServicesPlugin(config);

  config = withDangerousMod(config, [
    'android',
    modConfig => {
      copyPerFlavorGoogleServices(modConfig.modRequest.projectRoot);
      return modConfig;
    },
  ]);

  return config;
};
