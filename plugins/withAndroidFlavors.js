const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const FLAVORS = require('../constants/flavorConfig');

const MIPMAP_DENSITIES = [
  { dir: 'mipmap-mdpi',    icon: 48,  foreground: 108 },
  { dir: 'mipmap-hdpi',    icon: 72,  foreground: 162 },
  { dir: 'mipmap-xhdpi',   icon: 96,  foreground: 216 },
  { dir: 'mipmap-xxhdpi',  icon: 144, foreground: 324 },
  { dir: 'mipmap-xxxhdpi', icon: 192, foreground: 432 },
];

const ADAPTIVE_ICON_XML =
  '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n' +
  '    <background android:drawable="@color/iconBackground"/>\n' +
  '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n' +
  '</adaptive-icon>\n';

// Uses applicationId('...') with parentheses intentionally.
// Expo's setPackageInBuildGradle regex is: /(applicationId|namespace) ['"].*['"]/g
// It requires a SPACE then a QUOTE after applicationId — parentheses syntax bypasses it entirely.
//
// manifestPlaceholders here is what makes each flavor's deep-link scheme/host
// actually flavor-specific: android/app/src/main/AndroidManifest.xml (via
// app.config.js's intentFilters) references these as ${appScheme}/${appHost}
// instead of a literal value, since that manifest is the ONE file shared by
// every flavor in this Gradle tree (there's no per-flavor manifest override —
// confirmed no android/app/src/<flavor>/AndroidManifest.xml exists for any
// flavor, only resource/icon overrides). Without this, whichever flavor's
// scheme/domain happened to be baked in by the last `expo prebuild` run
// would silently ship in EVERY flavor's APK, breaking real App Links for
// every other flavor.
function buildFlavorsBlock() {
  const entries = Object.entries(FLAVORS)
    .map(
      ([name, { appType, applicationId, appName, scheme, domain, domain2 }]) =>
        `        ${name} {\n` +
        `            dimension "appType"\n` +
        `            applicationId('${applicationId}')\n` +
        `            buildConfigField "int", "APP_TYPE", "${appType}"\n` +
        `            resValue "string", "app_name", "${appName}"\n` +
        // appHost2 is a second, additive App Link host (see flavorConfig.js's
        // jodii.domain2 comment) — every flavor MUST define it since they all
        // share the one AndroidManifest.xml (below), even flavors with no real
        // second domain, which just duplicate appHost here (a harmless no-op
        // intent-filter, not a broken one).
        `            manifestPlaceholders = [appScheme: "${scheme}", appHost: "${domain}", appHost2: "${domain2 || domain}"]\n` +
        `        }`
    )
    .join('\n');

  return (
    `    flavorDimensions "appType"\n` +
    `    productFlavors {\n` +
    `${entries}\n` +
    `    }\n\n    `
  );
}

async function generateFlavorIcons(projectRoot) {
  let generateImageAsync;
  try {
    ({ generateImageAsync } = require('@expo/image-utils'));
  } catch {
    console.warn('[withAndroidFlavors] @expo/image-utils not available — skipping icon generation');
    return;
  }

  for (const [flavorName, { icon }] of Object.entries(FLAVORS)) {
    const iconSrc = path.resolve(projectRoot, icon.replace('./', ''));
    if (!fs.existsSync(iconSrc)) {
      console.warn(`[withAndroidFlavors] Icon missing for flavor "${flavorName}": ${iconSrc}`);
      continue;
    }

    const resDir = path.join(projectRoot, 'android', 'app', 'src', flavorName, 'res');
    console.log(`[withAndroidFlavors] Generating icons for: ${flavorName}`);

    for (const { dir, icon: iconSize, foreground: fgSize } of MIPMAP_DENSITIES) {
      const outDir = path.join(resDir, dir);
      fs.mkdirSync(outDir, { recursive: true });

      const { source: iconImg } = await generateImageAsync(
        { projectRoot },
        { src: iconSrc, name: 'ic_launcher.png', width: iconSize, height: iconSize, resizeMode: 'cover', backgroundColor: '#E6F4FE' }
      );
      fs.writeFileSync(path.join(outDir, 'ic_launcher.png'), iconImg);
      fs.writeFileSync(path.join(outDir, 'ic_launcher_round.png'), iconImg);

      const { source: fgImg } = await generateImageAsync(
        { projectRoot },
        { src: iconSrc, name: 'ic_launcher_foreground.png', width: fgSize, height: fgSize, resizeMode: 'contain', backgroundColor: '#E6F4FE' }
      );
      fs.writeFileSync(path.join(outDir, 'ic_launcher_foreground.png'), fgImg);
    }

    const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
    fs.mkdirSync(anydpiDir, { recursive: true });
    fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), ADAPTIVE_ICON_XML);
    fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), ADAPTIVE_ICON_XML);
  }

  console.log('[withAndroidFlavors] All flavor icons generated');
}

module.exports = function withAndroidFlavors(config) {
  // Step 1: Inject product flavors into build.gradle.
  // Always replaces the block so stale values from previous prebuilds are cleaned up.
  config = withAppBuildGradle(config, modConfig => {
    let contents = modConfig.modResults.contents;

    // Remove stale flavor block if present
    if (contents.includes('flavorDimensions')) {
      contents = contents.replace(
        /\n?\s*flavorDimensions[\s\S]*?productFlavors\s*\{[\s\S]*?\}\s*\n\s*/,
        '\n    '
      );
    }

    // Insert fresh flavor block before buildTypes
    contents = contents.replace('    buildTypes {', buildFlavorsBlock() + 'buildTypes {');
    modConfig.modResults.contents = contents;
    return modConfig;
  });

  // Step 2: Generate per-flavor launcher icons
  config = withDangerousMod(config, [
    'android',
    async modConfig => {
      await generateFlavorIcons(modConfig.modRequest.projectRoot);
      return modConfig;
    },
  ]);

  return config;
};
