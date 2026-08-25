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
import { Colors } from '../../constants/colors'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { Endpoints } from '../../service/api.endpoints'
import { uploadFile } from '../../service/apiClient'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { os } from './onboardingStyles'

const MAX_PHOTOS = 10

type Props = { navigation: any; route: any }

export default function CustomGalleryScreen({ navigation, route }: Props) {
  const existingCount = (route?.params?.existingCount as number | undefined) ?? 0
  const remaining     = Math.max(0, MAX_PHOTOS - existingCount)

  const [uploading, setUploading] = useState(false)
  const inputRef   = useRef<HTMLInputElement | null>(null)

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
      let firstUri: string | undefined

      for (const file of files) {
        const formData = new FormData()
        formData.append('ID', userId)
        formData.append('UPLOADPHOTO', file, file.name)

        const res = await uploadFile(Endpoints.media.addProfilePic, formData)
        if (res?.RESPONSECODE == 1) {
          if (res?.RESPONSE?.PHOTOURL) {
            await setItem(SK.User.PHOTO_URL, String(res.RESPONSE.PHOTOURL))
          }
          if (!firstUri) firstUri = URL.createObjectURL(file)
        }
      }

      navigation.push('onboarding', { pageNo: '21', pendingUri: firstUri })
    } catch {
      Alert.alert('Error', 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
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
    fontSize:   22,
    fontWeight: '700',
    color:      '#111',
    textAlign:  'center',
  },
  subtitle: {
    fontSize:   14,
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
    fontSize:   16,
    fontWeight: '600',
    color:      '#fff',
  },
})
