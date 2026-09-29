// Mobile "Photo preview" full-screen swipeable viewer for Edit Profile's own
// photo grid — ports Angular's managephoto.page.ts/html `showAlbum` state
// (reached via edit-profile.page.html's albumView() → /managephoto/album/:id),
// NOT the same UI as PhotoViewerModal.tsx (that one is the separate desktop
// card layout with external chevrons — Figma "Jodii Desktop" node 647:3504).
//
// Layout follows the new "Photo preview" design:
// - Header: back, "Photo preview" title, trash icon (only when the active photo
//   isn't the main one — MAINPHOTO==0 in Angular; same rule as the grid).
// - Full-width swipeable, paged photo carousel with a red "Profile Picture"
//   chip on the main photo's top-left corner.
// - Pager under the photo: dots (active = red pill) + "(n/total)".
// - "Make as profile photo" (primary, non-main only) → setMainPhoto();
//   "Replace photo" (outlined, always) → picks a new photo, uploads it, then
//   deletes the old one. There is no dedicated "replace" endpoint anywhere in
//   this codebase (see PhotoViewerModal.tsx's header comment) — same
//   upload-then-delete composition as EditProfileDesktopScreen.tsx's
//   handleFiles()/replacing.
// - Delete confirmation is the shared BottomSheet sliding up over this
//   preview, with the Angular "revamp" delete-photo popup's copy (same text
//   as DeletePhotoConfirmModal, which stays the desktop dialog): ✕, trash
//   icon, "Delete photo?", "Are you sure…", single red "Delete" CTA.
// - Setting main / deleting / replacing all close the viewer afterward,
//   matching Angular's auto-navigate-back-on-success (ele.click() on the
//   back button) — simplest correct behavior given the parent just refetches.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import BottomSheet from '../bottom-sheet/BottomSheet'
import { Colors } from '../../constants/colors'
import { CDN_REACT, CDN_REG } from '../../constants/cdn'
import { Endpoints } from '../../service/api.endpoints'
import { uploadFile } from '../../service/apiClient'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { deletePhoto, setMainPhoto } from '../../service/profileService'
import {
  getPhotoConfig, validatePhotoAsset, getRejectReasons, describeRejection,
} from '../../service/photoValidationService'
import { Fonts, FontSize } from '../../src/theme/fonts'

const ICON_BACK   = CDN_REACT + '/menu_back_arrow.svg'
// Outline trash (registration-new/trash-img.svg). The earlier
// react/edit-profile-photo-delete-icon.svg asset 404s on every image host.
const ICON_DELETE = CDN_REG + 'trash-img.svg'
// Delete-confirm sheet's icon — same asset as DeletePhotoConfirmModal's illustration.
const ICON_DELETE_SHEET = CDN_REG + 'delete-photo.svg'
// The glyph only fills the middle ~half of the SVG's 24px box, so it's drawn
// larger than a normal 24px header icon to read at the same visual size.
const DELETE_ICON_SIZE = 36
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
  // Optional: when given, once the member CONFIRMS in the delete sheet the
  // viewer closes and hands the delete to the caller (the Edit Profile screen
  // runs its own undo-able deferred delete) instead of deleting immediately.
  onDeleteRequest?: ((photo: AlbumPhoto) => void) | undefined
  // Optional: fired after a successful "Make as profile photo", with the
  // previous main photo's id so the caller can offer an Undo.
  onMainPhotoSet?: ((previousMainId: string | undefined) => void) | undefined
}

export default function PhotoAlbumViewerMobile({
  visible, photos, initialIndex, onClose, onChanged, onDeleteRequest, onMainPhotoSet,
}: PhotoAlbumViewerMobileProps) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const [index,        setIndex]        = useState(initialIndex)
  const [busy,         setBusy]         = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AlbumPhoto | null>(null)
  const listRef = useRef<FlatList>(null)
  // Set true before the (async) permission request/picker launch, not after —
  // otherwise a fast double-tap on "Replace photo" can fire both before either
  // promise settles.
  const pickerBusyRef = useRef(false)

  // Real slide width, measured from the carousel's own layout — on web the
  // modal isn't necessarily the full window width, so Dimensions alone put
  // the paging maths (and the image width) off.
  const [slideW, setSlideW] = useState(SCREEN_W)

  // The component stays mounted between openings, so initialScrollIndex only
  // applies the first time — re-position on every open (and on re-measure).
  useEffect(() => {
    if (!visible) return
    setIndex(initialIndex)
    const id = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: initialIndex * slideW, animated: false })
    }, 0)
    return () => clearTimeout(id)
  }, [visible, initialIndex, slideW])

  const current = photos[index]
  const isMain  = current?.MAINPHOTO == 1

  // Driven from onScroll (fires on native AND web) rather than only
  // onMomentumScrollEnd, which react-native-web never emits — that's why the
  // dots and "(n/total)" stayed stuck on web.
  function syncIndexFromOffset(x: number) {
    const i = Math.round(x / slideW)
    if (i !== index && photos[i]) setIndex(i)
  }

  async function handleUseAsProfile() {
    if (!current || busy) return
    setBusy(true)
    const previousMainId = photos.find(p => p.MAINPHOTO == 1)?.PHOTOID
    try {
      const res = await setMainPhoto(current.PHOTOID)
      if (res?.RESPONSECODE == 1) {
        onChanged()
        onClose()
        onMainPhotoSet?.(previousMainId)
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
    if (onDeleteRequest) {
      onClose()
      onDeleteRequest(target)
      return
    }
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
          <Text style={s.headerTitle} numberOfLines={1}>{t('EDITPROFILE.PHOTO_PREVIEW', 'Photo preview')}</Text>
          {!isMain && (
            <Pressable
              style={s.deleteBtn}
              onPress={() => setDeleteTarget(current)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Delete photo"
            >
              <CdnSvg uri={ICON_DELETE} width={DELETE_ICON_SIZE} height={DELETE_ICON_SIZE} />
            </Pressable>
          )}
        </View>

        <View style={s.body}>
          {/* Swipeable carousel */}
          <View
            style={s.sliderWrap}
            onLayout={e => {
              const w = Math.round(e.nativeEvent.layout.width)
              if (w > 0 && w !== slideW) setSlideW(w)
            }}
          >
            <FlatList
              ref={listRef}
              data={photos}
              keyExtractor={p => p.PHOTOID}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={initialIndex}
              getItemLayout={(_, i) => ({ length: slideW, offset: slideW * i, index: i })}
              onScroll={e => syncIndexFromOffset(e.nativeEvent.contentOffset.x)}
              onMomentumScrollEnd={e => syncIndexFromOffset(e.nativeEvent.contentOffset.x)}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item.PHOTOURL || item.PHOTOTHUMB || '' }}
                  style={{ width: slideW, height: slideW * 4 / 3 }}
                  contentFit="cover"
                />
              )}
            />
            {isMain && (
              <View style={s.tag} pointerEvents="none">
                <Text style={s.tagText}>{t('EDITPROFILE.PROFILE_PICTURE', 'Profile Picture')}</Text>
              </View>
            )}
          </View>

          {/* Pager: dots (active = red pill) + "(n/total)" */}
          <View style={s.pagerRow}>
            {photos.length > 1 && (
              <View style={s.dotsRow}>
                {photos.map((p, i) => (
                  <View key={p.PHOTOID} style={[s.dot, i === index && s.dotActive]} />
                ))}
              </View>
            )}
            <Text style={s.counter}>({index + 1}/{photos.length})</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={[s.actions, { paddingBottom: insets.bottom + 20 }]}>
          {!isMain && (
            <Pressable style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]} onPress={handleUseAsProfile} disabled={busy}>
              {busy
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={s.primaryBtnText}>{t('EDITPROFILE.MAKE_PROFILE_PHOTO', 'Make as profile photo')}</Text>
              }
            </Pressable>
          )}
          <Pressable style={({ pressed }) => [s.secondaryBtn, pressed && s.pressed]} onPress={handleReplace} disabled={busy}>
            {busy && isMain
              ? <ActivityIndicator color={Colors.textDark} />
              : <Text style={s.secondaryBtnText}>{t('EDITPROFILE.REPLACE_PHOTO', 'Replace photo')}</Text>
            }
          </Pressable>
        </View>
      </View>

      <BottomSheet visible={!!deleteTarget} onClose={() => setDeleteTarget(null)} showClose={false}>
        <View style={s.sheetTopRow}>
          <CdnSvg uri={ICON_DELETE_SHEET} width={40} height={40} />
          <Pressable style={s.sheetCloseBtn} onPress={() => setDeleteTarget(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={s.sheetCloseX}>✕</Text>
          </Pressable>
        </View>
        <Text style={s.sheetTitle}>{t('EDITPROFILE.DELETE_PHOTO_TXT', 'Delete photo?')}</Text>
        <Text style={s.sheetMessage}>{t('EDITPROFILE.DELETE_PHOTO_SUB_TXT', 'Are you sure you want to delete this photo?')}</Text>
        <Pressable style={({ pressed }) => [s.primaryBtn, s.sheetDeleteBtn, pressed && s.pressed]} onPress={handleConfirmDelete} accessibilityRole="button">
          <Text style={s.primaryBtnText}>{t('EDITPROFILE.DELETE_PHOTO_CTA_2', 'Delete')}</Text>
        </Pressable>
      </BottomSheet>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  // Same header as the Edit Profile screens: 56 tall, white, soft drop shadow,
  // 16/Medium/#333333 title.
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, zIndex: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  headerTitle: {
    flex: 1, fontSize: FontSize.font16, fontFamily: Fonts.poppinsMedium, color: Colors.textDark, marginLeft: 6,
  },
  deleteBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 12 },

  // Photo + pager sit centred in the space between the header and the CTAs.
  body: { flex: 1, justifyContent: 'center' },
  sliderWrap: { position: 'relative', width: '100%', overflow: 'hidden' },

  // "Profile Picture" chip — same red badge as the Edit Profile grid's main tile.
  tag: {
    position: 'absolute', top: 0, left: 0, height: 22, justifyContent: 'center',
    backgroundColor: Colors.primaryDark, paddingHorizontal: 8, borderBottomRightRadius: 16,
  },
  tagText: { fontSize: FontSize.font12, fontFamily: Fonts.poppinsMedium, color: Colors.white },

  pagerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20,
  },
  dotsRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.borderSubtle },
  dotActive: { width: 20, backgroundColor: Colors.primaryDark },
  counter:   { fontSize: FontSize.font14, fontFamily: Fonts.poppinsRegular, color: Colors.textDark },

  actions: { paddingHorizontal: 24, paddingTop: 24, gap: 12 },
  primaryBtn: {
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: FontSize.font14, fontFamily: Fonts.poppinsMedium, color: Colors.white },
  secondaryBtn: {
    height: 44, borderRadius: 8, borderWidth: 1, borderColor: Colors.textDark, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: FontSize.font14, fontFamily: Fonts.poppinsRegular, color: Colors.textDark },
  pressed: { opacity: 0.8 },

  // Delete-confirm bottom sheet content (left-aligned, per the mobile design).
  sheetTopRow:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sheetCloseBtn: { padding: 4 },
  sheetCloseX:   { fontSize: FontSize.font16, color: Colors.textTertiary },
  sheetTitle:    { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font20, color: Colors.black, marginTop: 16 },
  sheetMessage:  { fontFamily: Fonts.poppinsRegular, fontSize: FontSize.font16, lineHeight: 24, color: Colors.textDark, marginTop: 8 },
  sheetDeleteBtn: { marginTop: 24 },
})
