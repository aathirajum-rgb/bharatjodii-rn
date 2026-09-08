import { useEffect, useMemo, useRef, useState } from 'react'
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
import { Colors } from '../../constants/colors'
import { CDN_REVAMP } from '../../constants/cdn'
import CdnSvg from '../cdn-svg/CdnSvg'
import { PICKER_PANEL_WIDTH } from '../../constants/registration.constants'
import CheckboxGroup, { type CheckboxOption } from '../checkbox/CheckboxGroup'
import type { OptionGroup } from '../../service/registrationService'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// Multi-select sibling of SearchablePicker — mirrors Angular's right-side-panel
// checkbox mode (search box + checkbox list + Apply button), used for filter
// facets where more than one value can be selected (Religion, Caste, Mother
// Tongue, etc). '0' is the "Any" sentinel key — selecting it clears everything
// else, and selecting anything else clears '0' (Angular: showAnyOption).

// Angular: right-side-panel.component.html:6 — revamp-img/close-icon-gray.svg,
// the same asset SearchablePicker uses. Was a literal "✕" text glyph, which
// rendered in the system font rather than as the brand icon.
const CDN_CLOSE_ICON = CDN_REVAMP + 'close-icon-gray.svg'

// Group heading rows share the checkbox list with their children, so their key
// is namespaced to keep it distinct from any option key.
const GROUP_ROW_PREFIX = '__group__'

export type MultiSelectOption = { key: string; label: string }

type Props = {
  visible:      boolean
  title:        string
  placeholder?: string | undefined   // omit to hide the search box
  options:      MultiSelectOption[]
  // Grouped mode (Angular's `type: 'parent'`/`'child'` rows — a country over
  // its states, a state over its districts). When given, `options` is ignored
  // and each group renders a heading row whose checkbox selects the whole
  // group. Only the CHILD keys are ever selected/applied.
  groups?:      OptionGroup[] | undefined
  selectedKeys: string[]
  anyLabel?:    string | undefined   // omit to hide the "Any" row
  onApply:      (keys: string[]) => void
  onClose:      () => void
}

export default function MultiSelectPicker({
  visible, title, placeholder, options, groups, selectedKeys, anyLabel, onApply, onClose,
}: Props) {
  const insets    = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(0)).current
  // Same approach SearchablePicker (this panel's single-select sibling) takes:
  // the option labels and title are server-translated, so the family has to
  // follow the current language rather than being baked into the StyleSheet.
  const langFonts = useLanguageFonts()
  // Backdrop: same animated scrim SearchablePicker (this panel's single-select
  // sibling, used by Age/Height) already has — it fades in/out alongside the
  // slide and covers the FULL screen. This panel previously used a static
  // `Colors.scrimMedium` <Pressable> sized `flex: 1`, so every field other
  // than Age/Height got a lighter dim that popped in and out with no
  // transition, and only over the strip beside the panel.
  const scrimAnim = useRef(new Animated.Value(0)).current

  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<string[]>(selectedKeys)
  // Keeps the Modal mounted through the CLOSING animation, so the scrim can
  // actually fade out instead of being torn down on the first frame when a
  // parent flips `visible` off without going through handleClose.
  const [mounted,  setMounted]  = useState(false)

  useEffect(() => {
    if (visible) {
      setSearch('')
      setSelected(selectedKeys)
      setMounted(true)
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(scrimAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Nothing ticked — not even the "Any" row — so there is nothing to apply.
  // ('0' present IS a selection: it's the explicit "Any" answer.)
  const applyDisabled = selected.length === 0

  function handleApply() {
    if (applyDisabled) return
    onApply(selected)
    handleClose()
  }

  function toggle(key: string, checked: boolean) {
    if (key.startsWith(GROUP_ROW_PREFIX)) {
      toggleGroup(key.slice(GROUP_ROW_PREFIX.length), checked)
      return
    }
    if (key === '0') {
      setSelected(checked ? ['0'] : [])
      return
    }
    setSelected(prev => {
      // Every row reads as checked while "Any" is on (see checkboxOptions), so
      // the checkbox hands us `false` for the first tap out of that state. A
      // tap there starts a fresh single selection rather than removing
      // anything — Angular: clickOnCheckboxBtn emits `isCheckAnyOption: false`
      // with that item as the selection.
      if (prev.includes('0')) return [key]
      const withoutAny = prev.filter(k => k !== '0')
      return checked ? [...withoutAny, key] : withoutAny.filter(k => k !== key)
    })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, search])

  // Grouped mode: search filters CHILDREN, and a group with no match drops out
  // heading and all (Angular's own grouped branch does the same).
  const filteredGroups = useMemo(() => {
    if (!groups) return []
    const q = search.trim().toLowerCase()
    return groups
      .map(g => ({
        ...g,
        options: q ? g.options.filter(o => o.label.toLowerCase().includes(q)) : g.options,
      }))
      .filter(g => g.options.length > 0)
  }, [groups, search])

  // Angular's isParentChecked(): a heading ticks only when EVERY child is
  // selected, and toggling it selects or clears that whole group.
  function toggleGroup(groupKey: string, checked: boolean) {
    const group = (groups ?? []).find(g => g.key === groupKey)
    if (!group) return
    const childKeys = group.options.map(o => o.key)
    setSelected(prev => {
      const withoutAny = prev.filter(k => k !== '0')
      // Coming out of "Any" every row reads as checked, so the first tap on a
      // heading is a select, not a clear (same rule as an individual row).
      if (prev.includes('0')) return childKeys
      const kept = withoutAny.filter(k => !childKeys.includes(k))
      return checked ? [...kept, ...childKeys] : kept
    })
  }

  const checkboxOptions: CheckboxOption[] = useMemo(() => {
    // Angular builds every row's checkbox as
    //   isCheckedBox = selectedObj[0] === '0' ? 0 : selectedObj.indexOf(key)
    //   item.checked = isCheckedBox > -1
    // (filter-popup.component.ts's getArrayData / getSearchObjList) — so while
    // the field sits on the "Any" sentinel EVERY row is ticked, not just the
    // Any row. This ticked only the Any row.
    //
    // The pink row background stays off in that state though: Angular's
    // `filter-selected-bg` is `item.checked && !isCheckAnyOption`, i.e. it
    // marks a real selection, so `highlighted` is passed separately.
    const anySelected = selected.includes('0')
    const rows: CheckboxOption[] = []
    if (anyLabel) rows.push({ key: '0', value: anyLabel, checked: anySelected, highlighted: anySelected })

    const childRow = (o: MultiSelectOption): CheckboxOption => ({
      key:         o.key,
      value:       o.label,
      checked:     anySelected || selected.includes(o.key),
      highlighted: !anySelected && selected.includes(o.key),
    })

    if (groups) {
      filteredGroups.forEach(g => {
        const allChecked = g.options.length > 0
          && g.options.every(o => anySelected || selected.includes(o.key))
        const someChecked = !anySelected && g.options.some(o => selected.includes(o.key))
        rows.push({
          // Prefixed so a group key can't collide with a child key.
          key:           `${GROUP_ROW_PREFIX}${g.key}`,
          value:         g.label,
          checked:       allChecked,
          highlighted:   allChecked || someChecked,
          parent:        true,
          indeterminate: someChecked && !allChecked,
        })
        g.options.forEach(o => rows.push(childRow(o)))
      })
      return rows
    }

    filtered.forEach(o => rows.push(childRow(o)))
    return rows
  }, [filtered, filteredGroups, groups, selected, anyLabel])

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
              // statusBarTranslucent draws this Modal behind the status bar/
              // notch — without an explicit top inset here, the panel's close
              // icon/header sat under it. Same fix as SearchablePicker.tsx.
              paddingTop:    insets.top,
              paddingBottom: Platform.OS === 'ios' ? insets.bottom : 16,
              transform: [{ translateX: panelTranslateX }],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { fontFamily: langFonts.medium }]}>{title}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <CdnSvg uri={CDN_CLOSE_ICON} width={24} height={24} />
            </TouchableOpacity>
          </View>

          {!!placeholder && (
            <View style={styles.searchBox}>
              <TextInput
                style={[styles.searchInput, { fontFamily: langFonts.medium }]}
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

          {checkboxOptions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, { fontFamily: langFonts.regular }]}>No results found</Text>
            </View>
          ) : (
            <FlatList
              data={checkboxOptions}
              keyExtractor={item => item.key}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={() => null}
              ListHeaderComponent={
                <CheckboxGroup options={checkboxOptions} onToggle={toggle} />
              }
            />
          )}

          {/* Angular: `[isDisabled]="enableApplyCta"` with
              `(click)="enableApplyCta ? '' : clicksOnApplyCTA()"`, where
              enableDisableApplyCta() leaves the CTA enabled only while
              `isCheckSubOption || isCheckAnyOption` — i.e. something is ticked,
              the "Any" row counting as something. Nothing ticked, no Apply. */}
          <Pressable
            style={[styles.applyBtn, applyDisabled && styles.applyBtnDisabled]}
            onPress={handleApply}
            disabled={applyDisabled}
          >
            <Text style={[
              styles.applyText,
              applyDisabled && styles.applyTextDisabled,
              { fontFamily: langFonts.regular },
            ]}>Apply</Text>
          </Pressable>
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
    // Same clip SearchablePicker's panel has: without it the sliding
    // transform can let header/list text render a hair past the left edge
    // mid-animation instead of staying flush inside the sheet.
    overflow:        'hidden',
    shadowRadius:    8,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  // Angular right-side-panel.component.html:12 — the panel title is
  // `heading4-medium-16` (16px / Poppins-Medium / 500), same as
  // SearchablePicker's. Was a system-font 600, one step too heavy.
  headerTitle: {
    flex:       1,
    fontSize:   16,
    color:      Colors.textPrimary,
  },
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
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, padding: 0 },
  searchClear: { fontSize: 13, color: Colors.scrimLight, padding: 2 },
  emptyBox:    { padding: 32, alignItems: 'center' },
  emptyText:   { fontSize: 14, color: Colors.scrimLight },
  applyBtn: {
    marginHorizontal: 16,
    marginTop:        12,
    height:           48,
    borderRadius:     8,
    backgroundColor:  Colors.primaryDark,
    alignItems:       'center',
    justifyContent:   'center',
  },
  // Angular's disabled button-revamp: `--ion-color-e6e6e6-color` #e6e6e6 fill
  // with `--ion-color-darkgrey-color` #8A8A8A text (theme/variables.scss).
  applyBtnDisabled:  { backgroundColor: '#e6e6e6' },
  applyTextDisabled: { color: '#8A8A8A' },
  // Angular: the panel's Apply is a button-revamp with no ctaFontSize override,
  // so it inherits `body2-regular-14` + `line-height-16` — Poppins-Regular 14,
  // not a 600 weight.
  applyText: {
    color:      Colors.white,
    fontSize:   14,
    lineHeight: 16,
  },
})
