// Desktop/laptop layout for the Star Matching summary screen (Figma "Jodii
// Desktop - Registration", file UaPAN9aG6MfZf6CRpwXf1L, node 141:38736).
// Purely presentational — StarMatchingScreen.tsx owns all data-parsing/state
// (route params, gender-avatar fallback, load-failure handling) and passes it
// down as props, same split ViewProfileDesktopLayout.tsx already uses.
//
// Confirmed against the Figma node directly (not just the screenshot):
//   - photos are a fixed SQUARE crop (unlike mobile's natural-ratio box)
//   - the "Star Matching: Excellent" line uses a colon + the line as one
//     unit — text id 141:39854 name="Star Matching: Excellent"
//   - compatibility list is a 2-column x 5-row grid (items 1-5 left, 6-10
//     right), not mobile's single column
//   - the note bar spans the full card width edge-to-edge (bleeds past the
//     card's own horizontal padding), not inset like mobile's noteBox
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image as RNImage, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { LANG_LABELS } from '../../components/matches-header/MatchesHeader'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { CDN_REACT, CDN_SVG } from '../../constants/cdn'
import type { CompatibilityItem } from './StarMatchingScreen'

const BACK_ICON_URI = CDN_REACT + '/arrowleft.svg'
const TICK_GREEN_URI = CDN_SVG + 'tick-green.svg'
const CROSS_RED_URI = CDN_SVG + 'cross-red.svg'
const ACTIVE_STAR_URI = CDN_SVG + 'active-star.svg'
const INACTIVE_STAR_URI = CDN_SVG + 'unactive-star.svg'
const MALE_AVATAR_URI = CDN_SVG + 'male_avatar_new.svg'
const FEMALE_AVATAR_URI = CDN_SVG + 'female_avatar_new.svg'

const PHOTO_SIZE = 220

export interface StarMatchingDesktopLayoutProps {
  ownName?: string | undefined
  ownPhoto?: string | undefined
  partnerName?: string | undefined
  partnerPhoto?: string | undefined
  loginGender: string | null
  userProfile: Record<string, any>
  partnerProfile: Record<string, any>
  isNorth: boolean
  compatibility: CompatibilityItem[]
  summary: Record<string, any>
  prediction: Record<string, any>
  activeStars: number
  progressPct: number
  langCode: string
  showDetail: boolean
  onBack: () => void
  onLanguagePress: () => void
  onViewDetailedReport: () => void
}

function DesktopPhoto({
  uri, fallbackUri,
}: { uri?: string | undefined; fallbackUri: string }) {
  const [failed, setFailed] = useState(false)
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={ds.photo}
        contentFit="cover"
        onError={() => setFailed(true)}
      />
    )
  }
  // expo-image can't decode remote SVGs on native (see CdnSvg.tsx) — the
  // fallback silhouette is an .svg, so it goes through plain RNImage.
  return <RNImage source={{ uri: fallbackUri }} style={ds.photo} resizeMode="cover" />
}

export default function StarMatchingDesktopLayout({
  ownName, ownPhoto, partnerName, partnerPhoto, loginGender,
  userProfile, partnerProfile, isNorth, compatibility, summary, prediction,
  activeStars, progressPct, langCode, showDetail, onBack, onLanguagePress, onViewDetailedReport,
}: StarMatchingDesktopLayoutProps) {
  const { t } = useTranslation()
  const ownAvatarFallback = loginGender === 'F' ? FEMALE_AVATAR_URI : MALE_AVATAR_URI
  const partnerAvatarFallback = loginGender === 'F' ? MALE_AVATAR_URI : FEMALE_AVATAR_URI

  // Figma: 2 columns of 5 (items 1-5 left, 6-10 right) — split down the
  // middle rather than hardcoding 5, so an odd/shorter real list still lays
  // out sensibly.
  const mid = Math.ceil(compatibility.length / 2)
  const leftItems = compatibility.slice(0, mid)
  const rightItems = compatibility.slice(mid)

  function renderCompatItem(item: CompatibilityItem, i: number) {
    return (
      <View key={i} style={ds.compatRow}>
        <Text style={ds.compatKey}>{i + 1} {item.KEY}</Text>
        <View style={ds.compatValueCol}>
          <RNImage
            source={{ uri: item.COLOR === 'RED' ? CROSS_RED_URI : TICK_GREEN_URI }}
            style={ds.compatIcon}
          />
          <Text style={item.COLOR === 'RED' ? ds.compatNo : ds.compatYes}>{item.VALUE}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={ds.screen}>
      {/* Top bar — logo + language only, same convention as ViewProfileDesktopLayout. */}
      <View style={ds.topBar}>
        <Text style={ds.logo}>BharatJodii</Text>
        <Pressable style={ds.langBtn} onPress={onLanguagePress}>
          <Text style={ds.langText}>{LANG_LABELS[langCode] ?? 'English'}</Text>
          <Text style={ds.langChevron}>{'▾'}</Text>
        </Pressable>
      </View>

      <ScrollView style={ds.scroll} contentContainerStyle={ds.content}>
        <Pressable style={ds.backRow} onPress={onBack} hitSlop={8}>
          <CdnSvg uri={BACK_ICON_URI} width={20} height={20} />
          <Text style={ds.backText}>{t('STARMATCHING.HEADER')}</Text>
        </Pressable>

        {showDetail ? (
          // No Figma frame provided yet for the desktop "detailed report" — this
          // reuses the same card/typography scale as the summary above (one card
          // per porutham item) rather than leaving the button as a dead click.
          // Replace with the real desktop design once that frame is shared.
          compatibility.map((item, i) => (
            <View key={i} style={[ds.card, ds.detailCard]}>
              <View style={ds.detailItemHeader}>
                <Text style={ds.detailKey}>{i + 1}. {item.KEY}</Text>
                <RNImage
                  source={{ uri: item.COLOR === 'RED' ? CROSS_RED_URI : TICK_GREEN_URI }}
                  style={ds.compatIcon}
                />
                <Text style={item.COLOR === 'RED' ? ds.compatNo : ds.compatYes}>{item.VALUE}</Text>
              </View>
              {!!item.PREDICTION && <Text style={ds.detailBody}>{item.PREDICTION}</Text>}
              {!!item.COMBINED && <Text style={ds.detailBody}>{item.COMBINED}</Text>}
              {!!item.RESULT && <Text style={ds.detailResult}>{item.RESULT}</Text>}
            </View>
          ))
        ) : (
        <View style={ds.card}>
          <View style={ds.cardPadded}>
            {/* ── Photos + center ratio/stars ─────────────────────────────── */}
            <View style={ds.topRow}>
              <DesktopPhoto uri={ownPhoto} fallbackUri={ownAvatarFallback} />

              <View style={ds.centerCol}>
                {isNorth ? (
                  <>
                    <Text style={ds.ratioText}>{prediction?.TOTAL ?? `${progressPct}%`}</Text>
                    <View style={ds.progressTrack}>
                      <View style={[ds.progressFill, { width: `${progressPct}%` }]} />
                    </View>
                    <Text style={ds.starMatchingLine}>
                      {t('STARMATCHING.STAR_MATCHING')}: <Text style={ds.starMatchingValue}>{prediction?.STAR_MATCHING}</Text>
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={ds.ratioText}>{summary?.PORUTHAM_RATIO}</Text>
                    <View style={ds.starsRow}>
                      {Array.from({ length: 10 }, (_, i) => (
                        <RNImage
                          key={i}
                          source={{ uri: i < activeStars ? ACTIVE_STAR_URI : INACTIVE_STAR_URI }}
                          style={ds.starIcon}
                        />
                      ))}
                    </View>
                    <Text style={ds.starMatchingLine}>
                      {t('STARMATCHING.STAR_MATCHING')}: <Text style={ds.starMatchingValue}>{summary?.STAR_MATCHING}</Text>
                    </Text>
                  </>
                )}
              </View>

              <DesktopPhoto uri={partnerPhoto} fallbackUri={partnerAvatarFallback} />
            </View>

            {/* ── Names + Raasi/Star, left-aligned under each respective photo ── */}
            <View style={ds.namesRow}>
              <View style={ds.nameCol}>
                <Text style={ds.profileName} numberOfLines={1}>{ownName ?? '—'}</Text>
                <Text style={ds.profileMeta}>{t('STARMATCHING.RAASI')} {userProfile?.RAASI ?? '—'}</Text>
                <Text style={ds.profileMeta}>{t('STARMATCHING.STAR')} {userProfile?.STAR ?? '—'}</Text>
              </View>
              <View style={[ds.nameCol, ds.nameColRight]}>
                <Text style={ds.profileName} numberOfLines={1}>{partnerProfile?.NAME ?? partnerName ?? '—'}</Text>
                <Text style={ds.profileMeta}>{t('STARMATCHING.RAASI')} {partnerProfile?.RAASI ?? '—'}</Text>
                <Text style={ds.profileMeta}>{t('STARMATCHING.STAR')} {partnerProfile?.STAR ?? '—'}</Text>
              </View>
            </View>

            <View style={ds.divider} />

            <Text style={ds.sectionHeader}>{t('STARMATCHING.STAR_COMPATIBILITY')}</Text>
            <View style={ds.compatGrid}>
              <View style={ds.compatColumn}>{leftItems.map((item, i) => renderCompatItem(item, i))}</View>
              <View style={ds.compatColumn}>{rightItems.map((item, i) => renderCompatItem(item, i + mid))}</View>
            </View>

            {/* Angular: the detailed-report toggle only exists for South India. */}
            {!isNorth && (
              <Pressable style={ds.detailBtn} onPress={onViewDetailedReport}>
                <Text style={ds.detailBtnText}>{t('STARMATCHING.REPORT_CTA')}</Text>
              </Pressable>
            )}
          </View>

          {/* Edge-to-edge note bar — bleeds past cardPadded's own horizontal
              padding to the card's full width; `card`'s own overflow:hidden +
              borderRadius clips this to matching rounded bottom corners. */}
          <View style={ds.noteBar}>
            <Text style={ds.noteText}>
              <Text style={ds.noteLabel}>{t('STARMATCHING.NOTE')}</Text>
              {t('STARMATCHING.NOTE_SUB')}
            </Text>
          </View>
        </View>
        )}
      </ScrollView>
    </View>
  )
}

const ds = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 32, paddingVertical: 14,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  logo: { fontFamily: Fonts.poppinsSemiBold, fontSize: 22, color: Colors.primary },
  langBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 8,
  },
  langText: { fontFamily: Fonts.poppinsRegular, fontSize: 13, color: Colors.textDark },
  langChevron: { fontSize: 10, color: Colors.textSecondary },

  scroll: { flex: 1 },
  content: { maxWidth: 1200, width: '100%', alignSelf: 'center', paddingHorizontal: 32, paddingVertical: 24 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  backText: { fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: Colors.black },

  card: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.borderSubtle, overflow: 'hidden',
  },
  cardPadded: { padding: 40 },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  // Figma: photos are a fixed square crop (unlike mobile's natural-ratio box).
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 12, backgroundColor: Colors.divider },
  centerCol: { flex: 1, alignItems: 'center', paddingTop: PHOTO_SIZE / 2 - 40 },

  ratioText: { fontFamily: SemanticFontsEnglish.headingEnglishBold, fontSize: 32, color: Colors.black },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  starIcon: { width: 28, height: 28, marginRight: 3 },
  progressTrack: {
    width: 220, height: 10, borderRadius: 20, backgroundColor: Colors.border,
    marginTop: 12, overflow: 'hidden',
  },
  progressFill: { height: 10, borderRadius: 20, backgroundColor: Colors.starMatchYes },
  starMatchingLine: { fontFamily: Fonts.poppinsMedium, fontSize: 16, color: '#334155', marginTop: 16 },
  starMatchingValue: { color: Colors.starMatchYes },

  namesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  nameCol: { width: PHOTO_SIZE },
  nameColRight: { alignItems: 'flex-start' },
  profileName: { fontFamily: Fonts.poppinsSemiBold, fontSize: 20, color: Colors.black },
  profileMeta: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textSecondary, marginTop: 4 },

  divider: { height: 1, backgroundColor: Colors.divider, marginTop: 24 },

  sectionHeader: { fontFamily: Fonts.poppinsSemiBold, fontSize: 22, color: Colors.black, marginTop: 24 },
  compatGrid: { flexDirection: 'row', marginTop: 16, gap: 48 },
  compatColumn: { flex: 1 },
  compatRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16,
  },
  compatKey: { flex: 1, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 15, color: '#555555', paddingRight: 12 },
  compatValueCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compatIcon: { width: 16, height: 16 },
  compatYes: { fontFamily: Fonts.poppinsMedium, fontSize: 15, color: Colors.starMatchYes },
  compatNo: { fontFamily: Fonts.poppinsMedium, fontSize: 15, color: Colors.starMatchNo },

  detailBtn: {
    backgroundColor: Colors.primary, borderRadius: 10, height: 48, paddingHorizontal: 32,
    alignItems: 'center', justifyContent: 'center', marginTop: 32, alignSelf: 'center',
  },
  detailBtnText: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.white },

  noteBar: { backgroundColor: Colors.starMatchNoteBg, paddingVertical: 16, paddingHorizontal: 40 },
  noteText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, color: Colors.starMatchNoteText, lineHeight: 18 },
  noteLabel: { fontFamily: Fonts.poppinsSemiBold },

  // Detail-view fallback (no Figma frame yet) — one card per item, spaced
  // like the summary card's own vertical rhythm.
  detailCard: { padding: 32, marginTop: 16 },
  detailItemHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  detailKey: { fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: Colors.textDark },
  detailBody: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textDark, lineHeight: 20, marginTop: 12 },
  detailResult: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 16, color: Colors.textDark, lineHeight: 22, marginTop: 12 },
})
