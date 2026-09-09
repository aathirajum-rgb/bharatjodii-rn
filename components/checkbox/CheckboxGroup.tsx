import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
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
  // Optional leading icon (a full CDN URI). Only the quick-filter rows use one;
  // every other group — locations, heights, castes — is text-only, so the row
  // keeps its plain layout when this is absent rather than reserving a gutter.
  icon?: string | undefined
}

export interface CheckboxGroupProps {
  options:  CheckboxOption[]
  onToggle: (key: string, checked: boolean) => void
  style?:   ViewStyle | undefined
  // Angular's filter-PAGE variant, `.filter-more-item` inside a
  // `<ion-list class="pr-24 pl-24">`: the row box is inset 24px (so its divider
  // is too), carries a bottom border, and is tighter vertically — 10px padding
  // rather than the panel variant's 48px minimum. The label/checkbox drop their
  // own insets, since the row now supplies them.
  // Off by default, so the picker panels and payment options are unaffected.
  inset?:   boolean | undefined
}

// ─── CheckboxItem ─────────────────────────────────────────────────────────────

function CheckboxItem({
  option,
  onToggle,
  inset,
}: {
  option:   CheckboxOption
  onToggle: (key: string, checked: boolean) => void
  inset?:   boolean | undefined
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
        inset && styles.rowInset,
        option.parent && styles.rowParent,
        (option.highlighted ?? checked) && (option.parent ? styles.rowParentActive : styles.rowChecked),
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      {option.icon && (
        <CdnSvg uri={option.icon} width={20} height={20} style={inset ? undefined : styles.icon} />
      )}

      <Text style={[
        styles.label,
        // The icon already sits at the row's 24px inset, so the label follows it
        // with a plain gap instead of repeating that inset.
        option.icon ? styles.labelWithIcon : null,
        inset && !option.icon ? styles.labelNoInset : null,
        { fontFamily: option.parent ? langFonts.semiBold : langFonts.regular },
      ]}>{option.value}</Text>

      {/* Angular: ion-checkbox slot=end, --checkbox-background-checked #B50033 */}
      <View style={[styles.box, inset && styles.boxInset, (checked || option.indeterminate) && styles.boxChecked]}>
        {checked && <Text style={styles.tick}>✓</Text>}
        {!checked && option.indeterminate && <Text style={styles.tick}>–</Text>}
      </View>
    </Pressable>
  )
}

// ─── CheckboxGroup ────────────────────────────────────────────────────────────
// Stateless — parent owns the checked state and handles persistence.
// Mirrors Angular CheckboxComponent without localStorage coupling.

export default function CheckboxGroup({ options, onToggle, style, inset }: CheckboxGroupProps) {
  return (
    <View style={style}>
      {options.map(option => (
        <CheckboxItem key={option.key} option={option} onToggle={onToggle} inset={inset} />
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
  // Angular `.filter-more-item` in a `pr-24 pl-24` list — 10px vertical padding
  // and a bottom border, the box inset 24 so the border is inset with it.
  rowInset: {
    marginHorizontal:  24,
    minHeight:         0,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(204,204,204,0.5)',
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
  icon: {
    marginLeft: 24,
  },
  labelWithIcon: {
    marginLeft: 12,
  },
  // The inset row's own margin already supplies the page gutter.
  labelNoInset: { marginLeft: 0 },
  boxInset:     { marginRight: 0 },
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
