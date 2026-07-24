// Angular: pages/recharge/payment-failed/payment-failed.page.ts — reached
// after a failed payment or an ambiguous ('pending') one. Polls for a
// pending order to resolve, and gates retry behind a 1-hour cooldown
// (payment-mode.page.ts isPayRetryWindowElapsed()) so the user can't hammer
// the gateway with repeated attempts right after a failure.

import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import {
  checkPaymentStatus, getPaymentFailedContext, handlePaymentSuccess,
  type SelectedPackage,
} from '../../service/paymentService'

// Angular: payment-failed.page.ts delayQR()-style polling — a handful of
// spaced checks rather than one immediate call, since the backend itself is
// usually still waiting on the gateway's own async webhook right after a
// pending result.
const POLL_ATTEMPTS  = 5
const POLL_DELAY_MS  = 4000

type Status = 'failure' | 'pending'

type Props = {
  navigation: any
  route: {
    params: {
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
  const insets = useSafeAreaInsets()
  const { selectedPackage, amountLabel, status, reason, orderId, retryRoute, retryParams } = route.params

  const [resolvedStatus, setResolvedStatus] = useState<Status>(status)
  const [polling, setPolling]               = useState(status === 'pending')
  const [retryDeadline, setRetryDeadline]   = useState<number | null>(null)
  const [remainingMs, setRemainingMs]       = useState(0)
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

  function handleRetry() {
    if (remainingMs > 0) return
    navigation.replace(retryRoute, retryParams ?? { selectedPackage, amountLabel })
  }

  function handleGoBack() {
    navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  if (polling) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
        <Text style={s.title}>Confirming your payment…</Text>
        <Text style={s.subtitle}>This usually takes a few seconds. Please don't close the app.</Text>
      </View>
    )
  }

  const canRetry = remainingMs <= 0

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <Text style={s.icon}>⚠️</Text>
      <Text style={s.title}>
        {resolvedStatus === 'pending' ? 'Payment still pending' : 'Payment Failed'}
      </Text>
      <Text style={s.subtitle}>
        {reason || "We couldn't complete your payment. If any amount was deducted, it will be refunded automatically."}
      </Text>

      {!canRetry && (
        <Text style={s.cooldown}>You can retry in {formatCountdown(remainingMs)}</Text>
      )}

      <ButtonRevamp
        label={amountLabel ? `Retry ${amountLabel}` : 'Retry Payment'}
        variant="primary"
        size="large"
        fullWidth
        disabled={!canRetry}
        onPress={handleRetry}
        style={s.retryBtn}
      />
      <ButtonRevamp
        label="Back to Matches"
        variant="link"
        size="medium"
        onPress={handleGoBack}
      />
    </View>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white, padding: 32, gap: 12,
  },
  icon:     { fontSize: 56, marginBottom: 4 },
  title:    { fontFamily: 'Poppins-SemiBold', fontSize: 20, color: Colors.black, textAlign: 'center' },
  subtitle: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  cooldown: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.primaryDark, marginTop: 4 },
  retryBtn: { marginTop: 20 },
})
