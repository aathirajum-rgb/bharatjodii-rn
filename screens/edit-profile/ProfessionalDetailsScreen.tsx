// New screen — Angular has no equivalent "group screen"; it navigates each
// field straight to /editform/:id individually (see edit-profile.page.html).
// This follows the new Figma design (node 2357-3964) instead: Education,
// Occupation, and Monthly Income on one screen, one Submit button that saves
// everything changed on this screen in one go.
//
// Simpler than Religious details — these three fields have no cascading
// dependency on each other (unlike Religion→Caste or Raasi→Star→Dosham).
//
// Save mechanics (confirmed against Angular, not assumed): Submit loops
// through only the fields that changed and calls the same per-field
// editprofile/updatememberinfo/v1 endpoint once per field.

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { fetchEditProfileInfo, submitFieldChanges, type FieldChange } from '../../service/editProfileService'
import {
  fetchQualificationOptions, fetchOccupationOptions, fetchMonthlyIncomeOptions,
} from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import SelectField from '../../components/input/SelectField'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

type Props = { navigation: any }
type Picker = 'education' | 'occupation' | 'income' | null

export default function ProfessionalDetailsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [education, setEducation]   = useState<PickerOption | null>(null)
  const [occupation, setOccupation] = useState<PickerOption | null>(null)
  const [income, setIncome]         = useState<PickerOption | null>(null)
  const [incomeEditable, setIncomeEditable] = useState(true)

  const [original, setOriginal] = useState<{
    education?:  string | undefined
    occupation?: string | undefined
    income?:     string | undefined
  }>({})

  const [educationOptions, setEducationOptions]   = useState<PickerOption[]>([])
  const [occupationOptions, setOccupationOptions] = useState<PickerOption[]>([])
  const [incomeOptions, setIncomeOptions]         = useState<PickerOption[]>([])

  const [activePicker, setActivePicker] = useState<Picker>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const info = await fetchEditProfileInfo()
    if (!info) { setLoading(false); return }

    setOriginal({ education: info.education, occupation: info.occupation, income: info.income })
    setIncomeEditable(info.incomeEditable)

    const [educationList, occupationList, incomeList] = await Promise.all([
      fetchQualificationOptions(),
      fetchOccupationOptions(),
      fetchMonthlyIncomeOptions(),
    ])
    setEducationOptions(educationList)
    setOccupationOptions(occupationList)
    setIncomeOptions(incomeList)
    setEducation(educationList.find(o => o.key === info.education) ?? null)
    setOccupation(occupationList.find(o => o.key === info.occupation) ?? null)
    setIncome(incomeList.find(o => o.key === info.income) ?? null)

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    const changes: FieldChange[] = []
    if (education && education.key !== original.education) {
      changes.push({ field: 'QUALIFICATION', value: education.key, existingValue: original.education })
    }
    if (occupation && occupation.key !== original.occupation) {
      changes.push({ field: 'OCCUPATION', value: occupation.key, existingValue: original.occupation })
    }
    if (incomeEditable && income && income.key !== original.income) {
      changes.push({ field: 'INCOME', value: income.key, existingValue: original.income })
    }

    if (changes.length === 0) {
      setSubmitting(false)
      navigation.goBack()
      return
    }

    const result = await submitFieldChanges(changes)
    setSubmitting(false)

    if (result.failed.length > 0) {
      Alert.alert(
        'Some changes could not be saved',
        `${result.succeeded.length} saved, ${result.failed.length} failed: ${result.failed.join(', ')}`,
      )
      return
    }
    navigation.goBack()
  }

  function showRestricted() {
    Alert.alert(t('EDITPROFILE.RESTRICT_FIELD'), t('EDITPROFILE.RESTRICT_SUPPORT'))
  }

  if (loading) {
    return (
      <View style={[s.screen, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
      </View>
    )
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('EDITPROFILE.EDIT_PROFILE')}</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 16 }]} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>Professional details</Text>

        <SelectField label="Higher education" value={education?.label} onPress={() => setActivePicker('education')} />
        <SelectField label={t('EDITPROFILE.OCCUPATION')} value={occupation?.label} onPress={() => setActivePicker('occupation')} />
        {incomeEditable ? (
          <SelectField label="Monthly Income" value={income?.label} onPress={() => setActivePicker('income')} />
        ) : (
          <SelectField label="Monthly Income" value={income?.label} locked onPress={showRestricted} />
        )}

        <Pressable style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={s.submitBtnText}>{t('GENERAL.SUBMIT')}</Text>}
        </Pressable>
      </ScrollView>

      <SearchablePicker
        visible={activePicker === 'education'}
        title="Higher education"
        placeholder="Search education..."
        options={educationOptions}
        selectedKey={education?.key}
        onSelect={opt => { setEducation(opt); setActivePicker(null) }}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'occupation'}
        title={t('EDITPROFILE.OCCUPATION')}
        placeholder="Search occupation..."
        options={occupationOptions}
        selectedKey={occupation?.key}
        onSelect={opt => { setOccupation(opt); setActivePicker(null) }}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'income'}
        title="Monthly Income"
        placeholder="Search income..."
        options={incomeOptions}
        selectedKey={income?.key}
        onSelect={opt => { setIncome(opt); setActivePicker(null) }}
        onClose={() => setActivePicker(null)}
      />
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

  content: { paddingHorizontal: 24, paddingTop: 32 },
  heading: { fontSize: 20, fontWeight: '600', color: Colors.black, marginBottom: 24 },

  submitBtn: {
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  submitBtnText: { color: Colors.white, fontSize: 14, fontWeight: '500' },
})
