// New screen — Angular has no equivalent "group screen"; it navigates each
// field straight to /editform/:id individually (see edit-profile.page.html).
// This follows the new Figma design (node 4389-1000) instead: one screen per
// section, each field a tap-to-open SelectField, one Submit button at the
// bottom that saves everything changed on this screen in one go.
//
// Save mechanics (confirmed against Angular, not assumed): there is no batch
// endpoint reachable in edit-profile context — Submit loops through only the
// fields that actually changed and calls the same per-field
// editprofile/updatememberinfo/v1 endpoint once per field (submitFieldChanges
// in editProfileService.ts).
//
// DOSHAM quirk ported from registration.page.ts's updateReligious(): the
// field is saved under one TYPE code (13) whose VALUE is either the plain
// Yes/No code ('1'/'2') or, when a specific dosham type is chosen, the type's
// own code — never both. EXISTINGVALUE mirrors whichever shape the field
// previously had.

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { fetchEditProfileInfo } from '../../service/editProfileService'
import { submitFieldChanges, type FieldChange } from '../../service/editProfileService'
import {
  fetchReligionOptions, fetchCasteOptions, fetchRaasiOptions,
  fetchStarOptions, fetchDoshamOptions, fetchGothraOptions, isGothraApplicableForCaste,
} from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import SelectField from '../../components/input/SelectField'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

type Props = { navigation: any }
type Picker = 'religion' | 'caste' | 'gothram' | 'raasi' | 'star' | 'doshamYesNo' | 'doshamType' | null

export default function ReligiousDetailsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [motherTongue, setMotherTongue] = useState('')

  const [religion, setReligion]         = useState<PickerOption | null>(null)
  const [caste, setCaste]               = useState<PickerOption | null>(null)
  const [gothram, setGothram]           = useState<PickerOption | null>(null)
  const [showGothra, setShowGothra]     = useState(false)
  const [raasi, setRaasi]               = useState<PickerOption | null>(null)
  const [star, setStar]                 = useState<PickerOption | null>(null)
  const [doshamYesNo, setDoshamYesNo]   = useState<PickerOption | null>(null)
  const [doshamType, setDoshamType]     = useState<PickerOption | null>(null)

  const [religionEditable, setReligionEditable] = useState(true)
  const [casteEditable, setCasteEditable]       = useState(true)

  const [original, setOriginal] = useState<{
    religion?: string | undefined
    caste?:    string | undefined
    gothram?:  string | undefined
    raasi?:    string | undefined
    star?:     string | undefined
    dosham?:   string | undefined
  }>({})

  const [religionOptions, setReligionOptions]     = useState<PickerOption[]>([])
  const [casteOptions, setCasteOptions]           = useState<PickerOption[]>([])
  const [gothramOptions, setGothramOptions]       = useState<PickerOption[]>([])
  const [raasiOptions, setRaasiOptions]           = useState<PickerOption[]>([])
  const [starOptions, setStarOptions]             = useState<PickerOption[]>([])
  const [doshamYesNoOptions, setDoshamYesNoOptions] = useState<PickerOption[]>([])
  const [doshamTypeOptions, setDoshamTypeOptions]   = useState<PickerOption[]>([])

  const [activePicker, setActivePicker] = useState<Picker>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const info = await fetchEditProfileInfo()
    if (!info) { setLoading(false); return }

    setMotherTongue(info.motherTongue ?? '')
    setReligionEditable(info.religionEditable)
    setCasteEditable(info.casteEditable)
    setOriginal({
      religion: info.religion,
      caste:    info.caste,
      gothram:  info.gothram,
      raasi:    info.raasi,
      star:     info.star,
      dosham:   info.doshamType?.[0] ?? info.dosham,
    })

    const [religionList, raasiList] = await Promise.all([
      fetchReligionOptions(),
      fetchRaasiOptions(),
    ])
    setReligionOptions(religionList)
    setRaasiOptions(raasiList)
    setReligion(religionList.find(o => o.key === info.religion) ?? null)
    setRaasi(raasiList.find(o => o.key === info.raasi) ?? null)

    const [casteList, starList] = await Promise.all([
      info.religion ? fetchCasteOptions(info.religion, info.motherTongue ?? '') : Promise.resolve([]),
      info.raasi ? fetchStarOptions(info.raasi) : Promise.resolve([]),
    ])
    setCasteOptions(casteList)
    setStarOptions(starList)
    setCaste(casteList.find(o => o.key === info.caste) ?? null)
    setStar(starList.find(o => o.key === info.star) ?? null)

    if (info.caste) {
      const applicable = await isGothraApplicableForCaste(info.caste)
      if (applicable || info.gothram) {
        const gothramList = await fetchGothraOptions(info.caste)
        setGothramOptions(gothramList)
        setShowGothra(applicable || gothramList.length > 0 || !!info.gothram)
        setGothram(gothramList.find(o => o.key === info.gothram) ?? null)
      }
    }

    // The Yes/No dosham list is static reference data, same as fetchRaasiOptions()
    // fetching RAASI with all-blank params — it doesn't actually depend on star/
    // raasi being set. Only DOSHAMHASH (the specific dosham *type* breakdown)
    // genuinely needs a real star+raasi to compute. Previously this whole call
    // was gated behind `info.star && info.raasi`, so a profile with neither set
    // (like a fresh account) never even fetched the Yes/No list, let alone its
    // existing dosham value.
    {
      const { dosham: yesNoList, doshamHash } = await fetchDoshamOptions(info.star ?? '', info.raasi ?? '', info.motherTongue)
      setDoshamYesNoOptions(yesNoList)
      setDoshamTypeOptions(doshamHash)
      setDoshamYesNo(yesNoList.find(o => o.key === info.dosham) ?? null)
      if (info.doshamType?.[0]) {
        setDoshamType(doshamHash.find(o => o.key === info.doshamType![0]) ?? null)
      }
    }

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Cascading resets when an upstream field changes ─────────────────────────

  async function handleSelectReligion(opt: PickerOption) {
    setReligion(opt)
    setActivePicker(null)
    if (opt.key === religion?.key) return
    setCaste(null)
    setGothram(null)
    setGothramOptions([])
    setShowGothra(false)
    const list = await fetchCasteOptions(opt.key, motherTongue)
    setCasteOptions(list)
  }

  async function handleSelectCaste(opt: PickerOption) {
    setCaste(opt)
    setActivePicker(null)
    if (opt.key === caste?.key) return
    setGothram(null)
    const applicable = await isGothraApplicableForCaste(opt.key)
    const list = applicable ? await fetchGothraOptions(opt.key) : []
    setGothramOptions(list)
    setShowGothra(applicable || list.length > 0)
  }

  async function handleSelectRaasi(opt: PickerOption) {
    setRaasi(opt)
    setActivePicker(null)
    if (opt.key === raasi?.key) return
    setStar(null)
    setDoshamType(null)
    const list = await fetchStarOptions(opt.key)
    setStarOptions(list)
  }

  async function handleSelectStar(opt: PickerOption) {
    setStar(opt)
    setActivePicker(null)
    if (opt.key === star?.key) return
    setDoshamType(null)
    if (raasi) {
      const { dosham: yesNoList, doshamHash } = await fetchDoshamOptions(opt.key, raasi.key, motherTongue)
      setDoshamYesNoOptions(yesNoList)
      setDoshamTypeOptions(doshamHash)
    }
  }

  function handleSelectDoshamYesNo(opt: PickerOption) {
    setDoshamYesNo(opt)
    setActivePicker(null)
    if (opt.key !== '1') setDoshamType(null)
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    const changes: FieldChange[] = []
    if (religionEditable && religion && religion.key !== original.religion) {
      changes.push({ field: 'RELIGION', value: religion.key, existingValue: original.religion })
    }
    if (casteEditable && caste && caste.key !== original.caste) {
      changes.push({ field: 'CASTE', value: caste.key, existingValue: original.caste })
    }
    if (showGothra && gothram && gothram.key !== original.gothram) {
      changes.push({ field: 'GOTHRA', value: gothram.key, existingValue: original.gothram })
    }
    if (raasi && raasi.key !== original.raasi) {
      changes.push({ field: 'RAASI', value: raasi.key, existingValue: original.raasi })
    }
    if (star && star.key !== original.star) {
      changes.push({ field: 'STAR', value: star.key, existingValue: original.star })
    }
    // Dosham saves under one TYPE code — value is the specific type if chosen
    // (dosham = "Yes"), otherwise the plain Yes/No code.
    const doshamValue = (doshamYesNo?.key === '1' && doshamType) ? doshamType.key : doshamYesNo?.key
    if (doshamValue && doshamValue !== original.dosham) {
      changes.push({ field: 'DOSHAM', value: doshamValue, existingValue: original.dosham })
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

  function showRestricted() {
    Alert.alert(t('EDITPROFILE.RESTRICT_FIELD'), t('EDITPROFILE.RESTRICT_SUPPORT'))
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
        <Text style={s.heading}>{t('EDITPROFILE.RELIGIOUSDETAIL')}</Text>

        {religionEditable ? (
          <SelectField label="Select your religion" value={religion?.label} onPress={() => setActivePicker('religion')} />
        ) : (
          <SelectField label="Select your religion" value={religion?.label} locked onPress={showRestricted} />
        )}
        {casteEditable ? (
          <SelectField label="Select your caste" value={caste?.label} onPress={() => setActivePicker('caste')} />
        ) : (
          <SelectField label="Select your caste" value={caste?.label} locked onPress={showRestricted} />
        )}
        {showGothra && (
          <SelectField label="Select your gothram" value={gothram?.label} onPress={() => setActivePicker('gothram')} />
        )}
        <SelectField label="Select your raasi" value={raasi?.label} onPress={() => setActivePicker('raasi')} />
        <SelectField label="Select your star" value={star?.label} onPress={() => setActivePicker('star')} />
        <SelectField label="Do you have dosham" value={doshamYesNo?.label} onPress={() => setActivePicker('doshamYesNo')} />
        {doshamYesNo?.key === '1' && (
          <SelectField label="Select your dosham" value={doshamType?.label} onPress={() => setActivePicker('doshamType')} />
        )}

        <Pressable style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={s.submitBtnText}>{t('GENERAL.SUBMIT')}</Text>}
        </Pressable>
      </ScrollView>

      <SearchablePicker
        visible={activePicker === 'religion'}
        title="Select your religion"
        placeholder="Search religion..."
        options={religionOptions}
        selectedKey={religion?.key}
        onSelect={handleSelectReligion}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'caste'}
        title="Select your caste"
        placeholder="Search caste..."
        options={casteOptions}
        selectedKey={caste?.key}
        onSelect={handleSelectCaste}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'gothram'}
        title="Select your gothram"
        placeholder="Search gothram..."
        options={gothramOptions}
        selectedKey={gothram?.key}
        onSelect={opt => { setGothram(opt); setActivePicker(null) }}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'raasi'}
        title="Select your raasi"
        placeholder="Search raasi..."
        options={raasiOptions}
        selectedKey={raasi?.key}
        onSelect={handleSelectRaasi}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'star'}
        title="Select your star"
        placeholder="Search star..."
        options={starOptions}
        selectedKey={star?.key}
        onSelect={handleSelectStar}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'doshamYesNo'}
        title="Do you have dosham"
        placeholder=""
        options={doshamYesNoOptions}
        selectedKey={doshamYesNo?.key}
        onSelect={handleSelectDoshamYesNo}
        onClose={() => setActivePicker(null)}
      />
      <SearchablePicker
        visible={activePicker === 'doshamType'}
        title="Select your dosham"
        placeholder="Search dosham..."
        options={doshamTypeOptions}
        selectedKey={doshamType?.key}
        onSelect={opt => { setDoshamType(opt); setActivePicker(null) }}
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
