// Angular equivalent: pages/search/search.component.ts + filter-popup.component.ts
// + filter/filter.component.ts (the single shared field-editor machinery for both
// "Filters" (quick/temporary) mode and "Partner preferences" (PP) mode).
//
// Known simplifications vs Angular (documented, not silent):
//  - LOCATION is State→City only (Country fixed to India), matching the same
//    simplification onboarding's LocationScreen already makes app-wide.
//  - CASTE stops at Caste (no Subcaste/Gothra sub-cascade) — those are rarely
//    changed post-onboarding and add a lot of UI for a rarely-touched facet.
//  - STAR is Raasi (single) → Star (multi), a simplified stand-in for Angular's
//    grouped parent/child checkbox tree.
//  - AGE/HEIGHT are bounded single-value Min/Max pickers (not Angular's grouped
//    side-panel lists), reusing the existing SearchablePicker component.
//  - MONTHLYINCOME is a flat multi-select bracket list — Angular's nested
//    "custom range" sub-picker isn't ported.
//  - PROFILECREATED/PHOTOAVAILABLE/HOROSCOPEAVAILABLE (Filter-mode-only) are
//    simple on/off toggle rows, not Angular's dedicated bracket lists.

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
import { fetchSearchResults } from '../../service/homeService'
import {
  getSelectedObject, saveFilterState, getSearchPPCheckBox,
  getFilterEventType, resetFilter, buildSearchParams, DEFAULT_FILTER,
} from '../../service/filterService'
import {
  fetchReligionOptions, fetchCasteOptions, fetchDivisionOptions,
  fetchRaasiOptions, fetchStarOptions, fetchDoshamOptions,
  fetchOccupationOptions, fetchQualificationOptions, fetchMonthlyIncomeOptions,
  fetchMotherTongueOptions, fetchMaritalStatusOptions, fetchEatingHabitOptions,
  fetchPhysicalStatusOptions, fetchExactHeightOptions,
  fetchStates, fetchCities,
} from '../../service/registrationService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'
import MultiSelectPicker, { type MultiSelectOption } from '../../components/multi-select-picker/MultiSelectPicker'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const ICON_BACK  = CDN_REACT + '/menu_back_arrow.svg'
const ICON_ARROW = CDN_REACT + '/menu_right_arrow.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any }

type FieldKey =
  | 'AGE' | 'LOCATION' | 'RELIGION' | 'CASTE' | 'STAR' | 'DOSHAM' | 'OCCUPATION'
  | 'MONTHLYINCOME' | 'EDUCATION' | 'HEIGHT' | 'MOTHERTONGUE' | 'MARITALSTATUS'
  | 'EATINGHABITS' | 'PHYSICALSTATUS' | 'PROFILECREATED'

// Multi-select fields sharing one generic checkbox-list editor.
const SIMPLE_MULTI_FIELDS = new Set<FieldKey>([
  'RELIGION', 'DOSHAM', 'OCCUPATION', 'MONTHLYINCOME', 'EDUCATION',
  'MOTHERTONGUE', 'MARITALSTATUS', 'EATINGHABITS', 'PHYSICALSTATUS',
])

const AGE_OPTIONS: PickerOption[] = Array.from({ length: 53 }, (_, i) => {
  const age = 18 + i
  return { key: String(age), label: `${age} yrs` }
})

// ─── SearchScreen ─────────────────────────────────────────────────────────────

export default function SearchScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [loading,    setLoading]    = useState(true)
  const [eventType,  setEventType]  = useState<'filter' | 'pp'>('pp')
  const [selected,   setSelected]   = useState<Record<string, any>>(DEFAULT_FILTER)
  const [ppCheckBox, setPpCheckBox] = useState<string[]>([])
  const [religion,   setReligion]   = useState('0')
  const [gender,     setGender]     = useState('1')
  const [matriId,    setMatriId]    = useState('')

  const [matchCount,   setMatchCount]   = useState(0)
  const [countLoading, setCountLoading] = useState(false)

  // key -> {key,label}[] cache, populated the first time a field's options are
  // fetched — used both to render the picker and to resolve display labels.
  const [labelCache, setLabelCache] = useState<Record<string, MultiSelectOption[]>>({})

  const [ageEditor,    setAgeEditor]    = useState<'min' | 'max' | null>(null)
  const [heightEditor, setHeightEditor] = useState<'min' | 'max' | null>(null)
  const [locationStep, setLocationStep] = useState<'state' | 'city' | null>(null)
  const [starStep,     setStarStep]     = useState<'raasi' | 'star' | null>(null)
  const [multiEditor,  setMultiEditor]  = useState<FieldKey | null>(null)
  const [heightOptions, setHeightOptions] = useState<PickerOption[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const [obj, pp, evType, id, gen] = await Promise.all([
        getSelectedObject(),
        getSearchPPCheckBox(),
        getFilterEventType(),
        getItem(SK.Auth.USER_ID),
        getItem(SK.User.LOGIN_GENDER),
      ])
      setSelected(obj)
      setPpCheckBox(pp)
      setEventType(evType)
      setMatriId(id ?? '')
      setGender(gen ?? '1')
      setReligion(obj.RELIGION?.[0] ?? '0')
      setLoading(false)
    })()
  }, [])

  // ── Live match-count preview ─────────────────────────────────────────────
  // Angular: search.component.ts getMatchesCount() — re-fires on every field edit.

  useEffect(() => {
    if (loading || !matriId) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setCountLoading(true)
      try {
        await saveFilterState(selected, ppCheckBox, {})
        const params = await buildSearchParams(matriId, 0, 1)
        const res = await fetchSearchResults(params)
        setMatchCount(res.totalCount)
      } catch {
        // keep last known count on failure
      } finally {
        setCountLoading(false)
      }
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, ppCheckBox, loading, matriId])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function updateField(key: string, value: any) {
    setSelected(prev => ({ ...prev, [key]: value }))
  }

  async function ensureOptions(key: string, loader: () => Promise<MultiSelectOption[]>) {
    if (labelCache[key]) return labelCache[key]
    const opts = await loader()
    setLabelCache(prev => ({ ...prev, [key]: opts }))
    return opts
  }

  function labelsFor(key: string, keys: string[]): string {
    if (!keys || keys.length === 0 || keys[0] === '0') return t('SEARCH.ANY')
    const opts = labelCache[key] ?? []
    const labels = keys.map(k => opts.find(o => o.key === k)?.label ?? k)
    return labels.length > 0 ? labels.join(', ') : t('SEARCH.ANY')
  }

  // ── Row value display ────────────────────────────────────────────────────

  const isIslam = religion === '2'

  const rowValue = useMemo(() => {
    return {
      AGE:            `${selected.STARTAGE ?? '18'} - ${selected.ENDAGE ?? '50'} ${t('SEARCH.ANY') === 'Any' ? 'yrs' : ''}`.trim(),
      LOCATION:       labelsFor('CITY', selected.CITY ?? []) !== t('SEARCH.ANY')
                        ? labelsFor('CITY', selected.CITY ?? [])
                        : labelsFor('STATE', selected.STATE ?? []),
      RELIGION:       labelsFor('RELIGION', selected.RELIGION ?? []),
      CASTE:          isIslam ? labelsFor('DIVISION', selected.DIVISION ?? []) : labelsFor('CASTE', selected.CASTE ?? []),
      STAR:           labelsFor('STAR', selected.STAR ?? []),
      DOSHAM:         labelsFor('DOSHAM', selected.DOSHAM ?? []),
      OCCUPATION:     labelsFor('OCCUPATION', selected.OCCUPATION ?? []),
      MONTHLYINCOME:  labelsFor('MONTHLYINCOME', selected.MONTHLYINCOME ?? []),
      EDUCATION:      labelsFor('EDUCATION', selected.EDUCATION ?? []),
      HEIGHT:         (selected.STARTHEIGHT?.[0] && selected.ENDHEIGHT?.[0])
                        ? `${labelsFor('HEIGHT', selected.STARTHEIGHT)} - ${labelsFor('HEIGHT', selected.ENDHEIGHT)}`
                        : t('SEARCH.ANY'),
      MOTHERTONGUE:   labelsFor('MOTHERTONGUE', selected.MOTHERTONGUE ?? []),
      MARITALSTATUS:  labelsFor('MARITALSTATUS', selected.MARITALSTATUS ?? []),
      EATINGHABITS:   labelsFor('EATINGHABITS', selected.EATINGHABITS ?? []),
      PHYSICALSTATUS: labelsFor('PHYSICALSTATUS', selected.PHYSICALSTATUS ?? []),
      PROFILECREATED: (selected.PROFILECREATED?.[0] && selected.PROFILECREATED[0] !== '0') ? t('GENERAL.YES') : t('SEARCH.ANY'),
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [selected, labelCache, isIslam])

  // ── Field open handlers ──────────────────────────────────────────────────

  async function openSimpleMulti(key: FieldKey) {
    let opts: MultiSelectOption[] = []
    switch (key) {
      case 'RELIGION':       opts = await ensureOptions('RELIGION', fetchReligionOptions); break
      case 'DOSHAM':         opts = await ensureOptions('DOSHAM', async () => (await fetchDoshamOptions(selected.STAR?.[0] ?? '', '', selected.MOTHERTONGUE?.[0])).dosham); break
      case 'OCCUPATION':     opts = await ensureOptions('OCCUPATION', fetchOccupationOptions); break
      case 'MONTHLYINCOME':  opts = await ensureOptions('MONTHLYINCOME', fetchMonthlyIncomeOptions); break
      case 'EDUCATION':      opts = await ensureOptions('EDUCATION', fetchQualificationOptions); break
      case 'MOTHERTONGUE':   opts = await ensureOptions('MOTHERTONGUE', fetchMotherTongueOptions); break
      case 'MARITALSTATUS':  opts = await ensureOptions('MARITALSTATUS', () => fetchMaritalStatusOptions(gender)); break
      case 'EATINGHABITS':   opts = await ensureOptions('EATINGHABITS', fetchEatingHabitOptions); break
      case 'PHYSICALSTATUS': opts = await ensureOptions('PHYSICALSTATUS', fetchPhysicalStatusOptions); break
      default: break
    }
    if (opts.length === 0) return
    setMultiEditor(key)
  }

  async function openCaste() {
    const key = isIslam ? 'DIVISION' : 'CASTE'
    const opts = isIslam
      ? await ensureOptions('DIVISION', fetchDivisionOptions)
      : await ensureOptions('CASTE', () => fetchCasteOptions(religion, selected.MOTHERTONGUE?.[0] ?? ''))
    if (opts.length === 0) return
    setMultiEditor(key as FieldKey)
  }

  async function openLocation() {
    await ensureOptions('STATE', fetchStates)
    setLocationStep('state')
  }

  async function openStar() {
    await ensureOptions('RAASI', fetchRaasiOptions)
    setStarStep('raasi')
  }

  async function openHeight(bound: 'min' | 'max') {
    const opts = await ensureOptions('HEIGHT', () => fetchExactHeightOptions(gender))
    setHeightOptions(opts.map(o => ({ key: o.key, label: o.label.replace(/<[^>]+>/g, '') })))
    setHeightEditor(bound)
  }

  function fieldRowPress(key: FieldKey) {
    if (key === 'AGE') { setAgeEditor('min'); return }
    if (key === 'HEIGHT') { openHeight('min'); return }
    if (key === 'LOCATION') { openLocation(); return }
    if (key === 'STAR') { openStar(); return }
    if (key === 'CASTE') { openCaste(); return }
    if (key === 'PROFILECREATED') {
      const cur = selected.PROFILECREATED?.[0] === '1'
      updateField('PROFILECREATED', cur ? ['0'] : ['1'])
      return
    }
    if (SIMPLE_MULTI_FIELDS.has(key)) { openSimpleMulti(key); return }
  }

  // ── Reset / Apply ─────────────────────────────────────────────────────────

  async function handleReset() {
    await resetFilter('filter')
    const obj = { ...DEFAULT_FILTER }
    setSelected(obj)
    setPpCheckBox([])
    setLabelCache({})
  }

  async function handleShowMatches() {
    await saveFilterState(selected, ppCheckBox, {})
    const params = await buildSearchParams(matriId, 0, 20)
    navigation.navigate('Matches', { searchParams: params })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[s.screen, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
      </View>
    )
  }

  const rows: Array<{ key: FieldKey; label: string; hidden?: boolean }> = [
    { key: 'AGE',            label: t('FILTER.AGE') },
    { key: 'LOCATION',       label: t('FILTER.LOCATION') },
    { key: 'RELIGION',       label: t('FILTER.RELIGION') },
    { key: 'CASTE',          label: isIslam ? t('FILTER.DIVISION') : t('FILTER.CASTE') },
    { key: 'STAR',           label: t('FILTER.STAR') },
    { key: 'DOSHAM',         label: t('FILTER.DOSHAM') },
    { key: 'OCCUPATION',     label: t('FILTER.OCCUPATION') },
    { key: 'MONTHLYINCOME',  label: t('FILTER.MONTHLYINCOME'), hidden: gender === '1' },
    { key: 'EDUCATION',      label: t('FILTER.EDUCATION') },
    { key: 'HEIGHT',         label: t('FILTER.HEIGHT') },
    { key: 'MOTHERTONGUE',   label: t('FILTER.MOTHERTONGUE') },
    { key: 'MARITALSTATUS',  label: t('FILTER.MARITALSTATUS') },
    { key: 'EATINGHABITS',   label: t('FILTER.EATINGHABITS') },
    { key: 'PHYSICALSTATUS', label: t('FILTER.PHYSICALSTATUS') },
    { key: 'PROFILECREATED', label: t('FILTER.PROFILECREATED'), hidden: eventType !== 'filter' },
  ]

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle}>
          {eventType === 'filter' ? t('FILTER.FILTER_HEADER') : t('FILTER.PP_HEADER')}
        </Text>
        {eventType === 'filter' && (
          <Pressable onPress={handleReset} hitSlop={8}>
            <Text style={s.resetText}>{t('FILTER.RESET_HEADER')}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView style={s.flex1} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {eventType !== 'filter' && (
          <Text style={s.subHeader}>{t('FILTER.FILTER_SUB_HEADER')}</Text>
        )}

        <View style={s.card}>
          {rows.filter(r => !r.hidden).map((row, i, arr) => (
            <View key={row.key}>
              <Pressable
                style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                onPress={() => fieldRowPress(row.key)}
                accessibilityRole="button"
              >
                <View style={s.rowText}>
                  <Text style={s.rowLabel}>{row.label}</Text>
                  <Text style={s.rowValue} numberOfLines={1}>{(rowValue as any)[row.key]}</Text>
                </View>
                {row.key === 'PROFILECREATED' ? (
                  <View style={[s.toggle, selected.PROFILECREATED?.[0] === '1' && s.toggleOn]} />
                ) : (
                  <CdnSvg uri={ICON_ARROW} width={16} height={16} />
                )}
              </Pressable>
              {i < arr.length - 1 && <View style={s.rowDivider} />}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={s.applyBtn} onPress={handleShowMatches} disabled={countLoading}>
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

      {/* ── AGE: bounded min/max via SearchablePicker ── */}
      <SearchablePicker
        visible={ageEditor === 'min'}
        title={t('FILTER.LBL_MIN_AGE')}
        placeholder={t('FILTER.PLACEHOLDER_MIN_AGE')}
        options={AGE_OPTIONS.filter(o => Number(o.key) < Number(selected.ENDAGE ?? 50))}
        selectedKey={selected.STARTAGE}
        onSelect={opt => { updateField('STARTAGE', opt.key); setAgeEditor('max') }}
        onClose={() => setAgeEditor(null)}
      />
      <SearchablePicker
        visible={ageEditor === 'max'}
        title={t('FILTER.LBL_MAX_AGE')}
        placeholder={t('FILTER.PLACEHOLDER_MAX_AGE')}
        options={AGE_OPTIONS.filter(o => Number(o.key) > Number(selected.STARTAGE ?? 18))}
        selectedKey={selected.ENDAGE}
        onSelect={opt => { updateField('ENDAGE', opt.key); setAgeEditor(null) }}
        onClose={() => setAgeEditor(null)}
      />

      {/* ── HEIGHT: bounded min/max via SearchablePicker ── */}
      <SearchablePicker
        visible={heightEditor === 'min'}
        title={t('FILTER.LBL_MIN_HEIGHT')}
        placeholder={t('FILTER.PLACEHOLDER_MIN_HEIGHT')}
        options={heightOptions}
        selectedKey={selected.STARTHEIGHT?.[0]}
        onSelect={opt => { updateField('STARTHEIGHT', [opt.key]); openHeight('max') }}
        onClose={() => setHeightEditor(null)}
      />
      <SearchablePicker
        visible={heightEditor === 'max'}
        title={t('FILTER.LBL_MAX_HEIGHT')}
        placeholder={t('FILTER.PLACEHOLDER_MAX_HEIGHT')}
        options={heightOptions}
        selectedKey={selected.ENDHEIGHT?.[0]}
        onSelect={opt => { updateField('ENDHEIGHT', [opt.key]); setHeightEditor(null) }}
        onClose={() => setHeightEditor(null)}
      />

      {/* ── LOCATION: State → City ── */}
      <SearchablePicker
        visible={locationStep === 'state'}
        title={t('FILTER.SELECT_STATE')}
        placeholder={t('FILTER.SEARCH_STATE')}
        options={(labelCache.STATE ?? []).map(o => ({ key: o.key, label: o.label }))}
        selectedKey={selected.STATE?.[0]}
        onSelect={async opt => {
          updateField('STATE', [opt.key])
          updateField('CITY', ['0'])
          const cities = await ensureOptions('CITY', () => fetchCities(opt.key))
          setLabelCache(prev => ({ ...prev, CITY: cities }))
          setLocationStep('city')
        }}
        onClose={() => setLocationStep(null)}
      />
      <MultiSelectPicker
        visible={locationStep === 'city'}
        title={t('FILTER.SELECT_CITY')}
        placeholder={t('FILTER.SEARCH_CITY')}
        options={labelCache.CITY ?? []}
        selectedKeys={selected.CITY ?? ['0']}
        anyLabel={t('SEARCH.ANY')}
        onApply={keys => updateField('CITY', keys)}
        onClose={() => setLocationStep(null)}
      />

      {/* ── STAR: Raasi → Star ── */}
      <SearchablePicker
        visible={starStep === 'raasi'}
        title={t('FILTER.SUBTITLE_STAR')}
        placeholder=""
        options={labelCache.RAASI ?? []}
        selectedKey={undefined}
        onSelect={async opt => {
          const stars = await ensureOptions(`STAR_${opt.key}`, () => fetchStarOptions(opt.key))
          setLabelCache(prev => ({ ...prev, STAR: stars }))
          setStarStep('star')
        }}
        onClose={() => setStarStep(null)}
      />
      <MultiSelectPicker
        visible={starStep === 'star'}
        title={t('FILTER.SELECT_STAR')}
        placeholder={t('FILTER.SEARCH_STAR')}
        options={labelCache.STAR ?? []}
        selectedKeys={selected.STAR ?? ['0']}
        anyLabel={t('SEARCH.ANY')}
        onApply={keys => updateField('STAR', keys)}
        onClose={() => setStarStep(null)}
      />

      {/* ── Generic multi-select fields (Religion, Caste/Division, Dosham, Occupation,
           Income, Education, Mother Tongue, Marital Status, Eating Habits, Physical Status) ── */}
      {multiEditor && (
        <MultiSelectPicker
          visible={!!multiEditor}
          title={t(`FILTER.${multiEditor}` as any)}
          placeholder={multiEditor === 'RELIGION' ? t('FILTER.SEARCH_RELIGION')
            : multiEditor === 'CASTE' ? t('FILTER.SEARCH_CASTE')
            : multiEditor === 'MOTHERTONGUE' ? t('FILTER.SEARCH_MOTHERTONGUE')
            : undefined}
          options={labelCache[multiEditor] ?? []}
          selectedKeys={selected[multiEditor] ?? ['0']}
          anyLabel={t('SEARCH.ANY')}
          onApply={keys => {
            updateField(multiEditor, keys)
            if (multiEditor === 'RELIGION') {
              setReligion(keys[0] ?? '0')
              // Religion changed — stale caste/subcaste cache must be dropped.
              updateField('CASTE', ['0'])
              updateField('DIVISION', ['0'])
              setLabelCache(prev => { const n = { ...prev }; delete n.CASTE; delete n.DIVISION; return n })
            }
          }}
          onClose={() => setMultiEditor(null)}
        />
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1F3FB' },
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
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: '#333333', marginLeft: 6 },
  resetText: { fontSize: 14, fontWeight: '600', color: Colors.primaryDark, paddingHorizontal: 12 },

  scrollContent: { padding: 16, gap: 12 },
  subHeader: { fontSize: 14, color: Colors.textSecondary, marginBottom: 4 },

  card: { backgroundColor: Colors.white, borderRadius: 12, overflow: 'hidden' },

  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               12,
  },
  rowPressed: { opacity: 0.6 },
  rowText:  { flex: 1 },
  rowLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  rowValue: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  rowDivider: {
    height:           StyleSheet.hairlineWidth,
    backgroundColor:  'rgba(204,204,204,0.5)',
    marginHorizontal: 16,
  },

  toggle: {
    width: 40, height: 24, borderRadius: 12,
    backgroundColor: Colors.borderSubtle,
  },
  toggleOn: { backgroundColor: Colors.primaryDark },

  footer: {
    paddingHorizontal: 16,
    paddingTop:        12,
    backgroundColor:   Colors.white,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    'rgba(204,204,204,0.5)',
  },
  applyBtn: {
    height:           48,
    borderRadius:     8,
    backgroundColor:  Colors.primaryDark,
    alignItems:       'center',
    justifyContent:   'center',
  },
  applyText: { color: Colors.white, fontSize: 14, fontWeight: '600' },
})
