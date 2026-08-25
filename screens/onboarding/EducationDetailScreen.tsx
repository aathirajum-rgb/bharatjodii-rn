// Angular: onboarding/34 — registration.config.ts's page 34 (JODII-490's
// "few more details" chain, 20 → 34 → 35 → 27). An OPTIONAL education-group
// picker, shown only when the qualification chosen on page 10 is a Bachelor's
// or Master's degree (EDU_DETAIL_KEYS = ['1','2']); every other qualification
// skips straight past it.
//
// Angular config: PAGENAME EDUGROUP, REGARRAYTYPE EDUCATIONDETAILS,
// ICONTYPE qualification.svg, ISDROPDOWN true, VISIBLETYPE 'SIDEPANEL',
// SHOWSKIPBTN true with SKIPBTNTXT REGISTRATION.IWILLDOTHISLATER.
// The value is saved live via updprofileinfo (EDUDETAILS), matching Angular —
// the profile already exists by this point in the flow.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Colors } from '../../constants/colors'
import {
  fetchEducationGroupOptions,
  getRegValue,
  setRegValue,
  updateFewMoreDetail,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import SelectField from '../../components/input/SelectField'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'
import { os } from './onboardingStyles'
import { getFewMoreDetailsNextPage } from './fewMoreDetailsFlow'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'qualification.svg'

// Angular's label strings embed a <span> for the "(Optional)" suffix styling;
// RN renders plain text, so the markup is stripped.
function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim()
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EducationDetailScreen({ navigation }: Props) {
  const { t } = useTranslation()

  const [options,      setOptions]      = useState<PickerOption[]>([])
  const [fetching,     setFetching]     = useState(true)
  const [selected,     setSelected]     = useState<PickerOption | null>(null)
  const [createdBy,    setCreatedBy]    = useState('1')
  const [submitting,   setSubmitting]   = useState(false)
  const [pickerOpen,   setPickerOpen]   = useState(false)

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('QUALIFICATION'),
      getRegValue('EDUGROUP'),
    ]).then(async ([cb, qual, savedGroup]) => {
      if (cb) setCreatedBy(cb)
      const list = await fetchEducationGroupOptions(String(qual ?? '')).catch(() => [])
      setOptions(list)
      if (savedGroup) setSelected(list.find(o => o.key === savedGroup) ?? null)
      setFetching(false)
    })
  }, [])

  // Angular: TITLE / TITLEMYSELF — "Provide your son's education" vs
  // "Provide your education" for a self-created profile.
  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const title = createdBy === '1'
    ? t('REGISTRATION.EDUCATIONDETAILMYSELF', 'Provide your education')
    : t('REGISTRATION.EDUCATIONDETAIL', 'Provide #PROFILETYPE# education')
        .replace('#PROFILETYPE#', possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : '')
        .replace(/\s{2,}/g, ' ')
        .trim()

  async function advance() {
    const next = await getFewMoreDetailsNextPage('34')
    navigation.push('onboarding', { pageNo: next })
  }

  async function handleNext() {
    if (submitting) return
    setSubmitting(true)
    try {
      if (selected) {
        await setRegValue('EDUGROUP', selected.key)
        await updateFewMoreDetail('EDUDETAILS', selected.key)
      }
      await advance()
    } catch {
      // Optional field — a save failure must never trap the user mid-onboarding.
      await advance()
    } finally {
      setSubmitting(false)
    }
  }

  // Angular: SHOWSKIPBTN — skipping leaves EDUGROUP untouched and moves on.
  function handleSkip() {
    advance()
  }

  useOnboardingFooter({
    nextLoading: submitting,
    onNext:      handleNext,
    showSkip:    true,
    skipLabel:   t('REGISTRATION.IWILLDOTHISLATER', "I'll do this later"),
    onSkip:      handleSkip,
  }, [submitting, selected])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.screen}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />
        <Text style={os.title}>{title}</Text>

        {fetching ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 32 }} />
        ) : (
          <SelectField
            label={stripTags(t('REGISTRATION.EDUGROUPLABEL', 'Education (Optional)'))}
            value={selected?.label}
            placeholder={stripTags(t('REGISTRATION.SELECTGROUP', 'Select education (Optional)'))}
            onPress={() => setPickerOpen(true)}
          />
        )}
      </ScrollView>

      <SearchablePicker
        visible={pickerOpen}
        title={t('REGISTRATION.SELECTGROUPTITLE', 'Select education')}
        placeholder={t('REGISTRATION.SEARCHGROUP', 'Search education')}
        options={options}
        selectedKey={selected?.key}
        onSelect={opt => { setSelected(opt); setPickerOpen(false) }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  )
}
