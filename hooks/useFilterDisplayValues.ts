// Resolves the user's saved search/partner-preference selections (filterService's
// AsyncStorage-only SELECTED_NEWPP object — raw option CODES, e.g. CASTE:['12']) into
// human-readable display strings + an "active" (differs-from-default) flag per field,
// for the desktop Matches sidebar (Figma "Jodii Desktop" node 1151:17450).
//
// SearchScreen.tsx already has this same code->label resolution (its `rowValue`
// useMemo + `labelsFor` helper), but fetches each field's option list LAZILY, only
// when the user opens that field's own editor — reasonable there since editing needs
// the full option list anyway. This hook is read-only display, so it mirrors that
// same lazy-only-when-non-default approach instead (skip the fetch entirely for any
// field still at its default, which is the common case), rather than eagerly
// fetching all ~13 option lists on every sidebar mount.
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSelectedObject, DEFAULT_FILTER } from '../service/filterService'
import { getItem } from '../service/storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { isAnySelection, resolveFilterLabel, type FilterOption } from '../adapters/filterPreference.adapter'
import {
  fetchReligionOptions, fetchCasteOptions, fetchDivisionOptions,
  fetchRaasiOptions, fetchStarOptions, fetchDoshamOptions,
  fetchOccupationOptions, fetchQualificationOptions, fetchMonthlyIncomeOptions,
  fetchMotherTongueOptions, fetchMaritalStatusOptions, fetchEatingHabitOptions,
  fetchPhysicalStatusOptions, fetchExactHeightOptions,
  fetchStates, fetchCities,
} from '../service/registrationService'

export type FilterFieldKey =
  | 'AGE' | 'LOCATION' | 'RELIGION' | 'CASTE' | 'STAR' | 'DOSHAM' | 'OCCUPATION'
  | 'MONTHLYINCOME' | 'EDUCATION' | 'HEIGHT' | 'MOTHERTONGUE' | 'MARITALSTATUS'
  | 'EATINGHABITS' | 'PHYSICALSTATUS' | 'PROFILECREATED'

type Opt = FilterOption

export interface FilterDisplayResult {
  values: Record<FilterFieldKey, string>
  active: Record<FilterFieldKey, boolean>
}

// isAnySelection()/resolveFilterLabel() — shared with SearchScreen.tsx's own
// code->label resolution via adapters/filterPreference.adapter.ts.
const isAny = isAnySelection

// Returns [result, reload] — reload lets the caller force a refetch (e.g. via
// useFocusEffect) after the user comes back from editing preferences in
// SearchScreen, since this hook only reads AsyncStorage once per mount otherwise.
export function useFilterDisplayValues(): [FilterDisplayResult | null, () => void] {
  const { t } = useTranslation()
  const [result, setResult] = useState<FilterDisplayResult | null>(null)

  const load = useCallback(async () => {
    const ANY = t('SEARCH.ANY')
    const empty: Opt[] = []

    function labelsFor(opts: Opt[], keys: any): string {
      return resolveFilterLabel(opts, keys, ANY)
    }

    const [selected, gender] = await Promise.all([
      getSelectedObject(),
      getItem(SK.User.LOGIN_GENDER),
    ])

    // Religion '2' is CHRISTIAN — search.component.ts:100 ("For christian the
    // division field is filled from the caste list") and CasteScreen.tsx's
    // `isChristian = religion === '2'`. Previously named isIslam here, which
    // mislabelled the branch (the behaviour it drove was already right).
    // Caste/division only resolve under ONE religion: a multi-religion
    // selection has neither, matching SearchScreen's own row-visibility rule.
    const religionKeys   = (selected.RELIGION ?? []).filter((k: string) => k && k !== '0')
    const singleReligion = religionKeys.length === 1 ? religionKeys[0] : null
    const religion       = singleReligion ?? '0'
    const isChristian    = singleReligion === '2'
    const casteKeys      = singleReligion === null ? [] : (isChristian ? selected.DIVISION : selected.CASTE)

    const [
      religionOpts, casteOpts, occupationOpts, incomeOpts, educationOpts,
      motherTongueOpts, maritalOpts, eatingHabitOpts, physicalOpts, stateOpts, cityOpts,
      heightOpts, starOpts, doshamOpts,
    ] = await Promise.all([
      isAny(selected.RELIGION) ? empty : fetchReligionOptions(),
      isAny(casteKeys) ? empty : (isChristian ? fetchDivisionOptions() : fetchCasteOptions(religion, selected.MOTHERTONGUE?.[0] ?? '')),
      isAny(selected.OCCUPATION) ? empty : fetchOccupationOptions(),
      isAny(selected.MONTHLYINCOME) ? empty : fetchMonthlyIncomeOptions(),
      isAny(selected.EDUCATION) ? empty : fetchQualificationOptions(),
      isAny(selected.MOTHERTONGUE) ? empty : fetchMotherTongueOptions(),
      isAny(selected.MARITALSTATUS) ? empty : fetchMaritalStatusOptions(gender ?? '1'),
      isAny(selected.EATINGHABITS) ? empty : fetchEatingHabitOptions(),
      isAny(selected.PHYSICALSTATUS) ? empty : fetchPhysicalStatusOptions(),
      isAny(selected.STATE) ? empty : fetchStates(),
      (isAny(selected.STATE) || isAny(selected.CITY)) ? empty : fetchCities(selected.STATE[0]),
      (selected.STARTHEIGHT?.[0] === DEFAULT_FILTER.STARTHEIGHT[0] && selected.ENDHEIGHT?.[0] === DEFAULT_FILTER.ENDHEIGHT[0])
        ? empty : fetchExactHeightOptions(gender ?? '1'),
      // STAR codes aren't grouped by raasi in storage, so resolving a real
      // selection means checking every raasi's own star list — Angular's UI
      // itself is a raasi->star tree, so a saved STAR code can't be resolved
      // without it. Only paid for when STAR actually differs from "Any".
      isAny(selected.STAR) ? empty : fetchRaasiOptions().then(raasis =>
        Promise.all(raasis.map(r => fetchStarOptions(r.key))).then(groups => groups.flat())),
      isAny(selected.DOSHAM) ? empty
        : fetchDoshamOptions(selected.STAR?.[0] ?? '', '', selected.MOTHERTONGUE?.[0]).then(r => r.dosham),
    ])

    const locationLabel = !isAny(selected.CITY)
      ? labelsFor(cityOpts, selected.CITY)
      : labelsFor(stateOpts, selected.STATE)

    const heightIsAny = selected.STARTHEIGHT?.[0] === DEFAULT_FILTER.STARTHEIGHT[0]
      && selected.ENDHEIGHT?.[0] === DEFAULT_FILTER.ENDHEIGHT[0]
    const heightLabel = heightIsAny
      ? ANY
      : `${labelsFor(heightOpts, selected.STARTHEIGHT)} - ${labelsFor(heightOpts, selected.ENDHEIGHT)}`

    const ageIsAny = selected.STARTAGE === DEFAULT_FILTER.STARTAGE && selected.ENDAGE === DEFAULT_FILTER.ENDAGE
    const profileCreatedIsYes = !!selected.PROFILECREATED?.[0] && selected.PROFILECREATED[0] !== '0'

    setResult({
      values: {
        AGE:            `${selected.STARTAGE ?? DEFAULT_FILTER.STARTAGE}-${selected.ENDAGE ?? DEFAULT_FILTER.ENDAGE} years`,
        LOCATION:       locationLabel,
        RELIGION:       labelsFor(religionOpts, selected.RELIGION),
        CASTE:          labelsFor(casteOpts, casteKeys),
        STAR:           labelsFor(starOpts, selected.STAR),
        DOSHAM:         labelsFor(doshamOpts, selected.DOSHAM),
        OCCUPATION:     labelsFor(occupationOpts, selected.OCCUPATION),
        MONTHLYINCOME:  labelsFor(incomeOpts, selected.MONTHLYINCOME),
        EDUCATION:      labelsFor(educationOpts, selected.EDUCATION),
        HEIGHT:         heightLabel,
        MOTHERTONGUE:   labelsFor(motherTongueOpts, selected.MOTHERTONGUE),
        MARITALSTATUS:  labelsFor(maritalOpts, selected.MARITALSTATUS),
        EATINGHABITS:   labelsFor(eatingHabitOpts, selected.EATINGHABITS),
        PHYSICALSTATUS: labelsFor(physicalOpts, selected.PHYSICALSTATUS),
        PROFILECREATED: profileCreatedIsYes ? t('GENERAL.YES') : ANY,
      },
      active: {
        AGE:            !ageIsAny,
        LOCATION:       !isAny(selected.STATE) || !isAny(selected.CITY),
        RELIGION:       !isAny(selected.RELIGION),
        CASTE:          !isAny(casteKeys),
        STAR:           !isAny(selected.STAR),
        DOSHAM:         !isAny(selected.DOSHAM),
        OCCUPATION:     !isAny(selected.OCCUPATION),
        MONTHLYINCOME:  !isAny(selected.MONTHLYINCOME),
        EDUCATION:      !isAny(selected.EDUCATION),
        HEIGHT:         !heightIsAny,
        MOTHERTONGUE:   !isAny(selected.MOTHERTONGUE),
        MARITALSTATUS:  !isAny(selected.MARITALSTATUS),
        EATINGHABITS:   !isAny(selected.EATINGHABITS),
        PHYSICALSTATUS: !isAny(selected.PHYSICALSTATUS),
        PROFILECREATED: profileCreatedIsYes,
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  useEffect(() => {
    load().catch(() => {})
  }, [load])

  // Memoized (not a fresh arrow function per call) — MatchesFilterSidebar.tsx
  // feeds this into useFocusEffect(useCallback(..., [reload])); an unstable
  // reference there made that effect re-fire on every render (since its own
  // dependency kept "changing"), each firing calling reload() -> setResult()
  // -> re-render -> new reference again — an infinite loop that pegged the JS
  // thread busy and made clicks anywhere on screen stop registering.
  const reload = useCallback(() => { load().catch(() => {}) }, [load])

  return [result, reload]
}
