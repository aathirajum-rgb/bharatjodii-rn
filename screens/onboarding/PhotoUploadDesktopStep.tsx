// Desktop-web onboarding step C — Figma "Jodii Desktop - Registration"
// (997-38660/-43426/-44690/-47184/1006-3021 general, 997-39845/-42223
// women-specific): combines AddPhotoScreen + CustomGalleryScreen.web +
// ManagePhotosScreen (mobile) into one card with two states — an empty
// "add your first photo" state and a grid-of-photos state once at least
// one photo exists — reusing those screens' exact upload/list/delete/
// set-main API calls.
//
// isFemale copy branch mirrors AddPhotoScreen.tsx's own formula exactly
// (gender key '2', or createdBy '5'/'9' — creating a profile for a
// daughter/sister) so the two Figma copy variants line up with the same
// condition mobile already uses.

import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import OnboardingDesktopLayout from './OnboardingDesktopLayout'
import { Colors } from '../../constants/colors'
import { Fonts, FontSize } from '../../src/theme/fonts'
import { CDN_SVG, CDN_REG } from '../../constants/cdn'
import { Endpoints } from '../../service/api.endpoints'
import { apiCall, uploadFile } from '../../service/apiClient'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { getRegValue } from '../../service/registrationService'
import {
  getPhotoConfig, validatePhotoAsset, normalizeWebFile, getRejectReasons, describeRejection,
  pollPhotoValidation,
  type PhotoRejectionCode,
} from '../../service/photoValidationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import PhotoVerdictSheet, { type VerdictPhoto } from '../../components/photo-validation/PhotoVerdictSheet'
import VerificationSuccessSheet from '../../components/bottom-sheet/VerificationSuccessSheet'

const PLACEHOLDER = CDN_SVG + 'add-photo.svg'
// onboarding-photo.component.html's per-photo trash icon — same asset
// ManagePhotosScreen.tsx's delete button now uses, in place of a "🗑" emoji
// glyph (emoji rendering isn't consistent across desktop browsers/OSes the
// way this real icon is).
const CDN_TRASH_ICON = CDN_REG + 'trash-img.svg'
const MAX_PHOTOS = 10

type Photo = { PHOTOID: string; PHOTOURL: string; PHOTOTHUMB?: string; MAINPHOTO: number; PHOTOSTATUS: number }

type Props = { navigation: any }

export default function PhotoUploadDesktopStep({ navigation }: Props) {
  const { t } = useTranslation()
  const [gender, setGender] = useState('1')
  const [createdBy, setCreatedBy] = useState('1')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // AI photo-validation verdict — same state machine as CustomGalleryScreen's
  // native/web variants, kept in sync with those files. Unlike onboarding's
  // first-photo flow, dismissing here doesn't navigate anywhere — the grid
  // (loadPhotos()) already reflects the new photo by the time the verdict
  // sheet can appear.
  const [verdictPhase, setVerdictPhase] = useState<'idle' | 'uploading' | 'approved' | 'rejected' | 'mixed'>('idle')
  const [verdictApproved, setVerdictApproved] = useState<VerdictPhoto[]>([])
  const [verdictRejected, setVerdictRejected] = useState<VerdictPhoto[]>([])

  useEffect(() => {
    Promise.all([getRegValue('GENDER'), getRegValue('CREATEDBY')]).then(([g, cb]) => {
      if (g) setGender(g)
      if (cb) setCreatedBy(cb)
    })
    loadPhotos()
  }, [])

  async function loadPhotos() {
    setLoading(true)
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      const res = await apiCall(Endpoints.profile.managePhoto, 'POST', `ID=${userId}`)
      if (res?.RESPONSECODE == 1 && res?.RESPONSE?.PHOTOS) setPhotos(res.RESPONSE.PHOTOS)
    } finally {
      setLoading(false)
    }
  }

  async function handleFiles(e: any) {
    const files: File[] = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
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
      await loadPhotos()
      if (rejections.length) {
        const reasons = await getRejectReasons()
        Alert.alert('Some photos were not added', rejections.map(code => describeRejection(code, reasons)).join('\n\n'))
      }

      // Same fire-immediately-after-upload verdict poll as CustomGalleryScreen
      // (native/web) — this desktop onboarding step was missing it entirely,
      // so an AI-flagged photo here never surfaced a verdict or a selfie
      // recheck prompt.
      if (config.isNativeFaceDetectionEnabled && uploadedPhotoIds.length > 0) {
        setVerdictPhase('uploading')
        const verdict = await pollPhotoValidation(uploadedPhotoIds)

        if (!verdict) {
          setVerdictPhase('idle')
          return
        }

        if (verdict.isSelfieRequired) {
          setVerdictPhase('idle')
          navigation.push('photo-mismatch-selfie', { onDonePageNo: 'desktop-other-details' })
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
    } catch {
      Alert.alert('Error', 'Upload failed. Please try again.')
      setVerdictPhase('idle')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function dismissVerdict() {
    setVerdictPhase('idle')
  }

  function retryFromVerdict() {
    setVerdictPhase('idle')
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

  function goNextStep() {
    navigation.push('onboarding', { pageNo: 'desktop-other-details' })
  }

  function handleBack() {
    navigation.push('onboarding', { pageNo: 'desktop-education-location' })
  }

  const isFemale = gender === '2' || ['5', '9'].includes(createdBy)
  const hasPhotos = photos.length > 0

  return (
    <OnboardingDesktopLayout
      onBack={handleBack}
      onNext={hasPhotos ? goNextStep : openFilePicker}
      nextLabel={hasPhotos ? t('REGISTRATION.CONTINUE', 'Continue') : t('REGISTRATION.ADDPHOTOCTA', 'Add photo')}
      nextDisabled={loading || uploading}
      nextLoading={uploading}
    >
      {Platform.OS === 'web' && (
        // `display: 'none'` looks equivalent but isn't — Safari silently
        // refuses to honor a programmatic .click() on a display:none file
        // input (works fine in Chrome, which is why this wasn't caught by
        // testing). A 1×1 fully transparent element still satisfies that
        // check in every browser — see EditProfileDesktopScreen.tsx's own
        // fix for the same bug.
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
          onChange={handleFiles}
        />
      )}

      {loading ? (
        <ActivityIndicator color={Colors.primaryDark} style={s.loader} />
      ) : hasPhotos ? (
        <>
          <View style={s.grid}>
            {photos.map((p, idx) => (
              <View key={p.PHOTOID} style={s.tile}>
                <Pressable style={s.tilePress} onPress={idx === 0 ? undefined : () => setAsMain(p)}>
                  <Image source={{ uri: p.PHOTOURL || p.PHOTOTHUMB || '' }} style={s.tileImg} contentFit="cover" />
                </Pressable>
                {idx === 0 && (
                  <View style={s.mainLabel}><Text style={s.mainLabelText}>Profile Picture</Text></View>
                )}
                <Pressable style={s.deleteBtn} onPress={() => confirmDelete(p)} hitSlop={4}>
                  <CdnSvg uri={CDN_TRASH_ICON} width={14} height={14} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <Pressable style={s.addTile} onPress={openFilePicker}>
                <Text style={s.addTilePlus}>+</Text>
                <Text style={s.addTileLabel}>Add Photos</Text>
              </Pressable>
            )}
          </View>
        </>
      ) : (
        <>
          <Text style={s.introText}>
            {isFemale ? 'Add your photo and get 30 free contacts' : 'Add your photo and get 3x more responses from matches'}
          </Text>
          {isFemale && <Text style={s.introSub}>Your photo is 100% safe with us</Text>}
          <Pressable style={s.placeholderWrap} onPress={openFilePicker}>
            <Image source={{ uri: PLACEHOLDER }} style={s.placeholderImg} contentFit="contain" />
          </Pressable>
        </>
      )}

      <Pressable onPress={() => Alert.alert('Photo guidelines', 'Use clear, recent photos with good lighting. Avoid group photos, blurry images, or photos with glasses.')}>
        <Text style={s.guidelines}>ⓘ Check out our photo guidelines</Text>
      </Pressable>

      {!hasPhotos && (
        <Pressable onPress={goNextStep} style={s.skipRow}>
          <Text style={s.skipText}>I'll do this later ›</Text>
        </Pressable>
      )}

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
    </OnboardingDesktopLayout>
  )
}

const s = StyleSheet.create({
  loader: { marginTop: 48 },

  // Figma-only desktop pitch copy — doesn't match any single Angular mobile
  // string/class 1:1 (AddPhotoScreen's own CONTENT1/CONTENT2 bullets read
  // differently), so left unchanged rather than guessing a source class.
  introText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center', lineHeight: 22 },
  introSub: { fontSize: 13, fontWeight: '400', color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },

  placeholderWrap: {
    alignSelf: 'center', width: 200, height: 200, marginTop: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  placeholderImg: { width: '100%', height: '100%' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: 128, height: 128, borderRadius: 12, overflow: 'hidden', position: 'relative',
    backgroundColor: Colors.surfaceInput,
  },
  tilePress: { flex: 1 },
  tileImg: { width: '100%', height: '100%' },
  mainLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 5, paddingLeft: 8,
  },
  // Angular: `.profile-picture textcta-medium-12 white-color`
  // (onboarding-photo.component.html) — same label ManagePhotosScreen renders.
  mainLabelText: { fontFamily: Fonts.poppinsMedium, fontSize: FontSize.font12, fontWeight: '500', color: Colors.white },
  deleteBtn: {
    position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
  },

  addTile: {
    width: 128, height: 128, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceInput,
  },
  // Angular's real icon here is a plain `<ion-icon name="add-outline">` with
  // no font-size utility class — no verified size to port, left as-is.
  addTilePlus: { fontSize: 26, fontWeight: '300', color: Colors.textSecondary },
  // Angular: `.textcta-medium-12 black-color` (onboarding-photo.component.html's
  // "Add photos" empty-slot label).
  addTileLabel: { fontFamily: Fonts.poppinsMedium, fontSize: FontSize.font12, fontWeight: '500', color: Colors.black, marginTop: 2 },

  // Angular: `.textcta-medium-12 color-29339B` wrapped in `<u>`
  // (registration-revamp.component.html:145) — same guidelines row
  // ManagePhotosScreen renders.
  guidelines: {
    fontFamily: Fonts.poppinsMedium, fontSize: FontSize.font12, fontWeight: '500', color: Colors.link, textDecorationLine: 'underline',
    textAlign: 'center', marginTop: 16,
  },

  skipRow: { alignSelf: 'center', marginTop: 12 },
  // Angular: #skip_cta's span is `.body2-regular-14 color-333333`.
  skipText: { fontFamily: Fonts.poppinsRegular, fontSize: FontSize.font14, fontWeight: '400', color: Colors.textDark },
})
