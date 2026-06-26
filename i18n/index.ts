// i18n setup — mirrors the Angular ngx-translate config.
// All 11 language JSONs are bundled inline (no HTTP loader needed in RN).
// Angular used #KEY# style interpolation for dynamic values; we keep the
// JSONs unchanged and handle those substitutions manually at call sites.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import bn from '../locales/bn.json';
import en from '../locales/en.json';
import gj from '../locales/gj.json';
import hi from '../locales/hi.json';
import kn from '../locales/kn.json';
import ml from '../locales/ml.json';
import mt from '../locales/mt.json';
import or from '../locales/or.json';
import pa from '../locales/pa.json';
import tl from '../locales/tl.json';
import tm from '../locales/tm.json';

export const SUPPORTED_LANGUAGES = ['en', 'tm', 'tl', 'ml', 'kn', 'mt', 'or', 'gj', 'bn', 'hi', 'pa'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    en: { translation: en },
    tm: { translation: tm },
    tl: { translation: tl },
    ml: { translation: ml },
    kn: { translation: kn },
    mt: { translation: mt },
    or: { translation: or },
    gj: { translation: gj },
    bn: { translation: bn },
    hi: { translation: hi },
    pa: { translation: pa },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
