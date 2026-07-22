// Full-screen viewer for a horoscope report delivered as a raw SVG file (a
// separate case from the JPG/PNG photos PhotoViewerModal handles). expo-image
// (used there) can't decode remote SVGs on native — see CdnSvg.tsx's own
// comment on this exact limitation — so this reuses CdnSvg (react-native-svg's
// SvgUri on native, a plain <img> on web) instead of expo-image.
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'

const BACK_ICON_URI = CDN_REACT + '/arrowleft.svg'

export interface HoroscopeSvgViewerModalProps {
  visible: boolean
  uri:     string | null
  onClose: () => void
}

export default function HoroscopeSvgViewerModal({ visible, uri, onClose }: HoroscopeSvgViewerModalProps) {
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        {/* Same header/back-button pattern as PhotoViewerModal, for consistency. */}
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <Pressable style={s.backBtn} onPress={onClose} hitSlop={8}>
            <CdnSvg uri={BACK_ICON_URI} width={22} height={22} />
          </Pressable>
        </View>
        <View style={s.content}>
          {!!uri && (
            <CdnSvg uri={uri} width={width} height={height - insets.top - 48} />
          )}
        </View>
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
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
