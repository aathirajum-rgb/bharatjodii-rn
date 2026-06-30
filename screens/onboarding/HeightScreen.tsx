import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
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
  HeightGroup,
  callRegistrationAPI,
  fetchHeightCategoryOptions,
  fetchExactHeightGrouped,
  getRegValue,
  setRegValues,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON  = 'https://imgs.jodii.app/assets/images/svg/registration-new/son-height.svg'
const FOOTER_H       = 140
const PANEL_WIDTH    = Dimensions.get('window').width * 0.85

const PROFILE_POSSESSIVE: Record<string, string> = {
  '4':  "son's",
  '5':  "daughter's",
  '8':  "brother's",
  '9':  "sister's",
  '10': "friend's",
  '11': "relative's",
}

// HEIGHTCATEGORY keys are 101-104 per Angular form-fields logic
const FALLBACK_CATEGORIES: Category[] = [
  { key: '101', label: 'Below average', subtitle: "Shorter than 5'3 ft" },
  { key: '102', label: 'Average',       subtitle: "5'4 - 5'6 ft"        },
  { key: '103', label: 'Above average', subtitle: "5'7 - 5'11 ft"       },
  { key: '104', label: 'Tall',          subtitle: "Greater than 6 ft"    },
]

const LANG_LABEL: Record<string, string> = {
  en: 'Eng', tm: 'Tamil', tl: 'Telugu', ml: 'Malay', kn: 'Kanna',
  hi: 'Hindi', bn: 'Bangla', mt: 'Marathi', or: 'Odia', gj: 'Gujarati', pa: 'Punjabi',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Option   = { key: string; label: string }
type Category = { key: string; label: string; subtitle: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Angular API labels contain HTML: "Below average <span ...>(Shorter than 5'3 ft)</span>"
// This strips all tags and returns the plain main text and the span content as subtitle.
function parseHtmlLabel(raw: string): { label: string; subtitle: string } {
  const spanMatch = raw.match(/<span[^>]*>([\s\S]*?)<\/span>/i)
  const subtitle  = spanMatch
    ? spanMatch[1].replace(/<[^>]+>/g, '').trim()
    : ''
  const label = raw
    .replace(/<span[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim()
  return { label, subtitle }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HeightScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [categories,       setCategories]       = useState<Category[]>([])
  const [heightGroups,     setHeightGroups]      = useState<HeightGroup[]>([])
  const [fetching,         setFetching]          = useState(true)
  const [selectedCategory, setSelectedCategory]  = useState<string | null>(null)
  const [selectedHeight,   setSelectedHeight]    = useState<Option | null>(null)
  const [createdBy,        setCreatedBy]         = useState('4')
  const [submitting,       setSubmitting]        = useState(false)
  const [customerCare,     setCustomerCare]      = useState('')
  const [panelVisible,     setPanelVisible]      = useState(false)

  const slideAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('GENDER'),
      getRegValue('HEIGHTCATEGORY'),
      getRegValue('HEIGHT'),
      getItem(SK.App.CUSTOMER_CARE),
    ]).then(([cb, gender, savedCat, savedHeight, cc]) => {
      const g2 = gender ?? '1'
      setCreatedBy(cb ?? '4')
      if (cc) setCustomerCare(cc)

      Promise.all([
        fetchHeightCategoryOptions(g2),
        fetchExactHeightGrouped(g2),
      ]).then(([rawCats, groups]) => {
        // Parse HTML from category labels — API returns Angular-flavoured HTML strings
        const cats: Category[] = rawCats.length
          ? rawCats.map((opt: Option) => {
              const { label, subtitle } = parseHtmlLabel(opt.label)
              return { key: opt.key, label, subtitle }
            })
          : FALLBACK_CATEGORIES
        setCategories(cats)
        setHeightGroups(groups)

        // Restore prior exact-height selection (back navigation)
        if (savedHeight && groups.length) {
          const found = groups.flatMap(g => g.data).find((h: Option) => h.key === savedHeight)
          if (found) { setSelectedHeight(found); return }
        }
        if (savedCat) setSelectedCategory(savedCat)
      }).catch(() => {
        setCategories(FALLBACK_CATEGORIES)
      }).finally(() => setFetching(false))
    })
  }, [])

  // ─── Panel open/close ─────────────────────────────────────────────────────

  function openPanel() {
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

  // ─── Selection ────────────────────────────────────────────────────────────

  function selectCategory(key: string) {
    setSelectedCategory(key)
    setSelectedHeight(null)
  }

  function selectExactHeight(option: Option) {
    setSelectedHeight(option)
    setSelectedCategory(null)
    closePanel()
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const possessive   = PROFILE_POSSESSIVE[createdBy] ?? 'their'
  const title        = `What is ${possessive} height?`
  const langLabel    = LANG_LABEL[i18n.language] ?? 'Eng'
  const hasSelection = selectedCategory !== null || selectedHeight !== null

  // Panel slides in from the right
  const panelTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [PANEL_WIDTH, 0],
  })

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!hasSelection || submitting) return
    setSubmitting(true)
    try {
      if (selectedHeight) {
        // Exact height selected — Angular: saves HEIGHT key, clears HEIGHTCATEGORY
        await setRegValues({ HEIGHT: selectedHeight.key, HEIGHTCATEGORY: '' })
        await callRegistrationAPI({ HEIGHT: selectedHeight.key, HEIGHTCATEGORY: '' })
      } else {
        // Category selected (101-104) — Angular: saves HEIGHTCATEGORY, clears HEIGHT
        await setRegValues({ HEIGHTCATEGORY: selectedCategory!, HEIGHT: '' })
        await callRegistrationAPI({ HEIGHTCATEGORY: selectedCategory, HEIGHT: '' })
      }
      navigation.push('onboarding', { pageNo: '38' })
    } catch {
      // Allow retry on next tap
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
          <>
            {/* Category radio rows */}
            {categories.map((cat, idx) => {
              const isSelected = selectedCategory === cat.key
              const isLast     = idx === categories.length - 1
              return (
                <Pressable
                  key={cat.key}
                  style={[
                    styles.row,
                    !isLast && styles.rowBorder,
                    isSelected && styles.rowSelected,
                  ]}
                  onPress={() => selectCategory(cat.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={cat.label}
                >
                  <View style={styles.rowLabels}>
                    <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>
                      {cat.label}
                    </Text>
                    {!!cat.subtitle && (
                      <Text style={[styles.rowSubtitle, isSelected && styles.rowSubtitleSelected]}>
                        {cat.subtitle}
                      </Text>
                    )}
                  </View>

                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <Text style={styles.radioTick}>✓</Text>}
                  </View>
                </Pressable>
              )
            })}

            {/* OR divider */}
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            {/* "Select exact height" field */}
            <Pressable
              style={[styles.exactField, !!selectedHeight && styles.exactFieldActive]}
              onPress={openPanel}
              accessibilityRole="button"
            >
              <Text
                style={[styles.exactFieldText, !!selectedHeight && styles.exactFieldTextActive]}
                numberOfLines={1}
              >
                {selectedHeight ? selectedHeight.label : `Select ${possessive} exact height`}
              </Text>
              <Text style={styles.exactFieldArrow}>›</Text>
            </Pressable>
          </>
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
          disabled={!hasSelection}
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

      {/* Exact height picker — right-side sliding panel */}
      <Modal
        transparent
        visible={panelVisible}
        animationType="none"
        onRequestClose={closePanel}
        statusBarTranslucent
      >
        <View style={styles.panelContainer}>
          {/* Backdrop (left of panel) — tap to close */}
          <Pressable style={styles.backdrop} onPress={closePanel} />

          {/* Panel slides in from the right */}
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
              <Text style={styles.panelTitle}>Select {possessive} height</Text>
              <TouchableOpacity onPress={closePanel} hitSlop={8}>
                <Text style={styles.panelCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            {heightGroups.length === 0 ? (
              <View style={styles.panelEmpty}>
                <Text style={styles.panelEmptyText}>No heights available</Text>
              </View>
            ) : (
              <SectionList
                sections={heightGroups}
                keyExtractor={(item: Option) => item.key}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section }) => (
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>{section.title}</Text>
                  </View>
                )}
                renderItem={({ item }: { item: Option }) => {
                  const isSelected = selectedHeight?.key === item.key
                  return (
                    <Pressable
                      style={[styles.heightItem, isSelected && styles.heightItemSelected]}
                      onPress={() => selectExactHeight(item)}
                      accessibilityRole="menuitem"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text style={[styles.heightItemText, isSelected && styles.heightItemTextSelected]}>
                        {item.label}
                      </Text>
                      {isSelected && (
                        <View style={[styles.radio, styles.radioSelected]}>
                          <Text style={styles.radioTick}>✓</Text>
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

const ROW_SELECTED_BG  = '#fff1f5'
const ROW_BORDER_COLOR = '#e6e6e6'

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

  // Row — negative margin cancels scroll padding so the pink selection bg
  // stretches edge-to-edge (matches Figma full-width highlight).
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    marginHorizontal:  -24,
    paddingHorizontal: 24,
    paddingVertical:   12,
    minHeight:         60,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: ROW_BORDER_COLOR,
  },
  rowSelected: {
    backgroundColor: ROW_SELECTED_BG,
  },

  rowLabels: { flex: 1 },

  rowLabel: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
    lineHeight: 18,
  },
  rowLabelSelected: {
    fontWeight: '500',
  },

  rowSubtitle: {
    fontSize:   14,
    fontWeight: '400',
    color:      'rgba(0,0,0,0.6)',
    lineHeight: 18,
    marginTop:  2,
  },
  rowSubtitleSelected: {
    fontWeight: '500',
  },

  // Radio — 20×20, 1px border (Figma: border-[#545454])
  radio: {
    width:           20,
    height:          20,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     '#545454',
    alignItems:      'center',
    justifyContent:  'center',
  },
  radioSelected: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  radioTick: {
    color:      Colors.surface,
    fontSize:   10,
    fontWeight: '700',
    lineHeight: 12,
  },

  // OR divider
  orRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     20,
    marginBottom:  16,
    gap:           8,
  },
  orLine: {
    flex:            1,
    height:          1,
    backgroundColor: '#e0e0e0',
  },
  orText: {
    fontSize: 14,
    color:    'rgba(0,0,0,0.5)',
  },

  // "Select exact height" outlined field
  exactField: {
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
  exactFieldActive: {},
  exactFieldText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  exactFieldTextActive: {
    fontWeight: '500',
  },
  exactFieldArrow: {
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

  // Right-side sliding panel (85 % of screen width)
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
    borderBottomColor: ROW_BORDER_COLOR,
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
  panelEmpty: {
    padding:    32,
    alignItems: 'center',
  },
  panelEmptyText: {
    fontSize: 14,
    color:    'rgba(0,0,0,0.4)',
  },

  // Section header inside SectionList (Short / Average Height / Tall)
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical:   8,
    backgroundColor:   Colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: ROW_BORDER_COLOR,
  },
  sectionHeaderText: {
    fontSize:   12,
    fontWeight: '600',
    color:      'rgba(0,0,0,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // Height list items (inside panel)
  heightItem: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    height:            52,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  heightItemSelected: {
    backgroundColor: ROW_SELECTED_BG,
  },
  heightItemText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  heightItemTextSelected: {
    fontWeight: '500',
    color:      Colors.primaryDark,
  },
})
