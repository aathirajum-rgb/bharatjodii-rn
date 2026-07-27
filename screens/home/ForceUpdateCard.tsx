// Force-update popup — Angular: components/payment-stickey/payment-stickey.component.html's
// APPFORCEUPDATE block. Visually distinct from the payment-failed/profile-validation
// sticky (a plain bottom bar, still handled by StickyBanner): this is a bordered card
// with its own close-X on a separate top row, an alert icon, note text, and a real
// CTA button — not inline text with a trailing chevron.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'

const ALERT_ICON = 'https://imgs.jodii.app/assets/images/svg/activity-alert-img.svg'

export interface ForceUpdateCardProps {
  onPress: () => void
  onClose: () => void
}

export default function ForceUpdateCard({ onPress, onClose }: ForceUpdateCardProps) {
  const { t } = useTranslation()

  return (
    <View style={s.wrap}>
      <Pressable style={s.closeRow} onPress={onClose} hitSlop={8}>
        <Text style={s.closeText}>✕</Text>
      </Pressable>
      <View style={s.row}>
        <CdnSvg uri={ALERT_ICON} width={28} height={28} />
        <Text style={s.note} numberOfLines={3}>{t('APP_UPDATE.NOTE')}</Text>
        <Pressable style={s.cta} onPress={onPress}>
          <Text style={s.ctaText}>{t('APP_UPDATE.CTA')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: 24,
    marginBottom:      12,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       Colors.divider,
    backgroundColor:   Colors.white,
    paddingHorizontal: 12,
    paddingTop:        4,
    paddingBottom:     8,
  },
  closeRow: {
    alignSelf: 'flex-end',
    padding:   4,
  },
  closeText: {
    fontSize: 14,
    color:    '#808080',
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  note: {
    flex:       1,
    fontFamily: 'Poppins-Regular',
    fontSize:   12,
    color:      Colors.textPrimary,
  },
  cta: {
    backgroundColor:   Colors.primary,
    borderRadius:      20,
    paddingVertical:   8,
    paddingHorizontal: 14,
  },
  ctaText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   12,
    color:      Colors.white,
  },
})
