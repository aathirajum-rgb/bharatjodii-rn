// Angular: components/id-verify/id-verify.component.ts(+.html), as rendered by
// pages/verify-id/verify-id.page.html's `isNewIdVerifyFlow` branch — the
// "To activate paid membership, you need to verify your profile" intermediate.
//
// Reached on app open (kill + reopen) via dr.service.ts's handleAfterDr() case
// "7" (CallVerify): the backend keeps sending landing page_id 7 on autologin
// until the profile is verified, and Angular routes it to
// verify-id?frm_page=notify, which shows this component whenever
// isNewIdVerifyFlow = EKYCSTATUS=='0' && LOGINGENDER=='M' (&& not the blocker
// flow, which never applies to frm_page 'notify'). See drService.ts case '7'.
//
// frm_page is always 'notify' here, so (hideSkipButton = true):
//  - no header / close icon; "I'll do this later" link IS shown
//  - Call CTA → common.callUs(VERIFIEDBYCALLNUM) then onboardingSkip with
//    frm_page 'notify' → showOnboardingSkipPopUp('notify') → /matches
//  - "I'll do this later" → onboardingSkip with no frm_page →
//    showOnboardingSkipPopUp('') → PROFILEVERIFYPAID.POPUP sheet the first
//    time (botttomSeetEnabled), /matches on any later tap. Both sheet CTAs
//    land on /matches (bottom-sheet.service.ts photoPopUp 'verifyId'/'matches'),
//    the primary one dialing first.
//
// Copy: PROFILEVERIFYPAID.INTERMEDIATE for isNonIdVerifyUser() (EKYCSTATUS!='1'
// && LOGINGENDER=='M' && ENTRYTYPE=='P'), the static VERIFY_ID i18n block
// otherwise — same split as id-verify.component.ts's constructor.
import { useEffect, useRef, useState } from 'react'
import { BackHandler, Linking, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import CdnLottie from '../../components/CdnLottie'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import BottomSheet, { type BottomSheetData } from '../../components/bottom-sheet/BottomSheet'
import ScreenTopInset from '../../components/screen/ScreenTopInset'
import { Fonts, FontSize } from '../../src/theme/fonts'
import { Colors } from '../../constants/colors'
import { CDN_SVG, CDN_LOTTIE } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { apiCall } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { getRegistrationArrays, getSessionValue } from '../../service/registrationService'
import { resetTo } from '../../utils/navigationRef'
import { ENavigation } from '../../types/enums/navigation.enum'

interface VerifyContent {
  CONFIRM_MATCH?:   string
  VERIFY_REQUIRED?: string
  CALL_CONFIRM?:    string
  QUICK_VERIFY?:    string
  LBL_DO_LATER_1?:  string
}

const stripHtml = (s?: string) => (s ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')

// Angular: CALL_CONFIRM?.replace('##CSNUM##', verifybyCall)?.replace('+91', '')
const withCallNum = (s: string | undefined, num: string) =>
  stripHtml(s).replace(/##CSNUM##/g, num).replace('+91', '')

function goToMatches() {
  resetTo(ENavigation.MATCHES)
}

export default function IdVerifyIntermediateScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [content, setContent]   = useState<VerifyContent>({})
  const [popup, setPopup]       = useState<Record<string, any> | null>(null)
  const [callNum, setCallNum]   = useState('')
  const [showSheet, setShowSheet] = useState(false)
  // Angular: verify-id.page.ts's botttomSeetEnabled — the skip sheet only
  // ever opens once; a later "I'll do this later" tap goes straight to Matches.
  const sheetShown = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [ekyc, gender, entryType, storedNum, arrays] = await Promise.all([
        getItem(SK.Verification.EKYC_STATUS),
        getItem(SK.User.LOGIN_GENDER),
        getSessionValue('ENTRYTYPE'),
        getItem('VERIFIEDBYCALLNUM'),
        getRegistrationArrays(),
      ])
      if (cancelled) return
      setCallNum(storedNum ?? '')

      const isNonIdVerifyUser = (ekyc ?? '0') !== '1' && gender === 'M' && entryType === 'P'
      const intermediate = arrays?.PROFILEVERIFYPAID?.INTERMEDIATE
      setContent(isNonIdVerifyUser
        ? {
            CONFIRM_MATCH:   intermediate?.HEADER,
            VERIFY_REQUIRED: intermediate?.BODY?.CONTENT1,
            CALL_CONFIRM:    intermediate?.CTA,
            LBL_DO_LATER_1:  intermediate?.CTA2,
          }
        : (t('VERIFY_ID', { returnObjects: true }) as VerifyContent))
      setPopup(arrays?.PROFILEVERIFYPAID?.POPUP ?? null)

      // Angular: callVerifyApi() — refresh the verify-by-call number.
      const [uid, mc] = await Promise.all([getItem(SK.Auth.USER_ID), getItem(SK.User.MEMBER_CODE)])
      const res = await apiCall(
        Endpoints.communication.idProofData, 'POST',
        `ID=${uid ?? ''}&LOGINGENDER=${gender ?? ''}&MCODE=${mc || '91'}`,
      )
      if (cancelled) return
      if (String(res?.ERRCODE) === '0' && String(res?.RESPONSECODE) === '1') {
        const num = String(res?.RESPONSE?.VERIFIEDBYCALLNUM ?? '')
        setCallNum(num)
        await setItem('VERIFIEDBYCALLNUM', num)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Nothing sits underneath this landing screen — device back goes to Matches
  // (Angular 'back' → skipVerificationPage()).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goToMatches()
      return true
    })
    return () => sub.remove()
  }, [])

  // Angular: common.callUs() → native missed_verify dialer event.
  function dialVerifyNumber() {
    const num = callNum.trim()
    if (!num) return
    Linking.openURL(`tel:${num}`).catch(e => {
      if (__DEV__) console.error('[IdVerifyIntermediate] dial error:', e)
    })
  }

  function handleCall() {
    dialVerifyNumber()
    goToMatches()
  }

  function handleDoLater() {
    if (!sheetShown.current && popup) {
      sheetShown.current = true
      setShowSheet(true)
    } else {
      goToMatches()
    }
  }

  const sheetData: BottomSheetData = {
    image:             popup?.IMG || undefined,
    title:             stripHtml(popup?.HEADER),
    ctaLabel:          withCallNum(popup?.CTA2, callNum),
    ctaIcon:           'call-img-white',
    showSecondaryCta:  true,
    secondaryCtaLabel: stripHtml(popup?.CTA1),
  }

  return (
    <LinearGradient colors={['#FFF3F6', Colors.white]} locations={[0, 0.4465]} style={s.screen}>
      <ScreenTopInset />

      <View style={s.imageWrap}>
        <CdnSvg uri={CDN_SVG + 'id-verify-bg.svg'} width="100%" height={260} />
        <View style={s.animation} pointerEvents="none">
          <CdnLottie uri={CDN_LOTTIE + 'serious-for-match-verify.json'} width={96} height={96} />
        </View>
        <LinearGradient
          colors={['rgba(255,255,255,0)', Colors.white]}
          locations={[0, 0.5]}
          style={s.whiteGradient}
          pointerEvents="none"
        />
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {!!content.CONFIRM_MATCH && <Text style={s.heading}>{stripHtml(content.CONFIRM_MATCH)}</Text>}
        {!!content.VERIFY_REQUIRED && <Text style={s.body}>{stripHtml(content.VERIFY_REQUIRED)}</Text>}

        <ButtonRevamp
          label={withCallNum(content.CALL_CONFIRM, callNum)}
          variant="primary"
          size="large"
          icon="call-img-white"
          fullWidth
          onPress={handleCall}
          style={s.callBtn}
        />

        {!!content.QUICK_VERIFY && <Text style={s.quick}>{stripHtml(content.QUICK_VERIFY)}</Text>}

        {!!content.LBL_DO_LATER_1 && (
          <ButtonRevamp
            label={stripHtml(content.LBL_DO_LATER_1)}
            variant="clear"
            size="small"
            icon="forward-icon-grey"
            iconPosition="end"
            onPress={handleDoLater}
            style={s.doLater}
          />
        )}
      </View>

      <BottomSheet
        visible={showSheet}
        type="photoPopUp"
        data={sheetData}
        onClose={() => setShowSheet(false)}
        onPrimaryPress={() => { setShowSheet(false); handleCall() }}
        onSecondaryPress={() => { setShowSheet(false); goToMatches() }}
      />
    </LinearGradient>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  imageWrap: { marginTop: 32, alignItems: 'center', justifyContent: 'center', flex: 1 },
  animation: { position: 'absolute', alignSelf: 'center', marginRight: 40 },
  whiteGradient: { position: 'absolute', bottom: -20, left: 0, right: 0, height: 50 },

  bottom: { paddingHorizontal: 24 },
  heading: {
    fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font18, lineHeight: 24,
    color: Colors.black, textAlign: 'center', marginTop: 32, paddingHorizontal: 12,
  },
  body: {
    fontFamily: Fonts.poppinsMedium, fontSize: FontSize.font14, lineHeight: 20,
    color: Colors.textPrimary, textAlign: 'center', marginTop: 12, marginBottom: 32,
  },
  callBtn: { marginTop: 16 },
  quick: { fontSize: FontSize.font12, color: '#8a8a8a', textAlign: 'center', marginTop: 12 },
  doLater: { alignSelf: 'center', marginTop: 24, marginBottom: 16 },
})
