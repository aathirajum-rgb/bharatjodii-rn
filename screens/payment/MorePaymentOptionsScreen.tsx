// Angular: pages/recharge/more-payment-option/more-payment-option.page.html
// + .ts — a DEDICATED screen reached by tapping "Other payment modes"
// (OTHERMODES key) on payment-mode (PaymentOptionsScreen), NOT rows shown
// inline on that screen. Filters the SAME PAYMENTMETHODS list by
// item.PAGE_ID==2 (Net Banking / NEFT-RTGS-Pay at Bank / Pay at our stores),
// plus a "Need help in making payment?" contact link.

import { useEffect, useState } from 'react'
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN, CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import LinkCTA from '../../components/link-cta/LinkCTA'
import {
  getPaymentConfig, getRechargeHelpline, type PaymentMethodItem, type SelectedPackage,
} from '../../service/paymentService'

const ICON_BACK    = CDN_REACT + '/menu_back_arrow.svg'
const ICON_CHEVRON = CDN_REACT + '/menu_right_arrow.svg'

// Angular: <img [src]="common.ImgDomain() + item.IMG"> — PAYMENTMETHODS icon
// paths come back relative to the CDN root, not as absolute URLs.
function resolveIcon(path: string): string {
  return /^https?:\/\//.test(path) ? path : CDN + path
}

type Props = { navigation: any; route: any }

export default function MorePaymentOptionsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const selectedPackage: SelectedPackage | undefined = route.params?.selectedPackage
  const amountLabel: string | undefined = route.params?.amountLabel

  const [methods, setMethods] = useState<PaymentMethodItem[]>([])
  const [helpline, setHelpline] = useState('')

  useEffect(() => {
    getPaymentConfig().then(config => {
      const list = (config.PAYMENTMETHODS ?? []).filter(m => Number(m.PAGE_ID) === 2)
      setMethods(list)
    })
    getRechargeHelpline().then(setHelpline)
  }, [])

  function handleBack() {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  // Angular: more-payment-option.page.ts onClickPaymentModes() — NETBANKING/
  // DEBITCARD have built RN screens already; NEFT (NEFT/RTGS/Pay at Bank)
  // and PAYATSTORE (branch locator) don't have one yet.
  function handlePress(item: PaymentMethodItem) {
    const params = { selectedPackage, amountLabel }
    switch (item.KEY) {
      case 'NETBANKING': navigation.navigate('net-banking', params); break
      case 'DEBITCARD':  navigation.navigate('card-payment', params); break
      default:           Alert.alert(item.NAME, 'This payment mode is coming soon.')
    }
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>More Payment Options</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {methods.map((item, idx) => (
          <Pressable
            key={item.KEY}
            style={[s.row, idx === methods.length - 1 && s.rowLast]}
            onPress={() => handlePress(item)}
            accessibilityRole="button"
          >
            <View style={s.rowLeft}>
              <View style={s.iconBox}>
                <CdnSvg uri={resolveIcon(item.IMG)} width={24} height={24} />
              </View>
              <Text style={s.rowLabel}>{item.NAME}</Text>
            </View>
            <CdnSvg uri={ICON_CHEVRON} width={20} height={20} />
          </Pressable>
        ))}

        {!!helpline && (
          <LinkCTA
            text="Need help in making payment?"
            contact={helpline}
            onPress={() => Linking.openURL(`tel:${helpline}`)}
            style={s.helpline}
          />
        )}
      </ScrollView>
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

  content: { padding: 16 },

  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    minHeight:      64,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 16, flexShrink: 1 },
  iconBox: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontFamily: 'Poppins-Regular', fontSize: 16, color: Colors.black },

  helpline: { marginTop: 32 },
})
