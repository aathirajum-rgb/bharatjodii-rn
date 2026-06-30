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
import RegistrationSuccessSheet from '../../components/registration-success-sheet/RegistrationSuccessSheet'
import {
  callRegistrationAPI,
  fetchCasteOptions,
  fetchSubcasteOptions,
  getNextPageAfterCaste,
  getRegValues,
  setRegValue,
  getRegValue,
} from '../../service/registrationService'
import { getItem, setItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'caste.svg'
const FOOTER_H      = 140
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Option      = { key: string; label: string }
type ActivePanel = 'caste' | 'subcaste' | null

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CasteScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  // Options
  const [casteOptions,    setCasteOptions]    = useState<Option[]>([])
  const [subcasteOptions, setSubcasteOptions] = useState<Option[]>([])

  // Selections
  const [selectedCaste,    setSelectedCaste]    = useState<Option | null>(null)
  const [selectedSubcaste, setSelectedSubcaste] = useState<Option | null>(null)

  // UI state
  const [fetchingCaste,    setFetchingCaste]    = useState(true)
  const [fetchingSubcaste, setFetchingSubcaste] = useState(false)
  const [hasSubcaste,      setHasSubcaste]      = useState(false)
  const [submitting,       setSubmitting]       = useState(false)
  const [successVisible,   setSuccessVisible]   = useState(false)
  const [customerCare,     setCustomerCare]     = useState('')

  // Panel state — single modal, one at a time
  const [activePanel,  setActivePanel]  = useState<ActivePanel>(null)
  const [search,       setSearch]       = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  // Context
  const [createdBy,    setCreatedBy]    = useState('4')
  const [religion,     setReligion]     = useState('')
  const [mothertongue, setMothertongue] = useState('')

  const slideAnim = useRef(new Animated.Value(0)).current

  // ─── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getItem(SK.App.CUSTOMER_CARE),
      getRegValues(),
    ]).then(async ([cb, cc, regVals]) => {
      const { RELIGION: rel, MOTHERTONGUE: mt, CASTE: savedCaste, SUBCASTE: savedSubcaste } = regVals
      if (cb)  setCreatedBy(cb)
      if (rel) setReligion(rel)
      if (mt)  setMothertongue(mt)
      if (cc)  setCustomerCare(cc)

      try {
        const list = await fetchCasteOptions(rel ?? '', mt ?? '')
        setCasteOptions(list)

        if (savedCaste) {
          const found = list.find(o => o.key === savedCaste)
          if (found) {
            setSelectedCaste(found)
            // Also restore subcaste if available
            if (savedSubcaste && rel !== '2') {
              await loadSubcaste(rel ?? '', savedCaste, mt ?? '', savedSubcaste)
            }
          }
        }
      } catch {
        // continue — user can still try
      } finally {
        setFetchingCaste(false)
      }
    })
  }, [])

  // ─── Subcaste loader ──────────────────────────────────────────────────────

  async function loadSubcaste(
    rel: string,
    caste: string,
    mt: string,
    restoreKey?: string,
  ) {
    if (rel === '2') {
      // Christianity — no subcaste
      setHasSubcaste(false)
      setSubcasteOptions([])
      return
    }
    setFetchingSubcaste(true)
    try {
      const list = await fetchSubcasteOptions(rel, caste, mt)
      setSubcasteOptions(list)
      setHasSubcaste(list.length > 0)
      if (restoreKey && list.length > 0) {
        const found = list.find(o => o.key === restoreKey)
        if (found) setSelectedSubcaste(found)
      }
    } catch {
      setHasSubcaste(false)
    } finally {
      setFetchingSubcaste(false)
    }
  }

  // ─── Panel ────────────────────────────────────────────────────────────────

  function openPanel(panel: ActivePanel) {
    setSearch('')
    setSearchFocused(false)
    setActivePanel(panel)
    Animated.timing(slideAnim, {
      toValue: 1, duration: 280, useNativeDriver: true,
    }).start()
  }

  function closePanel() {
    Animated.timing(slideAnim, {
      toValue: 0, duration: 230, useNativeDriver: true,
    }).start(() => setActivePanel(null))
  }

  async function selectCaste(opt: Option) {
    setSelectedCaste(opt)
    setSelectedSubcaste(null)   // clear subcaste when caste changes
    setHasSubcaste(false)
    closePanel()
    await loadSubcaste(religion, opt.key, mothertongue)
  }

  function selectSubcaste(opt: Option) {
    setSelectedSubcaste(opt)
    closePanel()
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const possessive      = PROFILE_POSSESSIVE[createdBy] ?? 'their'
  const title           = `Select ${possessive} caste`
  const panelTranslateX = slideAnim.interpolate({
    inputRange: [0, 1], outputRange: [PANEL_WIDTH, 0],
  })

  const activeOptions = activePanel === 'caste' ? casteOptions : subcasteOptions
  const panelTitle    = activePanel === 'caste' ? 'Select caste' : 'Select sub caste'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activeOptions
    return activeOptions.filter(o => o.label.toLowerCase().includes(q))
  }, [activeOptions, search])

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!selectedCaste || submitting) return
    setSubmitting(true)
    try {
      await setRegValue('CASTE', selectedCaste.key)
      let res = await callRegistrationAPI({ CASTE: selectedCaste.key })

      if (selectedSubcaste) {
        await setRegValue('SUBCASTE', selectedSubcaste.key)
        res = await callRegistrationAPI({ SUBCASTE: selectedSubcaste.key })
      }

      const matriId = res?.RESPONSE?.MATRIID
      const nextPage = await getNextPageAfterCaste(selectedCaste.key)

      if (matriId && nextPage === '20') {
        await setItem(SK.Auth.USER_ID, String(matriId))
        setSuccessVisible(true)
      } else {
        navigation.push('onboarding', { pageNo: nextPage })
      }
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
        onBackPress={() => navigation.goBack()}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />

      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: FOOTER_H + (Platform.OS === 'ios' ? insets.bottom : 20) + 12 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={{ uri: CDN_PAGE_ICON }}
          style={styles.pageIcon}
          contentFit="contain"
        />

        <Text style={styles.title}>{title}</Text>

        {fetchingCaste ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.fields}>
            {/* ── Caste select field ─────────────────────────────────── */}
            <View style={styles.fieldWrapper}>
              <View style={styles.fieldLabelBadge}>
                <Text style={styles.fieldLabelText}>Caste</Text>
              </View>
              <Pressable
                style={styles.selectField}
                onPress={() => openPanel('caste')}
                accessibilityRole="button"
                accessibilityLabel="Select caste"
              >
                <Text
                  style={[
                    styles.selectFieldText,
                    !!selectedCaste && styles.selectFieldTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {selectedCaste ? selectedCaste.label : 'Select caste'}
                </Text>
                <Text style={styles.selectFieldArrow}>›</Text>
              </Pressable>
            </View>

            {/* ── Sub caste field — only when available ─────────────── */}
            {selectedCaste && (
              fetchingSubcaste ? (
                <ActivityIndicator
                  color={Colors.primary}
                  size="small"
                  style={styles.subcasteLoader}
                />
              ) : hasSubcaste ? (
                <View style={[styles.fieldWrapper, styles.fieldWrapperGap]}>
                  <View style={styles.fieldLabelBadge}>
                    <Text style={styles.fieldLabelText}>
                      Sub caste{' '}
                      <Text style={styles.fieldLabelOptional}>(Optional)</Text>
                    </Text>
                  </View>
                  <Pressable
                    style={styles.selectField}
                    onPress={() => openPanel('subcaste')}
                    accessibilityRole="button"
                    accessibilityLabel="Select sub caste"
                  >
                    <Text
                      style={[
                        styles.selectFieldText,
                        !!selectedSubcaste && styles.selectFieldTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSubcaste ? selectedSubcaste.label : 'Select sub caste'}
                    </Text>
                    <Text style={styles.selectFieldArrow}>›</Text>
                  </Pressable>
                </View>
              ) : null
            )}
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
          disabled={!selectedCaste || submitting}
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

      {/* Single sliding panel — renders caste or subcaste list based on activePanel */}
      <Modal
        transparent
        visible={activePanel !== null}
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
            {/* Header */}
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>{panelTitle}</Text>
              <TouchableOpacity onPress={closePanel} hitSlop={8}>
                <Text style={styles.panelCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                style={styles.searchInput}
                placeholder={activePanel === 'caste' ? 'Search caste...' : 'Search sub caste...'}
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
                    activePanel === 'caste'
                      ? selectedCaste?.key === item.key
                      : selectedSubcaste?.key === item.key
                  return (
                    <Pressable
                      style={[styles.item, isSelected && styles.itemSelected]}
                      onPress={() =>
                        activePanel === 'caste' ? selectCaste(item) : selectSubcaste(item)
                      }
                      accessibilityRole="menuitem"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                        {item.label}
                      </Text>
                      {isSelected && (
                        <View style={styles.itemRadio}>
                          <Text style={styles.itemRadioTick}>✓</Text>
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

      <RegistrationSuccessSheet
        visible={successVisible}
        onContinue={() => {
          setSuccessVisible(false)
          navigation.push('onboarding', { pageNo: '20' })
        }}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SELECTED_BG  = 'rgba(181,0,51,0.02)'
const BORDER_COLOR = '#e6e6e6'

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

  loader:       { marginTop: 48 },
  subcasteLoader: { marginTop: 20, alignSelf: 'flex-start' },

  fields: { gap: 0 },

  // Floating-label field
  fieldWrapper: {
    position: 'relative',
    marginTop: 8,
  },
  fieldWrapperGap: {
    marginTop: 32,
  },
  fieldLabelBadge: {
    position:          'absolute',
    top:               -8,
    left:              12,
    zIndex:            1,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
    flexDirection:     'row',
    alignItems:        'center',
  },
  fieldLabelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textSecondary ?? '#666',
    lineHeight: 16,
  },
  fieldLabelOptional: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textSecondary ?? '#8a8a8a',
  },

  selectField: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          48,
    borderWidth:     1,
    borderColor:     '#b0b0b0',
    borderRadius:    8,
    paddingLeft:     16,
    paddingRight:    12,
    backgroundColor: Colors.surface,
  },
  selectFieldText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      'rgba(0,0,0,0.35)',
  },
  selectFieldTextActive: {
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  selectFieldArrow: {
    fontSize:   22,
    color:      Colors.textPrimary,
    lineHeight: 26,
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
    fontWeight:    '400',
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
    flex:           1,
    flexDirection:  'row',
    justifyContent: 'flex-end',
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
    borderBottomColor: BORDER_COLOR,
  },
  panelTitle: {
    flex:       1,
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
  panelCloseTxt: {
    fontSize: 16,
    color:    Colors.textPrimary,
    padding:  4,
  },

  searchBox: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  16,
    marginVertical:    12,
    height:            40,
    borderWidth:       1,
    borderColor:       BORDER_COLOR,
    borderRadius:      8,
    paddingHorizontal: 10,
    gap:               8,
    backgroundColor:   Colors.surface,
  },
  searchBoxFocused: { borderColor: Colors.primary },
  searchIcon:  { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, padding: 0 },
  searchClear: { fontSize: 13, color: 'rgba(0,0,0,0.4)', padding: 2 },

  panelEmpty: { padding: 32, alignItems: 'center' },
  panelEmptyText: { fontSize: 14, color: 'rgba(0,0,0,0.4)' },

  item: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    height:            ITEM_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  itemSelected:     { backgroundColor: SELECTED_BG },
  itemText:         { flex: 1, fontSize: 14, fontWeight: '400', color: Colors.textPrimary },
  itemTextSelected: { fontWeight: '500', color: Colors.primaryDark },
  itemRadio: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primaryDark, alignItems: 'center', justifyContent: 'center',
  },
  itemRadioTick: {
    color: Colors.surface, fontSize: 10, fontWeight: '700', lineHeight: 12,
  },
})
