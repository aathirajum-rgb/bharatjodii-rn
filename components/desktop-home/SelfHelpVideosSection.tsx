// "Self-help videos" carousel (Figma node 1034:6468) — 312×160 thumbnail
// cards, centered play button, bottom-left caption.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { CarouselSection, CARD_SCRIM_COLORS } from './DesktopHomeShared'
import type { HelpVideo } from '../../service/homeService'

const CARD_W = 312
const CARD_H = 160

type Props = {
  videos: HelpVideo[]
  onVideoPress: (video: HelpVideo) => void
  onSeeAllPress: () => void
}

export default function SelfHelpVideosSection({ videos, onVideoPress, onSeeAllPress }: Props) {
  return (
    <CarouselSection
      title="Self-help videos"
      data={videos}
      cardWidth={CARD_W}
      keyExtractor={(video, i) => video.id ?? String(i)}
      onSeeAllPress={onSeeAllPress}
      renderCard={video => (
        <Pressable style={s.card} onPress={() => onVideoPress(video)}>
          {!!video.thumbUrl && <Image source={{ uri: video.thumbUrl }} style={s.thumb} resizeMode="cover" />}
          <LinearGradient colors={CARD_SCRIM_COLORS} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View style={s.playBtn}>
            <Text style={s.playGlyph}>{'▶'}</Text>
          </View>
          {!!video.title && <Text style={s.caption} numberOfLines={2}>{video.title}</Text>}
        </Pressable>
      )}
    />
  )
}

const s = StyleSheet.create({
  card: {
    width:        CARD_W,
    height:       CARD_H,
    borderRadius: 8,
    overflow:     'hidden',
    backgroundColor: '#d9d9d9',
  },
  thumb: { width: '100%', height: '100%', position: 'absolute' },
  playBtn: {
    position:       'absolute',
    top:            '50%',
    left:           '50%',
    marginTop:      -16,
    marginLeft:     -16,
    width:          32,
    height:         32,
    borderRadius:   16,
    backgroundColor: '#b50033',
    alignItems:     'center',
    justifyContent: 'center',
  },
  playGlyph: { color: '#ffffff', fontSize: 14, marginLeft: 2 },
  caption: {
    position:   'absolute',
    left:       16,
    bottom:     12,
    right:      16,
    fontFamily: 'Poppins-Regular',
    fontSize:   12,
    lineHeight: 16,
    color:      '#ffffff',
  },
})
