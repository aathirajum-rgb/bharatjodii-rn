// Angular: pages/recharge/payment-failed/payment-failed.page.ts — reached
// after a failed payment or an ambiguous ('pending') one. Polls for a
// pending order to resolve, and gates retry behind a 1-hour cooldown
// (payment-mode.page.ts isPayRetryWindowElapsed()) so the user can't hammer
// the gateway with repeated attempts right after a failure.
//
// Once resolved to 'failure', renders as a bottom sheet (per Angular's own
// modal presentation of this same component) whose content is driven by
// PAGETYPE from nbpaymentfaileddet — entirely server-decided, never chosen
// client-side (confirmed against the Angular source). PAGETYPE '4'/'5' get
// the rich auto-renewal promo variant; anything else (including a failed
// detail fetch) falls back to the plain payment-method radio-picker.

import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { CDN_LOTTIE } from '../../constants/cdn'
import CdnLottie from '../../components/CdnLottie'
import ScreenTopInset from '../../components/screen/ScreenTopInset'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import PlainRetryFailureSheet from '../../components/payment/PlainRetryFailureSheet'
import AutoRenewalFailureSheet from '../../components/payment/AutoRenewalFailureSheet'
import PaymentRestrictedSheet from '../../components/payment/PaymentRestrictedSheet'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'
import {
  checkPaymentStatus, getPaymentConfig, getPaymentFailedContext, getPaymentFailedDetail,
  handlePaymentSuccess, type PaymentFailedDetail, type PaymentMethodItem, type SelectedPackage,
} from '../../service/paymentService'

// Angular: payment-failed.page.ts delayQR()-style polling — a handful of
// spaced checks rather than one immediate call, since the backend itself is
// usually still waiting on the gateway's own async webhook right after a
// pending result.
const POLL_ATTEMPTS = 5
const POLL_DELAY_MS = 4000

// Angular: payment-mode.page.html gates the auto-renewal checkbox on these
// three recurring-capable methods — the same set is "inline-selectable"
// here (retry lands back on retryRoute with the method preselected) rather
// than routed to a separate screen.
const AUTOPAY_CAPABLE_KEYS = new Set(['PAY_GPAY', 'PAY_PHONEPE', 'PAY_PAYTM'])

type Status = 'failure' | 'pending'

type Props = {
  navigation: any
  route: {
    params?: {
      selectedPackage?: SelectedPackage
      amountLabel?:     string
      status:           Status
      reason?:          string
      orderId?:         string
      retryRoute:       string
      retryParams?:     any
    }
  }
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export default function PaymentFailedScreen({ navigation, route }: Props) {
  // route.params is undefined if this screen is ever reached with no
  // navigation state (e.g. a future deep link). status/retryRoute seed
  // useState initializers below, before any effect could redirect away, so
  // they get safe inline fallbacks here instead of the destructure throwing
  // — worst case shows a generic "payment failed, retry from recharge"
  // state rather than crashing.
  const {
    selectedPackage, amountLabel, reason, orderId, retryParams,
    status = 'failure', retryRoute = 'recharge',
  } = route.params ?? {} as Partial<NonNullable<Props['route']['params']>>

  const [resolvedStatus, setResolvedStatus] = useState<Status>(status)
  const [polling, setPolling]               = useState(status === 'pending')
  const [retryDeadline, setRetryDeadline]   = useState<number | null>(null)
  const [remainingMs, setRemainingMs]       = useState(0)
  const [loadingDetail, setLoadingDetail]   = useState(true)
  const [detail, setDetail]                 = useState<PaymentFailedDetail | null>(null)
  const [fallbackMethods, setFallbackMethods] = useState<PaymentMethodItem[]>([])
  const [restrictedMinutes, setRestrictedMinutes] = useState<number | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    return () => { cancelledRef.current = true }
  }, [])

  // ── Poll for a pending order to resolve ─────────────────────────────────
  useEffect(() => {
    if (status !== 'pending') return
    let attempt = 0

    async function poll() {
      while (attempt < POLL_ATTEMPTS && !cancelledRef.current) {
        attempt += 1
        const result = await checkPaymentStatus({ razorpay_order_id: orderId ?? '' })
        const outcome = String(result?.MSG ?? '').toLowerCase()
        if (cancelledRef.current) return
        if (outcome === 'success') {
          await handlePaymentSuccess()
          return
        }
        if (outcome === 'failure') break
        await new Promise(resolve => setTimeout(resolve, POLL_DELAY_MS))
      }
      if (!cancelledRef.current) {
        setResolvedStatus('failure')
        setPolling(false)
      }
    }

    poll()
  }, [status, orderId])

  // ── Retry cooldown countdown ─────────────────────────────────────────────
  useEffect(() => {
    getPaymentFailedContext().then(context => {
      if (!cancelledRef.current) setRetryDeadline(context?.retryDeadline ?? Date.now())
    })
  }, [])

  useEffect(() => {
    if (retryDeadline == null) return
    const tick = () => setRemainingMs(Math.max(0, retryDeadline - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [retryDeadline])

  // ── Failure-detail + fallback payment-method list ───────────────────────
  useEffect(() => {
    if (polling) return
    Promise.all([
      getPaymentFailedDetail(orderId ?? ''),
      getPaymentConfig(),
    ]).then(([failedDetail, config]) => {
      if (cancelledRef.current) return
      setDetail(failedDetail)
      setFallbackMethods((config.PAYMENTMETHODS ?? []).filter(m => Number(m.PAGE_ID) !== 2))
      setLoadingDetail(false)
    })
  }, [polling, orderId])

  const canRetry = remainingMs <= 0

  function handleClose() {
    navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  // Angular: onClickPaymentModes()/payNow() — GPay/PhonePe/Paytm are always
  // inline-selectable back on retryRoute (the same screen that showed them
  // the first time); everything else routes to its own dedicated screen.
  function handleMethodSelect(item: PaymentMethodItem) {
    if (!canRetry) {
      setRestrictedMinutes(Math.ceil(remainingMs / 60000))
      return
    }
    if (AUTOPAY_CAPABLE_KEYS.has(item.KEY)) {
      navigation.replace(retryRoute, { ...(retryParams ?? { selectedPackage, amountLabel }), preselectedMethod: item.KEY })
      return
    }
    const params = { selectedPackage, amountLabel }
    switch (item.KEY) {
      case 'UPIPAY':     navigation.replace('upi-address', params); break
      case 'DEBITCARD':  navigation.replace('card-payment', params); break
      case 'NETBANKING': navigation.replace('net-banking', params); break
      case 'OTHERMODES': navigation.replace('more-payment-options', params); break
      case 'DOORSTEP':   navigation.replace('doorstep-collection', params); break
      default:           navigation.replace(retryRoute, retryParams ?? params)
    }
  }

  function handleOtherPaymentModes() {
    if (!canRetry) {
      setRestrictedMinutes(Math.ceil(remainingMs / 60000))
      return
    }
    navigation.replace('more-payment-options', { selectedPackage, amountLabel })
  }

  if (polling) {
    return (
      <View style={s.screen}>
        <ScreenTopInset style={s.topInset} />
        <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} />
        <Text style={s.title}>Confirming your payment…</Text>
        <Text style={s.subtitle}>This usually takes a few seconds. Please don't close the app.</Text>
      </View>
    )
  }

  const richVariant = !!detail && (detail.pageType === '4' || detail.pageType === '5') && detail.paymentMethods.length > 0
  const methods = detail?.paymentMethods.length ? detail.paymentMethods : fallbackMethods

  return (
    <BottomSheet visible onClose={handleClose}>
      {loadingDetail ? (
        <View style={s.sheetLoading}>
          <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} />
        </View>
      ) : (
        <>
          {!canRetry && (
            <Text style={s.cooldown}>You can retry in {formatCountdown(remainingMs)}</Text>
          )}
          {richVariant ? (
            <AutoRenewalFailureSheet
              detail={detail!}
              onSelectMethod={handleMethodSelect}
              onOtherPaymentModes={handleOtherPaymentModes}
            />
          ) : (
            <PlainRetryFailureSheet
              methods={methods}
              amountLabel={amountLabel ?? (detail?.totalAmt ? `₹${detail.totalAmt}` : '')}
              otherPaymentModesLabel={detail?.otherPaymentModesLabel}
              onRetry={handleMethodSelect}
              onOtherPaymentModes={handleOtherPaymentModes}
            />
          )}
          {!!reason && resolvedStatus === 'failure' && !richVariant && (
            <Text style={s.reason}>{reason}</Text>
          )}
        </>
      )}

      <PaymentRestrictedSheet
        visible={restrictedMinutes != null}
        remainingMinutes={restrictedMinutes ?? 0}
        onClose={() => setRestrictedMinutes(null)}
      />
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white, padding: 32, gap: 12,
  },
  // Absolute so the strip doesn't add to the flex layout and shift the
  // content off dead-center — `screen`'s own justifyContent:'center' must
  // keep centering exactly as before.
  topInset: { position: 'absolute', top: 0, left: 0, right: 0 },
  title:    { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font20, color: Colors.black, textAlign: 'center' },
  subtitle: { fontFamily: SemanticFontsEnglish.subheadingEnglishRegular, fontSize: FontSize.font14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  sheetLoading: { paddingVertical: 40, alignItems: 'center' },
  cooldown: {
    fontFamily: Fonts.poppinsMedium, fontSize: FontSize.font13, color: Colors.primaryDark,
    textAlign: 'center', marginBottom: 12,
  },
  reason: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.textTertiary,
    textAlign: 'center', marginTop: 8,
  },
})
