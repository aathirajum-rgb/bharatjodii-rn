// Reusable outlined dropdown field for desktop-web onboarding — Figma
// "Jodii Desktop - Registration" (997-27790 etc.): a bordered box with a
// floating label ABOVE the border (shown only once a value is selected,
// matching LocationScreen.tsx's FloatField on mobile), a chevron, and an
// inline options list that drops down below the field on tap.
//
// One reusable widget replaces mobile's many field-specific pickers (wheel
// pickers, pill grids, bottom sheets, side panels) — every desktop
// onboarding field is visually the same closed-option dropdown.

import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'

export interface SelectOption {
  key:   string
  label: string
}

export interface DesktopSelectFieldProps {
  label:        string
  options:      SelectOption[]
  selectedKey:  string | null
  onSelect:     (option: SelectOption) => void
  placeholder?: string
  disabled?:    boolean
  loading?:     boolean
}

const MAX_DROPDOWN_HEIGHT = 220

export default function DesktopSelectField({
  label, options, selectedKey, onSelect, placeholder, disabled, loading,
}: DesktopSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.key === selectedKey) ?? null

  function toggle() {
    if (disabled || loading) return
    setOpen(v => !v)
  }

  function handleSelect(opt: SelectOption) {
    onSelect(opt)
    setOpen(false)
  }

  return (
    <View style={[s.wrapper, open && s.wrapperOpen]}>
      <Pressable
        style={[s.field, open && s.fieldOpen, disabled && s.fieldDisabled]}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[s.value, !selected && s.placeholder]} numberOfLines={1}>
          {selected ? selected.label : (placeholder ?? `Select ${label.toLowerCase()}`)}
        </Text>
        {loading ? (
          <ActivityIndicator size={16} color={Colors.textSecondary} />
        ) : (
          <Text style={s.chevron}>{open ? '⌃' : '⌄'}</Text>
        )}
      </Pressable>

      {/* Floating label — only once a value is selected (matches LocationScreen's FloatField) */}
      {!!selected && (
        <View style={s.labelBadge} pointerEvents="none">
          <Text style={s.labelText}>{label}</Text>
        </View>
      )}

      {open && (
        <View style={s.dropdown}>
          <FlatList
            data={options}
            keyExtractor={o => o.key}
            style={{ maxHeight: MAX_DROPDOWN_HEIGHT }}
            showsVerticalScrollIndicator
            renderItem={({ item }) => {
              const isSelected = item.key === selectedKey
              return (
                <Pressable
                  style={[s.option, isSelected && s.optionSelected]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={[s.optionText, isSelected && s.optionTextSelected]}>{item.label}</Text>
                  {isSelected && <Text style={s.optionTick}>✓</Text>}
                </Pressable>
              )
            }}
          />
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  // wrapperOpen elevates this field's own stacking context above its sibling
  // fields — react-native-web gives every View `position: relative` by
  // default, so the dropdown's own zIndex alone competed only within a
  // stacking context that never actually out-ranked later siblings (e.g. the
  // next field's label, or the DOB row below it), which rendered on top of
  // the open menu instead of behind it.
  wrapper: { position: 'relative' },
  wrapperOpen: { zIndex: 100 },

  field: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    height:          56,
    borderWidth:     1,
    borderColor:     Colors.inputBorder,
    borderRadius:    8,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
  },
  fieldOpen: { borderColor: Colors.primaryDark },
  fieldDisabled: { backgroundColor: Colors.surfaceInput },

  value: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  placeholder: { fontWeight: '400', color: Colors.textSecondary },
  chevron: { fontSize: 16, color: Colors.textSecondary, marginLeft: 8 },

  labelBadge: {
    position: 'absolute', top: -9, left: 12,
    backgroundColor: Colors.surface, paddingHorizontal: 4,
  },
  labelText: { fontSize: 12, fontWeight: '400', color: Colors.textSecondary },

  dropdown: {
    position: 'absolute', top: 60, left: 0, right: 0, zIndex: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.inputBorder,
    borderRadius: 8, overflow: 'hidden',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8,
    elevation: 6,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  optionSelected: { backgroundColor: Colors.selectionBg },
  optionText: { fontSize: 14, fontWeight: '400', color: Colors.textPrimary },
  optionTextSelected: { fontWeight: '600', color: Colors.primaryDark },
  optionTick: { color: Colors.primaryDark, fontWeight: '700' },
})
