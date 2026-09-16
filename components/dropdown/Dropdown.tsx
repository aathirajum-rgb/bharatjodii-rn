import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Colors } from '../../constants/colors'
import { FontSize } from '../../src/theme/fonts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DropdownOption {
  key:   string
  value: string
}

export interface DropdownProps {
  label:              string
  options:            DropdownOption[]
  value?:             string  | undefined
  onSelect:           (key: string, value: string) => void
  showFloatingLabel?: boolean | undefined
  style?:             ViewStyle | undefined
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────
// Mirrors Angular dropdown.component — trigger button with floating label, inline
// scrollable options list that expands below. Closing on outside-tap is left to
// the screen layer (wrap in a Pressable overlay at screen level if needed).

export default function Dropdown({
  label,
  options,
  value,
  onSelect,
  showFloatingLabel = true,
  style,
}: DropdownProps) {
  const [open, setOpen] = useState(false)

  const hasValue = value !== undefined && value !== ''

  const selectedOption = options.find(o => o.key === value)

  const handleSelect = useCallback((opt: DropdownOption) => {
    onSelect(opt.key, opt.value)
    setOpen(false)
  }, [onSelect])

  return (
    <View style={[styles.wrapper, style]}>
      {/* Angular .floating-dob: absolute, top -8px, left 2vh, bg white, padding 0 4px */}
      {hasValue && showFloatingLabel && (
        <Text style={styles.floatingLabel} numberOfLines={1}>{label}</Text>
      )}

      {/* Trigger */}
      <Pressable
        onPress={() => setOpen(v => !v)}
        style={[styles.trigger, open && styles.triggerOpen]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text
          style={[styles.triggerText, !hasValue && styles.triggerPlaceholder]}
          numberOfLines={1}
        >
          {selectedOption?.value ?? label}
        </Text>

        {/* Angular: up-arrow / down-arrow img toggle */}
        <Text style={styles.arrow}>{open ? '▲' : '▼'}</Text>
      </Pressable>

      {/* Options list — inline expansion (avoids ScrollView clipping vs absolute) */}
      {open && (
        <ScrollView
          style={styles.optionsList}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {options.map((opt, idx) => (
            <Pressable
              key={opt.key}
              onPress={() => handleSelect(opt)}
              style={({ pressed }) => [
                styles.option,
                idx === 0 && styles.optionFirst,
                opt.key === value && styles.optionSelected,
                pressed && { backgroundColor: Colors.divider },
              ]}
            >
              {/* Angular span.body2-regular-14 */}
              <Text style={[styles.optionText, opt.key === value && styles.optionTextSelected]}>
                {opt.value}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // marginTop creates space above the trigger for the floating label
  wrapper: {
    marginTop: 8,
  },
  // Angular .floating-dob: position absolute, top -8px, left 2vh, z-index 99
  floatingLabel: {
    position:          'absolute',
    top:               -10,
    left:              12,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
    zIndex:            10,
    fontSize:          FontSize.font12,
    lineHeight:        16,
    color:             Colors.textPrimary,
  },
  // Angular .selected-btn: border 1px #B0B0B0, borderRadius 8, padding 12 2vh
  trigger: {
    flexDirection:     'row',
    alignItems:        'center',
    borderWidth:       1,
    borderColor:       Colors.inputBorder,
    borderRadius:      8,
    paddingHorizontal: 16,
    paddingVertical:   14,
    backgroundColor:   Colors.surface,
  },
  // Flatten bottom corners when list is open to merge visually with options
  triggerOpen: {
    borderBottomLeftRadius:  0,
    borderBottomRightRadius: 0,
  },
  triggerText: {
    flex:       1,
    fontSize:   FontSize.font14,
    fontWeight: '500',
    color:      Colors.textDark,
  },
  triggerPlaceholder: {
    color:      Colors.textPlaceholder,
    fontWeight: '400',
  },
  arrow: {
    fontSize:   FontSize.font10,
    color:      Colors.textTertiary,
    marginLeft: 8,
  },
  // Angular .select-option: border 1px #B0B0B0, no top border, max-height 70vw,
  // borderRadius 8 on bottom corners only
  optionsList: {
    borderWidth:             1,
    borderColor:             Colors.inputBorder,
    borderTopWidth:          0,
    borderBottomLeftRadius:  8,
    borderBottomRightRadius: 8,
    backgroundColor:         Colors.surface,
    maxHeight:               240,
  },
  // Angular .opt-select: margin 0 16, padding-top/bottom 12, border-bottom 1px #e6e6e6
  option: {
    marginHorizontal:  16,
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  // Angular .opt-select:first-child: border-top 1px #e6e6e6
  optionFirst: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  optionSelected: {
    backgroundColor: Colors.chipSurfaceSelected,
  },
  optionText: {
    fontSize: FontSize.font14,
    color:    Colors.textDark,
  },
  optionTextSelected: {
    fontWeight: '600',
    color:      Colors.primaryDark,
  },
})
