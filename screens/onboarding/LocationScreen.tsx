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
import { SvgXml } from 'react-native-svg'
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
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON  = CDN_REG + 'location.svg'
const INDIA_COUNTRY  = '98'

// Angular's dropdown-field arrow is Ionic's "chevron-forward-outline" icon —
// same one HeightScreen/MotherTongueScreen use for their "select ..." fields.
const CHEVRON_FORWARD_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M184 112l144 144-144 144"/></svg>`

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
  const langFonts = useLanguageFonts()

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

  // Angular (registration-revamp.component.ts case '9'): Myself profiles get
  // REGISTRATION.LOCATIONMYSELF ("Where do you live?"); every other createdBy
  // gets REGISTRATION.LOCATION ("Where does your #PROFILETYPE# live?").
  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = createdBy === '1'
    ? t('REGISTRATION.LOCATIONMYSELF', 'Where do you live?')
    : t('REGISTRATION.LOCATION', 'Where does your #PROFILETYPE# live?')
        .replace('#PROFILETYPE#', translatedProfileType)
        .replace('  ', ' ')
        .trim()
  const isIndianFlow = countryCode === '91'
  // Angular (getPlaceHolderContent/getMatchedItem): the country NAME itself is
  // plain data out of the COUNTRYLIST API response, not an i18n key — "India"
  // displays in English regardless of app language there too. Only the
  // surrounding label/placeholder chrome ("Country", "Select country") is
  // actually translated, which the label/placeholder props below handle.
  const countryLabel = 'India'
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
        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        {loadingStates ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.fieldsContainer}>

            {isIndianFlow ? (
              <>
                {/* Country field — fixed "India" for Indian flow, not interactive */}
                <FloatField
                  label={t('REGISTRATION.COUNTRYLABEL', 'Country')}
                  value={countryLabel}
                  placeholder={t('REGISTRATION.COUNTRYLABEL', 'Country')}
                  onPress={() => {}}
                  hasValue
                  disabled
                  langFonts={langFonts}
                />

                {/* State field */}
                <FloatField
                  label={t('REGISTRATION.STATELABEL', 'State')}
                  value={selectedState?.label ?? ''}
                  placeholder={t('REGISTRATION.SELECTSTATE', 'Select state')}
                  onPress={() => openPanel('state')}
                  hasValue={!!selectedState}
                  langFonts={langFonts}
                />

                {/* District / City field — Angular (updateCountryList() →
                    updateShowThisFieldAdvanced): SHOWTHISFIELD for CITY on this
                    page is IsValidParamWithoutZero(STATE), i.e. not rendered at
                    all until a state is picked, not just disabled. */}
                {!!selectedState && (
                  <FloatField
                    label={t('REGISTRATION.CITYLABEL', 'District')}
                    value={selectedCity?.label ?? ''}
                    placeholder={loadingCities
                      ? t('GENERAL.LOADING', 'Loading…')
                      : t('REGISTRATION.SELECTCITY', 'Select district')}
                    onPress={() => {
                      if (loadingCities) return
                      openPanel('city')
                    }}
                    hasValue={!!selectedCity}
                    disabled={loadingCities}
                    loading={loadingCities}
                    langFonts={langFonts}
                  />
                )}
              </>
            ) : (
              <>
                {/* NRI flow (Angular checkIsNRIUser()): real Country picker + State,
                    no District/City field on this step. */}
                <FloatField
                  label={t('REGISTRATION.COUNTRYLABEL', 'Country')}
                  value={selectedCountry?.label ?? ''}
                  placeholder={t('REGISTRATION.SELECTCOUNTRY', 'Select country')}
                  onPress={() => openPanel('country')}
                  hasValue={!!selectedCountry}
                  langFonts={langFonts}
                />

                <FloatField
                  label={t('REGISTRATION.STATELABEL', 'State')}
                  value={selectedState?.label ?? ''}
                  placeholder={t('REGISTRATION.SELECTSTATE', 'Select state')}
                  onPress={() => {
                    if (!selectedCountry) return
                    openPanel('state')
                  }}
                  hasValue={!!selectedState}
                  disabled={!selectedCountry}
                  langFonts={langFonts}
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
        title={
          panelKind === 'country' ? t('REGISTRATION.SELECTCOUNTRY', 'Select country') :
          panelKind === 'state'   ? t('REGISTRATION.SELECTSTATE', 'Select state') :
                                     t('REGISTRATION.SELECTCITY', 'Select district')
        }
        placeholder={
          panelKind === 'country' ? t('REGISTRATION.SEARCHCOUNTRY', 'Search country…') :
          panelKind === 'state'   ? t('REGISTRATION.SEARCHSTATE', 'Search state…') :
                                     t('REGISTRATION.SEARCHCITY', 'Search district…')
        }
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
  langFonts: ReturnType<typeof useLanguageFonts>
}

function FloatField({ label, value, placeholder, onPress, hasValue, disabled, loading, langFonts }: FloatFieldProps) {
  return (
    // Angular: registration-revamp.component.scss's .disabled-state —
    // opacity: 40%, pointer-events: none — applied to the WHOLE field block
    // (border, text, chevron, floating label together), not just the text.
    <View style={[floatStyles.wrapper, disabled && floatStyles.wrapperDisabled]}>
      <Pressable
        style={[
          floatStyles.field,
          hasValue && floatStyles.fieldActive,
        ]}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text
          style={[
            floatStyles.value,
            !hasValue && floatStyles.placeholder,
            { fontFamily: hasValue ? langFonts.medium : langFonts.regular },
          ]}
          numberOfLines={1}
        >
          {hasValue ? value : placeholder}
        </Text>
        {loading ? (
          <ActivityIndicator size={16} color={Colors.textSecondary} style={{ marginRight: 4 }} />
        ) : (
          <SvgXml xml={CHEVRON_FORWARD_XML} width={24} height={24} />
        )}
      </Pressable>

      {/* Floating label — appears only when field has a value */}
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
  // Angular: .disabled-state { opacity: 40%; pointer-events: none } — the
  // non-interactive Country field dims as a whole block (border + text +
  // chevron + floating label together), not just its text color.
  wrapperDisabled: {
    opacity: 0.4,
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
