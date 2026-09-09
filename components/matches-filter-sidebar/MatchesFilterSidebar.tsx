// Desktop Matches sidebar (Figma "Jodii Desktop", node 225:2522/1151:17450).
// The 14 preference rows (Age/Location/.../Profile created) now show the
// user's real saved search/PP selections (via useFilterDisplayValues, reading
// the same filterService AsyncStorage SearchScreen.tsx writes to) instead of
// a hardcoded "Any" placeholder — and are real entry points into the same
// `onEditPreferences` action the "Edit preferences" link above already uses.
// The two checkboxes reuse the SAME single-select quick-filter state as the
// chips above (PHOTOAVAILABLE/HOROSCOPEAVAILABLE are the same keys) — there's
// no separate multi-value facet system behind this sidebar.
import { useTranslation } from 'react-i18next'
import { useFocusEffect } from '@react-navigation/native'
import { useCallback } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import FilterFieldRow from './FilterFieldRow'
import CheckboxGroup from '../checkbox/CheckboxGroup'
import { QUICK_FILTER_ICON } from '../../service/filterService'
import { useFilterDisplayValues, type FilterFieldKey } from '../../hooks/useFilterDisplayValues'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

// Same field SET and ORDER as SearchScreen.tsx's own `rows` (the mobile "Edit
// preferences" screen, itself matching Angular) — this previously dropped
// EATINGHABITS entirely and placed RELIGION after MOTHERTONGUE instead of
// right after LOCATION, which read as "Religion is missing" since it only
// showed up far later in the scrollable list than every other version of
// this screen puts it.
const FIELD_KEYS = [
  'AGE', 'LOCATION', 'RELIGION', 'CASTE', 'STAR', 'DOSHAM', 'OCCUPATION', 'MONTHLYINCOME',
  'EDUCATION', 'HEIGHT', 'MOTHERTONGUE', 'MARITALSTATUS', 'EATINGHABITS',
  'PHYSICALSTATUS', 'PROFILECREATED',
] as const

const noop = () => {}

export default function MatchesFilterSidebar({
  totalCount, selectedChips, onChipSelect, onResetFilters, onApplyFilters, onEditPreferences,
}: {
  totalCount:         number
  // The quick-filter fields currently ON. Each toggles independently, matching
  // Angular's per-chip `isSelected` (see FilterChipsRow.tsx).
  selectedChips:      string[]
  onChipSelect:       (key: string) => void
  // Reset clears every quick filter at once; a per-key toggle can't express
  // that, and calling onChipSelect once per active key would re-query each time.
  onResetFilters?:    (() => void) | undefined
  // Each toggle already applies immediately (Angular's clickOnFilterChip calls
  // applyFilter()), so Apply just re-runs the current query.
  onApplyFilters?:    (() => void) | undefined
  onEditPreferences?: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const editPreferences = onEditPreferences ?? noop
  const resetFilters    = onResetFilters ?? noop
  const applyFilters    = onApplyFilters ?? noop
  const [filterDisplay, reloadFilterDisplay] = useFilterDisplayValues()

  // Refresh on every return to this screen — SearchScreen.tsx (navigated to via
  // onEditPreferences) is where these values actually change, and this sidebar
  // doesn't otherwise know when that happens (it only reads AsyncStorage once
  // per mount, and Matches often stays mounted underneath rather than remounting).
  useFocusEffect(useCallback(() => { reloadFilterDisplay() }, [reloadFilterDisplay]))

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{t('FILTER.FILTER_HEADER')}</Text>
        <Pressable onPress={resetFilters}>
          <Text style={s.reset}>{t('FILTER.RESET_HEADER')}</Text>
        </Pressable>
      </View>

      {/* Live desktop-web testing showed the previous "scroll away with the
          page" version go completely blank once scrolled past the sidebar's
          own (short, fixed) content — the match list kept going far longer
          than the filter fields do, so the shared-scroll page eventually left
          this whole column with nothing in it. Real requirement (confirmed
          against the actual running app, overriding the earlier design-only
          read): the Filters panel scrolls INDEPENDENTLY of the match list,
          each with its own scrollbar, side by side — this `list` is now the
          sidebar's own internal ScrollView again, sized to fill whatever
          height MatchesDesktopLayout's row stretches `container` to (flex:1,
          not a fixed content height), so it never runs out of its own content
          and never depends on how far the match list has scrolled. */}
      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {FIELD_KEYS.map(key => (
          <FilterFieldRow
            key={key}
            label={t(`FILTER.${key}`)}
            value={filterDisplay?.values[key as FilterFieldKey] ?? t('SEARCH.ANY')}
            active={filterDisplay?.active[key as FilterFieldKey] ?? false}
            onPress={editPreferences}
          />
        ))}

        <CheckboxGroup
          style={s.checkboxes}
          options={[
            { key: 'PHOTOAVAILABLE',     value: t('MATCHES.PP_ADDED_PHOTOS_CHECKBOX'), checked: selectedChips.includes('PHOTOAVAILABLE'),     icon: QUICK_FILTER_ICON.PHOTOAVAILABLE },
            { key: 'HOROSCOPEAVAILABLE', value: t('MATCHES.PP_HOROSCOPE_CHECKBOX'),    checked: selectedChips.includes('HOROSCOPEAVAILABLE'), icon: QUICK_FILTER_ICON.HOROSCOPEAVAILABLE },
          ]}
          onToggle={key => onChipSelect(key)}
        />

        <View style={s.footer}>
          <Text style={s.matchCount}>{t('MATCHES.MATCHES_PREVIEW_COUNT').replace('#COUNT#', String(totalCount))}</Text>
          <View style={s.actions}>
            <Pressable style={s.resetBtn} onPress={resetFilters}>
              <Text style={s.resetBtnText}>{t('FILTER.RESET_HEADER')}</Text>
            </Pressable>
            <Pressable style={s.applyBtn} onPress={applyFilters}>
              <Text style={s.applyBtnText}>{t('GENERAL.APPLY')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    width:            280,
    // Stretched to match MatchesDesktopLayout's row height (its default
    // cross-axis alignItems is 'stretch') rather than sized to this panel's
    // own content — `list` below then fills that with flex:1 so it gets a
    // real bounded height to scroll within, instead of an arbitrary maxHeight.
    //
    // marginTop (not the parent row's paddingTop) gives this card its 24px gap
    // below the nav — this panel is a static bordered card that should just
    // sit in place, unlike the match list's own top spacing, which needs to
    // live INSIDE its scrollable content so it can scroll away.
    marginTop:        24,
    backgroundColor:  Colors.surface,
    borderWidth:      1,
    borderColor:      Colors.borderSubtle,
    // Figma node 467:294: 8px radius (this used 12 — a plausible-looking guess
    // made before the design context was actually pulled).
    borderRadius:     8,
    overflow:         'hidden',
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  title: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   16,
    color:      Colors.textDark,
  },
  reset: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium,
    fontSize:   13,
    color:      Colors.link,
  },
  list: {
    flex:              1,
    paddingHorizontal: 16,
  },
  checkboxes: {
    marginTop: 8,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    marginTop:      16,
    paddingTop:     16,
    paddingBottom:  16,
    gap:            12,
  },
  matchCount: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   14,
    color:      Colors.textDark,
  },
  actions: {
    flexDirection: 'row',
    gap:           12,
  },
  resetBtn: {
    flex:              1,
    height:            40,
    borderWidth:       1,
    borderColor:       Colors.primaryDark,
    borderRadius:      4,
    alignItems:        'center',
    justifyContent:    'center',
  },
  resetBtnText: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium,
    fontSize:   12,
    color:      Colors.primaryDark,
  },
  applyBtn: {
    flex:            1,
    height:          40,
    backgroundColor: Colors.primaryDark,
    borderRadius:    4,
    alignItems:      'center',
    justifyContent:  'center',
  },
  applyBtnText: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium,
    fontSize:   12,
    color:      Colors.white,
  },
})
