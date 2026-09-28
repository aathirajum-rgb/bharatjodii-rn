import LottieView from 'lottie-react-native'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, Dimensions, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_LOTTIE, CDN_SVG } from '../../constants/cdn'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import CdnSvg from '../cdn-svg/CdnSvg'
import { FontSize } from '../../src/theme/fonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_H   = Dimensions.get('window').height
const LOTTIE_URL = CDN_LOTTIE + 'success-new.json'
// Same asset ButtonRevamp's ICON_URLS registers under 'forward-bold-icon-white'
// (components/button-revamp/ButtonRevamp.tsx) — reused directly here since this
// CTA hand-rolls its own Pressable rather than using ButtonRevamp.
const CTA_ARROW_ICON_URL = CDN_SVG + 'revamp/forward-bold-icon-white.svg'

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
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
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
        <Text style={[styles.title, { fontFamily: langFonts.semiBold }]}>
          {t('REGISTRATION.PROFILECREATEDTXT', 'Profile Created Successfully!')}
        </Text>

        {/* Continue CTA */}
        <Pressable style={styles.ctaBtn} onPress={handleContinue}>
          <Text style={[styles.ctaLabel, { fontFamily: langFonts.semiBold }]}>
            {t('REGISTRATION.CONTINUE', 'Continue')}
          </Text>
          <CdnSvg uri={CTA_ARROW_ICON_URL} width={20} height={20} style={styles.ctaArrow} />
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

  // success-new.json centres its artwork on a 1080×1080 canvas — the largest
  // circle is ~558px wide, so ~24% of the box is transparent on each side (~30px
  // at 124px). Pulled left by that much so the visible circle, not the empty
  // canvas, lines up with the title text on the left.
  lottieWrapper: {
    width:        124,
    height:       125,
    alignSelf:    'flex-start',
    marginLeft:   -30,
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
    fontSize:     FontSize.font16,
    fontWeight:   '700',
    color:        Colors.surface,
    marginRight:  6,
  },
  ctaArrow: {
    flexShrink: 0,
  },
})
