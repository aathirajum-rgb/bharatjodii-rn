// Force-update popup — Angular: components/payment-stickey/payment-stickey.component.html's
// APPFORCEUPDATE block. Visually distinct from the payment-failed/profile-validation
// sticky (a plain bottom bar, still handled by StickyBanner): this is a bordered card
// with its own close-X on a separate top row, an alert icon, note text, and a real
// CTA button — not inline text with a trailing chevron.
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SvgXml } from 'react-native-svg'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'

const ALERT_ICON = 'https://imgs.jodii.app/assets/images/svg/activity-alert-img.svg'
// Angular: `<ion-icon class="cross-img-vp-revamp color-808080" name="close-outline">`
// — a real Ionicons close-outline icon (same glyph HomeScreen.tsx's video-modal
// close button uses), not a styled text character. Traced from ionicons'
// actual SVG source (node_modules/ionicons/dist/svg/close-outline.svg).
const CLOSE_ICON_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#808080" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144M368 144L144 368"/></svg>`
// Angular: `.cross-img-vp-revamp { font-size: 6.67vmin }` — vmin is 1% of
// min(viewport width, height); this app is locked to portrait
// (app.json's orientation: 'portrait'), so width is always the smaller
// dimension and 1vmin ≈ 1% of device width — same reasoning as every other
// SW-based proportional size in HomeScreen.tsx (e.g. HAND_SIZE = SW * 0.35).
const SW = Dimensions.get('window').width
const CLOSE_ICON_SIZE = SW * 0.0667

export interface ForceUpdateCardProps {
  onPress: () => void
  onClose: () => void
}

export default function ForceUpdateCard({ onPress, onClose }: ForceUpdateCardProps) {
  const { t } = useTranslation()

  return (
    <View style={s.wrap}>
      <Pressable style={s.closeRow} onPress={onClose} hitSlop={8}>
        <SvgXml xml={CLOSE_ICON_XML} width={CLOSE_ICON_SIZE} height={CLOSE_ICON_SIZE} />
      </Pressable>
      <View style={s.row}>
        <CdnSvg uri={ALERT_ICON} width={28} height={28} />
        <Text style={s.note} numberOfLines={3}>{t('APP_UPDATE.NOTE')}</Text>
        <Pressable style={s.cta} onPress={onPress}>
          <Text style={s.ctaText}>{t('APP_UPDATE.CTA')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: 24,
    marginBottom:      12,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       Colors.divider,
    backgroundColor:   Colors.white,
    paddingHorizontal: 12,
    paddingTop:        4,
    paddingBottom:     8,
  },
  closeRow: {
    alignSelf: 'flex-end',
    padding:   4,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  // Angular: `.body3-regular-12 color-1f1e1b` on the NOTE `<h2>` — font-size
  // var(--font12) (0.75rem, scales with device width — see FontSize's header
  // comment); family already matched (english-regular-poppins = Poppins-Regular).
  note: {
    flex:       1,
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   FontSize.font12,
    color:      '#1f1e1b',
  },
  cta: {
    backgroundColor:   Colors.primary,
    borderRadius:      20,
    paddingVertical:   8,
    paddingHorizontal: 14,
  },
  // Angular: app-button-revamp with buttonSize='medium30', background='primaryBg',
  // textColor='whiteColor' — `ion-button.medium30 span` sets font-size
  // var(--font12) !important (higher specificity than the default ctaFontSize
  // class, so it wins outright), and `ion-button.medium30 span` (weight 400)
  // is itself overridden by `ion-button.primaryBg span` (weight 500, declared
  // later in the same stylesheet at equal specificity) — i.e. Poppins-MEDIUM,
  // not SemiBold. Color white already matched (--ion-color-white-color).
  ctaText: {
    fontFamily: Fonts.poppinsMedium,
    fontSize:   FontSize.font12,
    color:      Colors.white,
  },
})
