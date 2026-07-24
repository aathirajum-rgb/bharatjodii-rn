// Angular: pages/recharge/netbanking/netbanking.page.html + .ts — reached by
// tapping "Net Banking" on payment-mode (PaymentOptionsScreen). Shows the
// first few banks as a "popular" grid, the rest as a collapsible "other
// banks" radio list (netbanking.page.html:43-95) — Angular has no explicit
// "popular" flag on the data, this split is purely by render position.

import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import LinkCTA from '../../components/link-cta/LinkCTA'
import {
  getCheckoutDetails, getFinalAmount, getNetBankingList, getPaymentConfig, getRechargeHelpline,
  getRetryRemainingMs, handlePaymentSuccess, initRazorpayNative, initRazorpayPayment,
  recordPaymentFailure, stringifyPaymentResponse, toPaise, verifyPaymentSuccess,
  type NetBankingItem, type SelectedPackage,
} from '../../service/paymentService'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

const POPULAR_COUNT = 4

type Props = { navigation: any; route: any }

export default function NetBankingScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const selectedPackage: SelectedPackage | undefined = route.params?.selectedPackage
  const amountLabel: string | undefined = route.params?.amountLabel

  const [banks, setBanks]         = useState<NetBankingItem[]>([])
  const [selectedKey, setSelected] = useState('')
  const [showOthers, setShowOthers] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [paying, setPaying]       = useState(false)
  const [helpline, setHelpline]   = useState('')

  useEffect(() => {
    loadBanks()
    getRechargeHelpline().then(setHelpline)
  }, [])

  async function loadBanks() {
    setLoading(true)
    try {
      setBanks(await getNetBankingList())
    } catch {
      Alert.alert('Error', 'Could not load bank list. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const popularBanks = banks.slice(0, POPULAR_COUNT)
  const otherBanks    = banks.slice(POPULAR_COUNT)

  function handleBack() {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  async function handlePay() {
    if (!selectedKey || !selectedPackage) return

    const remainingMs = await getRetryRemainingMs()
    if (remainingMs > 0) {
      const mins = Math.ceil(remainingMs / 60000)
      Alert.alert('Please wait', `You can retry payment in about ${mins} minute${mins === 1 ? '' : 's'}.`)
      return
    }

    setPaying(true)
    try {
      const config  = await getPaymentConfig()
      const saltKey = config.RAZORPAY_KEY_ID ?? ''

      const checkout = await getCheckoutDetails(selectedPackage.PACKAGEID, 'NETBANKING')

      let result: { success: boolean; response: any }
      if (Platform.OS === 'android') {
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
          method:      'netbanking',
          razorpayKey: saltKey,
          bank:        selectedKey,
        })
      } else {
        result = await initRazorpayPayment(
          { ...checkout, amount: checkout.amount ?? toPaise(getFinalAmount(selectedPackage)), BANK: selectedKey },
          'NETBANKING', saltKey,
        )
      }

      if (result.success) {
        const verified = await verifyPaymentSuccess(result.response, checkout.orderId)
        if (verified) {
          await handlePaymentSuccess()
        } else {
          await recordPaymentFailure(null, selectedPackage, {
            status: 'pending', retryRoute: 'net-banking', retryParams: route.params,
          })
          navigation.navigate('payment-failed', {
            selectedPackage, amountLabel, status: 'pending', orderId: checkout.orderId,
            retryRoute: 'net-banking', retryParams: route.params,
          })
        }
      } else {
        const errCode: number = result.response?.code ?? 0
        if (errCode !== 0) {
          const reason = stringifyPaymentResponse(result.response)
          await recordPaymentFailure(null, selectedPackage, {
            status: 'failure', reason, retryRoute: 'net-banking', retryParams: route.params,
          })
          navigation.navigate('payment-failed', {
            selectedPackage, amountLabel, status: 'failure', reason,
            retryRoute: 'net-banking', retryParams: route.params,
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
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>Pay using Net Banking</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {popularBanks.length > 0 && (
            <>
              <Text style={s.sectionLabel}>Select from popular banks</Text>
              <View style={s.popularGrid}>
                {popularBanks.map(bank => (
                  <Pressable
                    key={bank.key}
                    style={[s.popularItem, selectedKey === bank.key && s.popularItemSelected]}
                    onPress={() => setSelected(bank.key)}
                  >
                    {!!(bank.ImagePathOn || bank.ImagePathOff) && (
                      <CdnSvg
                        uri={(selectedKey === bank.key ? bank.ImagePathOn : bank.ImagePathOff) ?? bank.ImagePathOff ?? bank.ImagePathOn ?? ''}
                        width={40}
                        height={40}
                      />
                    )}
                    <Text style={s.popularLabel} numberOfLines={1}>{bank.bankName}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {otherBanks.length > 0 && (
            <>
              <Pressable style={s.otherToggle} onPress={() => setShowOthers(v => !v)}>
                <Text style={s.otherToggleText}>Select from other banks</Text>
              </Pressable>
              {showOthers && (
                <View style={s.otherList}>
                  <Text style={s.sectionLabel}>Select bank</Text>
                  {otherBanks.map(bank => (
                    <Pressable
                      key={bank.key}
                      style={s.otherRow}
                      onPress={() => setSelected(bank.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selectedKey === bank.key }}
                    >
                      <Text style={s.otherLabel}>{bank.bankName}</Text>
                      <View style={[s.radioCircle, selectedKey === bank.key && s.radioCircleSelected]}>
                        {selectedKey === bank.key && <View style={s.radioDot} />}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}

          {!!helpline && (
            <LinkCTA
              text="Need help in making payment?"
              contact={helpline}
              onPress={() => Linking.openURL(`tel:${helpline}`)}
              style={s.helpLink}
            />
          )}
        </ScrollView>
      )}

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <ButtonRevamp
          label={amountLabel ? `Pay ${amountLabel}` : 'Pay'}
          variant="primary"
          size="large"
          fullWidth
          loading={paying}
          disabled={!selectedKey}
          style={{ backgroundColor: Colors.primaryDark }}
          onPress={handlePay}
        />
      </View>
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
  headerTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black, marginLeft: 16, flex: 1 },

  content: { padding: 16, gap: 16 },
  sectionLabel: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.black, marginBottom: 8 },

  popularGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  popularItem: {
    width: 80, alignItems: 'center', gap: 6, padding: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  popularItemSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.selectionBg },
  popularLabel: { fontFamily: 'Poppins-Regular', fontSize: 11, color: Colors.black, textAlign: 'center' },

  otherToggle: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.divider },
  otherToggleText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.link },
  otherList: { marginTop: 8 },
  helpLink:  { marginTop: 8 },

  otherRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 52, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  otherLabel: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black },

  radioCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primaryDark },

  footer: { paddingHorizontal: 16, paddingTop: 12 },
})
