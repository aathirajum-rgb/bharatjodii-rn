// New screen — same rationale as the other Edit Profile group screens.
//
// Angular's PROPERTIES field (TYPE code 18) is a single multi-select array,
// and edit-profile.page.html has exactly ONE row for it — "Properties
// owned" — displaying VIEWPROPERTIES. Codes '5'/'6'/'7' are explicitly
// filtered OUT of that display (comment: "remove vehicle related changes");
// they are never shown as a selectable "Own Vehicle" list anywhere in the
// real app (confirmed: onboarding's own PropertyDetailsScreen.tsx fallback
// options only cover codes 1-4 — house/land/other land/shop — no vehicle
// concept exists there either). An earlier version of this screen invented
// a second "Own Vehicle" picker from that filter comment, which had no real
// options to show since the assumption was wrong.
//
// Any pre-existing vehicle codes on a profile are carried through unchanged
// on Submit (recombined into the single PROPERTIES value alongside the
// user's real edits) rather than silently dropped — there's just no UI to
// view or change them, matching the real app.

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { fetchEditProfileInfo, submitFieldChanges, type FieldChange } from '../../service/editProfileService'
import { fetchPropertyOptions } from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import SelectField from '../../components/input/SelectField'
import MultiSelectPicker, { type MultiSelectOption } from '../../components/multi-select-picker/MultiSelectPicker'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'
const VEHICLE_CODES = new Set(['5', '6', '7'])

type Props = { navigation: any }
type Picker = 'properties' | null

export default function PropertyDetailsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [properties, setProperties] = useState<string[]>([])
  // Not editable anywhere in the real app — carried through as-is on Submit.
  const [legacyVehicleCodes, setLegacyVehicleCodes] = useState<string[]>([])
  const [originalAll, setOriginalAll] = useState<string[]>([])

  const [propertyOptions, setPropertyOptions] = useState<MultiSelectOption[]>([])

  const [activePicker, setActivePicker] = useState<Picker>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const info = await fetchEditProfileInfo()
    if (!info) { setLoading(false); return }

    setProperties(info.properties ?? [])
    setLegacyVehicleCodes(info.vehicles ?? [])
    setOriginalAll([...(info.properties ?? []), ...(info.vehicles ?? [])])

    const allOptions = await fetchPropertyOptions()
    setPropertyOptions(allOptions.filter(o => !VEHICLE_CODES.has(o.key)))

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function labelsFor(options: MultiSelectOption[], keys: string[]): string | undefined {
    if (keys.length === 0) return undefined
    const labels = keys.map(k => options.find(o => o.key === k)?.label ?? k)
    return labels.join(', ')
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    const currentAll = [...properties, ...legacyVehicleCodes]
    const changes: FieldChange[] = []
    const sameSet = currentAll.length === originalAll.length
      && currentAll.every(k => originalAll.includes(k))
    if (!sameSet) {
      changes.push({
        field: 'PROPERTIES',
        value: currentAll.join('~'),
        existingValue: originalAll.join('~'),
      })
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
        <Text style={s.heading}>Property details</Text>

        <SelectField
          label="Properties owned"
          value={labelsFor(propertyOptions, properties)}
          placeholder="Select properties"
          onPress={() => setActivePicker('properties')}
        />

        <Pressable style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={s.submitBtnText}>{t('GENERAL.SUBMIT')}</Text>}
        </Pressable>
      </ScrollView>

      <MultiSelectPicker
        visible={activePicker === 'properties'}
        title="Properties owned"
        options={propertyOptions}
        selectedKeys={properties}
        onApply={keys => { setProperties(keys); setActivePicker(null) }}
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
