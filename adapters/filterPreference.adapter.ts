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
  const labels = (keys as string[]).map(k => opts.find(o => o.key === k)?.label ?? k)
  return labels.length > 0 ? labels.join(', ') : anyLabel
}
