// New screen — Angular's Age/Height rows (editform/5, /6, /43) each need
// bespoke UI (a 3-dropdown DOB picker + "enter age directly" fallback for
// Age; a category-radio-or-exact-height side panel for Height) far more
// involved than the plain SelectField+SearchablePicker rows the other group
// screens use. BasicDetailsScreen.tsx's own header comment already deferred
// these two fields for exactly this reason. This screen re-implements (not
// imports) the same interaction patterns already proven in
// screens/onboarding/DOBScreen.tsx and screens/onboarding/HeightScreen.tsx,
// wired to editProfileService instead of registration AsyncStorage.
//
// Age save shape (FLAGGED, not confirmed against a live capture): whichever
// entry path is used (full DOB or "enter age directly"), the computed age
// number is sent under FieldKey 'AGE' (TYPE 3) — Angular's edit-profile
// TYPE-code map has no separate code for DATEOFBIRTH. Height is saved under
// whichever of HEIGHT/HEIGHTCATEGORY the user picked (both share TYPE 4,
// mutually exclusive) — never both in the same submit.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Alert, Animated, FlatList, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { fetchEditProfileInfo, submitFieldChanges, type FieldChange } from '../../service/editProfileService'
import {
  fetchHeightCategoryOptions, fetchExactHeightGrouped, type HeightGroup,
} from '../../service/registrationService'
import { PICKER_PANEL_WIDTH } from '../../constants/registration.constants'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import SelectField from '../../components/input/SelectField'
import FieldRestrictedSheet from '../../components/edit-profile/FieldRestrictedSheet'
import { handleBack } from '../../utils/navigationRef'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'
const ITEM_H = 40
const MAX_LIST_ITEMS = 7

type Option   = { key: string; label: string }
type Category = { key: string; label: string; subtitle: string }
type Props    = { navigation: any }
type DateFieldKey = 'date' | 'month' | 'year'
type DropdownPos  = { top: number; left: number; width: number; fieldBottom: number }

const FALLBACK_CATEGORIES: Category[] = [
  { key: '101', label: 'Below average', subtitle: "Shorter than 5'3 ft" },
  { key: '102', label: 'Average',       subtitle: "5'4 - 5'6 ft"        },
  { key: '103', label: 'Above average', subtitle: "5'7 - 5'11 ft"       },
  { key: '104', label: 'Tall',          subtitle: "Greater than 6 ft"    },
]

const MONTHS = [
  { key: '1',  label: 'January'   }, { key: '2',  label: 'February'  },
  { key: '3',  label: 'March'     }, { key: '4',  label: 'April'     },
  { key: '5',  label: 'May'       }, { key: '6',  label: 'June'      },
  { key: '7',  label: 'July'      }, { key: '8',  label: 'August'    },
  { key: '9',  label: 'September' }, { key: '10', label: 'October'   },
  { key: '11', label: 'November'  }, { key: '12', label: 'December'  },
]

function buildYears(): Option[] {
  const max = new Date().getFullYear() - 18
  const min = max - 52
  return Array.from({ length: max - min + 1 }, (_, i) => {
    const y = String(max - i)
    return { key: y, label: y }
  })
}

function getDaysInMonth(month: string, year: string): Option[] {
  const m     = Number(month) || 1
  const y     = Number(year)  || 2000
  const count = new Date(y, m, 0).getDate()
  return Array.from({ length: count }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    return { key: String(i + 1), label: d }
  })
}

function calculateAge(year: string, month: string, date: string): number {
  const today = new Date()
  const dob   = new Date(Number(year), Number(month) - 1, Number(date))
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

// Angular API labels contain HTML: "Below average <span ...>(Shorter than 5'3 ft)</span>"
function parseHtmlLabel(raw: string): { label: string; subtitle: string } {
  const spanMatch = raw.match(/<span[^>]*>([\s\S]*?)<\/span>/i)
  const subtitle  = spanMatch ? spanMatch[1].replace(/<[^>]+>/g, '').trim() : ''
  const label = raw.replace(/<span[^>]*>[\s\S]*?<\/span>/gi, '').replace(/<[^>]+>/g, '').trim()
  return { label, subtitle }
}

const YEARS = buildYears()

export default function EditProfileAgeHeightScreen({ navigation: _navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // ── Age ──
  const [ageEditable, setAgeEditable] = useState(true)
  const [restrictedVisible, setRestrictedVisible] = useState(false)
  const [selDate, setSelDate]   = useState('')
  const [selMonth, setSelMonth] = useState('')
  const [selYear, setSelYear]   = useState('')
  const [directAge, setDirectAge] = useState('')
  const [datePickerField, setDatePickerField] = useState<DateFieldKey | null>(null)
  const [dropdownPos, setDropdownPos] = useState<DropdownPos>({ top: 0, left: 0, width: 94, fieldBottom: 0 })
  const [showAgeSheet, setShowAgeSheet] = useState(false)
  const [ageInput, setAgeInput] = useState('')
  const [ageError, setAgeError] = useState('')

  const dateRef  = useRef<View>(null)
  const monthRef = useRef<View>(null)
  const yearRef  = useRef<View>(null)

  // ── Height ──
  const [categories, setCategories]     = useState<Category[]>([])
  const [heightGroups, setHeightGroups] = useState<HeightGroup[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedHeight, setSelectedHeight]     = useState<Option | null>(null)
  const [heightPanelVisible, setHeightPanelVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(0)).current

  const [original, setOriginal] = useState<{
    age?: string | undefined; height?: string | undefined; heightCategory?: string | undefined
  }>({})

  useEffect(() => {
    (async () => {
      setLoading(true)
      const info = await fetchEditProfileInfo()
      if (!info) { setLoading(false); return }

      setAgeEditable(info.ageEditable)
      setOriginal({ age: info.age, height: info.height, heightCategory: info.heightCategory })

      if (info.dateOfBirth) {
        const p = info.dateOfBirth.split('-')
        if (p.length === 3 && p[0]?.length === 4) {
          setSelYear(p[0]); setSelMonth(String(Number(p[1]))); setSelDate(String(Number(p[2])))
        }
      }
      if (!info.dateOfBirth && info.age) setDirectAge(info.age)

      const gender = info.gender ?? (await getItem(SK.User.LOGIN_GENDER)) ?? '1'
      const [rawCats, groups] = await Promise.all([
        fetchHeightCategoryOptions(gender),
        fetchExactHeightGrouped(gender),
      ])
      const cats: Category[] = rawCats.length
        ? rawCats.map(opt => { const { label, subtitle } = parseHtmlLabel(opt.label); return { key: opt.key, label, subtitle } })
        : FALLBACK_CATEGORIES
      setCategories(cats)
      setHeightGroups(groups)

      if (info.height) {
        const found = groups.flatMap(g => g.data).find(h => h.key === info.height)
        if (found) setSelectedHeight(found)
      } else if (info.heightCategory) {
        setSelectedCategory(info.heightCategory)
      }

      setLoading(false)
    })()
  }, [])

  // ── Age: DOB dropdown ──

  function getDateOptions(field: DateFieldKey) {
    if (field === 'month') return MONTHS
    if (field === 'year')  return YEARS
    return getDaysInMonth(selMonth, selYear)
  }
  function getDateCurrentVal(field: DateFieldKey) {
    if (field === 'date')  return selDate
    if (field === 'month') return selMonth
    return selYear
  }
  function dateRefFor(field: DateFieldKey) {
    if (field === 'date')  return dateRef
    if (field === 'month') return monthRef
    return yearRef
  }
  function openDatePicker(field: DateFieldKey) {
    const ref = dateRefFor(field)
    ref.current?.measureInWindow((x, y, w, h) => {
      const dropW = field === 'month' ? Math.max(w, 130) : w
      setDropdownPos({ top: y, left: x, width: dropW, fieldBottom: y + h })
      setDatePickerField(field)
    })
  }
  function handleDatePickerSelect(field: DateFieldKey, key: string) {
    if (field === 'date') {
      setSelDate(key)
    } else if (field === 'month') {
      setSelMonth(key)
      if (selDate) {
        const days = getDaysInMonth(key, selYear)
        if (Number(selDate) > days.length) setSelDate('')
      }
    } else {
      setSelYear(key)
      if (selDate && selMonth === '2') {
        const days = getDaysInMonth(selMonth, key)
        if (Number(selDate) > days.length) setSelDate('')
      }
    }
    setDatePickerField(null)
    setDirectAge('')
  }

  function handleAgeSubmit() {
    const age = ageInput.trim()
    const ageNum = Number(age)
    if (!age || ageNum < 18 || ageNum > 70) {
      setAgeError('Please enter a valid age (18–70)')
      return
    }
    setDirectAge(age)
    setSelDate(''); setSelMonth(''); setSelYear('')
    setShowAgeSheet(false)
  }

  const isDobComplete = !!(selDate && selMonth && selYear)
  const calculatedAge = isDobComplete ? calculateAge(selYear, selMonth, selDate) : null

  // ── Height ──

  function openHeightPanel() {
    setHeightPanelVisible(true)
    Animated.timing(slideAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start()
  }
  function closeHeightPanel() {
    Animated.timing(slideAnim, { toValue: 0, duration: 230, useNativeDriver: true }).start(() => setHeightPanelVisible(false))
  }
  function selectCategory(key: string) {
    setSelectedCategory(key)
    setSelectedHeight(null)
  }
  function selectExactHeight(option: Option) {
    setSelectedHeight(option)
    setSelectedCategory(null)
    closeHeightPanel()
  }

  const panelTranslateX = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [PICKER_PANEL_WIDTH, 0] })

  // ── Submit ──

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    const changes: FieldChange[] = []

    // Angular (form-fields.component.ts's goToNext()) never gates these calls
    // on "did the value change from the prefill" — EXISTINGVALUE is sent for
    // backend audit only, the update call itself always fires. Matching that
    // here matters specifically for Age: this screen is reached via the
    // server's own "Age still incomplete" signal (page_id 47), so if the
    // prefilled value happens to equal what the user re-confirms, skipping
    // the call would leave the backend's flag never cleared and re-land the
    // user right back on this screen on the next login.
    if (ageEditable) {
      if (isDobComplete) {
        // Angular fires BOTH calls for a completed DOB entry: TYPE=20 (DOB,
        // tilde-joined YEAR~MONTH~DATE) then TYPE=3 (AGE, computed). Sending
        // only AGE (as this screen used to) can leave the backend's
        // DOB-specific completeness check unsatisfied.
        changes.push({ field: 'DOB', value: `${selYear}~${selMonth}~${selDate}`, existingValue: original.age })
        changes.push({ field: 'AGE', value: String(calculatedAge), existingValue: original.age })
      } else if (directAge) {
        changes.push({ field: 'AGE', value: directAge, existingValue: original.age })
      }
    }

    if (selectedHeight) {
      changes.push({ field: 'HEIGHT', value: selectedHeight.key, existingValue: original.height || original.heightCategory })
    } else if (selectedCategory) {
      changes.push({ field: 'HEIGHTCATEGORY', value: selectedCategory, existingValue: original.heightCategory || original.height })
    }

    if (changes.length === 0) {
      setSubmitting(false)
      handleBack()
      return
    }

    const result = await submitFieldChanges(changes)
    setSubmitting(false)

    if (result.failed.length > 0) {
      Alert.alert(
        'Some changes could not be saved',
        `${result.succeeded.length} saved, ${result.failed.length} failed: ${result.failed.join(', ')}`,
      )
      return
    }
    handleBack()
  }

  if (loading) {
    return (
      <View style={[s.screen, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
      </View>
    )
  }

  const datePickerOptions = datePickerField ? getDateOptions(datePickerField) : []
  const datePickerCurrentVal = datePickerField ? getDateCurrentVal(datePickerField) : ''
  const dateListH = Math.min(datePickerOptions.length, MAX_LIST_ITEMS) * ITEM_H
  const dateDropStyle = {
    position: 'absolute' as const,
    top: dropdownPos.fieldBottom, left: dropdownPos.left, width: dropdownPos.width,
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('EDITPROFILE.EDIT_PROFILE')}</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 16 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={s.heading}>{t('EDITPROFILE.BASIC_DETAILS')}</Text>

        {/* ── Age ── */}
        <Text style={s.fieldGroupLabel}>{t('EDITPROFILE.AGE')}</Text>
        {!ageEditable ? (
          <SelectField
            label={t('EDITPROFILE.AGE')}
            value={original.age ? `${original.age} years old` : undefined}
            locked
            // Angular: showDisableToast('age') -> restrictPopup(), i.e. the
            // lowerpopup 'editFieldRestrict' popup with the generic
            // RESTRICT_FIELD/RESTRICT_SUPPORT copy — its per-field AGEDISABLE
            // toast is commented out there, same as NAMEDISABLE.
            onPress={() => setRestrictedVisible(true)}
          />
        ) : (
          <>
            <View style={h.fieldsRow}>
              {(
                [
                  { field: 'date' as DateFieldKey, ref: dateRef, val: selDate, display: selDate ? selDate.padStart(2, '0') : '', placeholder: 'Date' },
                  { field: 'month' as DateFieldKey, ref: monthRef, val: selMonth, display: MONTHS.find(m => m.key === selMonth)?.label ?? '', placeholder: 'Month' },
                  { field: 'year' as DateFieldKey, ref: yearRef, val: selYear, display: selYear, placeholder: 'Year' },
                ] as const
              ).map(({ field, ref, val, display, placeholder }) => {
                const isOpen = datePickerField === field
                return (
                  <View key={field} ref={ref as any} style={[h.dateField, isOpen && h.dateFieldOpen]}>
                    {!!val && (
                      <View style={h.dateFieldLabel} pointerEvents="none">
                        <Text style={h.dateFieldLabelText}>{placeholder}</Text>
                      </View>
                    )}
                    <Pressable style={h.dateFieldPressable} onPress={() => openDatePicker(field)} accessibilityRole="button" accessibilityLabel={`Select ${placeholder}`}>
                      <Text style={[h.dateFieldText, !val && h.dateFieldPlaceholder]} numberOfLines={1}>{val ? display : placeholder}</Text>
                      <Text style={h.chevron}>{isOpen ? '▴' : '▾'}</Text>
                    </Pressable>
                  </View>
                )
              })}
            </View>

            {isDobComplete && calculatedAge !== null && calculatedAge > 0 && (
              <View style={h.ageBadge}>
                <Text style={h.ageBadgeText}>You are <Text style={h.ageBadgeYears}>{calculatedAge} years</Text> old</Text>
              </View>
            )}

            {!isDobComplete && (
              <>
                {!!directAge && (
                  <Text style={h.currentAgeText}>Current age on file: {directAge} years</Text>
                )}
                <View style={h.orRow}>
                  <View style={h.orLine} />
                  <Text style={h.orText}>OR</Text>
                  <View style={h.orLine} />
                </View>
                <Pressable style={h.enterAgeRow} onPress={() => { setAgeInput(directAge); setAgeError(''); setShowAgeSheet(true) }}>
                  <Text style={h.enterAgeLink}>{directAge ? 'Update age' : 'Please enter age'}</Text>
                  <Text style={h.enterAgeCaret}> ›</Text>
                </Pressable>
              </>
            )}
          </>
        )}

        {/* ── Height ── */}
        <Text style={[s.fieldGroupLabel, s.fieldGroupLabelSpaced]}>{t('EDITPROFILE.HEIGHT')}</Text>
        {categories.map((cat, idx) => {
          const isSelected = selectedCategory === cat.key
          const isLast = idx === categories.length - 1
          return (
            <Pressable
              key={cat.key}
              style={[h.row, !isLast && h.rowBorder, isSelected && h.rowSelected]}
              onPress={() => selectCategory(cat.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              <View style={h.rowLabels}>
                <Text style={[h.rowLabel, isSelected && h.rowLabelSelected]}>{cat.label}</Text>
                {!!cat.subtitle && <Text style={[h.rowSubtitle, isSelected && h.rowSubtitleSelected]}>{cat.subtitle}</Text>}
              </View>
              <View style={[h.radio, isSelected && h.radioSelected]}>
                {isSelected && <Text style={h.radioTick}>✓</Text>}
              </View>
            </Pressable>
          )
        })}

        <View style={h.orRow}>
          <View style={h.orLine} />
          <Text style={h.orText}>OR</Text>
          <View style={h.orLine} />
        </View>

        <Pressable style={[h.exactField, !!selectedHeight && h.exactFieldActive]} onPress={openHeightPanel} accessibilityRole="button">
          <Text style={[h.exactFieldText, !!selectedHeight && h.exactFieldTextActive]} numberOfLines={1}>
            {selectedHeight ? selectedHeight.label : 'Select exact height'}
          </Text>
          <Text style={h.exactFieldArrow}>›</Text>
        </Pressable>

        <Pressable style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={s.submitBtnText}>{t('GENERAL.SUBMIT')}</Text>}
        </Pressable>
      </ScrollView>

      {/* ── Date dropdown ── */}
      <Modal visible={datePickerField !== null} transparent animationType="none" onRequestClose={() => setDatePickerField(null)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setDatePickerField(null)} />
        <View style={[h.dropdown, dateDropStyle]}>
          <FlatList
            data={datePickerOptions}
            keyExtractor={item => item.key}
            style={{ maxHeight: dateListH }}
            showsVerticalScrollIndicator
            getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
            initialScrollIndex={Math.max(0, datePickerOptions.findIndex(o => o.key === datePickerCurrentVal) - 2)}
            renderItem={({ item }) => {
              const isSel = item.key === datePickerCurrentVal
              return (
                <Pressable style={[h.dropdownItem, isSel && h.dropdownItemSel]} onPress={() => datePickerField && handleDatePickerSelect(datePickerField, item.key)}>
                  <Text style={[h.dropdownItemText, isSel && h.dropdownItemTextSel]}>{item.label}</Text>
                </Pressable>
              )
            }}
          />
        </View>
      </Modal>

      {/* ── Enter-age bottom sheet ── */}
      <Modal visible={showAgeSheet} transparent animationType="slide" onRequestClose={() => setShowAgeSheet(false)}>
        <TouchableWithoutFeedback onPress={() => setShowAgeSheet(false)}>
          <View style={h.overlay} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView style={[h.ageSheet, { paddingBottom: insets.bottom + 20 }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={h.dragHandle} />
          <Text style={h.ageSheetTitle}>Enter age</Text>
          <View style={h.ageInputOuter}>
            <TextInput
              style={h.ageInputBox}
              keyboardType="number-pad"
              value={ageInput}
              onChangeText={v => { setAgeInput(v.replace(/\D/g, '')); setAgeError('') }}
              maxLength={2}
              returnKeyType="done"
              autoFocus
              onSubmitEditing={handleAgeSubmit}
            />
            <View style={h.ageLabelWrap} pointerEvents="none">
              <Text style={h.ageLabelText}>Age</Text>
            </View>
          </View>
          {!!ageError && <Text style={h.ageError}>{ageError}</Text>}
          <Pressable style={[s.submitBtn, h.ageConfirmBtn, !ageInput && s.submitBtnDisabled]} onPress={handleAgeSubmit} disabled={!ageInput}>
            <Text style={s.submitBtnText}>Confirm</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Exact height side panel ── */}
      <Modal transparent visible={heightPanelVisible} animationType="none" onRequestClose={closeHeightPanel} statusBarTranslucent>
        <View style={h.panelContainer}>
          <Pressable style={h.backdrop} onPress={closeHeightPanel} />
          <Animated.View style={[h.panel, { paddingBottom: Platform.OS === 'ios' ? insets.bottom : 16, transform: [{ translateX: panelTranslateX }] }]}>
            <View style={h.panelHeader}>
              <Text style={h.panelTitle}>Select height</Text>
              <TouchableOpacity onPress={closeHeightPanel} hitSlop={8}>
                <Text style={h.panelCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            {heightGroups.length === 0 ? (
              <View style={h.panelEmpty}><Text style={h.panelEmptyText}>No heights available</Text></View>
            ) : (
              <SectionList
                sections={heightGroups}
                keyExtractor={(item: Option) => item.key}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section }) => (
                  <View style={h.sectionHeader}><Text style={h.sectionHeaderText}>{section.title}</Text></View>
                )}
                renderItem={({ item }: { item: Option }) => {
                  const isSelected = selectedHeight?.key === item.key
                  return (
                    <Pressable style={[h.heightItem, isSelected && h.heightItemSelected]} onPress={() => selectExactHeight(item)}>
                      <Text style={[h.heightItemText, isSelected && h.heightItemTextSelected]}>{item.label}</Text>
                      {isSelected && <View style={[h.radio, h.radioSelected]}><Text style={h.radioTick}>✓</Text></View>}
                    </Pressable>
                  )
                }}
              />
            )}
          </Animated.View>
        </View>
      </Modal>
      <FieldRestrictedSheet visible={restrictedVisible} onClose={() => setRestrictedVisible(false)} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: '#333333', marginLeft: 6, marginRight: 16 },

  content: { paddingHorizontal: 24, paddingTop: 32 },
  heading: { fontSize: 20, fontWeight: '600', color: Colors.black, marginBottom: 24 },
  fieldGroupLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 12 },
  fieldGroupLabelSpaced: { marginTop: 28 },

  submitBtn: {
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: Colors.white, fontSize: 14, fontWeight: '500' },
})

const h = StyleSheet.create({
  // Date row
  fieldsRow: { flexDirection: 'row', gap: 15, marginTop: 8, marginBottom: 12 },
  dateField: {
    flex: 1, height: 48, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8,
    backgroundColor: Colors.surface, overflow: 'visible', justifyContent: 'center',
  },
  dateFieldOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomColor: Colors.surface },
  dateFieldLabel: { position: 'absolute', top: -8, left: 12, backgroundColor: Colors.surface, paddingHorizontal: 4, zIndex: 10 },
  dateFieldLabelText: { fontSize: 12, fontWeight: '400', color: Colors.textSecondary },
  dateFieldPressable: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 48 },
  dateFieldText: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  dateFieldPlaceholder: { fontWeight: '500', color: Colors.textPrimary },
  chevron: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  ageBadge: {
    marginBottom: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1,
    borderColor: 'rgba(181,0,51,0.1)', borderRadius: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(181,0,51,0.03)',
  },
  ageBadgeText: { fontSize: 14, fontWeight: '400', color: Colors.textPrimary },
  ageBadgeYears: { fontWeight: '600' },
  currentAgeText: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },

  orRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 16, gap: 8 },
  orLine: { flex: 1, height: 1, backgroundColor: '#e0e0e0' },
  orText: { fontSize: 14, color: 'rgba(0,0,0,0.5)' },

  enterAgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  enterAgeLink: { fontSize: 14, fontWeight: '400', color: Colors.link, textDecorationLine: 'underline', lineHeight: 20 },
  enterAgeCaret: { fontSize: 16, fontWeight: '600', color: Colors.link, lineHeight: 20 },

  // Height rows
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  rowSelected: { backgroundColor: Colors.selectionBg },
  rowLabels: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '400', color: Colors.textPrimary },
  rowLabelSelected: { fontWeight: '500' },
  rowSubtitle: { fontSize: 14, fontWeight: '400', color: 'rgba(0,0,0,0.6)', marginTop: 2 },
  rowSubtitleSelected: { fontWeight: '500' },

  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#545454', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryDark },
  radioTick: { color: Colors.surface, fontSize: 10, fontWeight: '700', lineHeight: 12 },

  exactField: {
    flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1, borderColor: Colors.inputBorder,
    borderRadius: 8, paddingLeft: 16, paddingRight: 12, backgroundColor: Colors.surface,
  },
  exactFieldActive: {},
  exactFieldText: { flex: 1, fontSize: 14, fontWeight: '400', color: Colors.textPrimary },
  exactFieldTextActive: { fontWeight: '500' },
  exactFieldArrow: { fontSize: 22, color: Colors.textPrimary, lineHeight: 26 },

  // Dropdown (date picker)
  dropdown: {
    backgroundColor: Colors.surface, borderWidth: 1, borderTopWidth: 0, borderColor: Colors.inputBorder,
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 6 },
    }),
  },
  dropdownItem: { height: ITEM_H, justifyContent: 'center', paddingHorizontal: 10 },
  dropdownItemSel: { backgroundColor: 'rgba(181,0,51,0.05)' },
  dropdownItemText: { fontSize: 14, fontWeight: '400', color: Colors.textPrimary },
  dropdownItemTextSel: { fontWeight: '600', color: Colors.primaryDark },

  overlay: { flex: 1, backgroundColor: Colors.scrimMedium },

  ageSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 24, paddingTop: 20 },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderSoft, alignSelf: 'center', marginBottom: 12 },
  ageSheetTitle: { fontSize: 20, fontWeight: '600', color: Colors.textPrimary, marginBottom: 28, marginTop: 8 },
  ageInputOuter: { position: 'relative', marginTop: 8 },
  ageInputBox: { height: 48, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  ageLabelWrap: { position: 'absolute', top: -8, left: 12, backgroundColor: Colors.surface, paddingHorizontal: 4 },
  ageLabelText: { fontSize: 12, fontWeight: '400', color: Colors.textSecondary },
  ageError: { marginTop: 8, fontSize: 12, color: Colors.inputError, lineHeight: 16 },
  ageConfirmBtn: { marginTop: 28, marginBottom: 0 },

  panelContainer: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: Colors.scrimMedium },
  panel: { width: PICKER_PANEL_WIDTH, backgroundColor: Colors.surface, elevation: 8, shadowColor: Colors.shadow, shadowOpacity: 0.2, shadowOffset: { width: -2, height: 0 }, shadowRadius: 8 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  panelTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  panelCloseTxt: { fontSize: 16, color: Colors.textPrimary, padding: 4 },
  panelEmpty: { padding: 32, alignItems: 'center' },
  panelEmptyText: { fontSize: 14, color: Colors.scrimLight },
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: Colors.surfaceAlt, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  sectionHeaderText: { fontSize: 12, fontWeight: '600', color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: 0.6 },
  heightItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 52, borderBottomWidth: 1, borderBottomColor: Colors.surfaceDim },
  heightItemSelected: { backgroundColor: Colors.selectionBg },
  heightItemText: { flex: 1, fontSize: 14, fontWeight: '400', color: Colors.textPrimary },
  heightItemTextSelected: { fontWeight: '500', color: Colors.primaryDark },
})
