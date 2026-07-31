// "All matches (N)" carousel (Figma node 1034:1927) — 180×180 photo cards,
// name/age overlaid on a bottom scrim, fading-dot pagination + "See all".
import { Pressable } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { CarouselSection, PhotoOverlayCard, useOppGenderAvatarUrl } from './DesktopHomeShared'
import type { SwiperItem } from '../swiper-card/SwiperCard'

const CARD_W = 180
const CARD_H = 180

type Props = {
  items: SwiperItem[]
  total: number
  onCardPress: (item: SwiperItem) => void
  onSeeAllPress: () => void
}

export default function AllMatchesSection({ items, total, onCardPress, onSeeAllPress }: Props) {
  const avatarFallback = useOppGenderAvatarUrl()

  return (
    <CarouselSection
      title={`All matches (${total})`}
      data={items}
      cardWidth={CARD_W}
      keyExtractor={(item, i) => item.profileId ?? String(i)}
      onSeeAllPress={onSeeAllPress}
      renderCard={item => (
        <Pressable onPress={() => onCardPress(item)}>
          <PhotoOverlayCard
            width={CARD_W}
            height={CARD_H}
            photoUri={item.profileImg}
            fallback={<CdnSvg uri={avatarFallback} width={CARD_W * 0.4} height={CARD_W * 0.4} />}
            name={item.name}
            age={item.age}
          />
        </Pressable>
      )}
    />
  )
}
