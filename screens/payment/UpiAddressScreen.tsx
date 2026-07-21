// Angular: pages/recharge/upi-payment/upi-payment.page.html (lines 239-394) —
// one ion-radio-group holding TWO ion-accordion-groups back to back, so it
// renders as a single visual list: GPay/Paytm/PhonePe rows shown directly,
// followed by one "Other UPI Apps" accordion row that expands INLINE (within
// the same list/card) to reveal everything else detected (CRED, iMobile,
// PayZapp, etc.) — not a separate card below. Tapping any app row opens that
// specific app directly via intent, same native-bridge mechanism used for
// GPay/PhonePe on PaymentOptionsScreen — not just the manual VPA field this
// screen used to be limited to.

import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN, CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import FloatingLabelInput from '../../components/input/FloatingLabelInput'
import {
  getCheckoutDetails, getFinalAmount, getPaymentConfig, getUpiAppList, handlePaymentSuccess,
  initRazorpayNative, initUPIPayment, recordPaymentFailure, stringifyPaymentResponse, toPaise,
  type SelectedPackage, type UpiAppInfo,
} from '../../service/paymentService'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'
const ICON_UPI_GENERIC = CDN + 'assets/images/svg/upi/upi-img-updated.svg'
const ICON_CHEVRON = CDN_REACT + '/menu_right_arrow.svg'

// Angular: upi-payment.page.ts:167-171 — validateUpiAddress()
const VPA_REGEX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/

// Angular's UPIAPPS vs UPIAPPSOther split (upi-payment.page.html:261,335) —
// these three package names show as direct rows; everything else goes under
// the inline "Other UPI Apps" accordion row.
const KNOWN_UPI_APPS: { pkg: string; icon: string }[] = [
  { pkg: 'com.google.android.apps.nbu.paisa.user', icon: CDN + 'assets/images/svg/upi/gpay.svg' },
  { pkg: 'net.one97.paytm',                         icon: CDN + 'assets/images/svg/upi/paytm.svg' },
  { pkg: 'com.phonepe.app',                         icon: CDN + 'assets/images/svg/upi/phonepe.svg' },
]

function iconForApp(packageName: string): string {
  return KNOWN_UPI_APPS.find(a => a.pkg === packageName)?.icon ?? ICON_UPI_GENERIC
}

type Props = { navigation: any; route: any }

export default function UpiAddressScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const selectedPackage: SelectedPackage | undefined = route.params?.selectedPackage
  const amountLabel: string | undefined = route.params?.amountLabel

  const [vpa, setVpa]       = useState('')
  const [touched, setTouched] = useState(false)
  const [paying, setPaying]   = useState(false)

  // Detected installed UPI apps (Android only) — GPay/Paytm/PhonePe shown
  // directly, everything else (CRED, iMobile, PayZapp, etc.) tucked under an
  // inline "Other UPI Apps" row within the SAME card, matching Angular's
  // two-accordion-groups-in-one-list layout. Selecting an app row and
  // filling the manual VPA field are mutually exclusive — only one payment
  // method is active at a time.
  const [topApps, setTopApps]       = useState<UpiAppInfo[]>([])
  const [otherApps, setOtherApps]   = useState<UpiAppInfo[]>([])
  const [showOthers, setShowOthers] = useState(false)
  const [selectedApp, setSelectedApp] = useState<UpiAppInfo | null>(null)
  const [loadingApps, setLoadingApps] = useState(Platform.OS === 'android')

  useEffect(() => {
    if (Platform.OS !== 'android') return
    getUpiAppList().then(apps => {
      const known = apps.filter(a => KNOWN_UPI_APPS.some(k => k.pkg === a.packageName))
      const other = apps.filter(a => !KNOWN_UPI_APPS.some(k => k.pkg === a.packageName))
      setTopApps(known)
      setOtherApps(other)
      setLoadingApps(false)
    }).catch(() => setLoadingApps(false))
  }, [])

  const isValid = VPA_REGEX.test(vpa.trim())
  const errorMessage = touched && !selectedApp && !isValid ? 'Enter a valid UPI ID' : undefined
  const canPay = !!selectedApp || isValid

  function selectApp(app: UpiAppInfo) {
    setSelectedApp(app)
    setVpa('')
    setTouched(false)
  }

  function handleVpaChange(text: string) {
    setVpa(text)
    if (text.length > 0) setSelectedApp(null)
  }

  function handleBack() {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  async function handlePay() {
    setTouched(true)
    if (!canPay || !selectedPackage) return

    setPaying(true)
    try {
      const config  = await getPaymentConfig()
      const saltKey = config.RAZORPAY_KEY_ID ?? ''

      const checkout = await getCheckoutDetails(selectedPackage.PACKAGEID, 'UPI')

      let result: { success: boolean; response: any }
      if (Platform.OS === 'android') {
        result = await initRazorpayNative({
          // Confirmed via a real captured checkout response — it's a FLAT
          // object (getCheckoutDetails() previously returned .RESPONSE, a
          // plain status string, discarding these fields entirely): amount,
          // orderId, customerId, MOBILENO, recurring are top-level, no email.
          amount:      checkout.amount ?? toPaise(getFinalAmount(selectedPackage)),
          orderId:     checkout.orderId ?? '',
          customerId:  checkout.customerId,
          // The checkout response marks recurring:"1" whenever it created a
          // customer-linked order (autopay) — Razorpay needs customer_id
          // included in the submit payload for those orders, or it rejects
          // the order_id as invalid ("the id provided does not exist").
          recurring:   checkout.recurring === '1',
          contact:     checkout.MOBILENO ?? '',
          method:      'upi',
          razorpayKey: saltKey,
          // A specific detected app targets it directly via intent (same as
          // GPay/PhonePe on PaymentOptionsScreen); otherwise fall back to
          // the manually-entered VPA.
          upiAppPackageName: selectedApp?.packageName,
          vpa:               selectedApp ? undefined : vpa.trim(),
        })
      } else {
        result = await initUPIPayment(
          { ...checkout, amount: checkout.amount ?? toPaise(getFinalAmount(selectedPackage)), VPA: vpa.trim() },
          saltKey,
        )
      }

      if (result.success) {
        await handlePaymentSuccess()
      } else {
        const errCode: number = result.response?.code ?? 0
        if (errCode !== 0) {
          await recordPaymentFailure(null, selectedPackage)
          Alert.alert('Payment Failed', stringifyPaymentResponse(result.response))
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Something went wrong. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>Pay using UPI apps</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.subtitle}>Enter existing UPI address</Text>

        <FloatingLabelInput
          label="e.g. abcd@okxyzbank"
          value={vpa}
          onChangeText={handleVpaChange}
          errorMessage={errorMessage}
          variant="text"
          autoCapitalize="none"
          style={s.field}
        />
        <Text style={s.note}>You will receive a request in your UPI app</Text>
        <ButtonRevamp
          label="Submit"
          variant="primary"
          size="medium"
          disabled={!isValid}
          onPress={handlePay}
          style={s.submitBtn}
        />

        {loadingApps && <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 24 }} />}

        {!loadingApps && (topApps.length > 0 || otherApps.length > 0) && (
          <View style={s.appCard}>
            {topApps.map((app, idx) => (
              <Pressable
                key={app.packageName}
                style={[s.appRow, idx === topApps.length - 1 && otherApps.length === 0 && s.appRowLast]}
                onPress={() => selectApp(app)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedApp?.packageName === app.packageName }}
              >
                <View style={s.appRowLeft}>
                  <CdnSvg uri={iconForApp(app.packageName)} width={24} height={24} />
                  <Text style={s.appLabel}>{app.appName}</Text>
                </View>
                <View style={[s.radioCircle, selectedApp?.packageName === app.packageName && s.radioCircleSelected]}>
                  {selectedApp?.packageName === app.packageName && <View style={s.radioDot} />}
                </View>
              </Pressable>
            ))}

            {otherApps.length > 0 && (
              <>
                <Pressable
                  style={[s.appRow, !showOthers && s.appRowLast]}
                  onPress={() => setShowOthers(v => !v)}
                >
                  <View style={s.appRowLeft}>
                    <CdnSvg uri={ICON_UPI_GENERIC} width={24} height={24} />
                    <Text style={s.appLabel}>Other UPI apps</Text>
                  </View>
                  <CdnSvg uri={ICON_CHEVRON} width={16} height={16} />
                </Pressable>
                {showOthers && otherApps.map((app, idx) => (
                  <Pressable
                    key={app.packageName}
                    style={[s.appRow, idx === otherApps.length - 1 && s.appRowLast]}
                    onPress={() => selectApp(app)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selectedApp?.packageName === app.packageName }}
                  >
                    <View style={s.appRowLeft}>
                      <CdnSvg uri={iconForApp(app.packageName)} width={24} height={24} />
                      <Text style={s.appLabel}>{app.appName}</Text>
                    </View>
                    <View style={[s.radioCircle, selectedApp?.packageName === app.packageName && s.radioCircleSelected]}>
                      {selectedApp?.packageName === app.packageName && <View style={s.radioDot} />}
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <ButtonRevamp
          label={amountLabel ? `Pay ${amountLabel}` : 'Pay'}
          variant="primary"
          size="large"
          fullWidth
          loading={paying}
          disabled={touched && !canPay}
          style={{ backgroundColor: Colors.primaryDark }}
          onPress={handlePay}
        />
      </View>
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
  headerTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black, marginLeft: 16, flex: 1 },

  content:  { padding: 16 },
  subtitle: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  field:    { marginBottom: 8 },
  note:     { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textTertiary },
  submitBtn: { alignSelf: 'flex-start', marginTop: 12 },

  appCard: {
    marginTop: 24, backgroundColor: Colors.white, borderRadius: 16, paddingHorizontal: 16,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  appRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 52, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  appRowLast: { borderBottomWidth: 0 },
  appRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flexShrink: 1 },
  appLabel:   { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black },

  radioCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primaryDark },

  footer: { paddingHorizontal: 16, paddingTop: 12 },
})
