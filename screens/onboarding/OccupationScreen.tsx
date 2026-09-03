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
  fetchOccupationOptions,
  getRegValues,
  setRegValue,
  getRegValue,
} from '../../service/registrationService'
import { CDN_REG, CDN_LOTTIE } from '../../constants/cdn'
import CdnLottie from '../../components/CdnLottie'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'occupation.svg'
// Angular's dropdown-field arrow is Ionic's "chevron-forward-outline" icon —
// same one MotherTongueScreen/HeightScreen inline, for a pixel-exact match.
const CHEVRON_FORWARD_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M184 112l144 144-144 144"/></svg>`

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OccupationScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  const [allOptions,   setAllOptions]   = useState<Option[]>([])
  const [fetching,     setFetching]     = useState(true)
  const [selected,     setSelected]     = useState<Option | null>(null)
  const [createdBy,    setCreatedBy]    = useState('4')
  const [gender,       setGender]       = useState('1')
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
      getRegValues(),
    ]).then(([cb, rv]) => {
      const { GENDER: gnd, OCCUPATION: savedOcc } = rv as Record<string, string>
      if (cb)  setCreatedBy(cb)
      if (gnd) setGender(gnd)

      fetchOccupationOptions()
        .then(list => {
          setAllOptions(list)
          if (savedOcc) {
            const found = list.find(o => o.key === savedOcc)
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
  const title = t('REGISTRATION.OCCUPATION', 'What is your #PROFILETYPE# occupation?')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  const nextPage   = gender === '1' ? '12' : '13'

  // Angular: registration.config.ts LISTDATA — ISLABEL/LABEL: OCCUPATIONLABEL,
  // PLACEHOLDERTXT: SELECTOCCUPATION, ISSHOWSEARCHBAR: false.
  const fieldLabelText = t('REGISTRATION.OCCUPATIONLABEL', 'Occupation')
  const placeholderText = t('REGISTRATION.SELECTOCCUPATION', 'Select occupation')

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await setRegValue('OCCUPATION', selected.key)
      navigation.push('onboarding', { pageNo: nextPage })
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
          // Angular: registration-revamp.component.ts's enablePlaceHolder() —
          // the floating "Occupation" label only appears once a value is
          // selected, same conditional pattern as HeightScreen's exact-height field.
          <View style={styles.selectFieldWrapper}>
            {!!selected && (
              <View style={styles.selectFieldLabel} pointerEvents="none">
                <Text style={[styles.selectFieldLabelText, { fontFamily: langFonts.regular }]}>
                  {fieldLabelText}
                </Text>
              </View>
            )}
            <Pressable
              style={styles.selectField}
              onPress={() => setPanelVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Select occupation"
            >
              <Text
                style={[
                  styles.selectFieldText,
                  !!selected && styles.selectFieldTextActive,
                  { fontFamily: selected ? langFonts.medium : langFonts.regular },
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
        title={placeholderText}
        placeholder=""
        hideSearch
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
  selectFieldLabelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textPrimary,
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
  selectFieldText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  selectFieldTextActive: {
    fontWeight: '500',
  },
})
