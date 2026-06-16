# Jodii App — Project Documentation

## Table of Contents
- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How the Project Works](#how-the-project-works)
- [Setup & Installation](#setup--installation)
- [Development](#development)
- [Building for Android](#building-for-android)
- [Building for iOS](#building-for-ios)
- [EAS Cloud Builds](#eas-cloud-builds)
- [Troubleshooting](#troubleshooting)

---

## Project Overview

**Jodii** is a cross-platform mobile app built with Expo and React Native. It targets Android, iOS, and Web from a single TypeScript codebase.

- **Bundle ID (iOS):** `com.jodii.app`
- **Package Name (Android):** `com.jodii.app`
- **Expo SDK:** `~56.0.9`
- **React Native:** `0.85.3`

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Expo | ~56.0.9 | Framework & build tooling |
| React Native | 0.85.3 | Cross-platform UI |
| React | 19.2.3 | UI library |
| TypeScript | ~6.0.3 | Type safety |
| EAS | >= 16.0.0 | Cloud builds & distribution |

---

## Project Structure

```
Jodii/
├── App.tsx               # Root component — main UI entry point
├── index.ts              # App entry — registers root component with Expo
├── app.json              # Expo config (app name, icons, bundle IDs, etc.)
├── eas.json              # EAS Build profiles (development, preview, production)
├── tsconfig.json         # TypeScript config
├── package.json          # Dependencies and npm scripts
├── assets/               # Images, icons, splash screens
├── android/              # Native Android project (Gradle)
└── ios/                  # Native iOS project (Xcode)
```

---

## How the Project Works

1. **Entry Point:** `index.ts` calls `registerRootComponent(App)` which registers `App.tsx` as the root of the app.

2. **App.tsx:** The main component. All screens and navigation will be added here as the app grows.

3. **Expo handles the bridge** between the JavaScript/TypeScript code and the native Android/iOS layers. You write React Native code once and Expo compiles it to native for each platform.

4. **`app.json`** controls app-level configuration — name, icons, splash screen, orientation, bundle identifiers, and platform-specific settings.

5. **`eas.json`** defines build profiles used by EAS (Expo Application Services) for cloud builds.

---

## Setup & Installation

### Prerequisites
- Node.js (LTS recommended)
- npm or yarn
- Expo CLI
- For iOS: macOS with Xcode installed
- For Android: Android Studio with SDK configured

### Install dependencies

```bash
cd Jodii
npm install
```

### Install iOS Pods (first time or after dependency changes)

```bash
cd ios
pod install
cd ..
```

---

## Development

### Start Metro bundler

```bash
npx expo start
```

Opens the Expo dev menu. From here you can open on Simulator, device, or web.

### Run on iOS Simulator

```bash
npx expo run:ios
```

### Run on Android Emulator

```bash
npx expo run:android
```

### Run on Web

```bash
npx expo start --web
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

### Debug APK (local, for testing)

```bash
npx expo run:android
```

Builds a debug APK and installs it on a connected emulator or device.

### Release APK via EAS (for sharing/distribution)

```bash
npx eas build --platform android --profile preview
```

Produces an `.apk` file. Can be shared directly and installed on Android devices.

### Production AAB via EAS (for Google Play Store)

```bash
npx eas build --platform android --profile production
```

Produces an `.aab` (Android App Bundle) for uploading to the Google Play Store.

### Fix: Stale CMake cache after moving project folder

If you get a `FileNotFoundException` for `.cxx` paths on Android build:

```bash
rm -rf node_modules/expo-modules-core/android/.cxx
rm -rf android/build
```

Then rebuild.

---

## Building for iOS

> Requires macOS with Xcode installed.

### Debug build on Simulator

```bash
npx expo run:ios
```

Launches the app on the iOS Simulator (Debug mode, with Metro live reload).

### Release build on Simulator

```bash
npx expo run:ios --configuration Release
```

Builds with Release configuration — no dev tools, production JS bundle.

### Target a specific simulator

```bash
npx expo run:ios --device "iPhone 15 Pro"
```

### Install on a physical device (via Xcode)

1. Connect iPhone via USB
2. Open `ios/Jodii.xcworkspace` in Xcode
3. Set signing team: **Signing & Capabilities → Team**
4. Select your device as the build target
5. Press **Run (▶)**

### Generate IPA via Xcode Archive

1. Open `ios/Jodii.xcworkspace` in Xcode
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
| `production` | iOS | `.ipa` | App Store / TestFlight |

### iOS production build (requires Apple Developer account)

```bash
npx eas build --platform ios --profile production
```

### Android preview build

```bash
npx eas build --platform android --profile preview
```

### Submit to App Store / Play Store

```bash
npx eas submit --platform ios
npx eas submit --platform android
```

---

## Troubleshooting

### Android: FileNotFoundException for `.cxx` path
Happens when the project folder is moved or renamed. Fix:
```bash
rm -rf node_modules/expo-modules-core/android/.cxx
rm -rf android/build
```

### iOS: "Signing requires a development team"
1. Open `ios/Jodii.xcworkspace` in Xcode
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
