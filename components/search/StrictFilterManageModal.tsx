// "Manage Strict Filters" — Figma "Jodii - Filters (Partner Preferences)"
// node 1364:1929. Angular's search.component.ts manageStrictFilter mode:
// tapping "Manage Strict Filters" switches the whole PP list into a mode
// where every field row shows an edit shortcut + toggle instead of opening
// its own editor directly. Ported as a dedicated modal (matching this app's
// existing local-modal-state convention for every other field editor in
// SearchScreen.tsx) rather than a second full-screen mode of that screen.
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Toggle, { TOGGLE_WIDTH } from '../toggle/Toggle'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REVAMP, CDN_SVG } from '../../constants/cdn'
import CdnSvg from '../cdn-svg/CdnSvg'
import {
  STRICT_FIELD_ORDER, STRICT_EXCLUDED_FIELDS, STRICT_FILTERS_TITLE, STRICT_FILTERS_NOTE, FILTER_CTA_NOTE,
} from '../../constants/strictFilter.config'
import type { FieldKey } from '../../screens/search/SearchScreen'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'

// Close icon: revamp-img/close-icon-gray.svg — what Angular's own
// manageStrictFilter header uses (search.component.html:9,
// `revamp-img/close-icon-gray.svg` behind `.close-icon-size`), and the same
// asset SearchablePicker already uses for the side panel's close. Was
// svg/revamp/close-icon.svg (AppHeader's icon).
// The edit icon is the grey pencil under assets/images/svg/ — NOT
// registration-new/edit-pencil.svg, which is OTPScreen's own (blue) edit
// affordance and was borrowed here by mistake.
const ICON_CLOSE = CDN_REVAMP + 'close-icon-gray.svg'
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
  // Angular: search.component.ts's isFieldSetToAny() — read off the SAVED
  // SELECTION ('0'), not off the displayed text. Was `fieldValue[key] ===
  // anyLabel`, which only held while every unset field rendered one generic
  // "Any"; the per-field labels Angular really shows ("Any caste", "Dosham
  // doesn't matter", …) would all have counted as a real preference.
  fieldIsAny:   Record<string, boolean>
  matchCount:   number
  countLoading: boolean
  onShowMatches: () => void
}

const VISIBLE_FIELDS = STRICT_FIELD_ORDER.filter(key => !STRICT_EXCLUDED_FIELDS.has(key))

export default function StrictFilterManageModal({
  visible, onClose, strictState, onToggle, onEditField, fieldIcon, fieldLabel, fieldValue, fieldIsAny,
  matchCount, countLoading, onShowMatches,
}: StrictFilterManageModalProps) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Pressable style={s.closeBtn} onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            {/* 24, matching SearchablePicker's close (same asset, same flow) —
                Angular's `.close-icon-size` is 25px. 16 was sized for the
                smaller icon this replaced. */}
            <CdnSvg uri={ICON_CLOSE} width={24} height={24} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>{t(STRICT_FILTERS_TITLE)}</Text>
          <Text style={s.subtitle}>{t(STRICT_FILTERS_NOTE)}</Text>

          <View style={s.list}>
            {VISIBLE_FIELDS.map((key, i) => {
              // Angular: isFieldSetToAny() — a field left at "Any"/unset has
              // nothing to strictly match against, so its toggle is hidden
              // (the row stays tappable to go pick a value).
              const isAny = !!fieldIsAny[key]
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
                    {/* The toggle's slot is always occupied, so the edit icon
                        stays in one column whether or not the row has a toggle.
                        Angular does the same thing by padding the icon instead
                        (`isFieldSetToAny(item) ? 'pr-56' : 'pr-16'`), which
                        hardcodes the toggle's width in two places; reserving
                        the space keeps the two in step on their own. */}
                    <View style={s.toggleSlot}>
                      {!isAny && (
                        <Toggle
                          value={!!strictState[key]}
                          onValueChange={value => onToggle(key, value)}
                        />
                      )}
                    </View>
                  </View>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={s.footerNote}>{t(FILTER_CTA_NOTE)}</Text>
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
  // Angular (search.component.html, manageStrictFilter header): title is
  // `heading3-semibold-16` = 16px Poppins-SemiBold with `.strict-filter-title`
  // line-height 1.4; the note is `body3-regular-12` with line-height 1.5.
  // RN takes weight from the font file, so these name a family instead of a
  // fontWeight (which left them on the system font).
  title: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font16, lineHeight: 22, color: Colors.black, marginBottom: 4 },
  subtitle: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, lineHeight: 18, color: Colors.black, marginBottom: 24 },

  list: {},
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E6E6E6', gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { opacity: 0.6 },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowText: { flex: 1, gap: 8 },
  // Same two-line row as the PP list: label `body2-regular-14`,
  // value `body1-medium-14`.
  rowLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, lineHeight: 16, color: Colors.black },
  rowValue: { fontFamily: Fonts.poppinsMedium, fontSize: FontSize.font14, lineHeight: 16, color: Colors.black },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  toggleSlot: { width: TOGGLE_WIDTH, alignItems: 'flex-end' },

  footer: {
    paddingHorizontal: 24, paddingTop: 16, gap: 12, alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  // Angular: "(This might reduce your matches)" is `body2-regular-14
  // color-545454` — 14px, not 12.
  footerNote: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: '#545454' },
  showMatchesBtn: {
    alignSelf: 'stretch', height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  // button-revamp's default ctaFontSize: `body2-regular-14` + `line-height-16`.
  showMatchesText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, lineHeight: 16, color: Colors.white },
})
