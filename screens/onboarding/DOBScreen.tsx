import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Animated,
  Easing,
  Dimensions,
  Keyboard,
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
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import {
  callPartialRegistrationAPI,
  fetchDateOptions,
  fetchMonthOptions,
  fetchYearOptions,
  getRegValue,
  setRegValue,
  setRegValues,
} from '../../service/registrationService'
import { CDN_REG, CDN_REVAMP, CDN_SVG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { stripAndDecodeHtml as stripHtml } from '../../utils/htmlEntities'
import { FontSize } from '../../src/theme/fonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'son-birth-date.svg'
// Angular's revamp-img up/down arrow icons (registration-revamp.component.html) —
// same pair used for all three Date/Month/Year fields, flipped by rotation below
// rather than swapping images, so the direction change animates smoothly.
const CDN_ARROW_DOWN = CDN_REVAMP + 'down-arrow.svg'
// Angular's "Please enter age" link (button.config.ts's LINK_BTN) shows this same
// static icon as its non-animated fallback — used here in place of the Lottie
// forward-animation-link the live link button plays.
const CDN_FORWARD_ICON = CDN_SVG + 'revamp/forward-icon-link.svg'
// Angular's registration-modal-popup getCloseCTA() — the AGE sheet isn't in
// the 'incomeSheet' branch, so it always gets this grey close icon.
const CDN_CLOSE_ICON = CDN_REVAMP + 'close-icon-gray.svg'
// Angular's OR divider (registration-revamp.component.html) flanks the "OR"
// text with these two fading-line images instead of a plain solid bar.
const CDN_OR_LEFT  = CDN_SVG + 'revamp/or-left-side.svg'
const CDN_OR_RIGHT = CDN_SVG + 'revamp/or-right-side.svg'
const SCREEN_H = Dimensions.get('window').height
const ITEM_H        = 40   // Figma: each dropdown row is 40px tall
const MAX_LIST_ITEMS = 7   // how many rows visible before scroll

// Plain KeyboardAvoidingView can't take an Animated.Value directly in its
// `transform` style (only components wrapped by Animated.createAnimatedComponent
// can) — passing ageSlideAnim into a plain KeyboardAvoidingView's style crashed
// with "Transform with key of translateY must be number or a percentage" the
// moment the sheet mounted, since RN read the node's un-animated snapshot value.
const AnimatedKeyboardAvoidingView = Animated.createAnimatedComponent(KeyboardAvoidingView)

// Removes the browser's default black focus outline on web — TextInput renders
// as <input> there, and the outline would sit on top of our custom borderColor.
// Same fix as NameScreen.tsx.
const webOutlineReset = { outlineStyle: 'none', outlineWidth: 0 } as any

// Fallback only — Angular sources month names from the server (registrationArray
// ['MONTH'], server-translated) via fetchMonthOptions() below, not a static list.
// This English list is what's shown until that loads, and what's used if the API
// key is ever missing, so the picker is never empty. This was the screen's ONLY
// list before, which is why month names never switched language.
const MONTH_FALLBACK = [
  { key: '1',  label: 'January'   }, { key: '2',  label: 'February'  },
  { key: '3',  label: 'March'     }, { key: '4',  label: 'April'     },
  { key: '5',  label: 'May'       }, { key: '6',  label: 'June'      },
  { key: '7',  label: 'July'      }, { key: '8',  label: 'August'    },
  { key: '9',  label: 'September' }, { key: '10', label: 'October'   },
  { key: '11', label: 'November'  }, { key: '12', label: 'December'  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Angular's birthYear list (registration.page.ts's apiResponse["YEARS"]) is
// ordered oldest-first (ascending) — the last entry is the current cutoff
// year (`birthYear[birthYear.length - 1]`), not the first. The base list is
// an 18-year floor, but registration.service.ts's c2UpdateDateLists() then
// trims the last 4 entries for non-female profiles when the gap between now
// and that floor year is under 21 — e.g. 2026 floor year 2008 (18y gap) gets
// trimmed to 2004, since male/other's real minimum age is 21, not 18.
function buildYears(gender: string): { key: string; label: string }[] {
  const max = new Date().getFullYear() - 18
  const min = max - 52
  const years = Array.from({ length: max - min + 1 }, (_, i) => {
    const y = String(min + i)
    return { key: y, label: y }
  })

  if (gender !== '0') {
    const lastYear = Number(years[years.length - 1]?.key)
    const yearDif  = new Date().getFullYear() - lastYear
    if (yearDif < 21) return years.slice(0, years.length - 4)
  }
  return years
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
type DropdownPos = { top: number; left: number; width: number; fieldBottom: number; openUp: boolean; fieldTop: number }
type Props     = { navigation: any; route: { params?: { pageNo?: string } } }

// ─── Age badge ────────────────────────────────────────────────────────────────
// Figma: border-width 1px 0px 1px 1px (no right edge), border-image-source
// linear-gradient(90deg, rgba(181,0,51,0.1) -30.82%, #FFFFFF 83.06%), fill
// linear-gradient(90deg, rgba(181,0,51,0) -13.43%, rgba(255,255,255,0.2) 50.2%).
// Built as an outer gradient "border" layer with an inner gradient fill inset
// by 1px on top/left/bottom (flush on the right, matching the 0px right border).
const AGE_BADGE_BORDER_COLORS    = ['rgba(181,0,51,0.1)', '#FFFFFF'] as const
const AGE_BADGE_BORDER_LOCATIONS = [0, 1] as const
// Figma's fill stops are rgba(181,0,51,0) at -13.43% and rgba(255,255,255,0.2)
// at 50.2%. RN's LinearGradient can't take a negative/out-of-range location, so
// the start is pinned to 0 with the real start alpha (0, not 0.08 — the old
// value here didn't match the Figma spec at all), and the second stop is moved
// from 1 to ~0.5 so the gradient still reaches full effect around the visual
// midpoint of the badge, same as the documented 50.2% stop, instead of only at
// the far right edge.
const AGE_BADGE_FILL_COLORS      = ['rgba(181,0,51,0)', 'rgba(255,255,255,0.2)'] as const
const AGE_BADGE_FILL_LOCATIONS   = [0, 0.5] as const

function AgeBadge({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.ageBadgeBorder,
          { backgroundImage: `linear-gradient(90deg, ${AGE_BADGE_BORDER_COLORS[0]}, ${AGE_BADGE_BORDER_COLORS[1]})` } as any,
        ]}
      >
        <View
          style={[
            styles.ageBadge,
            { backgroundImage: `linear-gradient(90deg, ${AGE_BADGE_FILL_COLORS[0]}, ${AGE_BADGE_FILL_COLORS[1]})` } as any,
          ]}
        >
          {children}
        </View>
      </View>
    )
  }
  return (
    <LinearGradient
      colors={AGE_BADGE_BORDER_COLORS}
      locations={AGE_BADGE_BORDER_LOCATIONS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.ageBadgeBorder}
    >
      <LinearGradient
        colors={AGE_BADGE_FILL_COLORS}
        locations={AGE_BADGE_FILL_LOCATIONS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ageBadge}
      >
        {children}
      </LinearGradient>
    </LinearGradient>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DOBScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()
  const langFonts = useLanguageFonts()

  const [createdBy,    setCreatedBy]    = useState('1')
  const [gender,       setGender]       = useState('1')
  const [submitting,   setSubmitting]   = useState(false)

  const [selDate,  setSelDate]  = useState('')
  const [selMonth, setSelMonth] = useState('')
  const [selYear,  setSelYear]  = useState('')
  // Restored from a stored AGE registration value (see the Init effect below)
  // when the user previously entered their age via the "enter age" sheet
  // (handleAgeSubmit) instead of the DOB dropdowns, so the age badge re-populates
  // instead of staying blank when navigating back to this screen.
  // Angular: showAgePage() / isValidAgeValue() — once an age is entered via the
  // sheet (or restored from storage), the page becomes the "Enter your age"
  // page: an editable inline Age input replaces the DOB dropdowns.
  const [ageMode, setAgeMode] = useState(false)
  const [pageAge, setPageAge] = useState('')
  const [pageAgeFocused, setPageAgeFocused] = useState(false)
  const directAge = ageMode && pageAge ? Number(pageAge) : null

  const [months, setMonths] = useState(MONTH_FALLBACK)
  // API-sourced DATE/YEARS lists — null until fetched, so getOptions() can
  // fall back to the client-generated buildYears()/getDaysInMonth() (which
  // are correct in shape but never localise, same MONTH_FALLBACK reasoning).
  const [apiYears, setApiYears] = useState<{ key: string; label: string }[] | null>(null)
  const [apiDates, setApiDates] = useState<{ key: string; label: string }[] | null>(null)

  const [pickerField,  setPickerField]  = useState<FieldKey | null>(null)
  const [dropdownPos,  setDropdownPos]  = useState<DropdownPos>({ top: 0, left: 0, width: 94, fieldBottom: 0, openUp: false, fieldTop: 0 })

  const [showAgeSheet,   setShowAgeSheet]   = useState(false)
  // Keeps the Modal mounted through the closing animation — same as
  // components/bottom-sheet/BottomSheet.tsx's modalVisible/visible split.
  const [ageModalMounted, setAgeModalMounted] = useState(false)
  const [ageInput,        setAgeInput]        = useState('')
  const [ageError,        setAgeError]        = useState('')
  const [ageInputFocused, setAgeInputFocused] = useState(false)
  const ageInputRef = useRef<TextInput>(null)

  // Same border-color precedence as NameScreen.tsx (Angular's .mobile-number
  // ion-item: focused blue always wins, then empty red, then filled grey).
  const ageInputBorderColor = ageInputFocused
    ? Colors.inputFocus
    : ageInput.length === 0
      ? Colors.inputError
      : Colors.inputBorder

  // Same animated-scrim pattern as components/bottom-sheet/BottomSheet.tsx —
  // the dim backdrop fades in/out alongside the sheet's slide instead of
  // Modal's own default (an instant, un-animated full-opacity overlay).
  const ageSlideAnim = useRef(new Animated.Value(SCREEN_H)).current
  const ageScrimAnim = useRef(new Animated.Value(0)).current

  // "Please enter age" arrow — Angular plays a looping Lottie here
  // (forward-animation-link, right-arrow-animation.json). A looping
  // translateX bounce reproduces the same "nudging forward" motion
  // without pulling in a Lottie player dependency.
  const enterAgeArrowAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(enterAgeArrowAnim, { toValue: 4, duration: 450, useNativeDriver: true }),
        Animated.timing(enterAgeArrowAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [enterAgeArrowAnim])

  useEffect(() => {
    if (showAgeSheet) {
      setAgeModalMounted(true)
      Animated.parallel([
        Animated.spring(ageSlideAnim, { toValue: 0, useNativeDriver: true, tension: 55, friction: 11 }),
        Animated.timing(ageScrimAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(ageSlideAnim, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
        Animated.timing(ageScrimAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setAgeModalMounted(false)
      })
    }
  }, [showAgeSheet, ageSlideAnim, ageScrimAnim])

  const dateRef  = useRef<View>(null)
  const monthRef = useRef<View>(null)
  const yearRef  = useRef<View>(null)
  const pickerListRef = useRef<ScrollView>(null)

  // Year auto-scroll glide. ScrollView's own `animated: true` is a short native
  // fling (reads as a jump); driving the offset from an Animated.Value gives
  // a slow, eased scroll — same technique as BulkLikeModal's showcase scroll.
  // useNativeDriver must be false: scroll offset isn't a native-animatable prop.
  const yearScrollAnim  = useRef(new Animated.Value(0)).current
  const yearScrollRun   = useRef<Animated.CompositeAnimation | null>(null)
  const yearScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const id = yearScrollAnim.addListener(({ value }) => {
      pickerListRef.current?.scrollTo({ y: value, animated: false })
    })
    return () => yearScrollAnim.removeListener(id)
  }, [yearScrollAnim])

  function stopYearScroll() {
    if (yearScrollTimer.current) { clearTimeout(yearScrollTimer.current); yearScrollTimer.current = null }
    yearScrollRun.current?.stop()
    yearScrollRun.current = null
  }

  useEffect(() => stopYearScroll, [])

  // Arrow rotation per field — 0 = pointing down (closed), 1 = pointing up (open).
  // Same down-arrow.svg icon is reused for both states (Angular swaps the source
  // image instead; rotating one icon animates the flip rather than popping between them).
  const dateArrowAnim  = useRef(new Animated.Value(0)).current
  const monthArrowAnim = useRef(new Animated.Value(0)).current
  const yearArrowAnim  = useRef(new Animated.Value(0)).current

  const YEARS = apiYears ?? buildYears(gender)

  // ── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('DATEOFBIRTH'),
      getRegValue('GENDER'),
      getRegValue('AGE'),
    ]).then(([cb, dob, g, age]) => {
      if (cb) setCreatedBy(cb)
      if (dob && dob !== '0000-00-00') {
        const p = dob.split('-')
        if (p.length === 3) {
          setSelYear(p[0])
          setSelMonth(String(Number(p[1])))
          setSelDate(String(Number(p[2])))
        }
      } else if (age) {
        // No DOB stored, but an age was entered directly via the "enter age"
        // sheet (handleAgeSubmit) — reopen as the "Enter your age" page.
        setAgeMode(true)
        setPageAge(age)
      }
      if (g) setGender(g)
    })
  }, [])

  // Server-translated month names — see MONTH_FALLBACK above for why this
  // exists. Re-runs on a language change (useLanguageReload) so the picker
  // re-labels instead of staying frozen in whatever language it first loaded.
  function loadMonths() {
    fetchMonthOptions()
      .then(list => { if (list.length) setMonths(list) })
      .catch(() => {})
  }

  useEffect(() => { loadMonths() }, [])

  useLanguageReload(loadMonths)

  // Server-translated birth-year list — same MONTH_FALLBACK reasoning, plus
  // Angular's GENDER=='1' 4-entry trim (see fetchYearOptions doc comment).
  // Re-fetches whenever GENDER changes (the trim depends on it) and on a
  // live language change.
  function loadYears() {
    fetchYearOptions(gender)
      .then(list => { setApiYears(list.length ? list : null) })
      .catch(() => {})
  }

  useEffect(() => { loadYears() }, [gender])

  useLanguageReload(loadYears)

  // Server-translated day-of-month list, filtered to the selected month/year —
  // same MONTH_FALLBACK reasoning. Re-fetches on month/year change (Angular's
  // updateDateList() re-derives this on every change too) and on language change.
  function loadDates() {
    fetchDateOptions(selMonth, selYear)
      .then(list => { setApiDates(list.length ? list : null) })
      .catch(() => {})
  }

  useEffect(() => { loadDates() }, [selMonth, selYear])

  useLanguageReload(loadDates)

  // ── Computed ─────────────────────────────────────────────────────────────

  const possessive       = PROFILE_POSSESSIVE[createdBy]

  const possessiveKey = possessive?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const dobTitle = t('REGISTRATION.DATEOFBIRTH', 'Select your #PROFILETYPE# date of birth')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  // Angular: REGISTRATION.DOBREMINDER ("If you don't remember your
  // #PROFILETYPE# date of birth")
  const noRemText = t('REGISTRATION.DOBREMINDER', "If you don't remember your #PROFILETYPE# date of birth")
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  // Age sheet title — Angular: REGISTRATION.ENTERAGETITLE ("Enter your
  // #PROFILETYPE# age"), same #PROFILETYPE# substitution as the page title above.
  const ageSheetTitleText = t('REGISTRATION.ENTERAGETITLE', 'Enter your #PROFILETYPE# age')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  // Angular: REGISTRATION.ENTERAGE ("Please enter age") — the "Please enter
  // age" link shown once all 3 date fields are cleared/unfilled.
  const enterAgeLinkText = t('REGISTRATION.ENTERAGE', 'Please enter age')
  // Angular: REGISTRATION.AGE ("Age") — floating label above the age input.
  const ageLabelText = t('REGISTRATION.AGE', 'Age')
  // Angular: shared GENERAL.OR key — the divider between the date picker and
  // the "enter age" fallback link.
  const orDividerText = t('GENERAL.OR', 'OR')
  // Angular: REGISTRATION.DATE / .MONTH / .YEAR — the three dropdown placeholders,
  // previously hardcoded English literals in the fields array below.
  const datePlaceholder  = t('REGISTRATION.DATE',  'Date')
  const monthPlaceholder = t('REGISTRATION.MONTH', 'Month')
  const yearPlaceholder  = t('REGISTRATION.YEAR',  'Year')

  const selMonthLabel    = months.find(m => m.key === selMonth)?.label ?? ''
  const isAllSelected    = !!(selDate && selMonth && selYear)
  // In age mode (see ageMode above) the age comes from the inline Age input
  // instead of the DOB dropdowns.
  const calculatedAge    = isAllSelected ? calculateAge(selYear, selMonth, selDate) : directAge

  // Angular: registration-revamp.component.ts's setMinMaxAge() —
  // GENDER=='0' (female) → minAge 18, everything else (male/other) → 21.
  // maxAge is always 70. Same rule gates both the DOB fields (isDobAgeValid())
  // and the "enter age" textbox sheet (registration-modal-popup's setMinMaxAge()).
  const minAge = gender === '0' ? 18 : 21
  const maxAge = 70
  const isDobAgeValid = isAllSelected && calculatedAge !== null && calculatedAge >= minAge && calculatedAge <= maxAge
  // Angular: isAgeValid() — gates both Next and the age badge in age mode.
  const isDirectAgeValid = directAge !== null && directAge >= minAge && directAge <= maxAge
  const canGoNext = ageMode ? isDirectAgeValid : isDobAgeValid
  // Angular: ENTERAGETITLE replaces the DOB title in age mode.
  const title = ageMode ? ageSheetTitleText : dobTitle
  const pageAgeBorderColor = pageAgeFocused
    ? Colors.inputFocus
    : pageAge.length === 0
      ? Colors.inputError
      : Colors.inputBorder

  // Angular: updateAgeContent() — createdBy === '1' (Myself) uses
  // AGESTATEMENTMYSELF, everyone else uses AGESTATEMENT with #PROFILETYPE#
  // substituted, then #AGE# is replaced with the computed age. Both keys are
  // fully translated (see locales/*.json), unlike the previous hardcoded
  // "Your {ageSubject} is N years old" / "You are N years old" literals.
  //
  // The <span> that bolds the number wraps different text per language (English:
  // "#AGE# years"; Tamil: just "#AGE#" — "years/age" sits outside it there), so
  // this can't split on the <span> tags and assume "years" is always inside.
  // Strip all markup first, THEN split the plain string on #AGE# — whatever
  // words end up on each side are exactly what that language's template put there.
  const ageStatementTemplate = createdBy === '1'
    ? t('REGISTRATION.AGESTATEMENTMYSELF', "You are #AGE# years old")
    : t('REGISTRATION.AGESTATEMENT', "Your #PROFILETYPE# is #AGE# years old")
        .replace('#PROFILETYPE#', translatedProfileType).replace('  ', ' ')
  const ageStatementPlain = stripHtml(ageStatementTemplate)
  const [ageStatementBeforeRaw, ageStatementAfterRaw] = ageStatementPlain.includes('#AGE#')
    ? ageStatementPlain.split('#AGE#')
    : [ageStatementPlain, '']
  const ageStatementBefore = ageStatementBeforeRaw.trim() + ' '
  const ageStatementAfter  = ' ' + ageStatementAfterRaw.trim()
  const ageStatementYears  = String(calculatedAge ?? '')
  // ── Picker helpers ────────────────────────────────────────────────────────

  function getOptions(field: FieldKey) {
    if (field === 'month') return months
    if (field === 'year')  return YEARS
    return apiDates ?? getDaysInMonth(selMonth, selYear)
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

  function animFor(field: FieldKey) {
    if (field === 'date')  return dateArrowAnim
    if (field === 'month') return monthArrowAnim
    return yearArrowAnim
  }

  function rotateArrow(field: FieldKey, toOpen: boolean) {
    Animated.timing(animFor(field), {
      toValue:        toOpen ? 1 : 0,
      duration:       180,
      useNativeDriver: true,
    }).start()
  }

  function openPicker(field: FieldKey) {
    const ref = refFor(field)
    ref.current?.measureInWindow((x, y, w, h) => {
      // For month dropdown, use a minimum width so full month names fit
      const dropW = field === 'month' ? Math.max(w, 130) : w

      // Flip the dropdown above the field when there isn't enough room below —
      // e.g. the Year field can sit low enough on screen that a full-height
      // list opening downward would run off the bottom edge and be unreachable.
      const listHeight  = Math.min(getOptions(field).length, MAX_LIST_ITEMS) * ITEM_H
      const spaceBelow  = SCREEN_H - (y + h)
      const openUp      = spaceBelow < listHeight && y > listHeight

      setDropdownPos({ top: y, left: x, width: dropW, fieldBottom: y + h, openUp, fieldTop: y })
      setPickerField(field)
      rotateArrow(field, true)

      // Angular: registration.page.ts only auto-scrolls the Year list — and
      // only when YEAR has no value yet — via a 700ms-delayed, 1000ms smooth
      // scrollToPoint (never an instant jump). Same timing here, animated,
      // so the list visibly glides from the top down to the recent-years end
      // instead of opening pre-scrolled.
      if (field === 'year' && !selYear) {
        const years = getOptions('year')
        // Offset-based — the dropdown is a plain ScrollView with every row
        // mounted up front, so there are no blank rows mid-glide.
        const maxOffset = Math.max(0, years.length * ITEM_H - listHeight)
        stopYearScroll()
        yearScrollTimer.current = setTimeout(() => {
          yearScrollTimer.current = null
          yearScrollAnim.setValue(0)
          const run = Animated.timing(yearScrollAnim, {
            toValue:         maxOffset,
            duration:        1500,
            easing:          Easing.inOut(Easing.cubic),
            useNativeDriver: false,
          })
          yearScrollRun.current = run
          run.start(() => { yearScrollRun.current = null })
        }, 700)
      }
    })
  }

  function closePicker() {
    stopYearScroll()
    if (pickerField) rotateArrow(pickerField, false)
    setPickerField(null)
  }

  // Dismiss the keyboard before starting the close animation — otherwise the
  // keyboard's own dismiss animation competes with the sheet's slide-down,
  // making the close look janky/inconsistent compared to how it opens.
  function closeAgeSheet() {
    Keyboard.dismiss()
    setShowAgeSheet(false)
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
    closePicker()
  }

  // ── Submit (DOB path) ─────────────────────────────────────────────────────

  async function handleNext() {
    if (!canGoNext || submitting) return
    setSubmitting(true)
    try {
      if (ageMode) {
        // The inline Age input is editable, so re-store whatever it holds now.
        await setRegValue('AGE', pageAge)
        navigation.push('onboarding', { pageNo: '43' })
        callPartialRegistrationAPI()
        return
      }
      const dob = `${selYear}-${selMonth.padStart(2, '0')}-${selDate.padStart(2, '0')}`
      // Angular's sendPartialRegistrationData() blanks AGE once a full DOB is set.
      await setRegValues({ DATEOFBIRTH: dob, MONTH: selMonth, DATE: selDate, YEAR: selYear, AGE: '' })
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
    if (!age || ageNum < minAge || ageNum > maxAge) {
      setAgeError(`Please enter a valid age (${minAge}–${maxAge})`)
      return
    }
    // Unmount the sheet's Modal NOW rather than after its exit animation. On
    // Android a Modal is its own window above the whole app — left mounted
    // through the animation while push() below shows the next step, it sat
    // invisibly over Height and swallowed the first tap there.
    Keyboard.dismiss()
    setShowAgeSheet(false)
    setAgeModalMounted(false)
    setSubmitting(true)
    try {
      // TEMP DEBUG (age-path partialreg) — remove once diagnosed.
      if (__DEV__) console.log('[DOB] age submit', age)
      // Drop any half-picked DOB so it isn't sent alongside the age.
      await setRegValues({ AGE: age, DATEOFBIRTH: '', YEAR: '', MONTH: '', DATE: '' })
      if (__DEV__) console.log('[DOB] stored AGE =', await getRegValue('AGE'))
      // push() keeps this screen mounted underneath, so Back returns to this
      // same instance — the Init effect won't re-run, so switch to age mode
      // here or the page would still show the DOB dropdowns on return.
      setSelDate(''); setSelMonth(''); setSelYear('')
      setAgeMode(true)
      setPageAge(age)
      navigation.push('onboarding', { pageNo: '43' })
      callPartialRegistrationAPI()
    } catch (e) {
      if (__DEV__) console.log('[DOB] age submit failed', e)
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  useOnboardingFooter({ nextDisabled: !canGoNext, nextLoading: submitting, onNext: handleNext }, [canGoNext, submitting])

  // ── Render ────────────────────────────────────────────────────────────────

  const pickerOptions = pickerField ? getOptions(pickerField) : []
  const currentVal    = pickerField ? getCurrentVal(pickerField) : ''

  // Dropdown list height capped at MAX_LIST_ITEMS rows
  const listH = Math.min(pickerOptions.length, MAX_LIST_ITEMS) * ITEM_H

  // Only jump straight to a value when one is already selected (e.g. editing
  // an existing DOB) — otherwise the list opens at the top. Angular does the
  // same: registration.page.ts's scrollToPoint is only called when the field
  // has no existing value yet.
  const selectedIdx = pickerOptions.findIndex(o => o.key === currentVal)
  const initialScrollIdx = Math.max(0, selectedIdx >= 0 ? selectedIdx - 2 : 0)

  // Dropdown position: normally starts at fieldBottom (right below the field),
  // so it looks like the field expanded downward. When openPicker() detected
  // not enough room below (e.g. the Year field sitting low on screen), it's
  // anchored above the field instead, growing upward, so the list stays fully
  // visible and reachable either way.
  const dropStyle = dropdownPos.openUp
    ? {
        position: 'absolute' as const,
        bottom: SCREEN_H - dropdownPos.fieldTop,
        left:   dropdownPos.left,
        width:  dropdownPos.width,
      }
    : {
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
        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        {/* Age mode — Angular's inline #ageInput (ion-input + floating "Age"
            label) replaces the DOB dropdowns once an age has been entered. */}
        {ageMode && (
          <View style={styles.pageAgeOuter}>
            <TextInput
              style={[styles.ageInputBox, { borderColor: pageAgeBorderColor, fontFamily: langFonts.medium }, webOutlineReset]}
              keyboardType="number-pad"
              value={pageAge}
              onChangeText={v => setPageAge(v.replace(/\D/g, ''))}
              onFocus={() => setPageAgeFocused(true)}
              onBlur={() => setPageAgeFocused(false)}
              placeholder={enterAgeLinkText}
              placeholderTextColor={Colors.textTertiary}
              cursorColor={Colors.textPrimary}
              selectionColor={Colors.textPrimary}
              maxLength={2}
              returnKeyType="done"
              onSubmitEditing={handleNext}
            />
            <View style={styles.ageLabelWrap} pointerEvents="none">
              <Text style={[styles.ageLabelText, { fontFamily: langFonts.regular }]}>{ageLabelText}</Text>
            </View>
          </View>
        )}

        {/* Three dropdown trigger fields */}
        {!ageMode && (
        <View style={styles.fieldsRow}>
          {(
            [
              { field: 'date'  as FieldKey, ref: dateRef,  val: selDate,  display: selDate ? selDate.padStart(2, '0') : '',  placeholder: datePlaceholder  },
              { field: 'month' as FieldKey, ref: monthRef, val: selMonth, display: selMonthLabel,                            placeholder: monthPlaceholder },
              { field: 'year'  as FieldKey, ref: yearRef,  val: selYear,  display: selYear,                                  placeholder: yearPlaceholder  },
            ] as const
          ).map(({ field, ref, val, display, placeholder }) => {
            const isOpen = pickerField === field
            const arrowRotate = animFor(field).interpolate({
              inputRange:  [0, 1],
              outputRange: ['0deg', '180deg'],
            })
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
                    <Text style={[styles.fieldLabelText, { fontFamily: langFonts.regular }]}>{placeholder}</Text>
                  </View>
                )}

                <Pressable
                  style={styles.fieldPressable}
                  onPress={() => openPicker(field)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${placeholder}`}
                >
                  <Text style={[styles.fieldText, !val && styles.fieldPlaceholder, { fontFamily: langFonts.medium }]} numberOfLines={1}>
                    {val ? display : placeholder}
                  </Text>
                  {/* Same down-arrow icon for all 3 fields — rotates 180° when open,
                      matching Angular's up/down swap (registration-revamp). */}
                  <Animated.View style={{ transform: [{ rotate: arrowRotate }] }}>
                    <Image source={{ uri: CDN_ARROW_DOWN }} style={styles.chevronIcon} contentFit="contain" />
                  </Animated.View>
                </Pressable>
              </View>
            )
          })}
        </View>
        )}

        {/* Age badge — "Your son is 28 years old" (Angular .height-block).
            Figma has TWO gradients: a border-image (a pink→white hairline that fades
            out toward the right) and a fill. RN has no `border-image` equivalent, so
            this is built as two stacked layers: an outer gradient view acts as the
            1px border, and an inner gradient view (inset by that 1px on the top/left/
            bottom edges, and flush to the right where Figma's border-width is 0) is
            the fill. Both gradients are near-transparent by design, so the fill layer
            sits on an opaque white base — without it the badge has no background at
            all and reads as a dark rectangle against the page. */}
        {/* Angular: shown for (isDobValidValues() || isAgeValid()) — in age mode
            only while the typed age is within the min/max range. */}
        {(ageMode ? isDirectAgeValid : isAllSelected && calculatedAge !== null && calculatedAge > 0) && (
          <AgeBadge>
            <Text style={[styles.ageBadgeText, { fontFamily: langFonts.regular }]}>{ageStatementBefore}
              <Text style={[styles.ageBadgeYears, { fontFamily: langFonts.semiBold }]}>{ageStatementYears}</Text>
              {ageStatementAfter}
            </Text>
          </AgeBadge>
        )}

        {/* OR divider + "Please enter age" — hidden once all 3 date fields are
            filled, or in age mode */}
        {!isAllSelected && !ageMode && (
          <>
            <View style={styles.orRow}>
              <Image source={{ uri: CDN_OR_LEFT }} style={styles.orLine} contentFit="contain" />
              <Text style={[styles.orText, { fontFamily: langFonts.regular }]}>{orDividerText}</Text>
              <Image source={{ uri: CDN_OR_RIGHT }} style={styles.orLine} contentFit="contain" />
            </View>

            <Text style={[styles.noRemText, { fontFamily: langFonts.regular }]} numberOfLines={1}>{noRemText}</Text>
            <Pressable
              style={styles.enterAgeRow}
              onPress={() => { setAgeInput(''); setAgeError(''); setShowAgeSheet(true) }}
            >
              <Text style={[styles.enterAgeLink, { fontFamily: langFonts.regular }]}>{enterAgeLinkText}</Text>
              <Animated.View style={{ transform: [{ translateX: enterAgeArrowAnim }] }}>
                <CdnSvg uri={CDN_FORWARD_ICON} width={10} height={10} style={styles.enterAgeIcon} />
              </Animated.View>
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
        onRequestClose={closePicker}
      >
        {/* Full-screen tap-away closes the dropdown */}
        <Pressable style={StyleSheet.absoluteFill} onPress={closePicker} />

        {/* Dropdown list — below the field normally, or above it when flipped
            (dropdownPos.openUp) because there wasn't room underneath. */}
        <View style={[styles.dropdown, dropdownPos.openUp && styles.dropdownUp, dropStyle]}>
          {/* Plain ScrollView, not FlatList: at most ~53 rows (Year), so there's
              nothing to virtualize — and FlatList's per-scroll-event windowing
              recomputation competed with the frame-by-frame Year auto-scroll
              glide below, which is what made it stutter instead of gliding.
              Every row is mounted up front, so the glide never hits blank rows. */}
          <ScrollView
            ref={pickerListRef}
            style={{ maxHeight: listH }}
            contentOffset={{ x: 0, y: initialScrollIdx * ITEM_H }}
            // contentOffset is iOS-only — Android/web opened at the top, leaving the
            // selected year (e.g. 1994) out of view / cut off. Scroll there explicitly.
            onLayout={() => {
              if (selectedIdx >= 0) pickerListRef.current?.scrollTo({ y: initialScrollIdx * ITEM_H, animated: false })
            }}
            showsVerticalScrollIndicator
            scrollEventThrottle={16}
            // Any touch on the list hands scrolling back to the user.
            onTouchStart={stopYearScroll}
            onScrollBeginDrag={stopYearScroll}
          >
            {pickerOptions.map(item => {
              const isSel = item.key === currentVal
              return (
                <Pressable
                  key={item.key}
                  style={[styles.dropdownItem, isSel && styles.dropdownItemSel]}
                  onPress={() => pickerField && handlePickerSelect(pickerField, item.key)}
                >
                  <Text style={[styles.dropdownItemText, isSel && styles.dropdownItemTextSel, { fontFamily: isSel ? langFonts.semiBold : langFonts.regular }]}>
                    {item.label}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Age entry bottom sheet — animated scrim fade + slide, same pattern
          as components/bottom-sheet/BottomSheet.tsx, instead of Modal's own
          default (an instant, un-animated full-opacity overlay). ── */}
      <Modal
        visible={ageModalMounted}
        transparent
        animationType="none"
        onRequestClose={closeAgeSheet}
        statusBarTranslucent
        // Focus once the slide-in animation has actually finished presenting —
        // matches the OTPScreen 'transitionEnd' fix. `autoFocus` on the input
        // instead fires the instant it mounts, racing the Modal's own opening
        // animation: the keyboard would open before KeyboardAvoidingView('height')
        // has a settled layout to resize against, so the sheet never rises.
        onShow={() => ageInputRef.current?.focus()}
      >
        {/* Animated scrim — pointer-events none so it doesn't block the Pressable below.
            Angular's registration-modal-popup uses Ionic's modal backdrop (default
            --backdrop-opacity 0.4, up to 0.8 stacked) — 0.5 read as too light next
            to it, so this now fades to the same darkness as Colors.scrimStrong. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: Colors.scrimStrong, opacity: ageScrimAnim },
          ]}
          pointerEvents="none"
        />

        <TouchableWithoutFeedback onPress={closeAgeSheet}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <AnimatedKeyboardAvoidingView
          // No paddingBottom here: behavior="padding" writes its OWN
          // paddingBottom (keyboard height, 0 when closed) over the style's,
          // which left the Next CTA flush against — and half under — the
          // keyboard / gesture bar. The bottom gap lives on ageConfirmBtn.
          style={[
            styles.ageSheet,
            { transform: [{ translateY: ageSlideAnim }] },
          ]}
          // 'height' shrinks the container's own height by the keyboard height —
          // fine for a flex-filled view, but this sheet is absolutely positioned
          // with only `bottom: 0` (no `top`) and sized by its content, so the
          // shrunken box stays glued to the literal screen bottom and ends up
          // entirely underneath the keyboard instead of rising above it.
          // 'padding' instead adds invisible paddingBottom equal to the keyboard
          // height below the visible content, which pushes title/input/button up
          // regardless of the container's positioning — works on both platforms.
          behavior="padding"
        >
          {/* Angular: registration-modal-popup's close-icon-size, top-right of the
              sheet, dismisses back to the DOB fields without saving an age. */}
          <Pressable
            style={styles.ageCloseBtn}
            onPress={closeAgeSheet}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <CdnSvg uri={CDN_CLOSE_ICON} width={24} height={24} />
          </Pressable>

          <Text style={[styles.ageSheetTitle, { fontFamily: langFonts.semiBold }]}>{ageSheetTitleText}</Text>

          <View style={styles.ageInputOuter}>
            <TextInput
              ref={ageInputRef}
              style={[styles.ageInputBox, { borderColor: ageInputBorderColor, fontFamily: langFonts.medium }, webOutlineReset]}
              keyboardType="number-pad"
              value={ageInput}
              onChangeText={v => { setAgeInput(v.replace(/\D/g, '')); setAgeError('') }}
              onFocus={() => setAgeInputFocused(true)}
              onBlur={() => setAgeInputFocused(false)}
              cursorColor={Colors.textPrimary}
              selectionColor={Colors.textPrimary}
              maxLength={2}
              returnKeyType="done"
              onSubmitEditing={handleAgeSubmit}
            />
            <View style={styles.ageLabelWrap} pointerEvents="none">
              <Text style={[styles.ageLabelText, { fontFamily: langFonts.regular }]}>{ageLabelText}</Text>
            </View>
          </View>

          {!!ageError && <Text style={[styles.ageError, { fontFamily: langFonts.regular }]}>{ageError}</Text>}

          <View style={[styles.ageConfirmBtn, { marginBottom: insets.bottom + 20 }]}>
            <ButtonRevamp
              label={t('REGISTRATION.NEXTCTA', 'Next')}
              variant="primary"
              size="standard"
              fullWidth
              disabled={!ageInput || Number(ageInput) < minAge || Number(ageInput) > maxAge}
              onPress={handleAgeSubmit}
            />
          </View>
        </AnimatedKeyboardAvoidingView>
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
  // Angular: floating-dob body3-regular-12 black-color
  // No fontWeight next to the inline langFonts family: on Android a weight on a
  // custom family can fall back to the system font, which is what made the three
  // fields render at slightly different heights (misaligned).
  fieldLabelText: {
    fontSize:   FontSize.font12,
    lineHeight: 16,
    color:      Colors.black,
  },

  fieldPressable: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 10,
    height:            48,
  },
  // Angular: ion-label class="ion-no-margin black-color body1-medium-14" —
  // same class for both a filled value and the untranslated placeholder.
  // Explicit lineHeight + no font padding: Poppins' tall line box was clipping
  // the value (e.g. "1994" showed partially) inside the 48px field.
  fieldText: {
    flex:       1,
    minWidth:   0,
    fontSize:   FontSize.font14,
    lineHeight: 20,
    color:      Colors.black,
    includeFontPadding: false,
    textAlignVertical:  'center',
  },
  fieldPlaceholder: {
    color:      Colors.black,
  },
  chevronIcon: {
    width:  16,
    height: 16,
    flexShrink: 0,
    marginLeft: 4,
  },
  // ── Age badge ────────────────────────────────────────────────────────────────

  // Angular .height-block: border-radius left-corners-only (8px 0 0 8px).
  // Figma: border-image-source: linear-gradient(90deg, rgba(181,0,51,0.1)
  // -30.82%, #FFFFFF 83.06%), border-width 1px 0px 1px 1px (no right edge),
  // fill linear-gradient(90deg, rgba(181,0,51,0) -13.43%, rgba(255,255,255,0.2) 50.2%).
  // RN has no border-image-gradient equivalent, so this outer view renders the
  // border gradient and the inner `ageBadge` view (inset 1px top/left/bottom,
  // 0 on the right) renders the fill gradient over it — the outer layer only
  // shows through that 1px inset, reproducing the border-image effect.
  ageBadgeBorder: {
    marginTop:              12,
    paddingTop:             1,
    paddingBottom:          1,
    paddingLeft:            1,
    paddingRight:           0,
    borderTopLeftRadius:    8,
    borderBottomLeftRadius: 8,
    alignSelf:              'flex-start',
    overflow:               'hidden',
  },
  ageBadge: {
    paddingHorizontal:      8,
    paddingVertical:        4,
    borderTopLeftRadius:    7,
    borderBottomLeftRadius: 7,
  },
  // Angular: .mt-12 body2-regular-14 black-color height-block
  ageBadgeText: {
    fontSize:   FontSize.font14,
    fontWeight: '400',
    color:      Colors.black,
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
    flex:   1,
    height: 8,
    opacity: 1,
  },
  // Angular: body2-regular-14 or-color — or-color has no matching rule in
  // this component's stylesheet (only recharge/app-rating scope it), so this
  // text is left at its existing ambient color rather than forcing a new one.
  orText: {
    fontSize:         FontSize.font14,
    fontWeight:       '400',
    color:            Colors.textPrimary,
    opacity:          1,
    marginHorizontal: 16,
  },

  // ── "Please enter age" ────────────────────────────────────────────────────────
  // Angular's DOBREMINDER is a single continuous string (body2-regular-14,
  // Poppins Regular) — no manual line break; it wraps only if the viewport is
  // narrow. `numberOfLines` below keeps this to one line to match on mobile.

  // Angular: body2-regular-14 black-color (no line-height class set)
  noRemText: {
    fontSize:     FontSize.font14,
    fontWeight:   '400',
    color:        Colors.black,
    marginBottom: 8,
  },
  enterAgeRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  // Angular: app-button-revamp default ctaFontSize is EButtonFontSize.regular14
  // ('body2-regular-14'), textColor 'linkColor' (--ion-color-link-color, i.e.
  // Colors.link). No explicit lineHeight (user preference: let RN's Text
  // fall back to the font's natural metric on onboarding screens even where
  // Angular sets one).
  enterAgeLink: {
    fontSize:           FontSize.font14,
    fontWeight:         '400',
    color:              Colors.link,
    textDecorationLine: 'underline',
  },
  enterAgeIcon: {
    marginLeft: 6,
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
  // Flipped variant when the dropdown opens above the field instead of below
  // (see dropdownPos.openUp) — the rounded/borderless edge swaps to the top,
  // since that's now the edge touching the field.
  dropdownUp: {
    borderTopWidth:          1,
    borderBottomWidth:       0,
    borderTopLeftRadius:     8,
    borderTopRightRadius:    8,
    borderBottomLeftRadius:  0,
    borderBottomRightRadius: 0,
  },
  dropdownItem: {
    height:            ITEM_H,
    justifyContent:    'center',
    paddingHorizontal: 10,
  },
  dropdownItemSel: {
    backgroundColor: 'rgba(181,0,51,0.05)',
  },
  // Angular: <span class="body2-regular-14"> inside an ion-item styled by
  // .opt-select { color: #333333 } — no color class of its own, so it
  // inherits that ambient #333333 (Colors.textDark), not Colors.textPrimary.
  dropdownItemText: {
    fontSize:   FontSize.font14,
    lineHeight: 20,
    color:      Colors.textDark,
    includeFontPadding: false,
  },
  // Angular's '.selection' class (applied to the matching ion-item) only
  // changes --background — it doesn't bold or recolor the row's text.
  dropdownItemTextSel: {},

  // ── Modal overlay ─────────────────────────────────────────────────────────────

  // ── Age entry bottom sheet ────────────────────────────────────────────────────

  ageSheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      Colors.surface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingHorizontal:    24,
    paddingTop:           20,
  },
  // Angular's registration-modal-popup close-icon-size sits at the top of the
  // sheet content, right-aligned — no drag handle exists in that markup.
  ageCloseBtn: {
    alignSelf:    'flex-end',
    marginBottom: 12,
  },
  // Angular: registration-modal-popup's ion-label class="heading2-semibold-18
  // color-1f1e1b" — font18, not font20; #1f1e1b is a one-off color specific
  // to this popup, not one of the app's named color tokens.
  ageSheetTitle: {
    fontSize:     FontSize.font18,
    fontWeight:   '600',
    color:        '#1f1e1b',
    marginBottom: 28,
    marginTop:    0,
  },
  ageInputOuter: {
    position:  'relative',
    marginTop: 8,
  },
  // Inline age-mode input — same row position as fieldsRow it replaces.
  pageAgeOuter: {
    position:  'relative',
    marginTop: 8,
  },
  // Angular: ion-input class="body1-medium-14" (no black-color here, unlike
  // the other input fields, so the color is left at its existing value)
  ageInputBox: {
    height:            48,
    borderWidth:       1,
    borderColor:       Colors.inputBorder,
    borderRadius:      8,
    paddingHorizontal: 12,
    // Android's default TextInput vertical padding + Poppins' font padding
    // pushed the value above the box's centre — same paddingVertical:0 as
    // NameScreen.tsx's input, plus explicit centring.
    paddingVertical:    0,
    textAlignVertical:  'center',
    includeFontPadding: false,
    fontSize:          FontSize.font14,
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
  // Angular: floating body3-regular-12 black-color
  ageLabelText: {
    fontSize:   FontSize.font12,
    fontWeight: '400',
    color:      Colors.black,
  },
  // Closest Angular analog (name-violation text): body3-regular-12
  // color-de2a68 — no line-height class set.
  ageError: {
    marginTop:  8,
    fontSize:   FontSize.font12,
    color:      Colors.inputError,
  },
  ageConfirmBtn: {
    marginTop: 28,
  },
})
