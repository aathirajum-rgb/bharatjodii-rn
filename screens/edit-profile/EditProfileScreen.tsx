// Angular equivalent: pages/edit-profile/edit-profile.page.ts + .html — a pure
// read-only summary/list page. Nothing is edited inline here; every row exists
// to show the current value and navigate somewhere else. This port follows the
// new Figma design's 3-level flow (see node 2192-9135): this hub screen →
// a per-section "group screen" (Basic/Professional/Religious/etc., each with
// its own Submit) → a picker reusing onboarding's SearchablePicker/
// MultiSelectPicker components.
//
// Photo management is fully embedded on this screen: adding opens the
// gallery picker directly (CustomGalleryScreen as a modal, or a hidden file
// input on web — see openGalleryPicker), and tapping an existing photo opens
// PhotoAlbumViewerMobile (the swipeable view/delete/set-main/replace flow,
// ported from Angular's managephoto.page.ts `showAlbum` state) — no
// navigation to the onboarding wizard's own routes for either case.
//
// Jodii ID / Profile created by / Mobile number are display-only, no
// navigation — matches Angular exactly (Profile created by's click handler is
// commented out there too; Jodii ID and Mobile number never had one).
//
// Every row resolves its stored code to a label through one of
// registrationService's option fetchers, all of which read the cached
// registrationform/v1 bootstrap response. Verified against a live staging
// response that each list is actually present there (DRINKINGHABITS,
// SMOKINGHABITS, EATINGHABITS, BOTHER, SISTER, ASSETS, ...) — so an unresolved
// row means the member genuinely hasn't set the field, not a failed lookup.
// That matters because FieldRow now turns any empty editable row into the
// "Add details" + warning-triangle state.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { Endpoints } from '../../service/api.endpoints'
import { uploadFile } from '../../service/apiClient'
import { managePhotos } from '../../service/profileService'
import { getOwnGenderAvatarUrl } from '../../utils/avatar'
import { fetchEditProfileInfo, type EditProfileInfo } from '../../service/editProfileService'
import CustomGalleryScreen from '../onboarding/CustomGalleryScreen'
import PhotoAlbumViewerMobile from '../../components/edit-profile/PhotoAlbumViewerMobile'
import {
  CHILDREN_OPTIONS,
  fetchReligionOptions, fetchCasteOptions, fetchOccupationOptions,
  fetchQualificationOptions, fetchMotherTongueOptions,
  fetchEatingHabitOptions, fetchDrinkingHabitOptions, fetchSmokingHabitOptions, fetchRaasiOptions,
  fetchStarOptions, fetchMonthlyIncomeOptions, fetchPropertyOptions,
  fetchStates, fetchCities, fetchHeightCategoryOptions,
  fetchMaritalStatusOptions, fetchPhysicalStatusOptions, fetchProfileCreatedByOptions,
  fetchFamilyOptions, isHomeTownMotherTongue,
} from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import PhotoPrivacySheet from '../../components/photo-privacy/PhotoPrivacySheet'
import FieldRestrictedSheet from '../../components/edit-profile/FieldRestrictedSheet'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import EditProfileDesktopScreen from './EditProfileDesktopScreen'

const ICON_BACK  = CDN_REACT + '/menu_back_arrow.svg'
const ICON_ARROW = CDN_REACT + '/menu_right_arrow.svg'

// Missing-field warning triangle, shown at the right edge of any row whose
// value isn't set yet (Figma) — it replaces the grey chevron rather than
// sitting next to it. Drawn at its own 18x17 intrinsic size: the asset is not
// square, so forcing it into a square box would letterbox it smaller than the
// design and leave uneven padding on one axis.
// Leading icon on the "Photo privacy" link (Figma node 3366:13117 — a 32px
// icon box, gap 4, then the underlined label).
const ICON_PRIVACY = CDN_REACT + '/edit_privacy.svg'
const PRIVACY_ICON_SIZE = 32

const ICON_MISS_WARN = CDN_REACT + '/edit_miss_warn.svg'
const MISS_WARN_W = 18
const MISS_WARN_H = 17
// The chevron that trails the "Add details" link text itself. Figma's Link CTA
// uses the same 16px Icon-Backarrow as the row's own trailing chevron, not a
// smaller one.
const MISSING_CHEVRON = 16

// Per-field leading icons (Figma node 2192-9135), served from the same
// CDN_REACT folder as the nav chevrons. File names are the ones uploaded to the
// server, verified reachable on the staging CDN.
//
// SIX ROWS HAVE NO ICON YET — Jodii ID, Profile created by, Marital status,
// Children, Physical status and Mobile number. Nothing matching them exists in
// the react/ folder (probed every plausible name), so those rows render an
// empty icon slot: the space is still reserved via ROW_ICON so every label in
// the section stays on the same left edge instead of some rows jumping inward.
// Drop the files in and add them here — no other change needed.
//
// Not mapped: edit_vehicle.svg. This screen has exactly one "Properties owned"
// row and property codes 5/6/7 (the vehicle ones) are deliberately excluded
// from it — see the file header and splitProperties() in editProfileService.ts.
// There's no "Own Vehicle" row to hang it on; if the Figma has one, that's a
// separate change (the data is already parsed as `profile.vehicles`).
const ROW_ICON = 24
const R_ICON = {
  name:           CDN_REACT + '/edit_name.svg',
  age:            CDN_REACT + '/edit_age.svg',
  height:         CDN_REACT + '/edit_height.svg',
  motherTongue:   CDN_REACT + '/edit_mothertongue.svg',
  location:       CDN_REACT + '/edit_location.svg',
  hometown:       CDN_REACT + '/edit_hometown.svg',
  education:      CDN_REACT + '/edit_education.svg',
  occupation:     CDN_REACT + '/edit_occupation.svg',
  income:         CDN_REACT + '/edit_monthlyincome.svg',
  religion:       CDN_REACT + '/edit_religion.svg',
  caste:          CDN_REACT + '/edit_caste.svg',
  raasi:          CDN_REACT + '/edit_raasi.svg',
  star:           CDN_REACT + '/edit_star.svg',
  dosham:         CDN_REACT + '/edit_dosham.svg',
  horoscope:      CDN_REACT + '/edit_horoscope.svg',
  drinking:       CDN_REACT + '/edit_drinking_habits.svg',
  smoking:        CDN_REACT + '/edit_smoking.svg',
  eating:         CDN_REACT + '/edit_eating_habits.svg',
  brothers:       CDN_REACT + '/edit_brother.svg',
  sisters:        CDN_REACT + '/edit_sister.svg',
  properties:     CDN_REACT + '/edit_property_owned.svg',
} as const

// Photo mosaic (Figma node 2192-9135) — 1 large tile (spans 2x2 of the small-
// tile grid) + 5 small tiles: two stacked to its right, three in a row below.
// Matches Angular's 6-slot photo grid exactly (slot 0 = main/profile photo).
// The grid is RESPONSIVE: tile size is derived from the viewport, not fixed.
// The design's 98px tile only fills the row on a 360pt-wide frame — hardcoding
// it overflowed the 24pt content inset on a 320pt phone (312 of grid into 272
// of space) and left dead space on a 390-430pt one.
//
// The gap stays fixed at 9. Spacing is not something that should scale with
// the screen, and 9 is what the design's own numbers require: 360 - 48 inset
// = 312 of content, 3 tiles of 98 = 294, leaving 18 for two gaps.
const MOSAIC_GAP = 9
// Ceiling so a tablet or a sub-1024 browser window (both of which still get
// this mobile layout — see useIsDesktopWeb) doesn't produce absurd tiles: at
// 1023pt wide an uncapped tile would be ~319pt. 130 is above what any phone
// needs (it only binds past ~456pt of viewport, and the widest phones are
// ~430), so every real handset still fills edge to edge and only genuine
// tablets clamp — where the grid then sits left-aligned with the rows.
const MOSAIC_TILE_MAX = 130
const PHOTO_GRID_SLOTS = 6

// Horizontal content inset. Shared with scrollContent's paddingHorizontal so
// the two can't drift — the mosaic width is computed from it.
const CONTENT_PAD = 24

type MosaicMetrics = {
  tile:   number  // small tile edge
  main:   number  // main tile edge — spans 2 tile columns + 1 gap
  size:   number  // overall grid edge (3 columns)
  second: number  // offset of the 2nd track
  third:  number  // offset of the 3rd track
}

function mosaicMetrics(viewportWidth: number): MosaicMetrics {
  const available = Math.max(0, viewportWidth - CONTENT_PAD * 2)
  const tile   = Math.min(MOSAIC_TILE_MAX, (available - MOSAIC_GAP * 2) / 3)
  const main   = tile * 2 + MOSAIC_GAP
  const second = tile + MOSAIC_GAP
  const third  = main + MOSAIC_GAP
  return { tile, main, size: third + tile, second, third }
}

function photoSlotPosition(i: number, m: MosaicMetrics): { left: number; top: number } {
  if (i === 0) return { left: 0, top: 0 }
  if (i === 1) return { left: m.third,  top: 0 }
  if (i === 2) return { left: m.third,  top: m.second }
  if (i === 3) return { left: 0,        top: m.third }
  if (i === 4) return { left: m.second, top: m.third }
  return { left: m.third, top: m.third }
}

type Props = { navigation: any }

type Opt = { key: string; label: string }

function labelFor(list: Opt[], code: string | undefined): string | undefined {
  if (!code) return undefined
  return list.find(o => o.key === code)?.label
}

function labelsFor(list: Opt[], codes: string[] | undefined): string | undefined {
  if (!codes || codes.length === 0) return undefined
  const labels = codes.map(c => labelFor(list, c)).filter(Boolean) as string[]
  return labels.length > 0 ? labels.join(', ') : undefined
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function FieldRow({
  label, value, missingText, onPress, showDivider, hideArrow, icon,
}: {
  label: string
  value?: string | undefined
  missingText?: string | undefined
  onPress: () => void
  showDivider?: boolean | undefined
  // Display-only rows (Jodii ID, Profile created by, Mobile number — none of
  // which Angular makes editable either) — no chevron, so the row doesn't
  // look like a dead tap target. Also opts the row out of the missing-value
  // treatment below: a row you can't open must not invite you to fill it in.
  hideArrow?: boolean | undefined
  // Leading field icon (see R_ICON). Omitted for the six rows whose icon isn't
  // on the CDN yet — the slot is still laid out so labels stay aligned.
  icon?: string | undefined
}) {
  const { t } = useTranslation()

  // ANY editable row with no value is a "missing" row — the Add-details link
  // plus the warning triangle. This used to key off `!!missingText`, so only
  // the 7 rows that happened to pass one got the treatment and the other 21
  // (drinking, smoking, sisters, properties, …) silently fell through to a
  // bare "—" placeholder, which appears nowhere in the design.
  //
  // `missingText` is now only for rows whose copy differs from the generic
  // "Add details" — the per-field strings Angular already ships.
  const isMissing = !value && !hideArrow
  const missingLabel = missingText ?? t('EDITPROFILE.ADD_DETAILS_TXT')
  return (
    <>
      <Pressable style={({ pressed }) => [r.row, pressed && r.rowPressed]} onPress={onPress} accessibilityRole="button">
        <View style={r.rowIcon}>
          {!!icon && <CdnSvg uri={icon} width={ROW_ICON} height={ROW_ICON} />}
        </View>
        <View style={r.rowText}>
          <Text style={r.rowLabel}>{label}</Text>
          {isMissing ? (
            // Figma: the link text carries its own small trailing chevron, and
            // the red warning triangle takes over the row's right edge (see
            // below) — so no leading red "!" badge here any more.
            <View style={r.missingRow}>
              <Text style={r.missingText}>{missingLabel}</Text>
              <CdnSvg uri={ICON_ARROW} width={MISSING_CHEVRON} height={MISSING_CHEVRON} />
            </View>
          ) : (
            <Text style={r.rowValue} numberOfLines={2}>{value ?? '—'}</Text>
          )}
        </View>
        {/* Right edge: the warning triangle REPLACES the grey chevron while a
            field is missing (Figma) — a missing row never shows both. */}
        {isMissing
          ? <CdnSvg uri={ICON_MISS_WARN} width={MISS_WARN_W} height={MISS_WARN_H} />
          : !hideArrow && <CdnSvg uri={ICON_ARROW} width={16} height={16} />}
      </Pressable>
      {showDivider && <View style={r.rowDivider} />}
    </>
  )
}

// Figma's rows are an auto-layout list where the FIRST row has bottom padding
// only and the LAST row has top padding only — every row in between gets both.
// That's what makes the Basic details block measure exactly 312x440 in Figma
// (60 + 80x4 + 60).
//
// Rather than thread first/last flags through ~28 call sites, every row keeps a
// uniform paddingVertical: 20 and the list cancels the two outer ones with a
// -20 margin. Net effect is identical and the rows stay interchangeable.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionRows}>{children}</View>
    </View>
  )
}

// ─── EditProfileScreen ────────────────────────────────────────────────────────

export default function EditProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const isDesktop = useIsDesktopWeb()
  // Photo grid geometry, recomputed whenever the viewport changes — rotation on
  // native, window resize on mobile web. useWindowDimensions rather than an
  // onLayout measurement so the grid is correctly sized on its very first
  // paint instead of flashing at zero width and then snapping into place.
  const { width: windowWidth } = useWindowDimensions()
  const mosaic = mosaicMetrics(windowWidth)

  const [loading, setLoading]   = useState(true)
  const [profile, setProfile]   = useState<EditProfileInfo | null>(null)
  const [photos,  setPhotos]    = useState<any[]>([])
  const [labels,  setLabels]    = useState<Record<string, Opt[]>>({})
  const [ownId,   setOwnId]     = useState('')
  const [createdByLabel, setCreatedByLabel] = useState<string | undefined>(undefined)
  // Angular: edit-profile.page.html's `homePlaceDomain.includes(MOTHERTONGUE)`
  // guard around the Home Town row. Only a handful of mother tongues are asked
  // for a separate native place at all — for everyone else the field must not
  // exist, not merely sit empty (an empty row would now render as an
  // "Add details" prompt for something we never ask about).
  const [homeTownVisible, setHomeTownVisible] = useState(false)
  const [photoPrivacyVisible, setPhotoPrivacyVisible] = useState(false)
  // Angular: edit-profile.page.ts's restrictPopup() — the "this field cannot
  // be changed" popup, opened from showDisableToast() when a one-time-editable
  // field has already been used up. See `restrictedNav` below.
  const [fieldRestrictedVisible, setFieldRestrictedVisible] = useState(false)
  const [galleryVisible, setGalleryVisible] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [genderAvatarUrl, setGenderAvatarUrl] = useState('')
  // Photo failed to load (broken URL / still processing) — fall back to the
  // gender avatar instead of a blank tile, same as an empty slot.
  const [failedPhotos, setFailedPhotos] = useState<Set<number>>(new Set())

  useEffect(() => {
    getOwnGenderAvatarUrl().then(setGenderAvatarUrl)
  }, [])
  const [webUploading, setWebUploading] = useState(false)
  // Web only — see EditProfileDesktopScreen.tsx for the same pattern. Browsers
  // only allow a file picker to open from a direct, synchronous user click, so
  // there's no "landing screen" step to skip on web: this hidden input IS the
  // picker, triggered straight from the Pressable's own onPress.
  const webFileInputRef = useRef<HTMLInputElement | null>(null)

  async function handleWebFiles(e: any) {
    const files: File[] = Array.from(e.target.files ?? [])
    if (!files.length) return
    setWebUploading(true)
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
      await load()
    } catch {
      Alert.alert('Error', 'Upload failed. Please try again.')
    } finally {
      setWebUploading(false)
      if (webFileInputRef.current) webFileInputRef.current.value = ''
    }
  }

  const load = useCallback(async () => {
    const [id, info, photoData] = await Promise.all([
      getItem(SK.Auth.USER_ID),
      fetchEditProfileInfo(),
      managePhotos(),
    ])
    setOwnId(id ?? '')
    setProfile(info)
    setPhotos(photoData.photos)
    if (__DEV__) console.log('[EditProfile] managePhotos() returned:', JSON.stringify(photoData))

    if (!info) { setLoading(false); return }

    const gender = info.gender ?? (await getItem(SK.User.LOGIN_GENDER)) ?? '1'

    const [
      religion, occupation, education, motherTongue,
      eatingHabit, drinkingHabit, smokingHabit, raasi, income, property, states,
      heightCategory, maritalStatus, physicalStatus, createdByList, familyOptions,
    ] = await Promise.all([
      fetchReligionOptions(),
      fetchOccupationOptions(),
      fetchQualificationOptions(),
      fetchMotherTongueOptions(),
      fetchEatingHabitOptions(),
      fetchDrinkingHabitOptions(),
      fetchSmokingHabitOptions(),
      fetchRaasiOptions(),
      fetchMonthlyIncomeOptions(),
      fetchPropertyOptions(),
      fetchStates(),
      fetchHeightCategoryOptions(gender),
      fetchMaritalStatusOptions(gender),
      fetchPhysicalStatusOptions(),
      fetchProfileCreatedByOptions(),
      fetchFamilyOptions(),
    ])

    const [caste, star, cities, homeCities] = await Promise.all([
      info.religion ? fetchCasteOptions(info.religion, info.motherTongue ?? '') : Promise.resolve([]),
      info.raasi ? fetchStarOptions(info.raasi) : Promise.resolve([]),
      info.state ? fetchCities(info.state) : Promise.resolve([]),
      info.homeState ? fetchCities(info.homeState) : Promise.resolve([]),
    ])

    setLabels({
      religion, occupation, education, motherTongue,
      eatingHabit, drinkingHabit, smokingHabit, raasi, income, property, states,
      caste, star, cities, homeCities,
      heightCategory, maritalStatus, physicalStatus,
      brothers: familyOptions.brothers, sisters: familyOptions.sisters,
    })
    setCreatedByLabel(createdByList.find(o => o.key === info.createdBy)?.label)
    setHomeTownVisible(await isHomeTownMotherTongue(info.motherTongue ?? ''))
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  // Opens the photo picker directly — no navigation to the onboarding
  // wizard's own routes, so there's nothing to "come back from". On web this
  // has to be the file input's own .click() call, right here, so it stays a
  // trusted user gesture; on native it opens the embedded gallery modal.
  function openGalleryPicker() {
    if (Platform.OS === 'web') {
      webFileInputRef.current?.click()
    } else {
      setGalleryVisible(true)
    }
  }

  function openPreview() {
    navigation.navigate('viewProfile', { matriId: ownId, fromPage: 'menu' })
  }

  // Angular's edit-profile.page.html pattern for the seven one-time-editable
  // fields: `(xEditEnable) ? goToEditScreen(n) : showDisableToast('x')`. The
  // row stays tappable either way — the lock only changes what the tap does,
  // so the member gets told why instead of finding a dead row.
  function restrictedNav(editable: boolean, route: string) {
    return () => {
      if (editable) navigation.navigate(route)
      else setFieldRestrictedVisible(true)
    }
  }

  if (isDesktop) {
    return <EditProfileDesktopScreen navigation={navigation} />
  }

  if (loading || !profile) {
    return (
      <View style={[s.screen, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
      </View>
    )
  }

  const cityLabel     = labelFor(labels.cities ?? [], profile.city) ?? labelFor(labels.states ?? [], profile.state)
  const homeCityLabel = labelFor(labels.homeCities ?? [], profile.homeCity) ?? labelFor(labels.states ?? [], profile.homeState)
  // Angular's edit-profile.page.html has exactly one "Properties owned" row —
  // codes '5'/'6'/'7' are explicitly excluded from it (comment: "remove
  // vehicle related changes"), never shown as their own "Own Vehicle" row —
  // see PropertyDetailsScreen.tsx's header comment for the full story.
  const propertiesLabel = labelsFor(labels.property ?? [], profile.properties)

  // Angular: HEIGHTCATEGORY in 101-104 shows the bucket label; otherwise the
  // exact height (VIEWHEIGHT) is shown as-is. Category labels carry raw HTML
  // from the API (same quirk HeightScreen.tsx strips) — strip it here too.
  const heightCategoryLabel = profile.heightCategory
    ? labelFor(labels.heightCategory ?? [], profile.heightCategory)?.replace(/<[^>]+>/g, '').trim()
    : undefined
  const heightLabel = heightCategoryLabel ?? profile.height
  const childrenVisible = !!profile.maritalStatus && profile.maritalStatus !== '1'

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('EDITPROFILE.EDIT_PROFILE')}</Text>
      </View>

      <ScrollView contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>

        {/* ── Photo ── */}
        <View style={s.photoHeaderRow}>
          <Text style={s.sectionTitle}>{t('EDITPROFILE.PHOTOS')}</Text>
          <Pressable
            style={s.photoPrivacyBtn}
            onPress={() => (photos.length > 0 ? setPhotoPrivacyVisible(true) : openGalleryPicker())}
            hitSlop={8}
          >
            <CdnSvg uri={ICON_PRIVACY} width={PRIVACY_ICON_SIZE} height={PRIVACY_ICON_SIZE} />
            <Text style={s.photoPrivacyLink}>{t('EDITPROFILE.PHOTO_PRIVACY')}</Text>
          </Pressable>
        </View>

        {/* Figma node 2192-9135: a fixed 1-large + 5-small mosaic (matches
            Angular's 6-slot photo grid), not a horizontal scroll of equal
            tiles. Main tile spans 2x2 of the small-tile grid; every empty
            slot (not just the last one) is its own add-photo trigger. */}
        <View style={[s.photoGrid, { width: mosaic.size, height: mosaic.size }]}>
          {Array.from({ length: PHOTO_GRID_SLOTS }, (_, i) => {
            const photo = photos[i]
            const pos = photoSlotPosition(i, mosaic)
            const size = i === 0 ? mosaic.main : mosaic.tile
            if (photo && !failedPhotos.has(i)) {
              return (
                <Pressable key={i} style={[s.photoTile, i === 0 && s.photoTileMain, pos, { width: size, height: size }]} onPress={() => setViewerIndex(i)}>
                  <Image
                    source={{ uri: photo.PHOTOURL || photo.PHOTOTHUMB }}
                    style={s.photoTileImg}
                    contentFit="cover"
                    onError={(e) => {
                      if (__DEV__) console.warn(`[EditProfile] photo[${i}] failed to load:`, photo.PHOTOURL || photo.PHOTOTHUMB, e.error)
                      setFailedPhotos(prev => new Set(prev).add(i))
                    }}
                  />
                  {i === 0 && (
                    <View style={s.mainPhotoBadge}>
                      <Text style={s.mainPhotoBadgeText}>{t('EDITPROFILE.PROFILE_PHOTO')}</Text>
                    </View>
                  )}
                </Pressable>
              )
            }
            // Empty slot (or a photo whose image failed to load) — same
            // gender-avatar placeholder Angular falls back to (common.ts's
            // getAvatarImg(false)), not a generic "+" icon.
            return (
              <Pressable key={i} style={[s.photoAddSlot, pos, { width: size, height: size }]} onPress={openGalleryPicker} disabled={webUploading}>
                {webUploading
                  ? <ActivityIndicator color={Colors.textTertiary} size="small" />
                  : !!genderAvatarUrl && <CdnSvg uri={genderAvatarUrl} width={size} height={size} />
                }
              </Pressable>
            )
          })}
        </View>
        <Text style={s.photoHint}>{t('EDITPROFILE.DRAG_PHOTO')}</Text>

        {/* ── Basic details ── */}
        <Section title={t('EDITPROFILE.BASIC_DETAILS')}>
          <FieldRow label={t('EDITPROFILE.JODIIID')} value={ownId} onPress={() => {}} hideArrow showDivider />
          <FieldRow label={t('EDITPROFILE.CREATEDFOR')} value={createdByLabel} onPress={() => {}} hideArrow showDivider />
          <FieldRow label={t('EDITPROFILE.NAME')} value={profile.name} onPress={restrictedNav(profile.nameEditable, 'EditProfileBasic')} icon={R_ICON.name} showDivider />
          <FieldRow label={t('EDITPROFILE.AGE')} value={profile.age ? `${profile.age} years old` : undefined} onPress={restrictedNav(profile.ageEditable, 'EditProfileAgeHeight')} icon={R_ICON.age} showDivider />
          <FieldRow label={t('EDITPROFILE.HEIGHT')} value={heightLabel} onPress={() => navigation.navigate('EditProfileAgeHeight')} icon={R_ICON.height} showDivider />
          <FieldRow
            label={t('EDITPROFILE.MARITALSTATUS')}
            value={labelFor(labels.maritalStatus ?? [], profile.maritalStatus)}
            onPress={() => navigation.navigate('EditProfileMarital')}
            showDivider
          />
          {childrenVisible && (
            <FieldRow
              label={t('EDITPROFILE.CHILDREN')}
              value={labelFor(CHILDREN_OPTIONS, profile.noOfChildren)}
              onPress={() => navigation.navigate('EditProfileMarital')}
              showDivider
            />
          )}
          <FieldRow
            label={t('EDITPROFILE.PHYSICALSTATUS')}
            value={labelFor(labels.physicalStatus ?? [], profile.physicalStatus)}
            onPress={() => navigation.navigate('EditProfileMarital')}
            showDivider
          />
          <FieldRow label={t('EDITPROFILE.MOTHERTONGUE')} value={labelFor(labels.motherTongue ?? [], profile.motherTongue)} onPress={restrictedNav(profile.motherTongueEditable, 'EditProfileBasic')} icon={R_ICON.motherTongue} showDivider />
          <FieldRow label={t('EDITPROFILE.CURRENT_LOCATION')} value={cityLabel} onPress={() => navigation.navigate('EditProfileBasic')} icon={R_ICON.location} showDivider />
          {homeTownVisible && (
            <FieldRow label={t('EDITPROFILE.NATIVE_PLACE')} value={homeCityLabel} onPress={() => navigation.navigate('EditProfileBasic')} icon={R_ICON.hometown} showDivider />
          )}
          <FieldRow label={t('EDITPROFILE.MOBILENO')} value={profile.mobileNo} onPress={() => {}} hideArrow />
        </Section>

        {/* ── Professional details ── */}
        <Section title="Professional details">
          <FieldRow label={t('EDITPROFILE.EDUCATION')} value={labelFor(labels.education ?? [], profile.education)} onPress={() => navigation.navigate('EditProfileProfessional')} icon={R_ICON.education} showDivider />
          <FieldRow label={t('EDITPROFILE.OCCUPATION')} value={labelFor(labels.occupation ?? [], profile.occupation)} onPress={() => navigation.navigate('EditProfileProfessional')} icon={R_ICON.occupation} showDivider />
          <FieldRow label={t('EDITPROFILE.INCOME')} value={labelFor(labels.income ?? [], profile.income) ?? profile.income} onPress={restrictedNav(profile.incomeEditable, 'EditProfileProfessional')} icon={R_ICON.income} />
        </Section>

        {/* ── Religious details ── */}
        <Section title={t('EDITPROFILE.RELIGIOUSDETAIL')}>
          <FieldRow label={t('EDITPROFILE.RELIGION')} value={labelFor(labels.religion ?? [], profile.religion)} onPress={restrictedNav(profile.religionEditable, 'EditProfileReligious')} icon={R_ICON.religion} showDivider />
          <FieldRow label={t('EDITPROFILE.CASTESUB')} value={labelFor(labels.caste ?? [], profile.caste)} onPress={restrictedNav(profile.casteEditable, 'EditProfileReligious')} icon={R_ICON.caste} showDivider />
          <FieldRow
            label={t('EDITPROFILE.RAASI')}
            value={labelFor(labels.raasi ?? [], profile.raasi)}
            missingText={t('EDITPROFILE.ADDYOURRAASI')}
            icon={R_ICON.raasi}
            onPress={() => navigation.navigate('EditProfileReligious')}
            showDivider
          />
          <FieldRow
            label={t('EDITPROFILE.STAR')}
            value={labelFor(labels.star ?? [], profile.star)}
            missingText={t('EDITPROFILE.ADDYOURSTAR')}
            icon={R_ICON.star}
            onPress={() => navigation.navigate('EditProfileReligious')}
            showDivider
          />
          <FieldRow
            label={t('EDITPROFILE.DOSHAM')}
            value={profile.dosham === '1' ? 'Yes' : profile.dosham === '2' ? 'No' : undefined}
            missingText={t('EDITPROFILE.ADDYOURDOSHAM')}
            icon={R_ICON.dosham}
            onPress={() => navigation.navigate('EditProfileReligious')}
            showDivider
          />
          <FieldRow
            label={t('EDITPROFILE.HOROSCOPE')}
            value={profile.horoscopeAvailable
              ? `${t('EDITPROFILE.ADDEDON')}${profile.horoInfo?.birthDay ? ` ${profile.horoInfo.birthDay}` : ''}`
              : undefined}
            icon={R_ICON.horoscope}
            onPress={() => !profile.horoscopeAvailable && navigation.navigate('EditProfileHoroscope')}
            hideArrow={!!profile.horoscopeAvailable}
          />
        </Section>

        {/* ── Life style details ── */}
        <Section title="Life style details">
          <FieldRow label={t('EDITPROFILE.DRINKING')} value={labelFor(labels.drinkingHabit ?? [], profile.drinkingHabits)} onPress={() => navigation.navigate('EditProfileLifestyle')} icon={R_ICON.drinking} showDivider />
          <FieldRow label="Smoking habits" value={labelFor(labels.smokingHabit ?? [], profile.smokingHabits)} onPress={() => navigation.navigate('EditProfileLifestyle')} icon={R_ICON.smoking} showDivider />
          <FieldRow label={t('EDITPROFILE.EATING')} value={labelFor(labels.eatingHabit ?? [], profile.eatingHabits)} onPress={() => navigation.navigate('EditProfileLifestyle')} icon={R_ICON.eating} />
        </Section>

        {/* ── Family details ── */}
        <Section title={t('EDITPROFILE.FAMILYDETAILS')}>
          <FieldRow
            label={t('EDITPROFILE.BROTHERS')}
            value={labelFor(labels.brothers ?? [], profile.brothers)}
            onPress={() => navigation.navigate('EditProfileFamily')}
            icon={R_ICON.brothers}
            showDivider
          />
          <FieldRow
            label={t('EDITPROFILE.SISTERS')}
            value={labelFor(labels.sisters ?? [], profile.sisters)}
            onPress={() => navigation.navigate('EditProfileFamily')}
            icon={R_ICON.sisters}
          />
        </Section>

        {/* ── Property details ── */}
        <Section title="Property details">
          <FieldRow label="Properties owned" value={propertiesLabel} onPress={() => navigation.navigate('EditProfileProperty')} icon={R_ICON.properties} />
        </Section>

      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={s.previewBtn} onPress={openPreview}>
          <Text style={s.previewBtnText}>{t('EDITPROFILE.PREVIEW')}</Text>
        </Pressable>
      </View>

      <PhotoPrivacySheet
        visible={photoPrivacyVisible}
        onClose={() => setPhotoPrivacyVisible(false)}
      />

      <FieldRestrictedSheet
        visible={fieldRestrictedVisible}
        onClose={() => setFieldRestrictedVisible(false)}
      />

      {/* Photo picker — embedded directly (no navigation to the onboarding
          wizard's own routes): closing or finishing an upload just dismisses
          this modal and refreshes the grid below, in place. */}
      <Modal
        visible={galleryVisible}
        animationType="slide"
        onRequestClose={() => setGalleryVisible(false)}
        presentationStyle="fullScreen"
      >
        <CustomGalleryScreen
          navigation={navigation}
          route={{ params: { existingCount: photos.length } }}
          onClose={() => setGalleryVisible(false)}
          onUploaded={() => { setGalleryVisible(false); load() }}
        />
      </Modal>

      {/* Web only — hidden file input IS the picker (see openGalleryPicker) */}
      {Platform.OS === 'web' && (
        // @ts-ignore — raw DOM element, react-native-web only
        <input
          ref={webFileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
          onChange={handleWebFiles}
        />
      )}

      <PhotoAlbumViewerMobile
        visible={viewerIndex !== null}
        photos={photos}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
        onChanged={load}
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

  scrollContent: { paddingHorizontal: CONTENT_PAD, paddingTop: 24 },

  photoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Figma: icon + label on one centred row, 4px apart. Only the label is
  // underlined — the icon must stay outside the <Text> or the underline runs
  // beneath it too.
  photoPrivacyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  photoPrivacyLink: { fontSize: 14, color: Colors.link, textDecorationLine: 'underline' },

  // Square mosaic; its edge is supplied per-render from mosaicMetrics() so the
  // 3 tiles + 2 gaps land flush with the rows and section titles below at any
  // viewport width. Children are absolutely positioned within it.
  photoGrid: { marginTop: 24 },
  photoTile: {
    position: 'absolute', borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.surfaceDim,
  },
  // Only the main/profile tile (slot 0) gets the red border in Figma —
  // small tiles are plain rounded photos.
  photoTileMain: { borderWidth: 2, borderColor: Colors.primaryDark },
  photoTileImg: { width: '100%', height: '100%' },
  // Figma: 22px tall, pinned to the main tile's bottom-left corner. Width is
  // left content-driven rather than Figma's fixed 100 — the label is localised,
  // and a hard width would clip it in the longer languages.
  mainPhotoBadge: {
    position: 'absolute', left: 0, bottom: 0, height: 22, justifyContent: 'center',
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 8, borderTopRightRadius: 16, borderBottomLeftRadius: 8,
  },
  mainPhotoBadgeText: {
    fontSize: 12, lineHeight: 14, letterSpacing: 0.12,
    fontWeight: '500', color: Colors.white, textTransform: 'capitalize',
  },

  photoAddSlot: {
    position: 'absolute', borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderSubtle,
    backgroundColor: 'rgba(230,230,230,0.3)', alignItems: 'center', justifyContent: 'center',
  },

  photoHint: { fontSize: 12, color: '#585858', marginTop: 8 },

  // 44, not 24 — derived from the design's own absolute offsets: every section
  // in the frame starts 44px after the previous one's last row ends (Basic 554,
  // Professional 1082, Religious 1370, Life style 1898, Family 2186, Property
  // 2394 all reconcile at 44). 24 was cramming the sections together.
  section: { marginTop: 44 },
  // Figma: h-[20px] block, then a 24px gap before the first row. lineHeight is
  // the design's block height rather than its leading-16 — 16 on a 20px face
  // clips descenders on Android, and 20 is what the layout maths uses anyway.
  sectionTitle: { fontSize: 20, lineHeight: 20, fontWeight: '600', color: Colors.black, marginBottom: 24 },
  // Cancels the first row's top padding and the last row's bottom padding —
  // see the Section() comment.
  sectionRows: { marginTop: -20, marginBottom: -20 },

  footer: {
    paddingHorizontal: 24, paddingTop: 12, backgroundColor: Colors.white,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(204,204,204,0.5)',
  },
  previewBtn: { height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  previewBtnText: { color: Colors.white, fontSize: 14, fontWeight: '500' },
})

const r = StyleSheet.create({
  // items-start, not center: in Figma the icon and the chevron both sit level
  // with the LABEL line, not centred against the label+value pair. Centring
  // pushed both of them ~4px down on every row in the screen.
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 20 },
  rowPressed: { opacity: 0.6 },
  // Fixed-size slot, rendered even when the row has no icon — an absent icon
  // must not pull its label leftward out of line with the rest of the section.
  rowIcon: { width: ROW_ICON, height: ROW_ICON, alignItems: 'center', justifyContent: 'center' },
  // flex:1 resolves to Figma's fixed 248 text column: 312 content - 24 icon
  // - 12 gap - 12 gap - 16 chevron = 248.
  rowText: { flex: 1, gap: 8 },
  // lineHeight 16 on both lines is what makes a row 40px of content (16+8+16)
  // and therefore 80px overall — the figure the design's own offsets rely on.
  rowLabel: { fontSize: 14, lineHeight: 16, color: Colors.black },
  rowValue: { fontSize: 14, lineHeight: 16, fontWeight: '500', color: Colors.black },
  // Figma draws a 1px rule; hairlineWidth renders 0.33-0.5px on most devices,
  // which read as a washed-out gap rather than a divider.
  rowDivider: { height: 1, backgroundColor: 'rgba(204,204,204,0.5)' },

  // Figma's "Link CTA" component. alignSelf: 'flex-start' so the row hugs its
  // text — without it the chevron is pushed out to the far right of the flexed
  // text column instead of sitting directly after the label. Height matches a
  // value line (16) so a missing row is exactly as tall as a filled one.
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  missingText: { fontSize: 14, lineHeight: 16, color: Colors.link },
})
