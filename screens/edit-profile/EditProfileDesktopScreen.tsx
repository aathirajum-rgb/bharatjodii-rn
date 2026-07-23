// Desktop Edit Profile (Figma "Jodii Desktop - Registration", nodes 668-13976
// / 642-2780 / 647-5191 / 729-27212 / 647-5227 / 647-6920 — all 6 links
// resolve to ONE combined scrollable page shown in different interaction
// states, not 6 separate screens). Unlike mobile, which splits this into a
// read-only hub (EditProfileScreen.tsx) plus 6 separate "group screens"
// (BasicDetailsScreen, ProfessionalDetailsScreen, ReligiousDetailsScreen,
// LifestyleDetailsScreen, PropertyDetailsScreen — Family details/brothers-
// sisters not shown in this Figma and omitted), desktop combines every field
// into one page with one Save button — so this screen owns its own state
// directly (same pattern as the onboarding desktop steps, e.g.
// PersonalReligiousDesktopStep.tsx), rather than being fed by a mobile
// parent screen (no single mobile screen holds all of this state at once).
//
// Every fetch/save call below is reused as-is from the mobile group screens —
// see BasicDetailsScreen/ProfessionalDetailsScreen/ReligiousDetailsScreen/
// LifestyleDetailsScreen/PropertyDetailsScreen.tsx for the field-by-field
// precedent this mirrors. Notable deliberate choices, not gaps:
//  - Dosham is ONE flat field here (Figma shows a single "Dosham" box, e.g.
//    "Rahu") instead of mobile's two-dropdown Yes/No + specific-type pair.
//    The options list is "No" + every specific dosham type (bare "Yes" is
//    dropped since picking any specific type already implies Yes) — this
//    preserves the exact same save formula
//    (`doshamValue = specific type key, else Yes/No key`) with one control.
//  - Properties owned is ONE multi-select covering both property AND vehicle
//    codes together (Figma shows one "Properties owned" row, not mobile's
//    two-row split) — recombined into one PROPERTIES change on Save exactly
//    like PropertyDetailsScreen.tsx already does.
//  - "Horoscope details missing" is a single derived link (`!raasi || !star`)
//    — no such combined element exists in mobile (confirmed: mobile shows
//    three separate per-field missing hints instead); built directly from
//    the same underlying data.
//
// Known, flagged gaps (NOT silently invented):
//  - Age, Height, Profile created by are read-only here. Age/Height mirror
//    BasicDetailsScreen.tsx's own explicit deferral (full DOB flow / height
//    category-or-exact panel needs a focused follow-up pass). Profile
//    created by has no current-value field anywhere in EditProfileInfo and
//    no edit-profile save wiring exists in this codebase at all yet — shown
//    from the locally cached registration value for display only.
//  - Drinking/Smoking habits: pickers work but Submit never sends them —
//    Angular's own TYPE-code map has no code for either, so this matches
//    real (if buggy) behavior rather than inventing an unconfirmed code,
//    exactly like LifestyleDetailsScreen.tsx already does.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import DesktopSelectField, { type SelectOption } from '../../components/desktop-select-field/DesktopSelectField'
import DesktopMultiSelectField from '../../components/desktop-select-field/DesktopMultiSelectField'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { Endpoints } from '../../service/api.endpoints'
import { apiCall, uploadFile } from '../../service/apiClient'
import { getItem, setItem } from '../../service/storageService'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { paymentTrack } from '../../service/paymentService'
import { fetchEditProfileInfo, submitFieldChanges, type FieldChange } from '../../service/editProfileService'
import {
  fetchMotherTongueOptions, fetchStates, fetchCities,
  fetchQualificationOptions, fetchOccupationOptions, fetchMonthlyIncomeOptions,
  fetchReligionOptions, fetchCasteOptions, fetchRaasiOptions, fetchStarOptions, fetchDoshamOptions,
  fetchDrinkingHabitOptions, fetchSmokingHabitOptions, fetchEatingHabitOptions, fetchPropertyOptions,
  fetchProfileCreatedByOptions, getRegValue,
} from '../../service/registrationService'
import type { FooterTab } from '../../components/app-footer/AppFooter'

const PLACEHOLDER = CDN_SVG + 'add-photo.svg'
const MAX_PHOTOS = 10

// Each grid cell's own dropdown already escapes ITS OWN stacking context
// (DesktopSelectField's wrapperOpen), but that only out-ranks siblings within
// the same cell — an earlier row's open dropdown still rendered BEHIND a
// later row's cells, since the outer `s.cell` wrappers themselves were never
// ordered against each other. Giving earlier rows a higher z-index (a fixed
// stacking order, independent of open state) fixes it the same way the DOB
// row fix did in PersonalReligiousDesktopStep.tsx, one level higher up.
function rowZ(row: number) {
  return { zIndex: 100 - row * 10 }
}

type Photo = { PHOTOID: string; PHOTOURL: string; PHOTOTHUMB?: string; MAINPHOTO: number }
type Opt = SelectOption

type Props = { navigation: any }

export default function EditProfileDesktopScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [userName, setUserName] = useState('')

  // ── Photos ──
  const [photos, setPhotos]         = useState<Photo[]>([])
  const [uploading, setUploading]   = useState(false)

  // ── Read-only fields ──
  const [ageDisplay, setAgeDisplay]       = useState<string | undefined>(undefined)
  const [heightDisplay, setHeightDisplay] = useState<string | undefined>(undefined)
  const [createdByLabel, setCreatedByLabel] = useState<string | undefined>(undefined)

  // ── Basic details ──
  const [motherTongue, setMotherTongue] = useState<Opt | null>(null)
  const [motherTongueEditable, setMotherTongueEditable] = useState(true)
  const [state, setState] = useState<Opt | null>(null)
  const [city, setCity]   = useState<Opt | null>(null)
  const [homeState, setHomeState] = useState<Opt | null>(null)
  const [homeCity, setHomeCity]   = useState<Opt | null>(null)

  // ── Professional details ──
  const [education, setEducation]   = useState<Opt | null>(null)
  const [occupation, setOccupation] = useState<Opt | null>(null)
  const [income, setIncome]         = useState<Opt | null>(null)

  // ── Religious details ──
  const [religion, setReligion] = useState<Opt | null>(null)
  const [caste, setCaste]       = useState<Opt | null>(null)
  const [raasi, setRaasi]       = useState<Opt | null>(null)
  const [star, setStar]         = useState<Opt | null>(null)
  const [dosham, setDosham]     = useState<Opt | null>(null)

  // ── Life style details ──
  const [drinking, setDrinking] = useState<Opt | null>(null)
  const [smoking, setSmoking]   = useState<Opt | null>(null)
  const [eating, setEating]     = useState<Opt | null>(null)

  // ── Property details ──
  const [properties, setProperties] = useState<Set<string>>(new Set())

  // ── Original values (for change-diffing on Save) ──
  const [original, setOriginal] = useState<{
    motherTongue?: string | undefined; state?: string | undefined; city?: string | undefined
    homeState?: string | undefined; homeCity?: string | undefined
    education?: string | undefined; occupation?: string | undefined; income?: string | undefined
    religion?: string | undefined; caste?: string | undefined; raasi?: string | undefined
    star?: string | undefined; dosham?: string | undefined
    eating?: string | undefined; properties: string[]
  }>({ properties: [] })

  // ── Option lists ──
  const [motherTongueOptions, setMotherTongueOptions] = useState<Opt[]>([])
  const [stateOptions, setStateOptions]                 = useState<Opt[]>([])
  const [cityOptions, setCityOptions]                   = useState<Opt[]>([])
  const [homeCityOptions, setHomeCityOptions]           = useState<Opt[]>([])
  const [educationOptions, setEducationOptions]         = useState<Opt[]>([])
  const [occupationOptions, setOccupationOptions]       = useState<Opt[]>([])
  const [incomeOptions, setIncomeOptions]               = useState<Opt[]>([])
  const [religionOptions, setReligionOptions]           = useState<Opt[]>([])
  const [casteOptions, setCasteOptions]                 = useState<Opt[]>([])
  const [raasiOptions, setRaasiOptions]                 = useState<Opt[]>([])
  const [starOptions, setStarOptions]                   = useState<Opt[]>([])
  const [doshamOptions, setDoshamOptions]               = useState<Opt[]>([])
  const [drinkingOptions, setDrinkingOptions]           = useState<Opt[]>([])
  const [smokingOptions, setSmokingOptions]             = useState<Opt[]>([])
  const [eatingOptions, setEatingOptions]               = useState<Opt[]>([])
  const [propertyOptions, setPropertyOptions]           = useState<Opt[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [name, createdByKey, info] = await Promise.all([
      getItem(SK.User.NAME),
      getRegValue('CREATEDBY'),
      fetchEditProfileInfo(),
    ])
    setUserName(name ?? '')
    if (!info) { setLoading(false); return }

    setAgeDisplay(info.age ? `${info.age} years old` : undefined)
    setHeightDisplay(info.heightCategory ?? info.height)
    setMotherTongueEditable(info.motherTongueEditable)

    setOriginal({
      motherTongue: info.motherTongue, state: info.state, city: info.city,
      homeState: info.homeState, homeCity: info.homeCity,
      education: info.education, occupation: info.occupation, income: info.income,
      religion: info.religion, caste: info.caste, raasi: info.raasi, star: info.star,
      dosham: info.doshamType?.[0] ?? info.dosham,
      eating: info.eatingHabits,
      properties: [...(info.properties ?? []), ...(info.vehicles ?? [])],
    })
    setProperties(new Set([...(info.properties ?? []), ...(info.vehicles ?? [])]))

    const [
      createdByList, motherTongueList, stateList,
      educationList, occupationList, incomeList,
      religionList, raasiList,
      drinkingList, smokingList, eatingList, propertyList,
    ] = await Promise.all([
      fetchProfileCreatedByOptions(),
      fetchMotherTongueOptions(),
      fetchStates(),
      fetchQualificationOptions(),
      fetchOccupationOptions(),
      fetchMonthlyIncomeOptions(),
      fetchReligionOptions(),
      fetchRaasiOptions(),
      fetchDrinkingHabitOptions(),
      fetchSmokingHabitOptions(),
      fetchEatingHabitOptions(),
      fetchPropertyOptions(),
    ])

    setCreatedByLabel(createdByList.find(o => o.key === createdByKey)?.label)
    setMotherTongueOptions(motherTongueList)
    setStateOptions(stateList)
    setEducationOptions(educationList)
    setOccupationOptions(occupationList)
    setIncomeOptions(incomeList)
    setReligionOptions(religionList)
    setRaasiOptions(raasiList)
    setDrinkingOptions(drinkingList)
    setSmokingOptions(smokingList)
    setEatingOptions(eatingList)
    setPropertyOptions(propertyList)

    setMotherTongue(motherTongueList.find(o => o.key === info.motherTongue) ?? null)
    setState(stateList.find(o => o.key === info.state) ?? null)
    setHomeState(stateList.find(o => o.key === info.homeState) ?? null)
    setEducation(educationList.find(o => o.key === info.education) ?? null)
    setOccupation(occupationList.find(o => o.key === info.occupation) ?? null)
    setIncome(incomeList.find(o => o.key === info.income) ?? null)
    setReligion(religionList.find(o => o.key === info.religion) ?? null)
    setRaasi(raasiList.find(o => o.key === info.raasi) ?? null)
    setDrinking(drinkingList.find(o => o.key === info.drinkingHabits) ?? null)
    setSmoking(smokingList.find(o => o.key === info.smokingHabits) ?? null)
    setEating(eatingList.find(o => o.key === info.eatingHabits) ?? null)

    const [cityList, homeCityList, casteList, starList] = await Promise.all([
      info.state ? fetchCities(info.state) : Promise.resolve([]),
      info.homeState ? fetchCities(info.homeState) : Promise.resolve([]),
      info.religion ? fetchCasteOptions(info.religion, info.motherTongue ?? '') : Promise.resolve([]),
      info.raasi ? fetchStarOptions(info.raasi) : Promise.resolve([]),
    ])
    setCityOptions(cityList)
    setHomeCityOptions(homeCityList)
    setCasteOptions(casteList)
    setStarOptions(starList)
    setCity(cityList.find(o => o.key === info.city) ?? null)
    setHomeCity(homeCityList.find(o => o.key === info.homeCity) ?? null)
    setCaste(casteList.find(o => o.key === info.caste) ?? null)
    setStar(starList.find(o => o.key === info.star) ?? null)

    if (info.star && info.raasi) {
      const { dosham: yesNoList, doshamHash } = await fetchDoshamOptions(info.star, info.raasi, info.motherTongue)
      const combined = [...yesNoList.filter(o => o.key !== '1'), ...doshamHash]
      setDoshamOptions(combined)
      const currentDoshamKey = info.doshamType?.[0] ?? info.dosham
      setDosham(combined.find(o => o.key === currentDoshamKey) ?? null)
    }

    await loadPhotos()
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function loadPhotos() {
    const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
    const res = await apiCall(Endpoints.profile.managePhoto, 'POST', `ID=${userId}`)
    if (res?.RESPONSECODE == 1 && res?.RESPONSE?.PHOTOS) setPhotos(res.RESPONSE.PHOTOS)
  }

  // ── Cascading resets when an upstream field changes (mirrors BasicDetailsScreen/ReligiousDetailsScreen) ──

  async function handleSelectState(opt: Opt) {
    setState(opt)
    if (opt.key === state?.key) return
    setCity(null)
    setCityOptions(await fetchCities(opt.key))
  }

  async function handleSelectHomeState(opt: Opt) {
    setHomeState(opt)
    if (opt.key === homeState?.key) return
    setHomeCity(null)
    setHomeCityOptions(await fetchCities(opt.key))
  }

  async function handleSelectReligion(opt: Opt) {
    setReligion(opt)
    if (opt.key === religion?.key) return
    setCaste(null)
    setCasteOptions(await fetchCasteOptions(opt.key, motherTongue?.key ?? ''))
  }

  async function handleSelectRaasi(opt: Opt) {
    setRaasi(opt)
    if (opt.key === raasi?.key) return
    setStar(null)
    setDosham(null)
    setStarOptions(await fetchStarOptions(opt.key))
  }

  async function handleSelectStar(opt: Opt) {
    setStar(opt)
    if (opt.key === star?.key) return
    setDosham(null)
    if (raasi) {
      const { dosham: yesNoList, doshamHash } = await fetchDoshamOptions(opt.key, raasi.key, motherTongue?.key)
      setDoshamOptions([...yesNoList.filter(o => o.key !== '1'), ...doshamHash])
    }
  }

  function toggleProperty(key: string) {
    setProperties(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  // ── Photos ──

  async function handleFiles(e: any) {
    const files: File[] = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      for (const file of files) {
        const formData = new FormData()
        formData.append('ID', userId)
        formData.append('UPLOADPHOTO', file, file.name)
        const res = await uploadFile(Endpoints.media.addProfilePic, formData)
        if (res?.RESPONSECODE == 1 && res?.RESPONSE?.PHOTOURL) {
          await setItem(SK.User.PHOTO_URL, String(res.RESPONSE.PHOTOURL))
        }
      }
      await loadPhotos()
    } catch {
      Alert.alert('Error', 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function openFilePicker() {
    inputRef.current?.click()
  }

  function confirmDelete(photo: Photo) {
    Alert.alert('Delete photo', 'Remove this photo from your profile?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
          const res = await apiCall(Endpoints.profile.deletePhoto, 'POST', `ID=${userId}&PHOTOID=${photo.PHOTOID}`)
          if (res?.RESPONSECODE == 1) await loadPhotos()
        },
      },
    ])
  }

  async function setAsMain(photo: Photo) {
    const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
    const res = await apiCall(Endpoints.profile.setMainPhoto, 'POST', `ID=${userId}&PHOTOID=${photo.PHOTOID}`)
    if (res?.RESPONSECODE == 1) await loadPhotos()
  }

  // ── Save ──

  async function handleSave() {
    if (saving) return
    setSaving(true)

    const changes: FieldChange[] = []
    if (motherTongueEditable && motherTongue && motherTongue.key !== original.motherTongue) {
      changes.push({ field: 'MOTHERTONGUE', value: motherTongue.key, existingValue: original.motherTongue })
    }
    if (state && city && (state.key !== original.state || city.key !== original.city)) {
      changes.push({ field: 'STATE', value: `${state.key}~${city.key}`, existingValue: `${original.state ?? ''}~${original.city ?? ''}` })
    }
    if (homeState && homeCity && (homeState.key !== original.homeState || homeCity.key !== original.homeCity)) {
      changes.push({ field: 'HOMESTATE', value: `${homeState.key}~${homeCity.key}`, existingValue: `${original.homeState ?? ''}~${original.homeCity ?? ''}` })
    }
    if (education && education.key !== original.education) {
      changes.push({ field: 'QUALIFICATION', value: education.key, existingValue: original.education })
    }
    if (occupation && occupation.key !== original.occupation) {
      changes.push({ field: 'OCCUPATION', value: occupation.key, existingValue: original.occupation })
    }
    if (income && income.key !== original.income) {
      changes.push({ field: 'INCOME', value: income.key, existingValue: original.income })
    }
    if (religion && religion.key !== original.religion) {
      changes.push({ field: 'RELIGION', value: religion.key, existingValue: original.religion })
    }
    if (caste && caste.key !== original.caste) {
      changes.push({ field: 'CASTE', value: caste.key, existingValue: original.caste })
    }
    if (raasi && raasi.key !== original.raasi) {
      changes.push({ field: 'RAASI', value: raasi.key, existingValue: original.raasi })
    }
    if (star && star.key !== original.star) {
      changes.push({ field: 'STAR', value: star.key, existingValue: original.star })
    }
    if (dosham && dosham.key !== original.dosham) {
      changes.push({ field: 'DOSHAM', value: dosham.key, existingValue: original.dosham })
    }
    if (eating && eating.key !== original.eating) {
      changes.push({ field: 'EATING', value: eating.key, existingValue: original.eating })
    }
    const currentProperties = Array.from(properties)
    const sameProperties = currentProperties.length === original.properties.length
      && currentProperties.every(k => original.properties.includes(k))
    if (!sameProperties) {
      changes.push({ field: 'PROPERTIES', value: currentProperties.join('~'), existingValue: original.properties.join('~') })
    }
    // Drinking/Smoking intentionally excluded — see file header note.

    if (changes.length === 0) {
      setSaving(false)
      return
    }

    const result = await submitFieldChanges(changes)
    setSaving(false)

    if (result.failed.length > 0) {
      Alert.alert('Some changes could not be saved', `${result.succeeded.length} saved, ${result.failed.length} failed: ${result.failed.join(', ')}`)
    } else {
      Alert.alert('Saved', 'Your profile has been updated.')
      load()
    }
  }

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 3: paymentTrack('31'); navigation.navigate('recharge'); break
      case 4: navigation.navigate('Search');   break
    }
  }

  const missingHoroscope = !raasi || !star

  if (loading) {
    return (
      <DesktopPageShell navigation={navigation} userName={userName} activeItem="editProfile" onTabPress={handleTabPress}>
        <View style={[s.main, s.center]}><ActivityIndicator color={Colors.primaryDark} size="large" /></View>
      </DesktopPageShell>
    )
  }

  return (
    <DesktopPageShell navigation={navigation} userName={userName} activeItem="editProfile" onTabPress={handleTabPress}>
      {Platform.OS === 'web' && (
        <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFiles} />
      )}

      <View style={s.main}>
        <Text style={s.pageTitle}>{t('EDITPROFILE.EDIT_PROFILE')}</Text>

        {/* ── Photos ── */}
        <View style={s.card}>
          <View style={s.photoHeaderRow}>
            <Text style={s.sectionTitle}>{t('EDITPROFILE.PHOTOS')}</Text>
            <Pressable onPress={() => Alert.alert('Photo privacy', 'Coming soon')} hitSlop={8}>
              <Text style={s.link}>{t('EDITPROFILE.PHOTO_PRIVACY')}</Text>
            </Pressable>
          </View>

          <View style={s.photoGrid}>
            {photos.map((p, idx) => (
              <View key={p.PHOTOID} style={[s.photoTile, idx === 0 && s.photoTileMain]}>
                <Pressable style={s.photoTilePress} onPress={idx === 0 ? undefined : () => setAsMain(p)}>
                  <Image source={{ uri: p.PHOTOURL || p.PHOTOTHUMB || '' }} style={s.photoTileImg} contentFit="cover" />
                </Pressable>
                {idx === 0 && <View style={s.mainLabel}><Text style={s.mainLabelText}>Profile Picture</Text></View>}
                <Pressable style={s.photoDeleteBtn} onPress={() => confirmDelete(p)} hitSlop={4}>
                  <Text style={s.photoDeleteIcon}>🗑</Text>
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <Pressable style={s.photoAddTile} onPress={openFilePicker}>
                {uploading ? <ActivityIndicator color={Colors.textSecondary} /> : (
                  photos.length === 0
                    ? <Image source={{ uri: PLACEHOLDER }} style={{ width: 40, height: 40 }} contentFit="contain" />
                    : <Text style={s.photoAddPlus}>+</Text>
                )}
              </Pressable>
            )}
          </View>
          <Text style={s.photoHint}>{photos.length === 0 ? t('EDITPROFILE.DRAG_PHOTO', 'Add your photos') : t('EDITPROFILE.DRAG_PHOTO')}</Text>
          <Pressable onPress={() => Alert.alert('Photo guidelines', 'Use clear, recent photos with good lighting.')}>
            <Text style={s.guidelines}>ⓘ Check out our photo tips</Text>
          </Pressable>
        </View>

        {/* ── Basic details ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>{t('EDITPROFILE.BASIC_DETAILS')}</Text>
          <View style={s.grid}>
            <View style={[s.cell, rowZ(0)]}>
              <DesktopSelectField label={t('EDITPROFILE.CREATEDBY', 'Profile created by')} options={createdByLabel ? [{ key: '_', label: createdByLabel }] : []} selectedKey={createdByLabel ? '_' : null} onSelect={() => {}} disabled />
            </View>
            <View style={[s.cell, rowZ(0)]}>
              <DesktopSelectField label={t('EDITPROFILE.AGE')} options={ageDisplay ? [{ key: '_', label: ageDisplay }] : []} selectedKey={ageDisplay ? '_' : null} onSelect={() => {}} disabled />
            </View>
            <View style={[s.cell, rowZ(1)]}>
              <DesktopSelectField label={t('EDITPROFILE.HEIGHT')} options={heightDisplay ? [{ key: '_', label: heightDisplay }] : []} selectedKey={heightDisplay ? '_' : null} onSelect={() => {}} disabled />
            </View>
            <View style={[s.cell, rowZ(1)]}>
              <DesktopSelectField
                label={t('EDITPROFILE.MOTHERTONGUE')} options={motherTongueOptions} selectedKey={motherTongue?.key ?? null}
                onSelect={setMotherTongue} disabled={!motherTongueEditable}
              />
            </View>
            <View style={[s.cell, rowZ(2)]}>
              <DesktopSelectField label={t('EDITPROFILE.CURRENT_LOCATION')} options={stateOptions} selectedKey={state?.key ?? null} onSelect={handleSelectState} />
            </View>
            <View style={[s.cell, rowZ(2)]}>
              <DesktopSelectField
                label="City" options={cityOptions} selectedKey={city?.key ?? null} onSelect={setCity}
                disabled={!state} {...(state ? {} : { placeholder: 'Select state first' })}
              />
            </View>
            <View style={[s.cell, rowZ(3)]}>
              <DesktopSelectField label={t('EDITPROFILE.NATIVE_PLACE')} options={stateOptions} selectedKey={homeState?.key ?? null} onSelect={handleSelectHomeState} />
            </View>
            <View style={[s.cell, rowZ(3)]}>
              <DesktopSelectField
                label="Hometown city" options={homeCityOptions} selectedKey={homeCity?.key ?? null} onSelect={setHomeCity}
                disabled={!homeState} {...(homeState ? {} : { placeholder: 'Select state first' })}
              />
            </View>
          </View>
        </View>

        {/* ── Professional details ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Professional details</Text>
          <View style={s.grid}>
            <View style={[s.cell, rowZ(0)]}>
              <DesktopSelectField label={t('EDITPROFILE.EDUCATION')} options={educationOptions} selectedKey={education?.key ?? null} onSelect={setEducation} />
            </View>
            <View style={[s.cell, rowZ(0)]}>
              <DesktopSelectField label={t('EDITPROFILE.OCCUPATION')} options={occupationOptions} selectedKey={occupation?.key ?? null} onSelect={setOccupation} />
            </View>
            <View style={[s.cell, rowZ(1)]}>
              <DesktopSelectField label={t('EDITPROFILE.INCOME')} options={incomeOptions} selectedKey={income?.key ?? null} onSelect={setIncome} />
            </View>
          </View>
        </View>

        {/* ── Religious details ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>{t('EDITPROFILE.RELIGIOUSDETAIL')}</Text>
          <View style={s.grid}>
            <View style={[s.cell, rowZ(0)]}>
              <DesktopSelectField label={t('EDITPROFILE.RELIGION')} options={religionOptions} selectedKey={religion?.key ?? null} onSelect={handleSelectReligion} />
            </View>
            <View style={[s.cell, rowZ(0)]}>
              <DesktopSelectField label={t('EDITPROFILE.CASTESUB')} options={casteOptions} selectedKey={caste?.key ?? null} onSelect={setCaste} />
            </View>
            <View style={[s.cell, rowZ(1)]}>
              <DesktopSelectField label={t('EDITPROFILE.STAR')} options={starOptions} selectedKey={star?.key ?? null} onSelect={handleSelectStar} />
            </View>
            <View style={[s.cell, rowZ(1)]}>
              <DesktopSelectField label={t('EDITPROFILE.RAASI')} options={raasiOptions} selectedKey={raasi?.key ?? null} onSelect={handleSelectRaasi} />
            </View>
            <View style={[s.cell, rowZ(2)]}>
              <DesktopSelectField label={t('EDITPROFILE.DOSHAM')} options={doshamOptions} selectedKey={dosham?.key ?? null} onSelect={setDosham} disabled={!raasi || !star} />
            </View>
            {missingHoroscope && (
              <View style={[s.cell, rowZ(2)]}>
                <Pressable style={s.missingBox} onPress={() => Alert.alert('Horoscope', 'Coming soon')}>
                  <Text style={s.missingBoxText}>Horoscope details missing</Text>
                  <Text style={s.missingBoxBang}>!</Text>
                </Pressable>
                <Text style={s.missingHint}>{t('EDITPROFILE.ADDYOURHORO', 'Add your horoscope details')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Life style details ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Life style details</Text>
          <View style={s.grid}>
            <View style={[s.cell, rowZ(0)]}>
              <DesktopSelectField label={t('EDITPROFILE.DRINKING')} options={drinkingOptions} selectedKey={drinking?.key ?? null} onSelect={setDrinking} />
            </View>
            <View style={[s.cell, rowZ(0)]}>
              <DesktopSelectField label="Smoking habits" options={smokingOptions} selectedKey={smoking?.key ?? null} onSelect={setSmoking} />
            </View>
            <View style={[s.cell, rowZ(1)]}>
              <DesktopSelectField label={t('EDITPROFILE.EATING')} options={eatingOptions} selectedKey={eating?.key ?? null} onSelect={setEating} />
            </View>
          </View>
        </View>

        {/* ── Property details ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Property details</Text>
          <View style={s.grid}>
            <View style={s.cell}>
              <DesktopMultiSelectField label="Properties owned" options={propertyOptions} selectedKeys={properties} onToggle={toggleProperty} />
            </View>
          </View>
        </View>

        <ButtonRevamp label="Save changes" variant="primary" loading={saving} onPress={handleSave} style={s.saveBtn} />
      </View>
    </DesktopPageShell>
  )
}

const CELL_W = 338

const s = StyleSheet.create({
  main: { width: 700, paddingBottom: 24 },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  pageTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 20, color: Colors.textDark, marginBottom: 16 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle,
    padding: 20, marginBottom: 16,
  },
  sectionTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.textDark, marginBottom: 16 },
  link: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.link, textDecorationLine: 'underline' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  cell: { width: CELL_W },

  photoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoTile: {
    width: 100, height: 100, borderRadius: 10, overflow: 'hidden', position: 'relative',
    backgroundColor: Colors.surfaceInput,
  },
  photoTileMain: { borderWidth: 2, borderColor: Colors.primaryDark },
  photoTilePress: { flex: 1 },
  photoTileImg: { width: '100%', height: '100%' },
  mainLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 4, paddingLeft: 6 },
  mainLabelText: { fontSize: 10, fontWeight: '700', color: Colors.white },
  photoDeleteBtn: {
    position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
  },
  photoDeleteIcon: { fontSize: 11 },
  photoAddTile: {
    width: 100, height: 100, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceInput,
  },
  photoAddPlus: { fontSize: 24, fontWeight: '300', color: Colors.textSecondary },
  photoHint: { fontSize: 12, color: Colors.link, marginTop: 8 },
  guidelines: { fontSize: 12, color: Colors.textSecondary, textDecorationLine: 'underline', marginTop: 8 },

  missingBox: {
    height: 56, borderWidth: 1, borderColor: Colors.primaryDark, borderRadius: 8,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  missingBoxText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.textDark },
  missingBoxBang: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primaryDark, color: Colors.white,
    fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 18, overflow: 'hidden',
  },
  missingHint: { fontSize: 12, color: Colors.link, marginTop: 6 },

  saveBtn: { alignSelf: 'flex-end', width: 200, marginTop: 8 },
})
