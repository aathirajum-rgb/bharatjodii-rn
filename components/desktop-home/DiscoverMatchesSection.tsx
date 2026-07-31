// "Explore matches based on" category grid (Figma node 1034:6310) — a
// fixed 4-up wrapping grid (no carousel/pagination), each tile a photo over a
// tinted label bar. Unlike mobile's ExploreCategoriesSection (icon centered in
// a solid/gradient tile), Figma's desktop tile is a real category photo on
// top of a bordered label strip — so this doesn't reuse that component.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { SectionHeader, SeeAllLink } from './DesktopHomeShared'
import type { ExploreCategory } from '../../service/homeService'

const TILE_W = 180
const PHOTO_H = 148

type Props = {
  categories: ExploreCategory[]
  onCategoryPress: (cat: ExploreCategory) => void
  onHeaderPress?: (() => void) | undefined
  onDiscoverAllPress: () => void
}

export default function DiscoverMatchesSection({
  categories, onCategoryPress, onHeaderPress, onDiscoverAllPress,
}: Props) {
  if (categories.length === 0) return null

  return (
    <View style={{ gap: 32 }}>
      <View style={{ gap: 24 }}>
        <SectionHeader title="Explore matches based on" onPress={onHeaderPress} />
        <View style={s.grid}>
          {categories.map(cat => (
            <Pressable key={cat.id} style={s.tile} onPress={() => onCategoryPress(cat)}>
              {!!cat.imageUrl && <Image source={{ uri: cat.imageUrl }} style={s.photo} resizeMode="cover" />}
              <View style={s.labelBar}>
                <Text style={s.label} numberOfLines={2}>{cat.label}</Text>
                <Text style={s.tileChevron}>{'›'}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={s.footer}>
        <SeeAllLink label="Discover all categories" onPress={onDiscoverAllPress} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  grid: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    columnGap:         26,
    rowGap:            24,
    paddingLeft:       12,
  },
  tile: { width: TILE_W },
  photo: {
    width:         TILE_W,
    height:        PHOTO_H,
    borderWidth:   1,
    borderColor:   '#ecc9d3',
    borderRadius:  8,
    marginBottom:  -10,
  },
  labelBar: {
    backgroundColor:   '#fff3f7',
    borderWidth:       1,
    borderColor:       '#ecc9d3',
    borderBottomLeftRadius:  8,
    borderBottomRightRadius: 8,
    height:            48,
    padding:           12,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               4,
  },
  label: { flex: 1, fontFamily: 'Poppins-Medium', fontSize: 12, lineHeight: 16, color: '#333333' },
  tileChevron: { fontFamily: 'Poppins-Regular', fontSize: 16, color: '#333333' },
  footer: { alignItems: 'flex-end' },
})
