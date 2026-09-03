import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Animated, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import SearchablePicker from '../../components/searchable-picker/SearchablePicker'
import { Colors } from '../../constants/colors'
import {
  fetchDateOptions,
  fetchHoroCities,
  fetchMonthOptions,
  fetchStates,
  fetchYearOptions,
  getRegistrationArrays,
  getRegValues,
  setRegValues,
} from '../../service/registrationService'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { CDN_REVAMP, CDN_LOTTIE } from '../../constants/cdn'
import CdnLottie from '../../components/CdnLottie'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { useLanguageReload } from '../../hooks/useLanguageReload'

// ─── Constants ────────────────────────────────────────────────────────────────
// Angular pageType 30 (registration.config.ts) — HOROSTATE/HOROCITY plus the
// same Date/Month/Year dropdown triplet DOBScreen.tsx (page 5) uses, pre-filled
// from the already-saved DOB. Unlike page 29/5, page 30's config has NO
// ICONTYPE and its SUBTITLE is explicitly suppressed
// (`!['30'].includes(currentPageType)` in registration-revamp.component.html) —
// so this screen renders no icon and no subtitle line under the title.
const CDN_ARROW_DOWN = CDN_REVAMP + 'down-arrow.svg'
const ITEM_H         = 40
const MAX_LIST_ITEMS = 7

// Fallback only, same as DOBScreen.tsx — used until fetchMonthOptions() resolves.
const MONTH_FALLBACK = [
  { key: '1',  label: 'January'   }, { key: '2',  label: 'February'  },
  { key: '3',  label: 'March'     }, { key: '4',  label: 'April'     },
  { key: '5',  label: 'May'       }, { key: '6',  label: 'June'      },
  { key: '7',  label: 'July'      }, { key: '8',  label: 'August'    },
  { key: '9',  label: 'September' }, { key: '10', label: 'October'   },
  { key: '11', label: 'November'  }, { key: '12', label: 'December'  },
]

function getDaysInMonth(month: string, year: string): { key: string; label: string }[] {
  const m     = Number(month) || 1
  const y     = Number(year)  || 2000
  const count = new Date(y, m, 0).getDate()
  return Array.from({ length: count }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    return { key: String(i + 1), label: d }
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Option    = { key: string; label: string }
type PanelKind = 'state' | 'city'
type DateField = 'date' | 'month' | 'year'

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HoroscopeBirthDetailsScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  const [createdBy,       setCreatedBy]       = useState('4')
  const [gender,          setGender]          = useState('1')

  const [states,          setStates]          = useState<Option[]>([])
  const [cities,          setCities]          = useState<Option[]>([])
  const [selectedState,   setSelectedState]   = useState<Option | null>(null)
  const [selectedCity,    setSelectedCity]    = useState<Option | null>(null)

  // Pre-filled from the already-saved DATE/MONTH/YEAR (see effect below) —
  // Angular's isCheckValidValue()/showDobList() lets the user re-pick any of
  // the three exactly like DOBScreen.tsx's page-5 fields.
  const [selDate,  setSelDate]  = useState('')
  const [selMonth, setSelMonth] = useState('')
  const [selYear,  setSelYear]  = useState('')
  const [months,   setMonths]   = useState(MONTH_FALLBACK)
  const [apiYears, setApiYears] = useState<Option[] | null>(null)
  const [apiDates, setApiDates] = useState<Option[] | null>(null)

  const [pickerField, setPickerField] = useState<DateField | null>(null)
  const dateRef  = useRef<View>(null)
  const monthRef = useRef<View>(null)
  const yearRef  = useRef<View>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 94 })
  const dateArrowAnim  = useRef(new Animated.Value(0)).current
  const monthArrowAnim = useRef(new Animated.Value(0)).current
  const yearArrowAnim  = useRef(new Animated.Value(0)).current

  const [fetchingStates,  setFetchingStates]  = useState(true)
  const [fetchingCities,  setFetchingCities]  = useState(false)
  const [submitting,      setSubmitting]      = useState(false)

  const [panelKind,       setPanelKind]       = useState<PanelKind>('state')
  const [panelVisible,    setPanelVisible]    = useState(false)

  useEffect(() => {
    getRegValues().then(rv => {
      if (rv.CREATEDBY) setCreatedBy(rv.CREATEDBY)
      if (rv.GENDER)    setGender(rv.GENDER)

      if (rv.DATE)  setSelDate(String(Number(rv.DATE)))
      if (rv.MONTH) setSelMonth(String(Number(rv.MONTH)))
      if (rv.YEAR)  setSelYear(rv.YEAR)
    })
  }, [])

  // Server-translated state/city labels — same fetchStates()/fetchHoroCities()
  // used for the initial load AND re-run on a language change (useLanguageReload
  // below), the same way loadMonths()/loadYears()/loadDates() already do further
  // down. On a language-triggered reload this force-refreshes
  // getRegistrationArrays() itself first (force=true) rather than trusting
  // fetchStates()'s own cache check — submitLanguage() already force-refreshes
  // it during the switch, but re-forcing here removes any dependency on the two
  // running in a particular order relative to this screen's own listener.
  function loadStatesAndCities(force = false) {
    getRegValues().then(async rv => {
      try {
        if (force) await getRegistrationArrays(true)
        const stateList = await fetchStates()
        setStates(stateList)

        // Angular defaults HOROSTATE to NATIVESTATE, falling back to STATE
        const savedHoroState = rv.HOROSTATE || rv.NATIVESTATE || rv.STATE || ''
        if (savedHoroState) {
          const found = stateList.find(s => s.key === savedHoroState)
          if (found) {
            setSelectedState(found)
            setFetchingCities(true)
            try {
              const cityList = await fetchHoroCities(found.key)
              setCities(cityList)
              if (rv.HOROCITY) {
                const foundCity = cityList.find(c => c.key === rv.HOROCITY)
                if (foundCity) setSelectedCity(foundCity)
              }
            } catch {
              // user can retry by reopening the city picker
            } finally {
              setFetchingCities(false)
            }
          }
        }
      } catch {
        // user can retry by reopening the state picker
      } finally {
        setFetchingStates(false)
      }
    })
  }
  useEffect(() => { loadStatesAndCities(false) }, [])
  useLanguageReload(() => loadStatesAndCities(true))

  // Server-translated month names, same as DOBScreen.tsx.
  function loadMonths() {
    fetchMonthOptions()
      .then(list => { if (list.length) setMonths(list) })
      .catch(() => {})
  }
  useEffect(() => { loadMonths() }, [])
  useLanguageReload(loadMonths)

  function loadYears() {
    fetchYearOptions(gender)
      .then(list => setApiYears(list.length ? list : null))
      .catch(() => {})
  }
  useEffect(() => { loadYears() }, [gender])
  useLanguageReload(loadYears)

  function loadDates() {
    fetchDateOptions(selMonth, selYear)
      .then(list => setApiDates(list.length ? list : null))
      .catch(() => {})
  }
  useEffect(() => { loadDates() }, [selMonth, selYear])
  useLanguageReload(loadDates)

  function getDateOptions(field: DateField) {
    if (field === 'month') return months
    if (field === 'year')  return apiYears ?? []
    return apiDates ?? getDaysInMonth(selMonth, selYear)
  }

  function getCurrentDateVal(field: DateField) {
    if (field === 'date')  return selDate
    if (field === 'month') return selMonth
    return selYear
  }

  function refForField(field: DateField) {
    if (field === 'date')  return dateRef
    if (field === 'month') return monthRef
    return yearRef
  }

  function animForField(field: DateField) {
    if (field === 'date')  return dateArrowAnim
    if (field === 'month') return monthArrowAnim
    return yearArrowAnim
  }

  function rotateArrow(field: DateField, toOpen: boolean) {
    Animated.timing(animForField(field), { toValue: toOpen ? 1 : 0, duration: 180, useNativeDriver: true }).start()
  }

  function openDatePicker(field: DateField) {
    const ref = refForField(field)
    ref.current?.measureInWindow((x, y, w, h) => {
      const dropW = field === 'month' ? Math.max(w, 130) : w
      setDropdownPos({ top: y + h, left: x, width: dropW })
      setPickerField(field)
      rotateArrow(field, true)
    })
  }

  function closeDatePicker() {
    if (pickerField) rotateArrow(pickerField, false)
    setPickerField(null)
  }

  function handleDatePick(field: DateField, key: string) {
    if (field === 'date') {
      setSelDate(key)
    } else if (field === 'month') {
      setSelMonth(key)
      if (selDate) {
        const days = getDaysInMonth(key, selYear)
        if (Number(selDate) > days.length) setSelDate('')
      }
    } else {
      setSelYear(key)
      if (selDate && selMonth === '2') {
        const days = getDaysInMonth(selMonth, key)
        if (Number(selDate) > days.length) setSelDate('')
      }
    }
    closeDatePicker()
  }

  function openPanel(kind: PanelKind) {
    setPanelKind(kind)
    setPanelVisible(true)
  }

  async function onStateSelect(opt: Option) {
    setSelectedState(opt)
    setSelectedCity(null)
    setCities([])
    setFetchingCities(true)
    try {
      const cityList = await fetchHoroCities(opt.key)
      setCities(cityList)
    } catch {
      setCities([])
    } finally {
      setFetchingCities(false)
    }
  }

  function onCitySelect(opt: Option) {
    setSelectedCity(opt)
  }

  // Angular TITLE for page 30 is the SAME key as page 29 (GENERATEHOROSCOPE,
  // "Generate #PROFILETYPE# horoscope") — there is no separate
  // GENERATEHOROSCOPEBIRTH key. Page 30's SUBTITLE render is explicitly
  // suppressed (`!['30'].includes(currentPageType)`), so no subtitle line here.
  const possessiveKey = PROFILE_POSSESSIVE[createdBy]
  const possessiveTKey = possessiveKey?.toUpperCase()
  const translatedProfileType = possessiveTKey ? t(`REGISTRATION.${possessiveTKey}`) : ''
  const title = t('REGISTRATION.GENERATEHOROSCOPE', 'Generate #PROFILETYPE# horoscope')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  const isAllDateSelected = !!(selDate && selMonth && selYear)
  const canSubmit = !!selectedState && !!selectedCity && isAllDateSelected && !submitting

  async function handleNext() {
    if (!canSubmit || !selectedState || !selectedCity) return
    setSubmitting(true)
    try {
      await setRegValues({
        HOROSTATE: selectedState.key,
        HOROCITY:  selectedCity.key,
        DATE:      selDate,
        MONTH:     selMonth,
        YEAR:      selYear,
      })
      navigation.push('onboarding', { pageNo: '31' })
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  useOnboardingFooter({ nextDisabled: !canSubmit, nextLoading: submitting, onNext: handleNext }, [canSubmit, submitting])

  // ─── Render ───────────────────────────────────────────────────────────────

  const datePlaceholder  = t('REGISTRATION.DATE',  'Date')
  const monthPlaceholder = t('REGISTRATION.MONTH', 'Month')
  const yearPlaceholder  = t('REGISTRATION.YEAR',  'Year')
  const selMonthLabel    = months.find(m => m.key === selMonth)?.label ?? ''

  const pickerOptions = pickerField ? getDateOptions(pickerField) : []
  const currentPickerVal = pickerField ? getCurrentDateVal(pickerField) : ''
  const listH = Math.min(pickerOptions.length, MAX_LIST_ITEMS) * ITEM_H

  return (
    <View style={os.screen}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Angular's page-30 config has no ICONTYPE — no icon here, unlike
            every other onboarding screen. */}
        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        {fetchingStates ? (
          <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} style={[styles.loader, { alignSelf: 'center' }]} />
        ) : (
          <View style={styles.fieldsContainer}>
            <FloatField
              label={t('REG.STATE_BIRTH', 'State of birth')}
              value={selectedState?.label ?? ''}
              placeholder={t('REGISTRATION.SELECTSTATE', 'Select state')}
              onPress={() => openPanel('state')}
              hasValue={!!selectedState}
              langFonts={langFonts}
            />

            <FloatField
              label={t('REG.CITY_BIRTH', 'City of birth')}
              value={selectedCity?.label ?? ''}
              placeholder={fetchingCities ? t('GENERAL.LOADING', 'Loading…') : t('REGISTRATION.SELECTCITY', 'Select city')}
              onPress={() => {
                if (!selectedState || fetchingCities) return
                openPanel('city')
              }}
              hasValue={!!selectedCity}
              disabled={!selectedState || fetchingCities}
              loading={fetchingCities}
              langFonts={langFonts}
            />

            {/* Date / Month / Year — same dropdown-trigger fields as DOBScreen.tsx
                (page 5), pre-filled from the already-saved DOB and still editable
                (Angular: isCheckValidValue()/showDobList() on currentPageType == '30'). */}
            <View style={styles.dateRow}>
              {(
                [
                  { field: 'date'  as DateField, ref: dateRef,  val: selDate,  display: selDate ? selDate.padStart(2, '0') : '', placeholder: datePlaceholder  },
                  { field: 'month' as DateField, ref: monthRef, val: selMonth, display: selMonthLabel,                           placeholder: monthPlaceholder },
                  { field: 'year'  as DateField, ref: yearRef,  val: selYear,  display: selYear,                                 placeholder: yearPlaceholder  },
                ] as const
              ).map(({ field, ref, val, display, placeholder }) => {
                const isOpen = pickerField === field
                const arrowRotate = animForField(field).interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
                return (
                  <View key={field} ref={ref as any} style={[styles.dateField, isOpen && styles.dateFieldOpen]}>
                    {!!val && (
                      <View style={floatStyles.labelWrap} pointerEvents="none">
                        <Text style={[floatStyles.labelText, { fontFamily: langFonts.regular }]}>{placeholder}</Text>
                      </View>
                    )}
                    <Pressable
                      style={styles.dateFieldPressable}
                      onPress={() => openDatePicker(field)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${placeholder}`}
                    >
                      <Text style={[styles.dateFieldText, { fontFamily: langFonts.medium }]} numberOfLines={1}>
                        {val ? display : placeholder}
                      </Text>
                      <Animated.View style={{ transform: [{ rotate: arrowRotate }] }}>
                        <Image source={{ uri: CDN_ARROW_DOWN }} style={styles.chevronIcon} contentFit="contain" />
                      </Animated.View>
                    </Pressable>
                  </View>
                )
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}

      <SearchablePicker
        visible={panelVisible}
        title={panelKind === 'state' ? t('REGISTRATION.SELECTSTATE', 'Select state') : t('REGISTRATION.SELECTCITY', 'Select city')}
        placeholder={panelKind === 'state' ? t('REGISTRATION.SEARCHSTATE', 'Search state…') : t('REGISTRATION.SEARCHCITY', 'Search city…')}
        options={panelKind === 'state' ? states : cities}
        selectedKey={panelKind === 'state' ? selectedState?.key ?? null : selectedCity?.key ?? null}
        onSelect={panelKind === 'state' ? onStateSelect : onCitySelect}
        onClose={() => setPanelVisible(false)}
      />

      {/* Inline Date/Month/Year dropdown — same transparent-Modal-at-field-position
          pattern as DOBScreen.tsx. */}
      <Modal visible={pickerField !== null} transparent animationType="none" onRequestClose={closeDatePicker}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDatePicker} />
        <View style={[styles.dropdown, { position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }]}>
          <FlatList
            data={pickerOptions}
            keyExtractor={item => item.key}
            style={{ maxHeight: listH }}
            showsVerticalScrollIndicator
            getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
            renderItem={({ item }) => {
              const isSel = item.key === currentPickerVal
              return (
                <Pressable
                  style={[styles.dropdownItem, isSel && styles.dropdownItemSel]}
                  onPress={() => pickerField && handleDatePick(pickerField, item.key)}
                >
                  <Text style={[styles.dropdownItemText, isSel && styles.dropdownItemTextSel, { fontFamily: isSel ? langFonts.semiBold : langFonts.regular }]}>
                    {item.label}
                  </Text>
                </Pressable>
              )
            }}
          />
        </View>
      </Modal>
    </View>
  )
}

// ─── FloatField sub-component ─────────────────────────────────────────────────
// Angular renders the disabled DOB field identically to an active field — same
// border, solid black text, no graying-out (matches the fix already applied to
// LocationScreen.tsx / HomeTownLocationScreen.tsx).

type FloatFieldProps = {
  label: string
  value: string
  placeholder: string
  onPress: () => void
  hasValue: boolean
  disabled?: boolean
  loading?: boolean
  langFonts: ReturnType<typeof useLanguageFonts>
}

function FloatField({ label, value, placeholder, onPress, hasValue, disabled, loading, langFonts }: FloatFieldProps) {
  return (
    <View style={floatStyles.wrapper}>
      <Pressable
        style={floatStyles.field}
        onPress={disabled ? undefined : onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          style={[floatStyles.value, !hasValue && floatStyles.placeholder, { fontFamily: hasValue ? langFonts.medium : langFonts.regular }]}
          numberOfLines={1}
        >
          {hasValue ? value : placeholder}
        </Text>
        {loading ? (
          <ActivityIndicator size={16} color={Colors.textSecondary} style={{ marginRight: 4 }} />
        ) : (
          <Text style={floatStyles.arrow}>›</Text>
        )}
      </Pressable>

      {hasValue && (
        <View style={floatStyles.labelWrap}>
          <Text style={[floatStyles.labelText, { fontFamily: langFonts.regular }]}>{label}</Text>
        </View>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: { marginTop: 48 },
  // 32px between every field, including title-to-first-field
  fieldsContainer: { gap: 32 },

  // ── Date/Month/Year row — same layout as DOBScreen.tsx's fieldsRow/field ──
  dateRow: {
    flexDirection: 'row',
    gap:           15,
  },
  // Angular's computed .selected-btn/.body1-medium-14 rules (registration-revamp,
  // page-30 DOB row): border 1px solid #B0B0B0 (Colors.inputBorder), border-radius
  // 8px, padding-top/bottom 12px + padding-left 2vh (~16px), text color #333
  // (Colors.textDark) — NOT the darker Colors.textPrimary used elsewhere on this
  // screen, and font-family is the poppins-medium weight, not just a numeric weight.
  dateField: {
    flex:            1,
    height:          48,
    borderWidth:     1,
    borderColor:     Colors.inputBorder,
    borderRadius:    8,
    backgroundColor: Colors.surface,
    justifyContent:  'center',
  },
  dateFieldOpen: {
    borderBottomLeftRadius:  0,
    borderBottomRightRadius: 0,
    borderBottomColor:       Colors.surface,
  },
  dateFieldPressable: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingLeft:        16,
    paddingRight:       10,
    height:             48,
  },
  dateFieldText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '500',
    color:      Colors.textDark,
  },
  chevronIcon: {
    width:  16,
    height: 16,
  },

  // ── Inline dropdown (rendered inside Modal, positioned at field location) ──
  dropdown: {
    backgroundColor:         Colors.surface,
    borderWidth:             1,
    borderTopWidth:          0,
    borderColor:             Colors.inputBorder,
    borderBottomLeftRadius:  8,
    borderBottomRightRadius: 8,
    ...Platform.select({
      ios:     { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 6 },
    }),
  },
  dropdownItem: {
    height:            ITEM_H,
    justifyContent:    'center',
    paddingHorizontal: 10,
  },
  dropdownItemSel: {
    backgroundColor: 'rgba(181,0,51,0.05)',
  },
  dropdownItemText: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  dropdownItemTextSel: {
    fontWeight: '600',
    color:      Colors.primaryDark,
  },
})

const floatStyles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  field: {
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
  value: {
    flex:       1,
    fontSize:   14,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  placeholder: {
    fontWeight: '400',
  },
  arrow: {
    fontSize:   22,
    color:      Colors.textPrimary,
    lineHeight: 26,
  },
  labelWrap: {
    position:          'absolute',
    top:               -8,
    left:              12,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
    zIndex:            1,
  },
  labelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
})
