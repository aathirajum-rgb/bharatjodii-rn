// Angular: components/validation/validation.component.ts + .html — the
// registrationConfirm2/"route mode" branch only (webview.page.ts page_id "61" →
// handleAiProfileValidation() → /validation). The OTHER branch in the Angular
// file (isRegistrationConfirm() modal mode, used by registration-revamp) is a
// different flow entirely and is NOT ported here.
//
// Angular: after callAiProfileValidation() flags some fields as suspect
// (VIOLATIONFIELD), this screen shows only THOSE fields for the member to
// confirm/correct, saves each changed field via editprofileupdate (same
// endpoint editProfileService.ts's submitFieldChanges() already wraps), then
// re-validates. Depending on the fresh result it can: re-show the form with
// newly-flagged fields (max 2 rounds, editCnt), redirect to a "profile under
// review" wait state, prompt for changed-religion follow-up fields
// (mothertongue/caste/subcaste/gothra), prompt for structurally-required-but-
// empty subcaste/gothra, or complete with a success sheet.
//
// SCOPE NOTE (explicit, documented simplification — not silently dropped):
// Angular's post-submit "religion changed" and "dependent fields needed"
// branches open two SEPARATE bottom sheets (getReligionDetailsSheetComponentData/
// getDependentSheetComponentData), each ALSO including a "home town" state/city
// cluster gated on the member's mother tongue being in a specific domain list.
// That home-town sub-cluster's real UI (a Yes/No "same as current city?"
// toggle) was not available to read/verify, so it is NOT ported — this
// screen's own two follow-up phases below cover mothertongue/caste/subcaste/
// gothra (religion-changed case) and subcaste/gothra only (dependent-fields
// case), reusing the SAME field-row/picker machinery as the main form instead
// of two separate sheet components. If a member's home town is ever
// structurally required, this falls through to the success completion
// without collecting it — same class of gap as this file's own header comment
// already documents for cases 35/40.

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, getJson, removeItem } from '../../service/storageService'
import { submitFieldChanges, type FieldChange } from '../../service/editProfileService'
import {
  callAiProfileValidation, mapViolationFields, CONFIRM2_EDITABLE_VIOLATION_FIELDS,
  fetchEditFormValuesForValidation, getRegValues, setRegValues,
  fetchMaritalStatusOptions, CHILDREN_OPTIONS, fetchMotherTongueOptions,
  fetchStates, fetchCities, fetchQualificationOptions, fetchOccupationOptions,
  fetchMonthlyIncomeOptions, fetchReligionOptions, fetchCasteOptions,
  fetchSubcasteOptions, fetchGothraOptions, isGothraApplicableForCaste,
} from '../../service/registrationService'
import { resetTo } from '../../utils/navigationRef'
import { ENavigation } from '../../types/enums/navigation.enum'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'
import SelectField from '../../components/input/SelectField'
import RegistrationSuccessSheet from '../../components/registration-success-sheet/RegistrationSuccessSheet'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { CDN_SVG } from '../../constants/cdn'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_ALERT_ICON = CDN_SVG + 'alert-circle.svg'

const MONTHS: PickerOption[] = [
  { key: '1', label: 'January' }, { key: '2', label: 'February' }, { key: '3', label: 'March' },
  { key: '4', label: 'April' }, { key: '5', label: 'May' }, { key: '6', label: 'June' },
  { key: '7', label: 'July' }, { key: '8', label: 'August' }, { key: '9', label: 'September' },
  { key: '10', label: 'October' }, { key: '11', label: 'November' }, { key: '12', label: 'December' },
]

// Angular's own confirm2 date list (REGISTRATIONARRAYS['DATE']) is a flat 1-31
// list, not days-in-selected-month like the onboarding DOBScreen's version —
// matched exactly here, not "fixed".
const DAYS: PickerOption[] = Array.from({ length: 31 }, (_, i) => {
  const d = String(i + 1)
  return { key: d, label: d.padStart(2, '0') }
})

// Angular: setMinMaxAge() (GENDER=='0' female→18, else male→21) + c2UpdateDateLists'
// male-21-floor year trim — both achieve the same outcome, replicated here as one
// bounded year range instead of two overlapping mechanisms.
function buildYears(minAge: number, maxAge: number): PickerOption[] {
  const thisYear = new Date().getFullYear()
  const max = thisYear - minAge
  const min = thisYear - maxAge
  const out: PickerOption[] = []
  for (let y = min; y <= max; y++) out.push({ key: String(y), label: String(y) })
  return out
}

function calculateAge(year: string, month: string, date: string): number {
  const today = new Date()
  const dob = new Date(Number(year), Number(month) - 1, Number(date))
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'form' | 'religionForm' | 'dependentForm' | 'underReview' | 'success'

type ActiveField =
  | 'maritalStatus' | 'noOfChildren' | 'dobDate' | 'dobMonth' | 'dobYear'
  | 'motherTongue' | 'state' | 'city' | 'qualification' | 'occupation'
  | 'monthlyIncome' | 'religion' | 'caste' | 'subCaste' | 'gothra'
  | null

type Props = { navigation: any }

// ─── Component ────────────────────────────────────────────────────────────────

export default function ValidationScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [phase, setPhase] = useState<Phase>('loading')
  const [submitting, setSubmitting] = useState(false)
  const [violationFields, setViolationFields] = useState<string[]>([])
  const [gender, setGender] = useState('1')
  const [matriId, setMatriId] = useState('')

  // ── Field values ──────────────────────────────────────────────────────────
  const [maritalStatus, setMaritalStatus] = useState<PickerOption | null>(null)
  const [noOfChildren, setNoOfChildren]   = useState<PickerOption | null>(null)
  const [hasUserDob, setHasUserDob]       = useState(false)
  const [dobDate, setDobDate]   = useState<PickerOption | null>(null)
  const [dobMonth, setDobMonth] = useState<PickerOption | null>(null)
  const [dobYear, setDobYear]   = useState<PickerOption | null>(null)
  const [ageValue, setAgeValue] = useState('')
  const [motherTongue, setMotherTongue] = useState<PickerOption | null>(null)
  const [state, setState] = useState<PickerOption | null>(null)
  const [city, setCity]   = useState<PickerOption | null>(null)
  const [qualification, setQualification] = useState<PickerOption | null>(null)
  const [occupation, setOccupation]       = useState<PickerOption | null>(null)
  const [monthlyIncome, setMonthlyIncome] = useState<PickerOption | null>(null)
  const [religion, setReligion] = useState<PickerOption | null>(null)
  const [caste, setCaste]       = useState<PickerOption | null>(null)
  const [subCaste, setSubCaste] = useState<PickerOption | null>(null)
  const [gothra, setGothra]     = useState<PickerOption | null>(null)

  const [original, setOriginal] = useState<Record<string, string>>({})

  // ── Option lists ──────────────────────────────────────────────────────────
  const [maritalStatusOptions, setMaritalStatusOptions] = useState<PickerOption[]>([])
  const [motherTongueOptions, setMotherTongueOptions]   = useState<PickerOption[]>([])
  const [stateOptions, setStateOptions] = useState<PickerOption[]>([])
  const [cityOptions, setCityOptions]   = useState<PickerOption[]>([])
  const [qualificationOptions, setQualificationOptions] = useState<PickerOption[]>([])
  const [occupationOptions, setOccupationOptions]       = useState<PickerOption[]>([])
  const [monthlyIncomeOptions, setMonthlyIncomeOptions] = useState<PickerOption[]>([])
  const [religionOptions, setReligionOptions] = useState<PickerOption[]>([])
  const [casteOptions, setCasteOptions]       = useState<PickerOption[]>([])
  const [subCasteOptions, setSubCasteOptions] = useState<PickerOption[]>([])
  const [gothraOptions, setGothraOptions]     = useState<PickerOption[]>([])

  const [activeField, setActiveField] = useState<ActiveField>(null)
  const yearOptions = buildYears(gender === '0' ? 18 : 21, 70)

  // ─── Derived ────────────────────────────────────────────────────────────────

  const isChristian = religion?.key === '2'
  const shouldHideNoOfChildren = maritalStatus?.key === '1'
  const shouldHideMonthlyIncome = (occupation?.label ?? '').trim().toLowerCase() === 'not working'
  const hasSubcaste = !isChristian && subCasteOptions.length > 0
  const [hasGothra, setHasGothra] = useState(false)

  function shouldShowField(field: string): boolean {
    if (!violationFields.length) return true
    if (field === 'CITY') return violationFields.includes('STATE')
    if (field === 'NOOFCHILDREN') return violationFields.includes('MARITALSTATUS') || violationFields.includes('NOOFCHILDREN')
    return violationFields.includes(field)
  }

  function hasEditableViolationFields(fields: string[]): boolean {
    return fields.some(f => CONFIRM2_EDITABLE_VIOLATION_FIELDS.includes(f))
  }

  // ─── Load caste/subcaste/gothra for the current religion+mothertongue+caste ──

  const loadCasteChain = useCallback(async (rel: string, mt: string, savedCaste?: string, savedSubcaste?: string, savedGothra?: string) => {
    const list = await fetchCasteOptions(rel, mt)
    setCasteOptions(list)
    const foundCaste = savedCaste ? list.find(o => o.key === savedCaste) ?? null : null
    setCaste(foundCaste)
    if (!foundCaste || rel === '2') {
      setSubCasteOptions([]); setSubCaste(null); setGothraOptions([]); setGothra(null); setHasGothra(false)
      return
    }
    const [subList, gothraApplicable] = await Promise.all([
      fetchSubcasteOptions(rel, foundCaste.key, mt),
      isGothraApplicableForCaste(foundCaste.key),
    ])
    setSubCasteOptions(subList)
    setSubCaste(savedSubcaste ? subList.find(o => o.key === savedSubcaste) ?? null : null)
    if (gothraApplicable) {
      const gList = await fetchGothraOptions(foundCaste.key)
      setGothraOptions(gList)
      setHasGothra(gList.length > 0)
      setGothra(savedGothra ? gList.find(o => o.key === savedGothra) ?? null : null)
    } else {
      setGothraOptions([]); setGothra(null); setHasGothra(false)
    }
  }, [])

  // ─── Initial load ───────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setPhase('loading')
    const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
    setMatriId(userId)

    const info = await fetchEditFormValuesForValidation()
    if (!info) { resetTo(ENavigation.MATCHES); return }

    // Angular: c2ViolationFields() reads the ALREADY-STORED 'VIOLATIONFIELDS'
    // (written by pageLandingService.ts before navigating here) on this
    // initial load — it does not re-call the AI check itself.
    const storedViolations = await getJson<any[]>('VIOLATIONFIELDS')
    const violations = mapViolationFields(storedViolations)
    if (violations.length && !hasEditableViolationFields(violations)) {
      // Only non-editable violations (e.g. NAME) — nothing to show, complete directly.
      setPhase('success')
      return
    }
    setViolationFields(violations)

    const rv = await getRegValues()
    const genderVal = rv.GENDER ?? '1'
    setGender(genderVal)

    setOriginal({
      MARITALSTATUS: info.maritalStatus ?? '', NOOFCHILDREN: info.noOfChildren ?? '',
      MOTHERTONGUE: info.motherTongue ?? '', STATE: info.state ?? '', CITY: info.city ?? '',
      QUALIFICATION: info.education ?? '', OCCUPATION: info.occupation ?? '',
      MONTHLYINCOME: info.income ?? '', RELIGION: info.religion ?? '', CASTE: info.caste ?? '',
      SUBCASTE: info.subCaste ?? '', GOTHRA: info.gothram ?? '',
      AGE: rv.AGE ?? '', YEAR: rv.YEAR ?? '', MONTH: rv.MONTH ?? '', DATE: rv.DATE ?? '',
    })

    const userHasDob = !!(rv.YEAR && rv.MONTH && rv.DATE)
    setHasUserDob(userHasDob)
    if (userHasDob) {
      setDobYear(buildYears(genderVal === '0' ? 18 : 21, 70).find(o => o.key === rv.YEAR) ?? { key: rv.YEAR, label: rv.YEAR })
      setDobMonth(MONTHS.find(o => o.key === rv.MONTH) ?? null)
      setDobDate(DAYS.find(o => o.key === rv.DATE) ?? null)
    } else {
      setAgeValue(rv.AGE ?? '')
    }

    const [maritalList, mtList, stList, qualList, occList, incList, relList] = await Promise.all([
      fetchMaritalStatusOptions(genderVal), fetchMotherTongueOptions(), fetchStates(),
      fetchQualificationOptions(), fetchOccupationOptions(), fetchMonthlyIncomeOptions(),
      fetchReligionOptions(),
    ])
    setMaritalStatusOptions(maritalList)
    setMotherTongueOptions(mtList)
    setStateOptions(stList)
    setQualificationOptions(qualList)
    setOccupationOptions(occList)
    setMonthlyIncomeOptions(incList)
    setReligionOptions(relList)

    setMaritalStatus(maritalList.find(o => o.key === info.maritalStatus) ?? null)
    setNoOfChildren(CHILDREN_OPTIONS.find(o => o.key === info.noOfChildren) ?? null)
    setMotherTongue(mtList.find(o => o.key === info.motherTongue) ?? null)
    const foundState = stList.find(o => o.key === info.state) ?? null
    setState(foundState)
    setQualification(qualList.find(o => o.key === info.education) ?? null)
    setOccupation(occList.find(o => o.key === info.occupation) ?? null)
    setMonthlyIncome(incList.find(o => o.key === info.income) ?? null)
    const foundReligion = relList.find(o => o.key === info.religion) ?? null
    setReligion(foundReligion)

    if (foundState) {
      const ctyList = await fetchCities(foundState.key)
      setCityOptions(ctyList)
      setCity(ctyList.find(o => o.key === info.city) ?? null)
    }
    if (foundReligion) {
      await loadCasteChain(foundReligion.key, info.motherTongue ?? '', info.caste, info.subCaste, info.gothram)
    }

    setPhase('form')
  }, [loadCasteChain])

  useEffect(() => { load() }, [load])

  // ─── Cascading selection handlers ──────────────────────────────────────────

  async function handleSelectState(opt: PickerOption) {
    setState(opt); setCity(null); setCityOptions([]); setActiveField(null)
    const list = await fetchCities(opt.key)
    setCityOptions(list)
  }

  async function handleSelectReligion(opt: PickerOption) {
    setReligion(opt); setActiveField(null)
    await loadCasteChain(opt.key, motherTongue?.key ?? '')
  }

  async function handleSelectMotherTongue(opt: PickerOption) {
    setMotherTongue(opt); setActiveField(null)
    if (religion) await loadCasteChain(religion.key, opt.key)
  }

  async function handleSelectCaste(opt: PickerOption) {
    setActiveField(null)
    if (!religion) return
    await loadCasteChain(religion.key, motherTongue?.key ?? '', opt.key)
  }

  // ─── Validation ─────────────────────────────────────────────────────────────

  function isDobValid(): boolean {
    return !!(dobDate && dobMonth && dobYear)
  }
  function isAgeOutOfLimit(): boolean {
    if (hasUserDob) return false
    const minAge = gender === '0' ? 18 : 21
    const age = Number(ageValue)
    if (!ageValue || isNaN(age)) return true
    return age < minAge || age > 70
  }

  function isFormValid(): boolean {
    if (shouldShowField('MARITALSTATUS') && !maritalStatus) return false
    if (!shouldHideNoOfChildren && shouldShowField('NOOFCHILDREN') && !noOfChildren) return false
    if (shouldShowField('DOB') && (hasUserDob ? !isDobValid() : !ageValue)) return false
    if (isAgeOutOfLimit()) return false
    if (shouldShowField('MOTHERTONGUE') && !motherTongue) return false
    if ((stateOptions.length > 0 || state) && shouldShowField('STATE') && !state) return false
    if ((cityOptions.length > 0 || city) && shouldShowField('CITY') && !city) return false
    if (shouldShowField('QUALIFICATION') && !qualification) return false
    if (shouldShowField('OCCUPATION') && !occupation) return false
    if (!shouldHideMonthlyIncome && shouldShowField('MONTHLYINCOME') && !monthlyIncome) return false
    if (shouldShowField('RELIGION') && !religion) return false
    if (shouldShowField('CASTE') && !caste) return false
    if (hasSubcaste && shouldShowField('SUBCASTE') && !subCaste) return false
    if (hasGothra && shouldShowField('GOTHRA') && !gothra) return false
    return true
  }

  // ─── Submit (main form) ─────────────────────────────────────────────────────

  async function buildChanges(): Promise<FieldChange[]> {
    const changes: FieldChange[] = []
    if (maritalStatus && maritalStatus.key !== original.MARITALSTATUS) {
      changes.push({ field: 'MARITALSTATUS', value: maritalStatus.key, existingValue: original.MARITALSTATUS })
    }
    if (!shouldHideNoOfChildren && noOfChildren && noOfChildren.key !== original.NOOFCHILDREN) {
      changes.push({ field: 'NOOFCHILDREN', value: noOfChildren.key, existingValue: original.NOOFCHILDREN })
    }
    if (motherTongue && motherTongue.key !== original.MOTHERTONGUE) {
      changes.push({ field: 'MOTHERTONGUE', value: motherTongue.key, existingValue: original.MOTHERTONGUE })
    }
    if (state && city && (state.key !== original.STATE || city.key !== original.CITY)) {
      changes.push({
        field: 'STATE', value: `${state.key}~${city.key}`,
        existingValue: `${original.STATE ?? ''}~${original.CITY ?? ''}`,
      })
    }
    if (qualification && qualification.key !== original.QUALIFICATION) {
      changes.push({ field: 'QUALIFICATION', value: qualification.key, existingValue: original.QUALIFICATION })
    }
    if (occupation && occupation.key !== original.OCCUPATION) {
      changes.push({ field: 'OCCUPATION', value: occupation.key, existingValue: original.OCCUPATION })
    }
    if (!shouldHideMonthlyIncome && monthlyIncome && monthlyIncome.key !== original.MONTHLYINCOME) {
      changes.push({ field: 'INCOME', value: monthlyIncome.key, existingValue: original.MONTHLYINCOME })
    }
    if (religion && religion.key !== original.RELIGION) {
      changes.push({ field: 'RELIGION', value: religion.key, existingValue: original.RELIGION })
    }
    if (caste && caste.key !== original.CASTE) {
      changes.push({ field: 'CASTE', value: caste.key, existingValue: original.CASTE })
    }
    if (hasSubcaste && subCaste && subCaste.key !== original.SUBCASTE) {
      changes.push({ field: 'SUBCASTE', value: subCaste.key, existingValue: original.SUBCASTE })
    }
    if (hasGothra && gothra && gothra.key !== original.GOTHRA) {
      changes.push({ field: 'GOTHRA', value: gothra.key, existingValue: original.GOTHRA })
    }

    // DOB/age — persist recomputed age into REGISTRATIONVALUES (Angular: persistConfirm2Edits())
    if (hasUserDob && isDobValid()) {
      const age = calculateAge(dobYear!.key, dobMonth!.key, dobDate!.key)
      await setRegValues({ YEAR: dobYear!.key, MONTH: dobMonth!.key, DATE: dobDate!.key, AGE: String(age) })
      if (dobDate!.key !== original.DATE || dobMonth!.key !== original.MONTH || dobYear!.key !== original.YEAR) {
        changes.push({ field: 'AGE', value: String(age), existingValue: original.AGE })
      }
    } else if (!hasUserDob && ageValue && ageValue !== original.AGE) {
      await setRegValues({ AGE: ageValue })
      changes.push({ field: 'AGE', value: ageValue, existingValue: original.AGE })
    }

    return changes
  }

  function religionOrMotherTongueChanged(): boolean {
    return (religion?.key ?? '') !== (original.RELIGION ?? '') || (motherTongue?.key ?? '') !== (original.MOTHERTONGUE ?? '')
  }

  function needsDependentFields(): boolean {
    const needsSubCaste = hasSubcaste && !subCaste
    const needsGothra = hasGothra && !gothra
    return needsSubCaste || needsGothra
  }

  async function handleSubmitForm() {
    if (submitting || !isFormValid()) return
    setSubmitting(true)
    try {
      const changes = await buildChanges()
      if (changes.length) await submitFieldChanges(changes)

      const resp = await callAiProfileValidation(matriId)
      const aiValidationType = String(resp?.RESPONSE?.AIVALIDATIONTYPE ?? '1')
      const editCnt = parseInt(resp?.RESPONSE?.EDITCNT, 10) || 0

      if (aiValidationType === '2' && editCnt < 2) {
        const freshViolations = mapViolationFields(resp?.RESPONSE?.VIOLATIONFIELD)
        if (!hasEditableViolationFields(freshViolations)) {
          setPhase('success')
          return
        }
        setViolationFields(freshViolations)
        // Fields stay populated with what the member just entered — Angular
        // rebuilds componentData from the fresh response but keeps the same
        // form values on screen for the member to adjust further.
        return
      }
      if (aiValidationType === '3') {
        setPhase('underReview')
        setTimeout(() => navigation.push('onboarding', { pageNo: '20' }), 2000)
        return
      }
      if (religionOrMotherTongueChanged()) {
        setPhase('religionForm')
        return
      }
      if (needsDependentFields()) {
        setPhase('dependentForm')
        return
      }
      setPhase('success')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Submit (religion / dependent follow-up phases — see SCOPE NOTE above) ──

  async function handleSubmitFollowUp() {
    if (submitting) return
    setSubmitting(true)
    try {
      const changes: FieldChange[] = []
      if (phase === 'religionForm') {
        if (motherTongue && motherTongue.key !== original.MOTHERTONGUE) {
          changes.push({ field: 'MOTHERTONGUE', value: motherTongue.key, existingValue: original.MOTHERTONGUE })
        }
        if (caste && caste.key !== original.CASTE) {
          changes.push({ field: 'CASTE', value: caste.key, existingValue: original.CASTE })
        }
      }
      if (hasSubcaste && subCaste && subCaste.key !== original.SUBCASTE) {
        changes.push({ field: 'SUBCASTE', value: subCaste.key, existingValue: original.SUBCASTE })
      }
      if (hasGothra && gothra && gothra.key !== original.GOTHRA) {
        changes.push({ field: 'GOTHRA', value: gothra.key, existingValue: original.GOTHRA })
      }
      if (changes.length) await submitFieldChanges(changes)
      setPhase('success')
    } finally {
      setSubmitting(false)
    }
  }

  function isFollowUpValid(): boolean {
    if (phase === 'religionForm' && (!motherTongue || !caste)) return false
    if (hasSubcaste && !subCaste) return false
    if (hasGothra && !gothra) return false
    return true
  }

  function handleSuccessContinue() {
    removeItem('VIOLATIONFIELDS')
    resetTo(ENavigation.MATCHES)
  }

  // ─── Picker option resolver ─────────────────────────────────────────────────

  function pickerFor(field: ActiveField): { title: string; options: PickerOption[]; selectedKey?: string | undefined; onSelect: (o: PickerOption) => void } {
    switch (field) {
      case 'maritalStatus': return { title: t('EDITPROFILE.MARITALSTATUS', 'Marital status'), options: maritalStatusOptions, selectedKey: maritalStatus?.key, onSelect: o => { setMaritalStatus(o); setActiveField(null); if (o.key === '1') setNoOfChildren(null) } }
      case 'noOfChildren': return { title: t('EDITPROFILE.CHILDREN', 'No. of children'), options: CHILDREN_OPTIONS, selectedKey: noOfChildren?.key, onSelect: o => { setNoOfChildren(o); setActiveField(null) } }
      case 'dobDate': return { title: t('REGISTRATION.DATE', 'Date'), options: DAYS, selectedKey: dobDate?.key, onSelect: o => { setDobDate(o); setActiveField(null) } }
      case 'dobMonth': return { title: t('REGISTRATION.MONTH', 'Month'), options: MONTHS, selectedKey: dobMonth?.key, onSelect: o => { setDobMonth(o); setActiveField(null) } }
      case 'dobYear': return { title: t('REGISTRATION.YEAR', 'Year'), options: yearOptions, selectedKey: dobYear?.key, onSelect: o => { setDobYear(o); setActiveField(null) } }
      case 'motherTongue': return { title: t('REGISTRATION.MOTHERTONGUELABEL', 'Mother tongue'), options: motherTongueOptions, selectedKey: motherTongue?.key, onSelect: o => { handleSelectMotherTongue(o) } }
      case 'state': return { title: t('REGISTRATION.STATELABEL', 'State'), options: stateOptions, selectedKey: state?.key, onSelect: o => { handleSelectState(o) } }
      case 'city': return { title: t('REGISTRATION.CITYLABEL', 'City'), options: cityOptions, selectedKey: city?.key, onSelect: o => { setCity(o); setActiveField(null) } }
      case 'qualification': return { title: t('EDITPROFILE.EDUCATION', 'Qualification'), options: qualificationOptions, selectedKey: qualification?.key, onSelect: o => { setQualification(o); setActiveField(null) } }
      case 'occupation': return { title: t('REGISTRATION.OCCUPATIONLABEL', 'Occupation'), options: occupationOptions, selectedKey: occupation?.key, onSelect: o => { setOccupation(o); setActiveField(null) } }
      case 'monthlyIncome': return { title: t('GENERAL.MONTHLYINCOME', 'Monthly income'), options: monthlyIncomeOptions, selectedKey: monthlyIncome?.key, onSelect: o => { setMonthlyIncome(o); setActiveField(null) } }
      case 'religion': return { title: t('REGISTRATION.RELIGIONLABEL', 'Religion'), options: religionOptions, selectedKey: religion?.key, onSelect: o => { handleSelectReligion(o) } }
      case 'caste': return { title: isChristian ? t('REGISTRATION.DIVISIONLABEL', 'Division') : t('REGISTRATION.CASTELABEL', 'Caste'), options: casteOptions, selectedKey: caste?.key, onSelect: o => { handleSelectCaste(o) } }
      case 'subCaste': return { title: t('REGISTRATION.SUBCASTELABEL', 'Sub caste'), options: subCasteOptions, selectedKey: subCaste?.key, onSelect: o => { setSubCaste(o); setActiveField(null) } }
      case 'gothra': return { title: t('REGISTRATION.GOTHRAMLABEL', 'Gothram'), options: gothraOptions, selectedKey: gothra?.key, onSelect: o => { setGothra(o); setActiveField(null) } }
      default: return { title: '', options: [], onSelect: () => {} }
    }
  }
  const picker = pickerFor(activeField)

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <View style={[s.screen, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
      </View>
    )
  }

  if (phase === 'underReview') {
    return (
      <View style={[s.screen, s.underReview, { paddingTop: insets.top }]}>
        <CdnSvg uri={CDN_ALERT_ICON} width={80} height={80} />
        <Text style={s.underReviewTitle}>{t('REGISTRATION.PROFILE_REVIEW', 'Your profile is under review')}</Text>
      </View>
    )
  }

  const isFollowUp = phase === 'religionForm' || phase === 'dependentForm'

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <CdnSvg uri={CDN_ALERT_ICON} width={48} height={48} />
        <Text style={s.title}>
          {isFollowUp
            ? t('REGISTRATION.MISSING_DETAILS', 'Please provide the below details')
            : t('REGISTRATION.CONFIRM_SHEET', 'Please confirm your details below')}
        </Text>

        {phase === 'form' && (
          <>
            {shouldShowField('MARITALSTATUS') && (
              <SelectField label={t('EDITPROFILE.MARITALSTATUS', 'Marital status')} value={maritalStatus?.label} placeholder={t('EDITPROFILE.ADD_DETAILS_TXT', 'Select')} onPress={() => setActiveField('maritalStatus')} />
            )}
            {!shouldHideNoOfChildren && shouldShowField('NOOFCHILDREN') && (
              <SelectField label={t('EDITPROFILE.CHILDREN', 'No. of children')} value={noOfChildren?.label} placeholder={t('EDITPROFILE.ADD_DETAILS_TXT', 'Select')} onPress={() => setActiveField('noOfChildren')} />
            )}
            {shouldShowField('DOB') && (
              hasUserDob ? (
                <View style={s.dobRow}>
                  <View style={s.dobCol}><SelectField label={t('REGISTRATION.DATE', 'Date')} value={dobDate?.label} placeholder="DD" onPress={() => setActiveField('dobDate')} /></View>
                  <View style={s.dobColWide}><SelectField label={t('REGISTRATION.MONTH', 'Month')} value={dobMonth?.label} placeholder="Month" onPress={() => setActiveField('dobMonth')} /></View>
                  <View style={s.dobCol}><SelectField label={t('REGISTRATION.YEAR', 'Year')} value={dobYear?.label} placeholder="YYYY" onPress={() => setActiveField('dobYear')} /></View>
                </View>
              ) : (
                <View style={s.ageInputWrap}>
                  <Text style={s.ageLabel}>{t('REGISTRATION.AGE', 'Age')}</Text>
                  <TextInput
                    style={s.ageInput}
                    value={ageValue}
                    onChangeText={v => setAgeValue(v.replace(/[^\d]/g, ''))}
                    keyboardType="number-pad"
                    placeholder={t('REGISTRATION.AGE', 'Age')}
                  />
                </View>
              )
            )}
            {shouldShowField('MOTHERTONGUE') && (
              <SelectField label={t('REGISTRATION.MOTHERTONGUELABEL', 'Mother tongue')} value={motherTongue?.label} placeholder={t('REGISTRATION.SELECTMOTHERTONGUE', 'Select mother tongue')} onPress={() => setActiveField('motherTongue')} />
            )}
            {(stateOptions.length > 0 || state) && shouldShowField('STATE') && (
              <SelectField label={t('REGISTRATION.STATELABEL', 'State')} value={state?.label} placeholder={t('REGISTRATION.SELECTSTATE', 'Select state')} onPress={() => setActiveField('state')} />
            )}
            {(cityOptions.length > 0 || city) && shouldShowField('CITY') && (
              <SelectField label={t('REGISTRATION.CITYLABEL', 'City')} value={city?.label} placeholder={t('REGISTRATION.SELECTCITY', 'Select city')} onPress={() => setActiveField('city')} />
            )}
            {shouldShowField('QUALIFICATION') && (
              <SelectField label={t('EDITPROFILE.EDUCATION', 'Qualification')} value={qualification?.label} placeholder={t('REG.REG_TITLE_10', 'Select qualification')} onPress={() => setActiveField('qualification')} />
            )}
            {shouldShowField('OCCUPATION') && (
              <SelectField label={t('REGISTRATION.OCCUPATIONLABEL', 'Occupation')} value={occupation?.label} placeholder={t('REGISTRATION.SELECTOCCUPATION', 'Select occupation')} onPress={() => setActiveField('occupation')} />
            )}
            {!shouldHideMonthlyIncome && shouldShowField('MONTHLYINCOME') && (
              <SelectField label={t('GENERAL.MONTHLYINCOME', 'Monthly income')} value={monthlyIncome?.label} placeholder={t('REGISTRATION.CURRENCYTYPE', 'Select income')} onPress={() => setActiveField('monthlyIncome')} />
            )}
            {shouldShowField('RELIGION') && (
              <SelectField label={t('REGISTRATION.RELIGIONLABEL', 'Religion')} value={religion?.label} placeholder={t('REGISTRATION.SELECTRELIGION', 'Select religion')} onPress={() => setActiveField('religion')} />
            )}
            {shouldShowField('CASTE') && (
              <SelectField label={isChristian ? t('REGISTRATION.DIVISIONLABEL', 'Division') : t('REGISTRATION.CASTELABEL', 'Caste')} value={caste?.label} placeholder={isChristian ? t('REGISTRATION.SELECTDIVISION', 'Select division') : t('REGISTRATION.SELECTCASTE', 'Select caste')} onPress={() => setActiveField('caste')} />
            )}
            {hasSubcaste && shouldShowField('SUBCASTE') && (
              <SelectField label={t('REGISTRATION.SUBCASTELABEL', 'Sub caste')} value={subCaste?.label} placeholder={t('REGISTRATION.SELECTSUBCASTE', 'Select sub caste')} onPress={() => setActiveField('subCaste')} />
            )}
            {hasGothra && shouldShowField('GOTHRA') && (
              <SelectField label={t('REGISTRATION.GOTHRAMLABEL', 'Gothram')} value={gothra?.label} placeholder={t('REGISTRATION.SELECTGOTHRAM', 'Select gothram')} onPress={() => setActiveField('gothra')} />
            )}
          </>
        )}

        {phase === 'religionForm' && (
          <>
            <SelectField label={t('REGISTRATION.MOTHERTONGUELABEL', 'Mother tongue')} value={motherTongue?.label} placeholder={t('REGISTRATION.SELECTMOTHERTONGUE', 'Select mother tongue')} onPress={() => setActiveField('motherTongue')} />
            <SelectField label={isChristian ? t('REGISTRATION.DIVISIONLABEL', 'Division') : t('REGISTRATION.CASTELABEL', 'Caste')} value={caste?.label} placeholder={isChristian ? t('REGISTRATION.SELECTDIVISION', 'Select division') : t('REGISTRATION.SELECTCASTE', 'Select caste')} onPress={() => setActiveField('caste')} />
            {hasSubcaste && (
              <SelectField label={t('REGISTRATION.SUBCASTELABEL', 'Sub caste')} value={subCaste?.label} placeholder={t('REGISTRATION.SELECTSUBCASTE', 'Select sub caste')} onPress={() => setActiveField('subCaste')} />
            )}
            {hasGothra && (
              <SelectField label={t('REGISTRATION.GOTHRAMLABEL', 'Gothram')} value={gothra?.label} placeholder={t('REGISTRATION.SELECTGOTHRAM', 'Select gothram')} onPress={() => setActiveField('gothra')} />
            )}
          </>
        )}

        {phase === 'dependentForm' && (
          <>
            {hasSubcaste && (
              <SelectField label={t('REGISTRATION.SUBCASTELABEL', 'Sub caste')} value={subCaste?.label} placeholder={t('REGISTRATION.SELECTSUBCASTE', 'Select sub caste')} onPress={() => setActiveField('subCaste')} />
            )}
            {hasGothra && (
              <SelectField label={t('REGISTRATION.GOTHRAMLABEL', 'Gothram')} value={gothra?.label} placeholder={t('REGISTRATION.SELECTGOTHRAM', 'Select gothram')} onPress={() => setActiveField('gothra')} />
            )}
          </>
        )}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[s.submitBtn, ((isFollowUp ? !isFollowUpValid() : !isFormValid()) || submitting) && s.submitBtnDisabled]}
          disabled={(isFollowUp ? !isFollowUpValid() : !isFormValid()) || submitting}
          onPress={isFollowUp ? handleSubmitFollowUp : handleSubmitForm}
        >
          {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={s.submitBtnText}>{t('GENERAL.SUBMIT', 'Submit')}</Text>}
        </Pressable>
      </View>

      <SearchablePicker
        visible={activeField !== null}
        title={picker.title}
        placeholder={`Search...`}
        options={picker.options}
        selectedKey={picker.selectedKey}
        onSelect={picker.onSelect}
        onClose={() => setActiveField(null)}
      />

      <RegistrationSuccessSheet visible={phase === 'success'} onContinue={handleSuccessContinue} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  content: { paddingHorizontal: 24, paddingTop: 24 },
  title: { fontSize: 18, fontWeight: '600', color: '#1f1e1b', marginTop: 24, marginBottom: 24, lineHeight: 24 },

  dobRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  dobCol: { flex: 3 },
  dobColWide: { flex: 4 },

  ageInputWrap: {
    height: 48, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8,
    paddingHorizontal: 16, marginBottom: 20, justifyContent: 'center',
  },
  ageLabel: { position: 'absolute', left: 12, top: -9, backgroundColor: Colors.white, paddingHorizontal: 4, fontSize: 11, color: Colors.inputBorder },
  ageInput: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },

  footer: {
    paddingHorizontal: 24, paddingTop: 12, backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.inputBorder,
  },
  submitBtn: {
    height: 52, borderRadius: 8, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },

  underReview: { alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  underReviewTitle: { fontSize: 18, fontWeight: '600', color: '#1f1e1b', textAlign: 'center' },
})
