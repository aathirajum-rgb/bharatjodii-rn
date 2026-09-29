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
import RegistrationSuccessSheet from '../../components/registration-success-sheet/RegistrationSuccessSheet'
import {
  fetchGothraOptions,
  getRegValue,
  setRegValue,
  submitFullRegistration,
  resolvePostInsertAction,
} from '../../service/registrationService'
import { CDN_REG, CDN_LOTTIE } from '../../constants/cdn'
import CdnLottie from '../../components/CdnLottie'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { resetTo } from '../../utils/navigationRef'
import { ENavigation } from '../../types/enums/navigation.enum'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { useLanguageReload } from '../../hooks/useLanguageReload'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'gothra.svg'
const FOOTER_H      = 140

// Angular's dropdown-field arrow is Ionic's "chevron-forward-outline" icon —
// not a CDN-hosted image but a bundled Ionicons SVG (node_modules/ionicons/
// dist/svg/chevron-forward-outline.svg), colored via its "black-color" CSS
// class. Inlined here verbatim (stroke swapped from currentColor to a fixed
// black, since SvgXml doesn't inherit CSS color) for a pixel-exact match —
// same icon used on MotherTongueScreen's "select mother tongue" field.
const CHEVRON_FORWARD_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M184 112l144 144-144 144"/></svg>`

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GothraScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  const [allOptions,    setAllOptions]    = useState<Option[]>([])
  const [fetching,      setFetching]      = useState(true)
  const [selected,      setSelected]      = useState<Option | null>(null)
  const [createdBy,     setCreatedBy]     = useState('4')
  const [submitting,    setSubmitting]    = useState(false)
  const [panelVisible,   setPanelVisible]   = useState(false)
  const [successVisible, setSuccessVisible] = useState(false)

  // Extracted so a language change can re-run it — the option labels below are
  // server-translated. Angular: handleLanguageChange() → runInitialDataPopulation()
  // → getRegistrationDynamicArray(true, 1), then assignRegistrationData() re-resolves
  // the stored KEY against the newly translated list. Re-reading storage here does
  // the same, so the user's selection survives the switch.
  function loadOptions() {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('GOTHRA'),
    ]).then(([cb, savedGothra]) => {
      if (cb) setCreatedBy(cb)

      fetchGothraOptions()
        .then(list => {
          setAllOptions(list)
          // Prefer the persisted KEY (post-submit case), but fall back to the
          // in-memory selection's key — a gothram picked this session but not
          // yet submitted (handleNext() only writes GOTHRA on submit) has no
          // persisted value, so without this fallback its stale English-labeled
          // Option object never gets swapped for the newly translated one.
          const keyToResolve = savedGothra ?? selected?.key
          if (keyToResolve) {
            const found = list.find(o => o.key === keyToResolve)
            if (found) setSelected(found)
          }
        })
        .catch(() => {})
        .finally(() => setFetching(false))
    })
  }

  useEffect(() => { loadOptions() }, [])

  useLanguageReload(loadOptions)

  // ─── Derived ──────────────────────────────────────────────────────────────

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.GOTHRAM', 'Select your #PROFILETYPE# gothram')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await setRegValue('GOTHRA', selected.key)
      const res = await submitFullRegistration()
      if (res.matriId) {
        // Angular: callInsertApiAndHandleValidation() — the insert response's
        // AIVALIDATIONTYPE decides between the success sheet, the confirm
        // form, and the "profile under review" wait state.
        const action = await resolvePostInsertAction(res.aiValidationType, res.violationFields)
        if (action === 'success') setSuccessVisible(true)
        else resetTo(ENavigation.VALIDATION, action === 'underReview'
          ? { mode: 'underReview' }
          : { mode: 'confirm', violationFields: res.violationFields ?? [] })
      }
      // else: API cancelled or error — stay on screen so user can retry
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  useOnboardingFooter({ nextDisabled: !selected, nextLoading: submitting, onNext: handleNext }, [selected, submitting])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.screen}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={{ uri: CDN_PAGE_ICON }}
          style={os.pageIcon}
          contentFit="contain"
        />

        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        {fetching ? (
          <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} style={[styles.loader, { alignSelf: 'center' }]} />
        ) : (
          <View style={styles.fieldWrapper}>
            {/* Matches Religion/Caste: label only shows once a value is selected */}
            {!!selected && (
              <View style={styles.fieldLabelBadge}>
                <Text style={[styles.fieldLabelText, { fontFamily: langFonts.regular }]}>{t('REGISTRATION.GOTHRAMLABEL', 'Gothram')}</Text>
              </View>
            )}
            <Pressable
              style={styles.selectField}
              onPress={() => setPanelVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Select gothram"
            >
              <Text
                style={[
                  styles.selectFieldText,
                  !!selected && styles.selectFieldTextActive,
                  { fontFamily: selected ? langFonts.medium : langFonts.regular },
                ]}
                numberOfLines={1}
              >
                {selected ? selected.label : t('REGISTRATION.SELECTGOTHRAM', 'Select gothram')}
              </Text>
              <SvgXml xml={CHEVRON_FORWARD_XML} width={24} height={24} />
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}

      <RegistrationSuccessSheet
        visible={successVisible}
        onContinue={() => {
          setSuccessVisible(false)
          navigation.push('onboarding', { pageNo: '20' })
        }}
      />

      {/* Gothram picker */}
      <SearchablePicker
        visible={panelVisible}
        title={t('REGISTRATION.SELECTGOTHRAM', 'Select gothram')}
        placeholder={t('REGISTRATION.SEARCHGOTHRAM', 'Search gothram')}
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
