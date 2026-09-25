import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Image } from 'expo-image'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import CdnSvg, { CdnImage } from '../cdn-svg/CdnSvg'
import { WhatsAppUnlockButton, BlurPhotoPlaceholder } from '../matches/matchesCard.shared'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'
import { getItem } from '../../service/storageService'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { StorageKeys } from '../../constants/storage.keys'
import { getOppGenderAvatarUrl, FEMALE_AVATAR_URL } from '../../utils/avatar'

// ─── Types ────────────────────────────────────────────────────────────────────

// Drives border-radius variants — mirrors Angular .matches / .viewedyou / .successStory
export type PhotoVariant = 'matches' | 'viewedyou' | 'successStory' | 'default' | 'likedProfile'

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
  likedStatus?:   '0' | '1' | '2' | '3' | '5' | undefined
  showDontShow?:  boolean | undefined   // show "Don't show this profile" pill
  dontShowLabel?: string | undefined
  showThreeDots?: boolean | undefined   // show 3-dot action menu button

  // ── Layout ────────────────────────────────────────────────────────────────
  variant?:  PhotoVariant | undefined
  // Angular: .information-block — only card types 1 & 2's templates include
  // this dark gradient div; types 3/4/6/7/8 don't, so this must be opt-in
  // rather than rendered for every ProfilePhoto instance.
  showGradientScrim?: boolean | undefined
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
  // Angular: matches-card.component's "no photo at all" overlay — contact
  // her/him via WhatsApp to ask for a photo, not a generic "send request"
  // flow (see showAddRequest below).
  onWhatsApp?:         (() => void) | undefined

  // Upload callback — receives the local file URI selected by the user
  onPhotoUpload?: ((uri: string) => void) | undefined
}

// ─── Re-export PhotoVariant so importers don't need a second import ───────────

// ─── CDN constants ────────────────────────────────────────────────────────────

const CDN = CDN_SVG + 'revamp/'

const ICONS = {
  newlyJoinedBg:  CDN + 'newly-joined.svg',
  newlyJoinedStar: CDN + 'newly-joined-star.svg',
  shortlistOff:   CDN_SVG + 'shortlist/shortlist-white.svg',
  shortlistOn:    CDN_SVG + 'shortlist/shortlisted-white-updated.svg',
  closeWhite:     CDN + 'close-white.svg',
  camera:         CDN + 'camera-upload.svg',    // upload CTA icon
  hiddenLock:     CDN + 'hidden-lock.svg',       // protected-photo overlay padlock badge
  forwardGreen:   CDN + 'forward-icon-green.svg', // "view hidden photo" link CTA chevron
}

// ─── Border radius per variant (mirrors Angular CSS) ─────────────────────────

const RADIUS: Record<PhotoVariant, { tl: number; tr: number; bl: number; br: number }> = {
  default:      { tl: 12, tr: 12, bl: 12, br: 12 },
  matches:      { tl: 16, tr: 16, bl: 16, br: 16 },
  // Angular: .viewedyou/.viewedbyme/.whoviewednumber.card-ht3 { border-radius:
  // 12px } — full rounding (the photo is inset within its own card, not
  // full-bleed with a flat bottom edge like variant 1/2's cards).
  viewedyou:    { tl: 12, tr: 12, bl: 12, br: 12 },
  successStory: { tl: 12, tr: 12, bl:  0, br:  0 },
  // Angular: type='8's app-photo-new gets [btmRadiusClass]="'border-radius-24'"
  // — a distinct 24px radius, matching the outer .card-type-8 card shell's
  // own 24px (not the 16px 'matches' shares with newmatches/dailyrecommendations/etc).
  likedProfile: { tl: 24, tr: 24, bl: 24, br: 24 },
}

// ─── Newly-joined badge sub-component ────────────────────────────────────────
// Angular: .newly-joined's background SVG has no intrinsic size of its own to
// read — `width:fit-content` means the SHAPE stretches (background-size:cover)
// to whatever the icon+text+padding content naturally computes to. RN can't
// size an SvgUri/Image to "cover an as-yet-unmeasured parent", so this renders
// text-only on the first frame, measures itself via onLayout, then adds the
// real background SVG behind the content at that exact size.

export function NewlyJoinedBadge() {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  return (
    <View
      style={styles.newlyJoinedBadge}
      onLayout={e => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {!!size && (
        <CdnSvg uri={ICONS.newlyJoinedBg} width={size.width} height={size.height} style={StyleSheet.absoluteFill} />
      )}
      <CdnSvg uri={ICONS.newlyJoinedStar} width={16} height={16} />
      {/* Angular: MATCHES.NEW_BADGE — "Newly Joined", not the "New" this
          previously hardcoded. */}
      <Text style={[styles.newlyJoinedText, { fontFamily: langFonts.medium }]}>{t('MATCHES.NEW_BADGE')}</Text>
    </View>
  )
}

// Angular: profile-card.component.html's `.information-block` (name/basic-
// detail overlay, type 1/2 only) is gated `*ngIf="!whatsAppAddPhotoRequestFlag
// && !whatsAppViewHiddenPhotoRequest"` — computed here once so ProfileCard.tsx
// can gate its own <InfoOverlay> children the same way ProfilePhoto gates its
// internal photo-source swap, instead of re-deriving the same two booleans.
export function isPhotoRequestActive(
  isPhotoAvailable: boolean | undefined,
  isPhotoProtect:   boolean | undefined,
  showReqPhotoElement: boolean | undefined,
): boolean {
  const showAddRequest  = !isPhotoAvailable && !!showReqPhotoElement && !isPhotoProtect
  const showViewRequest = !!isPhotoProtect && !!showReqPhotoElement
  return showAddRequest || showViewRequest
}

// ─── ProfilePhoto ─────────────────────────────────────────────────────────────

export default function ProfilePhoto({
  profileImage,
  defaultImage,
  height,
  isPhotoAvailable  = true,
  isPhotoProtect    = false,
  showReqPhotoElement = true,
  isOwnPhoto = false,
  isNewlyJoined = false,
  isShortlisted = false,
  likedStatus,
  showDontShow = false,
  dontShowLabel = "Don't show this profile",
  showThreeDots = false,
  variant = 'default',
  showGradientScrim = false,
  style,
  children,
  onPress,
  onShortlistPress,
  onDontShowPress,
  onThreeDotPress,
  onImageLoad,
  onWhatsApp,
  onPhotoUpload,
}: ProfilePhotoProps) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
  const [imgError, setImgError] = useState(false)
  const [uploading, setUploading] = useState(false)
  // Angular: getAvatarImage(profile) → getAvatarImg(getOppGenderType()) — a
  // profile card's placeholder (no photo) is the OPPOSITE gender's silhouette.
  // Read once per mount rather than threading login gender through every
  // ProfileCard prop chain; callers that need a specific per-item avatar
  // (e.g. the logged-in user's own photo) still override via `defaultImage`.
  const [oppGenderAvatar, setOppGenderAvatar] = useState(FEMALE_AVATAR_URL)
  // Same single "opposite gender" concept as the avatar above — needed for
  // the WhatsApp overlay's #HER_HIS# pronoun token.
  const [oppGenderCode, setOppGenderCode] = useState<'M' | 'F'>('F')

  useEffect(() => {
    let cancelled = false
    getItem(StorageKeys.User.LOGIN_GENDER).then(gender => {
      if (cancelled) return
      const opp = gender === 'F' ? 'M' : 'F'
      setOppGenderCode(opp)
    })
    getOppGenderAvatarUrl().then(url => { if (!cancelled) setOppGenderAvatar(url) })
    return () => { cancelled = true }
  }, [])

  const r = RADIUS[variant]
  const resolvedDefault = defaultImage ?? oppGenderAvatar
  const showFallback = imgError || !profileImage

  // Determine what state the photo block is in
  const showBlur        = isPhotoProtect && isPhotoAvailable
  const showAddRequest  = !isPhotoAvailable && showReqPhotoElement && !isPhotoProtect
  const showViewRequest = isPhotoProtect && showReqPhotoElement

  // Guards against the camera/library picker being launched twice at once —
  // requestXPermissionsAsync()/launchXAsync() can reject ("Different picker
  // is already open") if invoked again before the first call's promise
  // settles, and neither handler's own `uploading` state is set until after
  // that point, so it can't catch this on its own.
  const pickerBusyRef = useRef(false)

  // ── Own-photo upload (React Native replaces the old native Cordova handler) ──
  const handleUploadPress = useCallback(async () => {
    if (pickerBusyRef.current) return
    pickerBusyRef.current = true
    try {
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
    } catch (e) {
      if (__DEV__) console.error('[ProfilePhoto] photo library error:', e)
    } finally {
      pickerBusyRef.current = false
    }
  }, [onPhotoUpload])

  const handleCameraPress = useCallback(async () => {
    if (pickerBusyRef.current) return
    pickerBusyRef.current = true
    try {
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
    } catch (e) {
      if (__DEV__) console.error('[ProfilePhoto] camera error:', e)
    } finally {
      pickerBusyRef.current = false
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
      {/* ── Base photo ──
          Angular: app-swiper.component.ts's setProfileImg() — when
          showWhatsAppPhotoRequest(profile) is true (no real photo at all,
          WhatsApp nudge eligible), the bound [profileImg] is REPLACED
          entirely with getWhatsAppAvatarImg() (a gender-specific blurred-
          silhouette SVG, e.g. profile-blur-male.svg), overriding whatever
          real photo/avatar would otherwise show — not just an overlay on top
          of the normal fallback avatar. Same asset MatchesScreen.tsx's
          MatchCard already uses via getBlurPhotoUri() for its own equivalent
          states. Fallback (no photo / failed load, WhatsApp nudge NOT active)
          is the plain opposite-gender SVG silhouette — native <Image> can't
          decode a remote .svg (see CdnSvg.tsx), so both branches route
          through CdnSvg/CdnImage instead of the real-photo <Image> below.

          BlurPhotoPlaceholder on the first branch: react-native-svg mis-scales
          the pattern-based SVG, so native rebuilds its card-stack artwork +
          bottom fade from a bundled bitmap — see that component. */}
      {showAddRequest ? (
        <BlurPhotoPlaceholder
          oppGender={oppGenderCode}
          width="100%"
          height="100%"
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
        />
      ) : showFallback ? (
        <CdnImage
          uri={resolvedDefault}
          width="100%"
          height="100%"
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
        />
      ) : (
        <Image
          source={{ uri: profileImage }}
          style={[
            styles.image,
            {
              borderTopLeftRadius:     r.tl,
              borderTopRightRadius:    r.tr,
              borderBottomLeftRadius:  r.bl,
              borderBottomRightRadius: r.br,
            },
          ]}
          contentFit="cover"
          // memory-disk cache + recyclingKey so the same photo isn't
          // re-downloaded/re-decoded every time this card remounts or is
          // recycled by a FlatList — mirrors matchesCard.shared.tsx's swiper.
          cachePolicy="memory-disk"
          recyclingKey={profileImage}
          transition={150}
          onError={() => setImgError(true)}
          // exactOptionalPropertyTypes forbids an explicit `onLoad: undefined`
          // — only include the prop at all when a real callback was passed.
          {...(onImageLoad ? { onLoad: onImageLoad } : {})}
        />
      )}

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

      {/* ── Gradient scrim, full card (types 1 & 2 only) — Figma: linear-
          gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.9) 100%), confirmed
          via get_design_context's `from-1/2 from-rgba(0,0,0,0) to-rgba(0,0,0,0.9)`
          on an inset-0 layer (spans the whole card, not just a bottom strip —
          differs from Angular's own shorter, fully-opaque .information-block
          gradient; this follows the Figma spec per explicit direction). ── */}
      {showGradientScrim && (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.9)']}
          locations={[0, 0.5, 1]}
          style={[
            StyleSheet.absoluteFill,
            {
              borderTopLeftRadius:     r.tl,
              borderTopRightRadius:    r.tr,
              borderBottomLeftRadius:  r.bl,
              borderBottomRightRadius: r.br,
            },
          ]}
        />
      )}

      {/* ── Card-level overlays passed from parent (InfoOverlay, eyeBadge, etc.) ──
          Angular: profile-card.component.html's `.information-block` (type 1/2's
          name+basic-detail text) is `*ngIf="!whatsAppAddPhotoRequestFlag &&
          !whatsAppViewHiddenPhotoRequest"` — but type 3's OWN overlay (viewed-
          icon+text) has NO such gate, so this can't be a blanket rule here.
          ProfileCard.tsx's case 1/2 branches gate their own <InfoOverlay>
          children using isPhotoRequestActive() (exported below) instead. */}
      {children}

      {/* ── Newly-joined badge (top-left ribbon) ── Angular: .newly-joined —
          a background SVG (newly-joined.svg, background-size:cover),
          width:fit-content — not a flat color + corner-radius rectangle.
          RN can't stretch an SVG to an as-yet-unknown auto-sized parent
          without measuring first, so the background renders only once
          onLayout reports the content's real size. ── */}
      {isNewlyJoined && <NewlyJoinedBadge />}

      {/* ── Shortlist pill (top-right) ── */}
      {isShortlisted && (
        <Pressable style={styles.shortlistPill} onPress={onShortlistPress}>
          <CdnSvg
            uri={(likedStatus === '1' || likedStatus === '3') ? ICONS.shortlistOn : ICONS.shortlistOff}
            width={20}
            height={20}
            style={styles.shortlistIcon}
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
          <CdnSvg uri={ICONS.closeWhite} width={16} height={16} style={styles.dontShowIcon} />
          <Text style={styles.dontShowText}>{dontShowLabel}</Text>
        </Pressable>
      )}

      {/* ── No photo at all — Angular: matches-card.component's WhatsApp
          overlay (getWhatsAppAvatarImg() + request-photo-vp block) — contact
          her/him on WhatsApp to ask for a photo. NOT the generic "send
          request" flow the isAddPhotoRequest/onAddPhotoRequest props drove
          previously (that flow doesn't exist for this case in the real app —
          there's no "request sent" alternate state here, tapping WhatsApp
          just opens WhatsApp directly). ── */}
      {showAddRequest && (
        // Angular: photoOverlay has no dim scrim of its own — only the
        // blurred photo behind and the dark floating card itself.
        <View style={styles.whatsappOverlayWrap}>
          <View style={styles.whatsappOverlayCard}>
            <Text style={[styles.whatsappOverlayText, { fontFamily: langFonts.regular }]}>
              {t('GENERAL.REQUEST_ADD_PHOTO_WHATSAPP').replace('#HER_HIS#', t(`PRONOUN.${oppGenderCode}.hisher`))}
            </Text>
            <WhatsAppUnlockButton label={t('GENERAL.WHATSAPP')} onPress={() => onWhatsApp?.()} />
          </View>
        </View>
      )}

      {/* ── Protected/hidden-photo overlay — Angular: getWhatsAppViewHiddenPhotoRequest()
          routes through the SAME WhatsApp click handler as the no-photo case
          above (whatsAppPhotoRequestBtnClickOn(), communication.service.ts:
          202-254) — there's no separate persisted "request sent" state for
          this variant, unlike the add-photo case's ADDPHOTOREQUEST flag.
          BUT the visual is genuinely different from that case, per Angular's
          photo-request.component.html: a padlock badge above the text
          (isPhotoProtect, lines 4-6), and the CTA itself is a plain green
          underlined text link with a small trailing chevron (buttonType:
          link, background: transparent, iconType: forwardIconGreen,
          textClassName: text-decoration-underline — lines 34-46), NOT the
          solid WhatsApp-branded button the add-photo case uses. Reusing
          WhatsAppUnlockButton here rendered a big solid green button where
          Angular shows a small text link. ── */}
      {showViewRequest && (
        <View style={styles.whatsappOverlayWrap}>
          <View style={styles.whatsappOverlayCard}>
            <CdnSvg uri={ICONS.hiddenLock} width={28} height={28} />
            <Text style={[styles.whatsappOverlayText, { fontFamily: langFonts.regular }]}>
              {t('GENERAL.REQUEST_HIDDEN_PHOTO_WHATSAPP').replace('#HER_HIS#', t(`PRONOUN.${oppGenderCode}.hisher`))}
            </Text>
            <Pressable style={styles.whatsappLinkBtn} onPress={() => onWhatsApp?.()}>
              <Text style={[styles.whatsappLinkText, { fontFamily: langFonts.regular }]}>{t('GENERAL.WHATSAPP')}</Text>
              <CdnSvg uri={ICONS.forwardGreen} width={7} height={10} />
            </Pressable>
          </View>
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
                <CdnSvg uri={ICONS.camera} width={28} height={28} />
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

  // ── Newly-joined badge ──────────────────────────────────────────────────────
  // Matches Angular .newly-joined (ribbon at top-left, custom SVG bg)
  // Angular: .newly-joined { padding: 4px 20px 4px 12px } — shape comes from
  // the real background SVG (rendered in NewlyJoinedBadge above), not a flat
  // color + corner-radius.
  newlyJoinedBadge: {
    position:        'absolute',
    top:             0,
    left:            0,
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical:   4,
    paddingLeft:      12,
    paddingRight:     20,
  },
  // Angular: .textcta-medium-12 { font-family: var(--english-medium-poppins) }
  newlyJoinedText: {
    fontFamily: SemanticFontsEnglish.specialCtaEnglishMedium,
    color:      Colors.white,
    fontSize:   FontSize.font12,
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
    fontSize:   FontSize.font12,
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
    fontSize:   FontSize.font18,
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
    fontSize:   FontSize.font12,
    fontWeight: '500',
    marginLeft:  8,
  },

  // ── WhatsApp "no photo" overlay ─────────────────────────────────────────────
  // Angular: matches-card.component's photoOverlay — centered, no dim scrim of
  // its own (see comment at the call site above).
  whatsappOverlayWrap: {
    ...StyleSheet.absoluteFill,
    alignItems:     'center',
    justifyContent: 'center',
  },
  whatsappOverlayCard: {
    backgroundColor:   Colors.scrimStrong,
    marginHorizontal:  24,
    paddingVertical:   8,
    paddingHorizontal: 16,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       Colors.overlayBorder,
    alignItems:        'center',
    width:             '80%',
    gap:               12,
  },
  whatsappOverlayText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   FontSize.font13,
    color:      Colors.white,
    textAlign:  'center',
    lineHeight: 18,
  },
  // Angular: photo-request.component.html's "view hidden photo" CTA —
  // buttonType link, background transparent, iconPosition end (chevron
  // trails the text, not the WhatsApp-icon-leads layout WhatsAppUnlockButton
  // uses for the add-photo case).
  whatsappLinkBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  whatsappLinkText: {
    fontFamily:        SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:          FontSize.font14,
    color:             Colors.whatsappGreen,
    textDecorationLine: 'underline',
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
  uploadLabel: {
    color:      Colors.white,
    fontSize:   FontSize.font13,
    fontWeight: '600',
  },
})
