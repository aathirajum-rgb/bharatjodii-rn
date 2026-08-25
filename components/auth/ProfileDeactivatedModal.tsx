// Android: LoginActivity.kt/SplashScreenActivity.kt's showDeactivatePopUp() +
// res/layout/profiledeactivaete_popup.xml. Shown when a login/OTP/auto-login
// response comes back with RESPONSECODE==2, ERRCODE==1, and
// RESPONSE.PROFILEDEACTIVATESTATUS=="1" — title/body/CTA labels and the call/
// WhatsApp numbers are all server-driven (RESPONSE.MSGERR.{TITLE,BODY,CTA,WCTA}
// + RESPONSE.{CALLINGNUMBER,CONTACTWTNUMBER}), not static i18n strings, so
// there's nothing to translate here — the backend already sends localized text.
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { WhatsAppIcon } from '../matches/matchesCard.shared'
import { Colors } from '../../constants/colors'
import { CDN, CDN_SVG } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const ICON_CLOSE = CDN_SVG + 'revamp/close-icon.svg'
const ICON_CALL  = CDN + 'call-white.svg'

export interface ProfileDeactivateInfo {
  title:          string
  body:           string
  cta:            string
  wcta:           string
  callingNumber:  string
  whatsappNumber: string
}

type Props = {
  visible: boolean
  info:    ProfileDeactivateInfo | null
  onClose: () => void
}

export default function ProfileDeactivatedModal({ visible, info, onClose }: Props) {
  if (!info) return null

  function handleCall() {
    if (info!.callingNumber) Linking.openURL(`tel:${info!.callingNumber}`)
  }
  function handleWhatsApp() {
    if (info!.whatsappNumber) Linking.openURL(`https://wa.me/${info!.whatsappNumber.replace(/\D/g, '')}`)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <Pressable style={s.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
            <CdnSvg uri={ICON_CLOSE} width={20} height={20} />
          </Pressable>

          {!!info.title && <Text style={s.title}>{info.title}</Text>}
          {!!info.body && <Text style={s.body}>{info.body}</Text>}

          <View style={s.ctaRow}>
            {!!info.cta && !!info.callingNumber && (
              <Pressable style={s.callBtn} onPress={handleCall}>
                <CdnSvg uri={ICON_CALL} width={18} height={18} />
                <Text style={s.callBtnText}>{info.cta}</Text>
              </Pressable>
            )}
            {!!info.wcta && !!info.whatsappNumber && (
              <Pressable style={s.whatsappBtn} onPress={handleWhatsApp}>
                <WhatsAppIcon width={20} height={20} />
                <Text style={s.whatsappBtnText}>{info.wcta}</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  scrim: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: Colors.white, borderRadius: 24,
    padding: 24, paddingTop: 40, gap: 16,
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16, width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: Colors.black, textAlign: 'center' },
  body:  { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black, lineHeight: 20, textAlign: 'center' },

  ctaRow: { gap: 12, marginTop: 8 },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
  },
  callBtnText:     { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 14, color: Colors.white },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#25D366',
  },
  whatsappBtnText: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 14, color: '#128C7E' },
})
