/**
 * OTA Server Scaffold — regenerates the companion `jodii-ota-server` repo
 * (sibling of this repo) from scratch, in one command.
 *
 * Usage:
 *   node scripts/create-ota-server.js
 *   npm run ota:server:create
 *
 * Writes to ../jodii-ota-server (relative to this repo root). Existing files
 * are overwritten. Once generated, either:
 *   - copy the ../jodii-ota-server folder to your server as-is (manifest.php
 *     path — what production actually serves, see app.config.js `updates.url`
 *     and .env.ota's OTA_SERVER_URL), or
 *   - run it locally for testing: `npm run ota:server`.
 *
 * This script is the source of truth for that folder's contents — if you
 * change server.js/manifest.php/etc. by hand in ../jodii-ota-server, port
 * the change back into this script too, or it'll be lost on next generate.
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', '..', 'jodii-ota-server');

const FILES = {
  'package.json': `{
  "name": "jodii-ota-server",
  "version": "1.0.0",
  "main": "src/functions/manifest.js",
  "scripts": {
    "start": "func start"
  },
  "dependencies": {
    "@azure/functions": "^4.0.0",
    "@azure/storage-blob": "^12.0.0"
  }
}
`,

  'host.json': `{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
`,

  // The manifest endpoint actually live in production — served as PHP from
  // the same host deploy-ota.js uploads bundles to via SFTP. Matches
  // app.config.js's `updates.url` and .env.ota's OTA_SERVER_URL layout.
  'manifest.php': `<?php
$platform = $_SERVER['HTTP_EXPO_PLATFORM'] ?? '';
$channel  = $_SERVER['HTTP_EXPO_CHANNEL_NAME'] ?? 'production';
$flavor   = $_SERVER['HTTP_EXPO_FLAVOR'] ?? 'jodii';
$current  = $_SERVER['HTTP_EXPO_CURRENT_UPDATE_ID'] ?? '';

// The written protocol spec (docs.expo.dev/technical-specs/expo-updates-1) says
// a plain-JSON (non-multipart) "no update" response SHOULD be 406. The actual
// expo-updates Android client does NOT implement that: FileDownloader.kt checks
// OkHttp's response.isSuccessful (true only for 2xx), and 406 fails that check
// immediately — before it ever reaches the code that treats 204 as a clean
// no-op. Only 204 gets that special no-op handling, and only when these
// protocol headers are present (without expo-protocol-version, a bare 204 is
// treated as "Invalid update response: Empty body" instead). So despite what
// the spec says, headers + 204 is the combination the real client accepts —
// headers + 406 throws "Remote update request not successful", and a
// header-less 204 (the original bug) throws "Failed to check for update".
function sendProtocolHeaders() {
    header('expo-protocol-version: 1');
    header('expo-sfv-version: 0');
    header('expo-manifest-filters: ');
    header('expo-server-defined-headers: ');
    header('cache-control: private, max-age=0');
}

$file = __DIR__ . "/ota-files/$flavor/$channel/$platform/latest.json";

if (!file_exists($file)) {
    sendProtocolHeaders();
    http_response_code(204);
    exit;
}

$raw = file_get_contents($file);
$manifest = json_decode($raw, true);

if ($manifest['id'] === $current) {
    sendProtocolHeaders();
    http_response_code(204);
    exit;
}

// Forward the ORIGINAL bytes, not json_encode($manifest) — PHP's array/object
// json_decode+json_encode round-trip can't tell an empty JSON object ({}) from
// an empty JSON array ([]) (both decode to array()), so deploy-ota.js's
// "metadata": {} was silently coming back out as "metadata": []. The native
// Android client requires metadata to be a JSON object and throws
// "Value [] at metadata ... cannot be converted to JSONObject" on every
// single check when it isn't — which is what was actually causing the
// permanent "Failed to check for update" failure (separate from, and on top
// of, the missing-headers/204-vs-406 issue fixed above).
header('Content-Type: application/json');
sendProtocolHeaders();
echo $raw;
`,

  // Plain-Node standalone server — same manifest logic as manifest.php, for
  // local testing (npm run ota:server) without needing PHP installed.
  'server.js': `/**
 * Jodii OTA Manifest Server
 *
 * Run this on your local server:
 *   node server.js
 *
 * Required env vars:
 *   OTA_FILES_PATH  — folder where deploy-ota.js copies files (e.g. /var/www/ota)
 *   PORT            — port to listen on (default: 4000)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const OTA_FILES_PATH = process.env.OTA_FILES_PATH || '/var/www/ota';
const PORT = process.env.PORT || 4000;

const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url);

  // POST /manifest — called by expo-updates on every app launch
  if (pathname === '/manifest') {
    const runtimeVersion = req.headers['expo-runtime-version'];
    const platform = req.headers['expo-platform'];
    const channelName = req.headers['expo-channel-name'] || 'production';
    const currentUpdateId = req.headers['expo-current-update-id'];
    const flavor = req.headers['expo-flavor'] || 'jodii';

    if (!runtimeVersion || !platform) {
      res.writeHead(400);
      res.end('Missing headers');
      return;
    }

    const latestJsonPath = path.join(OTA_FILES_PATH, flavor, channelName, platform, 'latest.json');

    // The written protocol spec (docs.expo.dev/technical-specs/expo-updates-1) says
    // a plain-JSON (non-multipart) "no update" response SHOULD be 406. The actual
    // expo-updates Android client does NOT implement that: FileDownloader.kt checks
    // OkHttp's response.isSuccessful (true only for 2xx), and 406 fails that check
    // immediately — before it ever reaches the code that treats 204 as a clean
    // no-op. Only 204 gets that special no-op handling, and only when these
    // protocol headers are present (without expo-protocol-version, a bare 204 is
    // treated as "Invalid update response: Empty body" instead). So despite what
    // the spec says, headers + 204 is the combination the real client accepts.
    const protocolHeaders = {
      'expo-protocol-version': '1',
      'expo-sfv-version': '0',
      'expo-manifest-filters': '',
      'expo-server-defined-headers': '',
      'cache-control': 'private, max-age=0',
    };

    if (!fs.existsSync(latestJsonPath)) {
      res.writeHead(204, protocolHeaders);
      res.end();
      return;
    }

    const manifest = JSON.parse(fs.readFileSync(latestJsonPath, 'utf-8'));

    // App already has this update
    if (manifest.id === currentUpdateId) {
      res.writeHead(204, protocolHeaders);
      res.end();
      return;
    }

    // Runtime version mismatch — needs native store update
    if (manifest.runtimeVersion !== runtimeVersion) {
      res.writeHead(204, protocolHeaders);
      res.end();
      return;
    }

    res.writeHead(200, {
      'content-type': 'application/json',
      ...protocolHeaders,
    });
    res.end(JSON.stringify(manifest));
    return;
  }

  // GET /files/* — serve bundle and asset files
  if (pathname.startsWith('/files/')) {
    const filePath = path.join(OTA_FILES_PATH, pathname.replace('/files/', ''));
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const mimeMap = { '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json' };
    res.writeHead(200, { 'content-type': mimeMap[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(\`Jodii OTA server running on port \${PORT}\`);
  console.log(\`Serving files from: \${OTA_FILES_PATH}\`);
  console.log(\`Manifest endpoint: http://YOUR_SERVER_IP:\${PORT}/manifest\`);
});
`,

  // Azure Functions variant — only relevant if this server is deployed to
  // Azure (Blob Storage-backed) instead of the PHP host. Unused by the
  // current deploy-ota.js/app.config.js wiring, kept for parity with the
  // existing folder.
  [path.join('src', 'functions', 'manifest.js')]: `const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

app.http('manifest', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'manifest',
  handler: async (request) => {
    const runtimeVersion = request.headers.get('expo-runtime-version');
    const platform = request.headers.get('expo-platform'); // 'android' or 'ios'
    const channelName = request.headers.get('expo-channel-name') || 'production';
    const currentUpdateId = request.headers.get('expo-current-update-id');
    const flavor = request.headers.get('expo-flavor') || 'jodii';

    if (!runtimeVersion || !platform) {
      return { status: 400, body: 'Missing required headers' };
    }

    const blobService = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    const container = blobService.getContainerClient('ota-updates');

    // latest.json is written by the deploy script after each OTA push
    const latestBlobName = \`\${flavor}/\${channelName}/\${platform}/latest.json\`;

    try {
      const blobClient = container.getBlockBlobClient(latestBlobName);
      const buffer = await blobClient.downloadToBuffer();
      const manifest = JSON.parse(buffer.toString());

      // App already has this update
      if (manifest.id === currentUpdateId) {
        return { status: 204 };
      }

      // Runtime version mismatch means a native build update is needed — skip OTA
      if (manifest.runtimeVersion !== runtimeVersion) {
        return { status: 204 };
      }

      return {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'expo-protocol-version': '1',
          'cache-control': 'no-store',
        },
        body: JSON.stringify(manifest),
      };
    } catch {
      // No update available for this channel/platform
      return { status: 204 };
    }
  },
});
`,
};

for (const [relPath, content] of Object.entries(FILES)) {
  const fullPath = path.join(OUT_DIR, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  console.log(`✓ ${path.relative(path.join(OUT_DIR, '..'), fullPath)}`);
}

console.log(`\nGenerated jodii-ota-server at: ${OUT_DIR}`);
console.log('Copy this folder to your server, or run it locally with: npm run ota:server');
