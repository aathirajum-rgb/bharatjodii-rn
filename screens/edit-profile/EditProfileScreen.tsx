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
// Drinking/Smoking habits have no option-fetching function anywhere in this
// app yet (only Eating habits does) — their raw stored value is shown as-is
// rather than resolved to a label, since there's nothing to resolve against.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
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
  fetchFamilyOptions,
} from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import PhotoPrivacySheet from '../../components/photo-privacy/PhotoPrivacySheet'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import EditProfileDesktopScreen from './EditProfileDesktopScreen'

const ICON_BACK  = CDN_REACT + '/menu_back_arrow.svg'
const ICON_ARROW = CDN_REACT + '/menu_right_arrow.svg'

// Photo mosaic (Figma node 2192-9135) — 1 large tile (spans 2x2 of the small-
// tile grid) + 5 small tiles: two stacked to its right, three in a row below.
// Matches Angular's 6-slot photo grid exactly (slot 0 = main/profile photo).
const MOSAIC_TILE = 98
const MOSAIC_GAP  = 8
const MOSAIC_MAIN = MOSAIC_TILE * 2 + MOSAIC_GAP // 204
const PHOTO_GRID_SLOTS = 6

function photoSlotPosition(i: number): { left: number; top: number } {
  if (i === 0) return { left: 0, top: 0 }
  if (i === 1) return { left: MOSAIC_MAIN + MOSAIC_GAP, top: 0 }
  if (i === 2) return { left: MOSAIC_MAIN + MOSAIC_GAP, top: MOSAIC_TILE + MOSAIC_GAP }
  if (i === 3) return { left: 0, top: MOSAIC_MAIN + MOSAIC_GAP }
  if (i === 4) return { left: MOSAIC_TILE + MOSAIC_GAP, top: MOSAIC_MAIN + MOSAIC_GAP }
  return { left: MOSAIC_MAIN + MOSAIC_GAP, top: MOSAIC_MAIN + MOSAIC_GAP }
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
  label, value, missingText, onPress, showDivider, hideArrow,
}: {
  label: string
  value?: string | undefined
  missingText?: string | undefined
  onPress: () => void
  showDivider?: boolean | undefined
  // Display-only rows (Jodii ID, Profile created by, Mobile number — none of
  // which Angular makes editable either) — no chevron, so the row doesn't
  // look like a dead tap target.
  hideArrow?: boolean | undefined
}) {
  const isMissing = !value && !!missingText
  return (
    <>
      <Pressable style={({ pressed }) => [r.row, pressed && r.rowPressed]} onPress={onPress} accessibilityRole="button">
        <View style={r.rowText}>
          <Text style={r.rowLabel}>{label}</Text>
          {isMissing ? (
            <View style={r.missingRow}>
              <Text style={r.missingBang}>!</Text>
              <Text style={r.missingText}>{missingText}</Text>
            </View>
          ) : (
            <Text style={r.rowValue} numberOfLines={2}>{value ?? '—'}</Text>
          )}
        </View>
        {!hideArrow && <CdnSvg uri={ICON_ARROW} width={16} height={16} />}
      </Pressable>
      {showDivider && <View style={r.rowDivider} />}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View>{children}</View>
    </View>
  )
}

// ─── EditProfileScreen ────────────────────────────────────────────────────────

export default function EditProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const isDesktop = useIsDesktopWeb()

  const [loading, setLoading]   = useState(true)
  const [profile, setProfile]   = useState<EditProfileInfo | null>(null)
  const [photos,  setPhotos]    = useState<any[]>([])
  const [labels,  setLabels]    = useState<Record<string, Opt[]>>({})
  const [ownId,   setOwnId]     = useState('')
  const [createdByLabel, setCreatedByLabel] = useState<string | undefined>(undefined)
  const [photoPrivacyVisible, setPhotoPrivacyVisible] = useState(false)
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
            onPress={() => (photos.length > 0 ? setPhotoPrivacyVisible(true) : openGalleryPicker())}
            hitSlop={8}
          >
            <Text style={s.photoPrivacyLink}>{t('EDITPROFILE.PHOTO_PRIVACY')}</Text>
          </Pressable>
        </View>

        {/* Figma node 2192-9135: a fixed 1-large + 5-small mosaic (matches
            Angular's 6-slot photo grid), not a horizontal scroll of equal
            tiles. Main tile spans 2x2 of the small-tile grid; every empty
            slot (not just the last one) is its own add-photo trigger. */}
        <View style={s.photoGrid}>
          {Array.from({ length: PHOTO_GRID_SLOTS }, (_, i) => {
            const photo = photos[i]
            const pos = photoSlotPosition(i)
            const size = i === 0 ? MOSAIC_MAIN : MOSAIC_TILE
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
          <FieldRow label={t('EDITPROFILE.NAME')} value={profile.name} onPress={() => navigation.navigate('EditProfileBasic')} showDivider />
          <FieldRow label={t('EDITPROFILE.AGE')} value={profile.age ? `${profile.age} years old` : undefined} onPress={() => navigation.navigate('EditProfileAgeHeight')} showDivider />
          <FieldRow label={t('EDITPROFILE.HEIGHT')} value={heightLabel} onPress={() => navigation.navigate('EditProfileAgeHeight')} showDivider />
          <FieldRow
            label={t('EDITPROFILE.MARITALSTATUS')}
            value={labelFor(labels.maritalStatus ?? [], profile.maritalStatus)}
            missingText={t('EDITPROFILE.ADD_DETAILS_TXT')}
            onPress={() => navigation.navigate('EditProfileMarital')}
            showDivider
          />
          {childrenVisible && (
            <FieldRow
              label={t('EDITPROFILE.CHILDREN')}
              value={labelFor(CHILDREN_OPTIONS, profile.noOfChildren)}
              missingText={t('EDITPROFILE.ADD_DETAILS_TXT')}
              onPress={() => navigation.navigate('EditProfileMarital')}
              showDivider
            />
          )}
          <FieldRow
            label={t('EDITPROFILE.PHYSICALSTATUS')}
            value={labelFor(labels.physicalStatus ?? [], profile.physicalStatus)}
            missingText={t('EDITPROFILE.ADD_DETAILS_TXT')}
            onPress={() => navigation.navigate('EditProfileMarital')}
            showDivider
          />
          <FieldRow label={t('EDITPROFILE.MOTHERTONGUE')} value={labelFor(labels.motherTongue ?? [], profile.motherTongue)} onPress={() => navigation.navigate('EditProfileBasic')} showDivider />
          <FieldRow label={t('EDITPROFILE.CURRENT_LOCATION')} value={cityLabel} onPress={() => navigation.navigate('EditProfileBasic')} showDivider />
          <FieldRow label={t('EDITPROFILE.NATIVE_PLACE')} value={homeCityLabel} onPress={() => navigation.navigate('EditProfileBasic')} showDivider />
          <FieldRow label={t('EDITPROFILE.MOBILENO')} value={profile.mobileNo} onPress={() => {}} hideArrow />
        </Section>

        {/* ── Professional details ── */}
        <Section title="Professional details">
          <FieldRow label={t('EDITPROFILE.EDUCATION')} value={labelFor(labels.education ?? [], profile.education)} onPress={() => navigation.navigate('EditProfileProfessional')} showDivider />
          <FieldRow label={t('EDITPROFILE.OCCUPATION')} value={labelFor(labels.occupation ?? [], profile.occupation)} onPress={() => navigation.navigate('EditProfileProfessional')} showDivider />
          <FieldRow label={t('EDITPROFILE.INCOME')} value={labelFor(labels.income ?? [], profile.income) ?? profile.income} onPress={() => navigation.navigate('EditProfileProfessional')} />
        </Section>

        {/* ── Religious details ── */}
        <Section title={t('EDITPROFILE.RELIGIOUSDETAIL')}>
          <FieldRow label={t('EDITPROFILE.RELIGION')} value={labelFor(labels.religion ?? [], profile.religion)} onPress={() => navigation.navigate('EditProfileReligious')} showDivider />
          <FieldRow label={t('EDITPROFILE.CASTESUB')} value={labelFor(labels.caste ?? [], profile.caste)} onPress={() => navigation.navigate('EditProfileReligious')} showDivider />
          <FieldRow
            label={t('EDITPROFILE.RAASI')}
            value={labelFor(labels.raasi ?? [], profile.raasi)}
            missingText={t('EDITPROFILE.ADDYOURRAASI')}
            onPress={() => navigation.navigate('EditProfileReligious')}
            showDivider
          />
          <FieldRow
            label={t('EDITPROFILE.STAR')}
            value={labelFor(labels.star ?? [], profile.star)}
            missingText={t('EDITPROFILE.ADDYOURSTAR')}
            onPress={() => navigation.navigate('EditProfileReligious')}
            showDivider
          />
          <FieldRow
            label={t('EDITPROFILE.DOSHAM')}
            value={profile.dosham === '1' ? 'Yes' : profile.dosham === '2' ? 'No' : undefined}
            missingText={t('EDITPROFILE.ADDYOURDOSHAM')}
            onPress={() => navigation.navigate('EditProfileReligious')}
            showDivider
          />
          <FieldRow
            label={t('EDITPROFILE.HOROSCOPE')}
            value={profile.horoscopeAvailable
              ? `${t('EDITPROFILE.ADDEDON')}${profile.horoInfo?.birthDay ? ` ${profile.horoInfo.birthDay}` : ''}`
              : undefined}
            missingText={t('EDITPROFILE.ADDYOURHORO')}
            onPress={() => !profile.horoscopeAvailable && navigation.navigate('EditProfileHoroscope')}
            hideArrow={!!profile.horoscopeAvailable}
          />
        </Section>

        {/* ── Life style details ── */}
        <Section title="Life style details">
          <FieldRow label={t('EDITPROFILE.DRINKING')} value={labelFor(labels.drinkingHabit ?? [], profile.drinkingHabits)} onPress={() => navigation.navigate('EditProfileLifestyle')} showDivider />
          <FieldRow label="Smoking habits" value={labelFor(labels.smokingHabit ?? [], profile.smokingHabits)} onPress={() => navigation.navigate('EditProfileLifestyle')} showDivider />
          <FieldRow label={t('EDITPROFILE.EATING')} value={labelFor(labels.eatingHabit ?? [], profile.eatingHabits)} onPress={() => navigation.navigate('EditProfileLifestyle')} />
        </Section>

        {/* ── Family details ── */}
        <Section title={t('EDITPROFILE.FAMILYDETAILS')}>
          <FieldRow
            label={t('EDITPROFILE.BROTHERS')}
            value={labelFor(labels.brothers ?? [], profile.brothers)}
            onPress={() => navigation.navigate('EditProfileFamily')}
            showDivider
          />
          <FieldRow
            label={t('EDITPROFILE.SISTERS')}
            value={labelFor(labels.sisters ?? [], profile.sisters)}
            onPress={() => navigation.navigate('EditProfileFamily')}
          />
        </Section>

        {/* ── Property details ── */}
        <Section title="Property details">
          <FieldRow label="Properties owned" value={propertiesLabel} onPress={() => navigation.navigate('EditProfileProperty')} />
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

  scrollContent: { paddingHorizontal: 24, paddingTop: 24 },

  photoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoPrivacyLink: { fontSize: 14, color: Colors.link, textDecorationLine: 'underline' },

  // Fixed-size mosaic — width/height match the 3-col/3-row tile grid exactly
  // (3 tiles + 2 gaps = 310), so absolutely-positioned children line up.
  photoGrid: {
    marginTop: 16,
    width: MOSAIC_MAIN + MOSAIC_GAP + MOSAIC_TILE,
    height: MOSAIC_MAIN + MOSAIC_GAP + MOSAIC_TILE,
  },
  photoTile: {
    position: 'absolute', borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.surfaceDim,
  },
  // Only the main/profile tile (slot 0) gets the red border in Figma —
  // small tiles are plain rounded photos.
  photoTileMain: { borderWidth: 2, borderColor: Colors.primaryDark },
  photoTileImg: { width: '100%', height: '100%' },
  mainPhotoBadge: {
    position: 'absolute', left: 0, bottom: 0, backgroundColor: Colors.primaryDark,
    paddingHorizontal: 8, paddingVertical: 4, borderTopRightRadius: 16, borderBottomLeftRadius: 8,
  },
  mainPhotoBadgeText: { fontSize: 12, fontWeight: '500', color: Colors.white, textTransform: 'capitalize' },

  photoAddSlot: {
    position: 'absolute', borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderSubtle,
    backgroundColor: 'rgba(230,230,230,0.3)', alignItems: 'center', justifyContent: 'center',
  },

  photoHint: { fontSize: 12, color: '#585858', marginTop: 8 },

  section: { marginTop: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: Colors.black },

  footer: {
    paddingHorizontal: 24, paddingTop: 12, backgroundColor: Colors.white,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(204,204,204,0.5)',
  },
  previewBtn: { height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  previewBtnText: { color: Colors.white, fontSize: 14, fontWeight: '500' },
})

const r = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 20 },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 8 },
  rowLabel: { fontSize: 14, color: Colors.black },
  rowValue: { fontSize: 14, fontWeight: '500', color: Colors.black },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(204,204,204,0.5)' },

  missingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  missingBang: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primaryDark, color: Colors.white,
    fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 16, overflow: 'hidden',
  },
  missingText: { fontSize: 14, color: Colors.link },
})
