// Angular: the "language pill" (app-dropdown actionType="languageChanges") on
// matches/viewprofile/activity/explore opens LanguageSelectionComponent with
// actionType='mothertongue' — normally a 2-LANGUAGE bottom sheet (English +
// the user's own regional language). Menu opens the SAME LanguageSelection
// Component but with NO actionType (menu.page.ts's own local languageChange()
// method, componentProps only has action:'expandLanguage') — its `if
// (actionType == 'mothertongue') {...} else { languageArray = CONFIG.
// languageArray }` falls to the full 11-language list instead. It's the same
// underlying component/template with one data-source + a couple of style
// branches (language-selection.component.html:20,22,28) — not a separate
// screen — so this port keeps it as ONE component too, switched by `allLanguages`. See:
//   app/components/dropdown/dropdown.component.ts (the mothertongue pill, showList())
//   app/pages/menu/menu.page.ts:277-311 (Menu's own languageChange(), no actionType)
//   app/services/language-change.service.ts (languageChange(), submitLanguage(),
//     getLanguageArrayApi() — the domain-fetch + missing-language patch-in)
//   app/pages/language-selection/language-selection.component.ts/.html (the sheet)
//
// The mothertongue (default) list CAN temporarily grow to 3 cards: if the
// user picks a language outside their own domain via Menu's full-language
// list, that language gets patched into the persisted LANGUAGEARRAY
// (service's getLanguageArrayApi()) and shows up here too, until English or
// the real mother tongue is picked again (which reverts the persisted array
// back to 2) — see languageService.ts's refreshMotherTongueLanguageArray()/
// getMotherTongueLanguages() for the full mechanism, ported from that Angular
// source exactly.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import BottomSheet from '../bottom-sheet/BottomSheet'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { Fonts, FontsByLanguage, FontSize } from '../../src/theme/fonts'
import { loadFonts } from '../../src/config/fonts'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import i18n from '../../i18n'
import { getCurrentLanguage, getMotherTongueLanguages, getAllLanguages, submitLanguage, type LangOption } from '../../service/languageService'

export interface LanguagePillSheetProps {
  visible:  boolean
  onClose:  () => void
  // Angular: actionType omitted (Menu's "expandLanguage" flow) → CONFIG.
  // languageArray (all 11), instead of the default 2-3 item mothertongue list.
  // Also switches the close-button style + adds scrolling, matching the
  // template's actionType == 'mothertongue' branches exactly.
  allLanguages?: boolean | undefined
}

// Angular: self.changeLanguage() — the calling page's own re-fetch after a
// successful switch (matches.page.ts:3258 / viewprofile.page.ts:2856). Both
// MatchesScreen and ViewProfileScreen already watch i18n.language and reload
// their own data on change (mountedLangRef effects), so i18n.changeLanguage()
// below is enough to trigger that — no separate callback needed here.
export default function LanguagePillSheet({ visible, onClose, allLanguages = false }: LanguagePillSheetProps) {
  const { t } = useTranslation()
  // Title/"Select" CTA are server-translated UI strings whose script isn't
  // known until runtime (same reasoning as onboarding's option labels — see
  // useLanguageFonts' own header comment) — Poppins for English, the matching
  // NotoSans script for every other current app language.
  const uiFonts = useLanguageFonts()
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
    let cancelled = false
    // Angular: ngOnInit:89-93 — `this.language = data.language ?? LANG` then
    // `selectLang(this.language)` pre-selects the CURRENT app language, not
    // an empty radio group (confirmed against the reference screenshot).
    getCurrentLanguage().then(lang => { if (!cancelled) setSelected(lang) })
    if (allLanguages) {
      getAllLanguages().then(langs => { if (!cancelled) setLanguages(langs) })
    } else {
      getMotherTongueLanguages().then(langs => { if (!cancelled) setLanguages(langs) })
    }
    return () => { cancelled = true }
  }, [visible, allLanguages])

  useEffect(() => {
    let cancelled = false
    Promise.all(languages.map(lang => loadFonts(lang.id))).then(() => { if (!cancelled) setFontsReady(true) })
    return () => { cancelled = true }
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

  // Angular: ion-col size="6" per card — same grid for both variants, just
  // more cards when allLanguages (11 vs 2-3).
  const grid = (
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
  )

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      // Angular: language-selection.component.html:22 — the bare floating
      // bottomsheet-cross.svg is ONLY for actionType=='mothertongue'; the
      // expandLanguage/full-list variant uses a different inline close button
      // (rendered below, in children) instead, so BottomSheet's own default is
      // suppressed here.
      showClose={!allLanguages}
      style={allLanguages ? s.allLangSheet : undefined}
    >
      {/* Angular: language-selection.component.html:28-34 — inline top-right
          ion-button[shape=round][fill=clear] close-outline, only when NOT
          actionType=='mothertongue'. */}
      {allLanguages && (
        <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
          <Text style={s.closeX}>✕</Text>
        </Pressable>
      )}

      {/* Angular: heading1-semibold-22, "Select your app language" */}
      <Text style={[s.title, { fontFamily: uiFonts.semiBold }, allLanguages && s.allLangTitle]}>
        {t('LOGIN_PAGE.SELECT_LANG')}
      </Text>

      {/* Angular: max-height 95% + overflow-y:scroll on the expandLanguage
          variant's container (viewprofile-revamp-popup) — 11 cards need it,
          unlike the 2-3 item mothertongue sheet which never scrolls. */}
      {allLanguages ? (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>{grid}</ScrollView>
      ) : grid}

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
  title: { fontSize: FontSize.font22, fontWeight: '600', color: Colors.textPrimary, marginBottom: 24 },
  // allLanguages variant: bumped outer cap for the 11-item scroll body
  // (BottomSheet's own default maxHeight:'95%' still applies as the ceiling).
  allLangSheet: { maxHeight: '85%' },
  // Angular: ion-button[shape=round][fill=clear] — no border/fill, just the
  // icon; inline top-right (d-flex mr-24 text-align-right), not floating
  // above the sheet like the mothertongue variant's bare SVG.
  closeBtn: {
    position: 'absolute', top: 16, right: 16, zIndex: 10,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  closeX: { fontSize: FontSize.font20, color: Colors.textPrimary },
  allLangTitle: { marginTop: 8, paddingRight: 32 },
  scroll: { marginBottom: 16 },
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
  nativeName: { fontSize: FontSize.font16, fontWeight: '600', color: Colors.textPrimary },
  nativeNameSelected: { color: '#1f1e1b' },
  // Always the English name (e.g. "Tamil", "Telugu") regardless of the card's
  // own language — always Poppins, never that card's FontsByLanguage script
  // font (which was leaving it on the RN system-default font instead).
  englishName: { fontFamily: Fonts.poppinsRegular, fontSize: FontSize.font12, color: Colors.textPrimary, marginTop: 2 },
  radio: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#cccccc',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  radioSelected: { borderColor: '#B30033' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#B30033' },
  submitBtn: { marginTop: 4, marginBottom: 8 },
})
