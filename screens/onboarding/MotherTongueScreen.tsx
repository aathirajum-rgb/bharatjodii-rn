import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { SvgXml } from 'react-native-svg'
import SearchablePicker from '../../components/searchable-picker/SearchablePicker'
import { Colors } from '../../constants/colors'
import {
  callPartialRegistrationAPI,
  fetchMotherTongueOptions,
  getRegValue,
  loadAndStoreStatesForMotherTongue,
  setRegValue,
} from '../../service/registrationService'
import { CDN_REG, CDN_LOTTIE } from '../../constants/cdn'
import CdnLottie from '../../components/CdnLottie'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { stripAndDecodeHtml } from '../../utils/htmlEntities'
import { Fonts, FontSize } from '../../src/theme/fonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'mother-tongue.svg'
// Angular's dropdown-field arrow is Ionic's "chevron-forward-outline" icon —
// not a CDN-hosted image but a bundled Ionicons SVG (node_modules/ionicons/
// dist/svg/chevron-forward-outline.svg), colored via its "black-color" CSS
// class. Inlined here verbatim (stroke swapped from currentColor to a fixed
// black, since SvgXml doesn't inherit CSS color) for a pixel-exact match.
const CHEVRON_FORWARD_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M184 112l144 144-144 144"/></svg>`

// Labels from registrationService are already tag-stripped and entity-decoded by
// its label() helper; kept as a thin alias to the shared util so this stays
// correct for any raw string and never silently reintroduces &#x....; codes.
const stripHtml = stripAndDecodeHtml

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

// Angular: right-side-panel.component.ts moveSelectedMotherTongueToTop() —
// MOTHERTONGUE panel only, floats the already-selected value to the top of
// the list instead of leaving it in its natural position. Angular re-runs
// this every time the panel is opened (it's a fresh component instance per
// ionViewDidEnter), so this is applied both on load and on each panel open,
// not just once from the persisted value.
function moveToTop(list: Option[], key: string | null | undefined): Option[] {
  if (!key) return list
  const idx = list.findIndex(o => o.key === key)
  if (idx <= 0) return list
  const copy = [...list]
  const [sel] = copy.splice(idx, 1)
  copy.unshift(sel)
  return copy
}

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MotherTongueScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  const [allOptions,   setAllOptions]   = useState<Option[]>([])
  const [fetching,     setFetching]     = useState(true)
  const [selected,     setSelected]     = useState<Option | null>(null)
  const [createdBy,    setCreatedBy]    = useState('4')
  const [submitting,   setSubmitting]   = useState(false)
  const [panelVisible, setPanelVisible] = useState(false)

  // Extracted so a language change can re-run it — the option labels below are
  // server-translated. Angular: handleLanguageChange() → runInitialDataPopulation()
  // → getRegistrationDynamicArray(true, 1), then assignRegistrationData() re-resolves
  // the stored KEY against the newly translated list. Re-reading storage here does
  // the same, so the user's selection survives the switch.
  function loadOptions() {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('MOTHERTONGUE'),
    ]).then(([cb, savedMT]) => {
      if (cb) setCreatedBy(cb)

      fetchMotherTongueOptions()
        .then(list => {
          const cleaned = list.map(o => ({ key: o.key, label: stripHtml(o.label) }))
          setAllOptions(moveToTop(cleaned, savedMT))
          if (savedMT) {
            const found = cleaned.find(o => o.key === savedMT)
            if (found) setSelected(found)
          }
        })
        .catch(() => {})
        .finally(() => setFetching(false))
    })
  }

  useEffect(() => { loadOptions() }, [])

  useLanguageReload(loadOptions)

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.MOTHERTONGUE', 'What is your #PROFILETYPE# mother tongue?')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  // Angular: registration.config.ts page 39 LISTDATA — PLACEHOLDERTXT:
  // REGISTRATION.SELECTMOTHERTONGUE, LABEL: REGISTRATION.MOTHERTONGUELABEL,
  // SEARCHBARTXT: REGISTRATION.SEARCHMOTHERTONGUE.
  const placeholderText = t('REGISTRATION.SELECTMOTHERTONGUE', 'Select mother tongue')
  const fieldLabelText  = t('REGISTRATION.MOTHERTONGUELABEL', 'Mother tongue')
  const searchPlaceholderText = t('REGISTRATION.SEARCHMOTHERTONGUE', 'Search mother tongue')

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await setRegValue('MOTHERTONGUE', selected.key)
      await loadAndStoreStatesForMotherTongue(selected.key)
      navigation.push('onboarding', { pageNo: '9' })
      callPartialRegistrationAPI()
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  useOnboardingFooter(
    { nextDisabled: !selected, nextLoading: submitting, onNext: handleNext },
    [selected, submitting],
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />

        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        {fetching ? (
          <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} style={styles.loader} />
        ) : (
          // Floating "Mother tongue" label — always shown above the field,
          // with or without a selection (unlike Height's floating label,
          // which is conditional on a value being present).
          <View style={styles.selectFieldWrapper}>
            <View style={styles.selectFieldLabel} pointerEvents="none">
              <Text style={[styles.selectFieldLabelText, { fontFamily: langFonts.regular }]}>{fieldLabelText}</Text>
            </View>
            <Pressable
              style={styles.selectField}
              onPress={() => {
                setAllOptions(prev => moveToTop(prev, selected?.key))
                setPanelVisible(true)
              }}
              accessibilityRole="button"
              accessibilityLabel="Select mother tongue"
            >
              {/* Angular: black-color width-95 poppins-family, ngClass'd between
                  body1-medium-14/body2-regular-14 — poppins-family is declared AFTER
                  both in global.scss, so at equal specificity (both !important) it wins
                  the font-family cascade; that class maps to var(--english-poppins),
                  which _variable.scss defines as Roboto-Regular (originally meant for
                  the Rupee symbol), not Poppins/NotoSans. */}
              <Text
                style={[
                  styles.selectFieldText,
                  !!selected && styles.selectFieldTextActive,
                  { fontFamily: Fonts.robotoRegular },
                ]}
                numberOfLines={1}
              >
                {selected ? selected.label : placeholderText}
              </Text>
              <SvgXml xml={CHEVRON_FORWARD_XML} width={24} height={24} />
            </Pressable>
          </View>
        )}
      </ScrollView>

      <SearchablePicker
        visible={panelVisible}
        title={title}
        placeholder={searchPlaceholderText}
        options={allOptions}
        selectedKey={selected?.key ?? null}
        onSelect={(opt) => setSelected(opt)}
        onClose={() => setPanelVisible(false)}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: { alignSelf: 'center', marginTop: 48 },

  selectFieldWrapper: {
    position:  'relative',
    marginTop: 8,
  },
  selectFieldLabel: {
    position:          'absolute',
    top:               -8,
    left:              12,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
    zIndex:            10,
  },
  // Angular: floating body3-regular-12 black-color
  // (registration-revamp.component.html:217-219) — Poppins-Regular
  selectFieldLabelText: {
    fontSize:   FontSize.font12,
    fontWeight: '400',
    color:      Colors.black,
  },
  selectField: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          48,
    borderWidth:     1,
    borderColor:     Colors.inputBorder,
    borderRadius:    8,
    paddingLeft:     16,
    paddingRight:    12,
    backgroundColor: Colors.surface,
  },
  // Angular: black-color width-95 poppins-family, body2-regular-14 while
  // showing the placeholder — fontFamily is Fonts.robotoRegular (see the
  // poppins-family cascade note at the Text element above), not Poppins.
  selectFieldText: {
    flex:       1,
    fontSize:   FontSize.font14,
    fontWeight: '400',
    color:      Colors.black,
  },
  // Angular: body1-medium-14 once a value is selected (registration-revamp.
  // component.html:211) — weight 500; family still Roboto (poppins-family)
  selectFieldTextActive: {
    fontWeight: '500',
  },
})
