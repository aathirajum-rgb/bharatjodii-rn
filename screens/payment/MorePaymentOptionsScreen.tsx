// Angular: pages/recharge/more-payment-option/more-payment-option.page.html
// + .ts — a DEDICATED screen reached by tapping "Other payment modes"
// (OTHERMODES key) on payment-mode (PaymentOptionsScreen), NOT rows shown
// inline on that screen. Filters the SAME PAYMENTMETHODS list by
// item.PAGE_ID==2 (Net Banking / NEFT-RTGS-Pay at Bank / Pay at our stores),
// plus a "Need help in making payment?" contact link, plus (Angular:
// enableQR()) a QR-code + WhatsApp-share block letting a family member/
// friend pay on the user's behalf.

import { useEffect, useRef, useState } from 'react'
import {
  Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'
import { File, Paths } from 'expo-file-system'
import { Colors } from '../../constants/colors'
import { CDN, CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import LinkCTA from '../../components/link-cta/LinkCTA'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import {
  checkQrPaymentOutcome, getPaymentConfig, getQRPaymentData, getRechargeHelpline, getUpiAppList,
  handlePaymentSuccess, recordPaymentFailure, type PaymentMethodItem, type QRPaymentData,
  type SelectedPackage,
} from '../../service/paymentService'

const ICON_BACK    = CDN_REACT + '/menu_back_arrow.svg'
const ICON_CHEVRON = CDN_REACT + '/menu_right_arrow.svg'
const ICON_WHATSAPP = CDN + 'assets/images/svg/whatsapp-green-icon.svg'
const QR_LOGO       = CDN + 'assets/images/png/logo-icon.png'

// Angular: delayQR() — checked once, 2 minutes after the QR is shown.
const QR_OUTCOME_DELAY_MS = 120000

// Angular: <img [src]="common.ImgDomain() + item.IMG"> — PAYMENTMETHODS icon
// paths come back relative to the CDN root, not as absolute URLs.
function resolveIcon(path: string): string {
  return /^https?:\/\//.test(path) ? path : CDN + path
}

type Props = { navigation: any; route: any }

export default function MorePaymentOptionsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const selectedPackage: SelectedPackage | undefined = route.params?.selectedPackage
  const amountLabel: string | undefined = route.params?.amountLabel

  const [methods, setMethods] = useState<PaymentMethodItem[]>([])
  const [helpline, setHelpline] = useState('')
  const [qrData, setQrData] = useState<QRPaymentData | null>(null)
  const outcomeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getPaymentConfig().then(config => {
      const list = (config.PAYMENTMETHODS ?? []).filter(m => Number(m.PAGE_ID) === 2)
      setMethods(list)
      loadQrSection(config.QRCODEFLAG === '1')
    })
    getRechargeHelpline().then(setHelpline)

    return () => { if (outcomeTimer.current) clearTimeout(outcomeTimer.current) }
  }, [])

  // Angular: more-payment-option.page.ts enableQR() — only shown when the
  // user has at least one UPI app installed, a package is selected, and the
  // backend has QRCODEFLAG on; 2 minutes after showing it, silently check
  // whether the friend/family member already paid (delayQR()).
  async function loadQrSection(qrCodeEnabled: boolean) {
    if (Platform.OS !== 'android' || !selectedPackage || !qrCodeEnabled) return
    const apps = await getUpiAppList()
    if (apps.length === 0) return

    const data = await getQRPaymentData(selectedPackage.PACKAGEID)
    if (!data.qrValue) return
    setQrData(data)

    outcomeTimer.current = setTimeout(async () => {
      const outcome = await checkQrPaymentOutcome(data.qrOrderId, data.upiOrderId)
      if (outcome === 'success') await handlePaymentSuccess()
      else if (outcome === 'failure') await recordPaymentFailure(null, selectedPackage)
    }, QR_OUTCOME_DELAY_MS)
  }

  // Angular: more-payment-option.page.ts shareQR() → native bridge event
  // "OpenwhatsappWithContent" → Constants.openWhatsappWithIntent() —
  // downloads QRIMG (a separate server-hosted QR PNG, not a snapshot of the
  // on-screen qrValue) to a local file, then fires an ACTION_SEND intent
  // pinned to com.whatsapp with the image attached (EXTRA_STREAM) alongside
  // the text (EXTRA_TEXT). Not sent to a fixed contact — the old intent's
  // mobileNo param is unused, WhatsApp shows its own chat picker.
  async function shareQrOnWhatsApp() {
    if (!qrData?.whatsappMsg) return

    let imageUri: string | undefined
    if (qrData.qrImg) {
      try {
        imageUri = (await File.downloadFileAsync(qrData.qrImg, Paths.cache)).uri
      } catch {
        imageUri = undefined
      }
    }

    // react-native-share has no web implementation — its module throws
    // ("NativeRNShare... getEnforcing") the moment it's imported, so it's
    // loaded lazily here rather than statically at the top of the file
    // (this whole QR section is Android-only anyway, see loadQrSection()).
    if (Platform.OS === 'android') {
      try {
        const { default: RNShare, Social } = await import('react-native-share')
        await RNShare.shareSingle({
          social:  Social.Whatsapp,
          message: qrData.whatsappMsg,
          ...(imageUri ? { url: imageUri, type: 'image/png' } : {}),
        })
        return
      } catch {
        // WhatsApp not installed, user cancelled, or the share failed — fall
        // through to a plain text share so the link still gets through.
      }
    }
    Share.share({ message: qrData.whatsappMsg }).catch(() => {})
  }

  function handleBack() {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  // Angular: more-payment-option.page.ts onClickPaymentModes()
  function handlePress(item: PaymentMethodItem) {
    const params = { selectedPackage, amountLabel }
    switch (item.KEY) {
      case 'NETBANKING': navigation.navigate('net-banking', params); break
      case 'NEFT':       navigation.navigate('neft-rtgs', params); break
      case 'PAYATSTORE': navigation.navigate('pay-at-store', params); break
      case 'DEBITCARD':  navigation.navigate('card-payment', params); break
      default:           Alert.alert(item.NAME, 'This payment mode is coming soon.')
    }
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>More Payment Options</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {methods.map((item, idx) => (
          <Pressable
            key={item.KEY}
            style={[s.row, idx === methods.length - 1 && s.rowLast]}
            onPress={() => handlePress(item)}
            accessibilityRole="button"
          >
            <View style={s.rowLeft}>
              <View style={s.iconBox}>
                <CdnSvg uri={resolveIcon(item.IMG)} width={24} height={24} />
              </View>
              <Text style={s.rowLabel}>{item.NAME}</Text>
            </View>
            <CdnSvg uri={ICON_CHEVRON} width={20} height={20} />
          </Pressable>
        ))}

        {!!helpline && (
          <LinkCTA
            text="Need help in making payment?"
            contact={helpline}
            onPress={() => Linking.openURL(`tel:${helpline}`)}
            style={s.helpline}
          />
        )}

        {!!qrData?.qrValue && (
          <View style={s.qrCard}>
            <Text style={s.qrTitle}>Request a family member or friend to pay for you?</Text>

            <View style={s.qrImageWrap}>
              <QRCode value={qrData.qrValue} size={220} logo={{ uri: QR_LOGO }} logoSize={44} logoBorderRadius={22} />
            </View>

            <Text style={s.qrNote}>
              Share the payment link & QR code with your family member/friend{'\n'}or{'\n'}
              Scan the QR code to pay for your Jodii membership
            </Text>

            {!!qrData.whatsappMsg && (
              <Pressable style={s.whatsappBtn} onPress={shareQrOnWhatsApp}>
                <CdnSvg uri={ICON_WHATSAPP} width={20} height={20} />
                <Text style={s.whatsappLabel}>Share profile on WhatsApp</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, marginLeft: 16, flex: 1 },

  content: { padding: 16 },

  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    minHeight:      64,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 16, flexShrink: 1 },
  iconBox: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 16, color: Colors.black },

  helpline: { marginTop: 32 },

  qrCard: {
    marginTop: 32, alignItems: 'center', gap: 16, padding: 20, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  qrTitle: {
    fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, textAlign: 'center',
  },
  qrImageWrap: { padding: 8, backgroundColor: Colors.white, borderRadius: 8 },
  qrNote: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.borderNeutral, borderRadius: 24,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  whatsappLabel: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 14, color: Colors.black },
})
