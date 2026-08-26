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

// Angular: right-side-panel.component.html's *ngIf="ISGROUPED" branch (JODII-490
// education detail) — a bold EDUCATIONCATEGORY title over each group of options,
// instead of one flat list. `title: null` renders no heading for that group
// (Angular: *ngIf="group?.title").
export type PickerSection = { title: string | null; options: PickerOption[] }

type Props = {
  visible:      boolean
  title:        string
  placeholder:  string
  // Either a flat list (options) or grouped sections (groups) — exactly one
  // should be passed. Search filters within each group's options either way.
  options?:     PickerOption[]
  groups?:      PickerSection[]
  selectedKey:  string | null | undefined
  onSelect:     (opt: PickerOption) => void
  onClose:      () => void
  // Angular: registration.config.ts LISTDATA.ISSHOWSEARCHBAR — some option
  // lists (e.g. occupation's short, fixed set) opt out of the search box.
  hideSearch?:  boolean
}

// Flattened row type FlatList renders — either a section header or an option,
// discriminated by `type`. Lets one FlatList render both flat and grouped data.
type Row =
  | { type: 'header'; key: string; title: string }
  | { type: 'option'; key: string; option: PickerOption }

export default function SearchablePicker({
  visible, title, placeholder, options, groups, selectedKey, onSelect, onClose, hideSearch,
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

  // Builds the flat row list FlatList renders. Grouped mode: a 'header' row
  // (skipped when a group's title is null, matching Angular's
  // *ngIf="group?.title") followed by that group's filtered 'option' rows —
  // a group with zero matches after filtering contributes no header either.
  const rows: Row[] = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = (o: PickerOption) => !q || o.label.toLowerCase().includes(q)

    if (groups) {
      const out: Row[] = []
      groups.forEach((group, gi) => {
        const opts = group.options.filter(matches)
        if (opts.length === 0) return
        if (group.title) out.push({ type: 'header', key: `h-${gi}`, title: group.title })
        opts.forEach(o => out.push({ type: 'option', key: o.key, option: o }))
      })
      return out
    }

    return (options ?? []).filter(matches).map(o => ({ type: 'option', key: o.key, option: o }))
  }, [options, groups, search])

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

          {rows.length === 0 ? (
            <View style={styles.emptyBox}>
              {/* Angular: SEARCH.SEARCH_NO_RESULTS */}
              <Text style={[styles.emptyText, { fontFamily: langFonts.regular }]}>
                {t('SEARCH.SEARCH_NO_RESULTS', 'No results found. Try again')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(row) => row.key}
              // Header rows are a different height than option rows, so a
              // fixed-height getItemLayout only holds up in flat (ungrouped) mode.
              getItemLayout={groups ? undefined : (_, index) => ({
                length: PICKER_ITEM_HEIGHT, offset: PICKER_ITEM_HEIGHT * index, index,
              })}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: row, index }) => {
                if (row.type === 'header') {
                  // Angular: .grouped-category-heading { margin-top: 24px },
                  // .edu-detail-scroll .grouped-category-heading:first-child
                  // { margin-top: 0 } — bold 14px title, no top gap for the
                  // very first group.
                  return (
                    <View style={[styles.groupHeader, index === 0 && styles.groupHeaderFirst]}>
                      <Text style={[styles.groupHeaderText, { fontFamily: langFonts.bold }]}>
                        {row.title}
                      </Text>
                    </View>
                  )
                }
                const item = row.option
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

  // ── Grouped sections (education detail) ──────────────────────────────────
  // Angular: .grouped-category-heading { margin-top: 24px } / :first-child
  // { margin-top: 0 } / .edu-category-title { font-weight: 700; font-size: 14px }
  groupHeader: {
    paddingHorizontal: 20,
    marginTop:         24,
    paddingVertical:   8,
  },
  groupHeaderFirst: { marginTop: 0 },
  groupHeaderText:  { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
})
