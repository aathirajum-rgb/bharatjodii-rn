// Angular: home.config.ts's drmatches swiper config — the ONLY section on
// Home with `coverflowEffect` (slidesPerView:1.133, centeredSlides:true,
// coverflowEffect:{rotate:33, stretch:0, depth:100, modifier:1,
// slideShadows:false}, pagination:{dynamicMainBullets:2}). Every other
// section's config is a flat freeMode scroll (SwiperCard.tsx) — this is a
// dedicated component rather than a SwiperCard variant because the layout
// model (centered active slide, neighbors rotated/receded at the edges) is
// fundamentally different, not just a style tweak.
//
// Swiper.js's real coverflow math projects each slide in true 3D (CSS
// perspective + translateZ). RN has no cheap equivalent of translateZ-driven
// depth stacking, so "depth:100" is approximated here with a scale shrink on
// off-center slides instead — the same approximation most RN coverflow
// implementations (e.g. react-native-snap-carousel's 'stack' layout) use.
import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import CdnSvg from '../cdn-svg/CdnSvg'
import CdnLottie from '../CdnLottie'
import ProfileCard, { PHOTO_HEIGHT } from '../profile-card/ProfileCard'
import { PaginationDots, type SwiperItem } from './SwiperCard'

const SEE_ALL_LINK_COLOR = '#29339B'
const FWD_ICON = `${CDN_SVG}revamp/forward-icon-link.svg`
const CDN_ANIM = `${CDN_SVG}revamp/animation/`

const { width: SW } = Dimensions.get('window')
// ProfileCard's own case-1 "isDR" branch sizes the photo itself via
// PHOTO_HEIGHT.dailyrecommendations (Angular: confirmed 80.667vmin, not a
// Figma-drift case here) — the card's WIDTH must match that exactly, or the
// photo stretches out of square inside a wrapper sized off a different ratio.
const CARD_WIDTH  = PHOTO_HEIGHT.dailyrecommendations
// Figma get_design_context on the card: 16px gap + 44px "View profile"
// button + 16px bottom padding below the square photo.
const CARD_HEIGHT = CARD_WIDTH + 76
const CARD_GAP    = 16
const SNAP         = CARD_WIDTH + CARD_GAP
const SIDE_INSET   = (SW - CARD_WIDTH) / 2

// Angular: coverflowEffect.rotate — max tilt in degrees for the immediate
// neighbor slides.
const ROTATE_DEG = 33
// Approximates coverflowEffect.depth (real translateZ push-back) as a scale
// shrink instead — RN has no cheap 3D depth-stacking equivalent.
const DEPTH_SCALE = 0.88
const OVERLAP_PX  = 18

export interface CoverflowSwiperProps {
  swiperHeader?: string | undefined
  items: SwiperItem[]
  moreItems?: { THUMBIMG: string }[] | undefined
  onCardPress?: ((item: SwiperItem, index: number) => void) | undefined
  onLikePress?: ((item: SwiperItem, index: number) => void) | undefined
  onSeeAllPress?: (() => void) | undefined
}

export default function CoverflowSwiper({
  swiperHeader, items, moreItems, onCardPress, onLikePress, onSeeAllPress,
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

  function renderCard(index: number, node: React.ReactNode) {
    const center = index * SNAP
    const inputRange = [center - SNAP, center, center + SNAP]
    const rotateY = scrollX.interpolate({
      inputRange, outputRange: [`${ROTATE_DEG}deg`, '0deg', `-${ROTATE_DEG}deg`], extrapolate: 'clamp',
    })
    const scale = scrollX.interpolate({
      inputRange, outputRange: [DEPTH_SCALE, 1, DEPTH_SCALE], extrapolate: 'clamp',
    })
    const translateX = scrollX.interpolate({
      inputRange, outputRange: [-OVERLAP_PX, 0, OVERLAP_PX], extrapolate: 'clamp',
    })
    const opacity = scrollX.interpolate({
      inputRange, outputRange: [0.85, 1, 0.85], extrapolate: 'clamp',
    })

    return (
      <Animated.View
        key={index}
        style={[
          styles.card,
          {
            marginRight: index === slideCount - 1 ? 0 : CARD_GAP,
            opacity,
            transform: [
              { perspective: 800 },
              { translateX },
              { rotateY },
              { scale },
            ],
          },
        ]}
      >
        {node}
      </Animated.View>
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
        contentContainerStyle={{ paddingHorizontal: SIDE_INSET }}
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
    fontFamily:  'Poppins-SemiBold',
    fontSize:    18,
    color:       Colors.textPrimary,
    textAlign:   'center',
    marginBottom: 32,
  },
  card: {
    width:  CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  bottomRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               12,
    marginTop:         16,
  },
  seeAllBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontSize: 13, color: SEE_ALL_LINK_COLOR, fontWeight: '600' },
})
