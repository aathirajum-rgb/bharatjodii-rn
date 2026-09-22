// Angular: pages/recharge/payusing/payusing.page.html + .ts — reached by
// tapping "NEFT/RTGS/Pay at Bank" on the More Payment Options screen
// (MorePaymentOptionsScreen). Pure bank-transfer instructions — no Razorpay
// checkout call at all: pick a bank tab, see its account details, then
// either dial the toll-free number to report the transfer or open the
// branch-locator link for that bank.

import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ScreenTopInset from '../../components/screen/ScreenTopInset'
import { getPayAtBankList, type PayAtBankItem } from '../../service/paymentService'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'
import { handleBack as handleRootBack } from '../../utils/navigationRef'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

type Props = { navigation: any; route: any }

export default function NeftRtgsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()

  const [banks, setBanks]         = useState<PayAtBankItem[]>([])
  const [tollFree, setTollFree]   = useState('')
  const [selected, setSelected]   = useState(0)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    getPayAtBankList().then(data => {
      setBanks(data.banks)
      setTollFree(data.tollFreeNo)
      setLoading(false)
    })
  }, [])

  function handleBack() {
    if (navigation.canGoBack()) handleRootBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  const bank = banks[selected]

  return (
    <View style={s.screen}>
      <ScreenTopInset />
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>NEFT/RTGS/Pay at Bank</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 16 }]}>
          {!!tollFree && (
            <Text style={s.note}>
              Share the transaction details with us after payment at{' '}
              <Text style={s.link} onPress={() => Linking.openURL(`tel:${tollFree}`)}>
                {tollFree}
              </Text>
              {' '}(Toll Free)
            </Text>
          )}

          {banks.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsRow}>
              {banks.map((item, idx) => (
                <Pressable
                  key={item.Bank + idx}
                  style={[s.tab, selected === idx && s.tabSelected]}
                  onPress={() => setSelected(idx)}
                >
                  {!!(item.ImagePathOn || item.ImagePathOff) && (
                    <CdnSvg
                      uri={(selected === idx ? item.ImagePathOn : item.ImagePathOff) ?? item.ImagePathOff ?? item.ImagePathOn ?? ''}
                      width={28}
                      height={28}
                    />
                  )}
                  <Text style={s.tabLabel} numberOfLines={1}>{item.Bank}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {!!bank && (
            <View style={s.detailCard}>
              <DetailRow label="Account No" value={bank.AccNo} />
              <DetailRow label="Account Name" value={bank.AccName} />
              <DetailRow label="IFSC Code" value={bank.IFSCNo} />

              {!!bank.BranchUrl && (
                <Text style={s.note}>
                  Visit {bank.Bank} branch to make payment.{' '}
                  <Text style={s.link} onPress={() => Linking.openURL(bank.BranchUrl!)}>
                    View Branch
                  </Text>
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailColon}>:</Text>
      <Text style={s.detailValue}>{value}</Text>
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
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font16, color: Colors.black, marginLeft: 16, flex: 1 },

  content: { padding: 16, gap: 16 },
  note: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font13, color: Colors.textSecondary, lineHeight: 20 },
  link: { color: Colors.link, fontFamily: SemanticFontsEnglish.specialCtaEnglishMedium },

  tabsRow: { flexGrow: 0 },
  tab: {
    alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.borderSubtle, marginRight: 12,
    minWidth: 84,
  },
  tabSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.selectionBg },
  tabLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font11, color: Colors.black, textAlign: 'center' },

  detailCard: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 16, gap: 12,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  detailRow: { flexDirection: 'row' },
  detailLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black, width: 130 },
  detailColon: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black, width: 12 },
  detailValue: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font14, color: Colors.black, flexShrink: 1 },
})
