import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import CdnSvg from '../cdn-svg/CdnSvg'
import FilterChipsRow, { type ChipConfig } from './FilterChipsRow'
import FacetFilterModal from './FacetFilterModal'
import LanguagePill, { LANG_LABELS } from '../language-pill/LanguagePill'
import { Colors } from '../../constants/colors'
import { CDN_SVG, CDN_REACT } from '../../constants/cdn'
import type { ExploreFacet } from '../../service/homeService'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { FontSize } from '../../src/theme/fonts'
import { handleBack } from '../../utils/navigationRef'

const CDN = CDN_SVG
const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

// Re-exported so existing imports (ViewProfileScreen.tsx, ViewProfileDesktopLayout.tsx,
// MatchesDesktopNav.tsx, StarMatchingDesktopLayout.tsx) keep working unchanged —
// the canonical definition now lives in components/language-pill/LanguagePill.tsx,
// which also owns the pill's markup/styling and the sheet it opens.
export { LANG_LABELS }

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface MatchesHeaderProps {
  loading:         boolean
  totalCount:      number
  langCode:        string
  // Angular: the `[filterDataFromMatches]="{list: hdrSearchList, …}"` input —
  // matches.page.ts builds the row from the API and passes it down, rather than
  // the chip row owning a static list of its own.
  chips:           ChipConfig[]
  // Angular gives every quick-filter chip its own `isSelected`, so more than one
  // can be on at a time — this is the set that is ON, not a single active key.
  selectedChips:   string[]
  onChipSelect:    (key: string) => void
  // Angular: filterService.updateFilterEditCount — the badge on the Filters chip.
  filterCount?:    number
  // Angular: getPPContent()'s count — the saved Partner Preference total, which
  // stays put while a quick filter narrows the list. NOT totalCount, which is
  // the current result set and drives the title above.
  preferenceCount?: number
  onEditPreferences?: () => void
  onHeaderLayout:  (height: number) => void
  // Explore-by-category mode (#5/#6) — facet refinement chips returned inline by
  // the explore listing response. Angular: matches.page.html:94-114 facetResponce row.
  facets?:         ExploreFacet[]
  onFacetToggle?:  (key: string) => void
  // "View more" modal Apply — Angular: pillFilter() with all checked facet KEYs
  // joined by '~' (matches.page.ts:1952-1988), not one-at-a-time like onFacetToggle.
  onFacetsApply?:  (checkedKeys: string[]) => void
  // Explore-by-category mode — Angular shows the category's own label instead of
  // "N Matches" as the page title (matches.page.ts pageTitle), PLUS the live
  // result count appended in parens once it's known — setPageTitle() does
  // `title = (discoverData.TITLE1||TITLE) + ' (' + count + ')'`, not the bare
  // label alone.
  titleOverride?:  string | undefined
  // Angular: setPageTitle()'s one exception — exploreTypeUrl === 'MHOROSCOPELIST'
  // is the only category whose title never gets the "(count)" suffix.
  hideExploreCount?: boolean
  // Angular: matches.page.html gates BOTH the "#COUNT# profiles..."/Edit-preferences
  // row AND the quick-filter chip row on `!isExploreMatches` — neither applies once
  // you're inside a category (only the facet refinement chips make sense there).
  isExploreMode?:  boolean
  // Hide-on-scroll title row (MatchesScreen owns the scroll worklet — see its
  // handleListScroll — this component only paints the transform and reports
  // its own measured height back). titleRowHeight is a SharedValue rather than
  // a plain number so the worklet reads the current measured value without a
  // JS round-trip.
  titleTranslateY?: SharedValue<number>
  titleRowHeight?:  SharedValue<number>
}

// ─── MatchesHeader ─────────────────────────────────────────────────────────────

export default function MatchesHeader({
  loading,
  totalCount,
  langCode,
  chips,
  selectedChips,
  onChipSelect,
  filterCount = 0,
  preferenceCount = 0,
  onEditPreferences,
  onHeaderLayout,
  facets,
  onFacetToggle,
  onFacetsApply,
  titleOverride,
  hideExploreCount = false,
  isExploreMode = false,
  titleTranslateY,
  titleRowHeight,
}: MatchesHeaderProps) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
  const [showFacetModal, setShowFacetModal] = useState(false)

  // Slides the WHOLE header block (title+ppRow+chips+facets) up together, not
  // just the title — ppRow/chips ride up into the title's vacated spot instead
  // of leaving it behind as a blank gap. transform: [] (identity, no-op) when
  // the parent doesn't wire up the scroll-hide props, so this still works
  // standalone/unanimated.
  const headerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: titleTranslateY?.value ?? 0 }],
  }))

  // Angular: matches.page.ts facetChipLimit = 3 — always slice(0, 3) inline,
  // plus a "View more" chip when there are more than that (matches.page.html:94-114).
  const allFacets       = facets ?? []
  const visibleFacets   = allFacets.slice(0, 3)
  const hasMoreFacets   = allFacets.length > 3

  return (
    <SafeAreaView
      edges={['top']}
      style={[s.headerSafeArea, s.headerAbsolute]}
      onLayout={e => {
        const h = e.nativeEvent.layout.height
        if (h > 0) onHeaderLayout(h)
      }}
    >
      {/* Clips the header block below to this box — the box itself is sized by
          the block's own (unanimated) layout height, so it never changes; only
          the Animated.View's paint position (translateY) moves, and
          overflow:hidden crops whatever slides above y=0 (the title row). */}
      <View style={s.headerClip}>
      <Animated.View style={[s.header, headerAnimStyle]}>

        {/* Title row — Figma: top 12, height 24, "Matches (49)" left, icons right.
            Hide-on-scroll: this row is the first child of the block above, so
            it's the first thing to slide above the clip box's top edge and
            disappear — ppRow/chips/facets below it ride up to take its place
            rather than a blank gap being left behind. */}
        <View
          style={s.titleRow}
          onLayout={e => {
            const h = e.nativeEvent.layout.height
            if (h > 0 && titleRowHeight) titleRowHeight.value = h
          }}
        >
          <View style={s.titleLeft}>
            {/* Angular: matches.page.html:6-7 — `*ngIf="isExploreMatches"` puts a
                real back button (defaultHref redirectUrl||'/home') in its own
                1.5/12 column ahead of the title, which otherwise has no way back
                to Home since this screen is normally a bottom-nav tab, not a
                pushed page. */}
            {isExploreMode && (
              <Pressable onPress={() => handleBack()} hitSlop={8} style={s.backBtn}>
                <CdnSvg uri={ICON_BACK} width={24} height={24} />
              </Pressable>
            )}
            {/* Angular matches.page.ts's setPageTitle() — "Matches (#COUNT)" (SEARCH.MATCHES_FOUND)
                normally, not a count-first "323 Matches"; in explore mode it's
                `(discoverData.TITLE1||TITLE) + ' (' + count + ')'` instead — the
                category label ALSO gets the live count appended once it's known,
                not shown bare (MHOROSCOPELIST is the one exception, per
                hideExploreCount above). */}
            <Text style={[s.title, { fontFamily: langFonts.semiBold }]}>
              {loading
                ? (titleOverride ?? t('GENERAL.ICON_1'))
                : titleOverride
                  ? (hideExploreCount ? titleOverride : `${titleOverride} (${totalCount})`)
                  : t('SEARCH.MATCHES_FOUND').replace('#COUNT', String(totalCount))}
            </Text>
          </View>

          {/* Angular: matches.page.html:19-36 — the real (live, non-commented)
              language dropdown sits inside the same `*ngIf="!isExploreMatches"`
              block as the back-button/search column above — hidden entirely
              once you're inside a category, not just the profile-count/chip
              rows below it. */}
          {!isExploreMode && (
            <View style={s.titleActions}>
              <LanguagePill langCode={langCode} />
            </View>
          )}
        </View>

        {/* Angular: matches.page.html — "#COUNT# profiles based on your preferences." on
            line 1, "Edit preferences" on line 2 — forced, not width-dependent wrap.
            Angular: *ngIf="!isExploreMatches && contentLoaded" — hidden inside a category. */}
        {!loading && !isExploreMode && (
          <View style={s.ppRow}>
            <Text style={[s.ppText, { fontFamily: langFonts.regular }]}>
              {/* Angular getPPContent(): `#COUNT#` is a literal token in every
                  locale file, replaced by hand rather than interpolated, and
                  the number is the PP count — not the filtered one. */}
              {t('MATCHES.PROFILE_COUNT').replace('#COUNT#', String(preferenceCount))}
            </Text>
            <Pressable style={s.ppEditBtn} onPress={onEditPreferences} hitSlop={8}>
              <Text style={[s.ppEditText, { fontFamily: langFonts.regular }]}>{t('MATCHES.EDIT_PP')}</Text>
              <CdnSvg uri={CDN + 'registration-new/edit-pencil.svg'} width={16} height={16} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
        )}

        {/* Filter chips — Figma: top 56 from content start (12 title-top + 24 title + 20 gap).
            Angular: *ngIf="!isExploreMatches && hdrSearchList.length > 0" — same gate. */}
        {/* Angular also gates the whole row on `quickFilterSearchList?.length > 0`
            — with no chips there is nothing to scroll. */}
        {!isExploreMode && chips.length > 0 && (
          <FilterChipsRow
            chips={chips}
            selected={selectedChips}
            onSelect={onChipSelect}
            filterCount={filterCount}
          />
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

      </Animated.View>
      </View>

      {/* Modal — renders to its own native overlay regardless of where it sits
          in this tree, so it doesn't need to be (and shouldn't be) inside the
          clipped/translating block above. */}
      <FacetFilterModal
        visible={showFacetModal}
        facets={allFacets}
        onClose={() => setShowFacetModal(false)}
        onApply={checkedKeys => {
          setShowFacetModal(false)
          onFacetsApply?.(checkedKeys)
        }}
      />
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // The notch/status-bar inset strip — same gray as ActivityScreen.tsx's own
  // top SafeAreaView / AppHeader.tsx's h1SafeArea. Kept separate from the
  // opaque white header box below (s.header) so only the inset strip is gray.
  // The drop-shadow lives here, not on s.header below — Android's `elevation`
  // draws a shadow around every edge of the shadowed view, not just the
  // bottom; on s.header (which now sits below the inset padding rather than
  // flush with the real screen top) that top-edge shadow would bleed visibly
  // into the gray strip above it. Up here, this view's own top edge is still
  // flush with the actual screen top (off-screen), so only the bottom shadow
  // — the intended drop-shadow below the header — ever shows, same as before
  // this strip was split out.
  headerSafeArea: {
    backgroundColor: Colors.background,
    shadowColor:     '#000000',
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       4,
  },
  // Figma: drop-shadow 0px 8px 8px rgba(0,0,0,0.08)
  header: {
    backgroundColor: Colors.white,
  },
  headerAbsolute: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    zIndex:   10,
  },
  // Figma: title at top 12, gap below title = 20 before chips (total 56 from content start)
  // paddingTop/paddingBottom (not margin) so onTitleLayout's measured height
  // includes them — a View's onLayout reports only its own box, not its margin,
  // so with margin here the scroll-hide animation only slid the header up by the
  // bare 24px content height, leaving the 12+8 margin as a visible sliver after
  // "hiding" instead of the row fully tucking away.
  // Clips the header block's Animated.View to this box — see the comment
  // above its usage in the JSX.
  headerClip: {
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingLeft:    16,
    paddingRight:   16,
    paddingTop:     12,
    paddingBottom:  8,
  },
  // Groups the (explore-mode-only) back button with the title so the outer
  // titleRow's space-between still puts just two things — this group and
  // titleActions — at opposite ends, instead of the back button splitting
  // away to its own far-left slot once it's a 3rd flex child.
  // flexGrow (not just flexShrink) matters once titleActions is hidden in
  // explore mode (the language pill — see its own comment): without it this
  // View stayed sized to its own content instead of claiming the width
  // titleActions vacated, so the now-longer "label (count)" title wrapped to
  // 2 lines with empty space sitting unused to its right.
  titleLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    flexGrow:      1,
    flexShrink:    1,
  },
  // Angular: the back-button column sits directly against the grid's own
  // pl-24 (dropped to a plain 0 via !isExploreMatches's pl-24 toggle) — no
  // extra inset of its own, just the icon's natural touch target.
  backBtn: {
    marginRight: 8,
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
  // Angular: matches.page.html body2-regular-14 black-color — fontFamily
  // applied inline (langFonts.regular), see Text usage.
  ppText: {
    fontSize:   FontSize.font14,
    color:      Colors.black,
  },
  ppEditBtn: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  // Angular: matches.page.html body2-regular-14 color-29339B — fontFamily
  // applied inline (langFonts.regular), see Text usage.
  ppEditText: {
    fontSize:   FontSize.font14,
    color:      Colors.link,
  },
  // Angular: matches.page.html color-333333 heading2-semibold-18 — fontFamily
  // applied inline (langFonts.semiBold).
  title: {
    fontSize:   FontSize.font18,
    lineHeight: 24,
    color:      Colors.textDark,
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
  // Angular: matches.page.html body3-regular-12 color-4c4c4c — fontFamily
  // applied inline (langFonts.regular).
  facetChipText: {
    fontSize:   FontSize.font12,
    color:      Colors.extendedCardTitle,
  },
  // No Angular equivalent selected-text color exists (.filter-selected only
  // restyles the chip's background/border) — kept as a pre-existing RN-only
  // enhancement rather than removed; flagging here per the typography audit.
  facetChipTextSelected: { color: Colors.primary },
})
