// "Contact Details" bottom sheet — Angular button.component.ts:613-664 /
// modalpopup.component.html:402-485 (action `viewProfileContactNo`), shown after
// the user confirms (ContactConfirmSheet) and the phoneviewed API call resolves.
// Shows Name/Mobile, a WhatsApp button (only if a WhatsApp number came back),
// a Call button (always), "Share this number with your family", and a
// "Contacts viewed X/Y" counter — paid entryType only (Angular gates this row
// on FUNC.getEnteryType()=='P'), matching `showCounter` from communicationService.ts.
//
// Exact colors/spacing confirmed against Figma "Jodii - Master File English"
// node 3765:4837/3765:4904 — a couple of earlier guesses here (green WhatsApp
// button, floating-above close X, underlined share link) turned out wrong;
// see inline comments below for what changed.
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { CallIcon, WhatsAppIcon } from './matchesCard.shared'
import CdnSvg from '../cdn-svg/CdnSvg'
import { CDN_SVG } from '../../constants/cdn'
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

  function handleShare() {
    if (!mobile) return
    Share.share({ message: mobile }).catch(() => {})
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]}>
        {/* Figma: close X sits INSIDE the card's top-right corner, same row as
            the title — not floating above the sheet (an earlier guess based on
            an Angular SCSS class name that turned out not to match). */}
        <View style={s.headerRow}>
          <Text style={s.title}>{t('VIEWPROFILE.CONTACT_DETAILS')}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={s.closeX}>✕</Text>
          </Pressable>
        </View>

        <View style={s.infoBlock}>
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
        </View>

        {/* Figma: this WhatsApp button is white bg + #B50033 (brand red) border +
            BLACK text — not green, and not a grey/muted outline either (both
            were earlier guesses). Shown only when a WhatsApp number actually
            came back in the phoneviewed response (Angular: *ngIf="loadWhatsapp()"). */}
        {!!whatsappNumber && (
          <Pressable style={s.waBtn} onPress={onWhatsApp}>
            <WhatsAppIcon width={24} height={24} />
            <Text style={s.waBtnText}>{t('GENERAL.WHATSAPP')}</Text>
          </Pressable>
        )}

        <Pressable style={[s.callBtn, { marginTop: whatsappNumber ? 12 : 16 }]} onPress={onCall}>
          <CallIcon width={24} height={24} />
          <Text style={s.btnText}>{t('GENERAL.CALL', 'Call')}</Text>
        </Pressable>

        {/* Figma: small icon + indigo (#29339B) text, NOT underlined — an
            earlier version guessed at an underlined link with no icon. */}
        <Pressable onPress={handleShare} style={s.shareRow} hitSlop={6}>
          <CdnSvg uri={CDN_SVG + 'share-img-contact-details-popup.svg'} width={10} height={12} />
          <Text style={s.shareLinkText}>{t('VIEWPROFILE.CONTACT_DETAIL_SHARE')}</Text>
        </Pressable>

        {showCounter && (
          <>
            <CdnSvg
              uri={CDN_SVG + 'contact-details-popup-divider-line.svg'}
              width="100%" height={1}
              style={s.divider}
            />
            <Text style={s.counter}>
              {t('VIEWPROFILE.VIEWPHONEDETAIL_1')
                .replace('#VAR#', viewedCount ?? '0')
                .replace('#VAR1#', remainingCount ?? '0')}
            </Text>
          </>
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
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   16,
  },
  closeX: { fontSize: 16, color: '#1f1e1b' },
  // Figma: Poppins-SemiBold 20px, lineHeight 28, #1f1e1b, left-aligned (this
  // used 18px centered before).
  title: {
    flex:       1,
    fontFamily: 'Poppins-SemiBold',
    fontSize:   20,
    lineHeight: 28,
    color:      '#1f1e1b',
  },
  infoBlock: { gap: 4 },
  row: { flexDirection: 'row' },
  label: { fontFamily: 'Poppins-Regular',  fontSize: 14, lineHeight: 25, color: '#1f1e1b' },
  // Figma: value is SemiBold (not Medium) with a slight letter-spacing.
  value: { fontFamily: 'Poppins-SemiBold', fontSize: 14, lineHeight: 25, letterSpacing: 0.14, color: '#1f1e1b' },
  waBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, height: 44, borderRadius: 8, marginTop: 16, paddingHorizontal: 24,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: '#B50033',
  },
  waBtnText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.black },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, height: 44, borderRadius: 8, paddingHorizontal: 24,
    backgroundColor: Colors.primaryDark,
  },
  btnText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.white },
  shareRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 24,
  },
  shareLinkText: { fontFamily: 'Poppins-Regular', fontSize: 14, letterSpacing: 0.035, color: Colors.link },
  divider: { marginTop: 16, marginBottom: 16 },
  counter: {
    fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.black,
    textAlign: 'center',
  },
})
