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
  fetchEducationGroupOptions,
  fetchQualificationOptions,
  getRegValue,
  isEducationGroupEligible,
  setRegValue,
  updateFewMoreDetail,
} from '../../service/registrationService'
import SearchablePicker from '../../components/searchable-picker/SearchablePicker'
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

  // ── Education Group (JODII-490) — dependent optional field, only shown for
  // Master's/Bachelor's qualifications (isEducationGroupEligible). ──────────
  const [eduGroupOptions,  setEduGroupOptions]  = useState<Option[]>([])
  const [selectedEduGroup, setSelectedEduGroup] = useState<Option | null>(null)
  const [eduGroupPanelVisible, setEduGroupPanelVisible] = useState(false)

  async function loadEduGroup(qualKey: string, restoreKey?: string | null) {
    if (!isEducationGroupEligible(qualKey)) {
      setEduGroupOptions([])
      setSelectedEduGroup(null)
      return
    }
    const list = await fetchEducationGroupOptions(qualKey)
    setEduGroupOptions(list)
    if (restoreKey) {
      const found = list.find(o => o.key === restoreKey)
      setSelectedEduGroup(found ?? null)
    } else {
      setSelectedEduGroup(null)
    }
  }

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('QUALIFICATION'),
      getRegValue('EDUGROUP'),
    ]).then(([cb, savedQual, savedEduGroup]) => {
      if (cb)        setCreatedBy(cb)
      if (savedQual) setSelected(savedQual)

      fetchQualificationOptions()
        .then(list => setOptions(list))
        .catch(() => {})
        .finally(() => setFetching(false))

      if (savedQual) loadEduGroup(savedQual, savedEduGroup)
    })
  }, [])

  async function selectQualification(opt: Option) {
    setSelected(opt.key)
    await loadEduGroup(opt.key)
  }

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

      // Education Group is optional and never blocks Next (same convention as
      // CasteScreen's Subcaste) — but if the field is eligible, Angular still
      // fires updprofileinfo even with an empty value, to clear any stale
      // saved value from a previous qualification. Fire-and-forget + silent
      // retroactive clear on rejection mirrors Angular's current (2026-08-14)
      // onboarding behavior — see updateFewMoreDetail()'s header comment.
      if (isEducationGroupEligible(selected)) {
        const eduGroupValue = selectedEduGroup?.key ?? ''
        await setRegValue('EDUGROUP', eduGroupValue)
        updateFewMoreDetail('EDUDETAILS', eduGroupValue).then(({ valid }) => {
          if (!valid) setRegValue('EDUGROUP', '')
        }).catch(() => {})
      } else {
        await setRegValue('EDUGROUP', '')
      }

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
                  onPress={() => selectQualification(opt)}
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

        {/* ── Education Group (JODII-490) — optional, only for Master's/Bachelor's ── */}
        {!fetching && selected && isEducationGroupEligible(selected) && (
          <View style={styles.eduGroupWrapper}>
            <View style={styles.eduGroupLabelBadge}>
              <Text style={styles.eduGroupLabelText}>
                {t('REGISTRATION.EDUCATIONGROUP', 'Education')}{' '}
                <Text style={styles.eduGroupLabelOptional}>(Optional)</Text>
              </Text>
            </View>
            <Pressable
              style={styles.selectField}
              onPress={() => setEduGroupPanelVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('REGISTRATION.SELECTEDUCATIONGROUP', 'Select education')}
            >
              <Text
                style={[styles.selectFieldText, !!selectedEduGroup && styles.selectFieldTextActive]}
                numberOfLines={1}
              >
                {selectedEduGroup ? selectedEduGroup.label : t('REGISTRATION.SELECTEDUCATIONGROUP', 'Select education')}
              </Text>
              <Text style={styles.selectFieldArrow}>›</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <SearchablePicker
        visible={eduGroupPanelVisible}
        title={t('REGISTRATION.SELECTEDUCATIONGROUP', 'Select education')}
        placeholder={t('REGISTRATION.SEARCHEDUCATIONGROUP', 'Search education...')}
        options={eduGroupOptions}
        selectedKey={selectedEduGroup?.key ?? null}
        onSelect={(opt) => setSelectedEduGroup(opt)}
        onClose={() => setEduGroupPanelVisible(false)}
      />
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

  // Education Group — dependent field, styled like CasteScreen's Subcaste field
  eduGroupWrapper: {
    position:  'relative',
    marginTop: 32,
  },
  eduGroupLabelBadge: {
    position:          'absolute',
    top:               -8,
    left:              12,
    zIndex:            1,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
    flexDirection:     'row',
    alignItems:        'center',
  },
  eduGroupLabelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  eduGroupLabelOptional: {
    fontSize:   12,
    fontWeight: '400',
    color:      'rgba(0,0,0,0.4)',
  },
  selectField: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          48,
    borderWidth:     1,
    borderColor:     Colors.inputBorder,
    borderRadius:    8,
    paddingLeft:     16,
    paddingRight:    12,
    backgroundColor: Colors.surface,
  },
  selectFieldText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  selectFieldTextActive: {
    fontWeight: '500',
  },
  selectFieldArrow: {
    fontSize:   22,
    color:      Colors.textPrimary,
    lineHeight: 26,
  },
})
