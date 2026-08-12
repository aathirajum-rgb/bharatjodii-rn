// Desktop logout confirm popup (Figma "Jodii Desktop - Registration",
// UaPAN9aG6MfZf6CRpwXf1L, node 659:33175 — a centered white card over a dark
// scrim, NOT the mobile LogoutSheet's slide-up bottom sheet with side-by-side
// Yes/No buttons). Buttons are stacked here (No on top, filled; Yes below,
// outlined) — same DeleteProfileDesktopLayout.tsx convention this session
// already established for desktop-only confirm popups.
//
// Reuses MenuScreen.tsx's exported performLogout() — the exact same
// socket-disconnect/analytics/session-clear sequence the mobile LogoutSheet
// fires, per that file's own comment inviting this reuse. AuthContext's
// logoutUpdate() (wired as performLogout -> clearSession's _onLogout
// callback) flips isAuthenticated to false, which is what actually redirects
// to the auth stack — no explicit navigation call needed here.
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, StyleSheet, Text } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { ICON } from '../../screens/menu/MenuScreen'

export interface LogoutConfirmModalProps {
  visible: boolean
  onYes:   () => void
  onNo:    () => void
}

export default function LogoutConfirmModal({ visible, onYes, onNo }: LogoutConfirmModalProps) {
  const { t } = useTranslation()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNo}>
      <Pressable style={s.scrim} onPress={onNo}>
        <Pressable style={s.card} onPress={() => {}}>
          <CdnSvg uri={ICON.logoutSheet} width={48} height={48} />
          <Text style={s.title}>{t('ACCOUNT.LOGOUT')}</Text>
          <Text style={s.message}>{t('ACCOUNT.LOGOUT_SHEET_MSG')}</Text>

          <Pressable style={s.btnPrimary} onPress={onNo}>
            <Text style={s.btnPrimaryLabel}>{t('ACCOUNT.NO')}</Text>
          </Pressable>
          <Pressable style={s.btnSecondary} onPress={onYes}>
            <Text style={s.btnSecondaryLabel}>{t('ACCOUNT.YES')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  scrim: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center', justifyContent: 'center',
  },
  card: {
    width: 360, backgroundColor: Colors.white, borderRadius: 24,
    padding: 24, gap: 16, alignItems: 'flex-start',
  },
  title: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.black },
  message: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black, lineHeight: 20, marginTop: -8 },

  btnPrimary: {
    width: '100%', height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  btnPrimaryLabel: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.white },
  btnSecondary: {
    width: '100%', height: 44, borderRadius: 8, borderWidth: 1, borderColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSecondaryLabel: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.primaryDark },
})
