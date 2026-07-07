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
import SearchablePicker from '../../components/searchable-picker/SearchablePicker'
import { Colors } from '../../constants/colors'
import { StorageKeys as SK } from '../../constants/storage.keys'
import {
  callPartialRegistrationAPI,
  fetchCities,
  fetchStates,
  getNextPageAfterLocation,
  getRegValues,
  setRegValues,
  getRegValue,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON  = CDN_REG + 'location.svg'
const INDIA_COUNTRY  = '98'

const LOCATION_TITLES: Record<string, string> = {
  '4':  'Select where your son lives',
  '5':  'Select where your daughter lives',
  '8':  'Select where your brother lives',
  '9':  'Select where your sister lives',
  '10': 'Select where your friend lives',
  '11': 'Select where your relative lives',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }
type PanelKind = 'state' | 'city'

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LocationScreen({ navigation }: Props) {
  const { t } = useTranslation()

  // ─── Core state ─────────────────────────────────────────────────────────────
  const [createdBy,      setCreatedBy]      = useState('4')
  const [customerCare,   setCustomerCare]   = useState('')
  const [countryCode,    setCountryCode]    = useState('91')

  // Location selections
  const [selectedState,  setSelectedState]  = useState<Option | null>(null)
  const [selectedCity,   setSelectedCity]   = useState<Option | null>(null)

  // List data
  const [states,         setStates]         = useState<Option[]>([])
  const [cities,         setCities]         = useState<Option[]>([])

  // Loading flags
  const [loadingStates,  setLoadingStates]  = useState(true)
  const [loadingCities,  setLoadingCities]  = useState(false)
  const [submitting,     setSubmitting]     = useState(false)

  // Panel visibility
  const [panelKind,      setPanelKind]      = useState<PanelKind>('state')
  const [panelVisible,   setPanelVisible]   = useState(false)

  // ─── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getItem(SK.App.CUSTOMER_CARE),
      getItem(SK.User.COUNTRY_CODE),
      getRegValues(),
    ]).then(async ([cb, cc, ccode, rv]) => {
      const { STATE: savedState, CITY: savedCity } = rv as Record<string, string>
      if (cb)    setCreatedBy(cb)
      if (cc)    setCustomerCare(cc)
      if (ccode) setCountryCode(ccode)

      const stateList = await loadStates()

      // Restore prior selection
      if (savedState && stateList.length > 0) {
        const found = stateList.find(s => s.key === savedState)
        if (found) {
          setSelectedState(found)
          // Also reload cities for saved state
          setLoadingCities(true)
          try {
            const cityList = await fetchCities(savedState)
            setCities(cityList)
            if (savedCity) {
              const foundCity = cityList.find(c => c.key === savedCity)
              if (foundCity) setSelectedCity(foundCity)
            }
          } catch {
            // Cities will be fetched again when user taps the field
          } finally {
            setLoadingCities(false)
          }
        }
      }
    })
  }, [])

  async function loadStates(): Promise<Option[]> {
    setLoadingStates(true)
    try {
      const list = await fetchStates()
      setStates(list)
      return list
    } catch {
      return []
    } finally {
      setLoadingStates(false)
    }
  }

  // ─── Panel helpers ────────────────────────────────────────────────────────────

  function openPanel(kind: PanelKind) {
    setPanelKind(kind)
    setPanelVisible(true)
  }

  async function onStateSelect(opt: Option) {
    setSelectedState(opt)
    setSelectedCity(null)
    setCities([])

    // Immediately start loading cities for the newly chosen state
    setLoadingCities(true)
    try {
      const cityList = await fetchCities(opt.key)
      setCities(cityList)
    } catch {
      setCities([])
    } finally {
      setLoadingCities(false)
    }
  }

  function onCitySelect(opt: Option) {
    setSelectedCity(opt)
  }

  // ─── Derived ──────────────────────────────────────────────────────────────────

  const title = LOCATION_TITLES[createdBy] ?? `Select where they live`
  const isIndianFlow = countryCode === '91'
  const countryLabel = isIndianFlow ? 'India' : 'Other'
  const canSubmit    = !!selectedState && !!selectedCity && !submitting

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!canSubmit || !selectedState || !selectedCity) return
    setSubmitting(true)
    try {
      await setRegValues({ STATE: selectedState.key, CITY: selectedCity.key, COUNTRY: INDIA_COUNTRY })
      const nextPage = await getNextPageAfterLocation()
      navigation.push('onboarding', { pageNo: nextPage })
      callPartialRegistrationAPI()
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  useOnboardingFooter({ nextDisabled: !canSubmit, nextLoading: submitting, onNext: handleNext }, [canSubmit, submitting])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.screen}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />
        <Text style={os.title}>{title}</Text>

        {loadingStates ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.fieldsContainer}>

            {/* Country field — fixed "India" for Indian flow, not interactive */}
            <FloatField
              label="Country"
              value={countryLabel}
              placeholder="Country"
              onPress={() => {}}
              hasValue
              disabled
            />

            {/* State field */}
            <FloatField
              label="State"
              value={selectedState?.label ?? ''}
              placeholder="Select state"
              onPress={() => openPanel('state')}
              hasValue={!!selectedState}
            />

            {/* District / City field */}
            <FloatField
              label="District"
              value={selectedCity?.label ?? ''}
              placeholder={loadingCities ? 'Loading cities…' : 'Select district'}
              onPress={() => {
                if (!selectedState || loadingCities) return
                openPanel('city')
              }}
              hasValue={!!selectedCity}
              disabled={!selectedState || loadingCities}
              loading={loadingCities}
            />

          </View>
        )}
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}

      {/* Shared picker for State + District */}
      <SearchablePicker
        visible={panelVisible}
        title={panelKind === 'state' ? 'Select state' : 'Select district'}
        placeholder={panelKind === 'state' ? 'Search state…' : 'Search district…'}
        options={panelKind === 'state' ? states : cities}
        selectedKey={panelKind === 'state' ? selectedState?.key ?? null : selectedCity?.key ?? null}
        onSelect={panelKind === 'state' ? onStateSelect : onCitySelect}
        onClose={() => setPanelVisible(false)}
      />
    </View>
  )
}

// ─── FloatField sub-component ─────────────────────────────────────────────────
// Material-style floating label field that matches the Figma design.
// When hasValue=true: floating label appears at top-left, cutting through the border.
// When hasValue=false: just placeholder text inside the field, no floating label.

type FloatFieldProps = {
  label: string
  value: string
  placeholder: string
  onPress: () => void
  hasValue: boolean
  disabled?: boolean
  loading?: boolean
}

function FloatField({ label, value, placeholder, onPress, hasValue, disabled, loading }: FloatFieldProps) {
  return (
    <View style={floatStyles.wrapper}>
      <Pressable
        style={[
          floatStyles.field,
          hasValue && floatStyles.fieldActive,
          disabled && floatStyles.fieldDisabled,
        ]}
        onPress={disabled ? undefined : onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          style={[
            floatStyles.value,
            !hasValue && floatStyles.placeholder,
            disabled && floatStyles.disabledText,
          ]}
          numberOfLines={1}
        >
          {hasValue ? value : placeholder}
        </Text>
        {loading ? (
          <ActivityIndicator size={16} color={Colors.textSecondary} style={{ marginRight: 4 }} />
        ) : (
          <Text style={[floatStyles.arrow, disabled && floatStyles.disabledText]}>›</Text>
        )}
      </Pressable>

      {/* Floating label — appears only when field has a value */}
      {hasValue && (
        <View style={floatStyles.labelWrap}>
          <Text style={floatStyles.labelText}>{label}</Text>
        </View>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────


const styles = StyleSheet.create({
  loader: { marginTop: 48 },

  fieldsContainer: {
    gap: 24,
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

// FloatField styles (separate object so the sub-component can reference them cleanly)
const floatStyles = StyleSheet.create({
  // Outer wrapper — marginTop: 8 gives room for the label that overflows upward
  wrapper: {
    position:  'relative',
    marginTop: 8,
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
  fieldActive:   { borderColor: Colors.inputBorder },
  fieldDisabled: {
    backgroundColor: Colors.surfaceInput,
    borderColor:     '#d8d8d8',
  },

  value: {
    flex:       1,
    fontSize:   14,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  placeholder: {
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  disabledText: { color: Colors.textSecondary },

  arrow: {
    fontSize:   22,
    color:      Colors.textPrimary,
    lineHeight: 26,
  },

  // Floating label — absolutely positioned to overlap the top border
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
