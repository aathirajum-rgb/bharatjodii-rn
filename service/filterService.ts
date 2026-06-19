import { getItem, setItem, getJson, setJson, removeItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'

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
}

// ─── State accessors ──────────────────────────────────────────────────────────

export async function getSelectedObject(): Promise<Record<string, any>> {
  return (await getJson<Record<string, any>>(K.SELECTED)) ?? { ...DEFAULT_FILTER }
}

export async function getSearchPPCheckBox(): Promise<string[]> {
  return (await getJson<string[]>(K.PPCHECK)) ?? [...DEFAULT_PP_CHECKBOX]
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

export async function buildSearchParams(matriId: string): Promise<string> {
  const obj       = await getSelectedObject()
  const ppCheckBox = await getSearchPPCheckBox()
  const isFilter  = (await getItem(K.EVTYPE)) === 'filter'

  let extra = ''
  let setPP = [...DEFAULT_PP_CHECKBOX]

  if (isFilter) {
    extra = `&PROFILECREATED=${(obj.PROFILECREATED ?? []).join('~')}&PHOTOAVAILABLE=${obj.PHOTOAVAILABLE ?? '0'}&HOROSCOPEAVAILABLE=${obj.HOROSCOPEAVAILABLE ?? '0'}`
    setPP = [...DEFAULT_PP_CHECKBOX, '0', '0', '0']
  }

  const params = `ID=${matriId}&START=0&LIMIT=20&LIKED=1&VIEWED=1&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1&BANNERFLAG=0&${baseParams(obj)}&${incomeParams(obj)}${extra}&SETPP=${setPP.join('|')}&FILTERPP=${ppCheckBox.join('|')}`
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
