import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
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
import { getRegValue, fetchAddPhotoIntermediateContent } from '../../service/registrationService'
import { CDN_SVG } from '../../constants/cdn'
import { os } from './onboardingStyles'
import { getFewMoreDetailsNextPage } from './fewMoreDetailsFlow'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import CustomGalleryScreen from './CustomGalleryScreen'
import GalleryAccessSheet from '../../components/gallery-access-sheet/GalleryAccessSheet'
import GallerySettingsSheet from '../../components/gallery-access-sheet/GallerySettingsSheet'
import { requestStoragePermission } from '../../service/permissionService'
import { getItem, setItem } from '../../service/storageService'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { Endpoints } from '../../service/api.endpoints'
import { uploadFile } from '../../service/apiClient'
import {
  getPhotoConfig, validatePhotoAsset, normalizeWebFile, getRejectReasons, describeRejection,
  type PhotoRejectionCode,
} from '../../service/photoValidationService'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_MALE_PLACEHOLDER   = CDN_SVG + 'add-photo.svg'
const CDN_FEMALE_PLACEHOLDER = CDN_SVG + 'add-photo.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: any
  route:      { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddPhotoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  const [gender,    setGender]    = useState('1')
  const [createdBy, setCreatedBy] = useState('4')

  // Angular: add-photo.component.ts's getLanguageContent() — HEADER (via
  // bindTitle)/SUBHEADER/BODY.CONTENT1/BODY.CONTENT2/CTA all come from the
  // registrationArrays API (PHOTOPUBLISHED or PHOTOPUBLISHPAID bucket), not
  // static locale strings. Defaults here match Angular's own template
  // fallback text, used until the fetch resolves (or if the API ever omits
  // a field).
  const [title,     setTitle]     = useState('Add your photo\nto continue')
  const [subheader, setSubheader] = useState('Only if you add photo:')
  const [content1,  setContent1]  = useState('You will be able to shortlist matches')
  const [content2,  setContent2]  = useState('Your profile will be visible to matches')
  const [addPhotoCta, setAddPhotoCta] = useState<string | null>(null)

  // Angular: clicking "Add photo now" calls addPhoto() → common.ts's
  // callNative('Add_photo'), which (on web/PWA) just pops the browser's own
  // native file-picker dialog directly over the current page — it never
  // navigates to a different in-app page. Presenting CustomGalleryScreen in a
  // Modal (same pattern as EditProfileScreen's photo picker) reproduces that
  // "transient overlay over this same screen" feel instead of a full-page
  // navigation into the wizard stack, which read as "showing some other page".
  const [galleryVisible, setGalleryVisible] = useState(false)

  // Shown before the picker whenever gallery permission isn't yet granted —
  // Angular's STORAGE_SETTINGS bottom sheet ("Let's add your photos" /
  // "Allow gallery access"), see GalleryAccessSheet.
  const [accessSheetVisible, setAccessSheetVisible] = useState(false)

  // Escalated variant (Angular's type '5') — shown on the 3rd+ tap while
  // permission is still not granted; adds Settings instructions + two
  // buttons, see GallerySettingsSheet.
  const [settingsSheetVisible, setSettingsSheetVisible] = useState(false)

  // Web only — Angular's real web/PWA behavior is click → the browser's own
  // native file-picker dialog directly, with NO intermediate screen at all
  // (see fileHandler.ts's openFilePicker / EditProfileScreen's
  // webFileInputRef). This hidden input IS that picker; CustomGalleryScreen's
  // whole-screen web fallback is native-only from here on.
  const webFileInputRef = useRef<HTMLInputElement | null>(null)
  const [webUploading, setWebUploading] = useState(false)

  // Angular: add-photo.component.ts's skip() — for the onboarding fromPage it
  // just emits straight to onboardingSkip(), no confirmation dialog; that only
  // exists for this same component's OTHER entry point (opened from a
  // notification banner), not here.
  function handleSkip() {
    // Angular: getFewMoreDetailsNext('20') — the JODII-490 chain routes to
    // 34 (education detail) or 35 (occupation detail) when eligible, else 27.
    getFewMoreDetailsNextPage('20').then(next =>
      navigation.push('onboarding', { pageNo: next }))
  }

  // Extracted so a language change can re-run it — this content is
  // server-translated (see fetchAddPhotoIntermediateContent), same pattern
  // as CasteScreen/HomeTownLocationScreen's useLanguageReload usage.
  function loadContent() {
    return fetchAddPhotoIntermediateContent().then(content => {
      if (content.header)    setTitle(content.header)
      if (content.subheader) setSubheader(content.subheader)
      if (content.content1)  setContent1(content.content1)
      if (content.content2)  setContent2(content.content2)
      if (content.cta)       setAddPhotoCta(content.cta)
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

    loadContent()
  }, [])

  useLanguageReload(loadContent)

  const isFemale = gender === '2' || ['5', '9'].includes(createdBy)

  // Angular: callNative('Add_photo') — common.ts's STG_PERMISSION_COUNT
  // escalation (when permission isn't already granted), NATIVE:
  //   1st tap (_cnt==0): native OS popup only, no in-app modal — counter set
  //     to 1 immediately (common.ts).
  //   2nd tap (_cnt==1): AutoStartComponent type '6' (GalleryAccessSheet) —
  //     counter only advances to 2 once THIS popup is dismissed
  //     (notification-service.service.ts's onDidDismiss, not on open).
  //   3rd+ tap (_cnt>=2): type '5' (GallerySettingsSheet) — terminal state,
  //     dismissing it does not advance the counter further.
  //
  // WEB has no native OS permission prompt at all, so Angular's real tap-1
  // behavior (no visible popup) has nothing to show here either — by request,
  // web instead starts the escalation at type '6' on tap 1 (skipping the
  // popup-less first step) so both in-app popups are reachable while testing
  // in a browser: tap 1 → GalleryAccessSheet; once it's dismissed the counter
  // advances straight to 2 (same as native), so tap 2+ → GallerySettingsSheet.
  async function openGallery() {
    if (Platform.OS !== 'web') {
      const { getPermissionsAsync } = await import('expo-media-library')
      const { status } = await getPermissionsAsync()
      if (status === 'granted') {
        setGalleryVisible(true)
        return
      }

      const raw = await getItem(SK.App.STG_PERMISSION_COUNT)
      const cnt = raw ? parseInt(raw, 10) || 0 : 0

      if (cnt === 0) {
        await setItem(SK.App.STG_PERMISSION_COUNT, '1')
        setGalleryVisible(true)
      } else if (cnt === 1) {
        setAccessSheetVisible(true)
      } else {
        setSettingsSheetVisible(true)
      }
      return
    }

    const raw = await getItem(SK.App.STG_PERMISSION_COUNT)
    const cnt = raw ? parseInt(raw, 10) || 0 : 0

    if (cnt <= 1) {
      setAccessSheetVisible(true)
    } else {
      setSettingsSheetVisible(true)
    }
  }

  // GalleryAccessSheet (type '6') dismissed — via either "Allow gallery
  // access" or the close icon. Angular advances STG_PERMISSION_COUNT here,
  // on dismiss, regardless of which button was used.
  function handleAccessSheetDismissed() {
    setAccessSheetVisible(false)
    setItem(SK.App.STG_PERMISSION_COUNT, '2')
  }

  // "Allow gallery access" tapped (type '6' sheet). On web this MUST open
  // the hidden file input synchronously, in the same call stack as the
  // user's press — browsers silently ignore input.click() once it happens
  // after an await/async gap, since it no longer counts as a direct user
  // gesture (see webFileInputRef above). So the click fires first, and the
  // (non-blocking) bookkeeping/permission calls happen after.
  function handleAllowGalleryAccess() {
    handleAccessSheetDismissed()
    if (Platform.OS === 'web') {
      webFileInputRef.current?.click()
      return
    }
    requestStoragePermission().then(() => setGalleryVisible(true))
  }

  // Web upload — same endpoint/pattern as CustomGalleryScreen.web.tsx and
  // EditProfileScreen's webFileInputRef, minus the intermediate screen.
  async function handleWebFiles(e: any) {
    const files: File[] = Array.from(e.target.files ?? [])
    if (!files.length) return
    setWebUploading(true)
    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      const config = await getPhotoConfig()
      const rejections: PhotoRejectionCode[] = []
      let firstUri: string | undefined
      for (const file of files) {
        const input = await normalizeWebFile(file)
        const validation = await validatePhotoAsset(input, config)
        if (!validation.ok) {
          URL.revokeObjectURL(input.uri)
          rejections.push(validation.code)
          continue
        }
        const formData = new FormData()
        formData.append('ID', userId)
        formData.append('AIVALIDATE', config.isNativeFaceDetectionEnabled ? '1' : '0')
        formData.append('UPLOADPHOTO', file, file.name)
        const res = await uploadFile(Endpoints.media.addProfilePic, formData)
        if (res?.RESPONSECODE == 1 && !firstUri) {
          firstUri = input.uri
        } else {
          URL.revokeObjectURL(input.uri)
        }
      }

      if (rejections.length) {
        const reasons = await getRejectReasons()
        Alert.alert(
          rejections.length === files.length ? 'Photo not added' : 'Some photos were not added',
          rejections.map(code => describeRejection(code, reasons)).join('\n\n'),
        )
      }
      if (rejections.length === files.length) return

      navigation.push('onboarding', { pageNo: '21', pendingUri: firstUri })
    } catch {
      Alert.alert('Error', 'Upload failed. Please try again.')
    } finally {
      setWebUploading(false)
      if (webFileInputRef.current) webFileInputRef.current.value = ''
    }
  }

  useOnboardingFooter({
    nextHidden: true,
    showSkip:   false,
    onNext:     () => {},
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        {/* Pink photo placeholder */}
        <View style={styles.photoAreaWrapper}>
          <Pressable
            style={styles.photoArea}
            onPress={openGallery}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
          >
            <Image
              source={{ uri: isFemale ? CDN_FEMALE_PLACEHOLDER : CDN_MALE_PLACEHOLDER }}
              style={styles.silhouette}
              contentFit="contain"
            />
          </Pressable>
        </View>

        {/* Title — Angular: add-photo.component.html's bindTitle(INTERMEDIATE)
            returns INTERMEDIATE.HEADER for the onboarding fromPage — same
            server-translated registrationArrays bucket as the rest of this
            page's content (fetched below), not a static locale key. */}
        <Text style={[styles.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        {/* Benefits card — Angular: add-photo.component.html's promotype==='1'
            block (SUBHEADER + BODY.CONTENT1/CONTENT2), fetched dynamically from
            the registrationArrays API (fetchAddPhotoIntermediateContent above);
            these state values fall back to Angular's own template default text
            until the fetch resolves. */}
        <View style={styles.card}>
          <Text style={[styles.cardIntro, { fontFamily: langFonts.regular }]}>{subheader}</Text>

          <View style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={[styles.bulletText, { fontFamily: langFonts.medium }]}>{content1}</Text>
          </View>

          <View style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={[styles.bulletText, { fontFamily: langFonts.medium }]}>{content2}</Text>
          </View>

          {/* Add photo button inside card — Angular: INTERMEDIATE.CTA off the
              same dynamic response; falls back to REGISTRATION.ADDPHOTOCTA
              (registration.config.ts page 20's CTA key) until fetched. */}
          <Pressable
            style={[styles.addBtn, webUploading && styles.addBtnDisabled]}
            onPress={openGallery}
            disabled={webUploading}
            accessibilityRole="button"
          >
            <Text style={[styles.addBtnLabel, { fontFamily: langFonts.regular }]}>
              {webUploading ? t('GENERAL.LOADING', 'Loading…') : (addPhotoCta ?? t('REGISTRATION.ADDPHOTOCTA', 'Add photo'))}
            </Text>
          </Pressable>
        </View>

        {/* "I'll do this later" — Angular: #skip_cta div sits inside the same
            scrollable wrapper right after the card ("mt-32 ... d-flex
            justify-content-center"), not pinned as a fixed footer. Skips
            immediately, no confirmation dialog, for the onboarding entry point. */}
        <Pressable
          style={styles.laterRow}
          onPress={handleSkip}
          hitSlop={12}
        >
          <Text style={[styles.laterText, { fontFamily: langFonts.regular }]}>
            {t('REGISTRATION.IWILLDOTHISLATER', "I'll do this later")}
          </Text>
          <Text style={styles.laterChevron}>›</Text>
        </Pressable>
      </ScrollView>

      {/* Gallery access explainer — Angular's STORAGE_SETTINGS bottom sheet,
          shown before requesting permission (2nd tap / type '6'). */}
      <GalleryAccessSheet
        visible={accessSheetVisible}
        onAllow={handleAllowGalleryAccess}
        onClose={handleAccessSheetDismissed}
      />

      {/* Escalated variant — Angular's type '5', shown on the 3rd+ tap. */}
      <GallerySettingsSheet
        visible={settingsSheetVisible}
        onClose={() => setSettingsSheetVisible(false)}
      />

      {/* Photo picker presented as an overlay on this same page — Angular:
          the OS file-picker pops directly over the current page, then this
          page is left/replaced only once a photo is actually chosen. */}
      <Modal
        visible={galleryVisible}
        animationType="slide"
        onRequestClose={() => setGalleryVisible(false)}
        presentationStyle="fullScreen"
      >
        <CustomGalleryScreen
          navigation={navigation}
          route={{ params: {} }}
          onClose={() => setGalleryVisible(false)}
          onUploaded={() => {
            setGalleryVisible(false)
            navigation.push('onboarding', { pageNo: '21' })
          }}
        />
      </Modal>

      {/* Web only — hidden file input IS the picker, triggered directly from
          handleAllowGalleryAccess (see webFileInputRef above). */}
      {Platform.OS === 'web' && (
        // @ts-ignore — raw DOM element, react-native-web only
        <input
          ref={webFileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
          onChange={handleWebFiles}
        />
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical:   24,
    alignItems:        'center',
    // Angular: registration-revamp's page wrapper has
    // "height100 ... d-flex align-center-item" (align-items:center !important
    // on a full-height flex column) — the photo/title/card block is vertically
    // centered when it's shorter than the viewport. flexGrow (not minHeight)
    // is used so the ScrollView still measures real overflow and keeps
    // scrolling on shorter screens / larger fonts.
    flexGrow:          1,
    justifyContent:    'center',
  },

  photoAreaWrapper: {
    alignItems:    'center',
    marginBottom:  24,
  },
  photoArea: {
    width:    180,
    height:   200,
    overflow: 'hidden',
    alignItems:      'center',
    justifyContent:  'center',
  
  },
  silhouette: {
    width:  '100%',
    height: '100%',
  },

  title: {
    fontSize:      24,
    fontWeight:    '700',
    color:         Colors.textPrimary,
    lineHeight:    32,
    textAlign:     'center',
    marginBottom:  24,
    
  },

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
    shadowOpacity:     0.12,
    shadowOffset:      { width: 0, height: 2 },
    shadowRadius:      8,
    elevation:         3,
    
  },
  cardIntro: {
    fontSize:   15,
    fontWeight: '400',
    color:      Colors.textPrimary,
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
    fontSize:   16,
    fontWeight: '500',
    color:      Colors.textPrimary,
    lineHeight: 20,
  },

  addBtn: {
    height:          52,
    backgroundColor: Colors.primaryDark,
    borderRadius:    8,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       4,
  },
  addBtnDisabled: {
    opacity: 0.6,
  },
  addBtnLabel: {
    // Angular: app-button-revamp's span uses "body2-regular-14" — 14px regular.
    fontSize:   15,
    fontWeight: '400',
    color:      Colors.white,
  },

  laterRow: {
    // Angular: "mt-32 pl-24 pr-24 d-flex justify-content-center" — in-flow
    // below the card, not a fixed footer bar.
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    marginTop:         32,
    paddingHorizontal: 24,
    gap:               4,
  },
  laterText: {
    fontSize:   15,
    color:      '#333333',
  },
  laterChevron: {
    fontSize:   18,
    color:      '#333333',
    lineHeight: 22,
  },
})
