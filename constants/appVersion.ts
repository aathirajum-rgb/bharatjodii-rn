// Single source of truth for "the app's current version" as the rest of
// this app's own logic understands it (X.Y scheme, matches what gets
// reported to the server as APPVERSION) — NOT app.json's "version" field
// (Constants.expoConfig?.version), which is a separate, unrelated Expo/
// native-build identifier that's still stuck at its "1.0.0" scaffolding
// default and was never meant to track this.
//
// Bump this by hand alongside App.tsx's own initializeAppConfig() version
// whenever the two need to move together.
export const APP_VERSION = '7.4'
