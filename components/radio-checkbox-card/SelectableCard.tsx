import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Colors } from '../../constants/colors'
import { FontSize } from '../../src/theme/fonts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SelectableCardProps {
  label:     string
  type?:     'radio' | 'checkbox' | undefined
  selected?: boolean | undefined
  onPress?:  (() => void) | undefined
  style?:    ViewStyle   | undefined
}

// ─── SelectableCard ───────────────────────────────────────────────────────────
// Mirrors Angular radio-checkbox-card.component — a bordered card with a label
// and either a radio or checkbox indicator at the end.
// State (selected) is fully controlled by the parent.

export default function SelectableCard({
  label,
  type     = 'radio',
  selected = false,
  onPress,
  style,
}: SelectableCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && { opacity: 0.85 },
        style,
      ]}
      accessibilityRole={type === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={type === 'radio' ? { selected } : { checked: selected }}
    >
      {/* Angular ion-label: body1-medium-14 black-color, flex: 1 */}
      <Text style={styles.label}>{label}</Text>

      {type === 'radio' ? (
        // Angular: ion-radio slot=end, class=gender-radio-btn (top-right positioned)
        <View style={[styles.radioCircle, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioInner} />}
        </View>
      ) : (
        // Angular: ion-checkbox slot=end, --checkbox-background-checked #B50033
        <View style={[styles.checkBox, selected && styles.checkBoxSelected]}>
          {selected && <Text style={styles.checkMark}>✓</Text>}
        </View>
      )}
    </Pressable>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Angular .radio-card / .checkbox-card: border 1px #8A8A8A, borderRadius 8, bg white,
  // --padding-start 16px, width 100%
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    width:           '100%',
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     Colors.inputBorder,
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingLeft:     16,
    paddingRight:    16,
    marginBottom:    8,
  },
  // Angular .item-radio-checked / .item-checkbox-checked:
  // border rgba(181,0,51,0.40), bg rgba(181,0,51,0.02)
  cardSelected: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.radioCheckedBg,
  },
  label: {
    flex:       1,
    fontSize:   FontSize.font14,
    fontWeight: '500',
    color:      Colors.textPrimary,
    paddingRight: 8,
  },
  radioCircle: {
    width:           20,
    height:          20,
    borderRadius:    10,
    borderWidth:     2,
    borderColor:     Colors.inputBorder,
    alignItems:      'center',
    justifyContent:  'center',
  },
  radioSelected: {
    borderColor: Colors.primaryDark,
  },
  radioInner: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: Colors.primaryDark,
  },
  checkBox: {
    width:           22,
    height:          22,
    borderRadius:    4,
    borderWidth:     1.5,
    borderColor:     Colors.inputBorder,
    backgroundColor: Colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
  },
  checkBoxSelected: {
    backgroundColor: Colors.primaryDark,
    borderColor:     Colors.primaryDark,
  },
  checkMark: {
    color:      Colors.white,
    fontSize:   FontSize.font13,
    fontWeight: '700',
    lineHeight: 16,
  },
})
