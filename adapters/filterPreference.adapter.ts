// Shared "selected filter/preference codes -> display label" resolution —
// previously duplicated byte-for-byte between hooks/useFilterDisplayValues.ts
// (desktop Matches filter sidebar) and screens/search/SearchScreen.tsx (both
// mobile and desktop Search), each with its own private isAny()/labelsFor().
//
// Not implemented as a class against core/base/base.adapter.ts's Adapter<T> —
// that interface models "one raw API item -> one UI model", but this
// transformation takes the resolved option list and the current "Any"
// translation as separate inputs (both callers source those differently:
// the sidebar hook eagerly Promise.all's every non-default field's list,
// SearchScreen lazily caches one field's list at a time in labelCache). Same
// shape as components/matches/matchesCard.shared.tsx's plain exported
// functions, not a class.
//
// Deliberately does NOT own field-specific formatting (AGE range text, the
// HEIGHT default-vs-truthy presence check, PROFILECREATED's collapse to a
// plain "Yes"/"Any" toggle in the sidebar vs its real recency label in
// SearchScreen) — those three fields render genuinely different UI between
// the two callers today, not an accidental duplicate, so they stay local to
// each caller.

export interface FilterOption {
  key:   string
  label: string
}

// '0' (or an empty/missing array) is filterService's own "Any" sentinel for
// every multi-select filter field.
export function isAnySelection(v: unknown): boolean {
  return !v || (v as any[]).length === 0 || (v as any[])[0] === '0'
}

// Resolves selected option codes against a fetched option list into the
// human-readable label callers render — `anyLabel` is the caller's already-
// translated t('SEARCH.ANY') string, kept as a param (not looked up here)
// since neither caller shares an i18n instance with this adapter module.
export function resolveFilterLabel(opts: FilterOption[], keys: unknown, anyLabel: string): string {
  if (isAnySelection(keys)) return anyLabel
  // A key with no matching option is DROPPED, not printed. Angular
  // (search.component.ts:838-845) only pushes a key when it matches
  // (`isSelected > -1`), and its object branch only when
  // `isValidparam(filterLists[key])` — an unknown code never reaches the label
  // string. The `?? k` fallback here surfaced raw codes to the member instead,
  // e.g. the Caste field reading "24 Manai Telugu Chettiar,771,772,Chettiar".
  //
  // Everything unresolved leaves labels empty, and the caller falls through to
  // anyLabel below — which is Angular's own behaviour too (valueList empty ->
  // it resets the field to ['0'], i.e. "Any").
  const labels = (keys as string[])
    .map(k => opts.find(o => o.key === k)?.label)
    .filter((l): l is string => !!l)
  // Angular joins a multi-value selection with a bare comma and no space
  // (filter-popup.component.ts's getArrayData -> `keyList.join(',')`), e.g.
  // "Krishna,Guntur,East Godavari" or "Christian,Hindu,Muslim - Shia".
  return labels.length > 0 ? labels.join(',') : anyLabel
}

// ─── Radio-first fields (DOSHAM / MONTHLYINCOME) ─────────────────────────────
// Angular: filterRevampConfig gives these two `RADIOBTNTYPE: 'type-1'`, and
// filter.component.html renders app-radio over the whole FILTERSCREEN map for
// the field, with the sub-list row disabled unless the '2' option is picked.
//
//   DOSHAM        {0: "Dosham doesn't matter", 1: "<gender> horoscope should
//                  not have dosham", 2: "<gender> horoscope should have"}
//   MONTHLYINCOME {0: "Any income", 1: "Should not exceed <income>",
//                  2: "Select income range", 3: "Should be at least <income>"}
//
// Rows come out in numeric key order, which is the order Angular's own
// Object-keyed list produces.
export function buildRadioChoices(
  screenMap: Record<string, any> | undefined,
  replacements: { gender?: string; income?: string } = {},
): FilterOption[] {
  if (!screenMap || typeof screenMap !== 'object') return []
  return Object.keys(screenMap)
    .filter(key => typeof screenMap[key] === 'string' && screenMap[key].trim() !== '')
    .sort((a, b) => Number(a) - Number(b))
    .map(key => {
      let label = String(screenMap[key])
      // Angular setDoshamValue(): <gender> becomes the PARTNER's term.
      if (replacements.gender) label = label.replace(/<gender>/gi, replacements.gender)
      // Angular replaceIncomeValue(): INCOME_PLACEHOLDER, or a literal
      // "undefined" the server sometimes interpolates.
      if (replacements.income) {
        label = INCOME_PLACEHOLDER.test(label)
          ? label.replace(INCOME_PLACEHOLDER, replacements.income)
          : label.replace('undefined', replacements.income)
      }
      return { key, label }
    })
}

// The income radio is PRUNED before it's shown — Angular's
// filter.component.ts getArrayList():
//
//   no PI income on file        -> drop '1' AND '3' (both name the member's
//                                  own income, so neither can be phrased)
//   male member, PI income      -> drop '3' ("should be at least")
//   female member with an
//   occupation, PI income       -> drop '1' ("should not exceed"), and move
//                                  the second remaining row to the end
//
// Without this every FILTERSCREEN.MONTHLYINCOME key was rendered, so members
// saw options Angular hides — e.g. "should not exceed" for a working woman.
export function buildIncomeChoices(
  screenMap: Record<string, any> | undefined,
  incomeAmount: string,
  member: { piIncome?: string; gender?: string; hasOccupation?: boolean },
): FilterOption[] {
  const all      = buildRadioChoices(screenMap, { income: incomeAmount })
  const piIncome = String(member.piIncome ?? '').trim()
  const drop     = new Set<string>()
  let moveSecondToEnd = false

  if (piIncome === '' || piIncome === '0') {
    drop.add('1'); drop.add('3')
  } else if (member.gender === 'M') {
    drop.add('3')
  } else if (member.gender === 'F' && member.hasOccupation) {
    drop.add('1')
    moveSecondToEnd = true
  }

  const kept = all.filter(o => !drop.has(o.key))
  if (moveSecondToEnd && kept.length > 1) {
    // Angular: `arrayList.splice(1, 1)[0]` then `arrayList.push(...)`.
    const [moved] = kept.splice(1, 1)
    if (moved) kept.push(moved)
  }
  return kept
}

// Angular: filter.config.ts's INCOME_PLACEHOLDER / INCOME_SLAB_AMOUNT and
// search.component.ts's getIncomeRangeValue() — resolves the member's own
// income code to a displayable amount for the "should not exceed / at least
// <income>" labels, checking the slab map first and then every income list the
// initialfetch blob might carry it under.
const INCOME_PLACEHOLDER = /<inc[a-z]*>/i
const INCOME_SLAB_AMOUNT: Record<string, string> = { '10': '₹50,000' }

export function incomeAmountFor(piIncome: unknown, arrays: Record<string, any>): string {
  // Angular: `['1','2'].includes(_split) ? '3' : _split`
  const raw = String(piIncome ?? '')
  const key = ['1', '2'].includes(raw) ? '3' : raw
  if (key === '') return ''
  if (INCOME_SLAB_AMOUNT[key]) return INCOME_SLAB_AMOUNT[key]

  const lists = [
    arrays?.INCOMERANGEARRAY, arrays?.MONTHLYINCOMERANGE,
    arrays?.MONTHLYINCOME, arrays?.INCOME,
  ]
  for (const list of lists) {
    if (!list || typeof list !== 'object') continue
    const direct = (list as any)[key]
    if (direct != null && typeof direct !== 'object' && String(direct) !== '') return String(direct)
    for (const item of Object.values(list) as any[]) {
      if (!item || typeof item !== 'object') continue
      const itemKey = String(item.key ?? item.KEY ?? item.INCOMEKEY ?? item.MINCOMEKEY ?? '')
      const value   = item.value ?? item.VALUE
      if (itemKey === key && value != null && String(value) !== '') return String(value)
    }
  }
  return ''
}

// ─── Star panel groups ───────────────────────────────────────────────────────
// The Star panel is NOT grouped by raasi. Angular splits the full star list in
// two, under the headings FILTERSCREEN.STAR carries:
//
//   {0: "Any star", 1: "Matching stars", 2: "All other stars"}
//
// "Matching stars" holds the stars in the member's own PISTARMATCHING (the
// horoscope-compatible ones) and "All other stars" holds the rest —
// filter.component.ts's getSearchDataList builds exactly these two, keyed off
// `matchingType === 'PISTARMATCHING'` vs its `allOtherStars` remainder. Both
// headings are read-only in the panel; only the stars themselves are tappable.
export function buildStarGroups(
  allStars: FilterOption[],
  matchingKeys: string[],
  matchingLabel: string,
  otherLabel: string,
): Array<{ key: string; label: string; options: FilterOption[] }> {
  const matching = new Set(matchingKeys.filter(k => k && k !== '0'))
  const byLabel  = (a: FilterOption, b: FilterOption) =>
    (a.label < b.label ? -1 : a.label > b.label ? 1 : 0)

  const groups = [
    { key: '1', label: matchingLabel, options: allStars.filter(s => matching.has(s.key)).sort(byLabel) },
    { key: '2', label: otherLabel,    options: allStars.filter(s => !matching.has(s.key)).sort(byLabel) },
  ]
  // No horoscope on file means no matching stars — that heading then has
  // nothing under it and drops out, leaving one plain list.
  return groups.filter(g => g.options.length > 0 && g.label.trim() !== '')
}

// Angular stores PISTARMATCHING as a '~'-joined string (search.component.ts's
// toTildeArray) and sometimes ','-joined; both split the same way here.
export function parseStarMatchingKeys(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  return String(raw ?? '')
    .split(/[~,]/)
    .map(s => s.trim())
    .filter(s => s !== '' && s !== '0')
}

// ─── Side-panel option order ─────────────────────────────────────────────────
// Angular: filter-popup.component.ts's sortingList() — how the value picker
// orders its rows. Two STABLE passes, each with its own field exclusions:
//
//   1. alphabetical by label, except for the fields whose server-supplied
//      order is itself meaningful (education/occupation ladders, religion,
//      height, country, physical status, state, city) and marital status;
//   2. currently-selected values hoisted to the top, except height/country
//      (and marital status).
//
// Marital status opts into BOTH passes only once it holds a real selection —
// Angular: `filterType === 'MARITALSTATUS' && selectedObject[...][0] != '0'`.
//
// Applied when the panel OPENS, against the saved selection — not on every
// tick, which would make rows jump under the user's finger (Angular's
// clickOnCheckboxBtn only flips `item.checked`, it never re-sorts).
const NO_ALPHA_SORT = new Set([
  'EDUCATION', 'OCCUPATION', 'RELIGION', 'HEIGHT', 'COUNTRY',
  'PHYSICALSTATUS', 'STATE', 'CITY', 'MARITALSTATUS',
])
const NO_SELECTED_FIRST = new Set(['HEIGHT', 'COUNTRY', 'MARITALSTATUS'])

export function sortFilterOptions<T extends FilterOption>(
  field: string, opts: T[], selectedKeys: unknown,
): T[] {
  // Angular's own exception: marital status stays in server order until the
  // user has actually picked something.
  const maritalHasSelection = field === 'MARITALSTATUS' && !isAnySelection(selectedKeys)
  const sorted = [...opts]

  if (maritalHasSelection || !NO_ALPHA_SORT.has(field)) {
    // Raw string compare, exactly like Angular's `a.value < b.value`.
    sorted.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
  }

  if (maritalHasSelection || !NO_SELECTED_FIRST.has(field)) {
    const keys = new Set(Array.isArray(selectedKeys) ? (selectedKeys as string[]) : [])
    // Array#sort is stable, so the alphabetical order above survives inside
    // each of the two groups — same as Angular chaining the two sorts.
    sorted.sort((a, b) => Number(keys.has(b.key)) - Number(keys.has(a.key)))
  }

  return sorted
}
