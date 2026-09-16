// Home screen's "assist" / breather banner — Angular: <app-breather>, shown instead
// of (takes precedence over) the regular hero banner when PPSET's ASSISTEDFLAG=='1'
// and the user hasn't locally dismissed it this session (homeGating.ts's
// computeShowAssistBanner). Content comes from paymentService.getMenuPromo()'s
// ASSISTEDPROMO fields.
//
// ⚠️ NO LIVE ANGULAR VISUAL TO MATCH. explore.component.html:19-21 renders
// <app-breather [bannerSlot]="'1001'" [assistFlag]="assistFlag">, and for exactly
// that pair breather.component.ts:86-91 sets breatherType = 'ASSIST' — but
// breather.component.html has NO *ngIf branch for 'ASSIST' (it only handles
// 'PCS', 'PAYMENT', 'ADDPHOTO', 'ADDPHOTOPAID'/'IDVERIFY'; the string "ASSIST"
// does not appear in that template at all). The .assist-breather-block /
// .assisted-benefits / .assist-header rules in breather.component.scss are
// likewise referenced by no markup. So on web this renders nothing inside
// explore.component.scss's .assist-block { min-height: 387px } box.
//
// Every size/colour below is therefore this port's own — there is no Angular
// value to cite or correct. Sizes are tokenised for consistency only; do NOT
// treat them as verified against Angular.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'

export interface AssistBannerContent {
  title:    string
  body:     string
  ctaLabel: string
}

export interface AssistBannerProps {
  content:   AssistBannerContent
  onPress:   () => void
  onDismiss: () => void
}

export default function AssistBanner({ content, onPress, onDismiss }: AssistBannerProps) {
  return (
    <View style={s.wrap}>
      <Pressable style={s.close} onPress={onDismiss} hitSlop={8}>
        <Text style={s.closeText}>✕</Text>
      </Pressable>
      {!!content.title && <Text style={s.title}>{content.title}</Text>}
      {!!content.body && <Text style={s.body}>{content.body}</Text>}
      <Pressable style={s.cta} onPress={onPress}>
        <Text style={s.ctaText}>{content.ctaLabel}</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor:   '#FFF6E8',
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               6,
    minHeight:         120,
  },
  close: {
    position: 'absolute',
    top:      10,
    right:    12,
    zIndex:   1,
  },
  closeText: {
    fontSize: FontSize.font16,
    color:    Colors.textSecondary,
  },
  title: {
    fontFamily:   Fonts.poppinsSemiBold,
    fontSize:     FontSize.font15,
    color:        Colors.textPrimary,
    paddingRight: 20,
  },
  body: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   FontSize.font12,
    color:      Colors.textSecondary,
  },
  cta: {
    alignSelf:         'flex-start',
    backgroundColor:   Colors.primary,
    borderRadius:      20,
    paddingVertical:   7,
    paddingHorizontal: 20,
    marginTop:         6,
  },
  ctaText: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   FontSize.font13,
    color:      Colors.white,
  },
})
