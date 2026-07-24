// Re-applies the custom PayU native bridge (PayUBridgeModule/PayUWebView —
// see service/paymentService.ts initPayUNative()) on every prebuild, for the
// same reason as withRazorpayAndroidBridge: `expo prebuild --clean`
// regenerates android/ from scratch and would otherwise silently drop these
// files, the build.gradle dependency, the MainApplication registration, and
// the AndroidManifest activity entry.
const {
  withDangerousMod, withAppBuildGradle, withMainApplication, withAndroidManifest,
} = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const fs = require('fs');
const path = require('path');

const PACKAGE_PATH = 'jodii/app';
const SRC_DIR = path.join(__dirname, 'android-native-src', 'payu');
const PAYU_GRADLE_DEP = `implementation("in.payu:upisdk:1.7.2") {
        exclude group: "org.json", module: "json"
    }`;

function copyNativeSources(projectRoot) {
  const javaDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'java', PACKAGE_PATH);
  const layoutDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'layout');
  fs.mkdirSync(javaDir, { recursive: true });
  fs.mkdirSync(layoutDir, { recursive: true });

  for (const file of ['PayUBridgeModule.kt', 'PayUWebView.kt', 'PayUBridgePackage.kt']) {
    fs.copyFileSync(path.join(SRC_DIR, file), path.join(javaDir, file));
  }
  fs.copyFileSync(
    path.join(SRC_DIR, 'payu_web_view.xml'),
    path.join(layoutDir, 'payu_web_view.xml'),
  );
}

function withPayUGradleDependency(config) {
  return withAppBuildGradle(config, modConfig => {
    if (!modConfig.modResults.contents.includes('in.payu:upisdk')) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${PAYU_GRADLE_DEP}`,
      );
    }
    return modConfig;
  });
}

function withPayUPackageRegistration(config) {
  return withMainApplication(config, modConfig => {
    const { contents, didMerge } = mergeContents({
      src: modConfig.modResults.contents,
      newSrc: '          add(PayUBridgePackage())',
      tag: 'payu-bridge-package',
      anchor: /packages\.apply\s*\{/,
      offset: 1,
      comment: '//',
    });
    if (didMerge) modConfig.modResults.contents = contents;
    return modConfig;
  });
}

function withPayUManifestEntry(config) {
  return withAndroidManifest(config, modConfig => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) return modConfig;

    // Same direct array manipulation as withRazorpayAndroidBridge — see that
    // plugin's comment for why the AndroidConfig.Manifest helper is avoided.
    const activities = application.activity ?? (application.activity = []);
    const alreadyPresent = activities.some(a => a.$?.['android:name'] === '.PayUWebView');
    if (!alreadyPresent) {
      activities.push({
        $: {
          'android:name': '.PayUWebView',
          'android:exported': 'false',
          'android:theme': '@style/Theme.AppCompat.Light.NoActionBar',
        },
      });
    }

    return modConfig;
  });
}

module.exports = function withPayUAndroidBridge(config) {
  config = withDangerousMod(config, [
    'android',
    modConfig => {
      copyNativeSources(modConfig.modRequest.projectRoot);
      return modConfig;
    },
  ]);

  config = withPayUGradleDependency(config);
  config = withPayUPackageRegistration(config);
  config = withPayUManifestEntry(config);

  return config;
};
