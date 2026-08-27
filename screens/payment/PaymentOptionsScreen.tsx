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
  ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { CDN, CDN_REACT, CDN_SVG } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { handleBack as handleRootBack } from '../../utils/navigationRef'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import LinkCTA from '../../components/link-cta/LinkCTA'
import PaymentRestrictedSheet from '../../components/payment/PaymentRestrictedSheet'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import PaymentOptionsDesktopLayout from './payment-options-desktop/PaymentOptionsDesktopLayout'
import {
  findUpiPackageName, formatAmount, getAutoRenewalBenefits, getCheckoutDetails, getFinalAmount,
  getPaymentConfig, getRechargeHelpline, getRetryRemainingMs, getUpiAppList, handlePaymentSuccess,
  initPayUNative, initRazorpayNative, initRazorpayPayment, parseAmount, recordPaymentFailure,
  stringifyPaymentResponse, toPaise, verifyPayUPaymentSuccess, verifyPaymentSuccess,
  type AutoRenewalSheetData, type PaymentMethodItem, type SelectedPackage, type UpiAppInfo,
} from '../../service/paymentService'

const ICON_BACK   = CDN_REACT + '/menu_back_arrow.svg'
const ICON_CHEVRON = CDN_REACT + '/menu_right_arrow.svg'
const ICON_EDIT_PENCIL = CDN_SVG + 'revamp/primary-edit-pencil.svg'

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
      if (Platform.OS === 'android') {
        const apps = await getUpiAppList()
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

  const recommended = methods.filter(m => m.RECOMMEND === '1')
  // On web (PWA), the "Other payment modes" section (netbanking/NEFT/pay-at-
  // store/doorstep, reached via the OTHERMODES row) isn't shown at all —
  // those flows depend on native bridges/screens this build doesn't have.
  const otherModes = Platform.OS === 'web' ? [] : methods.filter(m => m.RECOMMEND !== '1')

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

  const showRenewalCheckbox =
    selectedPackage.autopayflag === '1' && AUTOPAY_CAPABLE_KEYS.has(selectedKey)

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
      const checkout = await getCheckoutDetails(selectedPackage!.PACKAGEID, toRazorpayMethod(selectedKey), renewOnExpiry)

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
      console.error('DBG_PAYMENT_ERROR payment-options', error?.message, error)
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
              <Pressable onPress={() => navigation.navigate('recharge')} hitSlop={8}>
                <CdnSvg uri={ICON_EDIT_PENCIL} width={16} height={16} />
              </Pressable>
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
          <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 32 }} />
        ) : (
          <>
            {/* Recommended */}
            {recommended.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>{t('RECHARGE.RECOMMENDED')}</Text>
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
  screen: { flex: 1, backgroundColor: Colors.background },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn:     { padding: 4, marginRight: 16 },
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, flex: 1 },

  content: { padding: 16, gap: 24 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyText:  { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  // ── Plan summary card ────────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius:    8,
    padding:         16,
    shadowColor:     Colors.shadow,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       4,
  },
  summaryTopRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  planName:     { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black },
  planDuration: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.textSecondary, marginRight: 4 },
  planPrice:    { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: '#4C4C4C' },

  discountRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      8,
  },
  discountLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.black },
  discountValue: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.discountGreen },

  divider: { height: 1, backgroundColor: '#F1F5F9', borderRadius: 8, marginVertical: 16 },

  totalRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel:  { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black },
  totalValues: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  strikeThrough: {
    fontSize: 12, color: Colors.borderNeutral, textDecorationLine: 'line-through',
  },
  finalTotal: { fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: '#1F1E1B' },

  // ── Sections / cards ─────────────────────────────────────────────────────
  section:      { gap: 16 },
  sectionLabel: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black },
  card: {
    backgroundColor: Colors.white,
    borderRadius:    16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor:     Colors.shadow,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       4,
  },

  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    minHeight:      52,
  },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 16, flexShrink: 1 },
  iconBox: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black },

  radioTouch: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  radioCircle: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primaryDark },

  chevronTouch: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  rowDivider: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 16 },

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
  tick: { fontSize: 11, color: Colors.white, fontWeight: '700', lineHeight: 12 },
  renewLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.black },
})
