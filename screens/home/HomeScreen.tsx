import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Constants from 'expo-constants'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useVideoPlayer, VideoView } from 'expo-video'
import CdnSvg, { CdnImage, CdnSvgBackground } from '../../components/cdn-svg/CdnSvg'
import CdnLottie from '../../components/CdnLottie'
import AppHeader, { type ToolbarItem } from '../../components/app-header/AppHeader'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import SwiperCard, { type SwiperItem } from '../../components/swiper-card/SwiperCard'
import CoverflowSwiper from '../../components/swiper-card/CoverflowSwiper'
import Loader from '../../components/loader/Loader'
import StickyBanner from '../../components/sticky-banner/StickyBanner'
import PhotoPromoSticky from '../../components/sticky-banner/PhotoPromoSticky'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import ContactDetailsSheet from '../../components/matches/ContactDetailsSheet'
import WhatsAppPaywallModal from '../../components/matches/WhatsAppPaywallModal'
import { useContactGating } from '../../hooks/useContactGating'
import { usePhoneInfoSheet } from '../../hooks/usePhoneInfoSheet'
import { openMembershipTab, paymentTrack, getHeroBannerDetails, getMenuPromo, redirectToIntermediatePage } from '../../service/paymentService'
import { communicationBtnOnClick, fetchContactDetails, shouldSkipPhoneConfirm } from '../../service/communicationService'
import { redirectToViewProfile } from '../../service/buttonService'
import { getItem, setItem, removeItem, getJson } from '../../service/storageService'
import { getRegistrationArrays } from '../../service/registrationService'
import { logScreen } from '../../service/analyticsService'
import { socketConnection, emitNotificationDetails, onNotificationList } from '../../service/socketService'
import { StorageKeys } from '../../constants/storage.keys'
import { APP_VERSION } from '../../constants/appVersion'
import { EnvConfig } from '../../constants/env'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import HomeDesktopLayout from './HomeDesktopLayout'
import HeroBanner, { type HeroBannerContent } from './HeroBanner'
import AssistBanner, { type AssistBannerContent } from './AssistBanner'
import ForceUpdateCard from './ForceUpdateCard'
import {
  filterCompleteProfileCards,
  computeSelfHelpVideosVisible,
  computeDefaultLikedTab,
  computeHasPaidBadge,
  computeShowHeroBanner,
  computeHeroBannerVariant,
  computeShowAssistBanner,
  computeForceUpdateInfo,
  isPaidVerifiedNoPhotoMale,
  isNonIdVerifiedPaidMale,
  type LikedTab,
  type HeroBannerVariant,
  type ForceUpdateInfo,
} from './homeGating'
import {
  fetchExploreCategories, fetchHomeSession, fetchAndStorePPSetData, fetchHomeAllMatches,
  fetchViewedYou, fetchDailyRec, fetchNewlyJoined, fetchViewedByMe,
  fetchLikedByMe, fetchLikedYou, fetchSuccessStories, fetchFaqVideos,
  fetchCustomerCare, fetchNotifCount, refreshSession,
  mapCompleteProfileCards, fetchProfileValidationBanner, type ProfileValidationBanner,
  type ExploreCategory, type HelpVideo, type CompleteProfileCard, type ComCountEntry,
} from '../../service/homeService'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN = 'https://imgs.jodii.app/assets/images/svg/'
const FWD_ICON = `${CDN}revamp/forward-icon-link.svg`
const { width: SW } = Dimensions.get('window')

// Angular: explore.component.html / discover-matches.component.html both wrap
// the category grid in <ion-row class="... pl-4 pr-24">, with each
// <ion-col size="5.4" offset="0.6"> in Ionic's 12-column grid — every tile
// (including the first) is preceded by a 0.6-unit gap, and nothing follows
// the last tile beyond the row's own 24px right padding. RN has no per-column
// "offset" primitive, so this reproduces the same asymmetric result with
// plain padding + a shared gap: an enlarged left padding (4px + one gap unit)
// and a flat 24px right padding. A previous pass approximated this
// symmetrically (24px both sides, 16px gap) "since the difference is
// imperceptible" — it wasn't; the real left margin/gap only come out to
// ~22px/~18px on a typical phone width, and the asymmetry itself was visible.
const EXPLORE_ROW_PL    = 4
const EXPLORE_ROW_PR    = 24
const EXPLORE_GRID_UNIT = (SW - EXPLORE_ROW_PL - EXPLORE_ROW_PR) / 12
export const EXPLORE_TILE_WIDTH = EXPLORE_GRID_UNIT * 5.4
const EXPLORE_GRID_GAP  = EXPLORE_GRID_UNIT * 0.6
// Angular: .success-story-image img { width: 35vw; height: 35vw }
const HAND_SIZE = SW * 0.35

// ─── Toolbar ──────────────────────────────────────────────────────────────────
// Angular: core/config/home.config.ts's homeToolBar — discover-matches (search
// icon) then notification, in that order. 'menu'/'messager-list' entries exist
// in that same config but are commented out (dead) there too — there is no
// chat icon on Home's header at all in the real app.

function buildToolbar(comCount: ComCountEntry[]): ToolbarItem[] {
  const notifyTotal = comCount.reduce((sum, c) => sum + Number(c.newcount ?? 0), 0)
  return [
    { toolType: 'discover-matches', toolImg: CDN + 'bottom-nav/search-deactive.svg' },
    { toolType: 'notification', toolImg: CDN + 'revamp/home-notification.svg', showNotification: notifyTotal > 0, notifyCount: String(notifyTotal) },
  ]
}

function comCountFor(comCount: ComCountEntry[], type: string): number {
  return Number(comCount.find(c => c.comtype === type)?.newcount ?? 0)
}

// Angular: explore.component.ts's setCountListValue() — the "Who viewed you"/
// "Profiles you viewed"/"Liked you"/"Liked by me" section HEADER counts all
// come from this SAME communication/newcount response's per-comtype
// `totalCount` field, not from each section's own listing API response (which
// is independently capped by that listing's own LIMIT param — e.g. viewedbyme's
// LIMIT=10 — and was showing that smaller, unrelated number instead).
function comTotalFor(comCount: ComCountEntry[], type: string): number {
  return Number(comCount.find(c => c.comtype === type)?.totalCount ?? 0)
}

// Angular: cardMoreItemsData = cardMoreItems.splice(cap, 3) — the 3 items just
// beyond the visible slice, previewed as thumbnails on the "view more" card.
function moreItemsFrom(list: SwiperItem[], cap: number): { THUMBIMG: string }[] {
  return list.slice(cap, cap + 3).map(i => ({ THUMBIMG: i.profileImg ?? '' }))
}

// ─── Mock Data (shown briefly on first paint / kept if a fetch comes back empty) ──

const MOCK_ALL_MATCHES: SwiperItem[] = [
  { profileId: 'am1', name: 'Meenakshi',  age: '26 Yrs', education: "Bachelor's Degree", isNewlyJoined: false, likedStatus: '0' },
  { profileId: 'am2', name: 'Dhaarani',   age: '26 Yrs', education: "Bachelor's Degree", isNewlyJoined: false, likedStatus: '0' },
  { profileId: 'am3', name: 'Keerthana',  age: '26 Yrs', education: "Bachelor's Degree", isNewlyJoined: false, likedStatus: '0' },
  { profileId: 'am4', name: 'Kavitha',    age: '27 Yrs', education: "Bachelor's Degree", isNewlyJoined: false, likedStatus: '0' },
]

const MOCK_VIEWED_ME: SwiperItem[] = [
  { profileId: 'vm1', name: 'Kamatchi',        age: '26 Yrs', education: "Bachelor's Degree", isNewLabel: true, labelContent: 'NEW', likedViewedDateText: 'Viewed you on 11-May-2025', likedStatus: '0' },
  { profileId: 'vm2', name: 'Saraswathi',      age: '22 Yrs', education: "Bachelor's Degree", likedViewedDateText: 'Viewed you on 4-May-2025',  likedStatus: '0' },
  { profileId: 'vm3', name: 'Deepa',           age: '30 Yrs', education: "Master's Degree",   likedViewedDateText: 'Viewed you on 4-May-2025',  likedStatus: '0' },
]

const MOCK_TODAY_MATCHES: SwiperItem[] = [
  { profileId: 'tm1', name: 'Priyadharshini',  age: '26 Yrs', education: "Bachelor's Degree", isNewlyJoined: true,  likedStatus: '0' },
  { profileId: 'tm2', name: 'Divyadharshini',  age: '22 Yrs', education: "Bachelor's Degree", isNewlyJoined: false, likedStatus: '0' },
  { profileId: 'tm3', name: 'Karthika',        age: '24 Yrs', education: "Master's Degree",   isNewlyJoined: false, likedStatus: '0' },
]

const MOCK_NEWLY_JOINED: SwiperItem[] = [
  { profileId: 'nj1', name: 'Dhaarani',        age: '26 Yrs', education: "Bachelor's Degree", isNewlyJoined: true,  likedStatus: '0' },
  { profileId: 'nj2', name: 'Aabidah',         age: '26 Yrs', education: "Bachelor's Degree", isNewlyJoined: true,  likedStatus: '0' },
  { profileId: 'nj3', name: 'Aradhya',         age: '26 Yrs', education: "Bachelor's Degree", isNewlyJoined: true,  likedStatus: '0' },
]

const MOCK_PROFILES_VIEWED: SwiperItem[] = [
  { profileId: 'pv1', name: 'Meenakshi',       age: '26 Yrs', education: "Bachelor's Degree", likedViewedDateText: 'You viewed on 11-May-2025', likedStatus: '0' },
  { profileId: 'pv2', name: 'Divya',           age: '26 Yrs', education: "Bachelor's Degree", likedViewedDateText: 'You viewed on 8-May-2025',  likedStatus: '0' },
  { profileId: 'pv3', name: 'Rajalakshmi',     age: '26 Yrs', education: "Bachelor's Degree", likedViewedDateText: 'You viewed on 3-May-2025',  likedStatus: '0' },
]

const MOCK_LIKED_BY_ME: SwiperItem[] = [
  { profileId: 'lm1', name: 'Ramya Muralitharan',      age: '26 Yrs', education: "Bachelor's Degree", likedViewedDateText: 'You liked her on 14 Jan 2026', likedStatus: '1' },
  { profileId: 'lm2', name: 'Priyanka Sathiyamoorthy', age: '25 Yrs', education: "Bachelor's Degree", likedViewedDateText: 'You liked her on 02 Jan 2026', likedStatus: '1' },
]

const MOCK_LIKED_ME: SwiperItem[] = [
  { profileId: 'lme1', name: 'Kavitha',        age: '27 Yrs', education: "Bachelor's Degree", likedViewedDateText: 'Liked you on 05 Jan 2026', likedStatus: '0' },
  { profileId: 'lme2', name: 'Deepika',        age: '24 Yrs', education: "Master's Degree",   likedViewedDateText: 'Liked you on 03 Jan 2026', likedStatus: '0' },
]

const MOCK_STORIES: SwiperItem[] = [
  { profileId: 's1', name: 'Shankar & Aradhya', location: 'Chennai',    date: 'Posted on 20th Nov 2025' },
  { profileId: 's2', name: 'Vinoth & Priyanka', location: 'Coimbatore', date: 'Posted on 20th Nov 2025' },
  { profileId: 's3', name: 'Srikanth & Ramya',  location: 'Chennai',    date: 'Posted on 28th Oct 2025' },
]

const MOCK_CATEGORIES: ExploreCategory[] = [
  { id: 'c1', label: 'Diploma and below',    count: 33,  imageUrl: '', bgColor: '#DCF0FF' },
  { id: 'c2', label: 'Graduate and above',   count: 55,  imageUrl: '', bgColor: '#E6DCFF' },
  { id: 'c3', label: 'Same community',       count: 99,  imageUrl: '', bgColor: '#FFF6DC' },
  { id: 'c4', label: 'Own business',         count: 40,  imageUrl: '', bgColor: '#DCFFE6' },
]

export type { HelpVideo }
const MOCK_VIDEOS: HelpVideo[] = [
  { id: 'v1', title: 'How to search matches as per your preferences', thumbUrl: '', videoUrl: '' },
  { id: 'v2', title: 'Tips to get more profile views',                 thumbUrl: '', videoUrl: '' },
]

// ─── Complete Your Profile ────────────────────────────────────────────────────
// Generic renderer over homeGating's filterCompleteProfileCards() output — one
// row per PPSET-derived card type, replacing the old hardcoded horoscope+star-
// only widget. Extracted so HomeDesktopLayout.tsx can render the exact same list.

export interface CompleteProfileSectionProps {
  cards:       CompleteProfileCard[]
  onCardPress: (card: CompleteProfileCard) => void
}

// Angular: complete-profile.component.html's cardType==='completeprofile'
// branch — a plain *ngFor (each card its own bordered/gradient
// .complete-profile-block, mt-16 between them), NOT the <swiper> element
// that same component's [swiper-config] input might suggest — that config
// is only consumed by the *ngIf="selfVideo" branch (the FAQ-video carousel),
// a different cardType entirely.
export function CompleteProfileSection({ cards, onCardPress }: CompleteProfileSectionProps) {
  if (cards.length === 0) return null
  return (
    <View style={s.cpList}>
      {cards.map(card => (
        <Pressable key={card.type} onPress={() => onCardPress(card)}>
          <LinearGradient
            colors={['#E8EFFF', '#FFFFFF']}
            start={{ x: 0, y: 0.15 }}
            end={{ x: 1, y: 0 }}
            style={s.cpCard}
          >
            {/* Angular: card?.THUMBIMG — a per-card image URL from the server;
                format isn't guaranteed, so CdnImage picks SvgUri vs Image by
                extension instead of assuming either way. */}
            {!!card.imageUrl && <CdnImage uri={card.imageUrl} width={48} height={48} />}
            <View style={s.cpInfo}>
              <Text style={s.cpTitle}>{card.label}</Text>
              <View style={s.cpCtaRow}>
                <Text style={s.cpCtaText}>{card.ctaLabel}</Text>
                <CdnSvg uri={FWD_ICON} width={16} height={16} />
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      ))}
    </View>
  )
}

// ─── Liked Profiles (tab toggle + card list) ──────────────────────────────────

export interface LikedProfilesSectionProps {
  likedTab:     LikedTab
  onTabChange:  (tab: LikedTab) => void
  likedByMe:    SwiperItem[]
  likedMe:      SwiperItem[]
  likedByCount: number
  likedMeCount: number
  onCardPress:  (item: SwiperItem) => void
  onLikePress:  (item: SwiperItem) => void
}

export function LikedProfilesSection({
  likedTab, onTabChange, likedByMe, likedMe, likedByCount, likedMeCount, onCardPress, onLikePress,
}: LikedProfilesSectionProps) {
  const { t } = useTranslation()

  // Angular: app-swiper.component.ts's hasLikedYouData()/hasLikedByMeData()
  // OR the count with actual returned items — but NOT replicated here: this
  // port's likedMe/likedByMe arrays default to (and can keep showing) mock
  // placeholder data whenever the real fetch legitimately returns zero items
  // (see HomeScreen's loadHome() — setLikedMe/setLikedByMe are only called
  // when the result is non-empty), so ORing in `.length > 0` picked up that
  // leftover mock data and kept a "(0)" tab visible. likedMeCount/likedByCount
  // (comTotalFor, no mock fallback) are the only trustworthy signal here.
  // "LikedYou" in Angular (people who liked the viewer) = this port's
  // likedMe/likedMeCount; "LikedByMe" (people the viewer liked) = likedByMe/likedByCount.
  const hasLikedMe   = likedMeCount > 0
  const hasLikedByMe = likedByCount > 0
  // Angular: showLikedProfileTabs — the segmented tab switcher only renders
  // when BOTH sides have data. Previously this always showed both pills even
  // when one was a dead "(0)" tab with nothing to switch to.
  const showTabs = hasLikedMe && hasLikedByMe
  const items = showTabs
    ? (likedTab === 'likedbyme' ? likedByMe : likedMe)
    : hasLikedMe ? likedMe : likedByMe

  return (
    <>
      {/* Angular: app-swiper.component.ts's setHeader() — swiperHeader is
          sectionTitle.likedprofile = 'GENERAL.ICON_3' ("Liked profiles"),
          suffixed with (likedYouCount + likedByMeCount) when > 0. */}
      <Text style={s.sectionTitle}>{`${t('GENERAL.ICON_3')} (${likedByCount + likedMeCount})`}</Text>
      {showTabs ? (
        <View style={s.tabRow}>
          <Pressable style={[s.tabPill, likedTab === 'likedyou'  && s.tabPillActive]} onPress={() => onTabChange('likedyou')}>
            <Text style={[s.tabPillText, likedTab === 'likedyou'  && s.tabPillTextActive]}>{`${t('LIKE_LIST.LIKEDYOU_HOME')} (${likedMeCount})`}</Text>
          </Pressable>
          <Pressable style={[s.tabPill, likedTab === 'likedbyme' && s.tabPillActive]} onPress={() => onTabChange('likedbyme')}>
            <Text style={[s.tabPillText, likedTab === 'likedbyme' && s.tabPillTextActive]}>{`${t('LIKE_LIST.LIKESENT_HOME')} (${likedByCount})`}</Text>
          </Pressable>
        </View>
      ) : (
        // Angular: showOnlyLikedYouText/showOnlyLikedByMeText — no tab
        // switcher at all when only one side has data, just this sub-heading.
        // Key names look swapped at a glance but aren't: LIKESENT_SUB's real
        // copy is "Profiles who liked you" (the likedMe/"liked you" case);
        // LIKEDYOU_SUB's is "Profiles that you have liked" (the likedByMe case).
        <Text style={s.onlyOneLikedText}>
          {t(hasLikedMe ? 'LIKE_LIST.LIKESENT_SUB' : 'LIKE_LIST.LIKEDYOU_SUB')}
        </Text>
      )}
      <SwiperCard
        cardVariant={8}
        cardSection="likedprofile"
        items={items}
        showSeeAll={false}
        onCardPress={onCardPress}
        onLikePress={onLikePress}
      />
    </>
  )
}

// ─── Explore Categories ────────────────────────────────────────────────────────
// Angular: explore-card.component.html's ACTIVE template (the big-image-tile
// version with a separate count line and a "Discover all categories" CTA below
// the grid is entirely commented out in the real source) is a compact row —
// small icon + title (count baked into the server's TITLE string already,
// not a separate element) + inline forward chevron, on a light gradient card.
// No "see all"/"discover all" button exists in the live template at all.

// Angular: explore-card.component.ts's backgroundStyle() passes exploreData.BGCOLOUR
// straight through as a CSS `background` value (solid color or gradient string) —
// RN's LinearGradient needs a plain color array instead of CSS syntax, so pull the
// hex stops out of whatever the server sent. Falls back to the same default
// two-stop gradient Angular itself falls back to when BGCOLOUR is missing.
const DEFAULT_CAT_GRADIENT: [string, string] = ['#DCF0FF', '#FFFFFF']
function parseGradientColors(bgColor: string | undefined): [string, string, ...string[]] {
  const hexColors = bgColor?.match(/#[0-9a-fA-F]{3,8}/g)
  if (!hexColors || hexColors.length === 0) return DEFAULT_CAT_GRADIENT
  return hexColors.length === 1 ? [hexColors[0]!, hexColors[0]!] : [hexColors[0]!, hexColors[1]!, ...hexColors.slice(2)]
}

export interface ExploreCategoriesSectionProps {
  categories: ExploreCategory[]
  onCategoryPress: (cat: ExploreCategory) => void
}

export function ExploreCategoriesSection({
  categories, onCategoryPress,
}: ExploreCategoriesSectionProps) {
  const { t } = useTranslation()
  console.log("categories ",categories)
  return (
    <>
      {/* Angular: home.enum.ts's sectionTitle.exploreMatches = 'HOME.EXPLORE_MATCHES_TXT'
          ("Discover matches") — HOME.EXPLORE_MATCHES ("Explore matches based on")
          is a different, unused key. */}
      <Text style={s.sectionTitle}>{t('HOME.EXPLORE_MATCHES_TXT')}</Text>
      <View style={[s.catGrid, { paddingLeft: EXPLORE_ROW_PL + EXPLORE_GRID_GAP, paddingRight: EXPLORE_ROW_PR, gap: EXPLORE_GRID_GAP }]}>
        {categories.map(cat => (
          <Pressable key={cat.id} onPress={() => onCategoryPress(cat)} style={{ width: EXPLORE_TILE_WIDTH }}>
            {/* Angular: backgroundStyle() — server's BGCOLOUR per category,
                else this exact default diagonal gradient at 113deg. Converted
                via the standard CSS-angle-to-corner-points formula (same one
                HelpSection's 335deg gradient above uses):
                start=(0.5-sin(θ)·0.5, 0.5+cos(θ)·0.5), end=(0.5+sin(θ)·0.5, 0.5-cos(θ)·0.5). */}
            <LinearGradient
              colors={parseGradientColors(cat.bgColor)}
              start={{ x: 0.04, y: 0.30 }}
              end={{ x: 0.96, y: 0.70 }}
              style={s.catTile}
            >
              <View style={s.catIconWrap}>
                {!!cat.imageUrl && <CdnImage uri={cat.imageUrl} width={28} height={28} />}
              </View>
              <Text style={s.catLabel} numberOfLines={2}>
                {cat.label}{'  '}
                <Text style={s.catChevron}>{'›'}</Text>
              </Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
    </>
  )
}

// ─── Success Stories ───────────────────────────────────────────────────────────

export function SuccessStoriesSection({
  stories, onCardPress,
}: { stories: SwiperItem[]; onCardPress: (item: SwiperItem) => void }) {
  const { t } = useTranslation()
  const [headLine1, headLine2] = t('HOME.HAPPILY_MARRIED_HEAD').split('<br>').map(p => p.trim())
  const subtitle = t('HOME.HAPPILY_MARRIED_CONTENT').replace(/<br\s*\/?>/gi, '\n')
  return (
    <>
      {/* Angular: an 80x80 success-heart-animation.json Lottie sits above the
          header text (pl-24, pulled up 18px to overlap it), with
          success-story-hand.svg absolutely positioned top-right of the whole
          row (35vw square) — both were missing entirely before this fix. */}
      <View style={s.storyHeaderRow}>
        <View>
          <CdnLottie uri={`${CDN}revamp/animation/success-heart-animation.json`} width={80} height={80} />
          <View style={s.storyHeader}>
            <Text style={s.storyTitle}>{headLine1}</Text>
            <Text style={s.storyTitle}>{headLine2}</Text>
            <Text style={s.storySubtitle}>{subtitle}</Text>
          </View>
        </View>
        <CdnSvg uri={`${CDN}success-story-hand.svg`} width={HAND_SIZE} height={HAND_SIZE} style={s.storyHandImage} />
      </View>
      {/* No cardWidth override — Angular: card-ht4 is 91.111vmin square, not
          the previous guessed 68% width. Let SwiperCard's per-section default
          (ProfileCard's PHOTO_HEIGHT['successstory']) apply. */}
      <SwiperCard
        cardVariant={4}
        cardSection="successstory"
        items={stories}
        showSeeAll={false}
        onCardPress={onCardPress}
      />
    </>
  )
}

// ─── Self-help Videos ───────────────────────────────────────────────────────────
// Angular: complete-profile.component.html's self-video swiper slide — the
// caption (QUS) is overlaid in white text at the bottom of the background
// image itself (FAQ-banners-position, a bottom scrim), not a separate text
// row below the card; and the play button is the real CDN icon, not a
// CSS-drawn triangle.

export function SelfHelpVideosSection({
  videos, cardWidth, cardHeight, onVideoPress,
}: { videos: HelpVideo[]; cardWidth: number; cardHeight: number; onVideoPress: (item: HelpVideo) => void }) {
  const { t } = useTranslation()
  return (
    <>
      <Text style={s.sectionTitle}>{t('HOME.SELF_VIDEO_HEADER')}</Text>
      <FlatList
        data={videos}
        keyExtractor={i => i.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.hList}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        renderItem={({ item, index }) => (
          <Pressable style={[s.videoCard, { width: cardWidth, height: cardHeight }]} onPress={() => onVideoPress(item)}>
            {item.thumbUrl
              ? <Image source={{ uri: item.thumbUrl }} style={s.videoThumbImg} resizeMode="cover" />
              : <View style={[s.videoThumbImg, { backgroundColor: ['#D6E8F6','#F6D6E0'][index % 2] }]} />
            }
            <View style={s.playBtn}>
              <CdnSvg uri={`${CDN}play-pause-message-white.svg`} width={28} height={28} />
            </View>
            {!!item.title && (
              <View style={s.videoCaptionScrim}>
                <Text style={s.videoTitle} numberOfLines={2}>{item.title}</Text>
              </View>
            )}
          </Pressable>
        )}
      />
    </>
  )
}

// Inline video player for the self-help video modal — same expo-video pattern
// already used by screens/help-center/FaqScreen.tsx's FaqVideoPlayer.
export function SelfHelpVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => { p.play() })
  return <VideoView player={player} style={s.videoModalPlayer} nativeControls />
}

// ─── Help / Support ─────────────────────────────────────────────────────────────

// Angular: explore.component.ts's getHelbBannerData() → this whole section is
// actually the shared <app-home-banner> component with action='helpBanner',
// content read from the FAQ_DETAILS.BANNER translation object (a static
// title/body/CTA/image/gradient-background, not the customer-care API) —
// title+body+a single "Call us #CALL#" LINK (chevron, no button styling),
// with a decorative image on the right. There is no WhatsApp button at all
// in Angular's real Home help section.
export function HelpSection({
  onCallPress, phone = '+91 9876543210',
}: { onCallPress: () => void; phone?: string }) {
  const { t } = useTranslation()
  // Measured directly off the live Angular app's inline style on #helpBanner
  // (matches FAQ_DETAILS.BANNER.BANNERBG exactly): linear-gradient(335deg,
  // #FFEEE7 5.54%, #F5F5F5 93.82%) — peach starts near the bottom-right,
  // grey ends near the top-left. 335deg converted to start/end fractions via
  // the standard CSS-angle-to-corner-points formula (x=0.5+sin(θ)·0.5 etc.).
  return (
    <LinearGradient
      colors={['#FFEEE7', '#F5F5F5']}
      start={{ x: 0.71, y: 0.95 }}
      end={{ x: 0.29, y: 0.05 }}
      style={s.helpWrap}
    >
      <View style={s.helpTextCol}>
        <Text style={s.helpTitle}>{t('FAQ_DETAILS.BANNER.TITLE')}</Text>
        <Text style={s.helpSub}>{t('FAQ_DETAILS.BANNER.BODY')}</Text>
        <Pressable style={s.helpCta} onPress={onCallPress}>
          <Text style={s.helpCtaText}>{t('FAQ_DETAILS.BANNER.CTA').replace('#CALL#', phone).trim()}</Text>
          <Text style={s.helpCtaChevron}>{'›'}</Text>
        </Pressable>
      </View>
      <CdnSvg uri={`${CDN}call-24-7.svg`} width={80} height={80} />
    </LinearGradient>
  )
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: { navigation: any }) {
  const isDesktop = useIsDesktopWeb()
  const { t, i18n } = useTranslation()
  const [contentLoaded, setContentLoaded] = useState(false)

  // ── WhatsApp "no photo" CTA (All Matches / New Matches / etc. cards) ──────
  // Angular: matches-card.component's handleWhatsApp() — same confirm →
  // communicationBtnOnClick → result dispatch every other screen with a
  // Call/WhatsApp button already uses (ActivityScreen.tsx/MatchesScreen.tsx).
  const gating = useContactGating()
  const phoneInfo = usePhoneInfoSheet()
  const [contactConfirm, setContactConfirm] = useState<{ item: SwiperItem; action: 'whatsapp' } | null>(null)
  const [contactDetails, setContactDetails] = useState<{
    name: string; mobile?: string | undefined; dialNumber?: string | undefined; whatsappNumber?: string | undefined
    showCounter?: boolean | undefined; viewedCount?: string | undefined; totalCount?: string | undefined
    idVerified?: boolean | undefined
  } | null>(null)
  const [whatsappPaywallItem, setWhatsappPaywallItem] = useState<SwiperItem | null>(null)

  const [likedTab, setLikedTab] = useState<LikedTab>('likedbyme')
  const [categories, setCategories] = useState<ExploreCategory[]>(MOCK_CATEGORIES)

  // ── Session / profile-completion / gating inputs ──────────────────────────
  const [userName, setUserName]           = useState('')
  const [userImg, setUserImg]             = useState<string | undefined>(undefined)
  const [completionPct, setCompletionPct] = useState(0)
  const [entryType, setEntryType]         = useState('')
  const [gender, setGender]               = useState<'M' | 'F'>('F')
  const [ekycStatus, setEkycStatus]       = useState('')
  const [payRenewalFlag, setPayRenewalFlag] = useState('0')
  const [lang, setLang]                   = useState('en')
  const [ppSetData, setPpSetData]         = useState<Record<string, any>>({})
  const [comCount, setComCount]           = useState<ComCountEntry[]>([])
  const [completeCards, setCompleteCards] = useState<CompleteProfileCard[]>([])
  const [upgradeTag, setUpgradeTag] = useState('')
  const [showMembershipDot, setShowMembershipDot] = useState(false)

  // ── Hero banner / assist banner (mutually exclusive top slot) ─────────────
  const [heroBannerVariant, setHeroBannerVariant]   = useState<HeroBannerVariant>(null)
  const [heroBannerContent, setHeroBannerContent]   = useState<HeroBannerContent | null>(null)
  const [assistContent, setAssistContent]           = useState<AssistBannerContent | null>(null)
  const [assistDismissed, setAssistDismissed]       = useState(false)
  const [paymentFailedDismissed, setPaymentFailedDismissed] = useState(false)

  // ── Sticky banner (pinned above footer) — Angular's Home screen renders this
  // as a THIRD, separate slot from the hero banner above (§16 in the source
  // analysis: the generic sticky explicitly excludes PAYMENTFAILED_STICKY, which
  // stays in the hero-banner slot handled above). Covers force-update (highest
  // priority, same as MatchesScreen.tsx's judgment call) and the profile-
  // validation-rejected banner (PISTATUS in [5,13]).
  const [forceUpdateInfo, setForceUpdateInfo]           = useState<ForceUpdateInfo | null>(null)
  const [profileValidationBanner, setProfileValidationBanner] = useState<ProfileValidationBanner | null>(null)
  // Angular: tapping the ProfileValidSticky opens bottomSheetService.showBtmSheet()
  // (action='profileValidation') — a SEPARATE open/close state from the sticky
  // itself, which stays visible underneath (Row B has no close button of its own).
  const [profileValidationSheetVisible, setProfileValidationSheetVisible] = useState(false)
  // Angular: getPPSETData()'s if/elseif chain — the SAME 3 conditions that pick
  // the hero banner variant (photo_promo_free_female/non_id_verify_male/
  // paid_verified_no_photo) ALSO populate a sticky nudge simultaneously, reading
  // a DIFFERENT sub-key off the same REGISTRATIONARRAYS entry (.Shortlist/.sticky
  // instead of the hero banner's .Banner). type drives both the tap target and
  // (implicitly) that this sticky has no close button, matching Angular's
  // CLOSE_IMG='' for this content.
  const [photoPromoSticky, setPhotoPromoSticky] = useState<{ content: string; imageUrl?: string | undefined; type: 'ADDPHOTO' | 'IDVERIFY' } | null>(null)
  // Angular: getContactsData() — the pending-UPI-autopay-renewal-payment nudge.
  // Only ever checked when checkProfileStatus() DIDN'T already show the
  // profile-validation sticky (PISTATUS not 5/13) — mutually exclusive with it
  // by construction in Angular, matched below by gating the fetch the same way.
  const [autopaySticky, setAutopaySticky] = useState<{ content: string; ctaLabel: string } | null>(null)
  const [stickyDismissed, setStickyDismissed]           = useState(false)
  // Angular: logScrollEnd() hides the sticky banner once the user has scrolled
  // past the header while actively scrolling down (shows again scrolling up or
  // near the top) — RN has no overlaid/translucent header to recolor the way
  // Angular's does, so only the sticky-banner-hide half of that behavior applies.
  const [hideStickyOnScroll, setHideStickyOnScroll] = useState(false)
  const scrollYRef = useRef(0)

  // Self-help video playback — Angular has no modal for this either (its
  // FAQ videos use a dedicated VideoFaqPopupComponent); mirrors the inline
  // expo-video player pattern already used by screens/help-center/FaqScreen.tsx.
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null)

  // ── Per-section skeleton-loader flags (Angular: mContLoaded/nmContLoaded —
  // the only two Home sections that show a dashboard-skeleton while loading) ──
  const [allMatchesLoaded, setAllMatchesLoaded]   = useState(false)
  const [newlyJoinedLoaded, setNewlyJoinedLoaded] = useState(false)

  // ── Listing sections ───────────────────────────────────────────────────────
  const [allMatches, setAllMatches]           = useState(MOCK_ALL_MATCHES)
  const [allMatchesTotal, setAllMatchesTotal] = useState(MOCK_ALL_MATCHES.length)
  // No viewedMeTotal state — the section's visibility gate reads viewedMe's own
  // array length (matching Angular's swiperViewedYouList.length check exactly),
  // and its header count comes from comTotalFor(comCount, 'viewedyou') instead.
  const [viewedMe, setViewedMe]               = useState(MOCK_VIEWED_ME)
  const [todayMatches, setTodayMatches]       = useState(MOCK_TODAY_MATCHES)
  const [todayTotal, setTodayTotal]           = useState(MOCK_TODAY_MATCHES.length)
  const [newlyJoined, setNewlyJoined]         = useState(MOCK_NEWLY_JOINED)
  const [newlyJoinedTotal, setNewlyJoinedTotal] = useState(MOCK_NEWLY_JOINED.length)
  // No profilesViewedTotal state — Angular sources this section's header
  // count from comTotalFor(comCount, 'viewedbyme') exclusively (see that
  // function's header comment), not from this listing's own response.
  const [profilesViewed, setProfilesViewed]   = useState(MOCK_PROFILES_VIEWED)
  // No likedByMeTotal state — the section's visibility gate reads likedByMe's/
  // likedMe's own array lengths (matching Angular's likedByMeProfiles.length /
  // likedYouProfiles.length check exactly), and header counts come from
  // comTotalFor(comCount, ...) instead.
  const [likedByMe, setLikedByMe]             = useState(MOCK_LIKED_BY_ME)
  const [likedMe, setLikedMe]                 = useState(MOCK_LIKED_ME)
  const [likedMeTotal, setLikedMeTotal]       = useState(MOCK_LIKED_ME.length)
  const [stories, setStories]                 = useState<SwiperItem[]>(MOCK_STORIES)
  const [videos, setVideos]                   = useState<HelpVideo[]>(MOCK_VIDEOS)
  const [customerCare, setCustomerCare]       = useState({ phone: '+91 9876543210', whatsapp: '' })

  // Angular: ngOnInit()/ionViewDidEnter() — loadHome() is the RN equivalent of
  // BOTH combined. Called on every focus (useFocusEffect below); `includePopups`
  // gates the truly one-time-per-mount bits (screen-view analytics, the
  // once-per-install first-land ping) so they don't refire every time the user
  // tabs back to Home.
  const loadHome = useCallback(async (ctrl: { cancelled: boolean }, includePopups: boolean) => {
    // TEMP DEBUG — pinpointing a reported 5+ second "stuck" feeling on native
    // right after landing on Home. Times the two biggest suspects: the
    // blocking refreshSession() await (network-bound — everything below is
    // serialized behind it) vs. overall loadHome wall-clock (render-churn
    // territory, if refreshSession itself is fast but the total isn't).
    // Remove once the real bottleneck is confirmed from device logs.
    const __t0 = Date.now()

    // Angular's RN port convention (MatchesScreen.tsx's loadMatches() step 1):
    // every screen that fires listing API calls must refreshSession() first to
    // guarantee a valid/upgraded ATN — this was missing here, and its absence
    // is why every single Home listing call was failing with ERRCODE 23
    // ("Token expired") uniformly, all at once, regardless of endpoint.
    await refreshSession()
    if (__DEV__) console.log('DBG_HOME_TIMING refreshSession took', Date.now() - __t0, 'ms')
    if (ctrl.cancelled) return

    if (includePopups) {
      logScreen('Home')
      // Angular: calltrackApi() — paymentTrack('115') fires once per install,
      // guarded by FIRSTLAND_HOME in storage (no existing precedent for a
      // "forever" one-time flag elsewhere in this repo — modeled on the
      // SURVEYPOPUP/PN_LAST_SHOWN_DATE consume-once shapes in MatchesScreen.tsx).
      getItem('FIRSTLAND_HOME').then(fired => {
        if (ctrl.cancelled || fired === '1') return
        setItem('FIRSTLAND_HOME', '1')
        paymentTrack('115')
      })
    }

    getItem(StorageKeys.User.PHOTO_URL).then(photo => { if (!ctrl.cancelled && photo) setUserImg(photo) })

    Promise.all([fetchHomeSession(), fetchAndStorePPSetData()]).then(async ([session, data]) => {
      if (ctrl.cancelled) return
      if (session.userName) setUserName(session.userName)
      setEntryType(session.membershipType)
      setLang(session.lang)
      setPpSetData(data)
      const completeness = Number(data?.['PROFILECOMPLETENESS'])
      if (!Number.isNaN(completeness)) setCompletionPct(completeness)

      const [g, ekyc, paid, renewal, exploreCategories] = await Promise.all([
        getItem(StorageKeys.User.LOGIN_GENDER),
        getItem('EKYCSTATUS'),
        getItem(StorageKeys.Payment.PAY_P_FLAG),
        getItem(StorageKeys.Payment.PAY_RENEWAL_FLAG),
        fetchExploreCategories(data?.['DISCOVERKEY']),
      ])
      if (ctrl.cancelled) return
      const resolvedGender: 'M' | 'F' = g === 'M' ? 'M' : 'F'
      setGender(resolvedGender)
      setEkycStatus(ekyc ?? '')
      setPayRenewalFlag(renewal ?? '0')

      // Complete-Your-Profile cards — server list of incomplete cards, minus
      // whatever's already done locally (horoscope/photo — see homeGating.ts).
      const photoStatus = data?.['PI_PHOTOSTATUS'] ?? 'N'
      const photoApproved = photoStatus === 'Y'
      const rawCards = mapCompleteProfileCards(data)
      setCompleteCards(filterCompleteProfileCards(rawCards, session.horoAvailable, photoApproved))

      if (exploreCategories.length > 0) setCategories(exploreCategories)

      // ── Hero banner precedence chain (Angular: explore.component.ts's
      // getPPSETData() chain, same order MatchesScreen.tsx's applyHeroBanner
      // if/else-if already uses for its own 3-way subset) ──────────────────
      const entryTypeVal = session.membershipType
      const isPvnpMale = isPaidVerifiedNoPhotoMale(entryTypeVal, ekyc ?? '', resolvedGender, photoStatus)
      const isNivpMale = isNonIdVerifiedPaidMale(entryTypeVal, resolvedGender, ekyc ?? '', paid ?? '')
      const showHero = computeShowHeroBanner({
        entryType: entryTypeVal, payRenewalFlag: renewal ?? '0', gender: resolvedGender,
        isNonIdVerifiedPaidMale: isNivpMale, isPaidVerifiedNoPhotoMale: isPvnpMale,
      })
      const flagOk = String(data?.['PROFILEPUBLISHEDFLAG']) === '0'
      const typeOk = ['1', '2'].includes(String(data?.['PROFILEPUBLISHEDTYPE']))
      const isFreeFemalePhotoPromo = flagOk && typeOk && entryTypeVal === 'F'

      // Angular: PAYMENTFAILTYPE=='1' gates the payment-failed variant; content
      // comes from getHeroBannerDetails(true, 1) — same call MatchesScreen.tsx's
      // own payment-failed sticky uses (bannerType 1 = payment-failed content).
      let paymentFailedContent: HeroBannerContent | null = null
      if (!paymentFailedDismissed && (await getItem('PAYMENTFAILTYPE')) === '1') {
        const failedBanner = await getHeroBannerDetails(true, 1)
        const text = failedBanner?.['PAYMENTFAILEDCONTENT']
        const cta  = failedBanner?.['PAYMENTFAILEDCTA']
        if (text && cta) {
          const startMs = Date.parse(failedBanner?.['OFFSTTIME'] ?? '')
          const endMs   = Date.parse(failedBanner?.['OFFEDTIME'] ?? '')
          const deadlineMs = !Number.isNaN(startMs) && !Number.isNaN(endMs)
            ? Date.now() + Math.max(0, endMs - startMs)
            : Date.now() + 10 * 60 * 1000
          paymentFailedContent = { title: '', body: String(text), ctaLabel: String(cta), countdownDeadlineMs: deadlineMs }
        }
      }

      const variant = computeHeroBannerVariant({
        paymentFailedActive:       !!paymentFailedContent,
        showHeroBanner:            showHero,
        isFreeFemalePhotoPromo,
        isNonIdVerifiedPaidMale:   isNivpMale,
        isPaidVerifiedNoPhotoMale: isPvnpMale,
      })
      if (ctrl.cancelled) return
      setHeroBannerVariant(variant)
      setPhotoPromoSticky(null)

      if (variant === 'payment_failed' && paymentFailedContent) {
        // Angular: home-banner.component.html's paymentFailedPromotion grid —
        // a fixed alert icon (not a campaign image) when it's not the auto-
        // renewal (PAGETYPE 4/5) variant, which this Home banner never is —
        // that variant is handled separately by AutoRenewalFailureSheet on
        // the Payment screens.
        setHeroBannerContent({ ...paymentFailedContent, imageUrl: CDN + 'alert-triangle.svg' })
      } else if (variant === 'photo_promo_free_female' || variant === 'non_id_verify_male' || variant === 'paid_verified_no_photo') {
        const reg = await getRegistrationArrays()
        if (ctrl.cancelled) return
        const bannerKey = variant === 'photo_promo_free_female' ? 'PHOTOPUBLISHED'
                         : variant === 'non_id_verify_male'      ? 'PROFILEVERIFYPAID'
                         : 'PHOTOPUBLISHPAID'
        const raw = reg?.[bannerKey]?.['Banner'] ?? {}
        setHeroBannerContent({
          title:      raw['TITLE'] || 'Profile not active yet!',
          body:       raw['BODY']  || 'Upload your photo to activate profile and let matches see you',
          ctaLabel:   raw['CTA']   || 'Add photo now',
          // Angular: home-banner.component.html's "add photo banner" grid —
          // always shows BANNERIMG next to the text; previously dropped here.
          imageUrl:   raw['BANNERIMG'] || undefined,
          // Angular: this grid's own "free-trial-bg" CSS class is a FIXED
          // #FFDDDD→white gradient, not server-driven — same one
          // MatchesScreen.tsx's PhotoPromotionBanner already uses for this
          // exact banner type. Previously this fell through to HeroBanner's
          // generic navy default (wrong — showed as a blue banner instead of
          // the correct pink one).
          gradient:   [Colors.photoPromoGradientStart, Colors.white],
          // Angular: mt-8 body3-regular-12 black-color — this variant's text
          // is black-on-light-pink, not the white-on-dark every other
          // variant uses (previously left unset, rendering unreadable white
          // text on the pink gradient).
          textColor:  Colors.black,
          // Angular: data.CTABGCOLOR || Colors.primaryDark / data.CTACOLOR ||
          // Colors.white — same fallback PhotoPromotionBanner uses when the
          // server doesn't send explicit hex colors (previously left
          // undefined here, which fell through to HeroBanner's own unrelated
          // white/navy default).
          ctaBgColor: raw['CTABGCOLOR']?.startsWith?.('#') ? raw['CTABGCOLOR'] : Colors.primaryDark,
          ctaColor:   raw['CTACOLOR']?.startsWith?.('#')   ? raw['CTACOLOR']   : Colors.white,
        })

        // Angular: photo_promo_free_female reads PHOTOPUBLISHED.Shortlist;
        // non_id_verify_male reads PROFILEVERIFYPAID.sticky; paid_verified_no_photo
        // reads PHOTOPUBLISHPAID.sticky (lowercase 'sticky', capitalized
        // 'Shortlist' — matched exactly as in the Angular source, not a typo here).
        const stickySubKey = variant === 'photo_promo_free_female' ? 'Shortlist' : 'sticky'
        const stickyRaw = reg?.[bannerKey]?.[stickySubKey] ?? {}
        const stickyContent = stickyRaw['TITLE']
        if (stickyContent) {
          setPhotoPromoSticky({
            content:  String(stickyContent),
            imageUrl: stickyRaw['IMG'] || undefined,
            type:     variant === 'non_id_verify_male' ? 'IDVERIFY' : 'ADDPHOTO',
          })
        }
      } else if (variant === 'default') {
        const details = await getHeroBannerDetails(false)
        if (ctrl.cancelled) return
        // Angular: home-banner.component.ts's isOldBanner() — PROMOTYPE=='0'
        // uses one set of fields (BANNERIMG/BANNERBG/TITLE1/TITLE2, its own
        // CONTENT+TIMER countdown line); anything else uses the newer set
        // (BRIDEIMG/BRIDEBGCOLOR/VALID). Both styles share the same CTA
        // button styling (CTABGCOLOR/CTABORDERCOLOR/CTATEXTCOLOR/ARROWICON) —
        // showLinkCTA never applies to this call site (explore.component.html
        // only sets it on the separate helpBanner usage), so the button style
        // always applies here.
        const isOldBanner = String(details?.['PROMOTYPE'] ?? '') === '0'
        // Angular's [attr.style] binds these fields as raw CSS, so the CMS
        // can send plain hex, 'transparent' (e.g. a borderless/textual CTA),
        // or rgb(a)/hsl(a) — RN's `style` prop accepts all of those directly.
        // Excluded: CSS gradient syntax, which a plain View's backgroundColor
        // can't render (that case already has its own dedicated `gradient`
        // field on HeroBannerContent, populated separately where it applies).
        const hex = (v: any): string | undefined =>
          typeof v === 'string' && /^(#|rgb|hsl|transparent$)/i.test(v.trim()) && !/gradient/i.test(v)
            ? v.trim()
            : undefined
        const ownTimerDeadline = isOldBanner && details?.['TIMER'] ? Date.parse(details['TIMER']) : NaN
        const bgColor = hex(isOldBanner ? details?.['BANNERBG'] : details?.['BRIDEBGCOLOR'])
        setHeroBannerContent({
          title:      details?.['TITLE'] || 'Upgrade your membership',
          title1:     isOldBanner ? (details?.['TITLE1'] || undefined) : undefined,
          title2:     isOldBanner ? (details?.['TITLE2'] || undefined) : undefined,
          body:       details?.['BODY']  || '',
          validText:  !isOldBanner ? (details?.['VALID'] || undefined) : undefined,
          ctaLabel:   details?.['CTA']   || 'Upgrade now',
          imageUrl:   isOldBanner ? details?.['BANNERIMG'] : details?.['BRIDEIMG'],
          bgColor,
          // Figma default for this banner when the server sends no resolvable
          // BANNERBG/BRIDEBGCOLOR: linear-gradient(180deg, #D9E7FF 12.59%, #FFF 137.6%).
          gradient:          bgColor ? undefined : ['#D9E7FF', '#FFFFFF'],
          gradientLocations: bgColor ? undefined : [0.1259, 1],
          // Angular: home-banner.component.html's old-banner block colors
          // TITLE/BODY/TITLE1/TITLE2 from these 4 independent server fields
          // (TITLE2 genuinely reuses CTABGCOLOR as its own text color in the
          // live template) — previously unread here, so this text always
          // fell through to HeroBanner's hardcoded white default.
          // Falls back to the same navy the CTA button text already defaults
          // to (Colors.link, this component's own pre-existing dark-on-light
          // default) when the server sends neither a color nor a background —
          // otherwise title/body text stays white-on-white against the
          // gradient fallback above.
          titleColor:  hex(details?.['TITLECOLOR']) ?? (bgColor ? undefined : Colors.link),
          bodyColor:   hex(details?.['CONTENTCOLOR']) ?? (bgColor ? undefined : Colors.link),
          title1Color: isOldBanner ? hex(details?.['NOTECOLOR']) : undefined,
          title2Color: isOldBanner ? hex(details?.['CTABGCOLOR']) : undefined,
          ctaBgColor:     hex(details?.['CTABGCOLOR']),
          ctaBorderColor: hex(details?.['CTABORDERCOLOR']),
          ctaColor:       hex(details?.['CTATEXTCOLOR']),
          arrowIconUrl:   details?.['ARROWICON'] || undefined,
          ownTimerContent:    isOldBanner ? (details?.['CONTENT'] || undefined) : undefined,
          ownTimerDeadlineMs: !Number.isNaN(ownTimerDeadline) ? ownTimerDeadline : undefined,
          // Angular: the CONTENT+TIMER line's own container (not the CTA) —
          // border/background from these 2 server fields, previously unread.
          ownTimerBg:          isOldBanner ? hex(details?.['TIMERBG']) : undefined,
          ownTimerBorderColor: isOldBanner ? hex(details?.['TIMERBORDER']) : undefined,
        })
      } else {
        setHeroBannerContent(null)
      }

      // Angular: footer.component.ts's paymentService.getMenuPromo(0) — fetched
      // once, feeds both the assist banner (ASSISTEDPROMO) and the footer's
      // membership upgrade tag (MENUDISCOUNT) below. Cached by getMenuPromo
      // itself, so this doesn't duplicate the assist-banner-specific fetch.
      const menuPromo = await getMenuPromo('MENU')
      if (ctrl.cancelled) return

      // ── Assist ("breather") banner — Angular: takes precedence over the hero
      // banner slot entirely when ASSISTEDFLAG is set and not locally dismissed.
      if (computeShowAssistBanner(data?.['ASSISTEDFLAG'], assistDismissed)) {
        const assisted = menuPromo?.['ASSISTEDPROMO']
        if (assisted) {
          setAssistContent({
            title:    assisted['TITLE'] ?? '',
            body:     assisted['BODY']  ?? '',
            ctaLabel: assisted['CTA']   ?? 'Know more',
          })
        }
      }

      // ── Footer membership upgrade tag — Angular: footer.component.ts —
      // membershipExpiry = ppSetData.NUMBEROFPAYMENTS > 0; upgradeTag =
      // MENUDISCOUNT, cleared to '' for zero-value tags or paid members.
      const membershipExpiry = Number(data?.['NUMBEROFPAYMENTS'] ?? 0) > 0
      let tag = String(menuPromo?.['MENUDISCOUNT'] ?? '')
      if (['0', '0 OFF', '₹0 OFF'].includes(tag) || entryTypeVal === 'P') tag = ''
      setUpgradeTag(tag)
      // Angular's exact showRedDot trigger lives outside footer.component.ts
      // (a separate common.ts flag set elsewhere) and isn't traced here —
      // approximated as "would show the tag at all" rather than guessed further.
      setShowMembershipDot(membershipExpiry && entryTypeVal === 'F' && !!tag)

      // ── Sticky banner — force-update (Angular/MatchesScreen.tsx line 1115's
      // exact comparison, copied verbatim for parity) takes priority; else the
      // profile-validation-rejected banner when PISTATUS is 5 (rejected) or 13
      // (under review).
      // Was reading Constants.expoConfig?.version (app.json's "1.0.0" Expo
      // scaffolding default, a separate native-build identifier never meant
      // to track this) instead of the app's own real version — with any
      // APPFORCEUPDATE.APPVERSION starting '2'-'9', "1.0.0" < that string
      // lexicographically, so this fired almost unconditionally.
      const psUpdateFlag = await getItem('PLAYSTOREUPDATE')
      const forceUpdate = computeForceUpdateInfo(data?.['APPFORCEUPDATE'], psUpdateFlag, APP_VERSION, isFreeFemalePhotoPromo)
      if (ctrl.cancelled) return
      setForceUpdateInfo(forceUpdate)

      if (!forceUpdate) {
        if (['5', '13'].includes(String(data?.['PISTATUS']))) {
          setAutopaySticky(null)
          const validationBanner = await fetchProfileValidationBanner()
          if (!ctrl.cancelled && validationBanner) setProfileValidationBanner(validationBanner)
        } else {
          setProfileValidationBanner(null)
          setAutopaySticky(null)
          // Angular: checkProfileStatus()'s else branch → getContactsData().
          await fetchContactDetails()
          if (ctrl.cancelled) return
          const paymentDetails = (await getJson<Record<string, any>>('CONTACT_DETAIL'))?.['PAYMENTDETAILS']
          if (!ctrl.cancelled && paymentDetails?.['paypendingflag'] === '1' && paymentDetails?.['status']) {
            setAutopaySticky({ content: String(paymentDetails['status']), ctaLabel: String(paymentDetails['cta2'] ?? '') })
          }
        }
      }
    })

    fetchHomeAllMatches().then(result => {
      if (ctrl.cancelled) return
      if (result.items.length > 0) {
        setAllMatches(result.items)
        setAllMatchesTotal(result.totalCount)
      }
      setAllMatchesLoaded(true)
    })
    fetchViewedYou().then(result => {
      if (!ctrl.cancelled && result.items.length > 0) {
        setViewedMe(result.items)
      }
    })
    fetchDailyRec().then(result => {
      if (!ctrl.cancelled && result.items.length > 0) {
        // Full array kept in state (not sliced here) — display and the
        // "view more" card's thumbnail preview each slice it separately below.
        setTodayMatches(result.items)
        // Angular: explore.component.ts's setDRProfiles() — drTotalCount =
        // resultData.length, the count of items THIS call actually returned
        // (capped by the API's own LIMIT=15 param above), not a separate
        // server-side total field. result.totalCount here reads TOTAL/
        // TOTALCOUNT off the response, which on this endpoint is an unrelated
        // large number (a different total, not today's recommendation count) —
        // that's what was showing e.g. "977" instead of the real "15".
        setTodayTotal(result.items.length)
      }
    })
    fetchNewlyJoined().then(result => {
      if (ctrl.cancelled) return
      if (result.items.length > 0) {
        setNewlyJoined(result.items)
        setNewlyJoinedTotal(result.totalCount)
      }
      setNewlyJoinedLoaded(true)
    })
    fetchViewedByMe().then(result => {
      if (!ctrl.cancelled && result.items.length > 0) {
        setProfilesViewed(result.items)
      }
    })
    // Fetched together (rather than two independent .then()s) so the default-tab
    // decision (Angular's "singlelikedlist" behavior) sees both real totals at
    // once — computing it off either promise alone would race against whichever
    // of the two resolves first.
    Promise.all([fetchLikedByMe(), fetchLikedYou(), getItem(StorageKeys.User.LOGIN_GENDER)]).then(
      ([likedByMeResult, likedYouResult, g]) => {
        if (ctrl.cancelled) return
        if (likedByMeResult.items.length > 0) {
          setLikedByMe(likedByMeResult.items)
        }
        if (likedYouResult.items.length > 0) {
          setLikedMe(likedYouResult.items)
          setLikedMeTotal(likedYouResult.totalCount)
        }
        setLikedTab(computeDefaultLikedTab(g === 'M' ? 'M' : 'F', likedYouResult.totalCount, likedByMeResult.totalCount))
      }
    )
    fetchSuccessStories().then(result => {
      if (!ctrl.cancelled && result.length > 1) setStories(result)
    })
    fetchFaqVideos().then(result => {
      if (!ctrl.cancelled && result.length > 0) setVideos(result)
    })
    fetchCustomerCare().then(result => {
      if (!ctrl.cancelled && (result.phone || result.whatsapp)) setCustomerCare(result)
    })
    fetchNotifCount().then(result => {
      if (!ctrl.cancelled) setComCount(result.comCount)
    })

    // Header/footer-critical data is ready once session+PPSET has resolved —
    // Angular: contentLoaded gates the ENTIRE page (no header/footer) until
    // this point; individual list sections keep their own mock-then-real /
    // skeleton-loader treatment after that.
    Promise.all([fetchHomeSession(), fetchAndStorePPSetData()]).finally(() => {
      if (!ctrl.cancelled) setContentLoaded(true)
      // TEMP DEBUG — see note at loadHome's top. This is when the header/
      // footer-critical chain (refreshSession + fetchHomeSession +
      // fetchAndStorePPSetData) has fully resolved.
      if (__DEV__) console.log('DBG_HOME_TIMING contentLoaded flipped at', Date.now() - __t0, 'ms')
    })
  }, [assistDismissed, paymentFailedDismissed])

  // Angular: ionViewDidEnter() — re-runs every time Home regains focus (tab
  // switch, back-navigation), not just on first mount. `isFirstFocusRef` mirrors
  // ngOnInit-vs-ionViewDidEnter: the first focus gets includePopups=true (fires
  // once-per-mount analytics/tracking), every later focus gets false.
  const isFirstFocusRef = useRef(true)
  useFocusEffect(
    useCallback(() => {
      // TEMP DEBUG — see note at loadHome's top.
      if (__DEV__) console.log('DBG_HOME_TIMING focus fired', Date.now())
      const ctrl = { cancelled: false }
      const includePopups = isFirstFocusRef.current
      isFirstFocusRef.current = false
      loadHome(ctrl, includePopups)
      return () => { ctrl.cancelled = true }
    }, [loadHome])
  )

  // Angular: registration.service.ts's navigateToMatches() — clears REGISTERURL
  // once the user has genuinely reached Home, the one place every onboarding
  // exit path (mobile DoshamScreen.tsx, desktop OtherDetailsDesktopStep.tsx)
  // funnels through. Harmless no-op if the key was never set (returning user).
  useEffect(() => {
    removeItem('REGISTERURL')
  }, [])

  // Angular: changeLanguage() (explore.component.ts) — switching language tears
  // down and rebuilds the whole page so every server-rendered string re-fetches
  // in the new language. Same mountedLangRef pattern as MatchesScreen.tsx:1282-1294
  // — skips the initial mount (already covered by the focus effect above) and
  // only reloads on a REAL change.
  const mountedLangRef = useRef(i18n.language)
  useEffect(() => {
    if (i18n.language === mountedLangRef.current) return
    mountedLangRef.current = i18n.language
    const ctrl = { cancelled: false }
    loadHome(ctrl, false)
    return () => { ctrl.cancelled = true }
  }, [i18n.language, loadHome])

  // ── Live notification counts via socket (Angular: socketService.getNotificationLogin()
  // subscription in ngAfterViewInit) — connects once, requests counts, and updates
  // comCount live rather than only on load/focus. Nothing else in this app has
  // wired this socket up yet, so this is the first real consumer.
  useEffect(() => {
    let cancelled = false
    socketConnection(EnvConfig.notify).then(() => {
      if (cancelled) return
      emitNotificationDetails()
    })
    const unsubscribe = onNotificationList((data: any) => {
      if (cancelled || !data) return
      const list = data?.['COMCOUNT'] ?? data?.['RESPONSE']?.['COMCOUNT']
      if (Array.isArray(list)) setComCount(list)
    })
    return () => { cancelled = true; unsubscribe() }
  }, [])

  const hasPaidBadge = computeHasPaidBadge(
    entryType, payRenewalFlag,
    isPaidVerifiedNoPhotoMale(entryType, ekycStatus, gender, ppSetData?.['PI_PHOTOSTATUS'] ?? 'N'),
  )

  const toolbar = buildToolbar(comCount)
  const selfHelpVisible = computeSelfHelpVideosVisible(lang)

  // ── Navigation / action handlers ───────────────────────────────────────────

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 4: navigation.navigate('MessagerList'); break
      // Angular: footer.component.ts — paymentTrack(31) fires right before
      // routing a free member to the payment intermediate page.
      case 3: openMembershipTab(); break
    }
  }

  function handleToolbarPress(toolType: string) {
    // Angular: header.component.html's icon click is reDirectPage('/' +
    // toolbar.toolType) — the search icon's toolType is literally
    // 'discover-matches' (home.config.ts's homeToolBar), so it navigates to
    // /discover-matches, not /search. Notification icon goes to /notification.
    if (toolType === 'discover-matches') navigation.navigate('DiscoverMatches')
    if (toolType === 'notification')     navigation.navigate('Notification')
    if (toolType === 'menu')             navigation.navigate('Menu')
  }

  // Angular: onclickPayNowCTA(type) — dispatches per the variant currently shown.
  function handleHeroBannerPress() {
    switch (heroBannerVariant) {
      case 'payment_failed':
        navigation.navigate('recharge', { fromTab: false })
        break
      case 'photo_promo_free_female':
      case 'paid_verified_no_photo':
        navigation.navigate('Gallery')
        break
      case 'non_id_verify_male':
        navigation.navigate('verify-id')
        break
      default:
        paymentTrack('98')
        redirectToIntermediatePage('home')
    }
  }

  // Angular: onHomeBannerClose('paymentFailedPromotion') — session-scoped dismiss,
  // only meaningful for the payment-failed variant (the other variants aren't
  // closable in Angular either).
  function handleHeroBannerDismiss() {
    if (heroBannerVariant === 'payment_failed') {
      setPaymentFailedDismissed(true)
      setHeroBannerVariant(null)
      setHeroBannerContent(null)
    }
  }

  // Angular: assist-banner CTA — paymentTrack('105') + dismiss + payment intermediate page.
  function handleAssistPress() {
    paymentTrack('105')
    setAssistDismissed(true)
    setAssistContent(null)
    redirectToIntermediatePage('home')
  }

  function handleAssistDismiss() {
    setAssistDismissed(true)
    setAssistContent(null)
    setItem(StorageKeys.Promotions.ASSISTED_PROMO, '1')
  }

  // ── Sticky banner (force-update / photo-promo nudge / profile-validation) ──
  // Angular: getPPSETData()'s force-update branch explicitly checks
  // `!this.showPhotoPromotion` before showing — force-update wins over the
  // free-female photo nudge specifically. The other two photoPromo variants
  // (non-id-verify, paid-no-photo) aren't excluded quite so explicitly in the
  // source, but since only one sticky slot exists on screen at all, the same
  // forceUpdate-wins precedence is applied uniformly here rather than
  // reproducing that narrow, likely-unintentional overlap.
  const activeSticky: 'forceUpdate' | 'photoPromo' | 'autopay' | 'profileValidation' | null =
    stickyDismissed ? null
    : forceUpdateInfo ? 'forceUpdate'
    : photoPromoSticky ? 'photoPromo'
    : autopaySticky ? 'autopay'
    : profileValidationBanner ? 'profileValidation'
    : null

  function handleStickyPress() {
    if (activeSticky === 'forceUpdate') {
      const url = String(Constants.expoConfig?.extra?.['playStoreUrl'] ?? 'https://play.google.com/store/apps/details?id=jodii.app')
      Linking.openURL(url)
    } else if (activeSticky === 'photoPromo') {
      if (photoPromoSticky?.type === 'ADDPHOTO') {
        navigation.navigate('Gallery')
      } else {
        navigation.navigate('verify-id')
      }
    } else if (activeSticky === 'autopay') {
      // Angular: stickiyBtnEmit() → router.navigate(['/my-membership']). Not
      // substituting 'recharge' — that's a different screen, matching
      // pageLandingService.ts's own note that the two aren't equivalent.
      navigation.navigate('my-membership')
    } else if (activeSticky === 'profileValidation') {
      // Angular: bottomSheetService.showBtmSheet(pi_BottomPopupData) — a plain
      // informational sheet (why the profile isn't active), NOT a field-editor.
      // Confirmed by reading the real component: the CTA button's dismiss
      // action ('upgradeNow', from the shared generic click handler every
      // other action in that template also uses) never matches what
      // showBtmSheet()'s onDidDismiss actually checks for ('ProfileValidationBtmSheet')
      // — so tapping it is dead code in Angular itself, a no-op beyond closing
      // the sheet. Given the button's own label is overwritten with the
      // customer-care phone number right before the sheet opens
      // (`componentData.CTA = phoneNo`), wiring it to actually dial support —
      // matching BlockerScreen.tsx's existing pattern — is what this was
      // clearly meant to do, not reproducing the apparent bug.
      setProfileValidationSheetVisible(true)
    }
  }

  function handleProfileValidationCtaPress() {
    setProfileValidationSheetVisible(false)
    if (customerCare.phone) Linking.openURL(`tel:${customerCare.phone}`)
  }

  function handleStickyClose() {
    if (activeSticky === 'forceUpdate') {
      setItem('PLAYSTOREUPDATE', '2')   // Angular: "show again next login"
    }
    setStickyDismissed(true)
  }

  // Angular: logScrollEnd(ev) — hides the sticky banner while actively
  // scrolling down past a small threshold; shows it again scrolling up or near
  // the top. Simplified from Angular's header-height-relative thresholds (no
  // overlaid header here to measure against) to a flat 40px scroll delta.
  function handleScroll(e: any) {
    const y = e.nativeEvent.contentOffset.y
    const delta = y - scrollYRef.current
    if (Math.abs(delta) < 10) return
    scrollYRef.current = y
    if (y > 40 && delta > 0) setHideStickyOnScroll(true)
    else if (delta < 0 || y < 40) setHideStickyOnScroll(false)
  }

  // Angular: clickOnViewProfile() → matriIdDBset() (prev/next swipe chain) →
  // navigate to <type>/viewprofile/<id>. redirectToViewProfile is the same
  // helper MatchesScreen.tsx uses, so ViewProfileScreen's swipe-through works
  // identically regardless of which screen navigated into it.
  function goToProfile(item: SwiperItem, sectionItems: SwiperItem[], fromPage: string) {
    if (!item.profileId) return
    const ids = sectionItems.map(i => i.profileId).filter((id): id is string => !!id)
    redirectToViewProfile('', item.profileId, fromPage, ids)
  }

  // Angular: clickOnLike() → communicationBtnOnClick('home', action, oppProfile)
  // → optimistic flip of LIKED in the local array (emitLikeDislikeProfiles()).
  function makeLikeHandler(setList: (updater: (prev: SwiperItem[]) => SwiperItem[]) => void) {
    return async (item: SwiperItem) => {
      if (!item.profileId) return
      const alreadyLiked = ['1', '2', '3'].includes(item.likedStatus ?? '0')
      const action = alreadyLiked ? 'dislike' : 'like'
      const result = await communicationBtnOnClick('home', action, { MATRIID: item.profileId })
      if (result.type === 'api_success') {
        setList(prev => prev.map(p => (
          p.profileId === item.profileId ? { ...p, likedStatus: action === 'like' ? '1' : '0' } : p
        )))
      }
    }
  }

  function confirmThenWhatsApp(item: SwiperItem) {
    if (!item.profileId) return
    if (shouldSkipPhoneConfirm(item.phoneViewed ?? '', item.likedStatus ?? '0', gating.indNumbersLeft, gating.ownEntryType)) {
      handleContactConfirmYes({ item, action: 'whatsapp' })
    } else {
      setContactConfirm({ item, action: 'whatsapp' })
    }
  }

  function getContactConfirmContent(): string {
    if (!contactConfirm) return ''
    const question = t('VIEWPROFILE.VIEWPHONECONFIRM')
      .replace('#HISHER#', t(`PRONOUN.${gating.oppGender}.hisher`))
      .replace('#HIMHER#', t(`PRONOUN.${gating.oppGender}.himher`))
    const quota = t('VIEWPROFILE.VIEWPHONEDETAIL')
      .replace('#VAR#', gating.contactQuota.viewed)
      .replace('#VAR1#', gating.contactQuota.left)
      .replace('#VAR2#', gating.contactQuota.expiry)
    return `${question}\n\n${quota}`
  }

  function handleContactConfirmClose() {
    setContactConfirm(null)
  }

  async function handleContactConfirmYes(override?: { item: SwiperItem; action: 'whatsapp' }) {
    const pending = override ?? contactConfirm
    if (!pending) return
    const { item } = pending
    setContactConfirm(null)
    try {
      const result = await communicationBtnOnClick('home_matches', 'whatsapp', { MATRIID: item.profileId })
      if (result.type === 'show_contact') {
        setContactDetails({
          name: item.name ?? '', mobile: result.mobile, dialNumber: result.dialNumber, whatsappNumber: result.whatsappNumber,
          showCounter: result.showCounter, viewedCount: result.viewedCount, totalCount: result.totalCount,
          idVerified: item.isIdVerified,
        })
      } else if (result.type === 'payment_promo') {
        setWhatsappPaywallItem(item)
      } else if (result.type === 'error') {
        Alert.alert('', result.message)
      } else {
        await phoneInfo.handleResult(result)
      }
    } catch { /* silent — matches this app's established convention */ }
  }

  function handleContactDetailsClose() { setContactDetails(null) }
  function handleContactDetailsCall() {
    if (contactDetails?.dialNumber) Linking.openURL(`tel:${contactDetails.dialNumber}`)
  }
  function handleContactDetailsWhatsApp() {
    const num = contactDetails?.whatsappNumber?.replace(/\D/g, '')
    if (num) Linking.openURL(`https://wa.me/${num}`)
  }

  // setX setters are referentially stable across renders, so these don't need
  // useCallback — makeLikeHandler(setX) itself is already a fresh closure per
  // render either way, wrapping it would just add indirection with no benefit.
  const likeAllMatches   = makeLikeHandler(setAllMatches)
  const likeViewedMe     = makeLikeHandler(setViewedMe)
  const likeTodayMatches = makeLikeHandler(setTodayMatches)
  const likeNewlyJoined  = makeLikeHandler(setNewlyJoined)
  const likeProfilesViewed = makeLikeHandler(setProfilesViewed)
  const likeLikedByMe    = makeLikeHandler(setLikedByMe)
  const likeLikedMe      = makeLikeHandler(setLikedMe)

  // Angular: redirectToPCS(cardDetails) — each card type navigates to its own
  // edit screen. IDVERIFY has no registered route in this app yet (no dedicated
  // screen exists) — left as a TODO no-op rather than guessing.
  // StarRaasiScreen moved from page '29' to '33' when the horoscope generation
  // flow (pages 29/30/31) was added — '29' is now GenerateHoroscopeScreen.
  function handleCompleteProfileCard(card: CompleteProfileCard) {
    switch (card.type) {
      case 'PHOTO':       navigation.navigate('Gallery'); break
      case 'STAR_RAASI':  navigation.navigate('onboarding', { pageNo: '33', standalone: true }); break
      case 'PROPERTY':
      case 'VEHICLE':     navigation.navigate('onboarding', { pageNo: '28', standalone: true }); break
      case 'FAMILY':      navigation.navigate('onboarding', { pageNo: '27', standalone: true }); break
      case 'DIET':        navigation.navigate('onboarding', { pageNo: '38', standalone: true }); break
      case 'HOMETOWN':    navigation.navigate('onboarding', { pageNo: '44', standalone: true }); break
      case 'HOROSCOPE':   navigation.navigate('onboarding', { pageNo: '29', standalone: true }); break
      case 'IDVERIFY':    navigation.navigate('verify-id'); break
    }
  }

  // Angular: getHelbBannerData()'s CTA click → callNative('dial_pad') — dials
  // customer care directly. No WhatsApp option exists in Home's help section.
  function handleCallPress() {
    if (customerCare.phone) Linking.openURL(`tel:${customerCare.phone}`)
  }

  // ── Desktop web layout (Figma "Jodii Desktop - Registration", 161:10324) ───
  if (isDesktop) {
    return (
      <HomeDesktopLayout
        navigation={navigation}
        userName={userName}
        completionPct={completionPct}
        heroBannerVariant={heroBannerVariant}
        heroBannerContent={heroBannerContent}
        onHeroBannerPress={handleHeroBannerPress}
        onHeroBannerDismiss={handleHeroBannerDismiss}
        assistContent={assistDismissed ? null : assistContent}
        onAssistPress={handleAssistPress}
        onAssistDismiss={handleAssistDismiss}
        // photoPromo/autopay stickies are mobile-scoped for now (this pass) —
        // HomeDesktopLayout doesn't render them yet, so they're narrowed away
        // here rather than widening that component's prop type for variants
        // it can't show.
        activeSticky={activeSticky === 'photoPromo' || activeSticky === 'autopay' ? null : activeSticky}
        stickyText={activeSticky === 'forceUpdate' ? t('APP_UPDATE.NOTE') : profileValidationBanner?.stickyContent ?? ''}
        stickyCtaLabel={activeSticky === 'forceUpdate' ? t('APP_UPDATE.CTA') : profileValidationBanner?.bottomCtaLabel ?? ''}
        onStickyPress={handleStickyPress}
        onStickyClose={handleStickyClose}
        allMatches={allMatches}
        allMatchesTotal={allMatchesTotal}
        viewedMe={viewedMe}
        // Angular: setCountListValue() — these 4 header totals come from the
        // communication/newcount response's per-comtype totalCount, not each
        // section's own (differently-limited) listing API total. See
        // comTotalFor()'s header comment for the full story.
        viewedMeTotal={comTotalFor(comCount, 'viewedyou')}
        todayMatches={todayMatches}
        todayTotal={todayTotal}
        newlyJoined={newlyJoined}
        newlyJoinedTotal={newlyJoinedTotal}
        profilesViewed={profilesViewed}
        profilesViewedTotal={comTotalFor(comCount, 'viewedbyme')}
        completeCards={completeCards}
        onCompleteProfileCardPress={handleCompleteProfileCard}
        likedTab={likedTab}
        onLikedTabChange={setLikedTab}
        likedByMe={likedByMe}
        likedByMeTotal={comTotalFor(comCount, 'likedbyme')}
        likedMe={likedMe}
        likedMeTotal={comTotalFor(comCount, 'likedyou')}
        categories={categories}
        stories={stories}
        videos={videos}
        selfHelpVisible={selfHelpVisible}
        customerCare={customerCare}
        onCardPress={item => goToProfile(item, allMatches, 'home')}
        onTabPress={handleTabPress}
      />
    )
  }

  return (
    <View style={s.screen}>

      <AppHeader
        type="header1"
        userImg={userImg}
        userName={userName}
        completionPct={completionPct}
        hasPaidBatch={hasPaidBadge}
        homeToolBar={toolbar}
        // Angular: header.component.html's avatar click is reDirectPage('/edit-profile')
        // — there's no self-view-profile flow in the real app at all, this is
        // the actual, correct target, not a stand-in for a missing one.
        onAvatarPress={() => navigation.navigate('EditProfile')}
        onEditProfilePress={() => navigation.navigate('onboarding', { pageNo: '2', standalone: true })}
        onToolbarItemPress={handleToolbarPress}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />

      {!contentLoaded ? (
        // Angular: ionViewDidEnter() re-runs loadHome() on every focus, same
        // as this screen's own useFocusEffect — but the header/footer never
        // disappeared in Angular either. Keeping them mounted here (instead
        // of gating the whole screen behind contentLoaded, which used to hide
        // AppFooter too) matches MatchesScreen.tsx/ActivityScreen.tsx's own
        // pattern of never re-blanking the footer on a refocus reload.
        <Loader variant="spinner" fullPage />
      ) : (
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        bounces
        overScrollMode="never"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >

        {/* ════════════ HERO BANNER / ASSIST BANNER (mutually exclusive) ════════════
            Angular: <app-home-banner *ngIf="heroBannerData && !assistFlag && ..."/>
            vs. <app-breather *ngIf="assistFlag && assistBannerData"/> — assist wins. */}
        {!assistDismissed && assistContent ? (
          <AssistBanner content={assistContent} onPress={handleAssistPress} onDismiss={handleAssistDismiss} />
        ) : heroBannerVariant && heroBannerContent ? (
          <HeroBanner
            content={heroBannerContent}
            onPress={handleHeroBannerPress}
            onDismiss={heroBannerVariant === 'payment_failed' ? handleHeroBannerDismiss : undefined}
          />
        ) : null}

        {/* ════════════ ALL MATCHES ════════════
            Angular: no explore-border-top wraps All Matches itself, and none
            of its own is attached below it either — the divider that follows
            belongs to whichever next section renders (see below), not to this
            one. */}
        <View style={s.section}>
          {!allMatchesLoaded ? (
            <Loader variant="skeleton-dashboard" />
          ) : allMatches.length > 1 ? (
            <SwiperCard
              swiperHeader={`${t('HOME.ALLMATCH_HEADER')} (${allMatchesTotal})`}
              cardVariant={1}
              // Angular: core/enums/home.enum.ts — allMatches maps to the
              // section string 'matches', NOT 'newmatches' (that's Newly
              // Joined's section below). ProfileCard.tsx's basicDetail()
              // specifically omits the education suffix for section==='matches'
              // — this was wired to the wrong section, so All Matches always
              // showed "age, education" instead of Angular's age-only line.
              cardSection="matches"
              items={allMatches.slice(0, 5)}
              moreItems={moreItemsFrom(allMatches, 5)}
              showSeeAll
              onCardPress={item => goToProfile(item, allMatches, 'home_matches')}
              onLikePress={likeAllMatches}
              onSeeAllPress={() => navigation.navigate('Matches')}
              onWhatsAppPress={confirmThenWhatsApp}
            />
          ) : null}
        </View>

        {/* ════════════ PROFILES WHO VIEWED ME ════════════
            Angular: profilesWhoviewedYouSection.blockbgColor = 'dot-img-bg' —
            a decorative background SVG plus a light pink-to-white gradient,
            not the plain white every other (non-special-cased) section uses.
            Angular wraps this section in its own explore-border-top div — the
            divider above it is gated on THIS section's own visibility, not on
            whatever happens to render above it. */}
        {/* Angular's *ngIf checks swiperViewedYouList.length (the viewedyou
            listing call's own returned/displayed array, capped to 5), not a
            separate total-count field — matching that literally instead of
            trusting viewedMeTotal's TOTAL field to agree with it. */}
        {viewedMe.length > 3 && (
          <>
            <View style={s.divider} />
            <LinearGradient colors={['#FFF1FF', '#FFFFFF']} style={s.section}>
              <Image
                source={{ uri: `${CDN}revamp/who-viewed-bg-color.svg` }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              <SwiperCard
                swiperHeader={`${t('HOME.WHO_VIEWED_YOU_HEADER')} (${comTotalFor(comCount, 'viewedyou')})`}
                newCount={comCountFor(comCount, 'viewedyou')}
                cardVariant={3}
                cardSection="viewedyou"
                items={viewedMe.slice(0, 5)}
                moreItems={moreItemsFrom(viewedMe, 5)}
                showSeeAll
                onCardPress={item => goToProfile(item, viewedMe, 'home_viewedyou')}
                onLikePress={likeViewedMe}
                onSeeAllPress={() => navigation.navigate('Activity')}
              />
            </LinearGradient>
          </>
        )}

        {/* ════════════ COMPLETE YOUR PROFILE ════════════ */}
        {completeCards.length > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.section}>
              {/* Angular: complete-profile.component.html's header text is
                  .color-1f1e1b, not the generic textPrimary black every other
                  section header here uses; wrapping row is mt-16 before the
                  first card (not sectionTitle's shared 12px). */}
              <Text style={[s.sectionTitle, s.cpSectionTitle]}>{t('HOME.COMPLETE_PROFILE_HEADER')}</Text>
              <CompleteProfileSection cards={completeCards} onCardPress={handleCompleteProfileCard} />
            </View>
          </>
        )}

        {/* ════════════ TODAY'S MATCHES (Daily Recommendation) ════════════
            Angular: *ngIf="swiperDRContents?.length > 0" — unlike All Matches/
            Newly Joined (>1), this section's threshold is just >0. Missing
            this gate left a stray empty section + divider gap when there's no
            daily-rec data. */}
        {todayMatches.length > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.section}>
              {/* Angular: home.config.ts's drmatches is the only swiper config
                  with coverflowEffect — a centered, tilted-neighbor carousel,
                  not the flat scroll every other section uses. */}
              <CoverflowSwiper
                swiperHeader={`${t('DAILYRECOMMENDATIONS.DAILY_RECOMMENDATIONS')} (${todayTotal})`}
                items={todayMatches.slice(0, 4)}
                moreItems={moreItemsFrom(todayMatches, 4)}
                onCardPress={item => goToProfile(item, todayMatches, 'home_dailyrec')}
                onLikePress={likeTodayMatches}
                onSeeAllPress={() => navigation.navigate('Matches')}
              />
            </View>
          </>
        )}

        {/* ════════════ NEWLY JOINED ════════════
            Angular: newlyJoinedSection.blockbgColor = 'pink-bg-block' —
            linear-gradient(#FCEBFF → #FFFFFF), not the plain white every
            other section here uses. Angular: <app-loader *ngIf="!nmContLoaded">
            sits on plain white BEFORE the *ngIf="nmContLoaded && swiperNewlyMatchContents?.length > 1"
            wrapper — the pink background + divider only exist once there's
            real data, not as an empty band while loading or when empty. */}
        {!newlyJoinedLoaded ? (
          <View style={s.section}>
            <Loader variant="skeleton-dashboard" />
          </View>
        ) : newlyJoined.length > 1 ? (
          <>
            <View style={s.divider} />
            <LinearGradient colors={['#FCEBFF', '#FFFFFF']} style={s.section}>
              <SwiperCard
                swiperHeader={`${t('HOME.NEWLY_JOINED_HEADER')} (${newlyJoinedTotal})`}
                cardVariant={1}
                cardSection="newmatches"
                items={newlyJoined.slice(0, 4)}
                moreItems={moreItemsFrom(newlyJoined, 4)}
                showSeeAll
                onCardPress={item => goToProfile(item, newlyJoined, 'home_newmatches')}
                onLikePress={likeNewlyJoined}
                onSeeAllPress={() => navigation.navigate('Matches')}
              />
            </LinearGradient>
          </>
        ) : null}

        {/* ════════════ PROFILES YOU VIEWED ════════════
            Angular wraps this in its own explore-border-top div too — the
            divider above it is gated on profilesViewed's own length, not on
            Newly Joined's or Liked Profiles' visibility. */}
        {profilesViewed.length > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.section}>
              <SwiperCard
                // Angular: home.enum.ts's sectionTitle.viewedbyme = 'GENERAL.VIEWEDBYME'
                // ("Profiles you viewed"), the exact key this section's live
                // template binds swiperHeader to.
                swiperHeader={`${t('GENERAL.VIEWEDBYME')} (${comTotalFor(comCount, 'viewedbyme')})`}
                newCount={comCountFor(comCount, 'viewedbyme')}
                cardVariant={3}
                cardSection="viewedbyme"
                items={profilesViewed.slice(0, 5)}
                moreItems={moreItemsFrom(profilesViewed, 5)}
                showSeeAll
                onCardPress={item => goToProfile(item, profilesViewed, 'home_viewedbyme')}
                onLikePress={likeProfilesViewed}
                onSeeAllPress={() => navigation.navigate('Activity')}
              />
            </View>
          </>
        )}

        {/* ════════════ LIKED PROFILES ════════════
            Angular: enums.likedprofile.blockbgColor = 'liked-profile-bg' — a
            cover-fit background SVG, not plain white. No explore-border-top
            wrapper in Angular at all — no divider directly above or below
            this section; Explore Categories' own leading divider (below)
            supplies the separator that follows it. */}
        {/* Angular's *ngIf checks likedYouProfiles.length / likedByMeProfiles.length
            (the actual listing arrays), not the header's communication-count
            totals — matching that literally rather than trusting comCount to
            agree with these listing calls' own item counts. */}
        {(likedByMe.length > 0 || likedMe.length > 0) && (
          <CdnSvgBackground uri={`${CDN}liked-profiles-bg.svg`} style={s.section}>
            <LikedProfilesSection
              likedTab={likedTab}
              onTabChange={setLikedTab}
              likedByMe={likedByMe}
              likedMe={likedMe}
              likedByCount={comTotalFor(comCount, 'likedbyme')}
              likedMeCount={comTotalFor(comCount, 'likedyou')}
              onCardPress={item => goToProfile(item, likedTab === 'likedbyme' ? likedByMe : likedMe, 'home_liked')}
              onLikePress={likedTab === 'likedbyme' ? likeLikedByMe : likeLikedMe}
            />
          </CdnSvgBackground>
        )}

        {/* ════════════ EXPLORE CATEGORIES ════════════ */}
        {categories.length > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.section}>
              <ExploreCategoriesSection
                categories={categories}
                onCategoryPress={cat => navigation.navigate('Matches', { exploreType: cat.id, exploreLabel: cat.label })}
              />
            </View>
          </>
        )}

        {/* ════════════ SUCCESS STORIES ════════════
            Angular: .success-story-section { background: #FEF2F6 } — a light
            pink section background, missing entirely before this fix. */}
        {stories.length > 1 && (
          <>
            <View style={s.divider} />
            <View style={[s.section, s.successStorySection]}>
              <SuccessStoriesSection
                stories={stories}
                // Success stories are married couples, not viewable member
                // profiles — no per-story detail route exists anywhere in this
                // app (confirmed: SuccessStoriesScreen is a flat list with its
                // own in-screen photo viewer, not a routable id). Tapping a
                // preview card on Home opens that same list screen.
                onCardPress={() => navigation.navigate('SuccessStories')}
              />
            </View>
          </>
        )}

        {/* ════════════ SELF-HELP VIDEOS (non-English UI only) ════════════
            Angular: <app-complete-profile *ngIf="(lang !== 'en')"> — gated on
            language ALONE, no videos.length check; it still mounts (header +
            empty carousel) with zero videos. No explore-border-top wrapper
            either — no divider on either side of this section (none between
            it and Success Stories above; Help below supplies its own leading
            divider). */}
        {selfHelpVisible && (
          <View style={s.section}>
            <SelfHelpVideosSection
              videos={videos}
              cardWidth={SW * 0.58}
              cardHeight={SW * 0.33}
              onVideoPress={item => item.videoUrl && setVideoModalUrl(item.videoUrl)}
            />
          </View>
        )}

        {/* ════════════ HELP SECTION ════════════
            Angular: *ngIf="helpBannerData" class="explore-border-top" —
            helpBannerData is static translation content (FAQ_DETAILS.BANNER),
            not an API-gated flag, so it's always truthy once the screen
            renders — the divider above Help is effectively unconditional. */}
        <View style={s.divider} />
        <View style={s.section}>
          <HelpSection onCallPress={handleCallPress} phone={customerCare.phone} />
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
      )}

      {activeSticky === 'forceUpdate' && !hideStickyOnScroll && (
        <ForceUpdateCard onPress={handleStickyPress} onClose={handleStickyClose} />
      )}
      {activeSticky === 'photoPromo' && !hideStickyOnScroll && (
        <PhotoPromoSticky
          content={photoPromoSticky!.content}
          imageUrl={photoPromoSticky!.imageUrl}
          onPress={handleStickyPress}
        />
      )}
      {activeSticky === 'autopay' && !hideStickyOnScroll && (
        <StickyBanner
          text={autopaySticky!.content}
          ctaLabel={autopaySticky!.ctaLabel}
          onPress={handleStickyPress}
          onClose={handleStickyClose}
        />
      )}
      {activeSticky === 'profileValidation' && !hideStickyOnScroll && (
        <PhotoPromoSticky
          content={profileValidationBanner!.stickyContent}
          imageUrl={profileValidationBanner!.stickyImg}
          onPress={handleStickyPress}
        />
      )}

      <BottomSheet
        visible={profileValidationSheetVisible}
        type="profileValidation"
        data={{
          title:    profileValidationBanner?.bottomTitle,
          content:  profileValidationBanner?.bottomContent,
          image:    profileValidationBanner?.bottomImg,
          ctaLabel: customerCare.phone || profileValidationBanner?.bottomCtaLabel,
        }}
        onClose={() => setProfileValidationSheetVisible(false)}
        onPrimaryPress={handleProfileValidationCtaPress}
      />

      <Modal visible={!!videoModalUrl} animationType="slide" onRequestClose={() => setVideoModalUrl(null)}>
        <View style={s.videoModal}>
          <Pressable style={s.videoModalClose} onPress={() => setVideoModalUrl(null)}>
            <Text style={s.videoModalCloseText}>✕</Text>
          </Pressable>
          {!!videoModalUrl && <SelfHelpVideoPlayer uri={videoModalUrl} />}
        </View>
      </Modal>

      {/* WhatsApp "no photo" CTA — confirm → contact-details / paywall */}
      <BottomSheet
        visible={!!contactConfirm}
        type="viewPhoneConfirm"
        data={{ content: getContactConfirmContent(), ctaLabel: t('ACCOUNT.YES', 'Yes') }}
        onClose={handleContactConfirmClose}
        onPrimaryPress={handleContactConfirmYes}
      />
      {contactDetails && (
        <ContactDetailsSheet
          visible
          name={contactDetails.name}
          mobile={contactDetails.mobile}
          whatsappNumber={contactDetails.whatsappNumber}
          showCounter={contactDetails.showCounter}
          viewedCount={contactDetails.viewedCount}
          totalCount={contactDetails.totalCount}
          showNotVerifiedNote={!contactDetails.idVerified && gating.loginGender === 'F'}
          onClose={handleContactDetailsClose}
          onCall={handleContactDetailsCall}
          onWhatsApp={handleContactDetailsWhatsApp}
        />
      )}
      <WhatsAppPaywallModal
        visible={!!whatsappPaywallItem}
        // WhatsAppPaywallModal only reads .name/.profileImg off `profile` —
        // both exist on SwiperItem too, so this is safe despite the type gap
        // (its prop type is MatchProfile since every other caller has one on
        // hand already; Home's cards only carry the lighter SwiperItem shape).
        profile={whatsappPaywallItem as any}
        oppGender={gating.oppGender}
        onClose={() => setWhatsappPaywallItem(null)}
        onPayNow={() => { setWhatsappPaywallItem(null); navigation.navigate('recharge') }}
      />
      <BottomSheet
        visible={!!phoneInfo.sheet}
        type="phonePrivacyInfo"
        data={phoneInfo.getData(t)}
        onClose={phoneInfo.close}
        onPrimaryPress={() => phoneInfo.primaryPress(navigation)}
        onSecondaryPress={() => phoneInfo.secondaryPress(navigation)}
        onLinkPress={phoneInfo.close}
      />

      <AppFooter
        activeTab={0}
        likesCount={likedMeTotal}
        upgradeTag={upgradeTag || undefined}
        showMembershipDot={showMembershipDot}
        onTabPress={handleTabPress}
      />

    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.white },
  scroll:  { flex: 1 },
  section: { paddingTop: 20, paddingBottom: 4 },
  divider: { height: 8, backgroundColor: '#F5F5F5' },
  hList:   { paddingHorizontal: 16 },

  sectionTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 15, color: Colors.textPrimary, paddingHorizontal: 16, marginBottom: 12 },
  // Angular: complete-profile.component.html's outer grid is pl-24 pr-0
  // (not the generic 16px every other section header uses), header color is
  // the specific .color-1f1e1b (not textPrimary), and the cards-wrapping row
  // is mt-16 below it (not the generic 12px).
  cpSectionTitle: { paddingHorizontal: 24, color: '#1F1E1B', marginBottom: 16 },

  // Complete profile — Angular: .complete-profile-block (separate bordered/
  // gradient box per card, not one shared container with divider rows).
  cpList: { marginHorizontal: 24, gap: 16 },
  cpCard: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       '#E6E6E6',
    paddingHorizontal: 12,
    paddingVertical:   8,
  },
  cpInfo:    { flex: 1, gap: 8 },
  // Angular: .body1-medium-14 { font-family: var(--english-medium-poppins) }
  cpTitle:   { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 14, color: Colors.black },
  cpCtaRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cpCtaText: { fontFamily: Fonts.poppinsRegular, fontSize: 14, color: '#29339B' },

  // Liked profiles tabs
  tabRow:             { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#F5F5F5', borderRadius: 8, padding: 3 },
  tabPill:            { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 6 },
  tabPillActive:      { backgroundColor: Colors.white, shadowColor: Colors.shadow, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabPillText:        { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.textSecondary },
  tabPillTextActive:  { fontFamily: Fonts.poppinsSemiBold, fontSize: 12, color: Colors.textPrimary },
  // Angular: .body2-regular-14 line-height-24, ml-24 mr-24 mb-32 pt-8 — shown
  // instead of the tab row when only one of likedYou/likedByMe has data.
  onlyOneLikedText:   { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 24, color: Colors.textPrimary, paddingHorizontal: 16, marginBottom: 12 },

  // Explore categories
  // Angular: .discover-new-bg — 12px radius, 1px #E6E6E6 border, compact
  // icon+text row (not a big image tile), default background a light diagonal
  // gradient (applied via LinearGradient at the call site, not here).
  // Angular: ion-row's pl-4/pr-24 + ion-col's size="5.4" offset="0.6" — see
  // tileWidth's own call-site comment for the exact math this approximates.
  // paddingLeft/paddingRight/gap are computed per-render from screen width —
  // see EXPLORE_TILE_WIDTH's header comment — and merged in at the call site.
  catGrid:      { flexDirection: 'row', flexWrap: 'wrap' },
  // Angular: .discover-new-bg { padding: 8px 4px 8px 8px } — tighter on the
  // right, where the chevron sits, not a flat 8px on every side.
  catTile:      { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#E6E6E6', paddingTop: 8, paddingRight: 4, paddingBottom: 8, paddingLeft: 8, minHeight: 64 },
  catIconWrap:  { width: 32, height: 32, marginRight: 8, alignItems: 'center', justifyContent: 'center' },
  catLabel:     { flex: 1, fontFamily: Fonts.poppinsMedium, fontSize: 12, color: Colors.textPrimary, lineHeight: 16 },
  catChevron:   { color: '#29339B', fontFamily: Fonts.poppinsSemiBold },

  // Angular: .success-story-section { background: #FEF2F6 }
  successStorySection: { backgroundColor: '#FEF2F6' },

  // Angular: ion-row wrapping the heart animation + text column and the
  // absolutely-positioned hand image alongside it.
  storyHeaderRow: { position: 'relative' },
  // Angular: .success-story-image { position:absolute; right:6px } — no top
  // offset in the source, so it stays flush with the row's top edge.
  storyHandImage: { position: 'absolute', top: 0, right: 6 },

  // Success stories header — Angular: both lines of the translated header
  // ("Got married<br>through Jodii" — NOT the "Made with Love in Jodii" the
  // .html template shows, which is just static placeholder scaffolding the
  // live `| translate` pipe always overrides) share ONE style —
  // heading2-semibold-18 + whiteColor — not a two-tone regular/bold split.
  // Angular: .negative-mt-18 pulls this block up to overlap the heart
  // animation above it.
  storyHeader:    { paddingHorizontal: 24, marginTop: -18, marginBottom: 12 },
  storyTitle:     { fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: Colors.white },
  // Angular: .body2-regular-14.black-color.line-height-20
  storySubtitle:  { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black, marginTop: 8, lineHeight: 20 },

  // Self-help videos
  videoCard:     { borderRadius: 10, overflow: 'hidden', position: 'relative', backgroundColor: Colors.white },
  videoThumbImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  playBtn:       { position: 'absolute', top: '50%', left: '50%', width: 40, height: 40, marginLeft: -20, marginTop: -20, alignItems: 'center', justifyContent: 'center' },
  videoCaptionScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, paddingTop: 24, backgroundColor: 'rgba(0,0,0,0.45)' },
  videoTitle:    { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.white, lineHeight: 16 },

  // Help section
  // Angular: FAQ_DETAILS.BANNER — title/body/link-CTA on a gradient card with
  // a decorative image, not two call/whatsapp buttons.
  helpWrap:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, borderRadius: 12, padding: 16, gap: 12 },
  helpTextCol:   { flex: 1 },
  helpTitle:     { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.textPrimary, marginBottom: 6 },
  helpSub:       { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, color: Colors.textSecondary, marginBottom: 10, lineHeight: 20 },
  helpCta:       { flexDirection: 'row', alignItems: 'center' },
  helpCtaText:   { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 13, color: '#29339B' },
  helpCtaChevron: { fontFamily: Fonts.poppinsSemiBold, fontSize: 15, color: '#29339B', marginLeft: 4 },

  // Self-help video modal
  videoModal:      { flex: 1, backgroundColor: '#000' },
  videoModalClose: { position: 'absolute', top: 48, right: 16, zIndex: 1, padding: 8 },
  videoModalCloseText: { fontSize: 22, color: Colors.white },
  videoModalPlayer: { flex: 1 },
})
