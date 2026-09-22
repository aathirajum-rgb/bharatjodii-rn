// "Contact Details" bottom sheet — Angular button.component.ts:613-664 /
// modalpopup.component.html:402-485 (action `viewProfileContactNo`), shown after
// the user confirms (ContactConfirmSheet) and the phoneviewed API call resolves.
// Verified directly against modalpopup.component.html:402-485 — several
// details here previously came from a different, wrong Figma reference
// ("Jodii - Master File English" / a "Jodii Desktop" node) that doesn't match
// this actual popup; see inline comments below for what changed.
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { WhatsAppIcon } from './matchesCard.shared'
import CdnSvg from '../cdn-svg/CdnSvg'
import { CDN_SVG } from '../../constants/cdn'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'

// Angular: `EButtonIcons.callIconWhite` -> revamp/call-icon-white.svg
// (button-revamp.component.scss:340) — a bare WHITE-stroke handset, for use on
// the crimson button. Deliberately NOT the shared CallIcon: that one is
// revamp/call-revamp.svg, a white circle with a green border, right for the
// light-background name rows it serves and unreadable on this button.
const CDN_CALL_WHITE = CDN_SVG + 'revamp/call-icon-white.svg'

export interface ContactDetailsSheetProps {
  visible:         boolean
  name:            string
  mobile?:         string | undefined
  whatsappNumber?: string | undefined
  showCounter?:    boolean | undefined
  viewedCount?:    string | undefined
  totalCount?:     string | undefined
  // Angular: *ngIf="data.idverified == '0' && LOGINGENDER == 'F'"
  // (modalpopup.component.html:417) — shown only to female viewers looking at
  // a not-yet-ID-verified profile.
  showNotVerifiedNote?: boolean | undefined
  onClose:         () => void
  onCall:          () => void
  onWhatsApp:      () => void
}

export default function ContactDetailsSheet({
  visible, name, mobile, whatsappNumber, showCounter, viewedCount, totalCount, showNotVerifiedNote,
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
        {/* modalpopup.component.html:404-406 — the close control is a
            `.bottomsheet-cross` image floating ABOVE the sheet
            (modalpopup.component.scss:1995 — top:-60px, left:47%), the same
            revamp/bottomsheet-cross.svg the shared BottomSheet renders. It is
            NOT a ✕ glyph in the title row: that drew in the system font and
            put the control somewhere Angular never has one. */}
        <Pressable
          style={s.closeBtn}
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <CdnSvg uri={CDN_SVG + 'revamp/bottomsheet-cross.svg'} width={32} height={32} />
        </Pressable>

        {/* Angular: the title sits alone on its row (`ion-col size="10"`). */}
        <View style={s.headerRow}>
          <Text style={s.title}>{t('VIEWPROFILE.CONTACT_DETAILS')}</Text>
        </View>

        {showNotVerifiedNote && (
          <Text style={s.notVerifiedNote}>{t('VIEWPROFILE.VERIFIED_NOTE')}</Text>
        )}

        {/* modalpopup.component.html:422-435 — Name AND Mobile are both plain
            text rows here; the raw digits are NOT hidden on this popup (a
            previous pass here deliberately omitted the Mobile row entirely,
            based on a different/wrong Figma reference — confirmed wrong
            against both the real Angular markup and a live screenshot). */}
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

        {/* modalpopup.component.html:442-447 — app-button-revamp textColor:
            'greyColor' + border:'greyBorder' + background:'whiteBg'. Both map
            to the SAME --ion-color-grey-color (#545454, theme/variables.scss:179)
            — white bg + grey border + grey text, NOT a brand-red border/black
            text (a previous guess here). */}
        {!!whatsappNumber && (
          <Pressable style={s.waBtn} onPress={onWhatsApp}>
            <WhatsAppIcon width={24} height={24} />
            <Text style={s.waBtnText}>{t('GENERAL.WHATSAPP')}</Text>
          </Pressable>
        )}

        {/* modalpopup.component.html:455-458 — labeled "Call" (generalContent.
            CALL_CTA / GENERAL.CALL_CTA), not "View phone number" — that's the
            BEFORE-reveal button elsewhere; this popup IS the revealed state. */}
        <Pressable style={[s.callBtn, { marginTop: whatsappNumber ? 12 : 16 }]} onPress={onCall}>
          {/* Angular: app-button-revamp iconType callIconWhite + iconSize large —
              ion-icon.large is a 24x24 BOX, but the icon is a CSS
              `background: url(...) no-repeat` with no background-size, so the
              file draws at its own intrinsic 18x18 inside that box (24 here
              rendered the handset visibly larger/heavier than Angular). */}
          <CdnSvg uri={CDN_CALL_WHITE} width={16} height={16} />
          <Text style={s.btnText}>{t('GENERAL.CALL_CTA')}</Text>
        </Pressable>

        <Pressable onPress={handleShare} style={s.shareRow} hitSlop={6}>
          {/* modalpopup.component.html:463-465 — the share icon sits in a
              `.height-width-24` wrapper, i.e. 24x24 (the file itself is a 20x20
              share-nodes glyph with its own padding). 10x12 shrank it to an
              unreadable smudge. */}
          <CdnSvg uri={CDN_SVG + 'share-img-contact-details-popup.svg'} width={26} height={26} />
          <Text style={s.shareLinkText}>{t('VIEWPROFILE.CONTACT_DETAIL_SHARE')}</Text>
        </Pressable>

        {showCounter && (
          <>
            <CdnSvg
              uri={CDN_SVG + 'contact-details-popup-divider-line.svg'}
              width="100%" height={1}
              style={s.divider}
            />
            {/* Angular: viewContactNoPopUp() (communication.service.ts:604-609) —
                "Contacts viewed X/Y" = (TOTALPHNUMBER - PHNUMBERLEFT) / TOTALPHNUMBER.
                A previous pass here paired viewedCount with the REMAINING count
                instead of the TOTAL quota — a different, wrong pair (that's what
                produced a nonsensical "50/0" when the quota was exhausted). */}
            <Text style={s.counter}>
              {t('VIEWPROFILE.VIEWPHONEDETAIL_1')
                .replace('#VAR#', viewedCount ?? '0')
                .replace('#VAR1#', totalCount ?? '0')}
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
  // modalpopup.component.scss:1995 `.bottomsheet-cross` — the 32x32 asset
  // carries its own #545454 circle, so nothing is drawn behind it here.
  closeBtn: { position: 'absolute', top: -60, left: '47%', zIndex: 10 },
  // Figma: Poppins-SemiBold 20px, lineHeight 28, #1f1e1b, left-aligned (this
  // used 18px centered before).
  title: {
    flex:       1,
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   FontSize.font20,
    lineHeight: 28,
    color:      '#1f1e1b',
  },
  // Angular: VERIFIED_NOTE row (modalpopup.component.html:417) — body2-regular-14,
  // color-1f1e1b, mt-8 relative to the title above it.
  notVerifiedNote: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: '#1f1e1b', marginTop: 8 },
  infoBlock: { gap: 4, marginTop: 24 },
  row: { flexDirection: 'row' },
  label: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular,  fontSize: FontSize.font14, lineHeight: 25, color: '#1f1e1b' },
  // Figma: value is SemiBold (not Medium) with a slight letter-spacing.
  value: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font14, lineHeight: 25, letterSpacing: 0.14, color: '#1f1e1b' },
  // Angular: --ion-color-grey-color: #545454 (theme/variables.scss:179) — used
  // for BOTH the border and text on this button (not a brand-red border/black
  // text, a previous guess here).
  waBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, height: 44, borderRadius: 8, marginTop: 16, paddingHorizontal: 24,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: '#545454',
  },
  waBtnText: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: FontSize.font14, color: '#545454' },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, height: 44, borderRadius: 8, paddingHorizontal: 24,
    backgroundColor: Colors.primaryDark,
  },
  btnText: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: FontSize.font14, color: Colors.white },
  shareRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 24,
  },
  shareLinkText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, letterSpacing: 0.035, color: Colors.link },
  divider: { marginTop: 16, marginBottom: 16 },
  counter: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.black,
    textAlign: 'center',
  },
})
