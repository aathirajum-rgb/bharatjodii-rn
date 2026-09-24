// "Verify your profile to activate paid membership" breather banner — Angular:
// <app-breather> "breather-block"/"breather-container" variant (distinct from
// MembershipBanner's "matches-breather-block"/"payment-container" PAYMENT
// variant, and from IdVerifyBanner below, whose copy is "connect with matches",
// not membership activation). Diagonal white→pink gradient matches
// ActivationBannerRich's own approximation of the same 139.8deg Angular gradient.
import { Image, StyleSheet, Text, View } from 'react-native'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
const FALLBACK_IMG = CDN_SVG + 'activate-paid-membership-matches.svg'

export default function ActivateMembershipBanner({ data, onPress }: { data: any; onPress: () => void }) {
  if (!data) return null
  const { LinearGradient } = require('expo-linear-gradient')
 const langFonts = useLanguageFonts()
  const stripHtml = (s: string) => s?.replace(/<[^>]*>/g, '') ?? ''
  const title    = stripHtml(data.TITLE ?? '')
  const subtitle = stripHtml(data.BODY?.CONTENT1 ?? '')
  const cta      = stripHtml(data.CTA ?? 'Call us')

  return (
    <LinearGradient
      colors={[Colors.white, '#FFD9E4']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={am.card}
    >
      <Image source={{ uri: data.BANNERIMG || FALLBACK_IMG }} style={am.img} resizeMode="contain" />

      <View style={am.content}>
        {!!title && <Text style={[am.title,{ fontFamily: langFonts.semiBold }]}>{title}</Text>}
        {!!subtitle && <Text style={[am.subtitle, { fontFamily: langFonts.regular }]}>{subtitle}</Text>}

        <ButtonRevamp
          label={cta}
          variant="primary"
          size="standard"
          icon="call-img-white"
          iconPosition="start"
          fullWidth
          onPress={onPress}
          style={[am.cta,{ fontFamily: langFonts.semiBold }]}
        />
      </View>
    </LinearGradient>
  )
}

const am = StyleSheet.create({
  card: {
    borderRadius: 0,
    // Same 8px #E6E6E6 divider as the profile cards (c.card) around it, so the
    // banner reads as its own slide instead of running into the next card.
    borderBottomWidth: 8,
    borderBottomColor: Colors.borderSubtle,
  },
  // Angular: "add-photo-height" — no cited px value for this class, so this
  // sizes the illustration by content (contain) rather than guessing a crop.
  // Angular's own markup (pl-24 pr-24 row, no centering class on the <img>
  // itself) left-aligns this image — alignSelf:'flex-start' pins it there
  // instead of stretching to the card's full width.
  img: {
    width:      160,
    height:     120,
    marginTop:  16,
    // The row's pl-24 — without it the image sat flush on the screen edge
    // while the title/body/CTA below started 24px in.
    marginLeft: 24,
    alignSelf:  'flex-start',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom:     24,
  },
  // Angular: "mt-32 heading1-semibold-20 black-color line-height-24"
  title: {
    fontSize:   FontSize.font20,
    color:      Colors.black,
    lineHeight: 24,
    marginTop:  32,
  },
  // Angular: "mt-12 body2-regular-14 black-color line-height-20"
  subtitle: {
    fontSize:   FontSize.font14,
    color:      Colors.black,
    lineHeight: 20,
    marginTop:  12,
  },
  // Angular: "width100 mt-32" wrapping app-button-revamp
  cta: {
    marginTop: 32
  },
})
