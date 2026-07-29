// Angular: pages/recharge/congratulations/congratulations.page.ts — reached
// via handlePaymentSuccess() after any successful payment (all methods
// funnel through the same static benefits-summary content, no amount/order
// id/date is ever shown here). Angular's full page has a "View matches" CTA
// after a 2s Lottie splash, but this Figma variant (node 3604:749) is a
// non-dismissable auto-close sheet with no button at all — same treatment
// as OTPSuccessSheet.

import { useState } from 'react'
import { View } from 'react-native'
import PaymentSuccessSheet from '../../components/payment/PaymentSuccessSheet'
import { navigate } from '../../utils/navigationRef'
import { ENavigation } from '../../types/enums/navigation.enum'

export default function PaymentSuccessScreen() {
  const [visible, setVisible] = useState(true)

  function handleDismiss() {
    setVisible(false)
    navigate(ENavigation.MATCHES)
  }

  return (
    <View style={{ flex: 1 }}>
      <PaymentSuccessSheet visible={visible} onDismiss={handleDismiss} />
    </View>
  )
}
