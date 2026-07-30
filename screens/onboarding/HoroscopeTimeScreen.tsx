import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { Colors } from '../../constants/colors'
import { generateHoroscope, getRegValues } from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────
// Angular pageType 31 — birth-time picker. Figma shows a scrolling wheel with
// fading rows; per product decision, ported as the same Modal+FlatList dropdown
// pattern DOBScreen.tsx already uses for Date/Month/Year, not a custom wheel.
const CDN_PAGE_ICON = CDN_REG + 'horoscope-generate.svg'
const ITEM_H        = 40

const HOURS     = Array.from({ length: 12 }, (_, i) => ({ key: String(i + 1), label: String(i + 1).padStart(2, '0') }))
const MINUTES   = Array.from({ length: 60 }, (_, i) => ({ key: String(i),     label: String(i).padStart(2, '0') }))
const MERIDIANS = [{ key: 'AM', label: 'AM' }, { key: 'PM', label: 'PM' }]

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldKey     = 'hour' | 'minute' | 'meridian'
type DropdownPos  = { top: number; left: number; width: number; fieldBottom: number }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HoroscopeTimeScreen({ navigation }: Props) {
  const { t } = useTranslation()

  const [createdBy,  setCreatedBy]  = useState('4')
  const [selHour,    setSelHour]    = useState('')
  const [selMinute,  setSelMinute]  = useState('')
  const [selMeridian, setSelMeridian] = useState<'AM' | 'PM' | ''>('')
  const [submitting, setSubmitting] = useState(false)

  const [pickerField, setPickerField] = useState<FieldKey | null>(null)
  const [dropdownPos, setDropdownPos] = useState<DropdownPos>({ top: 0, left: 0, width: 94, fieldBottom: 0 })

  const hourRef     = useRef<View>(null)
  const minuteRef   = useRef<View>(null)
  const meridianRef = useRef<View>(null)

  useEffect(() => {
    getRegValues().then(rv => {
      if (rv.CREATEDBY) setCreatedBy(rv.CREATEDBY)

      // Angular preFetchHotoscopeTime(): parse saved 24-hour "HH:MM", else default to now
      if (rv.TIMEOFBIRTH) {
        const [h24, m] = rv.TIMEOFBIRTH.split(':').map(Number)
        const meridian: 'AM' | 'PM' = h24 < 12 ? 'AM' : 'PM'
        const h12 = h24 % 12 || 12
        setSelHour(String(h12))
        setSelMinute(String(m))
        setSelMeridian(meridian)
      } else {
        const now = new Date()
        const h24 = now.getHours()
        setSelHour(String(h24 % 12 || 12))
        setSelMinute(String(now.getMinutes()))
        setSelMeridian(h24 < 12 ? 'AM' : 'PM')
      }
    })
  }, [])

  function refFor(field: FieldKey) {
    if (field === 'hour')   return hourRef
    if (field === 'minute') return minuteRef
    return meridianRef
  }

  function getOptions(field: FieldKey) {
    if (field === 'hour')   return HOURS
    if (field === 'minute') return MINUTES
    return MERIDIANS
  }

  function getCurrentVal(field: FieldKey) {
    if (field === 'hour')   return selHour
    if (field === 'minute') return selMinute
    return selMeridian
  }

  function openPicker(field: FieldKey) {
    const ref = refFor(field)
    ref.current?.measureInWindow((x, y, w, h) => {
      setDropdownPos({ top: y, left: x, width: w, fieldBottom: y + h })
      setPickerField(field)
    })
  }

  function handlePickerSelect(field: FieldKey, key: string) {
    if (field === 'hour')        setSelHour(key)
    else if (field === 'minute') setSelMinute(key)
    else                          setSelMeridian(key as 'AM' | 'PM')
    setPickerField(null)
  }

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.SELECTTIMEOFBIRTH', 'Select #PROFILETYPE# time of birth')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  const isAllSelected = !!selHour && selMinute !== '' && !!selMeridian

  async function handleNext() {
    if (!isAllSelected || submitting) return
    setSubmitting(true)
    try {
      const rv = await getRegValues()
      await generateHoroscope({
        date:     rv.DATE  ?? '',
        month:    rv.MONTH ?? '',
        year:     rv.YEAR  ?? '',
        hour:     selHour,
        minute:   selMinute,
        meridian: selMeridian as 'AM' | 'PM',
        stateId:  rv.HOROSTATE ?? '',
        cityKey:  rv.HOROCITY  ?? '',
      })
      // StarRaasi (moved to page 33) — lets the user review/adjust the
      // auto-derived Star & Raasi before continuing to Dosham.
      navigation.push('onboarding', { pageNo: '33' })
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  function handleSkip() {
    navigation.push('onboarding', { pageNo: '32' })
  }

  useOnboardingFooter({
    nextDisabled: !isAllSelected,
    nextLoading:  submitting,
    onNext:       handleNext,
    showSkip:     true,
    skipLabel:    t('REG.DO_LATER', "I'll do this later"),
    onSkip:       handleSkip,
  }, [isAllSelected, submitting])

  // ─── Render ───────────────────────────────────────────────────────────────

  const pickerOptions = pickerField ? getOptions(pickerField) : []
  const currentVal    = pickerField ? getCurrentVal(pickerField) : ''
  const listH = Math.min(pickerOptions.length, 5) * ITEM_H

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
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />
        <Text style={os.title}>{title}</Text>

        <View style={styles.fieldsRow}>
          {(
            [
              { field: 'hour'     as FieldKey, ref: hourRef,     display: selHour ? selHour.padStart(2, '0') : '', label: t('REGISTRATION.HRS', 'Hrs') },
              { field: 'minute'   as FieldKey, ref: minuteRef,   display: selMinute !== '' ? selMinute.padStart(2, '0') : '', label: t('REGISTRATION.MIN', 'Min') },
              { field: 'meridian' as FieldKey, ref: meridianRef, display: selMeridian, label: '' },
            ] as const
          ).map(({ field, ref, display, label }) => {
            const isOpen = pickerField === field
            return (
              <View key={field} style={styles.fieldWrapper}>
                {!!label && <Text style={styles.fieldLabel}>{label}</Text>}
                <View
                  ref={ref as any}
                  style={[styles.field, isOpen && styles.fieldOpen]}
                >
                  <Pressable
                    style={styles.fieldPressable}
                    onPress={() => openPicker(field)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${field}`}
                  >
                    <Text style={styles.fieldText} numberOfLines={1}>{display}</Text>
                  </Pressable>
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}

      <Modal
        visible={pickerField !== null}
        transparent
        animationType="none"
        onRequestClose={() => setPickerField(null)}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setPickerField(null)} />

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
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fieldsRow: {
    flexDirection: 'row',
    gap:           15,
  },

  fieldWrapper: { flex: 1 },
  fieldLabel: {
    fontSize:     16,
    fontWeight:   '500',
    color:        Colors.textPrimary,
    marginBottom: 8,
  },

  field: {
    height:          48,
    borderWidth:     1,
    borderColor:     Colors.inputBorder,
    borderRadius:    8,
    backgroundColor: Colors.surface,
    overflow:        'visible',
    justifyContent:  'center',
  },
  fieldOpen: {
    borderBottomLeftRadius:  0,
    borderBottomRightRadius: 0,
    borderBottomColor:       Colors.surface,
  },

  fieldPressable: {
    alignItems:        'center',
    justifyContent:    'center',
    height:            48,
  },
  fieldText: {
    fontSize:   16,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },

  dropdown: {
    backgroundColor: Colors.surface,
    borderWidth:     1,
    borderTopWidth:  0,
    borderColor:     Colors.inputBorder,
    borderBottomLeftRadius:  8,
    borderBottomRightRadius: 8,
  },
  dropdownItem: {
    height:            ITEM_H,
    justifyContent:    'center',
    alignItems:        'center',
  },
  dropdownItemSel: {
    backgroundColor: Colors.selectionBg,
  },
  dropdownItemText: {
    fontSize:   16,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  dropdownItemTextSel: {
    fontWeight: '600',
    color:      Colors.primaryDark,
  },
})
