// Angular: pages/discover-matches/discover-matches.component.ts (route
// "discover-matches", webview page_id "55") — a dedicated "browse by
// category" screen: the same explore-category grid HomeScreen.tsx's own
// ExploreCategoriesSection already renders inline, just as a standalone
// destination reachable from the direct-login-landing case AND from the
// Home screen's "Discover all categories" link.
//
// SCOPE NOTE: Angular's version paginates categories in batches via a
// "View more" button (sendValue/getExploreMatchesCount incremental loads,
// max 3 extra pages, LIMIT=20 instead of Home's LIMIT=1) and special-cases
// the 'PHOTO' category (native camera call instead of navigating, when the
// member's photo isn't yet approved). RN's fetchExploreCategories() already
// returns the complete category list in one call (not batch-paginated), and
// HomeScreen.tsx's own onCategoryPress handler for this exact same grid does
// NOT special-case PHOTO either — both simplifications were already made,
// and shipped, for Home's inline section; this screen matches that existing
// precedent rather than diverging from it.

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT, CDN_LOTTIE } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import CdnLottie from '../../components/CdnLottie'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import {
  fetchExploreCategories, fetchAndStorePPSetData, type ExploreCategory,
} from '../../service/homeService'
import { ExploreCategoriesSection } from '../home/HomeScreen'
import { handleFooterTabPress } from '../../utils/footerTabPress'
import { setFilterEventType } from '../../service/filterService'
import { handleBack } from '../../utils/navigationRef'
import { FontSize, Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import ScreenTopInset from '../../components/screen/ScreenTopInset'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

type Props = { navigation: any }

export default function DiscoverMatchesScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<ExploreCategory[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const ppSetData = await fetchAndStorePPSetData()
    const cats = await fetchExploreCategories(ppSetData?.['DISCOVERKEY'])
    setCategories(cats)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Angular: footer.component.ts's tab navigation — this screen's own
  // <app-footer> is the same shared bottom bar every screen shows. No single
  // one of the 5 tabs corresponds to "discover matches" itself (FooterTab
  // has no "none active" option — it's a strict 0-4 union), so Matches (1)
  // is highlighted as the closest thematic fit, matching how this screen is
  // reached from Home's own Matches-adjacent search icon.
  const handleTabPress = (tab: FooterTab) => handleFooterTabPress(navigation, tab)

  return (
    <View style={s.screen}>
      <ScreenTopInset />
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('HOME.EXPLORE_MATCHES_TXT', 'Discover matches')}</Text>
      </View>

      {loading ? (
        <View style={[s.screen, s.center]}>
          <ActivityIndicator color={Colors.primaryDark} size="large" />
        </View>
      ) : categories.length === 0 ? (
        // Angular: discover-matches.component.html's *ngIf="exploreMatchesData?.length == 0"
        // block — a no-matches Lottie + copy + a CTA back to preferences,
        // missing entirely before this fix.
        <View style={[s.screen, s.center, s.emptyState]}>
          <CdnLottie uri={`${CDN_LOTTIE}no-matches-animation.json`} width={100} height={100} />
          <Text style={s.emptyText}>{t('GENERAL.MODIFY_PREFERENCE')}</Text>
          <ButtonRevamp
            label={t('GENERAL.CTA_MODIFY_PREFERENCE')}
            variant="secondary"
            onPress={() => { setFilterEventType('pp'); navigation.navigate('Search') }}
            style={s.emptyBtn}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          {/* Angular: same ion-row pl-4/pr-24 + ion-col size="5.4" offset="0.6"
              grid as Home's own explore-matches section — ExploreCategoriesSection
              now applies that exact left/right padding + gap itself (see
              EXPLORE_TILE_WIDTH's header comment in HomeScreen.tsx), so this
              screen's own content padding must stay vertical-only or the two
              would stack and double the margin. showTitle=false because this
              screen's own header above already renders "Discover matches" once
              (discover-matches.component.html's <ion-toolbar>) — Home's copy of
              this same section is the one page that also wants the in-grid
              "Discover matches" heading (a different Angular page context),
              so rendering it here too would show the title twice. */}
          <ExploreCategoriesSection
            categories={categories}
            onCategoryPress={cat => navigation.navigate('MainTabs', { screen: 'Matches', params: { exploreType: cat.id, exploreLabel: cat.label } })}
            showTitle={false}
          />
        </ScrollView>
      )}

      {/* Angular: <app-footer></app-footer> at the bottom of this page —
          missing entirely before this fix. */}
      <AppFooter activeTab={1} onTabPress={handleTabPress} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Angular: .border-bottom-search { border-bottom: 1px solid #f1f5f9 } —
  // a thin hairline, not the drop-shadow this previously used.
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  // Angular: heading4-medium-16 color-333333 (discover-matches.component.html:10)
  // — font16 + Poppins-Medium; fontFamily was missing entirely before this fix.
  headerTitle: { flex: 1, fontFamily: Fonts.poppinsMedium, fontSize: FontSize.font16, fontWeight: '500', color: '#333333', marginLeft: 6, marginRight: 16 },

  // No horizontal padding here — ExploreCategoriesSection applies its own
  // exact left/right padding (see its header comment in HomeScreen.tsx).
  // Angular: discover-matches.component.html's <ion-row class="... mt-16 pb-24">
  // — 16px top margin (bottom handled below via the ScrollView's own insets.bottom+24).
  content: { paddingTop: 16 },

  // Angular: no-matches block's <ion-grid class="... ion-cust-padding-start
  // ion-cust-padding-end ...">  — var(--ion-cust-padding) = 24px, not 32.
  emptyState:  { paddingHorizontal: 24 },
  emptyText:   { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black, textAlign: 'center', marginTop: 6, marginBottom: 16, lineHeight: 20 },
  emptyBtn:    { marginTop: 0 },
})
