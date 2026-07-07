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
import SearchablePicker from '../../components/searchable-picker/SearchablePicker'
import { Colors } from '../../constants/colors'
import { StorageKeys as SK } from '../../constants/storage.keys'
import RegistrationSuccessSheet from '../../components/registration-success-sheet/RegistrationSuccessSheet'
import {
  callRegistrationAPI,
  fetchCasteOptions,
  fetchSubcasteOptions,
  getNextPageAfterCaste,
  getRegValues,
  setRegValue,
  getRegValue,
  submitFullRegistration,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'caste.svg'
const FOOTER_H      = 140

// ─── Types ────────────────────────────────────────────────────────────────────

type Option      = { key: string; label: string }
type ActivePanel = 'caste' | 'subcaste' | null

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CasteScreen({ navigation }: Props) {
  const { t } = useTranslation()

  // Options
  const [casteOptions,    setCasteOptions]    = useState<Option[]>([])
  const [subcasteOptions, setSubcasteOptions] = useState<Option[]>([])

  // Selections
  const [selectedCaste,    setSelectedCaste]    = useState<Option | null>(null)
  const [selectedSubcaste, setSelectedSubcaste] = useState<Option | null>(null)

  // UI state
  const [fetchingCaste,    setFetchingCaste]    = useState(true)
  const [fetchingSubcaste, setFetchingSubcaste] = useState(false)
  const [hasSubcaste,      setHasSubcaste]      = useState(false)
  const [submitting,       setSubmitting]       = useState(false)
  const [successVisible,   setSuccessVisible]   = useState(false)
  const [customerCare,     setCustomerCare]     = useState('')

  // Panel state — single modal, one at a time
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)

  // Context
  const [createdBy,    setCreatedBy]    = useState('4')
  const [religion,     setReligion]     = useState('')
  const [mothertongue, setMothertongue] = useState('')

  // ─── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getItem(SK.App.CUSTOMER_CARE),
      getRegValues(),
    ]).then(async ([cb, cc, regVals]) => {
      const { RELIGION: rel, MOTHERTONGUE: mt, CASTE: savedCaste, SUBCASTE: savedSubcaste } = regVals
      if (cb)  setCreatedBy(cb)
      if (rel) setReligion(rel)
      if (mt)  setMothertongue(mt)
      if (cc)  setCustomerCare(cc)

      try {
        const list = await fetchCasteOptions(rel ?? '', mt ?? '')
        setCasteOptions(list)

        if (savedCaste) {
          const found = list.find(o => o.key === savedCaste)
          if (found) {
            setSelectedCaste(found)
            // Also restore subcaste if available
            if (savedSubcaste && rel !== '2') {
              await loadSubcaste(rel ?? '', savedCaste, mt ?? '', savedSubcaste)
            }
          }
        }
      } catch {
        // continue — user can still try
      } finally {
        setFetchingCaste(false)
      }
    })
  }, [])

  // ─── Subcaste loader ──────────────────────────────────────────────────────

  async function loadSubcaste(
    rel: string,
    caste: string,
    mt: string,
    restoreKey?: string,
  ) {
    if (rel === '2') {
      // Christianity — no subcaste
      setHasSubcaste(false)
      setSubcasteOptions([])
      return
    }
    setFetchingSubcaste(true)
    try {
      const list = await fetchSubcasteOptions(rel, caste, mt)
      setSubcasteOptions(list)
      setHasSubcaste(list.length > 0)
      if (restoreKey && list.length > 0) {
        const found = list.find(o => o.key === restoreKey)
        if (found) setSelectedSubcaste(found)
      }
    } catch {
      setHasSubcaste(false)
    } finally {
      setFetchingSubcaste(false)
    }
  }

  // ─── Selection handlers ───────────────────────────────────────────────────

  async function selectCaste(opt: Option) {
    setSelectedCaste(opt)
    setSelectedSubcaste(null)   // clear subcaste when caste changes
    setHasSubcaste(false)
    await loadSubcaste(religion, opt.key, mothertongue)
  }

  function selectSubcaste(opt: Option) {
    setSelectedSubcaste(opt)
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const isChristian = religion === '2'
  const noun        = isChristian ? 'division' : 'caste'
  const nounCap     = isChristian ? 'Division'  : 'Caste'

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.CASTE', 'Select your #PROFILETYPE# caste')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!selectedCaste || submitting) return
    setSubmitting(true)
    try {
      await setRegValue('CASTE', selectedCaste.key)
      if (selectedSubcaste) {
        await setRegValue('SUBCASTE', selectedSubcaste.key)
      }

      const nextPage = await getNextPageAfterCaste(selectedCaste.key)

      if (nextPage === '20') {
        // Final step (no gothra) — send full registration payload to get MATRIID
        const { matriId } = await submitFullRegistration()
        if (matriId) {
          setSuccessVisible(true)
        }
        // else: API cancelled or error — stay on screen so user can retry
      } else {
        // Gothra step follows — just save partial data and proceed
        await callRegistrationAPI({ CASTE: selectedCaste.key })
        navigation.push('onboarding', { pageNo: nextPage })
      }
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  useOnboardingFooter({ nextDisabled: !selectedCaste || submitting, nextLoading: submitting, onNext: handleNext }, [selectedCaste, submitting])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.screen}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={{ uri: CDN_PAGE_ICON }}
          style={os.pageIcon}
          contentFit="contain"
        />

        <Text style={[os.title, { marginBottom: 24 }]}>{title}</Text>

        {fetchingCaste ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.fields}>
            {/* ── Caste / Division select field ──────────────────────── */}
            <View style={styles.fieldWrapper}>
              <View style={styles.fieldLabelBadge}>
                <Text style={styles.fieldLabelText}>{nounCap}</Text>
              </View>
              <Pressable
                style={styles.selectField}
                onPress={() => setActivePanel('caste')}
                accessibilityRole="button"
                accessibilityLabel={`Select ${noun}`}
              >
                <Text
                  style={[
                    styles.selectFieldText,
                    !!selectedCaste && styles.selectFieldTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {selectedCaste ? selectedCaste.label : `Select ${noun}`}
                </Text>
                <Text style={styles.selectFieldArrow}>›</Text>
              </Pressable>
            </View>

            {/* ── Sub caste field — only when available ─────────────── */}
            {selectedCaste && (
              fetchingSubcaste ? (
                <ActivityIndicator
                  color={Colors.primary}
                  size="small"
                  style={styles.subcasteLoader}
                />
              ) : hasSubcaste ? (
                <View style={[styles.fieldWrapper, styles.fieldWrapperGap]}>
                  <View style={styles.fieldLabelBadge}>
                    <Text style={styles.fieldLabelText}>
                      Sub caste{' '}
                      <Text style={styles.fieldLabelOptional}>(Optional)</Text>
                    </Text>
                  </View>
                  <Pressable
                    style={styles.selectField}
                    onPress={() => setActivePanel('subcaste')}
                    accessibilityRole="button"
                    accessibilityLabel="Select sub caste"
                  >
                    <Text
                      style={[
                        styles.selectFieldText,
                        !!selectedSubcaste && styles.selectFieldTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSubcaste ? selectedSubcaste.label : 'Select sub caste'}
                    </Text>
                    <Text style={styles.selectFieldArrow}>›</Text>
                  </Pressable>
                </View>
              ) : null
            )}
          </View>
        )}
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}

      {/* Single picker — renders caste/division or subcaste list based on activePanel */}
      <SearchablePicker
        visible={activePanel !== null}
        title={activePanel === 'caste' ? `Select ${noun}` : 'Select sub caste'}
        placeholder={activePanel === 'caste' ? `Search ${noun}...` : 'Search sub caste...'}
        options={activePanel === 'caste' ? casteOptions : subcasteOptions}
        selectedKey={activePanel === 'caste' ? selectedCaste?.key ?? null : selectedSubcaste?.key ?? null}
        onSelect={activePanel === 'caste' ? selectCaste : selectSubcaste}
        onClose={() => setActivePanel(null)}
      />

      <RegistrationSuccessSheet
        visible={successVisible}
        onContinue={() => {
          setSuccessVisible(false)
          navigation.push('onboarding', { pageNo: '20' })
        }}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────


const styles = StyleSheet.create({
  loader:       { marginTop: 48 },
  subcasteLoader: { marginTop: 20, alignSelf: 'flex-start' },

  fields: { gap: 0 },

  // Floating-label field
  fieldWrapper: {
    position: 'relative',
    marginTop: 8,
  },
  fieldWrapperGap: {
    marginTop: 32,
  },
  fieldLabelBadge: {
    position:          'absolute',
    top:               -8,
    left:              12,
    zIndex:            1,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
    flexDirection:     'row',
    alignItems:        'center',
  },
  fieldLabelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textSecondary,
    lineHeight: 16,
  },
  fieldLabelOptional: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textSecondary,
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
    color:      Colors.scrimSubtle,
  },
  selectFieldTextActive: {
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  selectFieldArrow: {
    fontSize:   22,
    color:      Colors.textPrimary,
    lineHeight: 26,
  },

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
    color:         Colors.link,
    letterSpacing: 0.42,
  },
})
