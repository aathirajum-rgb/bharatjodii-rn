import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

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
//
// Angular's real per-icon rule is `ion-icon.#{$Name} { background: url($Url)
// no-repeat; background-position: center; }` — note there's NO `background-
// size` (the `contain` line is commented out in the source). `.small`/`.large`
// only size the invisible ion-icon BOX (16/24px); with no background-size,
// the image inside always renders at its own native pixel dimensions,
// centered in that box. So the real on-screen size of every one of these
// icons is whatever that specific SVG file's own width/height attributes
// say — confirmed by fetching each file directly — not a uniform 20x20 (or
// 16/24) the way the old flat CdnSvg size assumed. Each entry here carries
// its own real size instead.
const CDN = CDN_SVG

interface IconSpec { url: string; width: number; height: number }

export const ICON_URLS: Record<string, IconSpec> = {
  // Angular's download-biodata CTA glyph (download-biodata.component.html's
  // Download Biodata button) — not part of the original $IconURLs map, added
  // so BiodataScreen can use the standard leading-icon slot.
  'download-biodata-white': { url: CDN + 'download-biodata-white.svg',              width: 20, height: 20 },
  'like-img':                { url: CDN + 'revamp/like-white-revamp.svg',            width: 18, height: 19 },
  'liked-img':               { url: CDN + 'vp-liked-white.svg',                      width: 24, height: 24 },
  'call-img':                { url: CDN + 'revamp/call-icon.svg',                    width: 24, height: 24 },
  'call-img-white':          { url: CDN + 'revamp/call-icon-white.svg',              width: 18, height: 18 },
  'call-icon-pink':          { url: CDN + 'revamp/call-icon-pink.svg',               width: 24, height: 24 },
  'call-blue':               { url: CDN + 'revamp/call-blue.svg',                    width: 16, height: 16 },
  'whatsapp-img':            { url: CDN + 'revamp/whatsapp-revamp.svg',              width: 23, height: 22 },
  'whatsapp-white-img':      { url: CDN + 'revamp/white-whatsapp.svg',               width: 21, height: 21 },
  'message-primary-img':     { url: CDN + 'message-intermediate-img-vp.svg',         width: 15, height: 15 },
  'dont-show-img':           { url: CDN + 'revamp/close-icon.svg',                   width: 25, height: 24 },
  'tick-img':                { url: CDN + 'tick-white.svg',                          width: 24, height: 24 },
  'forward-icon-link':       { url: CDN + 'revamp/forward-icon-link.svg',            width: 7,  height: 10 },
  'forward-icon-white':      { url: CDN + 'revamp/white-forward-icon.svg',           width: 16, height: 18 },
  'forward-icon-pink':       { url: CDN + 'revamp/forward-icon-pink.svg',            width: 6,  height: 10 },
  'forward-icon-grey':       { url: CDN + 'revamp/forward-icon-grey.svg',            width: 16, height: 16 },
  'forward-icon-green':      { url: CDN + 'revamp/forward-icon-green.svg',           width: 7,  height: 10 },
  'right-arrow':             { url: CDN + 'revamp/arrow-right-white.svg',            width: 16, height: 16 },
  'forward-bold-icon-white': { url: CDN + 'revamp/forward-bold-icon-white.svg',      width: 24, height: 24 },
  'crown-white':             { url: CDN + 'revamp/crown-white.svg',                  width: 21, height: 16 },
  'shortlist-white':         { url: CDN + 'shortlist/shortlist-white.svg',           width: 10, height: 13 },
  'shortlisted-white':       { url: CDN + 'shortlist/shortlisted-white-updated.svg', width: 16, height: 16 },
  'mic-pink':                { url: CDN + 'revamp/mic-pink.svg',                     width: 25, height: 24 },
  'mic-grey':                { url: CDN + 'registration-new/mic-grey.svg',           width: 25, height: 24 },
  'button-skip':             { url: CDN + 'next-icon.svg',                           width: 25, height: 24 },
  'paid-membership':         { url: CDN + 'get-paid-membership.svg',                 width: 20, height: 20 },
  'view-later':              { url: CDN + 'view-later.svg',                          width: 24, height: 24 },
  'icon-gallery-pink':       { url: CDN + 'icon-gallery-pink.svg',                   width: 16, height: 16 },
  'icon-phone-pink':         { url: CDN + 'icon-phone-pink.svg',                     width: 24, height: 24 },
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
    // Angular: variables.scss --ion-color-primary: #B50033 (Colors.primaryDark) — every
    // primary/Pay-Now CTA in Angular uses this ONE color via button.config.ts's PRIMARY_BTN.
    // Colors.primary (#C62828) is an unrelated general-accent value, not Angular's button color.
    bg: Colors.primaryDark, textColor: Colors.white,
    borderColor: undefined, borderWidth: 0,
  },
  secondary: {
    // Angular: .secondary-cta-jodii { border: 1px solid #B50033; color: #B50033 }
    // — text and border share the exact same hex (Colors.primaryDark). Was
    // Colors.primaryDeep (#8D0028), a different, darker maroon not used by
    // this Angular class at all.
    bg: Colors.white, textColor: Colors.primaryDark,
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
  const iconSpec = icon ? ICON_URLS[icon] : undefined
  const isLink = variant === 'link'
  // Button labels are always server-translated text (CTA copy) — Poppins for
  // English, the matching NotoSans script for every other language, same as
  // every other piece of onboarding/registration text. This is read here
  // (rather than requiring every one of this component's ~50 call sites to
  // pass it) so no button in the app is silently stuck on the system font.
  const langFonts = useLanguageFonts()

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
          {iconPosition === 'start' && !!iconSpec && (
            <CdnSvg uri={iconSpec.url} width={iconSpec.width} height={iconSpec.height} style={styles.icon} />
          )}

          <Text
            numberOfLines={1}
            style={[
              styles.label,
              {
                fontSize:   st.fontSize,
                fontWeight: st.fontWeight,
                fontFamily: st.fontWeight === '600' ? langFonts.semiBold : st.fontWeight === '500' ? langFonts.medium : langFonts.regular,
                color:      disabled ? Colors.textTertiary : vt.textColor,
              },
            ]}
          >
            {label}
          </Text>

          {iconPosition === 'end' && !!iconSpec && (
            <CdnSvg uri={iconSpec.url} width={iconSpec.width} height={iconSpec.height} style={styles.icon} />
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
  // No fixed width/height here — CdnSvg's own `width`/`height` PROPS (now
  // per-icon, from ICON_URLS' IconSpec) are the source of truth; on web,
  // CdnSvg merges `style` in AFTER `{width,height}` in its own style array,
  // so a flat size baked in here would silently win back over the per-icon
  // size passed at each call site.
  icon: {
    flexShrink: 0,
  },
  label: {
    flexShrink: 1,
    textAlign:  'center',
  },
})
