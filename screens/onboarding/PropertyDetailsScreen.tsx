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
import { StorageKeys as SK } from '../../constants/storage.keys'
import {
  fetchPropertyOptions,
  getRegValues,
  setRegValue,
  submitPropertyDetails,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'property.svg'
const FOOTER_H      = 160

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

  const [options,      setOptions]      = useState<Option[]>([])
  const [fetching,     setFetching]     = useState(true)
  const [selected,     setSelected]     = useState<Set<string>>(new Set())
  const [customerCare, setCustomerCare] = useState('')
  const [submitting,   setSubmitting]   = useState(false)

  useEffect(() => {
    Promise.all([
      getRegValues(),
      getItem(SK.App.CUSTOMER_CARE),
    ]).then(([regVals, cc]) => {
      if (cc) setCustomerCare(cc)

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
  }, [])

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
                  <Text style={[styles.rowLabel, isChecked && styles.rowLabelSelected]}>
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
  title: {
    fontSize:     24,
    fontWeight:   '700',
    color:        Colors.textPrimary,
    lineHeight:   30,
    marginBottom: 8,
  },

  subtitle: {
    fontSize:     14,
    fontWeight:   '400',
    color:        Colors.textSecondary,
    lineHeight:   20,
    marginBottom: 28,
  },

  loader: { marginTop: 48 },

  // Bleeds out of the 24px horizontal padding of os.scrollContent
  list: {
    marginHorizontal: -24,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    Colors.border,
  },

  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 24,
    paddingVertical:   16,
    backgroundColor:   Colors.surface,
  },
  rowSelected: {
    backgroundColor: Colors.selectionBg,   // #FFF1F5
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },

  rowLabel: {
    flex:       1,
    fontSize:   15,
    fontWeight: '400',
    color:      Colors.textPrimary,
    lineHeight: 22,
    marginRight: 12,
  },
  rowLabelSelected: {
    fontWeight: '700',
  },

  checkbox: {
    width:           24,
    height:          24,
    borderRadius:    6,
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

  // Skip — always below Next button
  skipRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize:   15,
    fontWeight: '500',
    color:      Colors.textMedium,
  },
  skipArrow: {
    fontSize:   18,
    color:      Colors.textMedium,
    lineHeight: 22,
  },

  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop:       4,
    marginBottom:    12,
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
    color:         Colors.link,
    letterSpacing: 0.42,
  },
})
