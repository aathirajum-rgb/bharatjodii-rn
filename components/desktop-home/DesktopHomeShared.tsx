// Shared building blocks reused across every section of the desktop Home
// screen (Figma "Jodii Desktop - Registration", node 1034:802 "Jodii Homepage").
// Extracted once here since the same 3 patterns repeat near-identically across
// all 12 main-content sections: a section title + trailing chevron header, a
// "See all" link + chevron footer item, and a fading-dot carousel pagination
// indicator.
import { useEffect, useState, type ReactNode } from 'react'
import {
  FlatList, Image, Pressable, StyleSheet, Text, View,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '../../constants/colors'
import { getOppGenderAvatarUrl, FEMALE_AVATAR_URL } from '../../utils/avatar'

// Angular: getAvatarImage(profile) → getAvatarImg(getOppGenderType()) — a card
// with no real photo falls back to the opposite gender's silhouette. Shared
// hook since nearly every carousel section needs this same fallback lookup.
export function useOppGenderAvatarUrl(): string {
  const [url, setUrl] = useState(FEMALE_AVATAR_URL)
  useEffect(() => {
    let cancelled = false
    getOppGenderAvatarUrl().then(u => { if (!cancelled) setUrl(u) })
    return () => { cancelled = true }
  }, [])
  return url
}

// ─── Local asset helper ───────────────────────────────────────────────────────
// CdnSvg (components/cdn-svg/CdnSvg.tsx) takes a URI string for both its web
// (<Image>) and native (<SvgUri>) paths. On native, react-native's real
// Image.resolveAssetSource() turns a require()'d local file into that kind of
// URI. react-native-web has no such static method (confirmed by crash — throws
// "resolveAssetSource is not a function") since Metro's web asset plugin
// already resolves require() itself, to that same {uri, width, height} shape.
export function localAsset(mod: number): string {
  if (typeof Image.resolveAssetSource === 'function') {
    return Image.resolveAssetSource(mod).uri
  }
  const resolved = mod as unknown as string | { uri: string }
  return typeof resolved === 'string' ? resolved : resolved.uri
}

// ─── Section header: title + trailing chevron ────────────────────────────────
// Figma: `Poppins SemiBold`, 22px, #000000, paired with a 40×40 chevron
// (rotated -90° from a shared "Icon - Backarrow" base) — repeats on nearly
// every section (sections 4-9, 11-13 in the spec).
export function SectionHeader({ title, onPress }: { title: string; onPress?: (() => void) | undefined }) {
  return (
    <Pressable style={s.header} onPress={onPress} disabled={!onPress}>
      <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={s.headerChevron}>
        <Text style={s.chevronGlyph}>{'›'}</Text>
      </View>
    </Pressable>
  )
}

// ─── "See all" link + chevron ─────────────────────────────────────────────────
// Figma: `Poppins Regular`, 16px, #29339b, 20×20 trailing chevron — repeats
// verbatim across sections 4, 5, 7, 8, 9, 10, 13 (section 11 varies the
// wording to "Discover all categories", section 12 nests it inside its 4th
// card — both still use this same component via a custom `label`).
export function SeeAllLink({ label = 'See all', onPress }: { label?: string | undefined; onPress: () => void }) {
  return (
    <Pressable style={s.seeAll} onPress={onPress}>
      <Text style={s.seeAllText}>{label}</Text>
      <Text style={s.seeAllChevron}>{'›'}</Text>
    </Pressable>
  )
}

// ─── Fading-dot carousel pagination ───────────────────────────────────────────
// Figma: a 5-dot indicator — active dot is a `#b50033` 24×8px pill; inactive
// dots shrink progressively (8px, 6px, 4px, 2px) moving away from active,
// using `#f4cece`. Identical (down to node structure) across sections 4, 5,
// 7, 8, 9, 10, 13 — same "windowed dynamic bullets" concept already built for
// mobile's SwiperCard.tsx, ported here for the desktop carousels.
export function FadingDotPagination({ total, activeIndex }: { total: number; activeIndex: number }) {
  if (total <= 1) return null
  const maxVisible = 5
  const half = Math.floor(maxVisible / 2)
  let start = Math.max(0, Math.min(activeIndex - half, total - maxVisible))
  start = Math.max(0, start)
  const end = Math.min(total, start + maxVisible)
  const indices = Array.from({ length: end - start }, (_, i) => start + i)

  return (
    <View style={s.dotsRow}>
      {indices.map(i => {
        const distance = Math.abs(i - activeIndex)
        return (
          <View
            key={i}
            style={[
              s.dot,
              i === activeIndex && s.dotActive,
              i !== activeIndex && distance >= 2 && s.dotSmall,
            ]}
          />
        )
      })}
    </View>
  )
}

// ─── Section footer row: pagination (left) + "See all" (right) ───────────────
export function SectionFooter({
  total, activeIndex, seeAllLabel, onSeeAllPress,
}: { total: number; activeIndex: number; seeAllLabel?: string | undefined; onSeeAllPress: () => void }) {
  return (
    <View style={s.footerRow}>
      <FadingDotPagination total={total} activeIndex={activeIndex} />
      <SeeAllLink label={seeAllLabel} onPress={onSeeAllPress} />
    </View>
  )
}

// ─── Full carousel section: header + horizontally-scrolling card row + footer ─
// Shared shell for every "N cards in a row, swipeable, fading-dot pagination"
// section (All matches, Profiles who viewed me, Today's matches, Newly joined,
// Profiles you viewed, Liked profiles) — mirrors mobile SwiperCard.tsx's own
// onScroll-tracked (not onMomentumScrollEnd, unreliable on react-native-web)
// active-index approach, just with each section supplying its own card visuals
// instead of a fixed ProfileCard variant.
export function CarouselSection<T>({
  title, headerExtra, data, cardWidth, gap = 16, keyExtractor, renderCard,
  onHeaderPress, seeAllLabel, onSeeAllPress,
}: {
  title: string
  headerExtra?: ReactNode | undefined
  data: T[]
  cardWidth: number
  gap?: number | undefined
  keyExtractor: (item: T, index: number) => string
  renderCard: (item: T, index: number) => ReactNode
  onHeaderPress?: (() => void) | undefined
  seeAllLabel?: string | undefined
  onSeeAllPress: () => void
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + gap))
    setActiveIndex(Math.max(0, Math.min(idx, data.length - 1)))
  }

  if (data.length === 0) return null

  return (
    <View style={{ gap: 24 }}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
          {headerExtra}
        </View>
        <Pressable style={s.headerChevron} onPress={onHeaderPress} disabled={!onHeaderPress}>
          <Text style={s.chevronGlyph}>{'›'}</Text>
        </Pressable>
      </View>

      <FlatList
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={keyExtractor}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingLeft: 12, gap }}
        renderItem={({ item, index }) => <>{renderCard(item, index)}</>}
      />

      <SectionFooter
        total={data.length}
        activeIndex={activeIndex}
        seeAllLabel={seeAllLabel}
        onSeeAllPress={onSeeAllPress}
      />
    </View>
  )
}

// ─── Bottom-anchored photo-card gradient scrim ────────────────────────────────
// Figma: nearly every profile/photo card (sections 4, 5, 7, 8, 9, 10, 12, 13)
// uses a bottom-anchored dark gradient to keep overlaid white text legible,
// with the exact start-% and end-alpha drifting slightly per section (44–62%
// start, 0.8–1.0 end alpha) in what reads as incidental variation rather than
// deliberate design. Standardized to one canonical scrim reused everywhere.
export const CARD_SCRIM_COLORS: [string, string] = ['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']

// ─── Full-bleed photo card: photo + bottom scrim + overlaid name/age ─────────
// Shared visual for sections whose cards have NO separate white body below the
// photo (All matches, Newly joined) — name/age sit directly on the gradient
// scrim. Sections with a white card body below the photo (Who viewed me,
// Today's matches, Profiles you viewed) build their own layout instead, since
// that body content differs too much per section to share profitably.
export function PhotoOverlayCard({
  width, height, borderRadius = 16, photoUri, fallback, name, age, topLeftBadge,
}: {
  width: number
  height: number
  borderRadius?: number | undefined
  photoUri?: string | undefined
  fallback?: ReactNode | undefined
  name?: string | undefined
  age?: string | undefined
  topLeftBadge?: ReactNode | undefined
}) {
  return (
    <View style={[o.card, { width, height, borderRadius }]}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={o.photo} resizeMode="cover" />
      ) : (
        <View style={[o.photo, o.fallbackWrap]}>{fallback}</View>
      )}
      <LinearGradient colors={CARD_SCRIM_COLORS} style={o.scrim} pointerEvents="none" />
      {!!topLeftBadge && <View style={o.topLeftBadge}>{topLeftBadge}</View>}
      <View style={o.textWrap}>
        {!!name && <Text style={o.name} numberOfLines={1}>{name}</Text>}
        {!!age && <Text style={o.age} numberOfLines={1}>{age}</Text>}
      </View>
    </View>
  )
}

const o = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: Colors.surfaceInput },
  photo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fallbackWrap: { alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  topLeftBadge: { position: 'absolute', top: 8, left: 8 },
  textWrap: { position: 'absolute', left: 16, bottom: 12, right: 16 },
  name: { fontFamily: 'Poppins-Medium', fontSize: 16, lineHeight: 16, color: Colors.white },
  age:  { fontFamily: 'Poppins-Regular', fontSize: 14, lineHeight: 16, color: Colors.white, marginTop: 2 },
})

const s = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 12,
    width:             '100%',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    flexShrink:    1,
  },
  headerTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   22,
    color:      Colors.textStrong,
    flexShrink: 1,
  },
  headerChevron: {
    width:          40,
    height:         40,
    alignItems:     'center',
    justifyContent: 'center',
  },
  chevronGlyph: {
    fontSize:   22,
    color:      Colors.textStrong,
    fontFamily: 'Poppins-Regular',
  },

  seeAll: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  seeAllText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   16,
    color:      Colors.link,
  },
  seeAllChevron: {
    fontSize:   18,
    fontFamily: 'Poppins-SemiBold',
    color:      Colors.link,
  },

  footerRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingLeft:       12,
    width:             '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: '#f4cece',
  },
  dotActive: {
    width:           24,
    height:          8,
    borderRadius:    100,
    backgroundColor: Colors.primaryDark,
  },
  dotSmall: {
    width:        4,
    height:       4,
    borderRadius: 2,
  },
})
