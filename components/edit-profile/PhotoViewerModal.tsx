// Desktop "view photo" popup for Edit Profile's own photo grid (Figma "Jodii
// Desktop - Registration", UaPAN9aG6MfZf6CRpwXf1L, node 647:3504) — a
// centered white card with a big photo, a delete icon on the photo itself,
// external prev/next chevrons, an "n/total" counter, and two actions below
// ("Make as profile picture" / "Replace this photo").
//
// Deliberately a NEW sibling component, not a reuse of
// components/matches/PhotoViewerModalDesktop.tsx — that one is a read-only
// viewer for OTHER members' photos (thumbnail strip, no delete/make-main/
// replace actions); this one owns real mutating actions on the viewer's own
// profile photos, so its layout (page counter instead of a thumbnail strip,
// chevrons sitting inside the card's own side margins rather than outside
// it, action buttons under the photo) and props are genuinely different.
//
// "Replace this photo" has no dedicated backend endpoint anywhere in this
// codebase (mobile or web) — confirmed by checking service/api.endpoints.ts
// and service/profileService.ts. Composed here from the two real primitives
// that DO exist: upload the new file via the caller's existing add-photo
// flow, then delete the old PHOTOID — see EditProfileDesktopScreen.tsx's
// openReplacePicker()/handleFiles() for that composition.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const DELETE_ICON  = CDN_REACT + '/edit-profile-photo-delete-icon.svg'
const CHEVRON_ICON = CDN_REACT + '/photo-viewer-chevron-icon.svg'

const CARD_WIDTH = 680
const PHOTO_SIZE = 360

export interface ViewerPhoto {
  PHOTOID:  string
  PHOTOURL: string
  PHOTOTHUMB?: string
}

export interface PhotoViewerModalProps {
  visible:      boolean
  photos:       ViewerPhoto[]
  initialIndex: number
  uploading?:   boolean
  onClose:      () => void
  onDelete:     (photo: ViewerPhoto) => void
  onSetMain:    (photo: ViewerPhoto) => void
  onReplace:    (photo: ViewerPhoto) => void
}

export default function PhotoViewerModal({
  visible, photos, initialIndex, uploading, onClose, onDelete, onSetMain, onReplace,
}: PhotoViewerModalProps) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(initialIndex)

  useEffect(() => {
    if (visible) setIndex(initialIndex)
  }, [visible, initialIndex])

  const photo    = photos[index]
  const hasPrev  = index > 0
  const hasNext  = index < photos.length - 1
  const isMain   = index === 0

  function goPrev() { setIndex(i => Math.max(0, i - 1)) }
  function goNext() { setIndex(i => Math.min(photos.length - 1, i + 1)) }

  if (!photo) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <Pressable style={s.closeBtn} onPress={onClose} hitSlop={8}>
            <Text style={s.closeIcon}>{'✕'}</Text>
          </Pressable>

          <View style={s.photoBox}>
            <Image source={{ uri: photo.PHOTOURL || photo.PHOTOTHUMB || '' }} style={s.photoImg} contentFit="cover" />
            {/* Angular/PhotoAlbumViewerMobile.tsx: MAINPHOTO==0 gate — the main
                profile photo can't be deleted directly, only replaced or
                superseded by making another photo the main one first. */}
            {!isMain && (
              <Pressable style={s.deleteBtn} onPress={() => onDelete(photo)} hitSlop={4}>
                <CdnSvg uri={DELETE_ICON} width={24} height={24} />
              </Pressable>
            )}
          </View>

          <Text style={s.counter}>{index + 1}/{photos.length}</Text>

          {hasPrev && (
            <Pressable style={[s.chevronBtn, s.chevronLeft]} onPress={goPrev} hitSlop={8}>
              <CdnSvg uri={CHEVRON_ICON} width={16} height={9} style={s.chevronLeftIcon} />
            </Pressable>
          )}
          {hasNext && (
            <Pressable style={[s.chevronBtn, s.chevronRight]} onPress={goNext} hitSlop={8}>
              <CdnSvg uri={CHEVRON_ICON} width={16} height={9} style={s.chevronRightIcon} />
            </Pressable>
          )}

          <View style={s.actions}>
            {!isMain && (
              <Pressable style={s.primaryBtn} onPress={() => onSetMain(photo)}>
                <Text style={s.primaryBtnText}>{t('EDITPROFILE.MAKE_PROFILE_PIC', 'Make as profile picture')}</Text>
              </Pressable>
            )}
            <Pressable style={s.secondaryBtn} onPress={() => onReplace(photo)} disabled={uploading}>
              {uploading ? <ActivityIndicator color={Colors.textDark} /> : (
                <Text style={s.secondaryBtnText}>{t('EDITPROFILE.REPLACE_PHOTO', 'Replace this photo')}</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: CARD_WIDTH, backgroundColor: Colors.white, borderRadius: 24,
    alignItems: 'center', paddingTop: 50, paddingBottom: 40, position: 'relative',
  },
  closeBtn: {
    position: 'absolute', top: 24, right: 24, width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background,
  },
  closeIcon: { fontSize: 16, color: Colors.textDark },

  photoBox: {
    width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#d9d9d9', position: 'relative',
  },
  photoImg: { width: '100%', height: '100%' },
  deleteBtn: { position: 'absolute', top: 15, right: 16 },

  counter: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black, marginTop: 8 },

  // Figma node 735:29585: chevrons sit within the card's own side margins
  // around the centered photo, not outside the card — (680-360)/2=160px
  // margin each side, chevron inset ~93px into that margin.
  chevronBtn: {
    position: 'absolute', top: 186, width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(51,51,51,0.6)',
  },
  chevronLeft:  { left: 93 },
  chevronRight: { right: 93 },
  chevronLeftIcon:  { transform: [{ rotate: '90deg' }] },
  chevronRightIcon: { transform: [{ rotate: '-90deg' }] },

  actions: { width: PHOTO_SIZE, gap: 16, marginTop: 16 },
  primaryBtn: {
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.white },
  secondaryBtn: {
    height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#545454',
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { fontFamily: Fonts.poppinsRegular, fontSize: 14, color: '#545454' },
})
