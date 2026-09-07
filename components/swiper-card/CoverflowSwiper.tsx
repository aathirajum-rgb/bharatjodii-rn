// Daily Recommendations' carousel — Angular: home.config.ts's `drmatches`
// config (slidesPerView:1.133, centeredSlides:true, spaceBetween:16,
// pagination:{dynamicMainBullets:2}).
//
// The name is historical: that config also carries a `coverflowEffect` object,
// but the `effect: 'coverflow'` line right above it is COMMENTED OUT, so Swiper
// never loads the coverflow module and the object is dead config. Angular's DR
// slides are FLAT and centered — no rotation, no depth scaling, no fade. This
// component is still separate from SwiperCard because centeredSlides + snapping
// is a genuinely different layout model from the other sections' freeMode
// scroll, and because the card itself (padded white shell + "View profile"
// button) is unique to this section.
import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import CdnSvg from '../cdn-svg/CdnSvg'
import CdnLottie from '../CdnLottie'
import ProfileCard, { PHOTO_HEIGHT } from '../profile-card/ProfileCard'
import { PaginationDots, type SwiperItem } from './SwiperCard'
import { Fonts } from '../../src/theme/fonts'

const SEE_ALL_LINK_COLOR = '#29339B'
const FWD_ICON = `${CDN_SVG}revamp/forward-icon-link.svg`
const CDN_ANIM = `${CDN_SVG}revamp/animation/`

const { width: SW } = Dimensions.get('window')
// Angular: `.card-type-1-padding { width: 86.667vmin; padding: 4.444vmin }` —
// the DR card's width is declared outright on the card (not derived from the
// slide), and it wraps the photo (PHOTO_HEIGHT.dailyrecommendations = 77.78vmin)
// in 16px of padding on every side.
const CARD_WIDTH  = SW * 0.86667
// 16 card padding + photo + 12 (`mt-12`) + 44 button + 16 card padding.
const CARD_HEIGHT = PHOTO_HEIGHT.dailyrecommendations + 88
const CARD_GAP    = 16
const SNAP         = CARD_WIDTH + CARD_GAP
const SIDE_INSET   = (SW - CARD_WIDTH) / 2

export interface CoverflowSwiperProps {
  swiperHeader?: string | undefined
  items: SwiperItem[]
  moreItems?: { THUMBIMG: string }[] | undefined
  onCardPress?: ((item: SwiperItem, index: number) => void) | undefined
  onLikePress?: ((item: SwiperItem, index: number) => void) | undefined
  onSeeAllPress?: (() => void) | undefined
  // Photo-protected/no-photo overlay's WhatsApp CTA — see ProfilePhoto.tsx.
  onWhatsAppPress?: ((item: SwiperItem, index: number) => void) | undefined
}

export default function CoverflowSwiper({
  swiperHeader, items, moreItems, onCardPress, onLikePress, onSeeAllPress, onWhatsAppPress,
}: CoverflowSwiperProps) {
  const { t } = useTranslation()
  const scrollX = useRef(new Animated.Value(0)).current
  const [activeIndex, setActiveIndex] = useState(0)

  // PaginationDots needs a plain JS number, not an Animated.Value — mirrors
  // this same listener pattern SwiperCard.tsx's own handleScroll uses, just
  // driven off the Animated value instead of a raw onScroll callback since
  // the transforms below need the native-driven Animated.event.
  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      setActiveIndex(Math.max(0, Math.min(Math.round(value / SNAP), items.length - 1)))
    })
    return () => scrollX.removeListener(id)
  }, [scrollX, items.length])

  const showSeeAll = !!onSeeAllPress
  const slideCount = items.length + (showSeeAll && moreItems && moreItems.length > 1 ? 1 : 0)

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: true },
  )

  // Flat slides, deliberately. home.config.ts's drmatches block has
  // `// effect: 'coverflow',` COMMENTED OUT — without that line Swiper never
  // activates the coverflow module, so its `coverflowEffect: {rotate: 33,
  // depth: 100, ...}` object is inert config and Angular renders plain
  // centeredSlides. This component previously read that dead config as live and
  // applied a rotateY/scale/opacity/overlap treatment Angular never shows.
  function renderCard(index: number, node: React.ReactNode) {
    return (
      <View
        key={index}
        style={[styles.card, { marginRight: index === slideCount - 1 ? 0 : CARD_GAP }]}
      >
        {node}
      </View>
    )
  }

  if (items.length === 0) return null

  return (
    <View>
      {/* Angular: app-swiper.component.html's header — dailyrecommendations
          is the one section whose header is center-aligned, not left. Two
          mirrored today-matches-animation.json Lotties sit behind it as
          decoration (absolute, left/right, one rotated 50deg) — both were
          missing entirely before this fix. (new-tag-animation.json, the
          OTHER animation this section's header area references, stays
          skipped — its <lottie-player> is commented out in the live
          template, genuinely dead code, not an omission.) */}
      <View style={styles.headerWrap}>
        <CdnLottie uri={`${CDN_ANIM}today-matches-animation.json`} width={180} height={180} style={styles.headerAnimLeft} />
        <CdnLottie uri={`${CDN_ANIM}today-matches-animation.json`} width={180} height={180} style={styles.headerAnimRight} />
        {!!swiperHeader && <Text style={styles.header}>{swiperHeader}</Text>}
      </View>

      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SNAP}
        // The vertical padding is what lets the card's shadow render: a
        // ScrollView clips content to its frame, and with the track exactly as
        // tall as a card the shadow (Angular: box-shadow 0 0 7px) was cut off
        // flush along the top and bottom edges.
        contentContainerStyle={{ paddingHorizontal: SIDE_INSET, paddingVertical: 8 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {items.map((item, index) => renderCard(index, (
          <ProfileCard
            variant={1}
            section="dailyrecommendations"
            profileId={item.profileId}
            name={item.name}
            age={item.age}
            education={item.education}
            profileImg={item.profileImg}
            avatarImg={item.avatarImg}
            isPhotoAvailable={item.isPhotoAvailable}
            isPhotoProtect={item.isPhotoProtect}
            isAddPhotoRequest={item.isAddPhotoRequest}
            showReqPhotoElement={item.showReqPhotoElement}
            isNewlyJoined={item.isNewlyJoined}
            likedStatus={item.likedStatus}
            onPress={() => onCardPress?.(item, index)}
            onLikePress={() => onLikePress?.(item, index)}
            onWhatsApp={() => onWhatsAppPress?.(item, index)}
          />
        )))}

        {showSeeAll && moreItems && moreItems.length > 1 && renderCard(items.length, (
          <ProfileCard
            variant={5}
            section="dailyrecommendations"
            viewMoreList={moreItems}
            viewMoreContent={t('HOME.SEE_ALL_CTA')}
            onViewMorePress={onSeeAllPress}
          />
        ))}
      </Animated.ScrollView>

      {(items.length > 1 || showSeeAll) && (
        <View style={styles.bottomRow}>
          <PaginationDots total={slideCount} activeIndex={activeIndex} maxVisible={2} />
          {showSeeAll && (
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

const styles = StyleSheet.create({
  headerWrap: { position: 'relative' },
  // Angular: .animations-position { position:absolute; left:0; top:0 }
  headerAnimLeft:  { position: 'absolute', left: 0, top: 0 },
  // Angular: .animations-position-right { position:absolute; right:0; top:0 }
  // — same animation, mirrored via rotate(50deg).
  headerAnimRight: { position: 'absolute', right: 0, top: 0, transform: [{ rotate: '50deg' }] },
  header: {
    fontFamily:  Fonts.poppinsSemiBold,
    fontSize:    18,
    color:       Colors.textPrimary,
    textAlign:   'center',
    marginBottom: 32,
  },
  card: {
    width:  CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  // Angular: same shared app-swiper "explore-pagination" row every other
  // section uses (dots left, "See all" right) — this component's own
  // coverflowEffect config only changes the CARD track's layout, not this
  // row underneath it. Previously centered here, unlike SwiperCard.tsx's
  // correct space-between — 24px matches that component's own CARD_PAD.
  bottomRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 24,
    marginTop:         16,
  },
  seeAllBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontSize: 13, color: SEE_ALL_LINK_COLOR, fontWeight: '600' },
})
