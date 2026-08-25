// Returns the font family set (regular/medium/semiBold/bold) for whatever
// language the app is currently in, re-rendering the caller on every language
// change — Poppins for English, the matching NotoSans script (NotoSansTelugu,
// NotoSansTamil, ...) for every other supported language. Onboarding screens
// render server-translated text (option labels, month names, titles) whose
// language isn't known until runtime, so a static StyleSheet fontFamily can't
// express this — screens must read this hook and apply the family inline.
import { useEffect, useState } from 'react'
import i18n from '../i18n'
import { FontsByLanguage, type FontFamily } from '../src/theme/fonts'

type FontWeightSet = { regular: FontFamily; medium: FontFamily; semiBold: FontFamily; bold: FontFamily }

export function useLanguageFonts(): FontWeightSet {
  const [lang, setLang] = useState(i18n.language)

  useEffect(() => {
    function onLangChange(lng: string) { setLang(lng) }
    i18n.on('languageChanged', onLangChange)
    return () => { i18n.off('languageChanged', onLangChange) }
  }, [])

  return FontsByLanguage[lang] ?? FontsByLanguage.en
}
