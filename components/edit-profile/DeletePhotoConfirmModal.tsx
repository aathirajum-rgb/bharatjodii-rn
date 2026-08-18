// Desktop "delete photo" confirm popup for Edit Profile.
//
// Figma node 729:27212 (linked for this popup) only resolves to a bare
// 1336×800 dark scrim rectangle with no discoverable modal-card sibling
// despite extensive lookup (direct node-id fetch, metadata sweeps across the
// surrounding id ranges, and checking every other Figma node this same
// EditProfileDesktopScreen.tsx already references) — genuinely unlocatable
// through the Figma MCP tools this session has available, not skipped for
// convenience. Content/copy instead ported verbatim from the real Angular
// source (components/modalpopup/modalpopup.component.html, the `action ==
// 'deletePhoto'` branch — Angular's own "revamp" delete-photo dialog, the one
// actually reachable from managephoto.page.ts's slider trash icon):
//   - title "Delete photo?" / body "Are you sure you want to delete this
//     photo?" (EDITPROFILE.DELETE_PHOTO_TXT / DELETE_PHOTO_SUB_TXT)
//   - the decorative delete-photo.svg illustration above the title
//   - a SINGLE destructive "Delete" CTA (EDITPROFILE.DELETE_PHOTO_CTA_2) —
//     Angular's "Keep it" second button is commented out in the real
//     template, never actually rendered in production, so this doesn't add
//     one either; dismissal is the X / scrim-tap only, matching Angular.
// Visual chrome (centered white card, close X, primary button styling)
// follows this session's own established confirm-modal convention (see
// LogoutConfirmModal.tsx) since there's no real Figma spec to match instead.
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, StyleSheet, Text } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_REG } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const ILLUSTRATION = CDN_REG + 'delete-photo.svg'

export interface DeletePhotoConfirmModalProps {
  visible:   boolean
  onClose:   () => void
  onConfirm: () => void
}

// Confirming closes the modal immediately and only defers the real API call
// (see EditProfileDesktopScreen.tsx's DELETE_UNDO_WINDOW_MS) — there's
// nothing left to await here, so no loading state.
export default function DeletePhotoConfirmModal({
  visible, onClose, onConfirm,
}: DeletePhotoConfirmModalProps) {
  const { t } = useTranslation()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <Pressable style={s.closeBtn} onPress={onClose} hitSlop={8}>
            <Text style={s.closeIcon}>{'✕'}</Text>
          </Pressable>

          <CdnSvg uri={ILLUSTRATION} width={120} height={120} style={s.illustration} />

          <Text style={s.title}>{t('EDITPROFILE.DELETE_PHOTO_TXT', 'Delete photo?')}</Text>
          <Text style={s.message}>{t('EDITPROFILE.DELETE_PHOTO_SUB_TXT', 'Are you sure you want to delete this photo?')}</Text>

          <Pressable style={s.deleteBtn} onPress={onConfirm}>
            <Text style={s.deleteBtnText}>{t('EDITPROFILE.DELETE_PHOTO_CTA_2', 'Delete')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 400, backgroundColor: Colors.white, borderRadius: 24,
    padding: 24, alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  closeIcon: { fontSize: 16, color: Colors.textDark },

  illustration: { marginTop: 8, marginBottom: 16 },
  title: { fontFamily: Fonts.poppinsSemiBold, fontSize: 20, color: Colors.black, textAlign: 'center' },
  message: { fontFamily: SemanticFontsEnglish.subheadingEnglishRegular, fontSize: 14, color: Colors.textDark, textAlign: 'center', marginTop: 8 },

  deleteBtn: {
    width: '100%', height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  deleteBtnText: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.white },
})
