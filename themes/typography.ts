// Font families — names must match the font files registered in the app.
// Angular used CSS variables per language — replaced with a typed map here.
// Use LangFontMap to get the right font set for the active language.

export const FontFamilies = {
  english: {
    regular: 'Poppins-Regular',
    medium: 'Poppins-Medium',
    semiBold: 'Poppins-SemiBold',
    bold: 'Poppins-Bold',
  },
  gurmukhi: {   // Punjabi
    regular: 'NotoSansGurmukhi-Regular',
    medium: 'NotoSansGurmukhi-Medium',
    semiBold: 'NotoSansGurmukhi-SemiBold',
    bold: 'NotoSansGurmukhi-Bold',
  },
  tamil: {
    regular: 'NotoSansTamil-Regular',
    medium: 'NotoSansTamil-Medium',
    semiBold: 'NotoSansTamil-SemiBold',
    bold: 'NotoSansTamil-Bold',
  },
  malayalam: {
    regular: 'NotoSansMalayalam-Regular',
    medium: 'NotoSansMalayalam-Medium',
    semiBold: 'NotoSansMalayalam-SemiBold',
    bold: 'NotoSansMalayalam-Bold',
  },
  kannada: {
    regular: 'NotoSansKannada-Regular',
    medium: 'NotoSansKannada-Medium',
    semiBold: 'NotoSansKannada-SemiBold',
    bold: 'NotoSansKannada-Bold',
  },
  telugu: {
    regular: 'NotoSansTelugu-Regular',
    medium: 'NotoSansTelugu-Medium',
    semiBold: 'NotoSansTelugu-SemiBold',
    bold: 'NotoSansTelugu-Bold',
  },
  devanagari: {  // Hindi + Marathi share the same font
    regular: 'NotoSansDevanagari-Regular',
    medium: 'NotoSansDevanagari-Medium',
    semiBold: 'NotoSansDevanagari-SemiBold',
    bold: 'NotoSansDevanagari-Bold',
  },
  bengali: {
    regular: 'NotoSansBengali-Regular',
    medium: 'NotoSansBengali-Medium',
    semiBold: 'NotoSansBengali-SemiBold',
    bold: 'NotoSansBengali-Bold',
  },
  gujarati: {
    regular: 'NotoSansGujarati-Regular',
    medium: 'NotoSansGujarati-Medium',
    semiBold: 'NotoSansGujarati-SemiBold',
    bold: 'NotoSansGujarati-Bold',
  },
  oriya: {
    regular: 'NotoSansOriya-Regular',
    medium: 'NotoSansOriya-Medium',
    semiBold: 'NotoSansOriya-SemiBold',
    bold: 'NotoSansOriya-Bold',
  },
  rupee: {  // Roboto used specifically for the ₹ symbol rendering
    regular: 'Roboto-Regular',
  },
} as const

export type FontSet = typeof FontFamilies[keyof typeof FontFamilies]

// Maps i18n language code → correct font family set.
// Usage: const fonts = LangFontMap[currentLang] ?? FontFamilies.english
export const LangFontMap: Record<string, FontSet> = {
  en: FontFamilies.english,
  pa: FontFamilies.gurmukhi,
  ta: FontFamilies.tamil,
  ml: FontFamilies.malayalam,
  kn: FontFamilies.kannada,
  te: FontFamilies.telugu,
  hi: FontFamilies.devanagari,
  mr: FontFamilies.devanagari,
  bn: FontFamilies.bengali,
  gu: FontFamilies.gujarati,
  or: FontFamilies.oriya,
}

// Font sizes in dp (device-independent pixels) — matches Angular px values exactly
export const FontSizes = {
  xxs: 8,
  xs: 10,
  sm: 12,
  md: 14,
  mlg: 16,
  lg: 18,
  xlg: 20,
  xxlg: 24,
  xxxlg: 32,
  xxxxlg: 48,
} as const

// React Native expects string font weights
export const FontWeights = {
  medium: '500' as const,
  bold: '700' as const,
  heavy: '900' as const,
}
