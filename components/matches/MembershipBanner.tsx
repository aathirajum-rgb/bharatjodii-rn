// Membership/festival offer banner (BANNERSLOT 1001) — extracted from
// MatchesScreen.tsx so ViewProfileScreen can reuse it verbatim (Angular: same
// app-breather PAYMENT-type template renders on both pages, driven by the same
// paymentService.getMenuPromo(0) → MATCHESSLOT data).
// Figma (file GqYHfj2jHlbhNFKoYQ0W8H, node 9737:16600 "Jodii - Festival Offer Banner")
// confirms this card is themed per-campaign (Ramadan green, generic pink/red, etc.) —
// background art, CTA color, pill border/fill all vary by campaign and are server-driven
// (BGIMG/CTABGCOLOR/OFFERTAG); only the LAYOUT below (sizes/weights/gaps/radii) is fixed
// across campaigns and is what this component hardcodes.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { HtmlText } from './matchesCard.shared'
import { Colors } from '../../constants/colors'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

function parseCssColor(style: string | undefined, prop: string): string | undefined {
  if (!style) return undefined
  return style.match(new RegExp(`${prop}[^:;]*:[^;]*?(#[0-9a-fA-F]{3,8})`, 'i'))?.[1]
}

// Angular sometimes sends a CSS class-name token ('primaryBg'/'whiteColor') instead of
// a real hex for CTABGCOLOR/CTACOLOR — RN can't resolve a class name, so it silently
// fails to apply it (the text/button just falls back to its inherited default color
// instead of the intended one). Anything that isn't a real #hex is treated as unresolved.
function resolveCtaBg(v: string | undefined): string {
  return v && v.startsWith('#') ? v : Colors.primaryDark
}
function resolveCtaTextColor(v: string | undefined): string {
  return v && v.startsWith('#') ? v : Colors.white
}

export default function MembershipBanner({ data, onPress }: { data: any; onPress: () => void }) {
  if (!data) return null

  const stripHtml = (s: string) => s?.replace(/<[^>]*>/g, '') ?? ''
  const cta = stripHtml(data.CTA ?? 'Get Membership')
  const valid = stripHtml(data.VALID ?? data.FCONTENT ?? '')
  const benefits: Array<{ IMG?: string; VALUE?: string }> = Array.isArray(data.BENEFITS) ? data.BENEFITS : []
  const isWhite = data.FONTCOLOR === 'white-color'
  // Angular: breather.component.ts's getOfferTagClassName()/title ngClass fall back to
  // the literal 'black-color' class (#000000 = Colors.black) whenever FONTCOLOR isn't
  // 'white-color' — not this app's general textStrong (#1a1a1a) token.
  const textColor = isWhite ? Colors.white : Colors.black
  // Figma: pill is a light gradient fill + 1px border, both campaign-colored (Ramadan:
  // #218441/mint-green) — RN can't do the two-stop gradient cheaply here, so we take a
  // flat approximation from OFFERTAG's background color instead (accepted simplification).
  const validBg     = parseCssColor(data.OFFERTAG, 'background') ?? '#FFF3CD'
  const validBorder = parseCssColor(data.OFFERTAG, 'border') ?? validBg
  const langFonts = useLanguageFonts()
  return (
    <Pressable style={mb.card} onPress={onPress}>
      {/* Full-bleed campaign background art (Angular: background: url(BGIMG) on the whole card) */}
      {!!data.BGIMG && (
        <Image source={{ uri: data.BGIMG }} style={mb.bgImg} resizeMode="cover" />
      )}

      <View style={mb.content}>
        {/* TITLEIMG is an SVG logo/icon — CdnSvg (not plain Image) so it decodes on native */}
        {!!data.TITLEIMG && (
          <CdnSvg uri={data.TITLEIMG} width={140} height={28} style={mb.titleImg} />
        )}

        {/* Title — plain text. Angular's [innerHTML] title has no forced single-line/
            ellipsis styling — it just wraps naturally if genuinely too narrow, so we
            don't force numberOfLines here either. (adjustsFontSizeToFit was tried but
            doesn't work on React Native Web — it silently no-ops there, so numberOfLines={1}
            alone just truncated the text with "..." instead of shrinking to fit.) */}
        {!!data.TITLE && (
          <Text style={[mb.title, { color: textColor, fontFamily: langFonts.semiBold }]} numberOfLines={2}>
            {stripHtml(data.TITLE)}
          </Text>
        )}

        {/* Festival subtitle */}
        {!!data.FESTIVALSUBTITLE && (
          <HtmlText html={data.FESTIVALSUBTITLE} style={[mb.subtitle, { color: textColor, fontFamily: langFonts.semiBold }]} />
        )}

        {/* Subtitle — "Get up to <span>₹200 OFF</span> on paid membership!" — Angular gives
            the amount span its own CSS class (heading-semibold, bigger size) rather than an
            inline style; spanStyle reproduces that visual emphasis regardless of markup. */}
        {!!data.SUBTITLE && (
          <HtmlText
            html={data.SUBTITLE}
            style={[mb.subtitle, { color: textColor, fontFamily: langFonts.semiBold }]}
            spanStyle={mb.subtitleAmount}
          />
        )}

        {/* Validity / timer pill — ribbon shape: rounded left corners only, no right border
            (Angular: border-t/border-b/border-l but no border-r, rounded-tl/rounded-bl only) */}
        {!!valid && (
          <Text style={[mb.valid, { backgroundColor: validBg, borderColor: validBorder, color: isWhite ? Colors.white : Colors.black, fontFamily: langFonts.semiBold }]}>
            {valid}
          </Text>
        )}

        {/* Benefits list with icons */}
        {benefits.length > 0 && (
          <View style={mb.benefitsList}>
            {benefits.slice(0, 4).map((b, i) => (
              <View key={i} style={mb.benefitRow}>
                {/* Tick icon is an SVG (Figma "Tick" node) — CdnSvg so it decodes on native */}
                {!!b.IMG && (
                  <CdnSvg uri={b.IMG} width={20} height={20} style={mb.benefitIcon} />
                )}
                <Text style={[mb.benefitText, { color: textColor, fontFamily: langFonts.medium }]} numberOfLines={2}>
                  {stripHtml(b.VALUE ?? '')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* CTA button */}
        <Pressable
          style={[mb.ctaBtn, { backgroundColor: resolveCtaBg(data.CTABGCOLOR) }]}
          onPress={onPress}
        >
          <Text style={[mb.ctaText, { color: resolveCtaTextColor(data.CTACOLOR), fontFamily: langFonts.semiBold }]}>{cta}</Text>
        </Pressable>
      </View>
    </Pressable>
  )
}

const mb = StyleSheet.create({
  // Angular: matches-breather-block — background: url(BGIMG) covers the WHOLE card.
  // No minHeight: Angular's own min-height:387px assumes content is vertically
  // centered inside it (d-flex align-center-item), which isn't reproduced here —
  // without that centering, a fixed minHeight just leaves dead space below the CTA
  // button whenever this card's content (varies per campaign) is shorter than the
  // floor. Sizing purely to content removes that gap; bgImg (cover, often mostly
  // transparent art) adapts to whatever height results.
  card: {
    backgroundColor:   Colors.membershipCardBg,
    borderBottomWidth: 8,
    borderBottomColor: Colors.borderSubtle,
    overflow:          'hidden',
  },
  bgImg: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    bottom:   0,
  },
  // Figma content top/padding — but NOT a maxWidth: that 283 figure came from measuring
  // one screenshot ("Ramadan Offer", 13 chars) and was too tight for longer titles like
  // "Become a paid member" (21 chars), wrapping it to 2 lines. bgImg is a full-bleed
  // background (the campaign art), not a competing right column, so text can use the
  // full card width minus padding.
  content: {
    paddingHorizontal: 24,
    paddingTop:        38,
    paddingBottom:     24,
  },
  titleImg: {
    width:        140,
    height:       28,
    marginBottom: 8,
  },
  // Angular: breather.component.html:38 — heading1-semibold-22 (English/most languages),
  // heading2-semibold-18 for tm/ml. 22px, not 24 — that was from a different Figma node.
  title: {
    
    fontSize:   FontSize.font22,
    color:      Colors.textStrong,
    lineHeight: 24,
  },
  // Figma: "on paid membership!" line — 14px Poppins-Medium, tracking 0.28
  // (Angular: breather.component.html:38 FESTIVALSUBTITLE — body1-medium-14 line-height-20)
  subtitle: {
   
    fontSize:      FontSize.font14,
    color:         Colors.textDark,
    marginTop:     8,
    lineHeight:    20,
    letterSpacing: 0.28,
  },
  // The "₹200 OFF" span specifically — Angular: breather.component.ts's transform() confirms
  // the server-sent SUBTITLE span itself carries class heading1-semibold-22 (22px
  // Poppins-SemiBold, var(--font22)) — 24px here was a Figma-node mismeasurement.
  subtitleAmount: {
   
    fontSize:   FontSize.font22,
  },
  // Figma: ribbon pill — 14px Poppins-Regular, h-24 (py-4), rounded left corners only,
  // border on top/bottom/left but NOT right (open ribbon edge, not a closed pill).
  // Angular: breather.component.scss .offerTag { margin-top: 10px } (English) — the pill
  // text itself is body2-regular-14 (breather.component.html:49).
  valid: {
   
    fontSize:                FontSize.font14,
    lineHeight:              20,
    marginTop:               10,
    paddingHorizontal:       8,
    paddingVertical:         4,
    borderWidth:             1,
    borderRightWidth:        0,
    borderTopLeftRadius:     4,
    borderBottomLeftRadius:  4,
    alignSelf:               'flex-start',
  },
  // Angular: breather.component.scss .benefits { margin-top: 16px } (English);
  // gap-[12px] between individual rows matches Figma + Angular's .benefitItem margin-top
  benefitsList: {
    marginTop: 16,
    gap:       12,
  },
  // Figma: gap-[8px] between tick and text
  benefitRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
    width:        '77%',
  },
  // Figma: Tick is 20×20
  benefitIcon: {
    width:      20,
    height:     20,
    flexShrink: 0,
  },
  // Figma: 14px Poppins-Medium (not Regular/13)
  benefitText: {
   
    fontSize:   FontSize.font14,
    color:      Colors.textDark,
    flex:       1,
    lineHeight: 20,
  },
  // Angular: breather.component.scss .get-paid-membership { height:40px; width:100% }
  // — 100% of its OWN column, which is ion-col size="7.2" (7.2/12 = 60% of the row).
  // The Figma mockup's compact/content-sized look doesn't match the real Angular CSS —
  // this follows the actual implementation, not the mockup.
  ctaBtn: {
    marginTop:         16,
    height:            40,
    width:             '65%',
    borderRadius:      8,
    paddingHorizontal: 16,
    alignItems:        'center',
    justifyContent:    'center',
  },
  ctaText: {
   
    fontSize:   FontSize.font14,
  },
})
