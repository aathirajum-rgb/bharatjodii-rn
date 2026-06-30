import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppHeader from '../../components/app-header/AppHeader'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import i18n from '../../i18n'
import { fetchProfileCreatedByOptions, getRegValue, setRegValues } from '../../service/registrationService'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_ICON = 'https://imgs.jodii.app/assets/images/svg/registration-new/creating-profile.svg'
const FOOTER_H = 84

// Gender groups — used to pre-set LOGINGENDER for family-member profiles
const MALE_GENDER   = ['4', '8']   // son / brother → M
const FEMALE_GENDER = ['5', '9']   // daughter / sister → F

const LANG_LABEL: Record<string, string> = {
  en: 'Eng', tm: 'Tamil', tl: 'Telugu', ml: 'Malay', kn: 'Kanna',
  hi: 'Hindi', bn: 'Bangla', mt: 'Marathi', or: 'Odia', gj: 'Gujarati', pa: 'Punjabi',
}

// Hardcoded fallback — used if API is unavailable
const FALLBACK_OPTIONS: Option[] = [
  { key: '1',  label: 'Myself'      },
  { key: '4',  label: "Son's"       },
  { key: '5',  label: "Daughter's"  },
  { key: '8',  label: "Brother's"   },
  { key: '9',  label: "Sister's"    },
  { key: '10', label: "Friend's"    },
  { key: '11', label: "Relative's"  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreatedByScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [options,    setOptions]    = useState<Option[]>([])
  const [selected,   setSelected]   = useState<string | null>(null)
  const [fetching,   setFetching]   = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Restore previously saved selection (user pressed back from page 2)
  useEffect(() => {
    getRegValue('CREATEDBY').then(v => { if (v) setSelected(v) })
  }, [])

  // Fetch PROFILECREATEDBY from API; use fallback on failure
  useEffect(() => {
    fetchProfileCreatedByOptions()
      .then(list => setOptions(list.length ? list : FALLBACK_OPTIONS))
      .catch(() => setOptions(FALLBACK_OPTIONS))
      .finally(() => setFetching(false))
  }, [])

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)

    // Persist CREATEDBY — matches Angular updateRegistrationValues('CREATEDBY', key)
    // Set LOGINGENDER for family-member profiles — matches Angular getNextUrlForPage1()
    const updates: Record<string, string> = { CREATEDBY: selected }
    if (MALE_GENDER.includes(selected)) {
      updates.LOGINGENDER = 'M'
    } else if (FEMALE_GENDER.includes(selected)) {
      updates.LOGINGENDER = 'F'
    }
    await setRegValues(updates)

    // Everyone goes to page 2 (NAME) — Angular getNextUrlForPage1() returns /onboarding/2 for ALL createdBy values.
    // Branching to page 3 vs 4 happens at page 2 (NAME screen), not here.
    navigation.push('onboarding', { pageNo: '2' })
    setSubmitting(false)
  }

  const langLabel = LANG_LABEL[i18n.language] ?? 'Eng'

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
        {/* Page illustration — Angular: ICONTYPE = domain + creating-profile.svg */}
        <Image
          source={{ uri: CDN_ICON }}
          style={styles.icon}
          contentFit="contain"
        />

        {/* Title — i18n: REGISTRATION.CREATEDBY */}
        <Text style={styles.title}>
          {t('REGISTRATION.CREATEDBY', 'Creating profile for')}
        </Text>

        {/* Pill chip grid — TYPE=type-1, horizontal wrapping (Figma: node 11851-2413) */}
        {fetching ? (
          <ActivityIndicator
            color={Colors.primary}
            size="large"
            style={styles.loader}
          />
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
                  {/* Left check indicator — empty circle unselected, filled + tick selected */}
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

      {/* Sticky footer — matches Angular .otp-cta sticky bottom */}
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

  // Page icon — CDN SVG (Angular: ICONTYPE → creating-profile.svg)
  icon: {
    width:        48,
    height:       48,
    marginBottom: 24,
  },

  // Title — "Creating profile for" (Figma: Poppins SemiBold 22px / lineHeight 24)
  title: {
    fontSize:     22,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    lineHeight:   28,
    marginBottom: 24,
  },

  loader: {
    marginTop: 48,
  },

  // Horizontal wrapping chip grid — TYPE=type-1 (Figma: gap 16, flexWrap)
  chipGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           16,
  },

  // Pill chip — 40px height, fully-rounded (Figma: borderRadius 50px)
  chip: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          40,
    borderRadius:    50,
    borderWidth:     1,
    borderColor:     Colors.inputBorder,
    backgroundColor: Colors.surface,
    paddingLeft:     8,
    paddingRight:    16,
    gap:             8,
  },
  chipSelected: {
    borderColor:     CHIP_CHECKED_BORDER,
    backgroundColor: CHIP_CHECKED_BG,
  },

  // Left indicator icon — 20×20 circle, fills brand-red when selected
  chipIcon: {
    width:           20,
    height:          20,
    borderRadius:    10,
    borderWidth:     1.5,
    borderColor:     Colors.inputBorder,
    alignItems:      'center',
    justifyContent:  'center',
  },
  chipIconSelected: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },

  // White checkmark rendered inside the filled circle
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
})
