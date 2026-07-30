import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import SearchablePicker from '../../components/searchable-picker/SearchablePicker'
import { Colors } from '../../constants/colors'
import {
  fetchHoroCities,
  fetchStates,
  getRegValues,
  setRegValues,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────
// Angular pageType 30 — HOROSTATE/HOROCITY + a read-only DOB confirmation.
const CDN_PAGE_ICON = CDN_REG + 'horoscope-generate.svg'

// Same list DOBScreen.tsx uses — reused here to format "08 March 1997"
// (Angular has no date-formatting pipe for this; it's inline month-name lookup).
const MONTHS = [
  { key: '1',  label: 'January'   }, { key: '2',  label: 'February'  },
  { key: '3',  label: 'March'     }, { key: '4',  label: 'April'     },
  { key: '5',  label: 'May'       }, { key: '6',  label: 'June'      },
  { key: '7',  label: 'July'      }, { key: '8',  label: 'August'    },
  { key: '9',  label: 'September' }, { key: '10', label: 'October'   },
  { key: '11', label: 'November'  }, { key: '12', label: 'December'  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type Option    = { key: string; label: string }
type PanelKind = 'state' | 'city'

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HoroscopeBirthDetailsScreen({ navigation }: Props) {
  const { t } = useTranslation()

  const [createdBy,       setCreatedBy]       = useState('4')
  const [dobDisplay,       setDobDisplay]      = useState('')

  const [states,          setStates]          = useState<Option[]>([])
  const [cities,          setCities]          = useState<Option[]>([])
  const [selectedState,   setSelectedState]   = useState<Option | null>(null)
  const [selectedCity,    setSelectedCity]    = useState<Option | null>(null)

  const [fetchingStates,  setFetchingStates]  = useState(true)
  const [fetchingCities,  setFetchingCities]  = useState(false)
  const [submitting,      setSubmitting]      = useState(false)

  const [panelKind,       setPanelKind]       = useState<PanelKind>('state')
  const [panelVisible,    setPanelVisible]    = useState(false)

  useEffect(() => {
    getRegValues().then(async rv => {
      if (rv.CREATEDBY) setCreatedBy(rv.CREATEDBY)

      if (rv.DATE && rv.MONTH && rv.YEAR) {
        const monthLabel = MONTHS.find(m => m.key === String(Number(rv.MONTH)))?.label ?? ''
        setDobDisplay(`${rv.DATE.padStart(2, '0')} ${monthLabel} ${rv.YEAR}`)
      }

      try {
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
  }, [])

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

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]
  const possessiveTKey = possessiveKey?.toUpperCase()
  const translatedProfileType = possessiveTKey ? t(`REGISTRATION.${possessiveTKey}`) : ''
  const title = t('REGISTRATION.GENERATEHOROSCOPEBIRTH', 'Generate horoscope')
  const dobHelperText = t(
    'REGISTRATION.DOBALREADYPROVIDED',
    'You have already provided your #PROFILETYPE# date of birth',
  )
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  const canSubmit = !!selectedState && !!selectedCity && !submitting

  async function handleNext() {
    if (!canSubmit || !selectedState || !selectedCity) return
    setSubmitting(true)
    try {
      await setRegValues({ HOROSTATE: selectedState.key, HOROCITY: selectedCity.key })
      navigation.push('onboarding', { pageNo: '31' })
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

        {fetchingStates ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.fieldsContainer}>
            <FloatField
              label={t('REGISTRATION.STATEOFBIRTH', 'State of birth')}
              value={selectedState?.label ?? ''}
              placeholder={t('REGISTRATION.SELECTSTATE', 'Select state')}
              onPress={() => openPanel('state')}
              hasValue={!!selectedState}
            />

            <FloatField
              label={t('REGISTRATION.CITYOFBIRTH', 'City of birth')}
              value={selectedCity?.label ?? ''}
              placeholder={fetchingCities ? t('GENERAL.LOADING', 'Loading…') : t('REGISTRATION.SELECTCITY', 'Select city')}
              onPress={() => {
                if (!selectedState || fetchingCities) return
                openPanel('city')
              }}
              hasValue={!!selectedCity}
              disabled={!selectedState || fetchingCities}
              loading={fetchingCities}
            />

            {!!dobDisplay && (
              <View style={styles.dobGroup}>
                <FloatField
                  label={t('REGISTRATION.DATEOFBIRTH', 'Date of birth')}
                  value={dobDisplay}
                  placeholder={dobDisplay}
                  onPress={() => {}}
                  hasValue
                  disabled
                />
                <Text style={styles.dobHelperText}>{dobHelperText}</Text>
              </View>
            )}
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
}

function FloatField({ label, value, placeholder, onPress, hasValue, disabled, loading }: FloatFieldProps) {
  return (
    <View style={floatStyles.wrapper}>
      <Pressable
        style={floatStyles.field}
        onPress={disabled ? undefined : onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          style={[floatStyles.value, !hasValue && floatStyles.placeholder]}
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
          <Text style={floatStyles.labelText}>{label}</Text>
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
  // DOB field + its caption sit close together (~8px), not the standard 32px gap
  dobGroup: { gap: 8 },
  dobHelperText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textPrimary,
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
