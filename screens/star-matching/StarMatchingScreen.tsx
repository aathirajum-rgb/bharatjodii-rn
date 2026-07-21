// Star-matching "View details" full report — Angular: star-matching.component.ts/
// .html. Reached from ViewProfileScreen's "View details" link (paid viewers only;
// free viewers get the existing recharge-redirect teaser instead, unchanged).
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'

const BACK_ICON_URI = CDN_REACT + '/arrowleft.svg'

export default function StarMatchingScreen({ navigation, route }: { navigation: any; route: any }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const {
    partnerName, partnerPhoto, ownStar, ownRaasi, partnerStar, partnerRaasi,
    displayText = '', percentage = 0, isNorth = false,
  } = route?.params ?? {}

  // Angular: South India shows a 10-star row, active count = round(percentage/10).
  const activeStars = Math.round(Number(percentage) / 10)

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <CdnSvg uri={BACK_ICON_URI} width={22} height={22} />
        </Pressable>
        <Text style={s.headerTitle}>{t('VIEWPROFILE.HOROMATCH').replace('#PERCENT#', '').trim()}</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.profilesRow}>
          <View style={s.profileCol}>
            <View style={s.avatarPlaceholder} />
            <Text style={s.profileLabel} numberOfLines={1}>You</Text>
            <Text style={s.profileMeta} numberOfLines={1}>{ownRaasi ?? '—'}</Text>
            <Text style={s.profileMeta} numberOfLines={1}>{ownStar ?? '—'}</Text>
          </View>

          <View style={s.vsCol}><Text style={s.vsText}>VS</Text></View>

          <View style={s.profileCol}>
            {partnerPhoto ? (
              <Image source={{ uri: partnerPhoto }} style={s.avatarPlaceholder} contentFit="cover" />
            ) : (
              <View style={s.avatarPlaceholder} />
            )}
            <Text style={s.profileLabel} numberOfLines={1}>{partnerName ?? '—'}</Text>
            <Text style={s.profileMeta} numberOfLines={1}>{partnerRaasi ?? '—'}</Text>
            <Text style={s.profileMeta} numberOfLines={1}>{partnerStar ?? '—'}</Text>
          </View>
        </View>

        {/* displayText is Angular's ready-to-render poruthamPercentage/poruthamPercentageNorth
            string ("5.5/10" South, DHASA_PERCENTAGE North) — percentage is only the
            plain 0-100 number backing the star-count/progress-bar visuals below it. */}
        <Text style={s.percentText}>{displayText || `${percentage}%`}</Text>
        {isNorth ? (
          <View style={s.percentBlock}>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${Math.max(0, Math.min(100, percentage))}%` }]} />
            </View>
          </View>
        ) : (
          <View style={s.starsRow}>
            {Array.from({ length: 10 }, (_, i) => (
              <Text key={i} style={[s.starChar, i < activeStars && s.starCharActive]}>★</Text>
            ))}
          </View>
        )}

        <Pressable style={s.detailToggle} onPress={() => setExpanded(v => !v)}>
          <Text style={s.detailToggleText}>
            {expanded ? 'Show less' : t('VIEWPROFILE.PAID_MEMBER_REPORT')}
          </Text>
        </Pressable>

        {expanded && (
          <View style={s.detailBlock}>
            <Text style={s.detailRow}>{t('VIEWPROFILE.RAASIIS')}: You — {ownRaasi ?? '—'} / {partnerName ?? '—'} — {partnerRaasi ?? '—'}</Text>
            <Text style={s.detailRow}>{t('VIEWPROFILE.STARIS')}: You — {ownStar ?? '—'} / {partnerName ?? '—'} — {partnerStar ?? '—'}</Text>
            <Text style={s.detailRow}>{t('VIEWPROFILE.HOROCOMPATIBILITY').replace('#COMPARE#', displayText || `${percentage}%`)}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  backBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black },

  content: { padding: 24, alignItems: 'center' },
  profilesRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  profileCol: { alignItems: 'center', width: 120, gap: 4 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.divider },
  profileLabel: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.black, marginTop: 8 },
  profileMeta: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textSecondary },
  vsCol: { paddingHorizontal: 4 },
  vsText: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.textSecondary },

  percentBlock: { alignItems: 'center', marginTop: 32, width: '100%' },
  percentText: { fontFamily: 'Poppins-SemiBold', fontSize: 32, color: Colors.primaryDark },
  progressTrack: {
    width: '100%', height: 8, borderRadius: 4, backgroundColor: Colors.divider, marginTop: 12, overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: Colors.primaryDark },

  starsRow: { flexDirection: 'row', gap: 4, marginTop: 32 },
  starChar: { fontSize: 24, color: Colors.divider },
  starCharActive: { color: Colors.primaryDark },

  detailToggle: { marginTop: 24, paddingVertical: 8 },
  detailToggleText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.link },
  detailBlock: { marginTop: 12, gap: 8, width: '100%' },
  detailRow: { fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textDark },
})
