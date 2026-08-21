// "Send Image"/"Send Video" preview step before an attachment actually sends —
// Angular: modalpopup.component.ts's action='sendDocument' (showPreview()/
// sendAudio()). Confirmed against the real template: there is NO caption/text
// input here — just the preview and a single Send button (with a loading
// spinner while uploading). Cancelling (the back arrow) discards the pick
// entirely; there's no "swap file while open" affordance in Angular either.
import { useVideoPlayer, VideoView } from 'expo-video'
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import type { PickedChatAttachment } from '../../service/chatMediaService'

const BACK_ICON_URI = CDN_SVG + 'arrow-back-activity.svg'

function PreviewVideoPlayer({ uri }: { uri: string }) {
  // Angular's preview video has `controls` but no `autoplay` — the user
  // reviews before deciding to send, playback is opt-in.
  const player = useVideoPlayer(uri)
  return <VideoView player={player} style={styles.previewVideo} nativeControls />
}

export interface AttachmentPreviewModalProps {
  visible:    boolean
  attachment: PickedChatAttachment | null
  uploading:  boolean
  onCancel:   () => void
  onSend:     () => void
}

export default function AttachmentPreviewModal({ visible, attachment, uploading, onCancel, onSend }: AttachmentPreviewModalProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const isVideo = attachment?.msgType === '3'

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={12} style={styles.backBtn} disabled={uploading}>
            <CdnSvg uri={BACK_ICON_URI} width={20} height={20} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {t(isVideo ? 'MESSAGES.PREVIEW_HEADER_3' : 'MESSAGES.PREVIEW_HEADER_5')}
          </Text>
        </View>

        <View style={styles.previewArea}>
          {!!attachment && (isVideo
            ? <PreviewVideoPlayer uri={attachment.uri} />
            : <Image source={{ uri: attachment.uri }} style={styles.previewImage} resizeMode="contain" />
          )}
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable style={[styles.sendBtn, uploading && styles.sendBtnDisabled]} onPress={onSend} disabled={uploading}>
            {uploading
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.sendBtnLabel}>{t('MESSAGES.SEND_CTA')}</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.white },

  previewArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', height: '100%' },
  previewVideo: { width: '100%', height: '100%' },

  footer: { paddingHorizontal: 24, paddingTop: 16 },
  sendBtn: {
    height: 48, borderRadius: 24, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnLabel: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 15, color: Colors.white },
})
