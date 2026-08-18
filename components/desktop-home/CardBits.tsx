// Small reused-with-icon pieces shared by several desktop Home carousel cards
// (Profiles who viewed me, Today's matches, Newly joined, Profiles you viewed)
// — kept separate from DesktopHomeShared.tsx since these tie to specific
// icon glyphs rather than being pure layout/structure.
//
// Uses plain Text glyphs/Views instead of the original Figma-exported SVGs —
// those lived in assets/desktop-home/, were never committed to git, and got
// wiped from disk, breaking every screen that required() them. Glyphs can't
// go missing the same way.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

// "Viewed you on {date}" / "You viewed on {date}" overlay pill on a card photo.
export function EyeDatePill({ text }: { text: string }) {
  return (
    <View style={s.eyePill}>
      <Text style={s.eyeGlyph}>{'\u{1F441}'}</Text>
      <Text style={s.eyePillText} numberOfLines={1}>{text}</Text>
    </View>
  )
}

export function ViewProfileLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={s.viewProfile} onPress={onPress}>
      <Text style={s.viewProfileText}>View profile</Text>
      <Text style={s.viewProfileChevron}>{'›'}</Text>
    </Pressable>
  )
}

export function VerifiedCheckmark() {
  return (
    <View style={s.verifiedBadge}>
      <Text style={s.verifiedGlyph}>{'✓'}</Text>
    </View>
  )
}

// Masked "Newly Joined" pill badge, top-left of a card photo.
export function NewlyJoinedBadge() {
  return (
    <View style={s.newlyJoinedBadge}>
      <Text style={s.starGlyph}>{'★'}</Text>
      <Text style={s.newlyJoinedBadgeText}>Newly Joined</Text>
    </View>
  )
}

const s = StyleSheet.create({
  eyePill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    alignSelf:         'flex-start',
  },
  eyeGlyph:    { fontSize: 12 },
  eyePillText: {
    fontFamily: Fonts.poppinsMedium,
    fontSize:   12,
    color:      Colors.white,
  },

  viewProfile: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  viewProfileText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   14,
    lineHeight: 16,
    color:      Colors.link,
  },
  viewProfileChevron: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   16,
    color:      Colors.link,
  },

  verifiedBadge: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.link,
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedGlyph: { color: Colors.white, fontSize: 10 },

  newlyJoinedBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   'rgba(0,0,0,0.5)',
    borderRadius:      20,
    paddingHorizontal: 8,
    paddingVertical:   4,
  },
  starGlyph: { color: '#ffd700', fontSize: 12 },
  newlyJoinedBadgeText: {
    fontFamily:      SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:        12,
    color:           Colors.white,
    textTransform:   'capitalize',
  },
})
