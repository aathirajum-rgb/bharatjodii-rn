// STUB — Angular: pages/verify-id/verify-id.page.ts(+.html) is a full
// government-ID verification flow (camera capture, selfie, upload, retry/
// attempts tracking — 2100+ lines of logic). Not ported yet; this placeholder
// exists only so BlockerScreen.tsx's "Verify with a Govt ID" row and
// HomeScreen.tsx's non-ID-verified-male hero banner/sticky/PCS-card CTAs have
// somewhere to land instead of silently no-op'ing. Replace with the real flow
// when that gets built out.
import { useEffect, useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { fetchCustomerCare } from '../../service/homeService'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

export default function VerifyIdScreen({ navigation }: { navigation: any }) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [phone, setPhone] = useState('')

  useEffect(() => {
    fetchCustomerCare().then(result => setPhone(result.phone))
  }, [])

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('VERIFY_BLOCKER.VERIFY_GOVT_PROOF')}</Text>
      </View>

      <View style={[s.content, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={s.heading}>{'This feature is coming soon'}</Text>
        <Text style={s.body}>{'Government ID verification isn’t available in the app just yet. If you need help verifying your account, our support team can assist you.'}</Text>

        {!!phone && (
          <Pressable style={s.callBtn} onPress={() => Linking.openURL(`tel:${phone}`)}>
            <Text style={s.callBtnText}>{`Call support • ${phone}`}</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: 'Poppins-Medium', color: '#333333', marginLeft: 6, marginRight: 16 },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 48, alignItems: 'center' },
  heading: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.textPrimary, textAlign: 'center', marginBottom: 12 },
  body:    { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28 },

  callBtn:     { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24, backgroundColor: Colors.primary },
  callBtnText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.white },
})
