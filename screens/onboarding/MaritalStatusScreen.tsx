import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Image,
  Linking,
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
  callRegistrationAPI,
  fetchMaritalStatusOptions,
} from '../../service/registrationService'
import { getItem, setItem } from '../../service/storageService'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = 'https://imgs.jodii.app/assets/images/svg/registration-new/marital-status.svg'
const FOOTER_H = 140   // Next button + "Need help?" section height

// Possessive labels per createdBy — matches Angular PROFILETYPE replacements
const PROFILE_POSSESSIVE: Record<string, string> = {
  '4':  "son's",
  '5':  "daughter's",
  '8':  "brother's",
  '9':  "sister's",
  '10': "friend's",
  '11': "relative's",
}

// Fallback options when API is unavailable
const FALLBACK_MALE_OPTIONS   = [
  { key: '1', label: 'Never Married' },
  { key: '2', label: 'Divorced'      },
  { key: '3', label: 'Widower'       },
  { key: '4', label: 'Awaiting Divorce' },
]
const FALLBACK_FEMALE_OPTIONS = [
  { key: '1', label: 'Never Married' },
  { key: '2', label: 'Divorced'      },
  { key: '3', label: 'Widow'         },
  { key: '4', label: 'Awaiting Divorce' },
]

const LANG_LABEL: Record<string, string> = {
  en: 'Eng', tm: 'Tamil', tl: 'Telugu', ml: 'Malay', kn: 'Kanna',
  hi: 'Hindi', bn: 'Bangla', mt: 'Marathi', or: 'Odia', gj: 'Gujarati', pa: 'Punjabi',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MaritalStatusScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [options,      setOptions]      = useState<Option[]>([])
  const [fetching,     setFetching]     = useState(true)
  const [selected,     setSelected]     = useState<string | null>(null)
  const [createdBy,    setCreatedBy]    = useState('1')
  const [submitting,   setSubmitting]   = useState(false)
  const [customerCare, setCustomerCare] = useState('')

  useEffect(() => {
    Promise.all([
      getItem(SK.User.CREATED_BY),
      getItem(SK.User.GENDER),
      getItem('MARITALSTATUS'),         // restore prior selection (back navigation)
      getItem(SK.App.CUSTOMER_CARE),
    ]).then(([cb, gender, savedMS, cc]) => {
      const cb2 = cb ?? '1'
      const g2  = gender ?? '1'
      if (cb2)   setCreatedBy(cb2)
      if (savedMS) setSelected(savedMS)
      if (cc)    setCustomerCare(cc)

      const fallback = g2 === '0' ? FALLBACK_FEMALE_OPTIONS : FALLBACK_MALE_OPTIONS
      fetchMaritalStatusOptions(g2)
        .then(list => setOptions(list.length ? list : fallback))
        .catch(() => setOptions(fallback))
        .finally(() => setFetching(false))
    })
  }, [])

  // Title: "Select your [possessive] marital status" — Angular: REGISTRATION.MARITALSTATUS
  const possessive = PROFILE_POSSESSIVE[createdBy]
  const title = possessive
    ? `Select your ${possessive} marital status`
    : t('REGISTRATION.MARITALSTATUS', 'Select your marital status').replace(' #PROFILETYPE#', '')

  const langLabel = LANG_LABEL[i18n.language] ?? 'Eng'

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await setItem('MARITALSTATUS', selected)
      await callRegistrationAPI({ MARITALSTATUS: selected })
      navigation.push('onboarding', { pageNo: '5' })
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  function handleCallPress() {
    if (customerCare) Linking.openURL(`tel:${customerCare}`)
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
        {/* Page illustration — Figma: 48×48 ring-heart icon */}
        <Image
          source={{ uri: CDN_PAGE_ICON }}
          style={styles.pageIcon}
          resizeMode="contain"
        />

        {/* Title — Figma: 22px Poppins SemiBold */}
        <Text style={styles.title}>{title}</Text>

        {/* Pill chip grid — TYPE=type-1, horizontal wrapping (same as CreatedByScreen) */}
        {fetching ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.chipGrid}>
            {options.map(opt => {
              const isSelected = selected === opt.key
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => setSelected(opt.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={opt.label}
                >
                  {/* Left indicator — empty circle or filled red with tick */}
                  <View style={[styles.chipIcon, isSelected && styles.chipIconSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* Sticky footer — Next button + "Need help? Call" section */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 20 },
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

        {!!customerCare && (
          <>
            <View style={styles.divider} />
            <Pressable style={styles.helpRow} onPress={handleCallPress}>
              <Text style={styles.helpText}>Need help?  Call</Text>
              <Text style={styles.helpPhone}>{customerCare}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CHIP_CHECKED_BG     = 'rgba(181, 0, 51, 0.02)'
const CHIP_CHECKED_BORDER = 'rgba(181, 0, 51, 0.4)'

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

  // Horizontal wrapping chip grid — TYPE=type-1 (Figma: gap:16, flexWrap)
  chipGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           16,
  },

  // Pill chip — 40px height, fully-rounded (Figma: borderRadius:50px)
  chip: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          40,
    borderRadius:    50,
    borderWidth:     1,
    borderColor:     '#8a8a8a',
    backgroundColor: Colors.surface,
    paddingLeft:     8,
    paddingRight:    16,
    gap:             8,
  },
  chipSelected: {
    borderColor:     CHIP_CHECKED_BORDER,
    backgroundColor: CHIP_CHECKED_BG,
  },

  // Left indicator icon — 20×20 circle
  chipIcon: {
    width:           20,
    height:          20,
    borderRadius:    10,
    borderWidth:     1.5,
    borderColor:     '#8a8a8a',
    alignItems:      'center',
    justifyContent:  'center',
  },
  chipIconSelected: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },

  checkmark: {
    color:      Colors.surface,
    fontSize:   11,
    fontWeight: '700',
    lineHeight: 13,
  },

  chipLabel: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
    lineHeight: 16,
  },
  chipLabelSelected: {
    fontWeight: '500',
  },

  // Sticky footer
  footer: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 24,
    paddingTop:        20,
    backgroundColor:   Colors.surface,
  },

  // "Need help?" section — Figma: line + "Need help? Call [number]"
  divider: {
    height:          1,
    backgroundColor: Colors.inputBorder,
    marginTop:       16,
    marginBottom:    16,
  },
  helpRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
  },
  helpText: {
    fontSize:      14,
    fontWeight:    '400',
    color:         Colors.textPrimary,
    letterSpacing: 0.42,
  },
  helpPhone: {
    fontSize:      14,
    fontWeight:    '500',
    color:         '#29339b',
    letterSpacing: 0.42,
  },
})
