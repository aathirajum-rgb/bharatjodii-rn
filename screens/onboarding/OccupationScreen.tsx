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
  fetchOccupationOptions,
  getRegValues,
  setRegValue,
  getRegValue,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = 'https://imgs.jodii.app/assets/images/svg/registration-new/occupation.svg'
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

const LANG_LABEL: Record<string, string> = {
  en: 'Eng', tm: 'Tamil', tl: 'Telugu', ml: 'Malay', kn: 'Kanna',
  hi: 'Hindi', bn: 'Bangla', mt: 'Marathi', or: 'Odia', gj: 'Gujarati', pa: 'Punjabi',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OccupationScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [allOptions,   setAllOptions]   = useState<Option[]>([])
  const [fetching,     setFetching]     = useState(true)
  const [selected,     setSelected]     = useState<Option | null>(null)
  const [createdBy,    setCreatedBy]    = useState('4')
  const [gender,       setGender]       = useState('1')
  const [submitting,   setSubmitting]   = useState(false)
  const [customerCare, setCustomerCare] = useState('')
  const [panelVisible, setPanelVisible] = useState(false)
  const [search,       setSearch]       = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const slideAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValues(),
      getItem(SK.App.CUSTOMER_CARE),
    ]).then(([cb, rv, cc]) => {
      const { GENDER: gnd, OCCUPATION: savedOcc } = rv as Record<string, string>
      if (cb)  setCreatedBy(cb)
      if (gnd) setGender(gnd)
      if (cc)  setCustomerCare(cc)

      fetchOccupationOptions()
        .then(list => {
          setAllOptions(list)
          if (savedOcc) {
            const found = list.find(o => o.key === savedOcc)
            if (found) setSelected(found)
          }
        })
        .catch(() => {})
        .finally(() => setFetching(false))
    })
  }, [])

  // Filtered list for panel search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allOptions
    return allOptions.filter(o => o.label.toLowerCase().includes(q))
  }, [allOptions, search])

  // ─── Panel ────────────────────────────────────────────────────────────────

  function openPanel() {
    setSearch('')
    setPanelVisible(true)
    Animated.timing(slideAnim, {
      toValue: 1, duration: 280, useNativeDriver: true,
    }).start()
  }

  function closePanel() {
    Animated.timing(slideAnim, {
      toValue: 0, duration: 230, useNativeDriver: true,
    }).start(() => setPanelVisible(false))
  }

  function selectOption(opt: Option) {
    setSelected(opt)
    closePanel()
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const possessive      = PROFILE_POSSESSIVE[createdBy] ?? 'their'
  const title           = `What is ${possessive} occupation?`
  const langLabel       = LANG_LABEL[i18n.language] ?? 'Eng'
  const panelTranslateX = slideAnim.interpolate({
    inputRange: [0, 1], outputRange: [PANEL_WIDTH, 0],
  })
  // Angular: GENDER=='1' → page 12 (MonthlyIncome), else page 13 (Religion)
  const nextPage = gender === '1' ? '12' : '13'

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await setRegValue('OCCUPATION', selected.key)
      await callRegistrationAPI({ OCCUPATION: selected.key })
      navigation.push('onboarding', { pageNo: nextPage })
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

        {fetching ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <Pressable
            style={[styles.selectField, !!selected && styles.selectFieldActive]}
            onPress={openPanel}
            accessibilityRole="button"
            accessibilityLabel="Select occupation"
          >
            <Text
              style={[styles.selectFieldText, !!selected && styles.selectFieldTextActive]}
              numberOfLines={1}
            >
              {selected ? selected.label : 'Select occupation'}
            </Text>
            <Text style={styles.selectFieldArrow}>›</Text>
          </Pressable>
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
          disabled={!selected}
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

      {/* Occupation picker — right-side sliding panel */}
      <Modal
        transparent
        visible={panelVisible}
        animationType="none"
        onRequestClose={closePanel}
        statusBarTranslucent
      >
        <View style={styles.panelContainer}>
          {/* Backdrop */}
          <Pressable style={styles.backdrop} onPress={closePanel} />

          {/* Sliding panel */}
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
              <Text style={styles.panelTitle}>Select occupation</Text>
              <TouchableOpacity onPress={closePanel} hitSlop={8}>
                <Text style={styles.panelCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search box */}
            <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search occupation..."
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

            {/* Occupation list */}
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
                  const isSelected = selected?.key === item.key
                  return (
                    <Pressable
                      style={[styles.item, isSelected && styles.itemSelected]}
                      onPress={() => selectOption(item)}
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

  loader: { marginTop: 48 },

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
  selectFieldActive: {},
  selectFieldText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  selectFieldTextActive: {
    fontWeight: '500',
  },
  selectFieldArrow: {
    fontSize:   22,
    color:      Colors.textPrimary,
    lineHeight: 26,
  },

  // Sticky footer
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

  // Right-side sliding panel
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

  // Search box
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
  searchBoxFocused: {
    borderColor: Colors.primary,
  },
  searchIcon: {
    fontSize: 14,
  },
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

  panelEmpty: {
    padding:    32,
    alignItems: 'center',
  },
  panelEmptyText: {
    fontSize: 14,
    color:    'rgba(0,0,0,0.4)',
  },

  // Occupation list items
  item: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    height:            ITEM_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  itemSelected: {
    backgroundColor: SELECTED_BG,
  },
  itemText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  itemTextSelected: {
    fontWeight: '500',
    color:      Colors.primaryDark,
  },
  itemRadio: {
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: Colors.primaryDark,
    alignItems:      'center',
    justifyContent:  'center',
  },
  itemRadioTick: {
    color:      Colors.surface,
    fontSize:   10,
    fontWeight: '700',
    lineHeight: 12,
  },
})
