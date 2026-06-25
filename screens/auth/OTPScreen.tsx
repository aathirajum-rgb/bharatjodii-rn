import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Constants from 'expo-constants'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { parseAndStoreWebViewURL, resendOTP, verifyOTP } from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { StorageKeys } from '../../constants/storage.keys'

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const BG         = '#FAFAFA'
const TEXT_DARK  = '#1F1E1B'
const TEXT_GREY  = '#545454'
const PINK       = '#DE2A68'        // logo-pink class
const ERROR_RED  = '#E12B10'        // otp-error-msg color from global.scss
const RESEND_S   = 59               // matches Angular resendotpTimer = 59

type Props = {
  navigation: any
  route: { params: { mobile: string; countryCode: string; matriId: string } }
}

export default function OTPScreen({ navigation, route }: Props) {
  const { mobile, countryCode, matriId } = route.params
  const insets = useSafeAreaInsets()

  const [otp,       setOtp]       = useState('')
  const [errorMsg,  setErrorMsg]  = useState('')
  const [name,      setName]      = useState('')
  const [seconds,   setSeconds]   = useState(RESEND_S)
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    getItem(StorageKeys.User.NAME).then(n => { if (n) setName(n.trim()) })
    setTimeout(() => inputRef.current?.focus(), 400)
  }, [])

  // Countdown — matches Angular startResendOTPTimer()
  useEffect(() => {
    if (seconds <= 0) return
    const id = setInterval(() => setSeconds(s => s - 1), 1000)
    return () => clearInterval(id)
  }, [seconds])

  function formatTimer(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  function buildParams(withOtp?: string) {
    const appVersion = Constants.expoConfig?.version ?? '1.0.0'
    return {
      ID:           matriId,
      MOBILENO:     mobile,
      MCODE:        countryCode,
      NEWREG:       '1',
      APPVERSION:   appVersion,
      DEVICEDETAIL: '{}',
      DEVICEID:     '',
      REGISTERID:   '',
      ...(withOtp ? { OTP: withOtp } : {}),
    }
  }

  // Matches Angular: disabled when otp.length < 4
  const canSubmit = otp.length >= 4 && !verifying

  async function handleConfirm() {
    if (!canSubmit) return
    setErrorMsg('')
    setVerifying(true)
    try {
      const nallow = await getItem('NALLOW') ?? '0'
      const res = await verifyOTP('otp', { ...buildParams(otp), NALLOW: nallow })
      if (res?.RESPONSECODE == 1) {
        if (res?.RESPONSE?.WEBVIEWURL) {
          await parseAndStoreWebViewURL(res.RESPONSE.WEBVIEWURL)
        }
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] })
      } else {
        // errorMsg inline — matches Angular otp-error-msg div
        const msg = res?.ERRMSG ?? res?.RESPONSE?.MSG ?? res?.ERRORMESSAGE ?? 'Invalid OTP. Please try again.'
        setErrorMsg(msg)
        setOtp('')
      }
    } catch {
      Alert.alert('Error', 'Network error. Please check your connection.')
    } finally {
      setVerifying(false)
    }
  }

  // Matches Angular callSignZGenerateOTP() on resend click — resets timer to 59
  async function handleResend() {
    setResending(true)
    setErrorMsg('')
    try {
      const res = await resendOTP('otp', buildParams())
      if (res?.RESPONSECODE == 1) {
        setOtp('')
        setSeconds(RESEND_S)
        inputRef.current?.focus()
      } else if (res?.ERRCODE === 'OTP_LIMIT') {
        Alert.alert('Limit Reached', 'You have reached the daily OTP limit. Please try again tomorrow.')
      } else {
        Alert.alert('Error', res?.ERRMSG ?? 'Failed to resend OTP. Please try again.')
      }
    } catch {
      Alert.alert('Error', 'Network error. Please check your connection.')
    } finally {
      setResending(false)
    }
  }

  // Matches Angular changeNumber() — go back to mobile form
  function handleChangeNumber() {
    navigation.goBack()
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header with back button — matches Angular otp-form header */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ENTER_OTP_TITLE — matches Angular header02 col for otp-form */}
        <Text style={styles.otpTitle}>Verify OTP</Text>

        {/* OTP_RECIEVED message — matches Angular .otp-msg */}
        <Text style={styles.otpMsg}>
          Please enter the OTP received from your mobile operator (Airtel / Jio / Vi)
        </Text>

        {/* OTP input — matches Angular enter-otp class, single field, tel, maxlength 6 */}
        <View style={styles.otpInputWrap}>
          <TextInput
            ref={inputRef}
            style={styles.otpInput}
            value={otp}
            onChangeText={t => {
              setErrorMsg('')
              setOtp(t.replace(/\D/g, '').slice(0, 6))
            }}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="Enter OTP"
            placeholderTextColor="#AAAAAA"
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
            textAlign="center"
          />
        </View>

        {/* Error message — matches Angular .otp-error-msg with alert-circle icon */}
        {errorMsg ? (
          <View style={styles.errorRow}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Resend section — matches Angular resend divs */}
        <View style={styles.resendRow}>
          {seconds > 0 ? (
            // resendotpTimer > 0: "Didn't get OTP? [Resend OTP in MM:SS]"
            <Text style={styles.resendTimerTxt}>
              Didn't get OTP?{'  '}
              <Text style={styles.resendHighlight}>
                Resend OTP in {formatTimer(seconds)}
              </Text>
            </Text>
          ) : (
            // resendotpTimer <= 0: "Didn't get OTP? [Resend OTP] ›"
            <Pressable onPress={handleResend} disabled={resending} style={styles.resendAction}>
              <Text style={styles.resendNotGet}>Didn't get OTP?{'  '}</Text>
              {resending ? (
                <ActivityIndicator size="small" color={PINK} />
              ) : (
                <>
                  <Text style={styles.resendLink}>Resend OTP</Text>
                  <Text style={styles.resendChevron}> ›</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        {/* Confirm button — matches Angular round button, disabled when otp.length < 4 */}
        <View style={styles.confirmRow}>
          <ButtonRevamp
            label="Confirm"
            variant="primary"
            size="large"
            fullWidth
            loading={verifying}
            disabled={!canSubmit}
            onPress={handleConfirm}
          />
        </View>

        {/* Not registered / Change number — matches Angular not-registered-change */}
        <View style={styles.changeRow}>
          <Text style={styles.changeLabel}>
            {name ? `Not ${name}?  ` : 'Not your number?  '}
          </Text>
          <Pressable onPress={handleChangeNumber}>
            <Text style={styles.changeLink}>Change Number</Text>
          </Pressable>
          <Text style={styles.changeChevron}> ›</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // Header — hide-header-bar style, minimal
  header: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDEDED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 28,
    color: TEXT_DARK,
    lineHeight: 32,
    marginTop: -2,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,    // ion-cust-padding: 24px
    paddingBottom: 40,
  },

  // header02 col for otp-form — 16px medium
  otpTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_DARK,
    marginTop: 16,
    marginBottom: 8,
  },

  // .otp-msg — color #000000, font-size ~3.9vmin≈14px, letter-spacing 0.36
  otpMsg: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 22,
    letterSpacing: 0.36,
    marginBottom: 24,
  },

  // enter-otp + otp-not-entered + font-bold
  // border-radius: 4px, border always #DE2A68 (enter-otp declared last → wins)
  otpInputWrap: {
    marginBottom: 12,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: PINK,            // always pink — enter-otp overrides otp-not-entered
    borderRadius: 4,              // --border-radius: 4px from Angular
    backgroundColor: '#FFFFFF',
    height: 60,
    fontSize: 22,                 // font-size-mlg=16px in Angular; 22 keeps digits readable
    fontWeight: '700',            // font-bold class
    color: TEXT_DARK,
    letterSpacing: 6,
    textAlign: 'center',
    paddingHorizontal: 19,        // --padding-start: 19px (ps-19 class)
    outlineWidth: 0,
  },

  // .otp-error-msg — color #E12B10, font-size ~3.3vmin≈13px
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  errorIcon: {
    fontSize: 16,                 // f-mlg class
    color: ERROR_RED,
    marginTop: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 13,                 // ~3.3vmin
    color: ERROR_RED,
    lineHeight: 20,
    letterSpacing: 0.36,
  },

  // Resend row — ion-text-start d-flex ion-margin-top
  resendRow: {
    marginTop: 16,
    marginBottom: 24,
  },
  resendTimerTxt: {
    fontSize: 14,
    color: TEXT_GREY,
  },
  resendHighlight: {
    color: PINK,               // logo-pink class
    fontWeight: '600',
  },
  resendAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendNotGet: {
    fontSize: 14,
    color: TEXT_GREY,          // otp-not-get class
  },
  resendLink: {
    fontSize: 14,
    color: PINK,               // logo-pink send-again-otp
    fontWeight: '600',
  },
  resendChevron: {
    fontSize: 16,
    color: PINK,               // skip-icon logo-pink
  },

  // Confirm button — round, gradient (otpcontinuebtn color)
  confirmRow: {
    marginBottom: 20,
  },
  btnWrap: {
    borderRadius: 100,
    overflow: 'hidden',
  },
  btn: {
    height: 52,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // not-registered-change row
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeLabel: {
    fontSize: 14,
    color: TEXT_GREY,
  },
  changeLink: {
    fontSize: 14,
    color: PINK,               // logo-pink
    fontWeight: '600',
  },
  changeChevron: {
    fontSize: 16,
    color: PINK,
  },
})
