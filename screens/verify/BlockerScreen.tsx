// Angular: pages/blockerpage/blockerpage.component.ts(+.html+.scss) — the
// "Jodii Fraud blocker" page (webview.page.ts's page_id "51"). Angular's
// component is shared between two routes ('/blockerpage' and '/fup-verify');
// this only implements the '/blockerpage' (fraud-blocker) side — routePage is
// effectively hardcoded to that value throughout, which is why isFUPVerify()
// and the '/fup-verify' back-button/header branch aren't ported.
//
// "Take a selfie", "Verify with a Govt ID", "Upload Photo", and "Contact
// Customer Support" are all fully functional.

import { useCallback, useState } from 'react'
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import CdnLottie from '../../components/CdnLottie'
import { Colors } from '../../constants/colors'
import { CDN, CDN_SVG, CDN_LOTTIE } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { apiCall } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { useAddPhotoPicker } from '../../hooks/useAddPhotoPicker'
import WebPhotoInput from '../../components/add-photo/WebPhotoInput'
import AddPhotoVerdictSheets from '../../components/add-photo/AddPhotoVerdictSheets'
import { FontSize } from '../../src/theme/fonts'
import ScreenTopInset from '../../components/screen/ScreenTopInset'

const ICONS = {
  header:   CDN_SVG + 'updated-images/verify-your-identity-img-updated.svg',
  gallery:  CDN_SVG + 'gallery-id-revamp.svg',
  camera:   CDN_SVG + 'camera-id-revamp.svg',
  cameraOff:CDN_SVG + 'selfie-verification-camera-deactive.svg',
  success:  CDN_SVG + 'selfie-verification-successful.svg',
  failed:   CDN_SVG + 'selfie-verification-unsuccessful.svg',
  needHelp: CDN_SVG + 'need-help-circle-question-img.svg',
  callIcon: CDN + 'call-white.svg',
}

interface IdProofAttempt {
  SELFIEATTEMPT?:     string
  GOVTPROOFATTEMPT?:  string
}

export default function BlockerScreen({ navigation }: { navigation: any }) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [loading,        setLoading]        = useState(true)
  const [photoCount,     setPhotoCount]     = useState(0)
  // Angular: selfieBlockerStatus (RESPONSE.SELFIEADDED) — '0' none, '1' success,
  // anything else (e.g. '2'/'3') treated as a failed/rejected attempt.
  const [selfieStatus,   setSelfieStatus]   = useState('0')
  const [ekycStatus,     setEkycStatus]     = useState('0')
  const [fmsShowVerify,  setFmsShowVerify]  = useState('0')  // RESPONSE.FMSIDVERIFY
  const [fupDocShow,     setFupDocShow]     = useState('0')  // RESPONSE.FUPSTATUS — read regardless of route, matching Angular
  const [idProofAttempt, setIdProofAttempt] = useState<IdProofAttempt>({})
  const [customerCare,   setCustomerCare]   = useState('')

  // Web/PWA "Upload Photo" row — see hooks/useAddPhotoPicker.ts for why this
  // can't just navigate to the native-only 'Gallery' screen.
  const addPhoto = useAddPhotoPicker({
    onRejected: (msg) => Alert.alert('Some photos were not added', msg),
    onError: (msg) => Alert.alert('Error', msg),
  })

  // useFocusEffect (not a plain mount-only effect) so returning here after a
  // selfie/govt-ID attempt — or after uploading a photo via Gallery —
  // refreshes the status rows instead of showing stale pre-attempt state.
  useFocusEffect(
    useCallback(() => {
    let cancelled = false
    ;(async () => {
      const [userId, gender, mcode, cc, storedPhotoCount] = await Promise.all([
        getItem(SK.Auth.USER_ID),
        getItem(SK.User.LOGIN_GENDER),
        getItem(SK.User.MEMBER_CODE),
        getItem(SK.App.CUSTOMER_CARE),
        getItem('PHOTOCOUNT'),
      ])
      if (cancelled) return
      if (cc) setCustomerCare(cc)
      setPhotoCount(storedPhotoCount ? parseInt(storedPhotoCount, 10) || 0 : 0)

      // Angular verifyProofIDStatus(): isUpload=0 (initial load) always sends
      // ERRMSG=2 — the ERRMSG=1/RESENDOPTLIMIT branching only matters for the
      // post-upload retry flow (isUpload=1), which isn't built here yet.
      const params = `ID=${userId ?? ''}&LOGINGENDER=${gender ?? ''}&MCODE=${mcode ?? '91'}&ERRMSG=2`
      const result = await apiCall(Endpoints.communication.idProofData, 'POST', params)
      if (cancelled) return
      const resp = result?.RESPONSE
      if (resp) {
        if (resp.SELFIEADDED != null)     setSelfieStatus(String(resp.SELFIEADDED))
        if (resp.FMSIDVERIFY != null)     setFmsShowVerify(String(resp.FMSIDVERIFY))
        if (resp.FUPSTATUS != null)       setFupDocShow(String(resp.FUPSTATUS))
        if (resp.IDPROOFATTEMPT)          setIdProofAttempt(resp.IDPROOFATTEMPT)
        const ekyc = resp.EKYCSTATUS != null ? String(resp.EKYCSTATUS) : '0'
        // Angular: EKYCSTATUS==3 is stored back as 0 (only on the blocker route,
        // never on '/fup-verify' — which this screen always is).
        const storedEkyc = ekyc === '3' ? '0' : ekyc
        setEkycStatus(storedEkyc)
        await setItem('EKYCSTATUS', storedEkyc)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
    }, [])
  )

  // ── Derived — mirrors Angular's checkIdProofAttemptData()/isOptionShown() ──

  const selfieAttemptsLeft = Number(idProofAttempt.SELFIEATTEMPT ?? NaN)
  const govtAttemptsLeft   = Number(idProofAttempt.GOVTPROOFATTEMPT ?? NaN)

  const exhausted =
    (selfieAttemptsLeft <= 0 && selfieStatus !== '1') || govtAttemptsLeft <= 0

  const showUploadPhoto = photoCount === 0 && selfieStatus === '0'
  const showPhotoAdded  = photoCount > 0

  const showSelfieDeactive = photoCount === 0 && selfieStatus === '0'
  const showSelfieActive   = photoCount > 0 && selfieStatus === '0'
  const showSelfieFailed   = photoCount > 0 && !['0', '1'].includes(selfieStatus)
  const showSelfieSuccess  = photoCount > 0 && selfieStatus === '1'

  // Angular: isIdVerifyShow() = routePage=='/blockerpage' && fmsShowVerify=='1'
  // (always true here, since this screen only ever renders the blocker route)
  const showGovtIdSection  = fmsShowVerify === '1'
  const showGovtIdDeactive = (selfieStatus !== '1' || fupDocShow !== '1') && ekycStatus === '0'
  const showGovtIdActive   = photoCount > 0 && (selfieStatus === '1' || fupDocShow === '1') && ekycStatus === '0'
  const showGovtIdFailed   = photoCount > 0 && selfieStatus === '1' && !['0', '1'].includes(ekycStatus)

  function attemptsLeftText(count: number, type: 'selfie' | 'idVerify'): string {
    const n = Number.isFinite(count) ? count : 0
    const key = type === 'selfie'
      ? (n > 1 ? 'VERIFY_BLOCKER.ATTEMPTS_LEFT' : 'VERIFY_BLOCKER.ATTEMPT_LEFT')
      : (n > 1 ? 'VERIFY_BLOCKER.HAVE_ATTEMPTS_LEFT' : 'VERIFY_BLOCKER.HAVE_ATTEMPT_LEFT')
    return t(key).replace('#COUNT', String(n))
  }

  function callCustomerSupport() {
    if (customerCare) Linking.openURL(`tel:${customerCare}`)
  }

  function uploadPhoto() {
    addPhoto.openAddPhoto(navigation)
  }

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} />
      </View>
    )
  }

  return (
    <View style={[styles.screen, { paddingTop: 24, paddingBottom: insets.bottom + 16 }]}>
      <ScreenTopInset style={styles.topInsetAbsolute} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CdnSvg uri={ICONS.header} width="100%" height={160} />

        <Text style={styles.title}>
          {exhausted ? t('VERIFY_BLOCKER.VERIFY_EXHAUST') : t('VERIFY_BLOCKER.VERIFY_IDENTITY')}
        </Text>

        <Text style={styles.body}>
          {exhausted ? t('VERIFY_BLOCKER.REACH_CUSTOMER_SERVICE') : t('VERIFY_BLOCKER.KEEP_USING_PLATFORM')}
        </Text>

        {exhausted ? (
          <Pressable style={styles.supportBtn} onPress={callCustomerSupport}>
            <CdnSvg uri={ICONS.callIcon} width={20} height={20} />
            <Text style={styles.supportBtnText}>{t('VERIFY_BLOCKER.CONTACT_SUPPORT')}</Text>
          </Pressable>
        ) : (
          <>
            {/* ── Photo row ── */}
            {showUploadPhoto && (
              <Pressable style={[styles.row, styles.rowUpload]} onPress={uploadPhoto}>
                <CdnSvg uri={ICONS.gallery} width={28} height={28} />
                <Text style={styles.rowLabel}>{t('VERIFY_BLOCKER.UPLOAD_PROFILE_PHOTO')}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            )}
            {showPhotoAdded && (
              <View style={[styles.row, styles.rowSuccess]}>
                <CdnSvg uri={ICONS.success} width={28} height={28} />
                <Text style={styles.rowLabel}>{t('VERIFY_BLOCKER.PHOTOS_ADDED')}</Text>
              </View>
            )}

            {/* ── Selfie row ── */}
            {showSelfieDeactive && (
              <View style={[styles.row, styles.rowDeactive]}>
                <CdnSvg uri={ICONS.cameraOff} width={28} height={28} />
                <Text style={[styles.rowLabel, styles.rowLabelMuted]}>{t('VERIFY_BLOCKER.VERIFY_SELFIE')}</Text>
                <Text style={[styles.chevron, styles.chevronMuted]}>›</Text>
              </View>
            )}
            {showSelfieActive && (
              // Angular: onPress → openCamera() → '/selfie-verification'.
              <Pressable style={[styles.row, styles.rowUpload]} onPress={() => navigation.navigate('selfie-verification')}>
                <CdnSvg uri={ICONS.camera} width={28} height={28} />
                <Text style={styles.rowLabel}>{t('VERIFY_BLOCKER.TAKE_SELFIE')}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            )}
            {showSelfieFailed && (
              // Angular: caller-side clickOnTryAgainCTA() lets a failed
              // attempt retake the selfie the same way.
              <Pressable style={[styles.row, styles.rowFailed]} onPress={() => navigation.navigate('selfie-verification')}>
                <CdnSvg uri={ICONS.failed} width={28} height={28} />
                <View style={styles.rowTextCol}>
                  <Text style={styles.rowLabel}>{t('VERIFY_BLOCKER.SELFIE_UNSUCCESSFUL')}</Text>
                  <Text style={styles.attemptsText}>{attemptsLeftText(selfieAttemptsLeft, 'selfie')}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            )}
            {showSelfieSuccess && (
              <View style={[styles.row, styles.rowSuccess]}>
                <CdnSvg uri={ICONS.success} width={28} height={28} />
                <Text style={styles.rowLabel}>{t('VERIFY_BLOCKER.SELFIE_SUCCESSFULLY')}</Text>
              </View>
            )}

            {/* ── Govt ID row (only when the account is flagged for it) ── */}
            {showGovtIdSection && (
              <>
                {showGovtIdDeactive && (
                  <View style={[styles.row, styles.rowDeactive]}>
                    <CdnSvg uri={ICONS.cameraOff} width={28} height={28} />
                    <Text style={[styles.rowLabel, styles.rowLabelMuted]}>{t('VERIFY_BLOCKER.VERIFY_GOVT_PROOF')}</Text>
                    <Text style={[styles.chevron, styles.chevronMuted]}>›</Text>
                  </View>
                )}
                {showGovtIdActive && (
                  // Angular: onPress → verifyIdPage('1') → '/verify-id'.
                  <Pressable style={[styles.row, styles.rowUpload]} onPress={() => navigation.navigate('verify-id')}>
                    <CdnSvg uri={ICONS.camera} width={28} height={28} />
                    <Text style={styles.rowLabel}>{t('VERIFY_BLOCKER.VERIFY_GOVT_PROOF')}</Text>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                )}
                {showGovtIdFailed && (
                  <View style={[styles.row, styles.rowFailed]}>
                    <CdnSvg uri={ICONS.failed} width={28} height={28} />
                    <View style={styles.rowTextCol}>
                      <Text style={styles.rowLabel}>{t('VERIFY_BLOCKER.GOVT_ID_FAILED')}</Text>
                      <Text style={styles.attemptsText}>{attemptsLeftText(govtAttemptsLeft, 'idVerify')}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Need help footer — Angular shows a confirm popup before dialing;
          simplified here to dial directly. ── */}
      <Pressable style={styles.helpRow} onPress={callCustomerSupport}>
        <CdnSvg uri={ICONS.needHelp} width={18} height={18} />
        <Text style={styles.helpText}>
          {t('VERIFY_BLOCKER.NEED_HELP_1')}{'  '}
          <Text style={styles.helpLink}>{t('VERIFY_BLOCKER.CUSTOMER_SUPPORT')}</Text>
        </Text>
      </Pressable>
      <WebPhotoInput inputRef={addPhoto.webInputRef} onChange={addPhoto.handleWebFiles} />
      <AddPhotoVerdictSheets addPhoto={addPhoto} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: Colors.surface,
    paddingHorizontal: 24,
  },
  // screen carries paddingHorizontal:24 — absolute + left/right:0 escapes that
  // so the inset strip stays full-bleed instead of inset by the side padding.
  topInsetAbsolute: { position: 'absolute', top: 0, left: 0, right: 0 },
  loaderContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  content: {
    paddingBottom: 24,
  },
  title: {
    marginTop:  8,
    fontSize:   FontSize.font24,
    fontWeight: '700',
    color:      '#1f1e1b',
  },
  body: {
    marginTop:  24,
    fontSize:   FontSize.font14,
    color:      '#4c4c4c',
    lineHeight: 20,
  },

  // ── Rows ──────────────────────────────────────────────────────────────────
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               16,
    marginTop:         16,
    paddingHorizontal: 24,
    paddingVertical:   12,
    borderRadius:      4,
  },
  rowUpload: {
    backgroundColor: '#fef6db',
  },
  rowSuccess: {
    borderWidth:  2,
    borderColor:  '#10b981',
    borderRadius: 4,
  },
  rowFailed: {
    borderWidth:     2,
    borderColor:     '#ef4444',
    backgroundColor: '#FDECEC',
  },
  rowDeactive: {
    backgroundColor: '#ededed',
  },
  rowLabel: {
    flex:       1,
    fontSize:   FontSize.font14,
    fontWeight: '600',
    color:      '#333333',
  },
  rowLabelMuted: {
    color: '#999999',
  },
  rowTextCol: {
    flex: 1,
  },
  attemptsText: {
    marginTop:  2,
    fontSize:   FontSize.font12,
    fontWeight: '500',
    color:      '#ef4444',
  },
  chevron: {
    fontSize:   FontSize.font20,
    color:      '#333333',
  },
  chevronMuted: {
    color: '#999999',
  },

  // ── Exhausted-state support button ───────────────────────────────────────
  supportBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    marginTop:         24,
    paddingVertical:   14,
    borderRadius:      8,
    backgroundColor:   Colors.primaryDark,
  },
  supportBtnText: {
    fontSize:   FontSize.font14,
    fontWeight: '600',
    color:      Colors.white,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  helpRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               6,
    paddingTop:        12,
  },
  helpText: {
    fontSize: FontSize.font12,
    color:    '#4c4c4c',
  },
  helpLink: {
    color:          '#bd8800',
    textDecorationLine: 'underline',
  },
})
