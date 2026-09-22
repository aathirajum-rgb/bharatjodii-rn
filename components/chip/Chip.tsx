import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'

// ─── Types ────────────────────────────────────────────────────────────────────

// Maps to Angular's SCSS icon class names (used as CSS background-image keys).
export type ChipIcon = 'filter' | 'forward' | 'tick' | 'close'

// Merges Angular's selectedCls / checkedCls props into one explicit state.
export type ChipState = 'default' | 'selected' | 'checked'

export interface ChipProps {
  label:         string
  state?:        ChipState | undefined
  icon?:         ChipIcon  | undefined
  iconPosition?: 'start' | 'end' | undefined
  count?:        number    | undefined   // shows a red badge when > 0
  onPress?:      (() => void) | undefined
  style?:        ViewStyle   | undefined
  // Angular keeps the label `color-1f1e1b body2-regular-14` in every state, so
  // there is no per-state label styling here. This is for the callers that DO
  // restyle it — the desktop quick-filter row, which is a React-only design
  // with its own palette and the app's language-aware font stack.
  labelStyle?:   TextStyle | TextStyle[] | undefined
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN = CDN_SVG + 'revamp/'

// Angular SCSS: $IconURLs map — each icon class → background-image URL
const ICON_URL: Record<ChipIcon, string> = {
  filter:  CDN + 'filter-img.svg',
  forward: CDN + 'forward-icon-grey.svg',
  tick:    CDN + 'primary-tick.svg',
  close:   CDN + 'close-icon.svg',
}

// Angular SCSS: #start { width 20, height 20 } / #end { width 16, height 16 }
const ICON_SIZE: Record<'start' | 'end', number> = { start: 20, end: 16 }

// ─── Chip ─────────────────────────────────────────────────────────────────────

export default function Chip({
  label,
  state        = 'default',
  icon,
  iconPosition = 'end',
  count,
  onPress,
  style,
  labelStyle,
}: ChipProps) {
  const iconSize = ICON_SIZE[iconPosition]

  const iconEl = icon
    ? <CdnSvg uri={ICON_URL[icon]} width={iconSize} height={iconSize} />
    : null

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        state === 'selected' && styles.chipSelected,
        state === 'checked'  && styles.chipChecked,
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      {/* Start icon */}
      {iconPosition === 'start' && iconEl}

      {/* Label */}
      <Text style={[styles.label, labelStyle]} numberOfLines={1}>{label}</Text>

      {/* End icon */}
      {iconPosition === 'end' && iconEl}

      {/* Count badge — Angular: .count-chip-block-message */}
      {!!count && count > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </Pressable>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Angular ion-chip: height 40, padding 8 16, borderRadius 20, border 1px #B0B0B0, bg #fff, gap 4
  chip: {
    flexDirection:  'row',
    alignItems:     'center',
    alignSelf:      'flex-start',
    height:         40,
    paddingHorizontal: 16,
    paddingVertical:    8,
    borderRadius:   20,
    borderWidth:    1,
    borderColor:    Colors.inputBorder,
    backgroundColor: Colors.surface,
    gap:            4,
    marginRight:    8,
  },

  // Angular .selected: border rgba(181,0,51,0.4), background #FAE7ED
  chipSelected: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.chipSurfaceSelected,
  },

  // Angular .checked: border rgba(181,0,51,0.4), background rgba(249,230,235,0.20)
  chipChecked: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.chipSurfaceChecked,
  },

  // Angular: color-1f1e1b body2-regular-14
  label: {
    fontSize:  FontSize.font14,
    color:     Colors.textPrimary,
    flexShrink: 1,
  },

  // Angular .count-chip-block-message (chip.component.scss:78-87): background
  // var(--ion-color-primary-color) = #DE2A68, borderRadius 20, 24×20, centered,
  // margin-left 4.
  countBadge: {
    backgroundColor: Colors.countBadge,
    borderRadius:    20,
    width:           24,
    height:          20,
    alignItems:      'center',
    justifyContent:  'center',
    marginLeft:      4,
  },
  // Angular: `white-color font-12-all` (global.scss:2276) — 12px, Poppins
  // REGULAR/400, white. This was 10px with a bare fontWeight 700, which RN
  // resolves to the system font plus a synthetic bold.
  //
  // The centring comes from lineHeight + includeFontPadding, not from the
  // parent's justifyContent alone: the badge centres the text's LINE BOX, and
  // the digit sits inside that box per the font's ascent/descent, which left it
  // a pixel low in a 20px badge. Pinning lineHeight to the badge height makes
  // box and badge the same rectangle, and includeFontPadding:false drops the
  // extra top/bottom padding Android adds outside those metrics.
  countText: {
    fontFamily:         SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:           FontSize.font12,
    lineHeight:         20,
    color:              Colors.white,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
  },
})
