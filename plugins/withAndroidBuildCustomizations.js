// Re-applies Android build.gradle/proguard customizations on every prebuild that
// `expo prebuild --clean` has no way to know about, because they were previously
// hand-edited directly into the generated files rather than authored as a plugin:
// - Release signing from JODII_KEYSTORE_FILE/JODII_STORE_PASSWORD/JODII_KEY_ALIAS/
//   JODII_KEY_PASSWORD env vars, falling back to debug signing when no keystore is
//   present (so local/CI builds without secrets still succeed).
// - Excluding Google ML Kit's barcode-scanning stack (pulled in transitively by
//   expo-camera) since this app never scans barcodes — drops libbarhopper_v3.so
//   (several MB per ABI) from the packaged app.
const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');

const SIGNING_CONFIGS_DEBUG_ONLY = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

const SIGNING_CONFIGS_WITH_RELEASE = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            def keystoreName = System.getenv('JODII_KEYSTORE_FILE') ?: 'jodii-release.keystore'
            if (file(keystoreName).exists()) {
                storeFile file(keystoreName)
                storePassword System.getenv('JODII_STORE_PASSWORD') ?: ''
                keyAlias System.getenv('JODII_KEY_ALIAS') ?: 'jodii-release'
                keyPassword System.getenv('JODII_KEY_PASSWORD') ?: ''
            } else {
                // No release keystore — fall back to debug signing so the build succeeds
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }`;

const MLKIT_EXCLUDE_BLOCK = `// App does not use barcode/QR scanning — exclude Google ML Kit's barcode-scanning
// stack (pulled in transitively by expo-camera) to drop its native libs (libbarhopper_v3.so,
// several MB per ABI) from the packaged app.
configurations.all {
    exclude group: "com.google.mlkit", module: "barcode-scanning"
    exclude group: "com.google.android.gms", module: "play-services-code-scanner"
    exclude group: "com.google.android.gms", module: "play-services-mlkit-barcode-scanning"
    exclude group: "androidx.camera", module: "camera-mlkit-vision"
}

`;

const MLKIT_PROGUARD_RULE = `
# expo-camera's barcode-scanning code path is compiled in but its ML Kit dependencies
# are excluded from packaging (see app/build.gradle) since this app never scans barcodes.
# These classes are intentionally absent; the code paths referencing them are unreachable.
-dontwarn com.google.mlkit.vision.**
`;

function withReleaseSigningConfig(config) {
  return withAppBuildGradle(config, modConfig => {
    let contents = modConfig.modResults.contents;

    if (!contents.includes('JODII_KEYSTORE_FILE')) {
      contents = contents.replace(SIGNING_CONFIGS_DEBUG_ONLY, SIGNING_CONFIGS_WITH_RELEASE);
    }

    contents = contents.replace(
      /\/\/ Caution! In production, you need to generate your own keystore file\.\n\s*\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\n\s*/,
      '',
    );
    contents = contents.replace(
      /signingConfig signingConfigs\.debug(\n\s*def enableShrinkResources)/,
      'signingConfig signingConfigs.release$1',
    );

    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

function withMlkitExclusions(config) {
  return withAppBuildGradle(config, modConfig => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes('com.google.mlkit')) {
      contents = contents.replace(/dependencies\s*\{/, `${MLKIT_EXCLUDE_BLOCK}dependencies {`);
    }
    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

function withMlkitProguardRule(config) {
  return withDangerousMod(config, [
    'android',
    modConfig => {
      const proguardPath = `${modConfig.modRequest.platformProjectRoot}/app/proguard-rules.pro`;
      const contents = fs.readFileSync(proguardPath, 'utf8');
      if (!contents.includes('com.google.mlkit.vision')) {
        fs.writeFileSync(proguardPath, contents + MLKIT_PROGUARD_RULE);
      }
      return modConfig;
    },
  ]);
}

module.exports = function withAndroidBuildCustomizations(config) {
  config = withReleaseSigningConfig(config);
  config = withMlkitExclusions(config);
  config = withMlkitProguardRule(config);
  return config;
};
