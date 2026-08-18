// Net banking tab (Figma "Jodii Desktop - Registration", node 536:9535) —
// same bank list/selection as mobile NetBankingScreen.tsx (getNetBankingList,
// unchanged), submitted the same new-tab way as CardTab.tsx: getHostedCheckoutRequest()
// is unchanged, only how the {uri, body} form is rendered differs from the
// native WebView (see CardTab.tsx's comment for why the result can't be
// polled for automatically on web).
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../../components/button-revamp/ButtonRevamp'
import PaymentRestrictedSheet from '../../../components/payment/PaymentRestrictedSheet'
import { Colors } from '../../../constants/colors'
import { navigate } from '../../../utils/navigationRef'
import {
  getFinalAmount, getHostedCheckoutRequest, getNetBankingList, getRetryRemainingMs,
  submitHostedCheckoutFormOnWeb, type NetBankingItem, type SelectedPackage,
} from '../../../service/paymentService'
import { Fonts, SemanticFontsEnglish } from '../../../src/theme/fonts'

const POPULAR_COUNT = 4

type Props = { selectedPackage: SelectedPackage; amountLabel: string }

export default function NetBankingTab({ selectedPackage, amountLabel }: Props) {
  const [banks, setBanks]     = useState<NetBankingItem[]>([])
  const [selectedKey, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [paying, setPaying]   = useState(false)
  const [awaiting, setAwaiting] = useState(false)
  const [restrictedMinutes, setRestrictedMinutes] = useState<number | null>(null)

  useEffect(() => {
    getNetBankingList().then(list => { setBanks(list); setLoading(false) })
  }, [])

  const popularBanks = banks.slice(0, POPULAR_COUNT)
  const otherBanks    = banks.slice(POPULAR_COUNT)

  async function handlePay() {
    if (!selectedKey) return

    setPaying(true)
    try {
      const remainingMs = await getRetryRemainingMs()
      if (remainingMs > 0) {
        setRestrictedMinutes(Math.ceil(remainingMs / 60000))
        return
      }

      const request = await getHostedCheckoutRequest(
        selectedPackage.PACKAGEID, getFinalAmount(selectedPackage), 'netbanking', selectedKey,
      )
      if (!request) {
        Alert.alert('Error', 'Could not start payment. Please try again.')
        return
      }
      submitHostedCheckoutFormOnWeb(request)
      setAwaiting(true)
    } finally {
      setPaying(false)
    }
  }

  if (awaiting) {
    return (
      <View style={s.awaitWrap}>
        <Text style={s.awaitTitle}>Complete your payment in the new tab</Text>
        <Text style={s.awaitBody}>
          We've opened your bank's secure net-banking page in a new browser tab. Once you've
          finished paying there, come back here.
        </Text>
        <ButtonRevamp
          label="I've completed the payment"
          variant="primary"
          size="large"
          style={{ backgroundColor: Colors.primaryDark }}
          onPress={() => navigate('Matches')}
        />
        <Pressable onPress={() => setAwaiting(false)} hitSlop={8}>
          <Text style={s.awaitBack}>Back to bank selection</Text>
        </Pressable>
      </View>
    )
  }

  if (loading) {
    return <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 40 }} />
  }

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Net banking</Text>

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
                    <CdnSvg uri={bank.ImagePathOn ?? bank.ImagePathOff ?? ''} width={24} height={24} />
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
          <Text style={s.sectionLabel}>Select from other banks</Text>
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
              </Pressable>
            ))}
          </View>
        </>
      )}

      <ButtonRevamp
        label={amountLabel ? `Pay ${amountLabel}` : 'Pay'}
        variant="primary"
        size="large"
        loading={paying}
        disabled={!selectedKey}
        style={[{ backgroundColor: Colors.primaryDark }, s.payBtn]}
        onPress={handlePay}
      />

      <PaymentRestrictedSheet
        visible={restrictedMinutes != null}
        remainingMinutes={restrictedMinutes ?? 0}
        onClose={() => setRestrictedMinutes(null)}
      />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  title: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, marginBottom: 8 },
  sectionLabel: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 14, color: Colors.black, marginBottom: 8 },

  popularGrid: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  popularItem: { width: 58, alignItems: 'center', gap: 6 },
  popularIconBox: {
    width: 58, height: 58, borderRadius: 8, borderWidth: 1, borderColor: '#E6E6E6',
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
  },
  popularLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.black, textAlign: 'center' },

  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 16 },
  otherList: { gap: 8 },
  otherRow: {
    height: 48, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  otherLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, color: Colors.black },

  selectedTint: {
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(181, 0, 51, 0.40)', backgroundColor: 'rgba(249, 230, 235, 0.20)',
  },

  payBtn: { alignSelf: 'flex-start', marginTop: 24, minWidth: 200 },

  awaitWrap: { gap: 16, paddingVertical: 24, alignItems: 'center' },
  awaitTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, textAlign: 'center' },
  awaitBody: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20, maxWidth: 360,
  },
  awaitBack: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 13, color: Colors.link, marginTop: 4 },
})
