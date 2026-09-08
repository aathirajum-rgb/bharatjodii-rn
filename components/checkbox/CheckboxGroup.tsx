import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Colors } from '../../constants/colors'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckboxOption {
  key:      string
  value:    string
  checked?: boolean | undefined
  // Row background, separate from the tick. Angular's `filter-selected-bg` is
  // `item.checked && !isCheckAnyOption`: with the filter on "Any" every row is
  // ticked but none is highlighted, since none is a real selection. Defaults
  // to `checked` when not given.
  highlighted?: boolean | undefined
  // A group heading row (a country over its states, a state over its
  // districts). Angular: right-side-panel's `type == 'parent'` item —
  // `filter-heading-bg` #F0F0F0 background with a `font-14-semibold` label,
  // `filter-heading-bg-active` once the group is (partly) selected.
  parent?: boolean | undefined
  // Some children selected, not all — rendered as a dash, matching Angular's
  // `[indeterminate]` on a group heading.
  indeterminate?: boolean | undefined
}

export interface CheckboxGroupProps {
  options:  CheckboxOption[]
  onToggle: (key: string, checked: boolean) => void
  style?:   ViewStyle | undefined
}

// ─── CheckboxItem ─────────────────────────────────────────────────────────────

function CheckboxItem({
  option,
  onToggle,
}: {
  option:   CheckboxOption
  onToggle: (key: string, checked: boolean) => void
}) {
  const checked = !!option.checked
  // Option labels are server-translated, so the family follows the current
  // language (same rule SearchablePicker/MultiSelectPicker apply) — Angular
  // gets this from the per-language `.body2-regular-14` overrides in
  // global.scss. Without it these rows rendered in the system font.
  const langFonts = useLanguageFonts()

  return (
    <Pressable
      onPress={() => onToggle(option.key, !checked)}
      style={[
        styles.row,
        option.parent && styles.rowParent,
        (option.highlighted ?? checked) && (option.parent ? styles.rowParentActive : styles.rowChecked),
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <Text style={[
        styles.label,
        { fontFamily: option.parent ? langFonts.semiBold : langFonts.regular },
      ]}>{option.value}</Text>

      {/* Angular: ion-checkbox slot=end, --checkbox-background-checked #B50033 */}
      <View style={[styles.box, (checked || option.indeterminate) && styles.boxChecked]}>
        {checked && <Text style={styles.tick}>✓</Text>}
        {!checked && option.indeterminate && <Text style={styles.tick}>–</Text>}
      </View>
    </Pressable>
  )
}

// ─── CheckboxGroup ────────────────────────────────────────────────────────────
// Stateless — parent owns the checked state and handles persistence.
// Mirrors Angular CheckboxComponent without localStorage coupling.

export default function CheckboxGroup({ options, onToggle, style }: CheckboxGroupProps) {
  return (
    <View style={style}>
      {options.map(option => (
        <CheckboxItem key={option.key} option={option} onToggle={onToggle} />
      ))}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Angular .height-options: bg white, --padding-start 0, --padding-end 0
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.surface,
    minHeight:       48,
  },
  // Angular .height-options.item-checkbox-checked: background-color #FFF1F5
  rowChecked: {
    backgroundColor: Colors.selectionBg,
  },
  // Angular right-side-panel.component.scss: .filter-heading-bg / -active
  rowParent:       { backgroundColor: '#F0F0F0' },
  rowParentActive: { backgroundColor: 'rgba(181,0,51,0.10)' },
  // Angular ion-label: margin-top 8, margin-bottom 8, margin-left 24
  label: {
    flex:       1,
    fontSize:   14,
    lineHeight: 16,
    color:      Colors.textPrimary,
    marginLeft: 24,
    paddingVertical: 8,
  },
  // Angular ion-checkbox: --checkbox-background-checked #B50033, margin-right 24
  box: {
    width:           22,
    height:          22,
    borderRadius:    4,
    borderWidth:     1.5,
    borderColor:     Colors.inputBorder,
    backgroundColor: Colors.surface,
    marginRight:     24,
    alignItems:      'center',
    justifyContent:  'center',
  },
  boxChecked: {
    backgroundColor: Colors.primaryDark,
    borderColor:     Colors.primaryDark,
  },
  tick: {
    color:      Colors.white,
    fontSize:   14,
    fontWeight: '700',
    lineHeight: 18,
  },
})
