// Angular: pages/webview/webview.page.ts's page_id "62" (JODII-453) ->
// handleNameGenderValidation() -> showOnboarding3EditSheet() (registration-
// modal-popup.component's SHOWONBOARDING3EDITFORM block). Triggered for
// members an AI content-moderation pass flags specifically on NAME/GENDER —
// a different field set from case 61's confirm2 form (ValidationScreen.tsx):
// NAME/GENDER aren't in CONFIRM2_EDITABLE_VIOLATION_FIELDS, so that screen
// can never surface them.
//
// Flow (Angular: onOnboarding3EditSubmit()): fetch current NAME/GENDER -> show
// the edit sheet -> re-run AI name/gender validation on submit -> a still-
// flagged name keeps the sheet open with a violation message (gender is not
// re-checked here, matching Angular exactly — only NAME's validation_status
// gates the sheet) -> once accepted, persist only the changed field(s) -> re-
// run full AI profile validation -> land on Validation (other violations
// remain) or the same success sheet registration completion uses.
//
// GENDER PERSISTENCE GAP (deliberate, matches Angular): Angular's own
// GENDER_EDIT_TYPE backend TYPE code is still blank/unwired as of this port —
// its saveOnboarding3EditValues() saves a changed gender to local state only
// and logs a warning, never calling the real update endpoint for it. This
// screen replicates that exact (incomplete) behavior rather than inventing a
// TYPE code. Confirm with the Angular/backend team before wiring gender to
// editProfileService's real endpoint — see FIELD_TYPE_CODE in
// service/editProfileService.ts, which has no GENDER entry today.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { getItem, setItem, setJson } from '../../service/storageService'
import { submitFieldChanges, type FieldChange } from '../../service/editProfileService'
import {
  fetchEditFormValuesForValidation, fetchGenderOptions, validateNameGender,
  parseNameGenderValidation, callAiProfileValidation, mapViolationFields,
  CONFIRM2_EDITABLE_VIOLATION_FIELDS, getRegValues, setRegValues,
  type GenderOption,
} from '../../service/registrationService'
import { resetTo } from '../../utils/navigationRef'
import { ENavigation } from '../../types/enums/navigation.enum'
import ConfirmNameGenderSheet from '../../components/bottom-sheet/ConfirmNameGenderSheet'
import RegistrationSuccessSheet from '../../components/registration-success-sheet/RegistrationSuccessSheet'
import ScreenTopInset from '../../components/screen/ScreenTopInset'

type Phase = 'loading' | 'edit' | 'success'

export default function NameGenderRevalidationScreen() {
  const { t } = useTranslation()

  const [phase,         setPhase]         = useState<Phase>('loading')
  const [name,          setName]          = useState('')
  const [gender,        setGender]        = useState('')
  const [genderOptions, setGenderOptions] = useState<GenderOption[]>([])
  const [createdBy,     setCreatedBy]     = useState('1')
  const [nameViolated,  setNameViolated]  = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  // Whether the post-save AI re-check found other (editable) violations still
  // outstanding — decides the success sheet's destination.
  const [pendingReview, setPendingReview] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const info = await fetchEditFormValuesForValidation()
      if (cancelled) return
      if (!info) { resetTo(ENavigation.MATCHES); return }

      const loginGender = ((await getItem(SK.User.LOGIN_GENDER)) ?? '').toUpperCase()
      const genderKey    = loginGender === 'F' ? '0' : '1'
      const options      = await fetchGenderOptions(info.createdBy ?? '1')
      if (cancelled) return

      setName(info.name ?? '')
      setGender(genderKey)
      setGenderOptions(options)
      setCreatedBy(info.createdBy ?? '1')
      setPhase('edit')
    })().catch(() => { if (!cancelled) resetTo(ENavigation.MATCHES) })
    return () => { cancelled = true }
  }, [])

  // Angular: onOnboarding3EditSubmit(). Runs with the sheet's own CTA spinner.
  async function handleSubmit(editedName: string, editedGender: string) {
    if (submitting) return
    setSubmitting(true)
    // Commit the just-typed values into this screen's own state BEFORE
    // validating — ConfirmNameGenderSheet re-seeds its internal input from
    // these props whenever `nameViolated` changes, so a violated re-render
    // must reflect what the member just submitted, not the original prefill
    // (same fix GenderScreen.tsx's handleSheetSubmit() already applies).
    setName(editedName)
    setGender(editedGender)

    try {
      const oldRv    = await getRegValues()
      const oldName  = oldRv.NAME ?? ''
      const oldGender = oldRv.GENDER ?? ''

      // 1. Re-run AI name/gender validation — a still-flagged name keeps the
      // member on the sheet. Angular only gates on NAME's validation_status
      // here (unlike onboarding's page-3 check, gender is not re-validated).
      try {
        const res = await validateNameGender(editedName, editedGender)
        if (parseNameGenderValidation(res).isNameViolated) {
          setNameViolated(true)
          setSubmitting(false)
          return
        }
      } catch {
        // A failed validation call must not trap the member on the sheet —
        // let them through, matching Angular's own try/catch-and-continue.
      }
      setNameViolated(false)

      // 2. Persist only the changed field(s) — not a full profile resubmit.
      const changes: FieldChange[] = []
      if (editedName && editedName !== oldName) {
        changes.push({ field: 'NAME', value: editedName, existingValue: oldName })
      }
      if (changes.length) {
        try { await submitFieldChanges(changes) } catch {}
      }
      if (editedGender && editedGender !== oldGender) {
        await setItem(SK.User.LOGIN_GENDER, editedGender === '0' ? 'F' : 'M')
        if (__DEV__) {
          console.warn('[NameGenderRevalidationScreen] gender edit saved locally only — no confirmed backend TYPE code yet (see header note)')
        }
      }
      await setRegValues({ NAME: editedName, GENDER: editedGender })

      // 3. Re-run full AI profile validation to decide where to land next.
      const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
      let hasOtherViolations = false
      try {
        const aiRes        = await callAiProfileValidation(userId, 2)
        const violationList = aiRes?.RESPONSE?.VIOLATIONFIELD
        await setJson('VIOLATIONFIELDS', violationList ?? [])
        const mapped = mapViolationFields(violationList)
        hasOtherViolations = mapped.some(f => CONFIRM2_EDITABLE_VIOLATION_FIELDS.includes(f))
      } catch {
        hasOtherViolations = false
      }

      setPendingReview(hasOtherViolations)
      setSubmitting(false)
      setPhase('success')
    } catch {
      setSubmitting(false)
    }
  }

  function handleSuccessContinue() {
    resetTo(pendingReview ? ENavigation.VALIDATION : ENavigation.MATCHES)
  }

  if (phase === 'loading') {
    return (
      <View style={styles.loading}>
        <ScreenTopInset style={styles.topInset} />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  // Angular: getOnboarding3Title()/getOnboarding3NameLabel()/getOnboarding3GenderLabel()
  // — REGISTRATION.CONFIRM_SHEET/CREATED_NAME/CREATED_GENDER with #PROFILETYPE#
  // resolved from CREATEDBY, same substitution GenderScreen.tsx uses.
  const possessiveKey   = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const profileType     = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const fillProfileType = (key: string, fallback: string) =>
    t(key, fallback).replace('#PROFILETYPE#', profileType).replace(/\s{2,}/g, ' ').trim()

  return (
    <View style={styles.screen}>
      <ScreenTopInset style={styles.topInset} />
      <ConfirmNameGenderSheet
        visible={phase === 'edit'}
        title={fillProfileType('REGISTRATION.CONFIRM_SHEET', 'Please confirm your #PROFILETYPE# details below')}
        name={name}
        gender={gender}
        genderOptions={genderOptions}
        nameLabel={fillProfileType('REGISTRATION.CREATED_NAME', '#PROFILETYPE# name')}
        genderLabel={fillProfileType('REGISTRATION.CREATED_GENDER', '#PROFILETYPE# gender')}
        nameViolated={nameViolated}
        submitting={submitting}
        onSubmit={handleSubmit}
      />
      <RegistrationSuccessSheet visible={phase === 'success'} onContinue={handleSuccessContinue} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.white },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  // Absolute so the strip doesn't add to the flex layout above and shift the
  // spinner off dead-center — `loading`'s own justifyContent:'center' must
  // keep centering exactly as before.
  topInset: { position: 'absolute', top: 0, left: 0, right: 0 },
})
