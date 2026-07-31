// Desktop layout for the Language-change screen (Figma "Jodii Desktop -
// Registration", node 659:18465 — the shared screenshot resolved to a blank
// modal-backdrop fragment, same recurring pattern hit elsewhere this session;
// built from the established desktop shell + mobile LanguageSelectionScreen's
// own language grid instead). Purely presentational — LanguageSelectionScreen.tsx
// owns the selected/submitting state and handleNext handler.
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import DesktopPageShell from '../components/desktop-page-shell/DesktopPageShell'
import ButtonRevamp from '../components/button-revamp/ButtonRevamp'
import { Colors } from '../constants/colors'
import type { FooterTab } from '../components/app-footer/AppFooter'

const LANGUAGES = [
  { id: 'en', native: 'English',   english: 'English'   },
  { id: 'tm', native: 'தமிழ்',     english: 'Tamil'     },
  { id: 'tl', native: 'తెలుగు',    english: 'Telugu'    },
  { id: 'hi', native: 'हिंदी',      english: 'Hindi'     },
  { id: 'ml', native: 'മലയാളം',    english: 'Malayalam' },
  { id: 'kn', native: 'ಕನ್ನಡ',     english: 'Kannada'   },
  { id: 'bn', native: 'বাংলা',      english: 'Bengali'   },
  { id: 'mt', native: 'मराठी',      english: 'Marathi'   },
  { id: 'or', native: 'ଓଡ଼ିଆ',     english: 'Odia'      },
  { id: 'gj', native: 'ગુજરાતી',   english: 'Gujarati'  },
  { id: 'pa', native: 'ਪੰਜਾਬੀ',    english: 'Punjabi'   },
] as const

type LangId = (typeof LANGUAGES)[number]['id']

export interface LanguageSelectionDesktopLayoutProps {
  navigation:   any
  userName:     string
  selected:     LangId | null
  submitting:   boolean
  onSelect:     (langId: LangId) => void
  onNext:       () => void
  onTabPress:   (tab: FooterTab) => void
}

export default function LanguageSelectionDesktopLayout({
  navigation, userName, selected, submitting, onSelect, onNext, onTabPress,
}: LanguageSelectionDesktopLayoutProps) {
  const { t } = useTranslation()

  // No sidebar row maps to "change language" in the Figma-matched sidebar
  // (that's the top nav's language selector instead) — no activeItem to highlight.
  return (
    <DesktopPageShell navigation={navigation} userName={userName} onTabPress={onTabPress}>
      <View style={s.main}>
        <Text style={s.pageTitle}>{t('MENU.TTTLE_6')}</Text>

        <View style={s.card}>
          <Text style={s.heading}>{t('LOGIN_PAGE.SELECT_LANG')}</Text>

          <View style={s.grid}>
            {LANGUAGES.map(lang => {
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

          <ButtonRevamp
            label={t('LOGIN_PAGE.NEXT', 'Next')}
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

const CARD_W = 200
const CARD_H = 64

const s = StyleSheet.create({
  main: { width: 700 },
  pageTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 20, color: Colors.textDark, marginBottom: 16 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle,
    padding: 24,
  },
  heading: { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: Colors.textDark, marginBottom: 16 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },

  langCard: {
    width: CARD_W, height: CARD_H, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8,
    backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 10,
  },
  langCardSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.selectionBg },
  langText: { flex: 1, gap: 4 },
  nativeName: { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: Colors.textDark },
  englishName: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textSecondary },

  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.inputBorder,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  radioSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.primaryDark },

  nextBtn: { width: 200, alignSelf: 'flex-end' },
})
