import * as ImagePicker from 'expo-image-picker'
import {
  Asset,
  Album,
  AssetField,
  MediaType,
  Query,
  requestPermissionsAsync,
} from 'expo-media-library'
import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, { Path, Circle } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppHeader from '../../components/app-header/AppHeader'
import { Colors } from '../../constants/colors'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { Endpoints } from '../../service/api.endpoints'
import { uploadFile } from '../../service/apiClient'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { os } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_PHOTOS = 10
const COLS       = 3
const SCREEN_W   = Dimensions.get('window').width
const CELL_SIZE  = Math.floor(SCREEN_W / COLS)
const PAGE_SIZE  = 60

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: any
  route:      any
  // Embedded mode (e.g. opened as a Modal directly from EditProfileScreen,
  // outside the onboarding wizard's stack/shell): when provided, this screen
  // stops navigating anywhere on its own and instead hands control back to
  // whoever opened it. Omitted → original onboarding-flow behavior
  // (navigation.push to pageNo '21'), unchanged.
  onClose?:    () => void
  onUploaded?: () => void
}

type AlbumInfo = {
  album: Album
  title: string
}

type ListItem = 'camera' | Asset

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Build a displayable thumbnail URI from an asset.
// Android: asset.id is already a content:// URI.
// iOS:     asset.id is a PHAsset localIdentifier → use ph:// scheme.
function thumbUri(asset: Asset): string {
  return Platform.OS === 'ios' ? `ph://${asset.id}` : asset.id
}

// ─── Camera icon ─────────────────────────────────────────────────────────────

function CameraIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
      <Path
        d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
        stroke="#fff"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={4} stroke="#fff" strokeWidth={1.8} />
    </Svg>
  )
}

// ─── Checkmark badge ─────────────────────────────────────────────────────────

function CheckBadge() {
  return (
    <View style={styles.badge}>
      <Svg width={22} height={22} viewBox="0 0 22 22">
        <Circle cx={11} cy={11} r={11} fill={Colors.primary} />
        <Path
          d="M6 11.5l3.5 3.5 6.5-7"
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomGalleryScreen({ navigation, route, onClose, onUploaded }: Props) {
  const insets        = useSafeAreaInsets()
  const existingCount = (route.params?.existingCount as number | undefined) ?? 0
  const remaining     = Math.max(0, MAX_PHOTOS - existingCount)

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null)
  const [assets,            setAssets]            = useState<Asset[]>([])
  const [selected,          setSelected]          = useState<Set<string>>(new Set())
  const [loading,           setLoading]           = useState(true)
  const [loadingMore,       setLoadingMore]        = useState(false)
  const [uploading,         setUploading]          = useState(false)
  const [albums,            setAlbums]             = useState<AlbumInfo[]>([])
  const [activeAlbum,       setActiveAlbum]        = useState<AlbumInfo | null>(null)
  const [albumPickerOpen,   setAlbumPickerOpen]    = useState(false)

  const page    = useRef(0)
  const hasMore = useRef(true)

  // This screen has its own bottom bar — hide the shared footer entirely
  useOnboardingFooter({ nextHidden: true, showSkip: false, onNext: () => {} }, [])

  useEffect(() => { boot() }, [])

  // ─── Boot ─────────────────────────────────────────────────────────────────

  async function boot() {
    const { status } = await requestPermissionsAsync()
    if (status !== 'granted') {
      setPermissionGranted(false)
      setLoading(false)
      return
    }
    setPermissionGranted(true)
    loadAlbums()
    await fetchAssets(null, 0, true)
  }

  // ─── Load albums ─────────────────────────────────────────────────────────

  async function loadAlbums() {
    try {
      const all = await Album.getAll()
      const withTitles = await Promise.all(
        all.map(async album => ({ album, title: await album.getTitle() }))
      )
      setAlbums(withTitles)
    } catch {
      // not critical
    }
  }

  // ─── Fetch assets ─────────────────────────────────────────────────────────

  async function fetchAssets(
    albumInfo: AlbumInfo | null,
    pageIndex: number,
    initial:   boolean,
  ) {
    if (!initial && !hasMore.current) return
    initial ? setLoading(true) : setLoadingMore(true)

    try {
      let q = new Query()
        .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
        .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
        .limit(PAGE_SIZE)
        .offset(pageIndex * PAGE_SIZE)

      let result: Asset[]
      if (albumInfo) {
        result = await albumInfo.album.getAssets()
        hasMore.current = false // album.getAssets() returns all at once
      } else {
        result = await q.exe()
        hasMore.current = result.length === PAGE_SIZE
      }

      setAssets(prev => initial ? result : [...prev, ...result])
      page.current = pageIndex
    } catch {
      Alert.alert('Error', 'Could not load photos.')
    } finally {
      initial ? setLoading(false) : setLoadingMore(false)
    }
  }

  // ─── Album switch ─────────────────────────────────────────────────────────

  function switchAlbum(info: AlbumInfo | null) {
    setActiveAlbum(info)
    setAlbumPickerOpen(false)
    setSelected(new Set())
    page.current    = 0
    hasMore.current = true
    fetchAssets(info, 0, true)
  }

  // ─── Selection ────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelected(prev => {
      if (prev.has(id)) {
        const next = new Set(prev); next.delete(id); return next
      }
      if (prev.size >= remaining) return prev
      return new Set(prev).add(id)
    })
  }

  // ─── Camera ───────────────────────────────────────────────────────────────

  async function openCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to take a photo.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [3, 4], quality: 0.85,
    })
    if (!result.canceled) {
      const a = result.assets[0]
      await uploadAndNavigate([{ uri: a.uri, filename: a.fileName ?? 'photo.jpg' }])
    }
  }

  // ─── Upload & navigate ────────────────────────────────────────────────────

  async function handleNext() {
    const selectedAssets = assets.filter(a => selected.has(a.id))
    const photos: { uri: string; filename: string }[] = []

    for (const asset of selectedAssets) {
      const uri      = await asset.getUri()
      const filename = await asset.getFilename()
      photos.push({ uri, filename })
    }

    await uploadAndNavigate(photos)
  }

  async function uploadAndNavigate(photos: { uri: string; filename: string }[]) {
    if (photos.length === 0) return
    setUploading(true)
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      let firstPendingUri: string | undefined

      for (const photo of photos) {
        const formData = new FormData()
        formData.append('ID', userId)
        formData.append('UPLOADPHOTO', {
          uri:  photo.uri,
          type: 'image/jpeg',
          name: photo.filename,
        } as any)

        const res = await uploadFile(Endpoints.media.addProfilePic, formData)
        if (res?.RESPONSECODE == 1) {
          if (res?.RESPONSE?.PHOTOURL) {
            await setItem(SK.User.PHOTO_URL, String(res.RESPONSE.PHOTOURL))
          }
          if (!firstPendingUri) firstPendingUri = photo.uri
        }
      }

      if (onUploaded) {
        onUploaded()
      } else {
        navigation.push('onboarding', { pageNo: '21', pendingUri: firstPendingUri, standalone: route.params?.standalone })
      }
    } catch {
      Alert.alert('Error', 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  // ─── Render item ──────────────────────────────────────────────────────────

  function renderItem({ item }: { item: ListItem }) {
    if (item === 'camera') {
      return (
        <Pressable style={styles.cameraCell} onPress={openCamera}>
          <CameraIcon />
          <Text style={styles.cameraLabel}>Use camera</Text>
        </Pressable>
      )
    }

    const isSelected = selected.has(item.id)
    return (
      <Pressable style={styles.cell} onPress={() => toggleSelect(item.id)}>
        <Image
          source={{ uri: thumbUri(item) }}
          style={styles.cellImage}
          contentFit="cover"
          recyclingKey={item.id}
        />
        {isSelected && <CheckBadge />}
      </Pressable>
    )
  }

  // ─── Permission denied ────────────────────────────────────────────────────

  if (permissionGranted === false) {
    return (
      <View style={os.flex1}>
        {onClose && (
          <AppHeader type="registration" showBackBtn closeIcon onBackPress={onClose} />
        )}
        <View style={styles.permDenied}>
          <Text style={styles.permTitle}>Photo access needed</Text>
          <Text style={styles.permSub}>
            Allow Jodii to access your photos in Settings to choose a profile picture.
          </Text>
        </View>
      </View>
    )
  }

  const listData: ListItem[] = ['camera', ...assets]
  const canProceed = selected.size > 0 && !uploading

  return (
    <View style={os.flex1}>

      {/* Embedded mode has no persistent onboarding-shell header to close it
          with — render one here. Normal onboarding-flow entry (onClose
          omitted) keeps relying on that shared header, unchanged. */}
      {onClose && (
        <AppHeader type="registration" showBackBtn closeIcon onBackPress={onClose} />
      )}

      {/* Sub-header */}
      <View style={styles.subHeader}>
        <Pressable style={styles.albumBtn} onPress={() => setAlbumPickerOpen(true)}>
          <Text style={styles.albumLabel}>
            {activeAlbum ? activeAlbum.title : 'Recent'}
          </Text>
          <Text style={styles.albumChevron}> ▾</Text>
        </Pressable>

        {selected.size > 0 && (
          <Text style={styles.selectedCount}>{selected.size} selected</Text>
        )}
      </View>

      {/* Photo grid */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={item => item === 'camera' ? '__camera__' : item.id}
          numColumns={COLS}
          renderItem={renderItem}
          onEndReached={() => fetchAssets(activeAlbum, page.current + 1, false)}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={Colors.primary} style={{ margin: 16 }} />
              : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
        <Text style={styles.limitText}>
          You can select up to {remaining} more photo{remaining !== 1 ? 's' : ''}.
        </Text>
        <Pressable
          style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!canProceed}
        >
          {uploading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.nextBtnLabel}>Next</Text>
          }
        </Pressable>
      </View>

      {/* Album picker */}
      <Modal
        visible={albumPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAlbumPickerOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.albumOverlay} onPress={() => setAlbumPickerOpen(false)}>
          <View style={[styles.albumSheet, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 16 : 24 }]}>
            <Text style={styles.albumSheetTitle}>Select album</Text>
            <ScrollView showsVerticalScrollIndicator={false}>

              <Pressable style={styles.albumRow} onPress={() => switchAlbum(null)}>
                <Text style={[styles.albumRowText, !activeAlbum && styles.albumRowActive]}>Recent</Text>
                {!activeAlbum && <Text style={styles.albumRowCheck}>✓</Text>}
              </Pressable>

              {albums.map(info => (
                <Pressable
                  key={info.album.id}
                  style={styles.albumRow}
                  onPress={() => switchAlbum(info)}
                >
                  <Text style={[styles.albumRowText, activeAlbum?.album.id === info.album.id && styles.albumRowActive]}>
                    {info.title}
                  </Text>
                  {activeAlbum?.album.id === info.album.id && (
                    <Text style={styles.albumRowCheck}>✓</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  subHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 24,
    paddingVertical:   14,
    backgroundColor:   '#fff',
  },
  albumBtn: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  albumLabel: {
    fontSize:   17,
    fontWeight: '700',
    color:      '#111',
  },
  albumChevron: {
    fontSize: 15,
    color:    '#111',
  },
  selectedCount: {
    fontSize:   14,
    fontWeight: '600',
    color:      Colors.textSecondary,
  },

  loader: { marginTop: 60 },

  cameraCell: {
    width:           CELL_SIZE,
    height:          CELL_SIZE,
    backgroundColor: '#1a1a1a',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    borderWidth:     1,
    borderColor:     '#fff',
  },
  cameraLabel: {
    fontSize:   12,
    fontWeight: '500',
    color:      '#fff',
  },

  cell: {
    width:       CELL_SIZE,
    height:      CELL_SIZE,
    borderWidth: 1,
    borderColor: '#fff',
  },
  cellImage: {
    width:  '100%',
    height: '100%',
  },

  badge: {
    position: 'absolute',
    top:      5,
    right:    5,
  },

  bottomBar: {
    backgroundColor:   '#fff',
    paddingHorizontal: 24,
    paddingTop:        20,
    gap:               4,
    // Figma: drop-shadow(0px -3px 8px rgba(0,0,0,0.08)) — no border line
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: -3 },
    shadowOpacity:     0.08,
    shadowRadius:      8,
    elevation:         8,
  },
  limitText: {
    fontSize:  12,
    lineHeight: 16,
    color:     Colors.inputError,
    textAlign: 'center',
  },
  nextBtn: {
    height:          44,
    backgroundColor: Colors.primaryDark,
    borderRadius:    8,
    alignItems:      'center',
    justifyContent:  'center',
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  nextBtnLabel: {
    fontSize:   14,
    fontWeight: '500',
    color:      '#fff',
  },

  albumOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent:  'flex-end',
  },
  albumSheet: {
    backgroundColor:      '#fff',
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingHorizontal:    20,
    paddingTop:           20,
    maxHeight:            '60%',
  },
  albumSheetTitle: {
    fontSize:     16,
    fontWeight:   '700',
    color:        '#111',
    marginBottom: 16,
  },
  albumRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  albumRowText: {
    fontSize: 15,
    color:    '#333',
  },
  albumRowActive: {
    color:      Colors.primary,
    fontWeight: '600',
  },
  albumRowCheck: {
    fontSize:   16,
    color:      Colors.primary,
    fontWeight: '700',
  },

  permDenied: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 32,
    gap:               12,
  },
  permTitle: {
    fontSize:   18,
    fontWeight: '700',
    color:      '#111',
    textAlign:  'center',
  },
  permSub: {
    fontSize:   14,
    color:      '#666',
    textAlign:  'center',
    lineHeight: 20,
  },
})
