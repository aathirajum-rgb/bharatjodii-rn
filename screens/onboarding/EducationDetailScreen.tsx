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
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { SvgXml } from 'react-native-svg'
import { Colors } from '../../constants/colors'
import {
  fetchEducationGroupOptions,
  getRegValue,
  setRegValue,
  updateFewMoreDetail,
  type EducationGroupSection,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'
import { os } from './onboardingStyles'
import { getFewMoreDetailsNextPage } from './fewMoreDetailsFlow'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { useLanguageReload } from '../../hooks/useLanguageReload'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'qualification.svg'

// Angular's dropdown-field arrow is Ionic's "chevron-forward-outline" icon
// (see MotherTongueScreen.tsx's CHEVRON_FORWARD_XML) — not the plain '›' glyph
// SelectField.tsx uses elsewhere.
const CHEVRON_FORWARD_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M184 112l144 144-144 144"/></svg>`

// Angular's label strings embed a <span> for the "(Optional)" suffix styling —
// "Education <span class='body3-regular-12 color-808080'>(Optional)</span>"
// — the primary-color part before the span, and the #808080-grey "(Optional)"
// suffix from inside it. Used to render the two segments as separate Text
// nodes with different colors instead of flattening to plain text.
function splitOptionalLabel(s: string): { primary: string; secondary: string | null } {
  const match = s.match(/^(.*?)<span[^>]*>(.*?)<\/span>\s*$/)
  if (!match) return { primary: s.trim(), secondary: null }
  return { primary: match[1].trim(), secondary: match[2].trim() }
}

// Angular's label strings embed a <span> for the "(Optional)" suffix styling;
// RN renders plain text, so the markup is stripped. Used where the two-color
// split isn't needed (e.g. inside the field once a value is selected).
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
  const { t, i18n } = useTranslation()
  const langFonts = useLanguageFonts()

  const [groups,       setGroups]       = useState<EducationGroupSection[]>([])
  const [fetching,     setFetching]     = useState(true)
  const [selected,     setSelected]     = useState<PickerOption | null>(null)
  const [createdBy,    setCreatedBy]    = useState('1')
  const [submitting,   setSubmitting]   = useState(false)
  const [pickerOpen,   setPickerOpen]   = useState(false)

  // Extracted so a language change can re-run it — the group titles/option
  // labels below are server-translated. Angular: handleLanguageChange() →
  // runInitialDataPopulation() → getRegistrationDynamicArray(true, 1), then
  // assignRegistrationData() re-resolves the stored EDUGROUP key against the
  // newly translated list. Re-reading storage here does the same, so the
  // user's selection survives the switch. Same pattern as MotherTongueScreen.
  function loadOptions() {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('QUALIFICATION'),
      getRegValue('EDUGROUP'),
    ]).then(async ([cb, qual, savedGroup]) => {
      if (cb) setCreatedBy(cb)
      const sections = await fetchEducationGroupOptions(String(qual ?? '')).catch(() => [])
      setGroups(sections)
      if (savedGroup) {
        const found = sections.flatMap(s => s.options).find(o => o.key === savedGroup)
        setSelected(found ?? null)
      }
      setFetching(false)
    })
  }

  useEffect(() => { loadOptions() }, [])

  useLanguageReload(loadOptions)

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

  // Angular: registration-revamp.component.html's skip CTA is
  // *ngIf="SHOWSKIPBTN && !isInputFocused && (!showSkipBtn(regPageContent) || ...)",
  // and showSkipBtn() just returns showNextCTA (true once a valid value is
  // selected) for every page except the '20'/'29' overrides. So the skip
  // button is visible only while nothing is selected yet, and hides once a
  // value is picked — pages 34/35 aren't in the override list, so the
  // general rule applies here.
  function handleSkip() {
    advance()
  }

  useOnboardingFooter({
    nextLoading: submitting,
    onNext:      handleNext,
    showSkip:    !selected,
    skipLabel:   t('REGISTRATION.IWILLDOTHISLATER', "I'll do this later"),
    onSkip:      handleSkip,
    // i18n.language: skipLabel is translated, so re-push footer state on a
    // language change or it stays stuck on whatever language was active at mount.
  }, [submitting, selected, i18n.language])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.screen}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />
        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        {fetching ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 32 }} />
        ) : (
          // Angular: dropdown.component.html's floating label div is
          // *ngIf="isCheckValidValue() && showFloatingLabel" — the "Education
          // (Optional)" label only appears once a value is selected; before
          // that, only the placeholder text shows inside the box.
          <View style={styles.selectFieldWrapper}>
            {!!selected && (() => {
              const { primary, secondary } = splitOptionalLabel(
                t('REGISTRATION.EDUGROUPLABEL', "Education <span class='body3-regular-12 color-808080'>(Optional)</span>"),
              )
              return (
                <View style={styles.selectFieldLabel} pointerEvents="none">
                  <Text style={{ fontFamily: langFonts.regular }}>
                    <Text style={styles.selectFieldLabelText}>{primary}</Text>
                    {secondary != null && (
                      <Text style={[styles.selectFieldLabelText, styles.selectFieldLabelSecondary]}> {secondary}</Text>
                    )}
                  </Text>
                </View>
              )
            })()}
            <Pressable
              style={styles.selectField}
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.selectFieldText,
                  !!selected && styles.selectFieldTextActive,
                  { fontFamily: selected ? langFonts.medium : langFonts.regular },
                ]}
                numberOfLines={1}
              >
                {selected ? selected.label : stripTags(t('REGISTRATION.SELECTGROUP', 'Select education (Optional)'))}
              </Text>
              <SvgXml xml={CHEVRON_FORWARD_XML} width={24} height={24} />
            </Pressable>
          </View>
        )}
      </ScrollView>

      <SearchablePicker
        visible={pickerOpen}
        title={t('REGISTRATION.SELECTGROUPTITLE', 'Select education')}
        placeholder={t('REGISTRATION.SEARCHGROUP', 'Search education')}
        groups={groups}
        selectedKey={selected?.key}
        onSelect={opt => { setSelected(opt); setPickerOpen(false) }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Same pattern as MotherTongueScreen.tsx's select field, except the floating
// label is conditional on `selected` (Angular: isCheckValidValue() && showFloatingLabel).

const styles = StyleSheet.create({
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
  // Angular: EDUGROUPLABEL's <span class='body3-regular-12 color-808080'> —
  // the "(Optional)" suffix renders muted, not the label's primary color.
  selectFieldLabelSecondary: {
    color: Colors.textSecondary,
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
