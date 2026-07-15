// New screen — same rationale as ReligiousDetailsScreen/ProfessionalDetailsScreen:
// Angular navigates each field straight to /editform/:id individually; this
// follows the group-screen pattern the new design uses elsewhere instead.
//
// SCOPE (by explicit agreement — not a silent cut): Height and Age/DOB are
// deferred to a focused follow-up. In Angular/onboarding both have far more
// involved UI than a simple picker — Height is a category-bracket-or-exact-
// height side panel, Age is a full Date-of-Birth flow (three dropdowns) with
// a "just enter age" fallback sheet. Reusing that complexity here needs its
// own pass rather than a rushed inline reimplementation. This screen covers
// Name, Mother tongue, Location (Lives in), and Hometown.
//
// One-time-edit locks (Angular: NAMEEDIT/MOTHERTONGUEEDIT flags): a locked
// field stays tappable but shows a "contact support" message instead of
// opening its editor — ported from edit-profile.page.ts's showDisableToast()/
// restrictPopup(). Name gets its own dedicated message (NAMEDISABLE); Mother
// tongue falls back to the generic RESTRICT_FIELD/RESTRICT_SUPPORT pair,
// matching Angular exactly (no dedicated MOTHERTONGUEDISABLE string exists).
//
// Location/Hometown are each a State→City cascade, mirroring the Religion→
// Caste pattern already built. NRI-specific fields (nriCountry/nriState) and
// the Hindi-specific "home place domain" conditional aren't handled — flagged,
// not silently assumed away.

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { fetchEditProfileInfo, submitFieldChanges, type FieldChange } from '../../service/editProfileService'
import { fetchMotherTongueOptions, fetchStates, fetchCities } from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import SelectField from '../../components/input/SelectField'
import FloatingLabelInput, { validateName } from '../../components/input/FloatingLabelInput'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

type Props = { navigation: any }
type Picker = 'motherTongue' | 'state' | 'city' | 'homeState' | 'homeCity' | null

export default function BasicDetailsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName]           = useState('')
  const [nameError, setNameError] = useState<string | undefined>(undefined)
  const [nameEditable, setNameEditable] = useState(true)

  const [motherTongue, setMotherTongue]                 = useState<PickerOption | null>(null)
  const [motherTongueEditable, setMotherTongueEditable] = useState(true)

  const [state, setState] = useState<PickerOption | null>(null)
  const [city, setCity]   = useState<PickerOption | null>(null)
  const [homeState, setHomeState] = useState<PickerOption | null>(null)
  const [homeCity, setHomeCity]   = useState<PickerOption | null>(null)

  const [original, setOriginal] = useState<{
    name?: string | undefined
    motherTongue?: string | undefined
    state?: string | undefined
    city?: string | undefined
    homeState?: string | undefined
    homeCity?: string | undefined
  }>({})

  const [motherTongueOptions, setMotherTongueOptions] = useState<PickerOption[]>([])
  const [stateOptions, setStateOptions]               = useState<PickerOption[]>([])
  const [cityOptions, setCityOptions]                 = useState<PickerOption[]>([])
  const [homeCityOptions, setHomeCityOptions]         = useState<PickerOption[]>([])

  const [activePicker, setActivePicker] = useState<Picker>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const info = await fetchEditProfileInfo()
    if (!info) { setLoading(false); return }

    setName(info.name ?? '')
    setNameEditable(info.nameEditable)
    setMotherTongueEditable(info.motherTongueEditable)
    setOriginal({
      name: info.name, motherTongue: info.motherTongue,
      state: info.state, city: info.city,
      homeState: info.homeState, homeCity: info.homeCity,
    })

    const [motherTongueList, stateList] = await Promise.all([
      fetchMotherTongueOptions(),
      fetchStates(),
    ])
    setMotherTongueOptions(motherTongueList)
    setStateOptions(stateList)
    setMotherTongue(motherTongueList.find(o => o.key === info.motherTongue) ?? null)
    setState(stateList.find(o => o.key === info.state) ?? null)
    setHomeState(stateList.find(o => o.key === info.homeState) ?? null)

    const [cityList, homeCityList] = await Promise.all([
      info.state ? fetchCities(info.state) : Promise.resolve([]),
      info.homeState ? fetchCities(info.homeState) : Promise.resolve([]),
    ])
    setCityOptions(cityList)
    setHomeCityOptions(homeCityList)
    setCity(cityList.find(o => o.key === info.city) ?? null)
    setHomeCity(homeCityList.find(o => o.key === info.homeCity) ?? null)

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function showRestricted(field: 'name' | 'motherTongue') {
    if (field === 'name') {
      Alert.alert(t('EDITPROFILE.RESTRICT_FIELD'), t('EDITPROFILE.NAMEDISABLE'))
    } else {
      Alert.alert(t('EDITPROFILE.RESTRICT_FIELD'), t('EDITPROFILE.RESTRICT_SUPPORT'))
    }
  }

  async function handleSelectState(opt: PickerOption) {
    setState(opt)
    setActivePicker(null)
    if (opt.key === state?.key) return
    setCity(null)
    const list = await fetchCities(opt.key)
    setCityOptions(list)
  }

  async function handleSelectHomeState(opt: PickerOption) {
    setHomeState(opt)
    setActivePicker(null)
    if (opt.key === homeState?.key) return
    setHomeCity(null)
    const list = await fetchCities(opt.key)
    setHomeCityOptions(list)
  }

  function handleNameChange(text: string) {
    setName(text)
    if (nameError) setNameError(undefined)
  }

  async function handleSubmit() {
    if (submitting) return

    if (nameEditable && name !== original.name) {
      const err = validateName(name)
      if (err) { setNameError(err); return }
    }

    setSubmitting(true)
    const changes: FieldChange[] = []

    if (nameEditable && name && name !== original.name) {
      changes.push({ field: 'NAME', value: name, existingValue: original.name })
    }
    if (motherTongueEditable && motherTongue && motherTongue.key !== original.motherTongue) {
      changes.push({ field: 'MOTHERTONGUE', value: motherTongue.key, existingValue: original.motherTongue })
    }
    // STATE/CITY share TYPE code 6 — Angular sends them as one composite update.
    // Composite VALUE format ('~'-joined) inferred from this app's established
    // convention for multi-part values elsewhere — not independently confirmed
    // against a live capture the way EXISTINGVALUE was. Worth verifying.
    if (state && city && (state.key !== original.state || city.key !== original.city)) {
      changes.push({
        field: 'STATE',
        value: `${state.key}~${city.key}`,
        existingValue: `${original.state ?? ''}~${original.city ?? ''}`,
      })
    }
    if (homeState && homeCity && (homeState.key !== original.homeState || homeCity.key !== original.homeCity)) {
      changes.push({
        field: 'HOMESTATE',
        value: `${homeState.key}~${homeCity.key}`,
        existingValue: `${original.homeState ?? ''}~${original.homeCity ?? ''}`,
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
        <Text style={s.heading}>{t('EDITPROFILE.BASIC_DETAILS')}</Text>

        {nameEditable ? (
          <FloatingLabelInput
            label={t('EDITPROFILE.NAME')}
            value={name}
            onChangeText={handleNameChange}
            errorMessage={nameError}
            variant="name"
          />
        ) : (
          <SelectField label={t('EDITPROFILE.NAME')} value={name} locked onPress={() => showRestricted('name')} />
        )}

        {motherTongueEditable ? (
          <SelectField label={t('EDITPROFILE.MOTHERTONGUE')} value={motherTongue?.label} onPress={() => setActivePicker('motherTongue')} />
        ) : (
          <SelectField label={t('EDITPROFILE.MOTHERTONGUE')} value={motherTongue?.label} locked onPress={() => showRestricted('motherTongue')} />
        )}

        <SelectField label={t('EDITPROFILE.CURRENT_LOCATION')} value={state?.label} onPress={() => setActivePicker('state')} />
        <SelectField label="City" value={city?.label} placeholder={state ? 'Select city' : 'Select state first'} onPress={() => state && setActivePicker('city')} />

        <SelectField label={t('EDITPROFILE.NATIVE_PLACE')} value={homeState?.label} onPress={() => setActivePicker('homeState')} />
        <SelectField label="Hometown city" value={homeCity?.label} placeholder={homeState ? 'Select city' : 'Select state first'} onPress={() => homeState && setActivePicker('homeCity')} />

        <Pressable style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={s.submitBtnText}>{t('GENERAL.SUBMIT')}</Text>}
        </Pressable>
      </ScrollView>

      <SearchablePicker
        visible={activePicker === 'motherTongue'}
        title={t('EDITPROFILE.MOTHERTONGUE')}
        placeholder="Search mother tongue..."
        options={motherTongueOptions}
        selectedKey={motherTongue?.key}
        onSelect={opt => { setMotherTongue(opt); setActivePicker(null) }}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'state'}
        title="Select state"
        placeholder="Search state..."
        options={stateOptions}
        selectedKey={state?.key}
        onSelect={handleSelectState}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'city'}
        title="Select city"
        placeholder="Search city..."
        options={cityOptions}
        selectedKey={city?.key}
        onSelect={opt => { setCity(opt); setActivePicker(null) }}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'homeState'}
        title="Select hometown state"
        placeholder="Search state..."
        options={stateOptions}
        selectedKey={homeState?.key}
        onSelect={handleSelectHomeState}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'homeCity'}
        title="Select hometown city"
        placeholder="Search city..."
        options={homeCityOptions}
        selectedKey={homeCity?.key}
        onSelect={opt => { setHomeCity(opt); setActivePicker(null) }}
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
