const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const env = process.argv[2];

const VALID_ENVS = ['dev', 'stg', 'uat', 'preprod', 'prod'];
if (!env || !VALID_ENVS.includes(env)) {
  console.error(`Usage: node scripts/setup-env.js <${VALID_ENVS.join('|')}>`);
  process.exit(1);
}

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied ${path.relative(ROOT, src)} → ${path.relative(ROOT, dest)}`);
  } else {
    console.warn(`⚠  Missing: ${path.relative(ROOT, src)} (skipped)`);
  }
}

// Copy firebase config for Android
copyIfExists(
  path.join(ROOT, 'firebase', `google-services.${env}.json`),
  path.join(ROOT, 'android', 'app', 'google-services.json')
);

// Copy firebase config for iOS
copyIfExists(
  path.join(ROOT, 'firebase', `GoogleService-Info.${env}.plist`),
  path.join(ROOT, 'ios', 'GoogleService-Info.plist')
);

console.log(`\nEnvironment set to: ${env}`);
