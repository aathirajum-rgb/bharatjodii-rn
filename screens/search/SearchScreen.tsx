// Angular equivalent: pages/search/search.component.ts + filter-popup.component.ts
// + filter/filter.component.ts (the single shared field-editor machinery for both
// "Filters" (quick/temporary) mode and "Partner preferences" (PP) mode).
//
// Known simplifications vs Angular (documented, not silent):
//  - LOCATION is Country + State + City, three multi-select panels off the
//    field's own page, matching Angular. The City panel is a flat list of the
//    selected states' districts rather than Angular's per-state grouped tree.
//  - CASTE stops at Caste (no Subcaste/Gothra sub-cascade) — those are rarely
//    changed post-onboarding and add a lot of UI for a rarely-touched facet.
//  - STAR is Raasi (single) → Star (multi), a simplified stand-in for Angular's
//    grouped parent/child checkbox tree.
//  - AGE/HEIGHT are bounded single-value Min/Max pickers (not Angular's grouped
//    side-panel lists), reusing the existing SearchablePicker component.
//  - MONTHLYINCOME and DOSHAM are Angular's radio-first fields: three choices
//    from FILTERSCREEN, where only the LAST one opens a sub-list (income
//    brackets / dosham types). See buildRadioChoices and doshamChoices below.
//  - PROFILECREATED, PHOTOAVAILABLE and HOROSCOPEAVAILABLE are Filter-mode-only.
//    PROFILECREATED's options come from the server list (initialfetch's
//    PROFILECREATED), matching Angular; the other two are plain on/off
//    checkboxes, also matching Angular.

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
import { CDN_REACT } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { handleBack } from '../../utils/navigationRef'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import SearchDesktopLayout from './SearchDesktopLayout'
import { fetchSearchResults } from '../../service/homeService'
import {
  resolveFilterLabel, isAnySelection, sortFilterOptions,
  buildRadioChoices, buildIncomeChoices, incomeAmountFor, buildStarGroups, parseStarMatchingKeys,
} from '../../adapters/filterPreference.adapter'
import RadioGroup from '../../components/radio/RadioGroup'
import {
  getSelectedObject, saveFilterState,
  getFilterEventType, resetFilter, buildSearchParams, DEFAULT_FILTER, DEFAULT_PP_CHECKBOX,
  markFilterPPEdited,
  getStrictFilterState, setStrictFilterState, QUICK_FILTER_ICON,
  computeEditedRows, isAnyFieldEdited,
  ppSelectionFromPPSet, hasStoredFilterSelection,
} from '../../service/filterService'
import { getPPSetData } from '../../service/profileService'
import { fetchEditProfileInfo } from '../../service/editProfileService'
import StrictFilterManageModal from '../../components/search/StrictFilterManageModal'
import {
  MANAGE_FILTER_CTA, STRICT_FILTERS_TITLE, STRICT_FILTERS_NOTE,
} from '../../constants/strictFilter.config'
import StrictFieldEditorScreen, { CompactFieldRow } from '../../components/search/StrictFieldEditorScreen'
import {
  fetchReligionOptions, fetchSearchCasteOptions,
  fetchRaasiOptions, fetchStarOptions, fetchDoshamOptions,
  fetchOccupationOptions, fetchQualificationOptions, fetchIncomeRangeOptions,
  fetchMotherTongueOptions, fetchMaritalStatusOptions, fetchEatingHabitOptions,
  fetchPhysicalStatusOptions, fetchExactHeightOptions,
  fetchStates, fetchCities, fetchFilterCountries, getRegistrationArrays, fetchProfileCreatedOptions, getRegValue,
  fetchStateGroups, fetchCityGroups, type OptionGroup,
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
// these paths.
//
// RELIGION is the exception: it has no viewprofile counterpart, and the
// `viewprofile/religion-icon.svg` path guessed from that naming convention
// does not exist (404), so the row rendered with no icon at all. It now uses
// the dedicated react/filter-religion.svg asset — the same one Edit Profile's
// religion row points at, so the two surfaces stay in sync.
const FIELD_ICON: Record<FieldKey, string> = {
  AGE:            ICON.age,
  LOCATION:       ICON.location,
  RELIGION:       CDN_REACT + '/filter-religion.svg',
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

// Angular: `showAnyOption: !['AGE', 'DOSHAM', 'MONTHLYINCOME'].includes(TYPE)`
// (filter.component.ts / filter-popup.component.ts's side-panel payload). These
// two panels are the "pick specific values" step of a radio-first field, so the
// radio group above them already owns the "Dosham doesn't matter" / "Any income"
// answer — repeating it as an Any row inside the panel is a second, conflicting
// way to say the same thing. (AGE has no checkbox panel in this port.)
const NO_ANY_ROW_PANELS = new Set<FieldKey>(['DOSHAM', 'MONTHLYINCOME'])

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
  // The member's saved partner preference, mapped into selection shape — the
  // screen's starting point, the red dot's baseline, and what Reset restores.
  // Angular keeps it as `ppSetDataList` for exactly the same three uses.
  const [ppBaseline, setPpBaseline] = useState<Record<string, any>>(DEFAULT_FILTER)

  // ── Edited-row indicator (the red dot) ───────────────────────────────────
  // Angular: search.component.html:100's `*ngIf="checkIsAnyChanges(item)"`, whose
  // predicate is BOTH conditions together —
  //   checkFilterEventType()            // FILTEREVENTTYPE === 'filter'
  //   && item.isAnyChanges              // this row was actually changed
  // so in Partner-Preference mode the dot never appears, however much is set.
  // Derived, never stored: see computeEditedRows() for why. Declared up here
  // beside `selected` because the debounced count effect persists it too.
  //
  // The baseline is the member's saved partner preference — the screen opens
  // ON it, so a dot marks a Filters-mode change away from it, and Reset (which
  // restores it) clears every dot. DEFAULT_FILTER stands in until it loads.
  const editedRows     = useMemo(() => computeEditedRows(selected, ppBaseline), [selected, ppBaseline])
  const isRowEdited    = (key: string) => eventType === 'filter' && editedRows[key] === true
  // Angular's Reset guard, `if (!isAnyOneFieldEdited()) return` — the same
  // predicate decides whether the button does anything at all.
  const anyFieldEdited = isAnyFieldEdited(editedRows)
  const [gender,     setGender]     = useState('')
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

  // Angular: search.component.ts's `filterScreenList = filterDataList['FILTERSCREEN']`
  // — the per-field label map from the SAME initialfetch(type=all) blob this
  // port already caches as REGISTRATIONARRAYS, so reading it here costs no
  // extra call. Its ['0'] entry is each field's own "unset" wording ("Any
  // caste", "Any star", "Dosham doesn't matter", "Any Country", …), which is
  // what Angular's rows actually display; this port was showing one generic
  // t('SEARCH.ANY') = "Any" for every unset field instead.
  const [filterScreen, setFilterScreen] = useState<Record<string, any>>({})
  const [incomeAmount, setIncomeAmount] = useState('')
  // The member's own income and occupation, which decide WHICH income radio
  // rows exist (Angular's piIncomeStatus / occupationStatus).
  const [piIncome,     setPiIncome]     = useState('')
  const [ownOccupation, setOwnOccupation] = useState('')
  // Location's grouped panels: states under their country, districts under
  // their state (Angular's buildParentChild output).
  const [stateGroups, setStateGroups] = useState<OptionGroup[]>([])
  const [cityGroups,  setCityGroups]  = useState<OptionGroup[]>([])
  // Star's two groups (matching / all other) and the member's own matching
  // star keys, read from PPSETDATA.PISTARMATCHING.
  const [starGroups,   setStarGroups]   = useState<OptionGroup[]>([])
  const [matchingStars, setMatchingStars] = useState<string[]>([])

  const [ageEditor,    setAgeEditor]    = useState<'min' | 'max' | null>(null)
  const [heightEditor, setHeightEditor] = useState<'min' | 'max' | null>(null)
  // Angular's LOCATION field (filterRevampConfig.LOCATION) is three separate
  // checkbox panels — Country, State, City — reached from three rows on the
  // field's own page, not a forced Country->State->City walk.
  const [locationStep, setLocationStep] = useState<'country' | 'state' | 'city' | null>(null)
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
  const countryMounted   = useModalMounted(locationStep === 'country')
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
      const ppSet = await getPPSetData(true).catch(() => null)

      const [obj, hasStored, evType, id, gen, name, occupation, strict, arrays] = await Promise.all([
        getSelectedObject(),
        hasStoredFilterSelection(),
        getFilterEventType(),
        getItem(SK.Auth.USER_ID),
        getItem(SK.User.LOGIN_GENDER),
        getItem(SK.User.NAME),
        // Angular's occupationStatus reads the member's own OCCUPATION. In this
        // port that lives in REGISTRATION_VALUES (setRegValues, written when the
        // profile is fetched); SK.User.OCCUPATION is not written anywhere, so
        // reading only that left the flag permanently false and the income
        // radio unpruned.
        getRegValue('OCCUPATION').catch(() => null),
        getStrictFilterState(),
        getRegistrationArrays().catch(() => ({} as Record<string, any>)),
      ])
      // The height row always holds two real codes (height has no "Any"
      // state), so its label list is needed for the FIRST paint — seeded here
      // rather than left to the lazy prefetch effect, which would show the
      // "Any height" fallback for a frame. Reads the REGISTRATIONARRAYS blob
      // fetched just above, so it adds no request.
      const heightOpts = await fetchExactHeightOptions((gen ?? '') === 'F' ? '1' : '0')
        .catch(() => [] as MultiSelectOption[])

      setFilterScreen((arrays as any)?.FILTERSCREEN ?? {})
      // The member's own income, resolved to a displayable amount, fills the
      // <income> placeholder in Monthly income's radio labels ("Should not
      // exceed ₹50,000") — Angular's setMonthlyIncome() does this once, off
      // PPSETDATA.PIINCOME plus the blob's income lists.
      setIncomeAmount(incomeAmountFor((ppSet as any)?.PIINCOME, arrays as Record<string, any>))
      setPiIncome(String((ppSet as any)?.PIINCOME ?? ''))
      // Angular's occupationStatus reads localStorage.OCCUPATION, which its
      // setStorageValue('2', …) spread writes from the member's own profile.
      // REGISTRATION_VALUES is this port's equivalent container, but it is only
      // filled by flows the member may never have hit — so when it's empty the
      // profile is read once, or the income radio silently keeps rows Angular
      // prunes ("Should not exceed …").
      let ownOcc = String(occupation ?? '')
      if (ownOcc === '') {
        ownOcc = String((await fetchEditProfileInfo().catch(() => null))?.occupation ?? '')
      }
      setOwnOccupation(ownOcc)
      // The member's horoscope-matching stars, which the Star panel groups
      // under "Matching stars" (Angular: selectedObject.PISTARMATCHING, seeded
      // from PPSETDATA the same way).
      setMatchingStars(parseStarMatchingKeys((ppSet as any)?.PISTARMATCHING))
      if (heightOpts.length > 0) setLabelCache(prev => ({ ...prev, HEIGHT: heightOpts }))
      // Angular: setsearchValueList(ppSetDataList) — the saved partner
      // preference IS the screen's starting state, seeded whenever no filter
      // session is stored yet (`if (!localStorage.getItem('SEARCHVALUES'))`).
      // Without this the screen opened on DEFAULT_FILTER, so a member whose
      // preference said "Hindu, 25-30" saw "Any religion, 18-50" instead.
      const baseline = ppSelectionFromPPSet(ppSet as Record<string, any> | null)
      setPpBaseline(baseline)
      setSelected(hasStored ? obj : baseline)
      // FILTERPP reports the fields edited in THIS visit, so the flags start
      // clean on every open — a stale '1' left by an earlier visit would
      // otherwise ride along and break "only the edited field is 1". Both
      // paths that build a payload (the count effect and Show matches) persist
      // this array first, so storage picks the cleared value up too.
      setPpCheckBox([...DEFAULT_PP_CHECKBOX])
      setEventType(evType)
      setMatriId(id ?? '')
      // LOGIN_GENDER is 'M'/'F' (Angular's LOGINGENDER). Angular's
      // getLogInGender() returns '' when it isn't set, and every gender rule
      // below treats that as "not male" — '1' was never a value this key can
      // hold, so defaulting to it just made the state unreadable.
      setGender(gen ?? '')
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
        // Angular persists filterService.selectedFilters alongside the selection
        // (setStorageValues) — that map is what the Matches header's count badge
        // reads back. This wrote `{}`, so the badge was always 0 after an edit.
        await saveFilterState(selected, ppCheckBox, editedRows)
        // forCount — Angular's getUrlParams(0) countParam: SETPP hardcoded
        // all '0', no FILTERPP. This is the count the PP footer AND both
        // strict-filter screens display, and it was going out with the
        // search-call SETPP (1|1|1|…) instead.
        const params = await buildSearchParams(matriId, 0, 1, { forCount: true })
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
    // FILTERPP: flag this field's own position as edited (Angular does the
    // same inside each field editor — filter-popup.component.ts:1377). Every
    // edit on both mobile and desktop funnels through here, so this is the one
    // place that needs it.
    setPpCheckBox(prev => markFilterPPEdited(prev, key))
  }

  async function ensureOptions(key: string, loader: () => Promise<MultiSelectOption[]>) {
    if (labelCache[key]) return labelCache[key]
    const opts = await loader()
    setLabelCache(prev => ({ ...prev, [key]: opts }))
    return opts
  }

  // LOGIN_GENDER is Angular's LOGINGENDER ('M'/'F'), but this port's consumers
  // disagree about it — payWallService/communicationService compare against
  // 'M', while IgnoredProfilesScreen compares against '0' — so the stored value
  // can be either encoding depending on what the webview handed over. Every
  // gender rule below goes through this, because a value in the OTHER encoding
  // silently matches no branch: that alone leaves the income radio unpruned and
  // the Monthly income row visible for men.
  const memberGender: 'M' | 'F' | '' =
    ['F', 'f', '0'].includes(gender) ? 'F'
    : ['M', 'm', '1'].includes(gender) ? 'M'
    : ''

  // Angular (filter.component.ts:601) builds the filter's height list from the
  // OPPOSITE gender's NEWHEIGHT bucket — it's a PARTNER preference, so a male
  // user picks from the female heights and vice versa.
  //
  // Two encodings collide here: `gender` is LOGIN_GENDER ('M'/'F', same as
  // Angular's LOGINGENDER), while fetchExactHeight* takes registration's
  // GENDER ('1' male / '0' female). Passing `gender` straight through never
  // matched '0', so this screen always served the MALE list regardless of who
  // was logged in. This flips to the partner's gender AND translates it.
  const partnerHeightGender = memberGender === 'F' ? '1' : '0'

  // Shared with hooks/useFilterDisplayValues.ts (desktop Matches filter
  // sidebar) via adapters/filterPreference.adapter.ts — same "Any"-sentinel +
  // code->label resolution rule, just fed this screen's own lazily-cached
  // per-field option list instead of the sidebar's eagerly-fetched one.
  // Angular: search.component.ts's `data['selectedData'] =
  // this.filterScreenList[fieldKey][0]` for any field still holding '0'. Each
  // field words its own "unset" state ("Any caste", "Any star", "Dosham
  // doesn't matter"), so a single shared "Any" is never what the reference
  // shows. Falls back to t('SEARCH.ANY') only when FILTERSCREEN has no entry
  // (fields with no server list at all, e.g. PROFILECREATED).
  function anyLabelFor(key: string): string {
    const label = filterScreen?.[key]?.['0']
    return typeof label === 'string' && label.trim() !== '' ? label : t('SEARCH.ANY')
  }

  function labelsFor(key: string, keys: string[]): string {
    return resolveFilterLabel(labelCache[key] ?? [], keys, anyLabelFor(key))
  }

  // ── Radio-first fields: Dosham & Monthly income ──────────────────────────
  // Angular gives both a radio group built from their whole FILTERSCREEN map,
  // and the sub-list ("Select type of dosham" / the income brackets) is
  // reachable ONLY while option '2' is selected (filter.component.html's
  // `disabled: !(selectedData === searchDataList[2])`). This port used to show
  // the sub-list AS the whole field, so neither the "doesn't matter" / "should
  // not have dosham" choices nor the income semantics ("should not exceed" /
  // "should be at least" the member's own income) existed at all.
  const doshamChoices = useMemo(
    // The <gender> placeholder becomes the PARTNER's term: a female member is
    // looking for a groom and vice versa (Angular setDoshamValue()).
    () => buildRadioChoices(filterScreen?.DOSHAM, {
      gender: memberGender === 'F' ? t('SEARCH.GROOM') : t('SEARCH.BRIDE'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterScreen, memberGender],
  )
  // Angular prunes this list per member (getArrayList) — see buildIncomeChoices.
  // `hasOccupation` is Angular's occupationStatus: a stored OCCUPATION that
  // isn't the "not working" code '8'.
  const incomeChoices = useMemo(
    () => buildIncomeChoices(filterScreen?.MONTHLYINCOME, incomeAmount, {
      piIncome:      piIncome,
      gender:        memberGender,
      hasOccupation: ownOccupation !== '' && ownOccupation !== '0' && ownOccupation !== '8',
    }),
    [filterScreen, incomeAmount, piIncome, memberGender, ownOccupation],
  )

  // The radio label for a radio-first field, or null once the member has moved
  // past the radio into the sub-list (dosham types / income brackets), where
  // the value has to come from that list instead. '2' is the sub-list state, so
  // it reports null too — except before anything is picked, when it IS the
  // current answer ("Select income range").
  function radioChoiceLabel(
    field: 'DOSHAM' | 'MONTHLYINCOME', choices: { key: string; label: string }[],
  ): string | null {
    // A real sub-list pick is shown as the picked values themselves, so hand
    // the row back to labelsFor.
    if (hasSubListPick(field)) return null
    return choices.find(c => c.key === radioValueFor(field, choices))?.label ?? null
  }

  // One height bound -> its label, or null when the code can't be resolved.
  // Kept separate from labelsFor() because HEIGHT must never fall back to the
  // raw code: unlike every other field its stored value is always a real
  // list key ('1'..'31'), never the '0' "Any" sentinel, so resolveFilterLabel's
  // anyLabel branch can't catch an unresolved one.
  function heightBound(keys: string[] | undefined): string | null {
    const key = keys?.[0]
    if (!key) return null
    return (labelCache.HEIGHT ?? []).find(o => o.key === key)?.label ?? null
  }

  // ── Row value display ────────────────────────────────────────────────────

  // ── Caste / Division row visibility ──────────────────────────────────────
  // Angular: search.component.ts:1429-1446 (JA-104) filters searchInputLists —
  //   CASTE    → RELIGION.key !== '0' && RELIGION.key !== '2' && filterDataList.CASTE non-empty
  //   DIVISION → RELIGION.key !== '0' && RELIGION.key === '2' && filterDataList.CASTE non-empty
  // RELIGION.key is the WHOLE selection joined, so those three clauses read:
  //   Any religion ('0' / nothing) → neither row: there is no caste to narrow.
  //   Christian alone   ('2')      → the Division row, labelled "Division".
  //   Anything else ('1', '1~2', …)→ the Caste row, labelled "Caste" — and that
  //     deliberately INCLUDES a mixed selection such as Hindu+Christian, where
  //     the one panel lists Hindu castes and Christian divisions together under
  //     the single "Caste" name. Nothing in Angular special-cases multi-select
  //     here; the combined list is simply what the caste API answers for
  //     `religion=1~2`.
  // Both rows read the SAME list (filterDataList.CASTE) — getSearchDataList()
  // maps action 'DIVISION' onto searchType 'CASTE' — so there is one fetch,
  // fetchSearchCasteOptions(), and only the label and the stored key differ.
  //
  // Religion '2' is CHRISTIAN, not Islam: search.component.ts:100 ("For
  // christian the division field is filled from the caste list") and
  // CasteScreen.tsx's `isChristian = religion === '2'`. The old `isIslam` name
  // here (and in useFilterDisplayValues.ts) mislabelled it — the behaviour it
  // drove was right, the name wasn't.
  //
  // '~' is the join Angular sends to every list API (filter-popup.component.ts's
  // `relgval.replace(/,/g,'~')`); this used ',', which the caste API doesn't
  // parse, so a multi-religion selection never resolved to a list.
  const religionKey   = (selected.RELIGION ?? []).filter((k: string) => k && k !== '0').join('~')
  const isChristian   = religionKey === '2'
  const religionIsAny = religionKey === ''

  // Angular keeps filterDataList.CASTE populated by re-fetching on every
  // religion change; this is the same fetch, kept only as "did it return
  // anything", which is all the visibility rule needs.
  // Angular's `contentLoaded = false` during a reset — gates the primary CTA
  // only, not the whole page.
  const [resetting, setResetting] = useState(false)

  const [casteListAvailable, setCasteListAvailable] = useState(false)

  useEffect(() => {
    if (religionIsAny) { setCasteListAvailable(false); return }
    let cancelled = false
    ;(async () => {
      try {
        const opts = await fetchSearchCasteOptions(religionKey)
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
    // The member's own mother tongue is read inside the fetch and never
    // changes here, so the partner-preference MOTHERTONGUE is no longer a dep.
  }, [religionKey, isChristian, religionIsAny])

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
    // The filter's bracket list is MONTHLYINCOMERANGE, not MONTHLYINCOME —
    // see fetchIncomeRangeOptions.
    want('MONTHLYINCOME',  selected.STARTMONTHLYINCOME, fetchIncomeRangeOptions)
    want('EDUCATION',      selected.EDUCATION,      fetchQualificationOptions)
    want('MOTHERTONGUE',   selected.MOTHERTONGUE,   fetchMotherTongueOptions)
    want('MARITALSTATUS',  selected.MARITALSTATUS,  () => fetchMaritalStatusOptions(gender))
    want('EATINGHABITS',   selected.EATINGHABITS,   fetchEatingHabitOptions)
    want('PHYSICALSTATUS', selected.PHYSICALSTATUS, fetchPhysicalStatusOptions)
    want('COUNTRY',        selected.COUNTRY,        fetchFilterCountries)
    want('STATE',          selected.STATE,          fetchStates)
    // `doshamHash`, not `dosham`: the panel lists the dosham TYPES (Chevvai,
    // Kala sarpa, Kethu, …) from DOSHAMHASH[TAMIL|OTHER] — Angular's
    // getArrayData()'s DOSHAM branch reads exactly that. `dosham` is the
    // top-level DOSHAM list, whose own choices the radio group above already
    // owns, so this panel was showing those instead of the types.
    want('DOSHAM',         selected.DOSHAM,
      async () => (await fetchDoshamOptions(selected.STAR?.[0] ?? '', '', selected.MOTHERTONGUE?.[0])).doshamHash)
    if (!isAnySelection(selected.STATE)) {
      // Every selected state's districts in ONE call, so the row's label
      // resolves for all of them — this used to fetch the FIRST state only,
      // leaving raw codes for districts belonging to any other state.
      want('CITY', selected.CITY, async () => {
        const groups = await fetchCityGroups(
          (selected.STATE as string[]).filter(k => k && k !== '0').map(key => ({ key, label: key })),
        )
        return groups.flatMap(g => g.options)
      })
    }
    // HEIGHT is fetched UNCONDITIONALLY. Angular always resolves both bounds
    // against the height list (`START + ' - ' + END`) — height has no "Any"
    // state, and 1..31 is a real range, not a sentinel. Skipping the fetch
    // while the range was untouched left labelCache.HEIGHT empty, and
    // resolveFilterLabel's `?? k` fallback then rendered the raw CODES in the
    // row ("1 - 5"). The list is read out of the already-cached
    // REGISTRATIONARRAYS blob, so this costs no request.
    if (!labelCache.HEIGHT) {
      wanted.push(['HEIGHT', () => fetchExactHeightOptions(partnerHeightGender)])
    }
    // Star keys are unique across raasis, so the flat all-stars list resolves
    // any of them — fetchStarOptions() with no raasi reads it straight from the
    // cached blob. (This used to walk every raasi, which is now a call each.)
    want('STAR', selected.STAR, () => fetchStarOptions())

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
      // Angular: `START + ' - ' + END + ' ' + pageContent['YEARS']` — the unit
      // is a translated word ("years"), not an English-only "yrs" literal.
      AGE:            `${selected.STARTAGE ?? '18'} - ${selected.ENDAGE ?? '50'} ${t('SEARCH.YEARS')}`.trim(),
      // Angular: search.component.ts's updateLocationValue() — one composed
      // "Country - X , State - Y , District - Z" line, not just the narrowest
      // level that happens to be set. State/district parts appear only once
      // that level's own list exists (Angular gates them on
      // filterDataList.STATE/.CITY; labelCache is this port's equivalent, and
      // CITY is only fetched after a state is picked).
      LOCATION:       [
                        `${t('SEARCH.SELECT_COUNTRY_TXT')} - ${labelsFor('COUNTRY', selected.COUNTRY ?? [])}`,
                        `${t('SEARCH.SELECT_STATE_TXT')} - ${labelsFor('STATE', selected.STATE ?? [])}`,
                        ...((labelCache.CITY?.length ?? 0) > 0
                          ? [`${t('SEARCH.SELECT_CITY_TXT')} - ${labelsFor('CITY', selected.CITY ?? [])}`]
                          : []),
                      ].join(' , '),
      RELIGION:       labelsFor('RELIGION', selected.RELIGION ?? []),
      CASTE:          isChristian ? labelsFor('DIVISION', selected.DIVISION ?? []) : labelsFor('CASTE', selected.CASTE ?? []),
      STAR:           labelsFor('STAR', selected.STAR ?? []),
      // Dosham/Monthly income read their RADIO label while the stored value is
      // one of the radio keys, and the sub-list's labels once real values are
      // picked — Angular: `['0','1','3'].includes(key) ? searchValueList[field]
      // .value : searchValueList['START'+field].value` (search.component.ts).
      DOSHAM:         radioChoiceLabel('DOSHAM', doshamChoices)
                        ?? labelsFor('DOSHAM', selected.DOSHAM ?? []),
      OCCUPATION:     labelsFor('OCCUPATION', selected.OCCUPATION ?? []),
      MONTHLYINCOME:  radioChoiceLabel('MONTHLYINCOME', incomeChoices)
                        ?? labelsFor('MONTHLYINCOME', selected.STARTMONTHLYINCOME ?? []),
      EDUCATION:      labelsFor('EDUCATION', selected.EDUCATION ?? []),
      // Both bounds must actually RESOLVE to a label. resolveFilterLabel's
      // last resort is the raw code, which is never something to show a user
      // (this row read "1 - 5"); if either bound is missing from the list —
      // list not loaded yet, or a saved code outside it — fall back to the
      // field's own "Any" wording, the way an unset field renders.
      HEIGHT:         (heightBound(selected.STARTHEIGHT) && heightBound(selected.ENDHEIGHT))
                        ? `${heightBound(selected.STARTHEIGHT)} - ${heightBound(selected.ENDHEIGHT)}`
                        : anyLabelFor('HEIGHT'),
      MOTHERTONGUE:   labelsFor('MOTHERTONGUE', selected.MOTHERTONGUE ?? []),
      MARITALSTATUS:  labelsFor('MARITALSTATUS', selected.MARITALSTATUS ?? []),
      EATINGHABITS:   labelsFor('EATINGHABITS', selected.EATINGHABITS ?? []),
      PHYSICALSTATUS: labelsFor('PHYSICALSTATUS', selected.PHYSICALSTATUS ?? []),
      PROFILECREATED: labelsFor('PROFILECREATED', selected.PROFILECREATED ?? []),
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [selected, labelCache, isChristian, filterScreen, doshamChoices, incomeChoices])

  // Angular: search.component.ts's isFieldSetToAny() — whether a row still
  // holds NO real preference, read off the saved selection ('0'), which is
  // what gates the strict-filter toggle on both strict surfaces. Kept here
  // (not derived from the row's displayed text) because every unset field now
  // renders its own wording rather than one shared "Any" string.
  const isAnyField = useMemo(() => {
    const any: Record<string, boolean> = {}
    // Range fields always carry a concrete min-max, so they're never "Any".
    any.AGE    = false
    any.HEIGHT = false
    // Angular keys LOCATION off COUNTRY alone; this port fixes Country to
    // India and only lets State/District be narrowed (see this file's header),
    // so all three levels have to be unset for the field to count as "Any".
    any.LOCATION = isAnySelection(selected.COUNTRY)
      && isAnySelection(selected.STATE)
      && isAnySelection(selected.CITY)
    any.CASTE = isChristian ? isAnySelection(selected.DIVISION) : isAnySelection(selected.CASTE)
    // Same row, and the desktop layout's activeKey widens to 'DIVISION' for
    // Christian castes — keep both spellings resolvable.
    any.DIVISION = any.CASTE
    ;([
      'RELIGION', 'STAR', 'DOSHAM', 'OCCUPATION', 'MONTHLYINCOME', 'EDUCATION',
      'MOTHERTONGUE', 'MARITALSTATUS', 'EATINGHABITS', 'PHYSICALSTATUS', 'PROFILECREATED',
    ] as FieldKey[]).forEach(key => { any[key] = isAnySelection(selected[key]) })
    return any
  }, [selected, isChristian])

  // ── Field open handlers ──────────────────────────────────────────────────

  async function openSimpleMulti(key: FieldKey) {
    let opts: MultiSelectOption[] = []
    switch (key) {
      case 'RELIGION':       opts = await ensureOptions('RELIGION', fetchReligionOptions); break
      case 'DOSHAM':         opts = await ensureOptions('DOSHAM', async () => (await fetchDoshamOptions(selected.STAR?.[0] ?? '', '', selected.MOTHERTONGUE?.[0])).doshamHash); break
      case 'OCCUPATION':     opts = await ensureOptions('OCCUPATION', fetchOccupationOptions); break
      case 'MONTHLYINCOME':  opts = await ensureOptions('MONTHLYINCOME', fetchIncomeRangeOptions); break
      case 'EDUCATION':      opts = await ensureOptions('EDUCATION', fetchQualificationOptions); break
      case 'MOTHERTONGUE':   opts = await ensureOptions('MOTHERTONGUE', fetchMotherTongueOptions); break
      case 'MARITALSTATUS':  opts = await ensureOptions('MARITALSTATUS', () => fetchMaritalStatusOptions(gender)); break
      case 'EATINGHABITS':   opts = await ensureOptions('EATINGHABITS', fetchEatingHabitOptions); break
      case 'PHYSICALSTATUS': opts = await ensureOptions('PHYSICALSTATUS', fetchPhysicalStatusOptions); break
      case 'PROFILECREATED': opts = await ensureOptions('PROFILECREATED', fetchProfileCreatedOptions); break
      default: break
    }
    if (opts.length === 0) return
    setMultiEditor(key)
  }

  // One panel, one list. `key` only decides which stored field the panel
  // reads/writes (DIVISION for Christian alone, CASTE otherwise) and therefore
  // which title it shows — the OPTIONS are the same caste fetch either way,
  // because Angular's Division panel is literally filterDataList.CASTE.
  // religionKey, not a single religion: Angular sends the WHOLE selection
  // ('1~2' for Hindu+Christian), and the combined caste+division list that
  // comes back is what the one "Caste" panel is meant to show.
  async function openCaste() {
    const key  = isChristian ? 'DIVISION' : 'CASTE'
    const opts = await ensureOptions(key, () => fetchSearchCasteOptions(religionKey))
    if (opts.length === 0) return
    setMultiEditor(key as FieldKey)
  }

  async function openLocation() {
    await ensureOptions('STATE', fetchStates)
    setLocationStep('state')
  }

  // ── Location's three panels (Angular: LOCATION's COUNTRY/STATE/CITY LIST) ──
  async function openCountryList() {
    await ensureOptions('COUNTRY', fetchFilterCountries)
    setLocationStep('country')
  }

  // States of every selected country, grouped under it — and with Country on
  // "Any" that means EVERY country, which is what Angular does too
  // (getAnyKeyValues('COUNTRY', true, '0') collects all country keys before
  // asking for their states).
  async function openStateList() {
    const countries = await ensureOptions('COUNTRY', fetchFilterCountries)
    const chosen: string[] = (selected.COUNTRY ?? []).filter((k: string) => k && k !== '0')
    const parents = chosen.length > 0
      ? countries.filter(c => chosen.includes(c.key))
      : countries
    const groups = await fetchStateGroups(parents).catch(() => [] as OptionGroup[])
    setStateGroups(groups)
    // The flat pool behind the row's own label — every state on show.
    setLabelCache(prev => ({ ...prev, STATE: groups.flatMap(g => g.options) }))
    setLocationStep('state')
  }

  // Districts of every selected state, grouped under it.
  async function openCityList() {
    const chosen: string[] = (selected.STATE ?? []).filter((k: string) => k && k !== '0')
    if (chosen.length === 0) { openStateList(); return }
    const parents = (labelCache.STATE ?? []).filter(s => chosen.includes(s.key))
    const groups = await fetchCityGroups(
      parents.length > 0 ? parents : chosen.map(key => ({ key, label: key })),
    ).catch(() => [] as OptionGroup[])
    setCityGroups(groups)
    setLabelCache(prev => ({ ...prev, CITY: groups.flatMap(g => g.options) }))
    setLocationStep('city')
  }

  // Angular's Star panel is ONE list split under two read-only headings —
  // "Matching stars" (the member's own PISTARMATCHING) and "All other stars",
  // both named by FILTERSCREEN.STAR. There is no raasi step, and no per-raasi
  // grouping: see buildStarGroups.
  async function openStar() {
    // Still loaded for SearchDesktopLayout, which keeps its own Raasi -> Star
    // cascade and reads labelCache.RAASI for it.
    await ensureOptions('RAASI', fetchRaasiOptions)
    const allStars = await ensureOptions('STAR', () => fetchStarOptions())
    setStarGroups(buildStarGroups(
      allStars,
      matchingStars,
      String(filterScreen?.STAR?.['1'] ?? ''),
      String(filterScreen?.STAR?.['2'] ?? ''),
    ))
    setStarStep('star')
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
    const opts = await ensureOptions('HEIGHT', () => fetchExactHeightOptions(partnerHeightGender))
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

  // Every row opens its own field page. Angular's redirectToFilterPage() sends
  // all of them to `/search/filterpopup/<FIELD>` (only the range fields — AGE,
  // DOSHAM, MONTHLYINCOME, STAR, HEIGHT — take the `/search/filter/` route),
  // and filterRevampConfig has a full TITLE/SUBTITLE/LIST entry for
  // PROFILECREATED like any other field.
  //
  // PROFILECREATED used to jump straight to its picker, skipping the page, on
  // the grounds that it is Filter-mode-only and not a strict field. Being a
  // non-strict field only means the page shows no strict toggle — the editor
  // already decides that per field — not that it should have no page.
  function fieldRowPress(key: FieldKey) {
    setFieldEditorOpen(key)
  }

  // Angular: filterRevampConfig's per-field SUBTITLE — "Select preferred
  // monthly income", "Select preferred location", … Every field has its own
  // key; the constructed "Select preferred " + row label it replaces produced
  // wrong copy wherever the two differ (Income being the clearest case).
  // Falls back to that construction if a key is ever missing (i18n echoes the
  // key back when it can't resolve one).
  function fieldSubtitle(field: FieldKey): string {
    const key   = `FILTER.SUBTITLE_${field === 'CASTE' && isChristian ? 'DIVISION' : field}`
    const value = t(key as any)
    if (value && !value.includes('SUBTITLE_')) return value
    const label = rows.find(r => r.key === field)?.label ?? ''
    return `Select preferred ${label.toLowerCase()}`
  }

  // Angular: filterRevampConfig's LIST entry per field carries its own LABEL
  // and PLACEHOLDER, which are NOT the PP row's label — Monthly income's row
  // says "Income" while its sub-row says "Income range" and, until a range is
  // picked, reads "Select monthly income range".
  function subRowLabel(field: FieldKey): string {
    const value = t(`FILTER.LBL_${field}` as any)
    if (value && !value.includes('LBL_')) return value
    return rows.find(r => r.key === field)?.label ?? ''
  }

  function subRowPlaceholder(field: FieldKey): string {
    const value = t(`FILTER.PLACEHOLDER_${field}` as any)
    if (value && !value.includes('PLACEHOLDER_')) return value
    return anyLabelFor(field)
  }

  // Which stored key a picker reads/writes. Income is the one field where the
  // sub-list's selection does NOT live under the field's own key (see the
  // MONTHLYINCOME branch in the picker's onApply).
  function selectionFor(field: string): string[] {
    if (field === 'MONTHLYINCOME') return selected.STARTMONTHLYINCOME ?? ['0']
    return selected[field] ?? ['0']
  }

  // '2' is Angular's "pick specific values" option for both fields; any other
  // stored value that isn't one of the radio keys means the sub-list already
  // holds real selections, which is still the '2' state.
  // Which radio row is on. The two key spaces OVERLAP — a dosham type could be
  // keyed '1', the same as the "should not have dosham" radio — and the stored
  // field holds either kind, so the count breaks the tie: a radio answer is
  // always exactly one key, while a sub-list pick that isn't a radio key, or
  // more than one key, is the "pick specific values" state ('2').
  //
  // Still ambiguous for a SINGLE sub-list value keyed '0'/'1'/'2'; Angular has
  // the same overlap and leans on the two key spaces differing in practice.
  function radioValueFor(field: 'DOSHAM' | 'MONTHLYINCOME', choices: { key: string }[]): string {
    const stored: string[] = selected[field] ?? []
    if (stored.length === 1 && choices.some(c => c.key === stored[0])) return String(stored[0])
    return '2'
  }

  // True once the sub-list (dosham types / income brackets) holds a real pick,
  // as opposed to sitting on the bare '2' radio with nothing chosen yet.
  function hasSubListPick(field: 'DOSHAM' | 'MONTHLYINCOME'): boolean {
    const subList: string[] = selectionFor(field).filter(k => k && k !== '0' && k !== '2')
    return subList.length > 0
  }

  function onRadioChoice(field: 'DOSHAM' | 'MONTHLYINCOME', key: string) {
    updateField(field, [key])
    // Angular clearIncomeRangeSelection(): leaving "Select income range" must
    // drop the picked brackets, or they keep going out as STARTINCOME/ENDINCOME.
    if (field === 'MONTHLYINCOME' && key !== '2') {
      updateField('STARTMONTHLYINCOME', [...DEFAULT_FILTER.STARTMONTHLYINCOME])
      updateField('ENDMONTHLYINCOME', [...DEFAULT_FILTER.ENDMONTHLYINCOME])
    }
    if (key === '2') openFieldPicker(field)
  }

  // ── Reset / Apply ─────────────────────────────────────────────────────────

  // Angular: resetFilter(true) — search.component.ts:2100-ish.
  //
  //   if (!this.filterService.isAnyOneFieldEdited()) return;   // inert, not hidden
  //   ... filterService.resetFilter()  -> defaults + count + purge storage
  //   contentLoaded = false            -> disables the CTA while re-deriving
  //
  // Angular then chains nested setTimeout(…, 100) calls to force Angular to
  // re-run ngOnInit. That is a change-detection workaround, NOT behaviour:
  // resetting the state here re-renders everything that reads it, so there is
  // nothing to schedule. Idempotent by construction — a second tap hits the
  // guard above, because the state it would clear is already cleared.
  async function handleReset() {
    if (!anyFieldEdited) return
    setResetting(true)
    try {
      // resetFilter('pp') additionally clears the stored eventType flag itself,
      // which 'filter' deliberately doesn't touch; passing the actual current
      // mode matters now that this can fire from either. It purges the same
      // keys Angular's filterService.resetFilter() removes, SELECTEDFILTERS
      // (the edited map behind the count badge) included.
      await resetFilter(eventType)
      // Back to the PARTNER PREFERENCE, not to DEFAULT_FILTER. Angular gets
      // there indirectly: resetFilter() deletes FILTERDATALIST and
      // SELECTED_NEWPP, so the setDataValue() re-run that follows takes its
      // fetch-fresh branch and re-seeds every row from the getpreference
      // payload. Same destination, without the teardown-and-refetch — the
      // baseline is already in hand. Resetting to DEFAULT_FILTER instead wiped
      // the member's saved preference off the screen.
      setSelected({ ...ppBaseline })
      // Angular's reset drops SEARCHPPCHKBOX so the next read falls back to
      // CONFIG.searchPPCheckBox (14 zeros) — `[]` made FILTERPP go out empty
      // until the screen remounted.
      setPpCheckBox([...DEFAULT_PP_CHECKBOX])
      setLabelCache({})
      // editedRows recomputes off `selected`, so every dot clears and the
      // Filters-chip count lands on 0 with no separate bookkeeping. The Matches
      // screen re-reads both from storage on focus.
    } finally {
      setResetting(false)
    }
  }

  // `strictFilterApply` = the CTA inside Manage Strict Filters, which sends no
  // FILTERPP (turning a strict toggle isn't a field edit). SETPP is unaffected:
  // the strict filter lives inside Edit Preference, so it still goes out as
  // all '1' in PP mode.
  async function handleShowMatches(strictFilterApply = false) {
    // Dismiss the Manage Strict Filters panel BEFORE navigating. Angular's
    // manage-strict-filter view is a MODE of the PP page (search.component.html's
    // `manageStrictFilter` branch), so applying navigates the whole page away and
    // there is nothing to close. Here it's a Modal layered over this screen, and
    // a Modal outlives navigation — the member stayed looking at the same panel
    // while Matches loaded underneath it. Unconditional: it's already false for
    // the plain footer CTA, and this also stops a stale panel from being there
    // if the member comes back to this screen.
    setManageStrictOpen(false)

    await saveFilterState(selected, ppCheckBox, editedRows)
    const params = await buildSearchParams(matriId, 0, 20, { strictFilterApply })
    navigation.navigate('Matches', { searchParams: params })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Row order is Angular's own `CONFIG.searchList` (core/config/filter.config.ts)
  // read top to bottom: Age, Location, Religion, Caste/Division, Star, Dosham,
  // Occupation, Monthly income, Education, Height, Mother tongue, Marital
  // status, Eating habits, Physical status, Profile created. Religion sits
  // THIRD (right after Location, above Caste — the field it gates), not near
  // the end, and Eating habits comes before Physical status; this port had
  // both of those the other way round.
  const rows: Array<{ key: FieldKey; label: string; hidden?: boolean }> = [
    { key: 'AGE',            label: t('FILTER.AGE') },
    { key: 'LOCATION',       label: t('FILTER.LOCATION') },
    { key: 'RELIGION',       label: t('FILTER.RELIGION') },
    { key: 'CASTE',          label: isChristian ? t('FILTER.DIVISION') : t('FILTER.CASTE'), hidden: !showCasteRow },
    { key: 'STAR',           label: t('FILTER.STAR') },
    { key: 'DOSHAM',         label: t('FILTER.DOSHAM') },
    { key: 'OCCUPATION',     label: t('FILTER.OCCUPATION') },
    // Angular (JA-104): "Hide the monthly income field for male login users" —
    // `logInGender === 'M'`. LOGIN_GENDER stores 'M'/'F' (never '1'/'0'), so
    // the old `gender === '1'` test could never be true and the row showed for
    // male users too.
    { key: 'MONTHLYINCOME',  label: t('FILTER.MONTHLYINCOME'), hidden: memberGender === 'M' },
    { key: 'EDUCATION',      label: t('FILTER.EDUCATION') },
    { key: 'HEIGHT',         label: t('FILTER.HEIGHT') },
    { key: 'MOTHERTONGUE',   label: t('FILTER.MOTHERTONGUE') },
    { key: 'MARITALSTATUS',  label: t('FILTER.MARITALSTATUS') },
    { key: 'EATINGHABITS',   label: t('FILTER.EATINGHABITS') },
    { key: 'PHYSICALSTATUS', label: t('FILTER.PHYSICALSTATUS') },
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
        fieldIsAny={isAnyField}
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
        locationStep={locationStep === 'country' ? null : locationStep}
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
        isRowEdited={isRowEdited}
        onReset={handleReset}
        onShowMatches={() => handleShowMatches()}
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
        {/* Angular: search.component.html gates Reset on
            filterService.checkFilterEventType() — i.e. Filters mode ONLY.
            JODII-305 ("Reset button in PP needs to be removed (top right)")
            deliberately took it off Partner preferences; this port was showing
            it in both modes. */}
        {/* Angular: `*ngIf="filterService.checkFilterEventType()"` — Filters mode
            only (JODII-305 took it off Partner preferences). Angular leaves it
            looking enabled with nothing to undo and silently no-ops; here it is
            also rendered disabled, so the guard is visible rather than felt as
            a dead tap. */}
        {eventType === 'filter' && (
          <Pressable
            onPress={handleReset}
            hitSlop={8}
            disabled={!anyFieldEdited || resetting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !anyFieldEdited || resetting }}
          >
            <Text style={[s.resetText, !anyFieldEdited && s.resetTextDisabled]}>
              {t('FILTER.RESET_HEADER')}
            </Text>
          </Pressable>
        )}
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
            <Text style={s.strictBannerTitle}>{t(STRICT_FILTERS_TITLE)}</Text>
            <Text style={s.strictBannerDesc}>{t(STRICT_FILTERS_NOTE)}</Text>
            <Pressable style={s.manageStrictBtn} onPress={() => setManageStrictOpen(true)} accessibilityRole="button">
              <Text style={s.manageStrictBtnText}>{t(MANAGE_FILTER_CTA)}</Text>
            </Pressable>
          </View>
        )}

        {/* Angular: a plain ion-list on the white page — no card, no radius,
            no side margins. Every row (the last one included) carries its own
            bottom border, per `.filter-list-item`. */}
        <View style={s.list}>
          {rows.filter(r => !r.hidden).map(row => {
            const edited = isRowEdited(row.key)
            return (
              <Pressable
                key={row.key}
                style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                onPress={() => fieldRowPress(row.key)}
                accessibilityRole="button"
                // The dot is decorative — a screen reader gets the state as
                // words on the row instead, so it isn't announced as an
                // unlabelled image or missed entirely.
                accessibilityLabel={
                  `${row.label}, ${(rowValue as any)[row.key]}${edited ? `, ${t('FILTER.MODIFIED', 'modified')}` : ''}`
                }
              >
                <CdnSvg uri={FIELD_ICON[row.key]} width={24} height={24} style={s.rowIcon} />
                <View style={s.rowText}>
                  <View style={s.rowLabelLine}>
                    <Text style={s.rowLabel}>{row.label}</Text>
                    {/* Angular: `<span class="ml-8"><div class="red-dot"></div></span>` */}
                    {edited && <View style={s.editedDot} accessibilityElementsHidden importantForAccessibility="no" />}
                  </View>
                  <Text style={s.rowValue} numberOfLines={1}>
                    {(rowValue as any)[row.key]}
                  </Text>
                </View>
                <CdnSvg uri={ICON_ARROW} width={16} height={16} />
              </Pressable>
            )
          })}

          {/* Filter-mode-only, same as PROFILECREATED above — this port
              previously only had these two on the DESKTOP sidebar
              (MatchesFilterSidebar.tsx's own CheckboxGroup, tied to the quick-
              filter chip state); mobile's full Filters screen never showed
              them at all, even though they're part of the same persisted
              filterService selection (PHOTOAVAILABLE/HOROSCOPEAVAILABLE are
              already in DEFAULT_FILTER and saved/sent the same way every
              other field here is). */}
          {/* No separator of its own: every field row above already ends in
              Angular's own `.filter-list-item` bottom border. */}
          {eventType === 'filter' && (
            <>
              <CheckboxGroup
                inset
                options={[
                  {
                    key:     'PHOTOAVAILABLE',
                    value:   t('MATCHES.PP_ADDED_PHOTOS_CHECKBOX'),
                    checked: selected.PHOTOAVAILABLE === '1',
                    icon:    QUICK_FILTER_ICON.PHOTOAVAILABLE,
                  },
                  {
                    key:     'HOROSCOPEAVAILABLE',
                    value:   t('MATCHES.PP_HOROSCOPE_CHECKBOX'),
                    checked: selected.HOROSCOPEAVAILABLE === '1',
                    icon:    QUICK_FILTER_ICON.HOROSCOPEAVAILABLE,
                  },
                ]}
                onToggle={(key, checked) => updateField(key, checked ? '1' : '0')}
              />
            </>
          )}
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={s.applyBtn} onPress={() => handleShowMatches()} disabled={countLoading || resetting}>
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

      {/* ── LOCATION: three independent checkbox panels ──
           Angular's LOCATION LIST gives COUNTRY/STATE/CITY each their own
           SHOWCHECKBOXBTN panel (only Country has no search box). State was a
           SINGLE-select picker here, so "Andhra Pradesh, Telangana" couldn't
           be expressed at all. */}
      {countryMounted && <MultiSelectPicker
        visible={locationStep === 'country'}
        title={t('FILTER.SELECT_COUNTRY')}
        options={sortFilterOptions('COUNTRY', labelCache.COUNTRY ?? [], selected.COUNTRY)}
        selectedKeys={selected.COUNTRY ?? ['0']}
        anyLabel={anyLabelFor('COUNTRY')}
        onApply={keys => updateField('COUNTRY', keys)}
        onClose={() => setLocationStep(null)}
      />}
      {stateMounted && <MultiSelectPicker
        visible={locationStep === 'state'}
        title={t('FILTER.SELECT_STATE')}
        placeholder={t('FILTER.SEARCH_STATE')}
        options={sortFilterOptions('STATE', labelCache.STATE ?? [], selected.STATE)}
        groups={stateGroups}
        selectedKeys={selected.STATE ?? ['0']}
        anyLabel={anyLabelFor('STATE')}
        onApply={keys => {
          updateField('STATE', keys)
          // A different set of states invalidates the district choice, and its
          // list has to be refetched for the new states (Angular drops CITY the
          // same way when STATE changes).
          updateField('CITY', ['0'])
          setLabelCache(prev => { const n = { ...prev }; delete n.CITY; return n })
        }}
        onClose={() => setLocationStep(null)}
      />}
      {cityMounted && <MultiSelectPicker
        visible={locationStep === 'city'}
        title={t('FILTER.SELECT_CITY')}
        placeholder={t('FILTER.SEARCH_CITY')}
        options={sortFilterOptions('CITY', labelCache.CITY ?? [], selected.CITY)}
        groups={cityGroups}
        selectedKeys={selected.CITY ?? ['0']}
        anyLabel={anyLabelFor('CITY')}
        onApply={keys => updateField('CITY', keys)}
        onClose={() => setLocationStep(null)}
      />}

      {/* ── STAR: one panel, "Matching stars" / "All other stars" ──
           The raasi step this replaces was a React-only invention; Angular has
           no such screen. Tapping either heading selects that whole group —
           Angular's checkedListOption() sends STAR's '1' to
           selectSubOptionMatchinList and '2' to selectSubOptionList, each of
           which takes the group as a unit. The raasi picker below stays
           mounted for the desktop layout, which still cascades. */}
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
        options={sortFilterOptions('STAR', labelCache.STAR ?? [], selected.STAR)}
        groups={starGroups}
        selectedKeys={selected.STAR ?? ['0']}
        anyLabel={anyLabelFor('STAR')}
        onApply={keys => updateField('STAR', keys)}
        onClose={() => setStarStep(null)}
      />}

      {/* ── Generic multi-select fields (Religion, Caste/Division, Dosham, Occupation,
           Income, Education, Mother Tongue, Marital Status, Eating Habits, Physical Status) ── */}
      {multiEditor && (
        <MultiSelectPicker
          visible={!!multiEditor}
          title={t(`FILTER.SELECT_${multiEditor}` as any)}
          placeholder={multiEditor === 'RELIGION' ? t('FILTER.SEARCH_RELIGION')
            : multiEditor === 'CASTE' ? t('FILTER.SEARCH_CASTE')
            // Angular's DIVISION config entry carries its own SEARCHBARTXT
            // ('FILTER.SEARCH_DIVISION'), so the Christian panel says "Search
            // division" rather than dropping to no placeholder at all.
            // (cast: DIVISION isn't a member of FieldKey — openCaste widens it
            // the same way, matching SearchDesktopLayout's `FieldKey | 'DIVISION'`.)
            : (multiEditor as string) === 'DIVISION' ? t('FILTER.SEARCH_DIVISION')
            : multiEditor === 'MOTHERTONGUE' ? t('FILTER.SEARCH_MOTHERTONGUE')
            : undefined}
          options={sortFilterOptions(multiEditor, labelCache[multiEditor] ?? [], selectionFor(multiEditor))}
          selectedKeys={selectionFor(multiEditor) ?? ['0']}
          anyLabel={NO_ANY_ROW_PANELS.has(multiEditor) ? undefined : anyLabelFor(multiEditor)}
          onApply={keys => {
            if (multiEditor === 'MONTHLYINCOME') {
              // Angular stores picked income BRACKETS under STARTMONTHLYINCOME
              // and leaves MONTHLYINCOME on '2' (the "Select income range"
              // choice) — that pair is what incomeParams() reads. Writing the
              // brackets into MONTHLYINCOME made them look like the semantic
              // choice instead, so STARTINCOME went out as a bracket code.
              updateField('STARTMONTHLYINCOME', keys)
              updateField('ENDMONTHLYINCOME', keys)
              updateField('MONTHLYINCOME', ['2'])
              return
            }
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
        fieldIsAny={isAnyField}
        matchCount={matchCount}
        countLoading={countLoading}
        onShowMatches={() => handleShowMatches(true)}
      />

      {/* ── Per-field editor page ──
          Sits AROUND the field's own existing picker (opened unchanged via
          openFieldPicker) rather than replacing it — the picker's own Modal
          stacks on top of this one when a CompactFieldRow below is tapped.
          `strictAllowed` mirrors Angular's redirectToFilterPage(), which
          navigates this page with `manageStrictFilter || filterEventType !=
          'filter'`: the strict block belongs to Edit Preference, and to
          Filters mode only when opened from Manage Strict Filters. */}
      {fieldEditorOpen && (
        <StrictFieldEditorScreen
          visible={!!fieldEditorOpen}
          onClose={() => setFieldEditorOpen(null)}
          fieldKey={fieldEditorOpen}
          fieldLabel={rows.find(r => r.key === fieldEditorOpen)?.label ?? ''}
          subtitle={fieldSubtitle(fieldEditorOpen)}
          fieldValue={(rowValue as any)[fieldEditorOpen]}
          strictEnabled={!!strictPrefs[fieldEditorOpen]}
          onToggleStrict={value => toggleStrictPref(fieldEditorOpen, value)}
          isAny={!!isAnyField[fieldEditorOpen]}
          strictAllowed={eventType !== 'filter' || manageStrictOpen}
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
                value={heightBound(selected.STARTHEIGHT) ?? anyLabelFor('HEIGHT')}
                onPress={() => openHeight('min')}
              />
              <CompactFieldRow
                label={t('FILTER.LBL_MAX_HEIGHT')}
                value={heightBound(selected.ENDHEIGHT) ?? anyLabelFor('HEIGHT')}
                onPress={() => openHeight('max')}
              />
            </>
          )}
          {/* Location: Country / State / City, one row each — Angular's
              LOCATION field page (filterRevampConfig.LOCATION's three-entry
              LIST). This port only had State→City, with no Country row. */}
          {fieldEditorOpen === 'LOCATION' && (
            <>
              <CompactFieldRow
                label={t('SEARCH.SELECT_COUNTRY_TXT')}
                value={labelsFor('COUNTRY', selected.COUNTRY ?? [])}
                onPress={openCountryList}
              />
              <CompactFieldRow
                label={t('SEARCH.SELECT_STATE_TXT')}
                value={labelsFor('STATE', selected.STATE ?? [])}
                onPress={openStateList}
              />
              <CompactFieldRow
                label={t('SEARCH.SELECT_CITY_TXT')}
                value={labelsFor('CITY', selected.CITY ?? [])}
                onPress={openCityList}
              />
            </>
          )}

          {/* Dosham / Monthly income: radio group first, sub-list row gated on '2' */}
          {(fieldEditorOpen === 'DOSHAM' || fieldEditorOpen === 'MONTHLYINCOME') && (() => {
            const choices = fieldEditorOpen === 'DOSHAM' ? doshamChoices : incomeChoices
            const value   = radioValueFor(fieldEditorOpen, choices)
            return (
              <>
                <RadioGroup
                  options={choices.map(c => ({ key: c.key, value: c.label }))}
                  value={value}
                  onChange={key => onRadioChoice(fieldEditorOpen, key)}
                  layout="pill"
                />
                {/* Angular: the sub-row carries the field's own LIST LABEL
                    (`FILTER.LBL_MONTHLYINCOME` = "Income range", not the row's
                    "Income"), and its PLACEHOLDER until a value is actually
                    picked — this showed the current range instead. */}
                <CompactFieldRow
                  label={subRowLabel(fieldEditorOpen)}
                  value={hasSubListPick(fieldEditorOpen)
                    ? (rowValue as any)[fieldEditorOpen]
                    : subRowPlaceholder(fieldEditorOpen)}
                  onPress={() => openFieldPicker(fieldEditorOpen)}
                  disabled={value !== '2'}
                />
              </>
            )
          })()}

          {/* Every other field is a single row opening its own list. */}
          {!(['AGE', 'HEIGHT', 'LOCATION', 'DOSHAM', 'MONTHLYINCOME'] as FieldKey[])
            .includes(fieldEditorOpen) && (
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
  // Angular renders this page on a plain white ion-content — the tinted page
  // + floating rounded cards this port used are not in the reference.
  screen: { flex: 1, backgroundColor: Colors.white },
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
  resetTextDisabled: { opacity: 0.4 },

  // Angular: the strict-filter block sits flush under the header (full-bleed,
  // its own 24px inner padding) and the list follows with `mt-8` — there is no
  // page-level padding or inter-section gap to add here.
  scrollContent: { paddingBottom: 16 },
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

  // Angular `.strict-filter-card` (+ its `pr-24 pl-24 pt-16 pb-16`): a
  // full-bleed tinted band, NOT an inset rounded card — no radius and no side
  // margins, so it meets both screen edges exactly as in the reference.
  strictBanner: {
    backgroundColor: '#FBF2F5', borderWidth: 1, borderColor: '#FFE3EC',
    paddingHorizontal: 24, paddingVertical: 16, gap: 6,
  },
  strictBannerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, lineHeight: 20, color: Colors.black },
  // Angular: `.strict-filter-desc` + `mb-16` — 16px below the copy before the
  // CTA (6 of it from the container's own gap).
  strictBannerDesc:  { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, lineHeight: 18, color: Colors.black, marginBottom: 10 },
  // Angular FILTER_BTN: button-revamp `large` — 40px tall, 8px radius,
  // transparent fill, 1px primary border, primary text at body-14.
  manageStrictBtn: {
    height: 40, borderWidth: 1, borderColor: Colors.primaryDark, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  manageStrictBtnText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 16, color: Colors.primaryDark },

  // Angular: `<ion-list class="pl-24 pr-24">` in an `mt-8` row — a flat list
  // straight on the page.
  list: { marginTop: 8 },

  // Angular `.filter-list-item`: 20px top/bottom padding, top-aligned content,
  // and a bottom border on EVERY row (the last one included).
  //
  // The 24px page inset is a MARGIN, not padding: Angular puts it on the
  // enclosing `<ion-list class="pl-24 pr-24">` and gives the item itself
  // `--padding-start: 0; --inner-padding-end: 0`, so the item box — and with it
  // the bottom border — starts 24px in from each edge. As padding it sat INSIDE
  // the bordered box instead, which drew every divider edge to edge.
  row: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    marginHorizontal:  24,
    paddingVertical:   20,
    gap:               8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(204,204,204,0.5)',
  },
  rowPressed: { opacity: 0.6 },
  rowIcon:  { flexShrink: 0 },
  // Angular's value line carries `mt-6`, and it applies in EVERY state. The
  // template also puts `ion-no-margin` on it when the row has no edited dot,
  // which looks like it should collapse the gap — it doesn't: both rules are
  // `!important` at equal specificity, and `.mt-6` (global.scss:1066) is
  // declared after Ionic's `.ion-no-margin` (padding.css, imported line 20), so
  // the later one wins. Making the gap conditional here left every unedited row
  // with its label and value touching.
  rowText:  { flex: 1, gap: 10 },
  rowLabelLine: { flexDirection: 'row', alignItems: 'center' },
  // Angular search.component.scss:190 — `.red-dot { width/height 8; background
  // #DE2A68; border-radius 50% }`, with the `ml-8` from its wrapping span.
  editedDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: Colors.editedDot,
    marginLeft:      8,
  },
  // Angular: label `body2-regular-14`, value `body1-medium-14` — both black.
  rowLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 16, color: Colors.black },
  rowValue: { fontFamily: Fonts.poppinsMedium, fontSize: 14, lineHeight: 16, color: Colors.black },

  // Angular: `ion-footer.footer-shadow` with the CTA at `ml-24 mr-24 pt-16 pb-16`.
  footer: {
    paddingHorizontal: 24,
    paddingTop:        16,
    backgroundColor:   Colors.white,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: -4 },
    shadowOpacity:     0.08,
    shadowRadius:      8,
    elevation:         8,
  },
  // Angular PRIMARY_BTN: button-revamp `standard` — 44px tall, 8px radius.
  applyBtn: {
    height:           44,
    borderRadius:     8,
    backgroundColor:  Colors.primaryDark,
    alignItems:       'center',
    justifyContent:   'center',
  },
  // Angular button-revamp's default ctaFontSize is `body2-regular-14` +
  // `line-height-16`, and the PP/Filters footer CTA doesn't override it — so
  // the button label is Poppins-REGULAR 14, not medium or semibold.
  applyText: { color: Colors.white, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 16 },
})
