import { useEffect, useState } from 'react'
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import ProfileCard, { PHOTO_HEIGHT, type CardSection, type CardVariant } from '../profile-card/ProfileCard'
import { FEMALE_AVATAR_URL, getOppGenderAvatarUrl } from '../../utils/avatar'
import { FontSize } from '../../src/theme/fonts'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// Angular: core/config/button.config.ts's SEE_ALL — textColor: 'linkColor'
// (--ion-color-link-color: #29339B), iconType: 'forward-icon-link' — a plain
// text+chevron in the brand red was wrong on both counts.
const SEE_ALL_LINK_COLOR = '#29339B'
// Angular: app-swiper.component.html's "See all" <app-button-revamp> overrides
// SEE_ALL config's own iconType to `EButtonIcons.forwardAnimation`
// ('forward-animation-link') — button-revamp.component.ts's IsShowAnimation()
// then renders a plain <img> (not the static forward-icon-link.svg icon slot)
// at a literal `assets/images/svg/revamp/animation/right-arrow-animation.gif`,
// 24×20px (not the square 12×12/24×24 a static icon would use).
const FWD_ANIM_ICON = `${CDN_SVG}revamp/animation/right-arrow-animation.gif`

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
// Angular global.scss: .explore-pagination .swiper-pagination-bullet is 5x5.
const DOT_SIZE = 5

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
        if (i === activeIndex) return <View key={i} style={[styles.dot, styles.dotActive]} />
        // Swiper's dynamic-bullet CSS scales each bullet by how far it sits from
        // the active one — scale(0.66) at ±1, scale(0.33) at ±2 and beyond. The
        // app's own global.scss pins bullet opacity to 1, so this taper IS the
        // "fade" the dots read as. A flat 5px/4px pair made them look uniform.
        const size = DOT_SIZE * (distance === 1 ? 0.66 : 0.33)
        return (
          <View
            key={i}
            style={[styles.dot, { width: size, height: size, borderRadius: size / 2 }]}
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
  // The member's OWN height ("5'11\" feet") is `height`; this is the banded
  // bucket ("5.7 - 5.11 feet height"). Angular binds a DIFFERENT one per
  // surface, so both have to travel — see toProfile()/MatchProfileAdapter.
  heightCategory?: string | undefined
  education?:  string | undefined
  location?:   string | undefined
  profileImg?: string | undefined
  avatarImg?:  string | undefined
  photos?:     string[] | undefined   // full PHOTO array (Matches carousel) — profileImg is photos[0]
  // Raw THUMBIMG, kept separate from profileImg (which prefers PHOTO[0].IMAGE,
  // the FULL-SIZE photo). Angular's "see all" card reads THUMBIMG directly —
  // it's the small square built for these 56px circles, and for a hidden or
  // photo-protected profile it's a different asset from PHOTO[0].IMAGE.
  thumbImg?:   string | undefined

  // Photo states
  isPhotoAvailable?:    boolean | undefined
  isPhotoProtect?:      boolean | undefined
  isAddPhotoRequest?:   boolean | undefined
  isViewPhotoRequest?:  boolean | undefined
  showReqPhotoElement?: boolean | undefined
  isNewlyJoined?:       boolean | undefined

  // Like state — 5 is a documented alias of 0 in Angular's showLikeCTA(), see
  // types/interfaces/matches.interface.ts's MatchProfile.likedStatus.
  likedStatus?: '0' | '1' | '2' | '3' | '5' | undefined
  phoneViewed?: string | undefined   // raw '0'|'1'|'2'|'3' — drives after-like CTA label
  phoneProtected?: string | undefined   // raw PHONEPROTECTED — '0' = not protected

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
  // Angular's success-story branch is the one section that renders the
  // in-carousel "see all" SLIDE but no "See all" LINK row beneath the dots
  // (its ion-grid simply has no such row). Defaults to following showSeeAll,
  // so every other section is unchanged.
  showSeeAllLink?: boolean | undefined

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

const SCREEN_W = Dimensions.get('window').width

// Angular: core/config/home.config.ts — every section declares its OWN
// slidesPerView (all share spaceBetween: 16), and Swiper derives the slide
// width from it:
//     slideWidth = (containerWidth - spaceBetween * (slidesPerView - 1)) / slidesPerView
// containerWidth is the screen minus the slides row's 24px left padding
// (.row-pad), i.e. exactly SCREEN_W - CARD_PAD here.
//
// This is a DIFFERENT number from the photo height (ProfileCard's PHOTO_HEIGHT
// = Angular's per-section `photoHt`/card-htN value), which is what the card
// width was previously derived from. The two only coincide for some sections:
//   • matches     1.628 → 200 wide, photo 200 (0.5556vmin)  — same
//   • newmatches  1.189 → 280 wide, photo 280 (0.7778vmin)  — same
//   • viewedyou   1.3135 → 252 wide, photo 260 (0.72225vmin) — 8dp too wide before
//   • viewedbyme  1.3135 → 252 wide, photo 220 (0.61111vmin) — 32dp too NARROW before
// (all at a 360dp screen). Sections with no entry keep the PHOTO_HEIGHT
// fallback.
const SLIDES_PER_VIEW: Partial<Record<CardSection, number>> = {
  matches:         1.628,
  similarprofiles: 1.628,
  newmatches:      1.189,
  viewedyou:       1.3135,
  viewedbyme:      1.3135,
  whoviewednumber: 1.3135,
  likedprofile:    1.2,
  viewlater:       1.795,
  // Angular: home.config.ts's successStory config — slidesPerView 1.29,
  // spaceBetween 16 (no pagination block, unlike the others). Without an entry
  // here the card width fell back to PHOTO_HEIGHT['successstory'], so the slide
  // was as wide as the photo is tall instead of Angular's ~0.71 screen widths.
  successstory:    1.29,
}

// ─── SwiperCard ───────────────────────────────────────────────────────────────
// Horizontal scrollable section of ProfileCards.
// Equivalent of Angular's app-swiper-card / app-swiper — used on the Home page
// (Who Liked You, Who Viewed You, New Matches, Similar Profiles sections).

export default function SwiperCard({
  swiperHeader,
  newCount,
  showSeeAll = true,
  showSeeAllLink,
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
  const langFonts = useLanguageFonts()
  // Card WIDTH comes from the section's own swiper config, not from the photo
  // ratio table (see SLIDES_PER_VIEW above for the arithmetic and why the two
  // are different numbers). PHOTO_HEIGHT stays the fallback for sections with
  // no mapped config (e.g. successstory, whose Angular markup is a separate
  // grid rather than this swiper).
  // The in-carousel "see all" slide follows showSeeAll; the link row below the
  // dots follows showSeeAllLink, which defaults to it.
  const linkVisible = showSeeAllLink ?? showSeeAll

  const spv = SLIDES_PER_VIEW[cardSection]
  const resolvedCardWidth =
    cardWidth ??
    (spv ? (SCREEN_W - CARD_PAD - CARD_GAP * (spv - 1)) / spv : PHOTO_HEIGHT[cardSection])

  // Angular: app-swiper.component.ts's ngOnChanges — avatarImg =
  // FUNC.getAvatarImg(FUNC.getOppGenderType()), resolved once for the whole
  // swiper and handed to the "see all" card as its per-slot image fallback.
  const [oppAvatarUrl, setOppAvatarUrl] = useState(FEMALE_AVATAR_URL)
  useEffect(() => {
    let cancelled = false
    getOppGenderAvatarUrl().then(u => { if (!cancelled) setOppAvatarUrl(u) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

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
  // …but those per-variant numbers are only an ESTIMATE of the text block's
  // height, so any card whose name/detail line wraps (or whose font metrics
  // differ per language) left the ghost card visibly taller or shorter than its
  // siblings. Angular never estimates: `.see-all-card { height: 100% }` inside a
  // Swiper slide simply inherits the row height. The RN equivalent is to MEASURE
  // the first real card and use that; the estimate below is just the value used
  // for the one frame before onLayout reports back.
  const estimatedCardHeight =
    cardSection === 'dailyrecommendations' ? resolvedCardWidth + 70 :
    cardVariant === 3                      ? resolvedCardWidth + 85 :
    resolvedCardWidth
  const [measuredCardHeight, setMeasuredCardHeight] = useState<number | null>(null)
  const realCardHeight = measuredCardHeight ?? estimatedCardHeight

  function handleFirstCardLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height
    // Guard the state update so a sub-pixel re-layout can't loop.
    if (h > 0 && Math.abs(h - (measuredCardHeight ?? 0)) > 1) setMeasuredCardHeight(h)
  }

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
          {!!swiperHeader && (
            <Text style={[styles.headerTitle, { fontFamily: langFonts.semiBold }]} numberOfLines={1}>{swiperHeader}</Text>
          )}
          {/* Angular: app-swiper.component.html:29-33 — `isNewtag` (newCount > 0)
              renders a `.new-block` PILL on its own row 6px BELOW the title:
              purple gradient #801C8D → #E454F7, 4px radius, 3px/8px padding,
              12px medium white text reading getNewTxt() = HOME.NEW_TXT
              ("#COUNT New", with #PLURAL# dropped when the count is 1).
              This was a small red circular count badge sitting inline to the
              RIGHT of the title — a different element in every respect. */}
          {typeof newCount === 'number' && newCount > 0 && (
            <LinearGradient
              colors={['#801C8D', '#E454F7']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.newTag}
            >
              <Text style={[styles.newTagText, { fontFamily: langFonts.medium }]}>
                {t('HOME.NEW_TXT')
                  .replace(/#COUNT#/g, String(newCount))
                  .replace(/#PLURAL#/g, newCount === 1 ? '' : t('PROFILES.PLURALMEMBER'))
                  .trim()}
              </Text>
            </LinearGradient>
          )}
        </View>
      )}

      {/* ── Horizontal card list ── */}
      <FlatList
        data={items}
        keyExtractor={(item, i) => item.profileId ?? String(i)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { gap: CARD_GAP }]}
        // No snapping: Angular's swiper config for every section this component
        // renders sets `freeMode: true` (home.config.ts), i.e. the carousel
        // scrolls freely and does NOT lock to slide boundaries.
        //
        // snapToInterval was also why the trailing "See all" card could never be
        // brought fully into view: it forced rest positions at multiples of
        // (cardWidth + 16), but that card is only 94% of a card wide, so the
        // content's true end is not on that grid — the list snapped back to the
        // previous multiple and left it hanging off the right edge.
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <View
            style={{ width: resolvedCardWidth }}
            {...(index === 0 ? { onLayout: handleFirstCardLayout } : {})}
          >
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
          // The "view more" slide needs at least one profile behind the 5 on
          // display — i.e. the section has MORE THAN 5 cards. Previously this
          // rendered unconditionally, so a section with exactly 5 (or fewer)
          // profiles still tacked a full-size, empty tile onto the end.
          //
          // Angular's own gate is stricter — `*ngIf="cardMoreItemsData.length > 1"`
          // over getMoreItemData()'s indexes 5-7, so its slide needs 7+ profiles
          // and a 6-profile section shows none. This uses the >5 rule by
          // product decision; the preview strip simply shows however many
          // leftover thumbnails exist (1 to 3).
          showSeeAll && onSeeAllPress && (moreItems?.length ?? 0) > 0 ? (
            // "See All" ghost card at the end of the list — Angular's own
            // in-carousel "view more" slide (app-profile-card type='5'),
            // previewing the next few hidden profiles' real thumbnails.
            // Angular: .see-all-card { width: 94%; height: 100% } — nearly full
            // width (small inset just to reveal the drop shadow) and EXACTLY
            // the same height as the sibling profile cards in this section
            // (a fixed 1.3x-width multiplier here previously made the ghost
            // card taller/shorter than the real cards, inflating the row
            // height and leaving a gap below the shorter item).
            // The SLIDE is a full card wide (like every other slide) and the
            // card inside it is the 94% — that trailing 6% is what leaves the
            // card clear of the screen edge once scrolled to the end. Putting
            // the 94% on the slide itself instead made the content end exactly
            // at the card's right edge, so at maximum scroll the card sat flush
            // against (and looked cut off by) the viewport edge.
            <View style={{ width: resolvedCardWidth, height: realCardHeight }}>
              <View style={{ width: '94%', height: '100%' }}>
                <ProfileCard
                  variant={5}
                  section={cardSection}
                  viewMoreList={moreItems ?? []}
                  viewMoreContent={t('HOME.SEE_ALL_CTA')}
                  // Angular passes [avatarImg]="avatarImg" (the opposite-gender
                  // silhouette) to this type-5 card, which its <img (error)> handler
                  // swaps in for every slot with no usable thumbnail. Without it the
                  // card fell back to resolving that URL asynchronously on its own,
                  // so the circles rendered female-then-correct on the first paint.
                  avatarImg={oppAvatarUrl}
                  onViewMorePress={onSeeAllPress}
                />
              </View>
            </View>
          ) : null
        }
      />

      {/* ── Pagination dots + "See all" link, sharing one row (dots left,
          link right) ── Angular's dots are absolutely offset -25px UP into
          the space right above the CTA row (`.explore-pagination
          .swiper-pagination { bottom: -25px }`), so the two visually share a
          line even though they're separate elements in the DOM — splitting
          them into two stacked RN rows (previous version here) lost that and
          pushed "See all" onto its own line below the dots. Same
          space-between pattern CoverflowSwiper.tsx's own bottomRow uses. */}
      {(items.length > 1 || (linkVisible && !!onSeeAllPress)) && (
        <View style={styles.bottomRow}>
          <PaginationDots total={items.length} activeIndex={activeIndex} />
          {linkVisible && !!onSeeAllPress && (
            <Pressable onPress={onSeeAllPress} style={styles.seeAllBtn}>
              <Text style={[styles.seeAllText, { fontFamily: langFonts.regular }]}>{t('HOME.SEE_ALL_CTA')}</Text>
              {/* Angular: a plain <img style="width:24px;height:20px"> with no
                  object-fit — the browser default (`fill`, non-uniform
                  stretch, no cropping) applies. The GIF's real native frame
                  is a 1200x1200 SQUARE; RN's Image defaults to `resizeMode:
                  'cover'`, which for a square source in this 24x20 landscape
                  box crops off the top/bottom to fill-and-overflow instead of
                  stretching — a visibly zoomed-in/bigger arrow than Angular's. */}
              <Image source={{ uri: FWD_ANIM_ICON }} style={styles.seeAllIcon} resizeMode="stretch" />
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
    // Angular: the header ion-row is `pt-32 pr-24 pl-24 pb-24` inside a grid
    // whose own top padding is 0 — i.e. 32px above the title. The callers here
    // sit inside HomeScreen's `s.section` (paddingTop 20), so this adds the
    // remaining 12 to land on Angular's 32.
    paddingTop:        12,
    paddingHorizontal: CARD_PAD,
    // Angular: the header's own ion-row is pb-24 (pb-8 for likedprofile only,
    // not distinguished here — see SCOPE note if that section's spacing
    // gets reviewed separately). 12 of those 24 now sit on listContent's
    // paddingTop so the cards' top shadow isn't clipped by the scroll view.
    marginBottom:      12,
    // The NEW pill is a SECOND ROW under the title (ion-col size=12 + mt-6),
    // not an inline element beside it — so this column stacks, left-aligned.
    alignItems:        'flex-start',
    gap:               6,
  },
  // Angular: .heading2-semibold-18.line-height-24 — font-family
  // var(--english-semibold-poppins), font-size var(--font18) (1.125rem, scales
  // with device width — see remPx()'s header comment), line-height a flat 24px
  // (NOT rem-based, unlike the font-size). Color: every app-swiper caller
  // (home.enum.ts's *Section.headerbgColor) passes 'blackColor' — confirmed
  // across all of newlyJoinedSection/dailyRecommendationSection/
  // viewedbymeSection/etc — i.e. pure #000000, not textPrimary (#111111).
  headerTitle: {
   
    fontSize:   FontSize.font18,
    lineHeight: 24,
    color:      Colors.black,
    flexShrink: 1,
  },
  // Angular: .new-block (app-swiper.component.scss:961) — padding 3px 8px,
  // linear-gradient(to right, #801C8D, #E454F7), 4px radius.
  newTag: {
    paddingVertical:   3,
    paddingHorizontal: 8,
    borderRadius:      4,
  },
  // Angular: .textcta-medium-12 (var(--font12), 0.75rem, dynamic — see
  // FontSize's header comment) .white-color
  newTagText: {
   
    fontSize:   FontSize.font12,
    lineHeight: 16,
    color:      Colors.white,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  // Angular: button.config.ts's SEE_ALL sets no ctaFontSize, so
  // button-revamp.component.ts's default (EButtonFontSize.regular14 =
  // body2-regular-14) applies — Poppins-Regular @ var(--font14) (0.875rem,
  // dynamic), weight 400. A flat 13/600/system-font here matched none of
  // those three.
  seeAllText: {
    
    fontSize:   FontSize.font14,
    color:      SEE_ALL_LINK_COLOR,
  },
  // Angular: the animated <img> is styled inline `width: 24px; height: 20px`
  // — not square, so this can't be expressed as a single CdnSvg width/height.
  seeAllIcon: { width: 24, height: 20 },

  // ── List ──────────────────────────────────────────────────────────────────
  // Angular: the slides row is `.row-pad { padding-left: 24px }` — LEFT only, so
  // the carousel bleeds off the right edge (that's what produces the partial
  // next-card peek at 1.3135 slides-per-view). An equal right padding here
  // stopped the last card short of the edge and shifted every card's peek.
  //
  // paddingBottom: a FlatList IS a ScrollView, and a ScrollView clips its
  // content to its own frame. With the row exactly as tall as a card, the
  // card's drop shadow (offset +2, radius 12) fell outside that frame and was
  // cut off along the bottom edge. Angular's swiper box carries `pb-16` for the
  // same reason; the 16px that used to sit on `bottomRow`'s marginTop is simply
  // moved here, so the card→dots gap is unchanged.
  // paddingTop exists for the same clipping reason as paddingBottom: the card's
  // shadow spreads ~10px ABOVE the card too (radius 12 − offsetY 2), and the
  // ScrollView cut it off flush, drawing a hard straight line across the top of
  // every card. The 12px is taken back off the header's marginBottom below, so
  // the title→cards gap stays Angular's 24px (its header row's pb-24).
  listContent: {
    paddingLeft:   CARD_PAD,
    paddingTop:    12,
    paddingBottom: 16,
  },

  // ── Pagination dots row, centered, separate from the "See all" row ───────
  // Angular: swiper box has class="explore-pagination pb-16" (16px bottom
  // padding) before the dots start — the dots themselves are absolutely
  // offset -25px past that via Swiper.js's own pagination CSS (no clean RN
  // equivalent), landing them visually on the same line as the CTA row right
  // below — reproduced here as one real flex row (dots left, "See all"
  // right) instead of two stacked ones. The 16px card→row gap comes from
  // listContent's paddingBottom, which has to live INSIDE the scroll view so
  // the card shadow isn't clipped — no separate marginTop needed here.
  bottomRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: CARD_PAD,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  // Angular global.scss: .explore-pagination .swiper-pagination-bullet —
  // 5x5 circle, #F4CECE.
  // Size is overridden per-dot by the dynamic-bullet scale ramp in
  // PaginationDots; this is the unscaled (scale-1) baseline.
  dot: {
    width:           DOT_SIZE,
    height:          DOT_SIZE,
    borderRadius:    DOT_SIZE / 2,
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
})
