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
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import Toggle from '../toggle/Toggle'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../cdn-svg/CdnSvg'
import { STRICT_FIELD_COPY, STRICT_EXCLUDED_FIELDS, strictPromptText } from '../../constants/strictFilter.config'
import type { FieldKey } from '../../screens/search/SearchScreen'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

export interface StrictFieldEditorScreenProps {
  visible:      boolean
  onClose:      () => void
  fieldKey:     FieldKey
  fieldLabel:   string
  fieldValue:   string
  strictEnabled: boolean
  onToggleStrict: (value: boolean) => void
  anyLabel:     string   // e.g. "Any" — this screen's own "unset" sentinel text
  matchCount:   number
  countLoading: boolean
  children:     React.ReactNode
}

export default function StrictFieldEditorScreen({
  visible, onClose, fieldKey, fieldLabel, fieldValue,
  strictEnabled, onToggleStrict, anyLabel, matchCount, countLoading, children,
}: StrictFieldEditorScreenProps) {
  const insets = useSafeAreaInsets()
  const copy = STRICT_FIELD_COPY[fieldKey]
  // Angular: filter-popup.component.ts's showStrictFilter getter — excluded
  // fields (Occupation) never show the toggle here either, and any field
  // left at "Any"/unset has nothing to strictly match against yet.
  const showStrict = !STRICT_EXCLUDED_FIELDS.has(fieldKey) && fieldValue !== anyLabel

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
          <Text style={s.title}>Select preferred {fieldLabel.toLowerCase()}</Text>

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

              <Text style={[s.promptText, reduced && s.warningText]}>
                {reduced ? copy.note : strictPromptText(fieldKey, fieldLabel, fieldValue)}
              </Text>
            </>
          )}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.matchesCol}>
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
          </View>
          <Pressable style={s.applyBtn} onPress={onClose}>
            <Text style={s.applyText}>Apply</Text>
          </Pressable>
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
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: '#333333', marginLeft: 6, marginRight: 16 },

  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 24 },
  title: { fontSize: 16, fontWeight: '500', color: Colors.black },

  fieldsWrap: { gap: 24 },

  strictBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FBF2F5', borderWidth: 1, borderColor: '#FFE3EC',
    borderRadius: 8, padding: 12,
  },
  strictTextCol: { flex: 1, gap: 4 },
  strictTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black },
  strictDesc:  { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, lineHeight: 16, color: Colors.black },

  promptText:  { fontSize: 12, lineHeight: 16, color: Colors.black },
  warningText: { color: Colors.inputError },

  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 26, paddingHorizontal: 24, paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  matchesCol: { gap: 4 },
  matchesLabel: { fontSize: 12, color: Colors.black },
  matchesCount: { fontSize: 14, fontWeight: '600', color: Colors.black },
  reducedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reducedOld: { fontSize: 14, color: Colors.black, textDecorationLine: 'line-through' },
  reducedTo:  { fontSize: 14, color: Colors.black },
  reducedNew: { fontSize: 14, fontWeight: '600', color: Colors.inputError },
  applyBtn: {
    flex: 1, height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  applyText: { fontSize: 14, fontWeight: '500', color: Colors.white },
})

// ─── Compact "input field" summary row (Figma's Input field component) ───────
// Bordered box, floating label, current value, right chevron — a tap target
// that opens the field's REAL editor (SearchablePicker/MultiSelectPicker/
// cascade), unchanged. Exported so SearchScreen.tsx can compose 1 (most
// fields) or 2 (Age/Height min+max) of these as this screen's `children`.

export function CompactFieldRow({
  label, value, onPress,
}: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable style={cs.box} onPress={onPress}>
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
  labelWrap: {
    position: 'absolute', top: -9, left: 12, backgroundColor: Colors.white, paddingHorizontal: 4,
  },
  label: { fontSize: 12, color: Colors.black },
  value: { flex: 1, fontSize: 14, color: Colors.black },
})
