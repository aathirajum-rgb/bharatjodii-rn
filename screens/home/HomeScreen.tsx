import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { useFooterBadges } from '../../contexts/FooterBadgesContext'
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
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useVideoPlayer, VideoView } from 'expo-video'
import { SvgXml } from 'react-native-svg'
import CdnSvg, { CdnImage } from '../../components/cdn-svg/CdnSvg'
import CdnLottie from '../../components/CdnLottie'
import AppHeader, { type ToolbarItem } from '../../components/app-header/AppHeader'
import SwiperCard, { type SwiperItem } from '../../components/swiper-card/SwiperCard'
import CoverflowSwiper from '../../components/swiper-card/CoverflowSwiper'
import Loader from '../../components/loader/Loader'
import StickyBanner from '../../components/sticky-banner/StickyBanner'
import PhotoPromoSticky from '../../components/sticky-banner/PhotoPromoSticky'
import BottomSheet, { whatsAppPhotoRequestSheet } from '../../components/bottom-sheet/BottomSheet'
import ContactDetailsSheet from '../../components/matches/ContactDetailsSheet'
import WhatsAppPaywallModal from '../../components/matches/WhatsAppPaywallModal'
import { useContactGating, type ContactGating } from '../../hooks/useContactGating'
import { usePhoneInfoSheet } from '../../hooks/usePhoneInfoSheet'
import { useAddPhotoPicker } from '../../hooks/useAddPhotoPicker'
import WebPhotoInput from '../../components/add-photo/WebPhotoInput'
import AddPhotoVerdictSheets from '../../components/add-photo/AddPhotoVerdictSheets'
import { openMembershipTab, paymentTrack, getHeroBannerDetails, getMenuPromo, redirectToIntermediatePage } from '../../service/paymentService'
import { communicationBtnOnClick, fetchContactDetails, shouldSkipPhoneConfirm, shouldShowPhoneNoLimit, checkPaidBlockerGate, getContactConfirmContent as getSharedContactConfirmContent } from '../../service/communicationService'
import { redirectToViewProfile } from '../../service/buttonService'
import { getItem, setItem, removeItem, getJson } from '../../service/storageService'
import { getRegistrationArrays, getSessionValue } from '../../service/registrationService'
import { logScreen } from '../../service/analyticsService'
import { StorageKeys } from '../../constants/storage.keys'
import { CDN_LOTTIE, CDN_REACT, CDN_SVG } from '../../constants/cdn'
import { APP_VERSION } from '../../constants/appVersion'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { stripAndDecodeHtml } from '../../utils/htmlEntities'
import HomeDesktopLayout from './HomeDesktopLayout'
import HeroBanner, { type HeroBannerContent } from './HeroBanner'
import { parseCssBackground } from '../../utils/cssGradient'
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
  applyWhatsAppPhotoRequestFlags,
  type LikedTab,
  type HeroBannerVariant,
  type ForceUpdateInfo,
} from './homeGating'
import {
  fetchExploreCategories, fetchHomeSession, fetchAndStorePPSetData, fetchHomeAllMatches,
  fetchViewedYou, fetchDailyRec, fetchNewlyJoined, fetchViewedByMe,
  fetchLikedByMe, fetchLikedYou, fetchSuccessStories, fetchFaqVideos,
  fetchCustomerCare, fetchNotifCount, deriveExploreCount, refreshSession,
  mapCompleteProfileCards, fetchProfileValidationBanner, type ProfileValidationBanner,
  type ExploreCategory, type HelpVideo, type CompleteProfileCard, type ComCountEntry,
} from '../../service/homeService'
import { subscribeDrProfileRemoved } from '../../service/eventBus'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN = CDN_SVG
const FWD_ICON = `${CDN}revamp/forward-icon-link.svg`

// Figma spec for the default-variant hero banner's own fallback background,
// used only when the server sends no resolvable BANNERBG/BRIDEBGCOLOR at all:
// linear-gradient(180deg, #D9E7FF 12.59%, #FFF 137.6%) — note the 2nd stop
// sits PAST the visible box (>100%), so the real bottom edge never reaches
// solid white. Resampled once via the same parser/resampler the live API path
// uses (utils/cssGradient.ts), rather than a hand-computed literal, so this
// spec string stays the only source of truth and can't drift out of sync with
// what it's supposed to produce.
const DEFAULT_HERO_GRADIENT = (
  parseCssBackground('linear-gradient(180deg, #D9E7FF 12.59%, #FFF 137.6%)') as {
    gradient: { colors: string[]; locations?: number[] | undefined; start: { x: number; y: number }; end: { x: number; y: number } }
  }
).gradient

// Angular: both the Help section's CTA and the video-faq-popup's close button
// use Ionic's bundled Ionicons (node_modules/ionicons/dist/svg/*.svg), not a
// CDN-hosted image — same reasoning as AppHeader.tsx's CHEVRON_BACK_XML.
// Inlined verbatim (stroke swapped from currentColor to the CSS class's fixed
// color, since SvgXml doesn't inherit RN style color).
// chevron-forward-outline, colored .color-29339B — used by both the Help
// section's CTA (home-banner.component.html) and the Explore Categories tile
// (explore-card.component.html), both `ion-icon` with no other color class.
const CHEVRON_FORWARD_BLUE_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#29339B" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M184 112l144 144-144 144"/></svg>`
// close-outline, white (video-faq-popup.component.css's
// `.align-end-video-page { color: #fff }`, at its own font-size: 25px).
const CLOSE_OUTLINE_WHITE_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144M368 144L144 368"/></svg>`

// Rasterized instead of fetched from CDN as SVG (who-viewed-bg-color.svg,
// liked-profiles-bg.svg): both turned out to be auto-traced art with
// 700-1500+ <path> elements each (340KB/920KB of vector data for what's just
// a faint watermark pattern). react-native-svg draws every path synchronously
// on the UI thread via Canvas, plus a Canvas.saveLayer() per opacity group —
// that much work blocked the main thread past Android's 5s input-dispatch
// timeout, ANRing (and getting force-killed by the OS) on the Home screen.
// Decoding a bitmap is orders of magnitude cheaper than drawing ~1000 paths —
// that's still true fetched over the network as a plain <Image>, so these
// live on the CDN now (assets/images/react/) rather than bundled in the app;
// only the SVG-vs-raster format choice (not where the file lives) was ever
// the fix for the ANR.
const WHO_VIEWED_BG = CDN_REACT + '/who-viewed-bg-color.png'
const WHO_VIEWED_BG_RATIO = 360 / 588 // source SVG's viewBox aspect ratio
const LIKED_PROFILES_BG = CDN_REACT + '/liked-profiles-bg.png'
const LIKED_PROFILES_BG_RATIO = 360 / 624

// Raster equivalent of CdnSvgBackground's cover+anchor behavior (CSS
// background-size:cover + background-position) for the two CDN raster
// backgrounds above. RN's <Image resizeMode="cover"> always centers the
// crop, so 'top-left' anchoring (liked-profiles-bg — centering cut its
// artwork's top edge off, the same issue CdnSvgBackground's own anchor prop
// exists for) needs the scale/position worked out manually against the
// measured container box.
function LocalCoverBackground({
  source, aspectRatio, anchor = 'center', children, style,
}: {
  source: string
  aspectRatio: number
  anchor?: 'center' | 'top-left'
  children?: React.ReactNode
  style?: object
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  let imageStyle: object | null = null
  if (size) {
    const containerRatio = size.width / size.height
    const renderWidth  = containerRatio > aspectRatio ? size.width : size.height * aspectRatio
    const renderHeight = containerRatio > aspectRatio ? size.width / aspectRatio : size.height
    imageStyle = {
      position: 'absolute' as const,
      width: renderWidth,
      height: renderHeight,
      top:  anchor === 'top-left' ? 0 : -(renderHeight - size.height) / 2,
      left: anchor === 'top-left' ? 0 : -(renderWidth - size.width) / 2,
    }
  }

  return (
    <View
      style={[style, { overflow: 'hidden' }]}
      onLayout={e => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {!!imageStyle && <Image source={{ uri: source }} style={imageStyle} />}
      {children}
    </View>
  )
}
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
// Angular: .discover-new-bg { height: 20vmin } — a FIXED height (20vmin ≈ 20vw
// in portrait), so every tile is the same size and a two-line label centers
// inside it. A min-height instead let one-line tiles collapse shorter and
// two-line tiles grow taller than their neighbours.
const EXPLORE_TILE_HEIGHT = SW * 0.20
// Angular: the icon sits in an `ion-col size="2"` of the card's own 12-col grid,
// and the label column that follows adds `pl-5`. A flat 32+8 box pushed the
// label ~12px further right than Angular does, costing it that much width on an
// already-narrow two-line tile.
const EXPLORE_ICON_COL = (EXPLORE_TILE_WIDTH - 12) * 2 / 12
// Angular: .success-story-image img { width: 35vw; height: 35vw }
const HAND_SIZE = SW * 0.35
// Angular: complete-profile.component.html's `cardType==='completeprofile'`
// branch (the Complete-Your-Profile cards specifically — the OTHER branch
// this same component renders, `*ngIf="selfVideo"`, is a completely different
// full-bleed video-thumbnail layout) sizes its thumbnail via `ion-col size="2"
// class="padd0"` — a plain 2/12-width column, no gutter — inside a full-width
// row nested in `.complete-profile-block { padding: 8px 12px }`, itself
// inside the outer grid's `pl-24 pr-0`. So its true pixel size scales with
// device width (2/12 of screenWidth - 24 grid pad - 24 card pad), not a flat
// 48px.
const CP_THUMB_SIZE = (SW - 48) / 6

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

// Angular: app-swiper.component.ts's setHeader() — appends " (count)" to the
// translated section title ONLY when count > 0, never a bare "(0)".
// This matters most for the comTotalFor()-backed sections: their count comes
// from the communication/newcount call, which resolves INDEPENDENTLY of each
// section's own listing call. A section is gated on its listing (e.g.
// profilesViewed.length > 0), so it can render its cards a beat before the
// count arrives — and if the response carries no entry for that comtype, the
// count stays 0 for good. Interpolating unconditionally put a literal
// "Profiles you viewed (0)" above a swiper that visibly had profiles in it.
function headerWithCount(label: string, count: number): string {
  return count > 0 ? `${label} (${count})` : label
}

// Angular: cardMoreItemsData = cardMoreItems.splice(cap, 3) — the 3 items just
// beyond the visible slice, previewed as thumbnails on the "view more" card.
// Angular's card binds viewMoreList[i]?.THUMBIMG, so prefer the real thumbnail:
// profileImg resolves to PHOTO[0].IMAGE first (the full-size photo), which for a
// hidden/photo-protected profile is a different asset that renders blank in these
// 56px circles instead of falling through to the silhouette. Empty string last so
// SeeAllAvatar still sees a falsy uri and swaps in the opposite-gender avatar.
function moreItemsFrom(list: SwiperItem[], cap: number): { THUMBIMG: string }[] {
  return list.slice(cap, cap + 3).map(i => ({ THUMBIMG: i.thumbImg || i.profileImg || '' }))
}

// Root cause of the Home-screen freeze on focus: loadHome() below fires ~15
// independent API calls, each resolving at its own time and calling its own
// setState. None of the ~10 sections rendered further down were memoized, so
// EVERY one of those ~15 state updates re-rendered the entire section tree
// (multiple image-heavy FlatList-based swipers), not just the section whose
// own data actually changed — a burst of full-tree re-renders is what made
// the screen briefly unresponsive. React.memo fixes this IF the section's
// props are stable across unrelated re-renders — but every section's
// onCardPress/onLikePress/onWhatsAppPress/onSeeAllPress prop here is a fresh
// closure created on every HomeScreen render, which would defeat a normal
// memo comparison regardless. This comparator ignores function-prop identity
// instead: every such closure below closes ONLY over other props already
// compared here (the section's own items array/gating) or over stable values
// (navigation, setState setters), so a stale closure retained across a
// skipped re-render is behaviorally identical to a fresh one.
function propsEqualIgnoringFunctions<T extends Record<string, unknown>>(prev: T, next: T): boolean {
  for (const key of Object.keys(next) as (keyof T)[]) {
    const a = prev[key], b = next[key]
    if (typeof a === 'function' && typeof b === 'function') continue
    if (!Object.is(a, b)) return false
  }
  return true
}

// Angular: common-funtions.ts's updatePluralContent() — used ONLY for the
// "Who Viewed You" header on Home (explore.component.html:44,
// sectionTitle.profilesWhoviewedYou) — substitutes a locale-specific
// #PLURAL# token (e.g. Tamil's WHO_VIEWED_YOU_HEADER) with '' at count===1,
// PROFILES.PLURALMEMBER at count>1, or leaves it untouched at count===0
// (bug-compatible — Angular's own two-branch check never covers 0 either,
// but this header never renders at count 0 in practice: it's gated on
// viewedMe.length > 3). English's own translation has no #PLURAL# token in
// this specific key, so this is a no-op there.
function applyPluralToken(t: (key: string) => string, content: string, count: number): string {
  if (!content.includes('#PLURAL#')) return content
  if (count === 1) return content.replace('#PLURAL#', '')
  if (count > 1) return content.replace('#PLURAL#', t('PROFILES.PLURALMEMBER'))
  return content
}

export type { HelpVideo }

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
export const CompleteProfileSection = memo(function CompleteProfileSection({ cards, onCardPress }: CompleteProfileSectionProps) {
  const langFonts = useLanguageFonts()
  if (cards.length === 0) return null
  return (
    <View style={s.cpList}>
      {cards.map(card => (
        <Pressable key={card.type} onPress={() => onCardPress(card)}>
          <LinearGradient
            colors={['#E8EFFF', '#FFFFFF']}
            // Angular: linear-gradient(104deg, #E8EFFF 0%, #FFF 19.54%) — the
            // blue tint is confined to the leading ~20% of the card and it is
            // plain white from there on. Without the stop positions this ramped
            // across the whole card, tinting it far more heavily than Angular's.
            locations={[0, 0.1954]}
            start={{ x: 0, y: 0.15 }}
            end={{ x: 1, y: 0 }}
            style={s.cpCard}
          >
            {/* Angular: card?.THUMBIMG — a per-card image URL from the server;
                format isn't guaranteed, so CdnImage picks SvgUri vs Image by
                extension instead of assuming either way. */}
            {!!card.imageUrl && <CdnImage uri={card.imageUrl} width={CP_THUMB_SIZE} height={CP_THUMB_SIZE} />}
            <View style={s.cpInfo}>
              <Text style={s.cpTitle}>{card.label}</Text>
              <View style={s.cpCtaRow}>
                <Text style={[s.cpCtaText, { fontFamily: langFonts.regular }]}>{card.ctaLabel}</Text>
                {/* Angular: button-revamp.component.scss's icon rule has NO
                    `background-size` (the `contain` line is commented out) —
                    so the `iconSize`/large-vs-small box (16 or 24) never
                    actually scales the image at all; it only sizes an
                    invisible centering box. The real on-screen size is
                    forward-icon-link.svg's own native pixels: 7x10 (confirmed
                    from the live file), not 24 (same root cause fixed in
                    AppHeader.tsx and ButtonRevamp.tsx's ICON_URLS). iconType
                    IS the static forward-icon-link.svg (not the animated GIF
                    the header/ghost-card "See all" links use elsewhere on Home). */}
                <CdnSvg uri={FWD_ICON} width={7} height={10} />
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      ))}
    </View>
  )
}, propsEqualIgnoringFunctions)

// ─── Liked Profiles (tab toggle + card list) ──────────────────────────────────

export interface LikedProfilesSectionProps {
  likedTab:     LikedTab
  onTabChange:  (tab: LikedTab) => void
  likedByMe:    SwiperItem[]
  likedMe:      SwiperItem[]
  likedByCount: number
  likedMeCount: number
  gender:       'M' | 'F'
  onCardPress:  (item: SwiperItem) => void
  onLikePress:  (item: SwiperItem) => void
  // Photo-protected/no-photo overlay's WhatsApp CTA — see ProfilePhoto.tsx.
  onWhatsAppPress: (item: SwiperItem) => void
  // Angular: app-swiper's see-all link — shown for this section too
  // (showLinkCta defaults to true, showSeeAllButton = totalCount > 1).
  onSeeAllPress?: (() => void) | undefined
  // Not read directly by this component — onWhatsAppPress (passed in by
  // HomeScreen) closes over this, so it must be a compared prop here too;
  // see propsEqualIgnoringFunctions's header comment for why.
  gating: ContactGating
}

export const LikedProfilesSection = memo(function LikedProfilesSection({
  likedTab, onTabChange, likedByMe, likedMe, likedByCount, likedMeCount, gender, onCardPress, onLikePress, onWhatsAppPress,
  onSeeAllPress,
}: LikedProfilesSectionProps) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  // Angular: app-swiper.component.ts's hasLikedYouData()/hasLikedByMeData()
  // OR the count with actual returned items — but this port uses
  // likedMeCount/likedByCount (comTotalFor) instead of `.length > 0` on the
  // listing arrays, since those totals are the section header's own
  // trustworthy source (see comTotalFor's header comment).
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
      <Text style={[s.sectionTitle, s.likedSectionTitle, { fontFamily: langFonts.semiBold }]}>
        {headerWithCount(t('GENERAL.ICON_3'), likedByCount + likedMeCount)}
      </Text>
      {showTabs ? (
        // Angular: app-swiper.component.html:42-55 — the segment's tab ORDER
        // is gender-dependent (female sees "Liked you" first, male sees
        // "Liked by me" first); each tab keeps its own fixed label/id either
        // way, only the left/right position swaps.
        <View style={s.tabRow}>
          {(gender === 'F' ? (['likedyou', 'likedbyme'] as const) : (['likedbyme', 'likedyou'] as const)).map(tab => (
            <Pressable key={tab} style={[s.tabPill, likedTab === tab && s.tabPillActive]} onPress={() => onTabChange(tab)}>
              <Text style={[
                s.tabPillText,
                { fontFamily: langFonts.regular },
                likedTab === tab && s.tabPillTextActive,
                likedTab === tab && { fontFamily: langFonts.medium },
              ]}>
                {tab === 'likedyou'
                  ? `${t('LIKE_LIST.LIKEDYOU_HOME')} (${likedMeCount})`
                  : `${t('LIKE_LIST.LIKESENT_HOME')} (${likedByCount})`}
              </Text>
            </Pressable>
          ))}
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
        // Remounts the whole card list (FlatList scroll position included)
        // whenever the tab flips — this section reuses ONE SwiperCard
        // instance for both tabs, only swapping `items` below, so without a
        // key tied to the tab, switching tabs kept the previous tab's scroll
        // offset: e.g. scrolled to card 3 of "Liked by me", switching to
        // "Liked you" showed ITS card 3 first instead of starting over from
        // the first card.
        key={likedTab}
        cardVariant={8}
        cardSection="likedprofile"
        // Angular: setLikedProfileLists() — likedProfileContents is capped at
        // slice(0, 5) and the rest goes to likedProfileMoreItems, which feeds the
        // trailing "See all" ghost card. Passing the whole list as items rendered
        // every liked profile in the carousel and, with no moreItems at all, that
        // ghost card never appeared.
        items={items.slice(0, 5)}
        moreItems={moreItemsFrom(items, 5)}
        // Angular: showSeeAllButton = totalCount > 1, where this section's
        // totalCount is getLikedProfilesTotalCount() (both sides added).
        showSeeAll={likedByCount + likedMeCount > 1}
        onCardPress={onCardPress}
        onLikePress={onLikePress}
        onWhatsAppPress={onWhatsAppPress}
        {...(onSeeAllPress ? { onSeeAllPress } : {})}
      />
    </>
  )
}, propsEqualIgnoringFunctions)

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

// Angular's explore-card.component.html wraps the label in one span with the
// chevron as its last inline child, so the chevron always sits immediately
// after the final rendered word — after "stars" on a 2-line label, or right
// after a short one-line label, never pinned to the card's own edge. Each
// pre-split line (server-provided "\n" breaks, see fetchExploreCategories())
// renders as its own row; only the last one also carries the chevron.
function CategoryLabel({ label }: { label: string }) {
  const langFonts = useLanguageFonts()
  const lines = label.split('\n')
  return (
    <View style={s.catLabelWrap}>
      {lines.slice(0, -1).map((line, i) => (
        <Text key={i} style={[s.catLabel, { fontFamily: langFonts.medium }]} numberOfLines={1}>{line}</Text>
      ))}
      <View style={s.catLabelLastLine}>
        <Text style={[s.catLabel, { fontFamily: langFonts.medium }]} numberOfLines={1}>{lines[lines.length - 1]}</Text>
        <SvgXml xml={CHEVRON_FORWARD_BLUE_XML} width={16} height={16} style={s.catChevron} />
      </View>
    </View>
  )
}

export interface ExploreCategoriesSectionProps {
  categories: ExploreCategory[]
  onCategoryPress: (cat: ExploreCategory) => void
  // Angular: this section's own "Discover matches" heading (home.enum.ts's
  // sectionTitle.exploreMatches) only exists on the Home page's explore.component.html,
  // which stacks several differently-titled sections. discover-matches.component.html
  // reuses the exact same grid markup but has NO such in-page heading — that page's
  // <ion-toolbar> already shows "Discover matches" once, in the header. Defaults to
  // true so Home (this component's original/only caller until DiscoverMatchesScreen
  // started reusing it) keeps its heading unchanged.
  showTitle?: boolean
}

export const ExploreCategoriesSection = memo(function ExploreCategoriesSection({
  categories, onCategoryPress, showTitle = true,
}: ExploreCategoriesSectionProps) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
  return (
    <>
      {/* Angular: home.enum.ts's sectionTitle.exploreMatches = 'HOME.EXPLORE_MATCHES_TXT'
          ("Discover matches") — HOME.EXPLORE_MATCHES ("Explore matches based on")
          is a different, unused key. */}
      {showTitle && <Text style={[s.sectionTitle, s.exploreSectionTitle, { fontFamily: langFonts.semiBold }]}>{t('HOME.EXPLORE_MATCHES_TXT')}</Text>}
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
              {/* Angular: the chevron is INLINE right after the label text —
                  `homeService.ts`'s fetchExploreCategories() already turns a
                  server-sent "<br>" into a real "\n" (server bakes the break
                  in explicitly, e.g. "With matching\nstars"; it doesn't rely
                  on the container naturally wrapping). Splitting on that "\n"
                  and only attaching the chevron to the LAST line reproduces
                  Angular's real placement (right after "stars", not pinned to
                  the tile's own right edge/vertical center like before). */}
              <CategoryLabel label={cat.label} />
            </LinearGradient>
          </Pressable>
        ))}
      </View>
    </>
  )
}, propsEqualIgnoringFunctions)

// ─── Success Stories ───────────────────────────────────────────────────────────

export const SuccessStoriesSection = memo(function SuccessStoriesSection({
  stories, onCardPress, onSeeAllPress,
}: { stories: SwiperItem[]; onCardPress: (item: SwiperItem) => void; onSeeAllPress: () => void }) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
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
            <Text style={[s.storyTitle, { fontFamily: langFonts.semiBold }]}>{headLine1}</Text>
            <Text style={[s.storyTitle, { fontFamily: langFonts.semiBold }]}>{headLine2}</Text>
            <Text style={[s.storySubtitle, { fontFamily: langFonts.regular }]}>{subtitle}</Text>
          </View>
        </View>
        <CdnSvg uri={`${CDN}success-story-hand.svg`} width={HAND_SIZE} height={HAND_SIZE} style={s.storyHandImage} />
      </View>
      {/* No cardWidth override — SwiperCard derives it from successStory's own
          slidesPerView: 1.29, same as every other section. */}
      <SwiperCard
        cardVariant={4}
        cardSection="successstory"
        // Angular: getSucessStories() sets jodiihappilyMarried = allStories.slice(0, 5)
        // for [card-contents] and keeps the full list in [card-more-items], so the
        // carousel is 5 cards then the "see all" slide.
        items={stories.slice(0, 5)}
        moreItems={moreItemsFrom(stories, 5)}
        showSeeAll
        // Angular's success-story ion-grid has the in-carousel slide but no
        // "See all" link row under the dots — unlike every other section.
        showSeeAllLink={false}
        onCardPress={onCardPress}
        onSeeAllPress={onSeeAllPress}
      />
    </>
  )
}, propsEqualIgnoringFunctions)

// ─── Self-help Videos ───────────────────────────────────────────────────────────
// Angular: complete-profile.component.html's self-video swiper slide — the
// caption (QUS) is overlaid in white text at the bottom of the background
// image itself (FAQ-banners-position, a bottom scrim), not a separate text
// row below the card; and the play button is the real CDN icon, not a
// CSS-drawn triangle.

export const SelfHelpVideosSection = memo(function SelfHelpVideosSection({
  videos, cardWidth, cardHeight, onVideoPress, onSeeAllPress,
}: { videos: HelpVideo[]; cardWidth: number; cardHeight: number; onVideoPress: (item: HelpVideo) => void; onSeeAllPress: () => void }) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
  return (
    <>
      <Text style={[s.sectionTitle, s.selfVideoSectionTitle, { fontFamily: langFonts.semiBold }]}>{t('HOME.SELF_VIDEO_HEADER')}</Text>
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
                <Text style={[s.videoTitle, { fontFamily: langFonts.regular }]} numberOfLines={2}>{item.title}</Text>
              </View>
            )}
          </Pressable>
        )}
      />
      {/* Angular: complete-profile.component.html's own bottom "See all" row
          (`profileHeaders?.seeAllTxt !== ''` — true for this section, unlike
          Complete-Your-Profile's, which never sets that field) — a plain
          ion-text + static chevron-forward-outline icon, not an
          app-button-revamp (so no animated-GIF override applies here, unlike
          the header "See all" links elsewhere on Home). */}
      <View style={s.selfHelpSeeAllRow}>
        <Pressable style={s.selfHelpSeeAllBtn} onPress={onSeeAllPress}>
          <Text style={[s.selfHelpSeeAllText, { fontFamily: langFonts.medium }]}>{t('HOME.SEE_ALL_CTA')}</Text>
          <SvgXml xml={CHEVRON_FORWARD_BLUE_XML} width={16} height={16} />
        </Pressable>
      </View>
    </>
  )
}, propsEqualIgnoringFunctions)

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
export const HelpSection = memo(function HelpSection({
  onCallPress, phone,
}: { onCallPress: () => void; phone: string }) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
  // Angular: getHelbBannerData() strips a leading '+91' from the customer-care
  // number BEFORE substituting it into the CTA (cutomerCareNO.slice(3)) — the
  // dialled number keeps the prefix, only the label drops it.
  const ctaPhone = phone.includes('+91') ? phone.slice(3) : phone
  // FAQ_DETAILS.BANNER.BANNERBG is `linear-gradient(335deg, #FFEEE7 5.54%,
  // #F5F5F5 93.82%)` and the template binds it via [ngStyle] — but
  // home-banner.component.scss's `.help-banner { background: linear-gradient(
  // to right, rgb(245,245,245), rgb(255,238,231)) !important }` WINS over that
  // inline style (author !important outranks a normal inline declaration). So
  // the banner actually renders grey→peach left-to-right, not the diagonal
  // peach→grey BANNERBG describes.
  return (
    <LinearGradient
      colors={['#F5F5F5', '#FFEEE7']}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={s.helpWrap}
    >
      <View style={s.helpTextCol}>
        <Text style={[s.helpTitle, { fontFamily: langFonts.medium }]}>{t('FAQ_DETAILS.BANNER.TITLE')}</Text>
        <Text style={[s.helpSub, { fontFamily: langFonts.regular }]}>{t('FAQ_DETAILS.BANNER.BODY')}</Text>
        <Pressable style={s.helpCta} onPress={onCallPress}>
          <Text style={[s.helpCtaText, { fontFamily: langFonts.medium }]}>{t('FAQ_DETAILS.BANNER.CTA').replace('#CALL#', ctaPhone).trim()}</Text>
          <SvgXml xml={CHEVRON_FORWARD_BLUE_XML} width={18} height={18} style={s.helpCtaChevron} />
        </Pressable>
      </View>
      <CdnSvg uri={`${CDN}call-24-7.svg`} width={80} height={80} />
    </LinearGradient>
  )
}, propsEqualIgnoringFunctions)

// ─── Individually memoized listing sections (All Matches / Who Viewed Me /
// Today's Matches / Newly Joined / Profiles You Viewed) ───────────────────────
// These 5 sections used to be written directly inline in HomeScreen's return.
// Moved into their own memoized components (same propsEqualIgnoringFunctions
// pattern as the sections above) so that, say, fetchNotifCount resolving and
// updating comCount doesn't force All Matches' or Newly Joined's own
// FlatList-based swiper to re-render along with it — each section now only
// re-renders when the data it actually reads changes. `gating` is threaded
// through purely so onWhatsAppPress (which closes over it) is honored
// correctly by that comparator — see its header comment above.

interface AllMatchesSectionProps {
  loaded: boolean
  items: SwiperItem[]
  total: number
  navigation: any
  gating: ContactGating
  onCardPress: (item: SwiperItem) => void
  onLikePress: (item: SwiperItem) => void
  onWhatsAppPress: (item: SwiperItem) => void
}

const AllMatchesSection = memo(function AllMatchesSection({
  loaded, items, total, navigation, onCardPress, onLikePress, onWhatsAppPress,
}: AllMatchesSectionProps) {
  const { t } = useTranslation()
  return (
    <View style={s.section}>
      {!loaded ? (
        <Loader variant="skeleton-dashboard" />
      ) : items.length > 1 ? (
        <SwiperCard
          swiperHeader={`${t('HOME.ALLMATCH_HEADER')} (${total})`}
          cardVariant={1}
          // Angular: core/enums/home.enum.ts — allMatches maps to the section
          // string 'matches', NOT 'newmatches' (Newly Joined's section) —
          // ProfileCard.tsx's basicDetail() omits the education suffix only
          // for section==='matches'.
          cardSection="matches"
          items={items.slice(0, 5)}
          moreItems={moreItemsFrom(items, 5)}
          showSeeAll
          onCardPress={onCardPress}
          onLikePress={onLikePress}
          onSeeAllPress={() => navigation.navigate('Matches')}
          onWhatsAppPress={onWhatsAppPress}
        />
      ) : null}
    </View>
  )
}, propsEqualIgnoringFunctions)

interface WhoViewedMeSectionProps {
  items: SwiperItem[]
  comCount: ComCountEntry[]
  navigation: any
  gating: ContactGating
  onCardPress: (item: SwiperItem) => void
  onLikePress: (item: SwiperItem) => void
  onWhatsAppPress: (item: SwiperItem) => void
}

// Angular's *ngIf checks swiperViewedYouList.length (the viewedyou listing
// call's own returned/displayed array, capped to 5), not a separate
// total-count field.
const WhoViewedMeSection = memo(function WhoViewedMeSection({
  items, comCount, navigation, onCardPress, onLikePress, onWhatsAppPress,
}: WhoViewedMeSectionProps) {
  const { t } = useTranslation()
  if (items.length <= 3) return null
  return (
    <>
      <View style={s.divider} />
      {/* Angular: .dot-img-bg = background-image: url(who-viewed-bg-color.svg),
          linear-gradient(#FFF1FF → #FFFFFF) — the pattern sits ON TOP of the
          gradient. Bundled locally as a raster — see WHO_VIEWED_BG above. */}
      <LinearGradient colors={['#FFF1FF', '#FFFFFF']}>
        <LocalCoverBackground source={WHO_VIEWED_BG} aspectRatio={WHO_VIEWED_BG_RATIO} style={s.section}>
          <SwiperCard
            swiperHeader={`${applyPluralToken(t, t('HOME.WHO_VIEWED_YOU_HEADER'), comTotalFor(comCount, 'viewedyou'))} (${comTotalFor(comCount, 'viewedyou')})`}
            newCount={comCountFor(comCount, 'viewedyou')}
            cardVariant={3}
            cardSection="viewedyou"
            items={items.slice(0, 5)}
            moreItems={moreItemsFrom(items, 5)}
            showSeeAll
            onCardPress={onCardPress}
            onLikePress={onLikePress}
            // Angular app-swiper.component.ts's onClickSeeAllCTA() case
            // 'viewedyou' → router.navigate(['/activity/viewedyou'], { state:
            // { activityType: 'viewedyou' } }).
            onSeeAllPress={() => navigation.navigate('Activity', { activityType: 'viewedyou' })}
            onWhatsAppPress={onWhatsAppPress}
          />
        </LocalCoverBackground>
      </LinearGradient>
    </>
  )
}, propsEqualIgnoringFunctions)

interface TodayMatchesSectionProps {
  items: SwiperItem[]
  total: number
  navigation: any
  gating: ContactGating
  onCardPress: (item: SwiperItem) => void
  onLikePress: (item: SwiperItem) => void
  onWhatsAppPress: (item: SwiperItem) => void
}

// Angular: *ngIf="swiperDRContents?.length > 0" — unlike All Matches/Newly
// Joined (>1), this section's threshold is just >0.
const TodayMatchesSection = memo(function TodayMatchesSection({
  items, total, navigation, onCardPress, onLikePress, onWhatsAppPress,
}: TodayMatchesSectionProps) {
  const { t } = useTranslation()
  if (items.length === 0) return null
  return (
    <>
      <View style={s.divider} />
      <View style={s.drSection}>
        {/* Angular: home.config.ts's drmatches is the only swiper config with
            coverflowEffect — a centered, tilted-neighbor carousel. */}
        <CoverflowSwiper
          swiperHeader={`${stripAndDecodeHtml(t('DAILYRECOMMENDATIONS.DAILY_RECOMMENDATIONS'))} (${total})`}
          items={items.slice(0, 4)}
          moreItems={moreItemsFrom(items, 4)}
          onCardPress={onCardPress}
          onLikePress={onLikePress}
          // Angular: onClickSeeAllCTA() case 'dailyrecommendations' →
          // router.navigate(['dailyrecommendations'], { queryParams: { frm_page } }).
          onSeeAllPress={() => navigation.navigate('daily-recommendations', { frm_page: 'home' })}
          onWhatsAppPress={onWhatsAppPress}
        />
      </View>
    </>
  )
}, propsEqualIgnoringFunctions)

interface NewlyJoinedSectionProps {
  loaded: boolean
  items: SwiperItem[]
  total: number
  navigation: any
  gating: ContactGating
  onCardPress: (item: SwiperItem) => void
  onLikePress: (item: SwiperItem) => void
  onWhatsAppPress: (item: SwiperItem) => void
}

// Angular: newlyJoinedSection.blockbgColor = 'pink-bg-block'. <app-loader
// *ngIf="!nmContLoaded"> sits on plain white BEFORE the
// *ngIf="nmContLoaded && swiperNewlyMatchContents?.length > 1" wrapper — the
// pink background + divider only exist once there's real data.
const NewlyJoinedSection = memo(function NewlyJoinedSection({
  loaded, items, total, navigation, onCardPress, onLikePress, onWhatsAppPress,
}: NewlyJoinedSectionProps) {
  const { t } = useTranslation()
  if (!loaded) {
    return (
      <View style={s.section}>
        <Loader variant="skeleton-dashboard" />
      </View>
    )
  }
  if (items.length <= 1) return null
  return (
    <>
      <View style={s.divider} />
      <LinearGradient colors={['#FCEBFF', '#FFFFFF']} style={s.section}>
        <SwiperCard
          // toListingResult() falls back to 0 when the response carries no
          // TOTAL — see headerWithCount() for Angular's setHeader() rule.
          swiperHeader={headerWithCount(t('HOME.NEWLY_JOINED_HEADER'), total)}
          cardVariant={1}
          cardSection="newmatches"
          items={items.slice(0, 4)}
          moreItems={moreItemsFrom(items, 4)}
          showSeeAll
          onCardPress={onCardPress}
          onLikePress={onLikePress}
          // Angular: onClickSeeAllCTA() case 'newmatches' → NEWMATCHESLANDING='1'
          // then router.navigate(['/matches/bynewlyjoined']) — matches.page.ts's
          // urlExploreObj maps route name 'bynewlyjoined' to FILTERTYPE
          // 'NEYLYJOINED' (backend typo, preserved) before it reaches the API.
          onSeeAllPress={() => navigation.navigate('Matches', {
            exploreType: 'NEYLYJOINED',
            exploreLabel: t('HOME.NEWLY_JOINED_HEADER'),
          })}
          onWhatsAppPress={onWhatsAppPress}
        />
      </LinearGradient>
    </>
  )
}, propsEqualIgnoringFunctions)

interface ProfilesViewedSectionProps {
  items: SwiperItem[]
  comCount: ComCountEntry[]
  navigation: any
  gating: ContactGating
  onCardPress: (item: SwiperItem) => void
  onLikePress: (item: SwiperItem) => void
  onWhatsAppPress: (item: SwiperItem) => void
}

const ProfilesViewedSection = memo(function ProfilesViewedSection({
  items, comCount, navigation, onCardPress, onLikePress, onWhatsAppPress,
}: ProfilesViewedSectionProps) {
  const { t } = useTranslation()
  if (items.length === 0) return null
  return (
    <>
      <View style={s.divider} />
      <View style={s.section}>
        <SwiperCard
          // Angular: home.enum.ts's sectionTitle.viewedbyme = 'GENERAL.VIEWEDBYME'
          // ("Profiles you viewed").
          swiperHeader={headerWithCount(t('GENERAL.VIEWEDBYME'), comTotalFor(comCount, 'viewedbyme'))}
          newCount={comCountFor(comCount, 'viewedbyme')}
          cardVariant={3}
          cardSection="viewedbyme"
          items={items.slice(0, 5)}
          moreItems={moreItemsFrom(items, 5)}
          showSeeAll
          onCardPress={onCardPress}
          onLikePress={onLikePress}
          // Angular: onClickSeeAllCTA() case 'viewedbyme' → /activity/viewedbyme
          // with state { activityType: 'viewedbyme', selectedSubTab: 'viewedbyme' }.
          onSeeAllPress={() => navigation.navigate('Activity', { activityType: 'viewedbyme', selectedSubTab: 'viewedbyme' })}
          onWhatsAppPress={onWhatsAppPress}
        />
      </View>
    </>
  )
}, propsEqualIgnoringFunctions)

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: { navigation: any }) {
  const isDesktop = useIsDesktopWeb()
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation()
  const langFonts = useLanguageFonts()

  // ── WhatsApp "no photo" CTA (All Matches / New Matches / etc. cards) ──────
  // Angular: matches-card.component's handleWhatsApp() — same confirm →
  // communicationBtnOnClick → result dispatch every other screen with a
  // Call/WhatsApp button already uses (ActivityScreen.tsx/MatchesScreen.tsx).
  const gating = useContactGating()
  const phoneInfo = usePhoneInfoSheet()
  // Web/PWA "Add photo" CTAs — see hooks/useAddPhotoPicker.ts for why this can't
  // just navigate to the native-only 'Gallery' screen. onUploaded refreshes
  // completion%/banners the same way loadHome's other callers do — safe to
  // reference loadHome here even though it's declared further down: this
  // callback only ever runs after a full render (and loadHome's own
  // initialization) has completed.
  const addPhoto = useAddPhotoPicker({
    onUploaded: () => loadHome({ cancelled: false }, false),
    onRejected: (msg) => Alert.alert('Some photos were not added', msg),
    onError: (msg) => Alert.alert('Error', msg),
  })
  const [contactConfirm, setContactConfirm] = useState<{ item: SwiperItem; action: 'whatsappNudge'; fromPage: string } | null>(null)
  const [contactDetails, setContactDetails] = useState<{
    name: string; mobile?: string | undefined; dialNumber?: string | undefined; whatsappNumber?: string | undefined
    showCounter?: boolean | undefined; viewedCount?: string | undefined; totalCount?: string | undefined
    idVerified?: boolean | undefined
  } | null>(null)
  const [whatsappPaywallItem, setWhatsappPaywallItem] = useState<SwiperItem | null>(null)
  // The WhatsApp photo-request paywall sheet (BottomSheet 'whatsAppPhotoRequest').
  const [waPhotoRequest, setWaPhotoRequest] = useState<{ item: SwiperItem; fromPage: string } | null>(null)

  const [likedTab, setLikedTab] = useState<LikedTab>('likedbyme')
  const [categories, setCategories] = useState<ExploreCategory[]>([])

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
  // The persistent tab bar (MainTabs.tsx) renders AppFooter now, not this
  // screen — publish these into the shared context instead of local state.
  const {
    setUpgradeTag, dismissMembershipDotForSession,
    setLikesCount, setExploreCount,
  } = useFooterBadges()

  // ── Hero banner / assist banner (mutually exclusive top slot) ─────────────
  const [heroBannerVariant, setHeroBannerVariant]   = useState<HeroBannerVariant>(null)
  const [heroBannerContent, setHeroBannerContent]   = useState<HeroBannerContent | null>(null)
  const [assistContent, setAssistContent]           = useState<AssistBannerContent | null>(null)
  const [assistDismissed, setAssistDismissed]       = useState(false)
  const [paymentFailedDismissed, setPaymentFailedDismissed] = useState(false)

  // ── Sticky banners (pinned above footer) — Angular's Home screen renders
  // TWO genuinely independent <app-payment-stickey> elements here, each with
  // its own *ngIf and its own close handling (explore.component.html:198-205):
  // one for force-update (*ngIf="contentLoaded && APPFORCEUPDATE.SHOWFLAG=='1'",
  // no scroll-gating), and a separate one for the profile-validation/autopay/
  // photo-promo "nudge" (*ngIf="showStickyBanner && hideNotch && ..."). They
  // can render simultaneously and dismissing one never affects the other —
  // matched below with two independent dismiss states instead of one shared
  // slot/priority chain.
  const [forceUpdateInfo, setForceUpdateInfo]           = useState<ForceUpdateInfo | null>(null)
  const [forceUpdateDismissed, setForceUpdateDismissed] = useState(false)
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
  // Angular: logScrollEnd()'s `hideNotch` — the sticky banner is HIDDEN by
  // default (hideNotch starts false) and only appears once the user has
  // scrolled down past the hero banner/header (hideNotch → true), hiding
  // again immediately on any upward scroll (explore.component.ts:730-745,
  // explore.component.html:198-199's `*ngIf="... && hideNotch"`). RN has no
  // overlaid/translucent header to recolor the way Angular's does, so only
  // this show/hide half of that behavior applies.
  const [showStickyOnScroll, setShowStickyOnScroll] = useState(false)
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
  const [allMatches, setAllMatches]           = useState<SwiperItem[]>([])
  const [allMatchesTotal, setAllMatchesTotal] = useState(0)
  // No viewedMeTotal state — the section's visibility gate reads viewedMe's own
  // array length (matching Angular's swiperViewedYouList.length check exactly),
  // and its header count comes from comTotalFor(comCount, 'viewedyou') instead.
  const [viewedMe, setViewedMe]               = useState<SwiperItem[]>([])
  const [todayMatches, setTodayMatches]       = useState<SwiperItem[]>([])
  const [todayTotal, setTodayTotal]           = useState(0)
  const [newlyJoined, setNewlyJoined]         = useState<SwiperItem[]>([])
  const [newlyJoinedTotal, setNewlyJoinedTotal] = useState(0)
  // No profilesViewedTotal state — Angular sources this section's header
  // count from comTotalFor(comCount, 'viewedbyme') exclusively (see that
  // function's header comment), not from this listing's own response.
  const [profilesViewed, setProfilesViewed]   = useState<SwiperItem[]>([])
  // No likedByMeTotal state — the section's visibility gate reads likedByMe's/
  // likedMe's own array lengths (matching Angular's likedByMeProfiles.length /
  // likedYouProfiles.length check exactly), and header counts come from
  // comTotalFor(comCount, ...) instead.
  const [likedByMe, setLikedByMe]             = useState<SwiperItem[]>([])
  const [likedMe, setLikedMe]                 = useState<SwiperItem[]>([])
  const [likedMeTotal, setLikedMeTotal]       = useState(0)
  // Was passed straight into a locally-rendered <AppFooter likesCount=.../> —
  // the persistent tab bar reads it from FooterBadgesContext instead now.
  useEffect(() => { setLikesCount(likedMeTotal) }, [likedMeTotal, setLikesCount])
  const [stories, setStories]                 = useState<SwiperItem[]>([])
  const [videos, setVideos]                   = useState<HelpVideo[]>([])
  const [customerCare, setCustomerCare]       = useState({ phone: '', whatsapp: '' })

  // Angular: ngOnInit()/ionViewDidEnter() — loadHome() is the RN equivalent of
  // BOTH combined. Called on every focus (useFocusEffect below); `includePopups`
  // gates the truly one-time-per-mount bits (screen-view analytics, the
  // once-per-install first-land ping) so they don't refire every time the user
  // tabs back to Home.
  const loadHome = useCallback(async (ctrl: { cancelled: boolean }, includePopups: boolean) => {
    // Angular's RN port convention (MatchesScreen.tsx's loadMatches() step 1):
    // every screen that fires listing API calls must refreshSession() first to
    // guarantee a valid/upgraded ATN — this was missing here, and its absence
    // is why every single Home listing call was failing with ERRCODE 23
    // ("Token expired") uniformly, all at once, regardless of endpoint.
    await refreshSession()
    if (ctrl.cancelled) return

    // Angular: common-funtions.ts's whatsAppPhotoFlag() — server-driven
    // eligibility for the WhatsApp photo-request nudge, copied verbatim from
    // the login response (see registrationService.ts's storeWebURLData). Read
    // once per load and applied to every listing section below.
    const waPhotoFlag = String((await getSessionValue('WAPHOTOFLAG')) ?? '0')
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
      // Angular: explore.component.ts's getSelfHelpVideos() is only ever
      // called for non-English UI (explore.component.html:181's *ngIf="lang
      // !== 'en'" gates the section, and the fetch itself is skipped
      // entirely for English rather than fetched-but-hidden) — was
      // previously firing unconditionally on every load regardless of
      // language, wasting the call for English users.
      if (session.lang !== 'en') {
        fetchFaqVideos().then(result => {
          if (!ctrl.cancelled && result.length > 0) setVideos(result)
        })
      }
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
        // Angular: home-banner.component.html's paymentFailedPromotion grid is
        // itself gated on `heroBannerData?.PAGETYPE != '0'` — PAGETYPE=='0'
        // renders nothing at all, previously unchecked here.
        if (text && cta && String(failedBanner?.['PAGETYPE'] ?? '') !== '0') {
          const startMs = Date.parse(failedBanner?.['OFFSTTIME'] ?? '')
          const endMs   = Date.parse(failedBanner?.['OFFEDTIME'] ?? '')
          const deadlineMs = !Number.isNaN(startMs) && !Number.isNaN(endMs)
            ? Date.now() + Math.max(0, endMs - startMs)
            : Date.now() + 10 * 60 * 1000
          paymentFailedContent = {
            bannerStyle: 'paymentFailed',
            title: '', body: String(text), ctaLabel: String(cta), countdownDeadlineMs: deadlineMs,
            // Angular: .payment-failed-banner — a rounded, bordered, inset
            // card (mt-24 ml-24 mr-24), not the full-bleed banner every other
            // variant uses; text is black-color, not white.
            insetCard:   true,
            bgColor:     '#FCEAF0',
            borderColor: '#F5BDD0',
            textColor:   Colors.black,
            // Angular: [background]="heroBannerData?.CTABGCOLOR" — previously
            // unread here, so the CTA always fell back to HeroBanner's plain
            // white default instead of the server-driven color.
            ctaBgColor: String(failedBanner?.['CTABGCOLOR'] ?? '').startsWith('#') ? failedBanner['CTABGCOLOR'] : Colors.primaryDark,
            ctaColor:   Colors.white,
          }
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
          bannerStyle: 'photoPromo',
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
        const hex = (v: any): string | undefined =>
          typeof v === 'string' && /^(#|rgb|hsl|transparent$)/i.test(v.trim()) && !/gradient/i.test(v)
            ? v.trim()
            : undefined
        const ownTimerDeadline = isOldBanner && details?.['TIMER'] ? Date.parse(details['TIMER']) : NaN
        // Angular's [attr.style]="'background: ' + heroBannerData?.BANNERBG"
        // binds this field straight into a raw CSS `background` — the CMS can
        // (and does) send either a plain color OR a full `linear-gradient(...)`
        // string here, not just solid colors. `hex()` above only covers the
        // solid case; a gradient string used to be silently dropped entirely
        // (matched neither `hex()` nor the untouched fallback-gradient branch),
        // which left the banner showing HeroBanner's hardcoded navy default
        // instead of the campaign color the API actually sent.
        const parsedBg = parseCssBackground(isOldBanner ? details?.['BANNERBG'] : details?.['BRIDEBGCOLOR'])
        const bgColor      = parsedBg && 'solid' in parsedBg ? parsedBg.solid : undefined
        const apiGradient  = parsedBg && 'gradient' in parsedBg ? parsedBg.gradient : undefined
        const hasOwnBg     = !!parsedBg
        setHeroBannerContent({
          bannerStyle: isOldBanner ? 'old' : 'bride',
          title:      details?.['TITLE'] || 'Upgrade your membership',
          title1:     isOldBanner ? (details?.['TITLE1'] || undefined) : undefined,
          title2:     isOldBanner ? (details?.['TITLE2'] || undefined) : undefined,
          body:       details?.['BODY']  || '',
          validText:  !isOldBanner ? (details?.['VALID'] || undefined) : undefined,
          ctaLabel:   details?.['CTA']   || 'Upgrade now',
          imageUrl:   isOldBanner ? details?.['BANNERIMG'] : details?.['BRIDEIMG'],
          bgColor,
          // DEFAULT_HERO_GRADIENT (see its own comment above) — a server-sent
          // gradient (apiGradient) takes precedence over this fallback, same
          // as a server-sent solid bgColor already did.
          gradient:          apiGradient ? apiGradient.colors    : (hasOwnBg ? undefined : DEFAULT_HERO_GRADIENT.colors),
          gradientLocations: apiGradient ? apiGradient.locations : (hasOwnBg ? undefined : DEFAULT_HERO_GRADIENT.locations),
          gradientStart:     apiGradient?.start ?? (hasOwnBg ? undefined : DEFAULT_HERO_GRADIENT.start),
          gradientEnd:       apiGradient?.end   ?? (hasOwnBg ? undefined : DEFAULT_HERO_GRADIENT.end),
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
          titleColor:  hex(details?.['TITLECOLOR']) ?? (hasOwnBg ? undefined : Colors.link),
          bodyColor:   hex(details?.['CONTENTCOLOR']) ?? (hasOwnBg ? undefined : Colors.link),
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
      const menuPromo = await getMenuPromo()
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
      // The red dot itself is no longer computed here. Angular's footer owns it
      // (it loads ppSetData/getMenuPromo for itself), and having only Home set it
      // meant it never appeared for a session that started on Matches — so that
      // derivation now lives in FooterBadgesContext. `membershipExpiry` is still
      // read above for the tag's own conditions.
      void membershipExpiry

      // ── Force-update sticky — Angular populates updatePopupContent.APPFORCEUPDATE
      // independently of checkProfileStatus() below (explore.component.ts:553),
      // suppressed only by the free-female photo-promo variant, never by
      // whether a profile-validation/autopay nudge also applies.
      // Was reading Constants.expoConfig?.version (app.json's "1.0.0" Expo
      // scaffolding default, a separate native-build identifier never meant
      // to track this) instead of the app's own real version — with any
      // APPFORCEUPDATE.APPVERSION starting '2'-'9', "1.0.0" < that string
      // lexicographically, so this fired almost unconditionally.
      const psUpdateFlag = await getItem('PLAYSTOREUPDATE')
      const forceUpdate = computeForceUpdateInfo(data?.['APPFORCEUPDATE'], psUpdateFlag, APP_VERSION, isFreeFemalePhotoPromo)
      if (ctrl.cancelled) return
      setForceUpdateInfo(forceUpdate)

      // ── Profile-validation / autopay nudge — Angular's checkProfileStatus()
      // (which alone decides between these two) is called ONLY from
      // getPPSETData()'s final `else` branch (explore.component.ts:537-540):
      // i.e. only when none of the payment-failed / photo-promo hero-banner
      // variants matched — not gated on force-update at all, so this can
      // render at the same time as the force-update sticky above.
      if (variant === 'default') {
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
      } else {
        setProfileValidationBanner(null)
        setAutopaySticky(null)
      }
    })

    // These 8 listing calls used to all fire in parallel the instant focus
    // fired. Firing that many requests at once means every one of them
    // competes for the same limited mobile-network pipe simultaneously
    // (bandwidth/connection-slot contention can make EACH one slower than if
    // they weren't all fighting for it at once), and does nothing to
    // prioritize whichever section the user actually scrolls to first.
    // Chained sequentially instead, in the same top-to-bottom order the
    // sections appear on screen (fetchNotifCount is pulled forward, just
    // after All Matches, since its comCount result feeds 3 of the section
    // headers below it — Who Viewed Me/Profiles You Viewed/Liked Profiles —
    // rather than owning a section position of its own). A section now
    // genuinely finishes (and renders) before the ones below it start
    // loading, instead of everything arriving in an unpredictable burst —
    // and if the user navigates away partway through, the remaining
    // not-yet-started fetches in the chain never fire at all (ctrl.cancelled
    // short-circuits it), where the old all-at-once version had already put
    // every one of them on the wire.
    // Not using InteractionManager.runAfterInteractions to also defer the
    // start of this chain past the tab-switch transition: in this RN version
    // (0.86, new architecture) it's a no-op compatibility stub that no longer
    // tracks real touches/animations at all (createInteractionHandle() is a
    // hardcoded no-op) — it would only add one setImmediate tick for no real
    // benefit, so this starts immediately instead.
    ;(async () => {
      if (ctrl.cancelled) return
      const allMatchesResult = await fetchHomeAllMatches()
      if (ctrl.cancelled) return
      if (allMatchesResult.items.length > 0) {
        setAllMatches(applyWhatsAppPhotoRequestFlags(allMatchesResult.items, waPhotoFlag))
        setAllMatchesTotal(allMatchesResult.totalCount)
      }
      setAllMatchesLoaded(true)

      const notifResult = await fetchNotifCount()
      if (ctrl.cancelled) return
      setComCount(notifResult.comCount)
      // Footer Home bubble — Angular recomputes it inside getNotificationCount(),
      // so every screen that refreshes the counts refreshes the badge too.
      deriveExploreCount(notifResult.comCount)
        .then(n => { if (!ctrl.cancelled) setExploreCount(n) })
        .catch(() => {})

      const viewedYouResult = await fetchViewedYou()
      if (ctrl.cancelled) return
      if (viewedYouResult.items.length > 0) {
        setViewedMe(applyWhatsAppPhotoRequestFlags(viewedYouResult.items, waPhotoFlag))
      }

      const dailyRecResult = await fetchDailyRec()
      if (ctrl.cancelled) return
      if (dailyRecResult.items.length > 0) {
        // Full array kept in state (not sliced here) — display and the
        // "view more" card's thumbnail preview each slice it separately below.
        setTodayMatches(applyWhatsAppPhotoRequestFlags(dailyRecResult.items, waPhotoFlag))
        // Angular: explore.component.ts's setDRProfiles() — drTotalCount =
        // resultData.length, the count of items THIS call actually returned
        // (capped by the API's own LIMIT=15 param above), not a separate
        // server-side total field. result.totalCount here reads TOTAL/
        // TOTALCOUNT off the response, which on this endpoint is an unrelated
        // large number (a different total, not today's recommendation count) —
        // that's what was showing e.g. "977" instead of the real "15".
        setTodayTotal(dailyRecResult.items.length)
      }

      const newlyJoinedResult = await fetchNewlyJoined()
      if (ctrl.cancelled) return
      if (newlyJoinedResult.items.length > 0) {
        setNewlyJoined(applyWhatsAppPhotoRequestFlags(newlyJoinedResult.items, waPhotoFlag))
        setNewlyJoinedTotal(newlyJoinedResult.totalCount)
      }
      setNewlyJoinedLoaded(true)

      const viewedByMeResult = await fetchViewedByMe()
      if (ctrl.cancelled) return
      if (viewedByMeResult.items.length > 0) {
        setProfilesViewed(applyWhatsAppPhotoRequestFlags(viewedByMeResult.items, waPhotoFlag))
      }

      // Fetched together (rather than two independent awaits) so the
      // default-tab decision (Angular's "singlelikedlist" behavior) sees both
      // real totals at once — computing it off either promise alone would
      // race against whichever of the two resolves first.
      const [likedByMeResult, likedYouResult, loginGender] = await Promise.all([
        fetchLikedByMe(), fetchLikedYou(), getItem(StorageKeys.User.LOGIN_GENDER),
      ])
      if (ctrl.cancelled) return
      if (likedByMeResult.items.length > 0) {
        setLikedByMe(applyWhatsAppPhotoRequestFlags(likedByMeResult.items, waPhotoFlag))
      }
      if (likedYouResult.items.length > 0) {
        setLikedMe(applyWhatsAppPhotoRequestFlags(likedYouResult.items, waPhotoFlag))
        setLikedMeTotal(likedYouResult.totalCount)
      }
      setLikedTab(computeDefaultLikedTab(loginGender === 'M' ? 'M' : 'F', likedYouResult.totalCount, likedByMeResult.totalCount))

      const storiesResult = await fetchSuccessStories()
      if (ctrl.cancelled) return
      if (storiesResult.length > 1) setStories(storiesResult)

      const customerCareResult = await fetchCustomerCare()
      if (ctrl.cancelled) return
      if (customerCareResult.phone || customerCareResult.whatsapp) setCustomerCare(customerCareResult)
    })()
  }, [assistDismissed, paymentFailedDismissed])

  // Angular: ionViewDidEnter() — re-runs every time Home regains focus (tab
  // switch, back-navigation), not just on first mount. `isFirstFocusRef` mirrors
  // ngOnInit-vs-ionViewDidEnter: the first focus gets includePopups=true (fires
  // once-per-mount analytics/tracking), every later focus gets false.
  const isFirstFocusRef = useRef(true)
  useFocusEffect(
    useCallback(() => {
      const ctrl = { cancelled: false }
      const includePopups = isFirstFocusRef.current
      isFirstFocusRef.current = false
      loadHome(ctrl, includePopups)
      return () => { ctrl.cancelled = true }
    }, [loadHome])
  )

  // DailyRecommendationScreen.tsx (the full-screen swipe stack, a separate
  // fetch from this section's own todayMatches) tells Home the instant a
  // card is swiped away there, so it disappears from THIS list right away
  // instead of waiting on the next loadHome() refetch — see eventBus.ts's
  // own comment on emitDrProfileRemoved for why the refetch alone wasn't
  // reliable enough (Home stays mounted underneath, and loadHome() only
  // applies a fresh result when it comes back non-empty).
  useEffect(() => {
    return subscribeDrProfileRemoved(profileId => {
      setTodayMatches(prev => prev.filter(p => p.profileId !== profileId))
    })
  }, [])

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

  const hasPaidBadge = computeHasPaidBadge(
    entryType, payRenewalFlag,
    isPaidVerifiedNoPhotoMale(entryType, ekycStatus, gender, ppSetData?.['PI_PHOTOSTATUS'] ?? 'N'),
  )

  const toolbar = buildToolbar(comCount)
  const selfHelpVisible = computeSelfHelpVideosVisible(lang)

  // ── Navigation / action handlers ───────────────────────────────────────────

  // The mobile bottom AppFooter is gone from this screen (MainTabs.tsx's
  // persistent tab bar owns tab-switch taps now) — this only still exists to
  // feed HomeDesktopLayout's MatchesDesktopNav (the desktop-web top nav,
  // which is its own separate, still-per-screen component, not AppFooter).
  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 4: navigation.navigate('MessagerList'); break
      // Angular: footer.component.ts:165 — showRedDot flips false for the
      // rest of the session the moment the membership tab is tapped, before
      // paymentTrack(31)/routing even happens below.
      case 3:
        dismissMembershipDotForSession()
        openMembershipTab()
        break
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
        addPhoto.openAddPhoto(navigation)
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

  // ── Sticky banners (force-update is its own independent slot; photo-promo
  // nudge / autopay / profile-validation share a second slot — see the state
  // declarations above for why these are split instead of one priority chain).
  const showForceUpdate = !!forceUpdateInfo && !forceUpdateDismissed
  const activeSticky: 'photoPromo' | 'autopay' | 'profileValidation' | null =
    stickyDismissed ? null
    : photoPromoSticky ? 'photoPromo'
    : autopaySticky ? 'autopay'
    : profileValidationBanner ? 'profileValidation'
    : null

  function handleForceUpdatePress() {
    const url = String(Constants.expoConfig?.extra?.['playStoreUrl'] ?? 'https://play.google.com/store/apps/details?id=jodii.app')
    Linking.openURL(url)
  }

  function handleForceUpdateClose() {
    setItem('PLAYSTOREUPDATE', '2')   // Angular: "show again next login"
    setForceUpdateDismissed(true)
  }

  function handleStickyPress() {
    if (activeSticky === 'photoPromo') {
      if (photoPromoSticky?.type === 'ADDPHOTO') {
        addPhoto.openAddPhoto(navigation)
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
    setStickyDismissed(true)
  }

  // Angular: logScrollEnd(ev) — the sticky is hidden until the user scrolls
  // down past the hero banner/header (offsetHeight, falling back to 80 for
  // free-entry-type users / 104 otherwise per explore.component.ts:740), then
  // hides again the instant they scroll up at all.
  function handleScroll(e: any) {
    const y = e.nativeEvent.contentOffset.y
    const delta = y - scrollYRef.current
    if (Math.abs(delta) < 10) return
    scrollYRef.current = y
    const offsetHeight = entryType === 'F' ? 80 : 104
    if (y > offsetHeight && delta > 0) setShowStickyOnScroll(true)
    else if (delta < 0) setShowStickyOnScroll(false)
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

  // Angular: matches-card.component's WhatsApp photo-request overlay (see
  // ProfilePhoto.tsx) — fromPage varies per section, matching goToProfile's
  // own per-section fromPage argument below.
  async function confirmThenWhatsApp(item: SwiperItem, fromPage: string) {
    if (!item.profileId) return
    // Angular communication.service.ts:181-186 — the paid verify-id / add-photo
    // gates run BEFORE showContactDetails() (PHONENOLIMIT + confirm), so an
    // unverified paid male gets the verify-profile sheet straight away.
    if (await checkPaidBlockerGate()) {
      handleContactConfirmYes({ item, action: 'whatsappNudge', fromPage })
      return
    }
    // Angular communication.service.ts's showContactDetails() FIRST check — a
    // paid user whose mutual-like AND overall phone-view quotas are both
    // exhausted sees the PHONENOLIMIT sheet instead of the confirm popup.
    if (shouldShowPhoneNoLimit(item.phoneViewed ?? '', item.likedStatus ?? '0', gating.indNumbersLeft, gating.contactQuota.left, gating.ownEntryType)) {
      phoneInfo.handleResult({ type: 'female_free', action: 'femaleFree-LimitOver', profile: item }).catch(() => {})
      return
    }
    // Angular: a free member who's never viewed this profile's number goes
    // straight to paymentPromoPopUp(), no confirm step first — see
    // ActivityScreen.tsx's confirmThenContact for the same fix.
    const alreadyViewed = ['1', '3'].includes(String(item.phoneViewed ?? '0'))
    if (gating.ownEntryType !== 'P' && !alreadyViewed) {
      handleContactConfirmYes({ item, action: 'whatsappNudge', fromPage })
      return
    }
    if (shouldSkipPhoneConfirm(item.phoneViewed ?? '', item.likedStatus ?? '0', gating.indNumbersLeft, gating.ownEntryType, item.phoneProtected)) {
      handleContactConfirmYes({ item, action: 'whatsappNudge', fromPage })
    } else {
      setContactConfirm({ item, action: 'whatsappNudge', fromPage })
    }
  }

  function getContactConfirmContent(): string {
    if (!contactConfirm) return ''
    return getSharedContactConfirmContent(t, gating.oppGender, gating.contactQuota)
  }

  function handleContactConfirmClose() {
    setContactConfirm(null)
  }

  async function handleContactConfirmYes(override?: { item: SwiperItem; action: 'whatsappNudge'; fromPage: string }) {
    const pending = override ?? contactConfirm
    if (!pending) return
    const { item, fromPage } = pending
    setContactConfirm(null)
    try {
      const result = await communicationBtnOnClick(fromPage, 'whatsappNudge', { MATRIID: item.profileId })
      if (result.type === 'show_contact') {
        setContactDetails({
          name: item.name ?? '', mobile: result.mobile, dialNumber: result.dialNumber, whatsappNumber: result.whatsappNumber,
          showCounter: result.showCounter, viewedCount: result.viewedCount, totalCount: result.totalCount,
          idVerified: item.isIdVerified,
        })
      } else if (result.type === 'payment_promo') {
        // Angular communication.service.ts's whatsappNudge branch: a free
        // member on a card showing the WhatsApp photo-request overlay (no
        // photo, or a hidden one — showReqPhotoElement, see homeGating.ts)
        // gets the whatsAppPhotoRequestPayment sheet, not the generic promo.
        if (item.showReqPhotoElement) setWaPhotoRequest({ item, fromPage })
        else setWhatsappPaywallItem(item)
      } else if (result.type === 'error') {
        Alert.alert('', result.message)
      } else {
        await phoneInfo.handleResult(result)
      }
    } catch { /* silent — matches this app's established convention */ }
  }

  // Hidden photo → the partner's blurred THUMBIMG + "has hidden" copy;
  // no photo → the placeholder (see whatsAppPhotoRequestSheet()).
  const waPhotoSheet = useMemo(() => whatsAppPhotoRequestSheet(
    t,
    gating.oppGender,
    !!waPhotoRequest?.item.isPhotoAvailable,
    waPhotoRequest?.item.thumbImg ?? waPhotoRequest?.item.profileImg,
  ), [waPhotoRequest, gating.oppGender, t])
  const waPhotoRequestData = waPhotoRequest ? waPhotoSheet.data : undefined
  const waPhotoTracking    = waPhotoSheet.tracking

  // Angular showWhatsAppPhotoRequestPaymentPopup(): the open beacon fires as
  // the sheet is created.
  useEffect(() => {
    if (waPhotoRequest) paymentTrack(waPhotoTracking.open).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waPhotoRequest])

  // Angular onDidDismiss 'upgradeNow': pay beacon, then
  // redirectToIntermediatePage(this.router.url, '', '7', true).
  function handleWaPhotoRequestPayNow() {
    const fromPage = waPhotoRequest?.fromPage ?? 'home'
    setWaPhotoRequest(null)
    paymentTrack(waPhotoTracking.pay).catch(() => {})
    redirectToIntermediatePage(fromPage, '', '7').catch(() => {})
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
  // edit screen. StarRaasiScreen moved from page '29' to '33' when the
  // horoscope generation flow (pages 29/30/31) was added — '29' is now
  // GenerateHoroscopeScreen.
  async function handleCompleteProfileCard(card: CompleteProfileCard) {
    switch (card.type) {
      case 'PHOTO':       addPhoto.openAddPhoto(navigation); break
      case 'STAR_RAASI':  navigation.navigate('onboarding', { pageNo: '33', standalone: true }); break
      case 'PROPERTY':
      case 'VEHICLE':     navigation.navigate('onboarding', { pageNo: '28', standalone: true }); break
      case 'FAMILY':      navigation.navigate('onboarding', { pageNo: '27', standalone: true }); break
      case 'DIET':        navigation.navigate('onboarding', { pageNo: '38', standalone: true }); break
      case 'HOMETOWN':    navigation.navigate('onboarding', { pageNo: '44', standalone: true }); break
      case 'HOROSCOPE':   navigation.navigate('onboarding', { pageNo: '29', standalone: true }); break
      case 'IDVERIFY': {
        // Angular: complete-profile.component.ts:124-135's IDVERIFY case —
        // navigates to /verify-id ONLY for a non-ID-verified paid male
        // (isNonIdVerifyUser()); under the legacy female free-3-contact promo
        // it shows a different popup instead (not built here — narrow/legacy
        // segment); otherwise the tap is a no-op in the real app too.
        const paidFlag = await getItem(StorageKeys.Payment.PAY_P_FLAG)
        if (isNonIdVerifiedPaidMale(entryType, gender, ekycStatus, paidFlag ?? '')) {
          navigation.navigate('verify-id')
        }
        break
      }
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
      <>
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
        // it can't show. forceUpdate is its own independent slot (see the
        // mobile render below), so it's merged back in here for desktop only.
        activeSticky={showForceUpdate ? 'forceUpdate' : activeSticky === 'profileValidation' ? 'profileValidation' : null}
        stickyText={showForceUpdate ? t('APP_UPDATE.NOTE') : profileValidationBanner?.stickyContent ?? ''}
        stickyCtaLabel={showForceUpdate ? t('APP_UPDATE.CTA') : profileValidationBanner?.bottomCtaLabel ?? ''}
        onStickyPress={showForceUpdate ? handleForceUpdatePress : handleStickyPress}
        onStickyClose={showForceUpdate ? handleForceUpdateClose : handleStickyClose}
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
        oppGender={gating.oppGender}
        categories={categories}
        stories={stories}
        videos={videos}
        selfHelpVisible={selfHelpVisible}
        customerCare={customerCare}
        onCardPress={item => goToProfile(item, allMatches, 'home')}
        onTabPress={handleTabPress}
      />
      <WebPhotoInput inputRef={addPhoto.webInputRef} onChange={addPhoto.handleWebFiles} />
      <AddPhotoVerdictSheets addPhoto={addPhoto} />
      </>
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
        // Angular: header.component.html:52,77 — the avatar AND the "Edit
        // Profile" link both call the identical reDirectPage('/edit-profile')
        // — one single destination, not two different screens.
        onAvatarPress={() => navigation.navigate('EditProfile')}
        onEditProfilePress={() => navigation.navigate('EditProfile')}
        onToolbarItemPress={handleToolbarPress}
      />

      {/* Angular: ionViewDidEnter() re-runs loadHome() on every focus, same as
          this screen's own useFocusEffect — header/footer never disappeared
          in Angular either, and (deliberate deviation from Angular here) the
          scrollable body doesn't either: Angular gates this entire body
          behind a single contentLoaded flag (a full-page spinner until
          session+PPSET data resolves), which meant nothing was visible or
          scrollable for the whole first network round-trip on every focus.
          Removed that gate — the ScrollView mounts immediately and each
          section below fills in independently as its own fetch resolves
          (All Matches/Newly Joined already show their own skeleton-dashboard
          Loader via allMatchesLoaded/newlyJoinedLoaded; the rest simply
          render once their own data/length check passes, same as Angular's
          per-section conditionals). */}
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
        <AllMatchesSection
          loaded={allMatchesLoaded}
          items={allMatches}
          total={allMatchesTotal}
          navigation={navigation}
          gating={gating}
          onCardPress={item => goToProfile(item, allMatches, 'home_matches')}
          onLikePress={likeAllMatches}
          onWhatsAppPress={item => confirmThenWhatsApp(item, 'home_matches')}
        />

        {/* ════════════ PROFILES WHO VIEWED ME ════════════
            Angular: profilesWhoviewedYouSection.blockbgColor = 'dot-img-bg' —
            a decorative background SVG plus a light pink-to-white gradient,
            not the plain white every other (non-special-cased) section uses.
            Angular wraps this section in its own explore-border-top div — the
            divider above it is gated on THIS section's own visibility, not on
            whatever happens to render above it. */}
        <WhoViewedMeSection
          items={viewedMe}
          comCount={comCount}
          navigation={navigation}
          gating={gating}
          onCardPress={item => goToProfile(item, viewedMe, 'home_viewedyou')}
          onLikePress={likeViewedMe}
          onWhatsAppPress={item => confirmThenWhatsApp(item, 'home_viewedyou')}
        />

        {/* ════════════ COMPLETE YOUR PROFILE ════════════ */}
        {completeCards.length > 0 && (
          <>
            <View style={s.divider} />
            <View style={[s.section, s.cpSection]}>
              {/* Angular: complete-profile.component.html's header text is
                  .color-1f1e1b, not the generic textPrimary black every other
                  section header here uses. */}
              <Text style={[s.sectionTitle, s.cpSectionTitle, { fontFamily: langFonts.semiBold }]}>{t('HOME.COMPLETE_PROFILE_HEADER')}</Text>
              <CompleteProfileSection cards={completeCards} onCardPress={handleCompleteProfileCard} />
            </View>
          </>
        )}

        {/* ════════════ TODAY'S MATCHES (Daily Recommendation) ════════════
            Angular: *ngIf="swiperDRContents?.length > 0" — unlike All Matches/
            Newly Joined (>1), this section's threshold is just >0. Missing
            this gate left a stray empty section + divider gap when there's no
            daily-rec data. */}
        <TodayMatchesSection
          items={todayMatches}
          total={todayTotal}
          navigation={navigation}
          gating={gating}
          onCardPress={item => goToProfile(item, todayMatches, 'home_dailyrec')}
          onLikePress={likeTodayMatches}
          onWhatsAppPress={item => confirmThenWhatsApp(item, 'home_dailyrec')}
        />

        {/* ════════════ NEWLY JOINED ════════════
            Angular: newlyJoinedSection.blockbgColor = 'pink-bg-block' —
            linear-gradient(#FCEBFF → #FFFFFF), not the plain white every
            other section here uses. Angular: <app-loader *ngIf="!nmContLoaded">
            sits on plain white BEFORE the *ngIf="nmContLoaded && swiperNewlyMatchContents?.length > 1"
            wrapper — the pink background + divider only exist once there's
            real data, not as an empty band while loading or when empty. */}
        <NewlyJoinedSection
          loaded={newlyJoinedLoaded}
          items={newlyJoined}
          total={newlyJoinedTotal}
          navigation={navigation}
          gating={gating}
          onCardPress={item => goToProfile(item, newlyJoined, 'home_newmatches')}
          onLikePress={likeNewlyJoined}
          onWhatsAppPress={item => confirmThenWhatsApp(item, 'home_newmatches')}
        />

        {/* ════════════ PROFILES YOU VIEWED ════════════
            Angular wraps this in its own explore-border-top div too — the
            divider above it is gated on profilesViewed's own length, not on
            Newly Joined's or Liked Profiles' visibility. */}
        <ProfilesViewedSection
          items={profilesViewed}
          comCount={comCount}
          navigation={navigation}
          gating={gating}
          onCardPress={item => goToProfile(item, profilesViewed, 'home_viewedbyme')}
          onLikePress={likeProfilesViewed}
          onWhatsAppPress={item => confirmThenWhatsApp(item, 'home_viewedbyme')}
        />

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
        {/* anchor="top-left": Angular's .liked-profile-bg sets background-size:cover
            with NO background-position, so CSS anchors it top-left. Native was
            centering the cover crop, which cut the artwork's top edge off.
            Bundled locally as a raster — see LIKED_PROFILES_BG above. */}
        {(likedByMe.length > 0 || likedMe.length > 0) && (
          <LocalCoverBackground source={LIKED_PROFILES_BG} aspectRatio={LIKED_PROFILES_BG_RATIO} anchor="top-left" style={s.likedSection}>
            <LikedProfilesSection
              gating={gating}
              likedTab={likedTab}
              onTabChange={setLikedTab}
              // Angular: onClickSeeAllCTA() case 'likedprofile' → /activity/likedyou
              // or /activity/likesent depending on which tab is selected. The
              // section's see-all was disabled outright in this port; Angular
              // shows it whenever the combined count is > 1 (showSeeAllButton).
              onSeeAllPress={() => navigation.navigate('Activity', {
                activityType: likedTab === 'likedbyme' ? 'likesent' : 'likedyou',
              })}
              likedByMe={likedByMe}
              likedMe={likedMe}
              likedByCount={comTotalFor(comCount, 'likedbyme')}
              likedMeCount={comTotalFor(comCount, 'likedyou')}
              gender={gender}
              onCardPress={item => goToProfile(item, likedTab === 'likedbyme' ? likedByMe : likedMe, 'home_liked')}
              onLikePress={likedTab === 'likedbyme' ? likeLikedByMe : likeLikedMe}
              onWhatsAppPress={item => confirmThenWhatsApp(item, 'home_liked')}
            />
          </LocalCoverBackground>
        )}

        {/* ════════════ EXPLORE CATEGORIES ════════════ */}
        {categories.length > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.exploreSection}>
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
        {/* Angular: getSucessStories() assigns jodiihappilyMarried only when
            allStories.length >= 4 (and [] otherwise), and the wrapper then
            checks length > 1 — so the section needs FOUR stories, not two. */}
        {stories.length >= 4 && (
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
                // Angular: onClickSeeAllCTA() case 'successStory' → /success-story
                onSeeAllPress={() => navigation.navigate('SuccessStories')}
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
              // Angular: onClickSeeAllCTA() case 'faqvideo' → router.navigate(['/video-faq']).
              onSeeAllPress={() => navigation.navigate('VideoFaq')}
            />
          </View>
        )}

        {/* ════════════ HELP SECTION ════════════
            Angular: *ngIf="helpBannerData" class="explore-border-top" —
            helpBannerData is static translation content (FAQ_DETAILS.BANNER),
            not an API-gated flag, so it's always truthy once the screen
            renders — the divider above Help is effectively unconditional. */}
        {/* No section wrapper — Angular's explore-border-top div has no padding
            of its own; the banner's own pt-24 / cust-padding-start supplies it. */}
        <View style={s.divider} />
        <HelpSection onCallPress={handleCallPress} phone={customerCare.phone} />

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Angular: force-update's own *ngIf has no scroll-gating at all
          (contentLoaded && SHOWFLAG=='1' only) — independent of, and able to
          render alongside, the nudge sticky below. */}
      {showForceUpdate && (
        <ForceUpdateCard onPress={handleForceUpdatePress} onClose={handleForceUpdateClose} />
      )}
      {activeSticky === 'photoPromo' && showStickyOnScroll && (
        <PhotoPromoSticky
          content={photoPromoSticky!.content}
          imageUrl={photoPromoSticky!.imageUrl}
          onPress={handleStickyPress}
        />
      )}
      {activeSticky === 'autopay' && showStickyOnScroll && (
        <StickyBanner
          text={autopaySticky!.content}
          ctaLabel={autopaySticky!.ctaLabel}
          onPress={handleStickyPress}
          onClose={handleStickyClose}
          lottieUri={CDN_LOTTIE + 'payment-via-autopay-img.json'}
        />
      )}
      {activeSticky === 'profileValidation' && showStickyOnScroll && (
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

      {/* statusBarTranslucent: without it, Android's Modal leaves the system
          status bar as its own opaque (white) window ABOVE this one, so the
          camera-cutout strip reads white against this player's black
          background instead of blending into it. StatusBar style="light"
          swaps to light icons for that same strip while the modal is open —
          App.tsx's root <StatusBar style="dark"/> auto-restores on unmount. */}
      {!!videoModalUrl && <StatusBar style="light" />}
      <Modal visible={!!videoModalUrl} animationType="slide" statusBarTranslucent onRequestClose={() => setVideoModalUrl(null)}>
        <View style={s.videoModal}>
          <Pressable style={[s.videoModalClose, { top: insets.top + 8 }]} onPress={() => setVideoModalUrl(null)}>
            <SvgXml xml={CLOSE_OUTLINE_WHITE_XML} width={25} height={25} />
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
        visible={!!waPhotoRequest}
        type="whatsAppPhotoRequest"
        data={waPhotoRequestData}
        // Angular opens this modal with backdropDismiss:false.
        dismissOnBackdrop={false}
        onClose={() => setWaPhotoRequest(null)}
        onPrimaryPress={handleWaPhotoRequestPayNow}
      />
      <BottomSheet
        visible={!!phoneInfo.sheet}
        type="phonePrivacyInfo"
        data={phoneInfo.getData(t)}
        onClose={phoneInfo.close}
        onPrimaryPress={() => phoneInfo.primaryPress(navigation)}
        onSecondaryPress={() => phoneInfo.secondaryPress(addPhoto.openAddPhoto, navigation)}
        onLinkPress={phoneInfo.close}
      />

      <WebPhotoInput inputRef={addPhoto.webInputRef} onChange={addPhoto.handleWebFiles} />
      <AddPhotoVerdictSheets addPhoto={addPhoto} />

    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.white },
  scroll:  { flex: 1 },
  section: { paddingTop: 20, paddingBottom: 4 },
  // Angular: this section's ion-grid is `pt-0 pl-0 pr-0 pb-12` and its header
  // ion-row supplies the `pt-32` — so 32 above and 12 below, not the generic
  // section's 20/4. The background SVG fills this whole padded box.
  likedSection: { paddingTop: 32, paddingBottom: 12 },
  // Daily Recommendation (app-swiper.component.html's `swipperType ===
  // dailyRecommendation` branch) goes through this exact same generic
  // <app-swiper> `pt-0 pb-12` grid / `pt-32` row as likedSection above — it
  // was left on the generic section's 20/4 instead of getting the same 32/12
  // override, so its bottom gap to the next section (Newly Joined) sat
  // noticeably tighter than every other swiper section's.
  drSection: { paddingTop: 40, paddingBottom: 24 },
  // Angular: .explore-border-top { border-top: 3px solid #EBEBEB } — a thin
  // top-border line between sections, not a filled band.
  divider: { borderTopWidth: 3, borderTopColor: '#EBEBEB' },
  hList:   { paddingHorizontal: 16 },

  // Angular: every one of this style's four callers (Complete your profile,
  // Liked profiles, Explore categories, Self-help videos) uses
  // `heading2-semibold-18` for its section heading — font-size var(--font18)
  // (1.125rem, scales with device width — see FontSize's header comment),
  // not the static 15/18 previously used here.
  // Angular: app-swiper.component.html's heading gets no [headerColor] input for
  // the liked-profiles swiper (explore.component.html only passes blockbgColor),
  // so it inherits the framework default black (#000000), not textPrimary.
  sectionTitle: { fontSize: FontSize.font18, color: Colors.black, paddingHorizontal: 16, marginBottom: 12 },
  // Angular: complete-profile.component.html's outer grid is pl-24 pr-0
  // (not the generic 16px every other section header uses), header color is
  // the specific .color-1f1e1b (not textPrimary) — no line-height-24 class on
  // this heading (unlike app-swiper's own header), so no lineHeight here either.
  // The title→first-card gap is 37: the heading's own mb-5, plus the cards
  // ion-row's mt-16, plus each card's own mt-16.
  cpSectionTitle: { paddingHorizontal: 24, color: '#1F1E1B', marginBottom: 37 },
  // Angular: complete-profile.component.html is ALSO what renders the
  // Self-help videos heading (self-videos=true uses the identical template),
  // so it's the same `heading2-semibold-18 color-1f1e1b` — color only here,
  // this section's own paddingHorizontal/marginBottom (sectionTitle's 16/12)
  // are unchanged from before.
  selfVideoSectionTitle: { color: '#1F1E1B' },
  // Angular: the grid is `pt-32 pb-24` and the cards row adds mb-16 below the
  // last card — i.e. 32 above the heading and 40 under the last card, not the
  // generic section's 20/4.
  cpSection: { paddingTop: 32, paddingBottom: 40 },

  // Complete profile — Angular: .complete-profile-block (separate bordered/
  // gradient box per card, not one shared container with divider rows).
  cpList: { marginHorizontal: 24, gap: 16 },
  // Angular: the inner ion-row is `d-flex align-item-flex-end` — the
  // thumbnail and text column align to the row's BOTTOM edge, not centered.
  cpCard: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    gap:               12,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       '#E6E6E6',
    paddingHorizontal: 12,
    paddingVertical:   8,
  },
  // Angular: the title `<div>` and the CTA `<div>` below it are plain
  // siblings with no margin/gap class between them — no gap here either.
  cpInfo:    { flex: 1 },
  // Angular: .body1-medium-14 { font-family: var(--english-medium-poppins) }
  // Angular: `body1-medium-14 black-color` — font-size var(--font14) (0.875rem,
  // scales with device width — see FontSize's header comment); family/color
  // already matched.
  cpTitle:   { fontSize: FontSize.font14, color: Colors.black },
  cpCtaRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Angular: this CTA is <app-button-revamp buttonSize="link">, whose
  // ctaFontSize defaults to EButtonFontSize.regular14 = body2-regular-14 —
  // font-size var(--font14) (0.875rem, dynamic — see FontSize's header
  // comment), not a flat 14. `ion-button.link span` also sets
  // `line-height: 20px !important` explicitly.
  cpCtaText: { fontSize: FontSize.font14, color: '#29339B', lineHeight: 20 },

  // Liked profiles tabs
  // Angular: app-swiper.component.scss's `ion-segment` for this section —
  // --background: #E5B582 (a tan track, not the neutral #F5F5F5 used here),
  // border-radius: 12px, padding: 2px; and the wrapper div is
  // `ml-24 mr-24 mb-32 mt-16`, not 16/12/0.
  tabRow:             { flexDirection: 'row', marginHorizontal: 24, marginTop: 16, marginBottom: 32, backgroundColor: '#E5B582', borderRadius: 12, padding: 2 },
  // Angular: ion-segment-button gets `padding: 5px` from the app, and
  // ::part(native) { padding: 0 } strips Ionic's own 13px inline padding — so
  // 5px all round is the real inset. The rest is Ionic's segment-button.ios.css:
  // `min-height: 28px`, `--border-radius: 7px`, and the white pill is inset from
  // the button slot on EVERY side, from two separate rules:
  //   :host                        { margin-top: 2px; margin-bottom: 2px }
  //   .segment-button-indicator    { padding-left: 2px; padding-right: 2px }
  // (the indicator is the white background; it's absolutely positioned over the
  // host at top/bottom 0, so only its horizontal 2px shows as an inset). Without
  // that 2px on all four sides the pill filled its slot and looked cramped.
  tabPill: {
    flex: 1,
    minHeight: 28,
    margin: 2,
    paddingVertical: 5,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  // --indicator-box-shadow: 0 0 5px rgba(0, 0, 0, 0.16) — an even glow with no
  // offset. NOTE: that is Ionic's own segment-button.ios.css :host default, NOT
  // an app rule (app-swiper.component.scss never sets it); the value is right,
  // it just isn't declared in this project. Same source as tabPill's
  // --border-radius: 7px and min-height: 28px below.
  tabPillActive:      { backgroundColor: Colors.white, shadowColor: Colors.shadow, shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 0 }, elevation: 2 },
  // Angular: --color: #000000 (unselected) at body3-regular-12; --color-checked:
  // #8B4800 (a brown) at body1-medium-14 — the selected tab is a size up, and
  // neither color is the generic text token this used.
  // body3-regular-12's font-size is var(--font12) — 0.75rem, dynamic (see
  // FontSize's header comment). lineHeight 17 DOES have a source, contrary to
  // an earlier note here: app-swiper.component.scss:1073 sets
  // `ion-segment-button ion-label { line-height: 1.4 }`, and 1.4 x 12 = 16.8
  // ≈ 17. The active pill's 20 is the same rule at 14 (1.4 x 14 = 19.6).
  tabPillText:        {  fontSize: FontSize.font12, lineHeight: 17, color: '#000000', textAlign: 'center' },
  // global.scss's .body1-medium-14 is --english-medium-poppins @ var(--font14)
  // (0.875rem, dynamic), i.e. Poppins-Medium — SemanticFontsEnglish has no
  // body-medium slot, so take the family straight from Fonts (same mapping
  // SemanticFonts.en.medium uses).
  tabPillTextActive:  { fontSize: FontSize.font14, lineHeight: 20, color: '#8B4800' },
  // Angular: this section's header ion-row is `pt-32 pr-24 pl-24` with pb-8
  // (every other section gets pb-24), and its ion-col adds mt-24 — so the title
  // sits 24px lower and 24px in from the edge, with only 8px under it before the
  // tab row. The generic sectionTitle's 16px inset / 12px gap is neither.
  // Unlike sectionTitle's other 3 callers, this heading is actually rendered
  // through app-swiper.component.html's OWN header template (Liked Profiles
  // is an <app-swiper>, not <app-complete-profile>/a standalone <ion-text>),
  // which — see SwiperCard.tsx's headerTitle — carries `line-height-24` too.
  likedSectionTitle:  { paddingHorizontal: 24, marginTop: 24, marginBottom: 8, lineHeight: 24 },
  // Angular: .body2-regular-14 line-height-24, ml-24 mr-24 mb-32 pt-8 — shown
  // instead of the tab row when only one of likedYou/likedByMe has data.
  // No color class on this label either, so it's the same inherited black
  // (not textPrimary) as likedSectionTitle above.
  onlyOneLikedText:   { fontSize: FontSize.font14, lineHeight: 24, color: Colors.black, paddingHorizontal: 24, paddingTop: 8, marginBottom: 32 },

  // Explore categories
  // Angular: .discover-new-bg — 12px radius, 1px #E6E6E6 border, compact
  // icon+text row (not a big image tile), default background a light diagonal
  // gradient (applied via LinearGradient at the call site, not here).
  // Angular: ion-row's pl-4/pr-24 + ion-col's size="5.4" offset="0.6" — see
  // tileWidth's own call-site comment for the exact math this approximates.
  // paddingLeft/paddingRight/gap are computed per-render from screen width —
  // see EXPLORE_TILE_WIDTH's header comment — and merged in at the call site.
  // Angular: the title ion-row is `pl-24 pr-24 mt-32 mb-16` and the grid ion-row
  // is `mt-16 pb-24 pr-24 pl-4`. So: 32 below the divider, then (16 collapsed
  // between the two rows + 16 from each card's own `mt-16`) = 32 between the
  // title and the first tile, and 24 under the last row. The generic section's
  // 20/12/4 had the whole block sitting far too tight.
  exploreSection:      { paddingTop: 32, paddingBottom: 24 },
  // Angular: this heading's class list is `heading2-semibold-18 black-color`
  // — pure black (#000), not sectionTitle's textPrimary (#111).
  exploreSectionTitle: { paddingHorizontal: 24, marginBottom: 32, color: Colors.black },
  catGrid:      { flexDirection: 'row', flexWrap: 'wrap' },
  // Angular: .discover-new-bg { padding: 8px 4px 8px 8px } — tighter on the
  // right, where the chevron sits, not a flat 8px on every side.
  catTile:      { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#E6E6E6', paddingTop: 8, paddingRight: 4, paddingBottom: 8, paddingLeft: 8, height: EXPLORE_TILE_HEIGHT },
  // marginRight is Angular's `pl-5` on the label column, not a rounded 8.
  catIconWrap:  { width: EXPLORE_ICON_COL, marginRight: 5, alignItems: 'center', justifyContent: 'center' },
  // Angular: `textcta-medium-12 black-color`, label wrapped in a
  // `line-height-16` span — font-size var(--font12) (0.75rem, dynamic — see
  // FontSize's header comment), pure black (not textPrimary).
  catLabel:         { fontSize: FontSize.font12, color: Colors.black, lineHeight: 16 },
  // Fills the tile's remaining width (catLabel itself no longer does, now
  // that it's a per-line, content-sized Text — see CategoryLabel's header
  // comment above for why).
  catLabelWrap:     { flex: 1 },
  catLabelLastLine: { flexDirection: 'row', alignItems: 'center' },
  // Angular's `ml-2` on the icon itself — 2px, not a flat 8 (that was
  // compensating for the chevron being pinned to the tile's far edge instead
  // of sitting right after the text, see CategoryLabel above).
  catChevron:   { marginLeft: 2 },

  // Angular: .success-story-section { background: #FEF2F6 } and its own pb-24,
  // wrapped in an ion-grid that is `pt-0 pr-0 pl-0 pb-0` — so the heart
  // animation starts flush at the top of the pink band and there's 24 under the
  // cards. The generic section's 20/4 gave it a gap on top and none below.
  successStorySection: { backgroundColor: '#FEF2F6', paddingTop: 0, paddingBottom: 24 },

  // Angular: ion-row wrapping the heart animation + text column and the
  // absolutely-positioned hand image alongside it — the row's own mb-24 is the
  // gap down to the cards row.
  storyHeaderRow: { position: 'relative', marginBottom: 24 },
  // Angular: .success-story-image { position:absolute; right:6px } with mt-6 on
  // its container — no `top`, so it lands at its static position plus that 6px.
  storyHandImage: { position: 'absolute', top: 6, right: 6 },

  // Success stories header — Angular: both lines of the translated header
  // ("Got married<br>through Jodii" — NOT the "Made with Love in Jodii" the
  // .html template shows, which is just static placeholder scaffolding the
  // live `| translate` pipe always overrides) share ONE style —
  // heading2-semibold-18 — not a two-tone regular/bold split.
  // Angular: .negative-mt-18 pulls this block up to overlap the heart
  // animation above it. The header ion-row's own mb-24 (on storyHeaderRow)
  // supplies the gap down to the cards, so no marginBottom here.
  storyHeader:    { paddingHorizontal: 24, marginTop: -18 },
  // succussStorySection.headerbgColor is 'whiteColor', but NO reachable rule
  // defines that class: it exists only in button-revamp.component.scss (as
  // `ion-button.whiteColor`) and profile-card.component.scss, both view-
  // encapsulated, and app-swiper.component.scss defines only .blackColor /
  // .purpleColor. So Angular's title falls back to the inherited dark text —
  // painting it white here put it on #FEF2F6 pink and made it unreadable.
  // Angular: this headline is ALSO app-swiper's own header template
  // (successStory's swiperHeader branch) — same `heading2-semibold-18
  // line-height-24`, so the same dynamic font-size applies.
  storyTitle:     { fontSize: FontSize.font18, lineHeight: 24, color: Colors.black },
  // Angular: .body2-regular-14.black-color.line-height-20
  // Angular: `line-height-20 body2-regular-14 black-color mt-8` — font-size
  // var(--font14) (0.875rem, dynamic — see FontSize's header comment);
  // line-height-20 is a flat 20px (not rem-based), already matched.
  storySubtitle:  { fontSize: FontSize.font14, color: Colors.black, marginTop: 8, lineHeight: 20 },

  // Self-help videos
  videoCard:     { borderRadius: 10, overflow: 'hidden', position: 'relative', backgroundColor: Colors.white },
  videoThumbImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  playBtn:       { position: 'absolute', top: '50%', left: '50%', width: 40, height: 40, marginLeft: -20, marginTop: -20, alignItems: 'center', justifyContent: 'center' },
  videoCaptionScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, paddingTop: 24, backgroundColor: 'rgba(0,0,0,0.45)' },
  // Angular: `body3-regular-12 white-color overflow-auto line-height-16` —
  // font-size var(--font12) (0.75rem, dynamic — see FontSize's header comment);
  // line-height-16 is a flat 16px (not rem-based), already matched.
  videoTitle:    { fontSize: FontSize.font12, color: Colors.white, lineHeight: 16 },
  // Angular: the "See all" row is `ion-col size="12" class="d-flex
  // ion-justify-content-end"` — right-aligned, no extra top margin of its own
  // beyond the FlatList's existing bottom padding.
  selfHelpSeeAllRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, marginTop: 12 },
  selfHelpSeeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Angular: `textcta-medium-12 color-29339B` — font-size var(--font12)
  // (0.75rem, dynamic — see FontSize's header comment), Poppins-Medium.
  selfHelpSeeAllText: { fontSize: FontSize.font12, color: '#29339B' },

  // Help section
  // Angular: FAQ_DETAILS.BANNER — title/body/link-CTA on a gradient card with
  // a decorative image, not two call/whatsapp buttons.
  // Angular: `.help-banner { min-height: 35vmin }` on an ion-grid that is
  // `padd0`, inside a plain explore-border-top div — a FULL-BLEED band with no
  // border radius and no horizontal margin. Its row is
  // `ion-cust-padding-start pt-24 pr-24`, and --ion-cust-padding is 24px.
  // Rendering it as a 16px-inset rounded card was the wrong shape entirely.
  // Note there is no bottom-padding class at all on that row (and
  // `.help-banner` itself sets only min-height + background, no padding) —
  // the content sits flush at the bottom, with only min-height (not real
  // padding) creating any extra room below when content is short.
  helpWrap:      { flexDirection: 'row', alignItems: 'center', minHeight: SW * 0.35, paddingLeft: 24, paddingRight: 24, paddingTop: 24 },
  helpTextCol:   { flex: 1 },
  // Angular: `heading4-medium-16` (Poppins-MEDIUM 16, not semibold). TITLECOLOR
  // isn't a key on FAQ_DETAILS.BANNER, so [ngStyle] sets nothing and the title
  // keeps the default dark text.
  // Angular: home-banner.component.html's helpBanner TITLE is
  // `heading4-medium-16` — font-size var(--font16) (1rem, scales with device
  // width — see FontSize's header comment), not a flat 16px. TITLECOLOR is
  // bound via [ngStyle] but absent from the FAQ_DETAILS.BANNER translation
  // object, so it resolves to inherited black, not textPrimary.
  helpTitle:     { fontSize: FontSize.font16, color: Colors.black },
  // Angular: `body2-regular-14` + `mt-8`; CONTANTCOLOR is likewise absent from
  // the translation object, so this is default dark at 14 — not 13 gray.
  // Angular: home-banner.component.html's helpBanner BODY is `body2-regular-14
  // poppins-family mt-8` — font-size var(--font14) (0.875rem, dynamic — see
  // FontSize's header comment). No line-height class on this one (unlike
  // storySubtitle's identically-sized text, which has line-height-20) — drop
  // the explicit lineHeight so it falls back to the font's natural metric.
  helpSub:       { fontSize: FontSize.font14, color: Colors.black, marginTop: 8 },
  // Angular: the CTA row is `mt-4`; its label is `textcta-medium-12`
  // (var(--font12), 0.75rem, dynamic — see FontSize's header comment —
  // Poppins-Medium) in .color-29339B, with the chevron at ml-4.
  helpCta:       { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  helpCtaText:   { fontSize: FontSize.font12, color: '#29339B' },
  // Angular's ion-icon here has no explicit size class, so it's Ionic's own
  // default (1.5rem ≈ 24px) — a real chevron-forward-outline icon now
  // (CHEVRON_FORWARD_BLUE_XML), not this SemiBold '›' character standing in
  // for it.
  helpCtaChevron: { marginLeft: 4 },

  // Self-help video modal
  videoModal:      { flex: 1, backgroundColor: '#000' },
  videoModalClose: { position: 'absolute', top: 48, right: 16, zIndex: 1, padding: 8 },
  videoModalPlayer: { flex: 1 },
})
