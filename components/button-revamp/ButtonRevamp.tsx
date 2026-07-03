import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import { SvgUri } from 'react-native-svg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'

// ─── Types ────────────────────────────────────────────────────────────────────

// Maps to Angular's EButtonBackground + EButtonBorder + EButtonTextColor combination.
// Each variant is a named preset so callers don't juggle 3 separate props.
export type BtnVariant =
  | 'primary'      // primaryBg + noBorder + whiteColor
  | 'secondary'    // whiteBg + primaryBorder + primaryDeepColor (outlined brand)
  | 'ghost'        // whiteBg + greyBorder + blackColor (neutral outlined)
  | 'clear'        // transparent + noBorder + blackColor (fill="clear" Ionic equiv)
  | 'link'         // transparent + noBorder + linkColor (linkSmall style)
  | 'callwhatsapp' // whiteBg + greyBorder + blackColor + pill radius (callwhatsapp size)

// Maps to Angular's EButtonSize — drives height, padding, fontSize, borderRadius.
export type BtnSize = 'standard' | 'large' | 'medium' | 'small' | 'callwhatsapp'

export interface ButtonRevampProps {
  label:         string
  variant?:      BtnVariant | undefined
  size?:         BtnSize    | undefined
  icon?:         string     | undefined   // key from ICON_URLS below
  iconPosition?: 'start' | 'end' | undefined
  fullWidth?:    boolean     | undefined
  disabled?:     boolean     | undefined
  loading?:      boolean     | undefined
  onPress?:      (() => void) | undefined
  style?:        StyleProp<ViewStyle> | undefined
}

// ─── Icon CDN map ─────────────────────────────────────────────────────────────
// Mirrors Angular button-revamp.component.scss $IconURLs map exactly.

const CDN = CDN_SVG

export const ICON_URLS: Record<string, string> = {
  'like-img':             CDN + 'revamp/like-white-revamp.svg',
  'liked-img':            CDN + 'vp-liked-white.svg',
  'call-img':             CDN + 'revamp/call-icon.svg',
  'call-img-white':       CDN + 'revamp/call-icon-white.svg',
  'call-icon-pink':       CDN + 'revamp/call-icon-pink.svg',
  'call-blue':            CDN + 'revamp/call-blue.svg',
  'whatsapp-img':         CDN + 'revamp/whatsapp-revamp.svg',
  'whatsapp-white-img':   CDN + 'revamp/white-whatsapp.svg',
  'message-primary-img':  CDN + 'message-intermediate-img-vp.svg',
  'dont-show-img':        CDN + 'revamp/close-icon.svg',
  'tick-img':             CDN + 'tick-white.svg',
  'forward-icon-link':    CDN + 'revamp/forward-icon-link.svg',
  'forward-icon-white':   CDN + 'revamp/white-forward-icon.svg',
  'forward-icon-pink':    CDN + 'revamp/forward-icon-pink.svg',
  'forward-icon-grey':    CDN + 'revamp/forward-icon-grey.svg',
  'forward-icon-green':   CDN + 'revamp/forward-icon-green.svg',
  'right-arrow':          CDN + 'revamp/arrow-right-white.svg',
  'forward-bold-icon-white': CDN + 'revamp/forward-bold-icon-white.svg',
  'crown-white':          CDN + 'revamp/crown-white.svg',
  'shortlist-white':      CDN + 'shortlist/shortlist-white.svg',
  'shortlisted-white':    CDN + 'shortlist/shortlisted-white-updated.svg',
  'mic-pink':             CDN + 'revamp/mic-pink.svg',
  'mic-grey':             CDN + 'registration-new/mic-grey.svg',
  'button-skip':          CDN + 'next-icon.svg',
  'paid-membership':      CDN + 'get-paid-membership.svg',
  'view-later':           CDN + 'view-later.svg',
  'icon-gallery-pink':    CDN + 'icon-gallery-pink.svg',
  'icon-phone-pink':      CDN + 'icon-phone-pink.svg',
}

// ─── Variant → visual tokens ──────────────────────────────────────────────────
// bg / textColor match Angular's EButtonBackground / EButtonTextColor CSS vars.

type VariantTokens = {
  bg:          string
  textColor:   string
  borderColor: string | undefined
  borderWidth: number
}

const VARIANT_TOKENS: Record<BtnVariant, VariantTokens> = {
  primary: {
    bg: Colors.primary, textColor: Colors.white,
    borderColor: undefined, borderWidth: 0,
  },
  secondary: {
    bg: Colors.white, textColor: Colors.primaryDeep,
    borderColor: Colors.primaryDark, borderWidth: 1,
  },
  ghost: {
    bg: Colors.white, textColor: Colors.textPrimary,
    borderColor: Colors.inputBorder, borderWidth: 1,
  },
  clear: {
    bg: 'transparent', textColor: Colors.textPrimary,
    borderColor: undefined, borderWidth: 0,
  },
  link: {
    bg: 'transparent', textColor: Colors.link,
    borderColor: undefined, borderWidth: 0,
  },
  callwhatsapp: {
    bg: Colors.white, textColor: Colors.textPrimary,
    borderColor: Colors.borderLight, borderWidth: 1,
  },
}

// ─── Size → layout tokens ─────────────────────────────────────────────────────
// Matches Angular EButtonSize SCSS: height, borderRadius, padding, typography.

type SizeTokens = {
  height:     number | undefined
  paddingH:   number
  radius:     number
  fontSize:   number
  fontWeight: '400' | '500' | '600' | '700'
}

const SIZE_TOKENS: Record<BtnSize, SizeTokens> = {
  // standard: height 44, borderRadius 8 — primary form CTAs
  standard: { height: 44, paddingH: 16, radius: 8,  fontSize: 14, fontWeight: '500' },
  // large: height 40, borderRadius 8 — most action buttons
  large:    { height: 40, paddingH: 16, radius: 8,  fontSize: 14, fontWeight: '500' },
  // medium: height 32, borderRadius 94 (pill) — compact CTAs
  medium:   { height: 32, paddingH: 12, radius: 94, fontSize: 12, fontWeight: '400' },
  // small: height 24, borderRadius 30 — tags / badges
  small:    { height: 24, paddingH: 10, radius: 30, fontSize: 12, fontWeight: '400' },
  // callwhatsapp: height 40, borderRadius 30 — pill-shaped contact buttons
  callwhatsapp: { height: 40, paddingH: 16, radius: 30, fontSize: 14, fontWeight: '500' },
}

// ─── ButtonRevamp ─────────────────────────────────────────────────────────────

export default function ButtonRevamp({
  label,
  variant      = 'primary',
  size         = 'large',
  icon,
  iconPosition = 'start',
  fullWidth    = false,
  disabled     = false,
  loading      = false,
  onPress,
  style,
}: ButtonRevampProps) {
  const vt = VARIANT_TOKENS[variant]
  const st = SIZE_TOKENS[size]
  const iconUrl = icon ? ICON_URLS[icon] : undefined
  const isLink = variant === 'link'

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          height:            isLink ? undefined : st.height,
          paddingHorizontal: isLink ? 0 : st.paddingH,
          borderRadius:      st.radius,
          backgroundColor:   disabled ? Colors.border : vt.bg,
          borderWidth:       vt.borderWidth,
          borderColor:       vt.borderColor,
        },
        fullWidth && styles.fullWidth,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {loading ? (
        // Spinner color matches text area so it's always visible
        <ActivityIndicator
          size="small"
          color={vt.textColor === Colors.white ? Colors.white : Colors.primary}
        />
      ) : (
        <>
          {iconPosition === 'start' && !!iconUrl && (
            <SvgUri uri={iconUrl} width={20} height={20} style={styles.icon} />
          )}

          <Text
            numberOfLines={1}
            style={[
              styles.label,
              {
                fontSize:   st.fontSize,
                fontWeight: st.fontWeight,
                color:      disabled ? Colors.textTertiary : vt.textColor,
              },
            ]}
          >
            {label}
          </Text>

          {iconPosition === 'end' && !!iconUrl && (
            <SvgUri uri={iconUrl} width={20} height={20} style={styles.icon} />
          )}
        </>
      )}
    </Pressable>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.82,
  },
  icon: {
    width:      20,
    height:     20,
    flexShrink: 0,
  },
  label: {
    flexShrink: 1,
    textAlign:  'center',
  },
})
