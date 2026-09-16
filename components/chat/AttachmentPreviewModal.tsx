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
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'
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
            <CdnSvg uri={BACK_ICON_URI} width={24} height={24} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {t(isVideo ? 'MESSAGES.PREVIEW_HEADER_3' : 'MESSAGES.PREVIEW_HEADER_5')}
          </Text>
        </View>

        <View style={styles.previewArea}>
          {!!attachment && (
            <View style={[styles.previewMediaBox, isVideo && styles.previewMediaBoxVideo]}>
              {isVideo
                ? <PreviewVideoPlayer uri={attachment.uri} />
                : <Image source={{ uri: attachment.uri }} style={styles.previewImage} resizeMode="cover" />}
            </View>
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
  // Angular: modalpopup.component.html:75 — `ion-grid.color-white` for the
  // 'sendDocument' action; `.color-white` (global.scss:5869) is a misleadingly
  // -named BACKGROUND utility (`background-color: white`), not a text color —
  // this screen is white, not the black backdrop it had.
  screen: { flex: 1, backgroundColor: Colors.white },
  // Angular: `ion-row.pt-16.pl-16.pr-24` — asymmetric (24 on the right, not a
  // flat 16/12).
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, paddingLeft: 16, paddingRight: 24 },
  backBtn: { padding: 4 },
  // Angular: `.color-333333 heading4-medium-16` — Poppins-MEDIUM (not
  // semibold), #333333 (not white — there's no dark backdrop to sit on).
  headerTitle: { fontFamily: Fonts.poppinsMedium, fontSize: FontSize.font16, color: Colors.textDark },

  // Angular: the media box sits in a `pl-24 pr-24 mt-24` row.
  previewArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  // Angular: `.attachment-img-size-block { height: 100vmin; border-radius: 8px }`
  // — a fixed ~400px-tall box at this project's 400x800 reference viewport,
  // not the image/video simply filling all remaining flex space.
  previewMediaBox: { width: '100%', height: 400, borderRadius: 8, marginTop: 24, overflow: 'hidden' },
  // Angular: `.video-measurement-search { border: 1px solid #c30047;
  // background-color: #c30047 }` — a distinct red border+fill, not the same
  // plain box as the image case.
  previewMediaBoxVideo: { borderWidth: 1, borderColor: '#c30047', backgroundColor: '#c30047' },
  // Angular: `.attachment-img-size { object-fit: cover; border-radius: 8px }`
  // — cover (fills/crops), not contain (letterboxes).
  previewImage: { width: '100%', height: '100%', borderRadius: 8 },
  previewVideo: { width: '100%', height: '100%' },

  footer: { paddingHorizontal: 24, paddingTop: 16 },
  // Angular: `.primary-cta-jodii { background: #B50033 }` — this app's
  // primaryDark, not the brighter primary red. `.primary-btn-ht { height:44px
  // !important }` and 8px radius (a rounded rect), not a 48px-tall pill.
  sendBtn: {
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.6 },
  // Angular: `white-color body1-medium-14` — 14px (not 15), Poppins-Medium, white.
  sendBtnLabel: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: FontSize.font14, color: Colors.white },
})
