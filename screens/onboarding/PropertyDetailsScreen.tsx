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
import { Colors } from '../../constants/colors'
import {
  fetchPropertyOptions,
  getRegValues,
  setRegValue,
  submitPropertyDetails,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'property.svg'

const FALLBACK_OPTIONS = [
  { key: '1', label: 'Own house' },
  { key: '2', label: 'Agriculture land' },
  { key: '3', label: 'Other land' },
  { key: '4', label: 'Own shop' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PropertyDetailsScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  const [options,      setOptions]      = useState<Option[]>([])
  const [fetching,     setFetching]     = useState(true)
  const [selected,     setSelected]     = useState<Set<string>>(new Set())
  const [submitting,   setSubmitting]   = useState(false)

  // Extracted so a language change can re-run it — the option labels below are
  // server-translated. Angular: handleLanguageChange() → runInitialDataPopulation()
  // → getRegistrationDynamicArray(true, 1), then assignRegistrationData() re-resolves
  // the stored KEY against the newly translated list. Re-reading storage here does
  // the same, so the user's selection survives the switch.
  function loadOptions() {
    getRegValues().then((regVals) => {
      const existing = regVals.PROPERTIES
      if (existing) {
        const keys = Array.isArray(existing)
          ? existing
          : String(existing).split('~').filter(Boolean)
        setSelected(new Set(keys))
      }

      fetchPropertyOptions()
        .then(list => setOptions(list.length ? list : FALLBACK_OPTIONS))
        .catch(() => setOptions(FALLBACK_OPTIONS))
        .finally(() => setFetching(false))
    })
  }

  useEffect(() => { loadOptions() }, [])

  useLanguageReload(loadOptions)

  function toggleOption(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleNext() {
    if (submitting) return
    setSubmitting(true)
    try {
      const keys = Array.from(selected)
      await setRegValue('PROPERTIES', keys as any)
      if (keys.length > 0) await submitPropertyDetails(keys)
      navigation.push('onboarding', { pageNo: '29' })
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  function handleSkip() {
    navigation.push('onboarding', { pageNo: '29' })
  }

  useOnboardingFooter({
    nextLoading: submitting,
    onNext: handleNext,
    showSkip: true,
    skipLabel: t('REG.DO_LATER', "I'll do this later"),
    onSkip: handleSkip,
  }, [submitting])

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

        <Text style={styles.title}>Add property details</Text>
        <Text style={styles.subtitle}>
          You can add multiple properties from the below list
        </Text>

        {fetching ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          // Full-width list — marginHorizontal: -24 bleeds out of scrollContent's padding
          <View style={styles.list}>
            {options.map((opt, idx) => {
              const isChecked = selected.has(opt.key)
              const isLast    = idx === options.length - 1
              return (
                <Pressable
                  key={opt.key}
                  style={[
                    styles.row,
                    isChecked && styles.rowSelected,
                    !isLast   && styles.rowDivider,
                  ]}
                  onPress={() => toggleOption(opt.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                  accessibilityLabel={opt.label}
                >
                  <Text style={[styles.rowLabel, isChecked && styles.rowLabelSelected, { fontFamily: langFonts.regular }]}>
                    {opt.label}
                  </Text>
                  <View style={[styles.checkbox, isChecked && styles.checkboxSelected]}>
                    {isChecked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </Pressable>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Figma: 22px SemiBold (matches the standard onboarding title font, but this
  // screen's own subtitle sits right below it with only a 12px gap, not the
  // usual 32px, so this can't just reuse the shared os.title style)
  title: {
    fontSize:     22,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    marginBottom: 12,
  },

  // Figma: black, not gray — 32px gap down to the property list
  subtitle: {
    fontSize:     14,
    fontWeight:   '400',
    color:        Colors.textPrimary,
    marginBottom: 32,
  },

  loader: { marginTop: 48 },

  // Bleeds out of the 24px horizontal padding of os.scrollContent
  list: {
    marginHorizontal: -24,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    Colors.borderSubtle,
  },

  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    height:            44,
    paddingHorizontal: 24,
    backgroundColor:   Colors.surface,
  },
  rowSelected: {
    backgroundColor: Colors.selectionBg,   // #FFF1F5
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },

  rowLabel: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  rowLabelSelected: {
    fontWeight: '500',
  },

  checkbox: {
    width:           20,
    height:          20,
    borderRadius:    4,
    borderWidth:     1.5,
    borderColor:     Colors.borderNeutral,
    backgroundColor: Colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  checkboxSelected: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  checkmark: {
    color:      Colors.white,
    fontSize:   13,
    fontWeight: '700',
    lineHeight: 16,
  },
})
