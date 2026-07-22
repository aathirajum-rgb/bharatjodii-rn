// Star-matching "View details" full report — Angular: star-matching.component.ts/
// .html/.css. Reached from ViewProfileScreen's "View details" link (paid viewers
// only; free viewers get the existing recharge-redirect teaser instead, unchanged).
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image as RNImage, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_REACT, CDN_SVG } from '../../constants/cdn'

const BACK_ICON_URI = CDN_REACT + '/arrowleft.svg'
const TICK_GREEN_URI = CDN_SVG + 'tick-green.svg'
const CROSS_RED_URI = CDN_SVG + 'cross-red.svg'
const ACTIVE_STAR_URI = CDN_SVG + 'active-star.svg'
const INACTIVE_STAR_URI = CDN_SVG + 'unactive-star.svg'

// Angular: star-matching.component.ts's RESPONSE.COMPATIBILITY item shape.
interface CompatibilityItem {
  KEY: string
  VALUE: string   // 'YES' | 'NO'
  COLOR: string   // 'GREEN' | 'RED'
  PREDICTION?: string
  RESULT?: string
  COMBINED?: string
}

export default function StarMatchingScreen({ navigation, route }: { navigation: any; route: any }) {
  const { t } = useTranslation()
  // Angular: template/templateChange — true once "View Detailed Report" is tapped;
  // the back button then returns to the summary view instead of leaving the screen
  // (reDirectoPage()), and only actually navigates back on a second back-press.
  const [showDetail, setShowDetail] = useState(false)

  const { data: dataJson, ownName, ownPhoto, partnerName, partnerPhoto } = route?.params ?? {}
  // See ViewProfileScreen.tsx's handleViewStarMatchDetails — JSON-stringified
  // there specifically because React Navigation's web linking otherwise
  // serializes an object param into the URL as literal "[object Object]".
  let data: Record<string, any> = {}
  try { data = JSON.parse(dataJson ?? '{}') } catch { /* keep {} */ }
  const domainType     = data?.TYPE
  const isNorth         = domainType === 'North India'
  const compatibility: CompatibilityItem[] = Array.isArray(data?.COMPATIBILITY) ? data.COMPATIBILITY : []
  const summary         = data?.SUMMARY ?? {}
  const prediction      = data?.PREDICTION ?? {}
  const userProfile     = data?.USERPROFILE ?? {}
  const partnerProfile  = data?.PARTNERPROFILE ?? {}

  // Angular: setStarMatchingDetails() — activeStars = round(PORUTHAM_PERCENTAGE / 10).
  const southPercentage = Number(String(summary?.PORUTHAM_PERCENTAGE ?? '0').replace('%', ''))
  const activeStars = Math.round((Number.isFinite(southPercentage) ? southPercentage : 0) / 10)
  const northPercentage = Number(String(prediction?.DHASA_PERCENTAGE ?? '0').replace('%', ''))
  const progressPct = Math.max(0, Math.min(100, Number.isFinite(northPercentage) ? northPercentage : 0))

  function handleBack() {
    // Angular: reDirectoPage() — cancels the detail view first, only leaves the
    // screen on a second back-press.
    if (showDetail) setShowDetail(false)
    else navigation.goBack()
  }

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={handleBack} hitSlop={8}>
          <CdnSvg uri={BACK_ICON_URI} width={22} height={22} />
        </Pressable>
        <Text style={s.headerTitle}>{t('STARMATCHING.HEADER')}</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {!showDetail ? (
          <>
            {/* ── Two profile cards ──────────────────────────────────────────── */}
            <View style={s.profilesRow}>
              <View style={s.profileCol}>
                {ownPhoto ? (
                  <Image source={{ uri: ownPhoto }} style={s.avatar} contentFit="cover" />
                ) : (
                  <View style={s.avatar} />
                )}
                <Text style={s.profileName} numberOfLines={1}>{ownName ?? '—'}</Text>
                <Text style={s.profileMeta}>{t('STARMATCHING.RAASI')} {userProfile?.RAASI ?? '—'}</Text>
                <Text style={s.profileMeta}>{t('STARMATCHING.STAR')} {userProfile?.STAR ?? '—'}</Text>
              </View>
              <View style={s.profileCol}>
                {partnerPhoto ? (
                  <Image source={{ uri: partnerPhoto }} style={s.avatar} contentFit="cover" />
                ) : (
                  <View style={s.avatar} />
                )}
                <Text style={s.profileName} numberOfLines={1}>{partnerProfile?.NAME ?? partnerName ?? '—'}</Text>
                <Text style={s.profileMeta}>{t('STARMATCHING.RAASI')} {partnerProfile?.RAASI ?? '—'}</Text>
                <Text style={s.profileMeta}>{t('STARMATCHING.STAR')} {partnerProfile?.STAR ?? '—'}</Text>
              </View>
            </View>

            {/* ── Ratio/percentage + stars or progress bar ──────────────────── */}
            {isNorth ? (
              <>
                <Text style={s.ratioText}>{prediction?.TOTAL ?? `${progressPct}%`}</Text>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${progressPct}%` }]} />
                </View>
                <Text style={s.starMatchingLine}>
                  {t('STARMATCHING.STAR_MATCHING')} <Text style={s.starMatchingValue}>{prediction?.STAR_MATCHING}</Text>
                </Text>
              </>
            ) : (
              <>
                <Text style={s.ratioText}>{summary?.PORUTHAM_RATIO}</Text>
                <View style={s.starsRow}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <RNImage
                      key={i}
                      source={{ uri: i < activeStars ? ACTIVE_STAR_URI : INACTIVE_STAR_URI }}
                      style={s.starIcon}
                    />
                  ))}
                </View>
                <Text style={s.starMatchingLine}>
                  {t('STARMATCHING.STAR_MATCHING')} <Text style={s.starMatchingValue}>{summary?.STAR_MATCHING}</Text>
                </Text>
              </>
            )}

            {/* ── Compatibility list (summary rows only) ─────────────────────── */}
            <Text style={s.sectionHeader}>{t('STARMATCHING.STAR_COMPATIBILITY')}</Text>
            {compatibility.map((item, i) => (
              <View key={i} style={s.compatRow}>
                <Text style={s.compatKey}>{i + 1}. {item.KEY}</Text>
                <View style={s.compatValueCol}>
                  <RNImage
                    source={{ uri: item.COLOR === 'RED' ? CROSS_RED_URI : TICK_GREEN_URI }}
                    style={s.compatIcon}
                  />
                  <Text style={item.COLOR === 'RED' ? s.compatNo : s.compatYes}>{item.VALUE}</Text>
                </View>
              </View>
            ))}

            {/* Angular: the "View Detailed Report" toggle only exists for South
                India — the North India branch has no equivalent button. */}
            {!isNorth && (
              <Pressable style={s.detailBtn} onPress={() => setShowDetail(true)}>
                <Text style={s.detailBtnText}>{t('STARMATCHING.REPORT_CTA')}</Text>
              </Pressable>
            )}

            <View style={s.noteBox}>
              <Text style={s.noteText}>
                <Text style={s.noteLabel}>{t('STARMATCHING.NOTE')}</Text>
                {t('STARMATCHING.NOTE_SUB')}
              </Text>
            </View>
          </>
        ) : (
          /* ── Detail view — full breakdown per porutham item, no header photos/
              ratio/note — matches Angular's moreDetailTemplate exactly. ────────── */
          compatibility.map((item, i) => (
            <View key={i} style={s.detailItem}>
              <View style={s.detailItemHeader}>
                <Text style={s.detailKey}>{i + 1}. {item.KEY}</Text>
                <RNImage
                  source={{ uri: item.COLOR === 'RED' ? CROSS_RED_URI : TICK_GREEN_URI }}
                  style={s.compatIcon}
                />
                <Text style={item.COLOR === 'RED' ? s.compatNo : s.compatYes}>{item.VALUE}</Text>
              </View>
              {!!item.PREDICTION && <Text style={s.detailBody}>{item.PREDICTION}</Text>}
              {!!item.COMBINED && <Text style={s.detailBody}>{item.COMBINED}</Text>}
              {!!item.RESULT && <Text style={s.detailResult}>{item.RESULT}</Text>}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  backBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Poppins-Medium', fontSize: 16, color: Colors.textDark },

  content: { padding: 24 },

  profilesRow: { flexDirection: 'row', gap: 16 },
  profileCol: { flex: 1 },
  avatar: { width: '100%', aspectRatio: 1.4, borderRadius: 4, backgroundColor: Colors.divider, marginBottom: 8 },
  profileName: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.textDark },
  profileMeta: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  ratioText: { fontFamily: 'Poppins-SemiBold', fontSize: 20, color: Colors.black, textAlign: 'center', marginTop: 24 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  starIcon: { width: 24, height: 24, marginRight: 2 },
  progressTrack: {
    width: '60%', height: 8, borderRadius: 20, backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 8, overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 20, backgroundColor: Colors.starMatchYes },
  starMatchingLine: { fontFamily: 'Poppins-Medium', fontSize: 12, color: '#334155', textAlign: 'center', marginTop: 12 },
  starMatchingValue: { color: Colors.starMatchYes },

  sectionHeader: { fontFamily: 'Poppins-SemiBold', fontSize: 20, color: Colors.black, marginTop: 24 },
  compatRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16,
  },
  compatKey: { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 14, color: '#555555', paddingRight: 12 },
  compatValueCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compatIcon: { width: 16, height: 16 },
  compatYes: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.starMatchYes },
  compatNo: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.starMatchNo },

  detailBtn: {
    backgroundColor: Colors.starMatchCtaBg, borderRadius: 8, height: 36,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  detailBtnText: { fontFamily: 'Poppins-Medium', fontSize: 12, color: Colors.textDark },

  noteBox: { backgroundColor: Colors.starMatchNoteBg, borderRadius: 4, padding: 12, marginTop: 24, marginBottom: 24 },
  noteText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.starMatchNoteText, lineHeight: 16 },
  noteLabel: { fontFamily: 'Poppins-Medium' },

  detailItem: { paddingTop: 24, paddingBottom: 24, borderTopWidth: 1, borderTopColor: Colors.divider },
  detailItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailKey: { fontFamily: 'Poppins-Medium', fontSize: 16, color: Colors.textDark, flex: 1 },
  detailBody: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textDark, lineHeight: 16, marginTop: 12 },
  detailResult: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.textDark, lineHeight: 18, marginTop: 12 },
})
