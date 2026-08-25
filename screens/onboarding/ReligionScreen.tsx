import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
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
  fetchReligionOptions,
  getRegValues,
  prefetchCasteForReligion,
  setRegValue,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'religion-updated.svg'
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

export default function ReligionScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  const [allOptions,   setAllOptions]   = useState<Option[]>([])
  const [fetching,     setFetching]     = useState(true)
  const [selected,     setSelected]     = useState<Option | null>(null)
  const [createdBy,    setCreatedBy]    = useState('4')
  const [mothertongue, setMothertongue] = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [panelVisible, setPanelVisible] = useState(false)

  // Extracted so a language change can re-run it — the option labels below are
  // server-translated. Angular: handleLanguageChange() → runInitialDataPopulation()
  // → getRegistrationDynamicArray(true, 1), then assignRegistrationData() re-resolves
  // the stored KEY against the newly translated list. Re-reading storage here does
  // the same, so the user's selection survives the switch.
  function loadOptions() {
    getRegValues().then(rv => {
      if (rv.CREATEDBY)    setCreatedBy(rv.CREATEDBY)
      if (rv.MOTHERTONGUE) setMothertongue(rv.MOTHERTONGUE)

      fetchReligionOptions()
        .then(list => {
          setAllOptions(list)
          if (rv.RELIGION) {
            const found = list.find(o => o.key === rv.RELIGION)
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
  const title = t('REGISTRATION.RELIGION', 'Select your #PROFILETYPE# religion')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  // Angular: registration.config.ts page 13 LISTDATA — LABEL: RELIGIONLABEL,
  // PLACEHOLDERTXT: SELECTRELIGION, ISSHOWSEARCHBAR: false.
  const fieldLabelText  = t('REGISTRATION.RELIGIONLABEL', 'Religion')
  const placeholderText = t('REGISTRATION.SELECTRELIGION', 'Select religion')

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await setRegValue('RELIGION', selected.key)
      navigation.push('onboarding', { pageNo: '14' })
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
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.fieldWrapper}>
            {/* Angular only shows this label once a value is selected */}
            {!!selected && (
              <View style={styles.fieldLabelBadge}>
                <Text style={[styles.fieldLabelText, { fontFamily: langFonts.regular }]}>{fieldLabelText}</Text>
              </View>
            )}
            <Pressable
              style={styles.selectField}
              onPress={() => setPanelVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Select religion"
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
        onSelect={(opt) => {
          setSelected(opt)
          prefetchCasteForReligion(opt.key, mothertongue)
        }}
        onClose={() => setPanelVisible(false)}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: { marginTop: 48 },

  fieldWrapper: {
    position:  'relative',
    marginTop: 8,
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
  // Angular's placeholder/value span is always black-color; only weight toggles
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
