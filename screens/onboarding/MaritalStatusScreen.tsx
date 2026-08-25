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
  callPartialRegistrationAPI,
  fetchMaritalStatusOptions,
  fetchNoOfChildrenOptions,
  getRegValues,
  setRegValue,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os } from './onboardingStyles'
import { Fonts } from '../../src/theme/fonts'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'son-marital.svg'

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

// Fallback "number of children" options — matches the live Angular app's
// NOOFCHILDREN list (None, 1, 2, 3, 4+). Scoped to this screen since other
// consumers of registrationService's shared CHILDREN_OPTIONS constant use
// different labels ("1 child", "2 children", ...) and are out of scope here.
const FALLBACK_CHILDREN_OPTIONS = [
  { key: '0', label: 'None' },
  { key: '1', label: '1'    },
  { key: '2', label: '2'    },
  { key: '3', label: '3'    },
  { key: '4', label: '4+'   },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MaritalStatusScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const langFonts = useLanguageFonts()

  const [options,         setOptions]         = useState<Option[]>([])
  const [childrenOptions, setChildrenOptions] = useState<Option[]>(FALLBACK_CHILDREN_OPTIONS)
  const [fetching,        setFetching]        = useState(true)
  const [selected,        setSelected]        = useState<string | null>(null)
  const [noOfChildren,    setNoOfChildren]    = useState<string | null>(null)
  const [createdBy,       setCreatedBy]       = useState('1')
  const [submitting,      setSubmitting]      = useState(false)

  // Extracted so a language change can re-run it — the option labels below are
  // server-translated. Angular: handleLanguageChange() → runInitialDataPopulation()
  // → getRegistrationDynamicArray(true, 1), then assignRegistrationData() re-resolves
  // the stored KEY against the newly translated list. Re-reading storage here does
  // the same, so the user's selection survives the switch.
  function loadOptions() {
    getRegValues().then(({ CREATEDBY, GENDER, MARITALSTATUS, NOOFCHILDREN }) => {
      const cb2 = CREATEDBY ?? '1'
      const g2  = GENDER    ?? '1'
      if (cb2)           setCreatedBy(cb2)
      if (MARITALSTATUS) setSelected(MARITALSTATUS)
      if (NOOFCHILDREN)  setNoOfChildren(NOOFCHILDREN)

      const fallback = g2 === '0' ? FALLBACK_FEMALE_OPTIONS : FALLBACK_MALE_OPTIONS
      fetchMaritalStatusOptions(g2)
        .then(list => setOptions(list.length ? list : fallback))
        .catch(() => setOptions(fallback))
        .finally(() => setFetching(false))

      fetchNoOfChildrenOptions()
        .then(list => { if (list.length) setChildrenOptions(list) })
        .catch(() => {})
    })
  }

  useEffect(() => { loadOptions() }, [])

  useLanguageReload(loadOptions)

  // Title: "Select your [possessive] marital status" — Angular: REGISTRATION.MARITALSTATUS
  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.MARITALSTATUS', 'Select your #PROFILETYPE# marital status')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ') // handle empty replacement
    .trim()

  // Angular: registration.page.ts's showChild — "Never Married" is always key '1'
  // regardless of gendered option set, so any other status reveals the
  // "select number of children" step (registration.page.html:206-211).
  const showChildren = !!selected && selected !== '1'

  function handleSelectMaritalStatus(key: string) {
    // Reset any previously chosen children count on every status change — not
    // just when switching to "Never Married" — since a stale value from a
    // different status (e.g. Divorced → Widower) shouldn't silently carry over.
    if (key !== selected) setNoOfChildren(null)
    setSelected(key)
  }

  async function handleNext() {
    if (!selected || (showChildren && !noOfChildren) || submitting) return
    setSubmitting(true)
    try {
      await setRegValue('MARITALSTATUS', selected)
      await setRegValue('NOOFCHILDREN', showChildren ? (noOfChildren ?? '') : '')
      navigation.push('onboarding', { pageNo: '5' })
      callPartialRegistrationAPI()
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  useOnboardingFooter(
    { nextDisabled: !selected || (showChildren && !noOfChildren), nextLoading: submitting, onNext: handleNext },
    [selected, showChildren, noOfChildren, submitting],
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page illustration — Figma: 48×48 ring-heart icon */}
        <Image
          source={{ uri: CDN_PAGE_ICON }}
          style={os.pageIcon}
          contentFit="contain"
        />

        {/* Title — Figma: 22px Poppins SemiBold */}
        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

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
                  onPress={() => handleSelectMaritalStatus(opt.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={opt.label}
                >
                  {/* Left indicator — empty circle or filled red with tick */}
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

        {/* Angular: registration.page.html's REG.SELECT_NOOFCHILD section —
            only shown once a non-"Never Married" status is picked. */}
        {showChildren && (
          <>
            <Text style={[styles.childrenTitle, { fontFamily: langFonts.medium }]}>{t('REGISTRATION.NOOFCHILD', 'Select number of children')}</Text>
            <View style={styles.chipGrid}>
              {childrenOptions.map(opt => {
                const isSelected = noOfChildren === opt.key
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setNoOfChildren(opt.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={opt.label}
                  >
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
          </>
        )}
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CHIP_CHECKED_BG     = 'rgba(181, 0, 51, 0.02)'
const CHIP_CHECKED_BORDER = 'rgba(181, 0, 51, 0.4)'

const styles = StyleSheet.create({
  loader: {
    marginTop: 48,
  },

  // Sub-heading above the children chip grid — extra marginTop gives clear
  // separation from the marital-status options above it.
  childrenTitle: {
    fontSize:     17.5,
    fontWeight:   '500',
    color:        Colors.textPrimary,
    marginTop:    40,
    marginBottom: 16,
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
    borderColor:     Colors.borderNeutral,
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
    borderColor:     Colors.borderNeutral,
    alignItems:      'center',
    justifyContent:  'center',
  },
  chipIconSelected: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },

  checkmark: {
    fontFamily: Fonts.poppinsBold,
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
})
