// Angular: pages/recharge/payment-mode/payment-mode.page.html + .ts — the
// checkout screen reached after a plan is selected (or directly from Matches/
// Explore banners). NOT the same page as recharge.page.html (plan-selection
// list, see RechargeScreen.tsx) — confirmed by tracing both files; the Figma
// "Jodii Auto Renewal" design matches this page, not recharge.page.html.
//
// Route param contract: expects `selectedPackage` from RechargeScreen.tsx
// (the plan-list screen). If no package is passed, this screen shows a
// friendly error rather than guessing an nbpromotion promotionId.

import { Fragment, useEffect, useState } from 'react'
import {
  Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'
import { CDN, CDN_REACT, CDN_LOTTIE } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import CdnLottie from '../../components/CdnLottie'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { handleBack as handleRootBack } from '../../utils/navigationRef'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import LinkCTA from '../../components/link-cta/LinkCTA'
import PaymentRestrictedSheet from '../../components/payment/PaymentRestrictedSheet'
import { useNetwork } from '../../contexts/NetworkContext'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import PaymentOptionsDesktopLayout from './payment-options-desktop/PaymentOptionsDesktopLayout'
import {
  findUpiPackageName, formatAmount, getAutoRenewalBenefits, getCheckoutDetails, getFinalAmount,
  getPaymentConfig, getRechargeHelpline, getRetryRemainingMs, getServerFilteredUpiApps, getUpiAppList,
  handlePaymentSuccess,
  initPayUNative, initRazorpayNative, initRazorpayPayment, initRazorpayWebCheckout,
  initRazorpayWebUpiAppPayment, parseAmount, razorpayWebAppId, recordPaymentFailure,
  stringifyPaymentResponse, toPaise, verifyPayUPaymentSuccess, verifyPaymentSuccess,
  type AutoRenewalSheetData, type PaymentMethodItem, type SelectedPackage, type UpiAppInfo,
} from '../../service/paymentService'

const ICON_BACK   = CDN_REACT + '/menu_back_arrow.svg'
const ICON_CHEVRON = CDN_REACT + '/menu_right_arrow.svg'

// Angular: payment-mode.page.html gates the auto-renewal checkbox on
// item.KEY being one of these three recurring-capable methods.
const AUTOPAY_CAPABLE_KEYS = new Set(['PAY_GPAY', 'PAY_PHONEPE', 'PAY_PAYTM'])

// Razorpay's `method` object only recognizes its own type strings ('upi',
// 'card', 'netbanking', ...) — NOT our internal PAYTYPE keys. GPay/PhonePe/
// Paytm are all just UPI intent under Razorpay's SDK (which shows its own
// generic UPI-app picker; there's no supported way in this package to jump
// straight to one specific app — see PR discussion, react-native-razorpay
// only exposes Standard Checkout, not the app-targeted custom-UI flow).
function toRazorpayMethod(key: string): string {
  return AUTOPAY_CAPABLE_KEYS.has(key) ? 'upi' : key.toLowerCase()
}

// Angular: <img [src]="common.ImgDomain() + item.IMG"> — PAYMENTMETHODS icon
// paths come back relative to the CDN root, not as absolute URLs. Rendering
// item.IMG directly (as this screen did before) resolves against the app's
// own origin instead of the CDN, producing a 404.
function resolveIcon(path: string): string {
  return /^https?:\/\//.test(path) ? path : CDN + path
}

type Props = { navigation: any; route: any }

export default function PaymentOptionsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation()
  const isDesktop = useIsDesktopWeb()
  const { isOffline } = useNetwork()

  const selectedPackage: SelectedPackage | undefined = route.params?.selectedPackage

  // This screen has no back-stack when reached in a context with no prior
  // screen (e.g. deep link) — goBack() would silently no-op then. Same fix
  // as RechargeScreen's close icon.
  function handleBack() {
    if (navigation.canGoBack()) handleRootBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  const [methods, setMethods]   = useState<PaymentMethodItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [paying, setPaying]     = useState(false)
  const [selectedKey, setSelectedKey] = useState('')
  // Angular: payment-mode.page.ts `renewOnExpiry = true` — ON by default.
  const [renewOnExpiry, setRenewOnExpiry] = useState(true)
  const [showRetentionSheet, setShowRetentionSheet] = useState(false)
  // Detected installed UPI apps (Android only) — fetched once on mount,
  // reused both to filter the visible list and to target the right app at pay time.
  const [installedApps, setInstalledApps] = useState<UpiAppInfo[]>([])
  const [helpline, setHelpline] = useState('')
  const [restrictedMinutes, setRestrictedMinutes] = useState<number | null>(null)

  useEffect(() => {
    if (!selectedPackage) { setLoading(false); return }
    loadMethods()
    getRechargeHelpline().then(setHelpline)
  }, [])

  async function loadMethods() {
    setLoading(true)
    try {
      const config = await getPaymentConfig()
      let list = config.PAYMENTMETHODS ?? []

      // Cross-reference GPay/PhonePe/Paytm rows against apps actually
      // installed on the device (rn-hybrid's formatUpiApps() pattern) —
      // without this, the screen shows every configured UPI app row
      // regardless of whether it's really installed, which is misleading
      // (e.g. showing "Paytm" when Paytm isn't on the device at all).
      // Angular: payment-mode.page.ts loadUPIApp() — the on-device list is
      // never trusted directly; it's round-tripped through nbapplicationpay
      // first (getServerFilteredUpiApps), since the backend can filter out an
      // installed app the merchant/account doesn't actually support.
      if (Platform.OS === 'android') {
        const detected = await getUpiAppList()
        const apps = detected.length > 0 ? await getServerFilteredUpiApps(detected) : []
        setInstalledApps(apps)
        list = list.filter(m =>
          !AUTOPAY_CAPABLE_KEYS.has(m.KEY) || !!findUpiPackageName(apps, m.KEY),
        )
      }

      // Angular: payment-mode.page.html filters PAGE_ID==1 for this screen —
      // NETBANKING/NEFT/PAYATSTORE (PAGE_ID==2) belong to the dedicated
      // "More Payment Options" screen, reached via the OTHERMODES row below,
      // not shown inline here.
      list = list.filter(m => Number(m.PAGE_ID) !== 2)

      // Angular: payment-mode.page.ts isEmiFlow() — EMI packages default to
      // (and are restricted to) UPI-app checkout only; Card/Netbanking/Other
      // payment modes/Doorstep collection aren't valid for a recurring
      // autopay mandate.
      if (selectedPackage?.isEmi) {
        list = list.filter(m => AUTOPAY_CAPABLE_KEYS.has(m.KEY) || m.KEY === 'UPIPAY')
      }

      setMethods(list)
      // A failed payment retried from PaymentFailedScreen arrives with the
      // method the user picked there already chosen — falls back to the
      // first recommended row otherwise (unchanged default behavior).
      const preselected = route.params?.preselectedMethod
        ? list.find(m => m.KEY === route.params.preselectedMethod)
        : undefined
      const firstRecommended = preselected ?? list.find(m => m.RECOMMEND === '1')
      if (firstRecommended) setSelectedKey(firstRecommended.KEY)
    } finally {
      setLoading(false)
    }
  }

  if (!selectedPackage) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <Header t={t} onBack={handleBack} />
        <View style={s.emptyState}>
          <Text style={s.emptyText}>Select a membership plan to continue.</Text>
          <ButtonRevamp label="Go back" variant="primary" onPress={handleBack} />
        </View>
      </View>
    )
  }

  // Angular: filterPaymentMethod() (payment-mode.page.ts:855-868) computes a
  // FLAG per method and the template renders on FLAG==1 && PAGE_ID==1. The
  // three UPI-app rows (PhonePe/GPay/Paytm) get FLAG=0 unless that app is
  // actually INSTALLED — detected from the nbapplicationpay response's
  // AppPkgName list — so on a device/browser without them they vanish, and
  // showTitle() (:1255) hides the "Recommended" heading with them.
  //
  // loadMethods() above already performs that installed-app filtering
  // (getUpiAppList() + findUpiPackageName()) on Android, so any UPI-app row
  // still present in `methods` here has already been confirmed installed —
  // it must NOT be filtered out again below, or GPay/PhonePe/Paytm never show.
  const recommended = methods.filter(m => m.RECOMMEND === '1')
  // Angular gates this whole section on !isEmiFlow() && !isPwaApp() — not on
  // the platform. The previous `Platform.OS === 'web' ? []` blanked out
  // Credit/Debit card and Other payment modes entirely on web, which is why
  // that card was missing from this port.
  const otherModes = methods.filter(m => m.RECOMMEND !== '1')

  const value1 = selectedPackage.value1
  const planName     = value1?.[0] ?? selectedPackage.value
  const planDuration = value1?.[1]

  // Angular: displayAmt() — API amounts (price/paidamt/discountamount) come
  // pre-formatted with their own ₹ symbol (e.g. "₹1290"), not bare numbers;
  // parseAmount() strips that for arithmetic, formatAmount() re-adds it for
  // display without inserting thousand separators (Angular doesn't either).
  const priceNum          = parseAmount(selectedPackage.price)
  const discountAmountNum = parseAmount(selectedPackage.discountamount) - parseAmount(selectedPackage.extradiscount)
  const hasDiscount       = discountAmountNum > 0
  const finalTotalNum     = getFinalAmount(selectedPackage)

  // ── Desktop web layout (Figma "Jodii Desktop - Registration", nodes
  // 533:2467 -> 536:14130) — wide browser window only; mobile/native/narrow-
  // web keep the JSX below, untouched. Unlike RechargeScreen's split, this
  // desktop layout owns its own per-tab data loading (see
  // PaymentOptionsDesktopLayout.tsx's header comment for why) — it only
  // needs the already-computed order-summary numbers and the selected
  // package from this screen.
  if (isDesktop) {
    return (
      <PaymentOptionsDesktopLayout
        selectedPackage={selectedPackage}
        amountLabel={formatAmount(finalTotalNum)}
        planName={planName}
        planDuration={planDuration}
        priceNum={priceNum}
        discountAmountNum={discountAmountNum}
        finalTotalNum={finalTotalNum}
        onClose={handleBack}
        onEditPlan={() => navigation.navigate('recharge')}
        langCode={i18n.language}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />
    )
  }

  // Angular: payment-mode.page.html:31 — the renew-on-expiry row is hidden
  // entirely for an EMI package (!isEmiFlow() in that *ngIf), since EMI
  // checkout is already an unconditional recurring mandate — see handlePay()
  // below, which forces RENEWALFLAG regardless of this checkbox's state.
  const showRenewalCheckbox =
    !selectedPackage.isEmi && selectedPackage.autopayflag === '1' && AUTOPAY_CAPABLE_KEYS.has(selectedKey)

  const benefits: AutoRenewalSheetData = getAutoRenewalBenefits()

  function toggleRenew(checked: boolean) {
    setRenewOnExpiry(checked)
    // Angular: onRenewToggle() — unchecking opens the retention bottom sheet;
    // only its "Enable Auto-renewal" CTA re-checks the box, any other dismiss
    // (backdrop, close) leaves it unchecked.
    if (!checked) setShowRetentionSheet(true)
  }

  // Angular: recharge.page.ts navigates to distinct pages for these rows
  // (pay-using-credit-debit / upi-payment / netbanking); the remaining rows
  // (Contact to make payment, NEFT/RTGS, Pay at our stores) have no built RN
  // screen yet — routed by NAME text since the server doesn't expose a
  // stable per-row type code beyond the KEY values already confirmed for
  // GPay/PhonePe/Paytm.
  // Angular: real PAYCONFIG.PAYMENTMETHODS KEY values (confirmed from a live
  // response) — UPIPAY, DEBITCARD, OTHERMODES, NETBANKING, NEFT, PAYATSTORE.
  function handleOtherModePress(item: PaymentMethodItem) {
    const params = { selectedPackage, amountLabel: formatAmount(finalTotalNum) }
    switch (item.KEY) {
      case 'UPIPAY':     navigation.navigate('upi-address', params); break
      case 'DEBITCARD':  navigation.navigate('card-payment', params); break
      case 'NETBANKING': navigation.navigate('net-banking', params); break
      // Angular: goToOtherPaymentModes() — navigates to the dedicated
      // more-payment-option page (Net Banking/NEFT-RTGS/Pay at stores),
      // it does NOT show those rows inline on this screen.
      case 'OTHERMODES': navigation.navigate('more-payment-options', params); break
      // Angular: payment-mode.page.ts:700-702 — free-doorstep-collection,
      // a scheduling request (no charge here), separate from OTHERMODES.
      case 'DOORSTEP':   navigation.navigate('doorstep-collection', params); break
      default:           Alert.alert(item.NAME, 'This payment mode is coming soon.')
    }
  }

  async function handlePay() {
    if (!selectedKey) { Alert.alert('Select payment method', 'Please choose a payment method.'); return }
    // Defense-in-depth alongside the global OfflineScreen overlay — don't
    // start checkout/open the payment gateway SDK while offline.
    if (isOffline) { Alert.alert('Error', t('GENERAL.NOINTERNET')); return }

    const remainingMs = await getRetryRemainingMs()
    if (remainingMs > 0) {
      setRestrictedMinutes(Math.ceil(remainingMs / 60000))
      return
    }

    setPaying(true)
    try {
      const config = await getPaymentConfig()
      const saltKey = config.RAZORPAY_KEY_ID ?? ''

      // Angular: payment.service.ts callNativeForUPIPayment() — the checkout
      // API always receives a normalized method ('upi'), never the specific
      // app KEY (PAY_GPAY/PAY_PHONEPE/PAY_PAYTM) — that KEY only decides
      // which native UPI app to target, further down.
      // Angular: payment-mode.page.ts:546 — RecurringFlag is forced for an
      // EMI package regardless of the (hidden, for EMI) renew-on-expiry
      // checkbox state.
      const checkout = await getCheckoutDetails(
        selectedPackage!.PACKAGEID, toRazorpayMethod(selectedKey), renewOnExpiry || !!selectedPackage!.isEmi,
      )

      // PAYSOURCE=='2' silently routes this account's whole UPI flow through
      // PayU instead of Razorpay — see initPayUNative(). Only applies to the
      // UPI-native-bridge branch below; card/netbanking (and iOS, which has
      // no PayU bridge) keep using Razorpay regardless.
      //
      // Angular: payment.service.ts:371-373 — an autopay-mandate registration
      // (renewOnExpiry checked) forces this specific transaction back to
      // Razorpay when PayU's own GOOGLEPAY.AUTOPAYFLAG isn't '1', even on a
      // PAYSOURCE=='2' account — PayU can't handle that account's autopay
      // setup, so only the one-time-charge path may still use it.
      const payUBlockedForAutopay = renewOnExpiry && config.PAYU_AUTOPAY_FLAG !== '1'
      const usePayU = Platform.OS === 'android' && AUTOPAY_CAPABLE_KEYS.has(selectedKey) &&
        config.PAYSOURCE === '2' && !payUBlockedForAutopay

      let result: { success: boolean; response: any }
      if (usePayU) {
        const upiAppPackageName = findUpiPackageName(installedApps, selectedKey)
        result = await initPayUNative({
          merchantKey: config.PAYU_MERCHANT_KEY ?? '',
          txnId:       checkout.txnid ?? '',
          productInfo: checkout.productinfo ?? '',
          firstName:   checkout.firstname ?? '',
          email:       checkout.email || 'bharatjodii@matrimony.com',
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
          upiAppPackageName,
          si: checkout.si === 1 && checkout.si_details ? {
            billingAmount:    checkout.si_details.billingAmount,
            billingCurrency:  checkout.si_details.billingCurrency,
            billingCycle:     checkout.si_details.billingCycle,
            billingInterval:  checkout.si_details.billingInterval,
            paymentStartDate: checkout.si_details.paymentStartDate,
            paymentEndDate:   checkout.si_details.paymentEndDate,
          } : undefined,
        })
      } else if (Platform.OS === 'android' && AUTOPAY_CAPABLE_KEYS.has(selectedKey)) {
        // Native bridge: target the specific detected GPay/PhonePe/Paytm app
        // directly via its package name, instead of Razorpay's own generic
        // UPI-app picker (which is all react-native-razorpay's Standard
        // Checkout — used below on iOS — can do).
        const upiAppPackageName = findUpiPackageName(installedApps, selectedKey)
        result = await initRazorpayNative({
          // Confirmed via a real captured checkout response — it's a FLAT
          // object (getCheckoutDetails() previously returned .RESPONSE, a
          // plain status string, discarding these fields entirely): amount,
          // orderId, customerId, MOBILENO, recurring are top-level, no email.
          amount:      checkout.amount ?? toPaise(finalTotalNum),
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
          upiAppPackageName,
        })
      } else if (Platform.OS === 'web' && AUTOPAY_CAPABLE_KEYS.has(selectedKey)) {
        // Web equivalent of the native-bridge app-targeting above — see
        // initRazorpayWebUpiAppPayment()'s header comment. PAYSOURCE=='2'
        // (PayU) has no web path in the legacy app either, so that case
        // (usePayU false but still PAYSOURCE=='2') falls through to the
        // generic Standard Checkout modal instead of a targeted deep link.
        const appId = config.PAYSOURCE !== '2' ? razorpayWebAppId(selectedKey) : undefined
        result = appId
          ? await initRazorpayWebUpiAppPayment(
              { ...checkout, amount: checkout.amount ?? toPaise(finalTotalNum) },
              appId, methods.find(m => m.KEY === selectedKey)?.NAME ?? 'This', saltKey,
            )
          : await initRazorpayWebCheckout(
              { ...checkout, amount: checkout.amount ?? toPaise(finalTotalNum) }, saltKey,
            )
      } else if (Platform.OS === 'web') {
        // Generic web fallback (e.g. a recommended Card row) — was
        // previously calling initRazorpayPayment(), which is react-native-
        // razorpay's native module and throws on web (no web implementation).
        result = await initRazorpayWebCheckout(
          { ...checkout, amount: checkout.amount ?? toPaise(finalTotalNum) }, saltKey,
        )
      } else {
        result = await initRazorpayPayment(
          { ...checkout, amount: checkout.amount ?? toPaise(finalTotalNum) },
          toRazorpayMethod(selectedKey), saltKey,
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
            status: 'pending', retryRoute: 'payment-options', retryParams: route.params,
          })
          navigation.navigate('payment-failed', {
            selectedPackage, amountLabel: formatAmount(finalTotalNum), status: 'pending', orderId: checkout.orderId,
            retryRoute: 'payment-options', retryParams: route.params,
          })
        }
      } else if (result.response?.noAppAvailable) {
        Alert.alert('Payment', result.response.description)
      } else {
        const errCode: number = result.response?.code ?? 0
        if (errCode !== 0) {
          const reason = stringifyPaymentResponse(result.response)
          await recordPaymentFailure(null, selectedPackage, {
            status: 'failure', reason, retryRoute: 'payment-options', retryParams: route.params,
          })
          navigation.navigate('payment-failed', {
            selectedPackage, amountLabel: formatAmount(finalTotalNum), status: 'failure', reason,
            retryRoute: 'payment-options', retryParams: route.params,
          })
        }
      }
    } catch (error: any) {
      if (__DEV__) console.error('[PaymentOptions] payment error:', error?.message, error)
      Alert.alert('Error', error?.message || 'Something went wrong. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <Header t={t} onBack={handleBack} />

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>
        {/* Plan summary card */}
        <View style={s.summaryCard}>
          <View style={s.summaryTopRow}>
            <View style={s.planNameRow}>
              <Text style={s.planName}>{planName}</Text>
              {!!planDuration && <Text style={s.planDuration}>{planDuration}</Text>}
              {/* Angular: the edit pencil is COMMENTED OUT (payment-mode.page
                  .html:52-56) — it does not render at all, and its would-be
                  gate (packEditOption == '1' && ...) is dead alongside a
                  showEditOption() helper that never returns a value. */}
            </View>
            <Text style={s.planPrice}>{formatAmount(priceNum)}</Text>
          </View>

          {hasDiscount && (
            <View style={s.discountRow}>
              <Text style={s.discountLabel}>{t('RECHARGE.SPECIAL_DISCOUNT')}</Text>
              <Text style={s.discountValue}>- {formatAmount(discountAmountNum)}</Text>
            </View>
          )}

          <View style={s.divider} />

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>{t('RECHARGE.PKG_TOTAL_AMT')}</Text>
            <View style={s.totalValues}>
              {hasDiscount && <Text style={s.strikeThrough}>{formatAmount(priceNum)}</Text>}
              <Text style={s.finalTotal}>{formatAmount(finalTotalNum)}</Text>
            </View>
          </View>
        </View>

        {loading ? (
          // Angular: payment-mode.page.html's loading state uses
          // <lottie-player src="{{common.ImgDomain() + 'assets/jodii-lottie-files/loader.json'}}">,
          // not a native spinner.
          <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} style={{ alignSelf: 'center', marginTop: 32 }} />
        ) : (
          <>
            {/* Recommended — Angular: payment-mode.page.html:189 gates the
                HEADING on showTitle() (payment-mode.page.ts:1255), which is
                `isPhonePe || isGPay || isPaytm`, i.e. an installed UPI app was
                detected. It is NOT gated on the rows existing: PAY_UPI ("Pay
                using other UPI apps") also carries RECOMMEND==1 and renders in
                this same card, but on its own it leaves the heading hidden.
                Since this port has no installed-app detection, showTitle() is
                always false here and the heading never shows — the card of
                rows still does. */}
            {recommended.length > 0 && (
              <View style={s.section}>
                <View style={s.card}>
                  {recommended.map((item, idx) => (
                    <Fragment key={item.KEY}>
                      <PaymentMethodRow
                        item={item}
                        selected={selectedKey === item.KEY}
                        onPress={() => item.AUTOPAY === '1' ? setSelectedKey(item.KEY) : handleOtherModePress(item)}
                      />
                      {selectedKey === item.KEY && (
                        <View style={s.inlinePayBlock}>
                          <ButtonRevamp
                            label={`Proceed to Pay ${formatAmount(finalTotalNum)}`}
                            variant="primary"
                            fullWidth
                            loading={paying}
                            style={{ backgroundColor: Colors.primaryDark }}
                            onPress={handlePay}
                          />
                          {showRenewalCheckbox && (
                            <Pressable
                              style={s.renewRow}
                              onPress={() => toggleRenew(!renewOnExpiry)}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: renewOnExpiry }}
                            >
                              <View style={[s.checkbox, renewOnExpiry && s.checkboxChecked]}>
                                {renewOnExpiry && <Text style={s.tick}>✓</Text>}
                              </View>
                              <Text style={s.renewLabel}>Renew my membership on expiry</Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                      {idx < recommended.length - 1 && <View style={s.rowDivider} />}
                    </Fragment>
                  ))}
                </View>
              </View>
            )}

            {/* Other payment modes */}
            {otherModes.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>{t('RECHARGE.OTHERPAYMENTMODES')}</Text>
                <View style={s.card}>
                  {otherModes.map((item, idx) => (
                    <Fragment key={item.KEY}>
                      <PaymentMethodRow item={item} onPress={() => handleOtherModePress(item)} />
                      {idx < otherModes.length - 1 && <View style={s.rowDivider} />}
                    </Fragment>
                  ))}
                </View>
              </View>
            )}

            {!!helpline && (
              <LinkCTA
                text="Need help in making payment?"
                contact={helpline}
                onPress={() => Linking.openURL(`tel:${helpline}`)}
              />
            )}
          </>
        )}
      </ScrollView>

      <BottomSheet
        visible={showRetentionSheet}
        data={{
          title:    benefits.title,
          benefits: benefits.benefits,
          ctaLabel: benefits.ctaLabel,
        }}
        onClose={() => setShowRetentionSheet(false)}
        onPrimaryPress={() => { setRenewOnExpiry(true); setShowRetentionSheet(false) }}
      />

      <PaymentRestrictedSheet
        visible={restrictedMinutes != null}
        remainingMinutes={restrictedMinutes ?? 0}
        onClose={() => setRestrictedMinutes(null)}
      />
    </View>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ t, onBack }: { t: (k: string) => string; onBack: () => void }) {
  return (
    <View style={s.header}>
      <Pressable style={s.backBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
        <CdnSvg uri={ICON_BACK} width={24} height={24} />
      </Pressable>
      <Text style={s.headerTitle} numberOfLines={1}>{t('RECHARGE.PAYMENT_OPT')}</Text>
    </View>
  )
}

// ─── PaymentMethodRow ─────────────────────────────────────────────────────────
// Angular: payment-mode.page.html *ngFor row — icon (item.IMG) + item.NAME,
// ending in either an ion-radio (item.AUTOPAY==='1') or a chevron-forward
// (item.AUTOPAY==='0', navigates to a sub-page).

function PaymentMethodRow({
  item, selected, onPress,
}: { item: PaymentMethodItem; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable style={s.row} onPress={onPress} accessibilityRole="button">
      <View style={s.rowLeft}>
        <View style={s.iconBox}>
          <CdnSvg uri={resolveIcon(item.IMG)} width={24} height={24} />
        </View>
        <Text style={s.rowLabel}>{item.NAME}</Text>
      </View>

      {item.AUTOPAY === '1' ? (
        <View style={s.radioTouch}>
          <View style={[s.radioCircle, selected && s.radioCircleSelected]}>
            {selected && <View style={s.radioDot} />}
          </View>
        </View>
      ) : (
        <View style={s.chevronTouch}>
          <CdnSvg uri={ICON_CHEVRON} width={20} height={20} />
        </View>
      )}
    </Pressable>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Angular: no --ion-background-color override and no page-level ion-content
  // background rule exists, so the page falls through to Ionic's white
  // default. The card/page separation comes from each card's own box-shadow,
  // not from a grey canvas (RN had Colors.background, a grey tint).
  screen: { flex: 1, backgroundColor: Colors.white },

  // Angular: .payment-header (payment-mode.page.scss:108-111) — padding
  // 0.375rem (6px) vertical / 24px horizontal, with a 1px #f1f5f9 bottom
  // border and NO shadow (Ionic's md toolbar shadow is zeroed by
  // .hide-header-bar.header-md::after { height: 0 }, global.scss:2737). RN had
  // the inverse: a drop shadow, no border, 16px gutters and a fixed height.
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 6,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  // Angular: the back button sits in a size="1.5" column with the icon pulled
  // left by margin-left:-18px, so the arrow itself lands close to the 24px
  // gutter rather than a further 16px in.
  backBtn:     { padding: 4, marginRight: 4 },
  // Angular: .heading3-semibold-16 .line-height-20 — 16px Poppins-SemiBold,
  // line-height 20. The rem scale here resolves ~16 → ~17 at 412px width.
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font17, lineHeight: 20, color: Colors.black, flex: 1 },

  content: { padding: 16, gap: 24 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyText:  { fontSize: FontSize.font14, color: Colors.textSecondary, textAlign: 'center' },

  // ── Plan summary card ────────────────────────────────────────────────────
  // Angular: .payment-revamp-intermediate-block (payment-mode.page.scss:39-44)
  // — box-shadow: -1px 3px 6px 1px #40434343. That 8-digit hex is #404343 at
  // alpha 0x43 = 26.7%, and the offset is -1px on X, not 0.
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius:    8,
    padding:         16,
    shadowColor:     '#404343',
    shadowOffset:    { width: -1, height: 3 },
    shadowOpacity:   0.267,
    shadowRadius:    6,
    elevation:       4,
  },
  summaryTopRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  planName:     { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font14, color: Colors.black },
  planDuration: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.textSecondary, marginRight: 4 },
  // Angular: .body3-regular-12 .poppins-family .black-color .line-height-16
  // (payment-mode.page.html:56) — 12px, #000. RN had #4C4C4C, a grey.
  planPrice:    { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.black, lineHeight: 16 },

  discountRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      8,
  },
  discountLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.black },
  discountValue: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.discountGreen },

  divider: { height: 1, backgroundColor: '#F1F5F9', borderRadius: 8, marginVertical: 16 },

  totalRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel:  { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font14, color: Colors.black },
  totalValues: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  strikeThrough: {
    fontSize: FontSize.font12, color: Colors.borderNeutral, textDecorationLine: 'line-through',
  },
  // Angular: .pay-now-amount (payment-mode.page.scss:159-163) — color is
  // var(--black) (#000), not gray-color1 (#1F1E1B) — the pay-now amount is
  // pure black, distinct from the softer #1F1E1B used elsewhere on this page.
  finalTotal: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font18, color: Colors.black },

  // ── Sections / cards ─────────────────────────────────────────────────────
  section:      { gap: 16 },
  sectionLabel: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font14, color: Colors.black },
  // Angular: .payment-revamp-intermediate-block (payment-mode.page.scss:39-44)
  // — radius 8 (RN had 16) and shadow -1px 3px 6px 1px #40434343 (an 8-digit
  // hex = #404343 at 26.7% alpha). Inner gutters are 16px on the Recommended
  // card and 8px on the Other-modes card; rows supply their own vertical
  // padding, so the card no longer adds 16px of its own on top.
  card: {
    backgroundColor: Colors.white,
    borderRadius:    8,
    paddingVertical: 0,
    paddingHorizontal: 16,
    // Same .payment-revamp-intermediate-block shadow as the summary card —
    // these values were 0/6px at 8% opacity, a softer drop than Angular's.
    shadowColor:     '#404343',
    shadowOffset:    { width: -1, height: 3 },
    shadowOpacity:   0.267,
    shadowRadius:    6,
    elevation:       3,
  },

  // Angular: .payment-list (payment-mode.page.scss:254-258) — padding-top 6px
  // only, with the row's height coming from its 32px icon. RN's minHeight 52
  // plus the card's own 16px vertical padding made every row noticeably
  // taller than Angular's.
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 16, flexShrink: 1 },
  iconBox: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black },

  radioTouch: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  radioCircle: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primaryDark },

  chevronTouch: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // Angular: .border-bottom-upi-apps (payment-mode.page.scss:337-339) — a 1px
  // #f4f5f8 bottom border sitting directly under the row with NO vertical
  // margin of its own (RN added 16px above and below), suppressed on the last
  // row.
  rowDivider: { height: 1, backgroundColor: '#f4f5f8' },

  // ── Inline pay block (button + renew checkbox, sits under the first row) ──
  inlinePayBlock: { gap: 8, marginTop: 16 },
  renewRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkbox: {
    width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: '#545454',
    alignItems: 'center', justifyContent: 'center',
  },
  // Angular: ion-checkbox --checkbox-background-checked #B50033 — matches
  // CheckboxGroup.tsx's established filled-checked style.
  checkboxChecked: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  tick: { fontSize: FontSize.font11, color: Colors.white, fontWeight: '700', lineHeight: 12 },
  renewLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.black },
})
