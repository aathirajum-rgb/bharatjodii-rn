// "Manage Strict Filters" — Figma "Jodii - Filters (Partner Preferences)"
// node 1364:1929. Angular's search.component.ts manageStrictFilter mode:
// tapping "Manage Strict Filters" switches the whole PP list into a mode
// where every field row shows an edit shortcut + toggle instead of opening
// its own editor directly. Ported as a dedicated modal (matching this app's
// existing local-modal-state convention for every other field editor in
// SearchScreen.tsx) rather than a second full-screen mode of that screen.
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Toggle from '../toggle/Toggle'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import CdnSvg from '../cdn-svg/CdnSvg'
import {
  STRICT_FIELD_ORDER, STRICT_EXCLUDED_FIELDS, STRICT_FILTERS_TITLE, STRICT_FILTERS_NOTE, FILTER_CTA_NOTE,
} from '../../constants/strictFilter.config'
import type { FieldKey } from '../../screens/search/SearchScreen'

// Close icon is the same asset AppHeader.tsx uses. The edit icon is the grey
// pencil under assets/images/svg/ — NOT registration-new/edit-pencil.svg, which
// is OTPScreen's own (blue) edit affordance and was borrowed here by mistake.
const ICON_CLOSE = CDN_SVG + 'revamp/close-icon.svg'
const ICON_EDIT  = CDN_SVG + 'icon-edit-grey.svg'

export interface StrictFilterManageModalProps {
  visible:      boolean
  onClose:      () => void
  strictState:  Record<FieldKey, boolean>
  onToggle:     (key: FieldKey, value: boolean) => void
  onEditField:  (key: FieldKey) => void
  fieldIcon:    Record<FieldKey, string>
  fieldLabel:   Record<FieldKey, string>   // e.g. "Age", "Religion" — this screen's own row labels
  fieldValue:   Record<FieldKey, string>   // current selected value, e.g. "25 - 35 yrs"
  anyLabel:     string                     // e.g. "Any" — this screen's own "unset" sentinel text
  matchCount:   number
  countLoading: boolean
  onShowMatches: () => void
}

const VISIBLE_FIELDS = STRICT_FIELD_ORDER.filter(key => !STRICT_EXCLUDED_FIELDS.has(key))

export default function StrictFilterManageModal({
  visible, onClose, strictState, onToggle, onEditField, fieldIcon, fieldLabel, fieldValue, anyLabel,
  matchCount, countLoading, onShowMatches,
}: StrictFilterManageModalProps) {
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Pressable style={s.closeBtn} onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <CdnSvg uri={ICON_CLOSE} width={16} height={16} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>{STRICT_FILTERS_TITLE}</Text>
          <Text style={s.subtitle}>{STRICT_FILTERS_NOTE}</Text>

          <View style={s.list}>
            {VISIBLE_FIELDS.map((key, i) => {
              // Angular: isFieldSetToAny() — a field left at "Any"/unset has
              // nothing to strictly match against, so its toggle is hidden
              // (the row stays tappable to go pick a value).
              const isAny = fieldValue[key] === anyLabel
              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [s.row, i === VISIBLE_FIELDS.length - 1 && s.rowLast, pressed && s.rowPressed]}
                  onPress={() => onEditField(key)}
                  accessibilityRole="button"
                >
                  <View style={s.rowLeft}>
                    <CdnSvg uri={fieldIcon[key]} width={24} height={24} />
                    <View style={s.rowText}>
                      <Text style={s.rowLabel}>{fieldLabel[key]}</Text>
                      <Text style={s.rowValue} numberOfLines={1}>{fieldValue[key]}</Text>
                    </View>
                  </View>
                  <View style={s.rowRight}>
                    <CdnSvg uri={ICON_EDIT} width={24} height={24} />
                    {!isAny && (
                      <Toggle
                        value={!!strictState[key]}
                        onValueChange={value => onToggle(key, value)}
                      />
                    )}
                  </View>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={s.footerNote}>{FILTER_CTA_NOTE}</Text>
          <Pressable style={s.showMatchesBtn} onPress={onShowMatches} disabled={countLoading}>
            <Text style={s.showMatchesText}>
              {countLoading ? '…' : `Show ${matchCount.toLocaleString('en-IN')} matches`}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 24 },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  title: { fontSize: 16, fontWeight: '600', color: Colors.black, marginBottom: 4 },
  subtitle: { fontSize: 12, lineHeight: 20, color: Colors.black, marginBottom: 24 },

  list: {},
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E6E6E6', gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { opacity: 0.6 },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowText: { flex: 1, gap: 8 },
  rowLabel: { fontSize: 14, color: Colors.black },
  rowValue: { fontSize: 14, fontWeight: '500', color: Colors.black },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },

  footer: {
    paddingHorizontal: 24, paddingTop: 16, gap: 12, alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  footerNote: { fontSize: 12, color: '#545454' },
  showMatchesBtn: {
    alignSelf: 'stretch', height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  showMatchesText: { fontSize: 14, fontWeight: '500', color: Colors.white },
})
