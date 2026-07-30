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
  callPartialRegistrationAPI,
  fetchMonthlyIncomeOptions,
  fetchNriIncomeData,
  getRegValues,
  setRegValues,
  getRegValue,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'income.svg'
const FOOTER_H      = 140
const ITEM_H        = 44

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MonthlyIncomeScreen({ navigation }: Props) {
  const { t } = useTranslation()

  // Data
  const [indianOptions,  setIndianOptions]  = useState<Option[]>([])
  const [nriOptions,     setNriOptions]     = useState<Option[]>([])
  const [currencyType,   setCurrencyType]   = useState('')        // e.g., 'AED', 'USD'

  // UI state
  const [fetching,            setFetching]            = useState(true)
  const [selected,            setSelected]            = useState<string | null>(null)
  const [selectedCurrency,    setSelectedCurrency]    = useState('INR')  // 'INR' or NRI currency
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false)
  const [submitting,          setSubmitting]          = useState(false)
  const [customerCare,        setCustomerCare]        = useState('')

  // Context
  const [createdBy,  setCreatedBy]  = useState('4')
  const [gender,     setGender]     = useState('1')
  const [isNRI,      setIsNRI]      = useState(false)

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getItem(SK.User.COUNTRY_CODE),
      getItem(SK.App.CUSTOMER_CARE),
      getRegValues(),
    ]).then(async ([cb, ccode, cc, regVals]) => {
      const { GENDER: gnd, COUNTRY: country, INCOME: savedIncome, INCOMETYPE: savedIncomeType } = regVals
      if (cb)  setCreatedBy(cb)
      if (gnd) setGender(gnd)
      if (cc)  setCustomerCare(cc)

      const nri = ccode !== '91' && !!ccode
      setIsNRI(nri)

      // Restore saved values
      if (savedIncome)     setSelected(savedIncome)
      if (savedIncomeType) setSelectedCurrency(savedIncomeType)

      try {
        if (nri && country) {
          const { indianList, nriList, currencyType: ct } = await fetchNriIncomeData(country)
          setIndianOptions(indianList)
          setNriOptions(nriList)
          if (ct) setCurrencyType(ct)
          // Default to NRI currency if previously selected
          if (!savedIncomeType || savedIncomeType === 'INR') {
            setSelectedCurrency('INR')
          }
        } else {
          const list = await fetchMonthlyIncomeOptions()
          setIndianOptions(list)
        }
      } catch {
        // show empty — user can go back and retry
      } finally {
        setFetching(false)
      }
    })
  }, [])

  // ─── Derived ──────────────────────────────────────────────────────────────

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.INCOME', 'What is your #PROFILETYPE# monthly income?')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  // Active income list depends on selected currency
  const activeOptions = (isNRI && selectedCurrency !== 'INR' && nriOptions.length)
    ? nriOptions
    : indianOptions

  // Currency display label
  const currencyLabel = selectedCurrency === 'INR'
    ? 'Indian Rupees (INR)'
    : currencyType || selectedCurrency

  // Navigation: GENDER='1' (male) → page 13 (Religion), female → page 21
  const nextPage = gender === '1' ? '13' : '21'

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function selectCurrency(currency: string) {
    setSelectedCurrency(currency)
    setCurrencyDropdownOpen(false)
    // Clear income selection when currency changes
    if (currency !== selectedCurrency) {
      setSelected(null)
    }
  }

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await setRegValues({ INCOME: selected, INCOMETYPE: selectedCurrency })
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

        <Text style={os.title}>{title}</Text>

        {fetching ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <>
            {/* Currency picker — NRI users only */}
            {isNRI && currencyType && (
              <View style={styles.currencyWrapper}>
                <Pressable
                  style={[styles.currencyField, currencyDropdownOpen && styles.currencyFieldOpen]}
                  onPress={() => setCurrencyDropdownOpen(v => !v)}
                  accessibilityRole="button"
                  accessibilityLabel="Select currency"
                >
                  {/* Floating label */}
                  <View style={styles.currencyLabelBadge}>
                    <Text style={styles.currencyLabelText}>Currency</Text>
                  </View>
                  <Text style={styles.currencyFieldValue} numberOfLines={1}>
                    {currencyLabel}
                  </Text>
                  <Text style={styles.currencyChevron}>
                    {currencyDropdownOpen ? '∧' : '∨'}
                  </Text>
                </Pressable>

                {/* Inline dropdown */}
                {currencyDropdownOpen && (
                  <View style={styles.currencyDropdown}>
                    <Pressable
                      style={styles.currencyOption}
                      onPress={() => selectCurrency('INR')}
                    >
                      <Text style={[
                        styles.currencyOptionText,
                        selectedCurrency === 'INR' && styles.currencyOptionTextSelected,
                      ]}>
                        Indian Rupees (INR)
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.currencyOption, styles.currencyOptionLast]}
                      onPress={() => selectCurrency(currencyType)}
                    >
                      <Text style={[
                        styles.currencyOptionText,
                        selectedCurrency === currencyType && styles.currencyOptionTextSelected,
                      ]}>
                        {currencyType}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {/* Income radio list */}
            <View style={styles.list}>
              {activeOptions.length === 0 ? (
                <Text style={styles.emptyText}>No options available</Text>
              ) : (
                activeOptions.map((opt, idx) => {
                  const isSelected = selected === opt.key
                  const isLast     = idx === activeOptions.length - 1
                  return (
                    <Pressable
                      key={opt.key}
                      style={[
                        styles.listItem,
                        isSelected && styles.listItemSelected,
                        isLast && styles.listItemLast,
                      ]}
                      onPress={() => setSelected(opt.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text style={[
                        styles.listItemText,
                        isSelected && styles.listItemTextSelected,
                      ]}>
                        {opt.label}
                      </Text>
                      <View style={[styles.radio, isSelected && styles.radioSelected]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    </Pressable>
                  )
                })
              )}
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
  loader: { marginTop: 48 },

  // ─── Currency picker ───────────────────────────────────────────────────────
  currencyWrapper: {
    // Figma: 24px gap between the currency field and the income list below it
    // (the domestic/no-currency-field path gets its title-to-list gap from
    // os.title.marginBottom alone, so this must not add to that case)
    marginBottom: 24,
    zIndex:       10,
  },

  currencyField: {
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
  // Figma renders the field + expanded dropdown as one seamless bordered box —
  // hide this field's bottom border/radius so it merges with the dropdown below
  // (same technique as DOBScreen's fieldOpen).
  currencyFieldOpen: {
    borderBottomLeftRadius:  0,
    borderBottomRightRadius: 0,
    borderBottomColor:       Colors.surface,
  },

  currencyLabelBadge: {
    position:        'absolute',
    top:             -8,
    left:            12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 4,
  },
  currencyLabelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },

  currencyFieldValue: {
    flex:       1,
    fontSize:   14,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },

  currencyChevron: {
    fontSize:   14,
    color:      Colors.textPrimary,
    marginLeft: 8,
  },

  // No top border/radius or top margin — merges seamlessly with currencyFieldOpen above
  currencyDropdown: {
    borderWidth:              1,
    borderTopWidth:           0,
    borderColor:              Colors.inputBorder,
    borderBottomLeftRadius:   8,
    borderBottomRightRadius:  8,
    backgroundColor:          Colors.surface,
    overflow:                 'hidden',
  },

  currencyOption: {
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    height:            40,
    justifyContent:    'center',
  },
  currencyOptionLast: {
    borderBottomWidth: 0,
  },
  currencyOptionText: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  currencyOptionTextSelected: {
    fontWeight: '500',
    color:      Colors.primaryDark,
  },

  // ─── Income list ──────────────────────────────────────────────────────────
  // No marginTop: the domestic path (no currency field) gets its title-to-list
  // gap from os.title.marginBottom alone; the NRI path's field-to-list gap
  // comes from currencyWrapper.marginBottom instead.
  list: {},

  listItem: {
    flexDirection:     'row',
    alignItems:        'center',
    height:            ITEM_H,
    paddingVertical:   8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  listItemSelected: {
    backgroundColor: Colors.selectionBg,
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  listItemLast: {
    borderBottomWidth: 0,
  },

  listItemText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  listItemTextSelected: {
    fontWeight: '500',
  },

  // Radio button (right side)
  radio: {
    width:        20,
    height:       20,
    borderRadius: 10,
    borderWidth:  1.5,
    borderColor:  Colors.borderNeutral,
    alignItems:   'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.primaryDark,
  },
  radioDot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: Colors.primaryDark,
  },

  // ─── Footer ───────────────────────────────────────────────────────────────
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

  emptyText: {
    fontSize:   14,
    color:      Colors.scrimLight,
    marginTop:  24,
    textAlign:  'center',
  },
})
