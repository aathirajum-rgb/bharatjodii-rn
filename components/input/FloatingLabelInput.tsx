import { useRef, useState } from 'react'
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native'
import { Colors } from '../../constants/colors'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputVariant = 'text' | 'name' | 'age' | 'email' | 'phone' | 'password'

export interface FloatingLabelInputProps
  extends Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'secureTextEntry'> {
  label: string
  value: string
  onChangeText: (text: string) => void
  errorMessage?: string | undefined
  variant?: InputVariant | undefined
}

// ─── Emoji regex — same filter as Angular alphabetOnly() ─────────────────────
const EMOJI_RE =
  /(?:[✀-➿]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[#-9]️?⃣|㊙|㊗|〽|〰|Ⓜ|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|🆎|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|🈚|🈯|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|‼|⁉|[▪-▫]|▶|◀|[◻-◾]|©|®|™|ℹ|🀄|[☀-⛿]|⬅|⬆|⬇|⬛|⬜|⭐|⭕|⌚|⌛|⌨|⏏|[⏩-⏳]|[⏸-⏺]|🃏|⤴|⤵|[←-⇿])/g

// ─── Validation helpers (exported for use in forms) ───────────────────────────

export function validateName(value: string): string | undefined {
  if (!value.trim()) return 'Name is required'
  if (value.trim().length < 2) return 'Minimum 2 characters'
  if (/[`~!@#$%^&*()_+={}|[\]\\:';"<>?,.0-9/]/.test(value)) return 'No special characters or numbers'
  return undefined
}

export function validateAge(value: string): string | undefined {
  if (!value) return 'Age is required'
  const n = Number(value)
  if (isNaN(n) || n < 18 || n > 80) return 'Enter a valid age (18–80)'
  return undefined
}

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email'
  return undefined
}

export function validatePhone(value: string): string | undefined {
  if (!value.trim()) return 'Phone number is required'
  if (value.replace(/\D/g, '').length < 6) return 'Enter a valid phone number'
  return undefined
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INPUT_HEIGHT = 52

// Removes the browser's default focus ring and border on web — TextInput
// renders as <input> on web which gets a blue outline on focus.
const webInputReset = {
  outlineStyle: 'none',
  outlineWidth: 0,
  borderWidth: 0,
} as any

// ─── Component ────────────────────────────────────────────────────────────────

export default function FloatingLabelInput({
  label,
  value,
  onChangeText,
  errorMessage,
  variant = 'text',
  style,
  onFocus,
  onBlur,
  ...rest
}: FloatingLabelInputProps) {
  const [isFocused, setIsFocused]       = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // 0 = resting inside input, 1 = floating above border
  const anim = useRef(new Animated.Value(value.length > 0 ? 1 : 0)).current

  function floatUp() {
    Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: false }).start()
  }
  function floatDown() {
    Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: false }).start()
  }

  function handleFocus(e: any) {
    setIsFocused(true)
    floatUp()
    onFocus?.(e)
  }
  function handleBlur(e: any) {
    setIsFocused(false)
    if (!value) floatDown()
    onBlur?.(e)
  }

  function handleChange(text: string) {
    let out = text
    if (variant === 'name')  out = text.replace(EMOJI_RE, '')
    if (variant === 'age')   out = text.replace(/\D/g, '').slice(0, 3)
    if (variant === 'phone') out = text.replace(/[^\d+\s-]/g, '')
    onChangeText(out)
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const borderColor = errorMessage ? Colors.inputError : isFocused ? Colors.inputFocus : Colors.inputBorder

  const labelTop = anim.interpolate({ inputRange: [0, 1], outputRange: [INPUT_HEIGHT / 2 - 10, -9] })
  const labelSize = anim.interpolate({ inputRange: [0, 1], outputRange: [14, 11] })
  const labelColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      Colors.inputBorder,
      errorMessage ? Colors.inputError : isFocused ? Colors.inputFocus : Colors.inputBorder,
    ],
  })

  const keyboardType =
    variant === 'age'   ? 'number-pad'    :
    variant === 'phone' ? 'phone-pad'     :
    variant === 'email' ? 'email-address' : 'default'

  return (
    <View style={[styles.wrapper, style as any]}>
      {/* Outlined container */}
      <View style={[styles.container, { borderColor }]}>

        {/* Floating label — sits inside when resting, rides above border when floating */}
        <Animated.Text
          style={[styles.label, { top: labelTop, fontSize: labelSize, color: labelColor }]}
          pointerEvents="none"
        >
          {label}
        </Animated.Text>

        <TextInput
          style={[styles.input, webInputReset]}
          value={value}
          onChangeText={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          keyboardType={keyboardType}
          secureTextEntry={variant === 'password' && !showPassword}
          autoCapitalize={variant === 'email' ? 'none' : variant === 'name' ? 'words' : 'none'}
          autoCorrect={false}
          autoComplete="off"
          {...rest}
        />

        {/* Password eye toggle */}
        {variant === 'password' && (
          <Pressable style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)} hitSlop={8}>
            <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}
      </View>

      {/* Error message */}
      {!!errorMessage && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
  },
  container: {
    height: INPUT_HEIGHT,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    overflow: 'visible',
  },
  label: {
    position: 'absolute',
    left: 12,
    backgroundColor: Colors.white,
    paddingHorizontal: 4,
    zIndex: 10,
    // font size + color are Animated (set inline)
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 0,
    textAlignVertical: 'center',  // Android
    alignSelf: 'center',          // web / iOS
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  eyeText: {
    fontSize: 12,
    color: Colors.inputFocus,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 4,
    marginLeft: 4,
    fontSize: 12,
    color: Colors.inputError,
  },
})
