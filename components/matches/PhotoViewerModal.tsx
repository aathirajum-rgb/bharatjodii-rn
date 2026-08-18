// Full-screen photo viewer — Angular splits this into two separate behaviors
// (pinch/pan HostListeners directly on the inline photo, HostListeners at
// viewprofile.page.ts:2359-2490; and a separate albumView()/goToalbum() swiper-
// config swap for a horizontally-scrollable enlarged gallery). In RN these
// collapse naturally into one surface: tap the photo, get a full-screen modal
// that both pinch-zooms the current photo AND pages between all of them —
// covers both Angular behaviors as a single, more idiomatic component.
import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View, FlatList, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue, useAnimatedStyle, runOnJS,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Fonts } from '../../src/theme/fonts'

// Same back-icon asset ViewProfileScreen's own header uses.
const BACK_ICON_URI = CDN_REACT + '/arrowleft.svg'

// Angular: viewprofile.page.ts:2380-2488 (onPinchStartAndMoveHandler/onPinch/
// onPinchEndHandler) — a Hammer.js pinch, NOT the "pinch, then stay zoomed and
// pan around" gesture this component used to implement. Angular's real
// behavior: zoom tracks your fingers live (scaled from the pinch focal point,
// via CSS transformOrigin) and snaps back to scale 1 the INSTANT you release
// (pinchend unconditionally calls resetPinchElement() — no spring, just an
// immediate style removal) — it's a momentary preview, not a persistent
// zoomed-and-pan mode. There's also no double-tap-to-zoom anywhere in
// Angular's gesture code, and no upper scale clamp (only a lower one: pinching
// below scale 1 during the gesture snaps back immediately too, same as at the
// end). Ported here as closely as the RNGH/Reanimated equivalents allow.
function ZoomablePhoto({
  uri, width, height, onZoomChange, onNaturalSize, scrollRef,
}: {
  uri: string; width: number; height: number
  onZoomChange: (zoomed: boolean) => void
  onNaturalSize?: ((size: { width: number; height: number }) => void) | undefined
  // Real native Android/iOS builds route ALL touch dispatch through RNGH once
  // GestureHandlerRootView wraps the app (see App.tsx) — including the parent
  // FlatList's own scroll responder. Without explicitly declaring this pinch as
  // simultaneous with that FlatList, the FlatList claims two-finger touches
  // first and the pinch recognizer never activates at all (only reproduces on
  // a real device — a browser doesn't have this native responder to conflict
  // with, which is why this bug wasn't visible until a real build was tested).
  scrollRef: React.RefObject<any>
}) {
  const scale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  // Angular: transformOrigin set to the pinch focal point as a %-of-element
  // position (viewprofile.page.ts:2466-2481) — zoom expands from where your
  // fingers are, not always from the image's center.
  const originX = useSharedValue(50)
  const originY = useSharedValue(50)
  const startFocalX = useSharedValue(0)
  const startFocalY = useSharedValue(0)

  // Angular: resetPinchElement() — an immediate style removal, not an
  // animated spring-back, so no withSpring here either.
  function reset() {
    scale.value = 1
    translateX.value = 0
    translateY.value = 0
    onZoomChange(false)
  }

  const pinch = Gesture.Pinch()
    .simultaneousWithExternalGesture(scrollRef)
    .onStart(e => {
      startFocalX.value = e.focalX
      startFocalY.value = e.focalY
      originX.value = (e.focalX / width) * 100
      originY.value = (e.focalY / height) * 100
    })
    .onUpdate(e => {
      // Angular: `if (ev.scale < 1) { resetPinchElement(); return; }` — can't
      // pinch smaller than the original size; doing so just snaps back.
      if (e.scale < 1) {
        scale.value = 1
        translateX.value = 0
        translateY.value = 0
        return
      }
      scale.value = e.scale
      // Angular: translate.x/y = startXTranslate + startX + ev.deltaX/deltaY —
      // the pinch centroid's own movement doubles as a two-finger pan, since
      // initScale/startX/startY are always 0 here (full reset after every
      // previous gesture, so there's nothing saved to add them to).
      translateX.value = e.focalX - startFocalX.value
      translateY.value = e.focalY - startFocalY.value
      runOnJS(onZoomChange)(true)
    })
    .onEnd(() => {
      runOnJS(reset)()
    })

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    transformOrigin: `${originX.value}% ${originY.value}%`,
  }))

  return (
    <GestureDetector gesture={pinch}>
      <Animated.View style={[{ width, height }, style]}>
        {/* The card this photo sits in is now sized to the photo's OWN aspect
            ratio (see onNaturalSize below), so contentFit is close to a no-op
            in the common case — "cover" just guards against float rounding
            leaving a hairline gap, without actually cropping anything since
            the box already matches the photo's shape. */}
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onLoad={e => onNaturalSize?.({ width: e.source.width, height: e.source.height })}
        />
      </Animated.View>
    </GestureDetector>
  )
}

export interface PhotoViewerModalProps {
  visible:      boolean
  images:       string[]
  initialIndex: number
  onClose:      () => void
  // Angular's albumView() (viewprofile.page.ts:1318-1357) just toggles CSS
  // classes on the SAME page — the Don't show/View later/Like CTA row stays
  // visible below the enlarged photo (confirmed against a real screenshot),
  // it's not hidden behind a full-screen takeover. Callers pass their own CTA
  // block through so this modal can show the same thing below the photo.
  renderFooter?: (() => React.ReactNode) | undefined
}

export default function PhotoViewerModal({ visible, images, initialIndex, onClose, renderFooter }: PhotoViewerModalProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [index, setIndex] = useState(initialIndex)
  const [zoomed, setZoomed] = useState(false)
  // Per-photo natural size, captured once each image finishes loading — used
  // to size the rounded card to the photo's OWN shape (see fitCard below),
  // instead of a fixed box that leaves visible empty space around photos with
  // a different aspect ratio (confirmed against a real Angular screenshot:
  // it never shows a visible placeholder-colored gap around the photo).
  const [naturalSizes, setNaturalSizes] = useState<Record<number, { width: number; height: number }>>({})
  // Handed to each ZoomablePhoto's pinch gesture via simultaneousWithExternalGesture —
  // see the comment on that prop for why this is required on real native builds.
  const flatListRef = useRef<FlatList>(null)

  useEffect(() => {
    if (visible) { setIndex(initialIndex); setZoomed(false); setNaturalSizes({}) }
  }, [visible, initialIndex])

  // Angular: albumView()'s `slideGaOpt` (viewprofile.page.ts:1326-1336) —
  // slidesPerView 1.2, spaceBetween 20, centeredSlides — the active photo fills
  // most of the width with the next one peeking at the edge, not a full-bleed
  // single slide (that's the INLINE swiper's separate `ptofilephotoslide` config).
  const SPACE_BETWEEN = 20
  const SLIDE_WIDTH = width / 1.2
  const SLIDE_STRIDE = SLIDE_WIDTH + SPACE_BETWEEN
  const SIDE_INSET = (width - SLIDE_WIDTH) / 2
  // Computed directly from this modal's own known layout (header/footer sizes
  // are fixed by our own styles, not measured via onLayout) — a measured value
  // starts wrong on the very first frame (nothing measured yet) and only
  // self-corrects a frame later, which is exactly the "photo looks too small"
  // symptom a real device would show. header ≈ insets.top + 8 (paddingTop) +
  // 28 (back-button row) + 12 (paddingBottom); footer ≈ renderCtaBlock's own
  // Like-row layout (44 + 12 gap + 44 = 100) + its 16 marginTop + this modal's
  // footer paddingBottom (16).
  const HEADER_HEIGHT = insets.top + 48
  const FOOTER_HEIGHT = renderFooter ? 140 : 0
  const PHOTO_AREA_HEIGHT = height - HEADER_HEIGHT - FOOTER_HEIGHT
  // global.scss:26077-26092 — `.show-album-view .swiper-slide { height: 92% }`
  // — 92% of the photo area actually available, not 92% of the whole screen.
  const CARD_HEIGHT = PHOTO_AREA_HEIGHT * 0.92

  // Shrinks the rounded card to the photo's own aspect ratio, bounded by the
  // max slot size (SLIDE_WIDTH × CARD_HEIGHT) — so the card only ever covers
  // exactly the photo, never a bigger box with visible empty space around it.
  // Falls back to the full max box before the natural size is known (first
  // paint / still loading).
  function fitCardSize(natural: { width: number; height: number } | undefined) {
    if (!natural || !natural.width || !natural.height) return { width: SLIDE_WIDTH, height: CARD_HEIGHT }
    const scale = Math.min(SLIDE_WIDTH / natural.width, CARD_HEIGHT / natural.height)
    return { width: natural.width * scale, height: natural.height * scale }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Angular: albumView() (viewprofile.page.ts:1318-1357) just toggles CSS
          classes on the SAME page — the underlying white page background stays,
          it's not a black full-screen native-gallery-style overlay. Confirmed
          against a real screenshot (white background, no black backdrop at all). */}
      <View style={s.backdrop}>
        {/* A normal flow header (not a floating overlay) — matches how
            ViewProfileScreen's own header pushes the photo down rather than
            floating on top of it (same established pattern, applied here too
            so the header never covers/"crops" the top of the photo card).
            Angular: viewprofile.page.html:1-8,20-25 — back button + "Photo
            (1/2)"; `ngClass="{'hidden': isZoomed}"` hides it while zoomed. */}
        {!zoomed && (
          <View style={[s.header, { paddingTop: insets.top + 8 }]}>
            <Pressable style={s.backBtn} onPress={onClose} hitSlop={8}>
              <CdnSvg uri={BACK_ICON_URI} width={22} height={22} />
            </Pressable>
            {/* Angular shows the count even for a single photo — "Photo (1/1)",
                not just "Photo" — confirmed against a real screenshot. */}
            <Text style={s.headerTitle}>
              {t('EDITPROFILE.PHOTOS')} ({index + 1}/{images.length})
            </Text>
          </View>
        )}

        <View style={s.photoArea}>
          <FlatList
            ref={flatListRef}
            data={images}
            horizontal
            scrollEnabled={!zoomed}
            showsHorizontalScrollIndicator={false}
            snapToInterval={SLIDE_STRIDE}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: SIDE_INSET, alignItems: 'center' }}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, i) => ({ length: SLIDE_STRIDE, offset: SLIDE_STRIDE * i, index: i })}
            keyExtractor={(uri, i) => `${uri}-${i}`}
            onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / SLIDE_STRIDE))}
            renderItem={({ item, index: i }) => {
              const fitted = fitCardSize(naturalSizes[i])
              return (
                // Slot: fixed width, transparent — owns the FlatList paging math
                // only. The rounded/colored card lives entirely inside it, sized
                // to the photo, so no visibly "boxed" empty space ever shows.
                <View style={[s.slideSlot, { width: SLIDE_WIDTH, height: CARD_HEIGHT, marginRight: i === images.length - 1 ? 0 : SPACE_BETWEEN }]}>
                  <View style={[s.slideCard, fitted]}>
                    <ZoomablePhoto
                      uri={item}
                      width={fitted.width}
                      height={fitted.height}
                      onZoomChange={setZoomed}
                      onNaturalSize={size => setNaturalSizes(prev => (prev[i] ? prev : { ...prev, [i]: size }))}
                      scrollRef={flatListRef}
                    />
                  </View>
                </View>
              )
            }}
          />
        </View>

        {!!renderFooter && !zoomed && (
          <View style={s.footer}>{renderFooter()}</View>
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: Colors.white,
  },
  backBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: '#333333' },
  // Takes the remaining space between the header and the footer CTA (if any) —
  // the photo card's own height is measured off this, not a raw screen-height %.
  photoArea: { flex: 1, justifyContent: 'center' },
  // Fixed-width paging slot — transparent, no radius/background of its own.
  // Owns the FlatList snap math only; the actual rounded card centers inside it.
  slideSlot: { alignItems: 'center', justifyContent: 'center' },
  // global.scss:26077-26092 — `.show-album-view .swiper-slide`/`img { border-radius:
  // 16px }`, `overflow: hidden` clips the photo to those rounded corners. Sized
  // to the photo's own aspect ratio (fitCardSize) — never bigger than the photo
  // itself, so there's no empty space left showing this background color.
  slideCard: { borderRadius: 16, overflow: 'hidden', backgroundColor: Colors.divider },
  // Angular keeps the Like/Don't show/View later CTA visible below the photo
  // in album view (confirmed against a real screenshot) — same horizontal
  // padding as ViewProfileScreen's own CTA block so it lines up identically.
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
})
