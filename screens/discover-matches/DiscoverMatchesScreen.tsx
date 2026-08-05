// Angular: pages/discover-matches/discover-matches.component.ts (route
// "discover-matches", webview page_id "55") — a dedicated "browse by
// category" screen: the same explore-category grid HomeScreen.tsx's own
// ExploreCategoriesSection already renders inline, just as a standalone
// destination reachable from the direct-login-landing case AND from the
// Home screen's "Discover all categories" link.
//
// SCOPE NOTE: Angular's version paginates categories in batches via a
// "View more" button (sendValue/getExploreMatchesCount incremental loads,
// max 3 extra pages) and special-cases the 'PHOTO' category (native camera
// call instead of navigating, when the member's photo isn't yet approved).
// RN's fetchExploreCategories() already returns the complete category list in
// one call (not batch-paginated), and HomeScreen.tsx's own onCategoryPress
// handler for this exact same grid does NOT special-case PHOTO either — both
// simplifications were already made, and shipped, for Home's inline section;
// this screen matches that existing precedent rather than diverging from it.

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import {
  fetchExploreCategories, fetchExploreCounts, fetchAndStorePPSetData, type ExploreCategory,
} from '../../service/homeService'
import { ExploreCategoriesSection } from '../home/HomeScreen'
import { ENavigation } from '../../types/enums/navigation.enum'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'
const { width: SW } = Dimensions.get('window')

type Props = { navigation: any }

export default function DiscoverMatchesScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<ExploreCategory[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [cats, ppSetData] = await Promise.all([
      fetchExploreCategories(),
      fetchAndStorePPSetData(),
    ])
    const counts = await fetchExploreCounts(ppSetData?.['DISCOVERKEY'])
    setCategories(cats.map(cat => (
      counts[cat.id] !== undefined ? { ...cat, count: counts[cat.id] } : cat
    )))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('HOME.EXPLORE_MATCHES_TXT', 'Discover matches')}</Text>
      </View>

      {loading ? (
        <View style={[s.screen, s.center]}>
          <ActivityIndicator color={Colors.primaryDark} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <ExploreCategoriesSection
            categories={categories}
            tileWidth={(SW - 32 - 8) / 2}
            onCategoryPress={cat => navigation.navigate(ENavigation.MATCHES, { exploreType: cat.id, exploreLabel: cat.label })}
          />
        </ScrollView>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: '#333333', marginLeft: 6, marginRight: 16 },

  content: { paddingHorizontal: 16, paddingTop: 24 },
})
