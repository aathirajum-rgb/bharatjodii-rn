// White-card-with-photo-header pattern shared by "Profiles who viewed me"
// (Figma 1034:1967) and "Profiles you viewed" (Figma 1034:4683) — same
// structure (photo w/ scrim + date pill overlay, then name/age/link in a
// white body below), just different photo size and date-pill wording.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { PhotoOverlayCard, useOppGenderAvatarUrl } from './DesktopHomeShared'
import { EyeDatePill, ViewProfileLink, VerifiedCheckmark } from './CardBits'
import { Colors } from '../../constants/colors'
import type { SwiperItem } from '../swiper-card/SwiperCard'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

type Props = {
  item: SwiperItem
  cardWidth: number
  photoSize: number
  dateText: string
  onPress: () => void
}

export default function ViewedProfileCard({ item, cardWidth, photoSize, dateText, onPress }: Props) {
  const avatarFallback = useOppGenderAvatarUrl()

  return (
    <Pressable style={[s.card, { width: cardWidth }]} onPress={onPress}>
      <View style={s.photoWrap}>
        <PhotoOverlayCard
          width={photoSize}
          height={photoSize}
          fallback={<CdnSvg uri={avatarFallback} width={photoSize * 0.4} height={photoSize * 0.4} />}
          photoUri={item.profileImg}
        />
        <View style={s.pillWrap}>
          <EyeDatePill text={dateText} />
        </View>
      </View>
      <View style={s.body}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>{item.name}</Text>
          {item.isIdVerified && <VerifiedCheckmark />}
        </View>
        <Text style={s.meta} numberOfLines={1}>
          {[item.age, item.education].filter(Boolean).join(', ')}
        </Text>
        <ViewProfileLink onPress={onPress} />
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius:    12,
    shadowColor:     '#000000',
    shadowOpacity:   0.34,
    shadowRadius:    12,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       4,
  },
  photoWrap: { position: 'relative' },
  pillWrap:  { position: 'absolute', left: 12, bottom: 12 },
  body:      { padding: 16, gap: 4 },
  nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black },
  meta: { fontFamily: SemanticFontsEnglish.subheadingEnglishRegular, fontSize: 14, lineHeight: 16, color: '#372f3a' },
})
