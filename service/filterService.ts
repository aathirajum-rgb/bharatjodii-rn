import { getItem, setItem, getJson, setJson, removeItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { STRICT_FIELD_ORDER, STRICT_FIELD_KEY_MAP } from '../constants/strictFilter.config'
import { CDN_SVG } from '../constants/cdn'
import type { FieldKey } from '../screens/search/SearchScreen'

// ─── Filter defaults ──────────────────────────────────────────────────────────

export const DEFAULT_FILTER: Record<string, any> = {
  STARTAGE: '18', ENDAGE: '50',
  // Angular filter.config.ts's `selectedObject`: STARTHEIGHT ['1'],
  // ENDHEIGHT ['31'] — the first and LAST entry of the NEWHEIGHT list, i.e.
  // the full unrestricted range. ['5'] capped the default preference at the
  // 5th shortest height, which both narrowed every new user's search and made
  // the PP row read as a tiny range.
  STARTHEIGHT: ['1'], ENDHEIGHT: ['31'],
  EDUCATION: ['0'], OCCUPATION: ['0'],
  MARITALSTATUS: ['0'], STAR: ['0'],
  DOSHAM: ['0'], MONTHLYINCOME: ['0'],
  RELIGION: ['0'], CASTE: ['0'],
  SUBCASTE: ['0'], GOTHRA: ['0'],
  STATE: ['0'], CITY: ['0'],
  COUNTRY: ['0'], MOTHERTONGUE: ['0'],
  DIVISION: ['0'], PHYSICALSTATUS: ['0'],
  EATINGHABITS: ['0'],
  // Angular filter.config.ts's selectedObject: both '0'. ['3']/['13'] made an
  // untouched income field look like a picked bracket range — the sub-row read
  // "₹20,000 – ₹30,000" instead of its "Select monthly income range"
  // placeholder, and incomeParams saw a range where there was none.
  STARTMONTHLYINCOME: ['0'], ENDMONTHLYINCOME: ['0'],
  PROFILECREATED: ['0'], PHOTOAVAILABLE: '0', HOROSCOPEAVAILABLE: '0',
  PISTARMATCHING: '',
}

// 14 flags, in the order
// AGE|HEIGHT|MARITALSTATUS|RELIGION|STAR|DOSHAM|EDUCATION|OCCUPATION|INCOME|
// LOCATION|MOTHERTONGUE|CASTE|PHYSICALSTATUS|EATINGHABITS.
//
// Angular's CONFIG.searchPPCheckBox (filter.config.ts) is all '0' — this was
// all '1', which is what made both FILTERPP and SETPP go out as 1|1|1|…
// This array is the FILTERPP baseline ("which fields the user edited", JA-41);
// Angular flips individual positions to '1' as fields are edited, so the
// starting state is nothing-edited.
export const DEFAULT_PP_CHECKBOX = Array(14).fill('0')

// SETPP is NOT the FILTERPP array — Angular builds it fresh per call
// (filter.service.ts getUrlParams):
//   _searchPPCheckBox = checkFilterEventType()          // Filters mode?
//     ? [...CONFIG.searchPPCheckBox]                    // → all '0'
//     : ['1' × 14]                                      // Partner-Prefs mode
// and the COUNT call hardcodes all '0' regardless of mode.
const SETPP_OFF = Array(14).fill('0')
const SETPP_ON  = Array(14).fill('1')

// ─── Storage keys ─────────────────────────────────────────────────────────────
const K = {
  SELECTED: 'SELECTED_NEWPP',
  PPCHECK:  'SEARCHPPCHKBOX',
  FILTERS:  'SELECTEDFILTERS',
  EVTYPE:   'FILTEREVENTTYPE',
  PARAMS:   'SEARCH_PARAMS',
  STRICT:   'STRICT_FILTER_STATE',
  // The count of the CURRENT result set, temporary filter included.
  TOTAL:    'MATCHESTOTALCOUNT',
  // The count for the member's saved Partner Preference — see setMatchTotals().
  PP_TOTAL: 'MATCHESPPTOTALCOUNT',
}

// The state before anything is stored: every field strict-OFF.
//
// Angular's common-funtions.ts getStrictFilterState() returns `{}` when
// STRICT_FILTER_STATE is absent, and its serializer tests `state[key] === true`
// — so an unknown field is '0'. This was all `true`, which meant a missing or
// PARTIAL stored state silently sent 1s for those positions instead of echoing
// what getpreference gave us.
const DEFAULT_STRICT_STATE: Record<FieldKey, boolean> = Object.fromEntries(
  STRICT_FIELD_ORDER.map(key => [key, false]),
) as Record<FieldKey, boolean>

// ─── State accessors ──────────────────────────────────────────────────────────

export async function getSelectedObject(): Promise<Record<string, any>> {
  return (await getJson<Record<string, any>>(K.SELECTED)) ?? { ...DEFAULT_FILTER }
}

// Whether a filter session has actually been stored, as opposed to
// getSelectedObject() having handed back the DEFAULT_FILTER fallback. Angular
// asks the same question with `if (!localStorage.getItem('SEARCHVALUES'))`
// before seeding the screen from the member's partner preference.
export async function hasStoredFilterSelection(): Promise<boolean> {
  return (await getJson<Record<string, any>>(K.SELECTED)) != null
}

// ─── Partner preference → filter selection ────────────────────────────────────
// Angular: search.component.ts's setsearchValueList(PPSetData) plus the three
// helpers it delegates to (setCountryValue / setIncomeValues / setCasteValue).
// The getpreference payload IS the baseline the filter screen starts from: each
// row shows the member's saved preference until they change it in Filters mode,
// which is what makes a red dot mean "different from your saved preference"
// and what Reset puts back.
//
// Only the mapping is ported. Angular interleaves callAPIPoppulateData() calls
// for STATE/RELIGION/CASTE/… into the same loop; here those lists are fetched
// by the screen's own effects off the resulting selection, so this stays a pure
// function.

// Angular's common.isValidparam() — absent, empty, or the strings browsers
// leave behind when an undefined value is stringified.
function isValidPPValue(value: any): boolean {
  if (value === null || value === undefined) return false
  const s = String(value).trim()
  return s !== '' && s !== 'null' && s !== 'undefined'
}

// PP values arrive as '~'-joined strings; the selection stores arrays for most
// fields but plain scalars for a few (ages, the two availability flags,
// PISTARMATCHING). Match whatever shape DEFAULT_FILTER declares for the key, or
// buildSearchParams' `.join('~')` / raw reads see the wrong type.
function toSelectionShape(value: any, defaultValue: any): any {
  const parts = String(value).split('~').filter(p => p !== '')
  if (Array.isArray(defaultValue)) return parts.length > 0 ? parts : [String(value)]
  return String(value)
}

export function ppSelectionFromPPSet(ppSet: Record<string, any> | null | undefined): Record<string, any> {
  const obj: Record<string, any> = { ...DEFAULT_FILTER }
  if (!ppSet) return obj

  // Angular's setCasteValue(): the caste cascade collapses top-down, so a
  // preference with no religion cannot carry a caste, and so on. Done on a COPY
  // — Angular mutates the payload in place, which this deliberately doesn't.
  const pp: Record<string, any> = { ...ppSet }
  if (!isValidPPValue(pp.RELIGION) || String(pp.RELIGION) === '0') pp.CASTE    = '0'
  if (!isValidPPValue(pp.CASTE)    || String(pp.CASTE)    === '0') pp.SUBCASTE = '0'
  if (!isValidPPValue(pp.SUBCASTE) || String(pp.SUBCASTE) === '0') pp.GOTHRA   = '0'
  // search.component.ts:387 — Christian preferences store their division under
  // CASTE, and the DIVISION row reads it from there.
  if (String(pp.RELIGION) === '2' && !isValidPPValue(pp.DIVISION)) pp.DIVISION = pp.CASTE

  for (const key of Object.keys(DEFAULT_FILTER)) {
    // Handled below — Angular skips these in the same loop, via singleChkValues
    // for the location trio and setIncomeValues() for the income triple.
    if (['MONTHLYINCOME', 'STARTMONTHLYINCOME', 'ENDMONTHLYINCOME'].includes(key)) continue
    if (isValidPPValue(pp[key])) obj[key] = toSelectionShape(pp[key], DEFAULT_FILTER[key])
  }

  // Angular's setIncomeValues(): MONTHLYINCOME is the semantic CHOICE and comes
  // from STARTINCOME, not from a field of its own; a payload with no choice but
  // a real bracket pair means "pick specific values" ('2').
  obj.MONTHLYINCOME      = isValidPPValue(pp.STARTINCOME) ? [String(pp.STARTINCOME)] : ['0']
  obj.STARTMONTHLYINCOME = isValidPPValue(pp.STARTMONTHLYINCOME)
    ? toSelectionShape(pp.STARTMONTHLYINCOME, DEFAULT_FILTER.STARTMONTHLYINCOME) : ['0']
  obj.ENDMONTHLYINCOME   = isValidPPValue(pp.ENDMONTHLYINCOME)
    ? toSelectionShape(pp.ENDMONTHLYINCOME, DEFAULT_FILTER.ENDMONTHLYINCOME) : ['0']
  if (!isValidPPValue(pp.STARTINCOME)
    && obj.STARTMONTHLYINCOME[0] !== '0' && obj.ENDMONTHLYINCOME[0] !== '0') {
    obj.MONTHLYINCOME = ['2']
  }

  return obj
}

export async function getSearchPPCheckBox(): Promise<string[]> {
  return (await getJson<string[]>(K.PPCHECK)) ?? [...DEFAULT_PP_CHECKBOX]
}

// 'filter' = lighter/temporary quick-filter mode (Matches screen's "FILTER" chip);
// anything else = PP (Partner Preference) mode, the default when opened from Menu.
export async function getFilterEventType(): Promise<'filter' | 'pp'> {
  return (await getItem(K.EVTYPE)) === 'filter' ? 'filter' : 'pp'
}

export async function setFilterEventType(eventType: 'filter' | 'pp'): Promise<void> {
  if (eventType === 'filter') await setItem(K.EVTYPE, 'filter')
  else await removeItem(K.EVTYPE)
}

export async function getStrictFilterState(): Promise<Record<FieldKey, boolean>> {
  const stored = await getJson<Record<string, boolean>>(K.STRICT)
  return { ...DEFAULT_STRICT_STATE, ...stored } as Record<FieldKey, boolean>
}

export async function setStrictFilterState(state: Record<FieldKey, boolean>): Promise<void> {
  await setJson(K.STRICT, state)
}

// Angular: common-funtions.ts's setStrictFilterStateFromPP() — seeds the strict
// toggles from the STRICKPP the getpreference API answers with. That value is a
// 14-position pipe string in STRICT_FIELD_ORDER
// (AGE|HEIGHT|MARITALSTATUS|RELIGION|STAR|DOSHAM|EDUCATION|OCCUPATION|INCOME|
//  LOCATION|MOTHERTONGUE|CASTE|PHYSICALSTATUS|EATINGHABITS), '1' = strict on.
// It may also arrive as an array; an empty/absent value means "nothing to
// apply" and is left alone rather than wiping the member's toggles.
//
// onlyWhenMissing mirrors Angular's second argument: the PP data can come back
// from a local cache, so seeding from it must NOT clobber toggles the member
// has changed but not yet applied. Pass true on any cached read, false only
// where Angular overwrites (profile.service.ts's live getmemberPreference).
export async function setStrictFilterStateFromPP(
  strickPP: string | string[] | null | undefined,
  onlyWhenMissing = false,
): Promise<void> {
  const ppValue = Array.isArray(strickPP) ? strickPP.join('|') : (strickPP ?? '')
  if (String(ppValue).trim() === '') return

  if (onlyWhenMissing && (await getJson<Record<string, boolean>>(K.STRICT))) return

  const ppStates = String(ppValue).split('|')
  const state = await getStrictFilterState()

  STRICT_FIELD_ORDER.forEach((key, index) => {
    state[key] = (ppStates[index] ?? '').trim() === '1'
  })

  await setStrictFilterState(state)
}

// ─── FILTERPP ─────────────────────────────────────────────────────────────────
// FILTERPP carries "which fields did the user actually edit" — 1 per edited
// position, 0 everywhere else — in the same order as SETPP/STRICKPP:
// AGE|HEIGHT|MARITALSTATUS|RELIGION|STAR|DOSHAM|EDUCATION|OCCUPATION|INCOME|
// LOCATION|MOTHERTONGUE|CASTE|PHYSICALSTATUS|EATINGHABITS.
//
// Angular: filter.config.ts's `ppCheckBoxIndex`. Its first 14 entries are
// STRICT_FIELD_ORDER's order exactly, so that array is reused as the position
// lookup instead of duplicating the map; the last three positions exist only
// in Filters mode, where Angular extends the array to 17.
const FILTERPP_EXTRA_INDEX: Record<string, number> = {
  PROFILECREATED: 14, PHOTOAVAILABLE: 15, HOROSCOPEAVAILABLE: 16,
}

// A stored selection key (STARTAGE, CITY, DIVISION, …) -> its FILTERPP
// position, or -1 for keys that hold no position (e.g. PISTARMATCHING).
// Sub-fields share their parent's slot: COUNTRY/STATE/CITY all report
// LOCATION's, CASTE/SUBCASTE/GOTHRA/DIVISION all report CASTE's.
// Which ROW a stored selection key belongs to. Sub-fields collapse into their
// parent row the same way they share a FILTERPP slot: COUNTRY/STATE/CITY all
// report LOCATION, CASTE/SUBCASTE/GOTHRA/DIVISION all report CASTE, and
// STARTAGE/ENDAGE both report AGE.
export function filterRowKey(selectionKey: string): string | null {
  if (FILTERPP_EXTRA_INDEX[selectionKey] !== undefined) return selectionKey
  const base = selectionKey.replace(/^(START|END)/, '')
  return STRICT_FIELD_KEY_MAP[base] ?? null
}

function filterPPIndex(selectionKey: string): number {
  const extra = FILTERPP_EXTRA_INDEX[selectionKey]
  if (extra !== undefined) return extra
  const field = filterRowKey(selectionKey)
  return field ? STRICT_FIELD_ORDER.indexOf(field as FieldKey) : -1
}


// The red "edited" dot on a filter row, and the count badge on the Filters
// chip, both come from ONE flag per row: Angular's
// `searchValueList[field].isAnyChanges`, mirrored into
// filterService.selectedFilters and persisted as SELECTEDFILTERS — the map
// getSelectedFilters()/getFilterEditedCount() below read.
//
// It is written at each edit site, against the field the member is editing
// (filter.component.ts:754/774/789/1449 all key off `filterType`/`pageName`),
// and SearchScreen.updateField() is this port's single equivalent funnel.
//
// It deliberately is NOT computed by diffing the selection against the saved
// preference. A field the member never touched can still change value —
// picking a religion resets Caste and Division — and a diff cannot tell that
// apart from an edit, so one religion change lit up two rows.

// Angular: filter.service.ts's isAnyOneFieldEdited() — the guard Reset uses to
// decide whether there is anything to undo.
export function isAnyFieldEdited(edited: Record<string, boolean>): boolean {
  return Object.values(edited).some(Boolean)
}

// Marks the edited field — and ONLY that field. Editing age sends
// 1|0|0|0|0|0|0|0|0|0|0|0|0|0; every position the member didn't touch stays 0.
//
// Angular: filter-popup.component.ts:1377 / filter.component.ts:1043 ("When
// the filter field updated, the SETPP value should be set as 1 on required
// field location"). Two Angular behaviours are deliberately NOT ported:
//   - it writes '1' only in Partner-Preferences mode and '0' in Filters mode
//     (`checkFilterEventType() ? '0' : '1'`); here an edit counts in both;
//   - editing RELIGION also set CASTE's position ("for getting more matches"),
//     which would report a field the member never edited.
export function markFilterPPEdited(ppCheckBox: string[], selectionKey: string): string[] {
  const index = filterPPIndex(selectionKey)
  if (index < 0) return ppCheckBox

  const next = [...ppCheckBox]
  while (next.length <= index) next.push('0')
  next[index] = '1'
  return next
}

// ─── Quick-filter chips (Matches header) ──────────────────────────────────────
// Angular: search.component.html's chip swiper, fed by filter.config.ts's
// `quickFilterList` and toggled by search.component.ts's clickOnFilterChip().
//
// The chips are NOT a radio group — each one carries its own `isSelected` and
// toggles independently, so "Recently joined" + "with photos" can both be on.
// A tap is a real filter edit, not view state: it writes the field into the
// persisted selection, flips the app into Filters mode, records the field in
// SELECTEDFILTERS (which is what the Filters chip's count badge reads) and then
// re-runs the search. That is why this lives here rather than in the screen —
// the Matches header and Edit Preferences are editing one and the same object.

// The three fields the server may send chips for, in Angular's own
// filter.config.ts `quickFilterList` order (the FILTER chip is not one of them —
// it navigates rather than toggling a field).
export const QUICK_FILTER_FIELDS = ['PROFILECREATED', 'PHOTOAVAILABLE', 'HOROSCOPEAVAILABLE'] as const

// Leading icons for the two quick-filter CHECKBOX rows — the Filters screen's
// own list (mobile, Filters mode) and the desktop filter sidebar, which render
// the same two options and so must not each carry their own copy of the URLs.
// Not used by the chip row: a chip's icon is the filter/close glyph Chip.tsx
// owns, never the field's own (see FilterChipsRow.tsx).
export const QUICK_FILTER_ICON: Record<string, string> = {
  PHOTOAVAILABLE:     `${CDN_SVG}menu/filter-with-photos.svg`,
  HOROSCOPEAVAILABLE: `${CDN_SVG}viewprofile/horoscope-icon.svg`,
}

// One chip's server-driven definition. Angular hydrates each hdrSearchList entry
// from REGISTRATIONARRAYS.QUICKFILTER in matches.page.ts's updateQuickFilterList();
// registrationService.fetchQuickFilterChips() is that step, and hands the codes
// back here so this file stays free of any dependency on it.
export interface QuickFilterChip {
  key:      string   // fieldType — PROFILECREATED | PHOTOAVAILABLE | HOROSCOPEAVAILABLE
  label:    string   // already localized by the server (initialfetch is sent with LANG)
  onValue:  string   // written into the selection when the chip is switched ON
  offValue: string   // …and when it is switched OFF
}

function isQuickFilterOn(obj: Record<string, any>, chip: QuickFilterChip): boolean {
  const raw = obj[chip.key]
  return String(Array.isArray(raw) ? raw[0] : raw ?? '') === chip.onValue
}

export async function getSelectedFilters(): Promise<Record<string, boolean>> {
  return (await getJson<Record<string, boolean>>(K.FILTERS)) ?? {}
}

// Angular: filter.service.ts getFilterEditedCount() — how many fields the member
// has actually set, shown as the badge on the Filters chip. Zero outside Filters
// mode (`if (!checkFilterEventType()) { updateFilterEditCount = 0 }`), because
// the badge counts a temporary filter session, not the saved preference.
export async function getFilterEditedCount(): Promise<number> {
  if ((await getFilterEventType()) !== 'filter') return 0
  const filters = await getSelectedFilters()
  return Object.keys(filters).filter(key => filters[key] === true).length
}

// Which chips are currently on, read back from the persisted selection so the
// header renders correctly after a remount or a Reset elsewhere. Angular does
// the same re-derivation at the top of updateQuickFilterList().
export async function getActiveQuickFilters(chips: QuickFilterChip[]): Promise<string[]> {
  const obj = await getSelectedObject()
  return chips.filter(chip => isQuickFilterOn(obj, chip)).map(chip => chip.key)
}

// Angular: clickOnFilterChip() — toggle the one chip, persist, and let the
// caller re-query. Returns the full set of chips left on.
export async function toggleQuickFilter(
  field: string, chips: QuickFilterChip[],
): Promise<string[]> {
  const chip = chips.find(c => c.key === field)
  if (!chip) return getActiveQuickFilters(chips)

  const obj    = await getSelectedObject()
  const turnOn = !isQuickFilterOn(obj, chip)
  const value  = turnOn ? chip.onValue : chip.offValue
  // PROFILECREATED is stored as an ARRAY and sent joined with '~'; the other two
  // are plain scalars — see baseParams()/buildSearchParams() and DEFAULT_FILTER.
  // Angular writes `[keyValue]` for all three, but reads the latter two straight
  // into the URL, where a one-element array stringifies to the same '1'/'0'.
  const next   = { ...obj, [field]: field === 'PROFILECREATED' ? [value] : value }

  // Angular sets FILTEREVENTTYPE='filter' on every chip tap: a quick filter is
  // a temporary filter, never an edit to the saved partner preference.
  await setFilterEventType('filter')

  const filters = await getSelectedFilters()
  await Promise.all([
    setJson(K.SELECTED, next),
    setJson(K.FILTERS, { ...filters, [field]: turnOn }),
  ])

  return chips.filter(c => isQuickFilterOn(next, c)).map(c => c.key)
}

export async function saveFilterState(
  obj: Record<string, any>,
  ppCheckBox: string[],
  selectedFilters: Record<string, boolean>,
): Promise<void> {
  await Promise.all([
    setJson(K.SELECTED, obj),
    setJson(K.PPCHECK,  ppCheckBox),
    setJson(K.FILTERS,  selectedFilters),
  ])
}

// ─── Matches counts ───────────────────────────────────────────────────────────
// Angular keeps TWO counts, and the difference is the whole point of the
// "#COUNT# profiles based on your preferences." line (matches.page.ts:2900's
// getPPContent()):
//
//   MATCHESTOTALCOUNT    always written — the CURRENT result set, so it moves
//                        with a temporary quick filter.
//   MATCHESPPTOTALCOUNT  written only when NOT in filter mode
//                        (`if (!this.filterService.checkFilterEventType())`,
//                        matches.page.ts:1281) — the member's saved Partner
//                        Preference count.
//
// The sentence says "based on your preferences", so it has to keep showing the
// PP count while a temporary filter narrows the list. Hence the PP key is read
// first and the applied count is only a fallback for the very first load,
// before any PP count has been cached.
//
// Angular re-reads localStorage on every change-detection pass, which is why it
// needs no subscription. Here the caller holds the resolved number in state and
// these helpers return it, so one call both persists and yields what to render.

const parseCount = (raw: string | null): number | null => {
  if (raw == null || raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

// Angular's three-level fallback: PP count -> applied count -> in-memory.
export async function getPreferenceMatchCount(fallback = 0): Promise<number> {
  const [pp, total] = await Promise.all([getItem(K.PP_TOTAL), getItem(K.TOTAL)])
  return parseCount(pp) ?? parseCount(total) ?? fallback
}

// Angular: matches.page.ts:1281-1285 — the listing API returned a new TOTAL.
// Returns the number the preferences line should now show.
export async function setMatchTotals(total: number): Promise<number> {
  const isFilter = (await getFilterEventType()) === 'filter'
  await setItem(K.TOTAL, String(total))
  if (!isFilter) {
    await setItem(K.PP_TOTAL, String(total))
    return total
  }
  return getPreferenceMatchCount(total)
}

// Angular: matches.page.ts:1543-1547 / 1576-1580 — a profile left the list
// (interest sent, ignored, skipped), so both counts drop by one under the same
// filter-mode guard.
export async function decrementMatchTotals(): Promise<number> {
  const isFilter = (await getFilterEventType()) === 'filter'
  const [ppRaw, totalRaw] = await Promise.all([getItem(K.PP_TOTAL), getItem(K.TOTAL)])

  const total = parseCount(totalRaw)
  if (total != null) await setItem(K.TOTAL, String(Math.max(0, total - 1)))

  const pp = parseCount(ppRaw)
  if (!isFilter && pp != null) {
    const next = Math.max(0, pp - 1)
    await setItem(K.PP_TOTAL, String(next))
    return next
  }
  return getPreferenceMatchCount(Math.max(0, (total ?? 0) - 1))
}

// ─── URL param builders ───────────────────────────────────────────────────────

function baseParams(obj: Record<string, any>): string {
  // Angular (filter.service.ts getUrlParams): CASTE carries DIVISION's keys for
  // religion '2' — CHRISTIAN, not Islam (search.component.ts:100, "For
  // christian the division field is filled from the caste list").
  //
  // Tested on the WHOLE selection, not RELIGION[0]: Christian ALONE is the only
  // case whose picks live under DIVISION, which is exactly the rule the
  // Caste/Division row uses to decide which field it writes. Angular's
  // `RELIGION[0] === '2'` agrees for every selection the option list can
  // produce in order, but would send an empty DIVISION for a mixed
  // Christian-first selection whose picks the UI had stored under CASTE.
  const religionKeys = (obj.RELIGION ?? []).filter((k: string) => k && k !== '0')
  const casteVal = religionKeys.join('~') === '2'
    ? (obj.DIVISION ?? []).join('~')
    : (obj.CASTE ?? []).join('~')

  return [
    `STARTAGE=${obj.STARTAGE}`,
    `ENDAGE=${obj.ENDAGE}`,
    `STARTHEIGHT=${[...(obj.STARTHEIGHT ?? [])].sort()}`,
    `ENDHEIGHT=${[...(obj.ENDHEIGHT ?? [])].sort()}`,
    `MARITALSTATUS=${(obj.MARITALSTATUS ?? []).join('~')}`,
    `RELIGION=${(obj.RELIGION ?? []).join('~')}`,
    `CASTE=${casteVal}`,
    `SUBCASTE=${(obj.SUBCASTE ?? []).join('~')}`,
    `GOTHRA=${(obj.GOTHRA ?? []).join('~')}`,
    `STAR=${(obj.STAR ?? []).join('~')}`,
    `DOSHAM=${(obj.DOSHAM ?? []).join('~')}`,
    `EDUCATION=${(obj.EDUCATION ?? []).join('~')}`,
    `OCCUPATION=${(obj.OCCUPATION ?? []).join('~')}`,
    `CITY=${(obj.CITY ?? []).join('~')}`,
    `STATE=${(obj.STATE ?? []).join('~')}`,
    `COUNTRY=${(obj.COUNTRY ?? []).join('~')}`,
    `MOTHERTONGUE=${(obj.MOTHERTONGUE ?? []).join('~')}`,
    `PHYSICALSTATUS=${(obj.PHYSICALSTATUS ?? []).join('~')}`,
    `EATINGHABITS=${(obj.EATINGHABITS ?? []).join('~')}`,
  ].join('&')
}

// Angular: filter.service.ts getUrlParams()'s income block. MONTHLYINCOME is a
// semantic CHOICE, not a bracket list:
//   '0'          -> any income          -> STARTINCOME=0&ENDINCOME=
//   '1' or '3'   -> "should not exceed" / "should be at least" the member's own
//                   income            -> STARTINCOME=<that key>&ENDINCOME=
//   anything else with a real multi-entry STARTMONTHLYINCOME -> a custom
//                   bracket range     -> STARTINCOME=ENDINCOME=STARTMONTHLYINCOME
//
// Two bugs this replaces: the range branch was tested FIRST, so a '1'/'3'
// choice sitting alongside a stale bracket range was sent as a range; and the
// range's ENDINCOME came from ENDMONTHLYINCOME, where Angular sends
// STARTMONTHLYINCOME on BOTH sides.
function incomeParams(obj: Record<string, any>): string {
  const choice   = String(obj.MONTHLYINCOME?.[0] ?? '')
  const isRange  = !['0', '1', '3'].includes(choice)
    && (obj.STARTMONTHLYINCOME?.length ?? 0) > 1

  if (['1', '3'].includes(choice)) {
    return `STARTINCOME=${(obj.MONTHLYINCOME ?? []).join('~')}&ENDINCOME=`
  }
  if (isRange) {
    const brackets = (obj.STARTMONTHLYINCOME ?? []).join('~')
    return `STARTINCOME=${brackets}&ENDINCOME=${brackets}`
  }
  return 'STARTINCOME=0&ENDINCOME='
}

// Angular: filter.service.ts's getStrictFilterParam(). The saved strict state
// (what getpreference answered with, kept up to date by the Manage Strict
// Filters toggles) is the BASE, and Angular layers two adjustments over it:
//
//   1. In Filters mode only, every field the temporary filter holds a
//      selection in goes out as '1' — "a field selected in the temporary
//      filter is a strict one as well". A saved 1|0|0|0… with religion picked
//      in the filter goes out as 1|0|0|1….
//   2. CASTE goes out as '0' whenever religion is "Any", since caste only
//      means anything under a specific caste-bearing religion.
//
// An earlier version of this port dropped both, on a "one stored value, one
// payload" premise. That is not what the server is told by the Angular app:
// filtering by religion/star/education silently went out as non-strict, and a
// stale CASTE '1' kept being sent under "Any religion".
export function getStrictFilterParam(
  strictState: Record<FieldKey, boolean>,
  opts: { selectedStrictKeys?: FieldKey[]; religionIsAny?: boolean } = {},
): string {
  const { selectedStrictKeys = [], religionIsAny = false } = opts
  return STRICT_FIELD_ORDER
    .map(key => {
      if (selectedStrictKeys.includes(key)) return '1'
      if (key === 'CASTE' && religionIsAny) return '0'
      return strictState[key] ? '1' : '0'
    })
    .join('|')
}

// Angular: filter.service.ts's isSelectionAny() — a selection array counts as
// "Any" (no real preference) when it is empty or every entry is a zero/blank
// sentinel.
function isSelectionAny(val: any): boolean {
  return !val || val.length === 0
    || val.every((x: any) => x === '0' || x === '' || x === 0)
}

// Angular: filter.service.ts's getSelectedFilterStrictKeys() — the STRICKPP
// keys of the fields the TEMPORARY filter holds a selection in. It reads three
// sources and unions them, exactly as Angular does:
//   - the in-memory selectedFilters map (here: the caller's editedRows)
//   - the persisted SELECTEDFILTERS map, which is what the Filters chip's
//     count badge also reads
//   - SEARCHVALUES, whose per-field isAnyChanges flag is only ever set while
//     the filter event is on
//
// Range fields are stored as STARTAGE/ENDHEIGHT-style keys, so a leading
// START/END is stripped before the field-key lookup (Angular does the same).
async function getSelectedFilterStrictKeys(): Promise<FieldKey[]> {
  const keys: FieldKey[] = []
  const add = (fieldType: string) => {
    const key = STRICT_FIELD_KEY_MAP[fieldType]
      ?? STRICT_FIELD_KEY_MAP[fieldType.replace(/^(START|END)/, '')]
    if (key && !keys.includes(key)) keys.push(key)
  }

  const [savedFilters, searchValues] = await Promise.all([
    getJson<Record<string, boolean>>(K.FILTERS),
    getJson<Record<string, { isAnyChanges?: boolean }>>('SEARCHVALUES'),
  ])

  Object.keys(savedFilters ?? {}).forEach(f => { if (savedFilters?.[f] === true) add(f) })
  Object.keys(searchValues ?? {}).forEach(f => {
    if (searchValues?.[f]?.isAnyChanges === true) add(f)
  })

  return keys
}

export interface SearchParamOptions {
  // Angular's countParam (getUrlParams(0)) rather than its searchParam
  // (getUrlParams(1)): SETPP hardcoded all '0' whatever the mode, no FILTERPP,
  // and not persisted as SEARCH_PARAMS. Every live matches-count call is one —
  // the Edit-Preference footer count and both strict-filter screens' count.
  forCount?: boolean
  // Kept for call-site compatibility, but it no longer changes the payload.
  // Angular's Manage Strict Filters view is a MODE of the Partner Preference
  // page (search.component.html's `manageStrictFilter` branch), sharing the
  // page's ONE footer CTA — `(click)="contentLoaded ? applyFilter() : ''"`,
  // i.e. the very same getUrlParams(1). So its apply sends an identical
  // SETPP/FILTERPP/STRICKPP triple; suppressing FILTERPP here made the two
  // surfaces disagree.
  strictFilterApply?: boolean
}

// The three payloads this endpoint takes, all in the same 14-position order
// (AGE|HEIGHT|MARITALSTATUS|RELIGION|STAR|DOSHAM|EDUCATION|OCCUPATION|INCOME|
//  LOCATION|MOTHERTONGUE|CASTE|PHYSICALSTATUS|EATINGHABITS):
//
//   STRICKPP — always sent, on every call from every surface. The strict state
//              the getpreference API returned, plus Angular's two overrides
//              (see getStrictFilterParam).
//   SETPP    — all '1' ONLY on an Edit-Preference apply. Filters mode and
//              every count call send all '0'.
//   FILTERPP — every apply (Edit Preference, Filters, Manage Strict Filters),
//              with each edited field's own position set to '1'. Never on a
//              count call — Angular's countParam has no FILTERPP at all.
export async function buildSearchParams(
  matriId: string, start = 0, limit = 20, opts: SearchParamOptions = {},
): Promise<string> {
  const { forCount = false } = opts
  const obj       = await getSelectedObject()
  const ppCheckBox = await getSearchPPCheckBox()
  const isFilter  = (await getItem(K.EVTYPE)) === 'filter'
  const strictState = await getStrictFilterState()

  let extra = ''
  // Partner-Preferences mode is the ONLY case that sends ones; Filters mode
  // and every count call send zeros.
  let setPP = (forCount || isFilter) ? [...SETPP_OFF] : [...SETPP_ON]

  if (isFilter) {
    extra = `&PROFILECREATED=${(obj.PROFILECREATED ?? []).join('~')}&PHOTOAVAILABLE=${obj.PHOTOAVAILABLE ?? '0'}&HOROSCOPEAVAILABLE=${obj.HOROSCOPEAVAILABLE ?? '0'}`
    // Angular pushes three more '0' in Filters mode, for
    // PROFILECREATED/PHOTOAVAILABLE/HOROSCOPEAVAILABLE (17 positions).
    setPP = [...setPP, '0', '0', '0']
  }

  // Filters mode carries the same three extra positions on FILTERPP, so a
  // stored array that never reached them is padded out to 17 here.
  const filterPPLength = isFilter ? 17 : 14
  const filterPPFlags  = Array.from({ length: filterPPLength }, (_, i) => ppCheckBox[i] ?? '0')
  const filterPP = forCount ? '' : `&FILTERPP=${filterPPFlags.join('|')}`

  // Angular: filter.service.ts's getStrictFilterParam() applies the
  // "selected in the temporary filter ⇒ strict" override in Filters mode
  // ONLY (`checkFilterEventType() ? getSelectedFilterStrictKeys() : []`).
  // The religion-is-Any caste override is unconditional.
  const selectedStrictKeys = isFilter ? await getSelectedFilterStrictKeys() : []
  const strickPP = getStrictFilterParam(strictState, {
    selectedStrictKeys,
    religionIsAny: isSelectionAny(obj.RELIGION),
  })

  // VIEWED=0, not 1. Angular sends VIEWED=0 on BOTH search/searchform/v1 calls:
  // the count one (filter.service.ts's countParam) and the list one
  // (matches.page.ts:989 — its VIEWED is `newMatches == "1" ? 1 : 0`, and the
  // searchPage branch at :1002 forces `this.newMatches = "0"` right before
  // appending SearchURL). VIEWED=1 asks the server to include already-viewed
  // profiles, so filtered results and the count above them were both drawn
  // from a wider set than Angular's.
  const params = `ID=${matriId}&START=${start}&LIMIT=${limit}&LIKED=1&VIEWED=0&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1&BANNERFLAG=0&${baseParams(obj)}&${incomeParams(obj)}${extra}&SETPP=${setPP.join('|')}${filterPP}&STRICKPP=${strickPP}`
  // Angular only stores SEARCH_PARAMS for the search call — letting the
  // debounced count overwrite it would leave a LIMIT=1 URL behind as "the
  // last search".
  if (!forCount) await setItem(K.PARAMS, params)
  return params
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export async function resetFilter(eventType = 'filter'): Promise<void> {
  const keysToRemove = [
    'SYSTEMSETPP', SK.App.PP_SET_DATA, 'PREVLANGUAGE',
    'FILTERDATALIST', K.SELECTED, 'SEARCHVALUES',
    // K.PP_TOTAL is NOT here, deliberately: Angular's resetFilter() drops
    // MATCHESTOTALCOUNT and leaves MATCHESPPTOTALCOUNT alone, so the
    // "profiles based on your preferences" line survives a filter reset.
    'SELECTEDKEYS', 'SELECTEDVALUES', K.TOTAL,
    'FILTERCOUNT', 'MATCHESOLDCOUNT', K.PPCHECK,
    'ISCALLEDAPI', K.FILTERS,
    // K.STRICT (STRICT_FILTER_STATE) is deliberately NOT purged. Angular's
    // filter.service.ts resetFilter() removes exactly the 14 keys above and
    // leaves the strict state alone — the only place it is ever removed is
    // filter.component.ts:301, restoring a snapshot when the member cancels out
    // of the strict panel, which is a different action entirely.
    //
    // It used to be cleared here, on the premise that an absent key falls back
    // to "all strict flags on". It does not: DEFAULT_STRICT_STATE is all-FALSE
    // (see its own comment — an unknown field must serialize to '0', matching
    // Angular's `state[key] === true` test). So purging it made the next
    // searchResult call go out as STRICKPP=0|0|0|… and silently drop every
    // strict preference the member had set.
  ]

  if (eventType === 'pp') keysToRemove.push(K.EVTYPE)

  await Promise.all(keysToRemove.map(removeItem))
}

// ─── Parent-child list utilities (filter UI) ──────────────────────────────────

export interface FilterItem {
  type:         'parent' | 'child'
  key:          any
  value:        any
  checked:      boolean
  parentKey?:   any
  parentValue?: any
}

// Angular's sentinel option codes ("Caste no bar", "Others", "Don't wish to
// specify", …). It uses this one list for BOTH purposes: they can never be
// "checked" (isValueChecked below) and getSearchDataList() also omits them from
// a panel's options entirely — see fetchSearchCasteOptions(), which imports it.
export const NON_SELECTABLE_OPTION_KEYS = new Set(['no', '0', '00', '9998', '9999', '999', '998'])

export function isValueChecked(key: string, selectedList: any[] | undefined): boolean {
  if (!selectedList || NON_SELECTABLE_OPTION_KEYS.has(String(key))) return false
  if (selectedList[0] === '0') return false
  return selectedList.includes(String(key))
}

export function buildParentChildList(
  parentKeys: any[],
  parentValues: any[],
  childMap: any[] | Record<string, any[]>,
  filterKey: string,
  selectedObject: Record<string, any>,
): FilterItem[] {
  const result: FilterItem[] = []
  const selected = selectedObject[filterKey]

  parentKeys.forEach((parentKey, i) => {
    const children: any[] = Array.isArray(childMap)
      ? (filterKey === 'CITY'
        ? (childMap as any[]).filter((c: any) => String(c.STATEID) === String(parentKey))
        : (childMap as any[])[i] ?? [])
      : (childMap as Record<string, any[]>)[parentKey] ?? []

    const allChildrenChecked = children.length > 0 && children.every(c => isValueChecked(c.key, selected))

    result.push({ type: 'parent', key: parentKey, value: parentValues[i], checked: allChildrenChecked })

    children.forEach(child => {
      result.push({
        type:        'child',
        key:         child.key,
        value:       child.value,
        checked:     isValueChecked(child.key, selected),
        parentKey,
        parentValue: parentValues[i],
      })
    })
  })

  return sortFilterList(result)
}

// Checked items float to the top within each parent group.
export function sortFilterList(list: FilterItem[], sortParents = false): FilterItem[] {
  const groups: FilterItem[][] = []
  let i = 0

  while (i < list.length) {
    const parent = list[i++]
    const children: FilterItem[] = []

    while (i < list.length && list[i].type === 'child') children.push(list[i++])

    children.sort((a, b) => Number(b.checked) - Number(a.checked))
    groups.push([parent, ...children])
  }

  if (sortParents) groups.sort((a, b) => Number(b[0].checked) - Number(a[0].checked))

  return groups.flat()
}

// Refreshes checked state after selectedObject changes without rebuilding the full list.
export function updateCheckedState(
  list: FilterItem[],
  filterKey: string,
  selectedObject: Record<string, any>,
): FilterItem[] {
  const selected = selectedObject[filterKey]
  return list.map(item =>
    item.type === 'child'
      ? { ...item, checked: isValueChecked(item.key, selected) }
      : item,
  )
}
