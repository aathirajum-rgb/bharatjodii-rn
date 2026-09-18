// "Many Jobs" cross-promo banner (BANNERSLOT 1015) — Angular renders this through
// the same app-breather PAYMENT-type template MembershipBanner.tsx models (same
// "matches-breather-block"/"payment-container"/"pay-benefits-container" classes),
// just fed menuPromo.MANYJOBSPROMO instead of MATCHESSLOT. Kept as its own component
// rather than reused through MembershipBanner because this promo's markup carries no
// SUBTITLE/valid-pill section and its CTA column width differs from the Figma-sourced
// membership card, so forcing it through that component's conditionals would need as
// much code as a dedicated one.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// Angular's own fallback background art for this promo (many-jobs-bg-male.svg) —
// used only if the server payload doesn't send BGIMG.
const FALLBACK_BG = CDN_SVG + 'many-jobs-bg-male.svg'

export default function JobsPromoBanner({ data, onPress }: { data: any; onPress: () => void }) {
  if (!data) return null

  const stripHtml = (s: string) => s?.replace(/<[^>]*>/g, '') ?? ''
  const title = stripHtml(data.TITLE ?? '')
  const cta   = stripHtml(data.CTA ?? 'Download now')
  const benefits: Array<{ IMG?: string; VALUE?: string }> = Array.isArray(data.BENEFITS) ? data.BENEFITS : []
  const langFonts = useLanguageFonts()
  return (
    <Pressable style={jp.card} onPress={onPress}>
      <Image source={{ uri: data.BGIMG || FALLBACK_BG }} style={jp.bgImg} resizeMode="cover" />

      <View style={jp.content}>
        {!!data.TITLEIMG && (
          <CdnSvg uri={data.TITLEIMG} width={240} height={32} style={jp.titleImg} />
        )}

        {!!title && <Text style={[jp.title,{ fontFamily: langFonts.semiBold }]}>{title}</Text>}

        {benefits.length > 0 && (
          <View style={jp.benefitsList}>
            {benefits.slice(0, 4).map((b, i) => (
              <View key={i} style={jp.benefitRow}>
                {!!b.IMG && (
                  <CdnSvg uri={b.IMG} width={20} height={20} style={jp.benefitIcon} />
                )}
                <Text style={[jp.benefitText, { fontFamily: langFonts.medium }]} numberOfLines={2} >
                  {stripHtml(b.VALUE ?? '')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Angular: app-button-revamp's "free tag" pill sits alongside this CTA but is
            always rendered class="display-none" — never actually shown, so it's omitted
            here rather than ported as dead UI. */}
        <Pressable
          style={[jp.ctaBtn, data.CTABGCOLOR?.startsWith?.('#') ? { backgroundColor: data.CTABGCOLOR } : null]}
          onPress={onPress}
        >
          <Text style={[jp.ctaText, { fontFamily: langFonts.medium }, data.CTACOLOR?.startsWith?.('#') ? { color: data.CTACOLOR } : null]}>
            {cta}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  )
}

const jp = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  bgImg: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    bottom:   0,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical:   24,
  },
  titleImg: {
    width:        240,
    height:       32,
    marginBottom: 8,
  },
  // Angular: black-color heading1-semibold-22
  title: {
   
    fontSize:   FontSize.font22,
    color:      Colors.black,
    lineHeight: 24,
  },
  // Angular: pay-benefits-container, rows with no explicit margin utility between
  // them — 8px is a reasonable default vertical rhythm, not read off a class.
  benefitsList: {
    marginTop: 16,
    gap:       8,
  },
  // Angular: "normal en d-flex align-item-flex-start"
  benefitRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           4,
    width:        '77%',
  },
  // Angular: "min-width-20 mt-2" — icon nudged down 2px to align with the label's cap-height
  benefitIcon: {
    width:      20,
    height:     20,
    marginTop:  2,
    flexShrink: 0,
  },
  // Angular: "ml-4 body1-medium-14 black-color"
  benefitText: {
    
    fontSize:   FontSize.font14,
    color:      Colors.black,
    flex:       1,
  },
  // Angular: ion-col size="7.2" (7.2/12 = 60% of the row) holding app-button-revamp;
  // --background: #B50033 is Colors.primaryDark already.
  ctaBtn: {
    marginTop:         16,
    height:            40,
    width:             '66%',
    borderRadius:      8,
    backgroundColor:   Colors.primaryDark,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 16,
  },
  ctaText: {
    
    fontSize:   FontSize.font14,
    color:      Colors.white,
  },
})
