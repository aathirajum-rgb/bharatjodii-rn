// Full-screen viewer for a tapped chat image/video bubble — Angular:
// messages.component.ts's clickedImage() (ImageViewComponent, Swiper pinch-
// zoom) and showSelfVideoPopUp() (VideoFaqPopupComponent, native controls +
// autoplay). Both are dark/black full-bleed modals with just a close button —
// no download/save affordance in either (Angular's video tag explicitly sets
// controlslist="nodownload"). Deliberately simpler than PhotoViewerModal.tsx
// (no pinch-zoom, no paging) — chat only ever views ONE image/video at a
// time, unlike that component's profile-photo gallery use case.
import { useVideoPlayer, VideoView } from 'expo-video'
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../cdn-svg/CdnSvg'
import { CDN_REVAMP } from '../../constants/cdn'

const CLOSE_ICON_URI = CDN_REVAMP + 'rounded-back-btn.svg'

function ChatVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => { p.play() })
  return <VideoView player={player} style={styles.video} nativeControls />
}

export interface ChatMediaViewerModalProps {
  visible: boolean
  kind:    'image' | 'video' | null
  uri:     string | null
  onClose: () => void
}

export default function ChatMediaViewerModal({ visible, kind, uri, onClose }: ChatMediaViewerModalProps) {
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Angular: `.likeback-btn` (image-view.component.css:2-7) — top-left
            (top:5.84vmin, left:6.12vmin ≈ 24px at this project's reference
            viewport), Angular's rounded-back-btn.svg icon, not a plain "✕"
            glyph in the top-right corner. */}
        <Pressable style={[styles.closeBtn, { top: insets.top + 16 }]} onPress={onClose} hitSlop={12}>
          <CdnSvg uri={CLOSE_ICON_URI} width={32} height={32} />
        </Pressable>
        {!!uri && kind === 'image' && (
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        )}
        {!!uri && kind === 'video' && <ChatVideoPlayer uri={uri} />}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  closeBtn: { position: 'absolute', left: 20, zIndex: 1, padding: 8 },
  image: { flex: 1 },
  video: { flex: 1 },
})
