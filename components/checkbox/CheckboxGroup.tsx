import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Colors } from '../../constants/colors'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckboxOption {
  key:      string
  value:    string
  checked?: boolean | undefined
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

  return (
    <Pressable
      onPress={() => onToggle(option.key, !checked)}
      style={[styles.row, checked && styles.rowChecked]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <Text style={styles.label}>{option.value}</Text>

      {/* Angular: ion-checkbox slot=end, --checkbox-background-checked #B50033 */}
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Text style={styles.tick}>✓</Text>}
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
