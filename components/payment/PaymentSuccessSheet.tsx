// Figma: Jodii - Master File English, node 3604:749 — checkmark animation +
// "Payment successful!" + "Enjoy your premium benefits", no CTA at all.
// Angular's congratulations page has a "View matches" button, but this specific
// sheet design doesn't — same non-dismissable/auto-close treatment as
// OTPSuccessSheet.tsx (Angular's RegistrationModalPopupComponent otpVerified
// popup), which this is architecturally identical to.

import LottieView from 'lottie-react-native'
import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, Modal, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_LOTTIE } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const SCREEN_H      = Dimensions.get('window').height
const LOTTIE_URL    = CDN_LOTTIE + 'success-new.json'
const AUTO_CLOSE_MS = 3000

type Props = {
  visible:   boolean
  onDismiss: () => void
}

export default function PaymentSuccessSheet({ visible, onDismiss }: Props) {
  const insets = useSafeAreaInsets()

  const [modalVisible, setModalVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current
  const scrimAnim = useRef(new Animated.Value(0)).current
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!visible) return

    slideAnim.setValue(SCREEN_H)
    scrimAnim.setValue(0)
    setModalVisible(true)

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0, tension: 55, friction: 11, useNativeDriver: true,
      }),
      Animated.timing(scrimAnim, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }),
    ]).start()

    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
        Animated.timing(scrimAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) {
          setModalVisible(false)
          onDismiss()
        }
      })
    }, AUTO_CLOSE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [visible])

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: Colors.black,
            opacity: scrimAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] }),
          },
        ]}
        pointerEvents="none"
      />

      <Animated.View
        style={[
          s.sheet,
          { paddingBottom: Math.max(insets.bottom, 24) },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <LottieView source={{ uri: LOTTIE_URL }} autoPlay loop={false} style={s.lottie} />
        <Text style={s.title}>Payment successful!</Text>
        <Text style={s.subtitle}>Enjoy your premium benefits</Text>
      </Animated.View>
    </Modal>
  )
}

const s = StyleSheet.create({
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      Colors.white,
    borderTopLeftRadius:  16,
    borderTopRightRadius: 16,
    paddingTop:           24,
    paddingHorizontal:    24,
    shadowColor:          Colors.shadow,
    shadowOpacity:        0.15,
    shadowRadius:         16,
    shadowOffset:         { width: 0, height: -4 },
    elevation:            16,
  },
  lottie: {
    width:  84,
    height: 84,
    alignSelf:    'flex-start',
    marginBottom: 16,
  },
  title: {
    fontFamily:   Fonts.poppinsSemiBold,
    fontSize:     20,
    color:        '#1f1e1b',
    lineHeight:   28,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   14,
    color:      '#1f1e1b',
  },
})
