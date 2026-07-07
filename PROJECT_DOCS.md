# Jodii App — Project Documentation

## Table of Contents
- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How the Project Works](#how-the-project-works)
- [App Brands / White-labeling](#app-brands--white-labeling)
- [Navigation & Screens](#navigation--screens)
- [State Management & API Layer](#state-management--api-layer)
- [Environments](#environments)
- [Feature Areas](#feature-areas)
- [Known Gaps](#known-gaps)
- [Setup & Installation](#setup--installation)
- [Development](#development)
- [Building for Android](#building-for-android)
- [Building for iOS](#building-for-ios)
- [EAS Cloud Builds](#eas-cloud-builds)
- [OTA Updates](#ota-updates)
- [Troubleshooting](#troubleshooting)

---

## Project Overview

**Jodii** is a matrimony app, originally an Angular web app, now rebuilt as a cross-platform Expo/React Native app targeting Android, iOS, and Web from a single TypeScript codebase. It ships as **multiple white-label brands** (Jodii, Tamil Jodii, Malayalam Jodii, plus more language variants for the web marketing sites) from one codebase.

- **Package name (npm):** `jodii`, version `1.0.0`
- **Default bundle ID (iOS):** `com.jodii.app` (per-flavor IDs differ — see [App Brands](#app-brands--white-labeling))
- **Default package name (Android):** `com.jodii.app` (per-flavor IDs differ)
- **iOS Xcode project:** `ios/TamilJodii.xcodeproj` (name is a holdover from when this was originally the Tamil-only app — there is no `Jodii.xcworkspace`, only `ios/TamilJodii`/`ios/TamilJodii.xcodeproj` + generated `Pods`)
- **Expo SDK:** `~56.0.9`
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
├── plugins/                    # withAndroidFlavors.js — custom Expo config plugin for Gradle flavors
├── scripts/                    # setup-env.js, deploy-ota.js, web-server.js, convert-pwa.js
├── assets/                     # Images, icons, splash screens
├── web/, web-redirect/, nginx/ # Static PWA output & multi-language marketing landing pages
├── envs/.env.template           # Tracked template; real .env / .env.ota are gitignored, generated by setup-env.js
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

The codebase ships three (and growing) app brands from `constants/flavorConfig.js`, selected via `APP_FLAVOR` at build time:

| Flavor | App type | Package/Bundle ID | Scheme | Domain |
|---|---|---|---|---|
| `jodii` (default) | 115 | `com.jodii.app` / `jodii.app` | `jodii` | `jodii.app` |
| `tamil` | 116 | `jodiiapp.android.tamil` | `tamilmatrimony` | `tamil.jodii.app` |
| `malayalam` | 118 | `jodiiapp.android.malayalam` | `malayalammatrimony` | `malayalam.jodii.app` |

This is implemented via:
- `plugins/withAndroidFlavors.js` — custom Expo config plugin that sets up Gradle product flavors on Android.
- `app.config.js` — sets bundle ID, scheme, deep-link domain, and `extra.appType`/`extra.appFlavor` per flavor.
- Per-flavor EAS build profiles in `eas.json` (`jodii-preview`, `jodii-production`, `tamil-preview`, `tamil-production`, `malayalam-preview`, `malayalam-production`) that map to Gradle tasks like `:app:assembleJodiiRelease` / `:app:bundleTamilRelease`.
- Matching npm scripts: `assemble:<flavor>[:env]`, `bundle:<flavor>[:env]`, `eas:<flavor>:apk|aab`, `build:web:<flavor>`, `serve:dev:<flavor>`.

Deep linking supports `https://jodii.app`, `https://tamil.jodii.app`, `https://malayalam.jodii.app`, plus each flavor's custom URL scheme (see `navigation/RootNavigation.tsx` `linking` config).

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
- `envs/.env.template` is the only tracked env file — real `.env`/`.env.ota` are gitignored and generated by `scripts/setup-env.js <env>` (invoked automatically by the `start:<env>` npm scripts).

---

## Feature Areas

- **Matching/browsing:** `screens/matches/MatchesScreen`, `components/matches-card`, `components/swiper-card`, `adapters/matches.adapter.ts`, `service/homeService.ts`, `service/filterService.ts`.
- **Onboarding/profile creation:** ~21-screen flow covering identity, demographics, location, education/occupation/income, religion/caste/gothra/star-raasi/dosham, family & property details, and photo upload. Driven by `service/registrationService.ts` and `constants/registration.constants.ts`.
- **Auth/OTP login:** mobile + OTP based (`LoginScreen`, `OTPScreen`), with `service/encryptionService.ts` (crypto-js) encrypting payloads.
- **Photo upload/gallery:** `AddPhotoScreen`, `GalleryScreen`, `components/profile-photo`, via `expo-image-picker`/`expo-camera`/`expo-media-library`.
- **Chat/messaging:** `service/chatService.ts` + `service/socketService.ts` provide a full chat API (lists, messages, read status, deletion, search) — **no chat UI screen exists yet** (see [Known Gaps](#known-gaps)).
- **Payments/subscription:** `RechargeScreen`, `PaymentSuccessScreen`, `service/paymentService.ts` (ported from a 1112-line Angular service), `service/payWallService.ts`, Razorpay integration.
- **Female-free promotions:** `service/femaleFreeService.ts` — gender-based free-access promo logic.
- **Notifications:** `service/notificationService.ts` (Expo push; no-op in Expo Go) + socket-based in-app notifications.
- **Analytics:** `service/analyticsService.ts` (AppsFlyer events, called from `paymentService`).
- **Localization:** 11 languages via i18next + `LanguageSelectionScreen`.
- **OTA updates:** `expo-updates` + `hooks/useOTAUpdate.ts` + `scripts/deploy-ota.js`, served by a companion `../jodii-ota-server` repo.

---

## Known Gaps

Call these out explicitly rather than assuming they're just "not found yet":

- **No chat screen** — `chatService.ts`/`socketService.ts` are fully built but there's no UI consuming them yet.
- **No dedicated Settings/Profile-detail/Filter screens** despite `filterService.ts`/`profileService.ts` existing.
- **No tests** — no Jest config, no `__tests__`, no testing-library.
- **`store/` is unused** — empty except `.gitkeep`; don't assume Redux/Zustand exists.
- **`android/.kotlin/` is untracked but not gitignored** — Kotlin compiler cache generated by Gradle builds; add it to `.gitignore` if it keeps showing up in `git status`.
- **Windows-only release scripts** — `release:tamil:apk`/`release:tamil:aab` use `set` env-var syntax and likely don't work on macOS/Linux; prefer the `eas:*` or `assemble:*`/`bundle:*` scripts instead.
- **iOS project naming** — the Xcode project is `ios/TamilJodii.xcodeproj` (no `Jodii.xcworkspace`), a holdover from the original Tamil-only app.

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

Generates `.env`/`.env.ota` from `envs/.env.template` for the given environment (`dev`, `stg`, `uat`, `preprod`, `prod`). Also run automatically by the `start:<env>` npm scripts below.

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

### Fix: Stale CMake cache after moving project folder

If you get a `FileNotFoundException` for `.cxx` paths on Android build:

```bash
rm -rf node_modules/expo-modules-core/android/.cxx
rm -rf android/build
```

Then rebuild.

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

The app uses `expo-updates` for over-the-air JS updates, checked on launch via `hooks/useOTAUpdate.ts`. Updates are served by a companion repo (`../jodii-ota-server`) via a manifest URL configured in `app.config.js` (`updates.url`).

```bash
npm run ota:preview
npm run ota:production
```

Runs `scripts/deploy-ota.js`, which uploads the exported bundle via SFTP (`ssh2-sftp-client`) to the OTA server. `npm run ota:server` starts the companion OTA server locally from a sibling directory.

---

## Troubleshooting

### Android: FileNotFoundException for `.cxx` path
Happens when the project folder is moved or renamed. Fix:
```bash
rm -rf node_modules/expo-modules-core/android/.cxx
rm -rf android/build
```

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
