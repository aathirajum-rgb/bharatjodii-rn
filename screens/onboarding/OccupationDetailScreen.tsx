// Angular: onboarding/35 — registration.config.ts's page 35 (JODII-490's
// "few more details" chain, 20 → 34 → 35 → 27). An OPTIONAL free-text job
// description, shown for every occupation except "Not working"
// (JOB_DETAIL_HIDE_OCCUPATION = '8').
//
// Angular config: PAGENAME JOBDETAIL, TYPE reuses the 'name' form control so the
// same letters-only validation applies, ICONTYPE occupation.svg,
// ISINPUTEVENT true, SHOWSKIPBTN true with SKIPBTNTXT IWILLDOTHISLATER.
// Saved live via updprofileinfo (OCCDETAILS); that response's OCCDETAILSVALID
// flag can reject the text, in which case Angular keeps the user on the page.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import {
  getRegValue,
  isValidJobDetailFormat,
  setRegValue,
  updateFewMoreDetail,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'
import { getFewMoreDetailsNextPage } from './fewMoreDetailsFlow'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'occupation.svg'

// Removes the browser's default black focus outline on web — TextInput renders
// as <input> there, and the outline would sit on top of our custom borderColor.
const webOutlineReset = { outlineStyle: 'none', outlineWidth: 0 } as any

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

export default function OccupationDetailScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [value,      setValue]      = useState('')
  const [createdBy,  setCreatedBy]  = useState('1')
  const [error,      setError]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isFocused,  setIsFocused]  = useState(false)

  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('JOBDETAIL'),
    ]).then(([cb, saved]) => {
      if (cb)    setCreatedBy(cb)
      if (saved) setValue(saved)
    })
  }, [])

  // Angular: TITLE / TITLEMYSELF
  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const title = createdBy === '1'
    ? t('REGISTRATION.OCCUPATIONDETAILMYSELF', 'Mention your occupation')
    : t('REGISTRATION.OCCUPATIONDETAIL', 'Mention your #PROFILETYPE# occupation')
        .replace('#PROFILETYPE#', possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : '')
        .replace(/\s{2,}/g, ' ')
        .trim()

  // Optional field, so an empty value is valid — matches isValidJobDetailFormat().
  const isValid = isValidJobDetailFormat(value)

  const borderColor = isFocused
    ? Colors.inputFocus
    : error
      ? Colors.inputError
      : Colors.inputBorder

  async function advance() {
    const next = await getFewMoreDetailsNextPage('35')
    navigation.push('onboarding', { pageNo: next })
  }

  async function handleNext() {
    if (submitting) return
    const trimmed = value.trim()

    if (!isValidJobDetailFormat(value)) {
      setError(t('REG.ALPHABETONLY', 'Please enter valid characters'))
      return
    }

    setSubmitting(true)
    try {
      if (trimmed) {
        // Angular: OCCDETAILSVALID === '1' accepts; anything else keeps the user
        // on the page so they can correct the text.
        const { valid } = await updateFewMoreDetail('OCCDETAILS', trimmed)
        if (!valid) {
          setError(t('REG.ALPHABETONLY', 'Please enter valid characters'))
          return
        }
        await setRegValue('JOBDETAIL', trimmed)
      }
      await advance()
    } catch {
      // Optional field — a save failure must never trap the user mid-onboarding.
      await advance()
    } finally {
      setSubmitting(false)
    }
  }

  // Angular: SHOWSKIPBTN — skipping leaves JOBDETAIL untouched and moves on.
  function handleSkip() {
    advance()
  }

  useOnboardingFooter({
    nextDisabled: !isValid,
    nextLoading:  submitting,
    onNext:       handleNext,
    showSkip:     true,
    skipLabel:    t('REGISTRATION.IWILLDOTHISLATER', "I'll do this later"),
    onSkip:       handleSkip,
  }, [isValid, submitting])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.screen}>
      <KeyboardAvoidingView
        style={os.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
      >
        <ScrollView
          style={os.flex1}
          contentContainerStyle={os.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />
          <Text style={os.title}>{title}</Text>

          <View style={styles.inputOuter}>
            <TextInput
              ref={inputRef}
              style={[styles.inputBox, { borderColor }, webOutlineReset]}
              value={value}
              onChangeText={text => { setValue(text); if (error) setError('') }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              cursorColor={Colors.textPrimary}
              selectionColor={Colors.textPrimary}
              placeholder={t('REGISTRATION.JOBDETAILPLACEHOLDER', 'Eg: Sales manager')}
              placeholderTextColor={Colors.inputBorder}
              autoCapitalize="sentences"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleNext}
            />
            {/* Floating label chip — same treatment as NameScreen */}
            <View style={styles.labelWrap} pointerEvents="none">
              <Text style={styles.labelText}>
                {stripTags(t('REGISTRATION.JOBDETAILLABEL', 'Job details (Optional)'))}
              </Text>
            </View>
          </View>

          {!!error && <Text style={os.errorText}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  inputOuter: {
    position:  'relative',
    marginTop: 8,
  },
  inputBox: {
    height:            48,
    borderWidth:       1,
    borderColor:       Colors.inputBorder,
    borderRadius:      8,
    paddingHorizontal: 12,
    paddingVertical:   0,
    fontSize:          14,
    fontWeight:        '500',
    color:             Colors.textPrimary,
  },
  labelWrap: {
    position:          'absolute',
    top:               -8,
    left:              16,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
  },
  labelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
})
