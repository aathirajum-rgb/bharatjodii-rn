import { useState } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import CdnSvg from '../cdn-svg/CdnSvg'
import FilterChipsRow, { MOBILE_FILTER_CHIPS } from './FilterChipsRow'
import FacetFilterModal from './FacetFilterModal'
import LanguagePill, { LANG_LABELS } from '../language-pill/LanguagePill'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import type { ExploreFacet } from '../../service/homeService'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

const CDN = CDN_SVG

// Re-exported so existing imports (ViewProfileScreen.tsx, ViewProfileDesktopLayout.tsx,
// MatchesDesktopNav.tsx, StarMatchingDesktopLayout.tsx) keep working unchanged —
// the canonical definition now lives in components/language-pill/LanguagePill.tsx,
// which also owns the pill's markup/styling and the sheet it opens.
export { LANG_LABELS }

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface MatchesHeaderProps {
  headerAnim:      Animated.Value
  loading:         boolean
  totalCount:      number
  langCode:        string
  selectedChip:    string
  onChipSelect:    (key: string) => void
  onEditPreferences?: () => void
  onHeaderLayout:  (height: number) => void
  onTitleLayout:   (height: number) => void
  // Explore-by-category mode (#5/#6) — facet refinement chips returned inline by
  // the explore listing response. Angular: matches.page.html:94-114 facetResponce row.
  facets?:         ExploreFacet[]
  onFacetToggle?:  (key: string) => void
  // "View more" modal Apply — Angular: pillFilter() with all checked facet KEYs
  // joined by '~' (matches.page.ts:1952-1988), not one-at-a-time like onFacetToggle.
  onFacetsApply?:  (checkedKeys: string[]) => void
  // Explore-by-category mode — Angular shows the category's own label instead of
  // "N Matches" as the page title (matches.page.ts pageTitle).
  titleOverride?:  string | undefined
  // Angular: matches.page.html gates BOTH the "#COUNT# profiles..."/Edit-preferences
  // row AND the quick-filter chip row on `!isExploreMatches` — neither applies once
  // you're inside a category (only the facet refinement chips make sense there).
  isExploreMode?:  boolean
}

// ─── MatchesHeader ─────────────────────────────────────────────────────────────

export default function MatchesHeader({
  headerAnim,
  loading,
  totalCount,
  langCode,
  selectedChip,
  onChipSelect,
  onEditPreferences,
  onHeaderLayout,
  onTitleLayout,
  facets,
  onFacetToggle,
  onFacetsApply,
  titleOverride,
  isExploreMode = false,
}: MatchesHeaderProps) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
  const [showFacetModal, setShowFacetModal] = useState(false)

  // Angular: matches.page.ts facetChipLimit = 3 — always slice(0, 3) inline,
  // plus a "View more" chip when there are more than that (matches.page.html:94-114).
  const allFacets       = facets ?? []
  const visibleFacets   = allFacets.slice(0, 3)
  const hasMoreFacets   = allFacets.length > 3

  return (
    <Animated.View
      style={[s.header, s.headerAbsolute, { transform: [{ translateY: headerAnim }] }]}
      onLayout={e => {
        const h = e.nativeEvent.layout.height
        if (h > 0) onHeaderLayout(h)
      }}
    >
      {/* SafeAreaView pushes content below status bar — same pattern as Love project */}
      <SafeAreaView edges={['top']} style={s.safeTop}>

        {/* Title row — Figma: top 12, height 24, "Matches (49)" left, icons right */}
        <View
          style={s.titleRow}
          onLayout={e => {
            const h = e.nativeEvent.layout.height
            if (h > 0) onTitleLayout(h)
          }}
        >
          {/* Angular matches.page.ts's setPageTitle() — "Matches (#COUNT)" (SEARCH.MATCHES_FOUND),
              not a count-first "323 Matches". */}
          <Text style={[s.title, { fontFamily: langFonts.semiBold }]}>
            {loading ? (titleOverride ?? t('GENERAL.ICON_1')) : (titleOverride ?? t('SEARCH.MATCHES_FOUND').replace('#COUNT', String(totalCount)))}
          </Text>

          <View style={s.titleActions}>
            <LanguagePill langCode={langCode} />
          </View>
        </View>

        {/* Angular: matches.page.html — "#COUNT# profiles based on your preferences." on
            line 1, "Edit preferences" on line 2 — forced, not width-dependent wrap.
            Angular: *ngIf="!isExploreMatches && contentLoaded" — hidden inside a category. */}
        {!loading && !isExploreMode && (
          <View style={s.ppRow}>
            <Text style={[s.ppText, { fontFamily: langFonts.regular }]}>
              {t('MATCHES.PROFILE_COUNT').replace('#COUNT#', String(totalCount))}
            </Text>
            <Pressable style={s.ppEditBtn} onPress={onEditPreferences} hitSlop={8}>
              <Text style={[s.ppEditText, { fontFamily: langFonts.regular }]}>{t('MATCHES.EDIT_PP')}</Text>
              <CdnSvg uri={CDN + 'registration-new/edit-pencil.svg'} width={16} height={16} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
        )}

        {/* Filter chips — Figma: top 56 from content start (12 title-top + 24 title + 20 gap).
            Angular: *ngIf="!isExploreMatches && hdrSearchList.length > 0" — same gate. */}
        {!isExploreMode && (
          <FilterChipsRow chips={MOBILE_FILTER_CHIPS} selected={selectedChip} onSelect={onChipSelect} />
        )}

        {/* Facet refinement chips — explore-by-category mode only (#5). Angular:
            "View more" chip appears first when there are more than facetChipLimit (3),
            opening a modal with ALL facets; the same first 3 still show inline too. */}
        {allFacets.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.facetRow}>
            {hasMoreFacets && (
              <Pressable style={s.facetChip} onPress={() => setShowFacetModal(true)}>
                <CdnSvg uri={CDN + 'discover-matches/filter-image-discover.svg'} width={16} height={16} style={{ marginRight: 4 }} />
                <Text style={[s.facetChipText, { fontFamily: langFonts.regular }]}>
                  {t('SEARCH.VIEW_MORE').replace('#COUNT#', String(allFacets.length - 2))}
                </Text>
              </Pressable>
            )}
            {visibleFacets.map(f => (
              <Pressable
                key={f.key}
                style={[s.facetChip, f.checked && s.facetChipSelected, f.count === 0 && s.facetChipDisabled]}
                onPress={() => f.count !== 0 && onFacetToggle?.(f.key)}
                disabled={f.count === 0}
              >
                <Text style={[s.facetChipText, { fontFamily: langFonts.regular }, f.checked && s.facetChipTextSelected]}>{f.value}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

      </SafeAreaView>

      <FacetFilterModal
        visible={showFacetModal}
        facets={allFacets}
        onClose={() => setShowFacetModal(false)}
        onApply={checkedKeys => {
          setShowFacetModal(false)
          onFacetsApply?.(checkedKeys)
        }}
      />
    </Animated.View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Figma: drop-shadow 0px 8px 8px rgba(0,0,0,0.08)
  header: {
    backgroundColor: Colors.white,
    shadowColor:     '#000000',
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       4,
  },
  headerAbsolute: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    zIndex:   10,
  },
  safeTop: {
    backgroundColor: 'transparent',
  },
  // Figma: title at top 12, gap below title = 20 before chips (total 56 from content start)
  // paddingTop/paddingBottom (not margin) so onTitleLayout's measured height
  // includes them — a View's onLayout reports only its own box, not its margin,
  // so with margin here the scroll-hide animation only slid the header up by the
  // bare 24px content height, leaving the 12+8 margin as a visible sliver after
  // "hiding" instead of the row fully tucking away.
  titleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingLeft:    16,
    paddingRight:   16,
    paddingTop:     12,
    paddingBottom:  8,
  },
  // Angular: matches.page.html — "#COUNT# profiles based on your preferences." then
  // "Edit preferences" always on its own line below (column, not a wrapping row).
  ppRow: {
    flexDirection:     'column',
    alignItems:        'flex-start',
    paddingLeft:       16,
    paddingRight:      16,
    marginBottom:      12,
    marginTop    : 12,
    gap:               2,
  },
  // Figma: #000000 — fontFamily applied inline (langFonts.regular), see Text usage.
  ppText: {
    fontSize:   14,
    color:      '#000000',
  },
  ppEditBtn: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  ppEditText: {
    fontSize:   14,
    color:      Colors.link,
  },
  // Figma: Poppins-SemiBold 18 #000000 — fontFamily applied inline (langFonts.semiBold).
  title: {
    fontSize:   18,
    lineHeight: 24,
    color:      '#000000',
  },
  titleActions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  facetRow: {
    paddingLeft:   16,
    paddingRight:  16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  facetChip: {
    height:            32,
    paddingHorizontal: 12,
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       Colors.inputBorder,
    justifyContent:    'center',
    flexShrink:        0,
  },
  facetChipSelected: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.chipSurfaceSelected,
  },
  facetChipDisabled: { opacity: 0.4 },
  // fontFamily applied inline (langFonts.regular) — see Text usage.
  facetChipText: {
    fontSize:   12,
    color:      '#4c4c4c',
  },
  facetChipTextSelected: { color: Colors.primary },
})
