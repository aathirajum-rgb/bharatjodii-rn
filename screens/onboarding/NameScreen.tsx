import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppHeader from '../../components/app-header/AppHeader'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { callRegistrationAPI, getRegValues, setRegValue } from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os, footerPaddingBottom, scrollPaddingBottom } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_ICON = CDN_REG + 'son-name.svg'
const FOOTER_H = 84

// SELFGENDER → next page is GENDER (3); OTHERGENDER → skip to MARITALSTATUS (4)
// Matches Angular getNextUrlForPage2(): SELFGENDER → /onboarding/3, OTHERGENDER → /onboarding/4
const SELF_GENDER = ['1', '10', '11']

// Emoji regex — matches Angular alphabetOnly() which strips emojis from name input
const EMOJI_REGEX = /(?:[✀-➿]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[#-9]️?⃣|㊙|㊗|〽|〰|Ⓜ|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|🆎|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|🈚|🈯|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|‼|⁉|[▪-▫]|▶|◀|[◻-◾]|©|®|™|ℹ|🀄|[☀-⛿]|⬅|⬆|⬇|⬛|⬜|⭐|⭕|⌚|⌛|⌨|⏏|[⏩-⏳]|[⏸-⏺]|🃏|⤴|⤵|[←-⇿])/g

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NameScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [name,       setName]       = useState('')
  const [createdBy,  setCreatedBy]  = useState<string>('1')
  const [error,      setError]      = useState('')
  const [submitting, setSubmitting] = useState(false)

  const inputRef = useRef<TextInput>(null)

  // Load CREATEDBY + restore any previously typed name (back navigation)
  useEffect(() => {
    getRegValues().then(({ CREATEDBY, NAME }) => {
      if (CREATEDBY) setCreatedBy(CREATEDBY)
      if (NAME) setName(NAME)
    })
  }, [])

  // Auto-focus input after mount
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 300)
    return () => clearTimeout(id)
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Strip emojis — matches Angular alphabetOnly()
  function sanitize(text: string) {
    return text.replace(EMOJI_REGEX, '')
  }

  function handleChangeText(text: string) {
    const clean = sanitize(text)
    setName(clean)
    if (error) setError('')
  }

  // Title: "Enter your name" for Myself, "Enter your son's name" for Son's, etc.
  const possessive = PROFILE_POSSESSIVE[createdBy]
  const title = possessive
    ? `Enter your ${possessive} name`
    : t('REGISTRATION.NAME', 'Enter your name').replace(' #PROFILETYPE#', '')

  const isValid = name.trim().length >= 3

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!isValid || submitting) return

    const trimmed = name.trim()

    // Client-side: alphabets, spaces, dots allowed — matches Angular minlength=3
    if (!/^[^\d!@#$%^&*()_+=[\]{};':"\\|,<>/?]{3,}$/.test(trimmed)) {
      setError(t('REG.ALPHABETONLY', 'Please enter valid characters'))
      return
    }

    setSubmitting(true)
    try {
      await setRegValue('NAME', trimmed)
      await callRegistrationAPI({ NAME: trimmed })

      // SELFGENDER [1,10,11] → page 3 (GENDER); OTHERGENDER [4,5,8,9] → page 4 (MARITALSTATUS)
      const nextPage = SELF_GENDER.includes(createdBy) ? '3' : '4'
      navigation.push('onboarding', { pageNo: nextPage })
    } catch {
      setError(t('GENERAL.NOINTERNET', 'No internet connection'))
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.screen}>
      <AppHeader
        type="registration"
        showBackBtn={navigation.canGoBack()}
        onBackPress={() => navigation.goBack()}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />

      <KeyboardAvoidingView
        style={os.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <ScrollView
          style={os.flex1}
          contentContainerStyle={[
            os.scrollContent,
            { paddingBottom: scrollPaddingBottom(insets.bottom, FOOTER_H) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Page illustration — Angular: ICONTYPE = son-name.svg */}
          <Image
            source={{ uri: CDN_ICON }}
            style={os.pageIcon}
            contentFit="contain"
          />

          {/* Dynamic title — "Enter your name" / "Enter your son's name" etc. */}
          <Text style={os.title}>{title}</Text>

          {/* Outlined name input — Figma: 48px height, 8px radius, #b0b0b0 border */}
          <View style={styles.inputOuter}>
            <TextInput
              ref={inputRef}
              style={[styles.inputBox, error ? styles.inputBoxError : null]}
              value={name}
              onChangeText={handleChangeText}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleNext}
            />
            {/* Floating label overlapping top border — Figma: top:-8 left:12, white bg, 12px Regular */}
            <View style={styles.labelWrap} pointerEvents="none">
              <Text style={styles.labelText}>{t('REGISTRATION.NAMETXT', 'Name')}</Text>
            </View>
          </View>

          {/* Inline error */}
          {!!error && <Text style={os.errorText}>{error}</Text>}
        </ScrollView>

        {/* Sticky footer */}
        <View
          style={[
            os.footer,
            { paddingBottom: footerPaddingBottom(insets.bottom) },
          ]}
        >
          <ButtonRevamp
            label={t('REGISTRATION.NEXTCTA', 'Next')}
            variant="primary"
            size="standard"
            fullWidth
            disabled={!isValid}
            loading={submitting}
            onPress={handleNext}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Outlined input container — extra marginTop leaves room for the label chip above the border
  inputOuter: {
    position:  'relative',
    marginTop: 8,
  },

  // Box itself — Figma: 48px height, 8px radius, 1px #b0b0b0 border
  inputBox: {
    height:            48,
    borderWidth:       1,
    borderColor:       Colors.inputBorder,
    borderRadius:      8,
    paddingHorizontal: 12,
    paddingVertical:   0,
    fontSize:          14,
    fontWeight:        '500',
    color:             Colors.textPrimary,
  },
  inputBoxError: {
    borderColor: Colors.inputError,
  },

  // Floating label chip — sits on top of the top border (Figma: top:-8, left:12, white bg, 12px Regular)
  labelWrap: {
    position:        'absolute',
    top:             -8,
    left:            12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 4,
  },
  labelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textSecondary,
  },

})
