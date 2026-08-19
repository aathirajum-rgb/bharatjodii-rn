import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { Colors } from '../../constants/colors'
import {
  GenderOption,
  SELF_GENDER_KEYS,
  callPartialRegistrationAPI,
  fetchGenderOptions,
  getRegValues,
  isAiValidationEnabled,
  parseNameGenderValidation,
  parseNameValidationStrict,
  setRegValues,
  validateNameGender,
} from '../../service/registrationService'
import { CDN_SVG, CDN_REVAMP } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { Fonts } from '../../src/theme/fonts'
import ConfirmNameGenderSheet from '../../components/bottom-sheet/ConfirmNameGenderSheet'
import { os } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_SVG + 'gender-registration.svg'

// Fallback used when the API is unavailable — CDN URLs matched from Angular codebase
const FALLBACK_OPTIONS: GenderOption[] = [
  {
    key: '1', label: 'Male',
    img:       CDN_REVAMP + 'avatar_male_120.svg',
    imgActive: CDN_SVG + 'male_avatar_new.svg',
    text:      '',
  },
  {
    key: '0', label: 'Female',
    img:       CDN_REVAMP + 'avatar_female_120.svg',
    imgActive: CDN_SVG + 'female_avatar_new.svg',
    text:      '',
  },
]

// Male='1' → loginGender='M', Female='0' → loginGender='F'
const LOGIN_GENDER: Record<string, string> = { '1': 'M', '0': 'F' }

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GenderScreen({ navigation }: Props) {
  const { t }  = useTranslation()

  const [options,    setOptions]    = useState<GenderOption[]>([])
  const [fetching,   setFetching]   = useState(true)
  const [selected,   setSelected]   = useState<string | null>(null)
  const [name,       setName]       = useState('')
  const [createdBy,  setCreatedBy]  = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  // AI name/gender validation sheet — Angular: showOnboarding3EditSheet()
  const [sheetVisible,  setSheetVisible]  = useState(false)
  const [nameViolated,  setNameViolated]  = useState(false)

  // Load stored name + prior selection (back navigation), fetch gender options from API
  useEffect(() => {
    getRegValues().then(({ NAME, GENDER, CREATEDBY }) => {
      if (NAME)      setName(NAME)
      if (GENDER)    setSelected(GENDER)
      if (CREATEDBY) setCreatedBy(CREATEDBY)
      // Fetch API options — IMG/IMG-ACTIVE come from GENDERARRAY[createdBy] in the API
      fetchGenderOptions(CREATEDBY ?? '1')
        .then(list => setOptions(list.length ? list : FALLBACK_OPTIONS))
        .catch(() => setOptions(FALLBACK_OPTIONS))
        .finally(() => setFetching(false))
    })
  }, [])

  // Title: "Select the gender of [Name]" — Angular: REGISTRATION.GENDER = "Select the gender of #NAME#"
  const genderKey = t('REGISTRATION.GENDER', 'Select the gender of #NAME#')
  const title = name
    ? genderKey.replace('#NAME#', name)
    : genderKey.replace(' of #NAME#', '')

  // Persist the chosen gender, then continue to page 4 (marital status).
  async function commitAndAdvance(finalName: string, finalGender: string) {
    const lg = LOGIN_GENDER[finalGender] ?? 'M'
    await setRegValues({ NAME: finalName, GENDER: finalGender, LOGINGENDER: lg })
    navigation.push('onboarding', { pageNo: '4' })
    callPartialRegistrationAPI()
  }

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    setError('')
    try {
      // Angular: clickOnNext() case '3' — only self-created profiles (SELFGENDER)
      // run AI validation, and only while the server-set AIVFLAG is on. Any API
      // failure falls through to the normal navigation, never blocking signup.
      if (SELF_GENDER_KEYS.includes(createdBy) && await isAiValidationEnabled()) {
        const res = await validateNameGender(name, selected)
        const { isNameViolated, isGenderInvalid } = parseNameGenderValidation(res)
        if (isNameViolated || isGenderInvalid) {
          setNameViolated(isNameViolated)
          setSheetVisible(true)
          return
        }
      }
      await commitAndAdvance(name, selected)
    } catch {
      setError(t('GENERAL.NOINTERNET', 'No internet connection'))
    } finally {
      setSubmitting(false)
    }
  }

  // Angular: revalidateOnboarding3NameOnSubmit() — re-checks the corrected name
  // (name only, no gender check); still invalid → reopen the sheet.
  async function handleSheetSubmit(editedName: string, editedGender: string) {
    if (submitting) return
    setSubmitting(true)
    try {
      setName(editedName)
      setSelected(editedGender)
      // Angular: revalidateOnboarding3NameOnSubmit() uses the strict rule
      // (validation_status != 1), not page 3's [0,2] rule, and checks the name only.
      const res = await validateNameGender(editedName, editedGender)
      const { isNameViolated } = parseNameValidationStrict(res)
      if (isNameViolated) {
        setNameViolated(true)
        return
      }
      setSheetVisible(false)
      await commitAndAdvance(editedName, editedGender)
    } catch {
      // Network failure on re-validation shouldn't trap the user in the sheet.
      setSheetVisible(false)
      await commitAndAdvance(editedName, editedGender)
    } finally {
      setSubmitting(false)
    }
  }

  // Angular: getOnboarding3Title() — REGISTRATION.CONFIRM_SHEET with #PROFILETYPE#
  // resolved from CREATEDBY, same substitution the page titles use.
  const possessiveKey  = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const profileType    = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const fillProfileType = (key: string, fallback: string) =>
    t(key, fallback).replace('#PROFILETYPE#', profileType).replace(/\s{2,}/g, ' ').trim()

  const sheetTitle = fillProfileType(
    'REGISTRATION.CONFIRM_SHEET', 'Please confirm your #PROFILETYPE# details below')

  // Angular: getOnboarding3NameLabel() / getOnboarding3GenderLabel() —
  // REGISTRATION.CREATED_NAME / CREATED_GENDER with the same substitution.
  const sheetNameLabel   = fillProfileType('REGISTRATION.CREATED_NAME',   '#PROFILETYPE# name')
  const sheetGenderLabel = fillProfileType('REGISTRATION.CREATED_GENDER', '#PROFILETYPE# gender')

  useOnboardingFooter({ nextDisabled: !selected, nextLoading: submitting, onNext: handleNext }, [selected, submitting])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page illustration — Figma: 48×48 gender icon at top-left */}
        <Image
          source={{ uri: CDN_PAGE_ICON }}
          style={os.pageIcon}
          contentFit="contain"
        />

        {/* Title — "Select the gender of Ranganathan" (Figma: 22px SemiBold) */}
        <Text style={os.title}>{title}</Text>

        {/* Gender cards — Figma node 3-336: 1px #b0b0b0 border, 16px radius, gap:32 */}
        {fetching ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.cardList}>
            {options.map(opt => {
              const isSelected = selected === opt.key
              return (
                <View key={opt.key}>
                  <Pressable
                    style={[styles.card, isSelected && styles.cardSelected]}
                    onPress={() => setSelected(opt.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={opt.label}
                  >
                    {/* Avatar switches gray↔colored on selection — IMG / IMG-ACTIVE from API */}
                    <Image
                      source={{ uri: isSelected ? opt.imgActive : opt.img }}
                      style={styles.avatar}
                      contentFit="contain"
                    />

                    {/* Label — Figma: 14px Medium, stretches between avatar and radio */}
                    <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                      {opt.label}
                    </Text>

                    {/* Radio — Figma: 24×24, 2px border, filled dot when selected */}
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </Pressable>

                  {/* Helper subtext under the selected card — API: option.TEXT
                      (Angular: radio.component.html's *ngIf="selectedValue == option.key" div) */}
                  {isSelected && !!opt.text && (
                    <Text style={styles.helperText}>{opt.text}</Text>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      {/* AI name/gender validation sheet — Angular: onboarding3EditSheet */}
      <ConfirmNameGenderSheet
        visible={sheetVisible}
        title={sheetTitle}
        name={name}
        gender={selected}
        genderOptions={options}
        nameLabel={sheetNameLabel}
        genderLabel={sheetGenderLabel}
        nameViolated={nameViolated}
        submitting={submitting}
        onSubmit={handleSheetSubmit}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: {
    marginTop: 48,
  },

  // Card list — Figma: gap:32 between the two cards
  cardList: {
    gap: 32,
  },

  // Gender card — Angular .gender-selection: 1px #8A8A8A border, 16px radius, 12px horizontal padding
  card: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               16,
    borderWidth:       1,
    borderColor:       Colors.borderNeutral,
    borderRadius:      16,
    paddingHorizontal: 12,
    backgroundColor:   Colors.surface,
    overflow:          'hidden',
  },
  // Angular .gender-selection.item-radio-checked: 2px solid #B50033 border, no bg change
  cardSelected: {
    borderWidth: 2,
    borderColor: Colors.primaryDark,
  },

  // Avatar — Angular .img-icon: min 4.5rem (72px)
  avatar: {
    width:  72,
    height: 72,
  },

  // Label — Angular body1-medium-14: 14px Medium
  cardLabel: {
    flex:       1,
    fontSize:   14,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  cardLabelSelected: {
    color: Colors.textPrimary,
  },

  // Helper subtext under the selected card — Angular: body1-medium-14 black-color
  helperText: {
    marginTop:  8,
    fontFamily: Fonts.poppinsMedium,
    fontSize:   14,
    fontWeight: '500',
    lineHeight: 20,
    color:      Colors.textPrimary,
  },

  // Radio — Angular ion-radio::part(container): 20×20, 2px border
  radio: {
    width:           20,
    height:          20,
    borderRadius:    10,
    borderWidth:     2,
    borderColor:     Colors.borderNeutral,
    alignItems:      'center',
    justifyContent:  'center',
  },
  radioSelected: {
    borderColor: Colors.primaryDark,
  },
  radioDot: {
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: Colors.primaryDark,
  },

  errorText: {
    marginTop: 16,
    fontSize:  12,
    color:     Colors.inputError,
  },
})
