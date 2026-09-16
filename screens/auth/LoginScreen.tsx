import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Animated,
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
import ProfileDeactivatedModal, { type ProfileDeactivateInfo } from '../../components/auth/ProfileDeactivatedModal'
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
import { handleBack } from '../../utils/navigationRef'
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
  const labelAnim = useRef(new Animated.Value(0)).current
  // Measured width of the country-code Pressable (+91 chevron etc.) — the
  // floating label's `left` is derived from this instead of sharing the same
  // hardcoded offset as the code button, so the two never sit on top of each
  // other (QA #49). Seeded with a rough guess matching the default "+91" so
  // there's no visible jump before the first onLayout measurement lands.
  const [codeWidth, setCodeWidth] = useState(50)
  // Guards against re-showing the picker on every re-focus — matches Android's
  // LoginActivity.kt `phoneHint` boolean (requestPhoneNoHint() only fires once).
  const phoneHintRequested = useRef(false)

  // Restore previously used country code
  useEffect(() => {
    getItem(StorageKeys.User.MEMBER_CODE).then(saved => {
      const found = COUNTRIES.find(c => c.code === saved)
      if (found) setCountry(found)
    })
  }, [])

  // Auto-focus input on mount — matches Angular ionViewDidEnter setTimeout setFocus(100ms)
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300)
    return () => clearTimeout(t)
  }, [])

  // Float the "Mobile number" label when focused or value present
  useEffect(() => {
    Animated.timing(labelAnim, {
      toValue:         focused || mobile.length > 0 ? 1 : 0,
      duration:        150,
      useNativeDriver: false,
    }).start()
  }, [focused, mobile])

  // Google Phone Number Hint (Android only, no-op elsewhere) — matches
  // Android's LoginActivity.kt requestPhoneNoHint(), fired once on the mobile
  // field's first focus. Strips the currently-selected country's dial code
  // from the returned number the same way Android's regex did for India.
  async function requestPhoneHint() {
    if (phoneHintRequested.current) return
    phoneHintRequested.current = true
    try {
      if (!(await isAvailableAsync())) return
      const result = await showPhoneNumberHintAsync()
      if (result.canceled) return
      const digitsOnly = result.hint.number.replace(/\D/g, '')
      const stripped = digitsOnly.startsWith(country.code)
        ? digitsOnly.slice(country.code.length)
        : digitsOnly
      setMobile(stripped.slice(0, country.maxLen))
    } catch {
      // non-fatal — user can just type their number
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

  // ── Floating label interpolations ──────────────────────────────────────────
  const labelTop  = labelAnim.interpolate({ inputRange: [0, 1], outputRange: [17, -9] })
  const labelSize = labelAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 11] })
  const hasError = !!error || showValidationError

  // Border color: focused always wins (blue) regardless of value; unfocused
  // falls back to red when empty, grey when filled — same state machine as
  // NameScreen's Name input (Angular input-fields.component.scss precedence).
  // Red also requires `touched` (same flag showValidationError above uses) —
  // otherwise the box paints red on first mount / before the user has ever
  // interacted with it, just because it starts out empty (QA #9).
  const borderColor = focused
    ? Colors.inputFocus
    : touched && mobile.length === 0
      ? Colors.inputError
      : Colors.inputBorder

  const labelColor = labelAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [
      Colors.inputBorder,
      borderColor,
    ],
  })

  // Label's left offset: inputRow's own left padding (12) + the measured
  // country-code button width + the separator's width and right margin (1 +
  // 12). Used for BOTH the resting and floated-up label positions (it's not
  // part of the Animated interpolation — only top/fontSize/color animate) so
  // the label never lands under the country-code box in either state (QA #49,
  // and incidentally QA #4 / QA #10 which shared this same hardcoded offset).
  const labelLeft = 12 + codeWidth + 13

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
        showBackBtn
        onBackPress={() => handleBack()}
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

          {/* Mobile number input — floating label + country code prefix */}
          <View style={[styles.inputBox, { borderColor }]}>
            <Animated.Text
              style={[styles.floatLabel, { top: labelTop, left: labelLeft, fontSize: labelSize, color: labelColor }]}
              pointerEvents="none"
            >
              {t('LOGIN_PAGE.MOBILE_NO')}
            </Animated.Text>

            <View style={styles.inputRow}>
              {/* Country code picker — tapping opens inline dropdown */}
              <Pressable
                style={styles.codeBtn}
                onLayout={e => setCodeWidth(e.nativeEvent.layout.width)}
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
                  width={12}
                  height={12}
                  style={[dropOpen && styles.chevronUp]}
                />
              </Pressable>

              <View style={styles.separator} />

              {/* Phone number text input */}
              <TextInput
                ref={inputRef}
                style={[styles.textInput, webReset]}
                value={mobile}
                onChangeText={handleMobileChange}
                onFocus={() => { setFocused(true); setDropOpen(false); requestPhoneHint() }}
                onBlur={() => { setFocused(false); setTouched(true) }}
                keyboardType="number-pad"
                // The floating label rests INSIDE the box (same slot this
                // placeholder renders in) whenever it isn't floated up — i.e.
                // whenever `!(focused || mobile.length > 0)`, see the labelAnim
                // effect above. Gating on `focused` alone left this blank in
                // that exact resting case (QA #7), but showing it there too
                // would print "Enter your mobile number" right under/over the
                // resting "Mobile Number" label, especially now that both sit
                // at the same left offset (QA #49 fix). So this mirrors the
                // label's own floated condition rather than dropping the gate.
                placeholder={(focused || mobile.length > 0) ? t('LOGIN_PAGE.ENT_MOBILE') : ''}
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
  inputBox: {
    borderWidth:     1,
    borderRadius:    8,
    height:          56,
    overflow:        'visible',
    position:        'relative',
    backgroundColor: Colors.surface,
  },
  floatLabel: {
    // `left` is no longer a fixed value here — it's computed from the
    // measured country-code box width and applied inline (see `labelLeft`)
    // so the label can never land on top of the country-code button (QA #49).
    position:          'absolute',
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
    zIndex:            10,
    // Angular: signin.page.html:38 — `.floating body3-regular-12 black-color`.
    // body3-regular-12 sets font-family: var(--english-regular-poppins) =
    // Poppins-Regular (global.scss:2264). This was missing entirely, so the
    // label silently fell back to the OS system font in every state.
    fontFamily: Fonts.poppinsRegular,
  },
  inputRow: {
    flexDirection:     'row',
    alignItems:        'center',
    height:            '100%',
    paddingHorizontal: 12,
  },
  codeBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    paddingRight:  8,
    height:        '100%',
    justifyContent: 'center',
  },
  codeText: {
    fontFamily: Fonts.poppinsMedium,
    fontSize:   FontSize.font14,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  separator: {
    width:           1,
    height:          20,
    backgroundColor: Colors.border,
    marginRight:     12,
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
