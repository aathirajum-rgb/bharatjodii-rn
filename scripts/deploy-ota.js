/**
 * OTA Deploy Script — exports bundle and uploads to server via SFTP.
 *
 * Usage:
 *   node scripts/deploy-ota.js
 *
 * Required env vars:
 *   SFTP_HOST      — e.g. stgmobile.jodii.app
 *   SFTP_USER      — e.g. ionic
 *   SFTP_PASSWORD  — your server password
 *   SFTP_OTA_PATH  — remote folder e.g. /home/ionic/www/JodiiReact/jodii-ota-server/ota-files
 *   OTA_SERVER_URL — public URL  e.g. https://stgmobile.jodii.app/jodiiReact/jodii-ota-server/ota-files
 *
 * Optional:
 *   CHANNEL_SUFFIX — defaults to "production"
 *   FLAVOR         — which flavor(s) to publish the update to:
 *                       unset            -> jodii,tamil,malayalam (default)
 *                       "reddy"          -> just that one flavor
 *                       "reddy,nair,sc"  -> comma-separated list of flavors
 *                       "all"            -> every flavor in constants/flavorConfig.js
 */

const { execSync } = require('child_process');
const SftpClient = require('ssh2-sftp-client');

// Load .env.ota file directly — avoids zsh special character issues
const envPath = require('path').join(__dirname, '..', '.env.ota');
if (require('fs').existsSync(envPath)) {
  require('fs').readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });
}
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CHANNEL_SUFFIX = process.env.CHANNEL_SUFFIX || 'production';
const FLAVOR_CONFIGS = require('../constants/flavorConfig');

function resolveFlavors() {
  if (!process.env.FLAVOR) return ['jodii', 'tamil', 'malayalam'];
  if (process.env.FLAVOR === 'all') return Object.keys(FLAVOR_CONFIGS);

  const flavors = process.env.FLAVOR.split(',').map(f => f.trim()).filter(Boolean);
  const unknown = flavors.filter(f => !FLAVOR_CONFIGS[f]);
  if (unknown.length) {
    console.error(`Unknown flavor(s): ${unknown.join(', ')}\nKnown flavors: ${Object.keys(FLAVOR_CONFIGS).join(', ')}`);
    process.exit(1);
  }
  return flavors;
}

const ALL_FLAVORS = resolveFlavors();
const SFTP_HOST = process.env.SFTP_HOST;
const SFTP_PORT = parseInt(process.env.SFTP_PORT || '22', 10);
const SFTP_USER = process.env.SFTP_USER;
const SFTP_PASSWORD = process.env.SFTP_PASSWORD;
const SFTP_OTA_PATH = process.env.SFTP_OTA_PATH;
const SERVER_URL = process.env.OTA_SERVER_URL;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const RUNTIME_VERSION = require('../package.json').version;

if (!SFTP_HOST || !SFTP_USER || !SFTP_PASSWORD || !SFTP_OTA_PATH || !SERVER_URL) {
  console.error(`
Missing required env vars. Set all of these:
  SFTP_HOST      = ${SFTP_HOST || '❌ missing'}
  SFTP_USER      = ${SFTP_USER || '❌ missing'}
  SFTP_PASSWORD  = ${SFTP_PASSWORD ? '✓ set' : '❌ missing'}
  SFTP_OTA_PATH  = ${SFTP_OTA_PATH || '❌ missing'}
  OTA_SERVER_URL = ${SERVER_URL || '❌ missing'}
  `);
  process.exit(1);
}

function sha256Base64Url(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('base64url');
}

async function deploy() {
  const updateId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // Step 1 — Export bundle
  if (fs.existsSync(DIST_DIR)) fs.rmSync(DIST_DIR, { recursive: true });
  console.log('\n[1/3] Exporting bundle...');
  execSync(
    'npx expo export --platform android --platform ios --output-dir dist --clear',
    { cwd: path.join(__dirname, '..'), stdio: 'inherit' }
  );

  const metadataPath = path.join(DIST_DIR, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    console.error('metadata.json not found after export');
    process.exit(1);
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

  // Step 2 — Upload via SFTP
  console.log(`\n[2/3] Uploading to server via SFTP (update id: ${updateId})`);
  const sftp = new SftpClient();

  await sftp.connect({
    host: SFTP_HOST,
    port: SFTP_PORT,
    username: SFTP_USER,
    password: SFTP_PASSWORD,
  });

  const bundleInfo = {};

  for (const platform of ['android', 'ios']) {
    const platformMeta = metadata.fileMetadata?.[platform];
    if (!platformMeta) continue;

    const remoteBase = `${SFTP_OTA_PATH}/shared/${updateId}/${platform}`;
    const urlBase = `${SERVER_URL}/shared/${updateId}/${platform}`;
    const uploadedAssets = [];

    // Upload assets
    for (const asset of platformMeta.assets || []) {
      const localPath = path.join(DIST_DIR, asset.path);
      if (!fs.existsSync(localPath)) continue;
      const content = fs.readFileSync(localPath);
      const hash = sha256Base64Url(content);
      const fileName = `${path.basename(asset.path)}.${asset.ext}`;
      const remotePath = `${remoteBase}/assets/${fileName}`;
      await sftp.mkdir(path.dirname(remotePath), true);
      await sftp.put(localPath, remotePath);
      uploadedAssets.push({
        hash,
        key: fileName,
        contentType: assetMime(asset.ext),
        fileExtension: `.${asset.ext}`,
        url: `${urlBase}/assets/${fileName}`,
      });
    }

    // Upload JS bundle
    const bundleLocal = path.join(DIST_DIR, platformMeta.bundle);
    const bundleContent = fs.readFileSync(bundleLocal);
    const bundleHash = sha256Base64Url(bundleContent);
    const remoteBundlePath = `${remoteBase}/bundle.js`;
    await sftp.mkdir(path.dirname(remoteBundlePath), true);
    await sftp.put(bundleLocal, remoteBundlePath);

    bundleInfo[platform] = {
      bundleUrl: `${urlBase}/bundle.js`,
      bundleHash,
      uploadedAssets,
    };
    console.log(`  ✓ ${platform} bundle uploaded`);
  }

  // Step 3 — Write latest.json for all flavor channels
  console.log('\n[3/3] Publishing to all flavor channels...');
  for (const flavor of ALL_FLAVORS) {
    const channel = `${flavor}-${CHANNEL_SUFFIX}`;
    for (const platform of ['android', 'ios']) {
      const b = bundleInfo[platform];
      if (!b) continue;

      const manifest = {
        id: updateId,
        createdAt: timestamp,
        runtimeVersion: RUNTIME_VERSION,
        assets: b.uploadedAssets,
        launchAsset: {
          hash: b.bundleHash,
          key: `bundle-${updateId}`,
          contentType: 'application/javascript',
          fileExtension: '.bundle',
          url: b.bundleUrl,
        },
        metadata: {},
        extra: {
          expoClient: {
            name: FLAVOR_CONFIGS[flavor].appName,
            slug: 'jodii',
            scheme: FLAVOR_CONFIGS[flavor].scheme,
            updates: {
              url: 'https://stgimg.jodii.app/jodii-ota-server/jodii-ota-server/manifest.php',
            },
            extra: {
              appType: FLAVOR_CONFIGS[flavor].appType,
              appFlavor: flavor,
            },
          },
        },
      };

      const remotePath = `${SFTP_OTA_PATH}/${flavor}/${channel}/${platform}/latest.json`;
      await sftp.mkdir(path.dirname(remotePath), true);
      const json = Buffer.from(JSON.stringify(manifest, null, 2));
      await sftp.put(json, remotePath);
      console.log(`  ✓ ${flavor} / ${platform}`);
    }
  }

  await sftp.end();
  console.log(`\nDone! Update ID: ${updateId}`);
  console.log(`${ALL_FLAVORS.length} flavor(s) will get this update on next launch: ${ALL_FLAVORS.join(', ')}\n`);
}

function assetMime(ext) {
  const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', ttf: 'font/ttf', otf: 'font/otf', json: 'application/json' };
  return map[ext] || 'application/octet-stream';
}

deploy().catch((err) => {
  console.error('Deploy failed:', err);
  process.exit(1);
});
