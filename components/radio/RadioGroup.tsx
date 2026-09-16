import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Colors } from '../../constants/colors'
import { FontSize } from '../../src/theme/fonts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RadioOption {
  key:    string
  value:  string
  value1?: string | undefined   // subtitle line (list layout only)
}

// 'pill'  = Angular TYPE=type-1: horizontal wrapping pill chips
// 'list'  = Angular TYPE=type-2: full-width vertical list rows
export type RadioLayout = 'pill' | 'list'

export interface RadioGroupProps {
  options:  RadioOption[]
  value:    string                    // selected key (controlled)
  onChange: (key: string, value: string) => void
  layout?:  RadioLayout | undefined   // default: 'pill'
  style?:   ViewStyle   | undefined
}

// ─── Shared: radio indicator ──────────────────────────────────────────────────

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
      {selected && <View style={styles.radioInner} />}
    </View>
  )
}

// ─── Pill item (type-1) ───────────────────────────────────────────────────────

function PillItem({
  option, selected, onPress,
}: { option: RadioOption; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, selected && styles.pillSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      {/* Angular: ion-radio slot=start, mode=md — replicated as filled dot */}
      <RadioDot selected={selected} />
      <Text style={styles.pillLabel} numberOfLines={2}>{option.value}</Text>
    </Pressable>
  )
}

// ─── List item (type-2) ───────────────────────────────────────────────────────

function ListItem({
  option, selected, onPress,
}: { option: RadioOption; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.listRow, selected && styles.listRowSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={styles.listContent}>
        {/* Angular ion-label: body1-medium-14 */}
        <Text style={styles.listLabel}>{option.value}</Text>
        {/* Angular div body2-regular-14: optional subtitle (e.g. height range) */}
        {!!option.value1 && (
          <Text style={styles.listSub}>{option.value1}</Text>
        )}
      </View>
      {/* Angular: ion-radio slot=end */}
      <View style={styles.radioEnd}>
        <RadioDot selected={selected} />
      </View>
    </Pressable>
  )
}

// ─── RadioGroup ───────────────────────────────────────────────────────────────

export default function RadioGroup({
  options,
  value,
  onChange,
  layout = 'pill',
  style,
}: RadioGroupProps) {
  if (layout === 'pill') {
    return (
      <View style={[styles.pillContainer, style]}>
        {options.map(option => (
          <PillItem
            key={option.key}
            option={option}
            selected={value === option.key}
            onPress={() => onChange(option.key, option.value)}
          />
        ))}
      </View>
    )
  }

  return (
    <View style={style}>
      {options.map(option => (
        <ListItem
          key={option.key}
          option={option}
          selected={value === option.key}
          onPress={() => onChange(option.key, option.value)}
        />
      ))}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Pill ──────────────────────────────────────────────────────────────────

  // Angular .radio-options: border-radius 50px, height 40, border 1px #8A8A8A,
  // bg white, margin-right 16, margin-bottom 16, width fit-content
  pillContainer: {
    flexDirection: 'row',
    flexWrap:      'wrap',
  },
  pill: {
    flexDirection:   'row',
    alignItems:      'center',
    minHeight:       40,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     Colors.inputBorder,
    backgroundColor: Colors.surface,
    paddingRight:    16,
    marginRight:     16,
    marginBottom:    16,
  },
  // Angular .radio-options.item-radio-checked: border rgba(181,0,51,0.40), bg rgba(181,0,51,0.02)
  pillSelected: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.radioCheckedBg,
  },
  // Angular ion-label: margin 0 16 0 0, overflow visible
  pillLabel: {
    fontSize:    FontSize.font14,
    lineHeight:  16,
    color:       Colors.textPrimary,
    marginRight: 8,
    flexShrink:  1,
  },

  // ── List ──────────────────────────────────────────────────────────────────

  // Angular .height-options: bg white, padding via --padding-start 0
  listRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.surface,
    minHeight:       52,
  },
  // Angular .height-options.item-radio-checked: bg #FFF1F5
  listRowSelected: {
    backgroundColor: Colors.selectionBg,
  },
  listContent: {
    flex:            1,
    marginLeft:      24,
    paddingVertical: 8,
  },
  // Angular ion-label: body1-medium-14 black-color
  listLabel: {
    fontSize:   FontSize.font14,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  // Angular div: body2-regular-14 (optional subtitle, e.g. height range text)
  listSub: {
    fontSize:  FontSize.font14,
    color:     Colors.textSecondary,
    marginTop: 2,
  },

  // ── Radio dot ─────────────────────────────────────────────────────────────

  radioCircle: {
    width:           20,
    height:          20,
    borderRadius:    10,
    borderWidth:     2,
    borderColor:     Colors.inputBorder,
    alignItems:      'center',
    justifyContent:  'center',
    marginHorizontal: 8,
  },
  radioCircleSelected: {
    borderColor: Colors.primaryDark,
  },
  radioInner: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: Colors.primaryDark,
  },
  radioEnd: {
    marginRight: 16,
    marginLeft:   0,
  },
})
