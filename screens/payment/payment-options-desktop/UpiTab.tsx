// UPI tab (Figma "Jodii Desktop - Registration", nodes 533:2467 idle-state +
// 533:981 QR-revealed/countdown state) — merges two mobile screens into one
// panel: MorePaymentOptionsScreen.tsx's QR block (getQRPaymentData/
// checkQrPaymentOutcome — already pure HTTP, works unmodified on web) and
// UpiAddressScreen.tsx's manual-VPA field + validation + submit, ported to
// web via the new initRazorpayWebCheckout() (react-native-razorpay has no
// web build — see paymentService.ts).

import { useEffect, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { Colors } from '../../../constants/colors'
import { CDN } from '../../../constants/cdn'
import FloatingLabelInput from '../../../components/input/FloatingLabelInput'
import ButtonRevamp from '../../../components/button-revamp/ButtonRevamp'
import PaymentRestrictedSheet from '../../../components/payment/PaymentRestrictedSheet'
import { navigate } from '../../../utils/navigationRef'
import {
  checkQrPaymentOutcome, getCheckoutDetails, getFinalAmount, getPaymentConfig, getRetryRemainingMs,
  handlePaymentSuccess, initRazorpayWebCheckout, recordPaymentFailure, stringifyPaymentResponse, toPaise,
  verifyPaymentSuccess, type QRPaymentData, type SelectedPackage,
} from '../../../service/paymentService'

const QR_LOGO = CDN + 'assets/images/png/logo-icon.png'

// Angular: payment.service.ts delayQR() — 2 minutes after the QR is shown,
// check whether it's already been paid.
const QR_OUTCOME_DELAY_MS = 120000
// Cosmetic-only countdown shown next to the revealed QR (Figma: "Time left to
// pay: 03:57") — the backend doesn't return an explicit expiry for this QR,
// so this mirrors the outcome-check window above rather than inventing a
// separate one.
const QR_COUNTDOWN_MS = QR_OUTCOME_DELAY_MS

const VPA_REGEX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

type Props = {
  selectedPackage: SelectedPackage
  amountLabel:     string
  qrData:          QRPaymentData | null
}

export default function UpiTab({ selectedPackage, amountLabel, qrData }: Props) {
  const [revealed, setRevealed]   = useState(false)
  const [remainingMs, setRemainingMs] = useState(QR_COUNTDOWN_MS)
  const [vpa, setVpa]             = useState('')
  const [touched, setTouched]     = useState(false)
  const [paying, setPaying]       = useState(false)
  const [restrictedMinutes, setRestrictedMinutes] = useState<number | null>(null)
  const outcomeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelledRef  = useRef(false)

  useEffect(() => {
    return () => {
      cancelledRef.current = true
      if (outcomeTimer.current) clearTimeout(outcomeTimer.current)
    }
  }, [])

  function revealQr() {
    if (!qrData?.qrValue) return
    setRevealed(true)
    setRemainingMs(QR_COUNTDOWN_MS)

    outcomeTimer.current = setTimeout(async () => {
      const outcome = await checkQrPaymentOutcome(qrData.qrOrderId, qrData.upiOrderId)
      if (cancelledRef.current) return
      if (outcome === 'success') await handlePaymentSuccess()
      else if (outcome === 'failure') await recordPaymentFailure(null, selectedPackage)
    }, QR_OUTCOME_DELAY_MS)
  }

  useEffect(() => {
    if (!revealed) return
    const id = setInterval(() => setRemainingMs(prev => Math.max(0, prev - 1000)), 1000)
    return () => clearInterval(id)
  }, [revealed])

  const isValid = VPA_REGEX.test(vpa.trim())
  const errorMessage = touched && !isValid ? 'Enter a valid UPI ID' : undefined

  async function handlePay() {
    setTouched(true)
    if (!isValid) return

    const remaining = await getRetryRemainingMs()
    if (remaining > 0) {
      setRestrictedMinutes(Math.ceil(remaining / 60000))
      return
    }

    setPaying(true)
    try {
      const config  = await getPaymentConfig()
      const saltKey = config.RAZORPAY_KEY_ID ?? ''
      const checkout = await getCheckoutDetails(selectedPackage.PACKAGEID, 'upi')

      const result = await initRazorpayWebCheckout(
        { ...checkout, amount: checkout.amount ?? toPaise(getFinalAmount(selectedPackage)), VPA: vpa.trim() },
        saltKey,
      )

      if (result.success) {
        const verified = await verifyPaymentSuccess(result.response, checkout.orderId)
        if (verified) {
          await handlePaymentSuccess()
        } else {
          await recordPaymentFailure(null, selectedPackage, {
            status: 'pending', retryRoute: 'payment-options', retryParams: { selectedPackage, amountLabel },
          })
          navigate('payment-failed', {
            selectedPackage, amountLabel, status: 'pending', orderId: checkout.orderId,
            retryRoute: 'payment-options', retryParams: { selectedPackage, amountLabel },
          })
        }
      } else {
        const errCode: number = result.response?.code ?? 0
        if (errCode !== 0) {
          const reason = stringifyPaymentResponse(result.response)
          await recordPaymentFailure(null, selectedPackage, {
            status: 'failure', reason, retryRoute: 'payment-options', retryParams: { selectedPackage, amountLabel },
          })
          navigate('payment-failed', {
            selectedPackage, amountLabel, status: 'failure', reason,
            retryRoute: 'payment-options', retryParams: { selectedPackage, amountLabel },
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
    <View style={s.wrap}>
      <Text style={s.title}>Scan and Pay</Text>
      <Text style={s.subtitle}>Scan QR code using your preferred UPI app to pay</Text>

      <View style={s.qrBox}>
        {revealed && qrData?.qrValue ? (
          <QRCode value={qrData.qrValue} size={154} logo={{ uri: QR_LOGO }} logoSize={30} logoBorderRadius={15} />
        ) : (
          <>
            <View style={s.qrPlaceholder} />
            <Pressable style={s.showQrBtn} onPress={revealQr} disabled={!qrData?.qrValue}>
              <Text style={s.showQrText}>Show QR code</Text>
            </Pressable>
          </>
        )}
      </View>

      {revealed && (
        <Text style={s.countdown}>
          Time left to pay: <Text style={s.countdownBold}>{formatCountdown(remainingMs)}</Text>
        </Text>
      )}

      <View style={s.orRow}>
        <View style={s.orLine} />
        <Text style={s.orText}>OR</Text>
        <View style={s.orLine} />
      </View>

      <Text style={s.title}>Enter UPI ID</Text>
      <View style={s.vpaRow}>
        <FloatingLabelInput
          label="e.g. abcd@okxyzbank"
          value={vpa}
          onChangeText={text => { setVpa(text); if (touched) setTouched(false) }}
          errorMessage={errorMessage}
          variant="text"
          autoCapitalize="none"
          style={s.vpaField}
        />
        <ButtonRevamp
          label={paying ? '' : amountLabel ? `Pay ${amountLabel}` : 'Pay'}
          variant="primary"
          size="large"
          loading={paying}
          disabled={revealed}
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
  wrap: { gap: 8 },

  title:    { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black, marginTop: 8 },
  subtitle: { fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },

  qrBox: {
    width: 154, height: 154, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 8,
  },
  qrPlaceholder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 12, borderWidth: 2, borderColor: Colors.primaryDark, borderStyle: 'dashed',
    backgroundColor: '#FFF5F7',
  },
  showQrBtn: {
    borderRadius: 20, borderWidth: 1, borderColor: Colors.primaryDark, backgroundColor: '#FFF5F7',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  showQrText: { fontFamily: 'Poppins-Medium', fontSize: 12, color: Colors.primaryDark },

  countdown: { textAlign: 'center', fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.black, marginBottom: 8 },
  countdownBold: { fontFamily: 'Poppins-SemiBold', color: Colors.primaryDark },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.divider },
  orText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textSecondary },

  vpaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  vpaField: { flex: 1 },
})
