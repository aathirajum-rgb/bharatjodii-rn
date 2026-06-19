// Firebase config per language — authDomain, projectId, storageBucket, messagingSenderId
// are shared; appId and measurementId differ per language (used for Analytics).
// apiKey is injected at runtime via EXPO_PUBLIC_FIREBASE_API_KEY (never hardcoded).

const SENDER_ID = '598935480556'

export interface IFirebaseConfig {
  apiKey:            string
  authDomain:        string
  projectId:         string
  storageBucket:     string
  messagingSenderId: string
  appId:             string
  measurementId:     string
}

// Keys match ISO language codes used in the app (see LangFontMap in themes/typography.ts)
export const FirebaseConfigs: Record<string, Omit<IFirebaseConfig, 'apiKey'>> = {
  en: {
    authDomain:        'jodii-matrimony.firebaseapp.com',
    projectId:         'jodii-matrimony',
    storageBucket:     'jodii-matrimony.appspot.com',
    messagingSenderId: SENDER_ID,
    appId:             '1:598935480556:web:3f78edc1ef5e06f51c8038',
    measurementId:     'G-CDBZPHBG2H',
  },
  tm: {
    authDomain:        'jodii-tamil.firebaseapp.com',
    projectId:         'jodii-tamil',
    storageBucket:     'jodii-tamil.appspot.com',
    messagingSenderId: SENDER_ID,
    appId:             '1:598935480556:web:a7ef95b3e3e16f3c1c8038',
    measurementId:     'G-YTEHGM7JSH',
  },
  tl: {
    authDomain:        'jodii-telugu.firebaseapp.com',
    projectId:         'jodii-telugu',
    storageBucket:     'jodii-telugu.appspot.com',
    messagingSenderId: SENDER_ID,
    appId:             '1:598935480556:web:38f82f77a1a3daf91c8038',
    measurementId:     'G-3FY2Y3HQDZ',
  },
  hi: {
    authDomain:        'jodii-hindi.firebaseapp.com',
    projectId:         'jodii-hindi',
    storageBucket:     'jodii-hindi.appspot.com',
    messagingSenderId: SENDER_ID,
    appId:             '1:598935480556:web:a5ea26ab3d3c1d3e1c8038',
    measurementId:     'G-QLFE0P4GZH',
  },
  bn: {
    authDomain:        'jodii-bengali.firebaseapp.com',
    projectId:         'jodii-bengali',
    storageBucket:     'jodii-bengali.appspot.com',
    messagingSenderId: SENDER_ID,
    appId:             '1:598935480556:web:6d9d1f0f87e0c9d21c8038',
    measurementId:     'G-E8DT01Y2ET',
  },
  mt: {
    authDomain:        'jodii-marathi.firebaseapp.com',
    projectId:         'jodii-marathi',
    storageBucket:     'jodii-marathi.appspot.com',
    messagingSenderId: SENDER_ID,
    appId:             '1:598935480556:web:2b0fca4a81a3ba6d1c8038',
    measurementId:     'G-PSWZ04V2WT',
  },
  ml: {
    authDomain:        'jodii-malayalam.firebaseapp.com',
    projectId:         'jodii-malayalam',
    storageBucket:     'jodii-malayalam.appspot.com',
    messagingSenderId: SENDER_ID,
    appId:             '1:598935480556:web:2a3399e0dab7a4001c8038',
    measurementId:     'G-P4D7C2SQHH',
  },
  kn: {
    authDomain:        'jodii-kannada.firebaseapp.com',
    projectId:         'jodii-kannada',
    storageBucket:     'jodii-kannada.appspot.com',
    messagingSenderId: SENDER_ID,
    appId:             '1:598935480556:web:9b6289e7a4e9db8a1c8038',
    measurementId:     'G-L4SKWVLE1E',
  },
  or: {
    authDomain:        'jodii-odia.firebaseapp.com',
    projectId:         'jodii-odia',
    storageBucket:     'jodii-odia.appspot.com',
    messagingSenderId: SENDER_ID,
    appId:             '1:598935480556:web:70d4e40d23ac2b481c8038',
    measurementId:     'G-LNHEHFWB9L',
  },
  gj: {
    authDomain:        'jodii-gujarati.firebaseapp.com',
    projectId:         'jodii-gujarati',
    storageBucket:     'jodii-gujarati.appspot.com',
    messagingSenderId: SENDER_ID,
    appId:             '1:598935480556:web:3d92b05c93ef51371c8038',
    measurementId:     'G-CCKNXVNQ39',
  },
  pa: {
    authDomain:        'jodii-punjabi.firebaseapp.com',
    projectId:         'jodii-punjabi',
    storageBucket:     'jodii-punjabi.appspot.com',
    messagingSenderId: SENDER_ID,
    appId:             '1:598935480556:web:3e7eb39b09e7c5311c8038',
    measurementId:     'G-W7NY67LKVK',
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
