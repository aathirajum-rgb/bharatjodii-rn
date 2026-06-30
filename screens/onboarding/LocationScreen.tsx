import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppHeader from '../../components/app-header/AppHeader'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { StorageKeys as SK } from '../../constants/storage.keys'
import {
  callRegistrationAPI,
  fetchCities,
  fetchStates,
  getNextPageAfterLocation,
  getRegValues,
  setRegValues,
  getRegValue,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON  = CDN_REG + 'location.svg'
const PANEL_WIDTH    = Dimensions.get('window').width * 0.85
const ITEM_HEIGHT    = 52
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
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

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
  const [search,         setSearch]         = useState('')
  const [searchFocused,  setSearchFocused]  = useState(false)

  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current

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
    setSearch('')
    setPanelVisible(true)
    Animated.timing(slideAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start()
  }

  function closePanel() {
    Animated.timing(slideAnim, { toValue: 0, duration: 230, useNativeDriver: true }).start(
      () => setPanelVisible(false),
    )
  }

  async function onStateSelect(opt: Option) {
    setSelectedState(opt)
    setSelectedCity(null)
    setCities([])
    closePanel()

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
    closePanel()
  }

  // ─── Derived ──────────────────────────────────────────────────────────────────

  const title = LOCATION_TITLES[createdBy] ?? `Select where they live`
  const panelTranslateX = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [PANEL_WIDTH, 0] })
  const isIndianFlow = countryCode === '91'
  const countryLabel = isIndianFlow ? 'India' : 'Other'

  const currentList = panelKind === 'state' ? states : cities
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return currentList
    return currentList.filter(o => o.label.toLowerCase().includes(q))
  }, [currentList, search])

  const panelTitle  = panelKind === 'state' ? 'Select state' : 'Select district'
  const canSubmit   = !!selectedState && !!selectedCity && !submitting

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!canSubmit || !selectedState || !selectedCity) return
    setSubmitting(true)
    try {
      await setRegValues({ STATE: selectedState.key, CITY: selectedCity.key, COUNTRY: INDIA_COUNTRY })
      await callRegistrationAPI({
        STATE:   selectedState.key,
        CITY:    selectedCity.key,
        COUNTRY: INDIA_COUNTRY,
      })
      const nextPage = await getNextPageAfterLocation()
      navigation.push('onboarding', { pageNo: nextPage })
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <AppHeader
        type="registration"
        showBackBtn={navigation.canGoBack()}
        onBackPress={() => navigation.goBack()}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />

      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 160 + (Platform.OS === 'ios' ? insets.bottom : 20) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={styles.pageIcon} contentFit="contain" />
        <Text style={styles.title}>{title}</Text>

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

      {/* Right-side sliding panel — shared for State + District */}
      <Modal
        transparent
        visible={panelVisible}
        animationType="none"
        onRequestClose={closePanel}
        statusBarTranslucent
      >
        <View style={styles.panelContainer}>
          <Pressable style={styles.backdrop} onPress={closePanel} />

          <Animated.View
            style={[
              styles.panel,
              {
                paddingBottom: Platform.OS === 'ios' ? insets.bottom : 16,
                transform: [{ translateX: panelTranslateX }],
              },
            ]}
          >
            {/* Panel header */}
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>{panelTitle}</Text>
              <TouchableOpacity onPress={closePanel} hitSlop={8}>
                <Text style={styles.panelClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                style={styles.searchInput}
                placeholder={panelKind === 'state' ? 'Search state…' : 'Search district…'}
                placeholderTextColor="rgba(0,0,0,0.35)"
                value={search}
                onChangeText={setSearch}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {!!search && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                  <Text style={styles.searchClear}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* List */}
            {filtered.length === 0 ? (
              <View style={styles.panelEmpty}>
                <Text style={styles.panelEmptyText}>No results found</Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item: Option) => item.key}
                getItemLayout={(_: any, index: number) => ({
                  length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index,
                })}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }: { item: Option }) => {
                  const isSelected =
                    panelKind === 'state'
                      ? selectedState?.key === item.key
                      : selectedCity?.key === item.key
                  return (
                    <Pressable
                      style={[styles.item, isSelected && styles.itemSelected]}
                      onPress={() =>
                        panelKind === 'state' ? onStateSelect(item) : onCitySelect(item)
                      }
                      accessibilityRole="menuitem"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                        {item.label}
                      </Text>
                      {isSelected && (
                        <View style={styles.itemTick}>
                          <Text style={styles.itemTickText}>✓</Text>
                        </View>
                      )}
                    </Pressable>
                  )
                }}
              />
            )}
          </Animated.View>
        </View>
      </Modal>
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

const BORDER_COLOR   = '#b0b0b0'
const SELECTED_BG    = 'rgba(181,0,51,0.02)'

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
    marginBottom: 32,
  },

  loader: { marginTop: 48 },

  fieldsContainer: {
    gap: 24,
  },

  // Footer
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
    color:         Colors.textPrimary,
    letterSpacing: 0.42,
  },
  helpPhone: {
    fontSize:      14,
    fontWeight:    '500',
    color:         '#29339b',
    letterSpacing: 0.42,
  },

  // Right-side sliding panel
  panelContainer: {
    flex:          1,
    flexDirection: 'row',
  },
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  panel: {
    width:           PANEL_WIDTH,
    backgroundColor: Colors.surface,
    elevation:       8,
    shadowColor:     '#000',
    shadowOpacity:   0.2,
    shadowOffset:    { width: -2, height: 0 },
    shadowRadius:    8,
  },
  panelHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   16,
    borderBottomWidth: 1,
    borderBottomColor: '#e6e6e6',
  },
  panelTitle: {
    flex:       1,
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
  panelClose: {
    fontSize: 16,
    color:    Colors.textPrimary,
    padding:  4,
  },

  // Search
  searchBox: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  16,
    marginVertical:    12,
    height:            40,
    borderWidth:       1,
    borderColor:       '#e6e6e6',
    borderRadius:      8,
    paddingHorizontal: 10,
    gap:               8,
    backgroundColor:   Colors.surface,
  },
  searchBoxFocused: {
    borderColor: Colors.primary,
  },
  searchIcon:  { fontSize: 14 },
  searchInput: {
    flex:    1,
    fontSize: 14,
    color:    Colors.textPrimary,
    padding:  0,
  },
  searchClear: {
    fontSize: 13,
    color:    'rgba(0,0,0,0.4)',
    padding:  2,
  },

  panelEmpty: { padding: 32, alignItems: 'center' },
  panelEmptyText: { fontSize: 14, color: 'rgba(0,0,0,0.4)' },

  // List items
  item: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    height:            ITEM_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  itemSelected:     { backgroundColor: SELECTED_BG },
  itemText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  itemTextSelected: { fontWeight: '500', color: Colors.primaryDark },
  itemTick: {
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: Colors.primaryDark,
    alignItems:      'center',
    justifyContent:  'center',
  },
  itemTickText: {
    color:      Colors.surface,
    fontSize:   10,
    fontWeight: '700',
    lineHeight: 12,
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
    borderColor:     BORDER_COLOR,
    borderRadius:    8,
    paddingLeft:     16,
    paddingRight:    12,
    backgroundColor: Colors.surface,
  },
  fieldActive:   { borderColor: BORDER_COLOR },
  fieldDisabled: {
    backgroundColor: '#f5f5f5',
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
