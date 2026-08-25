// Desktop-web onboarding step A — Figma "Jodii Desktop - Registration"
// (997-27790 / 1448-3345): combines what mobile splits across 8 separate
// screens (GenderScreen, DOBScreen, HeightScreen, MaritalStatusScreen,
// MotherTongueScreen, ReligionScreen, CasteScreen, GothraScreen) into one
// scrollable card with two section titles: "Personal details" and
// "Religious & community details". Reuses those screens' exact fetch/save
// service calls — only the presentation (one card of dropdowns vs. eight
// full screens) is new.

import { useEffect, useState } from 'react'
import { Text, View, StyleSheet } from 'react-native'
import OnboardingDesktopLayout, { DesktopSectionTitle } from './OnboardingDesktopLayout'
import DesktopSelectField, { type SelectOption } from '../../components/desktop-select-field/DesktopSelectField'
import {
  CHILDREN_OPTIONS,
  fetchCasteOptions, fetchGenderOptions,
  fetchGothraOptions, fetchHeightCategoryOptions, fetchMaritalStatusOptions, fetchMotherTongueOptions,
  fetchReligionOptions, fetchSubcasteOptions, getNextPageAfterCaste, getRegValues, loadAndStoreStatesForMotherTongue,
  prefetchCasteForReligion, setRegValues, submitFullRegistration,
} from '../../service/registrationService'
import { Fonts } from '../../src/theme/fonts'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { stripAndDecodeHtml } from '../../utils/htmlEntities'

const MONTHS: SelectOption[] = [
  { key: '1', label: 'January' }, { key: '2', label: 'February' }, { key: '3', label: 'March' },
  { key: '4', label: 'April' }, { key: '5', label: 'May' }, { key: '6', label: 'June' },
  { key: '7', label: 'July' }, { key: '8', label: 'August' }, { key: '9', label: 'September' },
  { key: '10', label: 'October' }, { key: '11', label: 'November' }, { key: '12', label: 'December' },
]
function buildYears(): SelectOption[] {
  const max = new Date().getFullYear() - 18
  const min = max - 52
  return Array.from({ length: max - min + 1 }, (_, i) => {
    const y = String(max - i)
    return { key: y, label: y }
  })
}
function buildDays(month: string, year: string): SelectOption[] {
  const m = Number(month) || 1
  const y = Number(year) || 2000
  const count = new Date(y, m, 0).getDate()
  return Array.from({ length: count }, (_, i) => ({ key: String(i + 1), label: String(i + 1).padStart(2, '0') }))
}
// Labels from registrationService are already tag-stripped and entity-decoded by
// its label() helper; kept as a thin alias to the shared util so this stays
// correct for any raw string and never silently reintroduces &#x....; codes.
const stripHtml = stripAndDecodeHtml
const YEARS = buildYears()

type Props = { navigation: any }

export default function PersonalReligiousDesktopStep({ navigation }: Props) {
  const [submitting, setSubmitting] = useState(false)

  // Personal details
  const [genderOptions, setGenderOptions] = useState<SelectOption[]>([])
  const [gender, setGender] = useState<string | null>(null)
  const [selDate, setSelDate] = useState<string | null>(null)
  const [selMonth, setSelMonth] = useState<string | null>(null)
  const [selYear, setSelYear] = useState<string | null>(null)
  const [heightCategories, setHeightCategories] = useState<SelectOption[]>([])
  const [height, setHeight] = useState<string | null>(null)
  const [maritalOptions, setMaritalOptions] = useState<SelectOption[]>([])
  const [maritalStatus, setMaritalStatus] = useState<string | null>(null)
  const [noOfChildren, setNoOfChildren] = useState<string | null>(null)

  // Religious & community details
  const [motherTongueOptions, setMotherTongueOptions] = useState<SelectOption[]>([])
  const [motherTongue, setMotherTongue] = useState<string | null>(null)
  const [religionOptions, setReligionOptions] = useState<SelectOption[]>([])
  const [religion, setReligion] = useState<string | null>(null)
  const [casteOptions, setCasteOptions] = useState<SelectOption[]>([])
  const [caste, setCaste] = useState<string | null>(null)
  const [fetchingCaste, setFetchingCaste] = useState(false)
  const [subcasteOptions, setSubcasteOptions] = useState<SelectOption[]>([])
  const [subcaste, setSubcaste] = useState<string | null>(null)
  const [fetchingSubcaste, setFetchingSubcaste] = useState(false)
  const [showGothra, setShowGothra] = useState(false)
  const [gothraOptions, setGothraOptions] = useState<SelectOption[]>([])
  const [gothra, setGothra] = useState<string | null>(null)

  // ── Init: restore whatever's already saved (matches every mobile screen's own effect) ──
  // Extracted so a language change can re-run it — the option labels below are
  // server-translated. Angular: handleLanguageChange() → runInitialDataPopulation()
  // → getRegistrationDynamicArray(true, 1), then assignRegistrationData() re-resolves
  // the stored KEY against the newly translated list. Re-reading storage here does
  // the same, so the user's selection survives the switch.
  function loadOptions() {
    getRegValues().then(async rv => {
      const cb = rv.CREATEDBY ?? '1'
      if (rv.GENDER) setGender(rv.GENDER)
      if (rv.YEAR) setSelYear(rv.YEAR)
      if (rv.MONTH) setSelMonth(rv.MONTH)
      if (rv.DATE) setSelDate(rv.DATE)
      if (rv.HEIGHTCATEGORY) setHeight(rv.HEIGHTCATEGORY)
      if (rv.MARITALSTATUS) setMaritalStatus(rv.MARITALSTATUS)
      if (rv.NOOFCHILDREN) setNoOfChildren(rv.NOOFCHILDREN)
      if (rv.MOTHERTONGUE) setMotherTongue(rv.MOTHERTONGUE)
      if (rv.RELIGION) setReligion(rv.RELIGION)
      if (rv.CASTE) setCaste(rv.CASTE)
      if (rv.SUBCASTE) setSubcaste(rv.SUBCASTE)

      const gndForFetch = rv.GENDER ?? '1'
      const [genders, heights, marital, tongues, religions] = await Promise.all([
        fetchGenderOptions(cb),
        fetchHeightCategoryOptions(gndForFetch),
        fetchMaritalStatusOptions(gndForFetch),
        fetchMotherTongueOptions(),
        fetchReligionOptions(),
      ])
      setGenderOptions(genders.map(o => ({ key: o.key, label: o.label })))
      setHeightCategories(heights.map(o => ({ key: o.key, label: stripHtml(o.label) })))
      setMaritalOptions(marital)
      setMotherTongueOptions(tongues.map(o => ({ key: o.key, label: stripHtml(o.label) })))
      setReligionOptions(religions)

      if (rv.RELIGION && rv.CASTE) {
        await prefetchCasteForReligion(rv.RELIGION, rv.MOTHERTONGUE ?? '')
        const castes = await fetchCasteOptions(rv.RELIGION, rv.MOTHERTONGUE ?? '')
        setCasteOptions(castes)
        if (rv.RELIGION !== '2') {
          const subs = await fetchSubcasteOptions(rv.RELIGION, rv.CASTE, rv.MOTHERTONGUE ?? '')
          setSubcasteOptions(subs)
        }
        const nextPage = await getNextPageAfterCaste(rv.CASTE)
        if (nextPage === '16') {
          setShowGothra(true)
          const gothras = await fetchGothraOptions()
          setGothraOptions(gothras)
          if (rv.GOTHRA) setGothra(rv.GOTHRA)
        }
      }
    })
  }

  useEffect(() => { loadOptions() }, [])

  useLanguageReload(loadOptions)

  // ── Religion change → reload caste list, clear downstream selections ──
  async function handleSelectReligion(opt: SelectOption) {
    setReligion(opt.key)
    setCaste(null); setSubcaste(null); setSubcasteOptions([])
    setShowGothra(false); setGothra(null); setGothraOptions([])
    setFetchingCaste(true)
    try {
      // fetchCasteOptions() returns whatever REGISTRATIONARRAYS.CASTE already
      // holds without checking it's for THIS religion — prefetchCasteForReligion
      // clears that stale cache first (mirrors ReligionScreen.tsx's own
      // religion-select handler), otherwise switching religion here would
      // silently keep showing the previous religion's caste list.
      await prefetchCasteForReligion(opt.key, motherTongue ?? '')
      const castes = await fetchCasteOptions(opt.key, motherTongue ?? '')
      setCasteOptions(castes)
    } finally {
      setFetchingCaste(false)
    }
  }

  // ── Caste change → reload subcaste list + gothra-availability ──
  async function handleSelectCaste(opt: SelectOption) {
    setCaste(opt.key)
    setSubcaste(null)
    setShowGothra(false); setGothra(null); setGothraOptions([])
    if (religion === '2') { setSubcasteOptions([]); return }
    setFetchingSubcaste(true)
    try {
      const [subs, nextPage] = await Promise.all([
        fetchSubcasteOptions(religion ?? '', opt.key, motherTongue ?? ''),
        getNextPageAfterCaste(opt.key),
      ])
      setSubcasteOptions(subs)
      if (nextPage === '16') {
        setShowGothra(true)
        setGothraOptions(await fetchGothraOptions())
      }
    } finally {
      setFetchingSubcaste(false)
    }
  }

  async function handleSelectMotherTongue(opt: SelectOption) {
    setMotherTongue(opt.key)
    await loadAndStoreStatesForMotherTongue(opt.key)
  }

  const showChildren = !!maritalStatus && maritalStatus !== '1'
  const dayOptions = buildDays(selMonth ?? '', selYear ?? '')

  const isValid = !!gender && !!selDate && !!selMonth && !!selYear && !!height
    && !!maritalStatus && !!motherTongue && !!religion && !!caste

  async function handleNext() {
    if (!isValid || submitting) return
    setSubmitting(true)
    try {
      await setRegValues({
        GENDER: gender!,
        LOGINGENDER: gender === '1' ? 'M' : 'F',
        DATEOFBIRTH: `${selYear}-${String(selMonth).padStart(2, '0')}-${String(selDate).padStart(2, '0')}`,
        YEAR: selYear!, MONTH: selMonth!, DATE: selDate!,
        HEIGHTCATEGORY: height!, HEIGHT: '',
        MARITALSTATUS: maritalStatus!,
        NOOFCHILDREN: showChildren ? (noOfChildren ?? '') : '',
        MOTHERTONGUE: motherTongue!,
        RELIGION: religion!,
        CASTE: caste!,
        SUBCASTE: subcaste ?? '',
        GOTHRA: showGothra ? (gothra ?? '') : '',
      })
      // This combined step is the desktop equivalent of mobile's Caste/Gothra
      // screens — whichever of those is the LAST one reached calls
      // submitFullRegistration() (not just callPartialRegistrationAPI) because
      // that's the call that actually creates the profile, returns MATRIID,
      // and establishes the real session token via autoLogin. Skipping it
      // (as this step originally did) leaves USER_ID/ATN empty, so every
      // authenticated call afterward — including photo upload — fails.
      const { matriId } = await submitFullRegistration()
      if (matriId) {
        navigation.push('onboarding', { pageNo: 'desktop-education-location' })
      }
      // else: API cancelled or error — stay on screen so user can retry.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <OnboardingDesktopLayout onNext={handleNext} nextDisabled={!isValid} nextLoading={submitting}>
      <DesktopSectionTitle title="Personal details" />

      <DesktopSelectField
        label="Gender" options={genderOptions} selectedKey={gender}
        onSelect={opt => setGender(opt.key)}
      />

      <Text style={st.subLabel}>Select your date of birth</Text>
      <View style={st.row}>
        <View style={st.rowItem}>
          <DesktopSelectField label="Date" options={dayOptions} selectedKey={selDate} onSelect={opt => setSelDate(opt.key)} />
        </View>
        <View style={st.rowItem}>
          <DesktopSelectField label="Month" options={MONTHS} selectedKey={selMonth} onSelect={opt => setSelMonth(opt.key)} />
        </View>
        <View style={st.rowItem}>
          <DesktopSelectField label="Year" options={YEARS} selectedKey={selYear} onSelect={opt => setSelYear(opt.key)} />
        </View>
      </View>

      <DesktopSelectField
        label="Height" placeholder="Select height" options={heightCategories} selectedKey={height}
        onSelect={opt => setHeight(opt.key)}
      />

      <DesktopSelectField
        label="Marital Status" options={maritalOptions} selectedKey={maritalStatus}
        onSelect={opt => setMaritalStatus(opt.key)}
      />

      {showChildren && (
        <DesktopSelectField
          label="No. of children" options={CHILDREN_OPTIONS} selectedKey={noOfChildren}
          onSelect={opt => setNoOfChildren(opt.key)}
        />
      )}

      <DesktopSectionTitle title="Religious & community details" />

      <DesktopSelectField
        label="Mother tongue" options={motherTongueOptions} selectedKey={motherTongue}
        onSelect={handleSelectMotherTongue}
      />

      <DesktopSelectField
        label="Religion" options={religionOptions} selectedKey={religion}
        onSelect={handleSelectReligion}
      />

      <DesktopSelectField
        label="Caste" placeholder={religion === '2' ? 'Select division' : 'Select caste'}
        options={casteOptions} selectedKey={caste} onSelect={handleSelectCaste}
        loading={fetchingCaste} disabled={!religion}
      />

      {!!caste && subcasteOptions.length > 0 && (
        <DesktopSelectField
          label="Sub caste" options={subcasteOptions} selectedKey={subcaste}
          onSelect={opt => setSubcaste(opt.key)} loading={fetchingSubcaste}
        />
      )}

      {showGothra && (
        <DesktopSelectField
          label="Gothram" options={gothraOptions} selectedKey={gothra}
          onSelect={opt => setGothra(opt.key)}
        />
      )}
    </OnboardingDesktopLayout>
  )
}

const st = StyleSheet.create({
  subLabel: { fontFamily: Fonts.poppinsMedium, fontWeight: '500', fontSize: 14, color: '#000000' },
  // zIndex here is required for the same reason as DesktopSelectField's own
  // wrapperOpen: this row is an extra stacking level between each date field
  // and the fields below it (Height, Marital Status), so a date dropdown's
  // own elevated z-index doesn't escape past this row's boundary without it.
  row: { flexDirection: 'row', gap: 12, zIndex: 1 },
  rowItem: { flex: 1 },
})
