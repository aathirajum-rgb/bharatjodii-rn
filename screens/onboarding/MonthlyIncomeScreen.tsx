import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppHeader from '../../components/app-header/AppHeader'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { StorageKeys as SK } from '../../constants/storage.keys'
import i18n from '../../i18n'
import {
  callRegistrationAPI,
  fetchMonthlyIncomeOptions,
  fetchNriIncomeData,
  getRegValues,
  setRegValues,
  getRegValue,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = 'https://imgs.jodii.app/assets/images/svg/registration-new/income.svg'
const FOOTER_H      = 140
const ITEM_H        = 44
const SELECTED_ROW  = '#fff1f5'

const PROFILE_POSSESSIVE: Record<string, string> = {
  '4':  "son's",
  '5':  "daughter's",
  '8':  "brother's",
  '9':  "sister's",
  '10': "friend's",
  '11': "relative's",
}

const LANG_LABEL: Record<string, string> = {
  en: 'Eng', tm: 'Tamil', tl: 'Telugu', ml: 'Malay', kn: 'Kanna',
  hi: 'Hindi', bn: 'Bangla', mt: 'Marathi', or: 'Odia', gj: 'Gujarati', pa: 'Punjabi',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MonthlyIncomeScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

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

  const possessive = PROFILE_POSSESSIVE[createdBy] ?? 'their'
  const title      = `What is ${possessive} monthly Income?`
  const langLabel  = LANG_LABEL[i18n.language] ?? 'Eng'

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
      await callRegistrationAPI({ INCOME: selected, INCOMETYPE: selectedCurrency })
      navigation.push('onboarding', { pageNo: nextPage })
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <AppHeader
        type="registration"
        showBackBtn={navigation.canGoBack()}
        languageLabel={langLabel}
        onBackPress={() => navigation.goBack()}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />

      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: FOOTER_H + (Platform.OS === 'ios' ? insets.bottom : 20) + 12 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={{ uri: CDN_PAGE_ICON }}
          style={styles.pageIcon}
          contentFit="contain"
        />

        <Text style={styles.title}>{title}</Text>

        {fetching ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <>
            {/* Currency picker — NRI users only */}
            {isNRI && currencyType && (
              <View style={styles.currencyWrapper}>
                <Pressable
                  style={styles.currencyField}
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

      {/* Sticky footer */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 20 },
        ]}
      >
        <ButtonRevamp
          label={t('REGISTRATION.NEXTCTA', 'Next')}
          variant="primary"
          size="standard"
          fullWidth
          disabled={!selected}
          loading={submitting}
          onPress={handleNext}
        />

        {!!customerCare && (
          <>
            <View style={styles.divider} />
            <Pressable
              style={styles.helpRow}
              onPress={() => Linking.openURL(`tel:${customerCare}`)}
            >
              <Text style={styles.helpText}>Need help?  Call</Text>
              <Text style={styles.helpPhone}>{customerCare}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: Colors.surface,
  },
  flex1: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop:        24,
  },

  pageIcon: {
    width:        48,
    height:       48,
    marginBottom: 24,
  },

  title: {
    fontSize:     22,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    lineHeight:   28,
    marginBottom: 24,
  },

  loader: { marginTop: 48 },

  // ─── Currency picker ───────────────────────────────────────────────────────
  currencyWrapper: {
    marginBottom: 8,
    zIndex:       10,
  },

  currencyField: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          48,
    borderWidth:     1,
    borderColor:     '#b0b0b0',
    borderRadius:    8,
    paddingLeft:     16,
    paddingRight:    12,
    backgroundColor: Colors.surface,
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
    lineHeight: 16,
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

  currencyDropdown: {
    borderWidth:     1,
    borderColor:     '#b0b0b0',
    borderRadius:    8,
    backgroundColor: Colors.surface,
    marginTop:       4,
    overflow:        'hidden',
  },

  currencyOption: {
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: '#e6e6e6',
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
  list: {
    marginTop: 8,
  },

  listItem: {
    flexDirection:     'row',
    alignItems:        'center',
    height:            ITEM_H,
    paddingVertical:   8,
    borderBottomWidth: 1,
    borderBottomColor: '#e6e6e6',
  },
  listItemSelected: {
    backgroundColor: SELECTED_ROW,
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
    lineHeight: 20,
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
    borderColor:  '#8a8a8a',
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
  footer: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 24,
    paddingTop:        20,
    backgroundColor:   Colors.surface,
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
    color:         '#29339b',
    letterSpacing: 0.42,
  },

  emptyText: {
    fontSize:   14,
    color:      'rgba(0,0,0,0.4)',
    marginTop:  24,
    textAlign:  'center',
  },
})
