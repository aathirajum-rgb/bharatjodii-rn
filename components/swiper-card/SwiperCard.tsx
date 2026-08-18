import { useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import CdnSvg from '../cdn-svg/CdnSvg'
import ProfileCard, { PHOTO_HEIGHT, type CardSection, type CardVariant } from '../profile-card/ProfileCard'
import { Fonts } from '../../src/theme/fonts'

// Angular: core/config/button.config.ts's SEE_ALL — textColor: 'linkColor'
// (--ion-color-link-color: #29339B), iconType: 'forward-icon-link' — a plain
// text+chevron in the brand red was wrong on both counts.
const SEE_ALL_LINK_COLOR = '#29339B'
const FWD_ICON = `${CDN_SVG}revamp/forward-icon-link.svg`

// ─── Pagination dots ────────────────────────────────────────────────────────────
// Angular: home.config.ts's per-section swiper `pagination: { dynamicBullets:
// true, dynamicMainBullets: 5 }` (Swiper.js) — up to 5 dots visible at once in a
// window centered on the active slide, active dot enlarged into a pill, dots
// nearer the edge of the window shrunk. Tracked continuously via FlatList's
// onScroll (see handleScroll below) rather than only on scroll-settle, since
// react-native-web doesn't reliably fire onMomentumScrollEnd for mouse-drag/
// trackpad scrolling.
// Angular: dailyrecommendations' own drmatches config uses dynamicMainBullets:2
// instead of the 5 every other section's swiper config uses — exported so
// CoverflowSwiper.tsx (that section's dedicated carousel) can reuse this with
// its own window size instead of duplicating the dot logic.
export function PaginationDots({
  total, activeIndex, maxVisible = 5,
}: { total: number; activeIndex: number; maxVisible?: number }) {
  if (total <= 1) return null
  const half = Math.floor(maxVisible / 2)
  let start = Math.max(0, Math.min(activeIndex - half, total - maxVisible))
  start = Math.max(0, start)
  const end = Math.min(total, start + maxVisible)
  const indices = Array.from({ length: end - start }, (_, i) => start + i)

  return (
    <View style={styles.dotsRow}>
      {indices.map(i => {
        const distance = Math.abs(i - activeIndex)
        return (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex && styles.dotActive,
              i !== activeIndex && distance >= 2 && styles.dotSmall,
            ]}
          />
        )
      })}
    </View>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

// One item in the swiper — maps to a ProfileCard
export interface SwiperItem {
  profileId?:  string | undefined
  name?:       string | undefined
  age?:        string | undefined
  height?:     string | undefined
  education?:  string | undefined
  location?:   string | undefined
  profileImg?: string | undefined
  avatarImg?:  string | undefined
  photos?:     string[] | undefined   // full PHOTO array (Matches carousel) — profileImg is photos[0]

  // Photo states
  isPhotoAvailable?:    boolean | undefined
  isPhotoProtect?:      boolean | undefined
  isAddPhotoRequest?:   boolean | undefined
  isViewPhotoRequest?:  boolean | undefined
  showReqPhotoElement?: boolean | undefined
  isNewlyJoined?:       boolean | undefined

  // Like state
  likedStatus?: '0' | '1' | '2' | '3' | undefined
  phoneViewed?: string | undefined   // raw '0'|'1'|'2'|'3' — drives after-like CTA label

  // Angular: FUNC.disableDontShow()/disableViewLater() — '1'/'3' = action already taken
  dontShowStatus?:  string | undefined   // raw STATUS
  viewLaterStatus?: string | undefined   // raw VIEWLATER

  // Profile badge fields (used by MatchesScreen, ViewProfile, etc.)
  isPaidMember?: boolean | undefined    // Angular: FUNC.IsPaidMember(profile)
  isIdVerified?: boolean | undefined    // Angular: FUNC.IsIDVerifiedMember(profile)
  occupation?:   string | undefined
  income?:       string | undefined
  caste?:        string | undefined

  // Labels / dates
  isNewLabel?:          boolean | undefined
  labelContent?:        string | undefined
  likedViewedDateText?: string | undefined
  date?:                string | undefined   // success story posted date (variant 4)

  // See-all card (variant 5)
  viewMoreList?:    { THUMBIMG: string }[] | undefined
  viewMoreContent?: string | undefined
}

export interface SwiperCardProps {
  // ── Section header ─────────────────────────────────────────────────────────
  swiperHeader?:   string | undefined    // section title
  newCount?:       number | undefined    // red count badge on the header
  showSeeAll?:     boolean | undefined   // show "See All →" link at the end

  // ── Card config ────────────────────────────────────────────────────────────
  // Maps to Angular profileCardType (1–8) and swipper-type (CardSection)
  cardVariant?:  CardVariant  | undefined
  cardSection?:  CardSection  | undefined

  // ── Data ──────────────────────────────────────────────────────────────────
  items: SwiperItem[]

  // ── Layout ────────────────────────────────────────────────────────────────
  // Explicit width override — normally omit this and let the card size itself
  // from cardSection instead (see PHOTO_HEIGHT import below); Angular's cards
  // are square per section (card-htN CSS classes pair identical min-width/
  // min-height), so a flat one-size-fits-all default here would misshape
  // every section except the one it happens to match by coincidence.
  cardWidth?: number | undefined

  // Angular: cardMoreItemsData — the 3 items just beyond the visible slice
  // (e.g. items #6-8 when 5 are shown), previewed as overlapping THUMBIMG
  // thumbnails on the ghost "view more" card at the end of the list.
  moreItems?: { THUMBIMG: string }[] | undefined

  // ── Callbacks ─────────────────────────────────────────────────────────────
  onCardPress?:     ((item: SwiperItem, index: number) => void) | undefined
  onLikePress?:     ((item: SwiperItem, index: number) => void) | undefined
  onViewMorePress?: (() => void) | undefined
  onSeeAllPress?:   (() => void) | undefined
  // Photo-protected/no-photo overlay's WhatsApp CTA — see ProfilePhoto.tsx.
  onWhatsAppPress?: ((item: SwiperItem, index: number) => void) | undefined
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Angular: home.config.ts's per-section swiper `spaceBetween: 16` (every
// section but selfHelp, which is 1 — not special-cased here, the difference
// is imperceptible). app-swiper.component.html's wrapping ion-row is
// `pr-24 pl-24` — confirmed against global.scss, not the design file alone.
const CARD_GAP   = 16
const CARD_PAD   = 24   // horizontal padding on the FlatList

// ─── SwiperCard ───────────────────────────────────────────────────────────────
// Horizontal scrollable section of ProfileCards.
// Equivalent of Angular's app-swiper-card / app-swiper — used on the Home page
// (Who Liked You, Who Viewed You, New Matches, Similar Profiles sections).

export default function SwiperCard({
  swiperHeader,
  newCount,
  showSeeAll = true,
  cardVariant = 1,
  cardSection = 'matches',
  items,
  cardWidth,
  moreItems,
  onCardPress,
  onLikePress,
  onViewMorePress,
  onSeeAllPress,
  onWhatsAppPress,
}: SwiperCardProps) {
  const { t } = useTranslation()
  // Angular: card-htN classes set min-width === min-height per section — reuse
  // ProfileCard's own per-section ratio table as the default card width unless
  // a caller has a genuine reason to override it.
  const resolvedCardWidth = cardWidth ?? PHOTO_HEIGHT[cardSection]

  // ProfileCard's case-1 renders a plain square (photo height === width) for
  // every section EXCEPT Daily Recommendations, which adds an extra "View
  // profile" button block below the photo (cardBottom + primaryBtn: ~24px
  // block padding + ~26px button padding + ~20px text line height). Case-3
  // (viewedyou/viewedbyme — cardVariant 3) always adds its own cardInfo block
  // (name + detail + "View full profile" link: ~20px block padding + ~26px
  // name line + ~18px detail line + ~26px link ≈ 85px), regardless of which
  // of those two sections it is — both share the identical case-3 markup.
  // The ghost "see all" card needs to match whichever height the real
  // sibling cards actually render at, or the row grows to fit the taller
  // item and leaves a gap below the shorter one.
  const realCardHeight =
    cardSection === 'dailyrecommendations' ? resolvedCardWidth + 70 :
    cardVariant === 3                      ? resolvedCardWidth + 85 :
    resolvedCardWidth

  // Active-slide index for the pagination dots. Angular updates on the
  // swiper's `transitionEnd` — RN's onMomentumScrollEnd is the native
  // equivalent, but react-native-web never dispatches it for mouse-drag/
  // trackpad scrolling, which would leave the dots permanently stuck at 0 on
  // web. onScroll fires reliably on every platform, so track continuously
  // from it instead (throttled via scrollEventThrottle below).
  const [activeIndex, setActiveIndex] = useState(0)
  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x
    const idx = Math.round(x / (resolvedCardWidth + CARD_GAP))
    setActiveIndex(Math.max(0, Math.min(idx, items.length - 1)))
  }

  if (!items || items.length === 0) return null

  return (
    <View style={styles.container}>
      {/* ── Section header ── */}
      {/* Angular: app-swiper.component.html — the "See all" CTA is a separate
          element BELOW the card list (right-aligned, sharing a row with the
          pagination dots), not inline with the header title. */}
      {(!!swiperHeader || newCount !== undefined) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {!!swiperHeader && (
              <Text style={styles.headerTitle} numberOfLines={1}>{swiperHeader}</Text>
            )}
            {typeof newCount === 'number' && newCount > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{newCount > 99 ? '99+' : newCount}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── Horizontal card list ── */}
      <FlatList
        data={items}
        keyExtractor={(item, i) => item.profileId ?? String(i)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { gap: CARD_GAP }]}
        // Snap to each card for a clean swipe feel
        snapToInterval={resolvedCardWidth + CARD_GAP}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <View style={{ width: resolvedCardWidth }}>
            <ProfileCard
              variant={cardVariant}
              section={cardSection}
              profileId={item.profileId}
              name={item.name}
              age={item.age}
              height={item.height}
              education={item.education}
              location={item.location}
              profileImg={item.profileImg}
              avatarImg={item.avatarImg}
              isPhotoAvailable={item.isPhotoAvailable}
              isPhotoProtect={item.isPhotoProtect}
              isAddPhotoRequest={item.isAddPhotoRequest}
              isViewPhotoRequest={item.isViewPhotoRequest}
              showReqPhotoElement={item.showReqPhotoElement}
              isNewlyJoined={item.isNewlyJoined}
              likedStatus={item.likedStatus}
              isNewLabel={item.isNewLabel}
              labelContent={item.labelContent}
              likedViewedDateText={item.likedViewedDateText}
              date={item.date}
              viewMoreList={item.viewMoreList}
              viewMoreContent={item.viewMoreContent}
              onPress={() => onCardPress?.(item, index)}
              onLikePress={() => onLikePress?.(item, index)}
              onWhatsApp={() => onWhatsAppPress?.(item, index)}
              onViewMorePress={onViewMorePress}
            />
          </View>
        )}
        ListFooterComponent={
          showSeeAll && onSeeAllPress ? (
            // "See All" ghost card at the end of the list — Angular's own
            // in-carousel "view more" slide (app-profile-card type='5'),
            // previewing the next few hidden profiles' real thumbnails.
            // Angular: .see-all-card { width: 94%; height: 100% } — nearly full
            // width (small inset just to reveal the drop shadow) and EXACTLY
            // the same height as the sibling profile cards in this section
            // (a fixed 1.3x-width multiplier here previously made the ghost
            // card taller/shorter than the real cards, inflating the row
            // height and leaving a gap below the shorter item).
            <View style={{ width: resolvedCardWidth * 0.94, height: realCardHeight }}>
              <ProfileCard
                variant={5}
                section={cardSection}
                viewMoreList={moreItems ?? []}
                viewMoreContent={t('HOME.SEE_ALL_CTA')}
                onViewMorePress={onSeeAllPress}
              />
            </View>
          ) : null
        }
      />

      {/* ── Dots + "See all" row, below the card list ── */}
      {(items.length > 1 || (showSeeAll && !!onSeeAllPress)) && (
        <View style={styles.bottomRow}>
          <PaginationDots total={items.length} activeIndex={activeIndex} />
          {showSeeAll && !!onSeeAllPress && (
            <Pressable onPress={onSeeAllPress} style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>{t('HOME.SEE_ALL_CTA')}</Text>
              <CdnSvg uri={FWD_ICON} width={12} height={12} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Angular: app-swiper.component.html's outer ion-grid — pb-12 trailing gap
  // after the whole section, before the next section's divider.
  container: {
    marginBottom: 12,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: CARD_PAD,
    // Angular: header's own ion-row is pb-24 (pb-8 for likedprofile only,
    // not distinguished here — see SCOPE note if that section's spacing
    // gets reviewed separately).
    marginBottom:      24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    flex:          1,
  },
  // Angular: .heading2-semibold-18 { font-family: var(--english-semibold-poppins) }
  headerTitle: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   18,
    color:      Colors.textPrimary,
    flexShrink: 1,
  },
  countBadge: {
    backgroundColor:   Colors.primary,
    borderRadius:      10,
    minWidth:          22,
    height:            22,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 5,
  },
  countText: {
    color:      Colors.white,
    fontSize:   11,
    fontWeight: '700',
    lineHeight: 14,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    paddingLeft:   12,
  },
  seeAllText: {
    fontSize:   13,
    color:      SEE_ALL_LINK_COLOR,
    fontWeight: '600',
  },

  // ── List ──────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: CARD_PAD,
  },

  // ── Bottom row: pagination dots (left) + "See all" link (right) ──────────
  // Angular: swiper box has class="explore-pagination pb-16" (16px bottom
  // padding) before the dots/CTA row starts — the dots themselves are
  // absolutely offset -25px past that via Swiper.js's own pagination CSS
  // (no clean RN equivalent), but the resulting card-to-row gap is that 16px.
  bottomRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: CARD_PAD,
    marginTop:         16,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  // Angular global.scss: .explore-pagination .swiper-pagination-bullet —
  // 5x5 circle, #F4CECE.
  dot: {
    width:           5,
    height:          5,
    borderRadius:    2.5,
    backgroundColor: Colors.paginationDotInactive,
  },
  // Angular global.scss: .explore-pagination .swiper-pagination-bullet-active
  // — 20x5 pill, #B50033 (Colors.primaryDark, not the brighter Colors.primary).
  dotActive: {
    width:           20,
    height:          5,
    borderRadius:    2.5,
    backgroundColor: Colors.primaryDark,
  },
  dotSmall: {
    width:        4,
    height:       4,
    borderRadius: 2,
  },
})
