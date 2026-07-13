import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R = CDN_REACT + '/'

const ICON = {
  back:    R + 'menu_back_arrow.svg',
  gift:    R + 'marriage_gift.gif',
  chevron: R + 'menu_right_arrow.svg',
}

// ─── Date picker constants ────────────────────────────────────────────────────

const MONTHS = [
  { key: '1',  label: 'January'   }, { key: '2',  label: 'February'  },
  { key: '3',  label: 'March'     }, { key: '4',  label: 'April'     },
  { key: '5',  label: 'May'       }, { key: '6',  label: 'June'      },
  { key: '7',  label: 'July'      }, { key: '8',  label: 'August'    },
  { key: '9',  label: 'September' }, { key: '10', label: 'October'   },
  { key: '11', label: 'November'  }, { key: '12', label: 'December'  },
]

const ITEM_H      = 40
const MAX_VISIBLE = 7

function buildMarriageYears(): { key: string; label: string }[] {
  const max = new Date().getFullYear()
  const min = 1990
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Props        = { navigation: any; route: any }
type DateChip     = 'fixed' | 'not_fixed' | null
type MrgDateField = 'date' | 'month' | 'year'
type DropdownPos  = { top: number; left: number; width: number; fieldBottom: number }

// "Getting married in" month options (from Angular's DATENOTFIXED registration array)
const MONTHS_OPTIONS = [
  { key: '1', value: 'Getting married in 3 months'  },
  { key: '2', value: 'Getting married in 6 months'  },
  { key: '3', value: 'Getting married in 9 months'  },
  { key: '4', value: 'Getting married in 1 year'    },
  { key: '5', value: 'More than 1 year'             },
]

const MARRIAGE_YEARS = buildMarriageYears()

// ─── FloatingLabelField ───────────────────────────────────────────────────────

interface FloatingFieldProps {
  label:    string
  value:    string
  onPress:  () => void
}

function FloatingLabelField({ label, value, onPress }: FloatingFieldProps) {
  return (
    <Pressable style={fl.wrap} onPress={onPress} accessibilityRole="button">
      <View style={fl.labelWrap}>
        <Text style={fl.label}>{label}</Text>
      </View>
      <Text style={[fl.value, !value && fl.placeholder]} numberOfLines={1}>
        {value || ''}
      </Text>
      <View style={fl.chevronWrap}>
        <CdnSvg uri={ICON.chevron} width={16} height={16} />
      </View>
    </Pressable>
  )
}

// ─── MonthPickerSheet ─────────────────────────────────────────────────────────

interface MonthPickerProps {
  visible:    boolean
  selected:   string
  onSelect:   (key: string, value: string) => void
  onClose:    () => void
}

function MonthPickerSheet({ visible, selected, onSelect, onClose }: MonthPickerProps) {
  const insets    = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(300)).current

  const [modalMounted, setModalMounted] = useState(visible)

  if (visible && !modalMounted) setModalMounted(true)

  if (modalMounted !== visible) {
    if (visible) {
      setModalMounted(true)
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 55, friction: 11 }).start()
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true })
        .start(({ finished }) => { if (finished) setModalMounted(false) })
    }
  }

  return (
    <Modal visible={modalMounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View style={[mp.sheet, { paddingBottom: insets.bottom + 8 }, { transform: [{ translateY: slideAnim }] }]}>
        {MONTHS_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[mp.row, opt.key === selected && mp.rowSelected]}
            onPress={() => { onSelect(opt.key, opt.value); onClose() }}
            activeOpacity={0.7}
          >
            <Text style={[mp.rowText, opt.key === selected && mp.rowTextSelected]}>{opt.value}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Modal>
  )
}

// ─── DeleteProfileShareDetailsScreen ─────────────────────────────────────────

export default function DeleteProfileShareDetailsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const { t }  = useTranslation()

  // Partner name
  const [partnerName,    setPartnerName]    = useState('')
  const [nameError,      setNameError]      = useState(false)

  // Chips
  const [dateChip,       setDateChip]       = useState<DateChip>(null)

  // "Date not yet fixed" picker
  const [marriedInKey,   setMarriedInKey]   = useState('')
  const [marriedInLabel, setMarriedInLabel] = useState('')
  const [pickerVisible,  setPickerVisible]  = useState(false)

  // "Marriage date fixed" — DOB-style date fields
  const [selDate,  setSelDate]  = useState('')
  const [selMonth, setSelMonth] = useState('')
  const [selYear,  setSelYear]  = useState('')

  const [mrgPickerField,  setMrgPickerField]  = useState<MrgDateField | null>(null)
  const [mrgDropdownPos,  setMrgDropdownPos]  = useState<DropdownPos>({ top: 0, left: 0, width: 94, fieldBottom: 0 })

  const mrgDateRef  = useRef<View>(null)
  const mrgMonthRef = useRef<View>(null)
  const mrgYearRef  = useRef<View>(null)

  // ── Derived ───────────────────────────────────────────────────────────────

  const mrgPickerOptions: { key: string; label: string }[] = mrgPickerField
    ? (mrgPickerField === 'month' ? MONTHS
      : mrgPickerField === 'year' ? MARRIAGE_YEARS
      : getDaysInMonth(selMonth, selYear))
    : []
  const mrgCurrentVal = mrgPickerField === 'date' ? selDate : mrgPickerField === 'month' ? selMonth : selYear
  const mrgListH      = Math.min(mrgPickerOptions.length, MAX_VISIBLE) * ITEM_H

  const selMonthLabel = MONTHS.find(m => m.key === selMonth)?.label ?? ''

  // ── Validation ────────────────────────────────────────────────────────────

  const nextEnabled = useCallback(() => {
    if (partnerName.trim().length < 3) return false
    if (dateChip === null)             return false
    if (dateChip === 'fixed')          return !!(selDate && selMonth && selYear)
    if (dateChip === 'not_fixed')      return marriedInKey !== ''
    return false
  }, [partnerName, dateChip, selDate, selMonth, selYear, marriedInKey])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleNext() {
    if (partnerName.trim().length < 3) {
      setNameError(true)
      return
    }
    setNameError(false)

    const mrgDate = dateChip === 'fixed'
      ? `${selYear}-${selMonth.padStart(2, '0')}-${selDate.padStart(2, '0')}`
      : ''

    navigation.navigate('DeleteProfileUploadPhoto', {
      partnerName:     partnerName.trim(),
      dateFixType:     dateChip === 'fixed' ? '1' : '2',
      mrgDate,
      mrgInMonthsName: marriedInLabel,
      reasonName:      route.params?.reasonName  ?? '',
      mrgReasonName:   route.params?.mrgReasonName ?? '',
    })
  }

  function handleSelectChip(chip: DateChip) {
    setDateChip(chip)
    setMarriedInKey('')
    setMarriedInLabel('')
    setSelDate('')
    setSelMonth('')
    setSelYear('')
  }

  function openMrgPicker(field: MrgDateField) {
    const ref = field === 'date' ? mrgDateRef : field === 'month' ? mrgMonthRef : mrgYearRef
    ref.current?.measureInWindow((x, y, w, h) => {
      const dropW = field === 'month' ? Math.max(w, 130) : w
      setMrgDropdownPos({ top: y, left: x, width: dropW, fieldBottom: y + h })
      setMrgPickerField(field)
    })
  }

  function handleMrgPickerSelect(field: MrgDateField, key: string) {
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
    setMrgPickerField(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const mrgDropStyle = {
    position: 'absolute' as const,
    top:      mrgDropdownPos.fieldBottom,
    left:     mrgDropdownPos.left,
    width:    mrgDropdownPos.width,
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <Pressable
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <CdnSvg uri={ICON.back} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle}>{t('DELETE_PROFILE.HEADER')}</Text>
      </View>

      <ScrollView
        style={s.flex1}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Gift banner ── */}
        <LinearGradient
          colors={['#FCEDFF', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.banner}
        >
          <View style={s.bannerText}>
            <Text style={s.bannerLine}>{t('DELETE_PROFILE.SHARE_GIFT_PRE')}</Text>
            <Text style={s.bannerHighlight}>{t('DELETE_PROFILE.SHARE_GIFT_HIGHLIGHT')}</Text>
            <Text style={s.bannerLine}>{t('DELETE_PROFILE.SHARE_GIFT_POST')}</Text>
          </View>
          <View style={s.bannerIcon}>
            <Image source={{ uri: ICON.gift }} style={{ width: 120, height: 110 }} contentFit="contain" />
          </View>
        </LinearGradient>

        {/* ── Partner name input ── */}
        <View style={[s.inputWrap, nameError && s.inputWrapError]}>
          <TextInput
            style={s.textInput}
            value={partnerName}
            onChangeText={text => {
              setPartnerName(text)
              if (text.trim().length >= 3) setNameError(false)
            }}
            maxLength={60}
            returnKeyType="done"
          />
          {!partnerName && (
            <View style={s.placeholderRow} pointerEvents="none">
              <Text style={s.placeholderText}>
                {t('DELETE_PROFILE.PARTNER_NAME_PLACEHOLDER')}
              </Text>
              <Text style={s.placeholderAsterisk}> *</Text>
            </View>
          )}
        </View>
        {nameError && (
          <Text style={s.nameError}>{t('DELETE_PROFILE.PARTNER_NAME_ERROR')}</Text>
        )}

        {/* ── Date chips ── */}
        <View style={s.chipRow}>
          <Pressable
            style={[chip.base, dateChip === 'fixed' ? chip.selected : chip.unselected]}
            onPress={() => handleSelectChip('fixed')}
            accessibilityRole="radio"
            accessibilityState={{ selected: dateChip === 'fixed' }}
          >
            <Text style={[chip.label, dateChip === 'fixed' && chip.labelSelected]}>
              {t('DELETE_PROFILE.DATE_FIXED_CHIP')}
            </Text>
          </Pressable>
          <Pressable
            style={[chip.base, dateChip === 'not_fixed' ? chip.selected : chip.unselected]}
            onPress={() => handleSelectChip('not_fixed')}
            accessibilityRole="radio"
            accessibilityState={{ selected: dateChip === 'not_fixed' }}
          >
            <Text style={[chip.label, dateChip === 'not_fixed' && chip.labelSelected]}>
              {t('DELETE_PROFILE.DATE_NOT_FIXED_CHIP')}
            </Text>
          </Pressable>
        </View>

        {/* ── Marriage date fixed → DOB-style date fields ── */}
        {dateChip === 'fixed' && (
          <View style={s.subField}>
            <View style={mds.fieldsRow}>
              {(
                [
                  { field: 'date'  as MrgDateField, ref: mrgDateRef,  val: selDate,  display: selDate ? selDate.padStart(2, '0') : '',  placeholder: 'Date'  },
                  { field: 'month' as MrgDateField, ref: mrgMonthRef, val: selMonth, display: selMonthLabel,                             placeholder: 'Month' },
                  { field: 'year'  as MrgDateField, ref: mrgYearRef,  val: selYear,  display: selYear,                                   placeholder: 'Year'  },
                ] as const
              ).map(({ field, ref, val, display, placeholder }) => {
                const isOpen = mrgPickerField === field
                return (
                  <View
                    key={field}
                    ref={ref as any}
                    style={[mds.field, isOpen && mds.fieldOpen]}
                  >
                    {!!val && (
                      <View style={mds.fieldLabel} pointerEvents="none">
                        <Text style={mds.fieldLabelText}>{placeholder}</Text>
                      </View>
                    )}
                    <Pressable
                      style={mds.fieldPressable}
                      onPress={() => openMrgPicker(field)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${placeholder}`}
                    >
                      <Text style={[mds.fieldText, !val && mds.fieldPlaceholder]} numberOfLines={1}>
                        {val ? display : placeholder}
                      </Text>
                      <Text style={mds.chevron}>{isOpen ? '▴' : '▾'}</Text>
                    </Pressable>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* ── Date not yet fixed → "Married in" dropdown ── */}
        {dateChip === 'not_fixed' && (
          <View style={s.subField}>
            <FloatingLabelField
              label={t('DELETE_PROFILE.MARRIED_IN_LABEL')}
              value={marriedInLabel}
              onPress={() => setPickerVisible(true)}
            />
          </View>
        )}

      </ScrollView>

      {/* ── Next CTA ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <ButtonRevamp
          label={t('DELETE_PROFILE.NEXT_CTA')}
          variant="primary"
          fullWidth
          disabled={!nextEnabled()}
          onPress={handleNext}
        />
      </View>

      {/* ── Month picker bottom sheet (date not yet fixed) ── */}
      <MonthPickerSheet
        visible={pickerVisible}
        selected={marriedInKey}
        onSelect={(key, value) => { setMarriedInKey(key); setMarriedInLabel(value) }}
        onClose={() => setPickerVisible(false)}
      />

      {/* ── Marriage date inline dropdown ── */}
      <Modal
        visible={mrgPickerField !== null}
        transparent
        animationType="none"
        onRequestClose={() => setMrgPickerField(null)}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMrgPickerField(null)} />
        <View style={[mds.dropdown, mrgDropStyle]}>
          <FlatList
            data={mrgPickerOptions}
            keyExtractor={item => item.key}
            style={{ maxHeight: mrgListH }}
            showsVerticalScrollIndicator
            getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
            initialScrollIndex={Math.max(0, mrgPickerOptions.findIndex(o => o.key === mrgCurrentVal) - 2)}
            renderItem={({ item }) => {
              const isSel = item.key === mrgCurrentVal
              return (
                <Pressable
                  style={[mds.dropdownItem, isSel && mds.dropdownItemSel]}
                  onPress={() => mrgPickerField && handleMrgPickerSelect(mrgPickerField, item.key)}
                >
                  <Text style={[mds.dropdownItemText, isSel && mds.dropdownItemTextSel]}>
                    {item.label}
                  </Text>
                </Pressable>
              )
            }}
          />
        </View>
      </Modal>

    </View>
  )
}

// ─── Screen styles ────────────────────────────────────────────────────────────

const PRIMARY      = '#b50033'
const ERROR_COLOR  = '#de2a68'

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: Colors.white,
  },
  flex1: { flex: 1 },

  // ── Header ──
  header: {
    height:          56,
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.white,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       4,
  },
  backBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
    marginLeft:     14,
  },
  headerTitle: {
    fontSize:   16,
    fontWeight: '500',
    color:      '#333333',
    marginLeft: 6,
  },

  // ── Scroll ──
  scroll: {
    paddingHorizontal: 24,
    paddingTop:        0,
  },

  // ── Gift banner ──
  banner: {
    marginHorizontal:  -24,
    paddingHorizontal: 24,
    paddingVertical:   28,
    flexDirection:     'row',
    alignItems:        'center',
    minHeight:         155,
  },
  bannerText: {
    flex: 1,
  },
  bannerLine: {
    fontSize:   16,
    fontWeight: '400',
    color:      '#000000',
    lineHeight: 24,
  },
  bannerHighlight: {
    fontSize:   16,
    fontWeight: '600',
    color:      '#c9050b',
    lineHeight: 24,
  },
  bannerIcon: {
    width:          130,
    height:         120,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },

  // ── Partner name input ──
  inputWrap: {
    marginTop:         24,
    height:            48,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       '#b0b0b0',
    paddingHorizontal: 16,
    backgroundColor:   Colors.white,
    justifyContent:    'center',
  },
  inputWrapError: {
    borderColor: ERROR_COLOR,
  },
  textInput: {
    fontSize:   14,
    fontWeight: '400',
    color:      '#000000',
    padding:    0,
    margin:     0,
  },
  placeholderRow: {
    position:      'absolute',
    left:          16,
    right:         16,
    flexDirection: 'row',
    alignItems:    'center',
  },
  placeholderText: {
    fontSize:   14,
    color:      '#8a8a8a',
    lineHeight: 20,
  },
  placeholderAsterisk: {
    fontSize:   14,
    color:      '#f11b37',
    lineHeight: 20,
  },
  nameError: {
    fontSize:  12,
    color:     ERROR_COLOR,
    marginTop: 4,
  },

  // ── Chip row ──
  chipRow: {
    flexDirection: 'row',
    gap:           12,
    marginTop:     16,
    flexWrap:      'wrap',
  },

  // ── Sub field (below chips) ──
  subField: {
    marginTop: 20,
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: 24,
    paddingTop:        16,
    backgroundColor:   Colors.white,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: -2 },
    shadowOpacity:     0.04,
    shadowRadius:      4,
    elevation:         4,
  },
})

// ─── Chip styles ──────────────────────────────────────────────────────────────

const chip = StyleSheet.create({
  base: {
    height:            40,
    paddingHorizontal: 16,
    borderRadius:      20,
    borderWidth:       1,
    alignItems:        'center',
    justifyContent:    'center',
  },
  unselected: {
    borderColor:     '#b0b0b0',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  selected: {
    borderColor:     'rgba(181,0,51,0.4)',
    backgroundColor: 'rgba(181,0,51,0.02)',
  },
  label: {
    fontSize:   14,
    fontWeight: '400',
    color:      '#000000',
  },
  labelSelected: {
    fontWeight: '600',
    color:      PRIMARY,
  },
})

// ─── FloatingLabelField styles ────────────────────────────────────────────────

const fl = StyleSheet.create({
  wrap: {
    height:            48,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       '#b0b0b0',
    paddingHorizontal: 16,
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.white,
  },
  labelWrap: {
    position:          'absolute',
    top:               -8,
    left:              12,
    backgroundColor:   Colors.white,
    paddingHorizontal: 4,
    zIndex:            1,
  },
  label: {
    fontSize:   12,
    fontWeight: '400',
    color:      '#000000',
    lineHeight: 16,
  },
  value: {
    flex:       1,
    fontSize:   14,
    fontWeight: '500',
    color:      '#000000',
  },
  placeholder: {
    color: '#8a8a8a',
  },
  chevronWrap: {
    width:          24,
    height:         24,
    alignItems:     'center',
    justifyContent: 'center',
    transform:      [{ rotate: '90deg' }],
  },
})

// ─── MonthPickerSheet styles ──────────────────────────────────────────────────

const mp = StyleSheet.create({
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      Colors.white,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingTop:           12,
    shadowColor:          '#000',
    shadowOpacity:        0.15,
    shadowRadius:         16,
    shadowOffset:         { width: 0, height: -4 },
    elevation:            16,
  },
  row: {
    paddingVertical:   16,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(204,204,204,0.5)',
  },
  rowSelected: {
    backgroundColor: 'rgba(181,0,51,0.04)',
  },
  rowText: {
    fontSize:   14,
    fontWeight: '400',
    color:      '#000000',
  },
  rowTextSelected: {
    fontWeight: '600',
    color:      PRIMARY,
  },
})

// ─── Marriage date fields styles ──────────────────────────────────────────────

const mds = StyleSheet.create({
  fieldsRow: {
    flexDirection: 'row',
    gap:           12,
  },

  field: {
    flex:            1,
    height:          48,
    borderWidth:     1,
    borderColor:     '#b0b0b0',
    borderRadius:    8,
    backgroundColor: Colors.white,
    overflow:        'visible',
    justifyContent:  'center',
  },
  fieldOpen: {
    borderBottomLeftRadius:  0,
    borderBottomRightRadius: 0,
    borderBottomColor:       Colors.white,
  },

  fieldLabel: {
    position:          'absolute',
    top:               -8,
    left:              12,
    backgroundColor:   Colors.white,
    paddingHorizontal: 4,
    zIndex:            10,
  },
  fieldLabelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      '#8a8a8a',
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
    color:      '#000000',
  },
  fieldPlaceholder: {
    fontWeight: '400',
    color:      '#8a8a8a',
  },
  chevron: {
    fontSize:   13,
    color:      '#8a8a8a',
    lineHeight: 18,
  },

  // Inline dropdown list
  dropdown: {
    backgroundColor: Colors.white,
    borderWidth:     1,
    borderTopWidth:  0,
    borderColor:     '#b0b0b0',
    borderBottomLeftRadius:  8,
    borderBottomRightRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor:   '#000',
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
    color:      '#000000',
  },
  dropdownItemTextSel: {
    fontWeight: '600',
    color:      PRIMARY,
  },
})
