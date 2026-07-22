// Multi-select sibling of DesktopSelectField — same outlined-box/floating-
// label visual language, but the dropdown shows checkboxes and stays open
// across multiple picks; the closed field displays the selected labels
// comma-joined (Figma "Jodii Desktop - Registration" 997-30291: "Own house,
// Other lands" / "Rahu, Chevva").

import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import type { SelectOption } from './DesktopSelectField'

export interface DesktopMultiSelectFieldProps {
  label:        string
  options:      SelectOption[]
  selectedKeys: Set<string>
  onToggle:     (key: string) => void
  placeholder?: string
}

export default function DesktopMultiSelectField({
  label, options, selectedKeys, onToggle, placeholder,
}: DesktopMultiSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const selectedLabels = options.filter(o => selectedKeys.has(o.key)).map(o => o.label)

  return (
    <View style={[s.wrapper, open && s.wrapperOpen]}>
      <Pressable
        style={[s.field, open && s.fieldOpen]}
        onPress={() => setOpen(v => !v)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[s.value, selectedLabels.length === 0 && s.placeholder]} numberOfLines={1}>
          {selectedLabels.length > 0 ? selectedLabels.join(', ') : (placeholder ?? `Select ${label.toLowerCase()}`)}
        </Text>
        <Text style={s.chevron}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>

      {selectedLabels.length > 0 && (
        <View style={s.labelBadge} pointerEvents="none">
          <Text style={s.labelText}>{label}</Text>
        </View>
      )}

      {open && (
        <View style={s.dropdown}>
          <FlatList
            data={options}
            keyExtractor={o => o.key}
            style={{ maxHeight: 220 }}
            showsVerticalScrollIndicator
            renderItem={({ item }) => {
              const isChecked = selectedKeys.has(item.key)
              return (
                <Pressable style={[s.option, isChecked && s.optionSelected]} onPress={() => onToggle(item.key)}>
                  <Text style={[s.optionText, isChecked && s.optionTextSelected]}>{item.label}</Text>
                  <View style={[s.checkbox, isChecked && s.checkboxChecked]}>
                    {isChecked && <Text style={s.checkmark}>✓</Text>}
                  </View>
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
  // See DesktopSelectField.tsx's identical wrapperOpen comment — react-native-
  // web's default `position: relative` on every View means the dropdown's own
  // zIndex alone doesn't out-rank later sibling fields; elevating this whole
  // field's stacking context while open does.
  wrapper: { position: 'relative' },
  wrapperOpen: { zIndex: 100 },

  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 56, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8,
    paddingHorizontal: 16, backgroundColor: Colors.surface,
  },
  fieldOpen: { borderColor: Colors.primaryDark },

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
  optionText: { flex: 1, fontSize: 14, fontWeight: '400', color: Colors.textPrimary, marginRight: 12 },
  optionTextSelected: { fontWeight: '600', color: Colors.primaryDark },

  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxChecked: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryDark },
  checkmark: { color: Colors.white, fontSize: 12, fontWeight: '700' },
})
