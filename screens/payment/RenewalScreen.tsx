// Angular: components/lowerpopup/lowerpopup.component.ts (action=='reNewMembership')
// + services/payment.service.ts openRenew()/redirectToIntermediatePage() —
// reached instead of the normal recharge flow whenever the backend flags
// PAYRENEWALFLAG+RENEWALENABLEKEY are both '1' (an existing UPI Autopay
// mandate is due). The old app auto-fired the actual charge ~3s after
// showing this screen, Cancel being the only opt-out; this port requires an
// explicit "Renew Now" tap instead — a deliberate, safer UX change.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import PaymentRestrictedSheet from '../../components/payment/PaymentRestrictedSheet'
import { useNetwork } from '../../contexts/NetworkContext'
import {
  getRenewalBanner, getRetryRemainingMs, handlePaymentSuccess, recordPaymentFailure,
  submitUpiAutopayRenewal, type RenewalBannerData,
} from '../../service/paymentService'

const ICON_TICK = CDN_REACT + '/green_tick.svg'

type Props = { navigation: any; route: any }

export default function RenewalScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { isOffline } = useNetwork()

  const [banner, setBanner]         = useState<RenewalBannerData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [renewing, setRenewing]     = useState(false)
  const [remainingMs, setRemainingMs] = useState(0)
  const [restrictedMinutes, setRestrictedMinutes] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    getRenewalBanner().then(data => {
      if (cancelled) return
      if (!data) {
        // Couldn't load renewal details — fall back to the normal recharge
        // flow rather than showing a broken/empty screen.
        navigation.replace('recharge')
        return
      }
      setBanner(data)
      setLoading(false)
    })
    getRetryRemainingMs().then(ms => { if (!cancelled) setRemainingMs(ms) })
    return () => { cancelled = true }
  }, [])

  function handleMaybeLater() {
    navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  async function handleRenewNow() {
    if (remainingMs > 0) {
      setRestrictedMinutes(Math.ceil(remainingMs / 60000))
      return
    }
    // Defense-in-depth alongside the global OfflineScreen overlay — don't
    // start the charge while offline.
    if (isOffline) { Alert.alert('Error', t('GENERAL.NOINTERNET')); return }

    setRenewing(true)
    try {
      const result = await submitUpiAutopayRenewal()
      if (result.outcome === 'success') {
        await handlePaymentSuccess()
      } else if (result.outcome === 'pending') {
        Alert.alert('Payment processing', result.message || 'Please wait while we process your payment.')
      } else {
        await recordPaymentFailure(null, { PACKAGEID: banner?.paymentId }, {
          status: 'failure', reason: result.message, retryRoute: 'renewal', retryParams: route.params,
        })
        setRemainingMs(await getRetryRemainingMs())
        Alert.alert('Renewal Failed', result.message || 'We could not process your renewal. Please try again later.')
      }
    } finally {
      setRenewing(false)
    }
  }

  if (loading || !banner) {
    return (
      <View style={[s.screen, s.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
      </View>
    )
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>{banner.title}</Text>

        <View style={s.planCard}>
          {!!banner.planName && (
            <Row label={banner.planName} value={banner.planDuration} />
          )}
          {!!banner.paymentLabel && (
            <Row label={banner.paymentLabel} value={banner.paymentMethod} />
          )}
        </View>

        {banner.benefits.length > 0 && (
          <>
            <Text style={s.benefitsTitle}>{banner.benefitsTitle}</Text>
            {banner.benefits.map((b, idx) => (
              <View key={idx} style={s.benefitRow}>
                <CdnSvg uri={ICON_TICK} width={18} height={18} />
                <Text style={s.benefitText}>{b.value}</Text>
              </View>
            ))}
          </>
        )}

        {remainingMs > 0 && (
          <Text style={s.cooldownNote}>
            You can retry in {Math.ceil(remainingMs / 60000)} minute{Math.ceil(remainingMs / 60000) === 1 ? '' : 's'}.
          </Text>
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <ButtonRevamp
          label="Renew Now"
          variant="primary"
          size="large"
          fullWidth
          loading={renewing}
          disabled={remainingMs > 0}
          onPress={handleRenewNow}
          style={s.renewBtn}
        />
        <ButtonRevamp label="Maybe Later" variant="link" size="medium" onPress={handleMaybeLater} />
      </View>

      <PaymentRestrictedSheet
        visible={restrictedMinutes != null}
        remainingMinutes={restrictedMinutes ?? 0}
        onClose={() => setRestrictedMinutes(null)}
      />
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      {!!value && <Text style={s.rowValue}>{value}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: Colors.white },
  centered: { alignItems: 'center', justifyContent: 'center' },

  content: { padding: 16 },
  title:   { fontFamily: Fonts.poppinsSemiBold, fontSize: 20, color: Colors.black, marginBottom: 16 },

  planCard: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 16, gap: 8, marginBottom: 20,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  row:      { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textSecondary },
  rowValue: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black },

  benefitsTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black, marginBottom: 8 },
  benefitRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  benefitText:   { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black, flexShrink: 1 },

  cooldownNote: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, color: Colors.textSecondary, marginTop: 12 },

  footer:   { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  renewBtn: { backgroundColor: Colors.primaryDark },
})
