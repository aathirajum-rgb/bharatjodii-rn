// Full-screen photo viewer — Angular splits this into two separate behaviors
// (pinch/pan HostListeners directly on the inline photo, HostListeners at
// viewprofile.page.ts:2359-2490; and a separate albumView()/goToalbum() swiper-
// config swap for a horizontally-scrollable enlarged gallery). In RN these
// collapse naturally into one surface: tap the photo, get a full-screen modal
// that both pinch-zooms the current photo AND pages between all of them —
// covers both Angular behaviors as a single, more idiomatic component.
import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View, FlatList, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../cdn-svg/CdnSvg'

// Same back-icon asset ViewProfileScreen's own header uses.
const BACK_ICON_URI = CDN_REACT + '/arrowleft.svg'

const MIN_SCALE = 1
const MAX_SCALE = 4

function ZoomablePhoto({
  uri, width, height, onZoomChange,
}: { uri: string; width: number; height: number; onZoomChange: (zoomed: boolean) => void }) {
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)

  function reset() {
    scale.value = withSpring(1)
    savedScale.value = 1
    translateX.value = withSpring(0)
    translateY.value = withSpring(0)
    savedTranslateX.value = 0
    savedTranslateY.value = 0
    onZoomChange(false)
  }

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, savedScale.value * e.scale))
    })
    .onEnd(() => {
      savedScale.value = scale.value
      if (scale.value <= 1) runOnJS(reset)()
      else runOnJS(onZoomChange)(true)
    })

  const pan = Gesture.Pan()
    .onUpdate(e => {
      if (savedScale.value <= 1) return
      translateX.value = savedTranslateX.value + e.translationX
      translateY.value = savedTranslateY.value + e.translationY
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        runOnJS(reset)()
      } else {
        scale.value = withSpring(2)
        savedScale.value = 2
        runOnJS(onZoomChange)(true)
      }
    })

  const gesture = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan))

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, style]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  )
}

export interface PhotoViewerModalProps {
  visible:      boolean
  images:       string[]
  initialIndex: number
  onClose:      () => void
}

export default function PhotoViewerModal({ visible, images, initialIndex, onClose }: PhotoViewerModalProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [index, setIndex] = useState(initialIndex)
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    if (visible) { setIndex(initialIndex); setZoomed(false) }
  }, [visible, initialIndex])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        {/* Angular: viewprofile.page.html:1-8,20-25 — a proper header bar (back
            button + "Photo (1/2)"), not a floating close-X. `ngClass="{'hidden':
            isZoomed}"` hides it while pinch-zoomed — same here via `!zoomed`. */}
        {!zoomed && (
          <View style={[s.header, { paddingTop: insets.top + 8 }]}>
            <Pressable style={s.backBtn} onPress={onClose} hitSlop={8}>
              <CdnSvg uri={BACK_ICON_URI} width={22} height={22} />
            </Pressable>
            <Text style={s.headerTitle}>
              {t('EDITPROFILE.PHOTOS')}
              {images.length > 1 ? ` (${index + 1}/${images.length})` : ''}
            </Text>
          </View>
        )}

        <FlatList
          data={images}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <ZoomablePhoto uri={item} width={width} height={height} onZoomChange={setZoomed} />
          )}
        />
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: Colors.white,
  },
  backBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: '#333333' },
})
