# Jodii Web Server — Command Reference

---

## 1. Run Landing Page + React App (Full Dev Setup)

Two terminals must run at the same time.

### Terminal 1 — Expo React App (always required)
```bash
npm run web
```
> Starts the Expo dev server on port 8081.
> This powers the `/app/` route (mobile web view, registration, OTP, matches etc).

### Terminal 2 — Landing Page Web Server (pick one flavor)
```bash
npm run serve:dev:jodi        # Language selection page (index.html)
npm run serve:dev:tamil       # Tamil   → tamiljodii.html
npm run serve:dev:malayalam   # Malayalam → index-malayalam.html
npm run serve:dev:hindi       # Hindi   → index-hindi.html
npm run serve:dev:hindhi      # Hindhi  → index-hindhi.html
npm run serve:dev:bengali     # Bengali → index-bengali.html
npm run serve:dev:gujarati    # Gujarati → index-gujarati.html
npm run serve:dev:kannada     # Kannada → index-kannada.html
npm run serve:dev:marathi     # Marathi → index-marathi.html
npm run serve:dev:oriya       # Oriya   → index-oriya.html
npm run serve:dev:eng         # English → index-eng.html
```
> Opens at **http://localhost:3000/**
> Desktop → shows landing page HTML
> Mobile browser → auto-redirects to http://localhost:8081/ (Expo)

---

## 2. Run Only React App (No Landing Page)

Use this when you are working only on the React Native / Expo screens
(splash, sign in, OTP, matches, profile etc) and don't need the landing page.

```bash
npm run web
```
> Opens Expo directly at **http://localhost:8081/**
> No web server needed. No landing page.

---

## 3. Build — Create dist/ for Production

Build the Expo web app and output to a flavor-specific folder.
Run this once before deploying or testing prod mode.

```bash
npm run build:web:tamil       # → dist-tamil/
npm run build:web:malayalam   # → dist-malayalam/
npm run build:web:jodii       # → dist-jodii/   (used by hindi, bengali, gujarati etc)
```

> After build, the `dist-<flavor>/` folder contains the full static React web app.
> This is what gets served at `/app/` in production.

---

## 4. Run Production Server (After Build)

No Expo dev server needed. Serves everything from dist folder.

```bash
npm run serve:prod:tamil       # tamiljodii.html + dist-tamil/
npm run serve:prod:malayalam   # index-malayalam.html + dist-malayalam/
npm run serve:prod:hindi       # index-hindi.html + dist-jodii/
```

> Opens at **http://localhost:3000/**
> Desktop → landing page HTML
> Mobile → serves React app from dist/ (no redirect, fully offline)

---

## 5. Start Expo with Environment (React App Only)

Use these when working on React Native screens. Picks the correct API URL and Firebase config.

```bash
npm run start:dev        # Development environment
npm run start:stg        # Staging environment
npm run start:uat        # UAT environment
npm run start:preprod    # Pre-production environment
npm run start:prod       # Production environment
```

> ⚠️ Do NOT use `npx expo start` directly — it uses whatever `.env` is on disk (currently UAT).
> Always use `npm run start:<env>` to be sure which environment you are on.

### What each command does:
1. Runs `setup-env.js` → copies the correct Firebase `google-services.json`
2. Sets `EXPO_PUBLIC_APP_ENV` via `cross-env` (works on Windows + Mac)
3. Starts Expo dev server

### Android Release Build with Environment:
```bash
# Set env first, then build APK or AAB
node scripts/setup-env.js <env>
npm run assemble:tamil        # then build
```

---

## 6. Android Release Builds — All Flavors × All Environments

> One command does everything: copies Firebase config → sets env → runs Gradle.

---

### TAMIL (App ID: jodiiapp.android.tamil)

#### APK (for testing / sharing)
```bash
npm run assemble:tamil:dev
npm run assemble:tamil:uat
npm run assemble:tamil:preprod
npm run assemble:tamil:prod
```

#### AAB (for Play Store upload)
```bash
npm run bundle:tamil:dev
npm run bundle:tamil:uat
npm run bundle:tamil:preprod
npm run bundle:tamil:prod
```

---

### MALAYALAM (App ID: jodiiapp.android.malayalam)

#### APK
```bash
npm run assemble:malayalam:dev
npm run assemble:malayalam:uat
npm run assemble:malayalam:preprod
npm run assemble:malayalam:prod
```

#### AAB
```bash
npm run bundle:malayalam:dev
npm run bundle:malayalam:uat
npm run bundle:malayalam:preprod
npm run bundle:malayalam:prod
```

---

### JODII (App ID: jodii.app)

#### APK
```bash
npm run assemble:jodii:dev
npm run assemble:jodii:uat
npm run assemble:jodii:preprod
npm run assemble:jodii:prod
```

#### AAB
```bash
npm run bundle:jodii:dev
npm run bundle:jodii:uat
npm run bundle:jodii:preprod
npm run bundle:jodii:prod
```

---

### Output APK location after build:
```
android/app/build/outputs/apk/tamil/release/app-tamil-release.apk
android/app/build/outputs/apk/malayalam/release/app-malayalam-release.apk
android/app/build/outputs/apk/jodii/release/app-jodii-release.apk
```

### Output AAB location after build:
```
android/app/build/outputs/bundle/tamilRelease/app-tamil-release.aab
android/app/build/outputs/bundle/malayalamRelease/app-malayalam-release.aab
android/app/build/outputs/bundle/jodiiRelease/app-jodii-release.aab
```

---
## 7. Re-convert PHP Source Files → HTML

Run this whenever the source files in `D:\Jod website\pwa\` are updated.

```bash
npm run convert:pwa
```

> Reads all `.php` files from `D:\Jod website\pwa\`
> Converts them to `.html` files in `web/`
> Fixes links (.php → .html), replaces PHP date code, adds mobile redirect

---

## Full Flow Summary

```
DEV (working on landing page or React screens)
─────────────────────────────────────────────
Terminal 1:  npm run web
Terminal 2:  npm run serve:dev:tamil   (or any flavor)
Browser:     http://localhost:3000/


DEV (working only on React screens — no landing page needed)
─────────────────────────────────────────────────────────────
Terminal 1:  npm run web
Browser:     http://localhost:8081/


PRODUCTION BUILD + SERVE
─────────────────────────────────────────────
Step 1:  npm run build:web:tamil        ← builds dist-tamil/
Step 2:  npm run serve:prod:tamil       ← serves landing + app
Browser: http://localhost:3000/
```

---

## Why Two Terminals?

| Terminal | What it runs | Port | Purpose |
|----------|-------------|------|---------|
| `npm run web` | Expo dev server | 8081 | Powers the React app (registration, OTP, matches) |
| `npm run serve:dev:<flavor>` | Node web server | 3000 | Serves HTML landing page, routes mobile to Expo |

The web server on port 3000 is the **public entry point**.
Desktop visitors see the landing page.
Mobile visitors get redirected to port 8081 (Expo).

---

## Flavor → File Reference

| Command suffix | Landing page served | dist folder (prod) |
|---------------|--------------------|--------------------|
| `:jodi` | `index.html` (language picker) | `dist-jodii/` |
| `:tamil` | `tamiljodii.html` | `dist-tamil/` |
| `:malayalam` | `index-malayalam.html` | `dist-malayalam/` |
| `:hindi` | `index-hindi.html` | `dist-jodii/` |
| `:hindhi` | `index-hindhi.html` | `dist-jodii/` |
| `:bengali` | `index-bengali.html` | `dist-jodii/` |
| `:gujarati` | `index-gujarati.html` | `dist-jodii/` |
| `:kannada` | `index-kannada.html` | `dist-jodii/` |
| `:marathi` | `index-marathi.html` | `dist-jodii/` |
| `:oriya` | `index-oriya.html` | `dist-jodii/` |
| `:eng` | `index-eng.html` | `dist-jodii/` |
