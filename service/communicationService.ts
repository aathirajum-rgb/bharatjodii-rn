// Communication service — central profile-action dispatcher.
// Migrated from Angular communication.service.ts (827 lines).
// Angular showed Ionic modals directly; in RN this service returns ActionResult
// descriptors and components render the appropriate UI.

import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, getJson } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { getSessionValue } from './registrationService'
import { navigate } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'
import { resolveFemaleFreeAction } from './femaleFreeService'
import { redirectToIntermediatePage } from './paymentService'

// ─── Result types ─────────────────────────────────────────────────────────────
// Components switch on `type` to show the correct modal / sheet / alert.

export type CommActionResult =
  | { type: 'api_success';       data: any; action: string }
  | { type: 'show_contact';      contact: string; whatsapp: boolean }
  | { type: 'payment_promo';     action: string; profile: any }
  | { type: 'verify_id';         fromPage: string; action: string }
  | { type: 'female_free';       action: string; profile: any }
  | { type: 'chat_limit';        limitType: string }
  | { type: 'report_popup';      partnerId: string; profile: any }
  | { type: 'view_later_done' }
  | { type: 'skip_done' }
  | { type: 'error';             message: string }

export type CommunicationAction =
  | 'like' | 'dislike' | 'skip' | 'dontshow'
  | 'call' | 'whatsapp' | 'whatsappNudge'
  | 'jodimessages' | 'paynow' | 'viewlater'
  | 'reportprofile'

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

    case 'reportprofile':
      return { type: 'report_popup', partnerId, profile: oppProfile }

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
  const [entryType, ekycStatus, femaleFreeData, ppSetRaw] = await Promise.all([
    getSessionValue('ENTRYTYPE'),
    getItem('PI_EKYCSTATUS'),
    getSessionValue('FEMALEFREECONACT'),
    getJson<Record<string, any>>(SK.App.PP_SET_DATA),
  ])

  const photoStatus: string = (ppSetRaw as any)?.PI_PHOTOSTATUS ?? 'N'

  // Female free 3-contact promo
  if (entryType !== 'P' && femaleFreeData) {
    if (femaleFreeData.FEMALEFREECONACT === '1') {
      const femaleFreeAction = await resolveFemaleFreeAction(photoStatus, ekycStatus ?? '0')
      if (femaleFreeAction) {
        return { type: 'female_free', action: femaleFreeAction, profile: oppProfile }
      }
      // Eligible — show contact for free
      return showContactDetails(oppProfile, action === 'whatsapp' || action === 'whatsappNudge')
    }
  }

  // Non-ID verified user
  if (ekycStatus !== '1') {
    return { type: 'verify_id', fromPage, action }
  }

  // Free user → payment promo
  if (entryType !== 'P') {
    return { type: 'payment_promo', action, profile: oppProfile }
  }

  // Paid + verified → show contact
  return showContactDetails(oppProfile, action === 'whatsapp' || action === 'whatsappNudge')
}

async function showContactDetails(
  oppProfile: any,
  isWhatsapp: boolean,
): Promise<CommActionResult> {
  // Angular: getApiParams(profileId, 'phoneviewed') → ID&PARTNERID&LOGINGENDER&ENTRYTYPE
  const partnerId = String(oppProfile?.MATRIID ?? '')
  const params    = await getCommParams(partnerId, true)
  const result    = await apiCall(Endpoints.communication.phoneViewed, 'POST', params)

  if (result?.RESPONSECODE === '1' || result?.RESPONSECODE == 1) {
    const det = result.RESPONSE?.PHONEDET?.[0] ?? {}
    const cc  = det.PriMobileCountryCode ?? '+91'
    const num = det.MOBILE ?? det.MobileNo ?? det.MOBILENUMBER ?? ''
    const wa  = String(result.RESPONSE?.WHATSAPP ?? '').replace(/\D/g, '')
    const contact = num ? `${cc}${num}` : wa
    return {
      type:     'show_contact',
      contact:  isWhatsapp ? (wa || contact) : contact,
      whatsapp: isWhatsapp,
    }
  }
  return { type: 'error', message: 'Could not fetch contact' }
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
  if (result?.RESPONSECODE === '1' || result?.RESPONSECODE == 1) {
    return { type: 'api_success', data: result.RESPONSE, action }
  }
  return { type: 'error', message: result?.ERRORMESSAGE ?? 'Action failed' }
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
