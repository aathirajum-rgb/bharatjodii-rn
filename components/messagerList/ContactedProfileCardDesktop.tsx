// Desktop twin of ContactedProfileCard.tsx — Figma "Jodii Desktop —
// Registration" nodes 693:54/693:1347/693:2637 (810px-wide row, 160×160
// photo). Adds the desktop-only "photo protected → WhatsApp" overlay one
// sample card shows (locale: GENERAL.REQUEST_ADD_PHOTO_WHATSAPP /
// REQUEST_HIDDEN_PHOTO_WHATSAPP) — reuses the same onWhatsApp reveal-contact
// callback every other screen's WhatsApp button already wires up, rather than
// a bespoke photo-request flow.
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import CdnSvg from '../cdn-svg/CdnSvg'
import ProfilePhoto from '../profile-photo/ProfilePhoto'
import { VERIFIED_TAG_URI } from '../matches/matchesCard.shared'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import type { MatchProfile } from '../../types/interfaces/matches.interface'
import { isDeletedProfile } from './ContactedProfileCard'

const CDN = CDN_SVG

function buildDetailLine(p: MatchProfile): string {
  const parts: string[] = []
  if (p.age)        parts.push(`${p.age} years`)
  if (p.height)      parts.push(p.height)
  if (p.caste)        parts.push(p.caste)
  if (p.education)    parts.push(p.education)
  if (p.occupation)  parts.push(p.occupation)
  if (p.income)      parts.push(p.income)
  if (p.location)    parts.push(p.location)
  return parts.join(' | ')
}

interface Props {
  profile:          MatchProfile
  onPress:          () => void
  onDeletedPress?:  (() => void) | undefined
  onWhatsApp?:      (() => void) | undefined
}

export default function ContactedProfileCardDesktop({ profile, onPress, onDeletedPress, onWhatsApp }: Props) {
  const { t } = useTranslation()

  if (isDeletedProfile(profile)) {
    return (
      <Pressable style={styles.card} onPress={onDeletedPress}>
        <View style={styles.row}>
          <ProfilePhoto
            profileImage={profile.profileImg}
            isPhotoAvailable
            showReqPhotoElement={false}
            style={styles.avatar}
          />
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
            <Text style={styles.deletedText}>{t('LIKE_LIST.DELETED_PROFILE_TXT')}</Text>
          </View>
        </View>
      </Pressable>
    )
  }

  const detailLine = buildDetailLine(profile)
  const showWhatsAppNudge = !!profile.isPhotoProtect

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.avatarWrap}>
          <ProfilePhoto
            profileImage={profile.profileImg}
            isPhotoAvailable={profile.isPhotoAvailable}
            isPhotoProtect={profile.isPhotoProtect}
            showReqPhotoElement={false}
            style={styles.avatar}
          />
          {showWhatsAppNudge && (
            <View style={styles.whatsAppOverlay}>
              <Text style={styles.whatsAppOverlayText} numberOfLines={2}>
                {t('GENERAL.REQUEST_ADD_PHOTO_WHATSAPP', 'Contact and Get her Photos on WhatsApp')}
              </Text>
              <Pressable style={styles.whatsAppBtn} onPress={onWhatsApp} hitSlop={8}>
                <Text style={styles.whatsAppBtnText}>WhatsApp</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
            {profile.isIdVerified && (
              <CdnSvg uri={VERIFIED_TAG_URI} width={18} height={18} />
            )}
          </View>
          {!!detailLine && <Text style={styles.detail} numberOfLines={2}>{detailLine}</Text>}
          <Text style={styles.link}>{t('MESSAGES.VIEW_CONTACT', 'View full profile')} ›</Text>
        </View>
      </View>

      {!!profile.likedDateText && (
        <LinearGradient
          colors={['#FFE5DA', '#FFFFFF']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.notePill}
        >
          <CdnSvg uri={CDN + 'liked-new.svg'} width={14} height={14} />
          <Text style={styles.noteText} numberOfLines={1}>{profile.likedDateText}</Text>
        </LinearGradient>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  avatarWrap: {
    width: 160,
    height: 160,
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 12,
  },
  whatsAppOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  whatsAppOverlayText: {
    fontFamily: SemanticFontsEnglish.specialCtaEnglishMedium,
    fontSize: 12,
    color: Colors.white,
    textAlign: 'center',
  },
  whatsAppBtn: {
    backgroundColor: '#25D366',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  whatsAppBtnText: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize: 12,
    color: Colors.white,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize: 18,
    color: Colors.textPrimary,
  },
  detail: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  link: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium,
    fontSize: 14,
    color: Colors.primary,
    marginTop: 4,
  },
  deletedText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  notePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  noteText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize: 13,
    color: '#571B00',
  },
})
