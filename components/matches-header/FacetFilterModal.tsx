// "View more" facet refinement modal — explore-by-category mode only.
// Angular: matches.page.ts openQuickFilter() opens FilterComponent with
// action="QUICKFILTER", listing ALL facets (not just the first 3 shown inline)
// with checkboxes; on dismiss, checked facets are joined with '~' into QSEARCH
// via pillFilter() (matches.page.ts:1952-1988).
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import type { ExploreFacet } from '../../service/homeService'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'

export interface FacetFilterModalProps {
  visible:  boolean
  facets:   ExploreFacet[]
  onApply:  (checkedKeys: string[]) => void
  onClose:  () => void
}

export default function FacetFilterModal({ visible, facets, onApply, onClose }: FacetFilterModalProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  // Local draft state — Angular's modal also only commits on "Apply", not per-tap
  const [draft, setDraft] = useState<Record<string, boolean>>({})

  // Reset the draft to the live checked state each time the modal opens
  if (visible && Object.keys(draft).length === 0 && facets.some(f => f.checked)) {
    const initial: Record<string, boolean> = {}
    facets.forEach(f => { initial[f.key] = f.checked })
    setDraft(initial)
  }

  function toggle(key: string) {
    setDraft(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleApply() {
    const checkedKeys = facets.filter(f => draft[f.key] ?? f.checked).map(f => f.key)
    onApply(checkedKeys)
    setDraft({})
  }

  function handleClose() {
    setDraft({})
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={m.overlay} onPress={handleClose}>
        <Pressable style={[m.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
          <View style={m.header}>
            <Text style={m.title}>{t('SEARCH.FILTER_HEADER')}</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text style={m.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView style={m.list} contentContainerStyle={m.listContent}>
            {facets.map(f => {
              const checked = draft[f.key] ?? f.checked
              const disabled = f.count === 0
              return (
                <Pressable
                  key={f.key}
                  style={[m.row, disabled && m.rowDisabled]}
                  onPress={() => !disabled && toggle(f.key)}
                  disabled={disabled}
                >
                  <View style={[m.checkbox, checked && m.checkboxChecked]}>
                    {checked && <Text style={m.checkMark}>✓</Text>}
                  </View>
                  <Text style={m.rowText} numberOfLines={2}>{f.value}</Text>
                </Pressable>
              )
            })}
          </ScrollView>

          <Pressable style={m.applyBtn} onPress={handleApply}>
            <Text style={m.applyText}>{t('SEARCH.SUBMIT')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const m = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor:      Colors.surface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    maxHeight:            '70%',
    paddingTop:           16,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingBottom:     12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  // Angular: filter.component.html QUICKFILTER title — ion-label
  // heading2-semibold-18 (var(--font18)), not font16.
  title: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   FontSize.font18,
    color:      '#000000',
  },
  closeText: {
    fontSize:   24,
    color:      Colors.textSecondary,
    lineHeight: 24,
  },
  list:        { flexGrow: 0 },
  listContent: { paddingHorizontal: 20, paddingVertical: 8 },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingVertical:   12,
  },
  rowDisabled: { opacity: 0.4 },
  checkbox: {
    width:           20,
    height:          20,
    borderRadius:    4,
    borderWidth:     1.5,
    borderColor:     Colors.inputBorder,
    alignItems:      'center',
    justifyContent:  'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primaryDark,
    borderColor:     Colors.primaryDark,
  },
  checkMark: {
    color:      Colors.white,
    fontSize:   13,
    lineHeight: 15,
  },
  // Angular: filter.component.html ion-label body2-regular-14 → var(--font14)
  rowText: {
    flex:       1,
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   FontSize.font14,
    color:      '#000000',
  },
  applyBtn: {
    marginHorizontal: 20,
    marginTop:        12,
    height:           48,
    borderRadius:     8,
    backgroundColor:  Colors.primaryDark,
    alignItems:       'center',
    justifyContent:   'center',
  },
  applyText: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium,
    fontSize:   15,
    color:      Colors.white,
  },
})
