// "Complete your profile" tiles (Figma node 1034:4445). Figma's mock shows 2
// fixed tiles (horoscope, star/raasi) with bespoke multi-part vector icons,
// but the real data (CompleteProfileCard from homeService.ts) is server-driven
// and can return any of 9 card types with their own `imageUrl` — so this
// renders whatever cards the API returns, using that real icon, with the
// blue/pink tinted-gradient backgrounds cycling per index the way Figma's 2
// example tiles do.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SectionHeader } from './DesktopHomeShared'
import { Colors } from '../../constants/colors'
import type { CompleteProfileCard } from '../../service/homeService'
import { SemanticFontsEnglish } from '../../src/theme/fonts'

const TINTS: [string, string][] = [
  ['#e8efff', '#ffffff'],
  ['#ffedff', '#ffffff'],
]

type Props = {
  cards: CompleteProfileCard[]
  onCardPress: (card: CompleteProfileCard) => void
  onHeaderPress?: (() => void) | undefined
}

export default function CompleteYourProfileSection({ cards, onCardPress, onHeaderPress }: Props) {
  if (cards.length === 0) return null

  return (
    <View style={{ gap: 24 }}>
      <SectionHeader title="Complete your profile" onPress={onHeaderPress} />
      <View style={s.row}>
        {cards.map((card, i) => (
          <Pressable key={card.type} style={s.tile} onPress={() => onCardPress(card)}>
            <LinearGradient
              colors={TINTS[i % TINTS.length] ?? TINTS[0]!}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.iconWrap}>
              {card.imageUrl ? (
                <Image source={{ uri: card.imageUrl }} style={s.icon} resizeMode="contain" />
              ) : null}
            </View>
            <View style={s.textCol}>
              <Text style={s.label} numberOfLines={1}>{card.label}</Text>
              <View style={s.addRow}>
                <Text style={s.addText}>{card.ctaLabel}</Text>
                <Text style={s.addChevron}>{'›'}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  row:  { flexDirection: 'row', gap: 20, paddingHorizontal: 12 },
  tile: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    height:            76,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderWidth:       1,
    borderColor:       Colors.borderSubtle,
    borderRadius:      12,
    overflow:          'hidden',
  },
  iconWrap: { width: 48, height: 48 },
  icon:     { width: 48, height: 48 },
  textCol:  { flex: 1, gap: 8 },
  label: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 14, lineHeight: 20, color: Colors.black },
  addRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 20, color: Colors.link },
  addChevron: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 16, color: Colors.link },
})
