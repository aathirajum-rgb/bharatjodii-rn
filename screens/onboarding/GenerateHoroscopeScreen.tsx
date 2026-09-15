import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import GalleryAccessSheet from '../../components/gallery-access-sheet/GalleryAccessSheet'
import GallerySettingsSheet from '../../components/gallery-access-sheet/GallerySettingsSheet'
import { Colors } from '../../constants/colors'
import { FontSize } from '../../src/theme/fonts'
import { getRegValue, uploadHoroscopeFile } from '../../service/registrationService'
import { requestStoragePermission } from '../../service/permissionService'
import { getPhotoConfig, getRejectReasons, describeRejection } from '../../service/photoValidationService'
import { getItem, setItem } from '../../service/storageService'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { CDN_IMG, CDN_LOTTIE } from '../../constants/cdn'
import CdnLottie from '../../components/CdnLottie'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { os } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────
// Angular pageType 29 — "Generate Horoscope" prompt. The zodiac-wheel
// illustration is a PNG (not one of the standard svg/registration-new page
// icons every other onboarding screen uses) — registration-revamp.component.html's
// horoscope-img-center block: assets/images/png/registration-new/horoscope-revamp.png.
const CDN_ILLUSTRATION = CDN_IMG + 'png/registration-new/horoscope-revamp.png'
// Angular's .horoscope-image class: min-width/min-height: 77.77vmin — nearly
// fills the viewport's shorter dimension, not a small fixed icon.
const ILLUSTRATION_SIZE = Math.round(Dimensions.get('window').width * 0.7777)

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GenerateHoroscopeScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation()
  const langFonts = useLanguageFonts()

  const [createdBy, setCreatedBy] = useState('4')
  const [uploading,  setUploading]   = useState(false)

  // Gallery permission escalation sheets — same STG_PERMISSION_COUNT pattern
  // as AddPhotoScreen, shown with variant="horoscope" so the copy matches
  // HORO_STORAGE_SETTINGS instead of the generic add-photo wording.
  const [accessSheetVisible,   setAccessSheetVisible]   = useState(false)
  const [settingsSheetVisible, setSettingsSheetVisible] = useState(false)

  useEffect(() => {
    getRegValue('CREATEDBY').then(cb => { if (cb) setCreatedBy(cb) })
  }, [])

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.GENERATEHOROSCOPE', 'Generate #PROFILETYPE# horoscope')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  // Angular config (registration.config.ts, page 29): SUBTITLE is
  // HOROSCOPESUBTITLE — "Please give your time of birth and location to
  // generate free horoscope". GENERATEHOROSCOPESUBTITLE is a DIFFERENT
  // string ("You have already provided your date of birth") that belongs to
  // page 30 (HOROSTATE) — this screen was wrongly using that key.
  const subtitle = t(
    'REGISTRATION.HOROSCOPESUBTITLE',
    'Please give your #PROFILETYPE# time of birth and location to generate free horoscope',
  )
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  // Primary CTA → birth-details step (30). Skip → straight to Dosham (32),
  // matching Angular's onBoardingSkip['29'] exactly (the whole horoscope
  // sub-flow, including Star/Raasi, is skippable as one unit).
  function handleNext() {
    navigation.push('onboarding', { pageNo: '30' })
  }

  function handleSkip() {
    navigation.push('onboarding', { pageNo: '32' })
  }

  // Angular: clickOnLinkBtn() for currentPageType '29' calls
  // callNative('horoscope_from_phone') DIRECTLY — there is no phone/camera
  // options popup for this entry point (ModalpopupComponent's 'uploadHoro'
  // sheet is dead code here; uploadHoroscope() is commented out). It goes
  // straight into the gallery-permission flow below.
  function handleUploadHoroscope() {
    pickAndUpload()
  }

  // Angular: uploadHoroSuccess() (registration-revamp.component.ts) — sets
  // HOROSCOPEAVAILABLE and moves straight to the Star/Raasi step, skipping
  // the manual birth-details/time entry entirely since the horoscope is
  // already fully provided via the uploaded file. Angular's own page numbering
  // differs from this RN port's; RN's equivalent of Angular's "onboarding/26"
  // (STARRASSI) is pageNo '33' (see AppStack.tsx's page-number map).
  async function goToStarRaasiAfterUpload() {
    navigation.push('onboarding', { pageNo: '33' })
  }

  // Angular: Filehandler.openFilePicker('uploadhoroscope', ..., 'image/*', false)
  // — a plain <input type=file accept="image/*">, no crop step (unlike profile
  // photos). uploadHoroscopeFile() mirrors the multipart POST + success flag.
  async function uploadPickedAsset(uri: string) {
    setUploading(true)
    try {
      const ok = await uploadHoroscopeFile(uri)
      if (ok) {
        await goToStarRaasiAfterUpload()
      } else {
        Alert.alert('Something went wrong', 'Could not upload horoscope. Please try again.')
      }
    } catch {
      Alert.alert('Something went wrong', 'Could not upload horoscope. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  // Every other photo-upload site in the app runs the picked asset through
  // photoValidationService's size/format gate first — this one previously
  // sent whatever the picker returned straight to the server with no check
  // at all. Only size/format apply here (not validatePhotoAsset's full
  // gate) — a horoscope is a birth-chart image, not a profile photo, so the
  // minimum-resolution and face-detection checks don't apply and would
  // wrongly reject a legitimate horoscope scan.
  async function launchLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    const config = await getPhotoConfig()

    if (asset.fileSize != null && asset.fileSize > config.maximumPhotoSize) {
      const reasons = await getRejectReasons()
      Alert.alert('Photo not uploaded', describeRejection('ALERT_FILE_SIZE_EXCEEDED', reasons))
      return
    }
    if (asset.mimeType) {
      const format = asset.mimeType.split('/')[1]?.toUpperCase()
      if (!format || !config.allowedFormats.includes(format)) {
        const reasons = await getRejectReasons()
        Alert.alert('Photo not uploaded', describeRejection('ALERT_INCORRECT_FILE_FORMAT', reasons))
        return
      }
    }

    await uploadPickedAsset(asset.uri)
  }

  // Angular: common.ts's callNative('horoscope_from_phone') — the
  // STG_PERMISSION_COUNT escalation (same as AddPhotoScreen's openGallery()):
  //   1st tap (_cnt==0): native OS popup only (NATIVE) / GalleryAccessSheet (WEB)
  //   2nd tap (_cnt==1): GalleryAccessSheet (type '6')
  //   3rd+ tap (_cnt>=2): GallerySettingsSheet (type '5')
  // both sheets shown with variant="horoscope" for the HORO_STORAGE_SETTINGS copy.
  async function pickAndUpload() {
    if (Platform.OS !== 'web') {
      const { getPermissionsAsync } = await import('expo-media-library')
      const { status } = await getPermissionsAsync()
      if (status === 'granted') {
        await launchLibrary()
        return
      }

      const raw = await getItem(SK.App.STG_PERMISSION_COUNT)
      const cnt = raw ? parseInt(raw, 10) || 0 : 0

      if (cnt === 0) {
        await setItem(SK.App.STG_PERMISSION_COUNT, '1')
        await launchLibrary()
        return
      }

      if (cnt === 1) {
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

  // GalleryAccessSheet (type '6') dismissed — Angular advances
  // STG_PERMISSION_COUNT here, on dismiss, regardless of which button was used.
  function handleAccessSheetDismissed() {
    setAccessSheetVisible(false)
    setItem(SK.App.STG_PERMISSION_COUNT, '2')
  }

  // "Allow gallery access" tapped (type '6' sheet).
  function handleAllowGalleryAccess() {
    handleAccessSheetDismissed()
    requestStoragePermission().then(permission => {
      if (permission === 'granted') launchLibrary()
    })
  }

  // Angular: SHOWLINKBTN renders "Upload horoscope" ABOVE the primary CTA,
  // inside the shared otp-cta footer block — not inside the screen's own
  // scrollable content — so it's wired through the shell's link-button slot
  // (AppStack.tsx) instead of rendered here.
  useOnboardingFooter({
    nextLabel: t('REGISTRATION.GENERATEHOROSCOPECTA', 'Generate horoscope for FREE'),
    onNext:    handleNext,
    showSkip:  true,
    skipLabel: t('REG.DO_LATER', "I'll do this later"),
    onSkip:    handleSkip,
    showLink:  true,
    linkLabel: t('REGISTRATION.UPLOADHOROSCOPECTA', 'Upload horoscope'),
    onLink:    handleUploadHoroscope,
    // i18n.language: all three labels are translated, so re-push footer state
    // on a language change — otherwise they keep the wording from mount time.
  }, [i18n.language])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{ uri: CDN_ILLUSTRATION }}
          style={styles.illustration}
          contentFit="contain"
        />

        {/* Angular's page-29 title/subtitle use mt-32/mt-8 (registration-revamp.component.html) —
            an 8px gap, not the shared os.title's 32px marginBottom every other onboarding
            screen uses. Override it locally here to match. */}
        <Text style={[os.title, styles.title, styles.centered, { fontFamily: langFonts.semiBold }]}>{title}</Text>
        <Text style={[styles.subtitle, { fontFamily: langFonts.regular }]}>{subtitle}</Text>
      </ScrollView>

      {/* Angular: no phone/camera options popup for this entry point —
          clickOnLinkBtn() calls callNative('horoscope_from_phone') straight
          away, which just shows the native "uploading…" state while the
          picked file posts. */}
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} />
        </View>
      )}

      {/* Gallery permission escalation — Angular's AutoStartComponent
          action='enableStorage', shown with the HORO_STORAGE_SETTINGS copy. */}
      <GalleryAccessSheet
        visible={accessSheetVisible}
        variant="horoscope"
        onAllow={handleAllowGalleryAccess}
        onClose={handleAccessSheetDismissed}
      />
      <GallerySettingsSheet
        visible={settingsSheetVisible}
        variant="horoscope"
        onClose={() => setSettingsSheetVisible(false)}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  illustration: {
    width:        ILLUSTRATION_SIZE,
    height:       ILLUSTRATION_SIZE,
    alignSelf:    'center',
    marginBottom: 24,
  },
  centered: {
    textAlign: 'center',
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    fontSize:   FontSize.font14,
    fontWeight: '400',
    color:      Colors.black,
    textAlign:  'center',
  },

  // ── Upload-horoscope in-flight indicator (no popup in Angular for this
  // entry point — see handleUploadHoroscope) ──
  uploadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
})
