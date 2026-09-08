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
import { Colors } from '../../constants/colors'
import { fetchProfileCreatedByOptions, getRegValue, setRegValues } from '../../service/registrationService'
import { CDN_REG, CDN_LOTTIE } from '../../constants/cdn'
import CdnLottie from '../../components/CdnLottie'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_ICON = CDN_REG + 'creating-profile.svg'

// Gender groups — used to pre-set LOGINGENDER for family-member profiles
const MALE_GENDER   = ['4', '8']   // son / brother → M
const FEMALE_GENDER = ['5', '9']   // daughter / sister → F

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
  const langFonts = useLanguageFonts()

  const [options,    setOptions]    = useState<Option[]>([])
  const [selected,   setSelected]   = useState<string | null>(null)
  const [fetching,   setFetching]   = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Restore previously saved selection (user pressed back from page 2)
  useEffect(() => {
    getRegValue('CREATEDBY').then(v => { if (v) setSelected(v) })
  }, [])

  // Fetch PROFILECREATEDBY from API; use fallback on failure.
  // Labels are server-translated, so this must re-run on a language change —
  // see useLanguageReload below (Angular: handleLanguageChange()).
  function loadOptions() {
    return fetchProfileCreatedByOptions()
      .then(list => setOptions(list.length ? list : FALLBACK_OPTIONS))
      .catch(() => setOptions(FALLBACK_OPTIONS))
      .finally(() => setFetching(false))
  }

  useEffect(() => { loadOptions() }, [])

  // Re-fetch in the new language; `selected` is a KEY so the user's choice survives.
  useLanguageReload(loadOptions)

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)

    // Persist CREATEDBY — matches Angular updateRegistrationValues('CREATEDBY', key)
    // Set LOGINGENDER for family-member profiles — matches Angular getNextUrlForPage1()
    // Also set GENDER (registrationValues[GENDER] = isMale ? '1' : '0' in Angular) —
    // NameScreen/validateNameGender() reads this to run AI name/gender validation,
    // so it must be set here too, not just LOGINGENDER.
    const updates: Record<string, string> = { CREATEDBY: selected }
    if (MALE_GENDER.includes(selected)) {
      updates.LOGINGENDER = 'M'
      updates.GENDER = '1'
    } else if (FEMALE_GENDER.includes(selected)) {
      updates.LOGINGENDER = 'F'
      updates.GENDER = '0'
    }
    await setRegValues(updates)

    // Everyone goes to page 2 (NAME) — Angular getNextUrlForPage1() returns /onboarding/2 for ALL createdBy values.
    // Branching to page 3 vs 4 happens at page 2 (NAME screen), not here.
    navigation.push('onboarding', { pageNo: '2' })
    setSubmitting(false)
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
        {/* Page illustration — Angular: ICONTYPE = domain + creating-profile.svg */}
        <Image
          source={{ uri: CDN_ICON }}
          style={os.pageIcon}
          contentFit="contain"
        />

        {/* Title — i18n: REGISTRATION.CREATEDBY */}
        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>
          {t('REGISTRATION.CREATEDBY', 'Creating profile for')}
        </Text>

        {/* Pill chip grid — TYPE=type-1, horizontal wrapping (Figma: node 11851-2413) */}
        {fetching ? (
          <CdnLottie
            uri={CDN_LOTTIE + 'loader.json'}
            width={80}
            height={80}
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

                  <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected, { fontFamily: isSelected ? langFonts.medium : langFonts.regular }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: {
    marginTop: 48,
    alignSelf: 'center',
  },

  // Horizontal wrapping chip grid — TYPE=type-1 (Figma: gap 16, flexWrap)
  chipGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           16,
  },

  // Pill chip — 40px height, fully-rounded (Figma: borderRadius 50px, border #8a8a8a)
  chip: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          40,
    borderRadius:    50,
    borderWidth:     1,
    borderColor:     Colors.borderNeutral,
    backgroundColor: Colors.surface,
    paddingLeft:     8,
    paddingRight:    16,
    gap:             8,
  },
  chipSelected: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.radioCheckedBg,
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
  },
  chipLabelSelected: {
    fontWeight: '500',
  },

})
