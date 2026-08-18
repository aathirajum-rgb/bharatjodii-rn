// Re-applies the custom Razorpay Custom Integration bridge (RazorpayBridgeModule/
// RazorpayWebView/RazorpayBridgePackage — see service/paymentService.ts
// initRazorpayNative()) on every prebuild. Without this plugin, `expo prebuild
// --clean` regenerates android/ from scratch and silently drops these files,
// the build.gradle dependency, the MainApplication package registration, and
// the AndroidManifest entries — breaking Android payments with no build error.
const {
  withDangerousMod, withAppBuildGradle, withMainApplication, withAndroidManifest,
} = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const fs = require('fs');
const path = require('path');

const PACKAGE_PATH = 'jodii/app';
const SRC_DIR = path.join(__dirname, 'android-native-src', 'razorpay');
const RAZORPAY_GRADLE_DEP = `// Razorpay Custom Integration SDK — enables per-UPI-app targeting
    // (getAppsWhichSupportUpi + upi_app_package_name intent flow) and direct
    // card submission, neither of which react-native-razorpay's Standard
    // Checkout SDK (com.razorpay:checkout) supports. These two Razorpay
    // artifacts ship overlapping classes and cannot coexist in one Android
    // build (confirmed: duplicate class com.razorpay.AdvertisingIdUtil etc.)
    // — react-native-razorpay's Android autolinking is disabled in
    // react-native.config.js for exactly this reason; iOS still uses it.
    implementation "com.razorpay:customui:3.9.22"`;
// TEMP: real test key stripped before push — restore the actual value here
// before the next native build. Only used as a manifest placeholder (see
// AndroidManifest.xml comment); real per-transaction keys come from the
// backend at runtime via RazorpayWebView.kt, so this default isn't otherwise
// load-bearing.
const DEFAULT_RAZORPAY_API_KEY = 'rzp_test_PLACEHOLDER_RESTORE_ME';

function copyNativeSources(projectRoot) {
  const javaDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'java', PACKAGE_PATH);
  const layoutDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'layout');
  fs.mkdirSync(javaDir, { recursive: true });
  fs.mkdirSync(layoutDir, { recursive: true });

  for (const file of ['RazorpayBridgeModule.kt', 'RazorpayWebView.kt', 'RazorpayBridgePackage.kt']) {
    fs.copyFileSync(path.join(SRC_DIR, file), path.join(javaDir, file));
  }
  fs.copyFileSync(
    path.join(SRC_DIR, 'razorpay_web_view.xml'),
    path.join(layoutDir, 'razorpay_web_view.xml'),
  );
}

function withRazorpayGradleDependency(config) {
  return withAppBuildGradle(config, modConfig => {
    if (!modConfig.modResults.contents.includes(RAZORPAY_GRADLE_DEP)) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${RAZORPAY_GRADLE_DEP}`,
      );
    }
    return modConfig;
  });
}

function withRazorpayPackageRegistration(config) {
  return withMainApplication(config, modConfig => {
    const { contents, didMerge } = mergeContents({
      src: modConfig.modResults.contents,
      newSrc: '          add(RazorpayBridgePackage())',
      tag: 'razorpay-bridge-package',
      anchor: /packages\.apply\s*\{/,
      offset: 1,
      comment: '//',
    });
    if (didMerge) modConfig.modResults.contents = contents;
    return modConfig;
  });
}

function withRazorpayManifestEntries(config, { razorpayApiKey }) {
  return withAndroidManifest(config, modConfig => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) return modConfig;

    // Not using AndroidConfig.Manifest.addMetaDataItemToMainApplication() here —
    // against this project's manifest it serializes the meta-data tag as a
    // sibling of <manifest> instead of a child of <application> (reproduced
    // in isolation against a fresh prebuild output). Direct array manipulation,
    // same as the activity entry below, avoids that bug.
    const metaData = application['meta-data'] ?? (application['meta-data'] = []);
    if (!metaData.some(m => m.$?.['android:name'] === 'com.razorpay.ApiKey')) {
      metaData.push({ $: { 'android:name': 'com.razorpay.ApiKey', 'android:value': razorpayApiKey } });
    }

    const activities = application.activity ?? (application.activity = []);
    const alreadyPresent = activities.some(a => a.$?.['android:name'] === '.RazorpayWebView');
    if (!alreadyPresent) {
      activities.push({
        $: {
          'android:name': '.RazorpayWebView',
          'android:exported': 'false',
          'android:theme': '@style/Theme.AppCompat.Light.NoActionBar',
        },
      });
    }

    return modConfig;
  });
}

module.exports = function withRazorpayAndroidBridge(config, { razorpayApiKey = DEFAULT_RAZORPAY_API_KEY } = {}) {
  config = withDangerousMod(config, [
    'android',
    modConfig => {
      copyNativeSources(modConfig.modRequest.projectRoot);
      return modConfig;
    },
  ]);

  config = withRazorpayGradleDependency(config);
  config = withRazorpayPackageRegistration(config);
  config = withRazorpayManifestEntries(config, { razorpayApiKey });

  return config;
};
