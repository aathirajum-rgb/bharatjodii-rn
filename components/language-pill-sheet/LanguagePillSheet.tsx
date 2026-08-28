// Angular: the "language pill" (app-dropdown actionType="languageChanges") on
// matches/viewprofile/activity/explore opens LanguageSelectionComponent with
// actionType='mothertongue' — normally a 2-LANGUAGE bottom sheet (English +
// the user's own regional language), NOT the full 11-language page every
// other pill (menu/settings/signin/biodata) opens. See:
//   app/components/dropdown/dropdown.component.ts (the pill, showList())
//   app/services/language-change.service.ts (languageChange(), submitLanguage(),
//     getLanguageArrayApi() — the domain-fetch + missing-language patch-in)
//   app/pages/language-selection/language-selection.component.ts (the sheet)
//
// It CAN temporarily grow to 3 cards: if the user picks a language outside
// their own domain via Menu's full-language list, that language gets patched
// into the persisted LANGUAGEARRAY (service's getLanguageArrayApi()) and
// shows up here too, until English or the real mother tongue is picked again
// (which reverts the persisted array back to 2) — see languageService.ts's
// refreshMotherTongueLanguageArray()/getMotherTongueLanguages() for the full
// mechanism, ported from that Angular source exactly.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import BottomSheet from '../bottom-sheet/BottomSheet'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { FontsByLanguage } from '../../src/theme/fonts'
import { loadFonts } from '../../src/config/fonts'
import i18n from '../../i18n'
import { getCurrentLanguage, getMotherTongueLanguages, submitLanguage, type LangOption } from '../../service/languageService'

export interface LanguagePillSheetProps {
  visible:  boolean
  onClose:  () => void
}

// Angular: self.changeLanguage() — the calling page's own re-fetch after a
// successful switch (matches.page.ts:3258 / viewprofile.page.ts:2856). Both
// MatchesScreen and ViewProfileScreen already watch i18n.language and reload
// their own data on change (mountedLangRef effects), so i18n.changeLanguage()
// below is enough to trigger that — no separate callback needed here.
export default function LanguagePillSheet({ visible, onClose }: LanguagePillSheetProps) {
  const { t } = useTranslation()
  const [languages, setLanguages] = useState<LangOption[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fontsReady, setFontsReady] = useState(false)

  // Angular: ngOnInit → FUNC.getLanguageArrayList() (the persisted,
  // potentially-patched-to-3-items LANGUAGEARRAY) — re-read every time the
  // sheet opens so a language picked elsewhere (e.g. Menu's full list) shows
  // up here, and so reverting to English/mother-tongue makes it disappear.
  useEffect(() => {
    if (!visible) return
    // Angular: ngOnInit:89-93 — `this.language = data.language ?? LANG` then
    // `selectLang(this.language)` pre-selects the CURRENT app language, not
    // an empty radio group (confirmed against the reference screenshot).
    getCurrentLanguage().then(setSelected)
    getMotherTongueLanguages().then(setLanguages)
  }, [visible])

  useEffect(() => {
    Promise.all(languages.map(lang => loadFonts(lang.id))).then(() => setFontsReady(true))
  }, [languages])

  async function handleSubmit() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      const current = await getCurrentLanguage()
      if (current !== selected) {
        // Angular: submitLanguage() persists + re-fetches, THEN translate.use()
        // + self.changeLanguage() — same order/reasoning as LanguageSelectionScreen.
        await submitLanguage(current, selected)
        await i18n.changeLanguage(selected)
      }
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* Angular: heading1-semibold-22, "Select your app language" */}
      <Text style={s.title}>{t('LOGIN_PAGE.SELECT_LANG')}</Text>

      {/* Angular: ion-col size="6" per card — exactly 2 languages fill one row. */}
      <View style={s.row}>
        {languages.map(lang => {
          const isSelected = selected === lang.id
          return (
            <Pressable
              key={lang.id}
              style={[s.card, isSelected && s.cardSelected]}
              onPress={() => setSelected(lang.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${lang.native} ${lang.english}`}
            >
              <View style={s.cardText}>
                <Text
                  style={[
                    s.nativeName,
                    isSelected && s.nativeNameSelected,
                    fontsReady && { fontFamily: FontsByLanguage[lang.id]?.semiBold },
                  ]}
                  numberOfLines={1}
                >
                  {lang.native}
                </Text>
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
        label={t('REGISTRATION.SELECT', 'Select')}
        variant="primary"
        fullWidth
        disabled={!selected}
        loading={submitting}
        onPress={handleSubmit}
        style={s.submitBtn}
      />
    </BottomSheet>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────
// Angular: language-selection.component.scss's .jodii-language-selection
// (1px #e1e1e1 border / 8px radius / 12px top margin, item-radio-checked ->
// #FEFAFB bg + #B30033 border) + ion-radio 16x16 (--color-checked:#B30033).
const s = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '600', color: Colors.textPrimary, marginBottom: 24 },
  // flexWrap (not a fixed 2-up row) — a patched-in 3rd language (see
  // languageService.ts's getMotherTongueLanguages()) falls to its own row
  // alone, matching the reference screenshot (2 cards, then 1 below).
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  card: {
    width: '47%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#e1e1e1', borderRadius: 8, backgroundColor: Colors.white,
    paddingVertical: 12, paddingHorizontal: 10,
  },
  cardSelected: { borderColor: '#B30033', backgroundColor: '#FEFAFB' },
  cardText: { flex: 1, paddingRight: 8 },
  nativeName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  nativeNameSelected: { color: '#1f1e1b' },
  englishName: { fontSize: 12, color: Colors.textPrimary, marginTop: 2 },
  radio: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#cccccc',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  radioSelected: { borderColor: '#B30033' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#B30033' },
  submitBtn: { marginTop: 4, marginBottom: 8 },
})
