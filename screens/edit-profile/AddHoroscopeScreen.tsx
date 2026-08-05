// New screen — Angular's "Add Horoscope" promo CTA (editform/22) collects
// birth time + birth city/state (date of birth is already known from the
// profile) to generate a horoscope. Styled consistently with Edit Profile's
// own SelectField+SearchablePicker convention (not onboarding's bespoke
// positioned-dropdown) to match this flow's siblings — a deliberate choice,
// not an oversight; onboarding's HoroscopeBirthDetailsScreen.tsx/
// HoroscopeTimeScreen.tsx patterns were the reference but this screen
// re-implements them, not imports them (those are registration-flow-coupled
// route screens).
//
// Reuses registrationService's generateHoroscope() as-is — it only depends
// on userId + the REGISTRATIONARRAYS.HOROCITY cache (populated by
// fetchHoroCities(), called here identically to how onboarding populates it)
// and on the SK.Profile.HOROSCOPE_AVAILABLE storage flag to decide the
// generate-vs-update endpoint. That flag is normally only set as a side
// effect of a PRIOR successful generateHoroscope() call from the
// registration flow — for a user arriving here from Edit Profile it must be
// force-set from the server-confirmed EditProfileInfo.horoscopeAvailable
// right before calling, or a user whose horoscope already exists server-side
// (but who never ran the registration horoscope step on this device) would
// silently hit the wrong endpoint.
//
// dateOfBirth's exact server string format is unconfirmed (no other consumer
// of EditProfileInfo.dateOfBirth exists in this codebase to cross-check) —
// parsed defensively; if unparseable, Submit is disabled rather than guessing.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { setItem } from '../../service/storageService'
import { fetchEditProfileInfo } from '../../service/editProfileService'
import { fetchStates, fetchHoroCities, generateHoroscope, type HoroCity } from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import SelectField from '../../components/input/SelectField'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const HOURS     = Array.from({ length: 12 }, (_, i) => ({ key: String(i + 1), label: String(i + 1).padStart(2, '0') }))
const MINUTES   = Array.from({ length: 60 }, (_, i) => ({ key: String(i), label: String(i).padStart(2, '0') }))
const MERIDIANS = [{ key: 'AM', label: 'AM' }, { key: 'PM', label: 'PM' }]

type Props   = { navigation: any }
type Picker  = 'state' | 'city' | 'hour' | 'minute' | 'meridian' | null

// Defensive parse — server format for DATEOFBIRTH is unconfirmed. Tries
// YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY in turn.
function parseDob(raw: string | undefined): { date: string; month: string; year: string } | null {
  if (!raw) return null
  const parts = raw.split(/[-/]/).map(p => p.trim()).filter(Boolean)
  if (parts.length !== 3) return null
  const [a, b, c] = parts as [string, string, string]
  if (a.length === 4) return { year: a, month: String(Number(b)), date: String(Number(c)) }   // YYYY-MM-DD
  if (c.length === 4) return { year: c, month: String(Number(b)), date: String(Number(a)) }   // DD-MM-YYYY / DD/MM/YYYY
  return null
}

export default function AddHoroscopeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [dob, setDob] = useState<{ date: string; month: string; year: string } | null>(null)
  const [horoscopeAvailable, setHoroscopeAvailable] = useState(false)

  const [selectedState, setSelectedState] = useState<PickerOption | null>(null)
  const [selectedCity, setSelectedCity]   = useState<HoroCity | null>(null)
  const [stateOptions, setStateOptions]   = useState<PickerOption[]>([])
  const [cityOptions, setCityOptions]     = useState<HoroCity[]>([])

  const [selHour, setSelHour]         = useState<PickerOption | null>(null)
  const [selMinute, setSelMinute]     = useState<PickerOption | null>(null)
  const [selMeridian, setSelMeridian] = useState<PickerOption | null>(null)

  const [activePicker, setActivePicker] = useState<Picker>(null)

  useEffect(() => {
    (async () => {
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
          const cityList = await fetchHoroCities(found.key)
          setCityOptions(cityList)
        }
      }

      setLoading(false)
    })()
  }, [])

  async function handleSelectState(opt: PickerOption) {
    setSelectedState(opt)
    setSelectedCity(null)
    setActivePicker(null)
    const cityList = await fetchHoroCities(opt.key)
    setCityOptions(cityList)
  }

  const dobLabel = dob ? `${dob.date.padStart(2, '0')} ${MONTHS[Number(dob.month) - 1] ?? ''} ${dob.year}` : undefined
  const canSubmit = !!(dob && selectedState && selectedCity && selHour && selMinute && selMeridian)

  async function handleSubmit() {
    if (submitting || !canSubmit || !dob || !selectedState || !selectedCity || !selHour || !selMinute || !selMeridian) return
    setSubmitting(true)

    try {
      await setItem(SK.Profile.HOROSCOPE_AVAILABLE, horoscopeAvailable ? '1' : '0')
      const ok = await generateHoroscope({
        date: dob.date, month: dob.month, year: dob.year,
        hour: selHour.key, minute: selMinute.key, meridian: selMeridian.key as 'AM' | 'PM',
        stateId: selectedState.key, cityKey: selectedCity.key,
      })
      setSubmitting(false)
      if (!ok) {
        Alert.alert('Something went wrong', 'Could not save horoscope details. Please try again.')
        return
      }
      navigation.goBack()
    } catch {
      setSubmitting(false)
      Alert.alert('Something went wrong', 'Could not save horoscope details. Please try again.')
    }
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
        <Text style={s.headerTitle} numberOfLines={1}>{t('EDITPROFILE.HOROSCOPE')}</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 16 }]} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>{t('EDITPROFILE.ADDYOURHORO')}</Text>

        {dobLabel ? (
          <SelectField label="Date of birth" value={dobLabel} locked onPress={() => {}} />
        ) : (
          <Text style={s.dobMissing}>We couldn't read your date of birth — please add it under Basic details first.</Text>
        )}

        <SelectField label="Birth state" value={selectedState?.label} onPress={() => setActivePicker('state')} />
        <SelectField
          label="Birth city"
          value={selectedCity?.label}
          placeholder={selectedState ? 'Select city' : 'Select state first'}
          onPress={() => selectedState && setActivePicker('city')}
        />
        <SelectField label="Birth hour" value={selHour?.label} placeholder="Select hour" onPress={() => setActivePicker('hour')} />
        <SelectField label="Birth minute" value={selMinute?.label} placeholder="Select minute" onPress={() => setActivePicker('minute')} />
        <SelectField label="AM / PM" value={selMeridian?.label} placeholder="Select" onPress={() => setActivePicker('meridian')} />

        <Pressable style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting || !canSubmit}>
          {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={s.submitBtnText}>{t('GENERAL.SUBMIT')}</Text>}
        </Pressable>
      </ScrollView>

      <SearchablePicker
        visible={activePicker === 'state'}
        title="Select birth state"
        placeholder="Search state..."
        options={stateOptions}
        selectedKey={selectedState?.key}
        onSelect={handleSelectState}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'city'}
        title="Select birth city"
        placeholder="Search city..."
        options={cityOptions}
        selectedKey={selectedCity?.key}
        onSelect={opt => { setSelectedCity(cityOptions.find(c => c.key === opt.key) ?? null); setActivePicker(null) }}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'hour'}
        title="Select hour"
        placeholder=""
        options={HOURS}
        selectedKey={selHour?.key}
        onSelect={opt => { setSelHour(opt); setActivePicker(null) }}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'minute'}
        title="Select minute"
        placeholder="Search..."
        options={MINUTES}
        selectedKey={selMinute?.key}
        onSelect={opt => { setSelMinute(opt); setActivePicker(null) }}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'meridian'}
        title="AM / PM"
        placeholder=""
        options={MERIDIANS}
        selectedKey={selMeridian?.key}
        onSelect={opt => { setSelMeridian(opt); setActivePicker(null) }}
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
  heading: { fontSize: 16, fontWeight: '500', color: Colors.textSecondary, marginBottom: 24 },
  dobMissing: { fontSize: 13, color: Colors.inputError, marginBottom: 20 },

  submitBtn: {
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: Colors.white, fontSize: 14, fontWeight: '500' },
})
