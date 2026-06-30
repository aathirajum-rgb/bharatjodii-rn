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
import { PICKER_ITEM_HEIGHT, PICKER_PANEL_WIDTH } from '../../constants/registration.constants'

export type PickerOption = { key: string; label: string }

type Props = {
  visible:      boolean
  title:        string
  placeholder:  string
  options:      PickerOption[]
  selectedKey:  string | null | undefined
  onSelect:     (opt: PickerOption) => void
  onClose:      () => void
}

export default function SearchablePicker({
  visible, title, placeholder, options, selectedKey, onSelect, onClose,
}: Props) {
  const insets    = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(0)).current

  const [search,        setSearch]        = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  useEffect(() => {
    if (visible) {
      setSearch('')
      setSearchFocused(false)
      Animated.timing(slideAnim, {
        toValue: 1, duration: 280, useNativeDriver: true,
      }).start()
    }
  }, [visible])

  const panelTranslateX = slideAnim.interpolate({
    inputRange: [0, 1], outputRange: [PICKER_PANEL_WIDTH, 0],
  })

  function handleClose() {
    Animated.timing(slideAnim, {
      toValue: 0, duration: 230, useNativeDriver: true,
    }).start(() => onClose())
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

          <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={placeholder}
              placeholderTextColor={Colors.scrimSubtle}
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
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No results found</Text>
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
  searchBoxFocused: { borderColor: Colors.primary },
  searchIcon:       { fontSize: 14 },
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
  itemText:         { flex: 1, fontSize: 14, fontWeight: '400', color: Colors.textPrimary },
  itemTextSelected: { fontWeight: '500', color: Colors.primaryDark },
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
