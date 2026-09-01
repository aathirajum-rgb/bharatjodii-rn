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
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { PICKER_PANEL_WIDTH } from '../../constants/registration.constants'
import CheckboxGroup, { type CheckboxOption } from '../checkbox/CheckboxGroup'

// Multi-select sibling of SearchablePicker — mirrors Angular's right-side-panel
// checkbox mode (search box + checkbox list + Apply button), used for filter
// facets where more than one value can be selected (Religion, Caste, Mother
// Tongue, etc). '0' is the "Any" sentinel key — selecting it clears everything
// else, and selecting anything else clears '0' (Angular: showAnyOption).

export type MultiSelectOption = { key: string; label: string }

type Props = {
  visible:      boolean
  title:        string
  placeholder?: string | undefined   // omit to hide the search box
  options:      MultiSelectOption[]
  selectedKeys: string[]
  anyLabel?:    string | undefined   // omit to hide the "Any" row
  onApply:      (keys: string[]) => void
  onClose:      () => void
}

export default function MultiSelectPicker({
  visible, title, placeholder, options, selectedKeys, anyLabel, onApply, onClose,
}: Props) {
  const insets    = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(0)).current

  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<string[]>(selectedKeys)

  useEffect(() => {
    if (visible) {
      setSearch('')
      setSelected(selectedKeys)
      Animated.timing(slideAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const panelTranslateX = slideAnim.interpolate({
    inputRange: [0, 1], outputRange: [PICKER_PANEL_WIDTH, 0],
  })

  function handleClose() {
    Animated.timing(slideAnim, { toValue: 0, duration: 230, useNativeDriver: true }).start(() => onClose())
  }

  function handleApply() {
    onApply(selected)
    handleClose()
  }

  function toggle(key: string, checked: boolean) {
    if (key === '0') {
      setSelected(checked ? ['0'] : [])
      return
    }
    setSelected(prev => {
      const withoutAny = prev.filter(k => k !== '0')
      return checked ? [...withoutAny, key] : withoutAny.filter(k => k !== key)
    })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, search])

  const checkboxOptions: CheckboxOption[] = useMemo(() => {
    const rows: CheckboxOption[] = []
    if (anyLabel) rows.push({ key: '0', value: anyLabel, checked: selected.includes('0') })
    filtered.forEach(o => rows.push({ key: o.key, value: o.label, checked: selected.includes(o.key) }))
    return rows
  }, [filtered, selected, anyLabel])

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={handleClose} />

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
            <Text style={styles.headerTitle}>{title}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8}>
              <Text style={styles.headerClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {!!placeholder && (
            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
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
              <Text style={styles.emptyText}>No results found</Text>
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

          <Pressable style={styles.applyBtn} onPress={handleApply}>
            <Text style={styles.applyText}>Apply</Text>
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
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headerTitle: {
    flex:       1,
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
  headerClose: {
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
  applyText: {
    color:      Colors.white,
    fontSize:   14,
    fontWeight: '600',
  },
})
