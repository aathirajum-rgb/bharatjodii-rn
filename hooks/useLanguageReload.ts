// Re-runs a screen's option-list fetch whenever the app language changes.
//
// Angular reference: registration-revamp.component.ts subscribes to
// common.LangChangeUpdate and, on every emit, sets IsUpdateLanguage = true then
// calls handleLanguageChange() → runInitialDataPopulation(lang, forceRefresh=true)
// → getRegistrationDynamicArray(true, 1). That re-fetches the whole registration
// array in the new language and then re-runs assignRegistrationData(), which
// re-resolves each already-answered field from its stored KEY against the newly
// translated list — so the visible labels switch language live while the user's
// selection is preserved.
//
// The RN equivalent is the same two moves:
//   1. the service layer re-fetches (getRegistrationArrays() is language-scoped
//      via REGISTRATIONARRAYS_LANG, and submitLanguage() clears the cache), and
//   2. the screen re-runs its loader, which restores the selection by KEY from
//      registration storage — the RN analogue of assignRegistrationData().
//
// Screens already run `loader` once on mount with a [] dep array. This hook adds
// ONLY the re-run on a real language change: the initial mount is skipped via
// mountedLangRef, so nothing double-fetches on first render. Same pattern already
// used by MatchesScreen/ActivityScreen/HomeScreen for their own reloads.
import { useEffect, useRef } from 'react'
import i18n from '../i18n'

export function useLanguageReload(loader: () => void | Promise<void>) {
  // Kept in a ref so a screen can pass an inline closure without the effect
  // re-firing on every render — only i18n.language should trigger it.
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const mountedLangRef = useRef(i18n.language)

  useEffect(() => {
    function onLangChange(lng: string) {
      if (lng === mountedLangRef.current) return
      mountedLangRef.current = lng
      // Errors are the loader's own concern — each screen's loader already
      // catches and falls back, and an unhandled rejection here would be silent.
      Promise.resolve(loaderRef.current()).catch(() => {})
    }
    i18n.on('languageChanged', onLangChange)
    return () => { i18n.off('languageChanged', onLangChange) }
  }, [])
}
