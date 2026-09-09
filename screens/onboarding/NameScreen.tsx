import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { Colors } from '../../constants/colors'
import {
  OTHER_GENDER_KEYS,
  callPartialRegistrationAPI,
  getRegValues,
  isAiValidationEnabled,
  parseNameValidationStrict,
  setRegValue,
  validateNameGender,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { FontSize } from '../../src/theme/fonts'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import ConfirmNameGenderSheet from '../../components/bottom-sheet/ConfirmNameGenderSheet'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_ICON = CDN_REG + 'son-name.svg'

// SELFGENDER → next page is GENDER (3); OTHERGENDER → skip to MARITALSTATUS (4)
// Matches Angular getNextUrlForPage2(): SELFGENDER → /onboarding/3, OTHERGENDER → /onboarding/4
const SELF_GENDER = ['1', '10', '11']

// Removes the browser's default black focus outline on web — TextInput renders
// as <input> there, and the outline would sit on top of our custom borderColor.
const webOutlineReset = { outlineStyle: 'none', outlineWidth: 0 } as any

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
  const langFonts = useLanguageFonts()

  const [name,       setName]       = useState('')
  const [createdBy,  setCreatedBy]  = useState<string>('1')
  const [error,      setError]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isFocused,  setIsFocused]  = useState(false)

  // AI name validation sheet — Angular: showOnboarding3EditSheet(hideGender=true)
  const [sheetVisible, setSheetVisible] = useState(false)

  const inputRef = useRef<TextInput>(null)

  // Load CREATEDBY + restore any previously typed name (back navigation)
  useEffect(() => {
    getRegValues().then(({ CREATEDBY, NAME }) => {
      if (CREATEDBY) setCreatedBy(CREATEDBY)
      if (NAME) setName(NAME)
    })
  }, [])

  // Auto-focus once the push transition finishes (not a fixed setTimeout) — if the
  // keyboard opens while the screen is still mid-transition, KeyboardAvoidingView's
  // first resize computation runs before its layout has settled and gets silently
  // dropped, leaving the footer CTA hidden behind the keyboard. See OTPScreen.tsx.
  useEffect(() => {
    const sub = navigation.addListener('transitionEnd', () => {
      inputRef.current?.focus()
    })
    return sub
  }, [navigation])

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
  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.NAME', 'Enter your #PROFILETYPE# name')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  const isValid = name.trim().length >= 3

  // Border color: focused always wins (blue) regardless of value; unfocused
  // falls back to red when empty, grey when filled — matches Angular's
  // input-fields.component.scss .item-has-focus (#4797D9) / .ion-invalid
  // (#DE2A68) / default (#B0B0B0) precedence.
  const borderColor = isFocused
    ? Colors.inputFocus
    : name.length === 0
      ? Colors.inputError
      : Colors.inputBorder

  // ── Submit ─────────────────────────────────────────────────────────────────

  // Persist the name, then continue — SELFGENDER [1,10,11] → page 3 (GENDER),
  // OTHERGENDER [4,5,8,9] → page 4 (MARITALSTATUS).
  async function commitAndAdvance(finalName: string) {
    await setRegValue('NAME', finalName)
    const nextPage = SELF_GENDER.includes(createdBy) ? '3' : '4'
    navigation.push('onboarding', { pageNo: nextPage })
    callPartialRegistrationAPI()
  }

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
      // Angular: clickOnNext() case '2' — only other-created profiles
      // (OTHERGENDER) run AI validation here, and only while AIVFLAG is on.
      // Self-created profiles are validated on page 3 instead, once the user
      // has actually picked a gender.
      if (OTHER_GENDER_KEYS.includes(createdBy) && await isAiValidationEnabled()) {
        const gender = (await getRegValues()).GENDER ?? ''
        const res    = await validateNameGender(trimmed, gender)
        const { isNameViolated, isGenderInvalid } = parseNameValidationStrict(res)
        if (isNameViolated || isGenderInvalid) {
          setName(trimmed)
          setSheetVisible(true)
          return
        }
      }
      await commitAndAdvance(trimmed)
    } catch {
      setError(t('GENERAL.NOINTERNET', 'No internet connection'))
    } finally {
      setSubmitting(false)
    }
  }

  // Angular: revalidateOnboarding3NameOnSubmit() — re-checks the corrected name;
  // still invalid → the sheet stays open with the violation message.
  async function handleSheetSubmit(editedName: string) {
    if (submitting) return
    setSubmitting(true)
    try {
      setName(editedName)
      const gender = (await getRegValues()).GENDER ?? ''
      const res    = await validateNameGender(editedName, gender)
      const { isNameViolated } = parseNameValidationStrict(res)
      if (isNameViolated) return
      setSheetVisible(false)
      await commitAndAdvance(editedName)
    } catch {
      // Network failure on re-validation shouldn't trap the user in the sheet.
      setSheetVisible(false)
      await commitAndAdvance(editedName)
    } finally {
      setSubmitting(false)
    }
  }

  // Angular: getOnboarding3Title() — REGISTRATION.CONFIRM_SHEET with #PROFILETYPE#
  const sheetTitle = t('REGISTRATION.CONFIRM_SHEET', 'Please confirm your #PROFILETYPE# details below')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Angular: getOnboarding3NameLabel() — REGISTRATION.CREATED_NAME. The gender
  // label is omitted entirely here (HIDE_GENDER on this page).
  const sheetNameLabel = t('REGISTRATION.CREATED_NAME', '#PROFILETYPE# name')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace(/\s{2,}/g, ' ')
    .trim()

  useOnboardingFooter({ nextDisabled: !isValid, nextLoading: submitting, onNext: handleNext }, [isValid, submitting])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      {/* No KeyboardAvoidingView here — this screen only ever renders as
          OnboardingRouter's `renderContent()` output (navigation/AppStack.tsx),
          inside a shell that already wraps header + content + the persistent
          footer CTA in its OWN KeyboardAvoidingView. Nesting a second one here
          double-applied the keyboard compensation and left a large gap above
          the keyboard on iOS. */}
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
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
        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        {/* Outlined name input — Figma: 48px height, 8px radius, #b0b0b0 border */}
        <View style={styles.inputOuter}>
          <TextInput
            ref={inputRef}
            style={[styles.inputBox, { borderColor }, webOutlineReset]}
            value={name}
            onChangeText={handleChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            cursorColor={Colors.textPrimary}
            selectionColor={Colors.textPrimary}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleNext}
          />
          {/* Floating label overlapping top border — Figma: top:-8 left:12, white bg, 12px Regular */}
          <View style={styles.labelWrap} pointerEvents="none">
            <Text style={[styles.labelText, { fontFamily: langFonts.regular }]}>{t('REGISTRATION.NAMETXT', 'Name')}</Text>
          </View>
        </View>

        {/* Inline error */}
        {!!error && <Text style={os.errorText}>{error}</Text>}
      </ScrollView>

      {/* AI name validation sheet — Angular: onboarding3EditSheet, gender hidden */}
      <ConfirmNameGenderSheet
        visible={sheetVisible}
        title={sheetTitle}
        name={name}
        nameLabel={sheetNameLabel}
        nameViolated
        hideGender
        submitting={submitting}
        onSubmit={handleSheetSubmit}
      />
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

  // Box itself — Figma: 48px height, 8px radius, 1px #b0b0b0 border.
  // Angular: ion-input class="body1-medium-14 black-color" — font14/Medium/500,
  // and black-color is #000 exactly (not the app's general textPrimary #111).
  inputBox: {
    height:            48,
    borderWidth:       1,
    borderColor:       Colors.inputBorder,
    borderRadius:      8,
    paddingHorizontal: 12,
    paddingVertical:   0,
    fontSize:          FontSize.font14,
    fontWeight:        '500',
    color:             Colors.black,
  },
  // Floating label chip — Angular .floating: top:-8, left:16, white bg
  labelWrap: {
    position:        'absolute',
    top:             -8,
    left:            16,
    backgroundColor: Colors.surface,
    paddingHorizontal: 4,
  },
  // Angular body3-regular-12 black-color: font12 Regular, #000 exactly (not textPrimary)
  labelText: {
    fontSize:   FontSize.font12,
    fontWeight: '400',
    color:      Colors.black,
  },

})
