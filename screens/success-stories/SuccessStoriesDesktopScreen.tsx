// Desktop layout for "Jodii success stories" (Figma "Jodii Desktop -
// Registration", UaPAN9aG6MfZf6CRpwXf1L, node 659:36170 — the frame's own
// internal Figma layer name is stale/mislabeled "Jodii Homepage - Scroll
// view", confirmed by rendered screenshot instead of trusting the name).
// Same account-sidebar shell as Settings/ViewLater/IgnoredProfiles
// (DesktopPageShell) — reached from HomeSidebar, not the footer tabs.
//
// Standalone screen with its own fetch, mirroring SuccessStoriesScreen.tsx's
// exact same `registration/successstory/v1` call and `Story` shape — desktop
// just renders it as a static 3-column photo grid instead of a scrollable
// hero+list, and (per the real Figma frame, which shows no tap/hover
// affordance on any card) skips the mobile screen's full-screen photo-viewer
// modal entirely.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import { Colors } from '../../constants/colors'
import { CDN_REACT, CDN_REVAMP } from '../../constants/cdn'
import { StorageKeys } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { handleFooterTabPress } from '../../utils/footerTabPress'
import { apiCall } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import type { FooterTab } from '../../components/app-footer/AppFooter'

const FALLBACK_IMG = CDN_REVAMP + 'not-available.svg'
// Figma node 659:37258 ("Frame 1707482074") — a faint rotated hands-forming-
// a-heart line-art flourish in the header's top-right corner, masked to a
// heart-shaped crop in Figma. Downloaded the underlying line-art (the exact
// CSS mask/rotate math isn't worth replicating in RN for a purely decorative,
// barely-visible accent) and placed it plainly instead.
const FLOURISH = CDN_REACT + '/success-stories-hands-heart-flourish.svg'

const PAGE_LIMIT = 12   // 3 columns × 4 rows before paginating further

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

function StoryCard({ story }: { story: Story }) {
  const name = [story.GroomName, story.BrideName].filter(Boolean).join(' & ')
  return (
    <View style={s.card}>
      <Image
        source={{ uri: story.THUMBIMG || FALLBACK_IMG }}
        style={s.cardPhoto}
        contentFit="cover"
      />
      <View style={s.cardInfo}>
        {!!name && <Text style={s.cardName} numberOfLines={1}>{name}</Text>}
        {!!story.DISTRICT && <Text style={s.cardLocation} numberOfLines={1}>{story.DISTRICT}</Text>}
        {!!story.TimePosted && <Text style={s.cardDate} numberOfLines={1}>{story.TimePosted}</Text>}
      </View>
    </View>
  )
}

export default function SuccessStoriesDesktopScreen({ navigation }: Props) {
  const { t } = useTranslation()

  const [stories,     setStories]     = useState<Story[]>([])
  const [heroSub,      setHeroSub]    = useState('')
  const [loaded,       setLoaded]     = useState(false)
  const [loadingMore,  setLoadingMore] = useState(false)
  const [userName,     setUserName]  = useState('')

  const startRef      = useRef(0)
  const hasMoreRef    = useRef(true)
  const fetchingRef   = useRef(false)
  const contentSetRef = useRef(false)

  useEffect(() => {
    getItem(StorageKeys.User.NAME).then(name => setUserName(name ?? ''))
  }, [])

  const fetchStories = useCallback(async (reset: boolean) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    if (reset) { startRef.current = 0; hasMoreRef.current = true }

    const userId = (await getItem(StorageKeys.Auth.USER_ID)) ?? ''
    const params = `ID=${userId}&TYPE=4&START=${startRef.current}&END=${PAGE_LIMIT}`

    try {
      const res = await apiCall(Endpoints.registration.successStory, 'POST', params)
      if (res['RESPONSECODE'] == 1 && res['ERRCODE'] == 0 && res['RESPONSE']) {
        const data = res['RESPONSE']
        const incoming: Story[] = data['SUCCESSSTORY'] ?? []
        const total = parseInt(data['SSCOUNT'] ?? '0', 10)

        setStories(prev => {
          if (reset) return incoming
          const seen = new Set(prev.map(s => s.MatriId))
          return [...prev, ...incoming.filter(s => !seen.has(s.MatriId))]
        })

        if (!contentSetRef.current) {
          contentSetRef.current = true
          if (data['CONTENT1']) setHeroSub(data['CONTENT1'])
        }

        startRef.current += PAGE_LIMIT
        hasMoreRef.current = total > 0 ? startRef.current < total : incoming.length === PAGE_LIMIT
      } else {
        hasMoreRef.current = false
      }
    } catch {
      hasMoreRef.current = false
    } finally {
      fetchingRef.current = false
      setLoaded(true)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { fetchStories(true) }, [fetchStories])

  function loadMore() {
    if (loadingMore || !hasMoreRef.current || !loaded) return
    setLoadingMore(true)
    fetchStories(false)
  }

  const handleTabPress = (tab: FooterTab) => handleFooterTabPress(navigation, tab)

  return (
    <DesktopPageShell navigation={navigation} userName={userName} activeItem="successStories" onTabPress={handleTabPress}>
      <View style={s.header}>
        <CdnSvg uri={FLOURISH} width={150} height={150} style={s.flourish} />
        <Text style={s.title}>{t('MENU.SUCCESS_STORIES')}</Text>
        {!!heroSub && <Text style={s.subtitle}>{heroSub}</Text>}
      </View>

      {!loaded ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
        </View>
      ) : (
        <FlatList
          data={stories}
          keyExtractor={item => item.MatriId}
          style={s.list}
          numColumns={3}
          renderItem={({ item }) => (
            <View style={s.cardWrap}>
              <StoryCard story={item} />
            </View>
          )}
          columnWrapperStyle={s.row}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={Colors.primaryDark} style={s.footerLoader} /> : null}
          ListEmptyComponent={(
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>No stories yet</Text>
            </View>
          )}
          contentContainerStyle={s.listContent}
        />
      )}
    </DesktopPageShell>
  )
}

const CARD_W = 260

const s = StyleSheet.create({
  header: { width: 810, marginBottom: 24, position: 'relative' },
  flourish: { position: 'absolute', top: -40, right: -20, opacity: 0.5 },
  title: { fontFamily: Fonts.poppinsSemiBold, fontSize: 22, color: Colors.black },
  subtitle: { fontFamily: SemanticFontsEnglish.subheadingEnglishRegular, fontSize: 14, color: Colors.black, marginTop: 8 },

  list: { width: 810 },
  listContent: { paddingBottom: 32 },
  row: { gap: 16 },
  cardWrap: { marginBottom: 24 },
  loadingWrap: { width: 810, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  footerLoader: { marginVertical: 16 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black, textAlign: 'center' },

  card: { width: CARD_W, backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden' },
  cardPhoto: { width: CARD_W, height: CARD_W },
  cardInfo: { padding: 16 },
  cardName: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 16, color: Colors.black },
  cardLocation: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black, marginTop: 4 },
  cardDate: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.textSecondary, marginTop: 20 },
})
