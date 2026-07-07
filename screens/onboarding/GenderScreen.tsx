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
  callPartialRegistrationAPI,
  fetchGenderOptions,
  getRegValues,
  setRegValues,
} from '../../service/registrationService'
import { CDN_SVG, CDN_REVAMP } from '../../constants/cdn'
import { os } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_SVG + 'gender-registration.svg'

// Fallback used when the API is unavailable — CDN URLs matched from Angular codebase
const FALLBACK_OPTIONS: GenderOption[] = [
  {
    key: '1', label: 'Male',
    img:       CDN_REVAMP + 'avatar_male_120.svg',
    imgActive: CDN_SVG + 'male_avatar_new.svg',
  },
  {
    key: '0', label: 'Female',
    img:       CDN_REVAMP + 'avatar_female_120.svg',
    imgActive: CDN_SVG + 'female_avatar_new.svg',
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
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  // Load stored name + prior selection (back navigation), fetch gender options from API
  useEffect(() => {
    getRegValues().then(({ NAME, GENDER, CREATEDBY }) => {
      if (NAME)   setName(NAME)
      if (GENDER) setSelected(GENDER)
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

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const lg = LOGIN_GENDER[selected] ?? 'M'
      await setRegValues({ GENDER: selected, LOGINGENDER: lg })
      navigation.push('onboarding', { pageNo: '4' })
      callPartialRegistrationAPI()
    } catch {
      setError(t('GENERAL.NOINTERNET', 'No internet connection'))
    } finally {
      setSubmitting(false)
    }
  }

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
                <Pressable
                  key={opt.key}
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
              )
            })}
          </View>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>
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

  // Gender card — Figma: 1px #b0b0b0 border, 16px radius, 12px horizontal padding, no vertical padding
  card: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               16,
    borderWidth:       1,
    borderColor:       Colors.inputBorder,
    borderRadius:      16,
    paddingHorizontal: 12,
    backgroundColor:   Colors.surface,
    overflow:          'hidden',
  },
  cardSelected: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.radioCheckedBg,
  },

  // Avatar — Figma: 80×80, fills full card height (no vertical card padding)
  avatar: {
    width:  80,
    height: 80,
  },

  // Label — 14px Medium, stretches between avatar and radio
  cardLabel: {
    flex:       1,
    fontSize:   14,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  cardLabelSelected: {
    color: Colors.textPrimary,
  },

  // Radio — Figma: 24×24, 2px #8a8a8a border
  radio: {
    width:           24,
    height:          24,
    borderRadius:    12,
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
