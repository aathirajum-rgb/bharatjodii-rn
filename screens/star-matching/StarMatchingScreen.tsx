// Star-matching "View details" full report — Angular: star-matching.component.ts/
// .html/.css. Reached from ViewProfileScreen's "View details" link (paid viewers
// only; free viewers get the existing recharge-redirect teaser instead, unchanged).
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { CDN_REACT, CDN_SVG } from '../../constants/cdn'
import { getItem } from '../../service/storageService'
import { handleBack as goBackCentral } from '../../utils/navigationRef'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import i18n from '../../i18n'
import StarMatchingDesktopLayout from './StarMatchingDesktopLayout'

const BACK_ICON_URI = CDN_REACT + '/arrowleft.svg'
const TICK_GREEN_URI = CDN_SVG + 'tick-green.svg'
const CROSS_RED_URI = CDN_SVG + 'cross-red.svg'
const ACTIVE_STAR_URI = CDN_SVG + 'active-star.svg'
const INACTIVE_STAR_URI = CDN_SVG + 'unactive-star.svg'
const MALE_AVATAR_URI = CDN_SVG + 'male_avatar_new.svg'
const FEMALE_AVATAR_URI = CDN_SVG + 'female_avatar_new.svg'
// Angular never forces a fixed aspect ratio on this box — no height is set in
// its CSS at all (.start-matching-photo-block div), so the box just takes
// whatever shape the real photo naturally is (typically portrait, taller than
// wide). A guessed *wide* ratio (1.4) was the previous bug here: it squashed
// the box short, which is also why 10 compatibility rows + the button fit on
// one screen with no scrolling — Angular needs to scroll past ~6 rows because
// its taller photo boxes push everything else down further. Used only until
// the real photo's onLoad reports its actual width/height.
const DEFAULT_PHOTO_RATIO = 0.8
// The silhouette fallback icon's own canvas is roughly this shape — not
// measured from a real photo, so this stays fixed rather than dynamic.
const AVATAR_ICON_RATIO = 0.85

// Native <Image>/expo-image can't decode a remote .svg (see CdnSvg.tsx) — the
// fallback silhouette is one, so it needs CdnSvg, which (unlike Image) needs
// concrete pixel dimensions rather than a percentage width + aspectRatio.
// `style` still carries the percentage width + aspectRatio so the box reserves
// its correct space immediately; this just measures that box via onLayout and
// draws the SVG at the resulting pixel size once known.
function AvatarSilhouette({ uri, style }: { uri: string; style?: object }) {
  const [width, setWidth] = useState<number | null>(null)
  return (
    <View style={style} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {/* `cover` matches the real photo's own contentFit="cover" in the
          sibling branch above. */}
      {width != null && <CdnSvg uri={uri} width={width} height={width * AVATAR_ICON_RATIO} cover />}
    </View>
  )
}

// Angular: star-matching.component.ts's RESPONSE.COMPATIBILITY item shape.
// Exported so StarMatchingDesktopLayout can share the same shape.
export interface CompatibilityItem {
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
  // Angular: common.getAvatarImg() — own slot falls back to a silhouette
  // matching the logged-in user's OWN gender; the partner slot falls back to
  // the OPPOSITE gender's silhouette, not a blank box.
  const [loginGender, setLoginGender] = useState<string | null>(null)
  useEffect(() => { getItem(SK.User.LOGIN_GENDER).then(setLoginGender) }, [])
  const ownAvatarFallback = loginGender === 'F' ? FEMALE_AVATAR_URI : MALE_AVATAR_URI
  const partnerAvatarFallback = loginGender === 'F' ? MALE_AVATAR_URI : FEMALE_AVATAR_URI
  // Angular: (error)="onImgErrorHandler($event, isOppositeProfile)" — falls
  // back to the silhouette on a load FAILURE too, not just a missing URL.
  const [ownPhotoFailed, setOwnPhotoFailed] = useState(false)
  const [partnerPhotoFailed, setPartnerPhotoFailed] = useState(false)
  const [ownRatio, setOwnRatio] = useState(DEFAULT_PHOTO_RATIO)
  const [partnerRatio, setPartnerRatio] = useState(DEFAULT_PHOTO_RATIO)

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
    else goBackCentral()
  }

  // Desktop/laptop web gets the Figma "Jodii Desktop" single-card layout (see
  // StarMatchingDesktopLayout.tsx); native iOS/Android and narrow mobile-web
  // keep the mobile JSX below untouched — same isDesktop early-return split
  // ViewProfileDesktopLayout.tsx already uses.
  const isDesktop = useIsDesktopWeb()
  if (isDesktop) {
    return (
      <StarMatchingDesktopLayout
        ownName={ownName}
        ownPhoto={ownPhoto}
        partnerName={partnerName}
        partnerPhoto={partnerPhoto}
        loginGender={loginGender}
        userProfile={userProfile}
        partnerProfile={partnerProfile}
        isNorth={isNorth}
        compatibility={compatibility}
        summary={summary}
        prediction={prediction}
        activeStars={activeStars}
        progressPct={progressPct}
        langCode={i18n.language}
        showDetail={showDetail}
        onBack={handleBack}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
        onViewDetailedReport={() => setShowDetail(true)}
      />
    )
  }

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={handleBack} hitSlop={8}>
          <CdnSvg uri={BACK_ICON_URI} width={22} height={22} />
        </Pressable>
        <Text style={s.headerTitle}>{t('STARMATCHING.HEADER')}</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} style={s.scroll}>
        {!showDetail ? (
          <>
            {/* Angular: first white-background ion-row (photos + ratio/stars/
                progress + "Star matching X" line) — pt-24 pb-24. */}
            <View style={s.card}>
              {/* ── Two profile cards ──────────────────────────────────────── */}
              <View style={s.profilesRow}>
                <View style={s.profileCol}>
                  {ownPhoto && !ownPhotoFailed ? (
                    <Image
                      source={{ uri: ownPhoto }}
                      style={[s.avatar, { aspectRatio: ownRatio }]}
                      contentFit="cover"
                      onLoad={e => setOwnRatio(e.source.width / e.source.height)}
                      onError={() => setOwnPhotoFailed(true)}
                    />
                  ) : (
                    <AvatarSilhouette uri={ownAvatarFallback} style={[s.avatar, { aspectRatio: AVATAR_ICON_RATIO }]} />
                  )}
                  <Text style={s.profileName} numberOfLines={1}>{ownName ?? '—'}</Text>
                  <Text style={s.profileMeta}>{t('STARMATCHING.RAASI')} {userProfile?.RAASI ?? '—'}</Text>
                  <Text style={s.profileMeta}>{t('STARMATCHING.STAR')} {userProfile?.STAR ?? '—'}</Text>
                </View>
                <View style={s.profileCol}>
                  {partnerPhoto && !partnerPhotoFailed ? (
                    <Image
                      source={{ uri: partnerPhoto }}
                      style={[s.avatar, { aspectRatio: partnerRatio }]}
                      contentFit="cover"
                      onLoad={e => setPartnerRatio(e.source.width / e.source.height)}
                      onError={() => setPartnerPhotoFailed(true)}
                    />
                  ) : (
                    <AvatarSilhouette uri={partnerAvatarFallback} style={[s.avatar, { aspectRatio: AVATAR_ICON_RATIO }]} />
                  )}
                  <Text style={s.profileName} numberOfLines={1}>{partnerProfile?.NAME ?? partnerName ?? '—'}</Text>
                  <Text style={s.profileMeta}>{t('STARMATCHING.RAASI')} {partnerProfile?.RAASI ?? '—'}</Text>
                  <Text style={s.profileMeta}>{t('STARMATCHING.STAR')} {partnerProfile?.STAR ?? '—'}</Text>
                </View>
              </View>

              {/* ── Ratio/percentage + stars or progress bar ────────────────── */}
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
                      // Native <Image> can't decode a remote .svg — needs CdnSvg.
                      <CdnSvg
                        key={i}
                        uri={i < activeStars ? ACTIVE_STAR_URI : INACTIVE_STAR_URI}
                        width={24}
                        height={24}
                        style={s.starIcon}
                      />
                    ))}
                  </View>
                  <Text style={s.starMatchingLine}>
                    {t('STARMATCHING.STAR_MATCHING')} <Text style={s.starMatchingValue}>{summary?.STAR_MATCHING}</Text>
                  </Text>
                </>
              )}
            </View>

            {/* Angular: second white-background ion-row, mt-8 — the 8px gray
                page background shows through as a gap between the two cards. */}
            <View style={[s.card, s.cardGap]}>
              {/* ── Compatibility list (summary rows only) ───────────────────── */}
              <Text style={s.sectionHeader}>{t('STARMATCHING.STAR_COMPATIBILITY')}</Text>
              {compatibility.map((item, i) => (
                <View key={i} style={s.compatRow}>
                  <Text style={s.compatKey}>{i + 1}. {item.KEY}</Text>
                  <View style={s.compatValueCol}>
                    {/* Native <Image> can't decode a remote .svg — needs CdnSvg. */}
                    <CdnSvg
                      uri={item.COLOR === 'RED' ? CROSS_RED_URI : TICK_GREEN_URI}
                      width={16}
                      height={16}
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
            </View>
          </>
        ) : (
          /* ── Detail view — Angular's moreDetailTemplate: each porutham item is
              its OWN white-background ion-row, mt-8 gap between them (same
              stacked-card look as the summary view above), not a single list
              with divider lines. ─────────────────────────────────────────────── */
          compatibility.map((item, i) => (
            <View key={i} style={[s.card, i > 0 && s.cardGap]}>
              <View style={s.detailItemHeader}>
                <Text style={s.detailKey}>{i + 1}. {item.KEY}</Text>
                {/* Native <Image> can't decode a remote .svg — needs CdnSvg. */}
                <CdnSvg
                  uri={item.COLOR === 'RED' ? CROSS_RED_URI : TICK_GREEN_URI}
                  width={16}
                  height={16}
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
  // Angular: ion-content { --background: #dddddd } — the gray page the two
  // white cards below sit on top of.
  screen: { flex: 1, backgroundColor: Colors.starMatchPageBg },
  // Angular: ion-toolbar row — "pt-16 pb-16", not 12.
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  backBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 16, color: Colors.textDark },

  scroll: { backgroundColor: Colors.starMatchPageBg },
  content: { paddingBottom: 24 },
  // Angular: each ion-row.white-background — full-bleed white band, own
  // 24px horizontal/vertical padding (--ion-cust-padding: 24px).
  card: { backgroundColor: Colors.surface, padding: 24 },
  // Angular: mt-8 between the two stacked white rows — the gray page
  // background shows through as an 8px gap, not a border or shadow.
  cardGap: { marginTop: 8 },

  // Angular: ion-col size="5" / offset="2" size="5" on a 12-col grid —
  // 5:2:5 ratio, so each photo is 5/12 (41.67%) wide with a 2/12 (16.67%)
  // gap between them (space-between across two 41.67% columns leaves
  // exactly that gap, no explicit gap value needed).
  profilesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  profileCol: { width: '41.67%' },
  // aspectRatio is applied inline per-instance (real photo's own ratio once
  // known, or the fixed silhouette-icon ratio) — see DEFAULT_PHOTO_RATIO/
  // AVATAR_ICON_RATIO above.
  avatar: { width: '100%', borderRadius: 4, backgroundColor: Colors.divider, marginBottom: 8 },
  profileName: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 14, color: Colors.textDark },
  profileMeta: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  ratioText: { fontFamily: Fonts.poppinsSemiBold, fontSize: 20, color: Colors.black, textAlign: 'center', marginTop: 24 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  starIcon: { width: 24, height: 24, marginRight: 2 },
  progressTrack: {
    width: '60%', height: 8, borderRadius: 20, backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 8, overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 20, backgroundColor: Colors.starMatchYes },
  starMatchingLine: { fontFamily: Fonts.poppinsMedium, fontSize: 12, color: '#334155', textAlign: 'center', marginTop: 12 },
  starMatchingValue: { color: Colors.starMatchYes },

  // Angular: no margin class on this ion-col — its only top spacing is the
  // card's own pt-24 padding, already applied by `card` above. An extra
  // marginTop here would double that gap.
  sectionHeader: { fontFamily: Fonts.poppinsSemiBold, fontSize: 20, color: Colors.black },
  compatRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16,
  },
  compatKey: { flex: 1, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: '#555555', paddingRight: 12 },
  compatValueCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compatIcon: { width: 16, height: 16 },
  compatYes: { fontFamily: Fonts.poppinsMedium, fontSize: 14, color: Colors.starMatchYes },
  compatNo: { fontFamily: Fonts.poppinsMedium, fontSize: 14, color: Colors.starMatchNo },

  detailBtn: {
    backgroundColor: Colors.starMatchCtaBg, borderRadius: 8, height: 36,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  detailBtnText: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 12, color: Colors.textDark },

  // Angular: .star-match-report { padding: 10px 12px 10px 12px } — asymmetric,
  // not a uniform 12.
  noteBox: { backgroundColor: Colors.starMatchNoteBg, borderRadius: 4, paddingVertical: 10, paddingHorizontal: 12, marginTop: 24 },
  noteText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.starMatchNoteText, lineHeight: 16 },
  noteLabel: { fontFamily: Fonts.poppinsMedium },

  // Angular's moreDetailTemplate lays "{{i+1}}. KEY [icon] VALUE" out as one
  // inline-flowing label (d-flex, no space-between) — not a key-stretches/
  // value-pinned-right table row, so detailKey must NOT flex:1 here (that's
  // only correct for the summary view's compatRow above).
  detailItemHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  detailKey: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 16, color: Colors.textDark },
  detailBody: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.textDark, lineHeight: 16, marginTop: 12 },
  detailResult: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textDark, lineHeight: 18, marginTop: 12 },
})
