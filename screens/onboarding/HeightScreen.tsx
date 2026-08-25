import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { SvgXml } from 'react-native-svg'
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
import { CDN_REG, CDN_SVG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { Fonts, FontsByLanguage } from '../../src/theme/fonts'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import i18n from '../../i18n'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON  = CDN_REG + 'son-height.svg'
const FOOTER_H       = 140
// Same OR-divider image assets as DOBScreen (revamp/or-left-side.svg,
// revamp/or-right-side.svg) — HeightScreen previously drew plain colored
// lines instead of reusing this design.
const CDN_OR_LEFT  = CDN_SVG + 'revamp/or-left-side.svg'
const CDN_OR_RIGHT = CDN_SVG + 'revamp/or-right-side.svg'
// Angular's right-side-panel.component.scss .right-popup { width: 86.7% } —
// this screen's panel uses that exact value, not the shared 85% most other
// onboarding pickers use (PICKER_PANEL_WIDTH in registration.constants.ts).
const HEIGHT_PANEL_WIDTH = Dimensions.get('window').width * 0.867

// Angular's dropdown-field arrow is Ionic's "chevron-forward-outline" icon —
// not a CDN-hosted image but a bundled Ionicons SVG (node_modules/ionicons/
// dist/svg/chevron-forward-outline.svg), colored via its "black-color" CSS
// class. Inlined here verbatim (stroke swapped from currentColor to a fixed
// black, since SvgXml doesn't inherit CSS color) for a pixel-exact match —
// same icon used on MotherTongueScreen's "select mother tongue" field.
const CHEVRON_FORWARD_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M184 112l144 144-144 144"/></svg>`

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

// The live category API returns the subtitle as an inline HTML tag inside the
// main label — e.g. `Below average <div class="height-revamp-text-small mt-4
// opacity-6" slot="end"> Shorter than 5 feet 3 Inches</div>` — rendered as real
// HTML by Angular's [innerHTML] binding. Extract that inner tag's text as the
// subtitle and strip all tags from the rest to get the plain label. Falls back
// to '~'-delimited splitting (GetArrayListfrmObjwithTilde, common-funtions.ts:
// 145-150) when the value has no HTML tags at all.
function parseCategoryLabel(raw: string): { label: string; subtitle: string } {
  const tagMatch = raw.match(/<([a-zA-Z]+)[^>]*>([\s\S]*?)<\/\1>/)
  if (tagMatch) {
    const subtitle = tagMatch[2].replace(/<[^>]+>/g, '').trim()
    const label = raw
      .slice(0, tagMatch.index)
      .replace(/<[^>]+>/g, '')
      .trim()
    return { label, subtitle }
  }
  const [label = '', subtitle = ''] = raw.split('~')
  return { label: label.trim(), subtitle: subtitle.trim() }
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
  // Keeps the Modal mounted through the closing animation — same
  // ageModalMounted/showAgeSheet split DOBScreen's age sheet uses, so the
  // panel actually slides out instead of the Modal unmounting it instantly.
  const [panelMounted,     setPanelMounted]      = useState(false)

  const slideAnim = useRef(new Animated.Value(0)).current
  // Same animated-scrim pattern as DOBScreen's age sheet / BottomSheet.tsx —
  // the dim behind the panel fades in/out alongside the slide, instead of a
  // static Pressable whose opaque background can flash/clip against the
  // Modal's own web-polyfill container while the panel is still mid-transform.
  const scrimAnim = useRef(new Animated.Value(0)).current

  // Extracted so a language change can re-run it — the option labels below are
  // server-translated. Angular: handleLanguageChange() → runInitialDataPopulation()
  // → getRegistrationDynamicArray(true, 1), then assignRegistrationData() re-resolves
  // the stored KEY against the newly translated list. Re-reading storage here does
  // the same, so the user's selection survives the switch.
  function loadOptions() {
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
        // Split each category's label into its main text + subtitle
        const cats: Category[] = rawCats.length
          ? rawCats.map((opt: Option) => {
              const { label, subtitle } = parseCategoryLabel(opt.label)
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
  }

  useEffect(() => { loadOptions() }, [])

  useLanguageReload(loadOptions)

  // ─── Panel open/close ─────────────────────────────────────────────────────

  function openPanel() {
    setPanelMounted(true)
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(scrimAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
  }

  function closePanel() {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 230, useNativeDriver: true }),
      Animated.timing(scrimAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setPanelMounted(false)
    })
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

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.HEIGHT', 'What is your #PROFILETYPE# height?')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  // Angular: REGISTRATION.HEIGHTLINKTXT ("I know my #PROFILETYPE# exact height")
  // — the "select exact height" field's placeholder text.
  const linkText = t('REGISTRATION.HEIGHTLINKTXT', 'I know my #PROFILETYPE# exact height')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  // Angular: REGISTRATION.EXACTHEIGHT ("Select your #PROFILETYPE# height")
  // — the right-side panel's header title.
  const panelTitleText = t('REGISTRATION.EXACTHEIGHT', 'Select your #PROFILETYPE# height')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  // Angular: GENERAL.OR (registration-revamp.component.html:64/324)
  const orText = t('GENERAL.OR', 'OR')
  // Angular's right-side-panel shows a spinner (app-loader), not text, while
  // DATALIST.length == 0 — but SearchablePicker.tsx uses the app's real
  // SEARCH.SEARCH_NO_RESULTS copy for this same "nothing to show" case, so
  // this panel matches that established i18n string instead of a hardcoded one.
  const noHeightsText = t('SEARCH.SEARCH_NO_RESULTS', 'No results found. Try again')
  const hasSelection = selectedCategory !== null || selectedHeight !== null

  // Poppins for English, the matching NotoSans script for every other
  // language (e.g. NotoSansTelugu for Telugu) — same per-language family
  // lookup LanguageSelectionScreen uses, applied here since these category
  // labels are server-translated and can be in any supported language.
  const langFonts = FontsByLanguage[i18n.language] ?? FontsByLanguage.en

  // Panel slides in from the right
  const panelTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [HEIGHT_PANEL_WIDTH, 0],
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
            {/* "Select exact height" field — Angular: REGISTRATION.HEIGHTLINKTXT
                ("I know my #PROFILETYPE# exact height"), not a hardcoded
                "Select ... exact height". Once an exact height is chosen, a
                floating "Height" label (REGISTRATION.HEIGHTLABEL) appears above
                the border, same pattern as the floating field labels on
                DOBScreen/NameScreen — Angular only shows this label when the
                stored value is an exact height, not a category (101-104). */}
            <View style={styles.exactFieldWrapper}>
              {!!selectedHeight && (
                <View style={styles.exactFieldLabel} pointerEvents="none">
                  <Text style={styles.exactFieldLabelText}>
                    {t('REGISTRATION.HEIGHTLABEL', 'Height')}
                  </Text>
                </View>
              )}
              <Pressable
                style={styles.exactField}
                onPress={openPanel}
                accessibilityRole="button"
              >
                <Text style={styles.exactFieldText} numberOfLines={1}>
                  {selectedHeight
                    ? selectedHeight.label
                    : linkText}
                </Text>
                <SvgXml xml={CHEVRON_FORWARD_XML} width={24} height={24} />
              </Pressable>
            </View>

            {/* OR divider — same left/right fade image design as DOBScreen,
                instead of the plain colored lines this screen drew before. */}
            <View style={styles.orRow}>
              <Image source={{ uri: CDN_OR_LEFT }} style={styles.orLine} contentFit="contain" />
              <Text style={styles.orText}>{orText}</Text>
              <Image source={{ uri: CDN_OR_RIGHT }} style={styles.orLine} contentFit="contain" />
            </View>

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
                    <Text style={[styles.rowLabel, { fontFamily: langFonts.medium }]}>
                      {cat.label}
                    </Text>
                    {!!cat.subtitle && (
                      <Text style={[styles.rowSubtitle, { fontFamily: langFonts.regular }]}>
                        {cat.subtitle}
                      </Text>
                    )}
                  </View>

                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </Pressable>
              )
            })}
          </>
        )}
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}

      {/* Exact height picker — right-side sliding panel. Same animated-scrim
          pattern as DOBScreen's age bottom sheet: the Modal stays mounted
          through the close animation (panelMounted, not panelVisible), and
          the dim behind the panel fades via an Animated.View rather than a
          static Pressable, which is what caused the panel to feel abrupt and
          leave a stray dim rectangle when closing on web. */}
      <Modal
        transparent
        visible={panelMounted}
        animationType="none"
        onRequestClose={closePanel}
        statusBarTranslucent
      >
        <View style={styles.panelContainer}>
          {/* Animated scrim — pointer-events none so it doesn't block the
              TouchableWithoutFeedback below. */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: Colors.black, opacity: scrimAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
            ]}
            pointerEvents="none"
          />

          <TouchableWithoutFeedback onPress={closePanel}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

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
            {/* Panel header — Angular: REGISTRATION.EXACTHEIGHT */}
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>{panelTitleText}</Text>
              <TouchableOpacity onPress={closePanel} hitSlop={8}>
                <Text style={styles.panelCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            {heightGroups.length === 0 ? (
              <View style={styles.panelEmpty}>
                <Text style={styles.panelEmptyText}>{noHeightsText}</Text>
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
                      {/* Angular hides the radio control in this list entirely
                          (.exact-height ion-item ion-radio { display: none })
                          — selection is shown only via the row's background tint. */}
                      <Text style={[styles.heightItemText, isSelected && styles.heightItemTextSelected]}>
                        {item.label}
                      </Text>
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

  // Angular: body1-medium-14 (radio.component.html, TYPE=type-2) — weight stays
  // constant on selection (only the row background + radio dot change); the
  // fontFamily itself is set inline per the app's current language.
  rowLabel: {
    fontSize:   14,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },

  // Angular: body2-regular-14 (radio.component.html)
  rowSubtitle: {
    fontSize:   13,
    fontWeight: '400',
    color:      'rgba(0,0,0,0.6)',
    marginTop:  2,
  },

  // Radio — 22×22 unfilled ring; selection shows as a filled pink dot inside,
  // not a checkmark, matching Angular's ion-radio control (radio.component.html).
  radio: {
    width:           22,
    height:          22,
    borderRadius:    11,
    borderWidth:     1.5,
    borderColor:     '#8A8A8A',
    alignItems:      'center',
    justifyContent:  'center',
  },
  radioSelected: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.surface,
  },
  radioDot: {
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: Colors.primaryDark,
  },

  // OR divider — same left/right fade image assets + text style as DOBScreen
  orRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     20,
    marginBottom:  16,
  },
  orLine: {
    flex:    1,
    height:  8,
    opacity: 20,
  },
  // Angular: body2-regular-14 (registration-revamp.component.html:64) — Poppins-Regular
  orText: {
    fontFamily:       Fonts.poppinsRegular,
    fontSize:         14,
    color:            Colors.textPrimary,
    marginHorizontal: 16,
  },

  // "Select exact height" outlined field + floating "Height" label —
  // Angular only shows the floating label once an exact height (not a
  // category) is stored (enablePlaceHolder(), registration-revamp.component.ts:2743-2751).
  exactFieldWrapper: {
    position:  'relative',
    marginTop: 8,
  },
  exactFieldLabel: {
    position:          'absolute',
    top:               -8,
    left:              12,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
    zIndex:            10,
  },
  // Angular: body3-regular-12 (registration-revamp.component.html:54-55) — Poppins-Regular
  exactFieldLabelText: {
    fontFamily: Fonts.poppinsRegular,
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
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
  // Angular: body2-regular-14, static weight — never bolds on selection
  // (registration-revamp.component.html:51-52) — Poppins-Regular
  exactFieldText: {
    fontFamily: Fonts.poppinsRegular,
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },

  // Right-side sliding panel (Angular right-side-panel.component.scss: width 86.7%)
  panelContainer: {
    flex:           1,
    flexDirection:  'row',
    justifyContent: 'flex-end',
  },
  panel: {
    width:           HEIGHT_PANEL_WIDTH,
    backgroundColor: Colors.surface,
    elevation:       8,
    shadowColor:     Colors.shadow,
    shadowOpacity:   0.2,
    shadowOffset:    { width: -2, height: 0 },
    shadowRadius:    8,
    // Clips header/section/list text to the panel's bounds — without this,
    // the sliding transform could let text render a hair past the left edge
    // mid-animation instead of staying flush inside the sheet.
    overflow:        'hidden',
  },
  panelHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  // Angular: heading4-medium-16 (right-side-panel.component.html:12) — Poppins-Medium
  panelTitle: {
    fontFamily: Fonts.poppinsMedium,
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

  // Section header inside SectionList (e.g. Below Average / Average / Above Average / Tall)
  // Angular: heading4-medium-16, class "height-heading", background #F0F0F0
  // (right-side-panel.component.html:33-35, .scss:54-57) — Poppins-Medium
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical:   8,
    backgroundColor:   '#F0F0F0',
  },
  sectionHeaderText: {
    fontFamily: Fonts.poppinsMedium,
    fontSize:   16,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },

  // Height list items (inside panel)
  heightItem: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    height:            52,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6E6',
  },
  // Angular: right-side-panel.component.html:39 applies 'filter-selected-bg'
  // on the selected row for the HEIGHT page — #FBF2F5, distinct from the
  // category list's selected bg (Colors.selectionBg / #FFF1F5).
  heightItemSelected: {
    backgroundColor: '#FBF2F5',
  },
  // Angular: body2-regular-14 (right-side-panel.component.html:41) — Poppins-Regular
  heightItemText: {
    fontFamily: Fonts.poppinsRegular,
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
