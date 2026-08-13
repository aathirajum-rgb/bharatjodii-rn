import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { callPartialRegistrationAPI, getRegValue, setRegValue, setRegValues } from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'son-birth-date.svg'
const ITEM_H        = 40   // Figma: each dropdown row is 40px tall
const MAX_LIST_ITEMS = 7   // how many rows visible before scroll

const AGE_SUBJECT: Record<string, string> = {
  '4': 'son', '5': 'daughter', '8': 'brother',
  '9': 'sister', '10': 'friend', '11': 'relative',
}

const MONTHS = [
  { key: '1',  label: 'January'   }, { key: '2',  label: 'February'  },
  { key: '3',  label: 'March'     }, { key: '4',  label: 'April'     },
  { key: '5',  label: 'May'       }, { key: '6',  label: 'June'      },
  { key: '7',  label: 'July'      }, { key: '8',  label: 'August'    },
  { key: '9',  label: 'September' }, { key: '10', label: 'October'   },
  { key: '11', label: 'November'  }, { key: '12', label: 'December'  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildYears(): { key: string; label: string }[] {
  const max = new Date().getFullYear() - 18
  const min = max - 52
  return Array.from({ length: max - min + 1 }, (_, i) => {
    const y = String(max - i)
    return { key: y, label: y }
  })
}

function getDaysInMonth(month: string, year: string): { key: string; label: string }[] {
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

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldKey  = 'date' | 'month' | 'year'
type DropdownPos = { top: number; left: number; width: number; fieldBottom: number }
type Props     = { navigation: any; route: { params?: { pageNo?: string } } }

// ─── Component ────────────────────────────────────────────────────────────────

export default function DOBScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [createdBy,    setCreatedBy]    = useState('1')
  const [submitting,   setSubmitting]   = useState(false)

  const [selDate,  setSelDate]  = useState('')
  const [selMonth, setSelMonth] = useState('')
  const [selYear,  setSelYear]  = useState('')

  const [pickerField,  setPickerField]  = useState<FieldKey | null>(null)
  const [dropdownPos,  setDropdownPos]  = useState<DropdownPos>({ top: 0, left: 0, width: 94, fieldBottom: 0 })

  const [showAgeSheet, setShowAgeSheet] = useState(false)
  const [ageInput,     setAgeInput]     = useState('')
  const [ageError,     setAgeError]     = useState('')

  const dateRef  = useRef<View>(null)
  const monthRef = useRef<View>(null)
  const yearRef  = useRef<View>(null)

  const YEARS = buildYears()

  // ── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('DATEOFBIRTH'),
    ]).then(([cb, dob]) => {
      if (cb) setCreatedBy(cb)
      if (dob && dob !== '0000-00-00') {
        const p = dob.split('-')
        if (p.length === 3) {
          setSelYear(p[0])
          setSelMonth(String(Number(p[1])))
          setSelDate(String(Number(p[2])))
        }
      }
    })
  }, [])

  // ── Computed ─────────────────────────────────────────────────────────────

  const possessive       = PROFILE_POSSESSIVE[createdBy]
  const ageSubject       = AGE_SUBJECT[createdBy]
  
  const possessiveKey = possessive?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.DATEOFBIRTH', 'Select your #PROFILETYPE# date of birth')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  const noRemText        = possessive
    ? `If you don't remember your ${possessive}\ndate of birth,`
    : "If you don't remember your\ndate of birth,"

  const selMonthLabel    = MONTHS.find(m => m.key === selMonth)?.label ?? ''
  const isAllSelected    = !!(selDate && selMonth && selYear)
  const calculatedAge    = isAllSelected ? calculateAge(selYear, selMonth, selDate) : null
  // ── Picker helpers ────────────────────────────────────────────────────────

  function getOptions(field: FieldKey) {
    if (field === 'month') return MONTHS
    if (field === 'year')  return YEARS
    return getDaysInMonth(selMonth, selYear)
  }

  function getCurrentVal(field: FieldKey) {
    if (field === 'date')  return selDate
    if (field === 'month') return selMonth
    return selYear
  }

  function refFor(field: FieldKey) {
    if (field === 'date')  return dateRef
    if (field === 'month') return monthRef
    return yearRef
  }

  function openPicker(field: FieldKey) {
    const ref = refFor(field)
    ref.current?.measureInWindow((x, y, w, h) => {
      // For month dropdown, use a minimum width so full month names fit
      const dropW = field === 'month' ? Math.max(w, 130) : w
      setDropdownPos({ top: y, left: x, width: dropW, fieldBottom: y + h })
      setPickerField(field)
    })
  }

  function handlePickerSelect(field: FieldKey, key: string) {
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
    setPickerField(null)
  }

  // ── Submit (DOB path) ─────────────────────────────────────────────────────

  async function handleNext() {
    if (!isAllSelected || submitting) return
    setSubmitting(true)
    try {
      const dob = `${selYear}-${selMonth.padStart(2, '0')}-${selDate.padStart(2, '0')}`
      await setRegValues({ DATEOFBIRTH: dob, MONTH: selMonth, DATE: selDate, YEAR: selYear })
      navigation.push('onboarding', { pageNo: '43' })
      callPartialRegistrationAPI()
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submit (Age path) ─────────────────────────────────────────────────────

  async function handleAgeSubmit() {
    const age    = ageInput.trim()
    const ageNum = Number(age)
    if (!age || ageNum < 18 || ageNum > 70) {
      setAgeError('Please enter a valid age (18–70)')
      return
    }
    setShowAgeSheet(false)
    setSubmitting(true)
    try {
      await setRegValue('AGE', age)
      navigation.push('onboarding', { pageNo: '43' })
      callPartialRegistrationAPI()
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  useOnboardingFooter({ nextDisabled: !isAllSelected, nextLoading: submitting, onNext: handleNext }, [isAllSelected, submitting])

  // ── Render ────────────────────────────────────────────────────────────────

  const pickerOptions = pickerField ? getOptions(pickerField) : []
  const currentVal    = pickerField ? getCurrentVal(pickerField) : ''

  // Dropdown list height capped at MAX_LIST_ITEMS rows
  const listH = Math.min(pickerOptions.length, MAX_LIST_ITEMS) * ITEM_H

  // Dropdown position: start at fieldBottom (right below the field),
  // visually it looks like the field expanded downward.
  const dropStyle = {
    position: 'absolute' as const,
    top:   dropdownPos.fieldBottom,
    left:  dropdownPos.left,
    width: dropdownPos.width,
  }

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Birthday cake icon */}
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />

        {/* Title */}
        <Text style={os.title}>{title}</Text>

        {/* Three dropdown trigger fields */}
        <View style={styles.fieldsRow}>
          {(
            [
              { field: 'date'  as FieldKey, ref: dateRef,  val: selDate,  display: selDate ? selDate.padStart(2, '0') : '',  placeholder: 'Date'  },
              { field: 'month' as FieldKey, ref: monthRef, val: selMonth, display: selMonthLabel,                            placeholder: 'Month' },
              { field: 'year'  as FieldKey, ref: yearRef,  val: selYear,  display: selYear,                                  placeholder: 'Year'  },
            ] as const
          ).map(({ field, ref, val, display, placeholder }) => {
            const isOpen = pickerField === field
            return (
              <View
                key={field}
                ref={ref as any}
                style={[
                  styles.field,
                  isOpen && styles.fieldOpen,
                ]}
              >
                {/* Floating label — only when value is set */}
                {!!val && (
                  <View style={styles.fieldLabel} pointerEvents="none">
                    <Text style={styles.fieldLabelText}>{placeholder}</Text>
                  </View>
                )}

                <Pressable
                  style={styles.fieldPressable}
                  onPress={() => openPicker(field)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${placeholder}`}
                >
                  <Text style={[styles.fieldText, !val && styles.fieldPlaceholder]} numberOfLines={1}>
                    {val ? display : placeholder}
                  </Text>
                  {/* Chevron flips when open */}
                  <Text style={styles.chevron}>{isOpen ? '▴' : '▾'}</Text>
                </Pressable>
              </View>
            )
          })}
        </View>

        {/* Age badge — "Your son is 28 years old" (Angular .height-block: fading gradient fill) */}
        {isAllSelected && calculatedAge !== null && calculatedAge > 0 && (
          <LinearGradient
            colors={['rgba(181,0,51,0)', '#ffffff']}
            locations={[0, 0.6]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ageBadge}
          >
            <Text style={styles.ageBadgeText}>
              {ageSubject ? `Your ${ageSubject} is ` : 'You are '}
              <Text style={styles.ageBadgeYears}>{calculatedAge} years</Text>
              {' old'}
            </Text>
          </LinearGradient>
        )}

        {/* OR divider + "Please enter age" — hidden once all 3 date fields are filled */}
        {!isAllSelected && (
          <>
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            <Text style={styles.noRemText}>{noRemText}</Text>
            <Pressable
              style={styles.enterAgeRow}
              onPress={() => { setAgeInput(''); setAgeError(''); setShowAgeSheet(true) }}
            >
              <Text style={styles.enterAgeLink}>Please enter age</Text>
              <Text style={styles.enterAgeCaret}> ›</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}

      {/* ── Inline dropdown — transparent Modal positioned at field location ── */}
      <Modal
        visible={pickerField !== null}
        transparent
        animationType="none"
        onRequestClose={() => setPickerField(null)}
      >
        {/* Full-screen tap-away closes the dropdown */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerField(null)} />

        {/* Dropdown list — starts right below the field (fieldBottom) */}
        <View style={[styles.dropdown, dropStyle]}>
          <FlatList
            data={pickerOptions}
            keyExtractor={item => item.key}
            style={{ maxHeight: listH }}
            showsVerticalScrollIndicator
            getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
            initialScrollIndex={Math.max(0, pickerOptions.findIndex(o => o.key === currentVal) - 2)}
            renderItem={({ item }) => {
              const isSel = item.key === currentVal
              return (
                <Pressable
                  style={[styles.dropdownItem, isSel && styles.dropdownItemSel]}
                  onPress={() => pickerField && handlePickerSelect(pickerField, item.key)}
                >
                  <Text style={[styles.dropdownItemText, isSel && styles.dropdownItemTextSel]}>
                    {item.label}
                  </Text>
                </Pressable>
              )
            }}
          />
        </View>
      </Modal>

      {/* ── Age entry bottom sheet ── */}
      <Modal
        visible={showAgeSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAgeSheet(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowAgeSheet(false)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          style={[styles.ageSheet, { paddingBottom: insets.bottom + 20 }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.dragHandle} />
          <Text style={styles.ageSheetTitle}>Enter age</Text>

          <View style={styles.ageInputOuter}>
            <TextInput
              style={styles.ageInputBox}
              keyboardType="number-pad"
              value={ageInput}
              onChangeText={v => { setAgeInput(v.replace(/\D/g, '')); setAgeError('') }}
              maxLength={2}
              returnKeyType="done"
              autoFocus
              onSubmitEditing={handleAgeSubmit}
            />
            <View style={styles.ageLabelWrap} pointerEvents="none">
              <Text style={styles.ageLabelText}>Age</Text>
            </View>
          </View>

          {!!ageError && <Text style={styles.ageError}>{ageError}</Text>}

          <View style={styles.ageConfirmBtn}>
            <ButtonRevamp
              label="Confirm"
              variant="primary"
              size="standard"
              fullWidth
              disabled={!ageInput}
              onPress={handleAgeSubmit}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Fields row ──────────────────────────────────────────────────────────────

  fieldsRow: {
    flexDirection: 'row',
    gap:           15,
    marginTop:     8,   // space above for floating label
  },

  // Each field — bordered outlined box
  field: {
    flex:            1,
    height:          48,
    borderWidth:     1,
    borderColor:     Colors.inputBorder,
    borderRadius:    8,
    backgroundColor: Colors.surface,
    overflow:        'visible',
    justifyContent:  'center',
  },
  // When open: bottom border connects to dropdown
  fieldOpen: {
    borderBottomLeftRadius:  0,
    borderBottomRightRadius: 0,
    borderBottomColor:       Colors.surface, // hide bottom border (merges with dropdown top)
  },

  // Floating label above the top border (same as NameScreen)
  fieldLabel: {
    position:          'absolute',
    top:               -8,
    left:              12,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
    zIndex:            10,
  },
  fieldLabelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textSecondary,
  },

  fieldPressable: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 10,
    height:            48,
  },
  fieldText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  fieldPlaceholder: {
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  chevron: {
    fontSize:   14,
    color:      Colors.textSecondary,
    lineHeight: 20,
  },
  // ── Age badge ────────────────────────────────────────────────────────────────

  // Angular .height-block: border-radius left-corners-only (8px 0 0 8px);
  // fill is a fading gradient (rendered via LinearGradient at the call site).
  ageBadge: {
    marginTop:        12,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       'rgba(181,0,51,0.1)',
    borderTopLeftRadius:    8,
    borderBottomLeftRadius: 8,
    alignSelf:         'flex-start',
  },
  ageBadgeText: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  ageBadgeYears: {
    fontWeight: '600',
  },

  // ── OR divider ────────────────────────────────────────────────────────────────

  orRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     24,
    marginBottom:  20,
  },
  orLine: {
    flex:            1,
    height:          1,
    backgroundColor: Colors.textPrimary,
    opacity:         0.2,
  },
  orText: {
    fontSize:         14,
    fontWeight:       '400',
    color:            Colors.textPrimary,
    opacity:          0.5,
    marginHorizontal: 16,
  },

  // ── "Please enter age" ────────────────────────────────────────────────────────

  noRemText: {
    fontSize:     14,
    fontWeight:   '400',
    color:        Colors.textPrimary,
    lineHeight:   20,
    marginBottom: 8,
  },
  enterAgeRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  enterAgeLink: {
    fontSize:           14,
    fontWeight:         '400',
    color:              Colors.link,
    textDecorationLine: 'underline',
    lineHeight:         20,
  },
  enterAgeCaret: {
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.link,
    lineHeight: 20,
  },

  // ── Inline dropdown (rendered inside Modal, positioned at field location) ──────

  dropdown: {
    backgroundColor: Colors.surface,
    borderWidth:     1,
    borderTopWidth:  0,  // connects seamlessly with the open field's bottom
    borderColor:     Colors.inputBorder,
    borderBottomLeftRadius:  8,
    borderBottomRightRadius: 8,
    // Shadow for depth
    ...Platform.select({
      ios: {
        shadowColor:   Colors.shadow,
        shadowOffset:  { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius:  6,
      },
      android: { elevation: 6 },
    }),
  },
  dropdownItem: {
    height:            ITEM_H,
    justifyContent:    'center',
    paddingHorizontal: 10,
  },
  dropdownItemSel: {
    backgroundColor: 'rgba(181,0,51,0.05)',
  },
  dropdownItemText: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  dropdownItemTextSel: {
    fontWeight: '600',
    color:      Colors.primaryDark,
  },

  // ── Modal overlay ─────────────────────────────────────────────────────────────

  overlay: {
    flex:            1,
    backgroundColor: Colors.scrimMedium,
  },

  // ── Age entry bottom sheet ────────────────────────────────────────────────────

  ageSheet: {
    backgroundColor:      Colors.surface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingHorizontal:    24,
    paddingTop:           20,
  },
  dragHandle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.borderSoft,
    alignSelf:       'center',
    marginBottom:    12,
  },
  ageSheetTitle: {
    fontSize:     20,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    marginBottom: 28,
    marginTop:    8,
  },
  ageInputOuter: {
    position:  'relative',
    marginTop: 8,
  },
  ageInputBox: {
    height:            48,
    borderWidth:       1,
    borderColor:       Colors.inputBorder,
    borderRadius:      8,
    paddingHorizontal: 12,
    fontSize:          14,
    fontWeight:        '500',
    color:             Colors.textPrimary,
  },
  ageLabelWrap: {
    position:          'absolute',
    top:               -8,
    left:              12,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
  },
  ageLabelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textSecondary,
  },
  ageError: {
    marginTop:  8,
    fontSize:   12,
    color:      Colors.inputError,
    lineHeight: 16,
  },
  ageConfirmBtn: {
    marginTop: 28,
  },
})
