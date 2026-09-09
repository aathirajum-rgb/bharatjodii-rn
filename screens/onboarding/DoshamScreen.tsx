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
import { Colors } from '../../constants/colors'
import { FontSize } from '../../src/theme/fonts'
import {
  fetchDoshamOptions,
  getRegValues,
  setRegValue,
  submitHoroscopeDetails,
} from '../../service/registrationService'
import { setItem } from '../../service/storageService'
import { refreshSession } from '../../service/homeService'
import { CDN_REG, CDN_LOTTIE } from '../../constants/cdn'
import CdnLottie from '../../components/CdnLottie'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'dosham.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DoshamScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  // null = not answered yet; true = Yes picked; false = No picked (step 1 —
  // Next stays gated behind this pick, but the view doesn't change until Next
  // is tapped, matching Angular's clickOnNext-driven navigation).
  const [hasDosham,       setHasDosham]       = useState<boolean | null>(null)
  // Flips true only once Next is tapped on the Yes branch — this is what
  // actually swaps the view to the dosham-type checkbox list (step 2).
  const [showDoshamTypes, setShowDoshamTypes] = useState(false)
  const [doshamTypes,  setDoshamTypes]  = useState<Option[]>([])
  // multi-select — set of selected keys
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [fetching,     setFetching]     = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [createdBy,    setCreatedBy]    = useState('1')
  const [star,         setStar]         = useState('')
  const [raasi,        setRaasi]        = useState('')
  const [motherTongue, setMotherTongue] = useState('47')

  useEffect(() => {
    getRegValues().then(rv => {
      if (rv.CREATEDBY)    setCreatedBy(rv.CREATEDBY)
      if (rv.STAR)         setStar(rv.STAR)
      if (rv.RAASI)        setRaasi(rv.RAASI)
      if (rv.MOTHERTONGUE) setMotherTongue(rv.MOTHERTONGUE)
    })
  }, [])

  async function loadDoshamTypes() {
    setFetching(true)
    try {
      const { doshamHash } = await fetchDoshamOptions(star, raasi, motherTongue)
      setDoshamTypes(doshamHash)
    } catch {
      // stay on step 2 with empty list; user can skip
    } finally {
      setFetching(false)
    }
  }

  // Angular: choosing Yes/No via app-radio only records the value and enables
  // the Next CTA (enableNextCTA) — it does not navigate/fetch by itself. The
  // dosham-type list is only loaded once Next is tapped (clickOnNext → page 33).
  function handleYes() {
    if (submitting) return
    setHasDosham(true)
  }

  function handleNo() {
    if (submitting) return
    setHasDosham(false)
  }

  // Step 2 is entered only via handleNext (Yes branch) — re-fetch on a live
  // language change only while actually showing the checkbox list.
  // Selection is held as KEYs in `selectedKeys`, so it survives the re-label.
  useLanguageReload(() => { if (showDoshamTypes) loadDoshamTypes() })

  function toggleDoshamType(key: string) {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Angular's clickOnNext(currentPageType) for page 32: No submits '2' (no
  // dosham) straight away; Yes navigates to page 33 (the dosham-type
  // checklist) — modeled here as revealing step 2 in place. Tapping Next
  // again from step 2 then submits the '~'-joined selected dosham keys.
  async function handleNext() {
    if (submitting) return

    if (showDoshamTypes) {
      if (selectedKeys.size === 0) return
      setSubmitting(true)
      const doshamValue = Array.from(selectedKeys).join('~')
      try {
        await setRegValue('DOSHAM', doshamValue)
        await submitHoroscopeDetails(star, raasi, doshamValue)
        await refreshSession()
        await setItem('LASTAPPLOGINAT', new Date().toISOString())
        navigation.navigate('Home')
      } catch {
        // allow retry
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (hasDosham === false) {
      setSubmitting(true)
      try {
        await setRegValue('DOSHAM', '2')
        await submitHoroscopeDetails(star, raasi, '2')
        await refreshSession()
        await setItem('LASTAPPLOGINAT', new Date().toISOString())
        navigation.navigate('Home')
      } catch {
        setSubmitting(false)
      }
      return
    }

    if (hasDosham === true) {
      setShowDoshamTypes(true)
      await loadDoshamTypes()
    }
  }

  async function handleSkip() {
    await refreshSession()
    await setItem('LASTAPPLOGINAT', new Date().toISOString())
    navigation.navigate('Home')
  }

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.SELECTDOSHAM', 'Does your #PROFILETYPE# have dosham?')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  // Angular (registration-revamp.component.html): the Next CTA is always rendered,
  // just disabled via showNextCTA until a value is picked — never unmounted like
  // nextHidden used to do here. Skip ("I'll do this later") is the inverse: shown
  // while nothing is selected yet on step 1, hidden once showNextCTA flips true
  // (showSkipBtn()). Step 2 (page 33/DOSHAMHASH in Angular's config) has no
  // SHOWSKIPBTN at all — the user already said Yes to get here, so Skip never
  // shows on the checkbox page regardless of how many boxes are checked.
  const hasSelection = showDoshamTypes ? selectedKeys.size > 0 : hasDosham !== null
  useOnboardingFooter({
    nextDisabled: !hasSelection,
    nextLoading:  submitting,
    onNext:       handleNext,
    showSkip:     !showDoshamTypes && !hasSelection,
    skipLabel:    t('REG.DO_LATER', "I'll do this later"),
    onSkip:       handleSkip,
  }, [hasDosham, showDoshamTypes, selectedKeys.size, submitting, hasSelection])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />

        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>
          {title}
        </Text>

        {/* ── Step 1: Yes / No — standard pill-chip pattern (Figma: h40, radius50, left indicator) ──
            Angular order is Yes first, then No (registration-revamp's app-radio listData).
            Selecting either just marks the choice — the view doesn't advance to step 2
            until Next is tapped, so both buttons need a visible active state now. */}
        {!showDoshamTypes && (
          <View style={styles.yesNoRow}>
            <Pressable
              style={[styles.yesNoBtn, hasDosham === true && styles.yesNoBtnActive]}
              onPress={handleYes}
              disabled={submitting}
              accessibilityRole="button"
            >
              <View style={[styles.yesNoIcon, hasDosham === true && styles.yesNoIconActive]}>
                {hasDosham === true && <Text style={styles.yesNoCheckmark}>✓</Text>}
              </View>
              <Text style={[styles.yesNoBtnText, hasDosham === true && styles.yesNoBtnTextActive, { fontFamily: langFonts.regular }]}>
                {t('GENERAL.YES', 'Yes')}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.yesNoBtn, hasDosham === false && styles.yesNoBtnActive]}
              onPress={handleNo}
              disabled={submitting}
              accessibilityRole="button"
            >
              <View style={[styles.yesNoIcon, hasDosham === false && styles.yesNoIconActive]}>
                {hasDosham === false && <Text style={styles.yesNoCheckmark}>✓</Text>}
              </View>
              <Text style={[styles.yesNoBtnText, hasDosham === false && styles.yesNoBtnTextActive, { fontFamily: langFonts.regular }]}>
                {t('GENERAL.NO', 'No')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Step 2: Dosham type multi-select — entered only via Next (handleNext) ──
            Angular's registration-revamp (pages 32/33) has no subtitle here — the
            "You can choose one or more dosham" text only exists in the old, unrelated
            registration.page.html (legacy flow, page type '35'), so it doesn't belong. */}
        {showDoshamTypes && (
          <>
            {fetching ? (
              <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} style={[styles.loader, { alignSelf: 'center' }]} />
            ) : (
              <View style={styles.checkList}>
                {doshamTypes.map(opt => {
                  const checked = selectedKeys.has(opt.key)
                  return (
                    <Pressable
                      key={opt.key}
                      style={[styles.checkRow, checked && styles.checkRowActive]}
                      onPress={() => toggleDoshamType(opt.key)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                    >
                      <Text style={[styles.checkLabel, checked && styles.checkLabelActive, { fontFamily: langFonts.regular }]}>
                        {opt.label}
                      </Text>
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: { marginTop: 48 },

  // ── Yes / No — standard pill-chip pattern (Figma: h40, radius50, border #8a8a8a) ──
  yesNoRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           16,
  },
  yesNoBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          40,
    borderRadius:    50,
    borderWidth:     1,
    borderColor:     Colors.borderNeutral,
    backgroundColor: Colors.surface,
    paddingLeft:     8,
    paddingRight:    16,
    gap:             8,
  },
  yesNoBtnActive: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.radioCheckedBg,
  },
  // Angular (radio.component.html, type-1 non-GENDER): .body2-regular-14
  // line-height-16 black-color — Figma keeps the label black in both states,
  // only the indicator turns red. No explicit lineHeight here (user
  // preference: let RN's Text fall back to the font's natural metric on
  // onboarding screens even where Angular sets one).
  yesNoBtnText: {
    fontSize:   FontSize.font14,
    fontWeight: '400',
    color:      Colors.black,
  },
  yesNoBtnTextActive: {
    fontWeight: '500',
  },
  yesNoIcon: {
    width:          20,
    height:         20,
    borderRadius:   10,
    borderWidth:    1.5,
    borderColor:    Colors.borderNeutral,
    alignItems:     'center',
    justifyContent: 'center',
  },
  yesNoIconActive: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  yesNoCheckmark: {
    color:      Colors.surface,
    fontSize:   11,
    fontWeight: '700',
  },

  // ── Dosham type checkboxes — flat full-width rows (Figma: no card border/radius,
  // divider #e6e6e6, full-bleed #FFF1F5 when checked) ──
  checkList: { gap: 0 },

  checkRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    marginHorizontal:  -24,
    paddingHorizontal: 24,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  checkRowActive: {
    backgroundColor: Colors.selectionBg,
  },
  // Angular (checkbox.component.html): .body2-regular-14 line-height-16
  // black-color. No explicit lineHeight here (user preference: let RN's Text
  // fall back to the font's natural metric on onboarding screens even where
  // Angular sets one).
  checkLabel: {
    flex:        1,
    fontSize:    FontSize.font14,
    fontWeight:  '400',
    color:       Colors.black,
    marginRight: 12,
  },
  // Figma keeps the label black when checked — only the weight changes
  checkLabelActive: {
    fontWeight: '500',
  },
  checkbox: {
    width:          20,
    height:         20,
    borderRadius:   4,
    borderWidth:    1.5,
    borderColor:    Colors.borderNeutral,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  checkboxChecked: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  checkmark: {
    fontSize:   13,
    fontWeight: '700',
    color:      Colors.white,
    lineHeight: 16,
  },
})
