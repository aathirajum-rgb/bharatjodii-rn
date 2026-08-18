import { useState } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import CdnSvg from '../cdn-svg/CdnSvg'
import FilterChipsRow, { MOBILE_FILTER_CHIPS } from './FilterChipsRow'
import FacetFilterModal from './FacetFilterModal'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import type { ExploreFacet } from '../../service/homeService'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const CDN = CDN_SVG

// Exported so MatchesDesktopNav shares the same language-label map instead of
// duplicating it.
export const LANG_LABELS: Record<string, string> = {
  en: 'English', tm: 'Tamil', tl: 'Telugu', hi: 'Hindi',
  ml: 'Malayalam', kn: 'Kannada', bn: 'Bengali', mt: 'Marathi',
  or: 'Odia', gj: 'Gujarati', pa: 'Punjabi',
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface MatchesHeaderProps {
  headerAnim:      Animated.Value
  loading:         boolean
  totalCount:      number
  langCode:        string
  selectedChip:    string
  onChipSelect:    (key: string) => void
  onLanguagePress?: () => void
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
  onLanguagePress,
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
  const langLabel = LANG_LABELS[langCode] ?? 'English'
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
          {/* Figma: count-first — "323 Matches", not Angular's "Matches (323)" — so we
              reuse the bare noun from GENERAL.ICON_1 (also the footer tab label) rather
              than SEARCH.MATCHES_FOUND, which bakes in Angular's word order/parens. */}
          <Text style={s.title}>
            {loading ? (titleOverride ?? t('GENERAL.ICON_1')) : (titleOverride ?? `${totalCount} ${t('GENERAL.ICON_1')}`)}
          </Text>

          <View style={s.titleActions}>
            {/* Figma: bordered pill — 1px black, 8px radius, pl-8/pr-12/py-4, gap-4 */}
            <Pressable style={s.langPill} onPress={onLanguagePress} hitSlop={8}>
              <CdnSvg uri={CDN + 'revamp/lang-change-img.svg'} width={24} height={24} />
              <Text style={s.langText}>{langLabel}</Text>
            </Pressable>
          </View>
        </View>

        {/* Angular: matches.page.html — "#COUNT# profiles based on your preferences." on
            line 1, "Edit preferences" on line 2 — forced, not width-dependent wrap.
            Angular: *ngIf="!isExploreMatches && contentLoaded" — hidden inside a category. */}
        {!loading && !isExploreMode && (
          <View style={s.ppRow}>
            <Text style={s.ppText}>
              {t('MATCHES.PROFILE_COUNT').replace('#COUNT#', String(totalCount))}
            </Text>
            <Pressable style={s.ppEditBtn} onPress={onEditPreferences} hitSlop={8}>
              <Text style={s.ppEditText}>{t('MATCHES.EDIT_PP')}</Text>
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
                <Text style={s.facetChipText}>
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
                <Text style={[s.facetChipText, f.checked && s.facetChipTextSelected]}>{f.value}</Text>
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
    gap:               2,
  },
  // Figma: #000000
  ppText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   14,
    color:      '#000000',
  },
  ppEditBtn: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  ppEditText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   14,
    color:      Colors.link,
  },
  // Figma: Poppins-SemiBold 18 #000000
  title: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   18,
    lineHeight: 24,
    color:      '#000000',
  },
  titleActions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  // Figma: bordered pill — 1px solid black, 8px radius, pl-8/pr-12/py-4, gap-4
  langPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    borderWidth:       1,
    borderColor:       '#000000',
    borderRadius:      8,
    paddingLeft:       8,
    paddingRight:      12,
    paddingVertical:   4,
  },
  langText: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium,
    fontSize:   12,
    color:      '#000000',
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
  facetChipText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   12,
    color:      '#4c4c4c',
  },
  facetChipTextSelected: { color: Colors.primary },
})
