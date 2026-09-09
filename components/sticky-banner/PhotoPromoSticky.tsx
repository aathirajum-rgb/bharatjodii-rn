// Angular: components/payment-stickey/payment-stickey.component.html's SECOND
// ion-row (`ComponentData?.TYPE || STICKYTYPE=='ProfileValidSticky'`) — a
// distinct visual shape from StickyBanner.tsx (which models the FIRST row:
// payment-failed/force-update, with a separate CTA button + close icon).
// This row is: small image + content text + a trailing chevron, the WHOLE
// row tappable, and — per Angular's own CLOSE_IMG='' for this content —
// deliberately has NO close/dismiss affordance at all.
import { Pressable, StyleSheet, Text } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { Colors } from '../../constants/colors'
import CdnSvg from '../cdn-svg/CdnSvg'
import { FontSize, RupeeSymbolFont } from '../../src/theme/fonts'

// Angular: `<ion-icon name="chevron-forward-outline" class="ion-no-margin
// black-color closeImg">` — a real Ionicons chevron (sized via `.closeImg
// { width/height: 24px }`, not font-size), not a styled text character. Same
// glyph as HomeScreen.tsx's CHEVRON_FORWARD_BLUE_XML, just black here.
const CHEVRON_FORWARD_BLACK_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M184 112l144 144-144 144"/></svg>`

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
      <SvgXml xml={CHEVRON_FORWARD_BLACK_XML} width={24} height={24} />
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
  // Angular: payment-stickey.component.html's second row (`.verify-profile`)
  // — on Home (explore.component.html) no [component-class] is bound, so
  // ComponentClass?.contentClass is '' and only the template's own classes
  // apply: `.textcta-medium-12 poppins-family`. font-size var(--font12)
  // (0.75rem, scales with device width — see FontSize's header comment).
  // line-height: the template's own ternary picks `.line-height-14` for
  // English (`.line-height-16` is only for the other listed languages) — 14px
  // flat, not 16 (NOT rem-based, unlike the font-size). Color: neither active
  // class sets one, so it falls through to Ionic's default --ion-text-color
  // (#000000, i.e. Colors.black), not Colors.textPrimary (#111111).
  // fontFamily: both `.textcta-medium-12` (Poppins-Medium) and `.poppins-family`
  // (var(--english-poppins) = Roboto-Regular — the same alias RupeeSymbolFont
  // documents for the ₹-glyph use case) set font-family with `!important`, so
  // it comes down to plain source order between the two — `.poppins-family`
  // is declared LATER in global.scss, so it wins outright, same "later
  // !important beats earlier !important" mechanism HomeScreen.tsx's helpBanner
  // gradient direction already relies on. Whatever the original intent, this
  // is what Angular actually renders — Roboto, not Poppins-Medium.
  text: {
    flex:       1,
    fontFamily: RupeeSymbolFont,
    fontSize:   FontSize.font12,
    color:      Colors.black,
    lineHeight: 14,
  },
})
