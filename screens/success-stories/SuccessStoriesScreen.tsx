import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT, CDN_REVAMP } from '../../constants/cdn'
import { StorageKeys } from '../../constants/storage.keys'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { getItem } from '../../service/storageService'
import { apiCall } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { handleBack } from '../../utils/navigationRef'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import SuccessStoriesDesktopScreen from './SuccessStoriesDesktopScreen'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const ICON_BACK    = CDN_REACT + '/menu_back_arrow.svg'
const HERO_GIF     = CDN_REACT + '/success_stories.gif'
const FALLBACK_IMG = CDN_REVAMP + 'not-available.svg'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const CARD_W     = SCREEN_W - 48   // 24px padding each side
const PAGE_LIMIT = 10

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any }

type Photo = { IMG: string }

type Story = {
  MatriId:    string
  THUMBIMG:   string
  GroomName:  string
  BrideName:  string
  TimePosted: string
  DISTRICT:   string
  PHOTO:      Photo[]
}

// ─── StoryCard ────────────────────────────────────────────────────────────────

interface StoryCardProps {
  story:   Story
  onPress: () => void
}

function formatDate(raw: string): string {
  const match = raw.match(/([A-Za-z]+\s+\d{4})$/)
  return match ? match[1] : raw
}

function StoryCard({ story, onPress }: StoryCardProps) {
  const name     = [story.GroomName, story.BrideName].filter(Boolean).join(' & ')
  const date     = story.TimePosted ? formatDate(story.TimePosted) : ''
  const location = [story.DISTRICT, date].filter(Boolean).join(',  ')

  return (
    <Pressable style={c.card} onPress={onPress} accessibilityRole="button">
      {/* Square photo — fills card width */}
      <Image
        source={{ uri: story.THUMBIMG || FALLBACK_IMG }}
        style={c.cardPhoto}
        contentFit="cover"
      />

      {/* Text below photo — centered */}
      <View style={c.cardInfo}>
        {!!name && (
          <Text style={c.cardName} numberOfLines={1}>{name}</Text>
        )}
        {!!location && (
          <Text style={c.cardLocation} numberOfLines={1}>{location}</Text>
        )}
      </View>
    </Pressable>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

interface HeroProps { title: string; sub: string }

function HeroSection({ title, sub }: HeroProps) {
  return (
    <LinearGradient
      colors={['#FEF2F6', '#FFFFFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={c.hero}
    >
      <Image source={{ uri: HERO_GIF }} style={c.heroGif} contentFit="contain" />
      {!!title && <Text style={c.heroTitle}>{title}</Text>}
      {!!sub   && <Text style={c.heroSub}>{sub}</Text>}
    </LinearGradient>
  )
}

// ─── PhotoViewer ──────────────────────────────────────────────────────────────

interface PhotoViewerProps {
  photos:  Photo[]
  onClose: () => void
  insets:  { bottom: number; top: number }
}

function PhotoViewer({ photos, onClose, insets }: PhotoViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const displayPhotos = photos.length > 0 ? photos : [{ IMG: '' }]

  return (
    <View style={pv.screen}>
      <Pressable
        style={[pv.backBtn, { top: insets.top + 12 }]}
        onPress={onClose}
        accessibilityRole="button"
      >
        <CdnSvg uri={ICON_BACK} width={24} height={24} />
      </Pressable>

      <FlatList
        data={displayPhotos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
          setActiveIndex(idx)
        }}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.IMG || FALLBACK_IMG }}
            style={{ width: SCREEN_W, height: SCREEN_H }}
            contentFit="contain"
          />
        )}
        style={pv.list}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
      />

      {displayPhotos.length > 1 && (
        <View style={[pv.dots, { bottom: insets.bottom + 16 }]}>
          {displayPhotos.map((_, i) => (
            <View key={i} style={[pv.dot, i === activeIndex && pv.dotActive]} />
          ))}
        </View>
      )}
    </View>
  )
}

// ─── SuccessStoriesScreen ─────────────────────────────────────────────────────

export default function SuccessStoriesScreen({ navigation }: Props) {
  const isDesktop = useIsDesktopWeb()
  const insets = useSafeAreaInsets()
  const { t }  = useTranslation()

  const [stories,        setStories]        = useState<Story[]>([])
  const [heroTitle,      setHeroTitle]      = useState('')
  const [heroSub,        setHeroSub]        = useState('')
  const [loading,        setLoading]        = useState(true)
  const [loadingMore,    setLoadingMore]    = useState(false)
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[] | null>(null)

  const startRef      = useRef(0)
  const hasMoreRef    = useRef(true)
  const fetchingRef   = useRef(false)
  const contentSetRef = useRef(false)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchStories = useCallback(async (reset: boolean) => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    if (reset) {
      startRef.current = 0
      hasMoreRef.current = true
    }

    const userId = (await getItem(StorageKeys.Auth.USER_ID)) ?? ''
    const params = `ID=${userId}&TYPE=4&START=${startRef.current}&END=${PAGE_LIMIT}`

    try {
      const res = await apiCall(Endpoints.registration.successStory, 'POST', params)
      if (res['RESPONSECODE'] == 1 && res['ERRCODE'] == 0 && res['RESPONSE']) {
        const data     = res['RESPONSE']
        const incoming: Story[] = data['SUCCESSSTORY'] ?? []
        const total    = parseInt(data['SSCOUNT'] ?? '0', 10)

        if (reset) {
          setStories(incoming)
        } else {
          setStories(prev => {
            const seen = new Set(prev.map(s => s.MatriId))
            return [...prev, ...incoming.filter(s => !seen.has(s.MatriId))]
          })
        }

        if (!contentSetRef.current) {
          contentSetRef.current = true
          if (data['CONTENT'])  setHeroTitle(data['CONTENT'])
          if (data['CONTENT1']) setHeroSub(data['CONTENT1'])
        }

        startRef.current += PAGE_LIMIT

        if (total > 0) {
          hasMoreRef.current = startRef.current < total
        } else {
          hasMoreRef.current = incoming.length === PAGE_LIMIT
        }
      } else {
        hasMoreRef.current = false
      }
    } catch {
      hasMoreRef.current = false
    } finally {
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchStories(true).finally(() => setLoading(false))
  }, [fetchStories])

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMoreRef.current) return
    setLoadingMore(true)
    await fetchStories(false)
    setLoadingMore(false)
  }, [fetchStories])

  // ── Render ────────────────────────────────────────────────────────────────

  const title = t('MENU.SUCCESS_STORIES')

  // Desktop (Figma "Jodii Desktop - Registration" node 659:36170) needs a
  // static 3-column photo grid instead of this screen's scrollable hero+list
  // — see SuccessStoriesDesktopScreen.tsx's header comment. Standalone screen
  // with its own state, same split EditProfileScreen.tsx uses. Checked after
  // (not before) the hooks above since isDesktop can flip live on resize.
  if (isDesktop) {
    return <SuccessStoriesDesktopScreen navigation={navigation} />
  }

  return (
    <View style={[c.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={c.header}>
        <Pressable
          style={c.backBtn}
          onPress={() => handleBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={c.headerTitle} numberOfLines={1}>{title}</Text>
      </View>

      {/* List */}
      {loading ? (
        <View style={c.center}>
          <ActivityIndicator color={PRIMARY} size="large" />
        </View>
      ) : stories.length === 0 ? (
        <View style={c.center}>
          <HeroSection title={heroTitle} sub={heroSub} />
          <Text style={c.emptyText}>No stories yet</Text>
        </View>
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(item, index) => `${item.MatriId}_${index}`}
          ListHeaderComponent={<HeroSection title={heroTitle} sub={heroSub} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 24 }} />}
          renderItem={({ item }) => (
            <View style={c.cardWrap}>
              <StoryCard
                story={item}
                onPress={() => setSelectedPhotos(item.PHOTO ?? [])}
              />
            </View>
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore
              ? <View style={c.footerLoader}><ActivityIndicator color={PRIMARY} /></View>
              : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Photo viewer modal */}
      <Modal
        visible={selectedPhotos !== null}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedPhotos(null)}
      >
        {selectedPhotos !== null && (
          <PhotoViewer
            photos={selectedPhotos}
            onClose={() => setSelectedPhotos(null)}
            insets={insets}
          />
        )}
      </Modal>

    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PRIMARY = '#b50033'

const c = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: Colors.white,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize:  14,
    color:     '#777',
    marginTop: 16,
  },

  // ── Header ──
  header: {
    height:          56,
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.white,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       4,
  },
  backBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
    marginLeft:     14,
  },
  headerTitle: {
    flex:       1,
    fontSize:   16,
    fontWeight: '500',
    color:      '#333333',
    marginLeft: 6,
    marginRight: 16,
  },

  // ── Hero ──
  hero: {
    paddingHorizontal: 24,
    paddingTop:        16,
    paddingBottom:     18,
  },
  heroGif: {
    width:       84,
    height:      84,
    marginLeft:  -5,
    opacity:     0.33,
  },
  heroTitle: {
    fontSize:     20,
    fontWeight:   '600',
    color:        '#000',
    lineHeight:   26,
    marginBottom: 4,
  },
  heroSub: {
    fontSize:   14,
    fontWeight: '400',
    color:      '#000',
  },

  // ── Card wrapper (provides 24px side padding) ──
  cardWrap: {
    paddingHorizontal: 24,
  },

  // ── Card ──
  card: {
    width:           CARD_W,
    backgroundColor: Colors.white,
    borderRadius:    12,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.12,
    shadowRadius:    16,
    elevation:       6,
  },
  cardPhoto: {
    width:        CARD_W,
    height:       CARD_W,   // square
    borderRadius: 0,
  },
  cardInfo: {
    paddingTop:        16,
    paddingBottom:     16,
    paddingHorizontal: 12,
    alignItems:        'center',
  },
  cardName: {
    fontSize:     16,
    fontWeight:   '500',
    color:        '#000000',
    lineHeight:   24,
    textAlign:    'center',
  },
  cardLocation: {
    fontSize:   14,
    fontWeight: '400',
    color:      '#372f3a',
    lineHeight: 20,
    textAlign:  'center',
  },

  // ── Footer loader ──
  footerLoader: {
    paddingVertical: 24,
    alignItems:      'center',
  },
})

// ─── Photo viewer styles ──────────────────────────────────────────────────────

const pv = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: '#000',
  },
  backBtn: {
    position:        'absolute',
    zIndex:          10,
    top:             12,            // overridden at render with insets
    left:            16,
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  list: {
    flex: 1,
  },
  dots: {
    position:       'absolute',
    left:           0,
    right:          0,
    bottom:         16,            // overridden at render with insets
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            6,
  },
  dot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: Colors.white,
    width:           20,
  },
})
