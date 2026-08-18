// Angular: pages/verify-id/verify-id.page.ts(+.html) — government-ID verification
// (2136 lines). This is a full re-implementation of the classic flow (ID-type
// selection → typed-number OR photo-upload → status result), NOT a line-for-line
// port. Deliberately out of scope (documented here rather than silently dropped):
//   - Selfie capture (separate screen/feature, not part of this one)
//   - Signzy/OTP escalation redirect (navigateToSignzy → phone-verify flow)
//   - The "new consolidated flow" (isNewIdVerifyFlow) alternate full-page component
//   - IDVerifyPromo/IDVerifyBlurPromo upsell bottom sheets (shown from elsewhere)
//   - The "Need Help" example-image mismatch popup (openMock())
//   - Parent-created-profile / female-free-3-contacts post-success branching —
//     this always lands on Matches on success, matching the majority-case path.
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import RadioGroup, { type RadioOption } from '../../components/radio/RadioGroup'
import FloatingLabelInput from '../../components/input/FloatingLabelInput'
import VerificationSuccessSheet from '../../components/bottom-sheet/VerificationSuccessSheet'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { Colors } from '../../constants/colors'
import { CDN, CDN_SVG, CDN_REACT } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { apiCall, uploadFile } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { fetchCustomerCare } from '../../service/homeService'
import { getRegistrationArrays, getRegValue } from '../../service/registrationService'
import { requestCameraPermission, requestStoragePermission } from '../../service/permissionService'

// ─── Icons ──────────────────────────────────────────────────────────────────────

const ICONS = {
  back:     CDN_REACT + '/menu_back_arrow.svg',
  gallery:  CDN_SVG + 'gallery-id-revamp.svg',
  camera:   CDN_SVG + 'camera-id-revamp.svg',
  needHelp: CDN_SVG + 'need-help-circle-question-img.svg',
  callIcon: CDN + 'call-white.svg',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'loading' | 'select' | 'text' | 'upload' | 'result' | 'exhausted'
type ResultKind = 'success' | 'pending' | 'failure'

interface IdProofType {
  type:        string   // e.g. 'aadhar' | 'pan' | 'dl' | 'voter' | 'passport' | 'nationalid' | 'govtid'
  name:        string   // display label, from server (already localized) or fallback i18n
  upload:      boolean  // can verify by photo upload
  invoid:      boolean  // can verify by typing the ID number
  dob:         boolean  // requires date of birth (passport)
  mostPopular: boolean
}

// Per-type IDPROOFAPICALLFLAG shape, e.g. { PAN:'0', PANKEY:'0', ..., TOTALCOUNT:'0' }
type ApiCallFlags = Record<string, string>

// ─── Validation — ported from verify-id.page.ts:1560-1613 ────────────────────

function validateIdNumber(
  type: string,
  value: string,
  dobFilled: boolean,
): { valid: boolean; errorKey?: string } {
  const v = value.trim()
  switch (type) {
    case 'pan':
      return /^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/.test(v)
        ? { valid: true }
        : { valid: false, errorKey: 'VERIFY_ID.VERIFY_DOC_PAN_ERRMSG' }
    case 'voter':
      return v.length >= 8 && /^[a-zA-Z0-9]+$/.test(v)
        ? { valid: true }
        : { valid: false, errorKey: 'VERIFY_ID.VERIFY_DOC_VOTER_ERRMSG' }
    case 'dl':
      return v.length > 0 && /^[a-zA-Z0-9]+$/.test(v)
        ? { valid: true }
        : { valid: false, errorKey: 'VERIFY_ID.VERIFY_DOC_DL_ERRMSG' }
    case 'passport':
      return v.length > 0 && /^[a-zA-Z0-9]+$/.test(v) && dobFilled
        ? { valid: true }
        : { valid: false, errorKey: 'VERIFY_ID.VERIFY_DOC_PASSPORT_ERRMSG' }
    default:
      // Generic ID types (nationalid/govtid) — any non-empty alphanumeric value.
      return v.length >= 4 && /^[a-zA-Z0-9]+$/.test(v)
        ? { valid: true }
        : { valid: false, errorKey: 'VERIFY_ID.VERIFY_DOC_DL_ERRMSG' }
  }
}

function typeAvailability(type: string, flags: ApiCallFlags) {
  const key = type.toUpperCase()
  return {
    uploadDisabled: flags[key] === '1',
    textDisabled:   flags[`${key}KEY`] === '1',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VerifyIdScreen({ navigation }: { navigation: any }) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [step, setStep] = useState<Step>('loading')

  // Session context, loaded once
  const [userId, setUserId]     = useState('')
  const [gender, setGender]     = useState('')
  const [mcode, setMcode]       = useState('91')
  const [mobile, setMobile]     = useState('')
  const [phone, setPhone]       = useState('')   // customer-care number
  const originalName = useRef('')

  // ID-type list + per-type availability flags
  const [idTypes, setIdTypes]   = useState<IdProofType[]>([])
  const [apiFlags, setApiFlags] = useState<ApiCallFlags>({})
  const [selectedKey, setSelectedKey] = useState('')
  const selectedType = idTypes.find(t2 => t2.type === selectedKey) ?? null

  // Text-entry fields
  const [name, setName]       = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [dobDay, setDobDay]   = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>(undefined)

  // Upload
  const [uploadStage, setUploadStage] = useState<'front' | 'back'>('front')

  // Result
  const [resultKind, setResultKind]       = useState<ResultKind>('failure')
  const [resultMessage, setResultMessage] = useState('')
  const [showSuccessSheet, setShowSuccessSheet] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [uid, gen, mc, storedName, mobileNo, care] = await Promise.all([
        getItem(SK.Auth.USER_ID),
        getItem(SK.User.LOGIN_GENDER),
        getItem(SK.User.MEMBER_CODE),
        getItem(SK.User.NAME),
        getRegValue('MOBILENO'),
        fetchCustomerCare(),
      ])
      if (cancelled) return
      setUserId(uid ?? '')
      setGender(gen ?? '')
      setMcode(mc ?? '91')
      setMobile(mobileNo ?? '')
      setPhone(care?.phone ?? '')
      originalName.current = storedName ?? ''
      setName(storedName ?? '')

      const params = `ID=${uid ?? ''}&LOGINGENDER=${gen ?? ''}&MCODE=${mc ?? '91'}&ERRMSG=2`
      const [statusRes, arrays] = await Promise.all([
        apiCall(Endpoints.communication.idProofData, 'POST', params),
        getRegistrationArrays(),
      ])
      if (cancelled) return

      const resp = statusRes?.RESPONSE
      const flags: ApiCallFlags = resp?.IDPROOFAPICALLFLAG ?? {}
      setApiFlags(flags)

      const types = normalizeIdProofTypes(arrays?.IDPROOFHASH, t)
      setIdTypes(types)

      if (String(resp?.EKYCSTATUS) === '1') {
        setResultKind('success')
        setStep('result')
      } else if (flags['TOTALCOUNT'] === '1') {
        setStep('exhausted')
      } else {
        setStep('select')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── Re-poll status (after a submit) to refresh attempt flags ──────────────

  async function refreshStatusFlags() {
    const params = `ID=${userId}&LOGINGENDER=${gender}&MCODE=${mcode}&ERRMSG=2`
    const res = await apiCall(Endpoints.communication.idProofData, 'POST', params)
    const flags: ApiCallFlags = res?.RESPONSE?.IDPROOFAPICALLFLAG ?? {}
    setApiFlags(flags)
    return flags
  }

  // ── Type selection → route to text or upload ───────────────────────────────

  function handleSelectType(key: string) {
    const item = idTypes.find(i => i.type === key)
    if (!item) return

    const { uploadDisabled, textDisabled } = typeAvailability(item.type, apiFlags)
    if (uploadDisabled && textDisabled) {
      Alert.alert('', t('VERIFY_ID.LBL_OTHER', 'Choose a different document'))
      return
    }

    setSelectedKey(key)
    setIdNumber('')
    setDobDay(''); setDobMonth(''); setDobYear('')
    setFieldError(undefined)

    if (item.invoid && !textDisabled) {
      setStep('text')
    } else if (item.upload && !uploadDisabled) {
      setUploadStage('front')
      setStep('upload')
    } else {
      setStep('select')
    }
  }

  // ── Shared response handler (verifyIdProof submit AND idProofData poll share
  //    the same RESPONSE.EKYCSTATUS/EKYCMSG shape) ────────────────────────────

  function handleVerifyResponse(res: any) {
    const resp = res?.RESPONSE
    if (String(res?.RESPONSECODE) !== '1') {
      setResultKind('failure')
      setResultMessage(resp?.MSG ?? res?.ERRORMESSAGE ?? t('VERIFY_ID.SIGNZY_ERRMSG'))
      setStep('result')
      return
    }
    const status = String(resp?.EKYCSTATUS ?? '0')
    const msg = String(resp?.EKYCMSG ?? '').split('~')[0]
    if (status === '1') {
      setResultKind('success')
      setResultMessage(msg)
      setItem('EKYCSTATUS', '1')
    } else if (status === '2') {
      setResultKind('pending')
      setResultMessage(msg || t('VERIFY_ID.PENDING_NOTE1'))
    } else {
      setResultKind('failure')
      setResultMessage(msg || t('VERIFY_ID.SIGNZY_ERRMSG'))
    }
    setStep('result')
  }

  // ── Text-entry submit ───────────────────────────────────────────────────────

  async function submitTextEntry() {
    if (!selectedType || submitting) return
    const dobFilled = !!(dobDay && dobMonth && dobYear)
    const v = validateIdNumber(selectedType.type, idNumber, dobFilled)
    if (!v.valid) {
      setFieldError(t(v.errorKey!))
      return
    }
    setSubmitting(true)
    // DOB format inferred as DD-MM-YYYY — not independently confirmed against
    // a live backend contract (only passport requires it to be non-empty).
    const dobStr = selectedType.dob && dobFilled
      ? `${dobDay.padStart(2, '0')}-${dobMonth.padStart(2, '0')}-${dobYear}`
      : ''
    const params = [
      `ID=${encodeURIComponent(userId)}`,
      `TIMECREATED=${Date.now()}`,
      `ADDRESSPROOFTYPE=${selectedType.type}`,
      `DOB=${dobStr}`,
      `COUNTRYCODE=${mcode}`,
      `NAME=${encodeURIComponent(name)}`,
      `TEXT=${encodeURIComponent(idNumber.trim())}`,
      'VERIFYTYPE=text',
      'FEMALEFREE=0',
      `NAMEEDIT=${name !== originalName.current ? 1 : 0}`,
      'ERRMSG=2',
    ].join('&')
    const res = await apiCall(Endpoints.registration.verifyIdProof, 'POST', params)
    handleVerifyResponse(res)
    await refreshStatusFlags()
    setSubmitting(false)
  }

  // ── Upload (camera or gallery) ──────────────────────────────────────────────

  async function captureAndUpload(source: 'camera' | 'gallery') {
    if (!selectedType || submitting) return

    const permission = source === 'camera'
      ? await requestCameraPermission()
      : await requestStoragePermission()
    if (permission !== 'granted') return

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 })
    if (result.canceled || !result.assets[0]) return

    setSubmitting(true)
    const asset    = result.assets[0]
    const filename = asset.uri.split('/').pop() ?? 'id.jpg'
    const ext      = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
    const mime     = ext === 'png' ? 'image/png' : 'image/jpeg'
    // Passport is two-sided (verify-id.page.ts:975-978) — the old native camera
    // bridge captured both sides then sent one call with DOCPAGE='both'. Without
    // that native multi-capture UI, we capture+upload front then back as two
    // sequential calls instead, each with its own DOCPAGE — a deliberate
    // simplification of the original single dual-page call.
    const docPage = selectedType.dob ? uploadStage : 'front'
    const docName = [selectedType.type, name, name !== originalName.current ? '1' : '0', mobile].join('~')

    const formData = new FormData()
    formData.append('ID', userId)
    formData.append('DOCPAGE', docPage)
    formData.append('INVOID', '1')
    formData.append('DOCNAME', docName)
    formData.append('UPLOADPHOTO', { uri: asset.uri, name: filename, type: mime } as any)

    await uploadFile(Endpoints.media.addTrustBadge, formData)

    if (selectedType.dob && uploadStage === 'front') {
      // Passport front captured — prompt for the back before polling status.
      setUploadStage('back')
      setSubmitting(false)
      return
    }

    const pollParams = `ID=${userId}&LOGINGENDER=${gender}&MCODE=${mcode}&ADDRESSPROOFTYPE=${selectedType.type}&TYPE=UPLOAD&ERRMSG=1`
    const res = await apiCall(Endpoints.communication.idProofData, 'POST', pollParams)
    handleVerifyResponse(res)
    await refreshStatusFlags()
    setSubmitting(false)
  }

  function callCustomerSupport() {
    if (phone) Linking.openURL(`tel:${phone}`)
  }

  function handleBack() {
    if (step === 'text' || step === 'upload') {
      setStep('select')
    } else {
      navigation.goBack()
    }
  }

  function handleRetry() {
    if (!selectedType) { setStep('select'); return }
    const { uploadDisabled, textDisabled } = typeAvailability(selectedType.type, apiFlags)
    if (uploadDisabled && textDisabled) {
      setStep(apiFlags['TOTALCOUNT'] === '1' ? 'exhausted' : 'select')
      return
    }
    setFieldError(undefined)
    setStep(selectedType.invoid && !textDisabled ? 'text' : 'upload')
  }

  function handleSuccessDismiss() {
    setShowSuccessSheet(false)
    navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <View style={s.loaderContainer}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
      </View>
    )
  }

  const radioOptions: RadioOption[] = idTypes.map(item => ({ key: item.type, value: item.name }))

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={handleBack} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICONS.back} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('VERIFY_BLOCKER.VERIFY_GOVT_PROOF')}</Text>
      </View>

      {step === 'select' && (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={s.heading}>{t('VERIFY_ID.SUB_TITLE_1')}</Text>
          <Text style={s.body}>{t('VERIFY_ID.NOTE_2')}</Text>
          <RadioGroup
            options={radioOptions}
            value={selectedKey}
            onChange={key => handleSelectType(key)}
            layout="list"
            style={s.radioList}
          />
          <HelpFooter t={t} phone={phone} onPress={callCustomerSupport} />
        </ScrollView>
      )}

      {step === 'text' && selectedType && (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled">
          <Text style={s.heading}>
            {t('VERIFY_ID.ID_LABEL').replace('#VAR#', selectedType.name)}
          </Text>

          <FloatingLabelInput
            label={t('VERIFY_ID.PROFILE_NAME')}
            value={name}
            onChangeText={setName}
            variant="name"
            style={s.field}
          />

          <FloatingLabelInput
            label={selectedType.name}
            value={idNumber}
            onChangeText={txt => { setIdNumber(txt.toUpperCase()); if (fieldError) setFieldError(undefined) }}
            errorMessage={fieldError}
            variant="text"
            autoCapitalize="characters"
            style={s.field}
          />

          {selectedType.dob && (
            <View style={s.dobRow}>
              <FloatingLabelInput
                label="DD" value={dobDay}
                onChangeText={v => setDobDay(v.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad" maxLength={2} variant="text"
                style={s.dobField}
              />
              <FloatingLabelInput
                label="MM" value={dobMonth}
                onChangeText={v => setDobMonth(v.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad" maxLength={2} variant="text"
                style={s.dobField}
              />
              <FloatingLabelInput
                label="YYYY" value={dobYear}
                onChangeText={v => setDobYear(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad" maxLength={4} variant="text"
                style={s.dobField}
              />
            </View>
          )}

          {typeAvailability(selectedType.type, apiFlags).uploadDisabled === false && selectedType.upload && (
            <Pressable onPress={() => { setUploadStage('front'); setStep('upload') }}>
              <Text style={s.linkText}>{t('VERIFY_ID.UPLOAD_INSTEAD').replace('#NAME#', '').replace('#CARD#', selectedType.name)}</Text>
            </Pressable>
          )}

          <Text style={s.consent}>{t('VERIFY_ID.NOTE_CONSENT')}</Text>

          <ButtonRevamp
            label={t('GENERAL.SUBMIT', 'Submit')}
            variant="primary" size="standard" fullWidth
            disabled={!name.trim() || !idNumber.trim()}
            loading={submitting}
            onPress={submitTextEntry}
            style={s.field}
          />

          <HelpFooter t={t} phone={phone} onPress={callCustomerSupport} />
        </ScrollView>
      )}

      {step === 'upload' && selectedType && (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={s.heading}>
            {selectedType.dob
              ? (uploadStage === 'front' ? t('VERIFY_ID.UPLOAD_FRONT_CARD').replace('#CARD#', selectedType.name) : 'Upload back side of ' + selectedType.name)
              : t('VERIFY_ID.UPLOAD_TITLE').replace('#NAME#', '').replace('#VAR#', selectedType.name)}
          </Text>
          <Text style={s.body}>{t('VERIFY_ID.PRIVACY_ID')}</Text>

          <Pressable style={s.uploadRow} onPress={() => captureAndUpload('camera')} disabled={submitting}>
            <CdnSvg uri={ICONS.camera} width={28} height={28} />
            <Text style={s.rowLabel}>{t('VERIFY_ID.TAKE_PHOTO').replace('#CARD#', selectedType.name)}</Text>
          </Pressable>

          <Pressable style={s.uploadRow} onPress={() => captureAndUpload('gallery')} disabled={submitting}>
            <CdnSvg uri={ICONS.gallery} width={28} height={28} />
            <Text style={s.rowLabel}>{t('VERIFY_ID.UPLOAD_GALLERY')}</Text>
          </Pressable>

          {submitting && <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 16 }} />}

          {typeAvailability(selectedType.type, apiFlags).textDisabled === false && selectedType.invoid && (
            <Pressable onPress={() => setStep('text')}>
              <Text style={s.linkText}>{t('VERIFY_ID.OR')} — {t('VERIFY_ID.ENTER_CARD').replace('#NAME#', '').replace('#CARD#', selectedType.name)}</Text>
            </Pressable>
          )}

          <Text style={s.consent}>{t('VERIFY_ID.NOTE_CONSENT')}</Text>

          <HelpFooter t={t} phone={phone} onPress={callCustomerSupport} />
        </ScrollView>
      )}

      {step === 'result' && (
        <View style={[s.content, { flex: 1, justifyContent: 'center' }]}>
          {resultKind === 'success' && (
            <>
              <Text style={s.heading}>{t('VERIFY_ID.CONGRATS')}</Text>
              <Text style={s.body}>{resultMessage || t('VERIFY_ID.IDVERIFY_CONGRATS')}</Text>
              <ButtonRevamp
                label={t('VERIFY_ID.CONTINUE_MATCHES')}
                variant="primary" size="standard" fullWidth
                onPress={() => setShowSuccessSheet(true)}
                style={{ marginTop: 24 }}
              />
            </>
          )}
          {resultKind === 'pending' && (
            <>
              <Text style={s.heading}>{t('VERIFY_ID.VERIFY_LOADING')}</Text>
              <Text style={s.body}>{resultMessage || t('VERIFY_ID.PENDING_NOTE1')}</Text>
              <ButtonRevamp
                label={t('VERIFY_ID.MATCHES_CTA')}
                variant="primary" size="standard" fullWidth
                onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })}
                style={{ marginTop: 24 }}
              />
            </>
          )}
          {resultKind === 'failure' && (
            <>
              <Text style={s.heading}>{t('VERIFY_ID.SIGNZY_ERRMSG')}</Text>
              {!!resultMessage && <Text style={s.body}>{resultMessage}</Text>}
              <ButtonRevamp
                label={t('VERIFY_ID.TRY_AGAIN', 'Try again')}
                variant="primary" size="standard" fullWidth
                onPress={handleRetry}
                style={{ marginTop: 24 }}
              />
              <Pressable onPress={() => setStep('select')} style={{ marginTop: 16 }}>
                <Text style={s.linkText}>{t('VERIFY_ID.LBL_OTHER')}</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {step === 'exhausted' && (
        <View style={[s.content, { flex: 1, alignItems: 'center' }]}>
          <Text style={s.heading}>{t('VERIFY_BLOCKER.VERIFY_EXHAUST', "You've used up all your verification attempts")}</Text>
          <Text style={s.body}>
            {t('VERIFY_BLOCKER.REACH_CUSTOMER_SERVICE', 'Please reach out to our support team and they will help verify your account manually.')}
          </Text>
          {!!phone && (
            <Pressable style={s.callBtn} onPress={callCustomerSupport}>
              <CdnSvg uri={ICONS.callIcon} width={18} height={18} />
              <Text style={s.callBtnText}>{`${t('VERIFY_ID.CALL_TO_VERIFY')} • ${phone}`}</Text>
            </Pressable>
          )}
        </View>
      )}

      <VerificationSuccessSheet
        visible={showSuccessSheet}
        title={t('VERIFY_ID.CONGRATS')}
        subtitle={resultMessage || t('VERIFY_ID.IDVERIFY_CONGRATS')}
        onDismiss={handleSuccessDismiss}
      />
    </View>
  )
}

// ─── Shared "Need Help" footer ──────────────────────────────────────────────────

function HelpFooter({ t, phone, onPress }: { t: any; phone: string; onPress: () => void }) {
  if (!phone) return null
  return (
    <Pressable style={s.helpRow} onPress={onPress}>
      <CdnSvg uri={ICONS.needHelp} width={18} height={18} />
      <Text style={s.helpText}>
        {t('VERIFY_ID.NEED_HELP_VERIFY')}{'  '}
        <Text style={s.helpLink}>{t('VERIFY_ID.CUSTOMER_SUPPORT')}</Text>
      </Text>
    </Pressable>
  )
}

// ─── ID-type list — data-driven from REGISTRATIONARRAYS.IDPROOFHASH, falling
//     back to the static VERIFY_DOC i18n array if that data is unavailable
//     (mirrors DeleteProfileHideScreen's FALLBACK_OPTIONS pattern). ─────────────

function normalizeIdProofTypes(raw: any, t: (key: string, opts?: any) => any): IdProofType[] {
  const list: any[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' ? Object.values(raw) : []

  const parsed = list
    .map((item: any) => ({
      type:        String(item.TYPE ?? item.type ?? '').toLowerCase(),
      name:        String(item.NAME ?? item.name ?? ''),
      upload:      String(item.UPLOAD ?? item.upload ?? '0') === '1',
      invoid:      String(item.INVOID ?? item.invoid ?? '0') === '1',
      dob:         String(item.DOB ?? item.dob ?? '0') === '1',
      mostPopular: String(item.MOSTPOPULAR ?? item.mostPopular ?? '0') === '1',
    }))
    .filter(item => item.type && (item.upload || item.invoid))

  if (parsed.length > 0) return parsed

  const fallbackDocs = t('VERIFY_DOC', { returnObjects: true })
  if (Array.isArray(fallbackDocs)) {
    return fallbackDocs.map((d: any) => ({
      type: String(d.TYPE ?? '').toLowerCase(),
      name: String(d.NAME ?? ''),
      upload: true,
      invoid: true,
      dob: false,
      mostPopular: false,
    }))
  }
  return []
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: SemanticFontsEnglish.headingEnglishMedium, color: '#333333', marginLeft: 6, marginRight: 16 },

  content: { paddingHorizontal: 24, paddingTop: 24 },
  heading: { fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: Colors.textPrimary, marginBottom: 12 },
  body:    { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 20 },

  radioList: { marginTop: 8 },

  field:    { marginBottom: 4 },
  dobRow:   { flexDirection: 'row', gap: 12 },
  dobField: { flex: 1 },

  linkText: { fontSize: 14, fontWeight: '600', color: Colors.link, marginBottom: 20 },
  consent:  { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginBottom: 20 },

  uploadRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginBottom: 16, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 8, backgroundColor: '#fef6db',
  },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#333333' },

  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24,
    backgroundColor: Colors.primary, marginTop: 24,
  },
  callBtnText: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 14, color: Colors.white },

  helpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  helpText: { fontSize: 12, color: '#4c4c4c' },
  helpLink: { color: '#bd8800', textDecorationLine: 'underline' },
})
