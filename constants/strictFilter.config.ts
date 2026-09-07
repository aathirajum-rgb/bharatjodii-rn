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
export const STRICT_FILTERS_TITLE = 'Strict filters'
export const STRICT_FILTERS_NOTE  = 'By turning on strict filters, you will only see matches that exactly meet your specified preferences'
export const MANAGE_FILTER_CTA    = 'Manage Strict Filters'
export const FILTER_CTA_NOTE      = '(This might reduce your matches)'

// Angular en.json: MATCH_REDUCED, with #OLDCOUNT#/#NEWCOUNT# placeholders.
export function matchReducedText(oldCount: number, newCount: number): string {
  return `Matches reduced ${oldCount.toLocaleString('en-IN')} to ${newCount.toLocaleString('en-IN')}`
}

// Range-style fields use "between {label} range {value}" wording; every
// other field uses "matching your selected {label} ({value})" — same split
// STRICT_FIELD_COPY's own description/note text already uses.
const RANGE_FIELDS = new Set<FieldKey>(['AGE', 'HEIGHT', 'MONTHLYINCOME'])

// Angular en.json's per-field `{FIELD}_FILTER_RANGE` key — e.g. AGE_FILTER_RANGE:
// "Turn on strict age filter to view and get contacted only by matches between
// age range #AGERANGE#". Shown only while the toggle is OFF, with the field's
// live current value substituted in place of Angular's #AGERANGE#-style token.
export function strictPromptText(key: FieldKey, label: string, value: string): string {
  const lower = label.toLowerCase()
  return RANGE_FIELDS.has(key)
    ? `Turn on strict ${lower} filter to view and get contacted only by matches between ${lower} range ${value}`
    : `Turn on strict ${lower} filter to view and get contacted only by matches matching ${value}`
}

export interface StrictFieldCopy {
  label:       string   // e.g. "Strict age filter"
  description: string   // short one-liner shown in the manage-list row
  note:        string   // consequence warning shown when the toggle is ON
}

// Angular's per-field i18n key pattern is `{FIELD}_FILTER` / `{FIELD}_FILTER_TXT`
// / `{FIELD}_NOTE` for every one of the 14 fields — same shape, reused here as
// one data-driven map instead of 14 near-identical string constants. Age's
// wording is Angular's real captured string; the rest follow the exact same
// template Angular uses field-to-field (confirmed pattern, not per-field
// verbatim capture for every one of the 14 — safe since Angular itself just
// substitutes the field name into this same sentence shape).
export const STRICT_FIELD_COPY: Record<FieldKey, StrictFieldCopy> = {
  AGE: {
    label:       'Strict age filter',
    description: 'See matches strictly within the specified age range',
    note:        'Matches outside this age range will not be able to see your profile. You might miss some good matches because of this.',
  },
  HEIGHT: {
    label:       'Strict height filter',
    description: 'See matches strictly within the specified height range',
    note:        'Matches outside this height range will not be able to see your profile. You might miss some good matches because of this.',
  },
  MARITALSTATUS: {
    label:       'Strict marital status filter',
    description: 'See matches strictly matching your selected marital status',
    note:        'Matches with a different marital status will not be able to see your profile. You might miss some good matches because of this.',
  },
  RELIGION: {
    label:       'Strict religion filter',
    description: 'See matches strictly matching your selected religion',
    note:        'Matches of a different religion will not be able to see your profile. You might miss some good matches because of this.',
  },
  STAR: {
    label:       'Strict star filter',
    description: 'See matches strictly matching your selected star',
    note:        'Matches with a different star will not be able to see your profile. You might miss some good matches because of this.',
  },
  DOSHAM: {
    label:       'Strict dosham filter',
    description: 'See matches strictly matching your selected dosham',
    note:        'Matches with a different dosham will not be able to see your profile. You might miss some good matches because of this.',
  },
  EDUCATION: {
    label:       'Strict education filter',
    description: 'See matches strictly matching your selected education',
    note:        'Matches with a different education will not be able to see your profile. You might miss some good matches because of this.',
  },
  OCCUPATION: {
    label:       'Strict occupation filter',
    description: 'See matches strictly matching your selected occupation',
    note:        'Matches with a different occupation will not be able to see your profile. You might miss some good matches because of this.',
  },
  MONTHLYINCOME: {
    label:       'Strict income filter',
    description: 'See matches strictly within the specified income range',
    note:        'Matches outside this income range will not be able to see your profile. You might miss some good matches because of this.',
  },
  LOCATION: {
    label:       'Strict location filter',
    description: 'See matches strictly matching your selected location',
    note:        'Matches outside this location will not be able to see your profile. You might miss some good matches because of this.',
  },
  MOTHERTONGUE: {
    label:       'Strict mother tongue filter',
    description: 'See matches strictly matching your selected mother tongue',
    note:        'Matches with a different mother tongue will not be able to see your profile. You might miss some good matches because of this.',
  },
  CASTE: {
    label:       'Strict caste filter',
    description: 'See matches strictly matching your selected caste',
    note:        'Matches with a different caste will not be able to see your profile. You might miss some good matches because of this.',
  },
  PHYSICALSTATUS: {
    label:       'Strict physical status filter',
    description: 'See matches strictly matching your selected physical status',
    note:        'Matches with a different physical status will not be able to see your profile. You might miss some good matches because of this.',
  },
  EATINGHABITS: {
    label:       'Strict eating habits filter',
    description: 'See matches strictly matching your selected eating habits',
    note:        'Matches with different eating habits will not be able to see your profile. You might miss some good matches because of this.',
  },
  // Filter-mode-only field, never part of Partner Preferences' strict set —
  // kept only so this Record<FieldKey, ...> stays exhaustive over SearchScreen's
  // full FieldKey union; never rendered (not in STRICT_FIELD_ORDER).
  PROFILECREATED: {
    label:       '',
    description: '',
    note:        '',
  },
}
