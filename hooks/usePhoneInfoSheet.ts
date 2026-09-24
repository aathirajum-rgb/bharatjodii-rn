// The ~10 non-"show contact" phoneviewed/pre-flight outcomes communicationBtnOnClick
// can return (phone protected, under validation, limit exceeded, FUP limit,
// profile validation, phone-number-left, ID-verify prompt, and the 4 reachable
// female-free-contact variants) — extracted from MatchesScreen.tsx's own inline
// handling (getPhoneInfoSheetData()/handlePhoneInfoPrimaryPress()/
// handleContactConfirmYes()'s big if/else chain) so any other screen that
// dispatches through communicationBtnOnClick (e.g. ActivityScreen's liked-
// profile tabs) shows the same real sheets instead of a generic fallback
// alert. MatchesScreen itself keeps its own inline copy for now — not
// migrated here, to avoid touching an already-large, working screen.
import { useCallback, useMemo, useState } from 'react'
import type { BottomSheetData } from '../components/bottom-sheet/BottomSheet'
import { buildVerifyIdSheet, type CommActionResult } from '../service/communicationService'

export type PhoneInfoSheet =
  | { kind: 'phone_protected' }
  | { kind: 'under_validation'; message: string }
  | { kind: 'phone_limit_exceeded'; body: string; cta: string }
  | { kind: 'fup_limit'; header: string; body: string; cta: string; cta1: string }
  | { kind: 'profile_validation'; title: string; content: string; cta: string; image?: string | undefined }
  | { kind: 'phone_number_left' }
  | { kind: 'verify_id'; title: string; content: string; ctaLabel: string; image?: string | undefined; ctaIcon?: string | undefined; pinkWash?: boolean | undefined }
  | { kind: 'female_free_photo_add' }
  | { kind: 'female_free_photo_pending' }
  | { kind: 'female_free_photo_fail' }
  | { kind: 'female_free_call_verification' }
  | { kind: 'female_free_limit_over' }

const FEMALE_FREE_KIND_BY_ACTION: Record<string, PhoneInfoSheet['kind'] | undefined> = {
  'femaleFree-PhotoAdd':     'female_free_photo_add',
  'femaleFree-PhotoPending': 'female_free_photo_pending',
  'femaleFree-PhotoFail':    'female_free_photo_fail',
  'callVerification':        'female_free_call_verification',
  'femaleFree-LimitOver':    'female_free_limit_over',
}

export function usePhoneInfoSheet() {
  const [sheet, setSheet] = useState<PhoneInfoSheet | null>(null)

  // Returns true if `result` was one of the kinds this hook owns (caller
  // should stop processing); false if the caller still needs to handle it
  // (show_contact / payment_promo / error / api_success, etc.).
  // Wrapped in useCallback (here and below) so callers that build their own
  // memoized callbacks around this hook's return value (e.g. ChatScreen.tsx's
  // renderRow) get a referentially stable object instead of a new one every
  // render, which would otherwise silently defeat that memoization.
  const handleResult = useCallback(async (result: CommActionResult): Promise<boolean> => {
    switch (result.type) {
      case 'phone_protected':
        setSheet({ kind: 'phone_protected' }); return true
      case 'under_validation':
        setSheet({ kind: 'under_validation', message: result.message }); return true
      case 'phone_limit_exceeded':
        setSheet({ kind: 'phone_limit_exceeded', body: result.body, cta: result.cta }); return true
      case 'fup_limit':
        setSheet({ kind: 'fup_limit', header: result.header, body: result.body, cta: result.cta, cta1: result.cta1 }); return true
      case 'profile_validation':
        setSheet({ kind: 'profile_validation', title: result.title, content: result.content, cta: result.cta, image: result.image }); return true
      case 'phone_number_left':
        setSheet({ kind: 'phone_number_left' }); return true
      case 'verify_id': {
        // Angular communication.service.ts's navigateToVerify() — content is
        // server-driven, from ONE of two different registration-array configs
        // depending on which gate fired: PROFILEVERIFYPAID.Shortlist for the
        // plain not-yet-verified case, PHOTOPUBLISHPAID.Shortlist for the
        // verified-but-no-photo case (result.photoUpload). The ##CSNUM##
        // support-number placeholder only ever appears in CTA, not CONTENT
        // (communication.service.ts:640-642).
        const verifySheet = await buildVerifyIdSheet(!!result.photoUpload)
        setSheet({ kind: 'verify_id', ...verifySheet })
        return true
      }
      case 'female_free': {
        const kind = FEMALE_FREE_KIND_BY_ACTION[result.action]
        if (kind) { setSheet({ kind } as PhoneInfoSheet); return true }
        return false
      }
      default:
        return false
    }
  }, [])

  // Maps each kind onto BottomSheet's generic data shape — same mapping
  // MatchesScreen.tsx's getPhoneInfoSheetData() uses. `t` typed as `any` since
  // i18next's real TFunction overload set doesn't structurally assign to any
  // plain function type once a fallback second arg is involved.
  const getData = useCallback((t: any): BottomSheetData => {
    if (!sheet) return {}
    switch (sheet.kind) {
      case 'phone_protected':
        return {
          image: 'protected-phoneno.svg',
          title: t('GENERAL.PROTECT_NUMBER').replace(/<br\s*\/?>/gi, ' '),
          content: `${t('GENERAL.PROTECT_NUMBER_SUB')}\n\n${t('GENERAL.PROTECT_NUMBER_NOTE')}`,
          ctaLabel: t('GENERAL.OK_CTA', 'OK'),
        }
      case 'under_validation':
        return { content: sheet.message }
      case 'phone_limit_exceeded':
        return { content: sheet.body, ctaLabel: sheet.cta }
      case 'fup_limit':
        return {
          title: sheet.header, content: sheet.body, ctaLabel: sheet.cta,
          orCtaText: t('GENERAL.OR', 'OR'), linkCtaLabel: sheet.cta1,
        }
      case 'profile_validation':
        return { image: sheet.image, title: sheet.title, content: sheet.content, ctaLabel: sheet.cta }
      case 'phone_number_left':
        return {
          title: t('GENERAL.SORRY', 'Sorry'),
          content: 'Full renewal verification isn’t available in this app yet — please try again from a different profile for now.',
          ctaLabel: t('GENERAL.OK_CTA', 'OK'),
        }
      case 'verify_id':
        return { title: sheet.title, content: sheet.content, ctaLabel: sheet.ctaLabel, image: sheet.image, ctaIcon: sheet.ctaIcon, pinkWash: sheet.pinkWash }
      case 'female_free_photo_pending':
        return {
          title: 'Your photo is under validation!',
          content: 'This may take up to 2 hours. You can view phone numbers after that',
          ctaLabel: t('GENERAL.OK_CTA', 'OK'),
        }
      case 'female_free_photo_add':
      case 'female_free_photo_fail':
        return {
          title: `Add your photo to get 5 free contacts or get a paid membership to view #HISHER# phone number`,
          ctaLabel: 'Become a paid member', secondaryCtaLabel: 'Add photo now', showSecondaryCta: true,
        }
      case 'female_free_call_verification':
        return {
          title: `Contact us to get 5 more free contacts or get a paid membership to view #HISHER# phone number`,
          ctaLabel: 'Become a paid member', secondaryCtaLabel: 'Call now', showSecondaryCta: true,
        }
      case 'female_free_limit_over':
        return {
          title: 'You have reached the maximum free phone number views limit!',
          content: 'Become a paid member to view more phone numbers of matches',
          ctaLabel: 'Become paid member',
        }
    }
  }, [sheet])

  const close = useCallback(() => setSheet(null), [])

  // "Become a paid member" across the female-free variants, and verify_id's
  // own CTA, both point at the same upgrade path MatchesScreen uses.
  const primaryPress = useCallback((navigation: any) => {
    const kind = sheet?.kind
    setSheet(null)
    if (kind === 'female_free_photo_add' || kind === 'female_free_photo_fail'
      || kind === 'female_free_call_verification' || kind === 'female_free_limit_over') {
      navigation.navigate('recharge')
    }
  }, [sheet])

  // openAddPhoto is hooks/useAddPhotoPicker.ts's trigger — passed in rather than
  // called via navigation.navigate('Gallery') directly, since that route has no
  // web implementation (see that hook's own header comment for why).
  const secondaryPress = useCallback((openAddPhoto: (navigation: any) => void, navigation: any) => {
    const kind = sheet?.kind
    setSheet(null)
    if (kind === 'female_free_photo_add' || kind === 'female_free_photo_fail') {
      openAddPhoto(navigation)
    }
  }, [sheet])

  return useMemo(
    () => ({ sheet, handleResult, getData, close, primaryPress, secondaryPress }),
    [sheet, handleResult, getData, close, primaryPress, secondaryPress],
  )
}
