// Desktop-web onboarding step B — Figma "Jodii Desktop - Registration"
// (997-29066): combines QualificationScreen, OccupationScreen,
// MonthlyIncomeScreen, LocationScreen, and EatingHabitScreen (mobile) into
// one card with two section titles: "Education & Professional details" and
// "Location & lifestyle details". Reuses those screens' exact fetch/save
// service calls.
//
// Simplifications vs. the mobile screens (nothing shown for these in the
// Figma reference, so left out rather than guessed): MonthlyIncomeScreen's
// NRI/foreign-currency branch (Indian income list only), and HomeTownScreen's
// "is your hometown the same as your current city?" follow-up — this step
// only collects the fields actually visible in the shared design.

import { useEffect, useState } from 'react'
import OnboardingDesktopLayout, { DesktopSectionTitle } from './OnboardingDesktopLayout'
import DesktopSelectField, { type SelectOption } from '../../components/desktop-select-field/DesktopSelectField'
import {
  callPartialRegistrationAPI, fetchCities, fetchEatingHabitOptions, fetchMonthlyIncomeOptions,
  fetchOccupationOptions, fetchQualificationOptions, fetchStates, getRegValues, setRegValues,
} from '../../service/registrationService'

const INDIA_COUNTRY = '98'
const COUNTRY_OPTIONS: SelectOption[] = [{ key: INDIA_COUNTRY, label: 'India' }]

type Props = { navigation: any }

export default function EducationLocationDesktopStep({ navigation }: Props) {
  const [submitting, setSubmitting] = useState(false)

  // Education & Professional details
  const [qualificationOptions, setQualificationOptions] = useState<SelectOption[]>([])
  const [qualification, setQualification] = useState<string | null>(null)
  const [occupationOptions, setOccupationOptions] = useState<SelectOption[]>([])
  const [occupation, setOccupation] = useState<string | null>(null)
  const [incomeOptions, setIncomeOptions] = useState<SelectOption[]>([])
  const [income, setIncome] = useState<string | null>(null)

  // Location & lifestyle details
  const [stateOptions, setStateOptions] = useState<SelectOption[]>([])
  const [state, setState] = useState<string | null>(null)
  const [cityOptions, setCityOptions] = useState<SelectOption[]>([])
  const [city, setCity] = useState<string | null>(null)
  const [fetchingCities, setFetchingCities] = useState(false)
  const [eatingOptions, setEatingOptions] = useState<SelectOption[]>([])
  const [eating, setEating] = useState<string | null>(null)

  useEffect(() => {
    getRegValues().then(async rv => {
      if (rv.QUALIFICATION) setQualification(rv.QUALIFICATION)
      if (rv.OCCUPATION) setOccupation(rv.OCCUPATION)
      if (rv.INCOME) setIncome(rv.INCOME)
      if (rv.STATE) setState(rv.STATE)
      if (rv.CITY) setCity(rv.CITY)
      if (rv.EATING) setEating(rv.EATING)

      const [quals, occs, incomes, states, eats] = await Promise.all([
        fetchQualificationOptions(),
        fetchOccupationOptions(),
        fetchMonthlyIncomeOptions(),
        fetchStates(),
        fetchEatingHabitOptions(),
      ])
      setQualificationOptions(quals)
      setOccupationOptions(occs)
      setIncomeOptions(incomes)
      setStateOptions(states)
      setEatingOptions(eats)

      if (rv.STATE) {
        setFetchingCities(true)
        try { setCityOptions(await fetchCities(rv.STATE)) } finally { setFetchingCities(false) }
      }
    })
  }, [])

  async function handleSelectState(opt: SelectOption) {
    setState(opt.key)
    setCity(null)
    setFetchingCities(true)
    try {
      setCityOptions(await fetchCities(opt.key))
    } finally {
      setFetchingCities(false)
    }
  }

  const isValid = !!qualification && !!occupation && !!income && !!state && !!city && !!eating

  async function handleNext() {
    if (!isValid || submitting) return
    setSubmitting(true)
    try {
      await setRegValues({
        QUALIFICATION: qualification!,
        OCCUPATION: occupation!,
        INCOME: income!, INCOMETYPE: 'INR',
        COUNTRY: INDIA_COUNTRY, STATE: state!, CITY: city!,
        EATING: eating!,
      })
      callPartialRegistrationAPI()
      navigation.push('onboarding', { pageNo: 'desktop-photo-upload' })
    } finally {
      setSubmitting(false)
    }
  }

  function handleBack() {
    navigation.push('onboarding', { pageNo: 'desktop-personal-religious' })
  }

  return (
    <OnboardingDesktopLayout onBack={handleBack} onNext={handleNext} nextDisabled={!isValid} nextLoading={submitting}>
      <DesktopSectionTitle title="Education & Professional details" />

      <DesktopSelectField
        label="Education" options={qualificationOptions} selectedKey={qualification}
        onSelect={opt => setQualification(opt.key)}
      />
      <DesktopSelectField
        label="Occupation" placeholder="Select occupation" options={occupationOptions} selectedKey={occupation}
        onSelect={opt => setOccupation(opt.key)}
      />
      <DesktopSelectField
        label="Monthly income" placeholder="Select monthly income" options={incomeOptions} selectedKey={income}
        onSelect={opt => setIncome(opt.key)}
      />

      <DesktopSectionTitle title="Location & lifestyle details" />

      <DesktopSelectField label="Country" options={COUNTRY_OPTIONS} selectedKey={INDIA_COUNTRY} onSelect={() => {}} disabled />
      <DesktopSelectField
        label="State" options={stateOptions} selectedKey={state}
        onSelect={handleSelectState}
      />
      <DesktopSelectField
        label="District" options={cityOptions} selectedKey={city}
        onSelect={opt => setCity(opt.key)} loading={fetchingCities} disabled={!state}
      />
      <DesktopSelectField
        label="Eating habits" options={eatingOptions} selectedKey={eating}
        onSelect={opt => setEating(opt.key)}
      />
    </OnboardingDesktopLayout>
  )
}
