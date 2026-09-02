// Angular: pages/recharge/upi-payment/upi-payment.page.html (lines 239-394) —
// one ion-radio-group holding TWO ion-accordion-groups back to back, so it
// renders as a single visual list: GPay/Paytm/PhonePe rows shown directly,
// followed by one "Other UPI Apps" accordion row that expands INLINE (within
// the same list/card) to reveal everything else detected (CRED, iMobile,
// PayZapp, etc.) — not a separate card below. Tapping any app row opens that
// specific app directly via intent, same native-bridge mechanism used for
// GPay/PhonePe on PaymentOptionsScreen — not just the manual VPA field this
// screen used to be limited to.

import { Fragment, useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { CDN, CDN_REACT } from '../../constants/cdn'
import { handleBack as handleRootBack } from '../../utils/navigationRef'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import FloatingLabelInput from '../../components/input/FloatingLabelInput'
import PaymentRestrictedSheet from '../../components/payment/PaymentRestrictedSheet'
import {
  getCheckoutDetails, getFinalAmount, getPaymentConfig, getRetryRemainingMs,
  getUpiAppList, handlePaymentSuccess, initPayUNative, initRazorpayNative, initUPIPayment,
  recordPaymentFailure, stringifyPaymentResponse, toPaise, verifyPayUPaymentSuccess,
  verifyPaymentSuccess, type SelectedPackage, type UpiAppInfo,
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
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const selectedPackage: SelectedPackage | undefined = route.params?.selectedPackage
  const amountLabel: string | undefined = route.params?.amountLabel

  const [vpa, setVpa]       = useState('')
  const [touched, setTouched] = useState(false)
  const [paying, setPaying]   = useState(false)
  const [restrictedMinutes, setRestrictedMinutes] = useState<number | null>(null)


  // Detected installed UPI apps (Android only) — GPay/Paytm/PhonePe shown
  // directly, everything else (CRED, iMobile, PayZapp, etc.) tucked under an
  // inline "Other UPI Apps" row within the SAME card, matching Angular's
  // two-accordion-groups-in-one-list layout. Selecting an app row and
  // filling the manual VPA field are mutually exclusive — only one payment
  // method is active at a time.
  const [topApps, setTopApps]       = useState<UpiAppInfo[]>([])
  const [otherApps, setOtherApps]   = useState<UpiAppInfo[]>([])
  const [showOthers, setShowOthers] = useState(true)
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
    if (navigation.canGoBack()) handleRootBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  async function handlePay() {
    setTouched(true)
    if (!canPay || !selectedPackage) return

    const remainingMs = await getRetryRemainingMs()
    if (remainingMs > 0) {
      setRestrictedMinutes(Math.ceil(remainingMs / 60000))
      return
    }

    setPaying(true)
    try {
      const config  = await getPaymentConfig()
      const saltKey = config.RAZORPAY_KEY_ID ?? ''

      // Lowercase 'upi', matching PaymentOptionsScreen's toRazorpayMethod() —
      // checked against real Razorpay order/payment history via the Razorpay
      // MCP, which showed every recent UPI payment succeeding with no
      // errors, meaning this screen's "could not initiate payment" failures
      // were happening in our own nbpaymentcheckout call, before Razorpay
      // was ever reached.
      //
      // renewOnExpiry is deliberately NOT forced true here (unlike an
      // earlier version of this fix) — doing so made the backend create a
      // recurring/customer-linked order even when this flow isn't set up
      // for one, which surfaces as Razorpay rejecting the submit with
      // {"code":5,"description":"The id provided does not exist"} (the
      // known failure mode when a recurring order's customer_id doesn't
      // resolve — see the comment on the customerId field below).
      const checkout = await getCheckoutDetails(selectedPackage.PACKAGEID, 'upi')

      // PAYSOURCE=='2' silently routes this account's whole UPI flow through
      // PayU instead of Razorpay — see initPayUNative(). No iOS PayU bridge
      // exists (the old app's PayU integration was Android-only), so iOS
      // keeps using Razorpay's Standard Checkout regardless of PAYSOURCE.
      // Also requires a detected app: the old Android app's PayU integration
      // never supported manual VPA entry (startUpiPayment there has no vpa
      // field at all) — a manual VPA on a PayU account falls through to the
      // Razorpay branch below instead of submitting an incomplete PayU
      // payload with no UPI target.
      const usePayU = Platform.OS === 'android' && config.PAYSOURCE === '2' && !!selectedApp

      let result: { success: boolean; response: any }
      if (usePayU) {
        result = await initPayUNative({
          merchantKey: config.PAYU_MERCHANT_KEY ?? '',
          txnId:       checkout.txnid ?? '',
          productInfo: checkout.productinfo ?? '',
          firstName:   checkout.firstname ?? '',
          email:       checkout.email || 'jodii@matrimony.com',
          // PayUBridgeModule.kt reads this via getString() (unlike Razorpay's
          // bridge, which uses getInt()) — the backend sends amount as a raw
          // JSON number, which crashes ReadableMap.getString() if not
          // stringified first (confirmed via a real device crash trace).
          amount:      String(checkout.amount ?? ''),
          phone:       checkout.MOBILENO ?? '',
          surl:        checkout.surl ?? '',
          furl:        checkout.furl ?? '',
          hash:        checkout.hash ?? '',
          bankcode:    checkout.bankcode ?? '',
          upiAppPackageName: selectedApp?.packageName,
          si: checkout.si === 1 && checkout.si_details ? {
            billingAmount:    checkout.si_details.billingAmount,
            billingCurrency:  checkout.si_details.billingCurrency,
            billingCycle:     checkout.si_details.billingCycle,
            billingInterval:  checkout.si_details.billingInterval,
            paymentStartDate: checkout.si_details.paymentStartDate,
            paymentEndDate:   checkout.si_details.paymentEndDate,
          } : undefined,
        })
      } else if (Platform.OS === 'android') {
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
        const verified = usePayU
          ? await verifyPayUPaymentSuccess(result.response?.payuResult, result.response?.txnId)
          : await verifyPaymentSuccess(result.response, checkout.orderId)
        if (verified) {
          await handlePaymentSuccess()
        } else {
          await recordPaymentFailure(null, selectedPackage, {
            status: 'pending', retryRoute: 'upi-address', retryParams: route.params,
          })
          navigation.navigate('payment-failed', {
            selectedPackage, amountLabel, status: 'pending', orderId: checkout.orderId,
            retryRoute: 'upi-address', retryParams: route.params,
          })
        }
      } else {
        const errCode: number = result.response?.code ?? 0
        if (errCode !== 0) {
          const reason = stringifyPaymentResponse(result.response)
          await recordPaymentFailure(null, selectedPackage, {
            status: 'failure', reason, retryRoute: 'upi-address', retryParams: route.params,
          })
          navigation.navigate('payment-failed', {
            selectedPackage, amountLabel, status: 'failure', reason,
            retryRoute: 'upi-address', retryParams: route.params,
          })
        }
      }
    } catch (error: any) {
      console.error('DBG_PAYMENT_ERROR upi', error?.message, error)
      Alert.alert('Error', error?.message || 'Something went wrong. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Angular: upi-payment.page.html:1-36 — the header is a THREE-ROW
          stack inside ion-toolbar: the back arrow alone on row 1, then the
          title on its own row as .heading1-semibold-20 (20px, not 16), then
          the "Enter existing UPI address" line as a third row. RN had the
          title inline beside the arrow at 16px and the subtitle down in the
          scroll body. Both strings were hardcoded English; the keys already
          existed (RECHARGE.UPIPAY_TITLE / UPIPAY_TXT). */}
      <View style={s.header}>
        <Pressable style={s.backRow} onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle}>{t('RECHARGE.UPIPAY_TITLE')}</Text>
        <Text style={s.headerSubtitle}>{t('RECHARGE.UPIPAY_TXT')}</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>

        <FloatingLabelInput
          label={`${t('RECHARGE.EG')} abcd@okxyzbank`}
          value={vpa}
          onChangeText={handleVpaChange}
          errorMessage={errorMessage}
          variant="text"
          shape="underline"
          autoCapitalize="none"
          style={s.field}
        />
        <Text style={s.note}>{t('RECHARGE.UPIPAY_NOTE')}</Text>
        {/* Angular: a default-size ion-button (~40px tall) with
            body1-medium-14 text; RN's "medium" is 32px with 12px text, which
            read noticeably smaller than Angular's. */}
        <ButtonRevamp
          label={t('GENERAL.SUBMIT')}
          variant="primary"
          size="large"
          disabled={!isValid}
          loading={paying && !selectedApp}
          onPress={handlePay}
          style={[s.submitBtn, s.squareBtn, !isValid && s.submitBtnDisabled]}
        />

        {loadingApps && <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 24 }} />}

        {!loadingApps && (topApps.length > 0 || otherApps.length > 0) && (
          <View style={s.appCard}>
            {topApps.map((app, idx) => {
              const isSelected = selectedApp?.packageName === app.packageName
              return (
                <Fragment key={app.packageName}>
                  <Pressable
                    style={[s.appRow, idx === topApps.length - 1 && otherApps.length === 0 && !isSelected && s.appRowLast]}
                    onPress={() => selectApp(app)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View style={s.appRowLeft}>
                      <CdnSvg uri={iconForApp(app.packageName)} width={24} height={24} />
                      <Text style={s.appLabel}>{app.appName}</Text>
                    </View>
                    <View style={[s.radioCircle, isSelected && s.radioCircleSelected]}>
                      {isSelected && <View style={s.radioDot} />}
                    </View>
                  </Pressable>
                  {isSelected && (
                    <View style={s.inlinePayBlock}>
                      <ButtonRevamp
                        label={amountLabel ? `Proceed to pay ${amountLabel}` : 'Proceed to pay'}
                        variant="primary"
                        fullWidth
                        loading={paying}
                        style={s.payBtn}
                        onPress={handlePay}
                      />
                    </View>
                  )}
                </Fragment>
              )
            })}

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
                {showOthers && otherApps.map((app, idx) => {
                  const isSelected = selectedApp?.packageName === app.packageName
                  return (
                    <Fragment key={app.packageName}>
                      <Pressable
                        style={[s.appRow, idx === otherApps.length - 1 && !isSelected && s.appRowLast]}
                        onPress={() => selectApp(app)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                      >
                        <View style={s.appRowLeft}>
                          <CdnSvg uri={iconForApp(app.packageName)} width={24} height={24} />
                          <Text style={s.appLabel}>{app.appName}</Text>
                        </View>
                        <View style={[s.radioCircle, isSelected && s.radioCircleSelected]}>
                          {isSelected && <View style={s.radioDot} />}
                        </View>
                      </Pressable>
                      {isSelected && (
                        <View style={s.inlinePayBlock}>
                          <ButtonRevamp
                            label={amountLabel ? `Proceed to pay ${amountLabel}` : 'Proceed to pay'}
                            variant="primary"
                            fullWidth
                            loading={paying}
                            style={s.payBtn}
                            onPress={handlePay}
                          />
                        </View>
                      )}
                    </Fragment>
                  )
                })}
              </>
            )}
          </View>
        )}

        {/* Angular: upi-payment.page.html has NO app-link-cta — the only
            "need help" reference is inside a commented-out header block, so
            this page never shows the helpline row. */}
      </ScrollView>

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

  // Angular: plain ion-toolbar with no border and no shadow (Ionic's md
  // shadow is zeroed by .hide-header-bar.header-md::after, global.scss:2737).
  // Rows are indented by .ion-cust-padding-start = 24px.
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 24, paddingBottom: 8,
  },
  // Angular: the arrow is an ion-button with inline margin-left:-18px inside
  // an ion-col, so it sits close to the row's left edge. ADJUSTABLE — marginLeft
  // shifts it horizontally, marginTop/paddingVertical set the gap above.
  // ADJUSTABLE — marginLeft shifts the arrow horizontally, marginTop/padding
  // set the gap above it.
  backRow: { alignSelf: 'flex-start', marginLeft: 4, marginTop: 12, paddingVertical: 8 },
  // Angular: .heading1-semibold-20 .black-color (global.scss:2166) — 20px
  // Poppins-SemiBold. The rem scale resolves ~20 → ~21 at 412px width.
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 21, color: Colors.black, marginTop: 4 },
  // Angular: .existing-upi has NO definition anywhere in the codebase, so this
  // line inherits the Ionic default — Poppins-Regular at the base size, black —
  // not the grey medium this port used.
  headerSubtitle: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 17, color: Colors.black, marginTop: 8 },

  content:  { padding: 16 },
  subtitle: { fontFamily: Fonts.poppinsMedium, fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  // The underline shape itself comes from shape="underline" — these border
  // overrides would land on the outer wrapper, not the field, so they're not
  // set here.
  field:    { marginBottom: 8 },
  // Angular: .you-will-receive-request inherits the body default — black at
  // the base size, not a 12px grey.
  note:     { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 15, color: Colors.black },
  // Angular: .primary-cta-jodii-small-pay / .primary-disabled-cta-jodii
  // (global.scss:26281 / 26353) with .width-auto .pt-6 .pb-6 .pl-6 .pr-6 —
  // radius 8 (RN had 4), 6px padding all round, sized to its label rather
  // than stretched. The disabled state is #F0F0F0 with #B0B0B0 text; enabled
  // is #B50033 with white — both handled by ButtonRevamp's own variants.
  // ButtonRevamp applies `style` LAST, so any paddingHorizontal here silently
  // replaces the size token's own 16px and squeezes the label — which is what
  // an earlier 6px value here was doing. Angular's .pl-6/.pr-6 are Ionic CSS
  // vars applied INSIDE the button's padding, not a replacement for it, so the
  // width is left to the size token.
  submitBtn: { alignSelf: 'flex-start', marginTop: 12, minWidth: 96 },
  squareBtn: { borderRadius: 8 },
  // Angular: .primary-disabled-cta-jodii (global.scss:26353) — #F0F0F0
  // background with #B0B0B0 text, lighter than ButtonRevamp's shared disabled
  // default (#dddddd / #888888). Only the background is overridable here;
  // ButtonRevamp exposes no textStyle prop, so the label keeps its own grey.
  submitBtnDisabled: { backgroundColor: '#F0F0F0' },

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
  appLabel:   { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black },

  radioCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primaryDark },

  inlinePayBlock: { paddingVertical: 12, paddingBottom: 16 },
  payBtn: { backgroundColor: Colors.primaryDark },
})
