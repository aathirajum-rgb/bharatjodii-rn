// Desktop "Activation is required" banner (Figma "Jodii Desktop", node 783:56320) —
// the desktop treatment for BANNERSLOT 1013, embedded in the card list at its real
// API-reported position (same as mobile's `AddPhotoBanner`, MatchesScreen.tsx).
//
// Renders the SAME real server data mobile's AddPhotoBanner does (TITLE/SUBHEADER/
// BODY.CONTENT1/CONTENT2/CTA/BANNERIMG) — this is a visual variant of that one real
// banner, not a second, independently-worded banner. A previous pass here hardcoded
// Figma's mock copy and showed it as a persistent bar regardless of the real data,
// which is why it didn't match what mobile showed for the same account — fixed.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const CDN = CDN_SVG
const ALERT_CIRCLE_URI = CDN + 'revamp/alert-circle.svg'

// The Figma gradient is double-layered (a soft warm base under a pink wash) —
// React Native's LinearGradient can't stack two, so this uses a single dominant
// gradient approximating the visible result.

export function ActivationBannerRich({ data, onPress }: { data: any; onPress: () => void }) {
  if (!data) return null
  const { LinearGradient } = require('expo-linear-gradient')
  const stripHtml = (s: string) => s?.replace(/<[^>]*>/g, '') ?? ''
  const title = stripHtml(data.TITLE ?? 'Add photo to activate your profile')
  const lines = [data.SUBHEADER, data.BODY?.CONTENT1, data.BODY?.CONTENT2]
    .map(stripHtml)
    .filter(Boolean)
  const cta = stripHtml(data.CTA ?? 'Add photo now')

  return (
    <LinearGradient
      colors={[Colors.white, '#FFD9E4']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={rich.container}
    >
      <View style={rich.left}>
        <Text style={rich.title}>{title}</Text>
        {lines.length > 0 && (
          <View style={rich.checklist}>
            {lines.map((line, i) => (
              <Text key={i} style={rich.checkText}>{line}</Text>
            ))}
          </View>
        )}
        <Pressable style={[rich.cta, data.CTABGCOLOR ? { backgroundColor: data.CTABGCOLOR } : null]} onPress={onPress}>
          <Text style={rich.ctaText}>{cta}</Text>
        </Pressable>
      </View>
      <View style={[rich.iconCircle, !data.BANNERIMG && rich.iconCircleFallbackBg]}>
        <CdnSvg uri={data.BANNERIMG || ALERT_CIRCLE_URI} width={data.BANNERIMG ? 140 : 72} height={data.BANNERIMG ? 140 : 72} />
      </View>
    </LinearGradient>
  )
}

const rich = StyleSheet.create({
  container: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    borderRadius:      8,
    paddingHorizontal: 40,
    paddingVertical:   24,
    marginBottom:      16,
  },
  left: { gap: 16, flexShrink: 1 },
  title: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   24,
    lineHeight: 32,
    color:      Colors.black,
  },
  checklist: { gap: 8 },
  checkText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   14,
    color:      Colors.black,
  },
  cta: {
    minWidth:          200,
    height:            40,
    borderRadius:      8,
    backgroundColor:   Colors.primaryDark,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 24,
    alignSelf:         'flex-start',
  },
  ctaText: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   14,
    color:      Colors.white,
  },
  iconCircle: {
    width:           180,
    height:          180,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
    marginLeft:      24,
    overflow:        'hidden',
  },
  iconCircleFallbackBg: {
    borderRadius:    90,
    backgroundColor: 'rgba(199, 0, 56, 0.06)',
  },
})
