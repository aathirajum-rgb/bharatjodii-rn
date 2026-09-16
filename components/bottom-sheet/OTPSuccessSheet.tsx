import LottieView from 'lottie-react-native'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, Dimensions, Modal, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_LOTTIE } from '../../constants/cdn'
import { FontSize } from '../../src/theme/fonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_H      = Dimensions.get('window').height
const LOTTIE_URL    = CDN_LOTTIE + 'success-new.json'
const AUTO_CLOSE_MS = 3000   // matches Angular: setTimeout dismissModal 3000ms

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  visible:   boolean
  onDismiss: () => void
}

// ─── OTPSuccessSheet ──────────────────────────────────────────────────────────
// Matches Angular's RegistrationModalPopupComponent with action='otpVerified'.
// Non-dismissable (backdropDismiss: false), auto-closes after 3 seconds.

export default function OTPSuccessSheet({ visible, onDismiss }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  // Keep Modal in tree until slide-out animation finishes — same pattern as BottomSheet
  const [modalVisible, setModalVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current
  const scrimAnim = useRef(new Animated.Value(0)).current
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!visible) return

    // Reset positions before animating in (handles re-open edge case)
    slideAnim.setValue(SCREEN_H)
    scrimAnim.setValue(0)
    setModalVisible(true)

    // Slide sheet up + fade scrim in
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

    // Auto-dismiss — matches Angular setTimeout 3000ms
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
      onRequestClose={() => {}}   // Android back button — non-dismissable
    >
      {/* Dim scrim — 80% max opacity, matches Angular showBackdrop + backdropDismiss:false */}
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

      {/* Bottom sheet — no close button, no drag handle (non-dismissable) */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 24) },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Success Lottie — 124×125px, left-aligned (matches Angular .anim-slot + pl-0) */}
        <View style={styles.lottieWrapper}>
          <LottieView
            source={{ uri: LOTTIE_URL }}
            autoPlay
            loop={false}
            style={styles.lottie}
          />
        </View>

        {/* "Your OTP is verified successfully!" — i18n: LOGIN_PAGE.YOUROTP */}
        <Text style={styles.title}>
          {t('LOGIN_PAGE.YOUROTP', 'Your OTP is verified successfully!')}
        </Text>

        {/* "Your number is verified..." — i18n: LOGIN_PAGE.NO_VERIFY */}
        <Text style={styles.subtitle}>
          {t('LOGIN_PAGE.NO_VERIFY', "Your number is verified. Let's start creating your profile")}
        </Text>
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

  // Outer wrapper constrains size + pins to left — LottieView ignores alignSelf on some platforms
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

  // heading2-semibold-18 color-1f1e1b
  title: {
    fontSize:     FontSize.font18,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    lineHeight:   24,
    marginBottom: 12,
  },

  // body2-regular-14 color-1f1e1b
  subtitle: {
    fontSize:     FontSize.font14,
    color:        Colors.textPrimary,
    lineHeight:   20,
    marginBottom: 8,
  },
})
