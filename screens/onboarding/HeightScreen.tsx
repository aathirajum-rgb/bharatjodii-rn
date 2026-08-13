import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Animated,
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
import { Colors } from '../../constants/colors'
import {
  HeightGroup,
  callPartialRegistrationAPI,
  fetchHeightCategoryOptions,
  fetchExactHeightGrouped,
  getRegValue,
  setRegValues,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE, PICKER_PANEL_WIDTH } from '../../constants/registration.constants'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON  = CDN_REG + 'son-height.svg'
const FOOTER_H       = 140

// HEIGHTCATEGORY keys are 101-104 per Angular form-fields logic
const FALLBACK_CATEGORIES: Category[] = [
  { key: '101', label: 'Below average', subtitle: "Shorter than 5'3 ft" },
  { key: '102', label: 'Average',       subtitle: "5'4 - 5'6 ft"        },
  { key: '103', label: 'Above average', subtitle: "5'7 - 5'11 ft"       },
  { key: '104', label: 'Tall',          subtitle: "Greater than 6 ft"    },
]

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
  const [panelVisible,     setPanelVisible]      = useState(false)

  const slideAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('GENDER'),
      getRegValue('HEIGHTCATEGORY'),
      getRegValue('HEIGHT'),
    ]).then(([cb, gender, savedCat, savedHeight]) => {
      const g2 = gender ?? '1'
      setCreatedBy(cb ?? '4')

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

  const possessive = PROFILE_POSSESSIVE[createdBy] ?? 'their'
  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.HEIGHT', 'What is your #PROFILETYPE# height?')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  const hasSelection = selectedCategory !== null || selectedHeight !== null

  // Panel slides in from the right
  const panelTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [PICKER_PANEL_WIDTH, 0],
  })

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!hasSelection || submitting) return
    setSubmitting(true)
    try {
      if (selectedHeight) {
        // Exact height selected — Angular: saves HEIGHT key, clears HEIGHTCATEGORY
        await setRegValues({ HEIGHT: selectedHeight.key, HEIGHTCATEGORY: '' })
      } else {
        // Category selected (101-104) — Angular: saves HEIGHTCATEGORY, clears HEIGHT
        await setRegValues({ HEIGHTCATEGORY: selectedCategory!, HEIGHT: '' })
      }
      navigation.push('onboarding', { pageNo: '38' })
      callPartialRegistrationAPI()
    } catch {
      // Allow retry on next tap
    } finally {
      setSubmitting(false)
    }
  }

  useOnboardingFooter({ nextDisabled: !hasSelection, nextLoading: submitting, onNext: handleNext }, [hasSelection, submitting])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.screen}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{ uri: CDN_PAGE_ICON }}
          style={os.pageIcon}
          contentFit="contain"
        />

        <Text style={os.title}>{title}</Text>

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

      {/* Sticky footer handled globally via useOnboardingFooter */}

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


const styles = StyleSheet.create({
  loader: { marginTop: 48 },

  // Row — negative margin cancels scroll padding so the pink selection bg
  // stretches edge-to-edge (matches Figma full-width highlight).
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    marginHorizontal:  -24,
    paddingHorizontal: 24,
    paddingVertical:   8,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  rowSelected: {
    backgroundColor: Colors.selectionBg,
  },

  rowLabels: { flex: 1 },

  rowLabel: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  rowLabelSelected: {
    fontWeight: '500',
  },

  rowSubtitle: {
    fontSize:   14,
    fontWeight: '400',
    color:      'rgba(0,0,0,0.6)',
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
    borderColor:     Colors.inputBorder,
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

  // Right-side sliding panel (85 % of screen width)
  panelContainer: {
    flex:           1,
    flexDirection:  'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex:            1,
    backgroundColor: Colors.scrimMedium,
  },
  panel: {
    width:           PICKER_PANEL_WIDTH,
    backgroundColor: Colors.surface,
    elevation:       8,
    shadowColor:     Colors.shadow,
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
    borderBottomColor: Colors.borderSubtle,
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
    color:    Colors.scrimLight,
  },

  // Section header inside SectionList (Short / Average Height / Tall)
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical:   8,
    backgroundColor:   Colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
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
    borderBottomColor: Colors.surfaceDim,
  },
  heightItemSelected: {
    backgroundColor: Colors.selectionBg,
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
