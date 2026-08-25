import { useEffect, useMemo, useState } from 'react'
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
import RegistrationSuccessSheet from '../../components/registration-success-sheet/RegistrationSuccessSheet'
import {
  callPartialRegistrationAPI,
  fetchCasteOptions,
  fetchSubcasteOptions,
  getNextPageAfterCaste,
  getRegValues,
  setRegValue,
  getRegValue,
  submitFullRegistration,
  resolvePostInsertAction,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { resetTo } from '../../utils/navigationRef'
import { ENavigation } from '../../types/enums/navigation.enum'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

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
  const langFonts = useLanguageFonts()

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

  // Panel state — single modal, one at a time
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)

  // Context
  const [createdBy,    setCreatedBy]    = useState('4')
  const [religion,     setReligion]     = useState('')
  const [mothertongue, setMothertongue] = useState('')

  // ─── Init ────────────────────────────────────────────────────────────────

  // Extracted so a language change can re-run it — the option labels below are
  // server-translated. Angular: handleLanguageChange() → runInitialDataPopulation()
  // → getRegistrationDynamicArray(true, 1), then assignRegistrationData() re-resolves
  // the stored KEY against the newly translated list. Re-reading storage here does
  // the same, so the user's selection survives the switch.
  function loadOptions() {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValues(),
    ]).then(async ([cb, regVals]) => {
      const { RELIGION: rel, MOTHERTONGUE: mt, CASTE: savedCaste, SUBCASTE: savedSubcaste } = regVals
      if (cb)  setCreatedBy(cb)
      if (rel) setReligion(rel)
      if (mt)  setMothertongue(mt)

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
  }

  useEffect(() => { loadOptions() }, [])

  useLanguageReload(loadOptions)

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

  // Angular sorts the caste list alphabetically by label (form-fields.component.ts,
  // the `data.field == 'CASTE'` block). The API's own object order is NOT used.
  // Angular additionally floats the selected caste to the top; we intentionally
  // skip that pass so the list keeps a stable alphabetical order.
  const orderedCasteOptions = useMemo(() => {
    const items = [...casteOptions]
    items.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
    return items
  }, [casteOptions])

  const isChristian = religion === '2'
  const noun        = isChristian ? 'division' : 'caste'
  const nounCap     = isChristian ? 'Division'  : 'Caste'

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.CASTE', 'Select your #PROFILETYPE# caste')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  const casteLabelText     = t('REGISTRATION.CASTELABEL', 'Caste')
  const selectCasteText    = t('REGISTRATION.SELECTCASTE', 'Select caste')
  const searchCasteText    = t('REGISTRATION.SEARCHCASTE', 'Search caste')
  const subcasteLabelText  = t('REGISTRATION.SUBCASTELABEL', 'SubCaste')
  const selectSubcasteText = t('REGISTRATION.SELECTSUBCASTE', 'Select subcaste')
  const searchSubcasteText = t('REGISTRATION.SEARCHSUBCASTE', 'Search subcaste')

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
        const res = await submitFullRegistration()
        if (res.matriId) {
          // Angular: callInsertApiAndHandleValidation() — the insert response's
          // AIVALIDATIONTYPE decides between the success sheet, the confirm
          // form, and the "profile under review" wait state.
          const action = await resolvePostInsertAction(res.aiValidationType, res.violationFields)
          if (action === 'success') setSuccessVisible(true)
          else resetTo(ENavigation.VALIDATION, action === 'underReview'
            ? { mode: 'underReview' }
            : { mode: 'confirm', violationFields: res.violationFields ?? [] })
        }
        // else: API cancelled or error — stay on screen so user can retry
      } else {
        // Gothra step follows — just save partial data and proceed
        navigation.push('onboarding', { pageNo: nextPage })
        callPartialRegistrationAPI()
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

        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        {fetchingCaste ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.fields}>
            {/* ── Caste / Division select field ──────────────────────── */}
            <View style={styles.fieldWrapper}>
              <View style={styles.fieldLabelBadge}>
                <Text style={[styles.fieldLabelText, { fontFamily: langFonts.regular }]}>
                  {isChristian ? nounCap : casteLabelText}
                </Text>
              </View>
              <Pressable
                style={styles.selectField}
                onPress={() => setActivePanel('caste')}
                accessibilityRole="button"
                accessibilityLabel={isChristian ? `Select ${noun}` : selectCasteText}
              >
                <Text
                  style={[
                    styles.selectFieldText,
                    !!selectedCaste && styles.selectFieldTextActive,
                    { fontFamily: selectedCaste ? langFonts.medium : langFonts.regular },
                  ]}
                  numberOfLines={1}
                >
                  {selectedCaste ? selectedCaste.label : (isChristian ? `Select ${noun}` : selectCasteText)}
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
                    <Text style={[styles.fieldLabelText, { fontFamily: langFonts.regular }]}>
                      {subcasteLabelText}{' '}
                      <Text style={styles.fieldLabelOptional}>(Optional)</Text>
                    </Text>
                  </View>
                  <Pressable
                    style={styles.selectField}
                    onPress={() => setActivePanel('subcaste')}
                    accessibilityRole="button"
                    accessibilityLabel={selectSubcasteText}
                  >
                    <Text
                      style={[
                        styles.selectFieldText,
                        !!selectedSubcaste && styles.selectFieldTextActive,
                        { fontFamily: selectedSubcaste ? langFonts.medium : langFonts.regular },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSubcaste ? selectedSubcaste.label : selectSubcasteText}
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
        title={activePanel === 'caste' ? (isChristian ? `Select ${noun}` : selectCasteText) : selectSubcasteText}
        placeholder={activePanel === 'caste' ? (isChristian ? `Search ${noun}` : searchCasteText) : searchSubcasteText}
        options={activePanel === 'caste' ? orderedCasteOptions : subcasteOptions}
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
  // Angular .floating body3-regular-12 black-color: black, not gray
  fieldLabelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  // Figma: "(Optional)" suffix is a distinct lighter gray, not Colors.textSecondary
  fieldLabelOptional: {
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
  // Angular's placeholder/value span is always black-color; only weight toggles
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
