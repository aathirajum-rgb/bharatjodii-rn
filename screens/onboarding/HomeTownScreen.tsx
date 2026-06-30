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
import i18n from '../../i18n'
import {
  callRegistrationAPI,
  fetchCities,
  fetchStates,
  getRegValues,
  setRegValues,
  getRegValue,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = 'https://imgs.jodii.app/assets/images/svg/registration-new/location.svg'
const PANEL_WIDTH   = Dimensions.get('window').width * 0.85
const ITEM_HEIGHT   = 52

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
  const [search,            setSearch]             = useState('')
  const [searchFocused,     setSearchFocused]      = useState(false)

  const slideAnim = useRef(new Animated.Value(0)).current

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
    setSelectedHomeState(opt)
    setSelectedHomeCity(null)
    setCities([])
    closePanel()
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
    closePanel()
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const possessive       = PROFILE_POSSESSIVE[createdBy] ?? 'their'
  const title            = `Is ${possessive} home town same as current location?`
  const langLabel        = LANG_LABEL[i18n.language] ?? 'Eng'
  const panelTranslateX  = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [PANEL_WIDTH, 0] })
  const panelTitle       = panelKind === 'state' ? 'Select state' : 'Select district'
  const currentList      = panelKind === 'state' ? states : cities
  const canSubmit        = !!selectedHomeState && !!selectedHomeCity && !submitting

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return currentList
    return currentList.filter(o => o.label.toLowerCase().includes(q))
  }, [currentList, search])

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
          { paddingBottom: 160 + (Platform.OS === 'ios' ? insets.bottom : 20) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={styles.pageIcon} contentFit="contain" />
        <Text style={styles.title}>{title}</Text>

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
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>{panelTitle}</Text>
              <TouchableOpacity onPress={closePanel} hitSlop={8}>
                <Text style={styles.panelClose}>✕</Text>
              </TouchableOpacity>
            </View>

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
                      ? selectedHomeState?.key === item.key
                      : selectedHomeCity?.key === item.key
                  return (
                    <Pressable
                      style={[styles.item, isSelected && styles.itemSelected]}
                      onPress={() => panelKind === 'state' ? onStateSelect(item) : onCitySelect(item)}
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

const BORDER_COLOR   = '#b0b0b0'
const SELECTED_BG    = 'rgba(181,0,51,0.02)'
const CHIP_CHECKED_BORDER = 'rgba(181,0,51,0.4)'

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
    borderColor:     '#8a8a8a',
    backgroundColor: Colors.surface,
    paddingLeft:     8,
    paddingRight:    16,
    gap:             8,
  },
  yesNoChipSelected: {
    borderColor:     CHIP_CHECKED_BORDER,
    backgroundColor: SELECTED_BG,
  },

  chipRadio: {
    width:           20,
    height:          20,
    borderRadius:    10,
    borderWidth:     1.5,
    borderColor:     '#8a8a8a',
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

  // Panel
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
  searchBoxFocused: { borderColor: Colors.primary },
  searchIcon: { fontSize: 16, color: 'rgba(0,0,0,0.4)' },
  searchInput: {
    flex:     1,
    fontSize: 14,
    color:    Colors.textPrimary,
    padding:  0,
  },
  searchClear: {
    fontSize: 13,
    color:    'rgba(0,0,0,0.4)',
    padding:  2,
  },

  panelEmpty:     { padding: 32, alignItems: 'center' },
  panelEmptyText: { fontSize: 14, color: 'rgba(0,0,0,0.4)' },

  // List items
  item: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
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
    borderColor:     BORDER_COLOR,
    borderRadius:    8,
    paddingLeft:     16,
    paddingRight:    12,
    backgroundColor: Colors.surface,
  },
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
    color:      'rgba(0,0,0,0.35)',
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
