// Post-"Send likes" confirmation — mobile bottom sheet, overlaying
// BulkLikeModal.tsx's own list+CTA underneath while visible.
// Figma (1H9kp43PU6cpE0rF4zgDEx): scrim node 305:5038 (80% black) + card node
// 305:5048 — white card, top corners only radius 16, 24px padding all round,
// 48x48 success Lottie (same success-new.json OTPSuccessSheet.tsx uses) with
// a 24px gap to Poppins-SemiBold 18px black text. No close button — like
// OTPSuccessSheet, this is non-dismissable; the parent's own timer unmounts
// the whole screen a moment after `visible` turns true.
import LottieView from 'lottie-react-native'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, Dimensions, Modal, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_LOTTIE } from '../../constants/cdn'
import { Fonts, FontSize } from '../../src/theme/fonts'

const SCREEN_H   = Dimensions.get('window').height
const LOTTIE_URL = CDN_LOTTIE + 'success-new.json'

export default function BulkLikeSentSheet({ visible }: { visible: boolean }) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [modalVisible, setModalVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current
  const scrimAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(SCREEN_H)
      scrimAnim.setValue(0)
      setModalVisible(true)
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 11, useNativeDriver: true }),
        Animated.timing(scrimAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      setModalVisible(false)
    }
  }, [visible])

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: Colors.black, opacity: scrimAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] }) },
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 24) }, { transform: [{ translateY: slideAnim }] }]}
      >
        <View style={s.lottieWrapper}>
          <LottieView source={{ uri: LOTTIE_URL }} autoPlay loop={false} style={s.lottie} />
        </View>
        <Text style={s.text}>{t('MATCHES.BULK_BTM_TEXT')}</Text>
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
    gap:                  24,
  },
  lottieWrapper: { width: 48, height: 48, overflow: 'hidden' },
  lottie: { width: 48, height: 48 },
  // FLAGGED — no Angular counterpart: there is no "likes sent" confirmation
  // sheet anywhere in the Angular app (fullpage-modalpopup's Bulklike branch
  // ends at the CTA; nothing renders a success sheet). Values are this port's
  // own; size tokenised only, not verified.
  text: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   FontSize.font18,
    lineHeight: 24,
    color:      Colors.black,
  },
})
