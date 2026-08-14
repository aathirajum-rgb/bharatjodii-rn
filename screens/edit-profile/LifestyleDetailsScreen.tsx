// New screen — same rationale as the other Edit Profile group screens.
//
// Drinking/Smoking habits ARE editable — registration.page.ts's own
// editProfileUpdateObj copy has no TYPE code for either field, but the actual
// submit path for these two fields is the shared <app-form-fields> component
// (components/form-fields/form-fields.component.ts), which has a SEPARATE,
// more complete copy of that same map: SMOKING:'21', DRINKING:'22'. Confirmed
// by reading that second copy directly — see FIELD_TYPE_CODE's own comment
// in editProfileService.ts. Both now save through the same generic
// editprofileupdate call as every other field on this screen.

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { fetchEditProfileInfo, submitFieldChanges, type FieldChange } from '../../service/editProfileService'
import {
  fetchDrinkingHabitOptions, fetchSmokingHabitOptions, fetchEatingHabitOptions,
} from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import SelectField from '../../components/input/SelectField'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

type Props = { navigation: any }
type Picker = 'drinking' | 'smoking' | 'eating' | null

export default function LifestyleDetailsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [drinking, setDrinking] = useState<PickerOption | null>(null)
  const [smoking, setSmoking]   = useState<PickerOption | null>(null)
  const [eating, setEating]     = useState<PickerOption | null>(null)

  const [original, setOriginal] = useState<{
    drinking?: string | undefined
    smoking?:  string | undefined
    eating?:   string | undefined
  }>({})

  const [drinkingOptions, setDrinkingOptions] = useState<PickerOption[]>([])
  const [smokingOptions, setSmokingOptions]   = useState<PickerOption[]>([])
  const [eatingOptions, setEatingOptions]     = useState<PickerOption[]>([])

  const [activePicker, setActivePicker] = useState<Picker>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const info = await fetchEditProfileInfo()
    if (!info) { setLoading(false); return }

    setOriginal({ drinking: info.drinkingHabits, smoking: info.smokingHabits, eating: info.eatingHabits })

    const [drinkingList, smokingList, eatingList] = await Promise.all([
      fetchDrinkingHabitOptions(),
      fetchSmokingHabitOptions(),
      fetchEatingHabitOptions(),
    ])
    setDrinkingOptions(drinkingList)
    setSmokingOptions(smokingList)
    setEatingOptions(eatingList)
    setDrinking(drinkingList.find(o => o.key === info.drinkingHabits) ?? null)
    setSmoking(smokingList.find(o => o.key === info.smokingHabits) ?? null)
    setEating(eatingList.find(o => o.key === info.eatingHabits) ?? null)

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    const changes: FieldChange[] = []
    if (drinking && drinking.key !== original.drinking) {
      changes.push({ field: 'DRINKING', value: drinking.key, existingValue: original.drinking })
    }
    if (smoking && smoking.key !== original.smoking) {
      changes.push({ field: 'SMOKING', value: smoking.key, existingValue: original.smoking })
    }
    if (eating && eating.key !== original.eating) {
      changes.push({ field: 'EATING', value: eating.key, existingValue: original.eating })
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
        <Text style={s.heading}>Life style details</Text>

        <SelectField label={t('EDITPROFILE.DRINKING')} value={drinking?.label} onPress={() => setActivePicker('drinking')} />
        <SelectField label="Smoking habits" value={smoking?.label} onPress={() => setActivePicker('smoking')} />
        <SelectField label={t('EDITPROFILE.EATING')} value={eating?.label} onPress={() => setActivePicker('eating')} />

        <Pressable style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={s.submitBtnText}>{t('GENERAL.SUBMIT')}</Text>}
        </Pressable>
      </ScrollView>

      <SearchablePicker
        visible={activePicker === 'drinking'}
        title={t('EDITPROFILE.DRINKING')}
        placeholder="Search..."
        options={drinkingOptions}
        selectedKey={drinking?.key}
        onSelect={opt => { setDrinking(opt); setActivePicker(null) }}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'smoking'}
        title="Smoking habits"
        placeholder="Search..."
        options={smokingOptions}
        selectedKey={smoking?.key}
        onSelect={opt => { setSmoking(opt); setActivePicker(null) }}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'eating'}
        title={t('EDITPROFILE.EATING')}
        placeholder="Search..."
        options={eatingOptions}
        selectedKey={eating?.key}
        onSelect={opt => { setEating(opt); setActivePicker(null) }}
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
