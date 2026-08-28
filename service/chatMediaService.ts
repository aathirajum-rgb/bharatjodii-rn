// Image/video attachment picking + upload for the one-to-one chat screen —
// Angular: messages.component.ts's trigerFile()/loadImageFromDevice() (pick +
// validate) and modalpopup.component.ts's sendAudio() (upload — the same
// generic endpoint Angular reuses for audio/image/video/pdf despite the name).
// Scope: image and video only — pdf/audio are separate, out of scope here.
import * as ImagePicker from 'expo-image-picker'
import { Alert } from 'react-native'
import { uploadFile } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'

// Angular: loadImageFromDevice()'s formatAllow/size gates — image ≤25MB,
// video ≤100MB. expo-image-picker reports a broad `image/*`/`video/*` mime
// type per asset type rather than Angular's specific per-format list, so the
// asset's own `type` field ('image'|'video'|'livePhoto'|'pairedVideo') is the
// practical equivalent of Angular's MIME allow-list check here.
const MAX_IMAGE_BYTES = 26214400  // 25MB
const MAX_VIDEO_BYTES = 104857600 // 100MB

export interface PickedChatAttachment {
  msgType: '2' | '3' | '5'  // Angular: 2=audio 3=video 5=image
  uri:     string
  mimeType: string
}

export type PickAttachmentResult =
  | { ok: true; attachment: PickedChatAttachment }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'tooLarge' }
  | { ok: false; reason: 'permissionDenied' }

async function launchPicker(source: 'camera' | 'library'): Promise<ImagePicker.ImagePickerResult | null> {
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) return null

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images', 'videos'],
    quality: 0.85,
    videoMaxDuration: 180,
  }
  return source === 'camera' ? ImagePicker.launchCameraAsync(options) : ImagePicker.launchImageLibraryAsync(options)
}

// Angular: the native file-input's browser picker sheet (Camera / Photo
// Library, no forced-camera-only mode) — RN has no equivalent single control,
// so an explicit chooser stands in for it (same Alert.alert action-sheet
// pattern ProfilePhoto.tsx already uses for the profile-photo picker).
export function chooseAttachmentSource(): Promise<'camera' | 'library' | null> {
  return new Promise(resolve => {
    Alert.alert('Add attachment', 'Choose a source', [
      { text: 'Camera', onPress: () => resolve('camera') },
      { text: 'Photo Library', onPress: () => resolve('library') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ])
  })
}

export async function pickChatAttachment(source: 'camera' | 'library'): Promise<PickAttachmentResult> {
  const result = await launchPicker(source)
  if (!result) return { ok: false, reason: 'permissionDenied' }
  if (result.canceled || !result.assets?.[0]) return { ok: false, reason: 'cancelled' }

  const asset = result.assets[0]
  const isVideo = asset.type === 'video'
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  // fileSize isn't always populated by every platform/picker version — fail
  // open (allow) rather than block a legitimate attachment on missing metadata.
  if (asset.fileSize != null && asset.fileSize > maxBytes) {
    return { ok: false, reason: 'tooLarge' }
  }

  return {
    ok: true,
    attachment: {
      msgType: isVideo ? '3' : '5',
      uri: asset.uri,
      mimeType: asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
    },
  }
}

// Angular: modalpopup.component.ts's sendAudio() — POSTs to the SAME
// `chataudioupd` endpoint for audio/image/video/pdf alike; the field name
// `UPLOADAUDIO` and response fields `DOMAINNAME`/`AUDIOPATH` are misleading
// leftovers from the endpoint's original audio-only purpose but are confirmed
// (via that shared reuse) to carry image/video uploads too.
export async function uploadChatAttachment(attachment: PickedChatAttachment): Promise<string | null> {
  const loginId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const defaultExtension = attachment.msgType === '3' ? 'mp4' : attachment.msgType === '2' ? 'm4a' : 'jpg'
  const extension = attachment.mimeType.split('/')[1] ?? defaultExtension

  const formData = new FormData()
  formData.append('ID', loginId)
  formData.append('UPLOADAUDIO', {
    uri: attachment.uri,
    type: attachment.mimeType,
    name: `chat-attachment.${extension}`,
  } as any)

  const result = await uploadFile(Endpoints.media.chatAudioUpdate, formData)

  const ok = result?.RESPONSECODE === '1' || result?.RESPONSECODE == 1
  if (!ok || !result?.AUDIOPATH) return null
  const domain = String(result.DOMAINNAME ?? '').replace(/\/$/, '')
  return `${domain}/${result.AUDIOPATH}`
}
