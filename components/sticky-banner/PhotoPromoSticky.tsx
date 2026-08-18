// Angular: components/payment-stickey/payment-stickey.component.html's SECOND
// ion-row (`ComponentData?.TYPE || STICKYTYPE=='ProfileValidSticky'`) — a
// distinct visual shape from StickyBanner.tsx (which models the FIRST row:
// payment-failed/force-update, with a separate CTA button + close icon).
// This row is: small image + content text + a trailing chevron, the WHOLE
// row tappable, and — per Angular's own CLOSE_IMG='' for this content —
// deliberately has NO close/dismiss affordance at all.
import { Pressable, StyleSheet, Text } from 'react-native'
import { Colors } from '../../constants/colors'
import CdnSvg from '../cdn-svg/CdnSvg'
import { SemanticFontsEnglish } from '../../src/theme/fonts'

export default function PhotoPromoSticky({
  content, imageUrl, onPress,
}: {
  content:   string
  imageUrl?: string | undefined
  onPress:   () => void
}) {
  return (
    <Pressable style={s.row} onPress={onPress}>
      {!!imageUrl && <CdnSvg uri={imageUrl} width={20} height={20} style={s.icon} />}
      <Text style={s.text} numberOfLines={2}>{content}</Text>
      <Text style={s.chevron}>{'›'}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.white,
    paddingVertical:   12,
    paddingHorizontal: 16,
    gap:               8,
    borderTopWidth:    1,
    borderTopColor:    Colors.divider,
  },
  icon: { marginRight: 4 },
  text: {
    flex:       1,
    fontFamily: SemanticFontsEnglish.specialCtaEnglishMedium,
    fontSize:   12,
    color:      Colors.textPrimary,
    lineHeight: 16,
  },
  chevron: {
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
})
