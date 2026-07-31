// "Profiles who viewed me (N)" carousel (Figma node 1034:1967) — 260-wide
// white cards with a "Viewed you on {date}" pill, plus a "1 New" gradient
// badge in the header when there's fresh activity.
import { StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { CarouselSection } from './DesktopHomeShared'
import ViewedProfileCard from './ViewedProfileCard'
import { Colors } from '../../constants/colors'
import type { SwiperItem } from '../swiper-card/SwiperCard'

const CARD_W = 260
const PHOTO_SIZE = 260

type Props = {
  items: SwiperItem[]
  total: number
  newCount?: number | undefined
  onCardPress: (item: SwiperItem) => void
  onSeeAllPress: () => void
}

export default function WhoViewedMeSection({ items, total, newCount, onCardPress, onSeeAllPress }: Props) {
  return (
    <CarouselSection
      title={`Profiles who viewed me (${total})`}
      headerExtra={
        !!newCount && newCount > 0 ? (
          <LinearGradient colors={['#801c8d', '#e454f7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.newBadge}>
            <Text style={s.newBadgeText}>{newCount} New</Text>
          </LinearGradient>
        ) : null
      }
      data={items}
      cardWidth={CARD_W}
      keyExtractor={(item, i) => item.profileId ?? String(i)}
      onSeeAllPress={onSeeAllPress}
      renderCard={item => (
        <View style={{ width: CARD_W }}>
          <ViewedProfileCard
            item={item}
            cardWidth={CARD_W}
            photoSize={PHOTO_SIZE}
            dateText={item.likedViewedDateText ?? 'Viewed you recently'}
            onPress={() => onCardPress(item)}
          />
        </View>
      )}
    />
  )
}

const s = StyleSheet.create({
  newBadge: {
    borderRadius:      12,
    paddingHorizontal: 10,
    height:            24,
    alignItems:        'center',
    justifyContent:    'center',
  },
  newBadgeText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      Colors.white,
  },
})
