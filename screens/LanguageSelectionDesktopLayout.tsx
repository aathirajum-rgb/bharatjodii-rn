// Desktop layout for the Language-change screen (Figma "Jodii Desktop -
// Registration", node 659:18512 — the real popup content, found under the
// 659:18465 backdrop fragment the first pass hit). Figma shows this as a
// centered popup over whatever page opened it (Settings, in the mockup) —
// this still renders as its own DesktopPageShell page (not a floating modal)
// since it's reached via navigation.navigate('LanguageSelection') from many
// call sites (onboarding, HomeSidebar, Settings), and react-navigation's
// stack unmounts the previous screen either way, so a transparent-modal
// backdrop would just show blank, not the previous page dimmed. Card sizing
// (148x64 tiles) now matches Figma exactly.
// Purely presentational — LanguageSelectionScreen.tsx owns the
// selected/submitting state and handleNext handler.
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import DesktopPageShell from '../components/desktop-page-shell/DesktopPageShell'
import ButtonRevamp from '../components/button-revamp/ButtonRevamp'
import { Colors } from '../constants/colors'
import type { FooterTab } from '../components/app-footer/AppFooter'
import { Fonts, SemanticFontsEnglish } from '../src/theme/fonts'
import { handleBack } from '../utils/navigationRef'

type LangOption = { id: string; native: string; english: string }

export interface LanguageSelectionDesktopLayoutProps {
  navigation:   any
  userName:     string
  languages:    LangOption[]
  selected:     string | null
  submitting:   boolean
  onSelect:     (langId: string) => void
  onNext:       () => void
  onTabPress:   (tab: FooterTab) => void
}

export default function LanguageSelectionDesktopLayout({
  navigation, userName, languages, selected, submitting, onSelect, onNext, onTabPress,
}: LanguageSelectionDesktopLayoutProps) {
  const { t } = useTranslation()

  // No sidebar row maps to "change language" in the Figma-matched sidebar
  // (that's the top nav's language selector instead) — no activeItem to highlight.
  return (
    <DesktopPageShell navigation={navigation} userName={userName} onTabPress={onTabPress}>
      <View style={s.main}>
        <View style={s.titleRow}>
          <Text style={s.pageTitle}>{t('MENU.TTTLE_6')}</Text>
          <Pressable onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
            <Text style={s.closeX}>✕</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.heading}>{t('LOGIN_PAGE.SELECT_LANG')}</Text>

          <View style={s.grid}>
            {languages.map(lang => {
              const isSelected = selected === lang.id
              return (
                <Pressable
                  key={lang.id}
                  style={[s.langCard, isSelected && s.langCardSelected]}
                  onPress={() => onSelect(lang.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${lang.native} ${lang.english}`}
                >
                  <View style={s.langText}>
                    <Text style={s.nativeName} numberOfLines={1}>{lang.native}</Text>
                    <Text style={s.englishName} numberOfLines={1}>{lang.english}</Text>
                  </View>
                  <View style={[s.radio, isSelected && s.radioSelected]}>
                    {isSelected && <View style={s.radioDot} />}
                  </View>
                </Pressable>
              )
            })}
          </View>

          {/* Angular: language-selection.component.html's button uses
              REGISTRATION.SELECT ("Select"), not a "Next" label. */}
          <ButtonRevamp
            label={t('REGISTRATION.SELECT', 'Select')}
            variant="primary"
            disabled={!selected}
            loading={submitting}
            onPress={onNext}
            style={s.nextBtn}
          />
        </View>
      </View>
    </DesktopPageShell>
  )
}

const CARD_W = 148
const CARD_H = 64

const s = StyleSheet.create({
  main: { width: 360 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  pageTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 20, color: Colors.textDark },
  closeX: { fontSize: 16, color: Colors.black },

  card: {
    backgroundColor: Colors.surface, borderRadius: 24, padding: 24,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8,
    elevation: 4,
  },
  heading: { fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: Colors.textDark, marginBottom: 24 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },

  langCard: {
    width: CARD_W, height: CARD_H, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8,
    backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 10,
  },
  langCardSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.selectionBg },
  langText: { flex: 1, gap: 4 },
  nativeName: { fontFamily: Fonts.poppinsBold, fontSize: 16, color: Colors.textDark },
  englishName: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.textSecondary },

  radio: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  radioSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primaryDark },

  nextBtn: { width: 312, alignSelf: 'center' },
})
