// Desktop-web replacement for SwiperCard/ProfileCard on the Home screen.
// ProfileCard.tsx (used by mobile's SwiperCard) sizes its photo height and
// card width directly from `Dimensions.get('window').width` — correct on a
// real mobile viewport, but on a wide desktop browser that constant is the
// full window width (e.g. 1440px), producing ~800×1120px cards with no way
// to override it via props. Same root problem MatchesDesktopLayout.tsx hit
// with mobile's MatchesCard — solved there with a dedicated MatchCardDesktop;
// this is that same fix for Home's simpler swiper sections (small square
// photo + name + age/education, no like/call/whatsapp actions).
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import type { SwiperItem } from './SwiperCard'

const AVATAR_FB = CDN_SVG + 'default-profile.svg'

export interface SwiperCardDesktopProps {
  swiperHeader?: string | undefined
  newCount?:     number | undefined
  items:         SwiperItem[]
  cardWidth?:    number | undefined
  cardHeight?:   number | undefined
  showSeeAll?:   boolean | undefined
  onCardPress?:  ((item: SwiperItem) => void) | undefined
  onSeeAllPress?: (() => void) | undefined
}

const DEFAULT_CARD_W = 180
const DEFAULT_CARD_H = 180

export default function SwiperCardDesktop({
  swiperHeader, newCount, items, cardWidth = DEFAULT_CARD_W, cardHeight = DEFAULT_CARD_H,
  showSeeAll = true, onCardPress, onSeeAllPress,
}: SwiperCardDesktopProps) {
  if (!items || items.length === 0) return null

  return (
    <View>
      {(!!swiperHeader || newCount !== undefined) && (
        <View style={s.header}>
          <View style={s.headerLeft}>
            {!!swiperHeader && <Text style={s.headerTitle}>{swiperHeader}</Text>}
            {typeof newCount === 'number' && newCount > 0 && (
              <View style={s.countBadge}>
                <Text style={s.countText}>{newCount > 99 ? '99+' : newCount}</Text>
              </View>
            )}
          </View>
          {showSeeAll && !!onSeeAllPress && (
            <Pressable onPress={onSeeAllPress}>
              <Text style={s.seeAllText}>See All →</Text>
            </Pressable>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {items.map((item, idx) => {
          const captionText = item.isNewLabel ? item.labelContent : (item.likedViewedDateText ?? item.date)
          return (
            <Pressable
              key={item.profileId ?? idx}
              style={[s.card, { width: cardWidth }]}
              onPress={() => onCardPress?.(item)}
            >
              <View style={[s.photoBox, { width: cardWidth, height: cardHeight }]}>
                {item.profileImg ? (
                  <Image source={{ uri: item.profileImg }} style={s.photoImg} resizeMode="cover" />
                ) : (
                  <View style={s.photoFallback}>
                    <CdnSvg uri={AVATAR_FB} width={cardWidth * 0.4} height={cardWidth * 0.4} />
                  </View>
                )}
                {item.isNewlyJoined && (
                  <View style={s.newBadge}><Text style={s.newBadgeText}>New</Text></View>
                )}
              </View>
              {!!captionText && <Text style={s.caption} numberOfLines={1}>{captionText}</Text>}
              <Text style={s.name} numberOfLines={1}>{item.name}</Text>
              <Text style={s.meta} numberOfLines={1}>
                {[item.age, item.education, item.location].filter(Boolean).join(', ')}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: Colors.textPrimary },
  countBadge: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  countText: { fontFamily: 'Poppins-SemiBold', fontSize: 11, color: Colors.white },
  seeAllText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.primary },

  row: { gap: 12 },
  card: {},
  photoBox: { borderRadius: 10, overflow: 'hidden', backgroundColor: Colors.surfaceInput, position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  photoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  newBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: Colors.primary, borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  newBadgeText: { fontFamily: 'Poppins-SemiBold', fontSize: 10, color: Colors.white },

  caption: { fontFamily: 'Poppins-Regular', fontSize: 11, color: Colors.textSecondary, marginTop: 8 },
  name:    { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.textPrimary, marginTop: 4 },
  meta:    { fontFamily: 'Poppins-Regular', fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
})
