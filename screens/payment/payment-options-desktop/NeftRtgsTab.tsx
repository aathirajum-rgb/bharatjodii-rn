// NEFT/RTGS/Pay at bank tab (Figma "Jodii Desktop - Registration", node
// 536:10942) — purely informational, same as mobile NeftRtgsScreen.tsx:
// getPayAtBankList() (unchanged), a bank-logo tab switcher, and the selected
// bank's account details + branch link. No submit/CTA button — matches both
// the mobile screen and the Figma design (no Pay button on this tab).
import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../../../components/cdn-svg/CdnSvg'
import { Colors } from '../../../constants/colors'
import { getPayAtBankList, type PayAtBankItem } from '../../../service/paymentService'

export default function NeftRtgsTab() {
  const [banks, setBanks]       = useState<PayAtBankItem[]>([])
  const [tollFree, setTollFree] = useState('')
  const [selected, setSelected] = useState(0)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    getPayAtBankList().then(data => {
      setBanks(data.banks)
      setTollFree(data.tollFreeNo)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 40 }} />
  }

  const bank = banks[selected]

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>NEFT/RTGS/Pay at bank</Text>

      {!!tollFree && (
        <Text style={s.note}>
          Share the transaction details with us after the payment at{' '}
          <Text style={s.link} onPress={() => Linking.openURL(`tel:${tollFree}`)}>{tollFree}</Text>
          {' '}(Toll Free)
        </Text>
      )}

      {banks.length > 0 && (
        <View style={s.tilesRow}>
          {banks.map((item, idx) => (
            <Pressable
              key={item.Bank + idx}
              style={s.tileWrap}
              onPress={() => setSelected(idx)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected === idx }}
            >
              <View style={[s.tile, selected === idx && s.tileSelected]}>
                {!!(item.ImagePathOn || item.ImagePathOff) && (
                  <CdnSvg
                    uri={(selected === idx ? item.ImagePathOn : item.ImagePathOff) ?? item.ImagePathOn ?? ''}
                    width={28}
                    height={28}
                  />
                )}
              </View>
              <Text style={s.tileLabel} numberOfLines={1}>{item.Bank}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!!bank && (
        <View style={s.detailCard}>
          <DetailRow label="Pay to A/C number" value={bank.AccNo} />
          <DetailRow label="A/C name" value={bank.AccName} />
          <DetailRow label="IFSC code" value={bank.IFSCNo} />

          {!!bank.BranchUrl && (
            <Text style={s.footnote}>
              Visit any {bank.Bank} branch in India to make your payment in cash{' '}
              <Text style={s.link} onPress={() => Linking.openURL(bank.BranchUrl!)}>View branch</Text>
            </Text>
          )}
        </View>
      )}
    </ScrollView>
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
  wrap: { gap: 16 },
  title: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black },
  note: { fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  link: { color: Colors.link, fontFamily: 'Poppins-Medium' },

  tilesRow: { flexDirection: 'row', gap: 27, flexWrap: 'wrap' },
  tileWrap: { width: 58, alignItems: 'center', gap: 6 },
  tile: {
    width: 58, height: 58, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
  },
  tileSelected: { borderColor: 'rgba(181, 0, 51, 0.40)', backgroundColor: 'rgba(181, 0, 51, 0.02)' },
  tileLabel: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.black, textAlign: 'center' },

  detailCard: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 16, gap: 12,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  detailRow: { flexDirection: 'row' },
  detailLabel: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black, width: 150 },
  detailColon: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black, width: 12 },
  detailValue: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.black, flexShrink: 1 },

  footnote: { fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginTop: 4 },
})
