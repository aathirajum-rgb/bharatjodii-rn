/**
 * Jodii Web Server — Multi-flavor / Multi-domain
 *
 * Domain → Flavor mapping:
 *   tamiljodii.com    → web/tamiljodii.html    + dist-tamil/
 *   jodii.com         → web/malayalamjodii.html + dist-malayalam/
 *   jodii.app         → web/jodii.html          + dist-jodii/
 *
 * On localhost / unknown host the FLAVOR env var picks the flavor (default: tamil).
 *
 * DEV mode (default):
 *   /      → landing page HTML (flavor-specific)
 *   /app/* → 302 redirect to Expo dev server (same-host :8081)
 *
 * PROD mode (NODE_ENV=production):
 *   /      → landing page HTML
 *   /app/* → flavor-specific dist folder (run build:web:<flavor> first)
 *
 * Usage:
 *   Dev (tamil):              node scripts/web-server.js
 *   Dev (malayalam):          FLAVOR=malayalam node scripts/web-server.js
 *   Prod (auto from host):    NODE_ENV=production node scripts/web-server.js
 *
 * Env:
 *   PORT      (default 3000)
 *   EXPO_PORT (default 8081)
 *   FLAVOR    (default tamil) — used on localhost/unknown host in dev
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const EXPO_PORT = parseInt(process.env.EXPO_PORT || '8081', 10);
const IS_PROD = process.env.NODE_ENV === 'production';
const ROOT = path.join(__dirname, '..');

// ── Flavor config ─────────────────────────────────────────────────────────────
// hosts: production domain names that map to this flavor
// html:  landing page inside web/ folder (served at /)
// dist:  built Expo web export folder (created by build:web:<flavor>)
const FLAVORS = {
  tamil: {
    hosts: ['tamiljodii.com', 'www.tamiljodii.com'],
    html:  'tamiljodii.html',
    dist:  'dist-tamil',
  },
  malayalam: {
    hosts: ['jodii.com', 'www.jodii.com', 'malayalamjodii.com', 'www.malayalamjodii.com'],
    html:  'index-malayalam.html',
    dist:  'dist-malayalam',
  },
  hindi: {
    hosts: ['hindijodii.com', 'www.hindijodii.com'],
    html:  'index-hindi.html',
    dist:  'dist-jodii',
  },
  hindhi: {
    hosts: ['hindhi.jodii.com'],
    html:  'index-hindhi.html',
    dist:  'dist-jodii',
  },
  bengali: {
    hosts: ['bengalijodii.com', 'www.bengalijodii.com'],
    html:  'index-bengali.html',
    dist:  'dist-jodii',
  },
  gujarati: {
    hosts: ['gujaratijodii.com', 'www.gujaratijodii.com'],
    html:  'index-gujarati.html',
    dist:  'dist-jodii',
  },
  kannada: {
    hosts: ['kannadajodii.com', 'www.kannadajodii.com'],
    html:  'index-kannada.html',
    dist:  'dist-jodii',
  },
  marathi: {
    hosts: ['marathijodii.com', 'www.marathijodii.com'],
    html:  'index-marathi.html',
    dist:  'dist-jodii',
  },
  oriya: {
    hosts: ['oriyajodii.com', 'www.oriyajodii.com'],
    html:  'index-oriya.html',
    dist:  'dist-jodii',
  },
  eng: {
    hosts: ['engjodii.com', 'www.engjodii.com'],
    html:  'index-eng.html',
    dist:  'dist-jodii',
  },
  jodii: {
    hosts: ['jodii.app', 'www.jodii.app'],
    html:  'index.html',
    dist:  'dist-jodii',
  },
};

const DEFAULT_FLAVOR = process.env.FLAVOR || 'tamil';

function getFlavor(hostHeader) {
  const bare = (hostHeader || '').split(':')[0].toLowerCase();
  for (const [key, cfg] of Object.entries(FLAVORS)) {
    if (cfg.hosts.includes(bare)) return { key, ...cfg };
  }
  // localhost / 192.168.x.x / unknown → use FLAVOR env
  const fallback = FLAVORS[DEFAULT_FLAVOR] || FLAVORS.tamil;
  return { key: DEFAULT_FLAVOR, ...fallback };
}

// ── MIME + helpers ────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

function mimeType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function send404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send404(res);
    res.writeHead(200, { 'Content-Type': mimeType(filePath) });
    res.end(data);
  });
}

// Production: serve from flavor's dist/ with SPA fallback
function serveProd(req, res, subPath, distDir) {
  const filePath = (subPath === '' || subPath === '/')
    ? path.join(ROOT, distDir, 'index.html')
    : path.join(ROOT, distDir, subPath);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      serveFile(res, path.join(ROOT, distDir, 'index.html'));
    } else {
      serveFile(res, filePath);
    }
  });
}

// ── Server ────────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const flavor = getFlavor(req.headers.host);

  // ── Landing page ─────────────────────────────────────────────────────────
  if (url === '/' || url === `/${flavor.html}` || url === '/web' || url === '/web/') {
    return serveFile(res, path.join(ROOT, 'web', flavor.html));
  }

  // ── Static assets inside web/ (CSS, JS, images referenced by landing page) ─
  if (url.startsWith('/web/')) {
    return serveFile(res, path.join(ROOT, 'web', url.slice(5)));
  }

  if (url.startsWith('/css/') || url.startsWith('/js/') || url.startsWith('/assets/')) {
    return serveFile(res, path.join(ROOT, 'web', url));
  }

  // ── Any other file that exists in web/ (terms, sw.js, all language HTMLs, etc.) ─
  const webFilePath = path.join(ROOT, 'web', url);
  if (fs.existsSync(webFilePath) && fs.statSync(webFilePath).isFile()) {
    return serveFile(res, webFilePath);
  }

  // ── React Native web app at /app/* ────────────────────────────────────────
  if (url === '/app' || url.startsWith('/app/')) {
    const subPath = url.replace(/^\/app/, '') || '/';

    if (IS_PROD) {
      return serveProd(req, res, subPath, flavor.dist);
    } else {
      // DEV: redirect to Expo dev server (works over WiFi too)
      const host = (req.headers.host || 'localhost').split(':')[0];
      const expoUrl = `http://${host}:${EXPO_PORT}${subPath}`;
      res.writeHead(302, { Location: expoUrl });
      res.end();
    }
    return;
  }

  send404(res);
});

server.listen(PORT, () => {
  const mode = IS_PROD ? 'PRODUCTION' : 'DEVELOPMENT';

  console.log('');
  console.log(`  Jodii Web Server  [${mode}]`);
  console.log('  ─────────────────────────────────────────────────────');
  console.log(`  Default flavor    →  ${DEFAULT_FLAVOR}  (set FLAVOR=malayalam to change)`);
  console.log('');
  console.log('  Domain routing:');
  for (const [key, cfg] of Object.entries(FLAVORS)) {
    console.log(`    ${cfg.hosts[0].padEnd(22)} → ${cfg.html}  +  ${cfg.dist}/`);
  }
  console.log('');
  console.log(`  Local:  http://localhost:${PORT}/`);
  if (IS_PROD) {
    const flavor = FLAVORS[DEFAULT_FLAVOR] || FLAVORS.tamil;
    console.log(`  App:    http://localhost:${PORT}/app/  (served from ${flavor.dist}/)`);
  } else {
    console.log(`  App:    http://localhost:${PORT}/app/  → redirects to :${EXPO_PORT}`);
    console.log(`  Keep "npm run web" running in another terminal`);
  }
  console.log('');
});
