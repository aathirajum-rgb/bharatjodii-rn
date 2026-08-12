// Desktop layout for Edit Preferences (Figma "Jodii Desktop - Registration",
// UaPAN9aG6MfZf6CRpwXf1L, node 647:10381 — list card — and node 647:13268 —
// the per-field popup). Purely presentational: SearchScreen.tsx owns all
// state/data-fetching (same split Home/Matches/DailyRecommendation's desktop
// layouts already use) and passes it down as props.
//
// Field popups: Figma's one shown example (Age) has an explicit Apply button,
// implying edits stage locally until confirmed. This reuses DesktopSelectField/
// DesktopMultiSelectField as-is instead — both already commit immediately on
// select/toggle (the same convention every other desktop-web screen in this
// app uses them with, e.g. onboarding's desktop steps) — so here "Apply" just
// closes the popup; the live "Matches" count inside it is the same debounced
// count SearchScreen already recomputes on every field change, so it updates
// in near-real-time as you pick values, before you even click Apply.
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import DesktopSelectField, { type SelectOption } from '../../components/desktop-select-field/DesktopSelectField'
import DesktopMultiSelectField from '../../components/desktop-select-field/DesktopMultiSelectField'
import PreferenceFieldModal from '../../components/preference-field-modal/PreferenceFieldModal'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import type { MultiSelectOption } from '../../components/multi-select-picker/MultiSelectPicker'
import type { PickerOption } from '../../components/searchable-picker/SearchablePicker'
import type { FieldKey } from './SearchScreen'
import { AGE_OPTIONS, SIMPLE_MULTI_FIELDS } from './SearchScreen'
import type { FooterTab } from '../../components/app-footer/AppFooter'

const ICON_ARROW = CDN_REACT + '/menu_right_arrow.svg'

export interface SearchDesktopLayoutProps {
  navigation: any
  userName:   string
  loading:    boolean

  rows:      Array<{ key: FieldKey; label: string; hidden?: boolean }>
  rowValue:  Record<string, string>
  selected:  Record<string, any>
  labelCache: Record<string, MultiSelectOption[]>
  heightOptions: PickerOption[]

  matchCount:   number
  countLoading: boolean

  strictPrefs: Record<string, boolean>
  onToggleStrictPref: (key: string, value: boolean) => void

  ageEditor:    'min' | 'max' | null
  setAgeEditor: (v: 'min' | 'max' | null) => void
  heightEditor: 'min' | 'max' | null
  setHeightEditor: (v: 'min' | 'max' | null) => void
  locationStep: 'state' | 'city' | null
  setLocationStep: (v: 'state' | 'city' | null) => void
  starStep:     'raasi' | 'star' | null
  setStarStep:  (v: 'raasi' | 'star' | null) => void
  multiEditor:  FieldKey | null
  setMultiEditor: (v: FieldKey | null) => void

  updateField:  (key: string, value: any) => void
  openSimpleMulti: (key: FieldKey) => void
  openCaste:    () => void
  openLocation: () => void
  openStar:     () => void
  openHeight:   (bound: 'min' | 'max') => void
  selectState:  (opt: PickerOption) => void
  selectRaasi:  (opt: PickerOption) => void

  onReset:       () => void
  onShowMatches: () => void
}

function strictCopyFor(key: FieldKey | 'DIVISION', label: string) {
  const isRange = key === 'AGE' || key === 'HEIGHT'
  return {
    label: `Strict ${label.toLowerCase()} filter`,
    description: isRange
      ? `See matches strictly within the specified ${label.toLowerCase()} range`
      : `See matches strictly matching your selected ${label.toLowerCase()}`,
  }
}

export default function SearchDesktopLayout(props: SearchDesktopLayoutProps) {
  const {
    navigation, userName, loading, rows, rowValue, selected, labelCache, heightOptions,
    matchCount, countLoading, strictPrefs, onToggleStrictPref,
    ageEditor, setAgeEditor, heightEditor, setHeightEditor, locationStep, setLocationStep,
    starStep, setStarStep, multiEditor, setMultiEditor,
    updateField, openSimpleMulti, openCaste, openLocation, openStar, openHeight,
    selectState, selectRaasi, onReset, onShowMatches,
  } = props
  const { t } = useTranslation()

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 3: navigation.navigate('recharge', { fromTab: true }); break
      case 4: navigation.navigate('MessagerList'); break
    }
  }

  function fieldRowPress(key: FieldKey) {
    if (key === 'AGE') { setAgeEditor('min'); return }
    if (key === 'HEIGHT') { openHeight('min'); return }
    if (key === 'LOCATION') { openLocation(); return }
    if (key === 'STAR') { openStar(); return }
    if (key === 'CASTE') { openCaste(); return }
    if (SIMPLE_MULTI_FIELDS.has(key)) { openSimpleMulti(key); return }
  }

  // Which field's popup (if any) is currently open, across the 5 separate
  // step states SearchScreen already tracks — resolved once so the popup
  // shell's title/strict-toggle copy can key off a single field. multiEditor
  // widens to 'DIVISION' for Islam castes (openCaste's own `key as FieldKey`
  // cast — DIVISION isn't a real FieldKey, so this stays a plain string here).
  const activeKey = (
    ageEditor    !== null ? 'AGE' :
    heightEditor !== null ? 'HEIGHT' :
    locationStep !== null ? 'LOCATION' :
    starStep     !== null ? 'STAR' :
    multiEditor  !== null ? multiEditor : null
  ) as FieldKey | 'DIVISION' | null

  const activeLabel = rows.find(r => r.key === activeKey)?.label
    ?? (activeKey === 'DIVISION' ? t('FILTER.DIVISION', 'Division')
      : activeKey ? t(`FILTER.${activeKey}` as any, activeKey) : '')

  function closeActiveEditor() {
    setAgeEditor(null)
    setHeightEditor(null)
    setLocationStep(null)
    setStarStep(null)
    setMultiEditor(null)
  }

  const strictCopy = activeKey ? strictCopyFor(activeKey, activeLabel) : { label: '', description: '' }

  function toSelectOptions(opts: MultiSelectOption[] | undefined): SelectOption[] {
    return (opts ?? []).map(o => ({ key: o.key, label: o.label }))
  }

  return (
    <DesktopPageShell navigation={navigation} userName={userName} activeItem="editPreferences" onTabPress={handleTabPress}>
      <View style={s.header}>
        <Text style={s.title}>{t('FILTER.PP_HEADER', 'Edit preferences')}</Text>
        <Pressable onPress={onReset} hitSlop={8}>
          <Text style={s.resetText}>{t('FILTER.RESET_HEADER', 'Reset')}</Text>
        </Pressable>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>{t('FILTER.PP_SUBTITLE', 'What kind of partner are you looking for ?')}</Text>

        <View style={s.strictBanner}>
          <View style={s.strictTextCol}>
            <Text style={s.strictTitle}>Strict filters</Text>
            <Text style={s.strictDesc}>
              By turning on strict filters, you will only see matches that exactly meet your specified preferences
            </Text>
          </View>
          {/* No dedicated Strict-Filters management screen exists yet — each
              field's own popup already exposes its own Strict toggle. */}
          <Pressable style={s.manageBtn} onPress={() => {}}>
            <Text style={s.manageBtnText}>Manage Strict Filters</Text>
          </Pressable>
        </View>

        <View style={s.rowsWrap}>
          {rows.filter(r => !r.hidden).map((row, i, arr) => (
            <Fragment key={row.key}>
              <Pressable
                style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                onPress={() => fieldRowPress(row.key)}
                accessibilityRole="button"
              >
                <View style={s.rowText}>
                  <Text style={s.rowLabel}>{row.label}</Text>
                  <Text style={s.rowValue} numberOfLines={1}>{(rowValue as any)[row.key]}</Text>
                </View>
                <Image source={{ uri: ICON_ARROW }} style={s.rowChevron} />
              </Pressable>
              {i < arr.length - 1 && <View style={s.rowDivider} />}
            </Fragment>
          ))}
        </View>

        <Pressable style={s.showMatchesBtn} onPress={onShowMatches} disabled={loading}>
          <Text style={s.showMatchesText}>
            {(matchCount === 1 ? t('FILTER.FILTER_SHOW_MATCH_CTA') : t('FILTER.FILTER_SHOW_MATCHES_CTA'))
              .replace('#MATCHESCOUNT#', String(matchCount))}
          </Text>
        </Pressable>
      </View>

      <PreferenceFieldModal
        visible={activeKey !== null}
        title={`Select preferred ${activeLabel.toLowerCase()}`}
        onClose={closeActiveEditor}
        onApply={closeActiveEditor}
        matchCount={matchCount}
        countLoading={countLoading}
        strictLabel={strictCopy.label}
        strictDescription={strictCopy.description}
        strictEnabled={!!(activeKey && strictPrefs[activeKey])}
        onToggleStrict={v => activeKey && onToggleStrictPref(activeKey, v)}
      >
        {activeKey === 'AGE' && (
          <>
            <DesktopSelectField
              label="Minimum age"
              options={AGE_OPTIONS.filter(o => Number(o.key) < Number(selected.ENDAGE ?? 50))}
              selectedKey={selected.STARTAGE ?? null}
              onSelect={opt => updateField('STARTAGE', opt.key)}
            />
            <DesktopSelectField
              label="Maximum age"
              options={AGE_OPTIONS.filter(o => Number(o.key) > Number(selected.STARTAGE ?? 18))}
              selectedKey={selected.ENDAGE ?? null}
              onSelect={opt => updateField('ENDAGE', opt.key)}
            />
          </>
        )}

        {activeKey === 'HEIGHT' && (
          <>
            <DesktopSelectField
              label="Minimum height"
              options={heightOptions}
              selectedKey={selected.STARTHEIGHT?.[0] ?? null}
              onSelect={opt => updateField('STARTHEIGHT', [opt.key])}
            />
            <DesktopSelectField
              label="Maximum height"
              options={heightOptions}
              selectedKey={selected.ENDHEIGHT?.[0] ?? null}
              onSelect={opt => updateField('ENDHEIGHT', [opt.key])}
            />
          </>
        )}

        {activeKey === 'LOCATION' && (
          <>
            <DesktopSelectField
              label="State"
              options={toSelectOptions(labelCache.STATE)}
              selectedKey={selected.STATE?.[0] ?? null}
              onSelect={selectState}
            />
            <DesktopMultiSelectField
              label="City"
              options={toSelectOptions(labelCache.CITY)}
              selectedKeys={new Set(selected.CITY ?? [])}
              onToggle={key => {
                const cur: string[] = selected.CITY ?? []
                if (key === '0') { updateField('CITY', ['0']); return }
                const withoutAny = cur.filter((k: string) => k !== '0')
                const next = withoutAny.includes(key) ? withoutAny.filter((k: string) => k !== key) : [...withoutAny, key]
                updateField('CITY', next.length ? next : ['0'])
              }}
            />
          </>
        )}

        {activeKey === 'STAR' && (
          <>
            <DesktopSelectField
              label="Raasi"
              options={toSelectOptions(labelCache.RAASI)}
              selectedKey={null}
              onSelect={selectRaasi}
            />
            <DesktopMultiSelectField
              label="Star"
              options={toSelectOptions(labelCache.STAR)}
              selectedKeys={new Set(selected.STAR ?? [])}
              onToggle={key => {
                const cur: string[] = selected.STAR ?? []
                if (key === '0') { updateField('STAR', ['0']); return }
                const withoutAny = cur.filter((k: string) => k !== '0')
                const next = withoutAny.includes(key) ? withoutAny.filter((k: string) => k !== key) : [...withoutAny, key]
                updateField('STAR', next.length ? next : ['0'])
              }}
            />
          </>
        )}

        {activeKey && (activeKey === 'CASTE' || activeKey === 'DIVISION' || SIMPLE_MULTI_FIELDS.has(activeKey as FieldKey)) && (
          <DesktopMultiSelectField
            label={activeLabel}
            options={toSelectOptions(labelCache[activeKey])}
            selectedKeys={new Set(selected[activeKey] ?? [])}
            onToggle={key => {
              const field = activeKey
              const cur: string[] = selected[field] ?? []
              if (key === '0') { updateField(field, ['0']); return }
              const withoutAny = cur.filter((k: string) => k !== '0')
              const next = withoutAny.includes(key) ? withoutAny.filter((k: string) => k !== key) : [...withoutAny, key]
              updateField(field, next.length ? next : ['0'])
              if (field === 'RELIGION') {
                updateField('CASTE', ['0'])
                updateField('DIVISION', ['0'])
              }
            }}
          />
        )}
      </PreferenceFieldModal>
    </DesktopPageShell>
  )
}

const s = StyleSheet.create({
  header: {
    width: 810, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24,
  },
  title: { fontFamily: 'Poppins-SemiBold', fontSize: 22, color: Colors.black },
  resetText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.link },

  card: {
    width: 810, backgroundColor: Colors.white, borderRadius: 24, padding: 40, gap: 24,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8,
    elevation: 4, alignItems: 'center',
  },
  cardTitle: { alignSelf: 'stretch', fontFamily: 'Poppins-SemiBold', fontSize: 20, color: Colors.black },

  strictBanner: {
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FBF2F5', borderWidth: 1, borderColor: '#FFE3EC', borderRadius: 4, padding: 16,
  },
  strictTextCol: { flex: 1, gap: 8 },
  strictTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black },
  strictDesc:  { fontFamily: 'Poppins-Regular', fontSize: 12, lineHeight: 16, color: Colors.black },
  manageBtn: {
    width: 200, height: 40, borderWidth: 1, borderColor: Colors.primaryDark, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16,
  },
  manageBtnText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.primaryDark, textAlign: 'center' },

  rowsWrap: { alignSelf: 'stretch', gap: 24 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowPressed: { opacity: 0.6 },
  rowText: { gap: 8 },
  rowLabel: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black },
  rowValue: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.black },
  rowChevron: { width: 16, height: 16 },
  rowDivider: { alignSelf: 'stretch', height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderSubtle },

  showMatchesBtn: {
    width: 312, height: 44, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  showMatchesText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.white },
})
