import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import CdnSvg from '../cdn-svg/CdnSvg'
import FilterChipsRow, { MOBILE_FILTER_CHIPS } from './FilterChipsRow'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import type { ExploreFacet } from '../../service/homeService'

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
  // Explore-by-category mode — Angular shows the category's own label instead of
  // "N Matches" as the page title (matches.page.ts pageTitle).
  titleOverride?:  string | undefined
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
  titleOverride,
}: MatchesHeaderProps) {
  const { t } = useTranslation()
  const langLabel = LANG_LABELS[langCode] ?? 'English'

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
            line 1, "Edit preferences" on line 2 — forced, not width-dependent wrap. */}
        {!loading && (
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

        {/* Filter chips — Figma: top 56 from content start (12 title-top + 24 title + 20 gap) */}
        <FilterChipsRow chips={MOBILE_FILTER_CHIPS} selected={selectedChip} onSelect={onChipSelect} />

        {/* Facet refinement chips — explore-by-category mode only (#5) */}
        {facets && facets.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.facetRow}>
            {facets.map(f => (
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
  titleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingLeft:    16,
    paddingRight:   16,
    marginTop:      12,
    marginBottom:   8,
    height:         24,
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
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      '#000000',
  },
  ppEditBtn: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  ppEditText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      Colors.link,
  },
  // Figma: Poppins-SemiBold 18 #000000
  title: {
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-Medium',
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
    fontFamily: 'Poppins-Regular',
    fontSize:   12,
    color:      '#4c4c4c',
  },
  facetChipTextSelected: { color: Colors.primary },
})
