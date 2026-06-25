import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { BlurView } from 'expo-blur'
import * as ImagePicker from 'expo-image-picker'
import { Colors } from '../../constants/colors'

// ─── Types ────────────────────────────────────────────────────────────────────

// Drives border-radius variants — mirrors Angular .matches / .viewedyou / .successStory
export type PhotoVariant = 'matches' | 'viewedyou' | 'successStory' | 'default'

export interface ProfilePhotoProps {
  // ── Image source ──────────────────────────────────────────────────────────
  profileImage?: string | undefined    // remote URL — shown as-is or blurred
  defaultImage?: string | undefined    // fallback avatar URL on load error
  height?: number | undefined          // explicit pixel height; omit for 100%

  // ── Photo states (from API, same props as ProfileCard) ────────────────────
  isPhotoAvailable?:    boolean | undefined  // profile has uploaded photos
  isPhotoProtect?:      boolean | undefined  // photos locked (view-request overlay)
  isAddPhotoRequest?:   boolean | undefined  // current user sent add-photo request
  isViewPhotoRequest?:  boolean | undefined  // current user sent view-photo request
  showReqPhotoElement?: boolean | undefined  // show request CTA on card

  // ── Own-photo / upload mode ───────────────────────────────────────────────
  // Set isOwnPhoto=true on the logged-in user's own photo blocks.
  // The component shows an upload CTA; actual upload is handled by the parent
  // via onPhotoUpload (uri → parent calls API).
  isOwnPhoto?: boolean | undefined

  // ── Badge / action overlays ───────────────────────────────────────────────
  isNewlyJoined?: boolean | undefined
  isShortlisted?: boolean | undefined   // show shortlist pill (top-right)
  likedStatus?:   '0' | '1' | '2' | '3' | undefined
  showDontShow?:  boolean | undefined   // show "Don't show this profile" pill
  dontShowLabel?: string | undefined
  showThreeDots?: boolean | undefined   // show 3-dot action menu button

  // ── Layout ────────────────────────────────────────────────────────────────
  variant?:  PhotoVariant | undefined
  style?:    StyleProp<ViewStyle> | undefined
  children?: React.ReactNode    // card-specific overlays (InfoOverlay, eyeBadge, etc.)

  // ── Callbacks ─────────────────────────────────────────────────────────────
  onPress?:            (() => void) | undefined
  onShortlistPress?:   (() => void) | undefined
  onDontShowPress?:    (() => void) | undefined
  onAddPhotoRequest?:  (() => void) | undefined
  onViewPhotoRequest?: (() => void) | undefined
  onThreeDotPress?:    (() => void) | undefined
  onImageLoad?:        (() => void) | undefined

  // Upload callback — receives the local file URI selected by the user
  onPhotoUpload?: ((uri: string) => void) | undefined
}

// ─── Re-export PhotoVariant so importers don't need a second import ───────────

// ─── CDN constants ────────────────────────────────────────────────────────────

const CDN = 'https://imgs.jodii.app/assets/images/svg/revamp/'
const DEFAULT_AVATAR = 'https://imgs.jodii.app/assets/images/default-profile.jpg'

const ICONS = {
  newlyJoinedBg:  CDN + 'newly-joined.svg',
  newlyJoinedStar: CDN + 'newly-joined-star.svg',
  shortlistOff:   'https://imgs.jodii.app/assets/images/svg/shortlist/shortlist-white.svg',
  shortlistOn:    'https://imgs.jodii.app/assets/images/svg/shortlist/shortlisted-white-updated.svg',
  closeWhite:     CDN + 'close-white.svg',
  camera:         CDN + 'camera-upload.svg',    // upload CTA icon
  addPhoto:       CDN + 'add-photo-icon.svg',
  lockPhoto:      CDN + 'lock-photo.svg',
}

// ─── Border radius per variant (mirrors Angular CSS) ─────────────────────────

const RADIUS: Record<PhotoVariant, { tl: number; tr: number; bl: number; br: number }> = {
  default:      { tl: 12, tr: 12, bl: 12, br: 12 },
  matches:      { tl: 16, tr: 16, bl: 16, br: 16 },
  viewedyou:    { tl: 12, tr: 12, bl:  0, br:  0 },
  successStory: { tl: 12, tr: 12, bl:  0, br:  0 },
}

// ─── PhotoRequest overlay sub-component ──────────────────────────────────────

interface PhotoRequestProps {
  type:       'addPhoto' | 'requestSent' | 'viewPhoto'
  onPress?:   (() => void) | undefined
}

function PhotoRequestOverlay({ type, onPress }: PhotoRequestProps) {
  const isRequestSent = type === 'requestSent'

  const icon   = type === 'viewPhoto' ? ICONS.lockPhoto : ICONS.addPhoto
  const title  = isRequestSent
    ? 'Request Sent'
    : type === 'viewPhoto'
    ? 'View Hidden Photo'
    : 'Add Photo'
  const desc   = isRequestSent
    ? 'Waiting for the member to add their photo'
    : type === 'viewPhoto'
    ? 'Request to view this member\'s hidden photo'
    : 'No photo uploaded yet. Request them to add one.'
  const btnLabel = isRequestSent ? 'Sent ✓' : 'Send Request'

  return (
    <View style={styles.requestOverlay}>
      <Image source={{ uri: icon }} style={styles.requestIcon} resizeMode="contain" />
      <Text style={styles.requestTitle}>{title}</Text>
      <Text style={styles.requestDesc}>{desc}</Text>
      {!isRequestSent && (
        <Pressable
          style={({ pressed }) => [styles.requestBtn, pressed && styles.requestBtnPressed]}
          onPress={onPress}
        >
          <Text style={styles.requestBtnText}>{btnLabel}</Text>
        </Pressable>
      )}
    </View>
  )
}

// ─── ProfilePhoto ─────────────────────────────────────────────────────────────

export default function ProfilePhoto({
  profileImage,
  defaultImage = DEFAULT_AVATAR,
  height,
  isPhotoAvailable  = true,
  isPhotoProtect    = false,
  isAddPhotoRequest = false,
  isViewPhotoRequest = false,
  showReqPhotoElement = true,
  isOwnPhoto = false,
  isNewlyJoined = false,
  isShortlisted = false,
  likedStatus,
  showDontShow = false,
  dontShowLabel = "Don't show this profile",
  showThreeDots = false,
  variant = 'default',
  style,
  children,
  onPress,
  onShortlistPress,
  onDontShowPress,
  onAddPhotoRequest,
  onViewPhotoRequest,
  onThreeDotPress,
  onImageLoad,
  onPhotoUpload,
}: ProfilePhotoProps) {
  const [imgError, setImgError] = useState(false)
  const [uploading, setUploading] = useState(false)

  const r = RADIUS[variant]
  const imgSrc = (imgError || !profileImage) ? defaultImage : profileImage

  // Determine what state the photo block is in
  const showBlur        = isPhotoProtect && isPhotoAvailable
  const showAddRequest  = !isPhotoAvailable && showReqPhotoElement && !isPhotoProtect
  const showViewRequest = isPhotoProtect && showReqPhotoElement

  // ── Own-photo upload (React Native replaces the old native Cordova handler) ──
  const handleUploadPress = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Allow photo library access in Settings to upload a photo.',
      )
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],     // portrait crop matching profile card ratio
      quality: 0.85,
    })

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri
      setUploading(true)
      try {
        onPhotoUpload?.(uri)
      } finally {
        setUploading(false)
      }
    }
  }, [onPhotoUpload])

  const handleCameraPress = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Allow camera access in Settings to take a photo.',
      )
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    })

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri
      setUploading(true)
      try {
        onPhotoUpload?.(uri)
      } finally {
        setUploading(false)
      }
    }
  }, [onPhotoUpload])

  const handleUpload = useCallback(() => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera',       onPress: handleCameraPress },
      { text: 'Photo Library', onPress: handleUploadPress },
      { text: 'Cancel', style: 'cancel' },
    ])
  }, [handleCameraPress, handleUploadPress])

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        {
          borderTopLeftRadius:     r.tl,
          borderTopRightRadius:    r.tr,
          borderBottomLeftRadius:  r.bl,
          borderBottomRightRadius: r.br,
          height,
        },
        style,
      ]}
    >
      {/* ── Base photo ── */}
      <Image
        source={{ uri: imgSrc }}
        style={[
          styles.image,
          {
            borderTopLeftRadius:     r.tl,
            borderTopRightRadius:    r.tr,
            borderBottomLeftRadius:  r.bl,
            borderBottomRightRadius: r.br,
          },
        ]}
        resizeMode="cover"
        onError={() => setImgError(true)}
        onLoad={onImageLoad}
      />

      {/* ── Blur overlay for protected photos (expo-blur) ── */}
      {showBlur && (
        <BlurView
          intensity={60}
          tint="dark"
          style={[
            StyleSheet.absoluteFill,
            {
              borderTopLeftRadius:     r.tl,
              borderTopRightRadius:    r.tr,
              borderBottomLeftRadius:  r.bl,
              borderBottomRightRadius: r.br,
              overflow: 'hidden',
            },
          ]}
        />
      )}

      {/* ── Gradient scrim at the bottom (matches Angular .information-block) ── */}
      <View style={[styles.scrim, { borderBottomLeftRadius: r.bl, borderBottomRightRadius: r.br }]} />

      {/* ── Card-level overlays passed from parent (InfoOverlay, eyeBadge, etc.) ── */}
      {children}

      {/* ── Newly-joined badge (top-left ribbon) ── */}
      {isNewlyJoined && (
        <View style={styles.newlyJoinedBadge}>
          <Image source={{ uri: ICONS.newlyJoinedStar }} style={styles.newlyJoinedStar} resizeMode="contain" />
          <Text style={styles.newlyJoinedText}>New</Text>
        </View>
      )}

      {/* ── Shortlist pill (top-right) ── */}
      {isShortlisted && (
        <Pressable style={styles.shortlistPill} onPress={onShortlistPress}>
          <Image
            source={{ uri: (likedStatus === '1' || likedStatus === '3') ? ICONS.shortlistOn : ICONS.shortlistOff }}
            style={styles.shortlistIcon}
            resizeMode="contain"
          />
          <Text style={styles.shortlistText}>
            {(likedStatus === '1' || likedStatus === '3') ? 'Shortlisted' : 'Shortlist'}
          </Text>
        </Pressable>
      )}

      {/* ── 3-dot action button (top-right, mutually exclusive with shortlist) ── */}
      {showThreeDots && !isShortlisted && (
        <Pressable style={styles.threeDotBtn} onPress={onThreeDotPress}>
          <Text style={styles.threeDotText}>⋮</Text>
        </Pressable>
      )}

      {/* ── Don't Show pill (bottom-center) ── */}
      {showDontShow && (
        <Pressable style={styles.dontShowPill} onPress={onDontShowPress}>
          <Image source={{ uri: ICONS.closeWhite }} style={styles.dontShowIcon} resizeMode="contain" />
          <Text style={styles.dontShowText}>{dontShowLabel}</Text>
        </Pressable>
      )}

      {/* ── Add-photo request overlay ── */}
      {showAddRequest && (
        <View style={styles.requestWrap}>
          <PhotoRequestOverlay
            type={isAddPhotoRequest ? 'requestSent' : 'addPhoto'}
            onPress={onAddPhotoRequest}
          />
        </View>
      )}

      {/* ── View-hidden-photo request overlay ── */}
      {showViewRequest && (
        <View style={styles.requestWrap}>
          <PhotoRequestOverlay
            type={isViewPhotoRequest ? 'requestSent' : 'viewPhoto'}
            onPress={onViewPhotoRequest}
          />
        </View>
      )}

      {/* ── Own-photo upload CTA ── */}
      {isOwnPhoto && (
        <Pressable
          style={styles.uploadOverlay}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <View style={styles.uploadIconWrap}>
                <Image source={{ uri: ICONS.camera }} style={styles.uploadIcon} resizeMode="contain" />
              </View>
              <Text style={styles.uploadLabel}>
                {profileImage ? 'Change Photo' : 'Add Photo'}
              </Text>
            </>
          )}
        </Pressable>
      )}
    </Pressable>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: Colors.background,
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  // Gradient scrim — matches Angular .information-block
  scrim: {
    position:  'absolute',
    bottom:    0,
    left:      0,
    right:     0,
    height:    75,
    // LinearGradient not available without expo-linear-gradient;
    // using opaque black at bottom achieves same visual
    backgroundColor: 'transparent',
    // Native shadow approach: semi-transparent fill at very bottom
  },

  // ── Newly-joined badge ──────────────────────────────────────────────────────
  // Matches Angular .newly-joined (ribbon at top-left, custom SVG bg)
  newlyJoinedBadge: {
    position:        'absolute',
    top:             0,
    left:            0,
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.primaryDark,
    paddingVertical:   4,
    paddingLeft:      12,
    paddingRight:     20,
    borderBottomRightRadius: 20,
  },
  newlyJoinedStar: {
    width:  14,
    height: 14,
  },
  newlyJoinedText: {
    color:      Colors.white,
    fontSize:   12,
    fontWeight: '500',
    marginLeft:  4,
  },

  // ── Shortlist pill ──────────────────────────────────────────────────────────
  // Matches Angular .shortlist-block
  shortlistPill: {
    position:          'absolute',
    top:               12,
    right:             12,
    flexDirection:     'row',
    alignItems:        'center',
    borderRadius:      50,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.5)',
    backgroundColor:   'rgba(0,0,0,0.4)',
    paddingVertical:   8,
    paddingHorizontal: 12,
  },
  shortlistIcon: {
    width:  20,
    height: 20,
  },
  shortlistText: {
    color:      Colors.white,
    fontSize:   12,
    fontWeight: '500',
    marginLeft:  4,
  },

  // ── 3-dot menu button ───────────────────────────────────────────────────────
  // Matches Angular .dot-3-block
  threeDotBtn: {
    position:        'absolute',
    top:             12,
    right:           12,
    width:           32,
    height:          32,
    borderRadius:    32,
    backgroundColor: 'rgba(84,84,84,0.9)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  threeDotText: {
    color:      Colors.white,
    fontSize:   18,
    fontWeight: '700',
    lineHeight: 22,
  },

  // ── Don't-show pill ─────────────────────────────────────────────────────────
  // Matches Angular .dont-show-photo
  dontShowPill: {
    position:          'absolute',
    bottom:            12,
    alignSelf:         'center',
    flexDirection:     'row',
    alignItems:        'center',
    borderRadius:      50,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.5)',
    backgroundColor:   'rgba(0,0,0,0.4)',
    paddingVertical:   12,
    paddingHorizontal: 16,
  },
  dontShowIcon: {
    width:  16,
    height: 16,
  },
  dontShowText: {
    color:      Colors.white,
    fontSize:   12,
    fontWeight: '500',
    marginLeft:  8,
  },

  // ── Photo request overlay ───────────────────────────────────────────────────
  requestWrap: {
    ...StyleSheet.absoluteFill,
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 16,
  },
  requestOverlay: {
    alignItems:        'center',
    backgroundColor:   'rgba(255,255,255,0.12)',
    borderRadius:      16,
    padding:           20,
    width:             '100%',
    maxWidth:          220,
  },
  requestIcon: {
    width:        48,
    height:       48,
    marginBottom: 10,
  },
  requestTitle: {
    color:        Colors.white,
    fontSize:     14,
    fontWeight:   '700',
    textAlign:    'center',
    marginBottom:  4,
  },
  requestDesc: {
    color:        'rgba(255,255,255,0.8)',
    fontSize:     12,
    textAlign:    'center',
    lineHeight:   16,
    marginBottom: 14,
  },
  requestBtn: {
    backgroundColor:   Colors.primary,
    borderRadius:      50,
    paddingVertical:   10,
    paddingHorizontal: 20,
  },
  requestBtnPressed: {
    opacity: 0.82,
  },
  requestBtnText: {
    color:      Colors.white,
    fontSize:   13,
    fontWeight: '600',
  },

  // ── Own-photo upload overlay ────────────────────────────────────────────────
  uploadOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
  },
  uploadIconWrap: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth:     2,
    borderColor:     Colors.white,
    alignItems:      'center',
    justifyContent:  'center',
  },
  uploadIcon: {
    width:  28,
    height: 28,
    tintColor: Colors.white,
  },
  uploadLabel: {
    color:      Colors.white,
    fontSize:   13,
    fontWeight: '600',
  },
})
