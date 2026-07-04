// Desktop Matches sidebar (Figma "Jodii Desktop", node 225:2522) — visual
// design only, no filtering functionality. Rows are static "Any" values,
// checkboxes are unchecked, Reset/Apply are decorative. Matching real matches
// (like/don't-show/view-later/call/whatsapp) already work elsewhere on the
// page — this sidebar intentionally does not add a second, separate feature.
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

export default function MatchesFilterSidebar() {
  const { t } = useTranslation()

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{t('FILTER.FILTER_HEADER')}</Text>
        <Pressable onPress={noop}>
          <Text style={s.reset}>{t('FILTER.RESET_HEADER')}</Text>
        </Pressable>
      </View>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {FIELD_KEYS.map(key => (
          <FilterFieldRow key={key} label={t(`FILTER.${key}`)} value="Any" onPress={noop} />
        ))}

        <CheckboxGroup
          style={s.checkboxes}
          options={[
            { key: 'PHOTOAVAILABLE',     value: t('MATCHES.PP_ADDED_PHOTOS_CHECKBOX') },
            { key: 'HOROSCOPEAVAILABLE', value: t('MATCHES.PP_HOROSCOPE_CHECKBOX') },
          ]}
          onToggle={noop}
        />

        <View style={s.actions}>
          <Pressable style={s.resetBtn} onPress={noop}>
            <Text style={s.resetBtnText}>{t('FILTER.RESET_HEADER')}</Text>
          </Pressable>
          <Pressable style={s.applyBtn} onPress={noop}>
            <Text style={s.applyBtnText}>{t('GENERAL.APPLY')}</Text>
          </Pressable>
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
  actions: {
    flexDirection:  'row',
    gap:            8,
    marginVertical: 16,
  },
  resetBtn: {
    flex:              1,
    borderWidth:       1,
    borderColor:       Colors.borderLight,
    borderRadius:      8,
    paddingVertical:   12,
    alignItems:        'center',
  },
  resetBtnText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      Colors.textDark,
  },
  applyBtn: {
    flex:            1,
    backgroundColor: Colors.primary,
    borderRadius:    8,
    paddingVertical: 12,
    alignItems:      'center',
  },
  applyBtnText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      Colors.white,
  },
})
