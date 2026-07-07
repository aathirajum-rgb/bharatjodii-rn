import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'
import { Endpoints } from '../../service/api.endpoints'
import { apiCall, uploadFile } from '../../service/apiClient'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'

// ─── Layout constants ──────────────────────────────────────────────────────────

const MAX_PHOTOS  = 10
const COLS        = 3
const H_PAD       = 16
const GAP         = 8
const SCREEN_W    = Dimensions.get('window').width
const SLOT_W      = Math.floor((SCREEN_W - H_PAD * 2 - GAP * (COLS - 1)) / COLS)
const SLOT_H      = Math.floor(SLOT_W * 4 / 3)

// ─── Types ─────────────────────────────────────────────────────────────────────

type Photo = {
  PHOTOID:     string
  PHOTOTHUMB:  string
  MAINPHOTO:   number   // 1 = main photo
  PHOTOSTATUS: number   // 0 = under review, 1 = approved
}

type Props = {
  navigation: any
  route:      { params?: { pageNo?: string } }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ManagePhotosScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()

  useOnboardingFooter({
    nextLabel:    'Continue',
    nextDisabled: false,
    onNext:       () => navigation.push('onboarding', { pageNo: '27' }),
  }, [navigation])

  const [photos,      setPhotos]      = useState<Photo[]>([])
  const [loading,     setLoading]     = useState(true)
  const [uploading,   setUploading]   = useState(false)
  const [actionPhoto, setActionPhoto] = useState<Photo | null>(null)

  const slideAnim = useRef(new Animated.Value(300)).current

  useEffect(() => { loadPhotos() }, [])

  // ─── Data ──────────────────────────────────────────────────────────────────

  async function loadPhotos() {
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      const res = await apiCall(Endpoints.profile.managePhoto, 'POST', `ID=${userId}`)
      if (res?.RESPONSECODE == 1 && res?.RESPONSE?.PHOTOS) {
        setPhotos(res.RESPONSE.PHOTOS)
      }
    } catch {
      // keep empty state, user can retry by coming back
    } finally {
      setLoading(false)
    }
  }

  // ─── Upload ────────────────────────────────────────────────────────────────

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [3, 4], quality: 0.85,
    })
    if (!result.canceled) doUpload(result.assets[0])
  }

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Photo library access is needed.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true, aspect: [3, 4], quality: 0.85,
    })
    if (!result.canceled) doUpload(result.assets[0])
  }

  function openPicker() {
    if (uploading || photos.length >= MAX_PHOTOS) return
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        (idx) => { if (idx === 1) pickFromCamera(); if (idx === 2) pickFromGallery() },
      )
    } else {
      Alert.alert('Add photo', 'Choose a source', [
        { text: 'Camera',  onPress: pickFromCamera },
        { text: 'Gallery', onPress: pickFromGallery },
        { text: 'Cancel',  style: 'cancel' },
      ])
    }
  }

  async function doUpload(asset: ImagePicker.ImagePickerAsset) {
    setUploading(true)
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      const formData = new FormData()
      formData.append('ID', userId)
      formData.append('UPLOADPHOTO', {
        uri:  asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName  ?? 'photo.jpg',
      } as any)

      const res = await uploadFile(Endpoints.media.addProfilePic, formData)
      if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0) {
        await loadPhotos()
      } else {
        Alert.alert('Upload failed', res?.RESPONSE?.MESSAGE ?? 'Please try again.')
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  // ─── Photo actions ─────────────────────────────────────────────────────────

  function openActions(photo: Photo) {
    if (photo.PHOTOSTATUS === 0) {
      Alert.alert('Photo under review', 'This photo is being verified. You can delete it if needed.', [
        { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(photo) },
        { text: 'Cancel', style: 'cancel' },
      ])
      return
    }
    setActionPhoto(photo)
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20,
    }).start()
  }

  function closeActions(cb?: () => void) {
    Animated.timing(slideAnim, {
      toValue: 300, duration: 220, useNativeDriver: true,
    }).start(() => {
      setActionPhoto(null)
      cb?.()
    })
  }

  async function handleSetMain(photo: Photo) {
    closeActions()
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      const res = await apiCall(
        Endpoints.profile.setMainPhoto, 'POST',
        `ID=${userId}&PHOTOID=${photo.PHOTOID}`,
      )
      if (res?.RESPONSECODE == 1) await loadPhotos()
    } catch {
      Alert.alert('Error', 'Could not update main photo. Please try again.')
    }
  }

  function confirmDelete(photo: Photo) {
    Alert.alert('Delete photo', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
            const res = await apiCall(
              Endpoints.profile.deletePhoto, 'POST',
              `ID=${userId}&PHOTOID=${photo.PHOTOID}`,
            )
            if (res?.RESPONSECODE == 1) await loadPhotos()
          } catch {
            Alert.alert('Error', 'Could not delete photo. Please try again.')
          }
        },
      },
    ])
  }

  function handleDelete(photo: Photo) {
    closeActions(() => confirmDelete(photo))
  }

  // ─── Grid slots ────────────────────────────────────────────────────────────
  // Filled photos + one "Add" slot (if under limit) + dimmed placeholder slots

  const canAddMore = photos.length < MAX_PHOTOS

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Your photos</Text>
        <Text style={styles.subtitle}>
          {photos.length}/{MAX_PHOTOS} photos added
          {canAddMore ? ' · Add more for better responses' : ''}
        </Text>

        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.grid}>
            {/* Existing photos */}
            {photos.map((photo) => (
              <Pressable
                key={photo.PHOTOID}
                style={styles.slot}
                onLongPress={() => openActions(photo)}
                delayLongPress={300}
              >
                <Image
                  source={{ uri: photo.PHOTOTHUMB }}
                  style={styles.slotImage}
                  contentFit="cover"
                />

                {/* Main badge */}
                {photo.MAINPHOTO === 1 && (
                  <View style={styles.mainBadge}>
                    <Text style={styles.mainBadgeText}>★ Main</Text>
                  </View>
                )}

                {/* Under-review overlay */}
                {photo.PHOTOSTATUS === 0 && (
                  <View style={styles.reviewOverlay}>
                    <Text style={styles.reviewText}>Under review</Text>
                  </View>
                )}

                {/* Long-press hint dot */}
                <View style={styles.dotsHint}>
                  <Text style={styles.dotsHintText}>···</Text>
                </View>
              </Pressable>
            ))}

            {/* Add more slot */}
            {canAddMore && (
              <Pressable
                style={[styles.slot, styles.addSlot]}
                onPress={openPicker}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color={Colors.primary} size="large" />
                ) : (
                  <>
                    <Text style={styles.addIcon}>+</Text>
                    <Text style={styles.addLabel}>Add photo</Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Dimmed placeholder slots to fill the grid visually */}
            {Array.from({
              length: COLS - ((photos.length + (canAddMore ? 1 : 0)) % COLS || COLS),
            }).map((_, i) => (
              <View key={`ph-${i}`} style={[styles.slot, styles.phantomSlot]} />
            ))}
          </View>
        )}

        <Text style={styles.hint}>Long-press a photo to set as main or delete</Text>
      </ScrollView>

      {/* Photo action sheet */}
      <Modal
        transparent
        visible={actionPhoto !== null}
        animationType="none"
        onRequestClose={() => closeActions()}
        statusBarTranslucent
      >
        <Pressable style={styles.sheetOverlay} onPress={() => closeActions()}>
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: Platform.OS === 'ios' ? insets.bottom + 16 : 24,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.sheetTitle}>Photo options</Text>

            {actionPhoto?.MAINPHOTO !== 1 && (
              <Pressable
                style={styles.sheetOption}
                onPress={() => actionPhoto && handleSetMain(actionPhoto)}
              >
                <Text style={styles.sheetOptionText}>Set as main photo</Text>
              </Pressable>
            )}

            <View style={styles.sheetDivider} />

            <Pressable
              style={styles.sheetOption}
              onPress={() => actionPhoto && handleDelete(actionPhoto)}
            >
              <Text style={[styles.sheetOptionText, styles.sheetOptionDanger]}>Delete photo</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingTop:        16,
  },

  title: {
    fontSize:     22,
    fontWeight:   '700',
    color:        Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize:     14,
    fontWeight:   '400',
    color:        Colors.textSecondary,
    marginBottom: 20,
  },

  loader: { marginTop: 60 },

  // Grid
  grid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            GAP,
  },

  slot: {
    width:        SLOT_W,
    height:       SLOT_H,
    borderRadius: 12,
    overflow:     'hidden',
  },

  slotImage: {
    width:  '100%',
    height: '100%',
  },

  // Main badge
  mainBadge: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    backgroundColor:   'rgba(0,0,0,0.55)',
    paddingVertical:   4,
    alignItems:        'center',
  },
  mainBadgeText: {
    fontSize:   11,
    fontWeight: '700',
    color:      '#FFD700',
  },

  // Under-review overlay
  reviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.50)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         8,
  },
  reviewText: {
    fontSize:   12,
    fontWeight: '600',
    color:      '#fff',
    textAlign:  'center',
  },

  // Three-dot long-press hint
  dotsHint: {
    position:        'absolute',
    top:             4,
    right:           6,
  },
  dotsHintText: {
    fontSize:   16,
    fontWeight: '700',
    color:      'rgba(255,255,255,0.8)',
    letterSpacing: 1,
  },

  // Add slot
  addSlot: {
    backgroundColor: Colors.background,
    borderWidth:     1.5,
    borderStyle:     'dashed',
    borderColor:     Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             4,
  },
  addIcon: {
    fontSize:   32,
    fontWeight: '300',
    color:      Colors.primary,
    lineHeight: 38,
  },
  addLabel: {
    fontSize:   12,
    fontWeight: '500',
    color:      Colors.primary,
  },

  // Invisible phantom slot to keep grid aligned
  phantomSlot: {
    backgroundColor: 'transparent',
    borderWidth:     0,
  },

  hint: {
    fontSize:   12,
    color:      Colors.textSecondary,
    textAlign:  'center',
    marginTop:  16,
  },

  // Action sheet
  sheetOverlay: {
    flex:            1,
    backgroundColor: Colors.scrim,
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor:      Colors.surface,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    24,
    paddingTop:           20,
  },
  sheetTitle: {
    fontSize:     16,
    fontWeight:   '700',
    color:        Colors.textPrimary,
    marginBottom: 16,
  },
  sheetDivider: {
    height:          1,
    backgroundColor: Colors.divider,
    marginVertical:  4,
  },
  sheetOption: {
    paddingVertical: 14,
  },
  sheetOptionText: {
    fontSize:   16,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  sheetOptionDanger: {
    color: '#E53935',
  },
})
