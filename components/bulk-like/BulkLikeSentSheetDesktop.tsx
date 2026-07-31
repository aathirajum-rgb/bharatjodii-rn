// Post-"Send likes" confirmation — desktop web modal box, overlaying
// BulkLikeDesktopModal.tsx's own grid+CTA underneath while visible. Same
// split BulkLikeSentSheet.tsx (mobile) uses.
// Figma (UaPAN9aG6MfZf6CRpwXf1L): scrim node 1047:38757 (80% black) + card
// node 1047:38759/1047:38758 — a small centered 360x216 white dialog, radius
// 24, with a manual close X (unlike mobile's non-dismissable sheet — this one
// lets the user skip the ~1.2s auto-close early).
import LottieView from 'lottie-react-native'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { CDN_LOTTIE } from '../../constants/cdn'

const LOTTIE_URL = CDN_LOTTIE + 'success-new.json'

export default function BulkLikeSentSheetDesktop({
  visible, onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()

  const [modalVisible, setModalVisible] = useState(false)
  const scaleAnim = useRef(new Animated.Value(0.92)).current
  const scrimAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.92)
      scrimAnim.setValue(0)
      setModalVisible(true)
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
        Animated.timing(scrimAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      setModalVisible(false)
    }
  }, [visible])

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: Colors.black, opacity: scrimAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] }) },
        ]}
        pointerEvents="none"
      />
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }] }]}>
            <Pressable style={s.closeBtn} onPress={onClose} hitSlop={8}>
              <Text style={s.close}>✕</Text>
            </Pressable>

            <View style={s.lottieWrapper}>
              <LottieView source={{ uri: LOTTIE_URL }} autoPlay loop={false} style={s.lottie} />
            </View>
            <Text style={s.text}>{t('MATCHES.BULK_BTM_TEXT')}</Text>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  card: {
    width:            360,
    height:           216,
    backgroundColor:  Colors.white,
    borderRadius:     24,
    paddingHorizontal: 24,
    paddingTop:        24,
    paddingBottom:     40,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width:  24,
    height: 24,
    alignItems:     'center',
    justifyContent: 'center',
  },
  close: {
    fontSize: 16,
    color:    Colors.black,
  },
  lottieWrapper: { width: 48, height: 48, overflow: 'hidden', marginBottom: 32 },
  lottie: { width: 48, height: 48 },
  text: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   18,
    lineHeight: 24,
    color:      Colors.black,
  },
})
