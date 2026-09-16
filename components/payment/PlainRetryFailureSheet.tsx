// Figma: Jodii - Master File English, node 3703:910 — the default failure
// retry screen (no promo/discount data), used whenever the failure-detail API
// returns PAGETYPE '0' or anything not yet ported ('1'/'2'). Angular's closest
// analogue is payment-failed.page.html's "old payment page popup" block
// (PAGETYPE === '0') — a radio-picker of payment methods + a single Retry button.

import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { CDN, CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../cdn-svg/CdnSvg'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'
import { type PaymentMethodItem } from '../../service/paymentService'

// Angular: payment-failed.page.html:15 — confirmed real asset path.
const ICON_ALERT   = CDN + 'assets/images/svg/recharge/congo-payment-failed.svg'
const ICON_CHEVRON = CDN_REACT + '/menu_right_arrow.svg'

function resolveIcon(path: string): string {
  return /^https?:\/\//.test(path) ? path : CDN + path
}

type Props = {
  methods:             PaymentMethodItem[]
  amountLabel:         string
  otherPaymentModesLabel?: string | undefined
  onRetry:             (item: PaymentMethodItem) => void
  onOtherPaymentModes: () => void
}

export default function PlainRetryFailureSheet({
  methods, amountLabel, otherPaymentModesLabel, onRetry, onOtherPaymentModes,
}: Props) {
  const [selectedKey, setSelectedKey] = useState(methods[0]?.KEY ?? '')

  return (
    <View style={s.container}>
      <CdnSvg uri={ICON_ALERT} width={64} height={64} style={s.icon} />
      <Text style={s.title}>Payment failed!</Text>
      <Text style={s.subtitle}>Retry again through one of the following options:</Text>

      <View style={s.card}>
        {methods.map((item, idx) => (
          <View key={item.KEY}>
            {idx > 0 && <View style={s.divider} />}
            <Pressable
              style={s.row}
              onPress={() => setSelectedKey(item.KEY)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedKey === item.KEY }}
            >
              <View style={s.rowLeft}>
                <View style={s.iconBox}>
                  <CdnSvg uri={resolveIcon(item.IMG)} width={24} height={24} />
                </View>
                <Text style={s.rowLabel}>{item.NAME}</Text>
              </View>
              <View style={[s.radioCircle, selectedKey === item.KEY && s.radioCircleSelected]}>
                {selectedKey === item.KEY && <View style={s.radioDot} />}
              </View>
            </Pressable>
          </View>
        ))}

        {methods.length > 0 && <View style={s.divider} />}
        <Pressable style={s.row} onPress={onOtherPaymentModes} accessibilityRole="button">
          <Text style={s.otherLabel}>{otherPaymentModesLabel || 'Use other payment options'}</Text>
          <CdnSvg uri={ICON_CHEVRON} width={20} height={20} />
        </Pressable>
      </View>

      <ButtonRevamp
        label={`Retry ${amountLabel}`}
        variant="primary"
        fullWidth
        disabled={!selectedKey}
        style={[s.retryBtn, { backgroundColor: Colors.primaryDark }]}
        onPress={() => {
          const item = methods.find(m => m.KEY === selectedKey)
          if (item) onRetry(item)
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { width: '100%' },
  icon:      { marginBottom: 16 },
  title:     { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font20, color: Colors.black, marginBottom: 8 },
  subtitle:  {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.textSecondary,
    lineHeight: 20, marginBottom: 20,
  },

  card: {
    backgroundColor:   Colors.white,
    borderRadius:      16,
    paddingHorizontal: 12,
    shadowColor:       Colors.shadow,
    shadowOffset:      { width: 0, height: 6 },
    shadowOpacity:     0.08,
    shadowRadius:      8,
    elevation:         4,
    marginBottom:      20,
  },
  divider: { height: 1, backgroundColor: Colors.divider },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 56, paddingVertical: 12,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  iconBox: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel:   { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black },
  otherLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black },

  radioCircle: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: Colors.primaryDark },
  radioDot:            { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primaryDark },

  retryBtn: { marginTop: 4 },
})
