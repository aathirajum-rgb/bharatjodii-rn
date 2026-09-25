// Angular: onboarding/35 — registration.config.ts's page 35 (JODII-490's
// "few more details" chain, 20 → 34 → 35 → 27). An OPTIONAL free-text job
// description, shown for every occupation except "Not working"
// (JOB_DETAIL_HIDE_OCCUPATION = '8').
//
// Angular config: PAGENAME JOBDETAIL, TYPE reuses the 'name' form control so the
// same letters-only validation applies, ICONTYPE occupation.svg,
// ISINPUTEVENT true, SHOWSKIPBTN true with SKIPBTNTXT IWILLDOTHISLATER.
// Saved live via updprofileinfo (OCCDETAILS); that response's OCCDETAILSVALID
// flag can reject the text. Angular kept the user on the page for that; here
// the check runs in the background after Next (validateJobDetailInBackground)
// — the user always moves on, and a rejected value is simply emptied.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { Colors } from '../../constants/colors'
import { FontSize } from '../../src/theme/fonts'
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
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'occupation.svg'

// AI job-detail validation, run AFTER the user has already moved on (module
// scope, not tied to this screen's lifecycle — it must finish even though the
// screen unmounts on advance). The same updprofileinfo call both saves and
// validates: OCCDETAILSVALID '1' keeps the value (it then shows in Edit
// Profile's Job details); anything else empties it both locally and on the
// server, so a rejected entry never lingers on the profile.
async function validateJobDetailInBackground(value: string): Promise<void> {
  try {
    const { valid } = await updateFewMoreDetail('OCCDETAILS', value)
    if (valid) return
    await setRegValue('JOBDETAIL', '')
    await updateFewMoreDetail('OCCDETAILS', '')
  } catch {
    // Network failure — nothing was confirmed either way; leave it as saved.
  }
}

// Removes the browser's default black focus outline on web — TextInput renders
// as <input> there, and the outline would sit on top of our custom borderColor.
const webOutlineReset = { outlineStyle: 'none', outlineWidth: 0 } as any

// Angular's label strings embed a <span> for the "(Optional)" suffix styling —
// "Job details <span class='body3-regular-12 color-808080'>(Optional)</span>"
// — the primary-color part before the span, and the #808080-grey "(Optional)"
// suffix from inside it. Same helper as EducationDetailScreen.tsx's own
// splitOptionalLabel(), used to render the two segments as separate Text
// nodes with different colors instead of flattening to plain text.
function splitOptionalLabel(s: string): { primary: string; secondary: string | null } {
  const match = s.match(/^(.*?)<span[^>]*>(.*?)<\/span>\s*$/)
  if (!match) return { primary: s.trim(), secondary: null }
  return { primary: match[1].trim(), secondary: match[2].trim() }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OccupationDetailScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation()
  const langFonts = useLanguageFonts()

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

  // isValidJobDetailFormat() treats an empty value as valid (the field is
  // optional overall — skippable via SHOWSKIPBTN) but that's a submission
  // check, not a Next-button-enable check: Angular's shared form control
  // also carries Validators.required, so typed text must actually satisfy
  // the format AND reach the 3-char minimum (the real gate is the custom
  // symbolsOnlyAllowDotComma validator, not the weaker Validators.minLength(2)
  // also present on the control) before Next enables. An empty box still
  // can't press Next — only Skip moves on without typing anything.
  const trimmedValue = value.trim()
  const isValid = trimmedValue.length >= 3 && isValidJobDetailFormat(value)

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

    // Mirrors the Next button's disabled state (2-char minimum) — guards the
    // keyboard's "done"/submit action, which can still fire on an empty box
    // even while the footer's Next button is disabled. Silently no-ops
    // instead of showing an error: an empty/too-short box isn't a format
    // mistake, it just hasn't reached the enable threshold yet — Skip is the
    // way to move on from here, not Next.
    if (!isValid) return

    if (!isValidJobDetailFormat(value)) {
      setError(t('REG.ALPHABETONLY', 'Please enter valid characters'))
      return
    }

    setSubmitting(true)
    try {
      if (trimmed) {
        // Saved locally right away so the box still shows it if the user
        // comes back before the AI check answers; the check itself runs in
        // the background and never holds the user on this page.
        await setRegValue('JOBDETAIL', trimmed)
        validateJobDetailInBackground(trimmed)
      }
    } catch {
      // Optional field — a save failure must never trap the user mid-onboarding.
    } finally {
      setSubmitting(false)
    }
    await advance()
  }

  // Angular: SHOWSKIPBTN — skipping leaves JOBDETAIL untouched and moves on.
  function handleSkip() {
    advance()
  }

  // Angular: registration-revamp.component.html's skip CTA is
  // *ngIf="SHOWSKIPBTN && !isInputFocused && (!showSkipBtn(regPageContent) || ...)",
  // and showSkipBtn() just returns showNextCTA (true once the field is
  // valid/Next is enabled) for every page except the '20'/'29' overrides.
  // So the skip button is visible only while Next isn't enabled yet, and
  // hides once the typed text becomes valid — page 35 isn't in the override
  // list, so the general rule applies here too.
  useOnboardingFooter({
    nextDisabled: !isValid,
    nextLoading:  submitting,
    onNext:       handleNext,
    showSkip:     !isValid,
    skipLabel:    t('REGISTRATION.IWILLDOTHISLATER', "I'll do this later"),
    onSkip:       handleSkip,
    // i18n.language: skipLabel is translated, so re-push footer state on a
    // language change or it stays stuck on whatever language was active at mount.
  }, [isValid, submitting, i18n.language])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.screen}>
      {/* No KeyboardAvoidingView here — this screen only ever renders as
          OnboardingRouter's `renderContent()` output (navigation/AppStack.tsx),
          inside a shell that already wraps header + content + the persistent
          footer CTA in its OWN KeyboardAvoidingView. Nesting a second one here
          double-applied the keyboard compensation and left a large gap above
          the keyboard on iOS. */}
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />
        <Text style={[os.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        <View style={styles.inputOuter}>
          <TextInput
            ref={inputRef}
            style={[styles.inputBox, { borderColor, fontFamily: langFonts.medium }, webOutlineReset]}
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
          {/* Floating label chip — same treatment as NameScreen. Angular:
              JOBDETAILLABEL's <span class='body3-regular-12 color-808080'>
              keeps "(Optional)" muted grey, not the label's primary color. */}
          {(() => {
            const { primary, secondary } = splitOptionalLabel(
              t('REGISTRATION.JOBDETAILLABEL', "Job details <span class='body3-regular-12 color-808080'>(Optional)</span>"),
            )
            return (
              <View style={styles.labelWrap} pointerEvents="none">
                <Text style={{ fontFamily: langFonts.regular }}>
                  <Text style={styles.labelText}>{primary}</Text>
                  {secondary != null && (
                    <Text style={[styles.labelText, styles.labelTextSecondary]}> {secondary}</Text>
                  )}
                </Text>
              </View>
            )
          })()}
        </View>

        {!!error && <Text style={[os.errorText, { fontFamily: langFonts.regular }]}>{error}</Text>}
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  inputOuter: {
    position:  'relative',
    marginTop: 8,
  },
  // Angular: `ion-input class="body1-medium-14 black-color"`.
  inputBox: {
    height:            48,
    borderWidth:       1,
    borderColor:       Colors.inputBorder,
    borderRadius:      8,
    paddingHorizontal: 12,
    paddingVertical:   0,
    fontSize:          FontSize.font14,
    fontWeight:        '500',
    color:             Colors.black,
  },
  labelWrap: {
    position:          'absolute',
    top:               -8,
    left:              16,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
  },
  // Angular: the floating label div is `.floating body3-regular-12 black-color`.
  labelText: {
    fontSize:   FontSize.font12,
    fontWeight: '400',
    color:      Colors.black,
  },
  // Angular: JOBDETAILLABEL's <span class='body3-regular-12 color-808080'> —
  // the "(Optional)" suffix renders muted, not the label's primary color.
  // #808080 has no exact Colors.* token (textSecondary is #666666), so it's
  // used as a literal here, matching the same convention already used for
  // this exact class elsewhere (e.g. NotificationScreen.tsx's .time-notification).
  labelTextSecondary: {
    color: '#808080',
  },
})
