// Shared "language pill" header control — Angular: every header pill that
// reaches LanguageChangeService.languageChange() (Home's app-header header1,
// Matches, ViewProfile, Activity — confirmed via exhaustive source trace) opens
// the SAME 2-language bottom sheet unconditionally, always passing
// actionType='mothertongue'. There is no Angular example of this pill
// opening the full 11-language list — that's a DIFFERENT pill (Menu/Settings/
// Login/Biodata's "expandLanguage" flow), visually and structurally distinct
// (LanguageSelectionScreen.tsx), which stays untouched by this component.
//
// Before this component existed, each screen re-implemented the pill
// independently and had drifted in three different ways:
//   - MatchesHeader.tsx: correct native-script label lookup (LANG_LABELS,
//     now moved here), opened the sheet — the reference this component is
//     modeled on.
//   - AppHeader.tsx (Home): had its own LANGUAGE_FULL_NAMES map showing
//     English names ("Tamil") instead of native script ("தமிழ்"), and
//     navigated to the full-page list instead of the sheet.
//   - ActivityScreen.tsx (Liked profiles): hardcoded the label to the literal
//     string "English" regardless of the actual active language, and also
//     navigated to the full-page list.
//   - MessagerListScreen.tsx (Messages) mobile view: had no language pill at
//     all.
// This component is the single source of truth going forward — it owns the
// label lookup, the pill's visual styling, AND the sheet it opens, so a
// screen only needs to render <LanguagePill langCode={i18n.language} /> with
// no extra state/wiring of its own.
import { useState } from 'react'
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import LanguagePillSheet from './LanguagePillSheet'
import { CDN_SVG } from '../../constants/cdn'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { FontSize } from '../../src/theme/fonts'

const CDN = CDN_SVG

// Angular: FUNC.getSelectedKeyValue(langArrayList, LANG, '2') — type '2' maps
// to the TITLE field of core/config/common.config.ts's languageArray, i.e.
// each language's OWN native-script name (e.g. "తెలుగు"), not its English
// name ("Telugu"). Re-exported under its old name from matches-header/
// MatchesHeader.tsx (now just a re-export) so existing imports keep working.
export const LANG_LABELS: Record<string, string> = {
  en: 'English', tm: 'தமிழ்', tl: 'తెలుగు', hi: 'हिंदी',
  ml: 'മലയാളം', kn: 'ಕನ್ನಡ', bn: 'বাংলা', mt: 'मराठी',
  or: 'ଓଡ଼ିଆ', gj: 'ગુજરાતી', pa: 'ਪੰਜਾਬੀ',
}

export interface LanguagePillProps {
  langCode: string
  style?:   StyleProp<ViewStyle> | undefined
}

export default function LanguagePill({ langCode, style }: LanguagePillProps) {
  const langFonts = useLanguageFonts()
  const [showSheet, setShowSheet] = useState(false)
  const label = LANG_LABELS[langCode] ?? 'English'

  return (
    <>
      <Pressable style={[s.pill, style]} onPress={() => setShowSheet(true)} hitSlop={8}>
        <CdnSvg uri={CDN + 'revamp/lang-change-img.svg'} width={24} height={24} />
        <Text style={[s.text, { fontFamily: langFonts.medium }]} numberOfLines={1}>{label}</Text>
      </Pressable>
      <LanguagePillSheet visible={showSheet} onClose={() => setShowSheet(false)} />
    </>
  )
}

// Figma/live-Angular-measured: 8px radius, transparent fill, solid black 1px
// border, ~37px tall (measured off the live Angular app's .lang-selection
// computed style, via AppHeader.tsx's now-removed h1LangBtn) — MatchesHeader.
// tsx's langPill independently matched this too. ActivityScreen.tsx's own
// copy had drifted to Colors.borderNeutral (a lighter grey) — reconciled
// back to this true value. Icon size (24x24) follows MatchesHeader.tsx's value.
const s = StyleSheet.create({
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    borderWidth:       1,
    borderColor:       '#000000',
    borderRadius:      8,
    paddingLeft:       8,
    paddingRight:      12,
    paddingVertical:   4,
  },
  text: {
    fontSize: FontSize.font12,
    color:    '#000000',
  },
})
