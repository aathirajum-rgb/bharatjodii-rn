// Figma: Jodii-Auto-Renewal, node 852:790 — "Payment temporarily restricted!"
// Replaces the plain Alert.alert('Please wait', ...) shown throughout the
// payment screens (NetBankingScreen, CardPaymentScreen, PaymentOptionsScreen,
// PaymentFailedScreen) whenever the 1-hour retry cooldown
// (getRetryRemainingMs()) is still active. Angular: botton-sheet.config.ts's
// alert-circle.svg icon convention (same asset used across its bottom-sheet
// popups) + a fixed single "Ok" CTA, no close (X) — same non-close-button
// shape as a plain confirm dialog.

import { StyleSheet, Text, View } from 'react-native'
import BottomSheet from '../bottom-sheet/BottomSheet'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const ICON_ALERT = CDN + 'assets/images/svg/alert-circle.svg'

type Props = {
  visible:          boolean
  remainingMinutes: number
  onClose:          () => void
}

export default function PaymentRestrictedSheet({ visible, remainingMinutes, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} showClose={false}>
      <View style={s.container}>
        <CdnSvg uri={ICON_ALERT} width={48} height={48} style={s.icon} />
        <Text style={s.title}>Payment temporarily restricted!</Text>
        <Text style={s.subtitle}>
          As per our policy, please retry after{' '}
          <Text style={s.bold}>{remainingMinutes} minutes</Text>
        </Text>
        <ButtonRevamp
          label="Ok"
          variant="primary"
          fullWidth
          style={[s.okBtn, { backgroundColor: Colors.primaryDark }]}
          onPress={onClose}
        />
      </View>
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  container: { width: '100%' },
  icon:      { marginBottom: 24 },
  title: {
    fontFamily:   Fonts.poppinsSemiBold,
    fontSize:     18,
    color:        Colors.black,
    lineHeight:   24,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   14,
    color:      Colors.black,
    lineHeight: 20,
    marginBottom: 32,
  },
  bold: { fontFamily: Fonts.poppinsSemiBold },
  okBtn: {},
})
