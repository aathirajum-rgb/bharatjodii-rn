import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_REVAMP } from '../../constants/cdn'
import { PICKER_ITEM_HEIGHT, PICKER_PANEL_WIDTH } from '../../constants/registration.constants'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// Angular: right-side-panel.component.html:6 — close-icon-gray.svg
const CDN_CLOSE_ICON = CDN_REVAMP + 'close-icon-gray.svg'

// Removes the browser's default black focus outline on web — TextInput renders
// as <input> there, and without this the outline shows as a black rectangle
// around the search box on focus. Same fix as NameScreen.tsx/DOBScreen.tsx.
const webOutlineReset = { outlineStyle: 'none', outlineWidth: 0 } as any

export type PickerOption = { key: string; label: string }

type Props = {
  visible:      boolean
  title:        string
  placeholder:  string
  options:      PickerOption[]
  selectedKey:  string | null | undefined
  onSelect:     (opt: PickerOption) => void
  onClose:      () => void
  // Angular: registration.config.ts LISTDATA.ISSHOWSEARCHBAR — some option
  // lists (e.g. occupation's short, fixed set) opt out of the search box.
  hideSearch?:  boolean
}

export default function SearchablePicker({
  visible, title, placeholder, options, selectedKey, onSelect, onClose, hideSearch,
}: Props) {
  const { t }     = useTranslation()
  const insets    = useSafeAreaInsets()
  const langFonts = useLanguageFonts()
  const slideAnim = useRef(new Animated.Value(0)).current
  // Same animated-scrim pattern as DOBScreen's age sheet / HeightScreen's
  // exact-height panel — the dim behind the panel fades in/out alongside the
  // slide, instead of a static Pressable whose opaque background can flash/
  // clip against the Modal's own web-polyfill container mid-transform.
  const scrimAnim = useRef(new Animated.Value(0)).current

  // Keeps the Modal mounted through the closing animation — same
  // ageModalMounted/showAgeSheet split DOBScreen's age sheet uses, so the
  // panel actually slides out instead of the Modal unmounting it instantly.
  const [mounted, setMounted] = useState(false)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    if (visible) {
      setSearch('')
      setMounted(true)
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(scrimAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  const panelTranslateX = slideAnim.interpolate({
    inputRange: [0, 1], outputRange: [PICKER_PANEL_WIDTH, 0],
  })

  function handleClose() {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 230, useNativeDriver: true }),
      Animated.timing(scrimAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false)
      onClose()
    })
  }

  function handleSelect(opt: PickerOption) {
    onSelect(opt)
    handleClose()
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, search])

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Animated scrim — pointer-events none so it doesn't block the
            TouchableWithoutFeedback below. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: Colors.black, opacity: scrimAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
          ]}
          pointerEvents="none"
        />

        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.panel,
            {
              paddingBottom: Platform.OS === 'ios' ? insets.bottom : 16,
              transform: [{ translateX: panelTranslateX }],
            },
          ]}
        >
          {/* Angular: right-side-panel.component.html:5-14 — the close icon
              sits alone on its own top row, with the title as a separate
              block below it (no shared row, no border under the title). */}
          <View style={styles.closeRow}>
            <TouchableOpacity onPress={handleClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <CdnSvg uri={CDN_CLOSE_ICON} width={24} height={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.titleRow}>
            <Text style={[styles.headerTitle, { fontFamily: langFonts.medium }]}>{title}</Text>
          </View>

          {!hideSearch && (
            <View style={styles.searchBox}>
              <TextInput
                style={[styles.searchInput, { fontFamily: langFonts.medium }, webOutlineReset]}
                placeholder={placeholder}
                placeholderTextColor={Colors.scrimSubtle}
                value={search}
                onChangeText={setSearch}
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
          )}

          {filtered.length === 0 ? (
            <View style={styles.emptyBox}>
              {/* Angular: SEARCH.SEARCH_NO_RESULTS */}
              <Text style={[styles.emptyText, { fontFamily: langFonts.regular }]}>
                {t('SEARCH.SEARCH_NO_RESULTS', 'No results found. Try again')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.key}
              getItemLayout={(_, index) => ({
                length: PICKER_ITEM_HEIGHT, offset: PICKER_ITEM_HEIGHT * index, index,
              })}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.key === selectedKey
                return (
                  <Pressable
                    style={[styles.item, isSelected && styles.itemSelected]}
                    onPress={() => handleSelect(item)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.itemText, { fontFamily: langFonts.regular }]}>
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
  )
}

const styles = StyleSheet.create({
  container: {
    flex:           1,
    flexDirection:  'row',
    justifyContent: 'flex-end',
  },
  panel: {
    width:           PICKER_PANEL_WIDTH,
    backgroundColor: Colors.surface,
    elevation:       8,
    shadowColor:     Colors.shadow,
    shadowOpacity:   0.2,
    shadowOffset:    { width: -2, height: 0 },
    shadowRadius:    8,
    // Clips header/search/list text to the panel's bounds — without this,
    // the sliding transform could let text render a hair past the left edge
    // mid-animation instead of staying flush inside the sheet.
    overflow:        'hidden',
  },
  // Angular: right-side-panel.component.html:5 — close icon alone, top-right,
  // pr-16 pt-24 (no border, no shared row with the title).
  closeRow: {
    flexDirection:     'row',
    justifyContent:    'flex-end',
    paddingRight:      16,
    paddingTop:        24,
  },
  // Angular: right-side-panel.component.html:11 — pl-16 pr-16 mb-24
  titleRow: {
    paddingHorizontal: 16,
    marginBottom:      24,
  },
  // Angular: heading4-medium-16 (right-side-panel.component.html:12) —
  // Poppins-Medium, 500, 16px (global.scss:2217-2221)
  headerTitle: {
    fontSize:   16,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  // Border stays a static grey (Colors.borderSubtle) whether or not the
  // search input is focused — no accent-color change on focus.
  searchBox: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  16,
    marginVertical:    12,
    height:            40,
    borderWidth:       1,
    borderColor:       Colors.borderSubtle,
    borderRadius:      8,
    paddingHorizontal: 10,
    gap:               8,
    backgroundColor:   Colors.surface,
  },
  // Angular: body1-medium-14 (right-side-panel.component.html:20) — Poppins-Medium
  searchInput:      { flex: 1, fontSize: 14, color: Colors.textPrimary, padding: 0 },
  searchClear:      { fontSize: 13, color: Colors.scrimLight, padding: 2 },
  emptyBox:         { padding: 32, alignItems: 'center' },
  emptyText:        { fontSize: 14, color: Colors.scrimLight },
  item: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    height:            PICKER_ITEM_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceDim,
  },
  itemSelected:     { backgroundColor: Colors.radioCheckedBg },
  // Angular: body2-regular-14 (right-side-panel.component.html:41) — Poppins-Regular
  itemText:         { flex: 1, fontSize: 14, fontWeight: '400', color: Colors.textPrimary },
})
