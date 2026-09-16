// Angular: pages/recharge/free-doorstep-collection/free-doorstep-collection.page.ts
// — reached by tapping "Free Doorstep Collection" (PAYMENTMETHODS KEY
// 'DOORSTEP') on payment-mode (PaymentOptionsScreen). This is a scheduling
// request, not a gateway checkout — no amount is charged here; a
// representative collects cash in person later, so success shows a plain
// "we'll call you" confirmation, not the payment-success screen (no purchase
// has actually happened yet).

import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import FloatingLabelInput from '../../components/input/FloatingLabelInput'
import { handleBack as handleRootBack } from '../../utils/navigationRef'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import { submitDoorstepCollection, type SelectedPackage } from '../../service/paymentService'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

type Props = { navigation: any; route: any }

export default function DoorstepCollectionScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const selectedPackage: SelectedPackage | undefined = route.params?.selectedPackage

  const [addressLine1, setAddressLine1] = useState('')
  const [touched, setTouched]           = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)

  const isValid = addressLine1.trim().length > 0

  function handleBack() {
    if (navigation.canGoBack()) handleRootBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  async function handleSubmit() {
    setTouched(true)
    if (!isValid || !selectedPackage) return

    setSubmitting(true)
    try {
      const ok = await submitDoorstepCollection(selectedPackage.PACKAGEID, addressLine1.trim())
      if (ok) setShowConfirm(true)
    } finally {
      setSubmitting(false)
    }
  }

  function handleConfirmDismiss() {
    setShowConfirm(false)
    navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>Free Doorstep Collection</Text>
      </View>

      <View style={s.content}>
        <Text style={s.note}>
          Share your address below & our representative will come to collect the payment.
        </Text>

        <FloatingLabelInput
          label="Enter address"
          value={addressLine1}
          onChangeText={setAddressLine1}
          errorMessage={touched && !isValid ? 'Address is required' : undefined}
          variant="text"
          style={s.field}
        />
      </View>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <ButtonRevamp
          label="Submit"
          variant="primary"
          size="large"
          fullWidth
          loading={submitting}
          disabled={touched && !isValid}
          onPress={handleSubmit}
        />
      </View>

      <BottomSheet
        visible={showConfirm}
        data={{
          title:    'Thanks!',
          content:  'We will call you on your registered mobile number.',
          ctaLabel: 'OK',
        }}
        onClose={handleConfirmDismiss}
        onPrimaryPress={handleConfirmDismiss}
      />
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 16,
    backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font16, color: Colors.black, flex: 1 },

  content: { flex: 1, padding: 16 },
  note: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 20 },
  field: { marginBottom: 8 },

  footer: { paddingHorizontal: 16, paddingTop: 12 },
})
