// Per-field "Select preferred {field}" screen with an inline Strict toggle —
// Figma "Jodii - Filters (Partner Preferences)" nodes 1364:2128 / 1385:302
// (the two Age states: just-toggled-on vs. an actual detected match-count
// reduction). Ported as a reusable wrapper (mirrors desktop's
// PreferenceFieldModal) instead of 14 near-identical screens: the caller
// supplies the field's own compact value-summary row(s) as `children`
// (SearchScreen.tsx's existing openHeight/openLocation/openStar/openCaste/
// openSimpleMulti pickers stay completely unchanged — this wrapper never
// touches them, it just sits around a tap-target that opens them).
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import Toggle from '../toggle/Toggle'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../cdn-svg/CdnSvg'
import {
  strictFieldCopy, STRICT_EXCLUDED_FIELDS, STRICT_FIELD_ORDER, strictPromptText,
} from '../../constants/strictFilter.config'
import type { FieldKey } from '../../screens/search/SearchScreen'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

export interface StrictFieldEditorScreenProps {
  visible:      boolean
  onClose:      () => void
  fieldKey:     FieldKey
  fieldLabel:   string
  // Angular: filterRevampConfig's per-field `SUBTITLE` key, e.g.
  // MONTHLYINCOME's "Select preferred monthly income" — not a "Select
  // preferred " + label string, which produced "Select preferred income".
  subtitle:     string
  fieldValue:   string
  strictEnabled: boolean
  onToggleStrict: (value: boolean) => void
  // Angular: search.component.ts's isFieldSetToAny() — decided from the SAVED
  // SELECTION ('0'), never from the displayed text. Was `fieldValue !==
  // anyLabel`, which only worked while every unset field rendered the one
  // generic "Any" string; the per-field labels Angular really shows ("Any
  // caste", "Dosham doesn't matter", …) would all have read as "not Any".
  isAny:        boolean
  // Angular: the `manageStrictFilter` flag this page is navigated with —
  // `manageStrictFilter || filterEventType != 'filter'` (search.component.ts's
  // redirectToFilterPage). False on a plain FILTERS-mode field page, where
  // none of the strict-filter UI belongs.
  strictAllowed: boolean
  matchCount:   number
  countLoading: boolean
  children:     React.ReactNode
}

export default function StrictFieldEditorScreen({
  visible, onClose, fieldKey, fieldLabel, subtitle, fieldValue,
  strictEnabled, onToggleStrict, isAny, strictAllowed, matchCount, countLoading, children,
}: StrictFieldEditorScreenProps) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const copy = strictFieldCopy(t, fieldKey)
  // Angular: filter-popup.component.ts's showStrictFilter getter —
  //   manageStrictFilter && !excluded(action) && !!content && !isFieldValueAny
  // Excluded fields (Occupation) never show the toggle, a field left at "Any"
  // has nothing to strictly match against, and Filters mode doesn't show the
  // strict block at all. (Angular's content check has no equivalent here:
  // STRICT_FIELD_KEYS is typed over every FieldKey, so copy always exists.)
  // A field with no STRICKPP position of its own (PROFILECREATED — Filters-mode
  // only, absent from STRICT_FIELD_ORDER) has no strict state to offer, so its
  // page is just the subtitle, the field row and Apply.
  const showStrict = strictAllowed
    && STRICT_FIELD_ORDER.includes(fieldKey)
    && !STRICT_EXCLUDED_FIELDS.has(fieldKey)
    && !isAny

  // Baseline captured the moment this screen opens — "Matches reduced" only
  // reflects a change made *in this visit*, not just "less than the total".
  const [baseline, setBaseline] = useState<number | null>(null)
  const wasVisible = useRef(false)

  useEffect(() => {
    if (visible && !wasVisible.current) setBaseline(matchCount)
    wasVisible.current = visible
  }, [visible, matchCount])

  const reduced = baseline != null && !countLoading && matchCount < baseline

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <CdnSvg uri={ICON_BACK} width={24} height={24} />
          </Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>{fieldLabel}</Text>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>{subtitle}</Text>

          <View style={s.fieldsWrap}>{children}</View>

          {showStrict && (
            <>
              <View style={s.strictBanner}>
                <View style={s.strictTextCol}>
                  <Text style={s.strictTitle}>{copy.label}</Text>
                  <Text style={s.strictDesc}>{copy.description}</Text>
                </View>
                <Toggle
                  value={strictEnabled}
                  onValueChange={onToggleStrict}
                />
              </View>

              {/* Angular: the consequence NOTE lives HERE, under the toggle,
                  and only once the count has actually dropped
                  (`<div *ngIf="isMatchesReduced">`). The "Turn on strict …"
                  RANGE prompt is a separate element in the FOOTER — see below. */}
              {reduced && <Text style={[s.promptText, s.warningText]}>{copy.note}</Text>}
            </>
          )}
        </ScrollView>

        <View style={[s.footerWrap, { paddingBottom: insets.bottom + 16 }]}>
          {/* Angular: `<div class="pl-24 pr-24 pb-16" *ngIf="showStrictFilter &&
              !isStrictFilterOn">` — the RANGE prompt sits in the FOOTER, above
              the count/Apply row, and only while the toggle is still OFF. It
              used to render up in the scroll body directly under the banner. */}
          {showStrict && !strictEnabled && (
            <Text style={s.footerPrompt}>{strictPromptText(t, fieldKey, fieldValue)}</Text>
          )}

          <View style={s.footerRow}>
          {/* Angular: the footer's matches column is `*ngIf="showStrictFilter"`
              and Apply widens from `width-60` to `width100` without it — so a
              Filters-mode field page is just a full-width Apply. */}
          {showStrict && <View style={s.matchesCol}>
            <Text style={s.matchesLabel}>{reduced ? 'Matches reduced' : 'Matches'}</Text>
            {reduced ? (
              <View style={s.reducedRow}>
                <Text style={s.reducedOld}>{baseline!.toLocaleString('en-IN')}</Text>
                <Text style={s.reducedTo}>to</Text>
                <Text style={s.reducedNew}>{matchCount.toLocaleString('en-IN')}</Text>
              </View>
            ) : (
              <Text style={s.matchesCount}>{countLoading ? '…' : matchCount.toLocaleString('en-IN')}</Text>
            )}
          </View>}
          <Pressable style={s.applyBtn} onPress={onClose}>
            {/* Angular: `[buttonText]="pageContent['FILTER_APPLY_CTA']"` — a
                translated string, not an English literal. */}
            <Text style={s.applyText}>{t('FILTER.FILTER_APPLY_CTA', 'Apply')}</Text>
          </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  // Angular `heading4-medium-16` = 16px / Poppins-Medium / 500. RN takes the
  // weight from the font FILE, so every style below names a family and drops
  // fontWeight — a bare fontWeight left these on the system font and let
  // Android synthesize a fake bold on top of it.
  headerTitle: { flex: 1, fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 16, color: '#333333', marginLeft: 6, marginRight: 16 },

  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 24 },
  // Angular: the "Select preferred X" subtitle is `heading4-medium-16` too.
  title: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 16, color: Colors.black },

  fieldsWrap: { gap: 24 },

  strictBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FBF2F5', borderWidth: 1, borderColor: '#FFE3EC',
    borderRadius: 8, padding: 12,
  },
  strictTextCol: { flex: 1, gap: 4 },
  // Angular `.setting-title body1-medium-14` — Poppins-MEDIUM 14/16, not
  // SemiBold (SemiBold at 14 is `font-14-semibold`, used only by the PP page's
  // own strict-filter card title and the pickers' group headers).
  strictTitle: { fontFamily: Fonts.poppinsMedium, fontSize: 14, lineHeight: 16, color: Colors.black },
  // Angular `.setting-description body3-regular-12` — 12/16 Poppins-Regular.
  strictDesc:  { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, lineHeight: 16, color: Colors.black },

  // Angular: `line-height-16 body3-regular-12` on both the range prompt and
  // the reduced-matches note.
  promptText:  { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, lineHeight: 16, color: Colors.black },
  warningText: { color: Colors.inputError },

  // Angular's <ion-footer> is a COLUMN: the RANGE prompt row, then the
  // count/Apply row. The hairline and the page inset belong to the outer
  // container so the prompt sits inside them too.
  footerWrap: {
    paddingHorizontal: 24, paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  // Angular `.pl-24 .pr-24 .pb-16` on the prompt div, with `pr-12` on the <p>
  // itself so the text stops short of the edge.
  footerPrompt: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize: 12, lineHeight: 16, color: Colors.black,
    paddingRight: 12, marginBottom: 16,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 26 },
  matchesCol: { gap: 4 },
  // Angular `.strict-matches-count`: label `body3-regular-12` at 12/16; value
  // `body2-regular-14` with the block's own `font-weight: 600` + 24 line-height
  // override — expressed here as the SemiBold family, since RN can't add
  // weight to Poppins-Regular the way the browser synthesizes it.
  matchesLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, lineHeight: 16, color: Colors.black },
  matchesCount: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, lineHeight: 24, color: Colors.black },
  reducedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Angular `.matches-count-reduced` (14/20): the struck-out old count and the
  // "to" keep weight 400 (`.matches-old`), the new count goes 600 (`.matches-new`).
  reducedOld: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 20, color: Colors.black, textDecorationLine: 'line-through' },
  reducedTo:  { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 20, color: Colors.black },
  reducedNew: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, lineHeight: 20, color: Colors.inputError },
  applyBtn: {
    flex: 1, height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  // Angular button-revamp's default ctaFontSize is `body2-regular-14` (+
  // `line-height-16`) — every CTA on the filter side is Poppins-REGULAR 14,
  // not medium/semibold. None of the filter-side call sites overrides it.
  applyText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 16, color: Colors.white },
})

// ─── Compact "input field" summary row (Figma's Input field component) ───────
// Bordered box, floating label, current value, right chevron — a tap target
// that opens the field's REAL editor (SearchablePicker/MultiSelectPicker/
// cascade), unchanged. Exported so SearchScreen.tsx can compose 1 (most
// fields) or 2 (Age/Height min+max) of these as this screen's `children`.

export function CompactFieldRow({
  label, value, onPress, disabled,
}: { label: string; value: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      style={[cs.box, disabled && cs.boxDisabled]}
      onPress={onPress}
      // Angular: filter.component.html puts `.disabled` on this row for
      // Dosham/Monthly income until the "specific" radio option is picked.
      disabled={disabled}
    >
      <View style={cs.labelWrap} pointerEvents="none">
        <Text style={cs.label}>{label}</Text>
      </View>
      <Text style={cs.value} numberOfLines={1}>{value}</Text>
      <CdnSvg uri={CDN_REACT + '/menu_right_arrow.svg'} width={16} height={16} />
    </Pressable>
  )
}

const cs = StyleSheet.create({
  box: {
    height: 48, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8,
  },
  boxDisabled: { opacity: 0.4 },
  labelWrap: {
    position: 'absolute', top: -9, left: 12, backgroundColor: Colors.white, paddingHorizontal: 4,
  },
  // Angular `.right-popup-open`: the value line is `body2-regular-14` and the
  // floating label `body3-regular-12` — both Poppins-Regular.
  label: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.black },
  value: { flex: 1, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black },
})
