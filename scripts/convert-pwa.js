/**
 * scripts/convert-pwa.js
 *
 * Converts all PHP landing pages from D:\Jod website\pwa\ to clean HTML
 * files in the jodiireact/web/ folder, ready to be served by web-server.js.
 *
 * Transformations applied:
 *  - <?= date("Y"); ?> → 2026
 *  - href/src *.php → *.html
 *  - Adds window.crypto.randomUUID polyfill (needed for landing-page.js on HTTP)
 *  - Adds html { visibility: hidden } + JS visibility restore (prevents flash)
 *
 * Static files copied as-is:
 *  sw.js, terms.html, privacy-policy.html, success-stories.html,
 *  app-ads.txt, ads.txt, ad.html, manifest.json,
 *  intermediatepage-language.html
 *
 * Usage:
 *   node scripts/convert-pwa.js
 */

const fs = require('fs');
const path = require('path');

const SRC  = 'D:\\Jod website\\pwa';
const DEST = path.join(__dirname, '..', 'web');

// ── PHP files to convert → output filename ───────────────────────────────────
const PHP_FILES = [
  { src: 'index.php',           out: 'index.html' },
  { src: 'index-hindi.php',     out: 'index-hindi.html' },
  { src: 'index-hindhi.php',    out: 'index-hindhi.html' },
  // index-tamil.html is kept in sync with tamiljodii.html (manually polished).
  // Uncomment below only if you want to re-convert from the raw PHP source:
  // { src: 'index-tamil.php', out: 'index-tamil.html' },
  { src: 'index-malayalam.php', out: 'index-malayalam.html' },
  { src: 'index-bengali.php',   out: 'index-bengali.html' },
  { src: 'index-gujarati.php',  out: 'index-gujarati.html' },
  { src: 'index-kannada.php',   out: 'index-kannada.html' },
  { src: 'index-marathi.php',   out: 'index-marathi.html' },
  { src: 'index-oriya.php',     out: 'index-oriya.html' },
  { src: 'index-eng.php',       out: 'index-eng.html' },
  { src: 'index-punjabi.php',   out: 'index-punjabi.html' },
  { src: 'index-telugu.php',    out: 'index-telugu.html' },
  { src: 'index-telegu.php',    out: 'index-telegu.html' },
  { src: 'pwa.php',             out: 'pwa.html' },
  { src: 'index-pwa.php',       out: 'index-pwa.html' },
];

// ── Static files to copy verbatim ─────────────────────────────────────────────
const STATIC_FILES = [
  'sw.js',
  'terms.html',
  'privacy-policy.html',
  'success-stories.html',
  'intermediatepage-language.html',
  'app-ads.txt',
  'ads.txt',
  'ad.html',
  'manifest.json',
];

// ── Polyfill + visibility trick injected right after <head> ───────────────────
// Only injected when the page uses landing-page.js (has registration forms).
const POLYFILL_SNIPPET = `
    <style>html { visibility: hidden; }</style>
    <script>
      // Skip redirect when opened as a local file
      if (location.protocol !== 'file:') {
        var _ua = navigator.userAgent || '';
        var _mobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(_ua)
                      || window.innerWidth < 768;
        if (_mobile) {
          document.documentElement.style.visibility = 'visible';
          location.replace('/app/');
        } else {
          document.documentElement.style.visibility = 'visible';
        }
      } else {
        document.documentElement.style.visibility = 'visible';
      }
      // Polyfill for window.crypto.randomUUID (unavailable on HTTP non-secure contexts)
      if (typeof window.crypto === 'undefined') window.crypto = {};
      if (typeof window.crypto.randomUUID !== 'function') {
        window.crypto.randomUUID = function() {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });
        };
      }
    </script>`;

function convertPhp(src, content) {
  // 1. Replace PHP date function
  content = content.replace(/<!--\?=\s*date\("Y"\);\s*\?-->/g, '2026');
  content = content.replace(/<\?=\s*date\("Y"\);\s*\?>/g, '2026');
  content = content.replace(/\<\?php\s+echo\s+date\("Y"\);\s*\?>/g, '2026');

  // 2. Rewrite .php → .html in href/src attributes
  content = content.replace(/(href|src)="([^"]*?)\.php(\?[^"]*)?"/g, (match, attr, file, qs) => {
    // Keep external URLs untouched
    if (file.startsWith('http')) return match;
    return `${attr}="${file}.html${qs || ''}"`;
  });

  // 3. Inject polyfill + visibility trick after <head> tag
  //    Only for pages that have registration forms (use landing-page.js).
  //    The index.php language-selection page is desktop-only so also inject.
  const hasLandingScript = content.includes('landing-page.js') || content.includes('language-selection.js');
  if (hasLandingScript) {
    content = content.replace(/<head>/i, `<head>${POLYFILL_SNIPPET}`);
  }

  return content;
}

// ── Main ──────────────────────────────────────────────────────────────────────
let ok = 0, skip = 0, errors = 0;

for (const { src, out } of PHP_FILES) {
  const srcPath  = path.join(SRC, src);
  const destPath = path.join(DEST, out);

  if (!fs.existsSync(srcPath)) {
    console.log(`  SKIP  ${src}  (not found)`);
    skip++;
    continue;
  }

  try {
    let content = fs.readFileSync(srcPath, 'utf8');
    content = convertPhp(src, content);
    fs.writeFileSync(destPath, content, 'utf8');
    console.log(`  OK    ${src}  →  web/${out}`);
    ok++;
  } catch (e) {
    console.error(`  ERR   ${src}: ${e.message}`);
    errors++;
  }
}

for (const file of STATIC_FILES) {
  const srcPath  = path.join(SRC, file);
  const destPath = path.join(DEST, file);

  if (!fs.existsSync(srcPath)) {
    console.log(`  SKIP  ${file}  (not found)`);
    skip++;
    continue;
  }

  try {
    fs.copyFileSync(srcPath, destPath);
    console.log(`  COPY  ${file}  →  web/${file}`);
    ok++;
  } catch (e) {
    console.error(`  ERR   ${file}: ${e.message}`);
    errors++;
  }
}

console.log(`\n  Done — ${ok} files written, ${skip} skipped, ${errors} errors\n`);
