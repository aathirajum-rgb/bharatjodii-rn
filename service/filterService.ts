import { getItem, setItem, getJson, setJson, removeItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { STRICT_FIELD_ORDER, STRICT_FIELD_KEY_MAP } from '../constants/strictFilter.config'
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
function filterPPIndex(selectionKey: string): number {
  const extra = FILTERPP_EXTRA_INDEX[selectionKey]
  if (extra !== undefined) return extra
  const base  = selectionKey.replace(/^(START|END)/, '')
  const field = STRICT_FIELD_KEY_MAP[base]
  return field ? STRICT_FIELD_ORDER.indexOf(field) : -1
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

// ─── URL param builders ───────────────────────────────────────────────────────

function baseParams(obj: Record<string, any>): string {
  // Religion 2 = Islam → use DIVISION instead of CASTE
  const casteVal = obj.RELIGION?.[0] === '2'
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

// STRICKPP is the strict state the getpreference API returned (stored by
// setStrictFilterStateFromPP, and updated in place by the Manage Strict
// Filters toggles) — serialized and sent back UNCHANGED on every search-form
// call, identically from Edit Preference and from Filters.
//
// It deliberately does NOT depend on the current selection or on which mode
// the screen is in. Angular's getStrictFilterParam() layers two adjustments on
// top (in Filters mode it forces a '1' for every field holding a non-"Any"
// selection, and it forces CASTE to '0' whenever religion is "Any"), which is
// why the two surfaces were sending different STRICKPP strings for the same
// stored value. Both are dropped here per the stated contract: one stored
// value, one payload.
export function getStrictFilterParam(strictState: Record<FieldKey, boolean>): string {
  return STRICT_FIELD_ORDER
    .map(key => (strictState[key] ? '1' : '0'))
    .join('|')
}

export interface SearchParamOptions {
  // Angular's countParam (getUrlParams(0)) rather than its searchParam
  // (getUrlParams(1)): SETPP hardcoded all '0' whatever the mode, no FILTERPP,
  // and not persisted as SEARCH_PARAMS. Every live matches-count call is one —
  // the Edit-Preference footer count and both strict-filter screens' count.
  forCount?: boolean
  // The strict-filter apply ("Show N matches" inside Manage Strict Filters).
  // FILTERPP goes out only on a real field-edit apply, never on this one:
  // turning a strict toggle isn't a field edit.
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
//   FILTERPP — only on a field-edit apply (Edit Preference or Filters), with
//              the edited field's own position set to '1'. Not on counts, not
//              on the strict-filter apply.
export async function buildSearchParams(
  matriId: string, start = 0, limit = 20, opts: SearchParamOptions = {},
): Promise<string> {
  const { forCount = false, strictFilterApply = false } = opts
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
  const filterPP = (forCount || strictFilterApply) ? '' : `&FILTERPP=${filterPPFlags.join('|')}`

  const params = `ID=${matriId}&START=${start}&LIMIT=${limit}&LIKED=1&VIEWED=1&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1&BANNERFLAG=0&${baseParams(obj)}&${incomeParams(obj)}${extra}&SETPP=${setPP.join('|')}${filterPP}&STRICKPP=${getStrictFilterParam(strictState)}`
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
    'SELECTEDKEYS', 'SELECTEDVALUES', 'MATCHESTOTALCOUNT',
    'FILTERCOUNT', 'MATCHESOLDCOUNT', K.PPCHECK,
    'ISCALLEDAPI', K.FILTERS,
    // Angular: reset forces every strict flag back to '1' — clearing this key
    // has the same effect, since getStrictFilterState() falls back to
    // DEFAULT_STRICT_STATE (all-true) when nothing is persisted.
    K.STRICT,
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

const UNCHECKED_KEYS = new Set(['no', '0', '00', '9998', '9999', '999', '998'])

export function isValueChecked(key: string, selectedList: any[] | undefined): boolean {
  if (!selectedList || UNCHECKED_KEYS.has(String(key))) return false
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
