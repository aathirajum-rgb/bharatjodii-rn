// Angular: pages/recharge/book-appointment/book-appointment.page.html + .ts —
// reached from PayAtStoreScreen.tsx after picking a specific store. This is
// the actual "confirm a visit" submit step (nbpayatretailstore) that screen
// was missing — it previously only ever browsed state/city/store lists.
//
// Angular lets the user pick any time via a free-form ion-datetime wheel;
// this port replaces that with a fixed list of business-hour slots instead —
// there's no time-wheel picker component in this codebase yet, and adding a
// new native picker dependency is out of scope for this fix.

import { Fragment, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN, CDN_REACT, CDN_LOTTIE } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import CdnLottie from '../../components/CdnLottie'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { handleBack as handleRootBack } from '../../utils/navigationRef'
import { getPostBookingDestination, submitStoreAppointment } from '../../service/paymentService'

const ICON_BACK         = CDN_REACT + '/menu_back_arrow.svg'
const ICON_EDIT         = CDN + 'assets/images/svg/edit-icon.svg'
const ICON_EXPAND_MINUS = CDN + 'assets/images/svg/expand-minus-icon.svg'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Business-hour slots, 1-hour apart — [display label, 24h "HH:mm:ss"].
const TIME_SLOTS: { label: string; value: string }[] = [
  { label: '10:00 AM', value: '10:00:00' },
  { label: '11:00 AM', value: '11:00:00' },
  { label: '12:00 PM', value: '12:00:00' },
  { label: '1:00 PM',  value: '13:00:00' },
  { label: '2:00 PM',  value: '14:00:00' },
  { label: '3:00 PM',  value: '15:00:00' },
  { label: '4:00 PM',  value: '16:00:00' },
  { label: '5:00 PM',  value: '17:00:00' },
  { label: '6:00 PM',  value: '18:00:00' },
]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

type Props = { navigation: any; route: any }

type FieldKey = 'year' | 'month' | 'day' | 'time'

export default function BookAppointmentScreen({ navigation, route }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const branch  = route.params?.branch ?? ''
  const address = route.params?.address ?? ''
  const packageId = route.params?.selectedPackage?.PACKAGEID ?? ''

  const now = useMemo(() => new Date(), [])
  const years = useMemo(() => [now.getFullYear(), now.getFullYear() + 1], [now])

  const [expanded, setExpanded]   = useState<FieldKey | null>(null)
  const [year, setYear]           = useState<number | null>(now.getFullYear())
  const [month, setMonth]         = useState<number | null>(now.getMonth() + 1)
  const [day, setDay]             = useState<number | null>(now.getDate())
  const [time, setTime]           = useState<{ label: string; value: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess]     = useState(false)

  const daysInMonth = useMemo(() => {
    if (!year || !month) return []
    const total = new Date(year, month, 0).getDate()
    return Array.from({ length: total }, (_, i) => i + 1)
  }, [year, month])

  // Angular: compareDate() — the submit button only enables once the
  // selected date+time is actually in the future.
  const selectedDate = useMemo(() => {
    if (!year || !month || !day || !time) return null
    const d = new Date(`${year}-${pad(month)}-${pad(day)} ${time.value}`)
    return isNaN(d.getTime()) ? null : d
  }, [year, month, day, time])

  const canSubmit = !!selectedDate && selectedDate.getTime() >= now.getTime()

  function handleBack() {
    if (navigation.canGoBack()) handleRootBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  function toggle(field: FieldKey) {
    setExpanded(prev => (prev === field ? null : field))
  }

  async function handleSubmit() {
    if (!canSubmit || !year || !month || !day || !time) return
    setSubmitting(true)
    try {
      const ok = await submitStoreAppointment({
        packageId,
        branchAddress: branch,
        visitingDate:  `${year}-${pad(month)}-${pad(day)}`,
        fromTime:      time.value,
      })
      if (!ok) {
        Alert.alert('Error', 'Could not book your appointment. Please try again.')
        return
      }
      setSuccess(true)
      setTimeout(async () => {
        const destination = await getPostBookingDestination()
        navigation.reset({ index: 0, routes: [{ name: destination }] })
      }, 2000)
    } catch {
      Alert.alert('Error', 'Could not book your appointment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <View style={[s.screen, s.centered, { paddingTop: insets.top }]}>
        <CdnLottie uri={CDN_LOTTIE + 'success-animation-lottie.json'} width={160} height={160} loop={false} />
      </View>
    )
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('RECHARGE.BOOKAPPOINT')}</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 96 }]}>
        <Text style={s.sectionLabel}>{t('RECHARGE.SELECTEDBRANCH')}</Text>
        <View style={s.branchCard}>
          <Text style={s.branchTitle}>{branch}</Text>
          {!!address && <Text style={s.branchAddress}>{address}</Text>}
        </View>

        <Text style={s.sectionLabel}>{t('RECHARGE.SELECTPREFERDATE')}</Text>
        <View style={s.card}>
          <FieldRow
            label={t('RECHARGE.YEAR')}
            value={year != null ? String(year) : ''}
            expanded={expanded === 'year'}
            onPress={() => toggle('year')}
          />
          {expanded === 'year' && (
            <RadioList
              items={years.map(y => ({ key: String(y), label: String(y) }))}
              selectedKey={year != null ? String(year) : undefined}
              onSelect={key => { setYear(Number(key)); setExpanded(null) }}
            />
          )}

          <FieldRow
            label={t('RECHARGE.MONTH')}
            value={month != null ? MONTH_NAMES[month - 1] ?? '' : ''}
            expanded={expanded === 'month'}
            onPress={() => toggle('month')}
          />
          {expanded === 'month' && (
            <RadioList
              items={MONTH_NAMES.map((name, i) => ({ key: String(i + 1), label: name }))}
              selectedKey={month != null ? String(month) : undefined}
              onSelect={key => { setMonth(Number(key)); setDay(null); setExpanded(null) }}
            />
          )}

          <FieldRow
            label={t('RECHARGE.DATE')}
            value={day != null ? String(day) : ''}
            expanded={expanded === 'day'}
            onPress={() => toggle('day')}
            last
          />
          {expanded === 'day' && (
            <RadioList
              items={daysInMonth.map(d => ({ key: String(d), label: String(d) }))}
              selectedKey={day != null ? String(day) : undefined}
              onSelect={key => { setDay(Number(key)); setExpanded(null) }}
            />
          )}
        </View>

        <Text style={s.sectionLabel}>{t('RECHARGE.SELECTPREFERTIME')}</Text>
        <View style={s.card}>
          <FieldRow
            label={t('RECHARGE.TIME')}
            value={time?.label ?? ''}
            expanded={expanded === 'time'}
            onPress={() => toggle('time')}
            last
          />
          {expanded === 'time' && (
            <RadioList
              items={TIME_SLOTS.map(slot => ({ key: slot.value, label: slot.label }))}
              selectedKey={time?.value}
              onSelect={key => {
                const slot = TIME_SLOTS.find(sl => sl.value === key)
                if (slot) setTime(slot)
                setExpanded(null)
              }}
            />
          )}
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <ButtonRevamp
          label={t('GENERAL.SUBMIT')}
          variant="primary"
          size="large"
          fullWidth
          disabled={!canSubmit}
          loading={submitting}
          onPress={handleSubmit}
          style={{ backgroundColor: Colors.primaryDark }}
        />
      </View>
    </View>
  )
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

function FieldRow({
  label, value, expanded, onPress, last,
}: { label: string; value: string; expanded: boolean; onPress: () => void; last?: boolean }) {
  return (
    <Pressable style={[s.row, last && s.rowLast]} onPress={onPress}>
      <View style={s.rowTextBlock}>
        <Text style={s.rowLabel}>{label}</Text>
        {!!value && <Text style={s.rowValue}>{value}</Text>}
      </View>
      <CdnSvg uri={expanded ? ICON_EXPAND_MINUS : ICON_EDIT} width={20} height={20} />
    </Pressable>
  )
}

// ─── RadioList ────────────────────────────────────────────────────────────────

function RadioList({
  items, selectedKey, onSelect,
}: { items: { key: string; label: string }[]; selectedKey?: string | undefined; onSelect: (key: string) => void }) {
  return (
    <View style={s.radioList}>
      {items.map((item, idx) => (
        <Fragment key={item.key}>
          <Pressable
            style={[s.radioRow, idx === items.length - 1 && s.rowLast]}
            onPress={() => onSelect(item.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selectedKey === item.key }}
          >
            <Text style={s.rowLabel}>{item.label}</Text>
            <View style={[s.radioCircle, selectedKey === item.key && s.radioCircleSelected]}>
              {selectedKey === item.key && <View style={s.radioDot} />}
            </View>
          </Pressable>
        </Fragment>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  centered: { alignItems: 'center', justifyContent: 'center' },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, marginLeft: 16, flex: 1 },

  content: { padding: 16, gap: 16 },
  sectionLabel: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black },

  branchCard: {
    borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle, padding: 16, gap: 4,
  },
  branchTitle:   { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black },
  branchAddress: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.borderSubtle, paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 56, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  rowTextBlock: { flexShrink: 1, gap: 2 },
  rowLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 11, color: Colors.textSecondary },
  rowValue: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black },

  radioList: { paddingBottom: 8 },
  radioRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 48, borderBottomWidth: 1, borderBottomColor: Colors.divider, paddingLeft: 8,
  },
  radioCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primaryDark },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.divider,
  },
})
