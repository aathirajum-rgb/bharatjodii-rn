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
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { CDN_SVG } from '../../constants/cdn'
import CdnSvg from '../cdn-svg/CdnSvg'

const CLEAR_ICON = CDN_SVG + 'revamp/close-icon.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputVariant = 'text' | 'name' | 'age' | 'email' | 'phone' | 'password' | 'id'

export interface FloatingLabelInputProps
  extends Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'secureTextEntry'> {
  label: string
  value: string
  onChangeText: (text: string) => void
  errorMessage?: string | undefined
  variant?: InputVariant | undefined
  // Angular renders some inputs as a bare ion-item, which is a bottom-LINE
  // field rather than this component's default rounded box (e.g. the UPI
  // address field inside .input-field-line-upi, global.scss:5852). The `style`
  // prop can't express that — it lands on the outer wrapper, not the bordered
  // container — so the shape is selected here instead.
  //
  // 'card' is the pay-using-credit-debit variant (.input-fields-style-card +
  // .item-border-normal): the label is a plain PLACEHOLDER that disappears on
  // typing — it never floats into the border. Once the field has a value a
  // separate small grey caption (.input-fields-text-absolute) appears above
  // the box instead. Border states differ too — see cardBorderColor below.
  shape?: 'box' | 'underline' | 'card' | undefined
  // Angular renders a decorative SVG inside some fields, absolutely positioned
  // at the right edge (.edit-icon-id-verification, pay-using-credit-debit
  // .page.scss:48-53) — e.g. the card-type glyph on "Card number" and the
  // little card-with-123 on "CVV". Pass the CDN uri to show one.
  trailingIcon?: string | undefined
  // shape="card" only. Angular binds .border-danger to the control's `invalid`
  // state directly ([ngClass]="{'border-danger': f.debit.invalid}"), NOT to a
  // touched/blurred error — so a required-but-empty field shows the red border
  // from first paint. `errorMessage` stays separate: it drives the message
  // text below the field, which Angular gates on `value.length > 0`.
  invalid?: boolean | undefined
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
  shape = 'box',
  trailingIcon,
  invalid,
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
    if (variant === 'id')    out = text.replace(/\D/g, '').slice(0, 12)
    onChangeText(out)
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  // Angular: an underline field is a bare ion-item, so its line is Ionic's
  // default item border (#c8c7cc) rather than this component's darker #B0B0B0
  // box outline, and .input-field-line-upi (global.scss:5852-5857) sets
  // --highlight-color-focused to the pink #DE2A68, not the box variant's blue.
  // Angular (pay-using-credit-debit.page.scss): three card states, in the
  // priority CSS specificity gives them —
  //   .item-has-focus   → border: 2px solid #BD8800 !important  (gold)
  //   .border-danger    → border-color: #ef4444 !important      (red)
  //   .item-border-normal → border: 1px solid #777777           (grey)
  // Focus wins over danger because it also sets border-width, and both carry
  // !important with .item-has-focus declared later in the file.
  const cardBorderColor = isFocused ? '#BD8800' : invalid ? '#ef4444' : '#777777'

  const borderColor =
    shape === 'card'
      ? cardBorderColor
      : errorMessage
        ? Colors.inputError
        : shape === 'underline'
          ? (isFocused ? '#DE2A68' : '#c8c7cc')
          : (isFocused ? Colors.inputFocus : Colors.inputBorder)

  const labelTop = anim.interpolate({ inputRange: [0, 1], outputRange: [INPUT_HEIGHT / 2 - 10, -9] })
  // The underline variant's resting label matches its larger input text (16px
  // vs the box variant's 14) so the placeholder reads at Angular's size.
  const labelSize = anim.interpolate({
    inputRange: [0, 1],
    outputRange: shape === 'underline' ? [16, 11] : [14, 11],
  })
  const labelColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      Colors.inputBorder,
      errorMessage ? Colors.inputError : isFocused ? Colors.inputFocus : Colors.inputBorder,
    ],
  })

  // Angular renders each glyph at its intrinsic size. The two used on the card
  // page have different aspect ratios (card number 36x21, CVV 40x29), so they
  // are scaled to a common 20px height rather than forced into one fixed box.
  const trailingIconSize = trailingIcon?.includes('enter-cvv-img')
    ? { width: 28, height: 20 }   // 40x29 -> 20px tall
    : { width: 34, height: 20 }   // 36x21 -> 20px tall

  const keyboardType =
    variant === 'age'   ? 'number-pad'    :
    variant === 'id'    ? 'number-pad'    :
    variant === 'phone' ? 'phone-pad'     :
    variant === 'email' ? 'email-address' : 'default'

  return (
    <View style={[styles.wrapper, style as any]}>
      {/* Outlined container */}
      <View
        style={[
          styles.container,
          shape === 'underline' && styles.containerUnderline,
          shape === 'card' && styles.containerCard,
          { borderColor },
          // .item-has-focus sets border-WIDTH to 2px as well as the color, so
          // the gold outline reads noticeably heavier than the resting grey.
          shape === 'card' && isFocused && styles.containerCardFocused,
        ]}
      >

        {/* Angular's card fields use a plain `placeholder`, never a floating
            label — on typing it simply disappears and the small grey caption
            below takes over. Only the box/underline shapes float. */}
        {shape !== 'card' && (
          <Animated.Text
            style={[styles.label, shape === 'underline' && styles.labelUnderline, { top: labelTop, fontSize: labelSize, color: labelColor }]}
            pointerEvents="none"
          >
            {label}
          </Animated.Text>
        )}

        {/* Angular: .input-fields-text-absolute — top:-10 left:12, white
            background punching through the border, #b3b3b3 at body3-regular-12.
            Rendered only once the field has a value (*ngIf="value.length > 0"). */}
        {shape === 'card' && value.length > 0 && (
          <Text style={styles.captionCard} pointerEvents="none" numberOfLines={1}>
            {label}
          </Text>
        )}

        <TextInput
          style={[styles.input, shape === 'underline' && styles.inputUnderline, shape === 'card' && styles.inputCard, webInputReset]}
          placeholder={shape === 'card' ? label : undefined}
          placeholderTextColor={shape === 'card' ? '#b3b3b3' : undefined}
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
        {/* Angular: .edit-icon-id-verification — an absolutely-positioned
            decorative glyph at the field's right edge. flexShrink:0 matters
            because the CVV field is narrow (ion-col 5.1) and the TextInput's
            flex:1 would otherwise squeeze this to zero width, which is why the
            CVV glyph rendered as nothing. Each icon keeps its own intrinsic
            aspect ratio — the card glyph is 36x21, the CVV one 40x29 — so a
            single hardcoded size distorted one of them. */}
        {!!trailingIcon && variant !== 'password' && (
          <View style={styles.trailingIconWrap}>
            <CdnSvg
              uri={trailingIcon}
              width={trailingIconSize.width}
              height={trailingIconSize.height}
            />
          </View>
        )}

        {variant === 'password' && (
          <Pressable style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)} hitSlop={8}>
            <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}

        {/* Clear button — Angular: search.page.ts closeSearchById(), shown inside
            the searchbar to reset the ID field in one tap. */}
        {variant === 'id' && value.length > 0 && (
          <Pressable style={styles.clearBtn} onPress={() => onChangeText('')} hitSlop={8}>
            <CdnSvg uri={CLEAR_ICON} width={14} height={14} />
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
  // Ionic's default ion-item: a single bottom line, square. The text is not
  // flush with the line's left edge — ion-item supplies its own inner padding
  // (--padding-start / --inner-padding-end), so the value/placeholder sits
  // indented from it.
  // Angular: the UPI field is <ion-item class="select-width ps-pe-0">, where
  // .ps-pe-0 (global.scss:6754) zeroes --padding-start/end so the LINE runs
  // the full width, while .select-width (global.scss:2802-2808) sets
  // --inner-padding-start: 10px so only the TEXT is indented. A
  // paddingHorizontal here would shorten the line itself, so the indent is
  // applied to the text via inputUnderline/labelUnderline instead.
  // ADJUSTABLE — `height` is the field's height (the gap between the text and
  // the line below it); `marginRight` shortens the line from the right edge.
  containerUnderline: {
    borderWidth: 0,
    borderBottomWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 0,
    height: 48,
    marginRight: 12,
  },
  // Angular: the ion-input inherits the body font at the rem-scaled base size
  // (~16-17px at 412px wide), noticeably larger than the box variant's 14px,
  // and .select-width's --inner-padding-start indents the text by 10px.
  inputUnderline: {
    fontSize: 16,
    paddingLeft: 10,
  },
  // Matches .select-width's --inner-padding-start: 10px so the resting
  // placeholder lines up with the typed value; the box variant keeps its 12.
  labelUnderline: {
    left: 10,
    paddingHorizontal: 0,
  },

  // Angular: .input-fields-style-card ion-item — border-radius 4px,
  // --inner-padding-start: 8px, --inner-padding-end: 12px; the border itself
  // is .item-border-normal's 1px (color supplied inline by borderColor).
  // ADJUSTABLE — paddingLeft is the gap before the text inside the box.
  containerCard: {
    borderRadius: 4,
    paddingLeft: 16,
    paddingRight: 12,
  },
  // Angular: .item-has-focus { border: 2px solid #BD8800 !important } — the
  // extra 1px is absorbed by the padding so the field doesn't jump on focus.
  containerCardFocused: {
    borderWidth: 2,
    paddingLeft: 15,
    paddingRight: 11,
  },
  // Keeps the decorative glyph at its own width instead of letting the
  // TextInput's flex:1 collapse it — the failure mode on the narrow CVV field.
  trailingIconWrap: {
    flexShrink: 0,
    marginLeft: 4,
  },
  // Angular: .body1-medium-14 .clr0 .f-600 — Poppins-Medium at --font14
  // (~15px once the rem root scale is applied), black, weight bumped to 600.
  inputCard: {
    fontFamily: Fonts.poppinsMedium,
    fontWeight: '400',
    fontSize: 15,
    color: Colors.black,
  },
  // Angular: .input-fields-text-absolute .color-b3b3b3 .body3-regular-12 —
  // top:-10 left:12 over a white background, padding 10px 5px 0 5px. The
  // white background is what makes it punch a gap through the border.
  captionCard: {
    position: 'absolute',
    top: -9,
    // Angular: .input-fields-text-absolute's left:12 minus the 5px of its own
    // horizontal padding, so the caption's TEXT lines up with the value's
    // 16px indent rather than sitting left of it.
    left: 11,
    zIndex: 99,
    backgroundColor: Colors.white,
    paddingHorizontal: 5,
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize: 12,
    color: '#b3b3b3',
    letterSpacing: 0.03,
  },
  // Angular's body font is Poppins-Regular (global.scss:329 sets
  // --english-regular-poppins on body). Neither the label nor the input
  // declared a fontFamily here, so both fell back to the platform system
  // font — the same gap that was fixed in LinkCTA.
  label: {
    position: 'absolute',
    left: 12,
    backgroundColor: Colors.white,
    paddingHorizontal: 4,
    zIndex: 10,
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    // font size + color are Animated (set inline)
  },
  input: {
    flex: 1,
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 0,
    textAlignVertical: 'center',  // Android
    alignSelf: 'center',          // web / iOS
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  clearBtn: {
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
