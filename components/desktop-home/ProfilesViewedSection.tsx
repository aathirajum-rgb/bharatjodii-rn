// "Profiles you viewed (N)" carousel (Figma node 1034:4683) — same white-card
// pattern as WhoViewedMeSection, smaller 220 photo and "You viewed on" wording.
import { View } from 'react-native'
import { CarouselSection } from './DesktopHomeShared'
import ViewedProfileCard from './ViewedProfileCard'
import type { SwiperItem } from '../swiper-card/SwiperCard'

const CARD_W = 220
const PHOTO_SIZE = 220

type Props = {
  items: SwiperItem[]
  total: number
  onCardPress: (item: SwiperItem) => void
  onSeeAllPress: () => void
}

export default function ProfilesViewedSection({ items, total, onCardPress, onSeeAllPress }: Props) {
  return (
    <CarouselSection
      title={`Profiles you viewed (${total})`}
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
            dateText={item.likedViewedDateText ?? 'You viewed recently'}
            onPress={() => onCardPress(item)}
          />
        </View>
      )}
    />
  )
}
