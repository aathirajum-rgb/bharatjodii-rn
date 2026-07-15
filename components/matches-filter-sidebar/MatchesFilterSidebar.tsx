// Desktop Matches sidebar (Figma "Jodii Desktop", node 225:2522).
// The 14 preference rows (Age/Location/.../Profile created) have no live
// per-field "current value" data source anywhere in the app — they keep the
// Figma-mock display values, but are now real entry points into the same
// `onEditPreferences` action the "Edit preferences" link above already uses.
// The two checkboxes reuse the SAME single-select quick-filter state as the
// chips above (PHOTOAVAILABLE/HOROSCOPEAVAILABLE are the same keys) — there's
// no separate multi-value facet system behind this sidebar.
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import FilterFieldRow from './FilterFieldRow'
import CheckboxGroup from '../checkbox/CheckboxGroup'
import { Colors } from '../../constants/colors'

const FIELD_KEYS = [
  'AGE', 'LOCATION', 'CASTE', 'STAR', 'DOSHAM', 'OCCUPATION', 'MONTHLYINCOME',
  'EDUCATION', 'HEIGHT', 'MOTHERTONGUE', 'RELIGION', 'MARITALSTATUS',
  'PHYSICALSTATUS', 'PROFILECREATED',
] as const

const noop = () => {}

export default function MatchesFilterSidebar({
  totalCount, selectedChip, onChipSelect, onEditPreferences,
}: {
  totalCount:         number
  selectedChip:       string
  onChipSelect:       (key: string) => void
  onEditPreferences?: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const editPreferences = onEditPreferences ?? noop

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{t('FILTER.FILTER_HEADER')}</Text>
        <Pressable onPress={() => onChipSelect('')}>
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
          <FilterFieldRow key={key} label={t(`FILTER.${key}`)} value="Any" onPress={editPreferences} />
        ))}

        <CheckboxGroup
          style={s.checkboxes}
          options={[
            { key: 'PHOTOAVAILABLE',     value: t('MATCHES.PP_ADDED_PHOTOS_CHECKBOX'), checked: selectedChip === 'PHOTOAVAILABLE' },
            { key: 'HOROSCOPEAVAILABLE', value: t('MATCHES.PP_HOROSCOPE_CHECKBOX'),    checked: selectedChip === 'HOROSCOPEAVAILABLE' },
          ]}
          onToggle={key => onChipSelect(selectedChip === key ? '' : key)}
        />

        <View style={s.footer}>
          <Text style={s.matchCount}>{t('MATCHES.MATCHES_PREVIEW_COUNT').replace('#COUNT#', String(totalCount))}</Text>
          <View style={s.actions}>
            <Pressable style={s.resetBtn} onPress={() => onChipSelect('')}>
              <Text style={s.resetBtnText}>{t('FILTER.RESET_HEADER')}</Text>
            </Pressable>
            <Pressable style={s.applyBtn} onPress={() => onChipSelect(selectedChip)}>
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
    fontFamily: 'Poppins-SemiBold',
    fontSize:   16,
    color:      Colors.textDark,
  },
  reset: {
    fontFamily: 'Poppins-Medium',
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
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-Medium',
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
    fontFamily: 'Poppins-Medium',
    fontSize:   12,
    color:      Colors.white,
  },
})
