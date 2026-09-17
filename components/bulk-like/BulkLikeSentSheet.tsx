// Post-"Send likes" confirmation — mobile bottom sheet, overlaying
// BulkLikeModal.tsx's own list+CTA underneath while visible.
// Angular: bottom-sheet.component.html:551-571, action == 'Successbtmpopup'
// (presented by bottom-sheet.service.ts BulkLikepopup(), which auto-dismisses
// it after 2000ms) — an .anim-slot success-new.json lottie above a
// heading2-semibold-18 title, no close button.
// Layout follows Figma (1H9kp43PU6cpE0rF4zgDEx): scrim node 305:5038 (80%
// black) + card node 305:5048 — white card, top corners only radius 16, 24px
// padding all round, Poppins-SemiBold 18px black text. Non-dismissable, like
// OTPSuccessSheet: BulkLikeModal drops `visible` when its own 2000ms timer
// fires, and also whenever the modal closes by any other route.
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
    // Angular stacks the lottie <ion-col> and the title row with no gap at all;
    // the nearest in-app precedent for this asset (OTPSuccessSheet's
    // marginBottom 16) is used instead, since 24 read as a hole once the lottie
    // grew from 48 to its Angular 140.
    gap:                  16,
  },
  // Angular: .anim-slot (bottom-sheet.component.scss:949) — 140x140, left
  // aligned (its <ion-col> is `padd0 d-flex`). This port previously used 48x48,
  // far smaller than every other success-new.json slot in the app
  // (OTPSuccessSheet 124, ReportProfileModal 100).
  lottieWrapper: { width: 140, height: 140, alignSelf: 'flex-start', overflow: 'hidden' },
  lottie: { width: 140, height: 140 },
  // Angular: heading2-semibold-18 == --font18 + --english-semibold-poppins.
  text: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   FontSize.font18,
    lineHeight: 24,
    color:      Colors.black,
  },
})
