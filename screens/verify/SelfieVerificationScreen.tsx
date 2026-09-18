// Angular: pages/selfie-verification/selfie-verification.component.ts (423
// lines) — a live getUserMedia + <canvas> camera view with face-api.js face
// framing. That framing is confirmed cosmetic-only in the source (the
// face-score gate on the capture button, `captureBtnEnable = detection.score
// > 0.5`, is commented out and never enforced) so it isn't replicated here.
// This screen uses expo-image-picker's launchCameraAsync (the OS camera app)
// instead of an embedded live view, matching every other capture screen in
// this app (CustomGalleryScreen.tsx, DeleteProfileUploadPhotoScreen.tsx,
// VerifyIdScreen.tsx) rather than introducing a new pattern.
//
// Deliberately out of scope (documented, not silently dropped):
//   - The "liveliness" sub-flow (tips screen, separate success bottom-sheet
//     auto-navigating to Matches) — a distinct entry path not reachable from
//     BlockerScreen, this port's only caller.
//   - The '/fup-verify'-specific DOCNAME suffix ('~NAME~0~mobile~FUP') and the
//     legacy EKYCStatus() global-bridge push — both tied to flows this port
//     doesn't implement (BlockerScreen.tsx only implements '/blockerpage').
//   - Attempt-limit/cooldown UI — that lives entirely in BlockerScreen.tsx
//     (SELFIEATTEMPT), nothing to add here.
import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { handleBack } from '../../utils/navigationRef'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import CdnLottie from '../../components/CdnLottie'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { CDN_REACT, CDN_LOTTIE } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { apiCall, uploadFile } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { requestCameraPermission } from '../../service/permissionService'
import { snapshotWebFile } from '../../utils/webFileSnapshot'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

type Step = 'idle' | 'preview' | 'uploading' | 'failed'

export default function SelfieVerificationScreen({ navigation: _navigation }: { navigation: any }) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [step, setStep] = useState<Step>('idle')
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function openCamera() {
    const permission = await requestCameraPermission()
    if (permission !== 'granted') return

    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      quality: 0.85,
    })
    if (result.canceled || !result.assets[0]) return

    setPhotoUri(result.assets[0].uri)
    // Snapshotted immediately, not held as a live reference — this screen
    // always shows a preview step before confirmAndUpload, and that delay is
    // exactly what triggers iOS Safari's 0-byte-upload bug for a picker File
    // (see webFileSnapshot.ts).
    const file = result.assets[0].file
    setPhotoFile(file ? await snapshotWebFile(file) : null)
    setStep('preview')
  }

  function retake() {
    setPhotoUri(null)
    setPhotoFile(null)
    setStep('idle')
    openCamera()
  }

  async function confirmAndUpload() {
    if (!photoUri) return
    setStep('uploading')

    const [userId, gender, mcode] = await Promise.all([
      getItem(SK.Auth.USER_ID),
      getItem(SK.User.LOGIN_GENDER),
      getItem(SK.User.MEMBER_CODE),
    ])

    const formData = new FormData()
    formData.append('ID', userId ?? '')
    formData.append('DOCPAGE', 'front')
    formData.append('INVOID', '1')
    formData.append('DOCNAME', 'selfie')
    if (Platform.OS === 'web' && photoFile) {
      formData.append('UPLOADPHOTO', photoFile, photoFile.name)
    } else {
      const filename = photoUri.split('/').pop() ?? 'selfie.jpg'
      const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
      formData.append('UPLOADPHOTO', { uri: photoUri, name: filename, type: mime } as any)
    }

    await uploadFile(Endpoints.media.addTrustBadge, formData)

    // The upload response is just an ack, not the verification result — the
    // real pass/fail comes from polling idProofData afterward (same pattern
    // VerifyIdScreen.tsx uses for its own upload step).
    const pollParams = `ID=${userId ?? ''}&LOGINGENDER=${gender ?? ''}&MCODE=${mcode ?? '91'}&ADDRESSPROOFTYPE=selfie&TYPE=UPLOAD&ERRMSG=1`
    const res = await apiCall(Endpoints.communication.idProofData, 'POST', pollParams)
    const selfieAdded = String(res?.RESPONSE?.SELFIEADDED ?? '0')

    if (selfieAdded === '1') {
      handleBack()
    } else {
      setErrorMsg(String(res?.RESPONSE?.EKYCMSG ?? '').split('~')[0] || t('VERIFY_ID.SELFIE_VERIFY_TXT', 'Selfie verification unsuccessful'))
      setStep('failed')
    }
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('VERIFY_ID.SELFIE_VERIFICATION', 'Selfie verification')}</Text>
      </View>

      {(step === 'idle') && (
        <View style={[s.content, { paddingBottom: insets.bottom }]}>
          <Text style={s.heading}>{t('VERIFY_BLOCKER.TAKE_SELFIE', 'Take a selfie')}</Text>
          <Text style={s.tip}>{`•  ${t('VERIFY_ID.GOOD_LIGHT', 'Make sure you are in a good light')}`}</Text>
          <Text style={s.tip}>{`•  ${t('VERIFY_ID.HOLD_PHONE', 'Hold your phone at eye level and look straight in the camera')}`}</Text>
          <ButtonRevamp
            label={t('VERIFY_ID.TAKE_SELFIE', 'Take selfie')}
            variant="primary" size="standard" fullWidth
            onPress={openCamera}
            style={s.ctaSpacing}
          />
        </View>
      )}

      {(step === 'preview' || step === 'uploading') && !!photoUri && (
        <View style={s.previewWrap}>
          <Image source={{ uri: photoUri }} style={s.previewImage} contentFit="cover" />

          {step === 'uploading' ? (
            <View style={s.uploadingOverlay}>
              <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} />
              <Text style={s.uploadingText}>{t('VERIFY_ID.VERIFY_DETAILS_TXT', 'Please wait, We are verifying your details')}</Text>
            </View>
          ) : (
            <View style={[s.previewActions, { paddingBottom: insets.bottom + 16 }]}>
              <Pressable style={s.previewIconBtn} onPress={retake} accessibilityRole="button" accessibilityLabel="Retake">
                <Text style={s.previewIconText}>{t('VERIFY_ID.TRY_AGAIN', 'Retake')}</Text>
              </Pressable>
              <ButtonRevamp
                label={t('GENERAL.SUBMIT', 'Use this photo')}
                variant="primary" size="standard"
                onPress={confirmAndUpload}
              />
            </View>
          )}

          <Pressable style={[s.closeBtn, { top: insets.top + 8 }]} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={s.closeIcon}>{'✕'}</Text>
          </Pressable>
        </View>
      )}

      {step === 'failed' && (
        <View style={[s.content, { paddingBottom: insets.bottom }]}>
          <Text style={s.heading}>{t('VERIFY_ID.SELFIE_VERIFY_FAILED', 'Selfie Verification failed !')}</Text>
          <Text style={s.tip}>{errorMsg}</Text>
          <ButtonRevamp
            label={t('VERIFY_ID.TRY_AGAIN', 'Try again')}
            variant="primary" size="standard" fullWidth
            onPress={retake}
            style={s.ctaSpacing}
          />
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  headerTitle: { flex: 1, fontSize: FontSize.font16, fontFamily: SemanticFontsEnglish.headingEnglishMedium, color: '#333333', marginLeft: 6, marginRight: 16 },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  heading: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font18, color: Colors.textPrimary, marginBottom: 16 },
  tip: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 8 },
  ctaSpacing: { marginTop: 24 },

  previewWrap: { flex: 1, backgroundColor: Colors.black },
  previewImage: { flex: 1, width: '100%' },

  closeBtn: {
    position: 'absolute', left: 16,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeIcon: { color: Colors.white, fontSize: FontSize.font16, fontWeight: '700' },

  previewActions: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  previewIconBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  previewIconText: { color: Colors.white, fontSize: FontSize.font14, fontWeight: '600' },

  uploadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 16,
  },
  uploadingText: { color: Colors.white, fontSize: FontSize.font14, textAlign: 'center', paddingHorizontal: 32 },
})
