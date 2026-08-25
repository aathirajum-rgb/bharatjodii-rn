import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// A read-only, tap-to-open counterpart to FloatingLabelInput — same visual
// language (bordered box, label riding above the border) but the box is a
// button that opens a picker rather than a text field. Used by the Edit
// Profile group screens (Religious details, Professional details, etc.) to
// match the new Figma design (node 4389-1000 / 2357-3964).

const FIELD_HEIGHT = 48

export interface SelectFieldProps {
  label: string
  value?: string | undefined
  placeholder?: string | undefined
  onPress: () => void
  // One-time-edit-lock rows (Angular: NAMEEDIT/CASTEEDIT/etc.) stay tappable —
  // tapping shows a "contact support" message instead of opening a picker —
  // but read visually muted so the lock is obvious before the tap.
  locked?: boolean | undefined
}

export default function SelectField({ label, value, placeholder, onPress, locked }: SelectFieldProps) {
  // Labels/values here are server-translated, so the family must follow the
  // active language (Poppins for English, the matching NotoSans script otherwise).
  const langFonts = useLanguageFonts()
  return (
    <Pressable style={[styles.container, locked && styles.containerLocked]} onPress={onPress} accessibilityRole="button">
      <View style={styles.labelWrap}>
        <Text style={[styles.label, { fontFamily: langFonts.regular }]}>{label}</Text>
      </View>
      <Text style={[styles.value, !value && styles.placeholder, locked && styles.valueLocked, { fontFamily: value ? langFonts.medium : langFonts.regular }]} numberOfLines={1}>
        {value || placeholder || ''}
      </Text>
      <Text style={[styles.arrow, locked && styles.valueLocked]}>{'›'}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    height: FIELD_HEIGHT,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  labelWrap: {
    position: 'absolute',
    left: 12,
    top: -9,
    backgroundColor: Colors.white,
    paddingHorizontal: 4,
    zIndex: 10,
  },
  label: { fontSize: 11, color: Colors.inputBorder },
  value: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  placeholder: { fontWeight: '400', color: Colors.textPlaceholder },
  arrow: { fontSize: 22, color: Colors.textPrimary, lineHeight: 26 },
  containerLocked: { backgroundColor: Colors.surfaceDim },
  valueLocked: { color: Colors.textTertiary },
})
