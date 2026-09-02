# Jodii App — Project Documentation

## Table of Contents
- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How the Project Works](#how-the-project-works)
- [App Brands / White-labeling](#app-brands--white-labeling)
- [Config Plugins](#config-plugins)
- [Navigation & Screens](#navigation--screens)
- [State Management & API Layer](#state-management--api-layer)
- [Environments](#environments)
- [Feature Areas](#feature-areas)
- [Known Gaps](#known-gaps)
- [Setup & Installation](#setup--installation)
- [Development](#development)
- [Building for Android](#building-for-android)
- [Build Size Optimization](#build-size-optimization)
- [Building for iOS](#building-for-ios)
- [EAS Cloud Builds](#eas-cloud-builds)
- [OTA Updates](#ota-updates)
- [Troubleshooting](#troubleshooting)

---

## Project Overview

**Jodii** is a matrimony app, originally an Angular web app, now rebuilt as a cross-platform Expo/React Native app targeting Android, iOS, and Web from a single TypeScript codebase. It ships as **multiple white-label brands** (Jodii, Tamil Jodii, Malayalam Jodii, plus more language variants for the web marketing sites) from one codebase.

- **Package name (npm):** `jodii`, version `1.0.0`
- **Default bundle ID (iOS):** `com.matrimony.jodii` (per-flavor IDs differ — see [App Brands](#app-brands--white-labeling))
- **Default package name (Android):** `com.jodii.app` (per-flavor IDs differ)
- **iOS Xcode project:** `ios/TamilJodii.xcodeproj` (name is a holdover from when this was originally the Tamil-only app — there is no `Jodii.xcworkspace`, only `ios/TamilJodii`/`ios/TamilJodii.xcodeproj` + generated `Pods`)
- **Expo SDK:** `~57.0.13`
- **React Native:** `0.85.3`
- **React:** `19.2.3`

> Expo SDK 56 changed a lot from older SDKs. Before writing code, check the versioned docs at https://docs.expo.dev/versions/v56.0.0/ (see `AGENTS.md`).

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Expo | ~56.0.9 | Framework & build tooling |
| React Native | 0.85.3 | Cross-platform UI |
| React | 19.2.3 | UI library |
| TypeScript | ~6.0.3 | Type safety (strict mode) |
| EAS | >= 16.0.0 | Cloud builds & distribution |
| @react-navigation/native + native-stack | ^7.x | Navigation (manual stacks, no Expo Router) |
| axios | ^1.18.0 | HTTP client (hand-rolled wrapper, see below) |
| socket.io-client | ^4.8.3 | Real-time chat / in-app notifications |
| react-native-razorpay | ^3.0.0 | Payments |
| i18next / react-i18next | ^26.x / ^17.x | Localization (11 languages) |
| react-native-svg | 15.15.4 | SVG rendering (use `SvgUri` for remote SVGs, not `Image`) |
| @react-native-async-storage/async-storage | ^3.1.1 | Local persistence (tokens, session, app config) |
| crypto-js | ^4.2.0 | Payload encryption |
| lottie-react-native / @lottiefiles/dotlottie-react | latest | Animations |
| expo-camera, expo-image, expo-image-picker, expo-media-library | ~56.x | Photo capture/upload |
| expo-location, expo-notifications, expo-updates | ~56.x | Location, push, OTA |

There is **no Redux/Zustand/MobX/React Query**. Global state is React Context (`AuthContext`) + AsyncStorage-backed services. There is **no form library** (Formik/react-hook-form) — forms are manual component state. A `store/` directory exists but is empty (only `.gitkeep`) — not currently used.

There is **no test infrastructure** — no Jest config, no `__tests__`, no testing-library packages. This is a real gap, not an oversight to assume away.

---

## Project Structure

This app uses **manual React Navigation** (native-stack) — there is **no `app/` directory and no Expo Router**.

```
jodiireact/
├── App.tsx                # Root component — bootstraps config, fonts, providers, navigation
├── index.ts                # Entry point — registerRootComponent(App)
├── app.json                 # Static Expo config (base name/icons/splash/bundle IDs)
├── app.config.js             # Dynamic Expo config — resolves flavor, permissions, OTA URL, plugins
├── eas.json                  # EAS Build profiles (per-flavor + per-env)
├── tsconfig.json              # Strict TypeScript config (extends expo/tsconfig.base)
├── eslint.config.js            # Flat ESLint config (eslint-config-expo + prettier)
├── package.json                # Dependencies and npm scripts
│
├── navigation/                # RootNavigation, AuthStack, AppStack
├── screens/                    # auth/, dev/, home/, matches/, onboarding/, payment/ + top-level screens
├── components/                 # ~28 reusable UI component folders (button, dropdown, chip, bottom-sheet, matches-card, etc.)
├── contexts/                   # AuthContext.tsx (the only context)
├── service/                    # ~20 service modules — API client, auth, chat, payment, etc. (many ported from the legacy Angular app)
├── adapters/                   # Data adapters (e.g. matches.adapter.ts)
├── core/base/                  # base.adapter.ts
├── hooks/                      # useOTAUpdate.ts
├── constants/                  # env config, colors, storage keys, flavorConfig.js, registration constants
├── types/                      # enums/ and interfaces/
├── utils/                      # navigationRef.ts, etc.
├── i18n/                       # i18next setup
├── locales/                    # 11 language JSON files
├── plugins/                    # Custom Expo config plugins — see "Config Plugins" section below
├── scripts/                    # setup-env.js, deploy-ota.js, flavor-cli.js
├── assets/                     # Images, icons, splash screens
├── web-redirect/               # Static marketing redirect page
├── envs/.env.template           # Tracked template; real .env is gitignored, copy-paste from this per env
├── .env.ota                     # Gitignored, hand-maintained — OTA SFTP creds + server URLs (see OTA Updates)
├── android/                     # Native Android project (Gradle, product flavors)
└── ios/                         # Native iOS project (Xcode project is named TamilJodii)
```

---

## How the Project Works

1. **Entry Point:** `index.ts` calls `registerRootComponent(App)`.

2. **App.tsx** bootstraps the app before rendering anything:
   - Calls `SplashScreen.preventAutoHideAsync()`.
   - `initializeAppConfig()` seeds AsyncStorage with `APPTYPE` (from `Constants.expoConfig.extra.appType`), `WEBLOGIN`, `APPVERSION`, `GLASSBOXFLAG`, and sets the default i18next language.
   - Runs `useOTAUpdate()` to check for an OTA update on mount.
   - Loads Poppins fonts (Regular/Medium/SemiBold/Bold/Black) via `useFonts`.
   - Registers `expo-notifications` foreground handlers.
   - Renders `null` until both config init and fonts are ready.
   - Provider tree: `SafeAreaProvider` → `AuthProvider` (`contexts/AuthContext`) → `RootNavigation`.

3. **`app.config.js`** dynamically resolves the active brand/flavor and permissions at build time (see below) — `app.json` only holds static defaults.

4. **`eas.json`** defines both generic and per-flavor build profiles used by EAS cloud builds.

---

## App Brands / White-labeling

The single source of truth for every brand/flavor is `constants/flavorConfig.js` — a flat object keyed by flavor name, selected via `APP_FLAVOR` at build time. As of 2026-08-21 it defines **55 flavors**: the 3 original ones plus 52 more ported from the old native Android project's `build.gradle.kts.jinja` (`productFlavors`, `dimension "app"`).

| Group | Flavors |
|---|---|
| Original 3 (fully set up, real icons) | `jodii` (default, app type 115), `tamil` (116), `malayalam` (118) |
| Language brands (ported 2026-08-21) | `telugu`, `kannada`, `oriya`, `bengali`, `marathi`, `gujarati`, `hindi`, `punjabi` |
| Community/caste brands (ported 2026-08-21) | `ninetysixkulimaratha`, `ezhava`, `nair`, `kayastha`, `lingayath`, `khandayat`, `sc`, `vokkaliga`, `vishwakarma`, `patel`, `adidravidar`, `teli`, `vanniyar`, `reddy`, `kapu`, `viswabrahmin`, `thiyya`, `kuruba`, `gowda`, `nadar`, `aryavysya`, `prajapati`, `konguvellalar`, `thevar`, `kshatriya`, `kamma`, `rajput`, `agarwal`, `yadav`, `mali`, `st`, `naidu`, `mudaliyar`, `chettiyar`, `padmasali`, `jat`, `baniya`, `pillai` |
| Religion/status brands (ported 2026-08-21) | `brahmin`, `christian`, `muslim`, `divorcee`, `jain`, `sikh` |

Each entry has `appType`, `appName`, `applicationId`, `scheme`, `domain`, `welcomeText`, `icon`, `playStoreUrl` — see the file directly for exact values (keys use this project's shortened-name convention, e.g. `brahmin` not the native project's `brahminjodii`; `applicationId`/`appType` are copied verbatim from the native source).

> **The 52 new flavors currently reuse the generic Jodii icon as a placeholder** (`icon: './assets/icon.png'`) — real per-flavor icons are a follow-up. Update the `icon` path in `flavorConfig.js` and re-run `npx expo prebuild --platform android` to regenerate that flavor's launcher icons once real assets are ready.

This is implemented via:
- `plugins/withAndroidFlavors.js` — custom Expo config plugin that injects the Gradle `productFlavors` block (one entry per `flavorConfig.js` key) and generates per-flavor launcher icons (all densities + adaptive-icon XML) at prebuild time.
- `app.config.js` — sets bundle ID, scheme, deep-link domain, and `extra.appType`/`extra.appFlavor` per flavor.
- Per-flavor EAS build profiles in `eas.json` (`jodii-preview`, `jodii-production`, `tamil-preview`, `tamil-production`, `malayalam-preview`, `malayalam-production` — **not yet added for the 52 new flavors**) that map to Gradle tasks like `:app:assembleJodiiRelease` / `:app:bundleTamilRelease`.
- Matching npm scripts: `assemble:<flavor>[:env]`, `bundle:<flavor>[:env]`, `eas:<flavor>:apk|aab`, `build:web:<flavor>` (**only wired for jodii/tamil/malayalam** — the 52 new flavors must be built directly via Gradle, e.g. `./android/gradlew -p android assembleBrahminDebug`, until scripts/EAS profiles are added for them).

Deep linking supports `https://jodii.app`, `https://tamil.jodii.app`, `https://malayalam.jodii.app`, plus each flavor's custom URL scheme (see `navigation/RootNavigation.tsx` `linking` config). Deep-link domains for the 52 new flavors are placeholder guesses (not verified against real DNS/App Links config).

### Firebase project (all flavors share ONE project)

All 55 flavors' Android/iOS apps are registered inside a **single** Firebase project: `jodii-app`. This was confirmed by cross-checking the old Angular app's `src/environments/environment*.ts` (`fireBaseObj` — every language entry across every env file uses the identical `projectId: "jodii-app"`) — a previous version of `constants/firebase.config.ts` incorrectly invented a separate project per language (`jodii-tamil`, `jodii-telugu`, ...) that doesn't exist anywhere in the real source; this was corrected 2026-08-21.

Required local files (gitignored, never committed — must be supplied per machine):
```
firebase/google-services.<flavor>.json        # Android, one per flavor
firebase/GoogleService-Info.<flavor>.plist    # iOS, one per flavor
```
`app.config.js` reads `./firebase/google-services.${flavor}.json` / `./firebase/GoogleService-Info.${flavor}.plist` for whichever flavor is active (`APP_FLAVOR` env var) — prebuild fails if the active flavor's file is missing.

Get these from the Firebase Console (`jodii-app` project → Project Settings → Your apps) — or, for Android, from this internal CDN pattern (folder name = the *native* flavor name, e.g. `brahminjodii`, not this repo's shortened key):
```
https://stageimgs.bharatmatrimony.com/AndroidApks/JodiiPipeline/<native-flavor-name>/google-services.json
```
As of 2026-08-21, **19 of the 52 new flavors don't have a Firebase app registered yet** (404 on that CDN path): `ninetysixkulimaratha`, `nair`, `sc`, `vokkaliga`, `vishwakarma`, `patel`, `teli`, `vanniyar`, `reddy`, `viswabrahmin`, `thiyya`, `prajapati`, `thevar`, `rajput`, `yadav`, `st`, `naidu`, `padmasali`, `pillai`. These flavors' `google-services.json` step will fail at prebuild time until a Firebase Android app is created for them — this doesn't affect jodii/tamil/malayalam or the other 33.

---

## Config Plugins

All Android/iOS native customizations this app needs beyond what Expo config supports live in `plugins/` and are wired into `app.config.js`'s `plugins` array. They all re-apply on every `expo prebuild` — this is what makes it safe to `--clean` regenerate `android/`/`ios/` without losing custom native code.

| Plugin | Platform | What it does |
|---|---|---|
| `withAndroidFlavors.js` | Android | Injects the Gradle `productFlavors` block from `constants/flavorConfig.js`; generates per-flavor launcher icons at every density. |
| `withAndroidBuildCustomizations.js` | Android | Other `android/app/build.gradle` tweaks (release keystore signing config, ML Kit barcode-scanning exclusion, etc. — see the file for the current list). |
| `withFirebaseAndroid.js` | Android | Copies each flavor's `firebase/google-services.<flavor>.json` into `android/app/src/<flavor>/`, and re-applies the `google-services` Gradle plugin/classpath lines. Missing files are skipped with a warning, not a hard failure. |
| `withFirebaseIOS.js` | iOS | Adds `$RNFirebaseDisableSPM = true` to `ios/Podfile` — without it, `react-native-firebase` resolves Firebase via Swift Package Manager, which collides with this project's static linkage and breaks `pod install` (`SPM + static linkage is not supported`). Added 2026-08-21. |
| `withRazorpayAndroidBridge.js` | Android | Copies the hand-written `RazorpayBridgeModule.kt`/`RazorpayWebView.kt`/`RazorpayBridgePackage.kt` (source in `plugins/android-native-src/razorpay/`) into `android/app/src/main/java/jodii/app/`, registers the package in `MainApplication.kt`, adds the Gradle dependency and the `AndroidManifest.xml` activity/meta-data entries. |
| `withPayUAndroidBridge.js` | Android | Same pattern as the Razorpay plugin, for `plugins/android-native-src/payu/`. |

**Why this matters:** these plugins are the only reason `android/app/src/main/**` custom native code survives a prebuild. If a prebuild ever runs partway and fails (e.g. a missing `firebase/*.json` — see below), the files these plugins manage can end up deleted/reset in the working tree with no build error until something tries to use them later. If you ever see `MainApplication.kt` missing `RazorpayBridgePackage()`/`PayUBridgePackage()`, or `android/app/build.gradle` missing the `productFlavors` block or reset to a generic `applicationId` like `com.jodii`, that's this failure mode — re-running a *successful* `npx expo prebuild --platform android --clean` (with all required `firebase/*.json` files present) reapplies everything correctly in one pass.

---

## Navigation & Screens

Navigation lives in `/navigation` (React Navigation native-stack, no Expo Router):

- **`RootNavigation.tsx`** — wraps `NavigationContainer`, configures deep-link prefixes, and switches between `AuthStack`/`AppStack` based on `useAuth().isAuthenticated`. Also runs an **auth guard** on every navigation state change (ported from the Angular `AuthGuardUser.canActivate()`) that silently refreshes the session if more than 1 hour has passed since the last auto-login.
- **`AuthStack.tsx`** — `Splash` (SplashAnimationScreen), `LanguageSelection`, `login` (LoginScreen), `otp` (OTPScreen — params: `mobile`, `countryCode`, `matriId`).
- **`AppStack.tsx`** — `Matches` (initial route for existing users), `Home`/`dashboard` (HomeScreen), `onboarding` (routed internally by an `OnboardingRouter` keyed on a numeric `pageNo`), `Permissions`, `Gallery`, `recharge`, `payment-success`, `ComponentShowcase` (dev-only).

**Screens by folder:**
- Top-level: `GalleryScreen`, `LanguageSelectionScreen`, `PermissionDemoScreen`, `SplashAnimationScreen`
- `auth/`: `LoginScreen`, `OTPScreen`
- `dev/`: `ComponentShowcaseScreen` (internal component library/demo)
- `home/`: `HomeScreen`
- `matches/`: `MatchesScreen`
- `onboarding/` (~21 screens): Name, Gender, DOB, MaritalStatus, Height, EatingHabit, MotherTongue, Location, HomeTown, HomeTownLocation, Qualification, Occupation, MonthlyIncome, Religion, Caste, Gothra, StarRaasi, Dosham, FamilyDetails, PropertyDetails, AddPhoto, CreatedBy
- `payment/`: `RechargeScreen`, `PaymentSuccessScreen`

---

## State Management & API Layer

- **Global state:** React Context only — `contexts/AuthContext.tsx` holds `{ isAuthenticated, userId, loading, isNewUser }`, backed by AsyncStorage (`ATN` token, `NBID` user id) via `service/storageService.ts`.
- **API client:** `service/apiClient.ts` — a hand-rolled axios wrapper (ported from an Angular `httpservice`), `application/x-www-form-urlencoded`, 30s timeout.
  - `apiCall(url, method, params)` auto-appends common params (`APPTYPE`, `LANG`, `ATN`, `RTN`) based on endpoint category defined in `service/api.endpoints.ts` (`AUTH_ONLY_ENDPOINTS`, `APPTYPE_ONLY_ENDPOINTS`, `MEDIA_ENDPOINTS`).
  - Custom `ERRCODE` handling: `22`/`61` → silent token refresh + single retry; `23` → force logout via `clearSession()` (registers a logout callback into `AuthContext` to redirect to `AuthStack`).
  - `uploadFile()` for multipart uploads; `fetchUserIp()` via `api.ipify.org` for token generation.
  - `service/api.endpoints.ts` builds ~80+ endpoint URLs from `EnvConfig` across auth, registration, listing, chat, payment, and notify domains.
- **Real-time:** `service/socketService.ts` wraps `socket.io-client` as a singleton (ported from a 583-line Angular RxJS service) for chat + in-app notifications, connecting to `EnvConfig.notify`.

---

## Environments

Environment config lives in `constants/env/`:
- `types.ts` defines `IEnvConfig` (`env`, `production`, `release`, `api`, `payment`, `paymentNg`, `notify`, `image` CDN base).
- Per-env files: `env.dev.ts`, `env.stg.ts`, `env.uat.ts`, `env.preprod.ts`, `env.prod.ts`.
- Selected via `EXPO_PUBLIC_APP_ENV` (default `dev`) in `env/index.ts`, re-exported via `constants/env.config.ts`.
- `envs/.env.template` is the only tracked env file — real `.env` is gitignored, copied by hand from the template per environment. `scripts/setup-env.js <env>` (invoked automatically by the `start:<env>` npm scripts) only copies the per-env Firebase config files (`google-services.json`/`GoogleService-Info.plist`), not `.env` itself.
- `.env.ota` (repo root, gitignored, hand-maintained) is separate — OTA deploy credentials, see [OTA Updates](#ota-updates).

---

## Feature Areas

- **Matching/browsing:** `screens/matches/MatchesScreen`, `components/matches-card`, `components/swiper-card`, `adapters/matches.adapter.ts`, `service/homeService.ts`, `service/filterService.ts`.
- **Onboarding/profile creation:** ~21-screen flow covering identity, demographics, location, education/occupation/income, religion/caste/gothra/star-raasi/dosham, family & property details, and photo upload. Driven by `service/registrationService.ts` and `constants/registration.constants.ts`.
- **Auth/OTP login:** mobile + OTP based (`LoginScreen`, `OTPScreen`), with `service/encryptionService.ts` (crypto-js) encrypting payloads.
- **Photo upload/gallery:** `AddPhotoScreen`, `GalleryScreen`, `components/profile-photo`, via `expo-image-picker`/`expo-camera`/`expo-media-library`.
- **Chat/messaging:** `screens/chat/ChatScreen.tsx` (added 2026-08-21) — one-to-one chat with text, read ticks, date grouping, block/report, message-quota gating (3-message first-reply limit + daily/weekly/monthly caps + paid-balance checks), image/video attachments (`components/chat/AttachmentPreviewModal.tsx`, `ChatMediaViewerModal.tsx`, `service/chatMediaService.ts`), and voice messages (press-and-hold recording via `expo-audio`, 1s minimum/3min cap, playback via `ChatBubble.tsx`'s `AudioBubble`). Backed by `service/socketService.ts` (socket.io, real-time) and `service/chatService.ts` (quota/balance checks). `screens/messagerList/MessagerListScreen.tsx` lists conversations (both "All Messages" and "Phone number views" tabs) and navigates into `ChatScreen`. Not yet built: pdf/document attachments.
- **Payments/subscription:** `RechargeScreen`, `PaymentSuccessScreen`, `service/paymentService.ts` (ported from a 1112-line Angular service), `service/payWallService.ts`, Razorpay integration.
- **Female-free promotions:** `service/femaleFreeService.ts` — gender-based free-access promo logic.
- **Notifications:** `service/notificationService.ts` (Expo push; no-op in Expo Go) + socket-based in-app notifications.
- **Analytics:** `service/analyticsService.ts` (AppsFlyer events, called from `paymentService`).
- **Localization:** 11 languages via i18next + `LanguageSelectionScreen`.
- **OTA updates:** `expo-updates` + `hooks/useOTAUpdate.ts` + `scripts/deploy-ota.js`, served by a companion `../jodii-ota-server` repo (regeneratable via `scripts/create-ota-server.js`). Credentials/URLs in gitignored `.env.ota` — see [OTA Updates](#ota-updates).

---

## Known Gaps

Call these out explicitly rather than assuming they're just "not found yet":

- **No pdf/document chat attachments** — image, video, and voice messages are built (see Chat/messaging above); pdf is not.
- **19 of the 52 newly-added flavors have no Firebase app registered yet** — see [App Brands](#app-brands--white-labeling) for the exact list. Their `google-services.json` step will fail at prebuild time until Firebase apps are created for them.
- **No EAS build profiles or npm build scripts for the 52 new flavors** — only jodii/tamil/malayalam have `eas.json` profiles and `assemble:*`/`bundle:*`/`eas:*` npm scripts. The new flavors build via raw Gradle tasks only (`./android/gradlew -p android assemble<Flavor>Debug`).
- **The 52 new flavors' icons are placeholders** — all reuse the generic Jodii icon (`./assets/icon.png`) in `constants/flavorConfig.js`; real per-flavor icons haven't been supplied yet.
- **`constants/firebase.config.ts`'s VAPID key is env-var-only with no fallback** (`EXPO_PUBLIC_FIREBASE_VAPID_KEY`, defaults to `''`) — unlike `apiKey`, the Angular source hardcodes this value directly (it's a public key, not a secret), so web push likely silently gets an empty VAPID key unless that env var happens to be set. Deliberately left as-is per explicit instruction (2026-08-21) — flagging here so it isn't mistaken for an oversight.
- **No dedicated Settings/Profile-detail/Filter screens** despite `filterService.ts`/`profileService.ts` existing.
- **No tests** — no Jest config, no `__tests__`, no testing-library.
- **`store/` is unused** — empty except `.gitkeep`; don't assume Redux/Zustand exists.
- **`android/.kotlin/` is untracked but not gitignored** — Kotlin compiler cache generated by Gradle builds; add it to `.gitignore` if it keeps showing up in `git status`.
- **Windows-only release scripts** — `release:tamil:apk`/`release:tamil:aab` use `set` env-var syntax and likely don't work on macOS/Linux; prefer the `eas:*` or `assemble:*`/`bundle:*` scripts instead.
- **iOS project naming** — the Xcode project is `ios/TamilJodii.xcodeproj` (no `Jodii.xcworkspace`), a holdover from the original Tamil-only app.
- **R8 minify + resource shrinking are off for every release build** — see [Build Size Optimization](#build-size-optimization) for the exact toggles and why they're not yet enabled (needs a regression pass on payments/Firebase/notifications first).

---

## Setup & Installation

### Prerequisites
- Node.js (LTS recommended)
- npm
- Expo CLI
- For iOS: macOS with Xcode installed
- For Android: Android Studio with SDK configured

### Install dependencies

```bash
npm install
```

### Install iOS Pods (first time or after dependency changes)

```bash
cd ios
pod install
cd ..
```

### Set up environment

```bash
node scripts/setup-env.js dev
```

Copies the per-env Firebase config files (`firebase/google-services.<env>.json` → `android/app/google-services.json`, `firebase/GoogleService-Info.<env>.plist` → `ios/GoogleService-Info.plist`) for the given environment (`dev`, `stg`, `uat`, `preprod`, `prod`). Does **not** generate `.env` or `.env.ota` — those are hand-maintained (copy `envs/.env.template` to `.env` yourself; `.env.ota` is OTA-only, see [OTA Updates](#ota-updates)). Also run automatically by the `start:<env>` npm scripts below.

---

## Development

### Start Metro bundler (per environment)

```bash
npm run start:dev
npm run start:stg
npm run start:uat
npm run start:preprod
npm run start:prod
```

Each sets `EXPO_PUBLIC_APP_ENV` and runs `scripts/setup-env.js` before `expo start`. Plain `npm start` also exists without env setup.

### Run on iOS Simulator

```bash
npm run ios
```

### Run on Android Emulator

```bash
npm run android
```

### Run on Web

```bash
npm run web
# or for a specific brand/language build:
npm run start:stg:web
```

### Type checking

```bash
npm run typecheck
```

### Lint

```bash
npm run lint
npm run lint:fix
```

### Format code

```bash
npm run format
npm run format:check
```

---

## Building for Android

The app builds per **flavor** (`jodii`, `tamil`, `malayalam`) and per **environment** (`dev`/`uat`/`preprod`/`prod`).

### Debug build (local, for testing)

```bash
npm run android
```

### Prebuild native project (regenerate `android/` from config)

```bash
npm run prebuild
# equivalent to:
npx expo prebuild --platform android          # incremental — applies config plugins to existing android/
npx expo prebuild --platform android --clean  # full regen — wipes and rebuilds android/ from scratch
```

Requires all of the active flavor's `firebase/google-services.<flavor>.json` to exist first (see [App Brands](#app-brands--white-labeling)) — prebuild hard-fails without it. `android/local.properties` (your local Android SDK path, e.g. `sdk.dir=/Users/you/Library/Android/sdk`) and `firebase/` are both gitignored/machine-local and get wiped by `--clean` — recreate `local.properties` manually if `assemble*`/`bundle*` then fails with `SDK location not found`.

**What's actually regenerated vs. hand-written:** `android/app/src/<flavor>/` (per-flavor launcher icons + the copied `google-services.json`) is 100% reproducible from `constants/flavorConfig.js` + `firebase/*.json` — for the 52 newly-added flavors these are gitignored (see `android/.gitignore`) rather than committed, since they're pure build output. `android/app/src/main/**` (custom native code, `MainApplication.kt`, manifest, build.gradle) is committed, but its Razorpay/PayU/Firebase/flavor-specific pieces are themselves reapplied by the [config plugins](#config-plugins) on every prebuild — see that section for the exact failure mode if a prebuild ever partially fails.

### Building the 52 newly-added flavors (no npm script yet)

```bash
cd android
./gradlew -p . assemble<Flavor>Debug      # e.g. assembleBrahminDebug, assembleTeluguDebug
npx expo run:android --variant <flavor>Debug   # builds, installs, and launches in one step
```

### Local release builds via Gradle (per flavor/env)

```bash
npm run assemble:jodii:prod      # APK
npm run bundle:jodii:prod        # AAB
npm run assemble:tamil:prod
npm run bundle:tamil:prod
npm run assemble:malayalam:prod
npm run bundle:malayalam:prod
```

(Same pattern for `:dev`, `:uat`, `:preprod` suffixes.) These invoke Gradle tasks like `:app:assembleJodiiRelease` directly via `./android/gradlew`.

> Avoid `release:tamil:apk`/`release:tamil:aab` — they use Windows `set` syntax and are unmaintained on macOS/Linux.

---

## Build Size Optimization

A 2026-09-02 audit found the "~160MB build" people were seeing was a **universal APK** (all 4 CPU architectures baked into one file, `armeabi-v7a`/`arm64-v8a`/`x86`/`x86_64`), with R8 minification and resource shrinking both off. Measured baseline for the `jodii` flavor: **159.6 MB** universal APK via `assembleJodiiRelease`.

### Fix applied: ABI split on APK builds

`android/app/build.gradle` now has a `splits { abi {...} }` block restricting per-architecture APK output to `armeabi-v7a` + `arm64-v8a` (real phones only, dropping the emulator-only `x86`/`x86_64` slices), while still emitting a universal fallback. The same block is injected by [`plugins/withAndroidBuildCustomizations.js`](../plugins/withAndroidBuildCustomizations.js) so it survives `expo prebuild --clean` regenerating `android/app/build.gradle`.

**This only affects `assemble<Flavor>Release` (APK) tasks** — used by local `assemble:*` npm scripts and the `*-preview` EAS profiles. It has **zero effect on `bundle<Flavor>Release` (`.aab`)** — Android Gradle Plugin ignores `splits.abi` for Bundle tasks; Play Store already does its own per-device ABI delivery from a single `.aab` upload, so production submissions are unchanged.

Measured after the change (`jodii` flavor):

| Output | Size |
|---|---:|
| `app-jodii-arm64-v8a-release.apk` (what a modern real phone needs) | 68.3 MB |
| `app-jodii-armeabi-v7a-release.apk` (older phones) | 58.0 MB |
| `app-jodii-universal-release.apk` (fallback, all ABIs) | 150.7 MB |

**When handing an APK to a tester, give them the `arm64-v8a` file, not the universal one** — nearly every phone sold in the last ~6 years is arm64.

### Play Store upload vs. actual user download size

Play Store never receives these split APKs — you upload the **`.aab`** from a `*-production` profile (e.g. `npm run bundle:jodii`, task `bundleJodiiRelease`). Play's backend explodes that bundle server-side per device (ABI × density × language) at install time; the architecture detection happens automatically, not in your build.

Measured for `jodii`'s `.aab` (still with minify/shrinkResources off):
- **Upload size** (the `.aab` file itself): 89.6 MB
- **Actual per-device download size**: **35.9–37.7 MB** (measured with `bundletool`, not a guess — see below). Upload size and download size are *not* the same number; don't quote the `.aab` size as what users experience.

To reproduce this measurement yourself after any build-size change:
```bash
brew install bundletool   # one-time
bundletool build-apks \
  --bundle=android/app/build/outputs/bundle/jodiiRelease/app-jodii-release.aab \
  --output=/tmp/jodii-splits.apks \
  --overwrite
bundletool get-size total --apks=/tmp/jodii-splits.apks
# prints MIN,MAX in bytes across every device config Play would generate
```

### Caveat: debug-signed builds

Neither the APK nor the `.aab` measurements above used a real release keystore (`JODII_KEYSTORE_FILE` wasn't set in the audit environment) — `android/app/build.gradle`'s signing config silently falls back to `debug.keystore` when the release keystore file is absent, so the build still succeeds but **cannot be uploaded to Play Console as-is**. Set `JODII_KEYSTORE_FILE`/`JODII_STORE_PASSWORD`/`JODII_KEY_ALIAS`/`JODII_KEY_PASSWORD` before a real release build.

### Not yet done (next levers, ranked by expected impact)

1. **Enable R8 minify + resource shrinking** for release builds — both default to `false` in `android/app/build.gradle` (`android.enableMinifyInReleaseBuilds`, `android.enableShrinkResourcesInReleaseBuilds`) and no build script passes them. Medium risk — needs a full regression pass (payments, Firebase, notifications) after enabling, since R8 can strip reflectively-used classes.
2. **Scope locale JSON loading to the active flavor's target language** — all 11 language dictionaries (`locales/*.json`, 2.8MB total) are bundled into every flavor's build regardless of which language it actually needs.
3. **Confirm every flavor needs both payment SDKs** — Razorpay `customui` and PayU `upisdk` are both compiled in unconditionally for all 69 Gradle flavors ([android/app/build.gradle](../android/app/build.gradle) `dependencies {}`); if some brands only use one gateway, gating the other's Gradle dependency per-flavor would shrink those builds further. Needs product confirmation, not just a code check.

---

## Building for iOS

> Requires macOS with Xcode installed. The Xcode project is `ios/TamilJodii.xcodeproj` (not `Jodii.xcworkspace`).

### Debug build on Simulator

```bash
npm run ios
```

### Target a specific simulator

```bash
npx expo run:ios --device "iPhone 15 Pro"
```

### Install on a physical device (via Xcode)

1. Connect iPhone via USB
2. Open `ios/TamilJodii.xcodeproj` in Xcode
3. Set signing team: **Signing & Capabilities → Team**
4. Select your device as the build target
5. Press **Run (▶)**

### Generate IPA via Xcode Archive

1. Open `ios/TamilJodii.xcodeproj` in Xcode
2. Set target device to **Any iOS Device (arm64)**
3. **Product → Archive**
4. In Organizer → **Distribute App**
5. Choose distribution method (Ad Hoc / App Store Connect)

> Note: Archiving requires a valid Apple Developer account and code signing set up under **Signing & Capabilities**.

### Install IPA on device

**Using Xcode:**
1. Connect iPhone via USB
2. Xcode → **Window → Devices and Simulators**
3. Select device → click **+** under Installed Apps → select `.ipa`

**Using Apple Configurator 2 (free, Mac App Store):**
1. Connect iPhone via USB
2. Open Apple Configurator 2
3. Drag and drop the `.ipa` onto the device

---

## EAS Cloud Builds

EAS (Expo Application Services) builds your app in the cloud — no local Android Studio or Xcode required for the build step.

### Login

```bash
npx eas login
```

### Build profiles (defined in `eas.json`)

| Profile | Platform | Output | Use case |
|---|---|---|---|
| `development` | Both | Dev client | Local development |
| `preview` | Android | `.apk` | Internal testing |
| `production` | Android | `.aab` | Google Play Store |
| `jodii-preview` / `jodii-production` | Android | `.apk` / `.aab` | Jodii brand builds (`APP_TYPE=115`) |
| `tamil-preview` / `tamil-production` | Android | `.apk` / `.aab` | Tamil Jodii brand builds (`APP_TYPE=116`) |
| `malayalam-preview` / `malayalam-production` | Android | `.apk` / `.aab` | Malayalam Jodii brand builds (`APP_TYPE=118`) |

iOS production builds use the generic `production` profile.

### Per-flavor builds via npm scripts

```bash
npm run eas:jodii:apk
npm run eas:jodii:aab
npm run eas:tamil:apk
npm run eas:tamil:aab
npm run eas:malayalam:apk
npm run eas:malayalam:aab
npm run build:ios
```

### Submit to App Store / Play Store

```bash
npx eas submit --platform ios
npx eas submit --platform android
```

> `submit.production` in `eas.json` is currently empty — store credentials need to be configured before this works.

---

## OTA Updates

The app uses `expo-updates` for over-the-air JS updates, checked on launch via `hooks/useOTAUpdate.ts`. Updates are served by a companion repo (`../jodii-ota-server`, PHP `manifest.php` on the live server) via a manifest URL configured in `app.config.js` (`updates.url`).

### Credentials — `.env.ota`

All OTA config (SFTP credentials + server URLs) lives in `.env.ota` at the repo root — gitignored, not committed. Neither `app.config.js` nor `scripts/deploy-ota.js` hardcode any of these; both load `.env.ota` directly (same small inline parser in each, kept in sync manually) and fail loudly if a required key is missing.

```
SFTP_HOST=<sftp host/ip>
SFTP_PORT=22
SFTP_USER=<sftp user>
SFTP_PASSWORD=<sftp password>
SFTP_OTA_PATH=<remote folder deploy-ota.js uploads bundles/latest.json into, e.g. /home/nbimg/www/jodii-ota-server/ota-files>
OTA_SERVER_URL=<public URL serving that same folder, e.g. https://stgimg.jodii.app/jodii-ota-server/ota-files>
OTA_MANIFEST_URL=<public URL of manifest.php — one directory above ota-files, e.g. https://stgimg.jodii.app/jodii-ota-server/manifest.php>
CHANNEL_SUFFIX=production
```

`OTA_MANIFEST_URL` is what `app.config.js` bakes into the app build as `updates.url` — since `.env.ota` is local-only and never uploaded to any cloud EAS build machine, any `eas.json` build profile that runs as a **cloud** build (not `--local`) needs `OTA_MANIFEST_URL` (and friends) set as an EAS secret/env var, or `app.config.js`'s config resolution will throw.

### Deploying an update

```bash
npm run ota:preview
npm run ota:production
```

Runs `scripts/deploy-ota.js`: exports the JS bundle, uploads it via SFTP (`ssh2-sftp-client`) to `SFTP_OTA_PATH`, and writes `latest.json` per flavor/channel/platform. `deploy-ota.js` only uploads into the `ota-files` subfolder — `manifest.php` itself is **not** uploaded by this script and must be placed on the server manually (see below).

### Regenerating the companion server folder

If `../jodii-ota-server` (a sibling directory, not part of this repo) ever goes missing:

```bash
npm run ota:server:create
```

Runs `scripts/create-ota-server.js`, which regenerates the full folder (`manifest.php` — the one actually live in production; `server.js` — a plain-Node standalone equivalent for local testing; `package.json`/`host.json`/`src/functions/manifest.js` — an Azure Functions + Blob Storage variant, currently unused) from templates embedded in that script. Copy the output folder to the server as-is, or test locally with `npm run ota:server` (starts `server.js`, reading `OTA_FILES_PATH`/`PORT` from the environment). If you ever hand-edit files directly in `../jodii-ota-server`, port the change back into `create-ota-server.js` too, or it'll be lost on next regenerate.

---

## Troubleshooting

### Renaming or moving the project folder

Confirmed 2026-08-21 (this project's folder was renamed from a path containing a space, `Jodii update`, to `jodii_update`, to fix several of the issues below — **a space anywhere in the project's path breaks multiple tools' shell scripts**, not just the ones listed here, so avoid spaces in this project's path entirely). After any rename/move:

1. **iOS**: stale absolute paths get baked into `ios/Pods/` by CocoaPods and don't self-heal — re-run `pod install`, then check for leftovers:
   ```bash
   grep -rl "<old-path>" ios/Pods
   ```
   If any hits, either `sed -i '' 's#<old-path>#<new-path>#g' <file>` them directly or delete `ios/Pods` and re-run `pod install`. Hit this exact issue with `HERMES_CLI_PATH` surviving in `Pods-TamilJodii.{debug,release}.xcconfig` and `Local Podspecs/hermes-engine.podspec.json` even after a fresh `pod install` — CocoaPods' Local Podspecs cache didn't auto-regenerate it.
2. **Xcode itself must be fully quit and reopened** (Cmd+Q, not just close the window) from the new path — a long-running Xcode process keeps cached absolute paths for script-phase resolution (e.g. `hermesc`) even though a fresh `pod install`/terminal build already picked up the new path.
3. **Android**: `android/build/generated/autolinking/autolinking.json` and `android/.gradle` are gitignored generated caches with the old path baked in — just delete them (`rm -rf android/build android/.gradle`), no need to fix in place.
4. **`android/local.properties`** (gitignored, machine-local SDK path) doesn't get path-corrected automatically either — if it exists and points at a stale path, or was wiped by a `--clean` prebuild, recreate it: `echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties`.
5. **`FileNotFoundException` for `.cxx` paths** on Android build:
   ```bash
   rm -rf node_modules/expo-modules-core/android/.cxx
   rm -rf android/build
   ```

### iOS build: Swift compiler errors on very new Xcode versions

Two distinct Swift 6.x-toolchain incompatibilities hit on Xcode 26.2 (Swift 6.2.3), both confirmed as known upstream issues, not bugs in this project's code:

- **`expo-modules-jsi`**: `type of expression is ambiguous without a type annotation` in `JavaScriptCodable+Date.swift`'s `dateFromMilliseconds()`, on the line using `abs()`. Worked around by hand-patching that one line in `node_modules/expo-modules-jsi/.../JavaScriptCodable+Date.swift` to avoid `abs()` entirely (`milliseconds >= -max && milliseconds <= max` instead of `abs(milliseconds) <= max`) — this patch does **not** survive `npm install`/`npm ci` since it's a raw `node_modules` edit, not a `patch-package` patch; re-apply if it resurfaces.
- **`expo-modules-core`**: `sending 'emitter' risks causing data races` in `EventEmitter.swift`, confirmed as [expo/expo#47539](https://github.com/expo/expo/issues/47539) — only happens when the module is compiled from Swift source rather than using Expo's prebuilt binaries. Root cause here: `ios/Podfile.properties.json` had `"ios.buildReactNativeFromSource": "true"` (an incidental leftover from an old `expo prebuild` run, not a deliberate setting), which forces every Expo module to build from source. **Fix: remove that line** (or set it `"false"`) so `pod install` uses Expo's precompiled `.xcframework`s instead, sidestepping the bug entirely.

### iOS `pod install`: SPM + static linkage conflict with react-native-firebase

```
[!] [react-native-firebase] SPM + static linkage is not supported (target(s): Pods-TamilJodii).
```
Fixed by `plugins/withFirebaseIOS.js` (adds `$RNFirebaseDisableSPM = true` to `ios/Podfile`) — see [Config Plugins](#config-plugins). If you ever hand-edit `ios/Podfile` directly and lose this line, `pod install` will fail with the above until it's added back (must be before the `target` block).

### macOS endpoint-security software (e.g. Digital Guardian) blocking builds

If a build fails with `Operation not permitted` on a file that a plain shell `cp`/`md5`/`cat` can read fine (confirmed via `xattr -l <file>` showing `com.dgagent.*` extended attributes), that's a corporate DLP/endpoint-security agent (seen here: Digital Guardian, `/usr/local/dgagent/`) intercepting file reads from specific processes (Node, Java/Gradle both confirmed affected) — not a project bug. It resurfaces unpredictably on different files as a build touches more of `node_modules`/`~/.gradle` — there's no reliable per-file workaround. Ask IT to exclude the project folder, `~/.gradle`, `node_modules`, and/or the `node`/`java`/`xcodebuild` processes from the agent's policy.

### Android: `android/.kotlin/` showing up as untracked in `git status`
This is Gradle's Kotlin compiler daemon cache, not currently in `.gitignore`. Safe to add `android/.kotlin/` to `.gitignore` and delete the local copy.

### iOS: "Signing requires a development team"
1. Open `ios/TamilJodii.xcodeproj` in Xcode
2. Click project → **Signing & Capabilities**
3. Check **Automatically manage signing**
4. Select your Apple account under **Team**

### iOS: Pods out of sync after `npm install`
```bash
cd ios && pod install && cd ..
```

### Metro bundler cache issues
```bash
npx expo start --clear
```

### SVG images not rendering on native
Remote `.svg` files must be rendered with `SvgUri` (from `react-native-svg`), not React Native's `Image` component — `Image` can't decode remote SVGs on iOS/Android.
