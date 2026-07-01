import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Animated,
  Image,
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
import AppHeader from '../../components/app-header/AppHeader'
import { CDN_REG, CDN_SVG } from '../../constants/cdn'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
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

  const inputRef  = useRef<TextInput>(null)
  const labelAnim = useRef(new Animated.Value(0)).current

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

  const labelColor = labelAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [
      Colors.inputBorder,
      hasError ? Colors.inputError : focused ? Colors.inputFocus : Colors.inputBorder,
    ],
  })

  const borderColor = hasError ? Colors.inputError : focused ? Colors.inputFocus : Colors.inputBorder

  // Title from i18n — Angular stores it with <br /> tag, strip to \n
  const title = t('LOGIN_PAGE.ENT_UR_MOBILE', 'Enter your\nmobile number')
    .replace(/<br\s*\/?>/gi, '\n')

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header: back | audio | language pill */}
      <AppHeader
        type="registration"
        showBackBtn
        onBackPress={() => navigation.canGoBack() && navigation.goBack()}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Phone illustration — CDN SVG (same source as Angular signin.config.ts ICONTYPE) */}
          <Image
            source={{ uri: CDN_REG + 'mobile.svg' }}
            style={styles.phoneImg}
            resizeMode="contain"
          />

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Mobile number input — floating label + country code prefix */}
          <View style={[styles.inputBox, { borderColor }]}>
            <Animated.Text
              style={[styles.floatLabel, { top: labelTop, fontSize: labelSize, color: labelColor }]}
              pointerEvents="none"
            >
              {t('LOGIN_PAGE.MOBILE_NO')}
            </Animated.Text>

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
                <Image
                  source={{ uri: CDN_SVG + 'chevron_down.svg' }}
                  style={[styles.chevron, dropOpen && styles.chevronUp]}
                />
              </Pressable>

              <View style={styles.separator} />

              {/* Phone number text input */}
              <TextInput
                ref={inputRef}
                style={[styles.textInput, webReset]}
                value={mobile}
                onChangeText={handleMobileChange}
                onFocus={() => { setFocused(true); setDropOpen(false) }}
                onBlur={() => { setFocused(false); setTouched(true) }}
                keyboardType="number-pad"
                placeholder={focused ? t('LOGIN_PAGE.ENT_MOBILE') : ''}
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

  // Phone illustration — CDN SVG (Angular: signin.config.ts ICONTYPE → registration-new/mobile.svg)
  phoneImg: {
    width:        48,
    height:       48,
    marginBottom: 24,
  },

  // Title — "Enter your\nmobile number" (Figma: Poppins Bold 28px)
  title: {
    fontSize:     28,
    fontWeight:   '700',
    color:        Colors.textPrimary,
    lineHeight:   36,
    marginBottom: 32,
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
    position:          'absolute',
    left:              12,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
    zIndex:            10,
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
    fontSize:   14,
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
    fontSize:        14,
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
    fontSize: 14,
    color:    Colors.textPrimary,
  },
  dropTextActive: {
    color:      Colors.primaryDark,
    fontWeight: '600',
  },

  // ── Error ───────────────────────────────────────────────────────────────────
  errorText: {
    marginTop:  6,
    marginLeft: 4,
    fontSize:   12,
    color:      Colors.inputError,
  },

  // ── Footer CTA ──────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 24,
    paddingTop:        12,
    backgroundColor:   Colors.surface,
  },
})
