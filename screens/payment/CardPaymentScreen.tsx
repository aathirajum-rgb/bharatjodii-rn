// Angular: pages/recharge/pay-using-credit-debit/pay-using-credit-debit.page.html + .ts
// — reached by tapping "Debit/Credit cards" on payment-mode (PaymentOptionsScreen).
//
// Architecture note: Angular's form submits raw card fields (number/expiry/cvv)
// through a native bridge straight to the payment gateway — that's how the old
// hybrid WebView app worked. On Android this form now does the same thing via
// RazorpayBridge (Razorpay's Custom Integration SDK, com.razorpay:customui),
// which accepts a raw card payload directly — see RazorpayWebView.kt. iOS has
// no Razorpay native bridge yet (out of scope for now), so it still falls back
// to react-native-razorpay's own secure card-entry UI, where this form's
// fields are only for UX/validation parity with Angular, not transmitted.

import { useEffect, useState } from 'react'
import {
  Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import FloatingLabelInput, { validateName } from '../../components/input/FloatingLabelInput'
import LinkCTA from '../../components/link-cta/LinkCTA'
import {
  getCheckoutDetails, getFinalAmount, getPaymentConfig, getRechargeHelpline, getRetryRemainingMs,
  handlePaymentSuccess, initRazorpayNative, initRazorpayPayment, recordPaymentFailure,
  stringifyPaymentResponse, toPaise, verifyPaymentSuccess, type SelectedPackage,
} from '../../service/paymentService'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

// Angular: pay-using-credit-debit.page.ts:68 — Validators.pattern("^[0-9 \\-]{19}$")
// i.e. 16 digits displayed as 4 hyphen-separated groups (XXXX-XXXX-XXXX-XXXX).
function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1-').replace(/-$/, '')
}

// Angular: filterExpiryDate() (.ts:267-326) — auto-inserts '/' after MM, then
// validates the combined value isn't before the current month.
function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

function validateCardNumber(value: string): string | undefined {
  const digits = value.replace(/\D/g, '')
  if (!digits) return 'Card number is required'
  if (digits.length !== 16) return 'Enter a valid card number'
  return undefined
}

function validateExpiry(value: string): string | undefined {
  const match = value.match(/^(0[1-9]|1[0-2])\/(\d{2})$/)
  if (!match) return 'Enter a valid expiry date'
  const month = Number(match[1])
  const year  = 2000 + Number(match[2])
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear  = now.getFullYear()
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return 'Enter a valid expiry date'
  }
  return undefined
}

function validateCvv(value: string): string | undefined {
  if (!/^\d{3}$/.test(value)) return 'Enter a valid CVV'
  return undefined
}

type Props = { navigation: any; route: any }

export default function CardPaymentScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const selectedPackage: SelectedPackage | undefined = route.params?.selectedPackage
  const amountLabel: string | undefined = route.params?.amountLabel

  const [name, setName]         = useState('')
  const [cardNumber, setCard]   = useState('')
  const [expiry, setExpiry]     = useState('')
  const [cvv, setCvv]           = useState('')
  const [touched, setTouched]   = useState(false)
  const [paying, setPaying]     = useState(false)
  const [helpline, setHelpline] = useState('')

  useEffect(() => { getRechargeHelpline().then(setHelpline) }, [])

  const nameError   = touched ? validateName(name) : undefined
  const cardError   = touched ? validateCardNumber(cardNumber) : undefined
  const expiryError = touched ? validateExpiry(expiry) : undefined
  const cvvError    = touched ? validateCvv(cvv) : undefined

  const isValid =
    !validateName(name) && !validateCardNumber(cardNumber) &&
    !validateExpiry(expiry) && !validateCvv(cvv)

  function handleBack() {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  async function handlePay() {
    setTouched(true)
    if (!isValid || !selectedPackage) return

    const remainingMs = await getRetryRemainingMs()
    if (remainingMs > 0) {
      const mins = Math.ceil(remainingMs / 60000)
      Alert.alert('Please wait', `You can retry payment in about ${mins} minute${mins === 1 ? '' : 's'}.`)
      return
    }

    setPaying(true)
    try {
      const config  = await getPaymentConfig()
      const saltKey = config.RAZORPAY_KEY_ID ?? ''

      const checkout = await getCheckoutDetails(selectedPackage.PACKAGEID, 'CARD')

      let result: { success: boolean; response: any }
      if (Platform.OS === 'android') {
        const [expiryMonthStr, expiryYearStr] = expiry.split('/')
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
          method:      'card',
          razorpayKey: saltKey,
          name,
          cardNumber:  cardNumber.replace(/\D/g, ''),
          expiryMonth: Number(expiryMonthStr),
          expiryYear:  2000 + Number(expiryYearStr),
          cvv,
        })
      } else {
        result = await initRazorpayPayment({ ...checkout, amount: checkout.amount ?? toPaise(getFinalAmount(selectedPackage)) }, 'CARD', saltKey)
      }

      if (result.success) {
        const verified = await verifyPaymentSuccess(result.response, checkout.orderId)
        if (verified) {
          await handlePaymentSuccess()
        } else {
          await recordPaymentFailure(null, selectedPackage, {
            status: 'pending', retryRoute: 'card-payment', retryParams: route.params,
          })
          navigation.navigate('payment-failed', {
            selectedPackage, amountLabel, status: 'pending', orderId: checkout.orderId,
            retryRoute: 'card-payment', retryParams: route.params,
          })
        }
      } else {
        const errCode: number = result.response?.code ?? 0
        if (errCode !== 0) {
          const reason = stringifyPaymentResponse(result.response)
          await recordPaymentFailure(null, selectedPackage, {
            status: 'failure', reason, retryRoute: 'card-payment', retryParams: route.params,
          })
          navigation.navigate('payment-failed', {
            selectedPackage, amountLabel, status: 'failure', reason,
            retryRoute: 'card-payment', retryParams: route.params,
          })
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
        <Text style={s.headerTitle} numberOfLines={1}>Payment options</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={s.subtitle}>Pay using Credit/Debit Card</Text>

        <FloatingLabelInput
          label="Name on the card"
          value={name}
          onChangeText={setName}
          errorMessage={nameError}
          variant="name"
          style={s.field}
        />
        <FloatingLabelInput
          label="Card number"
          value={cardNumber}
          onChangeText={text => setCard(formatCardNumber(text))}
          errorMessage={cardError}
          variant="text"
          keyboardType="number-pad"
          maxLength={19}
          style={s.field}
        />
        <View style={s.row}>
          <FloatingLabelInput
            label="MM/YY"
            value={expiry}
            onChangeText={text => setExpiry(formatExpiry(text))}
            errorMessage={expiryError}
            variant="text"
            keyboardType="number-pad"
            maxLength={5}
            style={[s.field, s.rowField]}
          />
          {/* Angular: CVV is masked (input type=password) with no way to reveal —
              the reveal-toggle button markup is commented out/dead in Angular's
              own template. variant="text" here (not "password") to skip
              FloatingLabelInput's Show/Hide affordance, which doesn't fit this
              field's width and doesn't exist in the live Angular UI anyway. */}
          <FloatingLabelInput
            label="CVV"
            value={cvv}
            onChangeText={text => setCvv(text.replace(/\D/g, '').slice(0, 3))}
            errorMessage={cvvError}
            variant="text"
            keyboardType="number-pad"
            maxLength={3}
            style={[s.field, s.rowField]}
          />
        </View>

        {/* Android submits these fields directly via RazorpayBridge (no second
            entry screen). iOS still falls back to react-native-razorpay's own
            secure card-entry screen, which can't accept a raw card number
            from the app — telling the user up front avoids the confusing
            experience of being asked for the same card twice unexplained. */}
        {Platform.OS !== 'android' && (
          <Text style={s.confirmNote}>You'll confirm your card details securely on the next screen</Text>
        )}

        {!!helpline && (
          <LinkCTA
            text="Need help in making payment?"
            contact={helpline}
            onPress={() => Linking.openURL(`tel:${helpline}`)}
            style={s.helpLink}
          />
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <ButtonRevamp
          label={amountLabel ? `Pay ${amountLabel}` : 'Pay'}
          variant="primary"
          size="large"
          fullWidth
          loading={paying}
          disabled={touched && !isValid}
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

  content:  { padding: 16, gap: 8 },
  subtitle: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },

  field:    { marginBottom: 8 },
  row:      { flexDirection: 'row', gap: 12 },
  rowField: { flex: 1 },

  confirmNote: {
    fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textTertiary,
    textAlign: 'center', marginTop: 16,
  },
  helpLink: { marginTop: 24 },

  footer: { paddingHorizontal: 16, paddingTop: 12 },
})
