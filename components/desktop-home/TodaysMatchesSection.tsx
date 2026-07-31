// "Today's matches (N)" carousel (Figma node 1034:4498) — Daily Recommendations:
// 312×372 white cards, 280×280 inset photo w/ "Newly Joined" badge + name/age
// overlay, and a solid "View profile" button below.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { CarouselSection, PhotoOverlayCard, useOppGenderAvatarUrl } from './DesktopHomeShared'
import { NewlyJoinedBadge } from './CardBits'
import { Colors } from '../../constants/colors'
import type { SwiperItem } from '../swiper-card/SwiperCard'

const CARD_W = 312
const PHOTO_SIZE = 280

type Props = {
  items: SwiperItem[]
  total: number
  onCardPress: (item: SwiperItem) => void
  onSeeAllPress: () => void
}

export default function TodaysMatchesSection({ items, total, onCardPress, onSeeAllPress }: Props) {
  const avatarFallback = useOppGenderAvatarUrl()

  return (
    <CarouselSection
      title={`Today's matches (${total})`}
      data={items}
      cardWidth={CARD_W}
      gap={24}
      keyExtractor={(item, i) => item.profileId ?? String(i)}
      onSeeAllPress={onSeeAllPress}
      renderCard={item => (
        <View style={[s.card, { width: CARD_W }]}>
          <View style={s.photoInset}>
            <PhotoOverlayCard
              width={PHOTO_SIZE}
              height={PHOTO_SIZE}
              photoUri={item.profileImg}
              fallback={<CdnSvg uri={avatarFallback} width={PHOTO_SIZE * 0.4} height={PHOTO_SIZE * 0.4} />}
              topLeftBadge={item.isNewlyJoined ? <NewlyJoinedBadge /> : undefined}
              name={item.name}
              age={[item.age, item.education].filter(Boolean).join(', ')}
            />
          </View>
          <Pressable style={s.viewBtn} onPress={() => onCardPress(item)}>
            <Text style={s.viewBtnText}>View profile</Text>
          </Pressable>
        </View>
      )}
    />
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius:    12,
    padding:         16,
    shadowColor:     '#000000',
    shadowOpacity:   0.15,
    shadowRadius:    7,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       2,
    gap:             16,
  },
  photoInset: {},
  viewBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius:    8,
    height:          44,
    alignItems:      'center',
    justifyContent:  'center',
  },
  viewBtnText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   14,
    color:      Colors.white,
  },
})
