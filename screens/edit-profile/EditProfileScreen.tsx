// Angular equivalent: pages/edit-profile/edit-profile.page.ts + .html — a pure
// read-only summary/list page. Nothing is edited inline here; every row exists
// to show the current value and navigate somewhere else. This port follows the
// new Figma design's 3-level flow (see node 2192-9135): this hub screen →
// a per-section "group screen" (Basic/Professional/Religious/etc., each with
// its own Submit) → a picker reusing onboarding's SearchablePicker/
// MultiSelectPicker components.
//
// Photo management is fully embedded on this screen: adding requests the OS
// photo-library permission and launches the native picker directly (a hidden
// file input on web — see openGalleryPicker), NOT the onboarding wizard's
// own hand-built CustomGalleryScreen UI — and tapping an existing photo opens
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
  ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Colors } from '../../constants/colors'
import { Fonts, FontSize } from '../../src/theme/fonts'
import { CDN_REACT, CDN_SVG } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { Endpoints } from '../../service/api.endpoints'
import { uploadFile } from '../../service/apiClient'
import { managePhotos } from '../../service/profileService'
import {
  getPhotoConfig, validatePhotoAsset, normalizeWebFile, getRejectReasons, describeRejection,
  pollPhotoValidation,
  type PhotoRejectionCode,
} from '../../service/photoValidationService'
import { getOwnGenderAvatarUrl } from '../../utils/avatar'
import { fetchEditProfileInfo, type EditProfileInfo } from '../../service/editProfileService'
import PhotoAlbumViewerMobile from '../../components/edit-profile/PhotoAlbumViewerMobile'
import PhotoVerdictSheet, { type VerdictPhoto } from '../../components/photo-validation/PhotoVerdictSheet'
import VerificationSuccessSheet from '../../components/bottom-sheet/VerificationSuccessSheet'
import {
  CHILDREN_OPTIONS,
  fetchReligionOptions, fetchCasteOptions, fetchOccupationOptions,
  fetchQualificationOptions, fetchMotherTongueOptions,
  fetchEatingHabitOptions, fetchDrinkingHabitOptions, fetchSmokingHabitOptions, fetchRaasiOptions,
  fetchStarOptions, fetchMonthlyIncomeOptions, fetchPropertyOptions,
  fetchStates, fetchCities, fetchHeightCategoryOptions,
  fetchMaritalStatusOptions, fetchPhysicalStatusOptions, fetchProfileCreatedByOptions,
  fetchFamilyOptions, isHomeTownMotherTongue, storeUserName,
} from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import Svg, { Rect } from 'react-native-svg'
import PhotoPrivacySheet from '../../components/photo-privacy/PhotoPrivacySheet'
import FieldRestrictedSheet from '../../components/edit-profile/FieldRestrictedSheet'
import ScreenTopInset from '../../components/screen/ScreenTopInset'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { handleBack } from '../../utils/navigationRef'
import EditProfileDesktopScreen from './EditProfileDesktopScreen'

const ICON_BACK  = CDN_REACT + '/menu_back_arrow.svg'
const ICON_ARROW = CDN_REACT + '/menu_right_arrow.svg'

// "View Photo Guidelines" row — Angular: edit-profile.page.html:160-167.
// The <ion-img> carries NO size class on this page (`.width-height-16` = 1.5rem
// is registration-revamp's guidelines row, not this one), so it renders at the
// asset's own intrinsic size — guidelins.svg is 16x16.
const ICON_GUIDELINES = CDN_SVG + 'guidelins.svg'
const GUIDELINES_ICON = 16

// Red "+" circle on the photo grid's Add Photo / Add More tile.
const ICON_ADD_CIRCLE = CDN_REACT + '/add_circle.svg'
const ADD_CIRCLE_ICON = 24

// Add Photo / Add More tile border. Drawn as an SVG rect because RN's
// borderStyle 'dashed' gives no control over dash length — its short native
// dashes read as a faint dotted line. Dash 8 / gap 6, 1.5 wide.
const ADD_DASH = '8 6'
const ADD_DASH_WIDTH = 1.5

function DashedBorder({ width, height, radius }: { width: number; height: number; radius: number }) {
  const inset = ADD_DASH_WIDTH / 2
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect
        x={inset} y={inset} width={width - ADD_DASH_WIDTH} height={height - ADD_DASH_WIDTH}
        rx={radius} ry={radius}
        fill="none" stroke={Colors.inputBorder} strokeWidth={ADD_DASH_WIDTH} strokeDasharray={ADD_DASH}
      />
    </Svg>
  )
}

// Missing-field warning triangle, shown at the right edge of any row whose
// value isn't set yet (Figma) — it replaces the grey chevron rather than
// sitting next to it. Drawn at its own 18x17 intrinsic size: the asset is not
// square, so forcing it into a square box would letterbox it smaller than the
// design and leave uneven padding on one axis.
// Leading icon on the "Photo privacy" link (Figma node 3366:13117 — a 32px
// icon box, gap 4, then the underlined label).
const ICON_PRIVACY = CDN_SVG + '/photo-privacy.svg'
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
// Five of the six previously-iconless rows (Jodii ID, Profile created by,
// Marital status, Physical status, Mobile number) are now mapped. Three of them
// are NOT in the react/ folder — they reuse assets from the Angular app's own
// svg/ tree, so they go through CDN_SVG rather than CDN_REACT. Every one was
// verified 200 on both the staging (stgimg.jodii.app) and production
// (imgs.jodii.app) hosts, so they resolve under EnvConfig.image in every
// environment — nothing here is a hardcoded absolute URL.
//
// ONE ROW STILL HAS NO ICON — Children. It keeps rendering an empty icon slot:
// the space is still reserved via ROW_ICON so every label in the section stays
// on the same left edge instead of some rows jumping inward. Drop a file in and
// add it here — no other change needed.
//
// Not mapped: edit_vehicle.svg. This screen has exactly one "Properties owned"
// row and property codes 5/6/7 (the vehicle ones) are deliberately excluded
// from it — see the file header and splitProperties() in editProfileService.ts.
// There's no "Own Vehicle" row to hang it on; if the Figma has one, that's a
// separate change (the data is already parsed as `profile.vehicles`).
const ROW_ICON = 24
const R_ICON = {
  jodiiId:        CDN_REACT + '/edit_id.svg',
  createdBy:      CDN_REACT + '/edit_name.svg',
  // Angular svg/ tree, not react/. 19x19 intrinsic, stroke #545454 — scaled up
  // to the 24 ROW_ICON box like every other row icon.
  maritalStatus:  CDN_SVG + 'viewprofile/marital-status-icon.svg',
  // 24x24 intrinsic, fill #858585 — already exactly ROW_ICON size.
  physicalStatus: CDN_SVG + 'physical-status.svg',
  mobileNo:       CDN_REACT + '/edit_phone.svg',

  name:           CDN_REACT + '/edit_name.svg',
  age:            CDN_REACT + '/edit_age.svg',
  height:         CDN_REACT + '/edit_height.svg',
  motherTongue:   CDN_REACT + '/edit_mothertongue.svg',
  location:       CDN_REACT + '/edit_location.svg',
  hometown:       CDN_REACT + '/edit_hometown.svg',
  education:      CDN_REACT + '/edit_education.svg',
  occupation:     CDN_REACT + '/edit_occupation.svg',
  income:         CDN_REACT + '/edit_monthlyincome.svg',
  // Shared with the Filters/Partner-preferences religion row (SearchScreen's
  // FIELD_ICON) so one asset covers both surfaces — was edit_religion.svg.
  religion:       CDN_REACT + '/filter-religion.svg',
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

// Photo mosaic — 1 large tile (spans 2x2 of the small-tile grid) with two
// small tiles stacked to its right, then rows of 3 small tiles below for every
// further photo (slot 0 = main/profile photo). The "Add More" tile takes the
// slot right after the last photo and disappears once MAX_PHOTOS is reached;
// with no photos at all the grid is replaced by one large "Add Photo" box.
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
  if (i === 1) return { left: m.third, top: 0 }
  if (i === 2) return { left: m.third, top: m.second }
  const row = Math.floor((i - 3) / 3)
  const col = (i - 3) % 3
  return { left: col * m.second, top: m.third + row * m.second }
}

// Height of a mosaic holding `count` slots (photos + the Add More tile).
function mosaicHeight(count: number, m: MosaicMetrics): number {
  if (count <= 3) return m.main
  const rows = Math.ceil((count - 3) / 3)
  return m.third + rows * m.second - MOSAIC_GAP
}

type Props = { navigation: any; route?: any }

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

export default function EditProfileScreen({ navigation, route }: Props) {
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
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [genderAvatarUrl, setGenderAvatarUrl] = useState('')
  // Photo failed to load (broken URL / still processing) — fall back to the
  // gender avatar instead of a blank tile, same as an empty slot.
  const [failedPhotos, setFailedPhotos] = useState<Set<number>>(new Set())

  useEffect(() => {
    getOwnGenderAvatarUrl().then(setGenderAvatarUrl)
  }, [])
  const [photoUploading, setPhotoUploading] = useState(false)
  // Web only — see EditProfileDesktopScreen.tsx for the same pattern. Browsers
  // only allow a file picker to open from a direct, synchronous user click, so
  // there's no "landing screen" step to skip on web: this hidden input IS the
  // picker, triggered straight from the Pressable's own onPress.
  const webFileInputRef = useRef<HTMLInputElement | null>(null)
  // Guards against a second openGalleryPicker() call firing (rapid double-tap
  // on the add-photo slot) while the permission prompt/native picker from the
  // first call is still in flight — before setPhotoUploading(true) below ever
  // runs, so the disabled={photoUploading} prop can't catch it on its own.
  const pickerBusyRef = useRef(false)

  // AI photo-validation verdict — same state machine as onboarding's
  // CustomGalleryScreen (native/web). Every add-photo path here sends
  // AIVALIDATE but, until now, never read the verdict back.
  const [verdictPhase, setVerdictPhase] = useState<'idle' | 'uploading' | 'approved' | 'rejected' | 'mixed'>('idle')
  const [verdictApproved, setVerdictApproved] = useState<VerdictPhoto[]>([])
  const [verdictRejected, setVerdictRejected] = useState<VerdictPhoto[]>([])

  async function runVerdictPoll(config: Awaited<ReturnType<typeof getPhotoConfig>>, uploadedPhotoIds: string[]) {
    if (!config.isNativeFaceDetectionEnabled || uploadedPhotoIds.length === 0) return
    setVerdictPhase('uploading')
    const verdict = await pollPhotoValidation(uploadedPhotoIds)

    if (!verdict) {
      setVerdictPhase('idle')
      return
    }
    if (verdict.isSelfieRequired) {
      setVerdictPhase('idle')
      navigation.push('photo-mismatch-selfie', { standalone: true })
      return
    }

    const approved: VerdictPhoto[] = []
    const rejected: VerdictPhoto[] = []
    for (const r of verdict.results) {
      const entry: VerdictPhoto = {
        photoId:  r.photoId,
        photoUrl: r.photoUrl,
        ...(r.reason?.title    ? { reasonTitle: r.reason.title }       : {}),
        ...(r.reason?.subtitle ? { reasonSubtitle: r.reason.subtitle } : {}),
      }
      if (r.status.toLowerCase() === 'approve') approved.push(entry)
      else rejected.push(entry)
    }
    setVerdictApproved(approved)
    setVerdictRejected(rejected)
    setVerdictPhase(rejected.length === 0 ? 'approved' : approved.length === 0 ? 'rejected' : 'mixed')
  }

  function dismissVerdict() {
    setVerdictPhase('idle')
  }

  function retryFromVerdict() {
    setVerdictPhase('idle')
  }

  async function handleWebFiles(e: any) {
    let files: File[] = Array.from(e.target.files ?? [])
    if (!files.length) return
    // Native's openGalleryPicker caps selection via selectionLimit before the
    // OS picker even opens; the browser's file dialog has no such incremental
    // cap, so enforce the same MAX_PHOTOS-total limit here after the fact.
    const remaining = Math.max(0, MAX_PHOTOS - photos.length)
    if (files.length > remaining) {
      Alert.alert(
        'Photo limit reached',
        `You can add up to ${remaining} more photo${remaining !== 1 ? 's' : ''}. Only the first ${remaining} selected will be uploaded.`,
      )
      files = files.slice(0, remaining)
    }
    if (!files.length) { if (webFileInputRef.current) webFileInputRef.current.value = ''; return }
    setPhotoUploading(true)
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      const config = await getPhotoConfig()
      const rejections: PhotoRejectionCode[] = []
      const uploadedPhotoIds: string[] = []
      for (const file of files) {
        const input = await normalizeWebFile(file)
        const validation = await validatePhotoAsset(input, config)
        URL.revokeObjectURL(input.uri)
        if (!validation.ok) {
          rejections.push(validation.code)
          continue
        }
        const formData = new FormData()
        formData.append('ID', userId)
        formData.append('AIVALIDATE', config.isNativeFaceDetectionEnabled ? '1' : '0')
        formData.append('UPLOADPHOTO', file, file.name)
        const res = await uploadFile(Endpoints.media.addProfilePic, formData)
        if (res?.RESPONSECODE == 1) {
          if (res?.RESPONSE?.PHOTOURL) {
            await setItem(SK.User.PHOTO_URL, String(res.RESPONSE.PHOTOURL))
          }
          if (res?.RESPONSE?.PHOTOID) {
            uploadedPhotoIds.push(String(res.RESPONSE.PHOTOID))
          }
        }
      }
      await load()
      if (rejections.length) {
        const reasons = await getRejectReasons()
        Alert.alert('Some photos were not added', rejections.map(code => describeRejection(code, reasons)).join('\n\n'))
      }
      await runVerdictPoll(config, uploadedPhotoIds)
    } catch {
      Alert.alert('Error', 'Upload failed. Please try again.')
      setVerdictPhase('idle')
    } finally {
      setPhotoUploading(false)
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
    // Angular getUserDetails(): keep the stored NAME in sync with the server.
    if (info.name) storeUserName(info.name)

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

  // The Photo Guidelines screen's "Continue to upload photo" CTA sends us back
  // here with this flag (Angular calls the native picker directly from that
  // page; ours lives on this screen). Cleared immediately so returning to this
  // screen any other way — or a re-render — doesn't reopen the picker.
  useEffect(() => {
    if (!route?.params?.openPhotoPicker) return
    navigation.setParams({ openPhotoPicker: undefined })
    openGalleryPicker()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.openPhotoPicker])

  // Opens the photo picker directly — no navigation to the onboarding
  // wizard's own routes, so there's nothing to "come back from". On web this
  // has to be the file input's own .click() call, right here, so it stays a
  // trusted user gesture; on native it opens the embedded gallery modal.
  // Same cap CustomGalleryScreen's own "You can select up to N more photos"
  // enforced — this screen no longer routes through that custom in-app
  // gallery UI (see openGalleryPicker below), so the limit is kept here.
  const MAX_PHOTOS = 10

  async function openGalleryPicker() {
    if (Platform.OS === 'web') {
      webFileInputRef.current?.click()
      return
    }
    if (pickerBusyRef.current) return
    pickerBusyRef.current = true
    try {
      // Native: request the OS photo-library permission and go straight into
      // the system picker — same permission → launchImageLibraryAsync pattern
      // PhotoAlbumViewerMobile.tsx's handleReplace() already uses, instead of
      // detouring through CustomGalleryScreen's hand-built in-app gallery UI.
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow photo library access in Settings to add photos.')
        return
      }
      const remaining = Math.max(0, MAX_PHOTOS - photos.length)
      if (remaining <= 0) return
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: remaining > 1,
        selectionLimit: remaining,
        quality: 0.85,
      })
      if (result.canceled || !result.assets.length) return

      setPhotoUploading(true)
      try {
        const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
        const config = await getPhotoConfig()
        const rejections: PhotoRejectionCode[] = []
        const uploadedPhotoIds: string[] = []
        for (const asset of result.assets) {
          const validation = await validatePhotoAsset({
            uri: asset.uri,
            mimeType: asset.mimeType,
            fileSize: asset.fileSize,
            width: asset.width,
            height: asset.height,
          }, config)
          if (!validation.ok) {
            rejections.push(validation.code)
            continue
          }
          const formData = new FormData()
          formData.append('ID', userId)
          formData.append('AIVALIDATE', config.isNativeFaceDetectionEnabled ? '1' : '0')
          formData.append('UPLOADPHOTO', {
            uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? 'photo.jpg',
          } as any)
          const res = await uploadFile(Endpoints.media.addProfilePic, formData)
          if (res?.RESPONSECODE == 1) {
            if (res?.RESPONSE?.PHOTOURL) {
              await setItem(SK.User.PHOTO_URL, String(res.RESPONSE.PHOTOURL))
            }
            if (res?.RESPONSE?.PHOTOID) {
              uploadedPhotoIds.push(String(res.RESPONSE.PHOTOID))
            }
          }
        }
        await load()
        if (rejections.length) {
          const reasons = await getRejectReasons()
          Alert.alert('Some photos were not added', rejections.map(code => describeRejection(code, reasons)).join('\n\n'))
        }
        await runVerdictPoll(config, uploadedPhotoIds)
      } catch {
        Alert.alert('Error', 'Upload failed. Please try again.')
        setVerdictPhase('idle')
      } finally {
        setPhotoUploading(false)
      }
    } catch (e) {
      if (__DEV__) console.error('[EditProfile] photo picker error:', e)
    } finally {
      pickerBusyRef.current = false
    }
  }

  function openPreview() {
    navigation.navigate('viewProfile', { matriId: ownId, fromPage: 'menu' })
  }

  // Angular: guidelinePageRedirection() — router.navigate(
  // ['/addphoto-intermediate/showguidelines'], { queryParams: { frm_page:
  // 'edit-profile' } }) (edit-profile.page.ts:1161). Same route, same params.
  function openPhotoGuidelines() {
    navigation.navigate('addphoto-intermediate', {
      page: 'showguidelines',
      frm_page: 'edit-profile',
    })
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
      <View style={[s.screen, s.center]}>
        <ScreenTopInset style={s.topInset} />
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
    <View style={s.screen}>
      <ScreenTopInset />
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('EDITPROFILE.EDIT_PROFILE')}</Text>
      </View>

      <ScrollView contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>

        {/* ── Photo ── */}
        <View style={s.photoHeaderRow}>
          <View style={s.photoTitleRow}>
            <Text style={[s.sectionTitle, s.photoTitleText]}>{t('EDITPROFILE.PHOTOS')}</Text>
            {photos.length === 0 && <CdnSvg uri={ICON_MISS_WARN} width={MISS_WARN_W} height={MISS_WARN_H} />}
          </View>
          <Pressable
            style={s.photoPrivacyBtn}
            onPress={() => (photos.length > 0 ? setPhotoPrivacyVisible(true) : openGalleryPicker())}
            hitSlop={8}
          >
            <CdnSvg uri={ICON_PRIVACY} width={PRIVACY_ICON_SIZE} height={PRIVACY_ICON_SIZE} />
            <Text style={s.photoPrivacyLink}>{t('EDITPROFILE.PHOTO_PRIVACY')}</Text>
          </Pressable>
        </View>

        {photos.length === 0 ? (
          <Pressable
            style={[s.photoAddSlot, s.photoAddEmpty, { width: mosaic.size, height: mosaic.size }]}
            onPress={openGalleryPicker}
            disabled={photoUploading}
            accessibilityRole="button"
          >
            <DashedBorder width={mosaic.size} height={mosaic.size} radius={16} />
            {photoUploading ? <ActivityIndicator color={Colors.textTertiary} size="small" /> : (
              <>
                <CdnSvg uri={ICON_ADD_CIRCLE} width={ADD_CIRCLE_ICON} height={ADD_CIRCLE_ICON} />
                <Text style={s.photoAddText}>{t('GENERAL.ADD_PHOTO_TXT')}</Text>
              </>
            )}
          </Pressable>
        ) : (() => {
          const showAddTile = photos.length < MAX_PHOTOS
          const slotCount = photos.length + (showAddTile ? 1 : 0)
          return (
            <View style={[s.photoGrid, { width: mosaic.size, height: mosaicHeight(slotCount, mosaic) }]}>
              {photos.map((photo, i) => {
                const pos = photoSlotPosition(i, mosaic)
                const size = i === 0 ? mosaic.main : mosaic.tile
                const failed = failedPhotos.has(i)
                return (
                  <Pressable key={i} style={[s.photoTile, i === 0 && s.photoTileMain, pos, { width: size, height: size }]} onPress={() => setViewerIndex(i)}>
                    {failed ? (
                      // Image failed to load — same gender-avatar placeholder
                      // Angular falls back to (common.ts's getAvatarImg(false)).
                      !!genderAvatarUrl && <CdnSvg uri={genderAvatarUrl} width={size} height={size} />
                    ) : (
                      <Image
                        source={{ uri: photo.PHOTOURL || photo.PHOTOTHUMB }}
                        style={s.photoTileImg}
                        contentFit="cover"
                        onError={(e) => {
                          if (__DEV__) console.warn(`[EditProfile] photo[${i}] failed to load:`, photo.PHOTOURL || photo.PHOTOTHUMB, e.error)
                          setFailedPhotos(prev => new Set(prev).add(i))
                        }}
                      />
                    )}
                    {i === 0 && (
                      <View style={s.mainPhotoBadge}>
                        <Text style={s.mainPhotoBadgeText}>{t('EDITPROFILE.PROFILE_PHOTO')}</Text>
                      </View>
                    )}
                  </Pressable>
                )
              })}
              {showAddTile && (
                <Pressable
                  style={[s.photoAddSlot, photoSlotPosition(photos.length, mosaic), { width: mosaic.tile, height: mosaic.tile }]}
                  onPress={openGalleryPicker}
                  disabled={photoUploading}
                  accessibilityRole="button"
                >
                  <DashedBorder width={mosaic.tile} height={mosaic.tile} radius={8} />
                  {photoUploading ? <ActivityIndicator color={Colors.textTertiary} size="small" /> : (
                    <>
                      <CdnSvg uri={ICON_ADD_CIRCLE} width={ADD_CIRCLE_ICON} height={ADD_CIRCLE_ICON} />
                      <Text style={s.photoAddText}>{t('EDITPROFILE.ADD_MORE', 'Add More')}</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          )
        })()}

        {/* ── View photo guidelines ──
            Angular: edit-profile.page.html:160-167 — a `mt-16` row sitting
            directly under the photo grid, no gender/photo-count gate. */}
        <Pressable style={s.guidelinesRow} onPress={openPhotoGuidelines} hitSlop={8} accessibilityRole="button">
          <CdnSvg uri={ICON_GUIDELINES} width={GUIDELINES_ICON} height={GUIDELINES_ICON} />
          <Text style={s.guidelinesText}>{t('GENERAL.VIEW_GUIDELINE')}</Text>
        </Pressable>

        {/* ── Basic details ── */}
        <Section title={t('EDITPROFILE.BASIC_DETAILS')}>
          {/* New alignment: ID, Profile created for, Name, Mobile number first. */}
          <FieldRow label={t('EDITPROFILE.JODIIID')} value={ownId} onPress={() => {}} hideArrow icon={R_ICON.jodiiId} showDivider />
          <FieldRow label={t('EDITPROFILE.CREATEDFOR')} value={createdByLabel} onPress={() => {}} hideArrow icon={R_ICON.createdBy} showDivider />
          <FieldRow label={t('EDITPROFILE.NAME')} value={profile.name} onPress={restrictedNav(profile.nameEditable, 'EditProfileBasic')} icon={R_ICON.name} showDivider />
          <FieldRow label={t('EDITPROFILE.MOBILENO')} value={profile.mobileNo} onPress={() => {}} hideArrow icon={R_ICON.mobileNo} showDivider />
          <FieldRow label={t('EDITPROFILE.AGE')} value={profile.age ? `${profile.age} years old` : undefined} onPress={restrictedNav(profile.ageEditable, 'EditProfileAgeHeight')} icon={R_ICON.age} showDivider />
          <FieldRow label={t('EDITPROFILE.HEIGHT')} value={heightLabel} onPress={() => navigation.navigate('EditProfileAgeHeight')} icon={R_ICON.height} showDivider />
          <FieldRow
            label={t('EDITPROFILE.MARITALSTATUS')}
            value={labelFor(labels.maritalStatus ?? [], profile.maritalStatus)}
            onPress={() => navigation.navigate('EditProfileMarital')}
            icon={R_ICON.maritalStatus}
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
            icon={R_ICON.physicalStatus}
            showDivider
          />
          <FieldRow label={t('EDITPROFILE.MOTHERTONGUE')} value={labelFor(labels.motherTongue ?? [], profile.motherTongue)} onPress={restrictedNav(profile.motherTongueEditable, 'EditProfileBasic')} icon={R_ICON.motherTongue} showDivider />
          <FieldRow label={t('EDITPROFILE.CURRENT_LOCATION')} value={cityLabel} onPress={() => navigation.navigate('EditProfileBasic')} icon={R_ICON.location} showDivider={homeTownVisible} />
          {homeTownVisible && (
            <FieldRow label={t('BIO_DATA.HOME_TOWN')} value={homeCityLabel} onPress={() => navigation.navigate('EditProfileBasic')} icon={R_ICON.hometown} />
          )}
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

      <VerificationSuccessSheet
        visible={verdictPhase === 'approved'}
        title={verdictApproved.length > 1
          ? t('AI_PHOTO_VALIDATION.PHOTOS_APPROVED_MULTI', '#COUNT Photos approved successfully!').replace('#COUNT', String(verdictApproved.length))
          : t('AI_PHOTO_VALIDATION.PHOTO_APPROVED_SINGLE', 'Photo approved successfully!')}
        subtitle=""
        onDismiss={dismissVerdict}
      />
      <PhotoVerdictSheet
        visible={verdictPhase === 'uploading' || verdictPhase === 'rejected' || verdictPhase === 'mixed'}
        phase={verdictPhase === 'uploading' ? 'uploading' : verdictPhase === 'mixed' ? 'mixed' : 'rejected'}
        approved={verdictApproved}
        rejected={verdictRejected}
        onAddNewPhoto={retryFromVerdict}
        onDismiss={dismissVerdict}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topInset: { position: 'absolute', top: 0, left: 0, right: 0 },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  // App-wide screen-header convention (same 16/Medium/#333333 as every other
  // stack screen). NOT Angular's own edit-profile header, which is
  // `heading1-semibold-20 black-color` (edit-profile.page.html:8) — 20px
  // semibold #000000. Left on the RN convention deliberately so this one
  // screen's header doesn't diverge from the rest of the app.
  headerTitle: {
    flex: 1, fontSize: FontSize.font16, fontFamily: Fonts.poppinsMedium,
    color: '#333333', marginLeft: 6, marginRight: 16,
  },

  scrollContent: { paddingHorizontal: CONTENT_PAD, paddingTop: 24 },

  photoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Figma: icon + label on one centred row, 4px apart. Only the label is
  // underlined — the icon must stay outside the <Text> or the underline runs
  // beneath it too.
  photoPrivacyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Angular: edit-profile.page.html:49 `textcta-medium-12 color-29339B` —
  // global.scss .textcta-medium-12 = var(--font12) + --english-medium-poppins
  // (Poppins-Medium); .color-29339B = #29339B (== Colors.link). Was 14px with
  // no family.
  photoPrivacyLink: {
    fontSize: FontSize.font12, fontFamily: Fonts.poppinsMedium,
    color: Colors.link, textDecorationLine: 'underline',
  },

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
  // Angular: edit-profile.page.html:93 `profile-picture textcta-medium-12
  // white-color` — var(--font12) + Poppins-Medium + #ffffff. Size/colour
  // already matched; the bare fontWeight '500' is replaced by the real family.
  mainPhotoBadgeText: {
    fontSize: FontSize.font12, lineHeight: 14, letterSpacing: 0.12,
    fontFamily: Fonts.poppinsMedium, color: Colors.white, textTransform: 'capitalize',
  },

  photoAddSlot: {
    // Border drawn by <DashedBorder> (SVG) for controllable dash length.
    position: 'absolute', borderRadius: 8,
    backgroundColor: 'rgba(230,230,230,0.3)', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  // No-photo state: one big box in normal flow instead of an absolute tile.
  photoAddEmpty: { position: 'relative', marginTop: 24, borderRadius: 16 },
  photoAddText: { fontSize: FontSize.font14, fontFamily: Fonts.poppinsMedium, color: Colors.primaryDark },
  photoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Title's own marginBottom would push it off-centre from the warning icon.
  photoTitleText: { marginBottom: 0 },

  // Unused — nothing renders this. Kept and tokenised rather than deleted; its
  // Angular counterpart (edit-profile.page.html:157 `textcta-medium-12
  // color-585858`, the "*Hold & Drag photos to reorder" hint) is commented out
  // there too, so both sides are dead in the same way.
  photoHint: { fontSize: FontSize.font12, fontFamily: Fonts.poppinsMedium, color: '#585858', marginTop: 8 },

  // Angular: `<ion-row class="mt-16 ion-cust-padding-start ion-cust-padding-end">`
  // — 16 above the row; the label's own `ml-8` is the 8 between icon and text.
  guidelinesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  // Angular: `textcta-medium-12 color-29339B` wrapped in <u> — global.scss:2270
  // = var(--font12) + --english-medium-poppins (Poppins-Medium); #29339B is
  // Colors.link.
  guidelinesText: {
    fontSize: FontSize.font12, fontFamily: Fonts.poppinsMedium,
    color: Colors.link, textDecorationLine: 'underline',
  },

  // Angular: `.primary-cta-jodii` (global.scss:26257) — width 100%,
  // background #B50033, border-radius 8, --box-shadow none. Height follows this
  // screen's own footer Preview CTA (44) rather than primary-cta-jodii's
  // min-height 40, so the screen's two full-width red CTAs match each other.
  //
  // marginTop 24 = the row's `ion-cust-padding-top` (var(--ion-cust-padding)).
  // Deliberately NO marginBottom: Angular's own `pb-12` on this row plus the
  // Basic-details grid's `mt-8` + inner `mt-24` sum to exactly 44 — which is
  // what `section.marginTop` already supplies below. Adding 12 here would
  // stack on top of that 44 (RN margins don't collapse) and push the first
  // section down to 56.
  addPhotoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark, marginTop: 24,
  },
  addPhotoBtnPressed: { opacity: 0.8 },
  // Angular: `<span class="body1-medium-14 white-color ml-8">` — var(--font14)
  // + Poppins-Medium + #ffffff. The ml-8 is the row's `gap: 8` above.
  addPhotoBtnText: { fontSize: FontSize.font14, fontFamily: Fonts.poppinsMedium, color: Colors.white },

  // 44, not 24 — derived from the design's own absolute offsets: every section
  // in the frame starts 44px after the previous one's last row ends (Basic 554,
  // Professional 1082, Religious 1370, Life style 1898, Family 2186, Property
  // 2394 all reconcile at 44). 24 was cramming the sections together.
  section: { marginTop: 44 },
  // Figma: h-[20px] block, then a 24px gap before the first row. lineHeight is
  // the design's block height rather than its leading-16 — 16 on a 20px face
  // clips descenders on Android, and 20 is what the layout maths uses anyway.
  // Angular: every section heading is `heading-03-bold-20 color-333333`
  // (edit-profile.page.html:43, 335, 670, 896, 971) — var(--font20) +
  // var(--heading-03-*-Bold) (= Poppins-Bold for English) and #333333, NOT
  // #000000. Was fontWeight '600' with no family, which fell back to the OS
  // system font at a synthetic semibold.
  //
  // Caveat: .heading-03-bold-20 is only declared inside global.scss's
  // per-language blocks (.tamil, .gujarati, .punjabi, …) — there is no English
  // declaration, so on English the web page actually inherits body's
  // Poppins-Regular at the inherited size. All nine language declarations are
  // identical (Bold + --font20), so that is the intended styling and an
  // Angular-side gap, not a different design.
  sectionTitle: {
    fontSize: FontSize.font20, lineHeight: 20, fontFamily: Fonts.poppinsBold,
    color: Colors.textDark, marginBottom: 24,
  },
  // Cancels the first row's top padding and the last row's bottom padding —
  // see the Section() comment.
  sectionRows: { marginTop: -20, marginBottom: -20 },

  footer: {
    paddingHorizontal: 24, paddingTop: 12, backgroundColor: Colors.white,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(204,204,204,0.5)',
  },
  previewBtn: { height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  // Angular's primary CTA copy is `primary-cta-jodii body1-medium-14
  // white-color` (edit-profile.page.html:172) — var(--font14) +
  // --english-medium-poppins + #ffffff.
  previewBtnText: { color: Colors.white, fontSize: FontSize.font14, fontFamily: Fonts.poppinsMedium },
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
  // Angular: every row's <h2> is `body2-regular-14 color-4c4c4c` — global.scss
  // .body2-regular-14 = var(--font14) + --english-regular-poppins
  // (Poppins-Regular); .color-4c4c4c = #4c4c4c, a grey, not black.
  rowLabel: { fontSize: FontSize.font14, lineHeight: 16, fontFamily: Fonts.poppinsRegular, color: '#4c4c4c' },
  // Angular: every row's value <p> is `mt-5 body1-medium-14 color-333333` —
  // var(--font14) + --english-medium-poppins (Poppins-Medium) + #333333.
  rowValue: { fontSize: FontSize.font14, lineHeight: 16, fontFamily: Fonts.poppinsMedium, color: Colors.textDark },
  // Figma draws a 1px rule; hairlineWidth renders 0.33-0.5px on most devices,
  // which read as a washed-out gap rather than a divider.
  rowDivider: { height: 1, backgroundColor: 'rgba(204,204,204,0.5)' },

  // Figma's "Link CTA" component. alignSelf: 'flex-start' so the row hugs its
  // text — without it the chevron is pushed out to the far right of the flexed
  // text column instead of sitting directly after the label. Height matches a
  // value line (16) so a missing row is exactly as tall as a filled one.
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  // Angular: `mt-5 body1-medium-14 color-29339B add-details-txt` — same
  // Poppins-Medium/--font14 as a filled value, recoloured to #29339B.
  missingText: { fontSize: FontSize.font14, lineHeight: 16, fontFamily: Fonts.poppinsMedium, color: Colors.link },
})
