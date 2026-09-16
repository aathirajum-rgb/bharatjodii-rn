// Web fallback — expo-media-library is native-only.
// On web we use a plain <input type="file"> and the existing upload API.

import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { Endpoints } from '../../service/api.endpoints'
import { uploadFile } from '../../service/apiClient'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import {
  getPhotoConfig, validatePhotoAsset, normalizeWebFile, getRejectReasons, describeRejection,
  pollPhotoValidation,
  type PhotoRejectionCode,
} from '../../service/photoValidationService'
import PhotoVerdictSheet, { type VerdictPhoto } from '../../components/photo-validation/PhotoVerdictSheet'
import VerificationSuccessSheet from '../../components/bottom-sheet/VerificationSuccessSheet'
import { os } from './onboardingStyles'
import { FontSize } from '../../src/theme/fonts'

const MAX_PHOTOS = 10

type Props = { navigation: any; route: any }

export default function CustomGalleryScreen({ navigation, route }: Props) {
  const { t } = useTranslation()
  const existingCount = (route?.params?.existingCount as number | undefined) ?? 0
  const remaining     = Math.max(0, MAX_PHOTOS - existingCount)

  const [uploading, setUploading] = useState(false)
  const inputRef   = useRef<HTMLInputElement | null>(null)

  // AI photo-validation verdict — see CustomGalleryScreen.tsx (native) for the
  // same state machine; kept in sync with that file.
  const [verdictPhase, setVerdictPhase] = useState<'idle' | 'uploading' | 'approved' | 'rejected' | 'mixed'>('idle')
  const [verdictApproved, setVerdictApproved] = useState<VerdictPhoto[]>([])
  const [verdictRejected, setVerdictRejected] = useState<VerdictPhoto[]>([])
  const continueAfterVerdict = useRef<() => void>(() => {})

  useOnboardingFooter({ nextHidden: true, showSkip: false, onNext: () => {} }, [])

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    let files = Array.from(e.target.files ?? [])
    if (!files.length) return

    // Native (CustomGalleryScreen.tsx) caps selection at MAX_PHOTOS total via
    // its own grid toggleSelect(); the browser's file dialog has no such
    // incremental cap, so enforce it here after the fact instead.
    if (files.length > remaining) {
      Alert.alert(
        'Photo limit reached',
        `You can add up to ${remaining} more photo${remaining !== 1 ? 's' : ''}. Only the first ${remaining} selected will be uploaded.`,
      )
      files = files.slice(0, remaining)
    }
    if (!files.length) { e.target.value = ''; return }

    setUploading(true)
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      const config = await getPhotoConfig()
      const rejections: PhotoRejectionCode[] = []
      const uploadedPhotoIds: string[] = []
      let firstUri: string | undefined

      for (const file of files) {
        const input = await normalizeWebFile(file)
        const validation = await validatePhotoAsset(input, config)
        if (!validation.ok) {
          URL.revokeObjectURL(input.uri)
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
          if (!firstUri) firstUri = input.uri
        } else {
          URL.revokeObjectURL(input.uri)
        }
      }

      if (rejections.length) {
        const reasons = await getRejectReasons()
        Alert.alert(
          rejections.length === files.length ? 'Photo not added' : 'Some photos were not added',
          rejections.map(code => describeRejection(code, reasons)).join('\n\n'),
        )
      }

      if (rejections.length === files.length) return

      continueAfterVerdict.current = () => {
        navigation.push('onboarding', { pageNo: '21', pendingUri: firstUri })
      }

      if (config.isNativeFaceDetectionEnabled && uploadedPhotoIds.length > 0) {
        setVerdictPhase('uploading')
        const verdict = await pollPhotoValidation(uploadedPhotoIds)

        if (!verdict) {
          setVerdictPhase('idle')
          continueAfterVerdict.current()
          return
        }

        if (verdict.isSelfieRequired) {
          setVerdictPhase('idle')
          navigation.push('photo-mismatch-selfie', { onDonePageNo: '21' })
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
        return
      }

      continueAfterVerdict.current()
    } catch {
      Alert.alert('Error', 'Upload failed. Please try again.')
      setVerdictPhase('idle')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function dismissVerdict() {
    setVerdictPhase('idle')
    continueAfterVerdict.current()
  }

  function retryFromVerdict() {
    setVerdictPhase('idle')
  }

  return (
    <View style={os.flex1}>
      <View style={styles.center}>
        <Text style={styles.title}>Add your photo</Text>
        <Text style={styles.subtitle}>
          {remaining > 0
            ? `Select up to ${remaining} more photo${remaining !== 1 ? 's' : ''} from your device`
            : `You've reached the ${MAX_PHOTOS}-photo limit`}
        </Text>

        {/* Hidden native file input — 1×1/opacity:0, NOT display:none, since
            Safari silently blocks a programmatic .click() on a display:none
            file input (see EditProfileDesktopScreen.tsx's fix for the same bug) */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
          onChange={handleFiles}
        />

        <Pressable
          style={[styles.btn, (uploading || remaining === 0) && styles.btnDisabled]}
          onPress={() => inputRef.current?.click()}
          disabled={uploading || remaining === 0}
        >
          {uploading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.btnLabel}>Choose photos</Text>
          }
        </Pressable>
      </View>

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

const styles = StyleSheet.create({
  center: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 32,
    gap:               16,
  },
  title: {
    fontSize:   FontSize.font22,
    fontWeight: '700',
    color:      '#111',
    textAlign:  'center',
  },
  subtitle: {
    fontSize:   FontSize.font14,
    color:      '#666',
    textAlign:  'center',
    lineHeight: 20,
  },
  btn: {
    height:          52,
    width:           '100%',
    backgroundColor: Colors.primary,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       8,
  },
  btnDisabled: { opacity: 0.6 },
  btnLabel: {
    fontSize:   FontSize.font16,
    fontWeight: '600',
    color:      '#fff',
  },
})
