// Angular equivalent: pages/search/search.component.ts + filter-popup.component.ts
// + filter/filter.component.ts (the single shared field-editor machinery for both
// "Filters" (quick/temporary) mode and "Partner preferences" (PP) mode).
//
// Known simplifications vs Angular (documented, not silent):
//  - LOCATION is State→City only (Country fixed to India), matching the same
//    simplification onboarding's LocationScreen already makes app-wide.
//  - CASTE stops at Caste (no Subcaste/Gothra sub-cascade) — those are rarely
//    changed post-onboarding and add a lot of UI for a rarely-touched facet.
//  - STAR is Raasi (single) → Star (multi), a simplified stand-in for Angular's
//    grouped parent/child checkbox tree.
//  - AGE/HEIGHT are bounded single-value Min/Max pickers (not Angular's grouped
//    side-panel lists), reusing the existing SearchablePicker component.
//  - MONTHLYINCOME is a flat multi-select bracket list — Angular's nested
//    "custom range" sub-picker isn't ported.
//  - PROFILECREATED is a recency multi-select (Any Time/1 Week/1 month/3 Month —
//    confirmed against a live screenshot) using PROFILECREATED_OPTIONS' local,
//    fixed list; its day-count codes ('7'/'30'/'90') aren't confirmed against
//    Angular's real API contract (see that constant's own comment).
//    PHOTOAVAILABLE/HOROSCOPEAVAILABLE (both Filter-mode-only, alongside
//    PROFILECREATED) are plain on/off checkboxes, matching Angular.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT, CDN_SVG } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { handleBack } from '../../utils/navigationRef'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import SearchDesktopLayout from './SearchDesktopLayout'
import { fetchSearchResults } from '../../service/homeService'
import { resolveFilterLabel, isAnySelection } from '../../adapters/filterPreference.adapter'
import {
  getSelectedObject, saveFilterState, getSearchPPCheckBox,
  getFilterEventType, resetFilter, buildSearchParams, DEFAULT_FILTER,
  getStrictFilterState, setStrictFilterState,
} from '../../service/filterService'
import { getPPSetData } from '../../service/profileService'
import StrictFilterManageModal from '../../components/search/StrictFilterManageModal'
import {
  MANAGE_FILTER_CTA, STRICT_FILTERS_TITLE, STRICT_FILTERS_NOTE,
} from '../../constants/strictFilter.config'
import StrictFieldEditorScreen, { CompactFieldRow } from '../../components/search/StrictFieldEditorScreen'
import {
  fetchReligionOptions, fetchCasteOptions, fetchDivisionOptions,
  fetchRaasiOptions, fetchStarOptions, fetchDoshamOptions,
  fetchOccupationOptions, fetchQualificationOptions, fetchMonthlyIncomeOptions,
  fetchMotherTongueOptions, fetchMaritalStatusOptions, fetchEatingHabitOptions,
  fetchPhysicalStatusOptions, fetchExactHeightOptions,
  fetchStates, fetchCities,
} from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'
import MultiSelectPicker, { type MultiSelectOption } from '../../components/multi-select-picker/MultiSelectPicker'
import { ICON } from '../viewprofile/ViewProfileScreen'
import CheckboxGroup from '../../components/checkbox/CheckboxGroup'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const ICON_BACK  = CDN_REACT + '/menu_back_arrow.svg'
const ICON_ARROW = CDN_REACT + '/menu_right_arrow.svg'

// Angular's real Filters screen shows a distinct icon per row (confirmed
// against a live screenshot: person/pin/caste/star/dosham/briefcase/cap icons
// etc.) — this port previously rendered label+value+chevron only, no icon at
// all. Reuses ViewProfile's own ICON map (same assets/images/svg/viewprofile/
// CDN set Angular's detail rows already use) rather than a second copy of
// these paths — every field below has a directly confirmed match EXCEPT
// RELIGION, which has no other on-screen usage anywhere in this port to
// confirm against; that one path is a best-guess following the exact same
// `viewprofile/{field}-icon.svg` naming convention every other icon here uses.
const FIELD_ICON: Record<FieldKey, string> = {
  AGE:            ICON.age,
  LOCATION:       ICON.location,
  RELIGION:       CDN_SVG + 'viewprofile/religion-icon.svg',
  CASTE:          ICON.caste,
  STAR:           ICON.star,
  DOSHAM:         ICON.dosham,
  OCCUPATION:     ICON.occupation,
  MONTHLYINCOME:  ICON.salary,
  EDUCATION:      ICON.education,
  HEIGHT:         ICON.height,
  MOTHERTONGUE:   ICON.motherTongue,
  MARITALSTATUS:  ICON.maritalStatus,
  EATINGHABITS:   ICON.eating,
  PHYSICALSTATUS: ICON.physicalStatus,
  PROFILECREATED: ICON.createdFor,
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any }

export type FieldKey =
  | 'AGE' | 'LOCATION' | 'RELIGION' | 'CASTE' | 'STAR' | 'DOSHAM' | 'OCCUPATION'
  | 'MONTHLYINCOME' | 'EDUCATION' | 'HEIGHT' | 'MOTHERTONGUE' | 'MARITALSTATUS'
  | 'EATINGHABITS' | 'PHYSICALSTATUS' | 'PROFILECREATED'

// Multi-select fields sharing one generic checkbox-list editor.
export const SIMPLE_MULTI_FIELDS = new Set<FieldKey>([
  'RELIGION', 'DOSHAM', 'OCCUPATION', 'MONTHLYINCOME', 'EDUCATION',
  'MOTHERTONGUE', 'MARITALSTATUS', 'EATINGHABITS', 'PHYSICALSTATUS', 'PROFILECREATED',
])

// Angular's real "Profile created" field is a recency multi-select (Any Time /
// 1 Week ago / 1 month ago / 3 Month ago — confirmed against a live
// screenshot), not the on/off toggle this port previously used. These 4
// options are fixed/local (no server list exists for them, unlike every
// other SIMPLE_MULTI_FIELDS entry), but the underlying day-count CODES sent
// to the search API ('7'/'30'/'90') are an unconfirmed best guess — a
// reasonable convention for day-based recency buckets, not verified against
// Angular's actual API contract. If matches don't filter correctly by this
// field, these codes are the first thing to check.
function getProfileCreatedOptions(t: (key: string) => string): MultiSelectOption[] {
  return [
    { key: '0',  label: t('FILTER.PROFILECREATED_ANYTIME') },
    { key: '7',  label: t('FILTER.PROFILECREATED_1WEEK') },
    { key: '30', label: t('FILTER.PROFILECREATED_1MONTH') },
    { key: '90', label: t('FILTER.PROFILECREATED_3MONTH') },
  ]
}

export const AGE_OPTIONS: PickerOption[] = Array.from({ length: 53 }, (_, i) => {
  const age = 18 + i
  return { key: String(age), label: `${age} yrs` }
})

// ─── Modal stacking ───────────────────────────────────────────────────────────
// react-native-web's Modal portals into a <div> it appends to document.body the
// moment the component MOUNTS (ModalPortal.js), and ModalContent styles it
// `position: fixed` with NO z-index — so which modal sits on top is decided
// purely by document order, i.e. by mount order.
//
// StrictFieldEditorScreen is mounted lazily (`{fieldEditorOpen && ...}`), so its
// div is always appended last and covers anything mounted with the screen. The
// pickers below open FROM inside it, so they have to mount after it too.
// Gating each on its own open state does that: the div is created on open and
// therefore lands last. The short unmount delay keeps the picker alive through
// its own slide-out animation instead of ripping it out mid-transition.
function useModalMounted(visible: boolean, exitMs = 300): boolean {
  const [mounted, setMounted] = useState(visible)
  useEffect(() => {
    if (visible) { setMounted(true); return }
    const id = setTimeout(() => setMounted(false), exitMs)
    return () => clearTimeout(id)
  }, [visible, exitMs])
  return mounted
}

// ─── SearchScreen ─────────────────────────────────────────────────────────────

export default function SearchScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const isDesktop = useIsDesktopWeb()

  const [loading,    setLoading]    = useState(true)
  const [eventType,  setEventType]  = useState<'filter' | 'pp'>('pp')
  const [selected,   setSelected]   = useState<Record<string, any>>(DEFAULT_FILTER)
  const [ppCheckBox, setPpCheckBox] = useState<string[]>([])
  const [gender,     setGender]     = useState('1')
  const [matriId,    setMatriId]    = useState('')
  const [userName,   setUserName]   = useState('')

  const [matchCount,   setMatchCount]   = useState(0)
  const [countLoading, setCountLoading] = useState(false)

  // Strict Filter (Angular JODII-453, Figma node 647:13268) — per-field
  // toggles, persisted via filterService's getStrictFilterState()/
  // setStrictFilterState() and sent to the search API as the STRICKPP param
  // (buildSearchParams() reads this same storage internally).
  const [strictPrefs, setStrictPrefs] = useState<Record<string, boolean>>({})
  const [manageStrictOpen, setManageStrictOpen] = useState(false)
  // Mobile per-field wrapper (Figma nodes 1364:2128 / 1385:302) — which of the
  // 14 strict fields is currently shown in its own "Select preferred X" +
  // strict-toggle screen. Stacks on top of manageStrictOpen's Modal when
  // opened via the manage-list's edit-pencil (both stay mounted/visible).
  const [fieldEditorOpen, setFieldEditorOpen] = useState<FieldKey | null>(null)

  // key -> {key,label}[] cache, populated the first time a field's options are
  // fetched — used both to render the picker and to resolve display labels.
  const [labelCache, setLabelCache] = useState<Record<string, MultiSelectOption[]>>({})

  const [ageEditor,    setAgeEditor]    = useState<'min' | 'max' | null>(null)
  const [heightEditor, setHeightEditor] = useState<'min' | 'max' | null>(null)
  const [locationStep, setLocationStep] = useState<'state' | 'city' | null>(null)
  const [starStep,     setStarStep]     = useState<'raasi' | 'star' | null>(null)
  const [multiEditor,  setMultiEditor]  = useState<FieldKey | null>(null)
  const [heightOptions, setHeightOptions] = useState<PickerOption[]>([])

  // Mount gates for the picker modals — see useModalMounted. Every field row
  // except PROFILECREATED opens StrictFieldEditorScreen first and the picker on
  // top of it, so the pickers MUST mount after it to be visible at all.
  const ageMinMounted    = useModalMounted(ageEditor === 'min')
  const ageMaxMounted    = useModalMounted(ageEditor === 'max')
  const heightMinMounted = useModalMounted(heightEditor === 'min')
  const heightMaxMounted = useModalMounted(heightEditor === 'max')
  const stateMounted     = useModalMounted(locationStep === 'state')
  const cityMounted      = useModalMounted(locationStep === 'city')
  const raasiMounted     = useModalMounted(starStep === 'raasi')
  const starMounted      = useModalMounted(starStep === 'star')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guards the live match-count preview below against a stale response
  // overwriting a fresher one — the 400ms debounce only delays when a new
  // request FIRES, it doesn't stop an already-in-flight one from a previous
  // firing finishing late and racing a newer request's response.
  const countAbortRef = useRef<AbortController | null>(null)
  const countGenRef    = useRef(0)

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      // Opening this screen (every "Edit preferences" entry point navigates
      // here) HITS editprofile/getpreference/v1 — force=true, so a warm
      // PP_SET_DATA cache doesn't skip the call. That response's STRICKPP is
      // what drives the strict toggles, and the live branch of getPPSetData
      // seeds them with overwrite semantics (Angular: profile.service.ts —
      // "Keep the strict filter toggles of the PP page in sync with the
      // STRICKPP of the response"), so the server's saved prefs always win here.
      //
      // Must finish BEFORE getStrictFilterState() below, or the toggles render
      // from whatever was in storage before the fetch.
      //
      // Note: Angular's own search.component.ts calls getPPSETData(0) — the
      // cache-first flag. Forcing is the deliberate difference, so the toggles
      // can't show a stale STRICKPP.
      await getPPSetData(true).catch(() => null)

      const [obj, pp, evType, id, gen, name, strict] = await Promise.all([
        getSelectedObject(),
        getSearchPPCheckBox(),
        getFilterEventType(),
        getItem(SK.Auth.USER_ID),
        getItem(SK.User.LOGIN_GENDER),
        getItem(SK.User.NAME),
        getStrictFilterState(),
      ])
      setSelected(obj)
      setPpCheckBox(pp)
      setEventType(evType)
      setMatriId(id ?? '')
      setGender(gen ?? '1')
      setUserName(name ?? '')
      setStrictPrefs(strict)
      setLoading(false)
    })()
  }, [])

  function toggleStrictPref(key: string, value: boolean) {
    setStrictPrefs(prev => {
      const next = { ...prev, [key]: value }
      setStrictFilterState(next as Record<FieldKey, boolean>).catch(() => {})
      return next
    })
  }

  // ── Live match-count preview ─────────────────────────────────────────────
  // Angular: search.component.ts getMatchesCount() — re-fires on every field edit.

  useEffect(() => {
    if (loading || !matriId) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      countAbortRef.current?.abort()
      const controller = new AbortController()
      countAbortRef.current = controller
      const myGen = ++countGenRef.current

      setCountLoading(true)
      try {
        await saveFilterState(selected, ppCheckBox, {})
        const params = await buildSearchParams(matriId, 0, 1)
        const res = await fetchSearchResults(params, controller.signal)
        // A newer request has since started — this one's result is stale,
        // discard it instead of overwriting the count for the current filters.
        if (myGen !== countGenRef.current) return
        setMatchCount(res.totalCount)
      } catch {
        // keep last known count on failure
      } finally {
        if (myGen === countGenRef.current) setCountLoading(false)
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      countAbortRef.current?.abort()
    }
  }, [selected, ppCheckBox, strictPrefs, loading, matriId])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function updateField(key: string, value: any) {
    setSelected(prev => ({ ...prev, [key]: value }))
  }

  async function ensureOptions(key: string, loader: () => Promise<MultiSelectOption[]>) {
    if (labelCache[key]) return labelCache[key]
    const opts = await loader()
    setLabelCache(prev => ({ ...prev, [key]: opts }))
    return opts
  }

  // Shared with hooks/useFilterDisplayValues.ts (desktop Matches filter
  // sidebar) via adapters/filterPreference.adapter.ts — same "Any"-sentinel +
  // code->label resolution rule, just fed this screen's own lazily-cached
  // per-field option list instead of the sidebar's eagerly-fetched one.
  function labelsFor(key: string, keys: string[]): string {
    return resolveFilterLabel(labelCache[key] ?? [], keys, t('SEARCH.ANY'))
  }

  // ── Row value display ────────────────────────────────────────────────────

  // ── Caste / Division row visibility ──────────────────────────────────────
  // Angular: search.component.ts:1429-1446 (JA-104) filters searchInputLists —
  //   CASTE    → RELIGION.key !== '0' && RELIGION.key !== '2' && filterDataList.CASTE non-empty
  //   DIVISION → RELIGION.key !== '0' && RELIGION.key === '2' && filterDataList.CASTE non-empty
  // RELIGION.key is the whole selection joined (multi-select is comma-joined,
  // cf. filter-popup.component.ts's `relgval.replace(/,/g,'~')`), so `=== '2'`
  // means Christian ALONE. The "several religions → show neither" case falls
  // out of the second clause: the caste fetch for a mixed religion returns no
  // list, so filterDataList.CASTE stays empty and both rows drop out. That
  // list-emptiness check is the real gate, not an "exactly one religion" rule —
  // two caste-bearing religions still show CASTE if the server returns options.
  //
  // Religion '2' is CHRISTIAN, not Islam: search.component.ts:100 ("For
  // christian the division field is filled from the caste list") and
  // CasteScreen.tsx's `isChristian = religion === '2'`. The old `isIslam` name
  // here (and in useFilterDisplayValues.ts) mislabelled it — the behaviour it
  // drove was right, the name wasn't.
  const religionKey  = (selected.RELIGION ?? []).filter((k: string) => k && k !== '0').join(',')
  const isChristian  = religionKey === '2'
  const religionIsAny = religionKey === ''

  // Angular keeps filterDataList.CASTE populated by re-fetching on every
  // religion change; this is the same fetch, kept only as "did it return
  // anything", which is all the visibility rule needs.
  const [casteListAvailable, setCasteListAvailable] = useState(false)
  const motherTongue = selected.MOTHERTONGUE?.[0] ?? ''

  useEffect(() => {
    if (religionIsAny) { setCasteListAvailable(false); return }
    let cancelled = false
    ;(async () => {
      try {
        const opts = isChristian
          ? await fetchDivisionOptions()
          : await fetchCasteOptions(religionKey, motherTongue)
        if (cancelled) return
        setCasteListAvailable(opts.length > 0)
        // The row's own value resolves against this same list — cache it here
        // rather than making the prefetch above fetch it a second time.
        if (opts.length > 0) {
          setLabelCache(prev => ({ ...prev, [isChristian ? 'DIVISION' : 'CASTE']: opts }))
        }
      } catch {
        if (!cancelled) setCasteListAvailable(false)
      }
    })()
    return () => { cancelled = true }
  }, [religionKey, isChristian, religionIsAny, motherTongue])

  const showCasteRow = !religionIsAny && casteListAvailable

  // ── Resolve saved selections to labels ───────────────────────────────────
  // Option lists load lazily (only when a field's own editor opens), so on a
  // fresh mount labelCache is empty and resolveFilterLabel falls back to the
  // raw code (`opts.find(...)?.label ?? k`) — the rows rendered "2, 4, 1"
  // instead of the real values. Prefetch the list for every field that HOLDS a
  // selection, so each row can show labels; fields still at "Any" need no list
  // and are skipped, the same non-default-only rule useFilterDisplayValues uses.
  useEffect(() => {
    if (loading) return
    let cancelled = false

    const wanted: Array<[string, () => Promise<MultiSelectOption[]>]> = []
    const want = (key: string, sel: any, loader: () => Promise<MultiSelectOption[]>) => {
      if (!isAnySelection(sel) && !labelCache[key]) wanted.push([key, loader])
    }

    want('RELIGION',       selected.RELIGION,       fetchReligionOptions)
    want('OCCUPATION',     selected.OCCUPATION,     fetchOccupationOptions)
    want('MONTHLYINCOME',  selected.MONTHLYINCOME,  fetchMonthlyIncomeOptions)
    want('EDUCATION',      selected.EDUCATION,      fetchQualificationOptions)
    want('MOTHERTONGUE',   selected.MOTHERTONGUE,   fetchMotherTongueOptions)
    want('MARITALSTATUS',  selected.MARITALSTATUS,  () => fetchMaritalStatusOptions(gender))
    want('EATINGHABITS',   selected.EATINGHABITS,   fetchEatingHabitOptions)
    want('PHYSICALSTATUS', selected.PHYSICALSTATUS, fetchPhysicalStatusOptions)
    want('STATE',          selected.STATE,          fetchStates)
    want('DOSHAM',         selected.DOSHAM,
      async () => (await fetchDoshamOptions(selected.STAR?.[0] ?? '', '', selected.MOTHERTONGUE?.[0])).dosham)
    if (!isAnySelection(selected.STATE)) {
      want('CITY', selected.CITY, () => fetchCities(selected.STATE[0]))
    }
    // Height rows read labelCache.HEIGHT for both bounds; DEFAULT_FILTER's
    // 1..5 is the "Any" case, so only fetch once it's been narrowed.
    if (selected.STARTHEIGHT?.[0] !== DEFAULT_FILTER.STARTHEIGHT[0]
      || selected.ENDHEIGHT?.[0] !== DEFAULT_FILTER.ENDHEIGHT[0]) {
      want('HEIGHT', selected.STARTHEIGHT, () => fetchExactHeightOptions(gender))
    }
    // STAR codes aren't grouped by raasi in storage, so resolving one means
    // flattening every raasi's star list (same approach useFilterDisplayValues
    // takes) — only worth it when STAR actually differs from "Any".
    want('STAR', selected.STAR, async () => {
      const raasis = await fetchRaasiOptions()
      const groups = await Promise.all(raasis.map(r => fetchStarOptions(r.key)))
      return groups.flat()
    })

    if (wanted.length === 0) return

    ;(async () => {
      const loaded = await Promise.all(wanted.map(async ([key, loader]) => {
        try { return { key, opts: await loader() } } catch { return { key, opts: [] as MultiSelectOption[] } }
      }))
      if (cancelled) return
      setLabelCache(prev => {
        const next = { ...prev }
        loaded.forEach(({ key, opts }) => { if (!next[key]) next[key] = opts })
        return next
      })
    })()

    return () => { cancelled = true }
    // labelCache is deliberately not a dep: `want` already skips anything
    // cached, and including it would re-run this on every cache write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, selected, gender])

  const rowValue = useMemo(() => {
    return {
      AGE:            `${selected.STARTAGE ?? '18'} - ${selected.ENDAGE ?? '50'} ${t('SEARCH.ANY') === 'Any' ? 'yrs' : ''}`.trim(),
      LOCATION:       labelsFor('CITY', selected.CITY ?? []) !== t('SEARCH.ANY')
                        ? labelsFor('CITY', selected.CITY ?? [])
                        : labelsFor('STATE', selected.STATE ?? []),
      RELIGION:       labelsFor('RELIGION', selected.RELIGION ?? []),
      CASTE:          isChristian ? labelsFor('DIVISION', selected.DIVISION ?? []) : labelsFor('CASTE', selected.CASTE ?? []),
      STAR:           labelsFor('STAR', selected.STAR ?? []),
      DOSHAM:         labelsFor('DOSHAM', selected.DOSHAM ?? []),
      OCCUPATION:     labelsFor('OCCUPATION', selected.OCCUPATION ?? []),
      MONTHLYINCOME:  labelsFor('MONTHLYINCOME', selected.MONTHLYINCOME ?? []),
      EDUCATION:      labelsFor('EDUCATION', selected.EDUCATION ?? []),
      HEIGHT:         (selected.STARTHEIGHT?.[0] && selected.ENDHEIGHT?.[0])
                        ? `${labelsFor('HEIGHT', selected.STARTHEIGHT)} - ${labelsFor('HEIGHT', selected.ENDHEIGHT)}`
                        : t('SEARCH.ANY'),
      MOTHERTONGUE:   labelsFor('MOTHERTONGUE', selected.MOTHERTONGUE ?? []),
      MARITALSTATUS:  labelsFor('MARITALSTATUS', selected.MARITALSTATUS ?? []),
      EATINGHABITS:   labelsFor('EATINGHABITS', selected.EATINGHABITS ?? []),
      PHYSICALSTATUS: labelsFor('PHYSICALSTATUS', selected.PHYSICALSTATUS ?? []),
      PROFILECREATED: labelsFor('PROFILECREATED', selected.PROFILECREATED ?? []),
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [selected, labelCache, isChristian])

  // ── Field open handlers ──────────────────────────────────────────────────

  async function openSimpleMulti(key: FieldKey) {
    let opts: MultiSelectOption[] = []
    switch (key) {
      case 'RELIGION':       opts = await ensureOptions('RELIGION', fetchReligionOptions); break
      case 'DOSHAM':         opts = await ensureOptions('DOSHAM', async () => (await fetchDoshamOptions(selected.STAR?.[0] ?? '', '', selected.MOTHERTONGUE?.[0])).dosham); break
      case 'OCCUPATION':     opts = await ensureOptions('OCCUPATION', fetchOccupationOptions); break
      case 'MONTHLYINCOME':  opts = await ensureOptions('MONTHLYINCOME', fetchMonthlyIncomeOptions); break
      case 'EDUCATION':      opts = await ensureOptions('EDUCATION', fetchQualificationOptions); break
      case 'MOTHERTONGUE':   opts = await ensureOptions('MOTHERTONGUE', fetchMotherTongueOptions); break
      case 'MARITALSTATUS':  opts = await ensureOptions('MARITALSTATUS', () => fetchMaritalStatusOptions(gender)); break
      case 'EATINGHABITS':   opts = await ensureOptions('EATINGHABITS', fetchEatingHabitOptions); break
      case 'PHYSICALSTATUS': opts = await ensureOptions('PHYSICALSTATUS', fetchPhysicalStatusOptions); break
      case 'PROFILECREATED': opts = await ensureOptions('PROFILECREATED', async () => getProfileCreatedOptions(t)); break
      default: break
    }
    if (opts.length === 0) return
    setMultiEditor(key)
  }

  async function openCaste() {
    const key = isChristian ? 'DIVISION' : 'CASTE'
    const opts = isChristian
      ? await ensureOptions('DIVISION', fetchDivisionOptions)
      // religionKey, not the single `religion` state — Angular sends the WHOLE
      // selection to the caste fetch (filter-popup.component.ts joins a
      // multi-select with '~'), which is exactly why a mixed religion comes
      // back with no list and the row disappears.
      : await ensureOptions('CASTE', () => fetchCasteOptions(religionKey, selected.MOTHERTONGUE?.[0] ?? ''))
    if (opts.length === 0) return
    setMultiEditor(key as FieldKey)
  }

  async function openLocation() {
    await ensureOptions('STATE', fetchStates)
    setLocationStep('state')
  }

  async function openStar() {
    await ensureOptions('RAASI', fetchRaasiOptions)
    setStarStep('raasi')
  }

  // Shared by mobile's SearchablePicker onSelect and SearchDesktopLayout's
  // DesktopSelectField onSelect — same State→City / Raasi→Star cascade either way.
  async function selectState(opt: PickerOption) {
    updateField('STATE', [opt.key])
    updateField('CITY', ['0'])
    const cities = await ensureOptions('CITY', () => fetchCities(opt.key))
    setLabelCache(prev => ({ ...prev, CITY: cities }))
    setLocationStep('city')
  }

  async function selectRaasi(opt: PickerOption) {
    const stars = await ensureOptions(`STAR_${opt.key}`, () => fetchStarOptions(opt.key))
    setLabelCache(prev => ({ ...prev, STAR: stars }))
    setStarStep('star')
  }

  async function openHeight(bound: 'min' | 'max') {
    const opts = await ensureOptions('HEIGHT', () => fetchExactHeightOptions(gender))
    setHeightOptions(opts.map(o => ({ key: o.key, label: o.label.replace(/<[^>]+>/g, '') })))
    setHeightEditor(bound)
  }

  function openFieldPicker(key: FieldKey) {
    if (key === 'AGE') { setAgeEditor('min'); return }
    if (key === 'HEIGHT') { openHeight('min'); return }
    if (key === 'LOCATION') { openLocation(); return }
    if (key === 'STAR') { openStar(); return }
    if (key === 'CASTE') { openCaste(); return }
    if (SIMPLE_MULTI_FIELDS.has(key)) { openSimpleMulti(key); return }
  }

  // PROFILECREATED is Filter-mode-only, never a strict field (not in
  // STRICT_FIELD_ORDER) — it bypasses StrictFieldEditorScreen and opens its
  // picker directly, same as before this wrapper existed.
  function fieldRowPress(key: FieldKey) {
    if (key === 'PROFILECREATED') { openFieldPicker(key); return }
    setFieldEditorOpen(key)
  }

  // ── Reset / Apply ─────────────────────────────────────────────────────────

  async function handleReset() {
    // Reset now shows in both modes (see header below) — resetFilter('pp')
    // additionally clears the stored eventType flag itself, which 'filter'
    // deliberately doesn't touch; passing the actual current mode instead of
    // always hardcoding 'filter' matters now that this fires from PP mode too.
    await resetFilter(eventType)
    const obj = { ...DEFAULT_FILTER }
    setSelected(obj)
    setPpCheckBox([])
    setLabelCache({})
  }

  async function handleShowMatches() {
    await saveFilterState(selected, ppCheckBox, {})
    const params = await buildSearchParams(matriId, 0, 20)
    navigation.navigate('Matches', { searchParams: params })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Row order matches Figma's "Jodii - Filters (Partner Preferences)" mobile
  // list (node 1364:1711) exactly — confirmed via screenshot: Age, Location,
  // Caste, Star, Dosham, Occupation, Monthly income, Education, Height,
  // Mother tongue, Religion, Marital status, Physical status. Religion sits
  // near the end (after Mother tongue), not right after Location, contrary
  // to this port's original (pre-Figma-review) guess. Same order the desktop
  // card (node 647:11468) already used, so one array now serves both.
  const rows: Array<{ key: FieldKey; label: string; hidden?: boolean }> = [
    { key: 'AGE',            label: t('FILTER.AGE') },
    { key: 'LOCATION',       label: t('FILTER.LOCATION') },
    { key: 'CASTE',          label: isChristian ? t('FILTER.DIVISION') : t('FILTER.CASTE'), hidden: !showCasteRow },
    { key: 'STAR',           label: t('FILTER.STAR') },
    { key: 'DOSHAM',         label: t('FILTER.DOSHAM') },
    { key: 'OCCUPATION',     label: t('FILTER.OCCUPATION') },
    { key: 'MONTHLYINCOME',  label: t('FILTER.MONTHLYINCOME'), hidden: gender === '1' },
    { key: 'EDUCATION',      label: t('FILTER.EDUCATION') },
    { key: 'HEIGHT',         label: t('FILTER.HEIGHT') },
    { key: 'MOTHERTONGUE',   label: t('FILTER.MOTHERTONGUE') },
    { key: 'RELIGION',       label: t('FILTER.RELIGION') },
    { key: 'MARITALSTATUS',  label: t('FILTER.MARITALSTATUS') },
    { key: 'PHYSICALSTATUS', label: t('FILTER.PHYSICALSTATUS') },
    { key: 'EATINGHABITS',   label: t('FILTER.EATINGHABITS') },
    { key: 'PROFILECREATED', label: t('FILTER.PROFILECREATED'), hidden: eventType !== 'filter' },
  ]

  if (isDesktop) {
    return (
      <SearchDesktopLayout
        navigation={navigation}
        userName={userName}
        loading={loading}
        rows={rows}
        rowValue={rowValue}
        selected={selected}
        labelCache={labelCache}
        heightOptions={heightOptions}
        fieldIcon={FIELD_ICON}
        matchCount={matchCount}
        countLoading={countLoading}
        strictPrefs={strictPrefs}
        onToggleStrictPref={toggleStrictPref}
        manageStrictOpen={manageStrictOpen}
        setManageStrictOpen={setManageStrictOpen}
        ageEditor={ageEditor}
        setAgeEditor={setAgeEditor}
        heightEditor={heightEditor}
        setHeightEditor={setHeightEditor}
        locationStep={locationStep}
        setLocationStep={setLocationStep}
        starStep={starStep}
        setStarStep={setStarStep}
        multiEditor={multiEditor}
        setMultiEditor={setMultiEditor}
        updateField={updateField}
        openSimpleMulti={openSimpleMulti}
        openCaste={openCaste}
        openLocation={openLocation}
        openStar={openStar}
        openHeight={openHeight}
        selectState={selectState}
        selectRaasi={selectRaasi}
        onReset={handleReset}
        onShowMatches={handleShowMatches}
      />
    )
  }

  if (loading) {
    return (
      <View style={[s.screen, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
      </View>
    )
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle}>
          {eventType === 'filter' ? t('FILTER.FILTER_HEADER') : t('FILTER.PP_HEADER')}
        </Text>
        {/* Figma (node 15889:1907) shows Reset in BOTH Filter and Partner-
            preferences mode — this previously only showed it in filter mode. */}
        <Pressable onPress={handleReset} hitSlop={8}>
          <Text style={s.resetText}>{t('FILTER.RESET_HEADER')}</Text>
        </Pressable>
      </View>

      <ScrollView style={s.flex1} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* {eventType !== 'filter' && (
          <View style={s.subHeader}>
            <Text style={s.subHeaderText}>{t('FILTER.FILTER_SUB_HEADER')}</Text>
          </View>
        )} */}

        {/* Strict Filter entry point (Figma node 1364:1711) — Partner-
            Preference mode only (same gate as the sub-header above). */}
        {eventType !== 'filter' && (
          <View style={s.strictBanner}>
            <Text style={s.strictBannerTitle}>{STRICT_FILTERS_TITLE}</Text>
            <Text style={s.strictBannerDesc}>{STRICT_FILTERS_NOTE}</Text>
            <Pressable style={s.manageStrictBtn} onPress={() => setManageStrictOpen(true)} accessibilityRole="button">
              <Text style={s.manageStrictBtnText}>{MANAGE_FILTER_CTA}</Text>
            </Pressable>
          </View>
        )}

        <View style={s.card}>
          {rows.filter(r => !r.hidden).map((row, i, arr) => (
            <View key={row.key}>
              <Pressable
                style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                onPress={() => fieldRowPress(row.key)}
                accessibilityRole="button"
              >
                <CdnSvg uri={FIELD_ICON[row.key]} width={20} height={20} style={s.rowIcon} />
                <View style={s.rowText}>
                  <Text style={s.rowLabel}>{row.label}</Text>
                  <Text style={s.rowValue} numberOfLines={1}>{(rowValue as any)[row.key]}</Text>
                </View>
                <CdnSvg uri={ICON_ARROW} width={16} height={16} />
              </Pressable>
              {i < arr.length - 1 && <View style={s.rowDivider} />}
            </View>
          ))}

          {/* Filter-mode-only, same as PROFILECREATED above — this port
              previously only had these two on the DESKTOP sidebar
              (MatchesFilterSidebar.tsx's own CheckboxGroup, tied to the quick-
              filter chip state); mobile's full Filters screen never showed
              them at all, even though they're part of the same persisted
              filterService selection (PHOTOAVAILABLE/HOROSCOPEAVAILABLE are
              already in DEFAULT_FILTER and saved/sent the same way every
              other field here is). */}
          {eventType === 'filter' && (
            <>
              <View style={s.rowDivider} />
              <CheckboxGroup
                options={[
                  {
                    key:     'PHOTOAVAILABLE',
                    value:   t('MATCHES.PP_ADDED_PHOTOS_CHECKBOX'),
                    checked: selected.PHOTOAVAILABLE === '1',
                  },
                  {
                    key:     'HOROSCOPEAVAILABLE',
                    value:   t('MATCHES.PP_HOROSCOPE_CHECKBOX'),
                    checked: selected.HOROSCOPEAVAILABLE === '1',
                  },
                ]}
                onToggle={(key, checked) => updateField(key, checked ? '1' : '0')}
              />
            </>
          )}
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={s.applyBtn} onPress={handleShowMatches} disabled={countLoading}>
          {countLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={s.applyText}>
              {(matchCount === 1 ? t('FILTER.FILTER_SHOW_MATCH_CTA') : t('FILTER.FILTER_SHOW_MATCHES_CTA'))
                .replace('#MATCHESCOUNT#', String(matchCount))}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Every picker below is wrapped in `{...Mounted && ...}` — see
          useModalMounted's header comment. Without it they mount with the
          screen, so their portal <div>s sit BEFORE StrictFieldEditorScreen's in
          document.body and it covers them: the picker opened from inside that
          screen was rendering, just underneath it. */}

      {/* ── AGE: bounded min/max via SearchablePicker ── */}
      {ageMinMounted && <SearchablePicker
        visible={ageEditor === 'min'}
        title={t('FILTER.LBL_MIN_AGE')}
        placeholder={t('FILTER.PLACEHOLDER_MIN_AGE')}
        options={AGE_OPTIONS.filter(o => Number(o.key) < Number(selected.ENDAGE ?? 50))}
        selectedKey={selected.STARTAGE}
        onSelect={opt => { updateField('STARTAGE', opt.key); setAgeEditor('max') }}
        onClose={() => setAgeEditor(null)}
      />}
      {ageMaxMounted && <SearchablePicker
        visible={ageEditor === 'max'}
        title={t('FILTER.LBL_MAX_AGE')}
        placeholder={t('FILTER.PLACEHOLDER_MAX_AGE')}
        options={AGE_OPTIONS.filter(o => Number(o.key) > Number(selected.STARTAGE ?? 18))}
        selectedKey={selected.ENDAGE}
        onSelect={opt => { updateField('ENDAGE', opt.key); setAgeEditor(null) }}
        onClose={() => setAgeEditor(null)}
      />}

      {/* ── HEIGHT: bounded min/max via SearchablePicker ── */}
      {heightMinMounted && <SearchablePicker
        visible={heightEditor === 'min'}
        title={t('FILTER.LBL_MIN_HEIGHT')}
        placeholder={t('FILTER.PLACEHOLDER_MIN_HEIGHT')}
        options={heightOptions}
        selectedKey={selected.STARTHEIGHT?.[0]}
        onSelect={opt => { updateField('STARTHEIGHT', [opt.key]); openHeight('max') }}
        onClose={() => setHeightEditor(null)}
      />}
      {heightMaxMounted && <SearchablePicker
        visible={heightEditor === 'max'}
        title={t('FILTER.LBL_MAX_HEIGHT')}
        placeholder={t('FILTER.PLACEHOLDER_MAX_HEIGHT')}
        options={heightOptions}
        selectedKey={selected.ENDHEIGHT?.[0]}
        onSelect={opt => { updateField('ENDHEIGHT', [opt.key]); setHeightEditor(null) }}
        onClose={() => setHeightEditor(null)}
      />}

      {/* ── LOCATION: State → City ── */}
      {stateMounted && <SearchablePicker
        visible={locationStep === 'state'}
        title={t('FILTER.SELECT_STATE')}
        placeholder={t('FILTER.SEARCH_STATE')}
        options={(labelCache.STATE ?? []).map(o => ({ key: o.key, label: o.label }))}
        selectedKey={selected.STATE?.[0]}
        onSelect={selectState}
        onClose={() => setLocationStep(null)}
      />}
      {cityMounted && <MultiSelectPicker
        visible={locationStep === 'city'}
        title={t('FILTER.SELECT_CITY')}
        placeholder={t('FILTER.SEARCH_CITY')}
        options={labelCache.CITY ?? []}
        selectedKeys={selected.CITY ?? ['0']}
        anyLabel={t('SEARCH.ANY')}
        onApply={keys => updateField('CITY', keys)}
        onClose={() => setLocationStep(null)}
      />}

      {/* ── STAR: Raasi → Star ── */}
      {raasiMounted && <SearchablePicker
        visible={starStep === 'raasi'}
        title={t('FILTER.SUBTITLE_STAR')}
        placeholder=""
        options={labelCache.RAASI ?? []}
        selectedKey={undefined}
        onSelect={selectRaasi}
        onClose={() => setStarStep(null)}
      />}
      {starMounted && <MultiSelectPicker
        visible={starStep === 'star'}
        title={t('FILTER.SELECT_STAR')}
        placeholder={t('FILTER.SEARCH_STAR')}
        options={labelCache.STAR ?? []}
        selectedKeys={selected.STAR ?? ['0']}
        anyLabel={t('SEARCH.ANY')}
        onApply={keys => updateField('STAR', keys)}
        onClose={() => setStarStep(null)}
      />}

      {/* ── Generic multi-select fields (Religion, Caste/Division, Dosham, Occupation,
           Income, Education, Mother Tongue, Marital Status, Eating Habits, Physical Status) ── */}
      {multiEditor && (
        <MultiSelectPicker
          visible={!!multiEditor}
          title={t(`FILTER.${multiEditor}` as any)}
          placeholder={multiEditor === 'RELIGION' ? t('FILTER.SEARCH_RELIGION')
            : multiEditor === 'CASTE' ? t('FILTER.SEARCH_CASTE')
            : multiEditor === 'MOTHERTONGUE' ? t('FILTER.SEARCH_MOTHERTONGUE')
            : undefined}
          options={labelCache[multiEditor] ?? []}
          selectedKeys={selected[multiEditor] ?? ['0']}
          anyLabel={t('SEARCH.ANY')}
          onApply={keys => {
            updateField(multiEditor, keys)
            if (multiEditor === 'RELIGION') {
              // Religion changed — stale caste/subcaste cache must be dropped.
              updateField('CASTE', ['0'])
              updateField('DIVISION', ['0'])
              setLabelCache(prev => { const n = { ...prev }; delete n.CASTE; delete n.DIVISION; return n })
            }
          }}
          onClose={() => setMultiEditor(null)}
        />
      )}

      <StrictFilterManageModal
        visible={manageStrictOpen}
        onClose={() => setManageStrictOpen(false)}
        strictState={strictPrefs as Record<FieldKey, boolean>}
        onToggle={toggleStrictPref}
        onEditField={key => setFieldEditorOpen(key)}
        fieldIcon={FIELD_ICON}
        fieldLabel={Object.fromEntries(rows.map(r => [r.key, r.label])) as Record<FieldKey, string>}
        fieldValue={rowValue as Record<FieldKey, string>}
        anyLabel={t('SEARCH.ANY')}
        matchCount={matchCount}
        countLoading={countLoading}
        onShowMatches={handleShowMatches}
      />

      {/* ── Per-field strict wrapper (Figma nodes 1364:2128 / 1385:302) ──
          Sits AROUND the field's own existing picker (opened unchanged via
          openFieldPicker) rather than replacing it — the picker's own Modal
          stacks on top of this one when the CompactFieldRow below is tapped. */}
      {fieldEditorOpen && (
        <StrictFieldEditorScreen
          visible={!!fieldEditorOpen}
          onClose={() => setFieldEditorOpen(null)}
          fieldKey={fieldEditorOpen}
          fieldLabel={rows.find(r => r.key === fieldEditorOpen)?.label ?? ''}
          fieldValue={(rowValue as any)[fieldEditorOpen]}
          strictEnabled={!!strictPrefs[fieldEditorOpen]}
          onToggleStrict={value => toggleStrictPref(fieldEditorOpen, value)}
          anyLabel={t('SEARCH.ANY')}
          matchCount={matchCount}
          countLoading={countLoading}
        >
          {fieldEditorOpen === 'AGE' && (
            <>
              <CompactFieldRow
                label={t('FILTER.LBL_MIN_AGE')}
                value={`${selected.STARTAGE ?? '18'} yrs`}
                onPress={() => setAgeEditor('min')}
              />
              <CompactFieldRow
                label={t('FILTER.LBL_MAX_AGE')}
                value={`${selected.ENDAGE ?? '50'} yrs`}
                onPress={() => setAgeEditor('max')}
              />
            </>
          )}
          {fieldEditorOpen === 'HEIGHT' && (
            <>
              <CompactFieldRow
                label={t('FILTER.LBL_MIN_HEIGHT')}
                value={selected.STARTHEIGHT?.[0] ? labelsFor('HEIGHT', selected.STARTHEIGHT) : t('SEARCH.ANY')}
                onPress={() => openHeight('min')}
              />
              <CompactFieldRow
                label={t('FILTER.LBL_MAX_HEIGHT')}
                value={selected.ENDHEIGHT?.[0] ? labelsFor('HEIGHT', selected.ENDHEIGHT) : t('SEARCH.ANY')}
                onPress={() => openHeight('max')}
              />
            </>
          )}
          {fieldEditorOpen !== 'AGE' && fieldEditorOpen !== 'HEIGHT' && (
            <CompactFieldRow
              label={rows.find(r => r.key === fieldEditorOpen)?.label ?? ''}
              value={(rowValue as any)[fieldEditorOpen]}
              onPress={() => openFieldPicker(fieldEditorOpen)}
            />
          )}
        </StrictFieldEditorScreen>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1F3FB' },
  flex1:  { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    height:            56,
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.white,
    paddingHorizontal: 8,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 8 },
    shadowOpacity:      0.08,
    shadowRadius:       8,
    elevation:          4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  // Figma (node 15889:1912/1913): title is Poppins-Medium/16/lineHeight24/black
  // (was a plain system-font 500 weight, #333333); Reset is Poppins-Regular/14
  // and Colors.link (#29339B, indigo) — was Colors.primaryDark, the app's dark
  // RED brand color, a genuinely wrong color for this specific text.
  headerTitle: { flex: 1, fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 16, lineHeight: 24, color: Colors.black, marginLeft: 6 },
  resetText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 16, color: Colors.link, paddingHorizontal: 12 },

  scrollContent: { padding: 16, gap: 12 },
  // Figma (node 15889:2095): a rounded card (5%-opacity tint of the brand red,
  // NOT a plain gray/secondary-colored line of text) — the container carries
  // the background/padding/radius, subHeaderText carries the actual type.
  subHeader: {
    backgroundColor: 'rgba(181,0,51,0.05)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
  },
  subHeaderText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 20, color: Colors.black },

  strictBanner: {
    backgroundColor: '#FBF2F5', borderWidth: 1, borderColor: '#FFE3EC',
    borderRadius: 8, padding: 12, marginBottom: 4, gap: 8,
  },
  strictBannerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black },
  strictBannerDesc:  { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, lineHeight: 20, color: Colors.black },
  manageStrictBtn: {
    height: 40, borderWidth: 1, borderColor: Colors.primaryDark, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  manageStrictBtnText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.primaryDark },

  card: { backgroundColor: Colors.white, borderRadius: 12, overflow: 'hidden' },

  // Figma (node 15889:1927): paddingVertical 20 (was 14) — each row is ~80px
  // tall there, ~56px here, which is why noticeably more rows fit on screen
  // before scrolling than Angular's own reference (~8 rows per screen there).
  row: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    paddingHorizontal: 16,
    paddingVertical:   20,
    gap:               12,
  },
  rowPressed: { opacity: 0.6 },
  rowIcon:  { flexShrink: 0 },
  // Figma: 8px gap between the label line and the value line below it (was a
  // 2px marginBottom on the label alone).
  rowText:  { flex: 1, gap: 8 },
  // Figma: label is 14px Poppins-Regular/black (was 12px, gray) — value is
  // 14px Poppins-Medium/black (was a plain 500-weight system font).
  rowLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 16, color: Colors.black },
  rowValue: { fontFamily: Fonts.poppinsMedium, fontSize: 14, lineHeight: 16, color: Colors.black },
  rowDivider: {
    height:           StyleSheet.hairlineWidth,
    backgroundColor:  'rgba(204,204,204,0.5)',
    marginHorizontal: 16,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop:        12,
    backgroundColor:   Colors.white,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    'rgba(204,204,204,0.5)',
  },
  applyBtn: {
    height:           48,
    borderRadius:     8,
    backgroundColor:  Colors.primaryDark,
    alignItems:       'center',
    justifyContent:   'center',
  },
  applyText: { color: Colors.white, fontSize: 14, fontWeight: '600' },
})
