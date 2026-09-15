// Shared "Add photo" trigger for every CTA/banner that used to do a bare
// `navigation.navigate('Gallery')`. That route (screens/GalleryScreen.tsx) is a
// native-only picker built on expo-media-library — on web it has no
// implementation at all (just shows "No Access"). Browsers also only allow a
// file dialog to open from a direct, synchronous click (see
// EditProfileScreen.tsx's identical comment), so there's no way to fix this by
// navigating to a web-friendly screen either — the hidden <input type="file">
// has to live in the same screen as the CTA that triggers it, and this hook
// only supplies the ref/handler/state for that; each screen still renders the
// actual <WebPhotoInput> (components/add-photo/WebPhotoInput.tsx) itself.
import { useCallback, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StorageKeys as SK } from '../constants/storage.keys'
import { Endpoints } from '../service/api.endpoints'
import { uploadFile } from '../service/apiClient'
import { getItem, setItem } from '../service/storageService'
import {
  getPhotoConfig, validatePhotoAsset, normalizeWebFile, getRejectReasons, describeRejection,
  pollPhotoValidation,
  type PhotoRejectionCode,
} from '../service/photoValidationService'
import type { VerdictPhoto } from '../components/photo-validation/PhotoVerdictSheet'

type NavigationLike = { navigate: (route: string) => void }

export type UseAddPhotoPickerOptions = {
  // Called once per handleWebFiles() run that uploaded at least one photo
  // successfully — hook up a screen's own refresh/reload call here so photo-
  // gated banners/gates clear without needing a manual re-focus.
  onUploaded?: () => void
  onRejected?: (message: string) => void
  onError?: (message: string) => void
}

export function useAddPhotoPicker(options: UseAddPhotoPickerOptions = {}) {
  const { onUploaded, onRejected, onError } = options
  const webInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const navigation = useNavigation<any>()

  // AI photo-validation verdict — same state machine as onboarding's
  // CustomGalleryScreen (native/web) and Edit Profile's photo picker. Native
  // uploads (routed to the Gallery screen) already poll on their own; this is
  // specifically for the web `<input>` path this hook drives directly.
  const [verdictPhase, setVerdictPhase] = useState<'idle' | 'uploading' | 'approved' | 'rejected' | 'mixed'>('idle')
  const [verdictApproved, setVerdictApproved] = useState<VerdictPhoto[]>([])
  const [verdictRejected, setVerdictRejected] = useState<VerdictPhoto[]>([])

  const handleWebFiles = useCallback(async (e: any) => {
    const files: File[] = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      const config = await getPhotoConfig()
      const rejections: PhotoRejectionCode[] = []
      const uploadedPhotoIds: string[] = []
      let uploadedAny = false

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
            uploadedAny = true
          }
          if (res?.RESPONSE?.PHOTOID) {
            uploadedPhotoIds.push(String(res.RESPONSE.PHOTOID))
          }
        }
      }

      if (rejections.length) {
        const reasons = await getRejectReasons()
        onRejected?.(rejections.map(code => describeRejection(code, reasons)).join(' '))
      }
      if (uploadedAny) onUploaded?.()

      if (config.isNativeFaceDetectionEnabled && uploadedPhotoIds.length > 0) {
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
    } catch {
      onError?.('Upload failed. Please try again.')
      setVerdictPhase('idle')
    } finally {
      setUploading(false)
      if (webInputRef.current) webInputRef.current.value = ''
    }
  }, [onUploaded, onRejected, onError, navigation])

  function dismissVerdict() {
    setVerdictPhase('idle')
  }

  function retryFromVerdict() {
    setVerdictPhase('idle')
  }

  // Single entry point for every "Add photo" CTA — native still routes through
  // the Gallery screen/navigator; web clicks the hidden input in place instead.
  const openAddPhoto = useCallback((navigation: NavigationLike) => {
    if (Platform.OS === 'web') {
      if (uploading) return
      webInputRef.current?.click()
    } else {
      navigation.navigate('Gallery')
    }
  }, [uploading])

  return {
    webInputRef, handleWebFiles, openAddPhoto, uploading,
    verdictPhase, verdictApproved, verdictRejected, dismissVerdict, retryFromVerdict,
  }
}
