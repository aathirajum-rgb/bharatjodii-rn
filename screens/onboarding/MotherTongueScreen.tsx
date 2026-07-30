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
import {
  callPartialRegistrationAPI,
  fetchMotherTongueOptions,
  getRegValue,
  loadAndStoreStatesForMotherTongue,
  setRegValue,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'mother-tongue.svg'

function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').trim()
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MotherTongueScreen({ navigation }: Props) {
  const { t } = useTranslation()

  const [allOptions,   setAllOptions]   = useState<Option[]>([])
  const [fetching,     setFetching]     = useState(true)
  const [selected,     setSelected]     = useState<Option | null>(null)
  const [createdBy,    setCreatedBy]    = useState('4')
  const [submitting,   setSubmitting]   = useState(false)
  const [panelVisible, setPanelVisible] = useState(false)

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('MOTHERTONGUE'),
    ]).then(([cb, savedMT]) => {
      if (cb) setCreatedBy(cb)

      fetchMotherTongueOptions()
        .then(list => {
          const cleaned = list.map(o => ({ key: o.key, label: stripHtml(o.label) }))
          setAllOptions(cleaned)
          if (savedMT) {
            const found = cleaned.find(o => o.key === savedMT)
            if (found) setSelected(found)
          }
        })
        .catch(() => {})
        .finally(() => setFetching(false))
    })
  }, [])

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.MOTHERTONGUE', 'What is your #PROFILETYPE# mother tongue?')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

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

        <Text style={os.title}>{title}</Text>

        {fetching ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <Pressable
            style={[styles.selectField, !!selected && styles.selectFieldActive]}
            onPress={() => setPanelVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Select mother tongue"
          >
            <Text
              style={[styles.selectFieldText, !!selected && styles.selectFieldTextActive]}
              numberOfLines={1}
            >
              {selected ? selected.label : 'Select mother tongue'}
            </Text>
            <Text style={styles.selectFieldArrow}>›</Text>
          </Pressable>
        )}
      </ScrollView>

      <SearchablePicker
        visible={panelVisible}
        title="Select language"
        placeholder="Search language..."
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
  selectFieldActive: {},
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
