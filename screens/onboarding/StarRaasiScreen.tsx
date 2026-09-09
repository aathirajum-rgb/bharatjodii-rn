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
import { FontSize } from '../../src/theme/fonts'
import {
  fetchRaasiOptions,
  fetchStarOptions,
  getRegValues,
  setRegValues,
  submitHoroscopeDetails,
} from '../../service/registrationService'
import { CDN_REG, CDN_LOTTIE } from '../../constants/cdn'
import CdnLottie from '../../components/CdnLottie'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'star-raasi.svg'
const FOOTER_H      = 160

// Angular's dropdown-row arrow is Ionic's "chevron-forward-outline" icon at
// `.width-height-24` (24px) — not the plain "›" text glyph this screen
// previously drew (that lacked Angular's font-size/weight and used the wrong
// 26px line-height). Same icon Religion/Caste/Gothra screens already inline
// for a pixel-exact match.
const CHEVRON_FORWARD_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M184 112l144 144-144 144"/></svg>`

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }
type ActivePanel = 'raasi' | 'star' | null

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StarRaasiScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  const [raasiOptions, setRaasiOptions] = useState<Option[]>([])
  const [starOptions,  setStarOptions]  = useState<Option[]>([])

  const [selectedRaasi, setSelectedRaasi] = useState<Option | null>(null)
  const [selectedStar,  setSelectedStar]  = useState<Option | null>(null)

  const [fetchingRaasi, setFetchingRaasi] = useState(true)
  const [submitting,    setSubmitting]    = useState(false)
  const [createdBy,     setCreatedBy]     = useState('1')
  const [activePanel,   setActivePanel]   = useState<ActivePanel>(null)

  // Extracted so a language change can re-run it — the option labels below are
  // server-translated. Angular: handleLanguageChange() → runInitialDataPopulation()
  // → getRegistrationDynamicArray(true, 1), then assignRegistrationData() re-resolves
  // the stored KEY against the newly translated list. Re-reading storage here does
  // the same, so the user's selection survives the switch.
  //
  // Both RAASI and STAR come from the SAME shared bootstrap cache (see
  // fetchRaasiOptions/fetchStarOptions) — fetched together here, matching
  // Angular where neither list depends on the other (STAR is never filtered
  // by the selected raasi in Angular).
  function loadOptions() {
    getRegValues().then((rv) => {
      if (rv.CREATEDBY) setCreatedBy(rv.CREATEDBY)

      Promise.all([fetchRaasiOptions(), fetchStarOptions()])
        .then(([raasiList, starList]) => {
          setRaasiOptions(raasiList)
          setStarOptions(starList)

          if (rv.RAASI && raasiList.length) {
            const found = raasiList.find(o => o.key === rv.RAASI)
            if (found) setSelectedRaasi(found)
          }
          if (rv.STAR && starList.length) {
            const foundStar = starList.find(o => o.key === rv.STAR)
            if (foundStar) setSelectedStar(foundStar)
          }
        })
        .catch(() => {})
        .finally(() => setFetchingRaasi(false))
    })
  }

  useEffect(() => { loadOptions() }, [])

  useLanguageReload(loadOptions)

  function selectRaasi(opt: Option) {
    // Angular: resetValuesIfNeeded() clears STAR when RAASI changes — the star
    // list itself doesn't change (it's the same shared unfiltered list), but a
    // previously-picked star may no longer be the user's intent once they've
    // changed their raasi, so the selection is cleared, not the list.
    setSelectedRaasi(opt)
    setSelectedStar(null)
  }

  async function handleNext() {
    if (!selectedRaasi || !selectedStar || submitting) return
    setSubmitting(true)
    try {
      await setRegValues({ RAASI: selectedRaasi.key, STAR: selectedStar.key })
      await submitHoroscopeDetails(selectedStar.key, selectedRaasi.key, '')
      navigation.push('onboarding', { pageNo: '32' })
    } catch {
      // allow retry
    } finally {
      setSubmitting(false)
    }
  }

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.STARRASSI', 'Select your #PROFILETYPE# rassi & star')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  const canNext = !!selectedRaasi && !!selectedStar

  // Angular: the Next button is ALWAYS rendered on this page, just
  // [isDisabled]="!showNextCTA" — disabled (not hidden) until both RAASI and
  // STAR are valid (isStarRassiValueValid()). "I'll do this later" removed
  // entirely on this screen per product direction (Angular does show it,
  // toggling off once Next enables, but this port omits it regardless).
  useOnboardingFooter({
    nextDisabled: !canNext,
    nextLoading:  submitting,
    onNext:       handleNext,
  }, [canNext, submitting])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.screen}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />

        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>
          {title}
        </Text>

        {fetchingRaasi ? (
          <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} style={styles.loader} />
        ) : (
          <View style={styles.fields}>
            {/* ── Raasi field ──────────────────────────────────────────── */}
            <View style={styles.fieldWrapper}>
              <View style={styles.fieldLabelBadge}>
                <Text style={[styles.fieldLabelText, { fontFamily: langFonts.regular }]}>{t('REGISTRATION.RAASI', 'Raasi')}</Text>
              </View>
              <Pressable
                style={styles.selectField}
                onPress={() => setActivePanel('raasi')}
                accessibilityRole="button"
                accessibilityLabel="Select raasi"
              >
                <Text
                  style={[
                    styles.selectFieldText,
                    !!selectedRaasi && styles.selectFieldTextActive,
                    { fontFamily: selectedRaasi ? langFonts.medium : langFonts.regular },
                  ]}
                  numberOfLines={1}
                >
                  {selectedRaasi ? selectedRaasi.label : t('REGISTRATION.SELECTRASSI', 'Select Raasi')}
                </Text>
                <SvgXml xml={CHEVRON_FORWARD_XML} width={24} height={24} />
              </Pressable>
            </View>

            {/* ── Star field — only after raasi is selected. The star list itself
                is already loaded alongside raasi's (it's the same shared,
                unfiltered list Angular uses — see fetchStarOptions), so no
                separate per-selection fetch/loading state is needed here. ── */}
            {selectedRaasi && (
              <View style={[styles.fieldWrapper, styles.fieldGap]}>
                <View style={styles.fieldLabelBadge}>
                  <Text style={[styles.fieldLabelText, { fontFamily: langFonts.regular }]}>{t('REGISTRATION.STAR', 'Star')}</Text>
                </View>
                <Pressable
                  style={styles.selectField}
                  onPress={() => setActivePanel('star')}
                  accessibilityRole="button"
                  accessibilityLabel="Select star"
                >
                  <Text
                    style={[
                      styles.selectFieldText,
                      !!selectedStar && styles.selectFieldTextActive,
                      { fontFamily: selectedStar ? langFonts.medium : langFonts.regular },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedStar ? selectedStar.label : t('REGISTRATION.SELECTSTAR', 'Select Star')}
                  </Text>
                  <SvgXml xml={CHEVRON_FORWARD_XML} width={24} height={24} />
                </Pressable>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}

      {/* Raasi picker — Angular's page-26 config (registration.config.ts,
          LISTDATA[0]) has ISSHOWSEARCHBAR: false for RAASI, so no search box. */}
      <SearchablePicker
        visible={activePanel === 'raasi'}
        title={t('REGISTRATION.RAASI', 'Select Raasi')}
        placeholder={t('REGISTRATION.SEARCHRASSI', 'Search raasi...')}
        options={raasiOptions}
        selectedKey={selectedRaasi?.key ?? null}
        onSelect={opt => { selectRaasi(opt); setActivePanel(null) }}
        onClose={() => setActivePanel(null)}
        hideSearch
      />

      {/* Star picker — same config, LISTDATA[1]: ISSHOWSEARCHBAR: false for STAR. */}
      <SearchablePicker
        visible={activePanel === 'star'}
        title={t('REGISTRATION.STAR', 'Select Star')}
        placeholder={t('REGISTRATION.SEARCHSTAR', 'Search star...')}
        options={starOptions}
        selectedKey={selectedStar?.key ?? null}
        onSelect={opt => { setSelectedStar(opt); setActivePanel(null) }}
        onClose={() => setActivePanel(null)}
        hideSearch
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: { alignSelf: 'center', marginTop: 48 },

  fields: { gap: 0 },

  fieldWrapper: {
    position: 'relative',
    marginTop: 8,
  },
  fieldGap: {
    marginTop: 32,
  },
  fieldLabelBadge: {
    position:          'absolute',
    top:               -8,
    left:              12,
    zIndex:            1,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
  },
  // Angular .floating body3-regular-12 black-color: black, not gray
  fieldLabelText: {
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
  // Angular's placeholder/value span is always black-color; only weight toggles
  selectFieldText: {
    flex:       1,
    fontSize:   FontSize.font14,
    fontWeight: '400',
    color:      Colors.black,
  },
  selectFieldTextActive: {
    fontWeight: '500',
  },

})
