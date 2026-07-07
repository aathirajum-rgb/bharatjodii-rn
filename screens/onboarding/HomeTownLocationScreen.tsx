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
import {
  callPartialRegistrationAPI,
  fetchCities,
  fetchStates,
  getRegValues,
  setRegValues,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'location.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

type Option    = { key: string; label: string }
type PanelKind = 'state' | 'city'

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeTownLocationScreen({ navigation }: Props) {
  const { t } = useTranslation()

  const [createdBy,         setCreatedBy]         = useState('4')
  const [selectedHomeState, setSelectedHomeState]  = useState<Option | null>(null)
  const [selectedHomeCity,  setSelectedHomeCity]   = useState<Option | null>(null)
  const [states,            setStates]             = useState<Option[]>([])
  const [cities,            setCities]             = useState<Option[]>([])
  const [loadingStates,     setLoadingStates]      = useState(true)
  const [loadingCities,     setLoadingCities]      = useState(false)
  const [submitting,        setSubmitting]         = useState(false)
  const [panelKind,         setPanelKind]          = useState<PanelKind>('state')
  const [panelVisible,      setPanelVisible]       = useState(false)

  useEffect(() => {
    getRegValues().then(async rv => {
      if (rv.CREATEDBY) setCreatedBy(rv.CREATEDBY)

      setLoadingStates(true)
      const stateList = await fetchStates().catch(() => [] as Option[])
      setStates(stateList)
      setLoadingStates(false)

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

  const canSubmit  = !!selectedHomeState && !!selectedHomeCity && !submitting
  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.HOME_TOWN_TXT', 'Is your #PROFILETYPE# home town same as current location?')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  async function handleNext() {
    if (!canSubmit || !selectedHomeState || !selectedHomeCity) return
    setSubmitting(true)
    try {
      await setRegValues({ HOMESTATE: selectedHomeState.key, HOMECITY: selectedHomeCity.key })
      navigation.push('onboarding', { pageNo: '10' })
      callPartialRegistrationAPI()
    } catch {
      // allow retry
    } finally {
      setSubmitting(false)
    }
  }

  useOnboardingFooter(
    { nextDisabled: !canSubmit, nextLoading: submitting, onNext: handleNext },
    [canSubmit, submitting],
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
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
        style={[floatStyles.field, disabled && floatStyles.fieldDisabled]}
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
  loader:         { marginTop: 32 },
  fieldsContainer: { gap: 24 },
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
