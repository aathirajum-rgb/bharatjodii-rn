// Ported from Angular's lowerpopup.component.html — the `action ==
// 'editFieldRestrict'` block, opened by edit-profile.page.ts's restrictPopup().
//
// Shown when a member taps a one-time-editable field they've already changed
// once. Angular's showDisableToast() gates this on an explicit field list —
// ['name', 'age', 'mt', 'income', 'religion', 'caste', 'profilecreatedby'] —
// and each of those rows only calls it when its own *EditEnable flag is false
// (see editProfileService.ts's `*Editable` flags, which come straight from the
// API's NAMEEDIT / DOBEDIT / MOTHERTONGUEEDIT / INCOMEEEDIT / RELIGIONEDIT /
// CASTEEDIT / CREATEDBYEDIT).
//
// Content is entirely informational — there is no "OK"/primary CTA in Angular
// either. The only actions are the ✕ and the customer-support phone row
// (Angular: callNative('dial_pad') -> a tel: dial, same as every other
// support-number row in this app).
//
// Angular opens this modal with backdropDismiss: false, so a tap on the scrim
// must NOT close it — hence dismissOnBackdrop={false} below.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Pressable, StyleSheet, Text } from 'react-native'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { fetchCustomerCare } from '../../service/homeService'
import CdnSvg from '../cdn-svg/CdnSvg'
import BottomSheet from '../bottom-sheet/BottomSheet'

// Angular's exact asset paths from the editFieldRestrict template.
const ICON_ALERT = CDN_SVG + 'entry-alert-popup-img.svg'
const ICON_CALL  = CDN_SVG + 'call-icon.svg'

type Props = {
  visible: boolean
  onClose: () => void
}

export default function FieldRestrictedSheet({ visible, onClose }: Props) {
  const { t } = useTranslation()
  const [phone, setPhone] = useState('')

  // Angular reads localStorage's CUSTOMER-CARE directly; in this app that key
  // holds a JSON blob, so go through the same accessor every other support-
  // number row uses rather than re-parsing it here.
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    fetchCustomerCare().then(({ phone: p }) => { if (!cancelled) setPhone(p) })
    return () => { cancelled = true }
  }, [visible])

  function callSupport() {
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(e => {
        if (__DEV__) console.error('[FieldRestrictedSheet] call error:', e)
      })
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} showClose={false} dismissOnBackdrop={false}>
      {/* ✕ sits INSIDE the card's top-right corner here, not floating above
          the sheet like BottomSheet's own default close button — matches
          Angular's template, which puts it in its own right-aligned row at
          the top of the popup grid. */}
      <Pressable style={s.closeBtn} onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
        <Text style={s.closeX}>✕</Text>
      </Pressable>

      <CdnSvg uri={ICON_ALERT} width={72} height={72} style={s.alertIcon} />

      <Text style={s.title}>{t('EDITPROFILE.RESTRICT_FIELD')}</Text>
      <Text style={s.content}>{t('EDITPROFILE.RESTRICT_SUPPORT')}</Text>

      {!!phone && (
        <Pressable style={s.phoneBox} onPress={callSupport} accessibilityRole="link">
          <Text style={s.phoneText}>{phone}</Text>
          <CdnSvg uri={ICON_CALL} width={20} height={20} />
        </Pressable>
      )}
    </BottomSheet>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  closeBtn:   { alignSelf: 'flex-end', padding: 4 },
  closeX:     { fontSize: 16, color: Colors.textPrimary, fontWeight: '400' },

  alertIcon:  { alignSelf: 'center', marginTop: 8 },

  title:      { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center', marginTop: 20 },
  content:    { fontSize: 14, color: '#4c4c4c', textAlign: 'center', lineHeight: 20, marginTop: 12, paddingHorizontal: 8 },

  // Angular: an <ion-item> row inside .reportprofile-section — number on the
  // left, tappable call icon on the right, inside a light rounded box.
  phoneBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 14, marginTop: 24,
  },
  phoneText: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
})
