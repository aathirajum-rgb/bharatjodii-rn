// Age / Height editors for the mobile Edit Profile screen (EditAgeHeightSheets
// below) plus the shared date/height helpers they use. The old full-page
// Age/Height screen that used to live here was removed — Edit Profile opens
// these sheets straight from its Age and Height rows (and via the EditProfile
// route's openField: 'age' | 'height' deep link).
//
// Age save shape: a full DOB sends DOB (TYPE 20, "Y~M~D") + AGE (TYPE 3), the
// same pair Angular's form-fields goToNext() fires; a typed age sends AGE only.
// Height is saved under whichever of HEIGHT / HEIGHTCATEGORY applies (both
// TYPE 4, mutually exclusive).

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Alert, Animated, Easing, Keyboard, Modal, Platform,
  Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { FontSize } from '../../src/theme/fonts'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { CDN_REVAMP } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { submitFieldChanges, type EditProfileInfo, type FieldChange } from '../../service/editProfileService'
import {
  fetchHeightCategoryOptions, fetchExactHeightGrouped, type HeightGroup,
} from '../../service/registrationService'
import { PICKER_PANEL_WIDTH, PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { Image } from 'expo-image'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'

const ITEM_H = 40

type Option   = { key: string; label: string }
type Category = { key: string; label: string; subtitle: string }
type DateFieldKey = 'date' | 'month' | 'year'

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
  const subtitle  = spanMatch ? spanMatch[1].replace(/<[^>]+>/g, '').replace(/^(|)$/g, '').trim() : ''
  const label = raw.replace(/<span[^>]*>[\s\S]*?<\/span>/gi, '').replace(/<[^>]+>/g, '').trim()
  return { label, subtitle }
}

const YEARS = buildYears()
// Age sheet's Year dropdown lists oldest → newest (reverse of YEARS).
const YEARS_ASC = [...YEARS].reverse()

// ═══════════════════════════════════════════════════════════════════════════
// Age / Height bottom sheets for the mobile Edit Profile hub (new design) —
// opened straight from the hub's Age and Height rows instead of navigating to
// the screen above. Built on the shared BottomSheet (its floating ✕ above the
// sheet is the design's close button); the exact-height list is the same
// right-side SectionList panel this screen uses. Shares this file's MONTHS /
// YEARS / getDaysInMonth / calculateAge / parseHtmlLabel helpers.
//
// Which editor opens depends on how the value was originally entered:
//   Age    — DATEOFBIRTH on file → "Select <x> age" Date/Month/Year dropdowns
//            (saves DOB TYPE 20 "Y~M~D" + AGE TYPE 3, same pair Angular's
//            form-fields goToNext() fires); no DOB → "Enter <x> age" number
//            input (AGE TYPE 3 only).
//   Height — an exact HEIGHT on file → exact-height panel (tap = save,
//            HEIGHT TYPE 4); otherwise → category radio sheet + "Save changes"
//            (HEIGHTCATEGORY TYPE 4).
// ═══════════════════════════════════════════════════════════════════════════

export type AgeHeightSheetMode = 'age' | 'height' | null

const DROPDOWN_ROWS = 5
// Web: drop the browser's own focus outline on the <input> so only our grey
// border shows — same reset DOBScreen.tsx / NameScreen.tsx use.
const webOutlineReset = { outlineStyle: 'none', outlineWidth: 0 } as any
// Dropdown chevron — same down-arrow.svg the onboarding DOBScreen uses, flipped 180° while open.
const ICON_ARROW_DOWN = CDN_REVAMP + 'down-arrow.svg'
const HEIGHT_CATEGORY_KEYS = ['101', '102', '103', '104']

// DATEOFBIRTH comes back as "YYYY-MM-DD"; manual-age profiles have none (or a zero date).
export function parseDob(raw: string | undefined): { year: string; month: string; date: string } | null {
  const p = (raw ?? '').split('-')
  if (p.length !== 3 || !p[0] || p[0].length !== 4 || Number(p[0]) < 1900) return null
  const month = String(Number(p[1])), date = String(Number(p[2]))
  if (!Number(month) || !Number(date)) return null
  return { year: p[0], month, date }
}

// Angular's rule (edit-profile.page.ts getHeightValue / VIEWHEIGHT): it's an
// EXACT height whenever HEIGHT is a valid value (isValidparam: not '', '0', '-')
// that isn't one of the 101-104 category codes — regardless of HEIGHTCATEGORY,
// which the server also fills in for exact heights. Otherwise it's a category
// (HEIGHT itself = 101-104, or HEIGHTCATEGORY = 101-104).
export function hasExactHeight(info: EditProfileInfo): boolean {
  const h = (info.height ?? '').trim()
  return !!h && h !== '0' && h !== '-' && !HEIGHT_CATEGORY_KEYS.includes(h)
}

// The category code on file for a category-mode profile (HEIGHT wins, as in Angular).
export function heightCategoryCode(info: EditProfileInfo): string | null {
  const h = (info.height ?? '').trim()
  if (HEIGHT_CATEGORY_KEYS.includes(h)) return h
  const c = (info.heightCategory ?? '').trim()
  return HEIGHT_CATEGORY_KEYS.includes(c) ? c : null
}

// Inline Date/Month/Year option list. A plain ScrollView (≤ 71 rows) rather
// than a virtualised FlatList: FlatList + initialScrollIndex only rendered the
// rows around the initial position, so scrolling away from the selected value
// showed blank space (notably on web). Scrolls to the selected row on open.
function DateDropList({ options, selected, onPick }: {
  options: Option[]; selected: string; onPick: (key: string) => void
}) {
  const langFonts = useLanguageFonts()
  const ref = useRef<ScrollView>(null)
  const selIndex = Math.max(0, options.findIndex(o => o.key === selected))
  return (
    <View style={sh.dropdown}>
      <ScrollView
        ref={ref}
        style={{ height: Math.min(options.length, DROPDOWN_ROWS) * ITEM_H }}
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        onLayout={() => ref.current?.scrollTo({ y: Math.max(0, (selIndex - 1) * ITEM_H), animated: false })}
      >
        {options.map(o => {
          const sel = o.key === selected
          return (
            <Pressable key={o.key} style={[sh.dropItem, sel && sh.dropItemSel]} onPress={() => onPick(o.key)}>
              <Text style={[sh.dropItemText, { fontFamily: sel ? langFonts.medium : langFonts.regular }]}>{o.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

export function EditAgeHeightSheets({
  mode, profile, onClose, onSaved,
}: {
  mode: AgeHeightSheetMode
  profile: EditProfileInfo | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
  const insets = useSafeAreaInsets()

  // "son's" / "daughter's" … for a relative-created profile, "your" for self.
  const possessiveKey = PROFILE_POSSESSIVE[profile?.createdBy ?? '']?.toUpperCase()
  const who = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : t('GENERAL.YOUR', 'your')

  const dob       = parseDob(profile?.dateOfBirth)
  const exact     = !!profile && hasExactHeight(profile)
  const ageMode   = mode === 'age'
  const heightMode = mode === 'height'

  const [saving, setSaving] = useState(false)

  // ── Age (manual) ──
  const [ageInput, setAgeInput] = useState('')
  const [ageError, setAgeError] = useState('')
  // ── Age (DOB) ──
  const [selDate, setSelDate]   = useState('')
  const [selMonth, setSelMonth] = useState('')
  const [selYear, setSelYear]   = useState('')
  const [openField, setOpenField] = useState<DateFieldKey | null>(null)
  // ── Height ──
  const [categories, setCategories]     = useState<Category[]>([])
  const [heightGroups, setHeightGroups] = useState<HeightGroup[]>([])
  const [selCategory, setSelCategory]   = useState<string | null>(null)
  const [heightLoading, setHeightLoading] = useState(false)
  const slideAnim = useRef(new Animated.Value(0)).current

  // Lift the sheet above the keyboard for the age input. BottomSheet's Modal is
  // statusBarTranslucent, so on Android the window does NOT resize for the
  // keyboard either — without this the sheet sat hidden under the number pad.
  const [kbHeight, setKbHeight] = useState(0)
  useEffect(() => {
    if (Platform.OS === 'web') return
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvt, e => setKbHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  // Prefill each time a sheet opens.
  useEffect(() => {
    if (!profile || !mode) return
    setSaving(false)
    setOpenField(null)
    if (mode === 'age') {
      setAgeInput(profile.age ?? '')
      setAgeError('')
      setSelYear(dob?.year ?? ''); setSelMonth(dob?.month ?? ''); setSelDate(dob?.date ?? '')
      return
    }
    // Exact-height panel: start the slide + backdrop fade right away (the
    // panel shows its own loader) instead of after the list fetch resolves —
    // waiting made the backdrop pop in first and the panel jump in later.
    if (exact) {
      slideAnim.setValue(0)
      Animated.timing(slideAnim, {
        toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start()
    }
    ;(async () => {
      setHeightLoading(true)
      const gender = profile.gender ?? (await getItem(SK.User.LOGIN_GENDER)) ?? '1'
      if (exact) {
        setHeightGroups(await fetchExactHeightGrouped(gender))
      } else {
        const raw = await fetchHeightCategoryOptions(gender)
        setCategories(raw.map(o => ({ key: o.key, ...parseHtmlLabel(o.label) })))
        setSelCategory(heightCategoryCode(profile))
      }
      setHeightLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  async function save(changes: FieldChange[]) {
    if (saving || changes.length === 0) return
    setSaving(true)
    const result = await submitFieldChanges(changes)
    setSaving(false)
    if (result.failed.length > 0) {
      Alert.alert('Could not save', 'Please try again.')
      return
    }
    onSaved()
    onClose()
  }

  // ── Age: manual ──
  function saveManualAge() {
    const age = ageInput.trim()
    const n = Number(age)
    if (!age || n < 18 || n > 70) { setAgeError('Please enter a valid age (18–70)'); return }
    Keyboard.dismiss()
    save([{ field: 'AGE', value: age, existingValue: profile?.age }])
  }

  // ── Age: DOB ──
  function optionsFor(f: DateFieldKey): Option[] {
    return f === 'month' ? MONTHS : f === 'year' ? YEARS_ASC : getDaysInMonth(selMonth, selYear)
  }
  function valueOf(f: DateFieldKey) { return f === 'date' ? selDate : f === 'month' ? selMonth : selYear }
  function pick(f: DateFieldKey, key: string) {
    if (f === 'date') setSelDate(key)
    else if (f === 'month') {
      setSelMonth(key)
      if (selDate && Number(selDate) > getDaysInMonth(key, selYear).length) setSelDate('')
    } else {
      setSelYear(key)
      if (selDate && Number(selDate) > getDaysInMonth(selMonth, key).length) setSelDate('')
    }
    setOpenField(null)
  }
  const dobComplete = !!(selDate && selMonth && selYear)
  function saveDob() {
    if (!dobComplete) return
    const age = calculateAge(selYear, selMonth, selDate)
    if (age < 18) { Alert.alert('Invalid date of birth', 'Age must be at least 18 years.'); return }
    const oldTriple = dob ? `${dob.year}~${dob.month}~${dob.date}` : ''
    save([
      { field: 'DOB', value: `${selYear}~${selMonth}~${selDate}`, existingValue: oldTriple },
      { field: 'AGE', value: String(age), existingValue: profile?.age },
    ])
  }

  // ── Height ──
  function closePanel() {
    Animated.timing(slideAnim, {
      toValue: 0, duration: 250, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(() => onClose())
  }
  function saveExactHeight(opt: Option) {
    if (saving) return
    save([{ field: 'HEIGHT', value: opt.key, existingValue: profile?.height || profile?.heightCategory }])
  }
  function saveCategory() {
    if (!selCategory) return
    save([{ field: 'HEIGHTCATEGORY', value: selCategory, existingValue: profile?.heightCategory || profile?.height }])
  }

  const saveBtn = (onPress: () => void, disabled: boolean) => (
    <Pressable style={[sh.saveBtn, disabled && sh.saveBtnDisabled]} onPress={onPress} disabled={disabled || saving} accessibilityRole="button">
      {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={[sh.saveBtnText, { fontFamily: langFonts.medium }]}>{t('GENERAL.SAVE_CHANGES', 'Save changes')}</Text>}
    </Pressable>
  )

  // ─── Exact-height side panel ───────────────────────────────────────────────
  if (heightMode && exact) {
    const translateX = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [PICKER_PANEL_WIDTH, 0] })
    return (
      <Modal transparent visible animationType="none" onRequestClose={closePanel} statusBarTranslucent>
        <View style={sh.panelContainer}>
          {/* Backdrop fades with the same animation that slides the panel in/out. */}
          <Animated.View style={[sh.panelBackdrop, { opacity: slideAnim }]} pointerEvents="none" />
          <Pressable style={sh.panelTapArea} onPress={closePanel} />
          <Animated.View style={[sh.panel, { paddingTop: insets.top, paddingBottom: insets.bottom, transform: [{ translateX }] }]}>
            <View style={sh.panelHeader}>
              <Text style={[sh.panelTitle, { fontFamily: langFonts.medium }]}>{`Select ${who} height`}</Text>
              <Pressable onPress={closePanel} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={sh.panelClose}>✕</Text>
              </Pressable>
            </View>
            {heightLoading ? (
              <ActivityIndicator style={sh.panelLoader} color={Colors.primaryDark} />
            ) : (
              <SectionList
                sections={heightGroups}
                keyExtractor={(item: Option) => item.key}
                stickySectionHeadersEnabled={false}
                showsVerticalScrollIndicator={false}
                renderSectionHeader={({ section }) => (
                  <View style={sh.sectionHeader}><Text style={[sh.sectionHeaderText, { fontFamily: langFonts.medium }]}>{section.title}</Text></View>
                )}
                renderItem={({ item }: { item: Option }) => {
                  const sel = item.key === profile?.height
                  return (
                    <Pressable style={[sh.heightItem, sel && sh.heightItemSel]} onPress={() => saveExactHeight(item)} disabled={saving}>
                      <Text style={[sh.heightItemText, sel && sh.heightItemTextSel, { fontFamily: sel ? langFonts.medium : langFonts.regular }]}>{item.label}</Text>
                    </Pressable>
                  )
                }}
              />
            )}
            {saving && <View style={sh.panelSaving}><ActivityIndicator color={Colors.primaryDark} /></View>}
          </Animated.View>
        </View>
      </Modal>
    )
  }

  return (
    <>
      {/* ── Age ── */}
      <BottomSheet visible={ageMode} onClose={onClose} style={kbHeight ? { bottom: kbHeight } : undefined}>
        {dob ? (
          <>
            <Text style={[sh.title, { fontFamily: langFonts.semiBold }]}>{`Select ${who} age`}</Text>
            <View style={sh.dateRow}>
              {([
                { f: 'date' as const,  label: 'Date',  display: selDate ? selDate.padStart(2, '0') : '' },
                { f: 'month' as const, label: 'Month', display: MONTHS.find(m => m.key === selMonth)?.label ?? '' },
                { f: 'year' as const,  label: 'Year',  display: selYear },
              ]).map(({ f, label, display }) => {
                const open = openField === f
                const opts = open ? optionsFor(f) : []
                const cur = valueOf(f)
                return (
                  <View key={f} style={[sh.dateCol, f === 'month' && sh.dateColWide, open && sh.dateColOpen]}>
                    <Pressable style={[sh.dateField, open && sh.dateFieldOpen]} onPress={() => setOpenField(open ? null : f)} accessibilityRole="button" accessibilityLabel={`Select ${label}`}>
                      <Text style={[sh.dateFieldText, !display && sh.placeholder, { fontFamily: langFonts.medium }]} numberOfLines={1}>{display || label}</Text>
                      <Image
                        source={{ uri: ICON_ARROW_DOWN }}
                        style={[sh.chevronIcon, open && sh.chevronIconOpen]}
                        contentFit="contain"
                      />
                    </Pressable>
                    {!!display && <View style={sh.floatLabel} pointerEvents="none"><Text style={[sh.floatLabelText, { fontFamily: langFonts.regular }]}>{label}</Text></View>}
                    {open && (
                      <DateDropList options={opts} selected={cur} onPick={key => pick(f, key)} />
                    )}
                  </View>
                )
              })}
            </View>
            {saveBtn(saveDob, !dobComplete)}
          </>
        ) : (
          <>
            <Text style={[sh.title, { fontFamily: langFonts.semiBold }]}>{`Enter ${who} age`}</Text>
            <View style={sh.inputWrap}>
              <TextInput
                style={[sh.input, !!ageError && sh.inputErr, webOutlineReset, { fontFamily: langFonts.medium }]}
                autoComplete="off"
                value={ageInput}
                onChangeText={v => { setAgeInput(v.replace(/\D/g, '')); setAgeError('') }}
                keyboardType="number-pad"
                maxLength={2}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveManualAge}
              />
              <View style={sh.floatLabel} pointerEvents="none"><Text style={[sh.floatLabelText, { fontFamily: langFonts.regular }]}>{t('EDITPROFILE.AGE', 'Age')}</Text></View>
            </View>
            {!!ageError && <Text style={[sh.error, { fontFamily: langFonts.regular }]}>{ageError}</Text>}
            {saveBtn(saveManualAge, !ageInput)}
          </>
        )}
      </BottomSheet>

      {/* ── Height category ── */}
      <BottomSheet visible={heightMode && !exact} onClose={onClose}>
        <Text style={[sh.title, { fontFamily: langFonts.semiBold }]}>{`Select ${who} height`}</Text>
        {heightLoading ? (
          <ActivityIndicator style={sh.catLoader} color={Colors.primaryDark} />
        ) : categories.map((c, i) => {
          const sel = selCategory === c.key
          return (
            <Pressable
              key={c.key}
              style={[sh.catRow, i < categories.length - 1 && sh.catRowBorder]}
              onPress={() => setSelCategory(c.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
            >
              <View style={sh.catLabels}>
                <Text style={[sh.catLabel, { fontFamily: langFonts.medium }]}>{c.label}</Text>
                {!!c.subtitle && <Text style={[sh.catSub, { fontFamily: langFonts.regular }]}>{c.subtitle}</Text>}
              </View>
              <View style={[sh.radio, sel && sh.radioSel]}>{sel && <Text style={sh.radioTick}>✓</Text>}</View>
            </Pressable>
          )
        })}
        {saveBtn(saveCategory, !selCategory)}
      </BottomSheet>
    </>
  )
}

const sh = StyleSheet.create({
  title: { fontSize: FontSize.font16, color: Colors.black, marginBottom: 24 },

  saveBtn: {
    height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: FontSize.font14, color: Colors.white },

  // Floating-label outlined field (Age input + date fields)
  floatLabel: { position: 'absolute', top: -8, left: 10, backgroundColor: Colors.white, paddingHorizontal: 4 },
  floatLabelText: { fontSize: FontSize.font12, color: Colors.textSecondary },

  inputWrap: { position: 'relative' },
  input: {
    height: 48, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8, paddingHorizontal: 12,
    fontSize: FontSize.font14, color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  inputErr: { borderColor: Colors.inputError },
  error: { marginTop: 8, fontSize: FontSize.font12, color: Colors.inputError },

  // DOB
  // alignItems flex-start: the open column grows by its list height while the
  // other two fields keep their 48px height.
  dateRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dateCol: { flex: 1, position: 'relative' },
  dateColWide: { flex: 1.3 },
  dateColOpen: { zIndex: 20 },
  dateField: {
    height: 48, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, backgroundColor: Colors.white,
  },
  // Open: field + list read as ONE box with the same 1px grey border all round —
  // the field drops its bottom edge/corners and the list carries on below it.
  dateFieldOpen: { borderBottomWidth: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  dateFieldText: { flex: 1, fontSize: FontSize.font14, color: Colors.textPrimary },
  placeholder: { color: Colors.textSecondary },
  chevronIcon: { width: 16, height: 16, marginLeft: 4 },
  chevronIconOpen: { transform: [{ rotate: '180deg' }] },
  // In normal flow under its field (NOT position:absolute). An absolutely
  // positioned list hung outside its 48px column, and touches outside a
  // parent's bounds never reach the child on Android/iOS — so the list
  // couldn't be scrolled or tapped.
  dropdown: {
    backgroundColor: Colors.white,
    borderWidth: 1, borderTopWidth: 0, borderColor: Colors.inputBorder,
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8, overflow: 'hidden',
  },
  dropItem: { height: ITEM_H, justifyContent: 'center', paddingHorizontal: 10 },
  dropItemSel: { backgroundColor: Colors.selectionBg },
  dropItemText: { fontSize: FontSize.font14, color: Colors.textPrimary },

  // Height category radio rows
  catLoader: { marginVertical: 24 },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  catRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  catLabels: { flex: 1 },
  catLabel: { fontSize: FontSize.font14, color: Colors.textPrimary },
  catSub: { fontSize: FontSize.font12, color: Colors.textSecondary, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#545454', alignItems: 'center', justifyContent: 'center' },
  radioSel: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryDark },
  radioTick: { color: Colors.white, fontSize: FontSize.font10, fontWeight: '700', lineHeight: 12 },

  // Exact-height side panel
  panelContainer: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  // Same black scrim as the shared BottomSheet (black @ 0.9) so the height list matches the other sheets.
  panelBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)' },
  panelTapArea: { flex: 1 },
  panel: { width: PICKER_PANEL_WIDTH, backgroundColor: Colors.white, elevation: 8 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  panelTitle: { flex: 1, fontSize: FontSize.font14, color: Colors.textPrimary },
  panelClose: { fontSize: FontSize.font16, color: Colors.textPrimary, padding: 4 },
  panelLoader: { marginTop: 32 },
  panelSaving: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.surfaceDim },
  sectionHeaderText: { fontSize: FontSize.font14, color: Colors.textPrimary },
  heightItem: { paddingHorizontal: 20, height: 44, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  heightItemSel: { backgroundColor: Colors.selectionBg },
  heightItemText: { fontSize: FontSize.font13, color: Colors.textPrimary },
  heightItemTextSel: { color: Colors.primaryDark },
})
