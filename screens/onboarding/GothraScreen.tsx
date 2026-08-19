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
import SearchablePicker from '../../components/searchable-picker/SearchablePicker'
import { Colors } from '../../constants/colors'
import RegistrationSuccessSheet from '../../components/registration-success-sheet/RegistrationSuccessSheet'
import {
  fetchGothraOptions,
  getRegValue,
  setRegValue,
  submitFullRegistration,
  resolvePostInsertAction,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { resetTo } from '../../utils/navigationRef'
import { ENavigation } from '../../types/enums/navigation.enum'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'gothra.svg'
const FOOTER_H      = 140

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GothraScreen({ navigation }: Props) {
  const { t } = useTranslation()

  const [allOptions,    setAllOptions]    = useState<Option[]>([])
  const [fetching,      setFetching]      = useState(true)
  const [selected,      setSelected]      = useState<Option | null>(null)
  const [createdBy,     setCreatedBy]     = useState('4')
  const [submitting,    setSubmitting]    = useState(false)
  const [panelVisible,   setPanelVisible]   = useState(false)
  const [successVisible, setSuccessVisible] = useState(false)

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('GOTHRA'),
    ]).then(([cb, savedGothra]) => {
      if (cb) setCreatedBy(cb)

      fetchGothraOptions()
        .then(list => {
          setAllOptions(list)
          if (savedGothra) {
            const found = list.find(o => o.key === savedGothra)
            if (found) setSelected(found)
          }
        })
        .catch(() => {})
        .finally(() => setFetching(false))
    })
  }, [])

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

        <Text style={os.title}>{title}</Text>

        {fetching ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.fieldWrapper}>
            {/* Matches Religion/Caste: label only shows once a value is selected */}
            {!!selected && (
              <View style={styles.fieldLabelBadge}>
                <Text style={styles.fieldLabelText}>Gothram</Text>
              </View>
            )}
            <Pressable
              style={styles.selectField}
              onPress={() => setPanelVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Select gothram"
            >
              <Text
                style={[styles.selectFieldText, !!selected && styles.selectFieldTextActive]}
                numberOfLines={1}
              >
                {selected ? selected.label : 'Select Gothram'}
              </Text>
              <Text style={styles.selectFieldArrow}>›</Text>
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
        title="Select gothram"
        placeholder="Search gothram..."
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
  selectFieldText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  selectFieldTextActive: {
    fontWeight: '500',
  },
  selectFieldArrow: {
    fontSize:   22,
    color:      Colors.textPrimary,
    lineHeight: 26,
  },
})
