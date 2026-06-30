import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppHeader from '../../components/app-header/AppHeader'
import { Colors } from '../../constants/colors'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { Endpoints } from '../../service/api.endpoints'
import { uploadFile } from '../../service/apiClient'
import { getRegValue } from '../../service/registrationService'
import { getItem, setItem } from '../../service/storageService'
import { CDN_IMG } from '../../constants/cdn'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_MALE_PLACEHOLDER   = CDN_IMG + 'male_silhouette.png'
const CDN_FEMALE_PLACEHOLDER = CDN_IMG + 'female_silhouette.png'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddPhotoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()

  const [gender,       setGender]       = useState('1')
  const [createdBy,    setCreatedBy]    = useState('4')
  const [photoUri,       setPhotoUri]       = useState<string | null>(null)
  const [uploading,      setUploading]      = useState(false)
  const [skipSheetVisible, setSkipSheetVisible] = useState(false)

  const slideAnim = useRef(new Animated.Value(300)).current

  function openSkipSheet() {
    setSkipSheetVisible(true)
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20,
    }).start()
  }

  function closeSkipSheet(thenNavigate = false) {
    Animated.timing(slideAnim, {
      toValue: 300, duration: 220, useNativeDriver: true,
    }).start(() => {
      setSkipSheetVisible(false)
      if (thenNavigate) navigation.push('onboarding', { pageNo: '27' })
    })
  }

  useEffect(() => {
    Promise.all([
      getRegValue('GENDER'),
      getRegValue('CREATEDBY'),
    ]).then(([g, cb]) => {
      if (g)  setGender(g)
      if (cb) setCreatedBy(cb)
    })
  }, [])

  // ─── Derived ──────────────────────────────────────────────────────────────

  const isFemale  = gender === '2' || ['5', '9'].includes(createdBy)

  // ─── Photo picker ─────────────────────────────────────────────────────────

  async function requestPermission(source: 'camera' | 'library'): Promise<boolean> {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      return status === 'granted'
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    return status === 'granted'
  }

  async function pickFromCamera() {
    if (!await requestPermission('camera')) {
      Alert.alert('Permission required', 'Camera access is needed to take a photo.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [3, 4], quality: 0.85,
    })
    if (!result.canceled) handlePickedAsset(result.assets[0])
  }

  async function pickFromGallery() {
    if (!await requestPermission('library')) {
      Alert.alert('Permission required', 'Photo library access is needed to select a photo.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true, aspect: [3, 4], quality: 0.85,
    })
    if (!result.canceled) handlePickedAsset(result.assets[0])
  }

  function handlePickedAsset(asset: ImagePicker.ImagePickerAsset) {
    setPhotoUri(asset.uri)
    uploadPhoto(asset)
  }

  function openPhotoPicker() {
    if (uploading) return
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

  // ─── Upload ───────────────────────────────────────────────────────────────

  async function uploadPhoto(asset: ImagePicker.ImagePickerAsset) {
    setUploading(true)
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''

      const formData = new FormData()
      formData.append('ID', userId)
      formData.append('UPLOADPHOTO', {
        uri:  asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName ?? 'photo.jpg',
      } as any)

      const res = await uploadFile(Endpoints.media.addProfilePic, formData)

      if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0) {
        if (res?.RESPONSE?.PHOTOURL) {
          await setItem(SK.User.PHOTO_URL, String(res.RESPONSE.PHOTOURL))
        }
        navigation.push('onboarding', { pageNo: '27' })
      } else {
        const msg = res?.RESPONSE?.MESSAGE ?? res?.ERRMSG ?? 'Upload failed. Please try again.'
        Alert.alert('Upload failed', msg, [
          { text: 'Retry', onPress: openPhotoPicker },
          { text: 'Skip',  onPress: openSkipSheet },
        ])
        setPhotoUri(null)
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.')
      setPhotoUri(null)
    } finally {
      setUploading(false)
    }
  }

  function goNext() {
    openSkipSheet()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <AppHeader
        type="registration"
        showBackBtn={navigation.canGoBack()}
        onBackPress={() => navigation.goBack()}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />

      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: (Platform.OS === 'ios' ? insets.bottom : 20) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        {/* Pink photo placeholder */}
        <View style={styles.photoAreaWrapper}>
          <Pressable
            style={styles.photoArea}
            onPress={openPhotoPicker}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
          >
            {uploading ? (
              <ActivityIndicator color={Colors.primary} size="large" />
            ) : photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.photoPreview}
                contentFit="cover"
              />
            ) : (
              <Image
                source={{ uri: isFemale ? CDN_FEMALE_PLACEHOLDER : CDN_MALE_PLACEHOLDER }}
                style={styles.silhouette}
                contentFit="contain"
              />
            )}
          </Pressable>
        </View>

        {/* Title */}
        <Text style={styles.title}>Add your photo{'\n'}to continue</Text>

        {/* Benefits card */}
        <View style={styles.card}>
          <Text style={styles.cardIntro}>Only if you add photo:</Text>

          <View style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={styles.bulletText}>You will be able to like matches</Text>
          </View>

          <View style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={styles.bulletText}>Your profile will be visible to matches</Text>
          </View>

          {/* Add photo button inside card */}
          <Pressable
            style={[styles.addBtn, uploading && styles.addBtnDisabled]}
            onPress={openPhotoPicker}
            accessibilityRole="button"
          >
            {uploading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.addBtnLabel}>Add photo now</Text>
            }
          </Pressable>
        </View>
      </ScrollView>

      {/* Skip */}
      <Pressable
        style={[
          styles.skipRow,
          { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 12 : 24 },
        ]}
        onPress={goNext}
        accessibilityRole="button"
      >
        <Text style={styles.skipText}>I'll do this later</Text>
        <Text style={styles.skipArrow}> ›</Text>
      </Pressable>

      {/* Skip-confirm bottom sheet */}
      <Modal
        transparent
        visible={skipSheetVisible}
        animationType="none"
        onRequestClose={() => closeSkipSheet(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.sheetOverlay} onPress={() => closeSkipSheet(false)}>
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 16 : 24,
                transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Warning icon */}
            <View style={styles.warnIconCircle}>
              <Text style={styles.warnIconText}>!</Text>
            </View>

            <Text style={styles.sheetTitle}>
              Without adding photo you will not be able to like matches or get responses.
            </Text>
            <Text style={styles.sheetSub}>Do you want to add photo?</Text>

            {/* Outlined — skip */}
            <Pressable
              style={styles.sheetBtnOutline}
              onPress={() => closeSkipSheet(true)}
            >
              <Text style={styles.sheetBtnOutlineLabel}>I'll do this later</Text>
            </Pressable>

            {/* Solid — add photo */}
            <Pressable
              style={styles.sheetBtnSolid}
              onPress={() => {
                closeSkipSheet(false)
                openPhotoPicker()
              }}
            >
              <Text style={styles.sheetBtnSolidLabel}>Yes, add photo</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PINK_BG = '#fdf0f3'

const styles = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: Colors.surface,
  },
  flex1: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop:        16,
    alignItems:        'center',
  },

  // Photo
  photoAreaWrapper: {
    alignItems:    'center',
    marginBottom:  24,
  },
  photoArea: {
    width:           180,
    height:          200,
    backgroundColor: PINK_BG,
    borderRadius:    20,
    overflow:        'hidden',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     '#f5cdd8',
  },
  silhouette: {
    width:  '100%',
    height: '100%',
  },
  photoPreview: {
    width:  '100%',
    height: '100%',
  },

  // Title
  title: {
    fontSize:      24,
    fontWeight:    '700',
    color:         Colors.textPrimary,
    lineHeight:    32,
    textAlign:     'center',
    marginBottom:  24,
  },

  // Benefits card
  card: {
    width:             '100%',
    backgroundColor:   Colors.surface,
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       Colors.divider,
    paddingHorizontal: 20,
    paddingVertical:   20,
    gap:               14,
    shadowColor:       Colors.black,
    shadowOpacity:     0.06,
    shadowOffset:      { width: 0, height: 2 },
    shadowRadius:      8,
    elevation:         3,
  },
  cardIntro: {
    fontSize:   13,
    fontWeight: '400',
    color:      Colors.textSecondary ?? '#888',
    lineHeight: 18,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           10,
  },
  bullet: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: Colors.textPrimary,
    marginTop:       7,
    flexShrink:      0,
  },
  bulletText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '700',
    color:      Colors.textPrimary,
    lineHeight: 20,
  },

  // Add button (inside card)
  addBtn: {
    height:          52,
    backgroundColor: Colors.primary,
    borderRadius:    8,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       4,
  },
  addBtnDisabled: { opacity: 0.7 },
  addBtnLabel: {
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.white,
  },

  // Skip-confirm sheet
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
    paddingTop:           28,
    gap:                  16,
  },
  warnIconCircle: {
    alignSelf:       'flex-start',
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    4,
  },
  warnIconText: {
    color:      Colors.white,
    fontSize:   20,
    fontWeight: '700',
    lineHeight: 24,
  },
  sheetTitle: {
    fontSize:   18,
    fontWeight: '700',
    color:      Colors.textPrimary,
    lineHeight: 26,
  },
  sheetSub: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textSecondary ?? '#888',
    lineHeight: 20,
  },
  sheetBtnOutline: {
    height:          52,
    borderRadius:    8,
    borderWidth:     1.5,
    borderColor:     Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sheetBtnOutlineLabel: {
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.primary,
  },
  sheetBtnSolid: {
    height:          52,
    borderRadius:    8,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sheetBtnSolidLabel: {
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.white,
  },

  // Skip
  skipRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     16,
    backgroundColor: Colors.surface,
  },
  skipText: {
    fontSize:   14,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  skipArrow: {
    fontSize:   18,
    color:      Colors.textPrimary,
  },
})
