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
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT, CDN_SVG } from '../../constants/cdn'
import { useTranslation } from 'react-i18next'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import FloatingLabelInput, { validateName } from '../../components/input/FloatingLabelInput'
import { handleBack as handleRootBack } from '../../utils/navigationRef'
import PaymentRestrictedSheet from '../../components/payment/PaymentRestrictedSheet'
import { getSessionValue } from '../../service/registrationService'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import {
  getFinalAmount, getRetryRemainingMs, type SelectedPackage,
} from '../../service/paymentService'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'
// Angular: pay-using-credit-debit.page.html:58 / :84 — decorative glyphs sat
// at the right edge of the Card number and CVV fields. CDN-only assets; they
// are not in the Angular repo's local asset tree.
const ICON_CARD_NUMBER = CDN_SVG + 'enter-card-number-img.svg'
const ICON_CVV         = CDN_SVG + 'enter-cvv-img.svg'
// Angular: .bottom-right-design's <img src="...reg-btm-img.svg"> — the app-wide
// bottom-right ornament, also live on more-payment-option and managephoto.
const ICON_BOTTOM_DESIGN = CDN_SVG + 'reg-btm-img.svg'

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
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const selectedPackage: SelectedPackage | undefined = route.params?.selectedPackage
  const amountLabel: string | undefined = route.params?.amountLabel

  const [name, setName]         = useState('')
  const [cardNumber, setCard]   = useState('')
  const [expiry, setExpiry]     = useState('')
  const [cvv, setCvv]           = useState('')
  const [paying, setPaying]     = useState(false)
  const [restrictedMinutes, setRestrictedMinutes] = useState<number | null>(null)

  // Angular: pay-using-credit-debit.page.ts:64 — `this.NAME =
  // localStorage.getItem('NAME')` runs on init and is two-way bound to the
  // field ([(ngModel)]="NAME"), so "Name on the card" arrives pre-filled with
  // the logged-in member's name rather than empty. Still editable.
  //
  // RN equivalent: `NAME` is written into the USER_SESSION blob at login
  // (registrationService.ts's storeWebURLData/SCALAR_KEYS, populated right
  // after OTP verification in OTPScreen.tsx) — the same moment/shape Angular's
  // bulk localvalueArr write covers. ViewProfileScreen.tsx already reads the
  // viewer's own name the same way via getSessionValue('NAME').
  // StorageKeys.User.NAME / storageService.getItem is a DIFFERENT, unrelated,
  // dead key — nothing in the app ever writes to it, which is why that first
  // attempt at this left the field empty.
  useEffect(() => {
    let cancelled = false
    getSessionValue('NAME').then(stored => {
      if (!cancelled && stored) setName(String(stored))
    })
    return () => { cancelled = true }
  }, [])


  // Angular gates each message on `value.length > 0 && control.invalid` — the
  // text appears as soon as there's partial input, not on submit (the Pay
  // button is disabled while invalid, so a submit-gated message could never
  // show). Angular renders a message for Card number and Expiry only; CVV and
  // Name get the red border but no text.
  const cardError   = cardNumber.length > 0 ? validateCardNumber(cardNumber) : undefined
  const expiryError = expiry.length > 0     ? validateExpiry(expiry)         : undefined

  const isValid =
    !validateName(name) && !validateCardNumber(cardNumber) &&
    !validateExpiry(expiry) && !validateCvv(cvv)

  function handleBack() {
    if (navigation.canGoBack()) handleRootBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  async function handlePay() {
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

      {/* Angular: this heading lives in the ion-header (not the content), in its
          own <ion-row class="ion-cust-padding-start"> — so it sits BELOW the
          header's bottom border with the grid's 24px left padding and the
          ion-col's own vertical padding. .heading-03-bold-20 has no English
          definition (it exists only inside per-language blocks), so in English
          it inherits the body font at the rem-scaled base size. */}
      <Text style={s.pageTitle}>{t('RECHARGE.PAYUSINGDEBIT')}</Text>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>
        {/* Angular: pay-using-credit-debit.page.html:51-101 — the DOM order is
            Card number (size 12) → MM/YY (6.5) → CVV (5.1, offset .4) → Name
            on the card (12). This port had Name first. Card number and CVV
            each carry a decorative icon at the field's right edge; MM/YY and
            Name have none. */}
        <FloatingLabelInput
          label={t('RECHARGE.CARDNO')}
          value={cardNumber}
          onChangeText={text => setCard(formatCardNumber(text))}
          errorMessage={cardError}
          invalid={!!validateCardNumber(cardNumber)}
          shape="card"
          variant="text"
          keyboardType="number-pad"
          maxLength={19}
          trailingIcon={ICON_CARD_NUMBER}
          style={s.field}
        />
        <View style={s.row}>
          <FloatingLabelInput
            label={t('RECHARGE.EXPIRY_PLACEHOLDER')}
            value={expiry}
            onChangeText={text => setExpiry(formatExpiry(text))}
            errorMessage={expiryError}
            invalid={!!validateExpiry(expiry)}
            shape="card"
            variant="text"
            keyboardType="number-pad"
            maxLength={5}
            style={[s.field, s.expiryField]}
          />
          {/* Angular: CVV is masked (input type=password) with no way to reveal —
              the reveal-toggle button markup is commented out/dead in Angular's
              own template. variant="text" here (not "password") to skip
              FloatingLabelInput's Show/Hide affordance, which doesn't fit this
              field's width and doesn't exist in the live Angular UI anyway. */}
          <FloatingLabelInput
            label={t('RECHARGE.CVV')}
            value={cvv}
            onChangeText={text => setCvv(text.replace(/\D/g, '').slice(0, 3))}
              invalid={!!validateCvv(cvv)}
            shape="card"
            variant="text"
            keyboardType="number-pad"
            maxLength={3}
            trailingIcon={ICON_CVV}
            style={[s.field, s.cvvField]}
          />
        </View>

        {/* Angular: name's only validator is symbolsOnly — NOT required (.ts:72)
            — so an empty name is valid and its border stays grey, unlike the
            other three fields which are red until filled. */}
        <FloatingLabelInput
          label={t('RECHARGE.NAME_CARD')}
          value={name}
          onChangeText={setName}
          invalid={name.length > 0 && !!validateName(name)}
          shape="card"
          variant="name"
          style={s.field}
        />

        {/* Angular: pay-using-credit-debit.page.html contains NO app-link-cta —
            the helpline row does not appear on the card page at all. */}
      </ScrollView>

      {/* Angular: .bottom-right-design (global.scss:5842) — position fixed,
          right 0, bottom 0, z-index -1, rendered at the SVG's intrinsic
          149.12x162.205 with the file's own 0.35 group opacity. It sits behind
          the footer, so it's declared before it and given no pointer events. */}
      <Image
        source={{ uri: ICON_BOTTOM_DESIGN }}
        style={s.bottomDesign}
        resizeMode="contain"
      />

      {/* Angular: <ion-footer class="ion-no-border bg-white"> with the row's
          .ion-cust-padding-start/end (24px), .pt-24 and .pb-16 — a plain white
          bar, no radius, no shadow, no top border. */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        {/* Rendered directly rather than via ButtonRevamp: Angular's disabled
            label is WHITE, not grey — the <span class="white-color"> beats the
            button's own --color: #B0B0B0 — and ButtonRevamp hardcodes a grey
            disabled label that the `style` prop can't reach. */}
        <Pressable
          onPress={handlePay}
          disabled={!isValid || paying}
          style={({ pressed }) => [
            s.payBtn,
            !isValid && s.payBtnDisabled,
            pressed && isValid && s.payBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !isValid }}
        >
          {paying ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={s.payBtnLabel} numberOfLines={1}>
              {amountLabel ? `Pay ${amountLabel}` : 'Pay'}
            </Text>
          )}
        </Pressable>
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

  // Angular: .payment-header .pl-16 .pr-24 .pt-12 .pb-4 (pay-using-credit-
  // debit.page.html:4) — asymmetric padding, a 1px #f1f5f9 bottom border, and
  // no shadow (Ionic's md header shadow is zeroed by .hide-header-bar).
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 16, paddingRight: 24, paddingTop: 12, paddingBottom: 4,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  // Angular: .body2-regular-14 .color-333333 — 14px Poppins-REGULAR at
  // #333333, not the 16px semibold black this port used. That's why the title
  // reads lighter and smaller here than on the other payment screens.
  headerTitle: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 15, color: '#333333', marginLeft: 8, flex: 1 },

  // Angular: <ion-row class="ion-cust-padding-start"> gives 24px on the left
  // (--ion-cust-padding, theme/variables.scss:33); the vertical space is the
  // ion-col's own grid padding. .heading-03-bold-20 has no English rule, so
  // this inherits the body font at the rem-scaled base (~17px) in #1f1e1b.
  // ADJUSTABLE — paddingTop/paddingLeft are the heading's top and left gaps.
  pageTitle: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize: 17,
    color: '#1f1e1b',
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },

  // Angular: the form grid's row is .ion-cust-padding-start .ion-cust-padding-end
  // — 24px each side, not the 16 this port used. The 8px gap stands in for the
  // gutter between the stacked ion-cols.
  content:  { paddingHorizontal: 24, paddingTop: 8, gap: 8 },

  field:    { marginBottom: 8 },
  row:      { flexDirection: 'row', gap: 12 },
  // Angular: ion-col size 6.5 for MM/YY and 5.1 (offset .4) for CVV of a
  // 12-col grid — 54.2% / 42.5% with a 3.3% gutter, not an even split.
  expiryField: { flex: 6.5 },
  cvvField:    { flex: 5.1 },


  // Angular: <ion-footer class="ion-no-border bg-white"> — a plain white bar
  // pinned to the bottom. The row inside carries .ion-cust-padding-start/end
  // (24px) and .pt-24 / .pb-16, and ion-no-border removes the top hairline.
  // No radius and no shadow exist on it in Angular.
  footer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    backgroundColor: Colors.white,
  },
  // Angular: .primary-cta-jodii-pay — background #B50033, border-radius 8,
  // width 100%, --padding-top/bottom 12px, height auto (so the 12px padding
  // and the 16px line-height define the height, not a fixed value).
  payBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 8,
    width: '100%',
    minHeight: 40,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnPressed: { opacity: 0.85 },
  // Angular: .primary-disabled-cta-jodii-pay — #F0F0F0, radius 8, min-height 40.
  payBtnDisabled: { backgroundColor: '#F0F0F0' },
  // Angular: <span class="body1-medium-14 white-color"> — Poppins-Medium at
  // --font14 (~15px scaled), line-height 16, letter-spacing .05, white in BOTH
  // states (the span's own color wins over the disabled button's #B0B0B0).
  payBtnLabel: {
    fontFamily: Fonts.poppinsMedium,
    fontSize: 15,
    lineHeight: 16,
    letterSpacing: 0.05,
    color: Colors.white,
  },

  // Angular: .bottom-right-design — position fixed, right 0, bottom 0,
  // z-index -1. The SVG's intrinsic size is 149.12x162.205 and its own root
  // group carries opacity 0.35, which RN's <Image> won't apply from inside the
  // file, so it's set here to match what the browser renders.
  // ADJUSTABLE — opacity is the rangoli's brightness (raised off Angular's 0.35).
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
