// Firebase config per language — Angular: src/environments/environment*.ts's
// fireBaseObj. ALL languages share the SAME project (authDomain/projectId/
// storageBucket/messagingSenderId are identical across every entry, in every
// environment file — dev/stg/pre/prod alike); only appId/measurementId differ
// per language, since each language gets its own Analytics (GA4) web-app
// registration inside that one project. A prior version of this file invented
// a separate project per language (jodii-tamil, jodii-telugu, ...) that
// doesn't exist anywhere in the Angular source — corrected here to match.
// apiKey is injected at runtime via EXPO_PUBLIC_FIREBASE_API_KEY (never hardcoded).

const AUTH_DOMAIN    = 'jodii-app.firebaseapp.com'
const PROJECT_ID     = 'jodii-app'
const STORAGE_BUCKET = 'jodii-app.appspot.com'
const SENDER_ID      = '598935480556'

export interface IFirebaseConfig {
  apiKey:            string
  authDomain:        string
  projectId:         string
  storageBucket:     string
  messagingSenderId: string
  appId:             string
  measurementId:     string
}

// Keys match ISO language codes used in the app (see LangFontMap in themes/typography.ts).
// appId/measurementId values copied verbatim from Angular's fireBaseObj — including
// 'tm' sharing the exact same appId as 'en' there, which looks like a copy-paste
// artifact in the original source but is kept as-is for a faithful port.
export const FirebaseConfigs: Record<string, Omit<IFirebaseConfig, 'apiKey'>> = {
  en: {
    authDomain: AUTH_DOMAIN, projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET, messagingSenderId: SENDER_ID,
    appId:         '1:598935480556:web:6a745bd1fa8fef773b9dc9',
    measurementId: 'G-1PGJN90TRZ',
  },
  tm: {
    authDomain: AUTH_DOMAIN, projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET, messagingSenderId: SENDER_ID,
    appId:         '1:598935480556:web:6a745bd1fa8fef773b9dc9',
    measurementId: 'G-1PGJN90TRZ',
  },
  tl: {
    authDomain: AUTH_DOMAIN, projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET, messagingSenderId: SENDER_ID,
    appId:         '1:598935480556:web:2aedb58f8dbe7b2b3b9dc9',
    measurementId: 'G-CXY3RDD31Z',
  },
  hi: {
    authDomain: AUTH_DOMAIN, projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET, messagingSenderId: SENDER_ID,
    appId:         '1:598935480556:web:94940c83980721c43b9dc9',
    measurementId: 'G-Y47C13G61D',
  },
  bn: {
    authDomain: AUTH_DOMAIN, projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET, messagingSenderId: SENDER_ID,
    appId:         '1:598935480556:web:dc61ee0dbc2854843b9dc9',
    measurementId: 'G-JT4LW2FD6J',
  },
  mt: {
    authDomain: AUTH_DOMAIN, projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET, messagingSenderId: SENDER_ID,
    appId:         '1:598935480556:web:bddab77f393141c73b9dc9',
    measurementId: 'G-4S0BNB98DK',
  },
  ml: {
    authDomain: AUTH_DOMAIN, projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET, messagingSenderId: SENDER_ID,
    appId:         '1:598935480556:web:09e0328fd0994a973b9dc9',
    measurementId: 'G-TGX9G27D15',
  },
  kn: {
    authDomain: AUTH_DOMAIN, projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET, messagingSenderId: SENDER_ID,
    appId:         '1:598935480556:web:8997ff581ec926603b9dc9',
    measurementId: 'G-ZS4HP5M381',
  },
  or: {
    authDomain: AUTH_DOMAIN, projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET, messagingSenderId: SENDER_ID,
    appId:         '1:598935480556:web:aec8e110d3d75f083b9dc9',
    measurementId: 'G-LNHEHFWB9L',
  },
  gj: {
    authDomain: AUTH_DOMAIN, projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET, messagingSenderId: SENDER_ID,
    appId:         '1:598935480556:web:bba5814595f247243b9dc9',
    measurementId: 'G-XHBLCKN9CY',
  },
  pa: {
    authDomain: AUTH_DOMAIN, projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET, messagingSenderId: SENDER_ID,
    appId:         '1:598935480556:web:8684deaf1fb3b5c03b9dc9',
    measurementId: 'G-N3STRC4F5L',
  },
}

// VAPID key for web push notifications — injected at runtime via EXPO_PUBLIC_FIREBASE_VAPID_KEY
export const FIREBASE_VAPID_KEY = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY ?? ''

// Returns the full Firebase config for the given language code.
// apiKey must be supplied from EXPO_PUBLIC_FIREBASE_API_KEY at runtime.
export function getFirebaseConfig(langCode: string): IFirebaseConfig {
  const base = FirebaseConfigs[langCode] ?? FirebaseConfigs['en']
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    ...base,
  }
}
