// "Pay now" WhatsApp paywall modal (Figma "Jodii Desktop", node 867:12515).
// Shown when a free/non-paid, ID-verified user taps WhatsApp on a match —
// communicationService.ts's showCallOrWhatsApp() already returns
// { type: 'payment_promo' } for exactly this case; this modal is the missing
// confirmation step before redirecting to recharge (today both mobile and
// desktop silently jump straight to the recharge screen instead).
import { useTranslation } from 'react-i18next'
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { WhatsAppIcon } from './matchesCard.shared'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import type { MatchProfile } from '../../types/interfaces/matches.interface'

const XML_SHARE = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M15 6.66667C16.3807 6.66667 17.5 5.54738 17.5 4.16667C17.5 2.78595 16.3807 1.66667 15 1.66667C13.6193 1.66667 12.5 2.78595 12.5 4.16667C12.5 5.54738 13.6193 6.66667 15 6.66667Z" stroke="#545454" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M5 12.5C6.38071 12.5 7.5 11.3807 7.5 10C7.5 8.61929 6.38071 7.5 5 7.5C3.61929 7.5 2.5 8.61929 2.5 10C2.5 11.3807 3.61929 12.5 5 12.5Z" stroke="#545454" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M15 18.3333C16.3807 18.3333 17.5 17.2141 17.5 15.8333C17.5 14.4526 16.3807 13.3333 15 13.3333C13.6193 13.3333 12.5 14.4526 12.5 15.8333C12.5 17.2141 13.6193 18.3333 15 18.3333Z" stroke="#545454" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7.15833 11.2583L12.85 14.575" stroke="#545454" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12.8417 5.42499L7.15833 8.74166" stroke="#545454" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

export interface WhatsAppPaywallModalProps {
  visible:   boolean
  profile:   MatchProfile | null
  oppGender: 'M' | 'F'
  onClose:   () => void
  onPayNow:  () => void
}

export default function WhatsAppPaywallModal({
  visible, profile, oppGender, onClose, onPayNow,
}: WhatsAppPaywallModalProps) {
  const { t } = useTranslation()
  if (!profile) return null

  // Localized via the same PRONOUN.M/F.* keys Angular resolves through translate.instant()
  // (common-funtions.ts getGenderPrefix_*) — a hardcoded English word here would show up
  // mid-sentence even when the app language is Hindi/Tamil/etc.
  const heShe  = t(`PRONOUN.${oppGender}.heshe`)
  const hisHer = t(`PRONOUN.${oppGender}.hisher`)
  const himHer = t(`PRONOUN.${oppGender}.himhers`)

  const bodyText = t('MATCHES.WHATSAPP_PAYWALL_TEXT')
    .replace(/##HE_SHE##/g, heShe)
    .replace(/##HIS_HER##/g, hisHer)
  const titleText = t('MATCHES.WHATSAPP_PAYWALL_TITLE').replace('#HIMHER#', himHer)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={m.overlay} onPress={onClose}>
        <Pressable style={m.card} onPress={() => {}}>
          <Pressable style={m.closeBtn} onPress={onClose} hitSlop={10}>
            <View style={m.closeCircle}>
              <Text style={m.closeX}>✕</Text>
            </View>
          </Pressable>

          <View style={m.iconRow}>
            {profile.profileImg ? (
              <Image source={{ uri: profile.profileImg }} style={m.avatar} />
            ) : (
              <View style={m.avatar} />
            )}
            <SvgXml xml={XML_SHARE} width={20} height={20} />
            <WhatsAppIcon width={40} height={40} />
          </View>

          {/* JODII-499: always show the partner's name in this popup — not
              localized (a name isn't translated), so it's rendered directly
              rather than threaded through the i18n copy above. */}
          {!!profile.name && <Text style={m.name}>{profile.name}</Text>}
          <Text style={m.body}>{bodyText}</Text>
          <Text style={m.title}>{titleText}</Text>

          <ButtonRevamp
            label={t('GENERAL.PAY_NOW')}
            variant="primary"
            size="standard"
            fullWidth
            onPress={onPayNow}
          />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const m = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  card: {
    width:            360,
    backgroundColor:  Colors.white,
    borderRadius:     16,
    padding:          24,
    gap:              24,
  },
  closeBtn: {
    position: 'absolute',
    top:      16,
    right:    16,
    zIndex:   10,
  },
  closeCircle: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeX: {
    fontSize:   12,
    color:      Colors.textMedium,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
  },
  avatar: {
    width:           60,
    height:          60,
    borderRadius:    6,
    backgroundColor: '#F0F0F0',
  },
  name: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   16,
    color:      Colors.black,
  },
  body: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      Colors.black,
    lineHeight: 19,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   18,
    color:      Colors.black,
    lineHeight: 24,
  },
})
