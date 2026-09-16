// "Got married through Jodii" success stories (Figma node 1034:6363) — a
// fixed row of 3 story cards + a 4th "See all" card with an overlapping
// avatar stack. No carousel/pagination — Figma caps this row at 3 stories.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SectionHeader } from './DesktopHomeShared'
import { Colors } from '../../constants/colors'
import type { SwiperItem } from '../swiper-card/SwiperCard'
import { SemanticFontsEnglish } from '../../src/theme/fonts'

const CARD_W = 260
const CARD_H = 352
const PHOTO_H = 260

type Props = {
  stories: SwiperItem[]
  onStoryPress: (item: SwiperItem) => void
  onSeeAllPress: () => void
  onHeaderPress?: (() => void) | undefined
}

export default function SuccessStoriesSection({ stories, onStoryPress, onSeeAllPress, onHeaderPress }: Props) {
  if (stories.length === 0) return null
  const visible = stories.slice(0, 3)
  const avatarSources = stories.slice(0, 3).map(s => s.profileImg).filter((u): u is string => !!u)

  return (
    <View style={s.section}>
      <View style={s.header}>
        <SectionHeader title="Got married through BharatJodii" onPress={onHeaderPress} />
        <Text style={s.subtitle}>Thousands have met their life partner through BharatJodii</Text>
      </View>

      <View style={s.row}>
        {visible.map((item, i) => (
          <Pressable key={item.profileId ?? i} style={s.card} onPress={() => onStoryPress(item)}>
            {!!item.profileImg && <Image source={{ uri: item.profileImg }} style={s.photo} resizeMode="cover" />}
            <View style={s.body}>
              <Text style={s.name} numberOfLines={1}>{item.name}</Text>
              <Text style={s.location} numberOfLines={1}>{item.location}</Text>
              <Text style={s.date} numberOfLines={1}>{item.date}</Text>
            </View>
          </Pressable>
        ))}

        <Pressable style={s.seeAllCard} onPress={onSeeAllPress}>
          <LinearGradient colors={['#fff1ff', '#ffffff']} style={StyleSheet.absoluteFill} />
          <View style={s.avatarStack}>
            {avatarSources.map((uri, i) => (
              <Image key={i} source={{ uri }} style={[s.avatar, { marginLeft: i === 0 ? 0 : -24 }]} />
            ))}
          </View>
          <View style={s.seeAllRow}>
            <Text style={s.seeAllText}>See all</Text>
            <Text style={s.seeAllChevron}>{'›'}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  section: {
    backgroundColor:   '#fef2f6',
    paddingTop:        80,
    paddingBottom:     40,
    paddingHorizontal: 24,
    borderRadius:      16,
    gap:               24,
    overflow:          'hidden',
  },

  header:   { gap: 4 },
  subtitle: { fontFamily: SemanticFontsEnglish.subheadingEnglishRegular, fontSize: 16, lineHeight: 20, color: Colors.black, paddingHorizontal: 12 },

  row: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  card: {
    width:           CARD_W,
    height:          CARD_H,
    backgroundColor: Colors.white,
    borderRadius:    12,
    overflow:        'hidden',
    shadowColor:     '#000000',
    shadowOpacity:   0.1,
    shadowRadius:    15,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       2,
  },
  photo: { width: CARD_W, height: PHOTO_H },
  body:  { padding: 16, gap: 4 },
  name:     { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 16, color: Colors.black },
  location: { fontFamily: SemanticFontsEnglish.subheadingEnglishRegular, fontSize: 14, color: Colors.black },
  date:     { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: '#545454', marginTop: 8 },

  seeAllCard: {
    width:           CARD_W,
    height:          CARD_H - 4,
    borderRadius:    12,
    overflow:        'hidden',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             16,
  },
  avatarStack: { flexDirection: 'row' },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 3, borderColor: Colors.white,
  },
  seeAllRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.link },
  seeAllChevron: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 16, color: Colors.link },
})
