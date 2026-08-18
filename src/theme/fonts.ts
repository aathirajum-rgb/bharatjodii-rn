// Font family constants — RN equivalent of the web app's
// var(--button-english-Medium) style custom properties. Screens should use
// these instead of hardcoding fontFamily strings inline.
export const Fonts = {
  robotoRegular: 'Roboto-Regular',
  berkshireSwashRegular: 'BerkshireSwash-Regular',
  bolbyonescRegular: 'Bolbyonesc-Regular',
  poppinsRegular: 'Poppins-Regular',
  poppinsMedium: 'Poppins-Medium',
  poppinsSemiBold: 'Poppins-SemiBold',
  poppinsBold: 'Poppins-Bold',
  libreBaskervilleRegular: 'LibreBaskerville-Regular',

  notoSansTamilRegular: 'NotoSansTamil-Regular',
  notoSansTamilMedium: 'NotoSansTamil-Medium',
  notoSansTamilSemiBold: 'NotoSansTamil-SemiBold',
  notoSansTamilBold: 'NotoSansTamil-Bold',

  notoSansMalayalamRegular: 'NotoSansMalayalam-Regular',
  notoSansMalayalamMedium: 'NotoSansMalayalam-Medium',
  notoSansMalayalamSemiBold: 'NotoSansMalayalam-SemiBold',
  notoSansMalayalamBold: 'NotoSansMalayalam-Bold',

  notoSansKannadaRegular: 'NotoSansKannada-Regular',
  notoSansKannadaMedium: 'NotoSansKannada-Medium',
  notoSansKannadaSemiBold: 'NotoSansKannada-SemiBold',
  notoSansKannadaBold: 'NotoSansKannada-Bold',

  notoSansTeluguRegular: 'NotoSansTelugu-Regular',
  notoSansTeluguMedium: 'NotoSansTelugu-Medium',
  notoSansTeluguSemiBold: 'NotoSansTelugu-SemiBold',
  notoSansTeluguBold: 'NotoSansTelugu-Bold',

  notoSansDevanagariRegular: 'NotoSansDevanagari-Regular',
  notoSansDevanagariMedium: 'NotoSansDevanagari-Medium',
  notoSansDevanagariSemiBold: 'NotoSansDevanagari-SemiBold',
  notoSansDevanagariBold: 'NotoSansDevanagari-Bold',

  notoSansGujaratiRegular: 'NotoSansGujarati-Regular',
  notoSansGujaratiMedium: 'NotoSansGujarati-Medium',
  notoSansGujaratiSemiBold: 'NotoSansGujarati-SemiBold',
  notoSansGujaratiBold: 'NotoSansGujarati-Bold',

  notoSansBengaliRegular: 'NotoSansBengali-Regular',
  notoSansBengaliMedium: 'NotoSansBengali-Medium',
  notoSansBengaliSemiBold: 'NotoSansBengali-SemiBold',
  notoSansBengaliBold: 'NotoSansBengali-Bold',

  notoSansOriyaRegular: 'NotoSansOriya-Regular',
  notoSansOriyaMedium: 'NotoSansOriya-Medium',
  notoSansOriyaSemiBold: 'NotoSansOriya-SemiBold',
  notoSansOriyaBold: 'NotoSansOriya-Bold',

  notoSansGurmukhiRegular: 'NotoSansGurmukhi-Regular',
  notoSansGurmukhiMedium: 'NotoSansGurmukhi-Medium',
  notoSansGurmukhiSemiBold: 'NotoSansGurmukhi-SemiBold',
  notoSansGurmukhiBold: 'NotoSansGurmukhi-Bold',
} as const

export type FontFamily = (typeof Fonts)[keyof typeof Fonts]

type FontWeightSet = { regular: string; medium: string; semiBold: string; bold: string }

// Per-language weight lookup — mirrors the legacy Angular _variable.scss
// script grouping (hi/mt both use Devanagari). Used where a screen must
// render text in whichever language the user is currently on (e.g. language
// picker labels), rather than a fixed family known at author time.
export const FontsByLanguage: Record<string, FontWeightSet> = {
  en: { regular: Fonts.poppinsRegular, medium: Fonts.poppinsMedium, semiBold: Fonts.poppinsSemiBold, bold: Fonts.poppinsBold },
  tm: { regular: Fonts.notoSansTamilRegular, medium: Fonts.notoSansTamilMedium, semiBold: Fonts.notoSansTamilSemiBold, bold: Fonts.notoSansTamilBold },
  tl: { regular: Fonts.notoSansTeluguRegular, medium: Fonts.notoSansTeluguMedium, semiBold: Fonts.notoSansTeluguSemiBold, bold: Fonts.notoSansTeluguBold },
  ml: { regular: Fonts.notoSansMalayalamRegular, medium: Fonts.notoSansMalayalamMedium, semiBold: Fonts.notoSansMalayalamSemiBold, bold: Fonts.notoSansMalayalamBold },
  kn: { regular: Fonts.notoSansKannadaRegular, medium: Fonts.notoSansKannadaMedium, semiBold: Fonts.notoSansKannadaSemiBold, bold: Fonts.notoSansKannadaBold },
  hi: { regular: Fonts.notoSansDevanagariRegular, medium: Fonts.notoSansDevanagariMedium, semiBold: Fonts.notoSansDevanagariSemiBold, bold: Fonts.notoSansDevanagariBold },
  mt: { regular: Fonts.notoSansDevanagariRegular, medium: Fonts.notoSansDevanagariMedium, semiBold: Fonts.notoSansDevanagariSemiBold, bold: Fonts.notoSansDevanagariBold },
  bn: { regular: Fonts.notoSansBengaliRegular, medium: Fonts.notoSansBengaliMedium, semiBold: Fonts.notoSansBengaliSemiBold, bold: Fonts.notoSansBengaliBold },
  gj: { regular: Fonts.notoSansGujaratiRegular, medium: Fonts.notoSansGujaratiMedium, semiBold: Fonts.notoSansGujaratiSemiBold, bold: Fonts.notoSansGujaratiBold },
  or: { regular: Fonts.notoSansOriyaRegular, medium: Fonts.notoSansOriyaMedium, semiBold: Fonts.notoSansOriyaSemiBold, bold: Fonts.notoSansOriyaBold },
  pa: { regular: Fonts.notoSansGurmukhiRegular, medium: Fonts.notoSansGurmukhiMedium, semiBold: Fonts.notoSansGurmukhiSemiBold, bold: Fonts.notoSansGurmukhiBold },
}

// ─── Semantic role scale ───────────────────────────────────────────────────
// Mirrors every --role-language-Weight custom property in the Angular app's
// src/_variable.scss (e.g. var(--button-english-Medium)), including the
// per-language weight variation Angular encodes per role (heading-02 is
// SemiBold for Tamil/Malayalam/Kannada/Telugu but Medium everywhere else;
// subheading-02 is Regular for Kannada/Telugu but Medium for Tamil/Malayalam).
// Two Angular vars used a miscased family name (NotoSansGurmukhi-Semibold)
// that would silently fail to match its @font-face and fall back in a web
// font-stack; RN has no such fallback, so those two roles use the correctly
// cased SemiBold family already registered in FONT_MANIFEST.
type SemanticRoles = {
  heading01: string
  heading02: string
  heading03: string
  subheading01: string
  subheading02: string
  body01: string
  body02: string
  button: string
  specialCta: string
  bottomnav: string
}

function semanticRoles(f: FontWeightSet, heading02: string, subheading02: string, specialCta: string): SemanticRoles {
  return {
    heading01: f.regular,
    heading02,
    heading03: f.bold,
    subheading01: f.regular,
    subheading02,
    body01: f.regular,
    body02: f.regular,
    button: f.medium,
    specialCta,
    bottomnav: f.regular,
  }
}

export const SemanticFonts: Record<string, SemanticRoles> = {
  en: semanticRoles(FontsByLanguage.en, FontsByLanguage.en.medium, FontsByLanguage.en.regular, FontsByLanguage.en.medium),
  pa: semanticRoles(FontsByLanguage.pa, FontsByLanguage.pa.semiBold, FontsByLanguage.pa.medium, FontsByLanguage.pa.semiBold),
  tm: semanticRoles(FontsByLanguage.tm, FontsByLanguage.tm.semiBold, FontsByLanguage.tm.medium, FontsByLanguage.tm.semiBold),
  ml: semanticRoles(FontsByLanguage.ml, FontsByLanguage.ml.semiBold, FontsByLanguage.ml.medium, FontsByLanguage.ml.semiBold),
  kn: semanticRoles(FontsByLanguage.kn, FontsByLanguage.kn.semiBold, FontsByLanguage.kn.regular, FontsByLanguage.kn.semiBold),
  tl: semanticRoles(FontsByLanguage.tl, FontsByLanguage.tl.semiBold, FontsByLanguage.tl.regular, FontsByLanguage.tl.semiBold),
  hi: semanticRoles(FontsByLanguage.hi, FontsByLanguage.hi.medium, FontsByLanguage.hi.regular, FontsByLanguage.hi.medium),
  mt: semanticRoles(FontsByLanguage.mt, FontsByLanguage.mt.medium, FontsByLanguage.mt.regular, FontsByLanguage.mt.medium),
  bn: semanticRoles(FontsByLanguage.bn, FontsByLanguage.bn.medium, FontsByLanguage.bn.regular, FontsByLanguage.bn.medium),
  gj: semanticRoles(FontsByLanguage.gj, FontsByLanguage.gj.medium, FontsByLanguage.gj.regular, FontsByLanguage.gj.medium),
  or: semanticRoles(FontsByLanguage.or, FontsByLanguage.or.medium, FontsByLanguage.or.regular, FontsByLanguage.or.medium),
}

// Flat English semantic constants for direct use in screens, e.g.
// fontFamily: Fonts.buttonEnglishMedium — the RN equivalent of
// var(--button-english-Medium) in the Angular CSS.
export const SemanticFontsEnglish = {
  headingEnglishRegular: SemanticFonts.en.heading01,
  headingEnglishMedium: SemanticFonts.en.heading02,
  headingEnglishBold: SemanticFonts.en.heading03,
  subheadingEnglishRegular: SemanticFonts.en.subheading01,
  bodyEnglishRegular: SemanticFonts.en.body01,
  buttonEnglishMedium: SemanticFonts.en.button,
  specialCtaEnglishMedium: SemanticFonts.en.specialCta,
  bottomnavEnglishRegular: SemanticFonts.en.bottomnav,
} as const

// Angular's --english-poppins var maps the "English/Poppins" family slot to
// Roboto-Regular specifically for the Rupee symbol (Poppins doesn't render
// ₹ correctly) — kept as an intent-revealing alias rather than a raw literal.
export const RupeeSymbolFont = Fonts.robotoRegular
