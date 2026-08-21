// Full-screen viewer for a tapped chat image/video bubble — Angular:
// messages.component.ts's clickedImage() (ImageViewComponent, Swiper pinch-
// zoom) and showSelfVideoPopUp() (VideoFaqPopupComponent, native controls +
// autoplay). Both are dark/black full-bleed modals with just a close button —
// no download/save affordance in either (Angular's video tag explicitly sets
// controlslist="nodownload"). Deliberately simpler than PhotoViewerModal.tsx
// (no pinch-zoom, no paging) — chat only ever views ONE image/video at a
// time, unlike that component's profile-photo gallery use case.
import { useVideoPlayer, VideoView } from 'expo-video'
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
        <Pressable style={[styles.closeBtn, { top: insets.top + 12 }]} onPress={onClose} hitSlop={12}>
          <Text style={styles.closeBtnText}>✕</Text>
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
  closeBtn: { position: 'absolute', right: 16, zIndex: 1, padding: 8 },
  closeBtnText: { fontSize: 22, color: '#fff' },
  image: { flex: 1 },
  video: { flex: 1 },
})
