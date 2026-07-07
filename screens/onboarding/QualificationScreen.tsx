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
  callPartialRegistrationAPI,
  fetchQualificationOptions,
  getRegValue,
  setRegValue,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'qualification.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QualificationScreen({ navigation }: Props) {
  const { t } = useTranslation()

  const [options,    setOptions]    = useState<Option[]>([])
  const [fetching,   setFetching]   = useState(true)
  const [selected,   setSelected]   = useState<string | null>(null)
  const [createdBy,  setCreatedBy]  = useState('4')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('QUALIFICATION'),
    ]).then(([cb, savedQual]) => {
      if (cb)        setCreatedBy(cb)
      if (savedQual) setSelected(savedQual)

      fetchQualificationOptions()
        .then(list => setOptions(list))
        .catch(() => {})
        .finally(() => setFetching(false))
    })
  }, [])

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.QUALIFICATION', 'What is your #PROFILETYPE# highest qualification?')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await setRegValue('QUALIFICATION', selected)
      navigation.push('onboarding', { pageNo: '11' })
      callPartialRegistrationAPI()
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  useOnboardingFooter(
    { nextDisabled: !selected, nextLoading: submitting, onNext: handleNext },
    [selected, submitting],
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />

        <Text style={os.title}>{title}</Text>

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
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: { marginTop: 48 },

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
