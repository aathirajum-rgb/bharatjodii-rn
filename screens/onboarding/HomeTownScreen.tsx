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
  callPartialRegistrationAPI,
  checkIsNRIUser,
  fetchHomeTownOptions,
  getRegValues,
  setRegValues,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { useLanguageReload } from '../../hooks/useLanguageReload'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'location.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

type YesNo = 'yes' | 'no' | null

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeTownScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  const [createdBy,       setCreatedBy]       = useState('4')
  const [homeTownSame,    setHomeTownSame]    = useState<YesNo>(null)
  const [currentStateKey, setCurrentStateKey] = useState('')
  const [currentCityKey,  setCurrentCityKey]  = useState('')
  const [submitting,      setSubmitting]      = useState(false)
  // Angular: getArrayList('HOMETOWN', 'HOMETOWN', '46') reads the Yes/No
  // labels out of registrationArray['HOMETOWN'] (the localised API response),
  // not the static GENERAL.YES/GENERAL.NO keys.
  const [yesLabel, setYesLabel] = useState<string | null>(null)
  const [noLabel,  setNoLabel]  = useState<string | null>(null)

  // Angular: updateHomeTownYes() — for an NRI user (checkIsNRIUser(), keyed
  // off COUNTRYCODE != '91') HOMESTATE/HOMECITY are seeded from
  // NATIVESTATE/NATIVECITY instead of STATE/CITY.
  useEffect(() => {
    getRegValues().then(async rv => {
      if (rv.CREATEDBY) setCreatedBy(rv.CREATEDBY)
      const nri = await checkIsNRIUser(rv.COUNTRYCODE ?? '')
      setCurrentStateKey(nri ? (rv.NATIVESTATE ?? '') : (rv.STATE ?? ''))
      setCurrentCityKey(nri ? (rv.NATIVECITY ?? '') : (rv.CITY ?? ''))
      if (rv.HOMETOWN === '1') setHomeTownSame('yes')
      else if (rv.HOMETOWN === '2') setHomeTownSame('no')
    })
  }, [])

  function loadHomeTownOptions() {
    return fetchHomeTownOptions().then(list => {
      setYesLabel(list.find(o => o.key === '1')?.label ?? null)
      setNoLabel(list.find(o => o.key === '2')?.label ?? null)
    }).catch(() => {})
  }

  useEffect(() => { loadHomeTownOptions() }, [])

  // Re-fetch the Yes/No labels when the app language changes while this
  // screen is mounted (e.g. switched via the mid-app language selector) —
  // same pattern as EatingHabitScreen.tsx/DoshamScreen.tsx/etc.
  useLanguageReload(loadHomeTownOptions)

  async function handleNext() {
    if (!homeTownSame || submitting) return
    setSubmitting(true)
    try {
      if (homeTownSame === 'yes') {
        await setRegValues({ HOMETOWN: '1', HOMESTATE: currentStateKey, HOMECITY: currentCityKey })
        navigation.push('onboarding', { pageNo: '10' })
        callPartialRegistrationAPI()
      } else {
        await setRegValues({ HOMETOWN: '2', HOMESTATE: '', HOMECITY: '' })
        navigation.push('onboarding', { pageNo: '44' })
      }
    } catch {
      // allow retry
    } finally {
      setSubmitting(false)
    }
  }

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  // Angular: registration.config.ts page 46 — TITLE: "REGISTRATION.HOME_TOWN_TXT"
  // ("Is your #PROFILETYPE# home town same as current location?"), not
  // REGISTRATION.HOMETOWN (that key is page 44's "Select your ... hometown"
  // state/city dropdown title).
  const title = t('REGISTRATION.HOME_TOWN_TXT', 'Is your #PROFILETYPE# home town same as current location?')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  useOnboardingFooter(
    { nextDisabled: !homeTownSame, nextLoading: submitting, onNext: handleNext },
    [homeTownSame, submitting],
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />
        <Text style={[os.title, { marginBottom: 32, fontFamily: langFonts.semiBold }]}>{title}</Text>

        <View style={styles.yesNoRow}>
          <Pressable
            style={[styles.yesNoChip, homeTownSame === 'yes' && styles.yesNoChipSelected]}
            onPress={() => setHomeTownSame('yes')}
            accessibilityRole="radio"
            accessibilityState={{ selected: homeTownSame === 'yes' }}
          >
            <View style={[styles.chipRadio, homeTownSame === 'yes' && styles.chipRadioSelected]}>
              {homeTownSame === 'yes' && <Text style={styles.chipRadioTick}>✓</Text>}
            </View>
            <Text style={[styles.yesNoLabel, { fontFamily: langFonts.regular }]}>
              {yesLabel ?? t('GENERAL.YES', 'Yes')}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.yesNoChip, homeTownSame === 'no' && styles.yesNoChipSelected]}
            onPress={() => setHomeTownSame('no')}
            accessibilityRole="radio"
            accessibilityState={{ selected: homeTownSame === 'no' }}
          >
            <View style={[styles.chipRadio, homeTownSame === 'no' && styles.chipRadioSelected]}>
              {homeTownSame === 'no' && <Text style={styles.chipRadioTick}>✓</Text>}
            </View>
            <Text style={[styles.yesNoLabel, { fontFamily: langFonts.regular }]}>
              {noLabel ?? t('GENERAL.NO', 'No')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  yesNoRow: {
    flexDirection: 'row',
    gap:           16,
    marginBottom:  28,
  },

  yesNoChip: {
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
  yesNoChipSelected: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.radioCheckedBg,
  },

  chipRadio: {
    width:          20,
    height:         20,
    borderRadius:   10,
    borderWidth:    1.5,
    borderColor:    Colors.borderNeutral,
    alignItems:     'center',
    justifyContent: 'center',
  },
  chipRadioSelected: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  chipRadioTick: {
    color:      Colors.surface,
    fontSize:   11,
    fontWeight: '700',
    lineHeight: 13,
  },

  // Angular: radio.component.html's type-1 label is always `body2-regular-14
  // line-height-16 black-color` — no medium/selected-weight variant exists for
  // the checked state (only the chip's border/background change). No explicit
  // lineHeight here (user preference: let RN's Text fall back to the font's
  // natural metric on onboarding screens even where Angular sets one).
  yesNoLabel: {
    fontSize:   FontSize.font14,
    fontWeight: '400',
    color:      Colors.black,
  },
})
