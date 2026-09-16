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
// field stays tappable but opens FieldRestrictedSheet instead of its editor —
// the port of edit-profile.page.ts's showDisableToast() -> restrictPopup(),
// i.e. lowerpopup.component's `action == 'editFieldRestrict'` popup. Both
// fields get the same generic RESTRICT_FIELD/RESTRICT_SUPPORT copy, matching
// Angular (its per-field NAMEDISABLE toast is commented out there).
//
// Location/Hometown are each a State→City cascade, mirroring the Religion→
// Caste pattern already built.
//
// Native place / Hometown city are only asked for the mother tongues in the
// native-place domain (Angular: isHomeTownVisible() over NATIVEPLACEDOMAIN,
// falling back to the hardcoded homeTownDomain list) — see homeTownVisible
// below. NRI-specific fields (nriCountry/nriState) are still not handled —
// flagged, not silently assumed away.

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, FontSize } from '../../src/theme/fonts'
import { CDN_REACT } from '../../constants/cdn'
import { fetchEditProfileInfo, submitFieldChanges, type FieldChange } from '../../service/editProfileService'
import { fetchMotherTongueOptions, fetchStates, fetchCities, fetchHomeTownDomain } from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import SelectField from '../../components/input/SelectField'
import FloatingLabelInput, { validateName } from '../../components/input/FloatingLabelInput'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'
import FieldRestrictedSheet from '../../components/edit-profile/FieldRestrictedSheet'
import { handleBack } from '../../utils/navigationRef'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

type Props = { navigation: any }
type Picker = 'motherTongue' | 'state' | 'city' | 'homeState' | 'homeCity' | null

export default function BasicDetailsScreen({ navigation: _navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName]           = useState('')
  const [nameError, setNameError] = useState<string | undefined>(undefined)
  const [nameEditable, setNameEditable] = useState(true)

  const [motherTongue, setMotherTongue]                 = useState<PickerOption | null>(null)
  const [motherTongueEditable, setMotherTongueEditable] = useState(true)
  const [restrictedVisible, setRestrictedVisible] = useState(false)
  // Angular: isHomeTownVisible() — only a few mother tongues are asked for a
  // separate native place. Mother tongue is editable on THIS screen, so the
  // domain list is held and re-checked against the live selection rather than
  // resolved once for the loaded value.
  const [homeTownDomain, setHomeTownDomain] = useState<string[]>([])

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

    const [motherTongueList, stateList, homeTownDomainList] = await Promise.all([
      fetchMotherTongueOptions(),
      fetchStates(),
      fetchHomeTownDomain(),
    ])
    setMotherTongueOptions(motherTongueList)
    setStateOptions(stateList)
    setHomeTownDomain(homeTownDomainList)
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

  // Angular's showDisableToast() routes every locked field — name included —
  // through the same restrictPopup(), which always renders the generic
  // RESTRICT_FIELD/RESTRICT_SUPPORT pair (its per-field NAMEDISABLE toast is
  // commented out there). So one shared sheet covers both fields rather than
  // the two different native OS alerts this used to raise.
  function showRestricted() {
    setRestrictedVisible(true)
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

  // Angular: isHomeTownVisible() against the live mother-tongue selection, not
  // the loaded one — this screen can change it.
  const homeTownVisible = !!motherTongue && homeTownDomain.includes(String(motherTongue.key))

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
    // Gated on homeTownVisible too: if the member's mother tongue isn't in the
    // native-place domain the fields aren't shown, so any values still sitting
    // in state (e.g. loaded, then mother tongue switched) must not be saved.
    if (homeTownVisible && homeState && homeCity && (homeState.key !== original.homeState || homeCity.key !== original.homeCity)) {
      changes.push({
        field: 'HOMESTATE',
        value: `${homeState.key}~${homeCity.key}`,
        existingValue: `${original.homeState ?? ''}~${original.homeCity ?? ''}`,
      })
    }

    if (changes.length === 0) {
      setSubmitting(false)
      handleBack()
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
    handleBack()
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
        <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
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
          <SelectField label={t('EDITPROFILE.NAME')} value={name} locked onPress={showRestricted} />
        )}

        {motherTongueEditable ? (
          <SelectField label={t('EDITPROFILE.MOTHERTONGUE')} value={motherTongue?.label} onPress={() => setActivePicker('motherTongue')} />
        ) : (
          <SelectField label={t('EDITPROFILE.MOTHERTONGUE')} value={motherTongue?.label} locked onPress={showRestricted} />
        )}

        <SelectField label={t('EDITPROFILE.CURRENT_LOCATION')} value={state?.label} onPress={() => setActivePicker('state')} />
        <SelectField label="City" value={city?.label} placeholder={state ? 'Select city' : 'Select state first'} onPress={() => state && setActivePicker('city')} />

        {/* Only asked for the mother tongues in the native-place domain — see
            homeTownDomain above. Re-evaluated against the CURRENT selection, so
            switching mother tongue shows/hides the pair immediately. */}
        {homeTownVisible && (
          <>
            <SelectField label={t('EDITPROFILE.NATIVE_PLACE')} value={homeState?.label} onPress={() => setActivePicker('homeState')} />
            <SelectField label="Hometown city" value={homeCity?.label} placeholder={homeState ? 'Select city' : 'Select state first'} onPress={() => homeState && setActivePicker('homeCity')} />
          </>
        )}

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

      <FieldRestrictedSheet visible={restrictedVisible} onClose={() => setRestrictedVisible(false)} />
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
  // App-wide screen-header convention (16/Medium/#333333), not Angular's own
  // edit-profile header (`heading1-semibold-20 black-color`) — kept so this
  // screen's header matches every other stack screen.
  headerTitle: {
    flex: 1, fontSize: FontSize.font16, fontFamily: Fonts.poppinsMedium,
    color: '#333333', marginLeft: 6, marginRight: 16,
  },

  content: { paddingHorizontal: 24, paddingTop: 32 },
  // Same section heading as the Edit Profile hub's section titles — Angular:
  // `heading-03-bold-20 color-333333` (edit-profile.page.html:335, 670, 896,
  // 971) = var(--font20) + var(--heading-03-*-Bold) (Poppins-Bold) + #333333.
  heading: {
    fontSize: FontSize.font20, fontFamily: Fonts.poppinsBold,
    color: Colors.textDark, marginBottom: 24,
  },

  submitBtn: {
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  // Angular primary CTA copy: `primary-cta-jodii body1-medium-14 white-color`
  // = var(--font14) + --english-medium-poppins (Poppins-Medium) + #ffffff.
  submitBtnText: { color: Colors.white, fontSize: FontSize.font14, fontFamily: Fonts.poppinsMedium },
})
