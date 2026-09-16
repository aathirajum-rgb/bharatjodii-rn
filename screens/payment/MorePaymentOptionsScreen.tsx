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
  Alert, Image, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'
import { File, Paths } from 'expo-file-system'
import { Colors } from '../../constants/colors'
import { CDN, CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import LinkCTA from '../../components/link-cta/LinkCTA'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'
import { handleBack as handleRootBack } from '../../utils/navigationRef'
import { useNetwork } from '../../contexts/NetworkContext'
import {
  checkQrPaymentOutcome, generatePaymentLink, getFinalAmount, getPaymentConfig, getQRPaymentData,
  getRechargeHelpline, getUpiAppList, handlePaymentSuccess, recordPaymentFailure,
  type PaymentMethodItem, type QRPaymentData, type SelectedPackage,
} from '../../service/paymentService'

const ICON_BACK    = CDN_REACT + '/menu_back_arrow.svg'
const ICON_CHEVRON = CDN_REACT + '/menu_right_arrow.svg'
const ICON_WHATSAPP = CDN + 'assets/images/svg/whatsapp-green-icon.svg'
const QR_LOGO       = CDN + 'assets/images/png/logo-icon.png'
// Angular: .bottom-right-design (global.scss:5842) — same rangoli decoration
// as CardPaymentScreen's footer, position fixed/right 0/bottom 0/z-index -1.
const ICON_BOTTOM_DESIGN = CDN + 'assets/images/svg/reg-btm-img.svg'

// Angular: delayQR() — checked once, 2 minutes after the QR is shown.
const QR_OUTCOME_DELAY_MS = 120000

// Angular: <img [src]="common.ImgDomain() + item.IMG"> — PAYMENTMETHODS icon
// paths come back relative to the CDN root, not as absolute URLs.
function resolveIcon(path: string): string {
  return /^https?:\/\//.test(path) ? path : CDN + path
}

type Props = { navigation: any; route: any }

export default function MorePaymentOptionsScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation()
  const insets = useSafeAreaInsets()
  const { isOffline } = useNetwork()
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
    if (navigation.canGoBack()) handleRootBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  // Angular: promotions.component.ts confirmationPopUP() — a second "someone
  // else can pay for me" option alongside the QR flow above, standalone here
  // (not gated on the legacy RPAYFLAG browser-compatibility check the old app
  // used it as a substitute for — see generatePaymentLink()'s header comment).
  function handleSharePaymentLink() {
    if (!selectedPackage) return
    // Defense-in-depth alongside the global OfflineScreen overlay — don't
    // start the link-generation call while offline.
    if (isOffline) { Alert.alert('Error', t('GENERAL.NOINTERNET')); return }
    Alert.alert(
      'Share a payment link',
      'Generate a payment link so a family member or friend can pay for you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate link',
          onPress: async () => {
            const ok = await generatePaymentLink(selectedPackage.PACKAGEID, getFinalAmount(selectedPackage))
            Alert.alert(
              ok ? 'Done' : 'Error',
              ok
                ? 'A payment link has been generated. The recipient will be notified to complete the payment.'
                : 'Could not generate a payment link. Please try again.',
            )
          },
        },
      ],
    )
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
        <Text style={s.headerTitle} numberOfLines={1}>{t('RECHARGE.MOREOPTION')}</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {methods.map(item => (
          <Pressable
            key={item.KEY}
            style={s.row}
            onPress={() => handlePress(item)}
            accessibilityRole="button"
          >
            <View style={s.iconBox}>
              <CdnSvg uri={resolveIcon(item.IMG)} width={24} height={24} />
            </View>
            {/* Angular: the divider border lives on <ion-item> (payment-mode-
                labels col), which wraps only the label + chevron — the icon is
                a separate column outside it — so the line starts at the text,
                not under the icon. Angular never strips the border on the
                last row (no last-child rule on .payment-mode-labels ion-item),
                so it shows on every row including the final one. */}
            <View style={s.rowText}>
              {/* Angular: more-payment-option.page.html (unlike payment-mode.
                  page.html's PAGE_ID==1 rows) labels via pageContent[item?.KEY]
                  — the local i18n string keyed by KEY — not item.NAME from the
                  API. i18nExists guards KEY values without a RECHARGE.<KEY>
                  translation, falling back to the API's own NAME so nothing
                  renders blank. */}
              <Text style={s.rowLabel}>
                {i18n.exists(`RECHARGE.${item.KEY}`) ? t(`RECHARGE.${item.KEY}`) : item.NAME}
              </Text>
              <CdnSvg uri={ICON_CHEVRON} width={20} height={20} />
            </View>
          </Pressable>
        ))}

        {!!helpline && (
          <LinkCTA
            text={t('RECHARGE.NEED_HELP_CONTENT')}
            contact={helpline}
            onPress={() => Linking.openURL(`tel:${helpline}`)}
            style={s.helpline}
          />
        )}

        {!!qrData?.qrValue && (
          <View style={s.qrCard}>
            <Text style={s.qrTitle}>{t('RECHARGE.PAY_AMT_FOR_YOU')}</Text>

            <View style={s.qrImageWrap}>
              <QRCode value={qrData.qrValue} size={220} logo={{ uri: QR_LOGO }} logoSize={44} logoBorderRadius={22} />
            </View>

            {/* Angular: [innerHTML]="pageContent['SHARE_QR_CODE']" — the string
                carries literal <br> tags; split them into RN line breaks. */}
            <Text style={s.qrNote}>
              {t('RECHARGE.SHARE_QR_CODE').split(/<br\s*\/?>/i).map((line, i, arr) => (
                <Text key={i}>
                  {line.trim()}
                  {i < arr.length - 1 ? '\n' : ''}
                </Text>
              ))}
            </Text>

            {!!qrData.whatsappMsg && (
              <Pressable style={s.whatsappBtn} onPress={shareQrOnWhatsApp}>
                <CdnSvg uri={ICON_WHATSAPP} width={20} height={20} />
                <Text style={s.whatsappLabel}>{t('RECHARGE.WHATSAPP_CTA')}</Text>
              </Pressable>
            )}
          </View>
        )}

        {!!selectedPackage && (
          <Pressable style={s.payLinkRow} onPress={handleSharePaymentLink}>
            <Text style={s.payLinkLabel}>Ask someone to pay for you</Text>
            <CdnSvg uri={ICON_CHEVRON} width={20} height={20} />
          </Pressable>
        )}
      </ScrollView>

      {/* Angular: .bottom-right-design (global.scss:5842) — position fixed,
          right 0, bottom 0, z-index -1; same rangoli as CardPaymentScreen. */}
      <Image
        source={{ uri: ICON_BOTTOM_DESIGN }}
        style={s.bottomDesign}
        resizeMode="contain"
      />
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  // Angular: .hide-header-bar.header-md::after { height: 0 } (global.scss:
  // 2737) — this page explicitly zeroes Ionic's default header shadow/border,
  // so no shadow here.
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    backgroundColor: Colors.white,
  },
  // Angular: .hide-header-bar .header-title (global.scss:2741) — english-
  // regular-poppins at font20 (20px), color gray-color1 #1f1e1b (not semibold
  // 16px black).
  headerTitle: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font20, color: '#1f1e1b',
    marginLeft: 16, flex: 1,
  },

  content: { padding: 16 },

  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
    minHeight:     64,
  },
  // Angular: the border lives on <ion-item> (payment-mode-labels column),
  // which wraps only the label + chevron — the icon is a separate column
  // outside it — so the divider starts at the text, not under the icon.
  rowText: {
    flex: 1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    minHeight:      64,
    // ADJUSTABLE — divider thickened past Angular's Ionic-default hairline
    // border per user request.
    borderBottomWidth: 1.35,
    borderBottomColor: Colors.divider,
  },
  iconBox: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  // Angular: .payment-mode-labels ion-label — color #1F1F1F (not pure black).
  rowLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font16, color: '#1F1F1F' },

  helpline: { marginTop: 32 },

  qrCard: {
    marginTop: 32, alignItems: 'center', gap: 16, padding: 20, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  qrTitle: {
    fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font16, color: Colors.black, textAlign: 'center',
  },
  qrImageWrap: { padding: 8, backgroundColor: Colors.white, borderRadius: 8 },
  // Angular: .qr-3-sub (more-payment-option.page.scss) — color #1f1f1f, the
  // same dark near-black used for rowLabel above, not the lighter
  // textSecondary grey (#666666).
  qrNote: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font13, color: '#1F1F1F',
    textAlign: 'center', lineHeight: 20,
  },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.borderNeutral, borderRadius: 24,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  whatsappLabel: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: FontSize.font14, color: Colors.black },

  payLinkRow: {
    marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 16, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  payLinkLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black },

  // Angular: .bottom-right-design — position fixed, right 0, bottom 0,
  // z-index -1. Same SVG/treatment as CardPaymentScreen's footer rangoli.
  bottomDesign: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 149,
    height: 162,
    opacity: 1,
    zIndex: -1,
  },
})
