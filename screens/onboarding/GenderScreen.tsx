import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
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
import { CDN_SVG, CDN_REVAMP, CDN_LOTTIE } from '../../constants/cdn'
import CdnLottie from '../../components/CdnLottie'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import ConfirmNameGenderSheet from '../../components/bottom-sheet/ConfirmNameGenderSheet'
import { os } from './onboardingStyles'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { FontSize, remPx } from '../../src/theme/fonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_SVG + 'gender-registration.svg'
// Angular .img-icon: min-height/min-width 4.5rem — a rem value, so it scales
// with device width like every other rem-based size (see src/theme/fonts.ts).
const AVATAR_SIZE = remPx(4.5)

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
  const langFonts = useLanguageFonts()

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
  // Extracted so a language change can re-run it — the option labels below are
  // server-translated. Angular: handleLanguageChange() → runInitialDataPopulation()
  // → getRegistrationDynamicArray(true, 1), then assignRegistrationData() re-resolves
  // the stored KEY against the newly translated list. Re-reading storage here does
  // the same, so the user's selection survives the switch.
  function loadOptions() {
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
  }

  useEffect(() => { loadOptions() }, [])

  useLanguageReload(loadOptions)

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
          style={[os.pageIcon, styles.pageIconOffset]}
          contentFit="contain"
        />

        {/* Title — "Select the gender of Ranganathan" (Figma: 22px SemiBold) */}
        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        {/* Gender cards — Figma node 3-336: 1px #b0b0b0 border, 16px radius, gap:32 */}
        {fetching ? (
          <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} style={[styles.loader, { alignSelf: 'center' }]} />
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
                    <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected, { fontFamily: langFonts.medium }]}>
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
                    <Text style={[styles.helperText, { fontFamily: langFonts.medium }]}>{opt.text}</Text>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {!!error && <Text style={[styles.errorText, { fontFamily: langFonts.regular }]}>{error}</Text>}
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
  // On mobile the gender illustration sat right up against the header's back
  // arrow — pushed down to leave clear space between the two.
  pageIconOffset: {
    marginTop: 16,
  },

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

  // Avatar — Angular .img-icon: min 4.5rem
  avatar: {
    width:  AVATAR_SIZE,
    height: AVATAR_SIZE,
  },

  // Label — Angular radio.component.html (pageName == 'GENDER'):
  // .body1-medium-14 pl-16 black-color line-height-20. No explicit lineHeight
  // here (user preference: let RN's Text fall back to the font's natural
  // metric on onboarding screens even where Angular sets one).
  cardLabel: {
    flex:       1,
    fontSize:   FontSize.font14,
    fontWeight: '500',
    color:      Colors.black,
  },
  cardLabelSelected: {
    color: Colors.black,
  },

  // Helper subtext under the selected card — Angular: body1-medium-14
  // black-color (no line-height class set — don't invent one)
  helperText: {
    marginTop:  8,
    fontSize:   FontSize.font14,
    fontWeight: '500',
    color:      Colors.black,
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
    fontSize:  FontSize.font12,
    color:     Colors.inputError,
  },
})
