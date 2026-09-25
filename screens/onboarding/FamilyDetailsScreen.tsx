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
import {
  fetchFamilyOptions,
  getRegValue,
  setRegValues,
  submitFamilyDetails,
} from '../../service/registrationService'
import { CDN_REG, CDN_LOTTIE } from '../../constants/cdn'
import CdnLottie from '../../components/CdnLottie'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { FontSize } from '../../src/theme/fonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'family-details.svg'
const FOOTER_H = 160

const FALLBACK_BROTHERS = [
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
  { key: '4', label: '4' },
  { key: '5', label: 'More than 5' },
  { key: '6', label: 'No brothers' },
]

const FALLBACK_SISTERS = [
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
  { key: '4', label: '4' },
  { key: '5', label: 'More than 5' },
  { key: '6', label: 'No sisters' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FamilyDetailsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation()
  const langFonts = useLanguageFonts()

  const [brotherOptions, setBrotherOptions] = useState<Option[]>([])
  const [sisterOptions,  setSisterOptions]  = useState<Option[]>([])
  const [fetching,       setFetching]       = useState(true)

  const [selBrothers,  setSelBrothers]  = useState<string | null>(null)
  const [selSisters,   setSelSisters]   = useState<string | null>(null)
  const [createdBy,    setCreatedBy]    = useState('1')
  const [submitting,   setSubmitting]   = useState(false)

  // Extracted so a language change can re-run it — the option labels below are
  // server-translated. Angular: handleLanguageChange() → runInitialDataPopulation()
  // → getRegistrationDynamicArray(true, 1), then assignRegistrationData() re-resolves
  // the stored KEY against the newly translated list. Re-reading storage here does
  // the same, so the user's selection survives the switch.
  function loadOptions() {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('BROTHERS'),
      getRegValue('SISTERS'),
    ]).then(([cb, br, si]) => {
      if (cb) setCreatedBy(cb)
      if (br) setSelBrothers(br)
      if (si) setSelSisters(si)

      fetchFamilyOptions()
        .then(({ brothers, sisters }) => {
          setBrotherOptions(brothers.length ? brothers : FALLBACK_BROTHERS)
          setSisterOptions(sisters.length  ? sisters  : FALLBACK_SISTERS)
        })
        .catch(() => {
          setBrotherOptions(FALLBACK_BROTHERS)
          setSisterOptions(FALLBACK_SISTERS)
        })
        .finally(() => setFetching(false))
    })
  }

  useEffect(() => { loadOptions() }, [])

  useLanguageReload(loadOptions)

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.ADDFAMILYDETAILS', 'Add your #PROFILETYPE# family details')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  const isReady = !!(selBrothers && selSisters)

  async function handleNext() {
    if (!isReady || submitting) return
    setSubmitting(true)
    try {
      await setRegValues({ BROTHERS: selBrothers!, SISTERS: selSisters! })
      await submitFamilyDetails(selBrothers!, selSisters!)
      navigation.push('onboarding', { pageNo: '28' })
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  function handleSkip() {
    navigation.push('onboarding', { pageNo: '28' })
  }

  // Angular: registration-revamp.component.html's skip CTA is
  // *ngIf="SHOWSKIPBTN && !isInputFocused && (!showSkipBtn(regPageContent) || ...)",
  // and showSkipBtn() just returns showNextCTA (true once Next is enabled)
  // for every page except the '20'/'29' overrides — page 27 isn't in that
  // list, so skip is visible only until both brothers and sisters are
  // picked, then hides. Same rule as pages 34/35.
  useOnboardingFooter({
    nextDisabled: !isReady,
    nextLoading: submitting,
    onNext: handleNext,
    showSkip: !isReady,
    skipLabel: t('REG.DO_LATER', "I'll do this later"),
    onSkip: handleSkip,
    // i18n.language: skipLabel is translated, so re-push footer state on a
    // language change or it stays stuck on whatever language was active at mount.
  }, [isReady, submitting, i18n.language])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.screen}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{ uri: CDN_PAGE_ICON }}
          style={os.pageIcon}
          contentFit="contain"
        />

        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        {fetching ? (
          <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} style={styles.loader} />
        ) : (
          <>
            {/* Brothers section */}
            <Text style={[styles.sectionLabel, { fontFamily: langFonts.medium }]}>
              {t('REGISTRATION.NO_OF_BROTHERS', 'No of brothers')}
            </Text>
            <View style={styles.chipGrid}>
              {brotherOptions.map(opt => {
                const isSelected = selBrothers === opt.key
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setSelBrothers(opt.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={opt.label}
                  >
                    <View style={[styles.chipIcon, isSelected && styles.chipIconSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected, { fontFamily: langFonts.regular }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {/* Sisters section */}
            <Text style={[styles.sectionLabel, styles.sectionLabelSpacing, { fontFamily: langFonts.medium }]}>
              {t('REGISTRATION.NO_OF_SISTERS', 'No of sisters')}
            </Text>
            <View style={styles.chipGrid}>
              {sisterOptions.map(opt => {
                const isSelected = selSisters === opt.key
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setSelSisters(opt.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={opt.label}
                  >
                    <View style={[styles.chipIcon, isSelected && styles.chipIconSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected, { fontFamily: langFonts.regular }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: { alignSelf: 'center', marginTop: 48 },

  sectionLabel: {
    fontSize:     FontSize.font16,
    fontWeight:   '500',
    color:        Colors.black,
    marginBottom: 16,
  },
  sectionLabelSpacing: {
    marginTop: 28,
  },

  chipGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           16,
  },

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
    color:      Colors.surface,
    fontSize:   FontSize.font11,
    fontWeight: '700',
    lineHeight: 13,
  },

  chipLabel: {
    fontSize:   FontSize.font14,
    fontWeight: '400',
    color:      Colors.black,
    lineHeight: 20,
  },
  chipLabelSelected: {
    fontWeight: '500',
  },
})
