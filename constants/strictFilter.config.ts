// Strict Filter — ported from Angular's JODII-453 ("Strict Filter" feature).
// Angular: src/app/core/config/filter.config.ts's new constants +
// src/assets/i18n/en.json's per-field STRICT copy keys (AGE_FILTER/
// AGE_FILTER_TXT/AGE_FILTER_RANGE/AGE_NOTE, repeated per field).
//
// English only — no other-language translation files are touched here,
// matching this session's convention elsewhere in the app.
import type { FieldKey } from '../screens/search/SearchScreen'

// Angular: filter.service.ts's getStrictFilterParam() — the exact 14-position
// order the pipe-delimited STRICKPP param is built in. Confirmed against a
// live read of that function, not guessed.
export const STRICT_FIELD_ORDER: FieldKey[] = [
  'AGE', 'HEIGHT', 'MARITALSTATUS', 'RELIGION', 'STAR', 'DOSHAM',
  'EDUCATION', 'OCCUPATION', 'MONTHLYINCOME', 'LOCATION', 'MOTHERTONGUE',
  'CASTE', 'PHYSICALSTATUS', 'EATINGHABITS',
]

// Angular: filter.config.ts's `strictFilterFieldKeyMap` — which STRICKPP
// position each *stored selection key* belongs to. Several keys share one
// position because they're one field on screen: COUNTRY/STATE/CITY all sit
// under LOCATION, and CASTE/SUBCASTE/GOTHRA/DIVISION all under CASTE. The
// range fields are stored as STARTAGE/ENDAGE-style keys, so callers strip a
// leading START/END before looking up (Angular does the same).
export const STRICT_FIELD_KEY_MAP: Record<string, FieldKey> = {
  AGE:            'AGE',
  HEIGHT:         'HEIGHT',
  MARITALSTATUS:  'MARITALSTATUS',
  RELIGION:       'RELIGION',
  STAR:           'STAR',
  DOSHAM:         'DOSHAM',
  EDUCATION:      'EDUCATION',
  OCCUPATION:     'OCCUPATION',
  MONTHLYINCOME:  'MONTHLYINCOME',
  INCOME:         'MONTHLYINCOME',
  LOCATION:       'LOCATION',
  COUNTRY:        'LOCATION',
  STATE:          'LOCATION',
  CITY:           'LOCATION',
  MOTHERTONGUE:   'MOTHERTONGUE',
  CASTE:          'CASTE',
  SUBCASTE:       'CASTE',
  GOTHRA:         'CASTE',
  DIVISION:       'CASTE',
  PHYSICALSTATUS: 'PHYSICALSTATUS',
  EATINGHABITS:   'EATINGHABITS',
}

// Angular: search.component.ts's `strictFilterExcludedFields = ['OCCUPATION']`,
// used by isHiddenInStrictFilter() (hides the row from the manage list) AND
// filter-popup.component.ts's showStrictFilter getter (hides the toggle on
// Occupation's own field-editor page too) — Occupation still occupies its
// STRICKPP position (defaults on, per DEFAULT_STRICT_STATE), it's just never
// user-editable through either strict-filter surface. Confirmed via direct
// read of both files, not guessed.
export const STRICT_EXCLUDED_FIELDS = new Set<FieldKey>(['OCCUPATION'])

// Angular en.json: STRICT_FILTERS / STRICT_FILTERS_NOTE / MANAGE_FILTER —
// verbatim strings, already what SearchDesktopLayout.tsx hardcoded inline;
// centralized here so mobile's new manage modal uses the exact same copy.
// i18n keys, not literals — every one of these now exists in all 11 locale
// files, copied across from Angular's own src/assets/i18n.
export const STRICT_FILTERS_TITLE = 'SEARCH.STRICT_FILTERS'
export const STRICT_FILTERS_NOTE  = 'SEARCH.STRICT_FILTERS_NOTE'
export const MANAGE_FILTER_CTA    = 'SEARCH.MANAGE_FILTER'
export const FILTER_CTA_NOTE      = 'SEARCH.FILTER_CTA_NOTE'

// The `t` from react-i18next, narrowed to what this file needs so the config
// stays free of a react-i18next import.
export type TFunc = (key: string) => string

// Angular en.json: MATCH_REDUCED, with #OLDCOUNT#/#NEWCOUNT# placeholders.
// Not read from i18n: Angular's string carries markup (`<br>` and two
// `<span class='matches-old|new'>`) that only its HTML renderer can use.
export function matchReducedText(oldCount: number, newCount: number): string {
  return `Matches reduced ${oldCount.toLocaleString('en-IN')} to ${newCount.toLocaleString('en-IN')}`
}

// Angular en.json's per-field `SEARCH.{PREFIX}_FILTER_RANGE`, shown under the
// toggle. Only AGE_FILTER_RANGE carries a substitution token (#AGERANGE#);
// every other field's string is fixed and names no value at all — HEIGHT's is
// "…only by matches within the specified height range", full stop.
//
// This used to BUILD the sentence from a template — "between {field} range
// {value}" for AGE/HEIGHT/INCOME, "matching {value}" otherwise — which invented
// copy Angular does not have. On the Height page it read "…matches between
// height range 4 ft 6 in (137 cm) - 7 ft 0 in (213 cm)" where Angular says
// "…matches within the specified height range".
export function strictPromptText(t: TFunc, key: FieldKey, value: string): string {
  return t(STRICT_FIELD_KEYS[key].prompt).replace('#AGERANGE#', value)
}

// The four i18n KEYS each field's strict block reads. Resolving happens at
// render time via strictFieldCopy(t, field) — the strings themselves live in
// locales/*.json for all 11 languages, exactly as Angular has them.
export interface StrictFieldCopy {
  label:       string   // SEARCH.{PREFIX}_FILTER        — e.g. "Strict age filter"
  description: string   // SEARCH.{PREFIX}_FILTER_TXT    — one-liner beside the toggle
  prompt:      string   // SEARCH.{PREFIX}_FILTER_RANGE  — shown under the toggle
  note:        string   // SEARCH.{PREFIX}_NOTE          — consequence warning
}

// Resolves a field's four keys against the active language.
export function strictFieldCopy(t: TFunc, field: FieldKey): StrictFieldCopy {
  const k = STRICT_FIELD_KEYS[field]
  return { label: t(k.label), description: t(k.description), prompt: t(k.prompt), note: t(k.note) }
}

// Angular's per-field i18n key pattern is `{FIELD}_FILTER` / `{FIELD}_FILTER_TXT`
// / `{FIELD}_NOTE` for every one of the 14 fields — same shape, reused here as
// one data-driven map instead of 14 near-identical string constants. Age's
// wording is Angular's real captured string; the rest follow the exact same
// template Angular uses field-to-field (confirmed pattern, not per-field
// verbatim capture for every one of the 14 — safe since Angular itself just
// substitutes the field name into this same sentence shape).
// Each field's four i18n keys, under Angular's own SEARCH namespace. The
// strings live in locales/*.json for all 11 languages (copied over from
// nbpwa/src/assets/i18n), so this file holds no user-facing copy at all.
//
// The prefixes are NOT simply the FieldKey — Angular's own naming is uneven,
// and getting one wrong silently renders the raw key:
//   MONTHLYINCOME  -> INCOME_*
//   MARITALSTATUS  -> MARITAL_STATUS_*
//   PHYSICALSTATUS -> PHYSICAL_STATUS_*
//   EATINGHABITS   -> EATING_HABITS_*
//   MOTHERTONGUE   -> MOTHER_TONGUE_*, except its note, which is MOTHERTONGUE_NOTE
export const STRICT_FIELD_KEYS: Record<FieldKey, StrictFieldCopy> = {
  AGE: {
    label:       'SEARCH.AGE_FILTER',
    description: 'SEARCH.AGE_FILTER_TXT',
    prompt:      'SEARCH.AGE_FILTER_RANGE',
    note:        'SEARCH.AGE_NOTE',
  },
  HEIGHT: {
    label:       'SEARCH.HEIGHT_FILTER',
    description: 'SEARCH.HEIGHT_FILTER_TXT',
    prompt:      'SEARCH.HEIGHT_FILTER_RANGE',
    note:        'SEARCH.HEIGHT_NOTE',
  },
  MARITALSTATUS: {
    label:       'SEARCH.MARITAL_STATUS_FILTER',
    description: 'SEARCH.MARITAL_STATUS_FILTER_TXT',
    prompt:      'SEARCH.MARITAL_STATUS_FILTER_RANGE',
    note:        'SEARCH.MARITAL_STATUS_NOTE',
  },
  RELIGION: {
    label:       'SEARCH.RELIGION_FILTER',
    description: 'SEARCH.RELIGION_FILTER_TXT',
    prompt:      'SEARCH.RELIGION_FILTER_RANGE',
    note:        'SEARCH.RELIGION_NOTE',
  },
  STAR: {
    label:       'SEARCH.STAR_FILTER',
    description: 'SEARCH.STAR_FILTER_TXT',
    prompt:      'SEARCH.STAR_FILTER_RANGE',
    note:        'SEARCH.STAR_NOTE',
  },
  DOSHAM: {
    label:       'SEARCH.DOSHAM_FILTER',
    description: 'SEARCH.DOSHAM_FILTER_TXT',
    prompt:      'SEARCH.DOSHAM_FILTER_RANGE',
    note:        'SEARCH.DOSHAM_NOTE',
  },
  EDUCATION: {
    label:       'SEARCH.EDUCATION_FILTER',
    description: 'SEARCH.EDUCATION_FILTER_TXT',
    prompt:      'SEARCH.EDUCATION_FILTER_RANGE',
    note:        'SEARCH.EDUCATION_NOTE',
  },
  OCCUPATION: {
    label:       'SEARCH.OCCUPATION_FILTER',
    description: 'SEARCH.OCCUPATION_FILTER_TXT',
    prompt:      'SEARCH.OCCUPATION_FILTER_RANGE',
    note:        'SEARCH.OCCUPATION_NOTE',
  },
  MONTHLYINCOME: {
    label:       'SEARCH.INCOME_FILTER',
    description: 'SEARCH.INCOME_FILTER_TXT',
    prompt:      'SEARCH.INCOME_FILTER_RANGE',
    note:        'SEARCH.INCOME_NOTE',
  },
  LOCATION: {
    label:       'SEARCH.LOCATION_FILTER',
    description: 'SEARCH.LOCATION_FILTER_TXT',
    prompt:      'SEARCH.LOCATION_FILTER_RANGE',
    note:        'SEARCH.LOCATION_NOTE',
  },
  MOTHERTONGUE: {
    label:       'SEARCH.MOTHER_TONGUE_FILTER',
    description: 'SEARCH.MOTHER_TONGUE_FILTER_TXT',
    prompt:      'SEARCH.MOTHER_TONGUE_FILTER_RANGE',
    note:        'SEARCH.MOTHERTONGUE_NOTE',
  },
  CASTE: {
    label:       'SEARCH.CASTE_FILTER',
    description: 'SEARCH.CASTE_FILTER_TXT',
    prompt:      'SEARCH.CASTE_FILTER_RANGE',
    note:        'SEARCH.CASTE_NOTE',
  },
  PHYSICALSTATUS: {
    label:       'SEARCH.PHYSICAL_STATUS_FILTER',
    description: 'SEARCH.PHYSICAL_STATUS_FILTER_TXT',
    prompt:      'SEARCH.PHYSICAL_STATUS_FILTER_RANGE',
    note:        'SEARCH.PHYSICAL_STATUS_NOTE',
  },
  EATINGHABITS: {
    label:       'SEARCH.EATING_HABITS_FILTER',
    description: 'SEARCH.EATING_HABITS_FILTER_TXT',
    prompt:      'SEARCH.EATING_HABITS_FILTER_RANGE',
    note:        'SEARCH.EATING_HABITS_NOTE',
  },
  // Filter-mode-only field, never part of Partner Preferences' strict set —
  // kept only so this Record<FieldKey, ...> stays exhaustive over SearchScreen's
  // full FieldKey union; never rendered (not in STRICT_FIELD_ORDER).
  PROFILECREATED: {
    label:       '',
    description: '',
    prompt:      '',
    note:        '',
  },
}
