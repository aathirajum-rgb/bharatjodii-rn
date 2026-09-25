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
import { isAvailableAsync, showPhoneNumberHintAsync } from 'expo-phone-number-hint'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import ProfileDeactivatedModal, { type ProfileDeactivateInfo } from '../../components/auth/ProfileDeactivatedModal'
import NotificationPermissionSheet from '../../components/notification-permission-sheet/NotificationPermissionSheet'
import { requestPushNotificationPermission } from '../../service/permissionService'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import AppHeader from '../../components/app-header/AppHeader'
import { CDN_REG, CDN_SVG } from '../../constants/cdn'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { Fonts, FontSize } from '../../src/theme/fonts'
import { StorageKeys } from '../../constants/storage.keys'
import { callPartialRegistrationAPI, login, setRegValues } from '../../service/registrationService'
import { getItem, setItem } from '../../service/storageService'
import { ENavigation } from '../../types/enums/navigation.enum'

// ─── Country codes (Angular signin.config.ts: COUNTRYCODELIST) ────────────────

const COUNTRIES = [
  { code: '91',  name: 'India',                minLen: 10, maxLen: 10 },
  { code: '971', name: 'United Arab Emirates', minLen: 8,  maxLen: 10 },
  { code: '974', name: 'Qatar',                minLen: 8,  maxLen: 10 },
  { code: '965', name: 'Kuwait',               minLen: 8,  maxLen: 10 },
  { code: '968', name: 'Oman',                 minLen: 8,  maxLen: 10 },
  { code: '973', name: 'Bahrain',              minLen: 8,  maxLen: 10 },
  { code: '966', name: 'Saudi Arabia',         minLen: 8,  maxLen: 10 },
] as const

type Country = (typeof COUNTRIES)[number]

// Converts a Phone Number Hint result into the LOCAL (national) number this
// field expects, i.e. without the country dial code.
//
// Prefers the library's own `e164` — it is derived by Android's bundled
// libphonenumber against the SIM's region, so when it is present the leading
// country code is known to be there and stripping it is safe.
//
// The previous implementation only had the raw `number` and used
// `digits.startsWith(country.code)` as the test. That silently CORRUPTS any
// national number whose own first digits happen to match the dial code — an
// Indian mobile like 9188888888 (10 digits, no country code) starts with "91",
// so it was cut down to "88888888" and the field ended up with the wrong
// number. The length check below is what makes the fallback safe: only strip
// when the number is actually longer than a local one can be.
//
// `e164` can't be trusted on its own either: it's built with the SIM's region,
// and for a hint like "919344874134" (country code included, no "+") on a
// dual-SIM device it came back mangled — stripping "91" off it put
// "1919344874" in the field. So every reading is tried and the first one that
// passes the field's own validation wins; the raw number with its visible
// country code stripped goes first, since that's what the user tapped.
function toLocalNumber(hint: { number: string; e164: string | null }, country: Country): string {
  const digits = hint.number.replace(/\D/g, '')
  const e164Digits = hint.e164 ? hint.e164.replace(/\D/g, '') : ''

  const candidates = [
    digits.length > country.maxLen && digits.startsWith(country.code) ? digits.slice(country.code.length) : '',
    e164Digits.startsWith(country.code) ? e164Digits.slice(country.code.length) : '',
    digits,
  ].filter(Boolean)

  const local = candidates.find(c => isValidMobile(c, country)) ?? candidates[0] ?? ''
  return local.slice(0, country.maxLen)
}

// New-user onboarding order: Splash → Language → this screen, where the
// "Turn on notifications" sheet comes up first. Shown once per install, and
// never when permission is already granted (or on web / Expo Go, which have
// no native push permission to ask for).
const LOGIN_NOTIF_PROMPT_SHOWN = 'LOGIN_NOTIF_PROMPT_SHOWN'

async function shouldShowNotificationPrompt(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false
  if (await getItem(LOGIN_NOTIF_PROMPT_SHOWN)) return false
  try {
    const Notifications = await import('expo-notifications')
    const { status } = await Notifications.getPermissionsAsync()
    return status !== 'granted'
  } catch {
    return false
  }
}

// Angular signin.page.ts validateMobileNumber() — exact regex match
function isValidMobile(mobile: string, country: Country): boolean {
  if (mobile.length < country.minLen || mobile.length > country.maxLen) return false
  const re = country.code === '91' ? /^[6-9][0-9]{7,11}$/ : /^[5-9][0-9]{7,11}$/
  return re.test(mobile)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginScreen({ navigation }: { navigation: any }) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [country,  setCountry]  = useState<Country>(COUNTRIES[0])
  const [mobile,   setMobile]   = useState('')
  const [dropOpen, setDropOpen] = useState(false)
  const [focused,  setFocused]  = useState(false)
  const [touched,  setTouched]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [deactivateInfo, setDeactivateInfo] = useState<ProfileDeactivateInfo | null>(null)

  const inputRef  = useRef<TextInput>(null)
  // Guards against re-showing the picker on every re-focus — matches Android's
  // LoginActivity.kt `phoneHint` boolean (requestPhoneNoHint() only fires once).
  const phoneHintRequested = useRef(false)
  // Latest typed value, readable after requestPhoneHint's 1s wait.
  const mobileRef = useRef('')
  mobileRef.current = mobile

  // Restore previously used country code
  useEffect(() => {
    getItem(StorageKeys.User.MEMBER_CODE).then(saved => {
      const found = COUNTRIES.find(c => c.code === saved)
      if (found) setCountry(found)
    })
  }, [])

  // "Turn on notifications" sheet — first thing on this screen for a new
  // user. The mobile field is deliberately NOT auto-focused: it stays grey
  // until the user taps it, and that tap is what brings up the number picker.
  const [showNotifSheet, setShowNotifSheet] = useState(false)
  useEffect(() => {
    let cancelled = false
    shouldShowNotificationPrompt().then(async show => {
      if (cancelled || !show) return
      await setItem(LOGIN_NOTIF_PROMPT_SHOWN, '1')
      setShowNotifSheet(true)
    })
    return () => { cancelled = true }
  }, [])

  async function handleEnableNotifications() {
    setShowNotifSheet(false)
    await requestPushNotificationPermission()
  }

  // Google Phone Number Hint (Android only, no-op elsewhere) — matches
  // Android's LoginActivity.kt requestPhoneNoHint(), fired once on the mobile
  // field's first focus. Strips the currently-selected country's dial code
  // from the returned number the same way Android's regex did for India.
  async function requestPhoneHint() {
    if (phoneHintRequested.current) return
    phoneHintRequested.current = true
    try {
      if (!(await isAvailableAsync())) return
      // Picker comes up 1s after the user taps into the field — and not at
      // all if they've tapped away or started typing in the meantime.
      await new Promise(resolve => setTimeout(resolve, 1000))
      if (!inputRef.current?.isFocused() || mobileRef.current) {
        phoneHintRequested.current = false
        return
      }
      const result = await showPhoneNumberHintAsync()
      if (result.canceled) {
        // Dismissing the picker must not burn the one-shot guard — otherwise
        // re-focusing the field never offers the number again.
        phoneHintRequested.current = false
        return
      }
      setMobile(toLocalNumber(result.hint, country))
    } catch (e) {
      // Non-fatal — the user can still type their number. But DO NOT swallow
      // silently: the native module rejects with real, diagnosable codes
      // (ERR_EXTRACTION_FAILED, ERR_PLAY_SERVICES_UNAVAILABLE,
      // ERR_NO_HINT_AVAILABLE, ERR_ALREADY_IN_PROGRESS...), and an empty catch
      // made "picker opens, selection does nothing" impossible to diagnose.
      if (__DEV__) console.warn('[LoginScreen] phone number hint failed:', e)
      // Let the user try again by re-focusing the field.
      phoneHintRequested.current = false
    }
  }

  const valid = isValidMobile(mobile, country)
  // Show validation error only after user has left the field (touched), not while typing
  const showValidationError = touched && mobile.length > 0 && !valid && !error

  function handleMobileChange(text: string) {
    const cleaned = text.replace(/\D/g, '').slice(0, country.maxLen)
    setMobile(cleaned)
    if (error) setError('')
  }

  function selectCountry(c: Country) {
    setCountry(c)
    setDropOpen(false)
    setMobile('')
    setError('')
    setTouched(false)
    setItem(StorageKeys.User.MEMBER_CODE, c.code)
    inputRef.current?.focus()
  }

  async function handleGetOtp() {
    if (!valid || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await login('login', { MOBILENO: mobile, MCODE: country.code, NEWREG: '1' })

      if (res?.ERRCODE == '0' && res?.RESPONSECODE == '1') {
        // Existing user — go straight to OTP verification
        navigation.navigate(ENavigation.OTP, {
          mobile,
          countryCode: country.code,
          matriId: String(res?.RESPONSE?.MATRIID ?? ''),
        })
        // Android checks this deactivation case (RESPONSECODE==2 && ERRCODE==1)
        // BEFORE the new-user/WEBVIEWURL branch below — same precedence here,
        // since a deactivated response could otherwise be misread as new-user.
      } else if (res?.RESPONSECODE == '2' && res?.ERRCODE == '1' && res?.RESPONSE?.PROFILEDEACTIVATESTATUS == '1') {
        setDeactivateInfo({
          title:          res.RESPONSE?.MSGERR?.TITLE ?? '',
          body:           res.RESPONSE?.MSGERR?.BODY ?? '',
          cta:            res.RESPONSE?.MSGERR?.CTA ?? '',
          wcta:           res.RESPONSE?.MSGERR?.WCTA ?? '',
          callingNumber:  res.RESPONSE?.CALLINGNUMBER ?? '',
          whatsappNumber: res.RESPONSE?.CONTACTWTNUMBER ?? '',
        })
      } else if (res?.ERRCODE == '1' && res?.RESPONSECODE == '2' && res?.RESPONSE?.WEBVIEWURL) {
        // New user — save mobile, fire partial registration, then go to OTP for phone verification
        await setRegValues({ MOBILENO: mobile, MCODE: country.code })
        callPartialRegistrationAPI({})  // fire-and-forget, mirrors Angular callPartialRegistrationAPI()
        navigation.navigate(ENavigation.OTP, {
          mobile,
          countryCode: country.code,
          matriId: '',
        })
      } else {
        setError(res?.RESPONSE?.MSG ?? res?.ERRMSG ?? res?.ERRORMESSAGE ?? t('LOGIN_PAGE.VALID_MOBILENO'))
      }
    } catch {
      setError(t('GENERAL.NOINTERNET'))
    } finally {
      setLoading(false)
    }
  }

  const hasError = !!error || showValidationError

  // Border color: red whenever the warning text below the box is showing
  // (so the two always agree), else blue while the field is tapped into,
  // else grey — including the untouched state on first arrival.
  const borderColor = hasError
    ? Colors.inputError
    : focused
      ? Colors.inputFocus
      : Colors.inputBorder

  // Title from i18n — Angular stores it with <br /> tag (padded with stray spaces,
  // e.g. "Enter your <br /> mobile number"), so strip surrounding whitespace too —
  // otherwise the second line renders with a leading-space indent.
  const title = t('LOGIN_PAGE.ENT_UR_MOBILE', 'Enter your\nmobile number')
    .replace(/\s*<br\s*\/?>\s*/gi, '\n')

  return (
    <View style={styles.screen}>
      {/* Header: back | audio | language pill */}
      <AppHeader
        type="registration"
        showBackBtn={false}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />

      {/* AppHeader above is a normal layout sibling (not a react-navigation
          native header), so RN's automatic frame measurement already knows
          this view starts below it — an explicit keyboardVerticalOffset here
          double-counts that header height and left a large gap above the
          keyboard on iOS. */}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Phone illustration — CDN SVG (same source as Angular signin.config.ts ICONTYPE) */}
          <CdnSvg
            uri={CDN_REG + 'mobile.svg'}
            width={48}
            height={48}
            style={styles.phoneImg}
          />

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Mobile number input — Angular signin.page.html's `.mobile-number`
              ion-item: the "Mobile number" label is a fixed `.floating` div
              sitting on the top border (left 16, top -8), the country code and
              input follow with no divider, and the placeholder is always shown. */}
          <View style={[styles.inputBox, { borderColor }]}>
            <Text style={styles.floatLabel} pointerEvents="none">
              {t('LOGIN_PAGE.MOBILE_NO')}
            </Text>

            <View style={styles.inputRow}>
              {/* Country code picker — tapping opens inline dropdown */}
              <Pressable
                style={styles.codeBtn}
                onPress={() => {
                  setDropOpen(v => !v)
                  inputRef.current?.blur()
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Country code +${country.code}`}
              >
                <Text style={styles.codeText}>+{country.code}</Text>
                <CdnSvg
                  uri={CDN_SVG + 'chevron_down.svg'}
                  width={18}
                  height={18}
                  style={[dropOpen && styles.chevronUp]}
                />
              </Pressable>

              {/* Phone number text input */}
              <TextInput
                ref={inputRef}
                style={[styles.textInput, webReset]}
                value={mobile}
                onChangeText={handleMobileChange}
                onFocus={() => { setFocused(true); setDropOpen(false); requestPhoneHint() }}
                onBlur={() => { setFocused(false); setTouched(true) }}
                keyboardType="number-pad"
                placeholder={t('LOGIN_PAGE.ENT_MOBILE')}
                placeholderTextColor={Colors.textPlaceholder}
                maxLength={country.maxLen}
                returnKeyType="done"
                onSubmitEditing={handleGetOtp}
                autoComplete="tel"
                // suppress web focus ring
                // @ts-ignore
                outlineStyle="none"
              />
            </View>
          </View>

          {/* Country code dropdown — inline below input (Figma node 12536:13613) */}
          {dropOpen && (
            <View style={styles.dropdown}>
              {COUNTRIES.map(c => {
                const isActive = c.code === country.code
                return (
                  <Pressable
                    key={c.code}
                    style={({ pressed }) => [styles.dropRow, pressed && styles.dropRowPressed]}
                    onPress={() => selectCountry(c)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[styles.dropText, isActive && styles.dropTextActive]}>
                      +{c.code} ({c.name})
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )}

          {/* Validation / API error */}
          {hasError && (
            <Text style={styles.errorText}>
              {error || t('LOGIN_PAGE.VALID_MOBILENO')}
            </Text>
          )}
        </ScrollView>

        {/* Sticky "Get OTP" CTA — rises above keyboard via KeyboardAvoidingView */}
        <View style={[styles.footer, { paddingBottom: Platform.OS === 'ios' ? insets.bottom : 20 }]}>
          <ButtonRevamp
            label={t('LOGIN_PAGE.GET_OTP', 'Get OTP')}
            variant="primary"
            size="standard"
            fullWidth
            disabled={!valid}
            loading={loading}
            onPress={handleGetOtp}
          />
        </View>
      </KeyboardAvoidingView>

      <ProfileDeactivatedModal
        visible={!!deactivateInfo}
        info={deactivateInfo}
        onClose={() => setDeactivateInfo(null)}
      />

      <NotificationPermissionSheet
        visible={showNotifSheet}
        onEnable={handleEnableNotifications}
        onClose={() => setShowNotifSheet(false)}
      />
    </View>
  )
}

// Suppress browser focus ring on web — same pattern as FloatingLabelInput
const webReset = { outlineStyle: 'none' } as any

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

  // Phone illustration — CDN SVG (Angular: signin.config.ts ICONTYPE → registration-new/mobile.svg).
  // Angular: signin.page.html:7-12 — the title's own <ion-col> carries `mt-32`
  // (margin-top: 32px !important, global.scss:1306), which is the actual gap
  // between the icon and the title (icon div itself has no bottom margin).
  // This was 24 — the icon↔title and title↔input gaps were swapped with the
  // ones below.
  phoneImg: {
    width:        48,
    height:       48,
    marginBottom: 32,
  },

  // Title — "Enter your\nmobile number" (Figma + Angular heading1-semibold-22: Poppins SemiBold 22px)
  // Angular: signin.page.html:21 — the mobile-number <ion-col> carries `mt-24`
  // (margin-top: 24px !important, global.scss:1355), the gap between the
  // title and the input box. This was 32 (swapped with phoneImg's gap above).
  title: {
    fontFamily:   Fonts.poppinsSemiBold,
    fontSize:     FontSize.font22,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    marginBottom: 24,
  },

  // ── Mobile input ────────────────────────────────────────────────────────────
  // Angular .mobile-number: ion-item min-height 48, radius 8, 1px border.
  inputBox: {
    borderWidth:     1,
    borderRadius:    8,
    height:          48,
    overflow:        'visible',
    position:        'relative',
    backgroundColor: Colors.surface,
  },
  // Angular .floating { position:absolute; left:16px; top:-8px; background:#fff;
  // padding:0 4px } + `body3-regular-12 black-color`.
  floatLabel: {
    position:          'absolute',
    top:               -9,
    left:              12,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
    zIndex:            10,
    fontFamily:        Fonts.poppinsRegular,
    fontSize:          FontSize.font12,
    lineHeight:        18,
    color:             Colors.black,
  },
  // Angular ion-item.mobile-number: --inner-padding-start 16px.
  inputRow: {
    flexDirection:     'row',
    alignItems:        'center',
    height:            '100%',
    paddingHorizontal: 16,
  },
  codeBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    paddingRight:  12,
    height:        '100%',
    justifyContent: 'center',
  },
  codeText: {
    fontFamily: Fonts.poppinsMedium,
    fontSize:   FontSize.font14,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  textInput: {
    flex:            1,
    fontFamily:      Fonts.poppinsRegular,
    fontSize:        FontSize.font14,
    color:           Colors.textPrimary,
    paddingVertical: 0,
  },
  chevron: {
    width:  12,
    height: 12,
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },

  // ── Inline country dropdown ─────────────────────────────────────────────────
  dropdown: {
    marginTop:       4,
    borderWidth:     1,
    borderColor:     Colors.inputBorder,
    borderRadius:    8,
    backgroundColor: Colors.surface,
    overflow:        'hidden',
  },
  dropRow: {
    paddingVertical:   14,
    paddingHorizontal: 16,
  },
  dropRowPressed: {
    backgroundColor: Colors.selectionBg,
  },
  dropText: {
    fontFamily: Fonts.poppinsRegular,
    fontSize:   FontSize.font14,
    color:      Colors.textPrimary,
  },
  dropTextActive: {
    fontFamily: Fonts.poppinsSemiBold,
    color:      Colors.primaryDark,
    fontWeight: '600',
  },

  // ── Error ───────────────────────────────────────────────────────────────────
  // Angular: signin.page.html:41 — `color-de2a68 mt-8 body3-regular-12`, no
  // left-offset class at all (sits flush with the row's own pl-24 padding).
  // mt-8 is margin-top: 8px !important (global.scss:1375) — this was 6, and
  // the extra marginLeft: 4 had no Angular source.
  errorText: {
    fontFamily: Fonts.poppinsRegular,
    marginTop:  8,
    fontSize:   FontSize.font12,
    color:      Colors.inputError,
  },

  // ── Footer CTA ──────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 24,
    paddingTop:        12,
    backgroundColor:   Colors.surface,
  },
})
