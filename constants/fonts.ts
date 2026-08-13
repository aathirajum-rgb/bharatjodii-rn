import * as Font from 'expo-font'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LangFontSet = {
  regular:  string
  medium:   string
  semiBold: string
  bold:     string
}

// ─── Font CDN base (same server as Angular) ───────────────────────────────────

const CDN_FONTS = 'https://imgs.jodii.app/assets/fonts/'

// ─── Language → font-family names ─────────────────────────────────────────────
// Mirrors _variable.scss: each language group maps to a NotoSans script family.
// English stays on Poppins (already loaded at startup via @expo-google-fonts).

const POPPINS: LangFontSet = {
  regular:  'Poppins-Regular',
  medium:   'Poppins-Medium',
  semiBold: 'Poppins-SemiBold',
  bold:     'Poppins-Bold',
}

export const LANG_FONTS: Record<string, LangFontSet> = {
  en: POPPINS,
  tm: { regular: 'NotoSansTamil-Regular',      medium: 'NotoSansTamil-Medium',      semiBold: 'NotoSansTamil-SemiBold',      bold: 'NotoSansTamil-Bold'      },
  tl: { regular: 'NotoSansTelugu-Regular',     medium: 'NotoSansTelugu-Medium',     semiBold: 'NotoSansTelugu-SemiBold',     bold: 'NotoSansTelugu-Bold'     },
  ml: { regular: 'NotoSansMalayalam-Regular',  medium: 'NotoSansMalayalam-Medium',  semiBold: 'NotoSansMalayalam-SemiBold',  bold: 'NotoSansMalayalam-Bold'  },
  kn: { regular: 'NotoSansKannada-Regular',    medium: 'NotoSansKannada-Medium',    semiBold: 'NotoSansKannada-SemiBold',    bold: 'NotoSansKannada-Bold'    },
  hi: { regular: 'NotoSansDevanagari-Regular', medium: 'NotoSansDevanagari-Medium', semiBold: 'NotoSansDevanagari-SemiBold', bold: 'NotoSansDevanagari-Bold' },
  mt: { regular: 'NotoSansDevanagari-Regular', medium: 'NotoSansDevanagari-Medium', semiBold: 'NotoSansDevanagari-SemiBold', bold: 'NotoSansDevanagari-Bold' },
  bn: { regular: 'NotoSansBengali-Regular',    medium: 'NotoSansBengali-Medium',    semiBold: 'NotoSansBengali-SemiBold',    bold: 'NotoSansBengali-Bold'    },
  gj: { regular: 'NotoSansGujarati-Regular',   medium: 'NotoSansGujarati-Medium',   semiBold: 'NotoSansGujarati-SemiBold',   bold: 'NotoSansGujarati-Bold'   },
  or: { regular: 'NotoSansOriya-Regular',      medium: 'NotoSansOriya-Medium',      semiBold: 'NotoSansOriya-SemiBold',      bold: 'NotoSansOriya-Bold'      },
  pa: { regular: 'NotoSansGurmukhi-Regular',   medium: 'NotoSansGurmukhi-Medium',   semiBold: 'NotoSansGurmukhi-SemiBold',   bold: 'NotoSansGurmukhi-Bold'   },
}

// ─── CDN URLs for each NotoSans family (weights: Regular, Medium, SemiBold, Bold) ──

const NOTO_CDN: Record<string, Record<string, string>> = {
  NotoSansTamil: {
    'NotoSansTamil-Regular':      CDN_FONTS + 'NotoSansTamil/NotoSansTamil-Regular.ttf',
    'NotoSansTamil-Medium':       CDN_FONTS + 'NotoSansTamil/NotoSansTamil-Medium.ttf',
    'NotoSansTamil-SemiBold':     CDN_FONTS + 'NotoSansTamil/NotoSansTamil-SemiBold.ttf',
    'NotoSansTamil-Bold':         CDN_FONTS + 'NotoSansTamil/NotoSansTamil-Bold.ttf',
  },
  NotoSansTelugu: {
    'NotoSansTelugu-Regular':     CDN_FONTS + 'NotoSansTelugu/NotoSansTelugu-Regular.ttf',
    'NotoSansTelugu-Medium':      CDN_FONTS + 'NotoSansTelugu/NotoSansTelugu-Medium.ttf',
    'NotoSansTelugu-SemiBold':    CDN_FONTS + 'NotoSansTelugu/NotoSansTelugu-SemiBold.ttf',
    'NotoSansTelugu-Bold':        CDN_FONTS + 'NotoSansTelugu/NotoSansTelugu-Bold.ttf',
  },
  NotoSansMalayalam: {
    'NotoSansMalayalam-Regular':  CDN_FONTS + 'NotoSansMalayalam/NotoSansMalayalam-Regular.ttf',
    'NotoSansMalayalam-Medium':   CDN_FONTS + 'NotoSansMalayalam/NotoSansMalayalam-Medium.ttf',
    'NotoSansMalayalam-SemiBold': CDN_FONTS + 'NotoSansMalayalam/NotoSansMalayalam-SemiBold.ttf',
    'NotoSansMalayalam-Bold':     CDN_FONTS + 'NotoSansMalayalam/NotoSansMalayalam-Bold.ttf',
  },
  NotoSansKannada: {
    'NotoSansKannada-Regular':    CDN_FONTS + 'NotoSansKannada/NotoSansKannada-Regular.ttf',
    'NotoSansKannada-Medium':     CDN_FONTS + 'NotoSansKannada/NotoSansKannada-Medium.ttf',
    'NotoSansKannada-SemiBold':   CDN_FONTS + 'NotoSansKannada/NotoSansKannada-SemiBold.ttf',
    'NotoSansKannada-Bold':       CDN_FONTS + 'NotoSansKannada/NotoSansKannada-Bold.ttf',
  },
  NotoSansDevanagari: {
    'NotoSansDevanagari-Regular':  CDN_FONTS + 'NotoSansDevanagari/NotoSansDevanagari-Regular.ttf',
    'NotoSansDevanagari-Medium':   CDN_FONTS + 'NotoSansDevanagari/NotoSansDevanagari-Medium.ttf',
    'NotoSansDevanagari-SemiBold': CDN_FONTS + 'NotoSansDevanagari/NotoSansDevanagari-SemiBold.ttf',
    'NotoSansDevanagari-Bold':     CDN_FONTS + 'NotoSansDevanagari/NotoSansDevanagari-Bold.ttf',
  },
  NotoSansBengali: {
    'NotoSansBengali-Regular':    CDN_FONTS + 'NotoSansBengali/NotoSansBengali-Regular.ttf',
    'NotoSansBengali-Medium':     CDN_FONTS + 'NotoSansBengali/NotoSansBengali-Medium.ttf',
    'NotoSansBengali-SemiBold':   CDN_FONTS + 'NotoSansBengali/NotoSansBengali-SemiBold.ttf',
    'NotoSansBengali-Bold':       CDN_FONTS + 'NotoSansBengali/NotoSansBengali-Bold.ttf',
  },
  NotoSansGujarati: {
    'NotoSansGujarati-Regular':   CDN_FONTS + 'NotoSansGujarati/NotoSansGujarati-Regular.ttf',
    'NotoSansGujarati-Medium':    CDN_FONTS + 'NotoSansGujarati/NotoSansGujarati-Medium.ttf',
    'NotoSansGujarati-SemiBold':  CDN_FONTS + 'NotoSansGujarati/NotoSansGujarati-SemiBold.ttf',
    'NotoSansGujarati-Bold':      CDN_FONTS + 'NotoSansGujarati/NotoSansGujarati-Bold.ttf',
  },
  NotoSansOriya: {
    'NotoSansOriya-Regular':      CDN_FONTS + 'NotoSansOriya/NotoSansOriya-Regular.ttf',
    'NotoSansOriya-Medium':       CDN_FONTS + 'NotoSansOriya/NotoSansOriya-Medium.ttf',
    'NotoSansOriya-SemiBold':     CDN_FONTS + 'NotoSansOriya/NotoSansOriya-SemiBold.ttf',
    'NotoSansOriya-Bold':         CDN_FONTS + 'NotoSansOriya/NotoSansOriya-Bold.ttf',
  },
  NotoSansGurmukhi: {
    'NotoSansGurmukhi-Regular':   CDN_FONTS + 'NotoSansGurmukhi-Regular.ttf',
    'NotoSansGurmukhi-Medium':    CDN_FONTS + 'NotoSansGurmukhi-Medium.ttf',
    'NotoSansGurmukhi-SemiBold':  CDN_FONTS + 'NotoSansGurmukhi-SemiBold.ttf',
    'NotoSansGurmukhi-Bold':      CDN_FONTS + 'NotoSansGurmukhi-Bold.ttf',
  },
}

// ─── Lazy font loader ─────────────────────────────────────────────────────────

const loaded = new Set<string>()

export async function loadLangFonts(lang: string): Promise<void> {
  if (lang === 'en' || loaded.has(lang)) return

  const fontSet = LANG_FONTS[lang]
  if (!fontSet) return

  // Determine which NotoSans family to load from the Regular name
  const familyKey = fontSet.regular.replace('-Regular', '')
  const urls = NOTO_CDN[familyKey]
  if (!urls) return

  const toLoad: Record<string, string> = {}
  for (const [name, url] of Object.entries(urls)) {
    if (!Font.isLoaded(name)) toLoad[name] = url
  }

  if (Object.keys(toLoad).length > 0) {
    await Font.loadAsync(toLoad)
  }

  loaded.add(lang)
}
