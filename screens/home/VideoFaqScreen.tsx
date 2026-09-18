// "See all" destination for Home's Self-Help Videos section — Angular:
// pages/video-faq/video-faq.page.html. That file's top `<ion-content
// *ngIf="false">` block (an accordion/expand-in-place list) is DEAD — never
// rendered — so this ports only the second, always-live `<ion-content>`: a
// plain vertical list of the same video cards Home's own horizontal strip
// already renders (same `faqvideo` API, same fetchFaqVideos()).
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { SvgXml } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import AppHeader from '../../components/app-header/AppHeader'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { fetchFaqVideos, type HelpVideo } from '../../service/homeService'
import { Fonts, FontSize } from '../../src/theme/fonts'
import { SelfHelpVideoPlayer } from './HomeScreen'

const PLAY_ICON = `${CDN_SVG}play-pause-message-white.svg`
// Same close-outline icon HomeScreen.tsx's own video modal uses.
const CLOSE_OUTLINE_WHITE_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144M368 144L144 368"/></svg>`

// Angular: video-faq.page.scss's `.video-img { min-height: 160px !important }`
// — the ONLY height rule actually in effect for this page's <img> (the same
// class list also carries `.faq-image`, but that class's own `height: 21.1vh`
// is defined in a DIFFERENT component's scoped stylesheet — Angular's
// ViewEncapsulation means it never applies here). With no explicit height
// otherwise, the image renders at its own natural aspect ratio — approximated
// here as a standard 16:9 video thumbnail, floored at the same 160px.
const IMAGE_MIN_HEIGHT = 160

export default function VideoFaqScreen({ navigation }: { navigation: any }) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [videos, setVideos] = useState<HelpVideo[]>([])
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchFaqVideos().then(list => { if (!cancelled) setVideos(list) })
    return () => { cancelled = true }
  }, [])

  return (
    <View style={s.screen}>
      {/* Angular: video-faq.page.html has its OWN inline header, not
          <app-header> — title is `heading4-medium-16 black-color` (pure
          black, not AppHeader's generic header2 default of #333333 — correct
          for menu-contacts.page.html, the screen that default IS modeled on),
          and the toolbar uses `.header-box-shadow` (a drop shadow) instead of
          the generic `.border-bottom-search` hairline. Also the one header2
          caller with a WIDER back-button column (`ion-col size="2"`, not the
          usual 1.5) and a content-hugging row (`pt-12 pb-12`, not the
          generic header2's flat height:52 — itself only a guess for the
          OTHER real source, which has no vertical padding class at all). */}
      <AppHeader
        type="header2"
        title={t('HOME.SELF_VIDEO_HEADER')}
        titleStyle={s.headerTitle}
        titleRowStyle={s.headerTitleRow}
        backColSize={2}
        shadowHeader
        onBackPress={() => navigation.goBack()}
      />
      <FlatList
        data={videos}
        keyExtractor={i => i.id}
        contentContainerStyle={[s.list, { paddingBottom: 24 + insets.bottom }]}
        renderItem={({ item }) => (
          <Pressable style={s.card} onPress={() => item.videoUrl && setVideoModalUrl(item.videoUrl)}>
            {item.thumbUrl
              ? <Image source={{ uri: item.thumbUrl }} style={s.image} resizeMode="cover" />
              : <View style={s.image} />
            }
            <View style={s.playBtn}>
              <CdnSvg uri={PLAY_ICON} width={20} height={20} />
            </View>
            {!!item.title && (
              <LinearGradient colors={['transparent', '#000000']} style={s.caption}>
                <Text style={s.captionText} numberOfLines={2}>{item.title}</Text>
              </LinearGradient>
            )}
          </Pressable>
        )}
      />

      {!!videoModalUrl && <StatusBar style="light" />}
      <Modal visible={!!videoModalUrl} animationType="slide" statusBarTranslucent onRequestClose={() => setVideoModalUrl(null)}>
        <View style={s.videoModal}>
          <Pressable style={[s.videoModalClose, { top: insets.top + 8 }]} onPress={() => setVideoModalUrl(null)}>
            <SvgXml xml={CLOSE_OUTLINE_WHITE_XML} width={25} height={25} />
          </Pressable>
          {!!videoModalUrl && <SelfHelpVideoPlayer uri={videoModalUrl} />}
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  // Angular: `heading4-medium-16 black-color` — family/size already match
  // AppHeader's generic header2 default, only the color differs (pure black,
  // not #333333).
  headerTitle: { color: Colors.black },
  // Angular: `<ion-row class="d-flex align-center-item pt-12 pb-12">` — a
  // real, content-hugging 12px top/bottom padding, replacing header2's
  // generic flat `height:52` (a guess for the other real header2 source,
  // which has no vertical padding class at all).
  headerTitleRow: { height: undefined, paddingVertical: 12 },
  // Angular: the video list's own wrapping div is `pl-24 pr-24 pb-24`.
  list: { paddingHorizontal: 24, paddingBottom: 24 },
  // Angular: `.mt-24 posrelative bg-color` — 24px above every card (including
  // the first, which gets it as its gap below the header); `.bg-color` is the
  // image's own loading/empty-state fallback (#e5e5e5), not the card's.
  card: {
    marginTop: 24,
    position:  'relative',
  },
  image: {
    width:        '100%',
    aspectRatio:  16 / 9,
    minHeight:    IMAGE_MIN_HEIGHT,
    borderRadius: 4,
    backgroundColor: '#e5e5e5',
  },
  // Angular: `.play-video` — 32x32 red circle, centered over the image.
  playBtn: {
    position:        'absolute',
    top:             '50%',
    left:            '50%',
    width:           32,
    height:          32,
    marginLeft:      -16,
    marginTop:       -16,
    borderRadius:    16,
    backgroundColor: '#FF0000',
    alignItems:      'center',
    justifyContent:  'center',
  },
  // Angular: `.faq-text` — position:absolute, bottom:0, full width,
  // padding: 12px 16px, linear-gradient(transparent, black).
  caption: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderRadius:      4,
  },
  // Angular: `.body3-regular-12 white-color line-height-16` — font-size
  // var(--font12) (0.75rem, dynamic — see FontSize's header comment),
  // Poppins-Regular; line-height a flat 16px (not rem-based).
  captionText: {
    fontFamily: Fonts.poppinsRegular,
    fontSize:   FontSize.font12,
    lineHeight: 16,
    color:      Colors.white,
  },
  // Same video-modal shell as HomeScreen.tsx's own self-help video popup.
  videoModal:      { flex: 1, backgroundColor: '#000' },
  videoModalClose: { position: 'absolute', top: 48, right: 16, zIndex: 1, padding: 8 },
})
