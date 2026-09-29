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
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { FontSize, remPx } from '../../src/theme/fonts'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'
import { getFewMoreDetailsNextPage } from './fewMoreDetailsFlow'
import { Endpoints } from '../../service/api.endpoints'
import { apiCall } from '../../service/apiClient'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { handleBack } from '../../utils/navigationRef'
import { getRegValue } from '../../service/registrationService'
import { deletePhoto, setMainPhoto } from '../../service/profileService'
import { CDN_LOTTIE, CDN_REG, CDN_SVG } from '../../constants/cdn'
import CdnLottie from '../../components/CdnLottie'
import CdnSvg from '../../components/cdn-svg/CdnSvg'

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
  PHOTOURL:    string
  PHOTOTHUMB?: string
  MAINPHOTO:   number
  PHOTOSTATUS: number
}

type Props = {
  navigation: any
  route:      { params?: { pageNo?: string; pendingUri?: string; standalone?: boolean } }
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
// Angular: this screen is currentPageType '20' once showPhotoPromotion has
// flipped false (post-upload) — registration-revamp.component.ts's
// getPageContent() then leaves ICONTYPE/regPageContent untouched, so the
// generic template's page icon (`*ngIf="regPageContent?.ICONTYPE"`,
// `.min-height-48`), app-onboarding-photo's trash icon, and the guidelines
// row's icon all render their real CDN assets — not the hand-drawn
// placeholder vectors this screen used before.

// registration.config.ts REGISTRATIONPAGE[20].ICONTYPE.
const CDN_PAGE_ICON = CDN_REG + 'add-photos.svg'
// onboarding-photo.component.html's per-photo trash icon.
const CDN_TRASH_ICON = CDN_REG + 'trash-img.svg'
// registration-revamp.component.html's guidelines row icon (`.width-height-16`
// = 1.5rem, so it scales with device width like any other rem value here).
const CDN_GUIDELINES_ICON = CDN_SVG + 'guidelins.svg'
const GUIDELINES_ICON_SIZE = remPx(1.5)

function TrashIcon() {
  // Angular's `.trash` wrapper sets position only, no explicit width/height —
  // no verified size to port, so this keeps its existing footprint.
  return <CdnSvg uri={CDN_TRASH_ICON} width={18} height={18} />
}

function InfoIcon() {
  return <CdnSvg uri={CDN_GUIDELINES_ICON} width={GUIDELINES_ICON_SIZE} height={GUIDELINES_ICON_SIZE} />
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ManagePhotosScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation()
  const langFonts = useLanguageFonts()
  const pendingUri  = (route.params as any)?.pendingUri as string | undefined
  const standalone  = !!(route.params as any)?.standalone

  const [photos,    setPhotos]    = useState<Photo[]>([])
  const [loading,   setLoading]   = useState(true)
  const [createdBy, setCreatedBy] = useState('1')

  useOnboardingFooter({
    nextLabel:    t('REGISTRATION.CONFIRM', 'Confirm'),
    nextDisabled: false,
    // Angular: editform/20 (help-center.component.ts PageNavigation 'Add Photo')
    // returns to frm_page on save — standalone entry mirrors that instead of
    // always continuing the signup wizard to page 27.
    // Angular: uploadPhotoSuccess() routes through getFewMoreDetailsNext('20'),
    // so a completed photo upload enters the same conditional 34/35 chain.
    onNext:       () => {
      // Angular: registration-revamp.component.ts's clickOnNext('20') has no
      // PHOTOSTATUS check at all — Confirm always proceeds, even with a photo
      // still pending. (Angular also auto-advances this same page itself,
      // straight from the upload-verdict callback, without waiting for a tap
      // — a separate, bigger behavior gap this RN port doesn't close yet.)
      if (standalone) { handleBack(); return }
      getFewMoreDetailsNextPage('20').then(next =>
        navigation.push('onboarding', { pageNo: next }))
    },
    // i18n.language: nextLabel is translated, so the footer state must be
    // re-pushed when the language changes or the button keeps the old wording.
  }, [navigation, standalone, i18n.language])

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
    navigation.push('onboarding', { pageNo: '22', existingCount: photos.length, standalone })
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  function confirmDelete(photo: Photo) {
    Alert.alert('Delete photo', 'Remove this photo from your profile?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const res = await deletePhoto(photo.PHOTOID)
            if (res?.RESPONSECODE == 1) await loadPhotos()
          } catch {
            Alert.alert('Error', 'Could not delete photo.')
          }
        },
      },
    ])
  }

  // ─── Set main ─────────────────────────────────────────────────────────────

  // Angular: managephoto.page.ts's makeMainPhoto() — a photo still pending AI
  // validation (PHOTOSTATUS===0) can't be set as main; the "more options"
  // popup shows the UNDERVALIDATE/TAKEHOURS message instead.
  function handlePhotoPress(photo: Photo) {
    if (photo.PHOTOSTATUS === 0) {
      showUnderValidationAlert()
      return
    }
    setAsMain(photo)
  }

  // Reused by both the per-photo guard above and the Confirm-button guard
  // below — same Angular UNDERVALIDATE/TAKEHOURS copy (modalpopup.component.html),
  // already translated in all 11 locale files.
  function showUnderValidationAlert() {
    Alert.alert(
      t('MATCHES.UNDERVALIDATE', 'Your photo is getting validated'),
      t('MATCHES.TAKEHOURS', 'This will take around 1 hour. We will notify you when its done'),
    )
  }

  async function setAsMain(photo: Photo) {
    try {
      const res = await setMainPhoto(photo.PHOTOID)
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
            <Text style={[styles.processingText, { fontFamily: langFonts.medium }]}>Processing…</Text>
          </View>
          {isMain && (
            <View style={styles.profileLabel}>
              <Text style={[styles.profileLabelText, { fontFamily: langFonts.medium }]}>Profile Picture</Text>
            </View>
          )}
        </View>
      )
    }

    const uri = item.PHOTOURL || item.PHOTOTHUMB || ''
    return (
      <Pressable
        style={[styles.photoCard, style, isMain && styles.mainPhotoCard]}
        onPress={isMain ? undefined : () => handlePhotoPress(item)}
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
            <Text style={[styles.reviewText, { fontFamily: langFonts.semiBold }]}>Under review</Text>
          </View>
        )}

        {/* Profile Picture label on main */}
        {isMain && (
          <View style={styles.profileLabel}>
            <Text style={[styles.profileLabelText, { fontFamily: langFonts.medium }]}>Profile Picture</Text>
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
        {/* Icon — Angular: REGISTRATIONPAGE[20].ICONTYPE, `.min-height-48` (flat 48px). */}
        <View style={styles.iconRow}>
          <Image source={{ uri: CDN_PAGE_ICON }} style={styles.pageIcon} contentFit="contain" />
        </View>

        {/* Title + subtitle */}
        <Text style={[styles.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>
        <Text style={[styles.subtitle, { fontFamily: langFonts.regular }]}>{subtitle}</Text>

        {/* Loading state (no pending URI) */}
        {loading && !pendingUri ? (
          <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} style={{ alignSelf: 'center', marginTop: 40 }} />
        ) : displayPhotos.length === 0 ? (
          <Text style={[styles.emptyHint, { fontFamily: langFonts.regular }]}>No photos yet. Go back and add one.</Text>
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
                <Text style={[styles.addMoreText, { fontFamily: langFonts.semiBold }]}>+ Add more photos</Text>
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
          <Text style={[styles.guidelinesText, { fontFamily: langFonts.medium }]}>Check out our photo guidelines</Text>
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
  // Angular: `.min-height-48` (flat 48px) on the page ICONTYPE `<img>`.
  pageIcon: {
    width:  48,
    height: 48,
  },

  // Angular: this screen renders once currentPageType '20' has left
  // showPhotoPromotion, so the generic template's title col applies again —
  // `.heading1-semibold-22 black-color` (registration-revamp.component.html:32).
  title: {
    fontSize:     FontSize.font22,
    fontWeight:   '600',
    color:        Colors.black,
    marginBottom: 6,
  },
  // Angular: the subheading ion-label is plain `.body2-regular-14` — no
  // color utility class and no line-height class, so this app's default text
  // color (Ionic's unthemed --ion-text-color, #000) applies, not an invented
  // gray, and no line-height is set either.
  subtitle: {
    fontSize:     FontSize.font14,
    fontWeight:   '400',
    color:        Colors.black,
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
    fontSize:   FontSize.font12,
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
    fontSize:   FontSize.font12,
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
  // Angular: `.profile-picture textcta-medium-12 white-color`
  // (onboarding-photo.component.html).
  profileLabelText: {
    fontSize:   FontSize.font12,
    fontWeight: '500',
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
    fontSize:   FontSize.font28,
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
    fontSize:   FontSize.font14,
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
  // Angular: `.textcta-medium-12 color-29339B` wrapped in `<u>`
  // (registration-revamp.component.html:145).
  guidelinesText: {
    fontSize:            FontSize.font12,
    fontWeight:          '500',
    color:               Colors.link,
    textDecorationLine: 'underline',
  },

  emptyHint: {
    fontSize:  FontSize.font14,
    color:     '#999',
    textAlign: 'center',
    marginTop: 40,
  },
})
