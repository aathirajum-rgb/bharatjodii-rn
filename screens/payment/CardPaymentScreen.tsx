// Angular: pages/recharge/pay-using-credit-debit/pay-using-credit-debit.page.html + .ts
// — reached by tapping "Debit/Credit cards" on payment-mode (PaymentOptionsScreen).
//
// Card is a hosted-webview flow, not a native-SDK order submission — see
// HostedCheckoutWebViewScreen.tsx. Same nbpaymentcheckout endpoint and bridge
// callback as Netbanking (matching the old native Android app's
// PaymentWebviewActivity design), so the checkout call, form submission, and
// verification all happen on that screen instead — this screen only collects
// the raw card fields and hands them off.

import { useEffect, useState } from 'react'
import {
  Linking, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import FloatingLabelInput, { validateName } from '../../components/input/FloatingLabelInput'
import LinkCTA from '../../components/link-cta/LinkCTA'
import PaymentRestrictedSheet from '../../components/payment/PaymentRestrictedSheet'
import { Fonts } from '../../src/theme/fonts'
import {
  getFinalAmount, getRechargeHelpline, getRetryRemainingMs, type SelectedPackage,
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
  const [restrictedMinutes, setRestrictedMinutes] = useState<number | null>(null)

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

    setPaying(true)
    try {
      const remainingMs = await getRetryRemainingMs()
      if (remainingMs > 0) {
        setRestrictedMinutes(Math.ceil(remainingMs / 60000))
        return
      }

      const [expiryMonthStr, expiryYearStr] = expiry.split('/')
      navigation.navigate('hosted-checkout', {
        selectedPackage,
        amountLabel,
        method: 'card',
        card: {
          number:      cardNumber.replace(/\D/g, ''),
          expiryMonth: expiryMonthStr,
          expiryYear:  String(2000 + Number(expiryYearStr)),
          cvv,
        },
        amount:      getFinalAmount(selectedPackage),
        retryRoute:  'card-payment',
        retryParams: route.params,
      })
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

      <PaymentRestrictedSheet
        visible={restrictedMinutes != null}
        remainingMinutes={restrictedMinutes ?? 0}
        onClose={() => setRestrictedMinutes(null)}
      />
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

  content:  { padding: 16, gap: 8 },
  subtitle: { fontFamily: Fonts.poppinsMedium, fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },

  field:    { marginBottom: 8 },
  row:      { flexDirection: 'row', gap: 12 },
  rowField: { flex: 1 },

  helpLink: { marginTop: 24 },

  footer: { paddingHorizontal: 16, paddingTop: 12 },
})
