// Compact row card for the "Contacted profiles" screen — Angular:
// app-list-view-card (list-view-card.component.html), a horizontal row
// (small square avatar + text), structurally different from MatchCard's big
// swipeable photo-card, so this is a new component rather than a MatchCard
// variant. Mobile counterpart of ContactedProfileCardDesktop.tsx.
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import CdnSvg from '../cdn-svg/CdnSvg'
import ProfilePhoto from '../profile-photo/ProfilePhoto'
import { VERIFIED_TAG_URI } from '../matches/matchesCard.shared'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import type { MatchProfile } from '../../types/interfaces/matches.interface'

const CDN = CDN_SVG

// Angular: messager-list.component.ts's isDeletedProfile() checks
// `profile.STATUS === 1`. The RN adapter chain (homeService.ts's toProfile())
// already passes raw STATUS straight through as MatchProfile.dontShowStatus
// for an unrelated reason (don't-show/view-later toggle state on OTHER
// listing endpoints) — for whoseviewednumber/whoviewednumber specifically,
// that same raw field carries Angular's deletion flag instead. Read here
// rather than adding a second STATUS-shaped field to the shared model.
export function isDeletedProfile(profile: MatchProfile): boolean {
  return String(profile.dontShowStatus) === '1'
}

// Angular: bindBasicView() — pipe-joined detail line, skipping empty fields.
// Age gets an explicit "years" suffix here (Figma: "26 years | ..."), unlike
// MatchCard's shorter "26, Bachelor's Degree" style basic-view line.
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
}

export default function ContactedProfileCard({ profile, onPress, onDeletedPress }: Props) {
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

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.row}>
        <ProfilePhoto
          profileImage={profile.profileImg}
          isPhotoAvailable={profile.isPhotoAvailable}
          isPhotoProtect={profile.isPhotoProtect}
          showReqPhotoElement={false}
          style={styles.avatar}
        />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
            {profile.isIdVerified && (
              <CdnSvg uri={VERIFIED_TAG_URI} width={16} height={16} />
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
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardPressed: { opacity: 0.9 },
  row: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 12,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  detail: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  link: {
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
    color: Colors.primary,
    marginTop: 2,
  },
  deletedText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  notePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  noteText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#571B00',
    flexShrink: 1,
  },
})
