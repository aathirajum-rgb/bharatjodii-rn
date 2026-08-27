// Angular: pages/recharge/netbanking/netbanking.page.html + .ts — reached by
// tapping "Net Banking" on payment-mode (PaymentOptionsScreen).
//
// Figma: Jodii - Master File English, node 3650:10435 ("Net banking" header +
// popular-bank grid + always-visible "All banks" list, no collapse toggle) +
// node 2792:9267 (the NEFT/RTGS screen, sharing the same bank-selector grid —
// its HDFC card shows the confirmed selected-state treatment: border
// rgba(181,0,51,0.4) + background rgba(249,230,235,0.2), reused here for both
// the popular grid AND the "All banks" list row).

import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import PaymentRestrictedSheet from '../../components/payment/PaymentRestrictedSheet'
import { handleBack as handleRootBack } from '../../utils/navigationRef'
import { SemanticFontsEnglish } from '../../src/theme/fonts'
import {
  getFinalAmount, getNetBankingList, getRetryRemainingMs,
  type NetBankingItem, type SelectedPackage,
} from '../../service/paymentService'

const ICON_BACK    = CDN_REACT + '/menu_back_arrow.svg'
const ICON_CHEVRON = CDN_REACT + '/menu_right_arrow.svg'

const POPULAR_COUNT = 4

type Props = { navigation: any; route: any }

export default function NetBankingScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const selectedPackage: SelectedPackage | undefined = route.params?.selectedPackage
  const amountLabel: string | undefined = route.params?.amountLabel

  const [banks, setBanks]         = useState<NetBankingItem[]>([])
  const [selectedKey, setSelected] = useState('')
  const [loading, setLoading]     = useState(true)
  const [paying, setPaying]       = useState(false)
  const [restrictedMinutes, setRestrictedMinutes] = useState<number | null>(null)

  useEffect(() => {
    loadBanks()
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
    if (navigation.canGoBack()) handleRootBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  // Netbanking is a hosted-webview flow, not a native-SDK order submission —
  // see HostedCheckoutWebViewScreen.tsx. Real device trace confirmed
  // nbpaymentcheckout returns raw HTML + a JS-bridge callback for this
  // method (matching the old native Android app's PaymentWebviewActivity
  // design exactly), not a Razorpay order — so the checkout call, native
  // submission, and verification all happen on that screen instead.
  async function handlePay() {
    if (!selectedKey || !selectedPackage) return

    setPaying(true)
    try {
      const remainingMs = await getRetryRemainingMs()
      if (remainingMs > 0) {
        setRestrictedMinutes(Math.ceil(remainingMs / 60000))
        return
      }

      navigation.navigate('hosted-checkout', {
        selectedPackage,
        amountLabel,
        method:   'netbanking',
        bank:     selectedKey,
        amount:   getFinalAmount(selectedPackage),
        retryRoute:  'net-banking',
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
        <Text style={s.headerTitle} numberOfLines={1}>Net banking</Text>
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
                    style={s.popularItem}
                    onPress={() => setSelected(bank.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selectedKey === bank.key }}
                  >
                    <View style={[s.popularIconBox, selectedKey === bank.key && s.selectedTint]}>
                      {!!(bank.ImagePathOn || bank.ImagePathOff) && (
                        <CdnSvg
                          uri={bank.ImagePathOn ?? bank.ImagePathOff ?? ''}
                          width={24}
                          height={24}
                        />
                      )}
                    </View>
                    <Text style={s.popularLabel} numberOfLines={1}>{bank.bankName}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {otherBanks.length > 0 && (
            <>
              <View style={s.divider} />
              <Text style={s.sectionLabel}>All banks</Text>
              <View style={s.otherList}>
                {otherBanks.map(bank => (
                  <Pressable
                    key={bank.key}
                    style={[s.otherRow, selectedKey === bank.key && s.selectedTint]}
                    onPress={() => setSelected(bank.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selectedKey === bank.key }}
                  >
                    <Text style={s.otherLabel} numberOfLines={1}>{bank.bankName}</Text>
                    <CdnSvg uri={ICON_CHEVRON} width={20} height={20} />
                  </Pressable>
                ))}
              </View>
            </>
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
  headerTitle: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 16, color: Colors.black, marginLeft: 16, flex: 1 },

  content: { padding: 16, gap: 16 },
  sectionLabel: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 14, color: Colors.black, marginBottom: 8 },

  popularGrid: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  popularItem: { width: 58, alignItems: 'center', gap: 6 },
  popularIconBox: {
    width: 58, height: 58, borderRadius: 8, borderWidth: 1, borderColor: '#E6E6E6',
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
  },
  popularLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.black, textAlign: 'center' },

  divider: { height: 1, backgroundColor: Colors.divider, marginBottom: 4 },
  otherList: { gap: 0 },

  otherRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 40, paddingHorizontal: 8,
  },
  otherLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.black, flexShrink: 1 },

  // Figma (NEFT/RTGS screen's selected HDFC card, node 2792:9267): the one
  // confirmed selected-state treatment, reused for both the popular grid and
  // an "All banks" row.
  selectedTint: {
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     'rgba(181, 0, 51, 0.40)',
    backgroundColor: 'rgba(249, 230, 235, 0.20)',
  },

  footer: { paddingHorizontal: 16, paddingTop: 12 },
})
