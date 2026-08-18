// Debit/Credit card tab (Figma "Jodii Desktop - Registration", nodes
// 759:1083 empty / 536:6776 error / 536:8141 filled). Same field set and
// validation as the mobile CardPaymentScreen.tsx, but submitted differently:
// mobile hands the raw card fields to a native WebView (HostedCheckoutWebViewScreen)
// that POSTs them straight to the bank/gateway's own hosted page —
// react-native-webview has no web build, so here the same {uri, body} from
// getHostedCheckoutRequest() (unchanged, no new endpoint) is submitted via a
// real browser <form> POST in a new tab instead (submitHostedCheckoutFormOnWeb).
//
// IMPORTANT LIMITATION: unlike the native WebView (which can observe the
// hosted page's own JS bridge / navigation redirects to learn the outcome
// definitively), a new browser tab is cross-origin once it reaches the bank's
// page — there is no way for this tab to read its URL or intercept a
// callback. getCheckoutDetails()/checkPaymentStatus() also don't apply here:
// this hosted-checkout method never returns a client-side order id to poll
// (confirmed against getHostedCheckoutRequest()'s contract — it returns a
// form {uri, body}, not an order). So instead of faking a verification
// result, this shows an explicit "come back once you're done" step and lets
// the account state resolve naturally from the backend's own server-side
// webhook by the time the user returns to the app.
import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../../constants/colors'
import FloatingLabelInput, { validateName } from '../../../components/input/FloatingLabelInput'
import ButtonRevamp from '../../../components/button-revamp/ButtonRevamp'
import PaymentRestrictedSheet from '../../../components/payment/PaymentRestrictedSheet'
import { navigate } from '../../../utils/navigationRef'
import {
  getFinalAmount, getHostedCheckoutRequest, getRetryRemainingMs, submitHostedCheckoutFormOnWeb,
  type SelectedPackage,
} from '../../../service/paymentService'
import { Fonts, SemanticFontsEnglish } from '../../../src/theme/fonts'

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1-').replace(/-$/, '')
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

function validateCardNumber(value: string): string | undefined {
  const digits = value.replace(/\D/g, '')
  if (!digits) return 'Card number is required'
  if (digits.length !== 16) return 'Enter a valid 16-digit card number'
  return undefined
}

function validateExpiry(value: string): string | undefined {
  const match = value.match(/^(0[1-9]|1[0-2])\/(\d{2})$/)
  if (!match) return 'Enter a valid expiry date'
  const month = Number(match[1])
  const year  = 2000 + Number(match[2])
  const now = new Date()
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    return 'Enter a valid expiry date'
  }
  return undefined
}

function validateCvv(value: string): string | undefined {
  if (!/^\d{3}$/.test(value)) return 'Enter a valid CVV'
  return undefined
}

type Props = { selectedPackage: SelectedPackage; amountLabel: string }

export default function CardTab({ selectedPackage, amountLabel }: Props) {
  const [name, setName]       = useState('')
  const [cardNumber, setCard] = useState('')
  const [expiry, setExpiry]   = useState('')
  const [cvv, setCvv]         = useState('')
  const [touched, setTouched] = useState(false)
  const [paying, setPaying]   = useState(false)
  const [awaiting, setAwaiting] = useState(false)
  const [restrictedMinutes, setRestrictedMinutes] = useState<number | null>(null)

  const nameError   = touched ? validateName(name) : undefined
  const cardError   = touched ? validateCardNumber(cardNumber) : undefined
  const expiryError = touched ? validateExpiry(expiry) : undefined
  const cvvError    = touched ? validateCvv(cvv) : undefined

  const isValid =
    !validateName(name) && !validateCardNumber(cardNumber) &&
    !validateExpiry(expiry) && !validateCvv(cvv)

  async function handlePay() {
    setTouched(true)
    if (!isValid) return

    setPaying(true)
    try {
      const remainingMs = await getRetryRemainingMs()
      if (remainingMs > 0) {
        setRestrictedMinutes(Math.ceil(remainingMs / 60000))
        return
      }

      const [expiryMonthStr, expiryYearStr] = expiry.split('/')
      const request = await getHostedCheckoutRequest(
        selectedPackage.PACKAGEID,
        getFinalAmount(selectedPackage),
        'card',
        undefined,
        {
          number:      cardNumber.replace(/\D/g, ''),
          expiryMonth: expiryMonthStr ?? '',
          expiryYear:  String(2000 + Number(expiryYearStr)),
          cvv,
        },
      )
      if (!request) {
        Alert.alert('Error', 'Could not start payment. Please try again.')
        return
      }
      submitHostedCheckoutFormOnWeb(request)
      setAwaiting(true)
    } finally {
      setPaying(false)
    }
  }

  if (awaiting) {
    return (
      <View style={s.awaitWrap}>
        <Text style={s.awaitTitle}>Complete your payment in the new tab</Text>
        <Text style={s.awaitBody}>
          We've opened your bank's secure payment page in a new browser tab. Once you've
          finished paying there, come back here.
        </Text>
        <ButtonRevamp
          label="I've completed the payment"
          variant="primary"
          size="large"
          style={{ backgroundColor: Colors.primaryDark }}
          onPress={() => navigate('Matches')}
        />
        <Pressable onPress={() => setAwaiting(false)} hitSlop={8}>
          <Text style={s.awaitBack}>Back to card details</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Debit / Credit card</Text>

      <FloatingLabelInput
        label="16-Digit card number"
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
          label="Expiry date"
          value={expiry}
          onChangeText={text => setExpiry(formatExpiry(text))}
          errorMessage={expiryError}
          variant="text"
          keyboardType="number-pad"
          maxLength={5}
          style={[s.field, s.rowField]}
        />
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
      <FloatingLabelInput
        label="Name on card"
        value={name}
        onChangeText={setName}
        errorMessage={nameError}
        variant="name"
        style={s.field}
      />

      <ButtonRevamp
        label={amountLabel ? `Pay ${amountLabel}` : 'Pay'}
        variant="primary"
        size="large"
        loading={paying}
        style={[{ backgroundColor: Colors.primaryDark }, s.payBtn]}
        onPress={handlePay}
      />

      <PaymentRestrictedSheet
        visible={restrictedMinutes != null}
        remainingMinutes={restrictedMinutes ?? 0}
        onClose={() => setRestrictedMinutes(null)}
      />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  wrap: { gap: 8 },

  title: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, marginBottom: 8 },

  field:    { marginBottom: 8 },
  row:      { flexDirection: 'row', gap: 12 },
  rowField: { flex: 1 },

  payBtn: { alignSelf: 'flex-start', marginTop: 8, minWidth: 200 },

  awaitWrap: { gap: 16, paddingVertical: 24, alignItems: 'center' },
  awaitTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, textAlign: 'center' },
  awaitBody: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20, maxWidth: 360,
  },
  awaitBack: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 13, color: Colors.link, marginTop: 4 },
})
