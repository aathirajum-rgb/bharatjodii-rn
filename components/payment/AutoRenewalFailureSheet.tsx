// Figma: Jodii-Auto-Renewal, nodes 87:5185 (PAGETYPE '4', with the bonus-
// contacts highlight box) and 1:12431 (PAGETYPE '5', plain discount only).
// Angular: payment-failed.page.html's PAGETYPE 4/5 block (lines ~250-329,
// ~550-599 for the modal variant) — countdown timer, package/discount
// breakdown, tappable payment-method rows (each row navigates directly,
// unlike the plain radio-picker variant's single shared Retry button).

import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { CDN, CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'
import { type PaymentFailedDetail, type PaymentMethodItem } from '../../service/paymentService'

// Angular: payment-failed.page.html:171 — confirmed real asset path, used
// specifically for the PAGETYPE 4/5 auto-renewal-flavored box.
const ICON_AUTO_RENEWAL = CDN + 'assets/images/svg/auto_renewal.svg'
const ICON_CHEVRON      = CDN_REACT + '/menu_right_arrow.svg'

function resolveIcon(path: string): string {
  return /^https?:\/\//.test(path) ? path : CDN + path
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

type Props = {
  detail:              PaymentFailedDetail
  onSelectMethod:      (item: PaymentMethodItem) => void
  onOtherPaymentModes: () => void
}

export default function AutoRenewalFailureSheet({ detail, onSelectMethod, onOtherPaymentModes }: Props) {
  const [remainingMs, setRemainingMs] = useState(
    detail.timerEndMs ? Math.max(0, detail.timerEndMs - Date.now()) : 0,
  )

  useEffect(() => {
    if (!detail.timerEndMs) return
    const id = setInterval(() => {
      setRemainingMs(Math.max(0, detail.timerEndMs! - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [detail.timerEndMs])

  const showBonusContacts = detail.pageType === '4' && !!detail.profileCount && !!detail.extraContact
  const totalContacts = showBonusContacts
    ? Number(detail.profileCount) + Number(detail.extraContact)
    : undefined

  return (
    <View style={s.container}>
      <CdnSvg uri={ICON_AUTO_RENEWAL} width={48} height={48} style={s.icon} />

      <Text style={s.title}>{detail.title || 'Pay without auto renewal now'}</Text>
      {!!detail.content && <Text style={s.subtitle}>{detail.content}</Text>}

      {!!detail.timerEndMs && (
        <View style={s.timerChip}>
          <Text style={s.timerValue}>{formatCountdown(remainingMs)}</Text>
          <Text style={s.timerUnit}> mins</Text>
        </View>
      )}

      <View style={s.priceBox}>
        <View style={s.priceRow}>
          <View style={s.priceRowLeft}>
            <Text style={s.packageName}>{detail.packageName || 'Standard'}</Text>
            {!!detail.packageDuration && <Text style={s.packageDuration}>{detail.packageDuration}</Text>}
          </View>
          {!!detail.packageCost && <Text style={s.amount}>₹{detail.packageCost}</Text>}
        </View>

        {!!detail.discountAmt && (
          <View style={s.priceRow}>
            <Text style={s.discountLabel}>Special discount</Text>
            <Text style={s.discountAmount}>- ₹{detail.discountAmt}</Text>
          </View>
        )}

        {showBonusContacts && (
          <View style={s.bonusBox}>
            <View style={s.priceRow}>
              <Text style={s.bonusLabel}>{detail.discountTitle}</Text>
            </View>
            <Text style={s.bonusTotal}>
              {detail.profileCount} + {detail.extraContact} Free contacts = {totalContacts} contacts
            </Text>
          </View>
        )}

        <View style={s.priceDivider} />
        <View style={s.priceRow}>
          <Text style={s.totalLabel}>Total amount</Text>
          {!!detail.totalAmt && <Text style={s.totalAmount}>₹{detail.totalAmt}</Text>}
        </View>
      </View>

      <View style={s.methodsCard}>
        {detail.paymentMethods.map((item, idx) => (
          <View key={item.KEY}>
            {idx > 0 && <View style={s.divider} />}
            <Pressable style={s.row} onPress={() => onSelectMethod(item)} accessibilityRole="button">
              <View style={s.rowLeft}>
                <CdnSvg uri={resolveIcon(item.IMG)} width={24} height={24} />
                <Text style={s.rowLabel}>{item.NAME}</Text>
              </View>
              <CdnSvg uri={ICON_CHEVRON} width={20} height={20} />
            </Pressable>
          </View>
        ))}
      </View>

      <Pressable style={s.otherModesBtn} onPress={onOtherPaymentModes} accessibilityRole="button">
        <Text style={s.otherModesText}>{detail.otherPaymentModesLabel || 'View other payment options'}</Text>
        <CdnSvg uri={ICON_CHEVRON} width={16} height={16} />
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  container: { width: '100%', alignItems: 'center' },
  icon:      { marginBottom: 16 },
  title: {
    fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font18, color: Colors.black,
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black,
    textAlign: 'center', lineHeight: 20, marginBottom: 16,
  },

  timerChip: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center',
    backgroundColor: '#F2FFF6', borderWidth: 1, borderColor: '#D7EFDF', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8, marginBottom: 16,
  },
  timerValue: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font24, color: Colors.black },
  timerUnit:  { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.black },

  priceBox: {
    width: '100%', borderRadius: 12, padding: 12, marginBottom: 16,
    backgroundColor: 'rgba(181,0,51,0.05)', borderWidth: 1, borderColor: 'rgba(181,0,51,0.1)',
    gap: 8,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceRowLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  packageName:     { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: FontSize.font14, color: Colors.black },
  packageDuration: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: '#545454' },
  amount:          { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font14, color: Colors.black },

  discountLabel:  { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.black },
  discountAmount: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.discountGreen },

  bonusBox: {
    backgroundColor: '#F5DCE2', borderWidth: 1, borderColor: '#F5DCE2', borderRadius: 8,
    padding: 8, gap: 4,
  },
  bonusLabel: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: FontSize.font12, color: Colors.black },
  bonusTotal: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black },

  priceDivider: { height: 1, backgroundColor: Colors.divider },
  totalLabel:   { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font14, color: Colors.black },
  totalAmount:  { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font14, color: Colors.black },

  methodsCard: {
    width: '100%', backgroundColor: Colors.white, borderRadius: 12,
    paddingHorizontal: 12, marginBottom: 16,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4,
    elevation: 4,
  },
  divider: { height: 1, backgroundColor: Colors.divider },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 56, paddingVertical: 12,
  },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  rowLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black },

  otherModesBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  otherModesText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.link },
})
