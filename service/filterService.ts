import { getItem, setItem, getJson, setJson, removeItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { STRICT_FIELD_ORDER, STRICT_FIELD_KEY_MAP } from '../constants/strictFilter.config'
import type { FieldKey } from '../screens/search/SearchScreen'

// ─── Filter defaults ──────────────────────────────────────────────────────────

export const DEFAULT_FILTER: Record<string, any> = {
  STARTAGE: '18', ENDAGE: '50',
  STARTHEIGHT: ['1'], ENDHEIGHT: ['5'],
  EDUCATION: ['0'], OCCUPATION: ['0'],
  MARITALSTATUS: ['0'], STAR: ['0'],
  DOSHAM: ['0'], MONTHLYINCOME: ['0'],
  RELIGION: ['0'], CASTE: ['0'],
  SUBCASTE: ['0'], GOTHRA: ['0'],
  STATE: ['0'], CITY: ['0'],
  COUNTRY: ['0'], MOTHERTONGUE: ['0'],
  DIVISION: ['0'], PHYSICALSTATUS: ['0'],
  EATINGHABITS: ['0'],
  STARTMONTHLYINCOME: ['3'], ENDMONTHLYINCOME: ['13'],
  PROFILECREATED: ['0'], PHOTOAVAILABLE: '0', HOROSCOPEAVAILABLE: '0',
  PISTARMATCHING: '',
}

// 14 flags — matches Angular's CONFIG.searchPPCheckBox
export const DEFAULT_PP_CHECKBOX = Array(14).fill('1')

// ─── Storage keys ─────────────────────────────────────────────────────────────
const K = {
  SELECTED: 'SELECTED_NEWPP',
  PPCHECK:  'SEARCHPPCHKBOX',
  FILTERS:  'SELECTEDFILTERS',
  EVTYPE:   'FILTEREVENTTYPE',
  PARAMS:   'SEARCH_PARAMS',
  STRICT:   'STRICT_FILTER_STATE',
}

// Angular: filter.service.ts's default — every field strict-on until the
// user turns one off. Replaces the ad-hoc 'PP_STRICT_FILTERS' key this app
// used before the backend contract (STRICKPP) was confirmed.
const DEFAULT_STRICT_STATE: Record<FieldKey, boolean> = Object.fromEntries(
  STRICT_FIELD_ORDER.map(key => [key, true]),
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

function incomeParams(obj: Record<string, any>): string {
  const income = obj.MONTHLYINCOME?.[0]
  const hasRange = (obj.STARTMONTHLYINCOME?.length ?? 0) > 1

  if (hasRange) {
    return `STARTINCOME=${(obj.STARTMONTHLYINCOME ?? []).join('~')}&ENDINCOME=${(obj.ENDMONTHLYINCOME ?? []).join('~')}`
  }
  if (['1', '3'].includes(income)) {
    return `STARTINCOME=${(obj.MONTHLYINCOME ?? []).join('~')}&ENDINCOME=`
  }
  return 'STARTINCOME=0&ENDINCOME='
}

// Angular: filter.service.ts's isSelectionAny() — a stored selection means
// "no preference" when it's empty or every entry is the 0/'' sentinel.
function isSelectionAny(val: any): boolean {
  if (val === undefined || val === null) return true
  const arr = Array.isArray(val) ? val : [val]
  return arr.length === 0 || arr.every(x => x === '0' || x === '' || x === 0)
}

// Angular: filter.service.ts's getSelectedFilterStrictKeys() — in FILTER mode a
// field the member actually narrowed counts as strict for this search, so its
// STRICKPP position goes out as 1 on top of the saved state. Angular reads the
// touched-field flags it keeps while the temporary filter is open; this derives
// the same set from the selection itself (a field holding a real, non-"Any"
// value is one the member narrowed), which needs no extra bookkeeping.
function selectedFilterStrictKeys(obj: Record<string, any>): Set<FieldKey> {
  const keys = new Set<FieldKey>()
  Object.keys(obj ?? {}).forEach(field => {
    if (isSelectionAny(obj[field])) return
    // Range fields are stored as STARTAGE/ENDAGE etc. — the field name is what
    // follows that prefix (Angular strips the same /^(START|END)/).
    const mapped = STRICT_FIELD_KEY_MAP[field] ?? STRICT_FIELD_KEY_MAP[field.replace(/^(START|END)/, '')]
    if (mapped) keys.add(mapped)
  })
  return keys
}

export function getStrictFilterParam(
  strictState: Record<FieldKey, boolean>,
  obj: Record<string, any>,
  isFilterMode = false,
): string {
  const religionIsAny = isSelectionAny(obj?.RELIGION)
  const selectedKeys  = isFilterMode ? selectedFilterStrictKeys(obj) : new Set<FieldKey>()

  return STRICT_FIELD_ORDER
    .map(key => {
      if (selectedKeys.has(key)) return '1'
      // Caste only means anything once a specific religion is chosen.
      if (key === 'CASTE' && religionIsAny) return '0'
      return strictState[key] ? '1' : '0'
    })
    .join('|')
}

export async function buildSearchParams(matriId: string, start = 0, limit = 20): Promise<string> {
  const obj       = await getSelectedObject()
  const ppCheckBox = await getSearchPPCheckBox()
  const isFilter  = (await getItem(K.EVTYPE)) === 'filter'
  const strictState = await getStrictFilterState()

  let extra = ''
  let setPP = [...DEFAULT_PP_CHECKBOX]

  if (isFilter) {
    extra = `&PROFILECREATED=${(obj.PROFILECREATED ?? []).join('~')}&PHOTOAVAILABLE=${obj.PHOTOAVAILABLE ?? '0'}&HOROSCOPEAVAILABLE=${obj.HOROSCOPEAVAILABLE ?? '0'}`
    setPP = [...DEFAULT_PP_CHECKBOX, '0', '0', '0']
  }

  const params = `ID=${matriId}&START=${start}&LIMIT=${limit}&LIKED=1&VIEWED=1&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1&BANNERFLAG=0&${baseParams(obj)}&${incomeParams(obj)}${extra}&SETPP=${setPP.join('|')}&FILTERPP=${ppCheckBox.join('|')}&STRICKPP=${getStrictFilterParam(strictState, obj, isFilter)}`
  await setItem(K.PARAMS, params)
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
