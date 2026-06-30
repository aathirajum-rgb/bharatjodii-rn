import LottieView from 'lottie-react-native'
import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_LOTTIE } from '../../constants/cdn'

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_H   = Dimensions.get('window').height
const LOTTIE_URL = CDN_LOTTIE + 'success-new.json'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  visible:    boolean
  onContinue: () => void
}

// ─── RegistrationSuccessSheet ─────────────────────────────────────────────────
// Matches Angular action='regSuccess' in registration-modal-popup.
// Shows lottie + "Profile Created Successfully!" + "Continue" CTA.
// Non-dismissable (backdropDismiss: false in Angular).

export default function RegistrationSuccessSheet({ visible, onContinue }: Props) {
  const insets = useSafeAreaInsets()
  const [modalVisible, setModalVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current
  const scrimAnim = useRef(new Animated.Value(0)).current

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
  }, [visible])

  function handleContinue() {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_H, duration: 220, useNativeDriver: true,
      }),
      Animated.timing(scrimAnim, {
        toValue: 0, duration: 180, useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setModalVisible(false)
        onContinue()
      }
    })
  }

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      {/* Scrim */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: Colors.black,
            opacity: scrimAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }),
          },
        ]}
        pointerEvents="none"
      />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 24 : 32 },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Lottie — 124×125px left-aligned, same as OTP verified sheet */}
        <View style={styles.lottieWrapper}>
          <LottieView
            source={{ uri: LOTTIE_URL }}
            autoPlay
            loop={false}
            style={styles.lottie}
          />
        </View>

        {/* Title */}
        <Text style={styles.title}>Profile Created Successfully!</Text>

        {/* Continue CTA */}
        <Pressable style={styles.ctaBtn} onPress={handleContinue}>
          <Text style={styles.ctaLabel}>Continue</Text>
          <Text style={styles.ctaArrow}> ›</Text>
        </Pressable>
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
    shadowColor:          Colors.black,
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
    fontSize:     18,
    fontWeight:   '600',
    color:        '#1f1e1b',
    lineHeight:   24,
    marginBottom: 20,
  },

  ctaBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: Colors.primary,
    borderRadius:    8,
    height:          52,
  },
  ctaLabel: {
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.surface,
  },
  ctaArrow: {
    fontSize:   20,
    fontWeight: '600',
    color:      Colors.surface,
    lineHeight: 22,
  },
})
