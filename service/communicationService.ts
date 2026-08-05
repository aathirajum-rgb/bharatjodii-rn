// Communication service — central profile-action dispatcher.
// Migrated from Angular communication.service.ts (827 lines).
// Angular showed Ionic modals directly; in RN this service returns ActionResult
// descriptors and components render the appropriate UI.

import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, getJson, setJson } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { getSessionValue } from './registrationService'
import { navigate } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'
import { resolveFemaleFreeAction, getFemaleContactStatus } from './femaleFreeService'
import { redirectToIntermediatePage } from './paymentService'

// ─── Result types ─────────────────────────────────────────────────────────────
// Components switch on `type` to show the correct modal / sheet / alert.

export type CommActionResult =
  // message: Angular's like/dislike success toast text (data.RESPONSE.MSG) —
  // optional since most OTHER api_success actions (paynow, etc.) don't carry one.
  | { type: 'api_success';       data: any; action: string; message?: string | undefined }
  // `contact`/`whatsapp` are the original fields (kept so the two call sites
  // that haven't been migrated to the full Contact Details sheet yet —
  // ViewProfileScreen.tsx — keep working unchanged). The rest are the fields
  // the new sheet (MatchesScreen.tsx) needs: mobile/whatsappNumber together
  // (Angular's popup shows both, regardless of which CTA was tapped), and the
  // "Contacts viewed X/Y" counter (paid-entryType only — communication.service.ts
  // fields PHNUMBERVIEWED/PHNUMBERLEFT via phoneviewed's response).
  | {
      type: 'show_contact'; contact: string; whatsapp: boolean
      // mobile = bare number, for ON-SCREEN display only. dialNumber = the
      // SAME number with country code prefixed — the one actually dialed/
      // opened in WhatsApp (Angular: mobileNo vs phoneNo, modalpopup.
      // component.ts:436-441 — conflating these leaks the country code into
      // the display text, a previous bug here).
      mobile?: string | undefined; dialNumber?: string | undefined
      whatsappNumber?: string | undefined
      showCounter?: boolean | undefined
      // viewedCount = TOTALPHNUMBER - PHNUMBERLEFT (shared by both counters below).
      // remainingCount = PHNUMBERLEFT — feeds the CONFIRM step's own "Y remaining"
      // quota footer (see contactQuota in MatchesScreen.tsx/ViewProfileScreen.tsx).
      // totalCount = TOTALPHNUMBER — feeds THIS popup's own "Contacts viewed X/Y"
      // counter (ContactDetailsSheet.tsx) — a different pairing than remainingCount,
      // easy to conflate since both come off the same response.
      viewedCount?: string | undefined
      remainingCount?: string | undefined
      totalCount?: string | undefined
    }
  | { type: 'payment_promo';     action: string; profile: any }
  | { type: 'verify_id';         fromPage: string; action: string }
  | { type: 'female_free';       action: string; profile: any }
  | { type: 'chat_limit';        limitType: string }
  | { type: 'report_popup';      partnerId: string; profile: any }
  | { type: 'view_later_done' }
  | { type: 'skip_done' }
  // ── phoneviewed's other ERRCODE branches (button.component.ts /
  // communication.service.ts's afterHttpServiceResponse — all 8 confirmed
  // scenarios for this endpoint). Most of these carry SERVER-DRIVEN text
  // (data.RESPONSE.MSG / data.BODY / data.RESPONSE.HEADER etc.) — Angular
  // renders whatever the API sent, not fixed app strings, so these fields are
  // read straight off the response rather than hardcoded here. ──
  | { type: 'phone_protected' } // ERRCODE:14 — fixed i18n text (GENERAL.PROTECT_NUMBER*)
  | { type: 'under_validation'; message: string } // ERRCODE:10 — raw data.RESPONSE.MSG
  | { type: 'phone_limit_exceeded'; body: string; cta: string } // ERRCODE:11
  | { type: 'fup_limit'; header: string; body: string; cta: string; cta1: string } // ERRCODE:12
  | { type: 'profile_validation'; title: string; content: string; cta: string; image?: string | undefined } // RESPONSECODE:1,ERRCODE:13
  | { type: 'phone_number_left'; profile: any } // RESPONSECODE:3 — renewal/upgrade sub-flow, not yet built (see showContactDetails)
  // Angular communication.service.ts's afterHttpServiceResponse() ERRCODE:11 branch,
  // 'like' action only — daily like-limit reached (CONFIG.DAILYLIMITREACHCONFIG).
  // Angular emits onLimitExceedPopupClosed IMMEDIATELY here (not on sheet dismiss) so
  // daily-recommendation.component.ts's restoreDRCard() puts the swiped card straight
  // back — callers should restore optimistic UI as soon as this result comes back,
  // not wait for the limitReachInfo sheet's own dismiss.
  | { type: 'like_limit_exceeded'; body?: string | undefined }
  | { type: 'error';             message: string }

export type CommunicationAction =
  | 'like' | 'dislike' | 'skip' | 'dontshow'
  | 'call' | 'whatsapp' | 'whatsappNudge'
  | 'jodimessages' | 'paynow' | 'viewlater'
  | 'reportprofile'

// Angular: communication.service.ts's showContactDetails() (lines 253-271) —
// the REAL entry point for "View phone number"/Call, decides whether to skip
// the confirm popup and reveal contact details directly, or show the confirm
// step first. A previous version of this port always showed the confirm step
// unconditionally — this is the missing decision. Two of Angular's three
// direct-reveal conditions are implemented (both use data already available
// on MatchProfile/ContactGating); the third (PHONEPROTECTED != '0') isn't —
// it needs a field this port doesn't otherwise track anywhere, and its exact
// real-world trigger rate couldn't be confirmed against live data.
export function shouldSkipPhoneConfirm(
  phoneViewed: string, likedStatus: string, indNumbersLeft: string, entryType: string,
): boolean {
  // Already viewed this specific profile's number before — no need to ask again.
  if (['1', '3'].includes(phoneViewed)) return true
  // Mutual-like/shortlisted, paid, with quota left.
  if ((['2', '3'].includes(likedStatus) || phoneViewed === '2') && Number(indNumbersLeft) > 0 && entryType === 'P') return true
  return false
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function communicationBtnOnClick(
  fromPage: string,
  action: CommunicationAction,
  oppProfile: any,
): Promise<CommActionResult> {
  const partnerId = String(oppProfile?.MATRIID ?? oppProfile?.PARTNERID ?? '')

  switch (action) {
    case 'like':
    case 'dislike': {
      // Angular: getApiParams(partnerId, 'communication') → ID&PARTNERID&LOGINGENDER&ENTRYTYPE
      const params = await getCommParams(partnerId, true)
      return callHttpAction(action, 'POST', params, action)
    }

    case 'skip':
    case 'dontshow':
      return dontShowSection(partnerId, oppProfile, fromPage)

    case 'call':
    case 'whatsapp':
    case 'whatsappNudge':
      return showCallOrWhatsApp(fromPage, action, oppProfile)

    case 'jodimessages':
      return handleChat(fromPage, oppProfile)

    case 'viewlater':
      return callViewLater(partnerId, oppProfile, fromPage)

    case 'paynow':
      await redirectToIntermediatePage(fromPage)
      return { type: 'api_success', data: null, action: 'paynow' }

    case 'reportprofile': {
      // Angular matches-card.component.ts:262-270 clickOnReportProfile() →
      // communicationBtnOnClick fires a SILENT `communication/report/profile/v1`
      // hit BEFORE opening the reasons picker (communication.service.ts:139-141,
      // 485-488 reportProfilePopUp() only runs on that call's success) — a
      // previous version of this port skipped straight to the picker with no
      // API call at all.
      const params = await getCommParams(partnerId, false)
      const result = await apiCall(Endpoints.communication.reportProfile, 'POST', params)
      const ok = (result?.RESPONSECODE === '1' || result?.RESPONSECODE == 1)
        && (result?.ERRCODE === '0' || result?.ERRCODE == 0)
      if (!ok) return { type: 'error', message: String(result?.MSG ?? result?.RESPONSE?.MSG ?? 'Unable to report this profile right now.') }
      return { type: 'report_popup', partnerId, profile: oppProfile }
    }

    default:
      return { type: 'error', message: `Unknown action: ${action}` }
  }
}

// ─── Call / WhatsApp / WhatsApp nudge ─────────────────────────────────────────

async function showCallOrWhatsApp(
  fromPage: string,
  action: string,
  oppProfile: any,
): Promise<CommActionResult> {
  const [entryType, ekycStatus, femaleFreeData, ppSetRaw, gender, paidFlag] = await Promise.all([
    getSessionValue('ENTRYTYPE'),
    getItem('PI_EKYCSTATUS'),
    getSessionValue('FEMALEFREECONACT'),
    getJson<Record<string, any>>(SK.App.PP_SET_DATA),
    getItem(SK.User.LOGIN_GENDER),
    getItem(SK.Payment.PAY_P_FLAG),
  ])

  const photoStatus: string = (ppSetRaw as any)?.PI_PHOTOSTATUS ?? 'N'

  // Female free 3-contact promo
  if (entryType !== 'P' && femaleFreeData) {
    if (femaleFreeData.FEMALEFREECONACT === '1') {
      const femaleFreeAction = await resolveFemaleFreeAction(photoStatus, ekycStatus ?? '0')
      if (femaleFreeAction) {
        return { type: 'female_free', action: femaleFreeAction, profile: oppProfile }
      }
      // resolveFemaleFreeAction returns null once eKYC-verified — but that
      // only means the photo/verification gates are clear, NOT that the free
      // quota itself still has room (Angular's PHONENOLIMIT case).
      const { canViewContact } = await getFemaleContactStatus()
      if (!canViewContact) {
        return { type: 'female_free', action: 'femaleFree-LimitOver', profile: oppProfile }
      }
      // Eligible — show contact for free
      return showContactDetails(oppProfile, action === 'whatsapp' || action === 'whatsappNudge', entryType ?? '')
    }
  }

  // Angular common-funtions.ts:362-364 check_Paid_NonVerifyIdUser() — this gate
  // requires ALL THREE: entryType=='P' AND gender=='M' AND ekycStatus=='0' AND
  // getPaidFlag()=='1' (session key PAYPFLAG — a SEPARATE feature-enablement
  // flag from ENTRYTYPE, not redundant with it). Missing this last check was a
  // confirmed real bug: it made the gate over-fire for a real paid male user
  // whose PAYPFLAG wasn't '1', who should have gone straight to showContactDetails
  // (Angular's own fallback for that exact combination — verified via source).
  if (entryType === 'P' && gender === 'M' && ekycStatus !== '1' && paidFlag === '1') {
    return { type: 'verify_id', fromPage, action }
  }

  // Free user → payment promo
  if (entryType !== 'P') {
    return { type: 'payment_promo', action, profile: oppProfile }
  }

  // Paid + verified → show contact
  return showContactDetails(oppProfile, action === 'whatsapp' || action === 'whatsappNudge', entryType ?? '')
}

async function showContactDetails(
  oppProfile: any,
  isWhatsapp: boolean,
  entryType: string,
): Promise<CommActionResult> {
  // Angular: getApiParams(profileId, 'phoneviewed') → ID&PARTNERID&LOGINGENDER&ENTRYTYPE
  const partnerId = String(oppProfile?.MATRIID ?? '')
  const params    = await getCommParams(partnerId, true)
  const result    = await apiCall(Endpoints.communication.phoneViewed, 'POST', params)
  const errCode   = String(result?.ERRCODE ?? '')
  const isSuccessCode = result?.RESPONSECODE === '1' || result?.RESPONSECODE == 1

  // Angular button.component.ts/communication.service.ts afterHttpServiceResponse()
  // — ERRCODE is checked BEFORE assuming a RESPONSECODE:1 means real success;
  // RESPONSECODE:1 + ERRCODE:13 is the profile-validation branch, not success.
  // All 8 confirmed scenarios for this endpoint, checked in Angular's own order:

  // ERRCODE:14 — profile has protected their phone number. Shown INSTEAD of the
  // Contact Details sheet, not alongside it — fixed i18n text (not server-driven).
  if (errCode === '14') {
    return { type: 'phone_protected' }
  }

  // ERRCODE:10 — under photo validation. Angular renders data.RESPONSE.MSG
  // directly as raw text (no title/CTA at all, just a close-X) — server-driven.
  if (errCode === '10' && result?.RESPONSE?.MSG) {
    return { type: 'under_validation', message: String(result.RESPONSE.MSG) }
  }

  // ERRCODE:11 — view-limit exceeded. Angular's lowerpopup reads content?.BODY /
  // content?.CTA off the raw response itself (server-driven; the quoted defaults
  // are Angular's own template placeholders, used here only if the field is absent).
  if (errCode === '11') {
    return {
      type: 'phone_limit_exceeded',
      body: String(result?.BODY ?? result?.RESPONSE?.BODY ?? 'You have reached your limit to like matches for the day.'),
      cta:  String(result?.CTA ?? result?.RESPONSE?.CTA ?? 'Okay'),
    }
  }

  // ERRCODE:12 — fair-usage-policy phone-view limit. Two CTAs ("complete
  // verification" vs "continue with limited access") separated by an "OR" —
  // Angular's own template placeholders used as fallbacks, server-driven otherwise.
  // NOTE: Angular's primary CTA navigates to a `/fup-verify` re-verification flow
  // that doesn't exist anywhere in this port yet — that's a separate, larger
  // feature (its own screen), not just a bottom sheet; see MatchesScreen.tsx's
  // handler for how this is surfaced until that's built.
  if (errCode === '12') {
    return {
      type:   'fup_limit',
      header: String(result?.HEADER ?? result?.RESPONSE?.HEADER ?? 'You have reached the maximum limit of phone numbers you can view with this account!'),
      body:   String(result?.BODY ?? result?.RESPONSE?.BODY ?? 'Please complete the full verification to remove this limit or continue to view only 1 phone number per day.'),
      cta:    String(result?.CTA ?? result?.RESPONSE?.CTA ?? 'Complete full verification'),
      cta1:   String(result?.CTA1 ?? result?.RESPONSE?.CTA1 ?? 'Continue with limited access'),
    }
  }

  // RESPONSECODE:1, ERRCODE:13 — profile validation rejected. Angular sources
  // title/content/CTA/icon from a server-driven "PROBOTTOM" config that isn't
  // fetched anywhere in this port yet (no confirmed data source) — falls back to
  // a reasonable generic message until that config is wired up.
  if (isSuccessCode && errCode === '13') {
    return {
      type:    'profile_validation',
      title:   String(result?.RESPONSE?.PROBOTTOM?.TITLE ?? 'Profile under review'),
      content: String(result?.RESPONSE?.PROBOTTOM?.CONTENT ?? 'This profile is currently under verification. Please try again later.'),
      cta:     String(result?.RESPONSE?.PROBOTTOM?.CTA ?? 'Okay'),
      image:   result?.RESPONSE?.PROBOTTOM?.IMG ?? undefined,
    }
  }

  // RESPONSECODE:3 — phone-number-left/renewal sub-flow. Angular calls a SECOND
  // API (nbcustomer) then branches into a renewal or upgrade-promo screen
  // depending on entry type — a materially bigger feature than a bottom sheet,
  // not built here; surfaced as its own result type so the caller can show
  // something reasonable rather than silently failing.
  if (String(result?.RESPONSECODE ?? '') === '3') {
    return { type: 'phone_number_left', profile: oppProfile }
  }

  if (isSuccessCode) {
    const det = result.RESPONSE?.PHONEDET?.[0] ?? {}
    const cc  = det.PriMobileCountryCode ?? '+91'
    // Angular button.component.ts:613-664 — real field is PriMobileNo, not
    // MOBILE/MobileNo/MOBILENUMBER (kept as fallbacks in case an older/other
    // server response shape is ever hit).
    const num = det.PriMobileNo ?? det.MOBILE ?? det.MobileNo ?? det.MOBILENUMBER ?? ''
    const dialNumber = num ? `${cc}${num}` : undefined
    // Angular's WhatsApp button dials the SAME phone number as Call
    // (modalpopup.component.ts:439-458 — callNative('whatsapp') sends
    // `data.phoneNo`, identical to what callNative('dial_pad') sends).
    // RESPONSE.WHATSAPP is NOT a phone number at all — it's an optional
    // prefill-message object ({BODY, LINK, BOTTOMCONTENT}) used only to open
    // WhatsApp with pre-filled text when present. A previous version of this
    // code treated that object as if it WERE the WhatsApp number (stripping
    // non-digits from it), which produced an empty string and made the
    // WhatsApp button silently never show.
    const contact = dialNumber ?? ''

    // Angular communication.service.ts:604-615 — after a successful phoneviewed
    // call, the LOCAL contact-quota cache gets updated with these fields (merged
    // with whatever CONTACT_DETAIL already holds, e.g. expiryTextValue from the
    // separate nbcontacts load — see fetchContactDetails below).
    //
    // Two field-name variants exist in Angular itself: communication.service.ts
    // writes `phoneNumbersUsed`, but button.component.ts's own CONFIRMATION-step
    // reader (viewContactNoConfirmPopUp(), the popup this port replicates) reads
    // `phoneNumbersViewed` instead — write both so this port's own confirmation
    // sheet (which reads phoneNumbersViewed, see MatchesScreen.tsx) gets real data.
    //
    // Two DIFFERENT counters exist in Angular, easy to conflate since both come
    // off this same response:
    //  - Confirm-step footer (next profile's confirm dialog): "viewed X, Y
    //    REMAINING" — (viewedCount, remainingCount=PHNUMBERLEFT).
    //  - THIS Contact Details popup's own counter: "Contacts viewed X/Y" —
    //    (viewedCount, totalCount=TOTALPHNUMBER), not remaining. Angular:
    //    viewContactNoPopUp() (communication.service.ts:604-606).
    // `viewedCount` itself is shared by both and is a COMPUTED value
    // (TOTALPHNUMBER - PHNUMBERLEFT) — a previous version of this code read
    // the raw PHNUMBERVIEWED field for it instead, which is actually a
    // this-profile-only viewed FLAG ('0'/'1'), not a running total.
    const totalPhNumber  = Number(result.RESPONSE?.TOTALPHNUMBER ?? 0)
    const phNumberLeft   = Number(result.RESPONSE?.PHNUMBERLEFT ?? 0)
    const viewedCount    = String(totalPhNumber - phNumberLeft)
    const remainingCount = String(result.RESPONSE?.PHNUMBERLEFT ?? '')
    const totalCount     = String(totalPhNumber)
    const prevDetail = (await getJson<Record<string, any>>('CONTACT_DETAIL')) ?? {}
    await setJson('CONTACT_DETAIL', {
      ...prevDetail,
      phoneNumbersUsed:   result.RESPONSE?.PHNUMBERVIEWED,
      phoneNumbersViewed: result.RESPONSE?.PHNUMBERVIEWED,
      phoneNumbersLeft:   result.RESPONSE?.PHNUMBERLEFT,
      IndContactUsed:     result.RESPONSE?.INDPHNUMBERVIEWED,
      IndNumbersLeft:     result.RESPONSE?.INDPHNUMBERLEFT,
    })

    return {
      type:           'show_contact',
      contact,
      whatsapp:       isWhatsapp,
      // Angular keeps mobile display and dial values as two DIFFERENT values
      // (modalpopup.component.ts:436-441) — `mobileNo` (bare, e.g.
      // "6494048462") is what's shown on screen ([innerHTML]="data?.mobileNo"),
      // `phoneNo` (country-code prefixed, e.g. "+91 6494048462") is what's
      // actually dialed for BOTH Call and WhatsApp (callNative('dial_pad')
      // and callNative('whatsapp') both send data.phoneNo) — WhatsApp does
      // NOT use a separate number. A previous version of this code baked the
      // country code into the one `mobile` field (leaking it into the
      // display) AND tried to source a distinct WhatsApp number from
      // RESPONSE.WHATSAPP (actually a prefill-message object, not a number),
      // which made the WhatsApp button silently never show.
      mobile:         num || undefined,
      dialNumber,
      whatsappNumber: dialNumber,
      // Angular modalpopup.component.html:476-480 — counter row only for paid
      // entryType ('P'); free users don't see it at all.
      showCounter:    entryType === 'P',
      viewedCount,
      remainingCount,
      totalCount,
    }
  }

  // Scenario 8 — any other failure with a message: Angular just shows a toast
  // (presentToast), not a modal at all.
  const fallbackMsg = result?.RESPONSE?.MSG ?? result?.MSG
  return { type: 'error', message: fallbackMsg ? String(fallbackMsg) : 'Could not fetch contact' }
}

// ─── Contact quota (nbcontacts) ────────────────────────────────────────────────
// Angular common.ts:920-943 getContactDetails() — called on page load (Matches/
// Menu/Activity/Explore/ViewProfile) to populate the CONTACT_DETAIL cache (raw
// RESPONSE written as-is: IndNumbersLeft/phoneNumbersLeft/expiryTextValue/
// totalProfileCountData) so getIndNumbersLeft()-style reads have real data
// instead of the '0' fallback before any phoneviewed call has ever happened.
export async function fetchContactDetails(): Promise<void> {
  const [loginId, gender, entryType, femaleFreeData] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem(SK.User.LOGIN_GENDER),
    getSessionValue('ENTRYTYPE'),
    getSessionValue('FEMALEFREECONACT'),
  ])
  // AUTORENEWALFLAG has no confirmed session source in this port yet — Angular
  // reads it off the user's active-plan state, which isn't tracked client-side
  // here; '0' is a safe default (server treats missing/'0' as "not auto-renew").
  const params = `ID=${loginId ?? ''}&MEMBERSHIPTYPE=${entryType ?? ''}&LOGINGENDER=${gender ?? 'M'}` +
    `&AUTORENEWALFLAG=0&FREECONTACTS=${femaleFreeData?.FEMALEFREECONACT === '1' ? '1' : '0'}`
  const result = await apiCall(Endpoints.payment.contacts, 'POST', params)
  if (result?.RESPONSECODE === '1' || result?.RESPONSECODE == 1) {
    await setJson('CONTACT_DETAIL', result.RESPONSE ?? {})
  }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

async function handleChat(fromPage: string, oppProfile: any): Promise<CommActionResult> {
  const [entryType, ekycStatus, ppSetRaw] = await Promise.all([
    getSessionValue('ENTRYTYPE'),
    getItem('PI_EKYCSTATUS'),
    getJson<Record<string, any>>(SK.App.PP_SET_DATA),
  ])

  const photoStatus: string = (ppSetRaw as any)?.PI_PHOTOSTATUS ?? 'N'

  // Photo check for female users
  if (photoStatus === 'N') {
    return { type: 'female_free', action: 'femaleFree-PhotoAdd', profile: oppProfile }
  }

  if (ekycStatus !== '1') {
    return { type: 'verify_id', fromPage, action: 'jodimessages' }
  }

  if (entryType !== 'P') {
    return { type: 'payment_promo', action: 'jodimessages', profile: oppProfile }
  }

  navigate(ENavigation.CHAT_WINDOW, {
    partnerId:    String(oppProfile?.MATRIID ?? ''),
    partnerName:  oppProfile?.FIRSTNAME ?? '',
    partnerPhoto: oppProfile?.PHOTOTHUMB ?? '',
  })

  return { type: 'api_success', data: null, action: 'jodimessages' }
}

// ─── Skip / Don't show ───────────────────────────────────────────────────────

async function dontShowSection(
  partnerId: string,
  _oppProfile: any,
  _fromPage: string,
): Promise<CommActionResult> {
  // Angular: getApiParams(profileId, 'dontshow') → ID&PARTNERID&LOGINGENDER
  const params = await getCommParams(partnerId)
  const result = await apiCall(Endpoints.communication.skipProfile, 'POST', params)

  if (result?.RESPONSECODE === '1' && result?.ERRCODE === '0') {
    return { type: 'skip_done' }
  }
  return { type: 'error', message: 'Skip failed' }
}

// ─── View later ───────────────────────────────────────────────────────────────

async function callViewLater(
  partnerId: string,
  _oppProfile: any,
  _fromPage: string,
): Promise<CommActionResult> {
  // Angular: getApiParams(partnerId, 'viewlater') → ID&PARTNERID&LOGINGENDER
  const params = await getCommParams(partnerId)
  const result = await apiCall(Endpoints.communication.viewLater, 'POST', params)

  if (result?.RESPONSECODE === '1') {
    return { type: 'view_later_done' }
  }
  return { type: 'error', message: 'View later failed' }
}

// ─── Generic HTTP action ──────────────────────────────────────────────────────

async function callHttpAction(
  endpoint: string,
  method: 'POST' | 'GET',
  params: string,
  action: string,
): Promise<CommActionResult> {
  const url = (Endpoints.communication as Record<string, string>)[endpoint] ?? endpoint
  const result = await apiCall(url, method, params)
  // Angular communication.service.ts's afterHttpServiceResponse() — like/dislike
  // shows a toast built from `data.RESPONSE.MSG` on BOTH success ("You have
  // liked X's profile...") and failure ("You have already liked ." — the exact
  // case a live test hit) — this previously read a nonexistent `ERRORMESSAGE`
  // field, so no real message ever surfaced; the actual field is MSG (either
  // top-level or nested under RESPONSE depending on the response shape).
  const msg = result?.RESPONSE?.MSG ?? result?.MSG
  if (result?.RESPONSECODE === '1' || result?.RESPONSECODE == 1) {
    return { type: 'api_success', data: result.RESPONSE, action, message: msg ? String(msg) : undefined }
  }
  // Angular communication.service.ts:492-505 — ERRCODE:11 is checked BEFORE the
  // generic message fallback, and only 'like' shows the daily-limit sheet (any
  // other action with ERRCODE:11 falls through to Angular's generic
  // limitExceedPopup(), which this port doesn't need since only 'like' is
  // reachable via this function's own callers for that scenario today).
  if (action === 'like' && String(result?.ERRCODE ?? '') === '11') {
    const body = result?.BODY ?? result?.RESPONSE?.BODY
    return { type: 'like_limit_exceeded', body: body ? String(body).replace('<br>', '') : undefined }
  }
  return { type: 'error', message: msg ? String(msg) : 'Action failed' }
}

// ─── Report + block (3-dot menu) ───────────────────────────────────────────────
// Angular: GENERAL.REPORT_BLOCK_CTA ("Report and Block") bundles both actions
// under one confirm — ViewProfileScreen's 3-dot menu triggers this directly rather
// than the full reasons-picker flow (deferred — see plan).

export async function reportAndBlockProfile(partnerId: string): Promise<boolean> {
  const params = await getCommParams(partnerId)
  const [reportRes, blockRes] = await Promise.all([
    apiCall(Endpoints.communication.reportProfile, 'POST', params),
    apiCall(Endpoints.communication.blockProfile, 'POST', params),
  ])
  const ok = (r: any) => r?.RESPONSECODE === '1' || r?.RESPONSECODE == 1
  return ok(reportRes) || ok(blockRes)
}

// ─── Unblock (Ignored Profiles → "Blocked profiles" tab) ───────────────────────

export async function unblockProfile(partnerId: string): Promise<boolean> {
  const params = await getCommParams(partnerId)
  const res = await apiCall(Endpoints.communication.unblock, 'POST', params)
  return res?.RESPONSECODE === '1' || res?.RESPONSECODE == 1
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Angular getApiParams(partnerId, 'communication'/'phoneviewed') → includes ENTRYTYPE
// Angular getApiParams(partnerId, 'dontshow'/'viewlater')        → no ENTRYTYPE
async function getCommParams(partnerId: string, includeEntryType = false): Promise<string> {
  const loginId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const gender  = (await getItem(SK.User.LOGIN_GENDER)) ?? 'M'
  const base    = `ID=${loginId}&PARTNERID=${partnerId}&LOGINGENDER=${gender}`
  if (!includeEntryType) return base
  const entryType = (await getSessionValue('ENTRYTYPE')) ?? 'F'
  return `${base}&ENTRYTYPE=${entryType}`
}
