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
import { SvgXml } from 'react-native-svg'
import { Colors } from '../../constants/colors'
import { StorageKeys as SK } from '../../constants/storage.keys'
import SearchablePicker from '../../components/searchable-picker/SearchablePicker'
import {
  callPartialRegistrationAPI,
  fetchMonthlyIncomeOptions,
  fetchNriIncomeData,
  getRegValues,
  setRegValues,
  getRegValue,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { CDN_REG, CDN_LOTTIE } from '../../constants/cdn'
import CdnLottie from '../../components/CdnLottie'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'income.svg'
// Angular's dropdown-field arrow is Ionic's "chevron-forward-outline" icon —
// same one MotherTongueScreen/HeightScreen inline, for a pixel-exact match.
const CHEVRON_FORWARD_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M184 112l144 144-144 144"/></svg>`

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MonthlyIncomeScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  // Data
  const [indianOptions,  setIndianOptions]  = useState<Option[]>([])
  const [nriOptions,     setNriOptions]     = useState<Option[]>([])
  const [currencyType,   setCurrencyType]   = useState('')        // e.g., 'AED', 'USD'

  // UI state
  const [fetching,          setFetching]          = useState(true)
  const [selected,          setSelected]          = useState<Option | null>(null)
  const [selectedCurrency,  setSelectedCurrency]  = useState('INR')  // 'INR' or NRI currency
  const [incomePanelVisible,    setIncomePanelVisible]    = useState(false)
  const [currencyPanelVisible,  setCurrencyPanelVisible]  = useState(false)
  const [submitting,        setSubmitting]        = useState(false)

  // Context
  const [createdBy,  setCreatedBy]  = useState('4')
  const [gender,     setGender]     = useState('1')
  const [isNRI,      setIsNRI]      = useState(false)

  // Extracted so a language change can re-run it — the option labels below are
  // server-translated. Angular: handleLanguageChange() → runInitialDataPopulation()
  // → getRegistrationDynamicArray(true, 1), then assignRegistrationData() re-resolves
  // the stored KEY against the newly translated list. Re-reading storage here does
  // the same, so the user's selection survives the switch.
  function loadOptions() {
    Promise.all([
      getRegValue('CREATEDBY'),
      getItem(SK.User.COUNTRY_CODE),
      getRegValues(),
    ]).then(async ([cb, ccode, regVals]) => {
      const { GENDER: gnd, COUNTRY: country, INCOME: savedIncome, INCOMETYPE: savedIncomeType } = regVals
      if (cb)  setCreatedBy(cb)
      if (gnd) setGender(gnd)

      const nri = ccode !== '91' && !!ccode
      setIsNRI(nri)

      if (savedIncomeType) setSelectedCurrency(savedIncomeType)

      try {
        let list: Option[] = []
        if (nri && country) {
          const { indianList, nriList, currencyType: ct } = await fetchNriIncomeData(country)
          setIndianOptions(indianList)
          setNriOptions(nriList)
          if (ct) setCurrencyType(ct)
          // Default to NRI currency if previously selected
          const effectiveCurrency = (!savedIncomeType || savedIncomeType === 'INR') ? 'INR' : savedIncomeType
          if (!savedIncomeType || savedIncomeType === 'INR') setSelectedCurrency('INR')
          list = effectiveCurrency === 'INR' ? indianList : nriList
        } else {
          list = await fetchMonthlyIncomeOptions()
          setIndianOptions(list)
        }

        // Restore saved income selection (back navigation)
        if (savedIncome) {
          const found = list.find(o => o.key === savedIncome)
          if (found) setSelected(found)
        }
      } catch {
        // show empty — user can go back and retry
      } finally {
        setFetching(false)
      }
    })
  }

  useEffect(() => { loadOptions() }, [])

  useLanguageReload(loadOptions)

  // ─── Derived ──────────────────────────────────────────────────────────────

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.INCOME', 'What is your #PROFILETYPE# monthly income?')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  // Angular: registration.config.ts page 12 — top-level LABEL/PLACEHOLDERTXT
  // for the currency field, LISTDATA[0] LABEL/PLACEHOLDERTXT for the income
  // field (ISSHOWSEARCHBAR: false on both — no search box in either panel).
  const currencyFieldLabelText = t('REGISTRATION.CURRENCY', 'Currency')
  const currencyPlaceholderText = t('REGISTRATION.CURRENCYTYPE', 'Select currency type')
  const incomeFieldLabelText = t('GENERAL.MONTHLYINCOME', 'Income')
  const incomePlaceholderText = t('REGISTRATION.SELECTINCOME', 'Select monthly income')

  // Active income list depends on selected currency
  const activeOptions = (isNRI && selectedCurrency !== 'INR' && nriOptions.length)
    ? nriOptions
    : indianOptions

  // Currency options — INR always first, then the NRI currency (e.g. AED/USD)
  const currencyOptions: Option[] = [
    { key: 'INR', label: 'Indian Rupees (INR)' },
    ...(currencyType ? [{ key: currencyType, label: currencyType }] : []),
  ]
  const selectedCurrencyOption = currencyOptions.find(c => c.key === selectedCurrency) ?? null

  // Navigation: GENDER='1' (male) → page 13 (Religion), female → page 21
  const nextPage = gender === '1' ? '13' : '21'

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function selectCurrency(opt: Option) {
    if (opt.key !== selectedCurrency) {
      setSelectedCurrency(opt.key)
      setSelected(null)
    }
  }

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await setRegValues({ INCOME: selected.key, INCOMETYPE: selectedCurrency })
      navigation.push('onboarding', { pageNo: nextPage })
      callPartialRegistrationAPI()
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  useOnboardingFooter({ nextDisabled: !selected, nextLoading: submitting, onNext: handleNext }, [selected, submitting])

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

        {fetching ? (
          <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} style={styles.loader} />
        ) : (
          <View style={styles.fieldsContainer}>
            {/* Currency field — NRI users only. Angular: registration.config.ts
                page 12's top-level LABEL/PLACEHOLDERTXT, same dropdown+
                right-side-panel pattern as the income field below, not the
                previous inline expand-down control. */}
            {isNRI && currencyType && (
              <View style={styles.selectFieldWrapper}>
                {!!selectedCurrencyOption && (
                  <View style={styles.selectFieldLabel} pointerEvents="none">
                    <Text style={[styles.selectFieldLabelText, { fontFamily: langFonts.regular }]}>
                      {currencyFieldLabelText}
                    </Text>
                  </View>
                )}
                <Pressable
                  style={styles.selectField}
                  onPress={() => setCurrencyPanelVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Select currency"
                >
                  <Text
                    style={[
                      styles.selectFieldText,
                      !!selectedCurrencyOption && styles.selectFieldTextActive,
                      { fontFamily: selectedCurrencyOption ? langFonts.medium : langFonts.regular },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedCurrencyOption ? selectedCurrencyOption.label : currencyPlaceholderText}
                  </Text>
                  <SvgXml xml={CHEVRON_FORWARD_XML} width={24} height={24} />
                </Pressable>
              </View>
            )}

            {/* Income field — Angular: ISDROPDOWN: true, VISIBLETYPE: SIDEPANEL,
                ISSHOWSEARCHBAR: false — a dropdown field opening a right-side
                sheet with no search box, same as MotherTongueScreen/
                OccupationScreen, not the previous inline radio list. */}
            <View style={styles.selectFieldWrapper}>
              {!!selected && (
                <View style={styles.selectFieldLabel} pointerEvents="none">
                  <Text style={[styles.selectFieldLabelText, { fontFamily: langFonts.regular }]}>
                    {incomeFieldLabelText}
                  </Text>
                </View>
              )}
              <Pressable
                style={styles.selectField}
                onPress={() => setIncomePanelVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Select monthly income"
              >
                <Text
                  style={[
                    styles.selectFieldText,
                    !!selected && styles.selectFieldTextActive,
                    { fontFamily: selected ? langFonts.medium : langFonts.regular },
                  ]}
                  numberOfLines={1}
                >
                  {selected ? selected.label : incomePlaceholderText}
                </Text>
                <SvgXml xml={CHEVRON_FORWARD_XML} width={24} height={24} />
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}

      <SearchablePicker
        visible={currencyPanelVisible}
        title={currencyPlaceholderText}
        placeholder=""
        hideSearch
        options={currencyOptions}
        selectedKey={selectedCurrency}
        onSelect={selectCurrency}
        onClose={() => setCurrencyPanelVisible(false)}
      />

      <SearchablePicker
        visible={incomePanelVisible}
        title={incomePlaceholderText}
        placeholder=""
        hideSearch
        options={activeOptions}
        selectedKey={selected?.key ?? null}
        onSelect={(opt) => setSelected(opt)}
        onClose={() => setIncomePanelVisible(false)}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: { alignSelf: 'center', marginTop: 48 },

  // 32px between fields, matching LocationScreen/other multi-field onboarding pages
  fieldsContainer: {
    gap: 32,
  },

  selectFieldWrapper: {
    position:  'relative',
    marginTop: 8,
  },
  selectFieldLabel: {
    position:          'absolute',
    top:               -8,
    left:              12,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
    zIndex:            10,
  },
  selectFieldLabelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textPrimary,
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
})
