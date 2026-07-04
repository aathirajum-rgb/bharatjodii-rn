import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { SvgUri } from 'react-native-svg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'

// ─── Types ────────────────────────────────────────────────────────────────────

// Maps to Angular's badgeClass: 'paid-member-block' | 'verified-member-block' | 'newly-joined'
export type BadgeVariant = 'paid' | 'verified' | 'newly-joined' | 'custom'

export interface BadgeProps {
  variant:   BadgeVariant
  text:      string
  imageUrl?: string | undefined   // left icon — passed from parent (CDN URL)
  hasInfo?:  boolean | undefined  // shows verified-info icon at end
  style?:    ViewStyle | undefined
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN = CDN_SVG
const INFO_ICON = CDN + 'verified-info.svg'

// Per-variant visual tokens — mirrors Angular SCSS badge block styles
const VARIANT_STYLE: Record<BadgeVariant, { bg: string; textColor: string }> = {
  paid:         { bg: Colors.badgePaidBg,     textColor: Colors.badgePaidText },
  verified:     { bg: Colors.badgeVerifiedBg, textColor: Colors.badgeVerifiedText },
  'newly-joined': { bg: Colors.badgeNewBg,   textColor: Colors.badgeNewText },
  custom:       { bg: Colors.background,      textColor: Colors.textPrimary },
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export default function Badge({ variant, text, imageUrl, hasInfo = false, style }: BadgeProps) {
  const { bg, textColor } = VARIANT_STYLE[variant]

  return (
    <View style={[styles.container, { backgroundColor: bg }, style]}>
      {!!imageUrl && (
        <SvgUri uri={imageUrl} width={18} height={18} style={styles.icon} />
      )}

      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {text}
      </Text>

      {hasInfo && (
        <SvgUri uri={INFO_ICON} width={14} height={14} style={styles.infoIcon} />
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Angular: padding 4px 30px 4px 20px, borderRadius 5px, display flex, align-items center
  container: {
    flexDirection:  'row',
    alignItems:     'center',
    alignSelf:      'flex-start',   // shrink-wrap to content (fit-content equivalent)
    borderRadius:   5,
    paddingVertical:   4,
    paddingLeft:    12,
    paddingRight:   16,
    gap:            4,
    minWidth:       100,
  },
  icon: {
    flexShrink: 0,
  },
  label: {
    fontSize:   12,
    fontWeight: '600',
    flexShrink: 1,
  },
  infoIcon: {
    flexShrink: 0,
    marginLeft: 2,
  },
})
