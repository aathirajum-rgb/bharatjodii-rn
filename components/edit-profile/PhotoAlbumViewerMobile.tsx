// Mobile "view photo" full-screen swipeable viewer for Edit Profile's own
// photo grid — ports Angular's managephoto.page.ts/html `showAlbum` state
// (reached via edit-profile.page.html's albumView() → /managephoto/album/:id),
// NOT the same UI as PhotoViewerModal.tsx (that one is the separate desktop
// card layout with external chevrons — Figma "Jodii Desktop" node 647:3504).
//
// Angular behavior mirrored here:
// - Header: back, "Photo (N)" title, trash icon (only when the active photo
//   isn't the main one — MAINPHOTO==0 in Angular).
// - "{index}/{total}" counter above a swipeable, paged photo carousel.
// - A "Profile Photo" / "Photos" tag overlaying the carousel's top-left
//   corner (Angular: .profile-photo-box, background #4c4c4c).
// - "Use as profile photo" (non-main only) → setMainPhoto(); "Replace photo"
//   (always present, primary style on the main photo / secondary style
//   otherwise) → picks a new photo, uploads it, then deletes the old one.
//   There is no dedicated "replace" endpoint anywhere in this codebase (see
//   PhotoViewerModal.tsx's header comment) — same upload-then-delete
//   composition as EditProfileDesktopScreen.tsx's handleFiles()/replacing.
// - Delete confirmation reuses DeletePhotoConfirmModal — its own header
//   comment confirms that dialog IS the real Angular "revamp" delete-photo
//   popup reachable from this exact slider trash icon.
// - Setting main / deleting / replacing all close the viewer afterward,
//   matching Angular's auto-navigate-back-on-success (ele.click() on the
//   back button) — simplest correct behavior given the parent just refetches.
import { useEffect, useRef, useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../cdn-svg/CdnSvg'
import DeletePhotoConfirmModal from './DeletePhotoConfirmModal'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { Endpoints } from '../../service/api.endpoints'
import { uploadFile } from '../../service/apiClient'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { deletePhoto, setMainPhoto } from '../../service/profileService'
import {
  getPhotoConfig, validatePhotoAsset, getRejectReasons, describeRejection,
} from '../../service/photoValidationService'
import { FontSize } from '../../src/theme/fonts'

const ICON_BACK   = CDN_REACT + '/menu_back_arrow.svg'
const ICON_DELETE = CDN_REACT + '/edit-profile-photo-delete-icon.svg'
const SCREEN_W    = Dimensions.get('window').width

export interface AlbumPhoto {
  PHOTOID:     string
  PHOTOURL:    string
  PHOTOTHUMB?: string
  MAINPHOTO:   number
}

export interface PhotoAlbumViewerMobileProps {
  visible:      boolean
  photos:       AlbumPhoto[]
  initialIndex: number
  onClose:      () => void
  onChanged:    () => void   // refetch the caller's photo list
}

export default function PhotoAlbumViewerMobile({
  visible, photos, initialIndex, onClose, onChanged,
}: PhotoAlbumViewerMobileProps) {
  const insets = useSafeAreaInsets()
  const [index,        setIndex]        = useState(initialIndex)
  const [busy,         setBusy]         = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AlbumPhoto | null>(null)
  const listRef = useRef<FlatList>(null)
  // Set true before the (async) permission request/picker launch, not after —
  // otherwise a fast double-tap on "Replace photo" can fire both before either
  // promise settles.
  const pickerBusyRef = useRef(false)

  useEffect(() => {
    if (visible) setIndex(initialIndex)
  }, [visible, initialIndex])

  const current = photos[index]
  const isMain  = current?.MAINPHOTO == 1

  function onMomentumScrollEnd(e: any) {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
    if (i !== index && photos[i]) setIndex(i)
  }

  async function handleUseAsProfile() {
    if (!current || busy) return
    setBusy(true)
    try {
      const res = await setMainPhoto(current.PHOTOID)
      if (res?.RESPONSECODE == 1) {
        onChanged()
        onClose()
      } else {
        Alert.alert('Error', 'Could not set profile photo.')
      }
    } catch {
      Alert.alert('Error', 'Could not set profile photo.')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    setBusy(true)
    try {
      const res = await deletePhoto(target.PHOTOID)
      if (res?.RESPONSECODE == 1) {
        onChanged()
        onClose()
      } else {
        Alert.alert('Error', 'Could not delete photo.')
      }
    } catch {
      Alert.alert('Error', 'Could not delete photo.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReplace() {
    if (!current || busy || pickerBusyRef.current) return
    pickerBusyRef.current = true
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow photo library access in Settings to replace this photo.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:    ['images'],
        allowsEditing: true,
        aspect:        [3, 4],
        quality:       0.85,
      })
      if (result.canceled || !result.assets[0]) return

      const target = current
      const asset  = result.assets[0]
      setBusy(true)
      try {
        const config = await getPhotoConfig()
        const validation = await validatePhotoAsset({
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
        }, config)
        if (!validation.ok) {
          const reasons = await getRejectReasons()
          Alert.alert('Photo not replaced', describeRejection(validation.code, reasons))
          return
        }

        const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
        const formData = new FormData()
        formData.append('ID', userId)
        formData.append('AIVALIDATE', config.isNativeFaceDetectionEnabled ? '1' : '0')
        formData.append('UPLOADPHOTO', {
          uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? 'photo.jpg',
        } as any)

        const uploadRes = await uploadFile(Endpoints.media.addProfilePic, formData)
        if (uploadRes?.RESPONSECODE == 1) {
          if (uploadRes?.RESPONSE?.PHOTOURL) {
            await setItem(SK.User.PHOTO_URL, String(uploadRes.RESPONSE.PHOTOURL))
          }
          await deletePhoto(target.PHOTOID)
          onChanged()
          onClose()
        } else {
          Alert.alert('Error', 'Could not replace photo.')
        }
      } catch {
        Alert.alert('Error', 'Could not replace photo.')
      } finally {
        setBusy(false)
      }
    } finally {
      pickerBusyRef.current = false
    }
  }

  if (!current) return null

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[s.screen, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
            <CdnSvg uri={ICON_BACK} width={24} height={24} />
          </Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>Photo ({photos.length})</Text>
          {!isMain && (
            <Pressable style={s.deleteBtn} onPress={() => setDeleteTarget(current)} hitSlop={8}>
              <CdnSvg uri={ICON_DELETE} width={20} height={20} />
            </Pressable>
          )}
        </View>

        {/* Counter */}
        <Text style={s.counter}>{index + 1}/{photos.length}</Text>

        {/* Swipeable carousel */}
        <View style={s.sliderWrap}>
          <FlatList
            ref={listRef}
            data={photos}
            keyExtractor={p => p.PHOTOID}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
            onMomentumScrollEnd={onMomentumScrollEnd}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item.PHOTOURL || item.PHOTOTHUMB || '' }}
                style={s.slideImg}
                contentFit="cover"
              />
            )}
          />

          <View style={s.tag}>
            <Text style={s.tagText}>{isMain ? 'Profile Photo' : 'Photos'}</Text>
          </View>

          <View style={s.dotsRow} pointerEvents="none">
            {photos.map((p, i) => (
              <View key={p.PHOTOID} style={[s.dot, i === index && s.dotActive]} />
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={[s.actions, { paddingBottom: insets.bottom + 20 }]}>
          {!isMain && (
            <Pressable style={s.primaryBtn} onPress={handleUseAsProfile} disabled={busy}>
              {busy
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={s.primaryBtnText}>Use as profile photo</Text>
              }
            </Pressable>
          )}
          <Pressable
            style={isMain ? s.primaryBtn : s.secondaryBtn}
            onPress={handleReplace}
            disabled={busy}
          >
            {busy && isMain
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={isMain ? s.primaryBtnText : s.secondaryBtnText}>Replace photo</Text>
            }
          </Pressable>
        </View>
      </View>

      <DeletePhotoConfirmModal
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: FontSize.font20, fontWeight: '600', color: Colors.black, marginLeft: 6 },
  deleteBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  counter: {
    marginTop: 32, fontSize: FontSize.font20, fontWeight: '400', color: Colors.black, textAlign: 'center',
  },

  sliderWrap: { marginTop: 16, position: 'relative' },
  slideImg:   { width: SCREEN_W, height: SCREEN_W * 1.2 },

  // Angular .profile-photo-box: bg #4c4c4c, overlaid top-left of the slider
  tag: {
    position: 'absolute', top: 0, left: 0,
    backgroundColor: '#4c4c4c', paddingVertical: 3, paddingHorizontal: 21,
    borderBottomRightRadius: 8,
  },
  tagText: { fontSize: FontSize.font10, color: '#fffefe' },

  // Dynamic-bullet style dot pagination (Angular swiper dynamicBullets)
  dotsRow: {
    position: 'absolute', bottom: 12, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  dot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.white, opacity: 0.5,
  },
  dotActive: { width: 12, opacity: 1 },

  actions: { paddingHorizontal: 24, paddingTop: 32, gap: 16 },
  primaryBtn: {
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: FontSize.font14, fontWeight: '500', color: Colors.white },
  secondaryBtn: {
    height: 44, borderRadius: 8, backgroundColor: Colors.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: FontSize.font14, fontWeight: '500', color: Colors.inputBorder },
})
