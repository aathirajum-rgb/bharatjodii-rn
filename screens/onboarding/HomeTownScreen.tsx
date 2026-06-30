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
import SearchablePicker from '../../components/searchable-picker/SearchablePicker'
import { Colors } from '../../constants/colors'
import { StorageKeys as SK } from '../../constants/storage.keys'
import {
  callRegistrationAPI,
  fetchCities,
  fetchStates,
  getRegValues,
  setRegValues,
  getRegValue,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'location.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

type Option    = { key: string; label: string }
type YesNo     = 'yes' | 'no' | null
type PanelKind = 'state' | 'city'

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeTownScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [createdBy,         setCreatedBy]         = useState('4')
  const [customerCare,      setCustomerCare]       = useState('')

  // Yes / No selection
  const [homeTownSame,      setHomeTownSame]       = useState<YesNo>(null)

  // Current location keys (for pre-filling when "Yes")
  const [currentStateKey,   setCurrentStateKey]    = useState('')
  const [currentCityKey,    setCurrentCityKey]     = useState('')

  // Home state + city selections
  const [selectedHomeState, setSelectedHomeState]  = useState<Option | null>(null)
  const [selectedHomeCity,  setSelectedHomeCity]   = useState<Option | null>(null)

  // List data
  const [states,            setStates]             = useState<Option[]>([])
  const [cities,            setCities]             = useState<Option[]>([])

  // Loading
  const [loadingStates,     setLoadingStates]      = useState(true)
  const [loadingCities,     setLoadingCities]      = useState(false)
  const [submitting,        setSubmitting]         = useState(false)

  // Panel
  const [panelKind,         setPanelKind]          = useState<PanelKind>('state')
  const [panelVisible,      setPanelVisible]       = useState(false)

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getItem(SK.App.CUSTOMER_CARE),
      getRegValues(),
    ]).then(async ([cb, cc, rv]) => {
      const { STATE: stateKey, CITY: cityKey, HOMESTATE: homeState, HOMECITY: homeCity } = rv as Record<string, string>
      if (cb) setCreatedBy(cb)
      if (cc) setCustomerCare(cc)

      const curState = stateKey ?? ''
      const curCity  = cityKey  ?? ''
      setCurrentStateKey(curState)
      setCurrentCityKey(curCity)

      // Load state list
      setLoadingStates(true)
      const stateList = await fetchStates().catch(() => [] as Option[])
      setStates(stateList)
      setLoadingStates(false)

      const noHomeState = !homeState || homeState === ''
      const noHomeCity  = !homeCity  || homeCity  === ''

      if (noHomeState && noHomeCity) {
        // Default to "Yes" — same as current location
        setHomeTownSame('yes')
        const stOpt = stateList.find(s => s.key === curState) ?? null
        setSelectedHomeState(stOpt)
        if (stOpt && curState) {
          setLoadingCities(true)
          const cityList = await fetchCities(curState).catch(() => [] as Option[])
          setCities(cityList)
          const ctOpt = cityList.find(c => c.key === curCity) ?? null
          setSelectedHomeCity(ctOpt)
          setLoadingCities(false)
        }
      } else {
        // Existing HOMESTATE/HOMECITY — determine yes/no
        const sameAsCurrentIndian = homeState === curState && homeCity === curCity
        if (sameAsCurrentIndian) {
          setHomeTownSame('yes')
        } else {
          setHomeTownSame('no')
        }
        const stOpt = stateList.find(s => s.key === homeState) ?? null
        setSelectedHomeState(stOpt)
        if (homeState) {
          setLoadingCities(true)
          const cityList = await fetchCities(homeState).catch(() => [] as Option[])
          setCities(cityList)
          const ctOpt = cityList.find(c => c.key === homeCity) ?? null
          setSelectedHomeCity(ctOpt)
          setLoadingCities(false)
        }
      }
    })
  }, [])

  // ─── Yes / No toggle ──────────────────────────────────────────────────────

  async function handleYes() {
    setHomeTownSame('yes')
    const stOpt = states.find(s => s.key === currentStateKey) ?? null
    setSelectedHomeState(stOpt)
    setSelectedHomeCity(null)
    if (stOpt && currentStateKey) {
      setLoadingCities(true)
      try {
        const cityList = await fetchCities(currentStateKey)
        setCities(cityList)
        const ctOpt = cityList.find(c => c.key === currentCityKey) ?? null
        setSelectedHomeCity(ctOpt)
      } catch {
        setCities([])
      } finally {
        setLoadingCities(false)
      }
    }
  }

  function handleNo() {
    setHomeTownSame('no')
    setSelectedHomeState(null)
    setSelectedHomeCity(null)
    setCities([])
  }

  // ─── Panel ────────────────────────────────────────────────────────────────

  function openPanel(kind: PanelKind) {
    setPanelKind(kind)
    setPanelVisible(true)
  }

  async function onStateSelect(opt: Option) {
    setSelectedHomeState(opt)
    setSelectedHomeCity(null)
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

  function onCitySelect(opt: Option) {
    setSelectedHomeCity(opt)
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const possessive = PROFILE_POSSESSIVE[createdBy] ?? 'their'
  const title      = `Is ${possessive} home town same as current location?`
  const canSubmit  = !!selectedHomeState && !!selectedHomeCity && !submitting

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!canSubmit || !selectedHomeState || !selectedHomeCity) return
    setSubmitting(true)
    try {
      await setRegValues({ HOMESTATE: selectedHomeState.key, HOMECITY: selectedHomeCity.key })
      await callRegistrationAPI({
        HOMESTATE: selectedHomeState.key,
        HOMECITY:  selectedHomeCity.key,
      })
      navigation.push('onboarding', { pageNo: '10' })
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.screen}>
      <AppHeader
        type="registration"
        showBackBtn={navigation.canGoBack()}
        onBackPress={() => navigation.goBack()}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />

      <ScrollView
        style={os.flex1}
        contentContainerStyle={[
          os.scrollContent,
          { paddingBottom: 160 + (Platform.OS === 'ios' ? insets.bottom : 20) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />
        <Text style={[os.title, { marginBottom: 24 }]}>{title}</Text>

        {/* Yes / No chips */}
        <View style={styles.yesNoRow}>
          <Pressable
            style={[styles.yesNoChip, homeTownSame === 'yes' && styles.yesNoChipSelected]}
            onPress={handleYes}
            accessibilityRole="radio"
            accessibilityState={{ selected: homeTownSame === 'yes' }}
          >
            <View style={[styles.chipRadio, homeTownSame === 'yes' && styles.chipRadioSelected]}>
              {homeTownSame === 'yes' && <Text style={styles.chipRadioTick}>✓</Text>}
            </View>
            <Text style={[styles.yesNoLabel, homeTownSame === 'yes' && styles.yesNoLabelSelected]}>
              Yes
            </Text>
          </Pressable>

          <Pressable
            style={[styles.yesNoChip, homeTownSame === 'no' && styles.yesNoChipSelected]}
            onPress={handleNo}
            accessibilityRole="radio"
            accessibilityState={{ selected: homeTownSame === 'no' }}
          >
            <View style={[styles.chipRadio, homeTownSame === 'no' && styles.chipRadioSelected]}>
              {homeTownSame === 'no' && <Text style={styles.chipRadioTick}>✓</Text>}
            </View>
            <Text style={[styles.yesNoLabel, homeTownSame === 'no' && styles.yesNoLabelSelected]}>
              No
            </Text>
          </Pressable>
        </View>

        {/* State + City fields — shown once a yes/no answer is given */}
        {loadingStates ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : homeTownSame !== null ? (
          <View style={styles.fieldsContainer}>
            <FloatField
              label="State"
              value={selectedHomeState?.label ?? ''}
              placeholder="Select state"
              onPress={() => openPanel('state')}
              hasValue={!!selectedHomeState}
            />

            <FloatField
              label="District"
              value={selectedHomeCity?.label ?? ''}
              placeholder={loadingCities ? 'Loading cities…' : 'Select district'}
              onPress={() => {
                if (!selectedHomeState || loadingCities) return
                openPanel('city')
              }}
              hasValue={!!selectedHomeCity}
              disabled={!selectedHomeState || loadingCities}
              loading={loadingCities}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky footer */}
      <View
        style={[
          os.footer,
          { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 20 },
        ]}
      >
        <ButtonRevamp
          label={t('REGISTRATION.NEXTCTA', 'Next')}
          variant="primary"
          size="standard"
          fullWidth
          disabled={!canSubmit}
          loading={submitting}
          onPress={handleNext}
        />

        {!!customerCare && (
          <>
            <View style={styles.divider} />
            <Pressable style={styles.helpRow} onPress={() => Linking.openURL(`tel:${customerCare}`)}>
              <Text style={styles.helpText}>Need help?  Call</Text>
              <Text style={styles.helpPhone}>{customerCare}</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Shared picker for State + District */}
      <SearchablePicker
        visible={panelVisible}
        title={panelKind === 'state' ? 'Select state' : 'Select district'}
        placeholder={panelKind === 'state' ? 'Search state…' : 'Search district…'}
        options={panelKind === 'state' ? states : cities}
        selectedKey={panelKind === 'state' ? selectedHomeState?.key ?? null : selectedHomeCity?.key ?? null}
        onSelect={panelKind === 'state' ? onStateSelect : onCitySelect}
        onClose={() => setPanelVisible(false)}
      />
    </View>
  )
}

// ─── FloatField sub-component ─────────────────────────────────────────────────

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
  loader: { marginTop: 32 },

  // Yes / No chip row
  yesNoRow: {
    flexDirection: 'row',
    gap:           16,
    marginBottom:  28,
  },

  yesNoChip: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          40,
    borderRadius:    50,
    borderWidth:     1,
    borderColor:     Colors.borderNeutral,
    backgroundColor: Colors.surface,
    paddingLeft:     8,
    paddingRight:    16,
    gap:             8,
  },
  yesNoChipSelected: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.radioCheckedBg,
  },

  chipRadio: {
    width:           20,
    height:          20,
    borderRadius:    10,
    borderWidth:     1.5,
    borderColor:     Colors.borderNeutral,
    alignItems:      'center',
    justifyContent:  'center',
  },
  chipRadioSelected: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  chipRadioTick: {
    color:      Colors.surface,
    fontSize:   11,
    fontWeight: '700',
    lineHeight: 13,
  },

  yesNoLabel: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  yesNoLabelSelected: {
    fontWeight: '500',
  },

  fieldsContainer: { gap: 24 },

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

const floatStyles = StyleSheet.create({
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
    color:      Colors.scrimSubtle,
  },
  disabledText: { color: Colors.textSecondary },
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
