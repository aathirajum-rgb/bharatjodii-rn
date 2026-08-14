import Constants from 'expo-constants'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
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
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import AppHeader from '../../components/app-header/AppHeader'
import OTPSuccessSheet from '../../components/bottom-sheet/OTPSuccessSheet'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { parseAndStoreWebViewURL, resendOTP, verifyOTP } from '../../service/registrationService'
import { getItem, setItem } from '../../service/storageService'
import { StorageKeys } from '../../constants/storage.keys'
import { useAuth } from '../../contexts/AuthContext'
import { CDN_REG } from '../../constants/cdn'

// ─── Constants ────────────────────────────────────────────────────────────────

const OTP_LENGTH  = 4
const TIMER_START = 59  // matches Angular resendotpTimer = 59
const CDN         = CDN_REG

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: any
  route: { params: { mobile: string; countryCode: string; matriId: string; isNewUser?: boolean } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OTPScreen({ navigation, route }: Props) {
  const { mobile, countryCode, matriId, isNewUser: routeIsNewUser } = route.params
  // If caller explicitly passes isNewUser, use it; otherwise infer from empty matriId
  const isRegistrationFlow = routeIsNewUser ?? (matriId === '')
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { loginUpdate } = useAuth()

  const [otpValues,    setOtpValues]    = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error,        setError]        = useState('')
  const [seconds,      setSeconds]      = useState(TIMER_START)
  const [loading,      setLoading]      = useState(false)
  const [resending,    setResending]    = useState(false)
  const [showSuccess,  setShowSuccess]  = useState(false)

  // Hold userId + new-user flag until OTPSuccessSheet dismisses
  const pendingUserId = useRef<string>('')
  const pendingIsNew  = useRef<boolean>(false)
  // Angular: webview.page.ts's :page_id route param, extracted from WEBVIEWURL —
  // drives pageLandingService.ts's post-login routing dispatch.
  const pendingPageId = useRef<string | undefined>(undefined)

  const inputRefs     = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null))

  // Auto-focus first box once the push transition finishes — matches Angular
  // ionViewDidEnter setFocusOnOtpPage. Waiting for 'transitionEnd' (rather than a
  // fixed setTimeout) avoids a KeyboardAvoidingView('height') quirk on Android:
  // if the keyboard opens while the screen is still mid-transition, its very
  // first resize computation runs before the view's layout has settled and gets
  // silently dropped — the CTA then stays hidden behind the keyboard until the
  // next focus change.
  useEffect(() => {
    const sub = navigation.addListener('transitionEnd', () => {
      inputRefs.current[0]?.focus()
    })
    return sub
  }, [navigation])

  // Countdown timer — matches Angular startCountdown()
  useEffect(() => {
    if (seconds <= 0) return
    const id = setInterval(() => setSeconds(s => s - 1), 1000)
    return () => clearInterval(id)
  }, [seconds])

  // ── Helpers ────────────────────────────────────────────────────────────────

  function formatTimer(s: number) {
    const m   = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  function buildParams(otp?: string) {
    return {
      ID:           matriId,
      MOBILENO:     mobile,
      MCODE:        countryCode,
      NEWREG:       '1',
      APPVERSION:   Constants.expoConfig?.version ?? '1.0.0',
      DEVICEDETAIL: '{}',
      DEVICEID:     '',
      REGISTERID:   '',
      ...(otp ? { OTP: otp } : {}),
    }
  }

  // isOtpCompleteAndValid — matches Angular: every value is a single digit
  const isValid = otpValues.every(v => /^[0-9]$/.test(v))

  // ── OTP box handlers ───────────────────────────────────────────────────────

  function handleChange(text: string, index: number) {
    // Paste support: distribute digits across boxes — matches Angular onPaste()
    if (text.length > 1) {
      const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH)
      const next   = Array(OTP_LENGTH).fill('')
      for (let i = 0; i < digits.length; i++) next[i] = digits[i]
      setOtpValues(next)
      setError('')
      inputRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus()
      return
    }

    const digit   = text.replace(/\D/g, '')
    const updated = [...otpValues]
    updated[index] = digit
    setOtpValues(updated)
    if (error) setError('')

    // Auto-advance — matches Angular otpController next logic
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyPress(key: string, index: number) {
    // Backspace on empty box → clear prev + focus prev — matches Angular otpController prev logic
    if (key === 'Backspace' && !otpValues[index] && index > 0) {
      const updated = [...otpValues]
      updated[index - 1] = ''
      setOtpValues(updated)
      inputRefs.current[index - 1]?.focus()
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleVerify() {
    if (!isValid || loading) return
    setLoading(true)
    setError('')
    try {
      const nallow = await getItem('NALLOW') ?? '0'
      const res    = await verifyOTP('otp', { ...buildParams(otpValues.join('')), NALLOW: nallow })
      if (res?.RESPONSECODE == 1) {
        // Store tokens — wrapped so a storage failure doesn't block the success UI.
        // ATN/RTN are at root of response; WEBVIEWURL carries profile data only.
        try {
          // Existing registered users have ATN at the root of the response.
          // New unregistered users have no root ATN — their token is embedded
          // inside the WEBVIEWURL JSON and extracted by parseAndStoreWebViewURL.
          pendingIsNew.current = !res.ATN
          if (res.ATN) await setItem(StorageKeys.Auth.TOKEN, res.ATN)
          if (res.RTN) await setItem(StorageKeys.Auth.REFRESH_TOKEN, res.RTN)
          if (res?.RESPONSE?.WEBVIEWURL) {
            pendingPageId.current = await parseAndStoreWebViewURL(res.RESPONSE.WEBVIEWURL)
          }
          pendingUserId.current = (await getItem(StorageKeys.Auth.USER_ID)) ?? ''
          // Angular authguard: LASTAPPLOGINAT tracks when we last autologined.
          // Save on every successful login so the 1hr gate in MatchesScreen starts fresh.
          await setItem('LASTAPPLOGINAT', new Date().toISOString())
        } catch (storageErr) {
          if (__DEV__) console.error('[OTP] storage error (non-fatal):', storageErr)
        }
        setShowSuccess(true)
      } else {
        const msg = res?.ERRMSG ?? res?.RESPONSE?.MSG ?? res?.ERRORMESSAGE
          ?? t('LOGIN_PAGE.ENTERVALIDOTP', 'Please enter a valid OTP')
        setError(msg)
        setOtpValues(Array(OTP_LENGTH).fill(''))
        setTimeout(() => inputRefs.current[0]?.focus(), 50)
      }
    } catch (e) {
      if (__DEV__) console.error('[OTP] handleVerify network error:', e)
      setError(t('GENERAL.NOINTERNET', 'No internet connection'))
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (resending || seconds > 0) return
    setResending(true)
    setError('')
    try {
      const res = await resendOTP('resendotp', buildParams())
      if (res?.RESPONSECODE == 1) {
        setOtpValues(Array(OTP_LENGTH).fill(''))
        setSeconds(TIMER_START)   // matches Angular clearIntervalTime + startCountdown
        setTimeout(() => inputRefs.current[0]?.focus(), 50)
      } else {
        setError(res?.ERRMSG ?? t('GENERAL.NOINTERNET', 'Failed to resend OTP'))
      }
    } catch {
      setError(t('GENERAL.NOINTERNET', 'No internet connection'))
    } finally {
      setResending(false)
    }
  }

  // Edit number → go back to LoginScreen — matches Angular redirectSignin()
  function handleEdit() {
    navigation.goBack()
  }

  // Angular subtitle: 'LOGIN_PAGE.DIGITCODE' with ##NO## replaced by mobile
  const subtitle = t('LOGIN_PAGE.DIGITCODE', "We've sent 4 digit code to")
    .replace('##NO##', mobile)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <AppHeader
        type="registration"
        showBackBtn
        onBackPress={handleEdit}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
      >
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* OTP illustration — CDN SVG (Angular: otpPage.ICONTYPE) */}
          <CdnSvg
            uri={CDN + 'otp.svg'}
            width={48}
            height={48}
            style={styles.icon}
          />

          {/* Title — i18n key: LOGIN_PAGE.ENT_OTP */}
          <Text style={styles.title}>
            {t('LOGIN_PAGE.ENT_OTP', 'Enter OTP')}
          </Text>

          {/* Subtitle: "We've sent 4 digit code to" + phone + edit link */}
          <View style={styles.subtitleBlock}>
            <Text style={styles.subtitleText}>{subtitle}</Text>

            <View style={styles.phoneRow}>
              <Text style={styles.phoneNumber}>{mobile}</Text>
              <Pressable style={styles.editBtn} onPress={handleEdit} hitSlop={8}>
                <CdnSvg
                  uri={CDN + 'edit-pencil.svg'}
                  width={14}
                  height={14}
                  style={styles.editIcon}
                />
                <Text style={styles.editText}>{t('LOGIN_PAGE.EDIT', 'Edit')}</Text>
              </Pressable>
            </View>
          </View>

          {/* 4 OTP boxes — matches Angular otp-inputs list (Figma: 48×48, gap 24) */}
          <View style={styles.otpRow}>
            {Array.from({ length: OTP_LENGTH }, (_, i) => (
              <TextInput
                key={i}
                ref={r => { inputRefs.current[i] = r }}
                style={[
                  styles.otpBox,
                  otpValues[i] ? styles.otpBoxFilled : styles.otpBoxEmpty,
                  !!error      ? styles.otpBoxError  : null,
                ]}
                value={otpValues[i]}
                onChangeText={text => handleChange(text, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={2}         // 2 to allow paste detection; trimmed in handleChange
                returnKeyType={i === OTP_LENGTH - 1 ? 'done' : 'next'}
                onSubmitEditing={i === OTP_LENGTH - 1 ? handleVerify : undefined}
                selectTextOnFocus
                // @ts-ignore — suppress web focus ring
                outlineStyle="none"
              />
            ))}
          </View>

          {/* Inline error — matches Angular otp-error-msg div */}
          {!!error && (
            <Text style={styles.errorText}>
              {error}
            </Text>
          )}

          {/* Timer / Resend — matches Angular timer + resend divs */}
          <View style={styles.resendRow}>
            {seconds > 0 ? (
              <Text style={styles.resendText}>
                {t('LOGIN_PAGE.RESENDOTP', `Didn't receive OTP? Resend in ##TIMER##`)
                  .replace('##TIMER##', formatTimer(seconds))}
              </Text>
            ) : (
              <Text style={styles.resendText}>
                {t('LOGIN_PAGE.SENDOTP', "Didn't receive OTP? ")}
                <Text
                  style={[styles.resendLink, resending && styles.resendDisabled]}
                  onPress={handleResend}
                >
                  {t('LOGIN_PAGE.RESEND', 'Resend')}
                </Text>
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Sticky "Verify OTP" CTA — matches Angular otp-cta div */}
        <View style={[styles.footer, { paddingBottom: Platform.OS === 'ios' ? insets.bottom : 20 }]}>
          <ButtonRevamp
            label={t('LOGIN_PAGE.VERIFYOTP', 'Verify OTP')}
            variant="primary"
            size="standard"
            fullWidth
            disabled={!isValid}
            loading={loading}
            onPress={handleVerify}
          />
        </View>
      </KeyboardAvoidingView>
      {/* OTP success bottom sheet — auto-closes after 3s then switches stack.
          New registration → AppStack opens at 'onboarding' page 1.
          Existing login    → AppStack opens at 'Home'. */}
      <OTPSuccessSheet
        visible={showSuccess}
        onDismiss={() => loginUpdate(pendingUserId.current, isRegistrationFlow, pendingPageId.current)}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: Colors.surface,
  },
  flex1: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop:        24,
    paddingBottom:     32,
  },

  // OTP illustration (Figma: 48×48)
  icon: {
    width:        48,
    height:       48,
    marginBottom: 24,
  },

  // Title — "Enter OTP" (Figma: Poppins SemiBold 22px)
  title: {
    fontSize:     22,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    lineHeight:   28,
    marginBottom: 8,
  },

  // Subtitle block
  subtitleBlock: {
    gap:          4,
    marginBottom: 32,
  },
  subtitleText: {
    fontSize:   14,
    color:      Colors.textPrimary,
    lineHeight: 20,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  phoneNumber: {
    fontSize:   14,
    fontWeight: '600',
    color:      Colors.textPrimary,
    lineHeight: 20,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  editIcon: {
    width:  14,
    height: 14,
  },
  editText: {
    fontSize:   14,
    color:      Colors.link,    // #29339B — matches Figma "Edit" blue
    lineHeight: 20,
  },

  // ── 4 OTP boxes (Figma: 48×48px, gap 24px, centred) ──────────────────────
  otpRow: {
    flexDirection: 'row',
    gap:           16,
    marginBottom:  8,
  },
  otpBox: {
    width:              56,
    height:             56,
    borderWidth:        1,
    borderRadius:       8,
    fontSize:           22,
    fontWeight:         '600',
    color:              Colors.textPrimary,
    backgroundColor:    Colors.surface,
    textAlign:          'center',
    textAlignVertical:  'center',   // Android vertical centering
    paddingVertical:    0,          // remove default padding that pushes text to top
    includeFontPadding: false,      // Android: strip extra font metric padding
  },
  otpBoxEmpty: {
    borderColor: Colors.inputBorder,
  },
  otpBoxFilled: {
    borderColor: Colors.inputBorder,
  },
  otpBoxError: {
    borderColor: Colors.inputError,
  },

  // Error — "Please enter a valid OTP" in #DE2A68
  errorText: {
    marginTop:  4,
    marginLeft: 4,
    fontSize:   12,
    color:      Colors.inputError,
    lineHeight: 16,
  },

  // Timer / Resend
  resendRow: {
    marginTop: 16,
  },
  resendText: {
    fontSize:   14,
    color:      Colors.textPrimary,
    lineHeight: 20,
  },
  resendLink: {
    fontWeight: '500',
    color:      Colors.link,     // #29339B — Figma "Resend" blue
  },
  resendDisabled: {
    opacity: 0.5,
  },

  // Sticky CTA footer
  footer: {
    paddingHorizontal: 24,
    paddingTop:        12,
    backgroundColor:   Colors.surface,
  },
})
