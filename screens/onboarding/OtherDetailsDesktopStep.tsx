// Desktop-web onboarding step D — Figma "Jodii Desktop - Registration"
// (997-30291, "Other details"): combines FamilyDetailsScreen (brothers /
// sisters), PropertyDetailsScreen (multi-select properties) and
// DoshamScreen (multi-select dosham types) into one card. Reuses those
// screens' exact fetch/save service calls.
//
// This is the LAST desktop onboarding step — mirrors DoshamScreen.tsx's own
// terminal behavior exactly (refreshSession + LASTAPPLOGINAT + navigate
// Home), since Dosham is mobile's own final onboarding screen too.
//
// Simplifications vs. mobile (Figma shows one flat "Dosham" field, not a
// preceding Yes/No question): submitting with zero dosham types selected is
// treated as DoshamScreen's "No" answer (DOSHAM='2'); one or more selected
// types are joined with '~' exactly as DoshamScreen's "Yes" path does.
// Star/Raasi themselves aren't fields on this screen — carried over from
// whatever a prior screen already stored in the reg-value blob, same as
// DoshamScreen reads them.

import { useEffect, useState } from 'react'
import OnboardingDesktopLayout, { DesktopSectionTitle } from './OnboardingDesktopLayout'
import DesktopSelectField, { type SelectOption } from '../../components/desktop-select-field/DesktopSelectField'
import DesktopMultiSelectField from '../../components/desktop-select-field/DesktopMultiSelectField'
import {
  fetchDoshamOptions, fetchFamilyOptions, fetchPropertyOptions, getRegValues,
  setRegValues, submitFamilyDetails, submitHoroscopeDetails, submitPropertyDetails,
} from '../../service/registrationService'
import { refreshSession } from '../../service/homeService'
import { setItem } from '../../service/storageService'

const FALLBACK_BROTHERS: SelectOption[] = [
  { key: '1', label: '1' }, { key: '2', label: '2' }, { key: '3', label: '3' },
  { key: '4', label: '4' }, { key: '5', label: 'More than 5' }, { key: '6', label: 'No brothers' },
]
const FALLBACK_SISTERS: SelectOption[] = [
  { key: '1', label: '1' }, { key: '2', label: '2' }, { key: '3', label: '3' },
  { key: '4', label: '4' }, { key: '5', label: 'More than 5' }, { key: '6', label: 'No sisters' },
]
const FALLBACK_PROPERTIES: SelectOption[] = [
  { key: '1', label: 'Own house' }, { key: '2', label: 'Agriculture land' },
  { key: '3', label: 'Other land' }, { key: '4', label: 'Own shop' },
]

type Props = { navigation: any }

export default function OtherDetailsDesktopStep({ navigation }: Props) {
  const [submitting, setSubmitting] = useState(false)

  const [brotherOptions, setBrotherOptions] = useState<SelectOption[]>([])
  const [brothers, setBrothers] = useState<string | null>(null)
  const [sisterOptions, setSisterOptions] = useState<SelectOption[]>([])
  const [sisters, setSisters] = useState<string | null>(null)

  const [propertyOptions, setPropertyOptions] = useState<SelectOption[]>([])
  const [properties, setProperties] = useState<Set<string>>(new Set())

  const [star, setStar] = useState('')
  const [raasi, setRaasi] = useState('')
  const [doshamOptions, setDoshamOptions] = useState<SelectOption[]>([])
  const [dosham, setDosham] = useState<Set<string>>(new Set())

  useEffect(() => {
    getRegValues().then(async rv => {
      if (rv.BROTHERS) setBrothers(rv.BROTHERS)
      if (rv.SISTERS) setSisters(rv.SISTERS)
      if (rv.PROPERTIES) setProperties(new Set(String(rv.PROPERTIES).split('~').filter(Boolean)))
      if (rv.STAR) setStar(rv.STAR)
      if (rv.RAASI) setRaasi(rv.RAASI)
      if (rv.DOSHAM) setDosham(new Set(String(rv.DOSHAM).split('~').filter(Boolean)))

      const [family, props, doshamRes] = await Promise.all([
        fetchFamilyOptions(),
        fetchPropertyOptions(),
        fetchDoshamOptions(rv.STAR ?? '', rv.RAASI ?? '', rv.MOTHERTONGUE),
      ])
      setBrotherOptions(family.brothers.length ? family.brothers : FALLBACK_BROTHERS)
      setSisterOptions(family.sisters.length ? family.sisters : FALLBACK_SISTERS)
      setPropertyOptions(props.length ? props : FALLBACK_PROPERTIES)
      setDoshamOptions(doshamRes.doshamHash)
    })
  }, [])

  function toggleProperty(key: string) {
    setProperties(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleDosham(key: string) {
    setDosham(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const isValid = !!brothers && !!sisters

  async function handleNext() {
    if (!isValid || submitting) return
    setSubmitting(true)
    try {
      const propertyKeys = Array.from(properties)
      const doshamValue = dosham.size > 0 ? Array.from(dosham).join('~') : '2'

      await setRegValues({
        BROTHERS: brothers!, SISTERS: sisters!,
        PROPERTIES: propertyKeys.join('~'),
        DOSHAM: doshamValue,
      })
      await submitFamilyDetails(brothers!, sisters!)
      if (propertyKeys.length > 0) await submitPropertyDetails(propertyKeys)
      await submitHoroscopeDetails(star, raasi, doshamValue)

      await refreshSession()
      await setItem('LASTAPPLOGINAT', new Date().toISOString())
      navigation.navigate('Home')
    } catch {
      // allow retry
    } finally {
      setSubmitting(false)
    }
  }

  function handleBack() {
    navigation.push('onboarding', { pageNo: 'desktop-photo-upload' })
  }

  return (
    <OnboardingDesktopLayout onBack={handleBack} onNext={handleNext} nextLabel="Finish" nextDisabled={!isValid} nextLoading={submitting}>
      <DesktopSectionTitle title="Family details" />

      <DesktopSelectField
        label="No. of brothers" placeholder="Select no. of brothers" options={brotherOptions} selectedKey={brothers}
        onSelect={opt => setBrothers(opt.key)}
      />
      <DesktopSelectField
        label="No. of sisters" placeholder="Select no. of sisters" options={sisterOptions} selectedKey={sisters}
        onSelect={opt => setSisters(opt.key)}
      />
      <DesktopMultiSelectField
        label="Properties" placeholder="Select properties" options={propertyOptions} selectedKeys={properties}
        onToggle={toggleProperty}
      />

      <DesktopSectionTitle title="Horoscope details" />

      <DesktopMultiSelectField
        label="Dosham" placeholder="Select dosham (if any)" options={doshamOptions} selectedKeys={dosham}
        onToggle={toggleDosham}
      />
    </OnboardingDesktopLayout>
  )
}
