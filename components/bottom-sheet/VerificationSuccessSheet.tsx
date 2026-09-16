import LottieView from 'lottie-react-native'
import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, Modal, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_LOTTIE } from '../../constants/cdn'
import { FontSize } from '../../src/theme/fonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_H      = Dimensions.get('window').height
const LOTTIE_URL    = CDN_LOTTIE + 'success-new.json'
const AUTO_CLOSE_MS = 3000

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  visible:   boolean
  title:     string
  subtitle:  string
  onDismiss: () => void
}

// ─── VerificationSuccessSheet ─────────────────────────────────────────────────
// Same Modal/spring/auto-dismiss skeleton as OTPSuccessSheet, generalized with
// title/subtitle props instead of hardcoded OTP copy so other "success moment"
// screens (govt-ID verification, etc.) can reuse it without duplicating the
// animation plumbing.

export default function VerificationSuccessSheet({ visible, title, subtitle, onDismiss }: Props) {
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
        toValue:         0,
        tension:         55,
        friction:        11,
        useNativeDriver: true,
      }),
      Animated.timing(scrimAnim, {
        toValue:         1,
        duration:        200,
        useNativeDriver: true,
      }),
    ]).start()

    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue:         SCREEN_H,
          duration:        220,
          useNativeDriver: true,
        }),
        Animated.timing(scrimAnim, {
          toValue:         0,
          duration:        180,
          useNativeDriver: true,
        }),
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
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 24) },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.lottieWrapper}>
          <LottieView
            source={{ uri: LOTTIE_URL }}
            autoPlay
            loop={false}
            style={styles.lottie}
          />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </Animated.View>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      Colors.surface,
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

  lottieWrapper: {
    width:        124,
    height:       125,
    alignSelf:    'flex-start',
    marginBottom: 16,
    overflow:     'hidden',
  },
  lottie: {
    width:  124,
    height: 125,
  },

  title: {
    fontSize:     FontSize.font18,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    lineHeight:   24,
    marginBottom: 12,
  },

  subtitle: {
    fontSize:     FontSize.font14,
    color:        Colors.textPrimary,
    lineHeight:   20,
    marginBottom: 8,
  },
})
