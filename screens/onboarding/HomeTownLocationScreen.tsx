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
  getRegValue,
  getRegValues,
  setRegValues,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os, scrollPaddingBottom } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'location.svg'
const FOOTER_H      = 160

// ─── Types ────────────────────────────────────────────────────────────────────

type Option    = { key: string; label: string }
type PanelKind = 'state' | 'city'

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeTownLocationScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [createdBy,         setCreatedBy]         = useState('4')
  const [customerCare,      setCustomerCare]       = useState('')

  const [selectedHomeState, setSelectedHomeState]  = useState<Option | null>(null)
  const [selectedHomeCity,  setSelectedHomeCity]   = useState<Option | null>(null)

  const [states,            setStates]             = useState<Option[]>([])
  const [cities,            setCities]             = useState<Option[]>([])

  const [loadingStates,     setLoadingStates]      = useState(true)
  const [loadingCities,     setLoadingCities]      = useState(false)
  const [submitting,        setSubmitting]         = useState(false)

  const [panelKind,         setPanelKind]          = useState<PanelKind>('state')
  const [panelVisible,      setPanelVisible]       = useState(false)

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([getRegValues(), getItem(SK.App.CUSTOMER_CARE)]).then(async ([rv, cc]) => {
      if (rv.CREATEDBY) setCreatedBy(rv.CREATEDBY)
      if (cc) setCustomerCare(cc)

      setLoadingStates(true)
      const stateList = await fetchStates().catch(() => [] as Option[])
      setStates(stateList)
      setLoadingStates(false)

      // Restore previously selected HOMESTATE/HOMECITY (e.g. on back navigation)
      const homeStateKey = rv.HOMESTATE ?? ''
      const homeCityKey  = rv.HOMECITY  ?? ''
      if (homeStateKey) {
        const stOpt = stateList.find(s => s.key === homeStateKey) ?? null
        setSelectedHomeState(stOpt)
        if (stOpt) {
          setLoadingCities(true)
          const cityList = await fetchCities(homeStateKey).catch(() => [] as Option[])
          setCities(cityList)
          if (homeCityKey) {
            const ctOpt = cityList.find(c => c.key === homeCityKey) ?? null
            setSelectedHomeCity(ctOpt)
          }
          setLoadingCities(false)
        }
      }
    })
  }, [])

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

  // ─── Submit ───────────────────────────────────────────────────────────────

  const canSubmit = !!selectedHomeState && !!selectedHomeCity && !submitting

  async function handleNext() {
    if (!canSubmit || !selectedHomeState || !selectedHomeCity) return
    setSubmitting(true)
    try {
      await setRegValues({ HOMESTATE: selectedHomeState.key, HOMECITY: selectedHomeCity.key })
      await callRegistrationAPI({ HOMESTATE: selectedHomeState.key, HOMECITY: selectedHomeCity.key })
      navigation.push('onboarding', { pageNo: '10' })
    } catch {
      // allow retry
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const possessive = PROFILE_POSSESSIVE[createdBy] ?? 'their'
  const title      = t('REGISTRATION.SELECT_HOMETOWN', `Select ${possessive} home town`)

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
          { paddingBottom: scrollPaddingBottom(insets.bottom, FOOTER_H) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />
        <Text style={[os.title, { marginBottom: 32 }]}>{title}</Text>

        {loadingStates ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.fieldsContainer}>
            <FloatField
              label={t('REGISTRATION.STATELABEL', 'State')}
              value={selectedHomeState?.label ?? ''}
              placeholder={t('REGISTRATION.SELECTSTATE', 'Select state')}
              onPress={() => openPanel('state')}
              hasValue={!!selectedHomeState}
            />

            <FloatField
              label={t('REGISTRATION.CITYLABEL', 'District')}
              value={selectedHomeCity?.label ?? ''}
              placeholder={loadingCities
                ? t('GENERAL.LOADING', 'Loading…')
                : t('REGISTRATION.SELECTCITY', 'Select district')}
              onPress={() => {
                if (!selectedHomeState || loadingCities) return
                openPanel('city')
              }}
              hasValue={!!selectedHomeCity}
              disabled={!selectedHomeState || loadingCities}
              loading={loadingCities}
            />
          </View>
        )}
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

      {/* Shared picker for State + District */}
      <SearchablePicker
        visible={panelVisible}
        title={panelKind === 'state'
          ? t('REGISTRATION.SELECTSTATE', 'Select state')
          : t('REGISTRATION.SELECTCITY', 'Select district')}
        placeholder={panelKind === 'state'
          ? t('REGISTRATION.SEARCHSTATE', 'Search state…')
          : t('REGISTRATION.SEARCHCITY', 'Search district…')}
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
