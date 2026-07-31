// "Newly joined (N)" carousel (Figma node 1034:4605) — 280×280 photo cards,
// "Newly Joined" badge top-left, name (+ optional verified checkmark) and
// age/education overlaid on a bottom scrim.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { CarouselSection, PhotoOverlayCard, useOppGenderAvatarUrl } from './DesktopHomeShared'
import { NewlyJoinedBadge, VerifiedCheckmark } from './CardBits'
import { Colors } from '../../constants/colors'
import type { SwiperItem } from '../swiper-card/SwiperCard'

const CARD_W = 280
const CARD_H = 280

type Props = {
  items: SwiperItem[]
  total: number
  onCardPress: (item: SwiperItem) => void
  onSeeAllPress: () => void
}

export default function NewlyJoinedSection({ items, total, onCardPress, onSeeAllPress }: Props) {
  const avatarFallback = useOppGenderAvatarUrl()

  return (
    <CarouselSection
      title={`Newly joined (${total})`}
      data={items}
      cardWidth={CARD_W}
      keyExtractor={(item, i) => item.profileId ?? String(i)}
      onSeeAllPress={onSeeAllPress}
      renderCard={item => (
        <Pressable onPress={() => onCardPress(item)}>
          <View>
            <PhotoOverlayCard
              width={CARD_W}
              height={CARD_H}
              borderRadius={12}
              photoUri={item.profileImg}
              fallback={<CdnSvg uri={avatarFallback} width={CARD_W * 0.4} height={CARD_W * 0.4} />}
              topLeftBadge={<NewlyJoinedBadge />}
            />
            <View style={s.textWrap}>
              <View style={s.nameRow}>
                <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                {item.isIdVerified && <VerifiedCheckmark />}
              </View>
              <Text style={s.age} numberOfLines={1}>
                {[item.age, item.education].filter(Boolean).join(', ')}
              </Text>
            </View>
          </View>
        </Pressable>
      )}
    />
  )
}

const s = StyleSheet.create({
  // Overlaid directly on PhotoOverlayCard's own scrim (absolute, bottom-left)
  // rather than PhotoOverlayCard's built-in name/age slot, since this section
  // additionally needs the verified-checkmark next to the name.
  textWrap: { position: 'absolute', left: 16, bottom: 12, right: 16 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.white },
  age:  { fontFamily: 'Poppins-Regular', fontSize: 14, lineHeight: 16, color: Colors.white, marginTop: 2 },
})
