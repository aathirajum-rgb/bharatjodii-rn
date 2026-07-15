// "Contact Details" bottom sheet — Angular button.component.ts:613-664 /
// modalpopup.component.html:402-485 (action `viewProfileContactNo`), shown after
// the user confirms (ContactConfirmSheet) and the phoneviewed API call resolves.
// Shows Name/Mobile, a WhatsApp button (only if a WhatsApp number came back),
// a Call button (always), "Share this number with your family", and a
// "Contacts viewed X/Y" counter — paid entryType only (Angular gates this row
// on FUNC.getEnteryType()=='P'), matching `showCounter` from communicationService.ts.
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { CallIcon, WhatsAppIcon } from './matchesCard.shared'
import { Colors } from '../../constants/colors'

export interface ContactDetailsSheetProps {
  visible:         boolean
  name:            string
  mobile?:         string | undefined
  whatsappNumber?: string | undefined
  showCounter?:    boolean | undefined
  viewedCount?:    string | undefined
  remainingCount?: string | undefined
  onClose:         () => void
  onCall:          () => void
  onWhatsApp:      () => void
}

export default function ContactDetailsSheet({
  visible, name, mobile, whatsappNumber, showCounter, viewedCount, remainingCount,
  onClose, onCall, onWhatsApp,
}: ContactDetailsSheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { LinearGradient } = require('expo-linear-gradient')

  function handleShare() {
    if (!mobile) return
    Share.share({ message: mobile }).catch(() => {})
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable style={s.closeBtn} onPress={onClose} hitSlop={10}>
          <View style={s.closeCircle}>
            <Text style={s.closeX}>✕</Text>
          </View>
        </Pressable>

        <Text style={s.title}>{t('VIEWPROFILE.CONTACT_DETAILS')}</Text>

        <View style={s.row}>
          <Text style={s.label}>{t('VIEWPROFILE.CONTACT_NAMEUSER')}</Text>
          <Text style={s.value}>{name}</Text>
        </View>
        {!!mobile && (
          <View style={s.row}>
            <Text style={s.label}>{t('VIEWPROFILE.CONTACT_MOBILE')}</Text>
            <Text style={s.value}>{mobile}</Text>
          </View>
        )}

        {/* Angular: WhatsApp button only *ngIf="common.loadWhatsapp()" — here, only
            when a WhatsApp number actually came back in the phoneviewed response. */}
        {!!whatsappNumber && (
          <Pressable onPress={onWhatsApp}>
            <LinearGradient
              colors={['#4AC14B', '#06853A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={s.waBtn}
            >
              <WhatsAppIcon width={20} height={20} />
              <Text style={s.btnText}>{t('GENERAL.WHATSAPP')}</Text>
            </LinearGradient>
          </Pressable>
        )}

        <Pressable style={s.callBtn} onPress={onCall}>
          <CallIcon width={18} height={18} />
          <Text style={s.btnText}>{t('GENERAL.CALL', 'Call')}</Text>
        </Pressable>

        <Pressable onPress={handleShare} style={s.shareLink} hitSlop={6}>
          <Text style={s.shareLinkText}>{t('VIEWPROFILE.CONTACT_DETAIL_SHARE')}</Text>
        </Pressable>

        {showCounter && (
          <Text style={s.counter}>
            {t('VIEWPROFILE.VIEWPHONEDETAIL_1')
              .replace('#VAR#', viewedCount ?? '0')
              .replace('#VAR1#', remainingCount ?? '0')}
          </Text>
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.scrim },
  sheet: {
    position:             'absolute',
    bottom:                0,
    left:                  0,
    right:                 0,
    backgroundColor:       Colors.white,
    borderTopLeftRadius:   16,
    borderTopRightRadius:  16,
    paddingHorizontal:     24,
    paddingTop:            24,
  },
  closeBtn: {
    position:   'absolute',
    top:        -48,
    left:       0,
    right:      0,
    alignItems: 'center',
  },
  closeCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surfaceInput,
    alignItems: 'center', justifyContent: 'center',
  },
  closeX: { fontSize: 12, color: Colors.textMedium, fontWeight: '600' },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   18,
    color:      '#1f1e1b',
    textAlign:  'center',
    marginBottom: 16,
  },
  row: { flexDirection: 'row', marginBottom: 8 },
  label: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.textSecondary },
  value: { fontFamily: 'Poppins-Medium',  fontSize: 14, color: Colors.textDark },
  waBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 44, borderRadius: 8, marginTop: 16,
  },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 44, borderRadius: 8, marginTop: 12,
    backgroundColor: Colors.primaryDark,
  },
  btnText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.white },
  shareLink: { alignItems: 'center', paddingVertical: 16 },
  shareLinkText: {
    fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.link,
    textDecorationLine: 'underline',
  },
  counter: {
    fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textTertiary,
    textAlign: 'center', marginTop: 4,
  },
})
