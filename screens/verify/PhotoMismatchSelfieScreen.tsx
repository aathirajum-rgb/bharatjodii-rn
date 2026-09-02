// AI photo validation — selfie verification sub-flow, reached when
// pollPhotoValidation() (service/photoValidationService.ts) returns
// isSelfieRequired (Android: PhotoUploadProcessViewModel's VerifySelfie
// state — a suspected AI-generated/celebrity photo needs a live selfie to
// confirm the uploader is a real match for their own profile photos).
//
// Angular reference: selfie-verification.component.ts's post-capture call is
// afterSelfiVerifyApiCall('profilepicval') — the SAME verdict endpoint
// pollPhotoValidation() already hits, just re-run against the freshly
// captured selfie's photo id. So this screen uploads the selfie exactly like
// any other profile photo (addProfilePic) and re-polls, instead of needing a
// new endpoint.
//
// Camera capture reuses the OS-camera-app pattern (expo-image-picker's
// launchCameraAsync) already used by SelfieVerificationScreen.tsx and every
// other capture screen in this app, rather than Figma's live in-app
// camera-preview mockup — see this screen's PR discussion for that tradeoff.
import { useEffect, useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { handleBack } from '../../utils/navigationRef'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import CdnLottie from '../../components/CdnLottie'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { CDN_SVG, CDN_REACT, CDN_LOTTIE } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { apiCall, uploadFile } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { requestCameraPermission } from '../../service/permissionService'
import { pollPhotoValidation } from '../../service/photoValidationService'

const ICONS = {
  back:    CDN_REACT + '/menu_back_arrow.svg',
  alert:   CDN_SVG + 'triangle-alert-outline.svg',
  check:   CDN_SVG + 'icon-check-green.svg',
  camera:  CDN_SVG + 'icon-camerapink.svg',
  // Not call-white.svg (CDN + 'call-white.svg', used elsewhere in VerifyIdScreen)
  // — that's a white glyph meant for a dark/colored surface; this row sits on
  // a plain white background, so the white variant renders invisible here.
  call:    CDN_SVG + 'icon-call-black.svg',
}

type Step = 'prompt' | 'preview' | 'uploading' | 'success' | 'mismatch' | 'failed'

type Props = {
  navigation?: any
  route?: { params?: { onDonePageNo?: string; standalone?: boolean } | undefined } | undefined
}

export default function PhotoMismatchSelfieScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const onDonePageNo = route?.params?.onDonePageNo ?? '21'
  const standalone   = route?.params?.standalone

  const [step, setStep] = useState<Step>('prompt')
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [existingThumbs, setExistingThumbs] = useState<string[]>([])
  const [mismatchReason, setMismatchReason] = useState<string | null>(null)
  // Angular/BlockerScreen.tsx: the support number is server-driven (CUSTOMER-CARE),
  // never hardcoded — Figma's "0123456789" is placeholder mockup data.
  const [customerCare, setCustomerCare] = useState('')

  useEffect(() => {
    getItem(SK.App.CUSTOMER_CARE).then(cc => { if (cc) setCustomerCare(cc) })
    getItem(SK.Auth.USER_ID).then(userId => {
      if (!userId) return
      apiCall(Endpoints.profile.managePhoto, 'POST', `ID=${userId}`).then(res => {
        const photos = res?.RESPONSE?.PHOTOS
        if (Array.isArray(photos)) {
          setExistingThumbs(
            photos.slice(0, 4).map((p: any) => p.PHOTOTHUMB || p.PHOTOURL).filter(Boolean),
          )
        }
      }).catch(() => {})
    })
  }, [])

  function callCustomerSupport() {
    if (customerCare) Linking.openURL(`tel:${customerCare}`)
  }

  function continueOnboarding() {
    if (standalone) { handleBack(); return }
    navigation.push('onboarding', { pageNo: onDonePageNo, standalone })
  }

  function goToMatches() {
    navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  async function openCamera() {
    const permission = await requestCameraPermission()
    if (permission !== 'granted') return

    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      quality: 0.85,
    })
    if (result.canceled || !result.assets[0]) return

    setPhotoUri(result.assets[0].uri)
    setStep('preview')
  }

  function retake() {
    setPhotoUri(null)
    setMismatchReason(null)
    setStep('prompt')
    openCamera()
  }

  async function confirmAndUpload() {
    if (!photoUri) return
    setStep('uploading')

    try {
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      const filename = photoUri.split('/').pop() ?? 'selfie.jpg'
      const ext  = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg'

      const formData = new FormData()
      formData.append('ID', userId)
      formData.append('AIVALIDATE', '1')
      formData.append('UPLOADPHOTO', { uri: photoUri, name: filename, type: mime } as any)

      const uploadRes = await uploadFile(Endpoints.media.addProfilePic, formData)
      const selfiePhotoId = uploadRes?.RESPONSE?.PHOTOID ? String(uploadRes.RESPONSE.PHOTOID) : null

      if (uploadRes?.RESPONSECODE != 1 || !selfiePhotoId) {
        setStep('failed')
        return
      }

      const verdict = await pollPhotoValidation([selfiePhotoId])
      if (!verdict) {
        setStep('failed')
        return
      }

      const result = verdict.results.find(r => r.photoId === selfiePhotoId) ?? verdict.results[0]
      if (result?.status.toLowerCase() === 'approve') {
        setStep('success')
      } else {
        setMismatchReason(result?.reason?.subtitle ?? result?.reason?.title ?? null)
        setStep('mismatch')
      }
    } catch {
      setStep('failed')
    }
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {step === 'prompt' && (
        <>
          <View style={s.header}>
            <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
              <CdnSvg uri={ICONS.back} width={24} height={24} />
            </Pressable>
          </View>

          <View style={s.content}>
            <CdnSvg uri={ICONS.alert} width={56} height={56} style={s.warningIcon} />
            <Text style={s.heading}>{t('VERIFY_BLOCKER.VERIFY_IDENTITY', 'Verify your identity!')}</Text>
            <Text style={s.tip}>
              {t('VERIFY_BLOCKER.KEEP_USING_PLATFORM', "To keep using our platform, we need to make sure it's really you. Please verify by taking a selfie")}
            </Text>

            <View style={[s.statusRow, s.statusRowDone]}>
              <CdnSvg uri={ICONS.check} width={24} height={24} />
              <Text style={s.statusLabel}>{t('VERIFY_BLOCKER.PHOTOS_ADDED', 'Photos added')}</Text>
              <View style={s.facepileRow}>
                {existingThumbs.map((uri, i) => (
                  <Image key={uri + i} source={{ uri }} style={[s.facepileImg, i > 0 && s.facepileOverlap]} contentFit="cover" />
                ))}
              </View>
            </View>

            <Pressable style={[s.statusRow, s.statusRowAction]} onPress={openCamera}>
              <CdnSvg uri={ICONS.camera} width={24} height={24} />
              <Text style={s.statusLabel}>{t('VERIFY_BLOCKER.TAKE_SELFIE', 'Take a selfie')}</Text>
              <Text style={s.chevron}>›</Text>
            </Pressable>

            {!!customerCare && (
              <Pressable style={s.helpRow} onPress={callCustomerSupport}>
                <CdnSvg uri={ICONS.call} width={16} height={16} />
                <Text style={s.helpText}>
                  {t('VERIFY_BLOCKER.NEED_HELP_1', 'Need Help?')}{'  '}{customerCare}
                </Text>
              </Pressable>
            )}
          </View>

          <Pressable style={[s.laterRow, { paddingBottom: Math.max(insets.bottom, 24) }]} onPress={continueOnboarding}>
            <Text style={s.laterText}>{t('VERIFY_ID.LBL_DO_LATER', "I'll do this later")}</Text>
          </Pressable>
        </>
      )}

      {(step === 'preview' || step === 'uploading') && !!photoUri && (
        <View style={s.previewWrap}>
          <Image source={{ uri: photoUri }} style={s.previewImage} contentFit="cover" />

          {step === 'uploading' ? (
            <View style={s.uploadingOverlay}>
              <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} loop style={s.uploadingLottie} />
              <Text style={s.uploadingText}>{t('AI_PHOTO_VALIDATION.VERIFYING_SELFIE', 'Please wait, we are verifying your selfie!')}</Text>
            </View>
          ) : (
            <View style={[s.previewActions, { paddingBottom: insets.bottom + 16 }]}>
              <Pressable style={s.previewIconBtn} onPress={retake} accessibilityRole="button" accessibilityLabel="Retake">
                <Text style={s.previewIconText}>{t('AI_PHOTO_VALIDATION.RETAKE', 'Retake')}</Text>
              </Pressable>
              {/* Angular/SelfieVerificationScreen.tsx: GENERAL.SUBMIT resolves to
                  "Submit" in the live locale files, not this fallback — kept
                  consistent with that existing screen's own copy. */}
              <ButtonRevamp label={t('GENERAL.SUBMIT', 'Use this photo')} variant="primary" size="standard" onPress={confirmAndUpload} />
            </View>
          )}

          <Pressable style={[s.closeBtn, { top: insets.top + 8 }]} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={s.closeIcon}>{'✕'}</Text>
          </Pressable>
        </View>
      )}

      {step === 'success' && (
        <View style={s.content}>
          <CdnLottie uri={CDN_LOTTIE + 'success-new.json'} width={80} height={80} loop={false} />
          <Text style={s.heading}>{t('AI_PHOTO_VALIDATION.VERIFICATION_COMPLETED', 'Verification completed!')}</Text>
          <Text style={s.tip}>{t('AI_PHOTO_VALIDATION.VERIFICATION_COMPLETED_BODY', 'Your profile is verified. You can start viewing matches')}</Text>
          <ButtonRevamp label={t('VERIFY_BLOCKER.GOTOMATCHES', 'Go to matches')} variant="primary" size="standard" fullWidth onPress={goToMatches} style={s.ctaSpacing} />
        </View>
      )}

      {step === 'mismatch' && (
        <View style={s.content}>
          <CdnSvg uri={ICONS.alert} width={56} height={56} style={s.warningIcon} />
          <Text style={s.heading}>{t('AI_PHOTO_VALIDATION.PROFILE_PHOTO_MISMATCH', 'Profile photo mismatch')}</Text>
          <Text style={s.tip}>{mismatchReason ?? t('AI_PHOTO_VALIDATION.MISMATCH_BODY', 'Upload a real photo of yourself to complete verification.')}</Text>
          <ButtonRevamp label={t('AI_PHOTO_VALIDATION.ADD_NEW_PHOTO', 'Add new photo')} variant="primary" size="standard" fullWidth onPress={retake} style={s.ctaSpacing} />
          <Pressable style={s.laterRowInline} onPress={continueOnboarding}>
            <Text style={s.laterText}>{t('VERIFY_ID.LBL_DO_LATER', "I'll do this later")}</Text>
          </Pressable>
        </View>
      )}

      {step === 'failed' && (
        <View style={s.content}>
          <CdnSvg uri={ICONS.alert} width={56} height={56} style={s.warningIcon} />
          <Text style={s.heading}>{t('VERIFY_ID.SELFIE_VERIFY_FAILED', 'Selfie Verification failed !')}</Text>
          <Text style={s.tip}>{t('AI_PHOTO_VALIDATION.SELFIE_PHOTO_MISMATCH', 'Photo mismatch')}</Text>
          <ButtonRevamp label={t('VERIFY_ID.TRY_AGAIN', 'Try again')} variant="primary" size="standard" fullWidth onPress={retake} style={s.ctaSpacing} />
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  warningIcon: { marginBottom: 16 },
  heading: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  tip: { fontSize: 14, color: Colors.textDark, lineHeight: 20, marginBottom: 24 },
  ctaSpacing: { marginTop: 24 },

  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 8, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 16,
  },
  statusRowDone: { backgroundColor: 'rgba(230,244,239,0.5)' },
  statusRowAction: {
    backgroundColor: 'rgba(249,230,235,0.5)',
    borderWidth: 1, borderColor: 'rgba(181,0,51,0.2)',
  },
  statusLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  chevron: { fontSize: 20, color: Colors.textDark },

  facepileRow: { flexDirection: 'row' },
  facepileImg: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: Colors.white,
    backgroundColor: Colors.surfaceDim,
  },
  facepileOverlap: { marginLeft: -8 },

  helpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  helpText: { fontSize: 13, color: Colors.link },

  laterRow: { alignItems: 'center', paddingTop: 8 },
  laterRowInline: { alignItems: 'center', marginTop: 16 },
  laterText: { fontSize: 14, color: Colors.textDark },

  previewWrap: { flex: 1, backgroundColor: Colors.black },
  previewImage: { flex: 1, width: '100%' },

  closeBtn: {
    position: 'absolute', left: 16,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeIcon: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  previewActions: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  previewIconBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  previewIconText: { color: Colors.white, fontSize: 14, fontWeight: '600' },

  uploadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 16,
  },
  uploadingLottie: { opacity: 0.9 },
  uploadingText: { color: Colors.white, fontSize: 16, fontWeight: '600', textAlign: 'center', paddingHorizontal: 32 },
})
