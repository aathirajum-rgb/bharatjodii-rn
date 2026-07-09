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
    backgroundColor:  Colors.surface,
    borderWidth:      1,
    borderColor:      Colors.borderSubtle,
    borderRadius:     12,
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
    paddingHorizontal: 16,
    maxHeight:         600,
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
