import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import CdnSvg, { CdnSvgBackground } from '../cdn-svg/CdnSvg'
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
// Angular: .paid-member-block { background: url(paid-member-bg.svg) ... } —
// a real background image, not a flat fill. badge.component.scss confirms
// .verified-member-block/.newly-joined ALSO use their own background SVGs
// (verified-bg.svg / newly-joined.svg) — likely the same gap, but only
// 'paid' is confirmed/in scope right now; those two keep their existing flat
// colors below untouched rather than guess at the rest.
const PAID_BG = `${CDN}revamp/paid-member-bg.svg`

// Per-variant visual tokens — mirrors Angular SCSS badge block styles.
// 'paid' intentionally omitted here — VARIANT_STYLE only backs the
// variants that DON'T have a confirmed real background image, so it keeps
// serving as their (unverified, unreviewed) flat-color fallback.
const VARIANT_STYLE: Record<Exclude<BadgeVariant, 'paid'>, { bg: string; textColor: string }> = {
  verified:     { bg: Colors.badgeVerifiedBg, textColor: Colors.badgeVerifiedText },
  'newly-joined': { bg: Colors.badgeNewBg,   textColor: Colors.badgeNewText },
  custom:       { bg: Colors.background,      textColor: Colors.textPrimary },
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export default function Badge({ variant, text, imageUrl, hasInfo = false, style }: BadgeProps) {
  if (variant === 'paid') {
    return (
      <CdnSvgBackground uri={PAID_BG} style={[styles.container, styles.paidContainer, style]}>
        {!!imageUrl && (
          <CdnSvg uri={imageUrl} width={24} height={24} style={styles.paidIcon} />
        )}
        {/* Angular: .color-006C48 { color: #006C48 } — a dark green, not the
            generic amber Colors.badgePaidText (shared with an unrelated,
            unreviewed badge elsewhere) was giving this. */}
        <Text style={[styles.label, styles.paidLabel]} numberOfLines={1}>
          {text}
        </Text>
        {hasInfo && (
          <CdnSvg uri={INFO_ICON} width={14} height={14} style={styles.infoIcon} />
        )}
      </CdnSvgBackground>
    )
  }

  const { bg, textColor } = VARIANT_STYLE[variant]

  return (
    <View style={[styles.container, { backgroundColor: bg }, style]}>
      {!!imageUrl && (
        <CdnSvg uri={imageUrl} width={18} height={18} style={styles.icon} />
      )}

      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {text}
      </Text>

      {hasInfo && (
        <CdnSvg uri={INFO_ICON} width={14} height={14} style={styles.infoIcon} />
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
  // Angular: .paid-member-block { padding: 4px 30px 4px 20px; min-width: 116px }
  paidContainer: {
    paddingLeft:  20,
    paddingRight: 30,
    minWidth:     116,
  },
  icon: {
    flexShrink: 0,
  },
  // Angular: .paid-tag-position { position:absolute; left:-10px; top:0;
  // height:100% } — the crown icon overlaps the badge's own left edge.
  paidIcon: {
    position: 'absolute',
    left:     -10,
    top:      '50%',
    marginTop: -12,
  },
  label: {
    fontSize:   12,
    fontWeight: '600',
    flexShrink: 1,
  },
  paidLabel: {
    color: '#006C48',
  },
  infoIcon: {
    flexShrink: 0,
    marginLeft: 2,
  },
})
