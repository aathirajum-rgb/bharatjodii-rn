import { useEffect, useRef, useState } from 'react'
import {
  Alert,
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
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { login } from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { StorageKeys } from '../../constants/storage.keys'
import { ENavigation } from '../../types/enums/navigation.enum'

// ─── Brand tokens (from Angular variables.scss) ───────────────────────────────
const BG        = '#FAFAFA'
const TEXT_DARK = '#1F1E1B'
const TEXT_GREY = '#545454'
const BORDER    = '#BD8800'       // item-border-edit — always amber
const PINK      = '#DE2A68'

// Indian mobile: starts 6-9, exactly 10 digits
const MOBILE_RE = /^[6-9][0-9]{9}$/

export default function LoginScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets()

  const [mobile,  setMobile]  = useState('')
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<TextInput>(null)

  // Load returning user's name (shown in subtitle)
  useEffect(() => {
    getItem(StorageKeys.User.NAME).then(n => { if (n) setName(n.trim()) })
  }, [])

  const isValid  = MOBILE_RE.test(mobile)
  const canSubmit = isValid && !loading

  async function handleConfirm() {
    if (!canSubmit) return
    setLoading(true)
    try {
      const res = await login('login', { MOBILENO: mobile, MCODE: '91', NEWREG: '1' })
      if (res?.RESPONSECODE == 1) {
        const matriId = String(res?.RESPONSE?.MATRIID ?? '')
        navigation.navigate(ENavigation.OTP, { mobile, countryCode: '91', matriId })
      } else {
        Alert.alert('Error', res?.ERRMSG ?? res?.ERRORMESSAGE ?? 'Failed to send OTP. Please try again.')
      }
    } catch {
      Alert.alert('Error', 'Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const subtitle = name
    ? `Hi ${name}, please enter your mobile number to verify your profile`
    : 'Please enter your mobile number to verify your profile'

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* "Verify your profile using your mobile number" — matches Angular heading */}
        <Text style={styles.verifyLabel}>Verify your profile using your mobile number</Text>

        {/* Dynamic subtitle with user name */}
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Mobile input — amber border always (matches .item-border-edit) */}
        <View style={styles.inputCard}>
          <View style={styles.inputRow}>
            {/* +91- prefix inside the input — matches Angular <ion-text>+91-</ion-text> */}
            <Text style={styles.prefix}>+91-</Text>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Enter mobile number"
              placeholderTextColor="#AAAAAA"
              keyboardType="phone-pad"
              value={mobile}
              onChangeText={t => setMobile(t.replace(/\D/g, '').slice(0, 10))}
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
              autoComplete="tel"
              underlineColorAndroid="transparent"
            />
            {/* Edit icon — clears the field (matches Angular editValue()) */}
            {mobile.length > 0 && (
              <Pressable
                onPress={() => { setMobile(''); inputRef.current?.focus() }}
                style={styles.editBtn}
                hitSlop={8}
              >
                <Text style={styles.editIcon}>✎</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Inline validation hint */}
        {mobile.length > 0 && !isValid && (
          <Text style={styles.validHint}>
            {mobile.length < 10
              ? 'Enter a valid 10-digit mobile number'
              : 'Mobile number must start with 6, 7, 8 or 9'}
          </Text>
        )}
      </ScrollView>

      {/* Fixed bottom confirm button — matches .confirm-button-block-login (bottom: 24px) */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
        <ButtonRevamp
          label="Confirm"
          variant="primary"
          size="large"
          fullWidth
          loading={loading}
          disabled={!canSubmit}
          onPress={handleConfirm}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,    // matches --ion-cust-padding: 24px
    paddingBottom: 120,
  },
  logo: {
    width: 72,
    height: 72,
    alignSelf: 'center',
    marginBottom: 28,
  },

  // heading3-semibold-16, matches pageContent['VERIFY_PROFILE'] label
  verifyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_DARK,
    marginBottom: 8,
  },

  // header02 class — 16px medium, matches ENTER_MOBILE_TITLE row
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: TEXT_GREY,
    marginBottom: 28,
    lineHeight: 24,
  },

  // input-fields-style → ion-item.item-border-edit
  // border: 1px solid #BD8800, border-radius: 16px — ALWAYS amber, not just focused
  inputCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,    // matches --inner-padding-start: 16px
    height: 56,
  },

  // +91- prefix text — matches <ion-text class="pl-16">+91-</ion-text>
  // body2-regular-14 on ion-input means prefix inherits 14px regular
  prefix: {
    fontSize: 14,
    fontWeight: '400',
    color: TEXT_DARK,
    marginRight: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT_DARK,
    height: '100%',
    // suppress native focus ring on web and underline on Android
    outlineWidth: 0,
    borderWidth: 0,
  },

  // Edit icon — matches .edit-icon-id-verification
  editBtn: {
    paddingLeft: 12,
  },
  editIcon: {
    fontSize: 18,
    color: TEXT_GREY,
  },

  validHint: {
    fontSize: 12,
    color: PINK,
    marginTop: 6,
    marginLeft: 4,
  },

  // confirm-button-block-login → position: fixed, bottom: 24px
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: BG,
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
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  btnArrow: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 24,
  },
})
