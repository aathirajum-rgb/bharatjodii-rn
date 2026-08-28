// Desktop layout for "Add Horoscope" (Figma "Jodii Desktop - Registration",
// UaPAN9aG6MfZf6CRpwXf1L, node 1151:10688 — the frame's own internal Figma
// layer name is stale/mislabeled "Jodii Registration - Education details",
// confirmed by rendered screenshot instead of trusting the name). Standalone
// full-page screen (simple back+title header, no DesktopPageShell sidebar/
// top-nav — Figma shows neither here), not a modal.
//
// Two steps, matching Figma's intro card (illustration + title + subtitle +
// Upload/Generate/Skip) followed by the actual birth-details form:
//  - 'intro': ported directly from the onboarding GenerateHoroscopeScreen.tsx
//    — same t('REGISTRATION.GENERATEHOROSCOPE'/'...CTA'/'...SUBTITLE') keys
//    and PROFILE_POSSESSIVE substitution formula, same CDN_REG illustration.
//    Figma's own mockup copy ("Please give your son's time of birth...",
//    "Generate horoscope for FREE") is stale — the real locale values
//    ("You have already provided...", "Create horoscope for FREE") are what
//    onboarding actually renders today, so those are reused verbatim rather
//    than hardcoding Figma's mockup text.
//  - 'form': AddHoroscopeScreen.tsx's exact fields/logic (birth state/city/
//    hour/minute/AM-PM, generateHoroscope()/fetchHoroCities()/fetchStates()),
//    just with DesktopSelectField instead of SelectField+SearchablePicker to
//    match this screen's own dropdown convention.
//
// "Upload horoscope" has no existing handler anywhere in this codebase (on
// mobile or web) despite the endpoint existing (Endpoints.media.uploadHoroscope)
// — stubbed as "Coming soon" like this app's other known, flagged gaps
// (e.g. HelpCenterScreen.tsx's own FAQ stubs) rather than inventing an
// unconfirmed upload flow.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import DesktopSelectField, { type SelectOption } from '../../components/desktop-select-field/DesktopSelectField'
import { Colors } from '../../constants/colors'
import { CDN_REACT, CDN_REG } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { setItem } from '../../service/storageService'
import { getRegValue } from '../../service/registrationService'
import { fetchEditProfileInfo } from '../../service/editProfileService'
import { fetchStates, fetchHoroCities, generateHoroscope, type HoroCity } from '../../service/registrationService'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { handleBack } from '../../utils/navigationRef'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'
const CDN_ILLUSTRATION = CDN_REG + 'horoscope-generate.svg'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_OPTIONS = MONTHS.map((label, i) => ({ key: String(i + 1), label }))
const HOURS     = Array.from({ length: 12 }, (_, i) => ({ key: String(i + 1), label: String(i + 1).padStart(2, '0') }))
const MINUTES   = Array.from({ length: 60 }, (_, i) => ({ key: String(i), label: String(i).padStart(2, '0') }))
const MERIDIANS = [{ key: 'AM', label: 'AM' }, { key: 'PM', label: 'PM' }]

// See AddHoroscopeScreen.tsx's header comment on this same helper set.
function buildYears(): SelectOption[] {
  const max = new Date().getFullYear() - 18
  const min = max - 82
  return Array.from({ length: max - min + 1 }, (_, i) => {
    const y = String(max - i)
    return { key: y, label: y }
  })
}
function getDaysInMonth(month: string, year: string): SelectOption[] {
  const m     = Number(month) || 1
  const y     = Number(year)  || 2000
  const count = new Date(y, m, 0).getDate()
  return Array.from({ length: count }, (_, i) => ({ key: String(i + 1), label: String(i + 1).padStart(2, '0') }))
}
const YEAR_OPTIONS = buildYears()

type Props = { navigation: any }
type Step  = 'intro' | 'form'

function parseDob(raw: string | undefined): { date: string; month: string; year: string } | null {
  if (!raw) return null
  const parts = raw.split(/[-/]/).map(p => p.trim()).filter(Boolean)
  if (parts.length !== 3) return null
  const [a, b, c] = parts as [string, string, string]
  let year: string, month: string, date: string
  if (a.length === 4)      { year = a; month = String(Number(b)); date = String(Number(c)) }
  else if (c.length === 4) { year = c; month = String(Number(b)); date = String(Number(a)) }
  else return null

  // See AddHoroscopeScreen.tsx's header comment on this same check — the
  // server sends "0000-00-00" as a placeholder when DOB was never set.
  const y = Number(year), m = Number(month), d = Number(date)
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null

  return { year, month, date }
}

export default function AddHoroscopeDesktopScreen({ navigation: _navigation }: Props) {
  const { t } = useTranslation()

  const [step, setStep] = useState<Step>('intro')
  const [createdBy, setCreatedBy] = useState('4')

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [dob, setDob] = useState<{ date: string; month: string; year: string } | null>(null)
  const [horoscopeAvailable, setHoroscopeAvailable] = useState(false)

  const [selectedState, setSelectedState] = useState<SelectOption | null>(null)
  const [selectedCity, setSelectedCity]   = useState<HoroCity | null>(null)
  const [stateOptions, setStateOptions]   = useState<SelectOption[]>([])
  const [cityOptions, setCityOptions]     = useState<HoroCity[]>([])
  const [cityLoading, setCityLoading]     = useState(false)

  const [selHour, setSelHour]         = useState<SelectOption | null>(null)
  const [selMinute, setSelMinute]     = useState<SelectOption | null>(null)
  const [selMeridian, setSelMeridian] = useState<SelectOption | null>(null)

  // Manual DOB entry — only used when the profile's own DOB is missing/
  // invalid, matching AddHoroscopeScreen.tsx's mobile counterpart.
  const [dobYear, setDobYear]   = useState<SelectOption | null>(null)
  const [dobMonth, setDobMonth] = useState<SelectOption | null>(null)
  const [dobDate, setDobDate]   = useState<SelectOption | null>(null)

  useEffect(() => {
    getRegValue('CREATEDBY').then(cb => { if (cb) setCreatedBy(cb) })

    ;(async () => {
      setLoading(true)
      const info = await fetchEditProfileInfo()
      if (!info) { setLoading(false); return }

      setDob(parseDob(info.dateOfBirth))
      setHoroscopeAvailable(!!info.horoscopeAvailable)

      const stateList = await fetchStates()
      setStateOptions(stateList)

      const defaultStateId = info.homeState || info.state || ''
      if (defaultStateId) {
        const found = stateList.find(s => s.key === defaultStateId)
        if (found) {
          setSelectedState(found)
          setCityLoading(true)
          const cityList = await fetchHoroCities(found.key)
          setCityOptions(cityList)
          setCityLoading(false)
        }
      }

      setLoading(false)
    })()
  }, [])

  async function handleSelectState(opt: SelectOption) {
    setSelectedState(opt)
    setSelectedCity(null)
    setCityLoading(true)
    const cityList = await fetchHoroCities(opt.key)
    setCityOptions(cityList)
    setCityLoading(false)
  }

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const introTitle = t('REGISTRATION.GENERATEHOROSCOPE', 'Generate #PROFILETYPE# horoscope')
    .replace('#PROFILETYPE#', translatedProfileType).replace('  ', ' ').trim()
  const introSubtitle = t(
    'REGISTRATION.GENERATEHOROSCOPESUBTITLE',
    'Please give your #PROFILETYPE# time of birth and location to generate free horoscope',
  ).replace('#PROFILETYPE#', translatedProfileType).replace('  ', ' ').trim()

  function handleSelectDobMonth(opt: SelectOption) {
    setDobMonth(opt)
    if (dobDate) {
      const days = getDaysInMonth(opt.key, dobYear?.key ?? '')
      if (Number(dobDate.key) > days.length) setDobDate(null)
    }
  }

  function handleSelectDobYear(opt: SelectOption) {
    setDobYear(opt)
    if (dobDate && dobMonth?.key === '2') {
      const days = getDaysInMonth(dobMonth.key, opt.key)
      if (Number(dobDate.key) > days.length) setDobDate(null)
    }
  }

  const dobLabel = dob ? `${dob.date.padStart(2, '0')} ${MONTHS[Number(dob.month) - 1] ?? ''} ${dob.year}` : undefined
  const manualDobComplete = !!(dobYear && dobMonth && dobDate)
  const canSubmit = !!((dob || manualDobComplete) && selectedState && selectedCity && selHour && selMinute && selMeridian)

  async function handleSubmit() {
    const effectiveDob = dob ?? (manualDobComplete ? { year: dobYear!.key, month: dobMonth!.key, date: dobDate!.key } : null)
    if (submitting || !canSubmit || !effectiveDob || !selectedState || !selectedCity || !selHour || !selMinute || !selMeridian) return
    setSubmitting(true)
    try {
      await setItem(SK.Profile.HOROSCOPE_AVAILABLE, horoscopeAvailable ? '1' : '0')
      const ok = await generateHoroscope({
        date: effectiveDob.date, month: effectiveDob.month, year: effectiveDob.year,
        hour: selHour.key, minute: selMinute.key, meridian: selMeridian.key as 'AM' | 'PM',
        stateId: selectedState.key, cityKey: selectedCity.key,
      })
      setSubmitting(false)
      if (!ok) {
        Alert.alert('Something went wrong', 'Could not save horoscope details. Please try again.')
        return
      }
      handleBack()
    } catch {
      setSubmitting(false)
      Alert.alert('Something went wrong', 'Could not save horoscope details. Please try again.')
    }
  }

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable
          style={s.backBtn}
          onPress={() => (step === 'form' ? setStep('intro') : handleBack())}
          accessibilityRole="button" accessibilityLabel="Back"
        >
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle}>{t('REGISTRATION.GENERATEHOROSCOPE', 'Generate horoscope').replace('#PROFILETYPE#', '').replace('  ', ' ').trim()}</Text>
      </View>

      <View style={s.card}>
        {loading ? (
          <ActivityIndicator color={Colors.primaryDark} size="large" style={s.loader} />
        ) : step === 'intro' ? (
          <>
            <CdnSvg uri={CDN_ILLUSTRATION} width={200} height={200} style={s.illustration} />
            <Text style={s.introTitle}>{introTitle}</Text>
            <Text style={s.introSubtitle}>{introSubtitle}</Text>

            <Pressable onPress={() => Alert.alert('Upload horoscope', 'Coming soon')} hitSlop={8}>
              <Text style={s.uploadLink}>{t('REGISTRATION.UPLOADHOROSCOPE', 'Upload horoscope')} ›</Text>
            </Pressable>

            <Pressable style={s.generateBtn} onPress={() => setStep('form')}>
              <Text style={s.generateBtnText}>{t('REGISTRATION.GENERATEHOROSCOPECTA', 'Generate horoscope for FREE')}</Text>
            </Pressable>

            <Pressable onPress={() => handleBack()} hitSlop={8}>
              <Text style={s.skipLink}>{t('REG.DO_LATER', "I'll do this later")} ›</Text>
            </Pressable>
          </>
        ) : (
          <View style={s.form}>
            {dobLabel ? (
              <View style={s.dobField}>
                <Text style={s.dobLabel}>Date of birth</Text>
                <Text style={s.dobValue}>{dobLabel}</Text>
              </View>
            ) : (
              <>
                <Text style={s.dobMissing}>We couldn't find your date of birth — please add it below to generate your horoscope.</Text>
                <View style={s.timeRow}>
                  <View style={s.timeCell}>
                    <DesktopSelectField label="Year" options={YEAR_OPTIONS} selectedKey={dobYear?.key ?? null} onSelect={handleSelectDobYear} />
                  </View>
                  <View style={s.timeCell}>
                    <DesktopSelectField label="Month" options={MONTH_OPTIONS} selectedKey={dobMonth?.key ?? null} onSelect={handleSelectDobMonth} />
                  </View>
                  <View style={s.timeCell}>
                    <DesktopSelectField
                      label="Date" options={dobYear && dobMonth ? getDaysInMonth(dobMonth.key, dobYear.key) : []}
                      selectedKey={dobDate?.key ?? null} placeholder={dobYear && dobMonth ? 'Date' : 'Pick year/month first'}
                      disabled={!dobYear || !dobMonth} onSelect={setDobDate}
                    />
                  </View>
                </View>
              </>
            )}

            <DesktopSelectField label="Birth state" options={stateOptions} selectedKey={selectedState?.key ?? null} onSelect={handleSelectState} />
            <DesktopSelectField
              label="Birth city" options={cityOptions} selectedKey={selectedCity?.key ?? null}
              placeholder={selectedState ? 'Select city' : 'Select state first'} disabled={!selectedState} loading={cityLoading}
              onSelect={opt => setSelectedCity(cityOptions.find(c => c.key === opt.key) ?? null)}
            />
            <View style={s.timeRow}>
              <View style={s.timeCell}>
                <DesktopSelectField label="Birth hour" options={HOURS} selectedKey={selHour?.key ?? null} onSelect={setSelHour} />
              </View>
              <View style={s.timeCell}>
                <DesktopSelectField label="Birth minute" options={MINUTES} selectedKey={selMinute?.key ?? null} onSelect={setSelMinute} />
              </View>
              <View style={s.timeCell}>
                <DesktopSelectField label="AM / PM" options={MERIDIANS} selectedKey={selMeridian?.key ?? null} onSelect={setSelMeridian} />
              </View>
            </View>

            <Pressable style={[s.generateBtn, !canSubmit && s.generateBtnDisabled]} onPress={handleSubmit} disabled={submitting || !canSubmit}>
              {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={s.generateBtnText}>{t('GENERAL.SUBMIT')}</Text>}
            </Pressable>
          </View>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background, alignItems: 'center' },

  header: { width: 810, flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 32, marginBottom: 24 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 22, color: Colors.black },

  card: {
    width: 810, backgroundColor: Colors.white, borderRadius: 24, alignItems: 'center',
    paddingVertical: 48, paddingHorizontal: 40,
  },
  loader: { marginVertical: 48 },

  illustration: { width: 200, height: 200, marginBottom: 24 },
  introTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 20, color: Colors.black, textAlign: 'center' },
  introSubtitle: { fontFamily: SemanticFontsEnglish.subheadingEnglishRegular, fontSize: 14, color: Colors.black, textAlign: 'center', marginTop: 8, maxWidth: 460 },
  uploadLink: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 14, color: Colors.link, marginTop: 24 },

  generateBtn: {
    width: 360, height: 48, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.white },
  skipLink: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textSecondary, marginTop: 16 },

  form: { width: '100%', gap: 20 },
  dobField: {
    height: 56, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8,
    paddingHorizontal: 16, justifyContent: 'center', backgroundColor: Colors.surfaceInput,
  },
  dobLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 11, color: Colors.textSecondary },
  dobValue: { fontFamily: Fonts.poppinsMedium, fontSize: 15, color: Colors.textPrimary, marginTop: 2 },
  dobMissing: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, color: Colors.inputError },

  timeRow: { flexDirection: 'row', gap: 16 },
  timeCell: { flex: 1 },
})
