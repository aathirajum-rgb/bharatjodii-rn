import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'
import { CDN_SVG } from '../../constants/cdn'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LinkCTAProps {
  text:      string          // contextual message, e.g. "You have shortlisted this member."
  contact:   string          // phone number / contact value to display
  onPress:   () => void      // called when contact row is tapped
  style?:    ViewStyle | undefined
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CALL_ICON = CDN_SVG + 'revamp/call-blue.svg'

// ─── LinkCTA ──────────────────────────────────────────────────────────────────
// Mirrors Angular link-cta.component — shows a context label above a tappable
// call icon + contact number row. Used in shortlist / communication flows.

export default function LinkCTA({ text, contact, onPress, style }: LinkCTAProps) {
  return (
    <View style={[styles.container, style]}>
      {!!text && (
        <Text style={styles.message}>{text}</Text>
      )}

      <Pressable
        style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.7 }]}
        onPress={onPress}
        hitSlop={8}
      >
        <CdnSvg uri={CALL_ICON} width={18} height={18} style={styles.callIcon} />
        <Text style={styles.contactText}>{contact}</Text>
      </Pressable>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Angular: width 100%, justify-content center, align-items center, text-align center
  container: {
    width:       '100%',
    alignItems:  'center',
    gap:         4,
  },
  // Angular: .body3-regular-12 .line-height-18 .black-color .mr-8 — 12px
  // Poppins-Regular. Neither text here declared a fontFamily at all, so both
  // fell back to the platform system font instead of Poppins.
  message: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   FontSize.font12,
    lineHeight: 18,
    color:      Colors.textPrimary,
    textAlign:  'center',
  },
  // Angular: d-flex, align-items center, justify-content center, margin-bottom 2
  contactRow: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent:'center',
    gap:           6,
    marginBottom:  2,
  },
  callIcon: {
    flexShrink: 0,
  },
  // Angular: .body1-medium-14-all .line-height-18 .color-29339B .ml-4 — 14px
  // Poppins-Medium, weight 500, #29339B.
  contactText: {
    fontFamily: Fonts.poppinsMedium,
    fontSize:   FontSize.font14,
    fontWeight: '500',
    lineHeight: 18,
    color:      Colors.link,
  },
})
