import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '../../constants/colors'
import { Fonts, FontSize } from '../../src/theme/fonts'
import { generateHoroscope, getRegValues } from '../../service/registrationService'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Constants ────────────────────────────────────────────────────────────────
// Angular pageType 31 — birth-time picker (registration-revamp.component.html):
// a single native `ion-datetime presentation="time" preferWheel` — one scrolling
// HH:MM AM/PM wheel, "Hrs"/"Min" column labels pinned above, a bold ":" injected
// between the hour/minute columns. applyDateTimeCustomizations()
// (registration-revamp.component.ts ~3845) shadow-DOM-overrides Ionic's own
// wheel: 40px-tall rows at 14px/#808080, growing to a 54px/#F0F0F0/8px-radius
// pill at 20px/500/#000 for the centered active row, plus a white-fade gradient
// masking only the BOTTOM ~120px of the 280px wheel (.picker-after) — no fade
// at the top. Ported here as three synced scroll-snap columns since RN has no
// equivalent native wheel control.
//
// Angular's page-31 config entry (registration.config.ts) has NO ICONTYPE
// field at all, and the shared page-icon block is gated on
// *ngIf="regPageContent?.ICONTYPE" — so Angular renders no icon here, and the
// title sits close under the header. Every other onboarding screen has an
// ICONTYPE and shows one; this one deliberately doesn't.

const ROW_H      = 40           // Angular: inactive .picker-item height
const ACTIVE_H   = 46           // Selected-value box (was Angular's 54 — reduced per design reference)
// Angular's wheel: ion-picker-internal is 280px tall but pulled up by
// margin-top:-70px inside the 294px .datetime-wrapper — so only ~210px
// (≈5 rows) actually shows below the "Hrs"/"Min" labels, with the boxed
// active row sitting close under them, not deep in the middle of a taller
// block. VISIBLE=5 reproduces that compact, close-to-the-labels look.
const VISIBLE    = 5            // odd count so one row sits dead-center
const WHEEL_H    = ROW_H * VISIBLE
const COLON_W    = 24            // total horizontal footprint of the ":" — shared
                                  // between the wheel row and its label-row spacer
                                  // so "Hrs"/"Min" stay centered over their columns

// The box sits directly under the "Hrs"/"Min" labels with nothing visible
// above it; scrollable rows trail off (faded) BELOW the box, wheel-tail style.
const BELOW_ROWS  = 2
const CLIP_H      = ACTIVE_H + BELOW_ROWS * ROW_H

const HOURS     = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
const MINUTES   = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const MERIDIANS = ['AM', 'PM']

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Wheel column ─────────────────────────────────────────────────────────────
// One scroll-snap column of a multi-column time wheel, uniform ROW_H rows (so
// scroll-snap math stays exact). Whichever row is nearest the centered pill
// gets highlighted LIVE as the user drags (not just once they let go) — the
// same "value crosses the center → lights up" feel as Ionic's native wheel —
// and releasing always settles exactly on a row (never a half-scrolled gap),
// so the highlight is always centered on the box.
//
// The boxed/centered row sits at the TOP of the visible area — nothing shows
// above it — while a couple of rows trail off, faded, below it (wheel-tail
// style). The outer wrapper clips to CLIP_H (box height + BELOW_ROWS), and the
// full WHEEL_H-tall ScrollView is positioned inside so its centered row lines
// up with the box at that window's top edge, not its middle.

function WheelColumn({
  data, selected, onChange,
}: {
  data:     string[]
  selected: string
  onChange: (value: string) => void
}) {
  const listRef = useRef<ScrollView>(null)
  const padCount = (VISIBLE - 1) / 2
  const selectedIndex = Math.max(0, data.indexOf(selected))

  // Live-tracked "row nearest center right now" — updates continuously while
  // scrolling so the highlight follows the wheel instead of waiting for release.
  const [liveIndex, setLiveIndex] = useState(selectedIndex)
  const isUserScrolling = useRef(false)
  // Guards against a settle firing twice for the same stop (touch: both
  // onScrollEndDrag's no-momentum fallback AND onMomentumScrollEnd can fire
  // for one gesture; wheel/trackpad: the debounce timer below could in theory
  // race a drag-based settle) — without this a single stop could commit twice.
  const settledForThisGesture = useRef(false)
  // Debounce fallback for scroll-stop detection: react-native-web's ScrollView
  // never fires onScrollBeginDrag/onScrollEndDrag/onMomentumScrollEnd for
  // mouse-wheel or trackpad input at all (those three are touch-gesture-only
  // there) — without this, wheel-scrolling would visually track the highlight
  // (handleScroll below) but never actually commit a selection or snap into
  // place, since settleGesture would never get called.
  const settleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isUserScrolling.current) return
    setLiveIndex(selectedIndex)
    // Deferred a frame: on mount (and right after the async getRegValues()
    // prefill resolves), the ScrollView may not have finished laying out its
    // content yet — calling scrollTo() before that can silently no-op on web,
    // leaving the box showing the initial "01:00 AM" default forever instead
    // of jumping to the actual saved/current time once it's known.
    const raf = requestAnimationFrame(() => {
      listRef.current?.scrollTo({ y: selectedIndex * ROW_H, animated: false })
    })
    return () => cancelAnimationFrame(raf)
  }, [selectedIndex])

  useEffect(() => () => {
    if (settleDebounce.current) clearTimeout(settleDebounce.current)
  }, [])

  function indexFromOffset(offsetY: number) {
    const index = Math.round(offsetY / ROW_H)
    return Math.max(0, Math.min(data.length - 1, index))
  }

  function settleGesture(offsetY: number) {
    if (settledForThisGesture.current) return
    settledForThisGesture.current = true
    isUserScrolling.current = false

    const index = indexFromOffset(offsetY)
    setLiveIndex(index)
    // Snap precisely onto the row's center — guarantees the wheel never rests
    // mid-row, so the highlighted value is always exactly the centered one.
    listRef.current?.scrollTo({ y: index * ROW_H, animated: true })

    const value = data[index]
    if (value !== undefined && value !== selected) onChange(value)
  }

  // Fires on every scroll frame — keeps the pill's highlighted value in sync
  // with whatever row is passing through center, live, mid-drag/mid-glide/
  // mid-wheel-scroll — and (re)arms the debounce fallback so wheel/trackpad
  // scrolling still settles even though it never fires the drag/momentum events.
  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetY = e.nativeEvent.contentOffset.y
    setLiveIndex(indexFromOffset(offsetY))

    settledForThisGesture.current = false
    if (settleDebounce.current) clearTimeout(settleDebounce.current)
    settleDebounce.current = setTimeout(() => settleGesture(offsetY), 120)
  }

  return (
    // Clip window — CLIP_H tall (box + a couple of trailing rows below it).
    // The taller ScrollView beneath is positioned so its centered row lines up
    // with the box sitting at THIS window's top edge (see wheelScrollPositioner).
    <View style={styles.wheelColumn}>
      {/* This column's own selection pill — Angular's active picker-item is
          scoped per ion-picker-column-internal (54px, #F0F0F0, 8px radius),
          NOT one band spanning all three columns. */}
      <View pointerEvents="none" style={styles.selectionBand} />

      <ScrollView
        ref={listRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={() => {
          isUserScrolling.current = true
          settledForThisGesture.current = false
        }}
        onMomentumScrollEnd={e => settleGesture(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={e => {
          // Covers the case where a slow drag ends with no momentum phase.
          // (When momentum DOES follow, onMomentumScrollEnd fires afterward and
          // settleGesture's guard makes it a no-op — no double commit.)
          if (e.nativeEvent.velocity && Math.abs(e.nativeEvent.velocity.y) > 0.05) return
          settleGesture(e.nativeEvent.contentOffset.y)
        }}
        // react-native-web's ScrollView does NOT implement snapToInterval (it's a
        // native-only prop there) — without real browser scroll-snap, the wheel
        // can coast to rest at any pixel offset on web, so the row sitting in the
        // box and the JS-computed "live" highlighted row can disagree for a beat
        // until the corrective scrollTo above catches up. CSS scroll-snap makes
        // the browser itself stop exactly on a row boundary, closing that gap.
        style={[
          styles.wheelScrollPositioner,
          Platform.OS === 'web'
            ? ({ scrollSnapType: 'y mandatory', overscrollBehavior: 'contain' } as any)
            : null,
        ]}
        contentContainerStyle={{ paddingVertical: padCount * ROW_H }}
      >
        {data.map((value, index) => {
          const isLive = index === liveIndex
          return (
            <View
              key={value}
              style={[
                styles.wheelRow,
                Platform.OS === 'web' ? ({ scrollSnapAlign: 'center' } as any) : null,
              ]}
            >
              <Text style={[styles.wheelText, isLive && styles.wheelTextSel]}>{value}</Text>
            </View>
          )
        })}
      </ScrollView>

      {/* Fades out the trailing rows below the box — Angular's .picker-after
          gradient does the same at the bottom of its (taller) wheel. */}
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', Colors.surface]}
        style={styles.fadeMaskBottom}
      />
    </View>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HoroscopeTimeScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  const [createdBy,  setCreatedBy]  = useState('4')
  // Angular getCTAName(): showNextCTA is hardcoded true for pageType 31 — the
  // wheel always has a value (prefilled or defaulted to "now"), so Next never
  // waits on a "some field still unset" check the way other steps do.
  const [selHour,    setSelHour]    = useState('01')
  const [selMinute,  setSelMinute]  = useState('00')
  const [selMeridian, setSelMeridian] = useState<'AM' | 'PM'>('AM')
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    getRegValues().then(rv => {
      if (rv.CREATEDBY) setCreatedBy(rv.CREATEDBY)

      // Angular preFetchHotoscopeTime(): parse saved 24-hour "HH:MM", else default to now
      if (rv.TIMEOFBIRTH) {
        const [h24, m] = rv.TIMEOFBIRTH.split(':').map(Number)
        const meridian: 'AM' | 'PM' = h24 < 12 ? 'AM' : 'PM'
        const h12 = h24 % 12 || 12
        setSelHour(String(h12).padStart(2, '0'))
        setSelMinute(String(m).padStart(2, '0'))
        setSelMeridian(meridian)
      } else {
        const now = new Date()
        const h24 = now.getHours()
        setSelHour(String(h24 % 12 || 12).padStart(2, '0'))
        setSelMinute(String(now.getMinutes()).padStart(2, '0'))
        setSelMeridian(h24 < 12 ? 'AM' : 'PM')
      }
    })
  }, [])

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  // Angular's actual i18n key for this page is REGISTRATION.SELECTBIRTH (see
  // en.json and every other locale file) — SELECTTIMEOFBIRTH doesn't exist in
  // any locale, so t() was silently falling back to the English default text
  // on every language, never actually translating.
  const title = t('REGISTRATION.SELECTBIRTH', 'Select #PROFILETYPE# time of birth')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  async function handleNext() {
    if (submitting) return
    setSubmitting(true)
    try {
      const rv = await getRegValues()
      const ok = await generateHoroscope({
        date:     rv.DATE  ?? '',
        month:    rv.MONTH ?? '',
        year:     rv.YEAR  ?? '',
        hour:     String(Number(selHour)),
        minute:   String(Number(selMinute)),
        meridian: selMeridian,
        stateId:  rv.HOROSTATE ?? '',
        cityKey:  rv.HOROCITY  ?? '',
      })
      if (ok) {
        // Angular generateHoroscope(): success toast (REG.HOROSUCCESS) on
        // navigating to the next step. Passed as a param so the onboarding
        // shell shows it on page 32 — a toast rendered here would be hidden
        // under the pushed screen (see OnboardingRouter's pendingToast).
        const toast = t('REG.HOROSUCCESS', 'Horoscope Generated Successfully!')
        // Angular: landingNextPage[31] = "/onboarding/32" (Dosham) — this port's
        // pageNo '32' is DoshamScreen, matching that target exactly. (Angular's
        // own Star/Raasi step is a DIFFERENT page — 26 — earlier in its flow,
        // well before the horoscope sub-flow even starts; it isn't page 31's
        // next step in Angular at all, despite this port's pageNo '33' being
        // named StarRaasiScreen.)
        navigation.push('onboarding', { pageNo: '32', toast })
      }
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  // "I'll do this later" removed on this screen per product direction — Angular's
  // own config does set SHOWSKIPBTN: true for page 31, but this port
  // deliberately omits the skip link here regardless.
  useOnboardingFooter({
    nextLoading: submitting,
    onNext:      handleNext,
  }, [submitting])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* No page icon on this screen — Angular's page-31 config has no
            ICONTYPE, so its icon block (gated on ICONTYPE) never renders. */}
        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        <View style={styles.wheelWrap}>
          {/* Column labels — Angular's .column-labels, pinned above the wheel.
              Mirrors the wheel row's own structure (Hour col / colon spacer /
              Minute col / colon spacer / AM-PM col) so "Hrs" and "Min" land
              centered directly over their columns instead of drifting from the
              colons' width not being accounted for here. */}
          <View style={styles.columnLabels}>
            <Text style={[styles.columnLabel, { fontFamily: langFonts.medium }]}>{t('REGISTRATION.HRS', 'Hrs')}</Text>
            <View style={styles.colonSpacer} />
            <Text style={[styles.columnLabel, { fontFamily: langFonts.medium }]}>{t('REGISTRATION.MINS', 'Min')}</Text>
            <View style={styles.colonSpacer} />
            <Text style={styles.columnLabel} />
          </View>

          <View style={styles.wheelBody}>
            <WheelColumn data={HOURS}     selected={selHour}     onChange={setSelHour} />
            <Text style={styles.colon}>:</Text>
            <WheelColumn data={MINUTES}   selected={selMinute}   onChange={setSelMinute} />
            {/* Second colon between Minute and AM/PM — same treatment as the
                Hour/Minute colon, per product direction. */}
            <Text style={styles.colon}>:</Text>
            <WheelColumn data={MERIDIANS} selected={selMeridian} onChange={v => setSelMeridian(v as 'AM' | 'PM')} />
          </View>
        </View>
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}

    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wheelWrap: {
    alignSelf: 'flex-start',   // left-aligned, not centered on the screen
    width:     '100%',
    // 3 columns × ~56 + 2 colons × COLON_W — keeps the boxes grouped tightly
    // (as in the design reference) instead of spread across 300px.
    maxWidth:  216,
  },

  columnLabels: {
    flexDirection: 'row',
    marginBottom:  8,
    // No justifyContent here on purpose — every child is either flex:1 (Hrs
    // label / Min label / AM-PM spacer) or a fixed COLON_W spacer, so they
    // already fill columnLabels' full width with nothing left to distribute.
    // (space-around was a no-op here, kept only for confusion's sake before.)
  },
  columnLabel: {
    flex:       1,
    fontSize:   FontSize.font16,
    fontWeight: '500',
    color:      Colors.black,
    textAlign:  'center',
  },
  colonSpacer: {
    width: COLON_W,
  },

  wheelBody: {
    flexDirection: 'row',
    alignItems:    'flex-start',   // columns' own boxes sit at the top of the
                                    // wheelBody row (see wheelColumn/selectionBand);
                                    // 'center' here would center columns across
                                    // the whole CLIP_H including the trailing rows.
    // No justifyContent here either — same flex:1 + fixed-colon structure as
    // columnLabels above, kept identical so both rows' columns land at exactly
    // the same x-position with nothing to redistribute.
    height: CLIP_H,   // box height + the trailing rows visible below it
  },

  // The clip window — CLIP_H tall (box on top + BELOW_ROWS trailing rows).
  // The full WHEEL_H-tall ScrollView still exists inside it (see
  // wheelScrollPositioner) so there's real vertical room to drag.
  wheelColumn: {
    flex:       1,
    height:     CLIP_H,
    position:   'relative',
    alignItems: 'center',   // so the absolutely-positioned selectionBand (width:
                             // ACTIVE_H, left unset) centers horizontally within
                             // this column instead of pinning to its left edge
    overflow:   'hidden',
  },
  // Shifts the (taller) ScrollView up so its centered row lines up with the box
  // at the TOP of wheelColumn's clip window (not the window's own center) —
  // the same offset as a plain centered wheel, since only the window grew
  // downward to reveal trailing rows; the box's own position didn't move.
  wheelScrollPositioner: {
    position: 'absolute',
    top:      -(WHEEL_H - ACTIVE_H) / 2,
    left:     0,
    right:    0,
    height:   WHEEL_H,
  },
  wheelRow: {
    height:         ROW_H,
    alignItems:     'center',
    justifyContent: 'center',
  },
  wheelText: {
    // Poppins Regular always — these are numerals/AM-PM, not translated text,
    // so they don't switch to the per-language NotoSans family the way the
    // title/labels do via useLanguageFonts().
    fontFamily: Fonts.poppinsRegular,
    fontSize:   FontSize.font14,
    color:      '#808080',   // Angular: .picker-item color, exact match
  },
  wheelTextSel: {
    fontFamily: Fonts.poppinsRegular,
    fontSize:   FontSize.font18,   // was font20 — sized down with the smaller box
    fontWeight: '500',
    color:      Colors.black,
  },

  colon: {
    width:      COLON_W,
    height:     ACTIVE_H,       // matches the box's height so its own line-height
    lineHeight: ACTIVE_H,       // centers vertically within that same top-aligned
    fontFamily: Fonts.poppinsRegular,
    fontSize:   FontSize.font24,             // space, now that wheelBody uses flex-start
    fontWeight: '700',
    color:      Colors.black,
    textAlign:  'center',
  },

  selectionBand: {
    position:        'absolute',
    alignSelf:       'center',
    top:             0,   // the box sits at the very top of the clip window
    width:           ACTIVE_H,   // square box (see ACTIVE_H),
    height:          ACTIVE_H,   // not a bar spanning the column's full width
    backgroundColor: Colors.divider,   // Angular: #F0F0F0
    borderRadius:    8,
  },

  fadeMaskBottom: {
    position: 'absolute',
    left:     0,
    right:    0,
    bottom:   0,
    height:   BELOW_ROWS * ROW_H,
  },
})
