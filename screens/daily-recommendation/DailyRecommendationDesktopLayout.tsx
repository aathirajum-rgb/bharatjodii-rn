// Desktop/laptop layout for Daily Recommendations (Figma "Jodii Desktop -
// Registration", file UaPAN9aG6MfZf6CRpwXf1L, node 1082:2285). Purely
// presentational — DailyRecommendationScreen.tsx owns all data-loading/
// state/handler logic (same split Home/Matches/ViewProfile's desktop layouts
// already use) and passes it down as props; this file only arranges that
// data into the desktop card + photo-strip layout. No drag/gesture/tutorial/
// fly-off animation here — Figma's desktop design has no swipe affordance at
// all, just the three action buttons, so none of the mobile-only gesture
// machinery in the parent screen is used on this path.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import LottieView from 'lottie-react-native'
import MatchesDesktopNav from '../../components/matches-header/MatchesDesktopNav'
import {
  CloseIcon, ViewLaterIcon, LikeIcon, ProfileBadge, RIGHT_ARROW_ANIMATION_URI,
  buildBasicViewParts, getAvatarFallbackUri,
} from '../../components/matches/matchesCard.shared'
import { ScreenBackground } from './DailyRecommendationScreen'
import type { MatchProfile } from '../../types/interfaces/matches.interface'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { Colors } from '../../constants/colors'
import { CDN_SVG, CDN_LOTTIE } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { stripAndDecodeHtml } from '../../utils/htmlEntities'

const CONTENT_W  = 1088
const STRIP_SIZE = 160
const STRIP_GAP  = 26
const MAIN_PHOTO = 328

export interface DailyRecommendationDesktopLayoutProps {
  langCode:       string
  onTabPress:     (tab: FooterTab) => void
  onLanguagePress?: (() => void) | undefined
  // Angular: onImgErrorHandler() — which gender silhouette to fall back to
  // when a profile photo is missing or fails to load (see getAvatarFallbackUri).
  oppGender:      'M' | 'F'

  contentLoaded:  boolean
  profiles:       MatchProfile[]
  currentIndex:   number
  totalCount:     number
  showEndCard:    boolean
  progressPct:    number

  onClose:        () => void
  onLike:         () => void
  onDontShow:     () => void
  onViewLater:    () => void
  onViewProfile:  (profile: MatchProfile) => void
}

export default function DailyRecommendationDesktopLayout({
  langCode, onTabPress, onLanguagePress, oppGender,
  contentLoaded, profiles, currentIndex, totalCount, showEndCard, progressPct,
  onClose, onLike, onDontShow, onViewLater, onViewProfile,
}: DailyRecommendationDesktopLayoutProps) {
  const { t } = useTranslation()

  // One-shot burst overlay played on top of the Like button on tap — Angular:
  // like-matches-post-click.json, played over the button in button.component.html.
  const [showLikeBurst, setShowLikeBurst] = useState(false)
  function handleLikePress() {
    setShowLikeBurst(true)
    onLike()
  }

  // Tapping a strip tile selects it (red border) and swaps the bottom card to
  // that profile, instead of the bottom card always being locked to profiles[0].
  // Resets whenever the profiles list itself changes (e.g. a like/skip/view-later
  // commit shifts the array) so the strip and card fall back to the new front profile.
  const [selectedIdx, setSelectedIdx] = useState(0)
  useEffect(() => setSelectedIdx(0), [profiles])

  const current = profiles[selectedIdx] ?? profiles[0]

  // Tracks photo URLs that failed to actually render (broken CDN link, 404,
  // S3 AccessDenied XML, ...) — distinct from "no photo at all" (handled by
  // the `||` fallback below). Keyed by profileId so one bad strip tile or a
  // stale main-card photo doesn't force every OTHER profile to the avatar too.
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({})
  function markPhotoFailed(profileId: string) {
    setFailedPhotos(prev => (prev[profileId] ? prev : { ...prev, [profileId]: true }))
  }
  function photoUriFor(p: MatchProfile): string {
    const real = p.profileImg || p.photos[0]
    return real && !failedPhotos[p.profileId] ? real : getAvatarFallbackUri(oppGender)
  }

  // Figma (node 1082:3498/1082:3493) shows a left/right arrow pair overlaid on
  // the photo strip — the strip holds every upcoming profile for the day (up
  // to totalCount, e.g. 15), not just a fixed 6, and the arrows page it one
  // tile at a time rather than requiring a drag/wheel gesture.
  const stripRef = useRef<ScrollView>(null)
  const stripScrollX = useRef(0)
  const [canScrollLeft, setCanScrollLeft]   = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const STRIP_STEP = STRIP_SIZE + STRIP_GAP

  function handleStripScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    stripScrollX.current = contentOffset.x
    setCanScrollLeft(contentOffset.x > 4)
    setCanScrollRight(contentOffset.x < contentSize.width - layoutMeasurement.width - 4)
  }

  function scrollStrip(direction: 'left' | 'right') {
    const next = direction === 'left'
      ? Math.max(0, stripScrollX.current - STRIP_STEP)
      : stripScrollX.current + STRIP_STEP
    stripRef.current?.scrollTo({ x: next, animated: true })
  }

  // Figma's info line adds income between occupation and location — the one
  // field buildBasicViewParts (shared with every mobile/ViewProfile card)
  // doesn't include, since no other card in this app shows income inline.
  // Spliced in locally rather than changing the shared builder and affecting
  // every other card that reuses it. p.income already arrives as a complete
  // display string (e.g. "Monthly Below ₹10,000") — no extra label prefix.
  function infoLineParts(p: MatchProfile): string[] {
    const parts = buildBasicViewParts(p)
    if (p.income) parts.splice(Math.max(parts.length - 1, 0), 0, p.income)
    return parts
  }

  return (
    <View style={s.screen}>
      <MatchesDesktopNav activeTab={1} langCode={langCode} onTabPress={onTabPress} onLanguagePress={onLanguagePress} />

      <ScreenBackground>
        <View style={s.body}>
          {!contentLoaded ? (
            <View style={s.loaderWrap}>
              <LottieView source={{ uri: `${CDN_LOTTIE}loader.json` }} autoPlay loop style={s.loaderLottie} />
            </View>
          ) : (
            <View style={s.content}>
              <Pressable style={s.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={s.closeIcon}>✕</Text>
              </Pressable>

              <Text style={s.title} numberOfLines={1}>
                {stripAndDecodeHtml(t('DAILYRECOMMENDATIONS.DAILY_RECOMMENDATIONS'))} ({currentIndex}/{totalCount})
              </Text>

              {!showEndCard && profiles.length > 0 && (
                <View style={s.stripWrap}>
                  <ScrollView
                    ref={stripRef}
                    horizontal
                    style={s.stripScroll}
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleStripScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={s.stripRow}
                  >
                    {profiles.map((p, idx) => (
                      <Pressable
                        key={p.profileId}
                        style={[s.stripTile, idx === selectedIdx && s.stripTileActive]}
                        onPress={() => setSelectedIdx(idx)}
                        accessibilityRole="button"
                        accessibilityLabel={p.name}
                      >
                        <Image
                          source={{ uri: photoUriFor(p) }}
                          style={s.stripImg}
                          onError={() => markPhotoFailed(p.profileId)}
                        />
                      </Pressable>
                    ))}
                  </ScrollView>

                  {canScrollLeft && (
                    <Pressable
                      style={[s.stripArrow, s.stripArrowLeft]}
                      onPress={() => scrollStrip('left')}
                      accessibilityRole="button"
                      accessibilityLabel="Show previous photos"
                    >
                      <Text style={s.stripArrowGlyph}>‹</Text>
                    </Pressable>
                  )}
                  {canScrollRight && (
                    <Pressable
                      style={[s.stripArrow, s.stripArrowRight]}
                      onPress={() => scrollStrip('right')}
                      accessibilityRole="button"
                      accessibilityLabel="Show more photos"
                    >
                      <Text style={s.stripArrowGlyph}>›</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {showEndCard ? (
                <View style={s.endCard}>
                  <LottieView
                    source={{ uri: `${CDN_SVG}revamp/animation/success-dr-animation.json` }}
                    autoPlay loop style={s.endLottie}
                  />
                  <Text style={s.endTitle}>{t('DAILYRECOMMENDATIONS.END_CARD_TXT_1')}</Text>
                  <Text style={s.endSub}>{t('DAILYRECOMMENDATIONS.END_CARD_TXT_2')}</Text>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${progressPct}%` }]} />
                  </View>
                </View>
              ) : current && (
                <View style={s.card}>
                  <Image
                    source={{ uri: photoUriFor(current) }}
                    style={s.mainPhoto}
                    onError={() => markPhotoFailed(current.profileId)}
                  />

                  <View style={s.details}>
                    {current.isPaidMember && <ProfileBadge variant="paid" text={t('MENU.PAID_BADGE')} />}

                    <View style={s.nameBlock}>
                      <Text style={s.name} numberOfLines={1}>{current.name}</Text>
                      <Text style={s.jodiId}>Jodi ID: {current.profileId}</Text>
                    </View>

                    <View style={s.infoLine}>
                      {infoLineParts(current).map((part, idx, arr) => (
                        <View key={idx} style={s.infoItem}>
                          <Text style={s.infoText}>{part}</Text>
                          {idx < arr.length - 1 && <Text style={s.infoPipe}>|</Text>}
                        </View>
                      ))}
                    </View>

                    <Pressable style={s.viewProfileRow} onPress={() => onViewProfile(current)}>
                      <Text style={s.viewProfileText}>{t('MATCHES.VIEW_FULL_PROFILE', 'View full profile')}</Text>
                      <Image source={{ uri: RIGHT_ARROW_ANIMATION_URI }} style={s.viewProfileArrow} />
                    </Pressable>

                    <View style={s.actionsRow}>
                      <Pressable style={s.secondaryBtn} onPress={onDontShow}>
                        <CloseIcon width={20} height={20} />
                        <Text style={s.secondaryBtnText}>{t('GENERAL.DONTSHOWCTA', "Don't show")}</Text>
                      </Pressable>
                      <Pressable style={s.secondaryBtn} onPress={onViewLater}>
                        <ViewLaterIcon width={20} height={20} />
                        <Text style={s.secondaryBtnText}>{t('GENERAL.VIEWLATER', 'View later')}</Text>
                      </Pressable>
                      <Pressable style={s.primaryBtn} onPress={handleLikePress}>
                        <LikeIcon width={18} height={19} />
                        <Text style={s.primaryBtnText}>{t('GENERAL.LIKE_CTA', 'Like').replace('#HER_HIM#', '').trim()}</Text>
                        {showLikeBurst && (
                          <LottieView
                            source={{ uri: CDN_LOTTIE + 'like-matches-post-click.json' }}
                            autoPlay
                            loop={false}
                            onAnimationFinish={() => setShowLikeBurst(false)}
                            style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
                          />
                        )}
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </ScreenBackground>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  body:   { flex: 1, alignItems: 'center', paddingVertical: 40 },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderLottie: { width: 80, height: 80 },

  content: { width: CONTENT_W },

  closeBtn: {
    position: 'absolute', top: 0, right: 0, zIndex: 1,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  closeIcon: { fontSize: 14, fontWeight: '700', color: Colors.textDark },

  title: {
    fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: '#1f1e1b', marginBottom: 32,
  },

  // Explicit heights on both the wrapper AND the ScrollView itself — a
  // horizontal ScrollView given only a contentContainerStyle can end up with
  // an unreliable/zero-height box on react-native-web, which throws off the
  // absolute-positioned arrow buttons' real hit-boxes (confirmed live: an
  // arrow click landed on "View full profile" in the card below instead of
  // scrolling, even though it visually rendered in the right place).
  stripWrap:   { width: '100%', height: STRIP_SIZE, marginBottom: 40 },
  stripScroll: { height: STRIP_SIZE },
  stripRow:    { flexDirection: 'row', gap: STRIP_GAP },
  stripTile: {
    width: STRIP_SIZE, height: STRIP_SIZE, borderRadius: 8, overflow: 'hidden',
    backgroundColor: Colors.surfaceInput,
  },
  stripTileActive: {
    borderWidth: 4, borderColor: Colors.primaryDark,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  stripImg: { width: '100%', height: '100%' },

  // Figma node 1082:3493 — chevron-in-white-circle pair overlaid on the strip,
  // vertically centered, one flush to each edge.
  stripArrow: {
    position: 'absolute', top: '50%', marginTop: -20,
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  stripArrowLeft:  { left: -8 },
  stripArrowRight: { right: -8 },
  stripArrowGlyph: { fontSize: 20, fontWeight: '600', color: Colors.textDark, marginTop: -2 },

  card: {
    flexDirection: 'row', gap: 44,
    width: CONTENT_W, minHeight: 368, padding: 20,
    backgroundColor: Colors.white, borderRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  mainPhoto: {
    width: MAIN_PHOTO, height: MAIN_PHOTO, borderRadius: 16,
    backgroundColor: Colors.surfaceInput,
  },
  details: { flex: 1, justifyContent: 'center', gap: 24, paddingVertical: 30 },

  nameBlock: { gap: 8 },
  name: { fontFamily: Fonts.poppinsSemiBold, fontSize: 26, color: Colors.black },
  jodiId: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black },

  infoLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black },
  infoPipe: { fontSize: 12, color: 'rgba(0,0,0,0.4)' },

  viewProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewProfileText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.link },
  viewProfileArrow: { width: 18, height: 15 },

  actionsRow: { flexDirection: 'row', gap: 16 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    height: 44, width: 158, borderRadius: 8, borderWidth: 1, borderColor: '#545454',
  },
  secondaryBtnText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: '#545454' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    height: 44, minWidth: 228, borderRadius: 8, paddingHorizontal: 24,
    backgroundColor: Colors.primaryDark,
  },
  primaryBtnText: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.white },

  endCard: {
    width: CONTENT_W, minHeight: 368, borderRadius: 24,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48,
    overflow: 'hidden',
  },
  endLottie: { width: 140, height: 140 },
  endTitle: { marginTop: 16, fontSize: 16, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  endSub:   { marginTop: 20, fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, backgroundColor: Colors.surface },
  progressFill:  { height: '100%', borderRadius: 10, backgroundColor: Colors.primaryDark },
})
