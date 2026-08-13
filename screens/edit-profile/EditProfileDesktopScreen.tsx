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
//  - "Horoscope details missing" is derived from `!horoscopeAvailable` (the
//    server-confirmed flag), not from Raasi/Star presence — those are
//    independently editable on this same screen and aren't a reliable proxy.
//
// Known, flagged gaps (NOT silently invented):
//  - Age, Height, Jodii ID, Profile created by, and Mobile number are
//    read-only here. Age/Height mirror BasicDetailsScreen.tsx's own explicit
//    deferral (full DOB flow / height category-or-exact panel is mobile-only
//    for now — a native `<input type=date>`/numeric web equivalent is a
//    reasonable low-cost follow-up, out of scope for this pass). Jodii ID /
//    Profile created by / Mobile number have no edit-profile save wiring
//    anywhere in this codebase (Angular doesn't make them editable either).
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
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_REACT, CDN_SVG } from '../../constants/cdn'
import { Endpoints } from '../../service/api.endpoints'
import { apiCall, uploadFile } from '../../service/apiClient'
import { getItem, setItem } from '../../service/storageService'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { openMembershipTab } from '../../service/paymentService'
import { fetchEditProfileInfo, submitFieldChanges, type FieldChange } from '../../service/editProfileService'
import { deletePhoto, setMainPhoto } from '../../service/profileService'
import PhotoPrivacyDesktopModal from '../../components/photo-privacy/PhotoPrivacyDesktopModal'
import PhotoViewerModal, { type ViewerPhoto } from '../../components/edit-profile/PhotoViewerModal'
import DeletePhotoConfirmModal from '../../components/edit-profile/DeletePhotoConfirmModal'
import Toast, { type ToastRequest } from '../../components/toast/Toast'
import {
  CHILDREN_OPTIONS,
  fetchMotherTongueOptions, fetchStates, fetchCities,
  fetchQualificationOptions, fetchOccupationOptions, fetchMonthlyIncomeOptions,
  fetchReligionOptions, fetchCasteOptions, fetchRaasiOptions, fetchStarOptions, fetchDoshamOptions,
  fetchDrinkingHabitOptions, fetchSmokingHabitOptions, fetchEatingHabitOptions, fetchPropertyOptions,
  fetchProfileCreatedByOptions, fetchMaritalStatusOptions, fetchPhysicalStatusOptions, getRegValue,
} from '../../service/registrationService'
import type { FooterTab } from '../../components/app-footer/AppFooter'

const PLACEHOLDER = CDN_SVG + 'add-photo.svg'
const MAX_PHOTOS = 10
// How long the delete-photo toast's "Undo" stays live — deletePicture/v1 has
// no matching "undelete", so Undo only works by NOT calling it yet: the
// photo is removed from the grid immediately (optimistic), but the real API
// call is deferred until this window elapses with no Undo tap. Longer than
// Toast's own 2000ms default so there's a real window to react in.
const DELETE_UNDO_WINDOW_MS = 3000
// Figma node 642:2780 ("with photos" state) — real pixel specs: 204×204
// primary tile (left) + a wrapping grid of 98×98 tiles (right, 16px column
// gap / 9px row gap), NOT one uniform flex-wrap row of same-size tiles like
// this screen previously rendered (which broke the moment a photo existed —
// see the bug report screenshot). Icons are downloaded assets, not text
// glyphs — Figma's trash-2/plus-circle already bake in their own white
// rounded-square / grey-circle backdrops, confirmed from the real SVGs.
const DELETE_ICON = CDN_REACT + '/edit-profile-photo-delete-icon.svg'
const ADD_ICON    = CDN_REACT + '/edit-profile-photo-add-icon.svg'

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
  // Set right before openFilePicker() fires for a "Replace this photo"
  // action (vs. a plain add) — handleFiles() checks this to know it should
  // delete the old PHOTOID after the new upload succeeds, and to only take
  // the first picked file (the hidden <input> stays `multiple` for the
  // regular add-photo case). See PhotoViewerModal.tsx's header comment for
  // why this compose-from-two-calls approach, not a dedicated endpoint.
  const replacingPhotoRef = useRef<Photo | null>(null)
  // The one in-flight "deferred delete" (see DELETE_UNDO_WINDOW_MS above) —
  // cleared either when its timer fires for real, or when Undo cancels it.
  const pendingDeleteRef = useRef<{ photo: Photo; index: number; timer: ReturnType<typeof setTimeout> } | null>(null)

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [userName, setUserName] = useState('')

  // ── Photos ──
  const [photos, setPhotos]         = useState<Photo[]>([])
  const [uploading, setUploading]   = useState(false)
  const [photoPrivacyVisible, setPhotoPrivacyVisible] = useState(false)
  const [photoViewerIndex, setPhotoViewerIndex] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null)
  const [toastRequest, setToastRequest] = useState<ToastRequest | null>(null)

  // ── Read-only fields ──
  const [ageDisplay, setAgeDisplay]       = useState<string | undefined>(undefined)
  const [heightDisplay, setHeightDisplay] = useState<string | undefined>(undefined)
  const [createdByLabel, setCreatedByLabel] = useState<string | undefined>(undefined)
  const [jodiiId, setJodiiId]         = useState<string | undefined>(undefined)
  const [mobileNo, setMobileNo]       = useState<string | undefined>(undefined)

  // ── Marital status / children / physical status ──
  const [maritalStatus, setMaritalStatus] = useState<Opt | null>(null)
  const [noOfChildren, setNoOfChildren]   = useState<Opt | null>(null)
  const [physicalStatus, setPhysicalStatus] = useState<Opt | null>(null)
  const [maritalStatusOptions, setMaritalStatusOptions] = useState<Opt[]>([])
  const [physicalStatusOptions, setPhysicalStatusOptions] = useState<Opt[]>([])

  // ── One-time-edit locks ──
  const [incomeEditable, setIncomeEditable]     = useState(true)
  const [casteEditable, setCasteEditable]       = useState(true)
  const [religionEditable, setReligionEditable] = useState(true)

  const [horoscopeAvailable, setHoroscopeAvailable] = useState(false)

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
    maritalStatus?: string | undefined; noOfChildren?: string | undefined; physicalStatus?: string | undefined
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
    const [name, createdByKey, userId, loginGender, info] = await Promise.all([
      getItem(SK.User.NAME),
      getRegValue('CREATEDBY'),
      getItem(SK.Auth.USER_ID),
      getItem(SK.User.LOGIN_GENDER),
      fetchEditProfileInfo(),
    ])
    setUserName(name ?? '')
    setJodiiId(userId ?? undefined)
    if (!info) { setLoading(false); return }

    const gender = info.gender ?? loginGender ?? '1'

    setAgeDisplay(info.age ? `${info.age} years old` : undefined)
    setHeightDisplay(info.heightCategory ?? info.height)
    setMotherTongueEditable(info.motherTongueEditable)
    setIncomeEditable(info.incomeEditable)
    setCasteEditable(info.casteEditable)
    setReligionEditable(info.religionEditable)
    setMobileNo(info.mobileNo)
    setHoroscopeAvailable(!!info.horoscopeAvailable)

    setOriginal({
      motherTongue: info.motherTongue, state: info.state, city: info.city,
      homeState: info.homeState, homeCity: info.homeCity,
      education: info.education, occupation: info.occupation, income: info.income,
      religion: info.religion, caste: info.caste, raasi: info.raasi, star: info.star,
      dosham: info.doshamType?.[0] ?? info.dosham,
      eating: info.eatingHabits,
      properties: [...(info.properties ?? []), ...(info.vehicles ?? [])],
      maritalStatus: info.maritalStatus, noOfChildren: info.noOfChildren, physicalStatus: info.physicalStatus,
    })
    setProperties(new Set([...(info.properties ?? []), ...(info.vehicles ?? [])]))

    const [
      createdByList, motherTongueList, stateList,
      educationList, occupationList, incomeList,
      religionList, raasiList,
      drinkingList, smokingList, eatingList, propertyList,
      maritalStatusList, physicalStatusList,
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
      fetchMaritalStatusOptions(gender),
      fetchPhysicalStatusOptions(),
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
    setMaritalStatusOptions(maritalStatusList)
    setPhysicalStatusOptions(physicalStatusList)

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
    setMaritalStatus(maritalStatusList.find(o => o.key === info.maritalStatus) ?? null)
    setNoOfChildren(CHILDREN_OPTIONS.find(o => o.key === info.noOfChildren) ?? null)
    setPhysicalStatus(physicalStatusList.find(o => o.key === info.physicalStatus) ?? null)

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
    const replacing = replacingPhotoRef.current
    replacingPhotoRef.current = null
    setUploading(true)
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      // Replace targets exactly one photo — only the first picked file
      // applies even if the browser's file picker allowed multi-select.
      const filesToUpload = replacing ? files.slice(0, 1) : files
      for (const file of filesToUpload) {
        const formData = new FormData()
        formData.append('ID', userId)
        formData.append('UPLOADPHOTO', file, file.name)
        const res = await uploadFile(Endpoints.media.addProfilePic, formData)
        if (res?.RESPONSECODE == 1 && res?.RESPONSE?.PHOTOURL) {
          await setItem(SK.User.PHOTO_URL, String(res.RESPONSE.PHOTOURL))
        }
      }
      if (replacing) await deletePhoto(replacing.PHOTOID)
      await loadPhotos()
      // "Profile photo updated successfully" is specifically about the MAIN
      // photo changing — only fires here when the replaced photo was the
      // current main. No Undo: unlike delete, there's no deferred-call trick
      // available (the old photo's file is already gone), so a real revert
      // isn't possible.
      if (replacing?.MAINPHOTO == 1) {
        setToastRequest({ message: t('EDITPROFILE.PHOTO_UPDATED_TOAST', 'Profile photo updated successfully'), key: Date.now() })
      }
    } catch {
      Alert.alert('Error', 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function openFilePicker() {
    replacingPhotoRef.current = null
    inputRef.current?.click()
  }

  function openReplacePicker(photo: Photo) {
    replacingPhotoRef.current = photo
    inputRef.current?.click()
  }

  function confirmDelete(photo: Photo) {
    setDeleteTarget(photo)
  }

  // ── Photo viewer modal actions — mirrors confirmDelete/setMainPhoto, but
  // closes the modal afterward instead of leaving it open against a
  // possibly-reordered `photos` array (deleting/setting-main/replacing all
  // change array order or length, so re-syncing the modal's own index would
  // just be extra risk for no real benefit — reopening is one click). ──

  function handleViewerDelete(photo: ViewerPhoto) {
    setPhotoViewerIndex(null)
    const target = photos.find(p => p.PHOTOID === photo.PHOTOID)
    if (target) setDeleteTarget(target)
  }

  // Real Angular copy/flow (modalpopup.component.html's `deletePhoto` action,
  // see DeletePhotoConfirmModal.tsx's header comment) — single destructive
  // "Delete" CTA, no separate Cancel button. The confirm modal closes right
  // away; the actual deletePicture/v1 call is deferred (see
  // DELETE_UNDO_WINDOW_MS) so the toast's "Undo" can genuinely cancel it
  // instead of being decorative.
  function handleConfirmDeletePhoto() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)

    // Any earlier deferred delete that's still pending gets flushed for
    // real right away — only one "undo window" is tracked at a time, so
    // starting a second one without resolving the first would leak it.
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timer)
      const prev = pendingDeleteRef.current
      pendingDeleteRef.current = null
      deletePhoto(prev.photo.PHOTOID).then(() => loadPhotos())
    }

    const removedIndex = Math.max(0, photos.findIndex(p => p.PHOTOID === target.PHOTOID))
    setPhotos(prev => prev.filter(p => p.PHOTOID !== target.PHOTOID))

    const timer = setTimeout(() => {
      pendingDeleteRef.current = null
      deletePhoto(target.PHOTOID).then(() => loadPhotos())
    }, DELETE_UNDO_WINDOW_MS)
    pendingDeleteRef.current = { photo: target, index: removedIndex, timer }

    setToastRequest({
      message: t('EDITPROFILE.PHOTO_DELETED_TOAST', 'Photo deleted successfully'),
      key: Date.now(),
      duration: DELETE_UNDO_WINDOW_MS,
      onUndo: () => {
        const pending = pendingDeleteRef.current
        if (!pending) return
        clearTimeout(pending.timer)
        pendingDeleteRef.current = null
        setPhotos(prev => {
          const next = [...prev]
          next.splice(Math.min(pending.index, next.length), 0, pending.photo)
          return next
        })
      },
    })
  }

  async function handleViewerSetMain(photo: ViewerPhoto) {
    setPhotoViewerIndex(null)
    const previousMain = photos[0]
    const res = await setMainPhoto(photo.PHOTOID)
    if (res?.RESPONSECODE == 1) {
      await loadPhotos()
      setToastRequest({
        message: t('EDITPROFILE.PHOTO_UPDATED_TOAST', 'Profile photo updated successfully'),
        key: Date.now(),
        onUndo: previousMain ? () => {
          setMainPhoto(previousMain.PHOTOID).then(() => loadPhotos())
        } : undefined,
      })
    }
  }

  function handleViewerReplace(photo: ViewerPhoto) {
    setPhotoViewerIndex(null)
    const target = photos.find(p => p.PHOTOID === photo.PHOTOID)
    if (target) openReplacePicker(target)
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
    if (incomeEditable && income && income.key !== original.income) {
      changes.push({ field: 'INCOME', value: income.key, existingValue: original.income })
    }
    if (religionEditable && religion && religion.key !== original.religion) {
      changes.push({ field: 'RELIGION', value: religion.key, existingValue: original.religion })
    }
    if (casteEditable && caste && caste.key !== original.caste) {
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
    if (maritalStatus && maritalStatus.key !== original.maritalStatus) {
      changes.push({ field: 'MARITALSTATUS', value: maritalStatus.key, existingValue: original.maritalStatus })
    }
    const showChildren = !!maritalStatus && maritalStatus.key !== '1'
    if (showChildren) {
      if (noOfChildren && noOfChildren.key !== original.noOfChildren) {
        changes.push({ field: 'NOOFCHILDREN', value: noOfChildren.key, existingValue: original.noOfChildren })
      }
    } else if (original.noOfChildren) {
      changes.push({ field: 'NOOFCHILDREN', value: '', existingValue: original.noOfChildren })
    }
    if (physicalStatus && physicalStatus.key !== original.physicalStatus) {
      changes.push({ field: 'PHYSICALSTATUS', value: physicalStatus.key, existingValue: original.physicalStatus })
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
      case 3: openMembershipTab(); break
      case 4: navigation.navigate('MessagerList'); break
    }
  }

  const missingHoroscope = !horoscopeAvailable

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
        // `display: 'none'` looks equivalent but isn't — Safari (and older
        // WebKit generally) silently refuses to honor a programmatic
        // .click() on a file input that's display:none, so openFilePicker()/
        // openReplacePicker() would appear to do nothing there (works fine
        // in Chrome/Chromium, which is why this wasn't caught by testing).
        // Keeping it in the layout as a 1×1 fully transparent element instead
        // of removing it from rendering satisfies that check in every browser.
        <input
          ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
        />
      )}

      <View style={s.main}>
        <Text style={s.pageTitle}>{t('EDITPROFILE.EDIT_PROFILE')}</Text>

        {/* ── Photos ── */}
        <View style={s.card}>
          <View style={s.photoHeaderRow}>
            <Text style={s.sectionTitle}>{t('EDITPROFILE.PHOTOS')}</Text>
            <Pressable
              onPress={() => (photos.length > 0 ? setPhotoPrivacyVisible(true) : openFilePicker())}
              hitSlop={8}
            >
              <Text style={s.link}>{t('EDITPROFILE.PHOTO_PRIVACY')}</Text>
            </Pressable>
          </View>

          <View style={s.photoRow}>
            {photos.length > 0 ? (
              <Pressable style={s.primaryTile} onPress={() => setPhotoViewerIndex(0)}>
                <Image source={{ uri: photos[0].PHOTOURL || photos[0].PHOTOTHUMB || '' }} style={s.primaryTileImg} contentFit="cover" />
                <View style={s.primaryLabel}>
                  <Text style={s.primaryLabelText}>{t('EDITPROFILE.PROFILE_PICTURE', 'Profile picture')}</Text>
                </View>
              </Pressable>
            ) : (
              <Pressable style={s.primaryTileEmpty} onPress={openFilePicker}>
                {uploading
                  ? <ActivityIndicator color={Colors.textSecondary} />
                  : <Image source={{ uri: PLACEHOLDER }} style={{ width: 40, height: 40 }} contentFit="contain" />}
              </Pressable>
            )}

            {photos.length > 0 && (
              <View style={s.smallGrid}>
                {photos.slice(1).map((p, i) => (
                  <View key={p.PHOTOID} style={s.smallTile}>
                    <Pressable style={s.smallTilePress} onPress={() => setPhotoViewerIndex(i + 1)}>
                      <Image source={{ uri: p.PHOTOURL || p.PHOTOTHUMB || '' }} style={s.smallTileImg} contentFit="cover" />
                    </Pressable>
                    <Pressable style={s.smallDeleteBtn} onPress={() => confirmDelete(p)} hitSlop={4}>
                      <CdnSvg uri={DELETE_ICON} width={24} height={24} />
                    </Pressable>
                  </View>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <Pressable style={s.smallAddTile} onPress={openFilePicker}>
                    {uploading
                      ? <ActivityIndicator color={Colors.textSecondary} />
                      : <CdnSvg uri={ADD_ICON} width={24} height={24} />}
                  </Pressable>
                )}
              </View>
            )}
          </View>
          <Text style={photos.length === 0 ? s.photoHintEmpty : s.photoHint}>
            {photos.length === 0 ? t('EDITPROFILE.ADDYOURPHOTO', 'Add your photos') : t('EDITPROFILE.DRAG_PHOTO')}
          </Text>
          <Pressable onPress={() => Alert.alert('Photo guidelines', 'Use clear, recent photos with good lighting.')}>
            <Text style={s.guidelines}>ⓘ Check out our photo tips</Text>
          </Pressable>
        </View>

        {/* ── Basic details ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>{t('EDITPROFILE.BASIC_DETAILS')}</Text>
          <View style={s.grid}>
            <View style={[s.cell, rowZ(0)]}>
              <DesktopSelectField label={t('EDITPROFILE.JODIIID')} options={jodiiId ? [{ key: '_', label: jodiiId }] : []} selectedKey={jodiiId ? '_' : null} onSelect={() => {}} disabled />
            </View>
            <View style={[s.cell, rowZ(0)]}>
              <DesktopSelectField label={t('EDITPROFILE.CREATEDFOR', 'Profile created by')} options={createdByLabel ? [{ key: '_', label: createdByLabel }] : []} selectedKey={createdByLabel ? '_' : null} onSelect={() => {}} disabled />
            </View>
            <View style={[s.cell, rowZ(1)]}>
              <DesktopSelectField label={t('EDITPROFILE.AGE')} options={ageDisplay ? [{ key: '_', label: ageDisplay }] : []} selectedKey={ageDisplay ? '_' : null} onSelect={() => {}} disabled />
            </View>
            <View style={[s.cell, rowZ(1)]}>
              <DesktopSelectField label={t('EDITPROFILE.HEIGHT')} options={heightDisplay ? [{ key: '_', label: heightDisplay }] : []} selectedKey={heightDisplay ? '_' : null} onSelect={() => {}} disabled />
            </View>
            <View style={[s.cell, rowZ(2)]}>
              <DesktopSelectField
                label={t('EDITPROFILE.MOTHERTONGUE')} options={motherTongueOptions} selectedKey={motherTongue?.key ?? null}
                onSelect={setMotherTongue} disabled={!motherTongueEditable}
              />
            </View>
            <View style={[s.cell, rowZ(2)]}>
              <DesktopSelectField label={t('EDITPROFILE.MOBILENO')} options={mobileNo ? [{ key: '_', label: mobileNo }] : []} selectedKey={mobileNo ? '_' : null} onSelect={() => {}} disabled />
            </View>
            <View style={[s.cell, rowZ(3)]}>
              <DesktopSelectField label={t('EDITPROFILE.CURRENT_LOCATION')} options={stateOptions} selectedKey={state?.key ?? null} onSelect={handleSelectState} />
            </View>
            <View style={[s.cell, rowZ(3)]}>
              <DesktopSelectField
                label="City" options={cityOptions} selectedKey={city?.key ?? null} onSelect={setCity}
                disabled={!state} {...(state ? {} : { placeholder: 'Select state first' })}
              />
            </View>
            <View style={[s.cell, rowZ(4)]}>
              <DesktopSelectField label={t('EDITPROFILE.NATIVE_PLACE')} options={stateOptions} selectedKey={homeState?.key ?? null} onSelect={handleSelectHomeState} />
            </View>
            <View style={[s.cell, rowZ(4)]}>
              <DesktopSelectField
                label="Hometown city" options={homeCityOptions} selectedKey={homeCity?.key ?? null} onSelect={setHomeCity}
                disabled={!homeState} {...(homeState ? {} : { placeholder: 'Select state first' })}
              />
            </View>
            <View style={[s.cell, rowZ(5)]}>
              <DesktopSelectField label={t('EDITPROFILE.MARITALSTATUS')} options={maritalStatusOptions} selectedKey={maritalStatus?.key ?? null} onSelect={setMaritalStatus} />
            </View>
            {!!maritalStatus && maritalStatus.key !== '1' && (
              <View style={[s.cell, rowZ(5)]}>
                <DesktopSelectField label={t('EDITPROFILE.CHILDREN')} options={CHILDREN_OPTIONS} selectedKey={noOfChildren?.key ?? null} onSelect={setNoOfChildren} />
              </View>
            )}
            <View style={[s.cell, rowZ(6)]}>
              <DesktopSelectField label={t('EDITPROFILE.PHYSICALSTATUS')} options={physicalStatusOptions} selectedKey={physicalStatus?.key ?? null} onSelect={setPhysicalStatus} />
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
              <DesktopSelectField label={t('EDITPROFILE.INCOME')} options={incomeOptions} selectedKey={income?.key ?? null} onSelect={setIncome} disabled={!incomeEditable} />
            </View>
          </View>
        </View>

        {/* ── Religious details ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>{t('EDITPROFILE.RELIGIOUSDETAIL')}</Text>
          <View style={s.grid}>
            <View style={[s.cell, rowZ(0)]}>
              <DesktopSelectField label={t('EDITPROFILE.RELIGION')} options={religionOptions} selectedKey={religion?.key ?? null} onSelect={handleSelectReligion} disabled={!religionEditable} />
            </View>
            <View style={[s.cell, rowZ(0)]}>
              <DesktopSelectField label={t('EDITPROFILE.CASTESUB')} options={casteOptions} selectedKey={caste?.key ?? null} onSelect={setCaste} disabled={!casteEditable} />
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
                <Pressable style={s.missingBox} onPress={() => navigation.navigate('EditProfileHoroscope')}>
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

      <PhotoPrivacyDesktopModal
        visible={photoPrivacyVisible}
        onClose={() => setPhotoPrivacyVisible(false)}
      />

      <PhotoViewerModal
        visible={photoViewerIndex !== null}
        photos={photos}
        initialIndex={photoViewerIndex ?? 0}
        uploading={uploading}
        onClose={() => setPhotoViewerIndex(null)}
        onDelete={handleViewerDelete}
        onSetMain={handleViewerSetMain}
        onReplace={handleViewerReplace}
      />

      <DeletePhotoConfirmModal
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeletePhoto}
      />

      <Toast request={toastRequest} />
    </DesktopPageShell>
  )
}

// main(700) minus card's 20px padding on each side leaves 660px of content
// width; two columns + the grid's 20px gap must fit inside that — 320*2+20=660.
// (Was 338, which needed 696 and forced flexWrap to drop every field to its
// own row — the exact single-column bug this fixes.)
const CELL_W = 320

const s = StyleSheet.create({
  main: { width: 700, paddingBottom: 24 },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  pageTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 22, color: Colors.textDark, marginBottom: 16 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: 20, marginBottom: 16,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 5,
    elevation: 3,
  },
  sectionTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 20, color: Colors.textDark, marginBottom: 16 },
  link: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.link, textDecorationLine: 'underline' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  cell: { width: CELL_W },

  photoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },

  // Figma node 642:2780: a 204×204 primary tile (left) beside a wrapping
  // grid of 98×98 tiles (right) — two distinct regions, not one uniform
  // flex-wrap row (that previously made the primary tile shrink to 100×100
  // and lose its own layout the moment a photo existed).
  photoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },

  primaryTile: {
    width: 204, height: 204, borderRadius: 8, overflow: 'hidden', position: 'relative',
    borderWidth: 2, borderColor: Colors.primaryDark, backgroundColor: Colors.surfaceInput,
  },
  primaryTileImg: { width: '100%', height: '100%' },
  // Figma: bg #b50033, 100×22, rounded bottom-left 8 / top-right 16, flush
  // to the tile's bottom-left corner (no outer margin).
  primaryLabel: {
    position: 'absolute', left: 0, bottom: 0, minWidth: 100, height: 22,
    backgroundColor: Colors.primaryDark, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 8, borderBottomLeftRadius: 8, borderTopRightRadius: 16,
  },
  primaryLabelText: { fontFamily: 'Poppins-Medium', fontSize: 12, color: '#fffefe', letterSpacing: 0.12 },
  // Empty state — Figma's main upload slot uses the same "needs attention"
  // pink as the hint text below it, distinct from the neutral grey used
  // once at least one photo already exists.
  primaryTileEmpty: {
    width: 204, height: 204, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.inputError,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceInput,
  },

  // Figma: 16px column gap / 9px row gap — deliberately different values,
  // not a copy-paste of one into the other.
  smallGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 440, columnGap: 16, rowGap: 9 },
  smallTile: {
    width: 98, height: 98, borderRadius: 8, overflow: 'hidden', position: 'relative',
    backgroundColor: Colors.surfaceInput,
  },
  smallTilePress: { flex: 1 },
  smallTileImg: { width: '100%', height: '100%' },
  // Figma: the trash-2 icon asset already bakes in its own white
  // rounded-square backdrop — no extra wrapper needed. Bottom-right corner,
  // 8px inset (66,66 within a 98×98 tile for a 24×24 icon).
  smallDeleteBtn: { position: 'absolute', bottom: 8, right: 8 },
  smallAddTile: {
    width: 98, height: 98, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderSubtle,
    backgroundColor: 'rgba(230,230,230,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  photoHint: { fontSize: 12, color: Colors.link, marginTop: 8 },
  photoHintEmpty: { fontSize: 12, color: Colors.inputError, marginTop: 8 },
  guidelines: { fontSize: 12, color: Colors.textSecondary, textDecorationLine: 'underline', marginTop: 8 },

  missingBox: {
    height: 56, borderWidth: 1, borderColor: Colors.inputError, borderRadius: 8,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  missingBoxText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.textDark },
  missingBoxBang: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.inputError, color: Colors.white,
    fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 18, overflow: 'hidden',
  },
  missingHint: { fontSize: 12, color: Colors.link, marginTop: 6 },

  saveBtn: { alignSelf: 'center', width: 312, marginTop: 8 },
})
