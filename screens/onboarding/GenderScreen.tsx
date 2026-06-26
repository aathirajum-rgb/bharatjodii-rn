import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppHeader from '../../components/app-header/AppHeader'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { StorageKeys as SK } from '../../constants/storage.keys'
import i18n from '../../i18n'
import {
  GenderOption,
  callRegistrationAPI,
  fetchGenderOptions,
} from '../../service/registrationService'
import { getItem, setItem } from '../../service/storageService'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = 'https://imgs.jodii.app/assets/images/svg/registration-new/gender.svg'
const FOOTER_H = 84

// Fallback used when the API is unavailable — CDN URLs matched from Angular codebase
const FALLBACK_OPTIONS: GenderOption[] = [
  {
    key: '1', label: 'Male',
    img:       'https://imgs.jodii.app/assets/images/revamp-img/avatar_male_120.svg',
    imgActive: 'https://imgs.jodii.app/assets/images/svg/male_avatar_new.svg',
  },
  {
    key: '0', label: 'Female',
    img:       'https://imgs.jodii.app/assets/images/revamp-img/avatar_female_120.svg',
    imgActive: 'https://imgs.jodii.app/assets/images/svg/female_avatar_new.svg',
  },
]

// Male='1' → loginGender='M', Female='0' → loginGender='F'
const LOGIN_GENDER: Record<string, string> = { '1': 'M', '0': 'F' }

const LANG_LABEL: Record<string, string> = {
  en: 'Eng', tm: 'Tamil', tl: 'Telugu', ml: 'Malay', kn: 'Kanna',
  hi: 'Hindi', bn: 'Bangla', mt: 'Marathi', or: 'Odia', gj: 'Gujarati', pa: 'Punjabi',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GenderScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [options,    setOptions]    = useState<GenderOption[]>([])
  const [fetching,   setFetching]   = useState(true)
  const [selected,   setSelected]   = useState<string | null>(null)
  const [name,       setName]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  // Load stored name + prior selection (back navigation), fetch gender options from API
  useEffect(() => {
    Promise.all([
      getItem(SK.User.NAME),
      getItem(SK.User.GENDER),
      getItem(SK.User.CREATED_BY),
    ]).then(([savedName, savedGender, createdBy]) => {
      if (savedName)   setName(savedName)
      if (savedGender) setSelected(savedGender)
      // Fetch API options — IMG/IMG-ACTIVE come from GENDERARRAY[createdBy] in the API
      fetchGenderOptions(createdBy ?? '1')
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

  const langLabel = LANG_LABEL[i18n.language] ?? 'Eng'

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const lg = LOGIN_GENDER[selected] ?? 'M'
      await Promise.all([
        setItem(SK.User.GENDER, selected),
        setItem(SK.User.LOGIN_GENDER, lg),
      ])
      await callRegistrationAPI({ GENDER: selected })
      navigation.push('onboarding', { pageNo: '4' })
    } catch {
      setError(t('GENERAL.NOINTERNET', 'No internet connection'))
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <AppHeader
        type="registration"
        showBackBtn={navigation.canGoBack()}
        languageLabel={langLabel}
        onBackPress={() => navigation.goBack()}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />

      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: FOOTER_H + (Platform.OS === 'ios' ? insets.bottom : 20) + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Page illustration — Figma: 48×48 gender icon at top-left */}
        <Image
          source={{ uri: CDN_PAGE_ICON }}
          style={styles.pageIcon}
          resizeMode="contain"
        />

        {/* Title — "Select the gender of Ranganathan" (Figma: 22px SemiBold) */}
        <Text style={styles.title}>{title}</Text>

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
                    resizeMode="contain"
                  />

                  {/* Label — Figma: 14px Poppins Medium, flex:1 */}
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

      {/* Sticky footer */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Platform.OS === 'ios' ? insets.bottom : 20 },
        ]}
      >
        <ButtonRevamp
          label={t('REGISTRATION.NEXTCTA', 'Next')}
          variant="primary"
          size="standard"
          fullWidth
          disabled={!selected}
          loading={submitting}
          onPress={handleNext}
        />
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_CHECKED_BG     = 'rgba(181, 0, 51, 0.02)'
const CARD_CHECKED_BORDER = 'rgba(181, 0, 51, 0.4)'

const styles = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: Colors.surface,
  },
  flex1: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop:        24,
  },

  pageIcon: {
    width:        48,
    height:       48,
    marginBottom: 24,
  },

  title: {
    fontSize:     22,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    lineHeight:   28,
    marginBottom: 32,
  },

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
    borderColor:     CARD_CHECKED_BORDER,
    backgroundColor: CARD_CHECKED_BG,
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
    borderColor:     '#8a8a8a',
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

  footer: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 24,
    paddingTop:        20,
    backgroundColor:   Colors.surface,
  },
})
