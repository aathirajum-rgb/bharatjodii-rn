import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Colors } from '../../constants/colors'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LinkCTAProps {
  text:      string          // contextual message, e.g. "You have shortlisted this member."
  contact:   string          // phone number / contact value to display
  onPress:   () => void      // called when contact row is tapped
  style?:    ViewStyle | undefined
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CALL_ICON = 'https://imgs.jodii.app/assets/images/svg/revamp/call-blue.svg'

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
        <Image source={{ uri: CALL_ICON }} style={styles.callIcon} resizeMode="contain" />
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
  // Angular: body3-regular-12, line-height 18, black-color, margin-right 8
  message: {
    fontSize:   12,
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
    width:  18,
    height: 18,
    flexShrink: 0,
  },
  // Angular: color-29339B, body1-medium-14, line-height 18, margin-left 4
  contactText: {
    fontSize:   14,
    fontWeight: '500',
    lineHeight: 18,
    color:      Colors.link,
  },
})
