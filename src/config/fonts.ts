// Font manifest + loader — RN equivalent of the Angular app's @font-face CSS
// rules. Every family below is fetched at runtime from the same CDN the web
// app uses and registered with expo-font, instead of being bundled or pulled
// from npm/Google Fonts. Native font rendering has no .woff2 support, so the
// web project's npm-hosted 'Poppins' entry (elitematrimony.com/fonts/poppins.woff2)
// is intentionally NOT replicated — Poppins-Regular.ttf below is its native stand-in.
import * as Font from 'expo-font'

const FONT_CDN = 'https://imgs.jodii.app/assets/fonts/'
const STG_FONT_CDN = 'https://stgimgs.jodii.app/assets/fonts/'

// Regional families live under <Family>/<Family>[-Variant].ttf, and the base
// (Regular) weight has no variant suffix in the path — e.g.
// NotoSansTamil/NotoSansTamil.ttf, NotoSansTamil/NotoSansTamil-Medium.ttf.
function regionalFamily(family: string): Record<string, string> {
  return {
    [`${family}-Regular`]: `${FONT_CDN}${family}/${family}.ttf`,
    [`${family}-Medium`]: `${FONT_CDN}${family}/${family}-Medium.ttf`,
    [`${family}-SemiBold`]: `${FONT_CDN}${family}/${family}-SemiBold.ttf`,
    [`${family}-Bold`]: `${FONT_CDN}${family}/${family}-Bold.ttf`,
  }
}

// family name -> remote .ttf URL, mirroring the web app's font list exactly.
export const FONT_MANIFEST: Record<string, string> = {
  'Roboto-Regular': `${FONT_CDN}RobotoEnglish/Roboto-Regular.ttf`,
  'BerkshireSwash-Regular': `${FONT_CDN}BerkshireSwash-Regular.ttf`,
  'Bolbyonesc-Regular': `${FONT_CDN}Bolby-one-sc.ttf`,
  'Poppins-Regular': `${FONT_CDN}PoppinsEnglish/Poppins-Regular.ttf`,
  'Poppins-Medium': `${FONT_CDN}PoppinsEnglish/Poppins-Medium.ttf`,
  'Poppins-SemiBold': `${FONT_CDN}PoppinsEnglish/Poppins-SemiBold.ttf`,
  'Poppins-Bold': `${FONT_CDN}PoppinsEnglish/Poppins-Bold.ttf`,
  'LibreBaskerville-Regular': `${STG_FONT_CDN}LibreBaskerville-Regular.ttf`,

  ...regionalFamily('NotoSansTamil'),
  ...regionalFamily('NotoSansMalayalam'),
  ...regionalFamily('NotoSansKannada'),
  ...regionalFamily('NotoSansTelugu'),
  ...regionalFamily('NotoSansDevanagari'),
  ...regionalFamily('NotoSansGujarati'),
  ...regionalFamily('NotoSansBengali'),
  ...regionalFamily('NotoSansOriya'),

  // Flat — no subfolder, and Regular keeps its suffix (unlike the families above).
  'NotoSansGurmukhi-Regular': `${FONT_CDN}NotoSansGurmukhi-Regular.ttf`,
  'NotoSansGurmukhi-Medium': `${FONT_CDN}NotoSansGurmukhi-Medium.ttf`,
  'NotoSansGurmukhi-SemiBold': `${FONT_CDN}NotoSansGurmukhi-SemiBold.ttf`,
  'NotoSansGurmukhi-Bold': `${FONT_CDN}NotoSansGurmukhi-Bold.ttf`,
}

// Always needed regardless of active language — loaded eagerly on app start.
export const ESSENTIAL_FONTS = [
  'Roboto-Regular',
  'Poppins-Regular',
  'Poppins-Medium',
  'Poppins-SemiBold',
  'Poppins-Bold',
]

// Which regional Noto family a given app language needs, loaded lazily on
// demand. Mirrors the script grouping from the legacy Angular _variable.scss
// (hi/mt both use Devanagari).
const LANGUAGE_FAMILY: Record<string, string> = {
  tm: 'NotoSansTamil',
  ml: 'NotoSansMalayalam',
  kn: 'NotoSansKannada',
  tl: 'NotoSansTelugu',
  hi: 'NotoSansDevanagari',
  mt: 'NotoSansDevanagari',
  bn: 'NotoSansBengali',
  gj: 'NotoSansGujarati',
  or: 'NotoSansOriya',
  pa: 'NotoSansGurmukhi',
}

function familyKeys(family: string): string[] {
  return ['Regular', 'Medium', 'SemiBold', 'Bold'].map(variant => `${family}-${variant}`)
}

const loadedFamilies = new Set<string>()
const attemptedLanguages = new Set<string>()

// Loads each family independently so one CDN/network failure never blocks the
// rest, and never throws — a family that fails to load is simply left
// unregistered, so RN's fontFamily lookup falls back to the system default.
async function loadFontFamilies(keys: string[]): Promise<void> {
  const toLoad = keys.filter(key => !loadedFamilies.has(key) && !Font.isLoaded(key))
  await Promise.all(
    toLoad.map(async key => {
      const uri = FONT_MANIFEST[key]
      if (!uri) return
      try {
        await Font.loadAsync({ [key]: { uri, display: Font.FontDisplay.FALLBACK } })
        loadedFamilies.add(key)
      } catch {
        // Network/CDN failure — leave unregistered, fall back to system font.
      }
    }),
  )
}

// Eager English/Latin batch — safe to call as often as needed, already-loaded
// families are skipped.
export async function loadEssentialFonts(): Promise<void> {
  await loadFontFamilies(ESSENTIAL_FONTS)
}

// Loads the essential batch plus the Noto family for `languageCode`, if any.
// Each language's family is only attempted once per session.
export async function loadFonts(languageCode: string): Promise<void> {
  await loadFontFamilies(ESSENTIAL_FONTS)

  const family = LANGUAGE_FAMILY[languageCode]
  if (!family || attemptedLanguages.has(languageCode)) return

  await loadFontFamilies(familyKeys(family))
  attemptedLanguages.add(languageCode)
}
