// Desktop photo lightbox (Figma "Jodii Desktop - Registration", file
// UaPAN9aG6MfZf6CRpwXf1L, node 141:37089) — a centered card with external
// prev/next chevrons and a thumbnail strip to jump directly to any photo.
// Visually and interaction-wise distinct enough from mobile's full-bleed swipe
// viewer (PhotoViewerModal.tsx — pinch-zoom, edge-to-edge, tap-chevron-less)
// that this is a separate sibling component, same split MatchCardDesktop.tsx
// already uses instead of branching one file two ways.
import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { Colors } from '../../constants/colors'

const CARD_MAX_WIDTH  = 960
const CARD_MAX_HEIGHT = 557
const PHOTO_SIZE_MAX  = 404
const THUMB_SIZE      = 40
// Figma (141:37089, "Bottom sheet" frame): the chevron buttons sit INSIDE the
// white card, not outside it — 44px circles offset a fixed 64px out from the
// (centered) photo box's own edges, vertically centered with it. A previous
// pass placed them at `left:-64`/`right:-64` relative to the CARD instead of
// the photo, which pushed them out into the dark scrim past the card's edge.
const CHEVRON_SIZE = 44
const CHEVRON_GAP   = 64

export interface PhotoViewerModalDesktopProps {
  visible:      boolean
  images:       string[]
  initialIndex: number
  onClose:      () => void
}

export default function PhotoViewerModalDesktop({
  visible, images, initialIndex, onClose,
}: PhotoViewerModalDesktopProps) {
  const { width, height } = useWindowDimensions()
  const [index, setIndex] = useState(initialIndex)

  useEffect(() => {
    if (visible) setIndex(initialIndex)
  }, [visible, initialIndex])

  const cardWidth  = Math.min(CARD_MAX_WIDTH, width * 0.9)
  const cardHeight = Math.min(CARD_MAX_HEIGHT, height * 0.85)
  const photoSize  = Math.min(PHOTO_SIZE_MAX, cardWidth * 0.42, cardHeight * 0.7)
  // The photo box is horizontally centered in the card, so the space on either
  // side of it is (cardWidth - photoSize) / 2 — the chevron sits CHEVRON_GAP
  // inside that margin, clamped so it can't overlap the photo on a narrow card.
  const sideMargin   = (cardWidth - photoSize) / 2
  const chevronInset = Math.max(8, sideMargin - CHEVRON_GAP - CHEVRON_SIZE)

  function goPrev() { setIndex(i => Math.max(0, i - 1)) }
  function goNext() { setIndex(i => Math.min(images.length - 1, i + 1)) }

  const hasPrev = index > 0
  const hasNext = index < images.length - 1

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={[s.card, { width: cardWidth, height: cardHeight }]}>
          <Pressable style={s.closeBtn} onPress={onClose} hitSlop={8}>
            <Text style={s.closeIcon}>{'✕'}</Text>
          </Pressable>

          <View style={[s.photoBox, { width: photoSize, height: photoSize }]}>
            {!!images[index] && (
              // "cover" cropped portrait-oriented photos (taller than the
              // square box) at the top/bottom to fill it — "contain" always
              // shows the whole photo, matching Figma's full-view intent.
              <Image source={{ uri: images[index] }} style={StyleSheet.absoluteFill} contentFit="contain" />
            )}
          </View>

          {hasPrev && (
            <Pressable style={[s.chevronBtn, { left: chevronInset }]} onPress={goPrev} hitSlop={8}>
              <Text style={s.chevronText}>{'‹'}</Text>
            </Pressable>
          )}
          {hasNext && (
            <Pressable style={[s.chevronBtn, { right: chevronInset }]} onPress={goNext} hitSlop={8}>
              <Text style={s.chevronText}>{'›'}</Text>
            </Pressable>
          )}

          {images.length > 1 && (
            <View style={s.thumbStrip}>
              {images.map((uri, i) => (
                <Pressable key={i} onPress={() => setIndex(i)}>
                  <Image
                    source={{ uri }}
                    style={[s.thumb, i === index && s.thumbActive]}
                    contentFit="cover"
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  scrim: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    backgroundColor: Colors.white, borderRadius: 16,
    alignItems: 'center', paddingTop: 59, paddingBottom: 24,
  },
  closeBtn: {
    position: 'absolute', top: 24, right: 24, width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background,
  },
  closeIcon: { fontSize: 16, color: Colors.textDark },
  photoBox: { borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.divider },
  chevronBtn: {
    position: 'absolute', top: '50%', marginTop: -22,
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  chevronText:  { color: Colors.white, fontSize: 26, lineHeight: 26 },
  thumbStrip: {
    flexDirection: 'row', gap: 16, marginTop: 27,
  },
  thumb: {
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 6,
    backgroundColor: Colors.divider,
  },
  thumbActive: {
    borderWidth: 2, borderColor: Colors.primary,
  },
})
