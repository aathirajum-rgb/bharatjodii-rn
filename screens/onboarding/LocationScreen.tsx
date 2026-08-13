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
import {
  callPartialRegistrationAPI,
  fetchCities,
  fetchCountries,
  fetchNriStates,
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
type PanelKind = 'country' | 'state' | 'city'

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LocationScreen({ navigation }: Props) {
  const { t } = useTranslation()

  // ─── Core state ─────────────────────────────────────────────────────────────
  const [createdBy,      setCreatedBy]      = useState('4')
  const [countryCode,    setCountryCode]    = useState('91')

  // Location selections
  const [selectedCountry, setSelectedCountry] = useState<Option | null>(null)  // NRI flow only
  const [selectedState,  setSelectedState]  = useState<Option | null>(null)
  const [selectedCity,   setSelectedCity]   = useState<Option | null>(null)

  // List data
  const [countries,      setCountries]      = useState<Option[]>([])  // NRI flow only
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
      getItem(SK.User.COUNTRY_CODE),
      getRegValues(),
    ]).then(async ([cb, ccode, rv]) => {
      const { COUNTRY: savedCountry, STATE: savedState, CITY: savedCity } = rv as Record<string, string>
      if (cb)    setCreatedBy(cb)
      if (ccode) setCountryCode(ccode)

      // Angular checkIsNRIUser(): country/state (no city) for non-Indian users
      if (ccode && ccode !== '91') {
        setLoadingStates(true)
        try {
          const countryList = await fetchCountries()
          setCountries(countryList)

          if (savedCountry && countryList.length > 0) {
            const foundCountry = countryList.find(c => c.key === savedCountry)
            if (foundCountry) {
              setSelectedCountry(foundCountry)
              const stateList = await fetchNriStates(savedCountry)
              setStates(stateList)
              if (savedState) {
                const foundState = stateList.find(s => s.key === savedState)
                if (foundState) setSelectedState(foundState)
              }
            }
          }
        } catch {
          // user can retry by reopening the pickers
        } finally {
          setLoadingStates(false)
        }
        return
      }

      // Domestic (Indian) flow — Country fixed to India, State + District
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

  // NRI flow: choosing a country loads that country's states; no city field.
  async function onCountrySelect(opt: Option) {
    setSelectedCountry(opt)
    setSelectedState(null)
    setStates([])

    setLoadingStates(true)
    try {
      const stateList = await fetchNriStates(opt.key)
      setStates(stateList)
    } catch {
      setStates([])
    } finally {
      setLoadingStates(false)
    }
  }

  async function onStateSelect(opt: Option) {
    setSelectedState(opt)

    // Domestic flow only — NRI has no city/district field
    if (isIndianFlow) {
      setSelectedCity(null)
      setCities([])
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
  }

  function onCitySelect(opt: Option) {
    setSelectedCity(opt)
  }

  // ─── Derived ──────────────────────────────────────────────────────────────────

  const title = LOCATION_TITLES[createdBy] ?? `Select where they live`
  const isIndianFlow = countryCode === '91'
  const countryLabel = isIndianFlow ? 'India' : 'Other'
  // Angular isLocationValid(): NRI only requires Country+State (city is hidden for NRI on this step)
  const canSubmit = isIndianFlow
    ? !!selectedState && !!selectedCity && !submitting
    : !!selectedCountry && !!selectedState && !submitting

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!canSubmit || !selectedState) return
    setSubmitting(true)
    try {
      if (isIndianFlow) {
        if (!selectedCity) return
        await setRegValues({ STATE: selectedState.key, CITY: selectedCity.key, COUNTRY: INDIA_COUNTRY })
      } else {
        if (!selectedCountry) return
        await setRegValues({ COUNTRY: selectedCountry.key, STATE: selectedState.key, CITY: '' })
      }
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

            {isIndianFlow ? (
              <>
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
              </>
            ) : (
              <>
                {/* NRI flow (Angular checkIsNRIUser()): real Country picker + State,
                    no District/City field on this step. */}
                <FloatField
                  label="Country"
                  value={selectedCountry?.label ?? ''}
                  placeholder="Select country"
                  onPress={() => openPanel('country')}
                  hasValue={!!selectedCountry}
                />

                <FloatField
                  label="State"
                  value={selectedState?.label ?? ''}
                  placeholder="Select state"
                  onPress={() => {
                    if (!selectedCountry) return
                    openPanel('state')
                  }}
                  hasValue={!!selectedState}
                  disabled={!selectedCountry}
                />
              </>
            )}

          </View>
        )}
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}

      {/* Shared picker for Country + State + District */}
      <SearchablePicker
        visible={panelVisible}
        title={panelKind === 'country' ? 'Select country' : panelKind === 'state' ? 'Select state' : 'Select district'}
        placeholder={panelKind === 'country' ? 'Search country…' : panelKind === 'state' ? 'Search state…' : 'Search district…'}
        options={panelKind === 'country' ? countries : panelKind === 'state' ? states : cities}
        selectedKey={
          panelKind === 'country' ? selectedCountry?.key ?? null :
          panelKind === 'state'   ? selectedState?.key ?? null :
          selectedCity?.key ?? null
        }
        onSelect={panelKind === 'country' ? onCountrySelect : panelKind === 'state' ? onStateSelect : onCitySelect}
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

  // 32px between every field, including title-to-first-field (matches Figma exactly)
  fieldsContainer: {
    gap: 32,
  },
})

// FloatField styles (separate object so the sub-component can reference them cleanly)
const floatStyles = StyleSheet.create({
  // Outer wrapper — the fieldsContainer gap already provides room for the
  // label that overflows upward, so no extra marginTop is needed here.
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
  fieldActive: { borderColor: Colors.inputBorder },
  // Figma renders the fixed/non-interactive Country field identically to an
  // active field — same border, solid black text, no graying-out.
  fieldDisabled: {},

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
  disabledText: {},

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
