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
  ActivityIndicator, Alert, BackHandler, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text,
  FlatList, TextInput, useWindowDimensions, View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Colors } from '../../constants/colors'
import { FontSize } from '../../src/theme/fonts'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { CDN_REACT, CDN_REG, CDN_REVAMP, CDN_SVG } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { Endpoints } from '../../service/api.endpoints'
import { uploadFile } from '../../service/apiClient'
import { managePhotos, deletePhoto, setMainPhoto, updateProfile } from '../../service/profileService'
import Toast, { type ToastRequest } from '../../components/toast/Toast'
import {
  getPhotoConfig, validatePhotoAsset, normalizeWebFile, getRejectReasons, describeRejection,
  pollPhotoValidation,
  type PhotoRejectionCode,
} from '../../service/photoValidationService'
import { getOwnGenderAvatarUrl } from '../../utils/avatar'
import { fetchEditProfileInfo, submitFieldChanges, type EditProfileInfo, type FieldChange, type FieldKey } from '../../service/editProfileService'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'
import MultiSelectPicker from '../../components/multi-select-picker/MultiSelectPicker'
import { validateName } from '../../components/input/FloatingLabelInput'
import PhotoAlbumViewerMobile from '../../components/edit-profile/PhotoAlbumViewerMobile'
import PhotoVerdictSheet, { type VerdictPhoto } from '../../components/photo-validation/PhotoVerdictSheet'
import VerificationSuccessSheet from '../../components/bottom-sheet/VerificationSuccessSheet'
import {
  CHILDREN_OPTIONS, fetchEducationGroupOptionsFlat, isEducationGroupEligible, fetchSubcasteOptions,
  fetchReligionOptions, fetchCasteOptions, fetchOccupationOptions,
  fetchQualificationOptions, fetchMotherTongueOptions,
  fetchEatingHabitOptions, fetchDrinkingHabitOptions, fetchSmokingHabitOptions, fetchRaasiOptions,
  fetchStarOptions, fetchMonthlyIncomeOptions, fetchPropertyOptions,
  fetchStates, fetchCities, fetchHeightCategoryOptions, fetchExactHeightOptions,
  fetchMaritalStatusOptions, fetchPhysicalStatusOptions, fetchProfileCreatedByOptions,
  fetchFamilyOptions, isHomeTownMotherTongue, storeUserName, verifyOTP, resendOTP, getSessionValue,
  fetchGothraOptions, isGothraApplicableForCaste, fetchDoshamOptions, updateFewMoreDetail,
  isValidJobDetailFormat, isJobDetailEligible,
} from '../../service/registrationService'
import Badge from '../../components/badge/Badge'
import { showReligiousDetails } from '../../service/biodataService'
import Constants from 'expo-constants'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import OTPSuccessSheet from '../../components/bottom-sheet/OTPSuccessSheet'
import { COUNTRIES, isValidMobile, type Country } from '../auth/LoginScreen'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import Svg, { Rect } from 'react-native-svg'
import PhotoPrivacySheet from '../../components/photo-privacy/PhotoPrivacySheet'
import FieldRestrictedSheet from '../../components/edit-profile/FieldRestrictedSheet'
import { EditAgeHeightSheets, hasExactHeight, heightCategoryCode, type AgeHeightSheetMode } from './EditProfileAgeHeightScreen'
import ScreenTopInset from '../../components/screen/ScreenTopInset'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
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
// New design: the mosaic shows at most 6 photo tiles (main + 5) and never a
// dashed "Add More" tile — adding goes through the "Add more photos" CTA below
// the grid; past 6 the 6th tile turns into a "+N more" overlay into the viewer.
const GRID_MAX_TILES = 6
// Profile preview badges — same assets the Matches card's Paid / ID Verified badges use.
const ICON_PAID_TAG     = CDN_SVG + 'revamp/paid-tag-revamp.svg'
const ICON_VERIFIED_TAG = CDN_SVG + 'viewprofile/verified-tag-img.svg'
// Same undo window EditProfileDesktopScreen uses — the delete API call is
// deferred this long so the toast's Undo can genuinely cancel it.
const DELETE_UNDO_WINDOW_MS = 3000
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
  children:       CDN_REACT + '/edit_child.svg',
  mobileNo:       CDN_REACT + '/edit_phone.svg',

  name:           CDN_REACT + '/editprofile_name.svg',
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
  gothram:        CDN_REACT + '/edit_gothram.svg',
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
  const langFonts = useLanguageFonts()

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
          <Text style={[r.rowLabel, { fontFamily: langFonts.regular }]}>{label}</Text>
          {isMissing ? (
            // Figma: the link text carries its own small trailing chevron, and
            // the red warning triangle takes over the row's right edge (see
            // below) — so no leading red "!" badge here any more.
            <View style={r.missingRow}>
              <Text style={[r.missingText, { fontFamily: langFonts.medium }]}>{missingLabel}</Text>
              <CdnSvg uri={ICON_ARROW} width={MISSING_CHEVRON} height={MISSING_CHEVRON} />
            </View>
          ) : (
            <Text style={[r.rowValue, { fontFamily: langFonts.medium }]} numberOfLines={2}>{value ?? '—'}</Text>
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
function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: any }) {
  const langFonts = useLanguageFonts()
  return (
    <View style={[s.section, style]}>
      <Text style={[s.sectionTitle, { fontFamily: langFonts.bold }]}>{title}</Text>
      <View style={s.sectionRows}>{children}</View>
    </View>
  )
}

// ─── Direct field editing (new design) ────────────────────────────────────────
// Tapping a row opens its right-side picker straight from this screen — no
// intermediate group screen (BasicDetails / Professional / Religious / Marital /
// Lifestyle / Family / Property). A pick saves immediately through the same
// editprofile/updatememberinfo/v1 call and value formats those screens used,
// then chains into any dependent field (State → City, Religion → Caste →
// Sub-caste → Gothram, Raasi → Star, Dosham Yes → Dosham type, Marital →
// No. of children, Education → Education group, Occupation → Job detail).
// Free-text fields (Name, Job detail) use a small bottom sheet instead.
const VEHICLE_CODES = new Set(['5', '6', '7'])

// Moves the member's current value to the top of a picker list (Lives in /
// Home town: current state first, then current city first).
function selectedFirst(list: PickerOption[], key: string | undefined): PickerOption[] {
  const i = key ? list.findIndex(o => o.key === key) : -1
  return i > 0 ? [list[i]!, ...list.slice(0, i), ...list.slice(i + 1)] : list
}

type PickerCfg = {
  title: string
  options: PickerOption[]
  selectedKey: string | null | undefined
  hideSearch?: boolean | undefined
  onPick: (opt: PickerOption) => void | Promise<void>
}
type MultiCfg = {
  title: string
  options: PickerOption[]
  selectedKeys: string[]
  onApply: (keys: string[]) => void | Promise<void>
}
type TextCfg = {
  title: string
  label: string
  value: string
  maxLength?: number | undefined
  validate: (v: string) => string | undefined
  onSave: (v: string) => Promise<string | undefined>   // returns an error to show, or undefined when saved
}

function useFieldEditor({ profile, labels, onSaved }: {
  profile: EditProfileInfo | null
  labels: Record<string, PickerOption[]>
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
  const [picker, setPicker] = useState<PickerCfg | null>(null)
  const [multi, setMulti]   = useState<MultiCfg | null>(null)
  const [text, setText]     = useState<TextCfg | null>(null)
  const [textValue, setTextValue] = useState('')
  const [textError, setTextError] = useState('')
  const [busy, setBusy]     = useState(false)
  // SearchablePicker calls onSelect then onClose (and unmounts) on every pick.
  // That automatic close must not end a chain (State → City …), so it's
  // ignored while a pick is being handled.
  const pickingRef = useRef(false)

  // Keep the text sheet above the keyboard (BottomSheet's Modal is
  // statusBarTranslucent, so Android doesn't resize the window for it).
  const [kbHeight, setKbHeight] = useState(0)
  useEffect(() => {
    if (Platform.OS === 'web') return
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvt, e => setKbHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  async function save(changes: FieldChange[]): Promise<boolean> {
    if (changes.length === 0) return true
    setBusy(true)
    try {
      const res = await submitFieldChanges(changes)
      if (res.failed.length > 0) {
        Alert.alert('Could not save', 'Please try again.')
        return false
      }
      return true
    } finally {
      setBusy(false)
    }
  }

  function done() {
    setPicker(null); setMulti(null); setText(null)
    onSaved()
  }

  function openText(cfg: TextCfg) {
    setTextValue(cfg.value); setTextError(''); setText(cfg)
  }

  const p = profile
  const L = (k: string) => labels[k] ?? []

  // ── Basic ──
  function name() {
    if (!p) return
    openText({
      title: t('EDITPROFILE.NAME', 'Name'),
      label: t('EDITPROFILE.NAME', 'Name'),
      value: p.name ?? '',
      maxLength: 50,
      validate: v => validateName(v) ?? undefined,
      onSave: async v => {
        const trimmed = v.trim()
        if (trimmed === (p.name ?? '')) return undefined
        const ok = await save([{ field: 'NAME', value: trimmed, existingValue: p.name }])
        if (ok) await storeUserName(trimmed)
        return ok ? undefined : 'Could not save. Please try again.'
      },
    })
  }

  function maritalStatus() {
    if (!p) return
    setPicker({
      title: t('EDITPROFILE.MARITALSTATUS', 'Marital status'),
      options: L('maritalStatus'), selectedKey: p.maritalStatus, hideSearch: true,
      onPick: async opt => {
        if (opt.key === p.maritalStatus) { setPicker(null); return }
        const changes: FieldChange[] = [{ field: 'MARITALSTATUS', value: opt.key, existingValue: p.maritalStatus }]
        // Never married clears No. of children (same rule as the Marital screen).
        if (opt.key === '1' && p.noOfChildren) changes.push({ field: 'NOOFCHILDREN', value: '', existingValue: p.noOfChildren })
        if (!(await save(changes))) return
        if (opt.key !== '1') noOfChildren(true)
        else done()
      },
    })
  }

  function noOfChildren(chained = false) {
    if (!p) return
    setPicker({
      title: t('BIO_DATA.NO_OF_CHILDREN', 'No. of children'),
      options: CHILDREN_OPTIONS, selectedKey: chained ? null : p.noOfChildren, hideSearch: true,
      onPick: async opt => {
        if (opt.key !== p.noOfChildren && !(await save([{ field: 'NOOFCHILDREN', value: opt.key, existingValue: p.noOfChildren }]))) return
        done()
      },
    })
  }

  function simple(key: FieldKey, title: string, listKey: string, current: string | undefined, hideSearch = true) {
    if (!p) return
    setPicker({
      title, options: L(listKey), selectedKey: current, hideSearch,
      onPick: async opt => {
        if (opt.key !== current && !(await save([{ field: key, value: opt.key, existingValue: current }]))) return
        done()
      },
    })
  }

  function motherTongue() {
    simple('MOTHERTONGUE', t('EDITPROFILE.MOTHERTONGUE', 'Mother tongue'), 'motherTongue', p?.motherTongue, false)
  }
  function physicalStatus() {
    simple('PHYSICALSTATUS', t('EDITPROFILE.PHYSICALSTATUS', 'Physical status'), 'physicalStatus', p?.physicalStatus)
  }

  // State → City, saved as one CITY update "<city>~<state>" (TYPE 6).
  function location(home = false) {
    if (!p) return
    const curState = home ? p.homeState : p.state
    const curCity  = home ? p.homeCity  : p.city
    setPicker({
      title: home ? t('BIO_DATA.HOME_TOWN', 'Home town') : t('EDITPROFILE.CURRENT_LOCATION', 'Current location'),
      options: selectedFirst(L('states'), curState), selectedKey: curState,
      onPick: async st => {
        setBusy(true)
        const cities = await fetchCities(st.key)
        setBusy(false)
        setPicker({
          title: st.label,
          options: st.key === curState ? selectedFirst(cities, curCity) : cities,
          selectedKey: st.key === curState ? curCity : null,
          onPick: async city => {
            if (st.key !== curState || city.key !== curCity) {
              const ok = await save([home
                ? { field: 'HOMECITY', value: `${city.key}~${st.key}`, existingValue: `${curCity ?? ''}~${curState ?? ''}` }
                : { field: 'CITY',     value: `${city.key}~${st.key}`, existingValue: `${curCity ?? ''}~${curState ?? ''}` }])
              if (!ok) return
            }
            done()
          },
        })
      },
    })
  }

  // ── Professional ──
  function education() {
    if (!p) return
    setPicker({
      title: t('EDITPROFILE.EDUCATION', 'Education'),
      options: L('education'), selectedKey: p.education,
      onPick: async opt => {
        if (opt.key !== p.education && !(await save([{ field: 'QUALIFICATION', value: opt.key, existingValue: p.education }]))) return
        if (isEducationGroupEligible(opt.key)) {
          setBusy(true)
          const groups = await fetchEducationGroupOptionsFlat(opt.key)
          setBusy(false)
          if (groups.length) {
            setPicker({
              title: opt.label,
              options: groups, selectedKey: opt.key === p.education ? p.educationGroup : null,
              onPick: async g => {
                if (g.key !== p.educationGroup) { setBusy(true); await updateFewMoreDetail('EDUDETAILS', g.key); setBusy(false) }
                done()
              },
            })
            return
          }
        } else if (p.educationGroup) {
          await updateFewMoreDetail('EDUDETAILS', '')
        }
        done()
      },
    })
  }

  function occupation() {
    if (!p) return
    setPicker({
      title: t('EDITPROFILE.OCCUPATION', 'Occupation'),
      options: L('occupation'), selectedKey: p.occupation,
      onPick: async opt => {
        if (opt.key !== p.occupation && !(await save([{ field: 'OCCUPATION', value: opt.key, existingValue: p.occupation }]))) return
        if (isJobDetailEligible(opt.key)) {
          setPicker(null)
          jobDetail(opt.key === p.occupation ? (p.jobDetail ?? '') : '')
          return
        }
        if (p.jobDetail) await updateFewMoreDetail('OCCDETAILS', '')
        done()
      },
    })
  }

  function jobDetail(initial: string) {
    openText({
      title: t('EDITPROFILE.OCCUPATION', 'Occupation'),
      label: t('REGISTRATION.JOBDETAIL', 'Job detail'),
      value: initial,
      maxLength: 100,
      validate: v => (v.trim() && !isValidJobDetailFormat(v.trim()) ? t('REGISTRATION.OCCUPATION_TXT', 'Please provide a valid occupation') : undefined),
      onSave: async v => {
        const val = v.trim()
        if (val === (p?.jobDetail ?? '')) return undefined
        setBusy(true)
        const { valid } = await updateFewMoreDetail('OCCDETAILS', val)
        setBusy(false)
        return valid ? undefined : t('REGISTRATION.OCCUPATION_TXT', 'Please provide a valid occupation')
      },
    })
  }

  function income() {
    simple('INCOME', t('EDITPROFILE.INCOME', 'Monthly income'), 'income', p?.income)
  }

  // ── Religious ──
  function religion() {
    if (!p) return
    setPicker({
      title: t('EDITPROFILE.RELIGION', 'Religion'),
      options: L('religion'), selectedKey: p.religion,
      onPick: async opt => {
        if (opt.key === p.religion) { setPicker(null); return }
        if (!(await save([{ field: 'RELIGION', value: opt.key, existingValue: p.religion }]))) return
        // A new religion invalidates the caste — go straight to its caste list.
        caste(opt.key, true)
      },
    })
  }

  async function caste(religionKey = p?.religion ?? '', chained = false) {
    if (!p) return
    setBusy(true)
    const list = await fetchCasteOptions(religionKey, p.motherTongue ?? '')
    setBusy(false)
    if (!list.length) { done(); return }
    setPicker({
      title: t('EDITPROFILE.CASTESUB', 'Caste'),
      options: list, selectedKey: chained ? null : p.caste,
      onPick: async opt => {
        if ((opt.key !== p.caste || chained) && !(await save([{ field: 'CASTE', value: `${opt.key}~`, existingValue: p.caste }]))) return
        // Angular: caste pick → type=subcaste (not for religion 2), then gothra when applicable.
        setBusy(true)
        const [subs, gothraOk] = await Promise.all([
          religionKey !== '2' ? fetchSubcasteOptions(religionKey, opt.key, p.motherTongue ?? '') : Promise.resolve([]),
          isGothraApplicableForCaste(opt.key),
        ])
        setBusy(false)
        const afterSub = () => (gothraOk ? gothra(opt.key) : done())
        if (subs.length) {
          setPicker({
            title: t('REG.SUBCASTE', 'Sub caste'),
            options: subs, selectedKey: opt.key === p.caste ? p.subCaste : null,
            onPick: async sub => {
              if (sub.key !== p.subCaste && !(await save([{ field: 'SUBCASTE', value: `${opt.key}~${sub.key}`, existingValue: p.subCaste }]))) return
              afterSub()
            },
          })
          return
        }
        afterSub()
      },
    })
  }

  // Sub caste on its own row: the current caste's sub-caste list (TYPE 11, "<caste>~<sub>").
  async function subCaste() {
    if (!p || !p.caste) return
    setBusy(true)
    const list = await fetchSubcasteOptions(p.religion ?? '', p.caste, p.motherTongue ?? '')
    setBusy(false)
    if (!list.length) { done(); return }
    setPicker({
      title: t('REG.SUBCASTE', 'Sub caste'),
      options: list, selectedKey: p.subCaste,
      onPick: async opt => {
        if (opt.key !== p.subCaste && !(await save([{ field: 'SUBCASTE', value: `${p.caste}~${opt.key}`, existingValue: p.subCaste }]))) return
        done()
      },
    })
  }

  async function gothra(casteKey: string) {
    if (!p) return
    setBusy(true)
    const list = await fetchGothraOptions(casteKey)
    setBusy(false)
    if (!list.length) { done(); return }
    setPicker({
      title: t('EDITPROFILE.GOTHRAM', 'Gothram'),
      options: list, selectedKey: p.gothram,
      onPick: async opt => {
        if (opt.key !== p.gothram && !(await save([{ field: 'GOTHRA', value: opt.key, existingValue: p.gothram }]))) return
        done()
      },
    })
  }

  function raasi() {
    if (!p) return
    setPicker({
      title: t('EDITPROFILE.RAASI', 'Raasi'),
      options: L('raasi'), selectedKey: p.raasi,
      onPick: async opt => {
        if (opt.key !== p.raasi && !(await save([{ field: 'RAASI', value: opt.key, existingValue: p.raasi }]))) return
        star(opt.key, opt.key !== p.raasi)
      },
    })
  }

  async function star(raasiKey = p?.raasi ?? '', chained = false) {
    if (!p) return
    if (!raasiKey) { raasi(); return }
    setBusy(true)
    const list = await fetchStarOptions(raasiKey)
    setBusy(false)
    setPicker({
      title: t('EDITPROFILE.STAR', 'Star'),
      options: list, selectedKey: chained ? null : p.star,
      onPick: async opt => {
        if (opt.key !== p.star && !(await save([{ field: 'STAR', value: opt.key, existingValue: p.star }]))) return
        done()
      },
    })
  }

  async function dosham() {
    if (!p) return
    setBusy(true)
    const { dosham: yesNo, doshamHash } = await fetchDoshamOptions(p.star ?? '', p.raasi ?? '', p.motherTongue)
    setBusy(false)
    const current = p.doshamType?.[0] ?? p.dosham
    setPicker({
      title: t('EDITPROFILE.DOSHAM', 'Dosham'),
      options: yesNo, selectedKey: p.dosham, hideSearch: true,
      onPick: async opt => {
        // Dosham saves under one TYPE code — the specific type when "Yes", else the Yes/No code.
        if (opt.key === '1' && doshamHash.length) {
          setPicker({
            title: opt.label,
            options: doshamHash, selectedKey: p.doshamType?.[0] ?? null,
            onPick: async type => {
              if (type.key !== current && !(await save([{ field: 'DOSHAM', value: type.key, existingValue: current }]))) return
              done()
            },
          })
          return
        }
        if (opt.key !== current && !(await save([{ field: 'DOSHAM', value: opt.key, existingValue: current }]))) return
        done()
      },
    })
  }

  // ── Lifestyle / Family ──
  function drinking() { simple('DRINKING', t('EDITPROFILE.DRINKING', 'Drinking habits'), 'drinkingHabit', p?.drinkingHabits) }
  function smoking()  { simple('SMOKING',  'Smoking habits', 'smokingHabit', p?.smokingHabits) }
  function eating()   { simple('EATING',   t('EDITPROFILE.EATING', 'Eating habits'), 'eatingHabit', p?.eatingHabits) }
  function brothers() { simple('BROTHERS', t('EDITPROFILE.BROTHERS', 'Brothers'), 'brothers', p?.brothers) }
  function sisters()  { simple('SISTERS',  t('EDITPROFILE.SISTERS', 'Sisters'), 'sisters', p?.sisters) }

  // ── Property (multi-select) — vehicle codes 5/6/7 aren't listed but are kept on save ──
  function properties() {
    if (!p) return
    setMulti({
      title: 'Properties owned',
      options: L('property').filter(o => !VEHICLE_CODES.has(o.key)),
      selectedKeys: p.properties ?? [],
      onApply: async keys => {
        const original = [...(p.properties ?? []), ...(p.vehicles ?? [])]
        const next = [...keys, ...(p.vehicles ?? [])]
        const same = next.length === original.length && next.every(k => original.includes(k))
        if (!same && !(await save([{ field: 'PROPERTIES', value: next.join('~'), existingValue: original.join('~') }]))) return
        done()
      },
    })
  }

  async function submitText() {
    if (!text) return
    const err = text.validate(textValue)
    if (err) { setTextError(err); return }
    Keyboard.dismiss()
    const saveErr = await text.onSave(textValue)
    if (saveErr) { setTextError(saveErr); return }
    done()
  }

  const element = (
    <>
      <SearchablePicker
        visible={!!picker}
        title={picker?.title ?? ''}
        placeholder={t('GENERAL.SEARCH', 'Search')}
        hideSearch={!!picker?.hideSearch}
        options={picker?.options ?? []}
        selectedKey={picker?.selectedKey ?? null}
        onSelect={opt => {
          if (busy || !picker) return
          const cfg = picker
          pickingRef.current = true
          // Close first and run the pick on the next tick, so a chained picker
          // (e.g. City after State) mounts fresh instead of reusing the one
          // that just unmounted itself.
          setPicker(null)
          setTimeout(() => { cfg.onPick(opt) }, 0)
        }}
        onClose={() => {
          if (pickingRef.current) { pickingRef.current = false; return }
          setPicker(null)
          onSaved()   // a chain may have saved earlier steps before being cancelled
        }}
      />
      <MultiSelectPicker
        visible={!!multi}
        title={multi?.title ?? ''}
        options={multi?.options ?? []}
        selectedKeys={multi?.selectedKeys ?? []}
        onApply={keys => { if (!busy) multi?.onApply(keys) }}
        onClose={() => setMulti(null)}
      />
      <BottomSheet visible={!!text} onClose={() => setText(null)} style={kbHeight ? { bottom: kbHeight } : undefined}>
        <Text style={[fe.title, { fontFamily: langFonts.semiBold }]}>{text?.title}</Text>
        <View style={fe.inputWrap}>
          <TextInput
            style={[fe.input, !!textError && fe.inputErr, { fontFamily: langFonts.medium }, mobileWebOutline]}
            value={textValue}
            onChangeText={v => { setTextValue(v); setTextError('') }}
            maxLength={text?.maxLength}
            autoFocus
            autoComplete="off"
            returnKeyType="done"
            onSubmitEditing={submitText}
          />
          <View style={fe.floatLabel} pointerEvents="none">
            <Text style={[fe.floatLabelText, { fontFamily: langFonts.regular }]}>{text?.label}</Text>
          </View>
        </View>
        {!!textError && <Text style={[fe.error, { fontFamily: langFonts.regular }]}>{textError}</Text>}
        <Pressable style={[fe.saveBtn, busy && fe.saveBtnBusy]} onPress={submitText} disabled={busy} accessibilityRole="button">
          {busy ? <ActivityIndicator color={Colors.white} /> : (
            <Text style={[fe.saveBtnText, { fontFamily: langFonts.medium }]}>{t('GENERAL.SAVE_CHANGES', 'Save changes')}</Text>
          )}
        </Pressable>
      </BottomSheet>
      {busy && !text && (
        <View style={fe.busyOverlay} pointerEvents="auto">
          <ActivityIndicator color={Colors.primaryDark} size="large" />
        </View>
      )}
    </>
  )

  return {
    element,
    open: {
      name, maritalStatus, noOfChildren: () => noOfChildren(false), physicalStatus, motherTongue,
      location: () => location(false), homeTown: () => location(true),
      education, occupation, income,
      religion, caste: () => caste(), subCaste, gothram: () => gothra(p?.caste ?? ''), raasi, star: () => star(), dosham,
      drinking, smoking, eating, brothers, sisters, properties,
    },
  }
}

const fe = StyleSheet.create({
  title: { fontSize: FontSize.font16, lineHeight: 24, color: Colors.black, marginBottom: 24 },
  inputWrap: { position: 'relative' },
  input: {
    height: 48, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8, paddingHorizontal: 12,
    fontSize: FontSize.font14, color: Colors.textPrimary, backgroundColor: Colors.white,
  },
  inputErr: { borderColor: Colors.inputError },
  floatLabel: { position: 'absolute', top: -9, left: 10, backgroundColor: Colors.white, paddingHorizontal: 4 },
  floatLabelText: { fontSize: FontSize.font12, lineHeight: 16, color: Colors.textSecondary },
  error: { marginTop: 8, fontSize: FontSize.font12, lineHeight: 16, color: Colors.inputError },
  saveBtn: {
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  saveBtnBusy: { opacity: 0.7 },
  saveBtnText: { fontSize: FontSize.font14, lineHeight: 20, color: Colors.white },
  busyOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.4)',
  },
})

// Fields that can be opened directly via the EditProfile route's `openField` param.
export type EditOpenField =
  | 'name' | 'maritalStatus' | 'noOfChildren' | 'physicalStatus' | 'motherTongue'
  | 'location' | 'homeTown' | 'education' | 'occupation' | 'income'
  | 'religion' | 'caste' | 'subCaste' | 'gothram' | 'raasi' | 'star' | 'dosham'
  | 'drinking' | 'smoking' | 'eating' | 'brothers' | 'sisters' | 'properties'
  | 'age' | 'height' | 'horoscope'

// ─── EditProfileScreen ────────────────────────────────────────────────────────

export default function EditProfileScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
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
  // New design: Age / Height edit in place via bottom sheets (EditAgeHeightSheets in EditProfileAgeHeightScreen.tsx)
  // (the old full-page Age/Height screen was removed).
  const [ageHeightSheet, setAgeHeightSheet] = useState<AgeHeightSheetMode>(null)
  // Mobile number edit → OTP → verified (MobileEditSheets below). No edit limit.
  const [mobileSheetVisible, setMobileSheetVisible] = useState(false)
  // "Profile preview" (new design): same screen, read-only-looking layout —
  // full-width photo carousel + Paid Member / Verified badges + name / Jodi ID,
  // then the same detail sections. Rendered in place (no navigation), so back
  // simply returns to Edit Profile.
  const [previewMode, setPreviewMode]   = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [badges, setBadges] = useState({ paid: false, verified: false })
  const previewModeRef = useRef(false)
  previewModeRef.current = previewMode
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [genderAvatarUrl, setGenderAvatarUrl] = useState('')
  // Photo failed to load (broken URL / still processing) — fall back to the
  // gender avatar instead of a blank tile, same as an empty slot.
  const [failedPhotos, setFailedPhotos] = useState<Set<number>>(new Set())
  const [toastRequest, setToastRequest] = useState<ToastRequest | null>(null)
  // One deferred delete tracked at a time — see handleConfirmDeletePhoto().
  const pendingDeleteRef = useRef<{ photo: any; index: number; timer: ReturnType<typeof setTimeout> } | null>(null)

  // Leaving the screen inside the undo window: commit the delete right away
  // rather than dropping it.
  useEffect(() => () => {
    const pending = pendingDeleteRef.current
    if (pending) {
      clearTimeout(pending.timer)
      pendingDeleteRef.current = null
      deletePhoto(pending.photo.PHOTOID)
    }
  }, [])

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
      showUploadToast(uploadedPhotoIds)
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
    // A delete still inside its undo window hasn't hit the API yet — keep it hidden.
    // Paid Member: session ENTRYTYPE outside the free/basic tiers (same rule as
    // homeService's isPaidMember). Verified: EKYCSTATUS '1' (Angular badge rule).
    Promise.all([getSessionValue('ENTRYTYPE'), getItem(SK.Verification.EKYC_STATUS)]).then(([entryType, ekyc]) => {
      setBadges({
        paid:     !!entryType && !['F', 'B'].includes(String(entryType)),
        verified: String(ekyc ?? '') === '1',
      })
    })
    const pendingId = pendingDeleteRef.current?.photo.PHOTOID
    setPhotos(pendingId ? photoData.photos.filter((p: any) => p.PHOTOID !== pendingId) : photoData.photos)
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

    const [caste, star, cities, homeCities, educationGroup, subCaste, exactHeight, gothram] = await Promise.all([
      info.religion ? fetchCasteOptions(info.religion, info.motherTongue ?? '') : Promise.resolve([]),
      info.raasi ? fetchStarOptions(info.raasi) : Promise.resolve([]),
      info.state ? fetchCities(info.state) : Promise.resolve([]),
      info.homeState ? fetchCities(info.homeState) : Promise.resolve([]),
      (info.education && isEducationGroupEligible(info.education)) ? fetchEducationGroupOptionsFlat(info.education) : Promise.resolve([]),
      // Sub caste / Gothram rows only exist when the member's caste has them —
      // an empty list hides the row (Angular: 'no subcaste' / GOTHRAAVAILCASTE).
      (info.caste && info.religion && info.religion !== '2')
        ? fetchSubcasteOptions(info.religion, info.caste, info.motherTongue ?? '') : Promise.resolve([]),
      hasExactHeight(info) ? fetchExactHeightOptions(gender) : Promise.resolve([]),
      info.caste
        ? isGothraApplicableForCaste(info.caste).then(ok => (ok ? fetchGothraOptions(info.caste!) : []))
        : Promise.resolve([]),
    ])

    setLabels({
      religion, occupation, education, motherTongue,
      eatingHabit, drinkingHabit, smokingHabit, raasi, income, property, states,
      caste, star, cities, homeCities, educationGroup, subCaste, exactHeight, gothram,
      heightCategory, maritalStatus, physicalStatus,
      brothers: familyOptions.brothers, sisters: familyOptions.sisters,
    })
    setCreatedByLabel(createdByList.find(o => o.key === info.createdBy)?.label)
    setHomeTownVisible(await isHomeTownMotherTongue(info.motherTongue ?? ''))
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  // Direct right-side-panel editing for every row (no intermediate group screen).
  const editor = useFieldEditor({ profile, labels, onSaved: load })
  // One-time-editable fields: locked → "contact Customer Support" sheet, else the editor.
  const guard = (editable: boolean, open: () => void) => () => (editable ? open() : setFieldRestrictedVisible(true))

  // Back from Edit Profile ALWAYS lands on Menu. A plain goBack() could return
  // to Profile preview instead (e.g. Edit Profile → preview → back → preview →
  // back left extra history entries on web), so jump to Menu explicitly:
  // popTo() goes back to Menu if it's already in the stack (dropping every
  // preview / edit-profile entry above it) and otherwise replaces this screen
  // with Menu (Edit Profile opened from Home / sidebar).
  const goToMenu = useCallback(() => {
    navigation.popTo('Menu')
  }, [navigation])

  // Android hardware back → same Menu redirect while this screen is focused.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // In Profile preview, back returns to Edit Profile first.
      if (previewModeRef.current) { setPreviewMode(false); return true }
      goToMenu()
      return true
    })
    return () => sub.remove()
  }, [goToMenu]))

  // The Photo Guidelines screen's "Continue to upload photo" CTA sends us back
  // here with this flag (Angular calls the native picker directly from that
  // page; ours lives on this screen). Cleared immediately so returning to this
  // screen any other way — or a re-render — doesn't reopen the picker.
  // Deep links into a single field (Biodata "Add" links, own-profile "complete
  // your profile" banner, post-login page landing): open that field's editor
  // straight away once the profile + option lists have loaded — replaces the
  // old per-group intermediate screens. Cleared immediately so a re-render or
  // coming back to this screen doesn't reopen it.
  const openField: EditOpenField | undefined = route?.params?.openField
  useEffect(() => {
    if (!openField || loading || !profile) return
    navigation.setParams({ openField: undefined })
    // Astro fields aren't shown for Muslim religions — don't open them either.
    if (['raasi', 'star', 'dosham', 'horoscope'].includes(openField) && !showReligiousDetails(profile.religion)) return
    const id = setTimeout(() => {
      const o = editor.open
      switch (openField) {
        case 'name':         return guard(profile.nameEditable, o.name)()
        case 'motherTongue': return guard(profile.motherTongueEditable, o.motherTongue)()
        case 'income':       return guard(profile.incomeEditable, o.income)()
        case 'religion':     return guard(profile.religionEditable, o.religion)()
        case 'caste':        return guard(profile.casteEditable, o.caste)()
        case 'subCaste':     return guard(profile.casteEditable || !profile.subCaste, o.subCaste)()
        case 'age':          return profile.ageEditable ? setAgeHeightSheet('age') : setFieldRestrictedVisible(true)
        case 'height':       return setAgeHeightSheet('height')
        case 'horoscope':
          if (!profile.horoscopeAvailable) navigation.navigate('onboarding', { pageNo: '29', standalone: true, fromEditProfile: true })
          return
        default:             return o[openField]()
      }
    }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openField, loading, profile])

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
        showUploadToast(uploadedPhotoIds)
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

  // ── Photo toasts (new design: dark snackbar + Undo) ──────────────────────

  // Upload: Undo removes the photo(s) that were just added.
  function showUploadToast(uploadedPhotoIds: string[]) {
    if (uploadedPhotoIds.length === 0) return
    setToastRequest({
      message: t('EDITPROFILE.PHOTO_UPDATED_TOAST', 'Profile photo updated successfully'),
      key: Date.now(),
      onUndo: () => {
        Promise.all(uploadedPhotoIds.map(id => deletePhoto(id))).then(() => load())
      },
    })
  }

  // "Use as profile photo" from the viewer: Undo restores the previous main photo.
  function handleMainPhotoSet(previousMainId: string | undefined) {
    setToastRequest({
      message: t('EDITPROFILE.PHOTO_UPDATED_TOAST', 'Profile photo updated successfully'),
      key: Date.now(),
      onUndo: previousMainId ? () => { setMainPhoto(previousMainId).then(() => load()) } : undefined,
    })
  }

  // Same flow as EditProfileDesktopScreen's handleConfirmDeletePhoto(): the
  // photo disappears immediately, but deletePicture/v1 only fires once the
  // undo window passes, so Undo can put it back without any API call.
  // Called once the member has already confirmed in Photo preview's delete sheet.
  function handleConfirmDeletePhoto(target: any) {

    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timer)
      const prev = pendingDeleteRef.current
      pendingDeleteRef.current = null
      deletePhoto(prev.photo.PHOTOID).then(() => load())
    }

    const removedIndex = Math.max(0, photos.findIndex(p => p.PHOTOID === target.PHOTOID))
    setPhotos(prev => prev.filter(p => p.PHOTOID !== target.PHOTOID))
    setFailedPhotos(new Set())

    const timer = setTimeout(() => {
      pendingDeleteRef.current = null
      deletePhoto(target.PHOTOID).then(() => load())
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

  function openPreview() {
    setPreviewIndex(0)
    setPreviewMode(true)
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

  // "State, City" (e.g. "Tamil Nadu, Chennai") — whichever parts resolve.
  const cityLabel     = [labelFor(labels.states ?? [], profile.state), labelFor(labels.cities ?? [], profile.city)]
    .filter(Boolean).join(', ') || undefined
  const homeCityLabel = labelFor(labels.homeCities ?? [], profile.homeCity) ?? labelFor(labels.states ?? [], profile.homeState)
  // "EDUCATION, EDUDETAILS" / "OCCUPATION, OCCDETAILS". EDUDETAILS is a group
  // code (resolved to its label); OCCDETAILS is the member's free-text job detail.
  const educationLabel  = [labelFor(labels.education ?? [], profile.education), labelFor(labels.educationGroup ?? [], profile.educationGroup)]
    .filter(Boolean).join(', ') || undefined
  const occupationLabel = [labelFor(labels.occupation ?? [], profile.occupation), profile.jobDetail?.trim()]
    .filter(Boolean).join(', ') || undefined
  // Angular's edit-profile.page.html has exactly one "Properties owned" row —
  // codes '5'/'6'/'7' are explicitly excluded from it (comment: "remove
  // vehicle related changes"), never shown as their own "Own Vehicle" row —
  // see PropertyDetailsScreen.tsx's header comment for the full story.
  const propertiesLabel = labelsFor(labels.property ?? [], profile.properties)

  // Angular getHeightValue(): a valid HEIGHT outside 101-104 is an exact height
  // (VIEWHEIGHT label, e.g. "5 ft 2 in (157 cm)"); otherwise the 101-104 bucket
  // label. Same rule decides which editor the Height row opens. Category labels
  // carry raw HTML from the API (same quirk HeightScreen.tsx strips).
  const catCode = heightCategoryCode(profile)
  const heightLabel = hasExactHeight(profile)
    ? (labelFor(labels.exactHeight ?? [], profile.height) ?? profile.height)
    : catCode ? labelFor(labels.heightCategory ?? [], catCode)?.replace(/<[^>]+>/g, '').trim() : undefined
  const childrenVisible = !!profile.maritalStatus && profile.maritalStatus !== '1'

  return (
    <View style={s.screen}>
      <ScreenTopInset />
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={previewMode ? () => setPreviewMode(false) : goToMenu} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={[s.headerTitle, { fontFamily: langFonts.medium }]} numberOfLines={1}>
          {previewMode ? t('VIEWPROFILE.PROFILE_PREVIEW', 'Profile preview') : t('EDITPROFILE.EDIT_PROFILE')}
        </Text>
      </View>

      <ScrollView key={previewMode ? 'preview' : 'edit'} contentContainerStyle={[s.scrollContent, previewMode && s.scrollContentPreview, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>

        {previewMode ? (
          <>
            {/* ── Profile preview header: carousel, badges, name, Jodi ID ── */}
            <View style={[s.pvCarousel, { width: windowWidth, height: Math.round(windowWidth * 0.8) }]}>
              {photos.length > 0 ? (
                <FlatList
                  data={photos}
                  keyExtractor={(p: any, i) => String(p.PHOTOID ?? i)}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={16}
                  getItemLayout={(_, i) => ({ length: windowWidth, offset: windowWidth * i, index: i })}
                  onScroll={e => {
                    const i = Math.round(e.nativeEvent.contentOffset.x / windowWidth)
                    if (i !== previewIndex && photos[i]) setPreviewIndex(i)
                  }}
                  renderItem={({ item }: { item: any }) => (
                    <Image
                      source={{ uri: item.PHOTOURL || item.PHOTOTHUMB }}
                      style={{ width: windowWidth, height: Math.round(windowWidth * 0.8) }}
                      contentFit="cover"
                    />
                  )}
                />
              ) : (
                !!genderAvatarUrl && <CdnSvg uri={genderAvatarUrl} width={windowWidth} height={Math.round(windowWidth * 0.8)} />
              )}
              {photos.length > 1 && (
                <View style={s.pvDots} pointerEvents="none">
                  {photos.map((p: any, i: number) => (
                    <View key={String(p.PHOTOID ?? i)} style={[s.pvDot, i === previewIndex && s.pvDotActive]} />
                  ))}
                </View>
              )}
            </View>

            <View style={s.pvIdentity}>
              {(badges.paid || badges.verified) && (
                <View style={s.pvBadgeRow}>
                  {badges.paid && (
                    <Badge variant="paid" text={t('MENU.PAID_BADGE', 'Paid Member')} imageUrl={ICON_PAID_TAG} style={s.pvPaidBadge} labelStyle={{ fontFamily: langFonts.semiBold }} />
                  )}
                  {badges.verified && (
                    <Badge variant="verified" text={t('MATCHES.VERIFIED_ID', 'Verified')} imageUrl={ICON_VERIFIED_TAG} labelStyle={{ fontFamily: langFonts.semiBold }} />
                  )}
                </View>
              )}
              <Text style={[s.pvName, { fontFamily: langFonts.bold }]} numberOfLines={2}>{profile.name}</Text>
              <Text style={[s.pvId, { fontFamily: langFonts.regular }]}>{`${t('EDITPROFILE.JODIIID', 'BharatJodii ID')}: ${ownId}`}</Text>
            </View>
          </>
        ) : (<>

        {/* ── Photo ── */}
        <View style={s.photoHeaderRow}>
          <View style={s.photoTitleRow}>
            <Text style={[s.sectionTitle, s.photoTitleText, { fontFamily: langFonts.bold }]}>{t('EDITPROFILE.PHOTOS')}</Text>
            {photos.length === 0 && <CdnSvg uri={ICON_MISS_WARN} width={MISS_WARN_W} height={MISS_WARN_H} />}
          </View>
          <Pressable
            style={s.photoPrivacyBtn}
            onPress={() => (photos.length > 0 ? setPhotoPrivacyVisible(true) : openGalleryPicker())}
            hitSlop={8}
          >
            <CdnSvg uri={ICON_PRIVACY} width={PRIVACY_ICON_SIZE} height={PRIVACY_ICON_SIZE} />
            <Text style={[s.photoPrivacyLink, { fontFamily: langFonts.medium }]}>{t('EDITPROFILE.PHOTO_PRIVACY')}</Text>
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
                <Text style={[s.photoAddText, { fontFamily: langFonts.medium }]}>{t('NOTIFICATION.ADDPHOTO_CTA', 'Add Photo')}</Text>
              </>
            )}
          </Pressable>
        ) : (() => {
          // Photos only — no dashed Add tile in the mosaic once there's at least
          // one photo (the big Add Photo box above is the empty state). Adding
          // more goes through the "Add more photos" CTA under the grid.
          const overflowCount = photos.length - GRID_MAX_TILES   // > 0 → "+N more" on tile 6
          const gridPhotos = photos.slice(0, GRID_MAX_TILES)
          // One photo: it fills the same full-width square as the empty
          // "Add Photo" box instead of sitting at main-tile size on the left.
          const singlePhoto = gridPhotos.length === 1
          return (
            <View style={[s.photoGrid, { width: mosaic.size, height: singlePhoto ? mosaic.size : mosaicHeight(gridPhotos.length, mosaic) }]}>
              {gridPhotos.map((photo, i) => {
                const pos = photoSlotPosition(i, mosaic)
                const size = singlePhoto ? mosaic.size : i === 0 ? mosaic.main : mosaic.tile
                const failed = failedPhotos.has(i)
                const isOverflowTile = overflowCount > 0 && i === GRID_MAX_TILES - 1
                return (
                  <Pressable key={photo.PHOTOID ?? i} style={[s.photoTile, i === 0 && photo.PHOTOSTATUS == 1 && s.photoTileMain, singlePhoto && s.photoTileSingle, pos, { width: size, height: size }]} onPress={() => setViewerIndex(i)}>
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
                    {i === 0 && photo.PHOTOSTATUS == 1 && (
                      <View style={s.mainPhotoBadge}>
                        <Text style={[s.mainPhotoBadgeText, { fontFamily: langFonts.medium }]}>{t('EDITPROFILE.PROFILE_PHOTO')}</Text>
                      </View>
                    )}
                    {isOverflowTile && (
                      <View style={s.photoMoreOverlay}>
                        <Text style={[s.photoMoreText, { fontFamily: langFonts.medium }]}>{`+${overflowCount}\n${t('MATCHES.MORE', 'more')}`}</Text>
                      </View>
                    )}
                  </Pressable>
                )
              })}
            </View>
          )
        })()}

        {/* ── View photo guidelines ──
            Angular: edit-profile.page.html:160-167 — a `mt-16` row sitting
            directly under the photo grid, no gender/photo-count gate. */}
        <Pressable style={s.guidelinesRow} onPress={openPhotoGuidelines} hitSlop={8} accessibilityRole="button">
          <CdnSvg uri={ICON_GUIDELINES} width={GUIDELINES_ICON} height={GUIDELINES_ICON} />
          <Text style={[s.guidelinesText, { fontFamily: langFonts.medium }]}>{t('GENERAL.VIEW_GUIDELINE')}</Text>
        </Pressable>

        {/* ── Add more photos (secondary CTA) — replaces the old dashed
            "Add More" grid tile; shown whenever there's at least one photo
            and the MAX_PHOTOS cap isn't reached yet. */}
        {photos.length > 0 && photos.length < MAX_PHOTOS && (
          <Pressable
            style={({ pressed }) => [s.addMoreCta, pressed && s.addPhotoBtnPressed]}
            onPress={openGalleryPicker}
            disabled={photoUploading}
            accessibilityRole="button"
          >
            {photoUploading ? <ActivityIndicator color={Colors.primaryDark} size="small" /> : (
              <>
                <Text style={[s.addMoreCtaPlus, { fontFamily: langFonts.regular }]}>+</Text>
                <Text style={[s.addMoreCtaText, { fontFamily: langFonts.medium }]}>{t('EDITPROFILE.ADD_MORE_PHOTOS', 'Add more photos')}</Text>
              </>
            )}
          </Pressable>
        )}

        </>)}

        {/* ── Basic details ── */}
        <Section title={t('EDITPROFILE.BASIC_DETAILS')} style={previewMode ? s.pvFirstSection : undefined}>
          {/* New alignment: ID, Profile created for, Name, Mobile number first. */}
          {/* Preview already shows the name + Jodi ID under the photo — skip the duplicate rows. */}
          {!previewMode && (
            <FieldRow label={t('EDITPROFILE.JODIIID')} value={ownId} onPress={() => {}} hideArrow icon={R_ICON.jodiiId} showDivider />
          )}
          <FieldRow label={t('EDITPROFILE.CREATEDFOR')} value={createdByLabel} onPress={() => {}} hideArrow icon={R_ICON.createdBy} showDivider />
          {!previewMode && (
            <FieldRow label={t('EDITPROFILE.NAME')} value={profile.name} onPress={guard(profile.nameEditable, editor.open.name)} icon={R_ICON.name} showDivider />
          )}
          {!previewMode && (
            <FieldRow label={t('EDITPROFILE.MOBILENO')} value={profile.mobileNo} onPress={() => setMobileSheetVisible(true)} icon={R_ICON.mobileNo} showDivider />
          )}
          <FieldRow label={t('EDITPROFILE.AGE')} value={profile.age ? `${profile.age} years old` : undefined} onPress={() => (profile.ageEditable ? setAgeHeightSheet('age') : setFieldRestrictedVisible(true))} icon={R_ICON.age} showDivider />
          <FieldRow label={t('EDITPROFILE.HEIGHT')} value={heightLabel} onPress={() => setAgeHeightSheet('height')} icon={R_ICON.height} showDivider />
          <FieldRow
            label={t('EDITPROFILE.MARITALSTATUS')}
            value={labelFor(labels.maritalStatus ?? [], profile.maritalStatus)}
            onPress={editor.open.maritalStatus}
            icon={R_ICON.maritalStatus}
            showDivider
          />
          {childrenVisible && (
            <FieldRow
              label={t('BIO_DATA.NO_OF_CHILDREN')}
              value={labelFor(CHILDREN_OPTIONS, profile.noOfChildren)}
              onPress={editor.open.noOfChildren}
              icon={R_ICON.children}
              showDivider
            />
          )}
          <FieldRow
            label={t('EDITPROFILE.PHYSICALSTATUS')}
            value={labelFor(labels.physicalStatus ?? [], profile.physicalStatus)}
            onPress={editor.open.physicalStatus}
            icon={R_ICON.physicalStatus}
            showDivider
          />
          <FieldRow label={t('EDITPROFILE.MOTHERTONGUE')} value={labelFor(labels.motherTongue ?? [], profile.motherTongue)} onPress={guard(profile.motherTongueEditable, editor.open.motherTongue)} icon={R_ICON.motherTongue} showDivider />
          <FieldRow label={t('EDITPROFILE.CURRENT_LOCATION')} value={cityLabel} onPress={editor.open.location} icon={R_ICON.location} showDivider={homeTownVisible} />
          {homeTownVisible && (
            <FieldRow label={t('BIO_DATA.HOME_TOWN')} value={homeCityLabel} onPress={editor.open.homeTown} icon={R_ICON.hometown} />
          )}
        </Section>

        {/* ── Professional details ── */}
        <Section title="Professional details">
          <FieldRow label={t('EDITPROFILE.EDUCATION')} value={educationLabel} onPress={editor.open.education} icon={R_ICON.education} showDivider />
          <FieldRow label={t('EDITPROFILE.OCCUPATION')} value={occupationLabel} onPress={editor.open.occupation} icon={R_ICON.occupation} showDivider />
          <FieldRow label={t('EDITPROFILE.INCOME')} value={labelFor(labels.income ?? [], profile.income) ?? profile.income} onPress={guard(profile.incomeEditable, editor.open.income)} icon={R_ICON.income} />
        </Section>

        {/* ── Religious details ── */}
        <Section title={t('EDITPROFILE.RELIGIOUSDETAIL')}>
          <FieldRow label={t('EDITPROFILE.RELIGION')} value={labelFor(labels.religion ?? [], profile.religion)} onPress={guard(profile.religionEditable, editor.open.religion)} icon={R_ICON.religion} showDivider />
          <FieldRow label={t('REG.CASTE', 'Caste')} value={labelFor(labels.caste ?? [], profile.caste)} onPress={guard(profile.casteEditable, editor.open.caste)} icon={R_ICON.caste} showDivider />
          {/* Only when the caste has sub-castes / a gothram list (see load()).
              Sub caste follows the caste's one-time-edit lock only once a sub caste
              is actually saved — picking the caste uses up CASTEEDIT, and a member
              who closed the sub-caste panel without choosing must still be able
              to add it afterwards. */}
          {(labels.subCaste?.length ?? 0) > 0 && (
            <FieldRow label={t('REG.SUBCASTE', 'Sub caste')} value={labelFor(labels.subCaste ?? [], profile.subCaste)} onPress={guard(profile.casteEditable || !profile.subCaste, editor.open.subCaste)} icon={R_ICON.caste} showDivider />
          )}
          {(labels.gothram?.length ?? 0) > 0 && (
            <FieldRow label={t('EDITPROFILE.GOTHRAM', 'Gothram')} value={labelFor(labels.gothram ?? [], profile.gothram)} onPress={editor.open.gothram} icon={R_ICON.gothram} showDivider />
          )}
          {/* Star / Raasi / Dosham / Horoscope don't apply to Muslim religions
              (codes 3/4/5) — same rule as Angular's showReligiousDetails. */}
          {showReligiousDetails(profile.religion) && (<>
            <FieldRow
              label={t('EDITPROFILE.STAR')}
              value={labelFor(labels.star ?? [], profile.star)}
              missingText={t('EDITPROFILE.ADDYOURSTAR')}
              icon={R_ICON.star}
              onPress={editor.open.star}
              showDivider
            />
            <FieldRow
              label={t('EDITPROFILE.RAASI')}
              value={labelFor(labels.raasi ?? [], profile.raasi)}
              missingText={t('EDITPROFILE.ADDYOURRAASI')}
              icon={R_ICON.raasi}
              onPress={editor.open.raasi}
              showDivider
            />
            <FieldRow
              label={t('EDITPROFILE.DOSHAM')}
              value={profile.dosham === '1' ? 'Yes' : profile.dosham === '2' ? 'No' : undefined}
              missingText={t('EDITPROFILE.ADDYOURDOSHAM')}
              icon={R_ICON.dosham}
              onPress={editor.open.dosham}
              showDivider
            />
            <FieldRow
              label={t('EDITPROFILE.HOROSCOPE')}
              value={profile.horoscopeAvailable
                ? `${t('EDITPROFILE.ADDEDON')}${profile.horoInfo?.birthDay ? ` ${profile.horoInfo.birthDay}` : ''}`
                : undefined}
              icon={R_ICON.horoscope}
              // Same "Generate horoscope" step as registration (onboarding 29), in
              // edit-profile mode so the flow returns here when done or skipped.
              onPress={() => !profile.horoscopeAvailable && navigation.navigate('onboarding', { pageNo: '29', standalone: true, fromEditProfile: true })}
              hideArrow={!!profile.horoscopeAvailable}
            />
          </>)}
        </Section>

        {/* ── Life style details ── */}
        <Section title="Life style details">
          <FieldRow label={t('EDITPROFILE.DRINKING')} value={labelFor(labels.drinkingHabit ?? [], profile.drinkingHabits)} onPress={editor.open.drinking} icon={R_ICON.drinking} showDivider />
          <FieldRow label="Smoking habits" value={labelFor(labels.smokingHabit ?? [], profile.smokingHabits)} onPress={editor.open.smoking} icon={R_ICON.smoking} showDivider />
          <FieldRow label={t('EDITPROFILE.EATING')} value={labelFor(labels.eatingHabit ?? [], profile.eatingHabits)} onPress={editor.open.eating} icon={R_ICON.eating} />
        </Section>

        {/* ── Family details ── */}
        <Section title={t('EDITPROFILE.FAMILYDETAILS')}>
          <FieldRow
            label={t('EDITPROFILE.BROTHERS')}
            value={labelFor(labels.brothers ?? [], profile.brothers)}
            onPress={editor.open.brothers}
            icon={R_ICON.brothers}
            showDivider
          />
          <FieldRow
            label={t('EDITPROFILE.SISTERS')}
            value={labelFor(labels.sisters ?? [], profile.sisters)}
            onPress={editor.open.sisters}
            icon={R_ICON.sisters}
          />
        </Section>

        {/* ── Property details ── */}
        <Section title="Property details">
          <FieldRow label="Properties owned" value={propertiesLabel} onPress={editor.open.properties} icon={R_ICON.properties} />
        </Section>

      </ScrollView>

      {/* Sticky footer CTA — Edit Profile: "Profile preview"; Profile preview:
          "Download Biodata for FREE" → the Biodata screen (same route Menu's
          redirectToBioData uses). */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {previewMode ? (
          <Pressable style={s.previewBtn} onPress={() => navigation.navigate('Biodata')} accessibilityRole="button">
            <Text style={[s.previewBtnText, { fontFamily: langFonts.medium }]}>{t('BIO_DATA.BIODATA_DOWNLOAD_FREE', 'Download Biodata for FREE')}</Text>
          </Pressable>
        ) : (
          <Pressable style={s.previewBtn} onPress={openPreview} accessibilityRole="button">
            <Text style={[s.previewBtnText, { fontFamily: langFonts.medium }]}>{t('VIEWPROFILE.PROFILE_PREVIEW')}</Text>
          </Pressable>
        )}
      </View>

      <PhotoPrivacySheet
        visible={photoPrivacyVisible}
        onClose={() => setPhotoPrivacyVisible(false)}
      />

      <FieldRestrictedSheet
        visible={fieldRestrictedVisible}
        onClose={() => setFieldRestrictedVisible(false)}
      />

      {editor.element}

      <MobileEditSheets
        visible={mobileSheetVisible}
        currentMobile={profile.mobileNo}
        onClose={() => setMobileSheetVisible(false)}
        onVerified={load}
      />

      <EditAgeHeightSheets
        mode={ageHeightSheet}
        profile={profile}
        onClose={() => setAgeHeightSheet(null)}
        onSaved={load}
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
        onDeleteRequest={handleConfirmDeletePhoto}
        onMainPhotoSet={handleMainPhotoSet}
      />
      <Toast request={toastRequest} />

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

// ─── Mobile number edit (new design) ──────────────────────────────────────────
// Angular: edit-profile "Contact details" row → goToEditScreen('26') →
// registration.page.ts varPageType '26' (editmobileno) → page 18 (verifymobno).
// No one-time lock — the number can be changed any number of times.
//   1. "Enter mobile number" sheet → editprofileupdate TYPE=19
//      (VALUE=new, EXISTINGVALUE=old, &MCODE=<country code>). Server sends the OTP.
//      Failure → RESPONSE.MSG or REG.NUMBEREXISTS.
//   2. "Enter OTP" sheet → login/verifyotp/v1 with Angular's OTPVerify() params
//      (ID, OTP, REGISTERID, DEVICEDETAIL, APPVERSION, FROMPAGE=REGISTER, MCODE,
//      DEVICEID, NALLOW). Wrong OTP → REG.OTPERROR. Resend → resendotp
//      (ID, MOBILENO, MCODE), daily limit enforced by resendOTP().
//   3. Success → OTPSuccessSheet ("Your OTP is verified successfully!").
const MOBILE_OTP_LENGTH  = 4
const MOBILE_OTP_SECONDS = 59   // Angular resendotpTimer
const ICON_EDIT_PENCIL   = CDN_REG + 'edit-pencil.svg'
const ICON_CC_ARROW      = CDN_REVAMP + 'down-arrow.svg'
const mobileWebOutline   = { outlineStyle: 'none', outlineWidth: 0 } as any

// MOBILENO comes back as "+91-9876543210" / "91-9876543210" / "9876543210".
function splitMobile(raw: string | undefined, fallbackCode: string): { code: string; number: string } {
  const str = (raw ?? '').trim()
  const m = str.match(/^\+?(\d{1,4})[-\s]+(\d+)$/)
  if (m) return { code: m[1]!, number: m[2]! }
  const d = str.replace(/\D/g, '')
  return { code: fallbackCode, number: d.length > 10 && d.startsWith(fallbackCode) ? d.slice(fallbackCode.length) : d }
}

function MobileEditSheets({ visible, currentMobile, onClose, onVerified }: {
  visible: boolean
  currentMobile: string | undefined
  onClose: () => void
  onVerified: () => void
}) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  const [step, setStep]         = useState<'number' | 'otp' | 'success' | null>(null)
  const [country, setCountry]   = useState<Country>(COUNTRIES[0])
  const [ccOpen, setCcOpen]     = useState(false)
  const [original, setOriginal] = useState({ code: '91', number: '' })
  const [mobile, setMobile]     = useState('')
  const [error, setError]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [otp, setOtp]           = useState<string[]>(Array(MOBILE_OTP_LENGTH).fill(''))
  const [seconds, setSeconds]   = useState(0)
  const [info, setInfo]         = useState('')
  const otpRefs = useRef<Array<TextInput | null>>([])

  // Keep the number / OTP sheet above the keyboard. BottomSheet's Modal is
  // statusBarTranslucent, so Android doesn't resize the window for it — the
  // number pad was covering the whole sheet (input + Get OTP).
  const [kbHeight, setKbHeight] = useState(0)
  useEffect(() => {
    if (Platform.OS === 'web') return
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvt, e => setKbHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])
  const kbLift = kbHeight ? { bottom: kbHeight } : undefined

  // Open → prefill the number step from the current number.
  useEffect(() => {
    if (!visible) { setStep(prev => (prev === 'success' ? prev : null)); return }
    let cancelled = false
    ;(async () => {
      const mcode = (await getItem(SK.User.MEMBER_CODE)) ?? '91'
      if (cancelled) return
      const cur = splitMobile(currentMobile, mcode)
      setOriginal(cur)
      setCountry(COUNTRIES.find(c => c.code === cur.code) ?? COUNTRIES[0])
      setMobile(cur.number)
      setError(''); setInfo(''); setCcOpen(false)
      setStep('number')
    })()
    return () => { cancelled = true }
  }, [visible, currentMobile])

  // Resend countdown
  useEffect(() => {
    if (step !== 'otp' || seconds <= 0) return
    const id = setTimeout(() => setSeconds(x => x - 1), 1000)
    return () => clearTimeout(id)
  }, [step, seconds])

  const numberValid   = isValidMobile(mobile, country)
  const numberChanged = mobile !== original.number || country.code !== original.code

  async function handleGetOtp() {
    if (!numberValid || !numberChanged || busy) return
    setBusy(true); setError('')
    try {
      const res = await updateProfile('19', mobile, original.number, `&MCODE=${country.code}`)
      if (res?.ERRCODE == 0 && res?.RESPONSECODE == 1) {
        const mcode = String(res?.RESPONSE?.MCODE ?? country.code)
        setCountry(COUNTRIES.find(c => c.code === mcode) ?? country)
        setOtp(Array(MOBILE_OTP_LENGTH).fill(''))
        setSeconds(MOBILE_OTP_SECONDS)
        setInfo('')
        setStep('otp')
        setTimeout(() => otpRefs.current[0]?.focus(), 350)
      } else {
        setError(res?.RESPONSE?.MSG || t('REG.NUMBEREXISTS', 'Number already exists'))
      }
    } catch {
      setError(t('GENERAL.NOINTERNET', 'No internet connection'))
    } finally {
      setBusy(false)
    }
  }

  function handleOtpChange(text: string, i: number) {
    const digits = text.replace(/\D/g, '')
    const next = [...otp]
    if (digits.length > 1) {
      // paste / SMS autofill — spread across the boxes
      digits.slice(0, MOBILE_OTP_LENGTH).split('').forEach((d, k) => { next[k] = d })
      setOtp(next); setError('')
      otpRefs.current[Math.min(digits.length, MOBILE_OTP_LENGTH) - 1]?.focus()
      return
    }
    next[i] = digits
    setOtp(next); setError('')
    if (digits && i < MOBILE_OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus()
  }

  function handleOtpKey(e: any, i: number) {
    if (e?.nativeEvent?.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
  }

  const otpComplete = otp.every(d => /^\d$/.test(d))

  async function handleVerifyOtp() {
    if (!otpComplete || busy) return
    setBusy(true); setError('')
    try {
      const [userId, registerId, deviceId, nallow] = await Promise.all([
        getItem(SK.Auth.USER_ID), getItem('REGISTERID'), getItem('DEVICEID'), getItem('NALLOW'),
      ])
      const res = await verifyOTP('verifyotp', {
        ID:           userId ?? '',
        OTP:          otp.join(''),
        REGISTERID:   registerId ?? '',
        DEVICEDETAIL: '{}',
        APPVERSION:   Constants.expoConfig?.version ?? '1.0.0',
        FROMPAGE:     'REGISTER',
        MCODE:        country.code,
        DEVICEID:     deviceId ?? '',
        NALLOW:       nallow ?? '0',
      })
      if (res?.ERRCODE == 0 && res?.RESPONSECODE == 1) {
        // Angular ParsingWeburlData(): keep the fresh tokens + MCODE for the verified number.
        if (res.ATN) await setItem(SK.Auth.TOKEN, String(res.ATN))
        if (res.RTN) await setItem(SK.Auth.REFRESH_TOKEN, String(res.RTN))
        await setItem(SK.User.MEMBER_CODE, country.code)
        setStep('success')
        onClose()
      } else {
        setError(t('REG.OTPERROR', 'Please enter the correct OTP'))
        setOtp(Array(MOBILE_OTP_LENGTH).fill(''))
        setTimeout(() => otpRefs.current[0]?.focus(), 50)
      }
    } catch {
      setError(t('GENERAL.NOINTERNET', 'No internet connection'))
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    if (seconds > 0 || busy) return
    setBusy(true); setError(''); setInfo('')
    try {
      const userId = await getItem(SK.Auth.USER_ID)
      const res = await resendOTP('resendotp', { ID: userId ?? '', MOBILENO: mobile, MCODE: country.code })
      if (res?.ERRCODE === 'OTP_LIMIT') {
        setError(t('REG.OTPLIMITCROSSED', 'You have crossed the maximum resend limit.'))
      } else if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0) {
        setInfo(t('VIEWPROFILE.OTPSENT', 'OTP sent successfully'))
        setOtp(Array(MOBILE_OTP_LENGTH).fill(''))
        setSeconds(MOBILE_OTP_SECONDS)
        setTimeout(() => otpRefs.current[0]?.focus(), 50)
      } else {
        setError(res?.RESPONSE?.MSG || res?.ERRMSG || t('GENERAL.NOINTERNET', 'Failed to resend OTP'))
      }
    } catch {
      setError(t('GENERAL.NOINTERNET', 'No internet connection'))
    } finally {
      setBusy(false)
    }
  }

  const timerText = `00:${String(Math.max(0, seconds)).padStart(2, '0')}`
  const digitCode = t('LOGIN_PAGE.DIGITCODE', 'We’ve sent 4 digit code to ##NO##.')
    .replace('##NO##', '').replace(/\s*\.\s*$/, '').trim()

  return (
    <>
      {/* ── Step 1: Enter mobile number ── */}
      <BottomSheet visible={visible && step === 'number'} onClose={onClose} style={kbLift}>
        <Text style={[ms.title, { fontFamily: langFonts.semiBold }]}>{t('LOGIN_PAGE.ENT_MOBILE', 'Enter mobile number')}</Text>
        <View style={[ms.field, !!error && ms.fieldError]}>
          <Pressable style={ms.ccBtn} onPress={() => setCcOpen(o => !o)} accessibilityRole="button" accessibilityLabel="Country code">
            <Text style={[ms.ccText, { fontFamily: langFonts.medium }]}>+{country.code}</Text>
            <Image source={{ uri: ICON_CC_ARROW }} style={[ms.ccArrow, ccOpen && ms.ccArrowOpen]} contentFit="contain" />
          </Pressable>
          <TextInput
            style={[ms.input, { fontFamily: langFonts.medium }, mobileWebOutline]}
            value={mobile}
            onChangeText={v => { setMobile(v.replace(/\D/g, '').slice(0, country.maxLen)); setError('') }}
            keyboardType="phone-pad"
            maxLength={country.maxLen}
            autoFocus
            autoComplete="off"
            returnKeyType="done"
            onSubmitEditing={handleGetOtp}
          />
          <View style={ms.floatLabel} pointerEvents="none">
            <Text style={[ms.floatLabelText, { fontFamily: langFonts.regular }]}>{t('LOGIN_PAGE.MOBILE_NO', 'Mobile number')}</Text>
          </View>
        </View>
        {ccOpen && (
          <View style={ms.ccList}>
            {COUNTRIES.map(c => (
              <Pressable
                key={c.code}
                style={[ms.ccItem, c.code === country.code && ms.ccItemSel]}
                onPress={() => { setCountry(c); setMobile(m => m.slice(0, c.maxLen)); setCcOpen(false); setError('') }}
              >
                <Text style={[ms.ccItemText, { fontFamily: c.code === country.code ? langFonts.medium : langFonts.regular }]}>+{c.code}  {c.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {!!error && <Text style={[ms.error, { fontFamily: langFonts.regular }]}>{error}</Text>}
        {!error && !!mobile && !numberValid && (
          <Text style={[ms.error, { fontFamily: langFonts.regular }]}>{t('LOGIN_PAGE.VALID_MOBILENO', 'Please enter a valid mobile number')}</Text>
        )}
        <Pressable
          style={[ms.primaryBtn, (!numberValid || !numberChanged) && ms.primaryBtnDisabled]}
          onPress={handleGetOtp}
          disabled={!numberValid || !numberChanged || busy}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color={Colors.white} /> : (
            <Text style={[ms.primaryBtnText, { fontFamily: langFonts.medium }]}>{t('LOGIN_PAGE.GET_OTP', 'Get OTP')}</Text>
          )}
        </Pressable>
      </BottomSheet>

      {/* ── Step 2: Enter OTP ── */}
      <BottomSheet visible={visible && step === 'otp'} onClose={onClose} style={kbLift}>
        <Text style={[ms.title, { fontFamily: langFonts.semiBold }]}>{t('LOGIN_PAGE.ENT_OTP', 'Enter OTP')}</Text>
        <Text style={[ms.sub, { fontFamily: langFonts.regular }]}>{digitCode}</Text>
        <View style={ms.numberRow}>
          <Text style={[ms.numberText, { fontFamily: langFonts.semiBold }]}>{mobile}</Text>
          <Pressable style={ms.editBtn} onPress={() => { setError(''); setStep('number') }} hitSlop={8} accessibilityRole="button">
            <CdnSvg uri={ICON_EDIT_PENCIL} width={14} height={14} />
            <Text style={[ms.editText, { fontFamily: langFonts.regular }]}>{t('LOGIN_PAGE.EDIT', 'Edit')}</Text>
          </Pressable>
        </View>
        <View style={ms.otpRow}>
          {otp.map((d, i) => (
            <TextInput
              key={i}
              ref={el => { otpRefs.current[i] = el }}
              style={[ms.otpBox, !!d && ms.otpBoxFilled, !!error && ms.fieldError, { fontFamily: langFonts.semiBold }, mobileWebOutline]}
              value={d}
              onChangeText={v => handleOtpChange(v, i)}
              onKeyPress={e => handleOtpKey(e, i)}
              keyboardType="number-pad"
              maxLength={i === 0 ? MOBILE_OTP_LENGTH : 1}
              textContentType="oneTimeCode"
              autoComplete={i === 0 ? 'sms-otp' : 'off'}
              selectTextOnFocus
            />
          ))}
        </View>
        {!!error && <Text style={[ms.error, { fontFamily: langFonts.regular }]}>{error}</Text>}
        {!!info && !error && <Text style={[ms.info, { fontFamily: langFonts.regular }]}>{info}</Text>}
        {seconds > 0 ? (
          <Text style={[ms.resendText, { fontFamily: langFonts.regular }]}>
            {t('LOGIN_PAGE.RESENDOTP', 'Didn’t receive OTP? Resend in ##TIMER##').replace('##TIMER##', timerText)}
          </Text>
        ) : (
          <Text style={[ms.resendText, { fontFamily: langFonts.regular }]}>
            {t('LOGIN_PAGE.SENDOTP', 'Didn’t receive OTP?')}
            <Text style={[ms.resendLink, { fontFamily: langFonts.medium }]} onPress={handleResend}>{t('LOGIN_PAGE.RESEND', ' Resend')}</Text>
          </Text>
        )}
        <Pressable
          style={[ms.primaryBtn, !otpComplete && ms.primaryBtnDisabled]}
          onPress={handleVerifyOtp}
          disabled={!otpComplete || busy}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color={Colors.white} /> : (
            <Text style={[ms.primaryBtnText, { fontFamily: langFonts.medium }]}>{t('LOGIN_PAGE.VERIFYOTP', 'Verify OTP')}</Text>
          )}
        </Pressable>
      </BottomSheet>

      {/* ── Step 3: verified ── */}
      <OTPSuccessSheet
        visible={step === 'success'}
        onDismiss={() => { setStep(null); onVerified() }}
      />
    </>
  )
}

const ms = StyleSheet.create({
  title: { fontSize: FontSize.font16, lineHeight: 24, color: Colors.black, marginBottom: 24 },
  sub:   { fontSize: FontSize.font14, lineHeight: 20, color: Colors.textDark, marginTop: -16 },

  field: {
    flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1, borderColor: Colors.inputBorder,
    borderRadius: 8, backgroundColor: Colors.white, position: 'relative',
  },
  fieldError: { borderColor: Colors.inputError },
  floatLabel: { position: 'absolute', top: -9, left: 10, backgroundColor: Colors.white, paddingHorizontal: 4 },
  floatLabelText: { fontSize: FontSize.font12, lineHeight: 16, color: Colors.textSecondary },
  ccBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 12, paddingRight: 8, height: '100%' },
  ccText: { fontSize: FontSize.font14, lineHeight: 20, color: Colors.textPrimary },
  ccArrow: { width: 14, height: 14 },
  ccArrowOpen: { transform: [{ rotate: '180deg' }] },
  input: {
    flex: 1, height: '100%', paddingHorizontal: 8, fontSize: FontSize.font14, color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  ccList: {
    marginTop: 4, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8, overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  ccItem: { height: 40, justifyContent: 'center', paddingHorizontal: 12 },
  ccItemSel: { backgroundColor: Colors.selectionBg },
  ccItemText: { fontSize: FontSize.font14, lineHeight: 20, color: Colors.textPrimary },

  error: { marginTop: 8, fontSize: FontSize.font12, lineHeight: 16, color: Colors.inputError },
  info:  { marginTop: 8, fontSize: FontSize.font12, lineHeight: 16, color: Colors.textSecondary },

  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, marginBottom: 20 },
  numberText: { fontSize: FontSize.font14, lineHeight: 20, color: Colors.black },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  editText: { fontSize: FontSize.font13, lineHeight: 18, color: Colors.link },

  otpRow: { flexDirection: 'row', gap: 20 },
  otpBox: {
    width: 44, height: 44, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8,
    textAlign: 'center', fontSize: FontSize.font16, color: Colors.textPrimary, backgroundColor: Colors.white,
  },
  otpBoxFilled: { borderColor: Colors.textDark },
  resendText: { marginTop: 20, fontSize: FontSize.font13, lineHeight: 18, color: Colors.textDark },
  resendLink: { color: Colors.link, textDecorationLine: 'underline' },

  primaryBtn: {
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: FontSize.font14, lineHeight: 20, color: Colors.white },
})

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
    flex: 1, fontSize: FontSize.font16,
    color: '#333333', marginLeft: 6, marginRight: 16,
    // lineHeight = the 24px back icon so the two share one vertical centre
    // (Poppins' default line box sits the glyphs visibly lower than the icon).
    lineHeight: 24, includeFontPadding: false, textAlignVertical: 'center',
  },

  scrollContent: { paddingHorizontal: CONTENT_PAD, paddingTop: 24 },
  // Profile preview: carousel runs edge to edge, flush under the header.
  // 16 of breathing room between the header and the photo.
  scrollContentPreview: { paddingTop: 16 },
  pvCarousel: { marginHorizontal: -CONTENT_PAD, backgroundColor: Colors.surfaceDim, position: 'relative' },
  pvDots: {
    position: 'absolute', bottom: 12, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  pvDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  pvDotActive: { width: 16, backgroundColor: Colors.white },
  pvIdentity: { marginTop: 24 },
  // Basic details sits closer to the name block than the usual 44 section gap.
  pvFirstSection: { marginTop: 28 },
  pvBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  // Badge's paid crown overhangs 10px left by default (Matches card) — keep it inside here.
  pvPaidBadge: { marginLeft: 0 },
  pvName: { fontSize: FontSize.font20, lineHeight: 28, color: Colors.black },
  pvId: { fontSize: FontSize.font12, lineHeight: 18, color: Colors.textDark, marginTop: 2 },

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
    fontSize: FontSize.font12,
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
  // Single-photo state — same 16 corner radius as the empty Add Photo box.
  photoTileSingle: { borderRadius: 16 },
  photoTileImg: { width: '100%', height: '100%' },
  // "+N more" overlay on the 6th tile once there are more than 6 photos.
  photoMoreOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoMoreText: {
    fontSize: FontSize.font16, color: Colors.white,
    textAlign: 'center', lineHeight: 24,
  },
  // Secondary (outlined) CTA — same 44 height / radius 8 as the red CTAs.
  addMoreCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: 8, borderWidth: 1, borderColor: Colors.primaryDark,
    backgroundColor: Colors.white, marginTop: 24,
  },
  addMoreCtaPlus: { fontSize: 22, lineHeight: 24, color: Colors.primaryDark },
  addMoreCtaText: { fontSize: FontSize.font14, color: Colors.primaryDark },
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
    fontSize: FontSize.font12, lineHeight: 18, letterSpacing: 0.12,
    color: Colors.white, textTransform: 'capitalize',
  },

  photoAddSlot: {
    // Border drawn by <DashedBorder> (SVG) for controllable dash length.
    position: 'absolute', borderRadius: 8,
    backgroundColor: 'rgba(230,230,230,0.3)', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  // No-photo state: one big box in normal flow instead of an absolute tile.
  photoAddEmpty: { position: 'relative', marginTop: 24, borderRadius: 16 },
  // Empty-state "Add Photo" label: 16px / weight 500 (Poppins-Medium = 500).
  photoAddText: { fontSize: FontSize.font16, color: Colors.primaryDark },
  photoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Title's own marginBottom would push it off-centre from the warning icon.
  photoTitleText: { marginBottom: 0 },

  // Unused — nothing renders this. Kept and tokenised rather than deleted; its
  // Angular counterpart (edit-profile.page.html:157 `textcta-medium-12
  // color-585858`, the "*Hold & Drag photos to reorder" hint) is commented out
  // there too, so both sides are dead in the same way.
  photoHint: { fontSize: FontSize.font12, color: '#585858', marginTop: 8 },

  // Angular: `<ion-row class="mt-16 ion-cust-padding-start ion-cust-padding-end">`
  // — 16 above the row; the label's own `ml-8` is the 8 between icon and text.
  guidelinesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  // Angular: `textcta-medium-12 color-29339B` wrapped in <u> — global.scss:2270
  // = var(--font12) + --english-medium-poppins (Poppins-Medium); #29339B is
  // Colors.link.
  guidelinesText: {
    fontSize: FontSize.font12,
    color: Colors.link, textDecorationLine: 'underline',
    // lineHeight = the 16px info icon so text and icon share one vertical centre
    // (Poppins' default line box sat the text lower than the icon).
    lineHeight: GUIDELINES_ICON, includeFontPadding: false, textAlignVertical: 'center',
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
  addPhotoBtnText: { fontSize: FontSize.font14, color: Colors.white },

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
    // 28 (1.4×): lineHeight equal to the font size clipped the Bold face's tops/tails.
    fontSize: FontSize.font20, lineHeight: 28,
    color: Colors.textDark, marginBottom: 20,
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
  previewBtnText: { color: Colors.white, fontSize: FontSize.font14 },
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
  rowText: { flex: 1, gap: 6 },
  // lineHeight 20 (≈1.4× the 14px face): the old 16 clipped Poppins' ascenders/
  // descenders (g, y, p, accents) so row text looked cut off. gap trimmed 8 → 4
  // to keep a row's content height close to the design's 40 (20+4+20 = 44).
  // Angular: every row's <h2> is `body2-regular-14 color-4c4c4c` — global.scss
  // .body2-regular-14 = var(--font14) + --english-regular-poppins
  // (Poppins-Regular); .color-4c4c4c = #4c4c4c, a grey, not black.
  rowLabel: { fontSize: FontSize.font14, lineHeight: 20, color: '#4c4c4c' },
  // Angular: every row's value <p> is `mt-5 body1-medium-14 color-333333` —
  // var(--font14) + --english-medium-poppins (Poppins-Medium) + #333333.
  // 22 so a value that wraps to 2 lines (e.g. "Bachelor's Degree, Bachelor's - Engineering / Computers") isn't cramped.
  rowValue: { fontSize: FontSize.font14, lineHeight: 22, color: Colors.textDark },
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
  missingText: { fontSize: FontSize.font14, lineHeight: 20, color: Colors.link },
})
