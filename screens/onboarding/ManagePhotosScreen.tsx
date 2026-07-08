import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, { Path, Polyline, Rect, Line } from 'react-native-svg'
import { Colors } from '../../constants/colors'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'
import { Endpoints } from '../../service/api.endpoints'
import { apiCall } from '../../service/apiClient'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { getRegValue } from '../../service/registrationService'

// ─── Layout ───────────────────────────────────────────────────────────────────

const SCREEN_W  = Dimensions.get('window').width
const H_PAD     = 16
const GAP        = 4
const LARGE_W    = Math.floor((SCREEN_W - H_PAD * 2) * 0.60)
const SMALL_W    = (SCREEN_W - H_PAD * 2) - LARGE_W - GAP
const LARGE_H    = Math.floor(LARGE_W * 1.35)
const SMALL_H    = Math.floor((LARGE_H - GAP) / 2)
const GRID_CELL  = Math.floor((SCREEN_W - H_PAD * 2 - GAP * 2) / 3)

// ─── Types ────────────────────────────────────────────────────────────────────

type Photo = {
  PHOTOID:     string
  PHOTOTHUMB:  string
  MAINPHOTO:   number
  PHOTOSTATUS: number
}

type Props = {
  navigation: any
  route:      { params?: { pageNo?: string; pendingUri?: string } }
}

// ─── Title helpers ────────────────────────────────────────────────────────────

const CREATED_BY_LABEL: Record<string, string> = {
  '1':  'your',
  '4':  "son's",
  '5':  "daughter's",
  '8':  "brother's",
  '9':  "sister's",
  '10': "friend's",
  '11': "relative's",
}

function getTitle(createdBy: string): string {
  const who = CREATED_BY_LABEL[createdBy] ?? 'your'
  return `Add ${who} photos`
}

function getSubtitle(createdBy: string): string {
  const who = CREATED_BY_LABEL[createdBy] ?? 'your'
  return `Add ${who} photo and get 3x more responses from matches`
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PersonCardIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={4} width={20} height={16} rx={2} stroke="#111" strokeWidth={1.6} />
      <Path
        d="M8 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
        stroke="#111"
        strokeWidth={1.5}
      />
      <Path
        d="M4 19c0-2.21 1.79-4 4-4h1"
        stroke="#111"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Line x1={14} y1={9} x2={20} y2={9} stroke="#111" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={14} y1={13} x2={18} y2={13} stroke="#111" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  )
}

function TrashIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Polyline points="3 6 5 6 21 6" stroke="#555" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
        stroke="#555"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M10 11v6M14 11v6" stroke="#555" strokeWidth={2} strokeLinecap="round" />
      <Path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="#555" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function InfoIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z"
        stroke="#555"
        strokeWidth={1.8}
      />
      <Line x1={12} y1={16} x2={12} y2={12} stroke="#555" strokeWidth={2} strokeLinecap="round" />
      <Line x1={12} y1={8} x2={12.01} y2={8} stroke="#555" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ManagePhotosScreen({ navigation, route }: Props) {
  const pendingUri = (route.params as any)?.pendingUri as string | undefined

  const [photos,    setPhotos]    = useState<Photo[]>([])
  const [loading,   setLoading]   = useState(true)
  const [createdBy, setCreatedBy] = useState('1')

  useOnboardingFooter({
    nextLabel:    'Confirm',
    nextDisabled: false,
    onNext:       () => navigation.push('onboarding', { pageNo: '27' }),
  }, [navigation])

  useEffect(() => {
    getRegValue('CREATEDBY').then(v => { if (v) setCreatedBy(v) })
    loadPhotos()
  }, [])

  // ─── Data ──────────────────────────────────────────────────────────────────

  async function loadPhotos() {
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      const res = await apiCall(Endpoints.profile.managePhoto, 'POST', `ID=${userId}`)
      if (res?.RESPONSECODE == 1 && res?.RESPONSE?.PHOTOS) {
        setPhotos(res.RESPONSE.PHOTOS)
      }
    } catch {
      // silently keep empty
    } finally {
      setLoading(false)
    }
  }

  // ─── Upload ────────────────────────────────────────────────────────────────

  async function pickAndUpload() {
    navigation.push('onboarding', { pageNo: '22' })
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  function confirmDelete(photo: Photo) {
    Alert.alert('Delete photo', 'Remove this photo from your profile?', [
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
            Alert.alert('Error', 'Could not delete photo.')
          }
        },
      },
    ])
  }

  // ─── Set main ─────────────────────────────────────────────────────────────

  async function setAsMain(photo: Photo) {
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      const res = await apiCall(
        Endpoints.profile.setMainPhoto, 'POST',
        `ID=${userId}&PHOTOID=${photo.PHOTOID}`,
      )
      if (res?.RESPONSECODE == 1) await loadPhotos()
    } catch {
      Alert.alert('Error', 'Could not set main photo.')
    }
  }

  // ─── Optimistic list ───────────────────────────────────────────────────────
  // While the server list loads, show the just-uploaded photo immediately.
  const displayPhotos: (Photo | 'pending')[] = loading && pendingUri
    ? ['pending']
    : photos

  const mainPhoto  = displayPhotos[0]
  const rightPhotos = displayPhotos.slice(1, 3)
  const gridPhotos  = displayPhotos.slice(3)

  const title    = getTitle(createdBy)
  const subtitle = getSubtitle(createdBy)

  // ─── Photo card helper ─────────────────────────────────────────────────────

  function PhotoCard({
    item,
    style,
    imgStyle,
    isMain,
  }: {
    item:     Photo | 'pending'
    style?:   object
    imgStyle?: object
    isMain?:  boolean
  }) {
    if (item === 'pending') {
      return (
        <View style={[styles.photoCard, style, isMain && styles.mainPhotoCard]}>
          <Image
            source={pendingUri ? { uri: pendingUri } : null}
            style={[styles.photoImg, imgStyle]}
            contentFit="cover"
          />
          <View style={styles.processingOverlay}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.processingText}>Processing…</Text>
          </View>
          {isMain && (
            <View style={styles.profileLabel}>
              <Text style={styles.profileLabelText}>Profile Picture</Text>
            </View>
          )}
        </View>
      )
    }

    const uri = item.PHOTOTHUMB
    return (
      <Pressable
        style={[styles.photoCard, style, isMain && styles.mainPhotoCard]}
        onPress={isMain ? undefined : () => setAsMain(item)}
        onLongPress={() => confirmDelete(item)}
      >
        <Image
          source={{ uri }}
          style={[styles.photoImg, imgStyle]}
          contentFit="cover"
        />

        {/* Under-review overlay */}
        {item.PHOTOSTATUS === 0 && (
          <View style={styles.reviewOverlay}>
            <Text style={styles.reviewText}>Under review</Text>
          </View>
        )}

        {/* Profile Picture label on main */}
        {isMain && (
          <View style={styles.profileLabel}>
            <Text style={styles.profileLabelText}>Profile Picture</Text>
          </View>
        )}

        {/* Trash delete button */}
        <Pressable
          style={styles.trashBtn}
          onPress={() => confirmDelete(item)}
          hitSlop={6}
        >
          <TrashIcon />
        </Pressable>
      </Pressable>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View style={styles.iconRow}>
          <PersonCardIcon />
        </View>

        {/* Title + subtitle */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Loading state (no pending URI) */}
        {loading && !pendingUri ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : displayPhotos.length === 0 ? (
          <Text style={styles.emptyHint}>No photos yet. Go back and add one.</Text>
        ) : (
          <>
            {/* ── Top section: large main + 2 small stacked ── */}
            <View style={styles.topRow}>
              {/* Main photo */}
              {mainPhoto !== undefined && (
                <PhotoCard
                  item={mainPhoto}
                  style={{ width: LARGE_W, height: LARGE_H }}
                  imgStyle={{ width: LARGE_W, height: LARGE_H }}
                  isMain
                />
              )}

              {/* Right column */}
              <View style={styles.rightCol}>
                {rightPhotos.map((photo, i) => (
                  <PhotoCard
                    key={photo === 'pending' ? `pending-${i}` : photo.PHOTOID}
                    item={photo}
                    style={{ width: SMALL_W, height: SMALL_H }}
                    imgStyle={{ width: SMALL_W, height: SMALL_H }}
                  />
                ))}

                {/* Empty slot placeholders if < 3 photos */}
                {Array.from({ length: Math.max(0, 2 - rightPhotos.length) }).map((_, i) => (
                  <Pressable
                    key={`slot-r-${i}`}
                    style={[styles.emptySlot, { width: SMALL_W, height: SMALL_H }]}
                    onPress={pickAndUpload}
                  >
                    <Text style={styles.slotPlus}>+</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* ── Bottom grid: photos 4+ ── */}
            {gridPhotos.length > 0 && (
              <View style={styles.gridRow}>
                {gridPhotos.map((photo, i) => (
                  <PhotoCard
                    key={photo === 'pending' ? `pending-g-${i}` : photo.PHOTOID}
                    item={photo}
                    style={{ width: GRID_CELL, height: GRID_CELL }}
                    imgStyle={{ width: GRID_CELL, height: GRID_CELL }}
                  />
                ))}

                {/* Empty add-more slot */}
                {gridPhotos.length < 7 && (
                  <Pressable
                    style={[styles.emptySlot, { width: GRID_CELL, height: GRID_CELL }]}
                    onPress={pickAndUpload}
                  >
                    <Text style={styles.slotPlus}>+</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Add more if top section is complete but no grid yet */}
            {gridPhotos.length === 0 && rightPhotos.length >= 2 && (
              <Pressable style={styles.addMoreRow} onPress={pickAndUpload}>
                <Text style={styles.addMoreText}>+ Add more photos</Text>
              </Pressable>
            )}
          </>
        )}

        {/* Photo guidelines */}
        <Pressable
          style={styles.guidelinesRow}
          onPress={() => Alert.alert('Photo guidelines', 'Use clear, recent photos with good lighting. Avoid group photos, blurry images, or photos with glasses.')}
        >
          <InfoIcon />
          <Text style={styles.guidelinesText}>Check out our photo guidelines</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: H_PAD,
    paddingTop:        16,
    paddingBottom:     24,
  },

  iconRow: {
    marginBottom: 12,
  },

  title: {
    fontSize:     24,
    fontWeight:   '700',
    color:        '#111',
    marginBottom: 6,
  },
  subtitle: {
    fontSize:     14,
    fontWeight:   '400',
    color:        '#555',
    lineHeight:   20,
    marginBottom: 20,
  },

  topRow: {
    flexDirection: 'row',
    gap:           GAP,
    marginBottom:  GAP,
  },

  rightCol: {
    flexDirection: 'column',
    gap:           GAP,
  },

  gridRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           GAP,
    marginBottom:  GAP,
  },

  // Photo card
  photoCard: {
    borderRadius: 12,
    overflow:     'hidden',
    position:     'relative',
  },
  mainPhotoCard: {
    borderWidth:  2,
    borderColor:  Colors.primary,
    borderRadius: 12,
  },
  photoImg: {
    borderRadius: 12,
  },

  // Under-review overlay
  reviewOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  reviewText: {
    fontSize:   12,
    fontWeight: '600',
    color:      '#fff',
  },

  // Processing overlay (pending upload)
  processingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
  },
  processingText: {
    fontSize:   12,
    color:      '#fff',
    fontWeight: '500',
  },

  // "Profile Picture" label
  profileLabel: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingLeft:     10,
  },
  profileLabelText: {
    fontSize:   13,
    fontWeight: '700',
    color:      '#fff',
  },

  // Trash button
  trashBtn: {
    position:        'absolute',
    bottom:          8,
    right:           8,
    width:           32,
    height:          32,
    borderRadius:    8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Empty add slot
  emptySlot: {
    borderRadius:    12,
    backgroundColor: '#f4f4f6',
    borderWidth:     1.5,
    borderStyle:     'dashed',
    borderColor:     '#ccc',
    alignItems:      'center',
    justifyContent:  'center',
  },
  slotPlus: {
    fontSize:   28,
    fontWeight: '300',
    color:      '#aaa',
  },

  // Add more row
  addMoreRow: {
    alignItems:   'center',
    paddingVertical: 14,
    marginBottom: 8,
  },
  addMoreText: {
    fontSize:   14,
    fontWeight: '600',
    color:      Colors.primary,
  },

  // Photo guidelines
  guidelinesRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginTop:     16,
    paddingVertical: 4,
  },
  guidelinesText: {
    fontSize:          14,
    color:             '#444',
    textDecorationLine: 'underline',
  },

  emptyHint: {
    fontSize:  14,
    color:     '#999',
    textAlign: 'center',
    marginTop: 40,
  },
})
