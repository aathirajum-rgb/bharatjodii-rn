// Message-quota gating for the one-to-one chat screen — Angular: messages.component.ts's
// getChatCount()/checkSetLimitValue()/becomePaidMemberPopUp(). Split from a prior version
// of this file that only covered the plain-success path; extended to cover every branch
// Angular's chatCount handler has (fair-usage exceeded, profile validation, invalid partner).
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem } from './storageService'
import { getSessionValue, getRegistrationArrays } from './registrationService'
import { getMenuPromo } from './paymentService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { decodeEntities } from '../utils/htmlEntities'

export type ChatLimitResult =
  | 'monthlyLimitExceeded'
  | 'weeklyLimitExceeded'
  | 'dailyLimitExceeded'
  | 'oneConversationOnly'
  | 'allowed'

export interface ChatCountResult {
  chatBalance:          string
  chatBalanceDetail:    any    // raw RESPONSE — checkChatLimit()'s chatData param
  profileValidation:    '0' | '1' | '2'   // 0=under validation 1=ok 2=rejected
  profileValidationMsg?: string
  // Angular's ERRCODE 13 branch does a SEPARATE round trip (getPPSETData +
  // getProfileValidationData) for this content, not ported anywhere in this
  // app. Reading PROBOTTOM straight off this same response instead (same
  // fallback fields communicationService.ts already uses for phoneviewed's
  // own ERRCODE 13) — unverified against a real chatCount ERRCODE 13 capture.
  profileValidationBottom?: { title: string; content: string; cta: string; image?: string }
  fairUsageExceeded:    boolean           // ERRCODE 11
  invalidPartner:       boolean           // RESPONSECODE 2 + ERRCODE 3
  invalidPartnerMsg?:   string
}

// ─── getChatCount ─────────────────────────────────────────────────────────────
// Angular: getChatCount() — TYPE=1 read call, a plain live API call every time
// it's invoked, with no client-side caching at all. A previous version of this
// function cached the result per-partner in storage, but that cache was never
// invalidated (no TTL, and the only clear function was never called anywhere
// in the app) — once a single successful call happened for a partner, every
// later refreshChatCount() (fired on every incoming/outgoing message) kept
// returning that same stale happy-path result forever, silently defeating the
// daily/weekly/monthly quota and profile-validation checks that depend on a
// fresh read. Removed the cache to match Angular's real (uncached) behavior.

export async function getChatCount(partnerId: string): Promise<ChatCountResult> {
  const loginId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const params  = `ID=${loginId}&PARTNERID=${partnerId}&TYPE=1`
  const result  = await apiCall(Endpoints.communication.chatCount, 'POST', params)

  const responseCode = String(result?.RESPONSECODE ?? '')
  const errCode       = String(result?.ERRCODE ?? '')

  if (responseCode === '1' && errCode === '0') {
    const resp = result.RESPONSE ?? {}
    const chatBalance = String(resp?.CHATBALANCE ?? '0')
    // Angular: getChatCount()'s ERRCODE:0 branch — a paid member who just hit
    // zero balance gets the renewal-enable flag set for the membership screen.
    if (chatBalance === '0') {
      const entryType = await getSessionValue('ENTRYTYPE')
      if (entryType === 'P') await setItem('RENEWALENABLEKEY', '1')
    }
    return { chatBalance, chatBalanceDetail: resp, profileValidation: '1', fairUsageExceeded: false, invalidPartner: false }
  }

  // Angular: ERRCODE 11 — fair usage policy limit exceeded (daily/weekly/
  // monthly/one-conversation caps), only meaningful before any real message
  // exists yet — checkChatLimit() does the actual daily/weekly/monthly compare.
  if (responseCode === '1' && errCode === '11') {
    const resp = result.RESPONSE ?? {}
    return { chatBalance: String(resp?.CHATBALANCE ?? '0'), chatBalanceDetail: resp, profileValidation: '1', fairUsageExceeded: true, invalidPartner: false }
  }

  // Angular: ERRCODE 10 — profile/photo under validation.
  if (errCode === '10') {
    return {
      chatBalance: '0', chatBalanceDetail: null, profileValidation: '0',
      profileValidationMsg: String(result?.RESPONSE?.MSG ?? ''),
      fairUsageExceeded: false, invalidPartner: false,
    }
  }

  // Angular: ERRCODE 13 — profile validation rejected.
  if (errCode === '13') {
    const bottom = result?.RESPONSE?.PROBOTTOM
    return {
      chatBalance: '0', chatBalanceDetail: null, profileValidation: '2',
      fairUsageExceeded: false, invalidPartner: false,
      ...(bottom ? {
        profileValidationBottom: {
          title:   String(bottom.TITLE ?? 'Profile under review'),
          content: String(bottom.CONTENT ?? 'Your profile is currently under review.'),
          cta:     String(bottom.CTA ?? 'Okay'),
          ...(bottom.IMG ? { image: bottom.IMG } : {}),
        },
      } : {}),
    }
  }

  // Angular: RESPONSECODE 2 + ERRCODE 3 — invalid MatriID, toast-only in Angular.
  if (responseCode === '2' && errCode === '3') {
    const msg = result?.RESPONSE?.MSG ?? result?.RESPONSE?.MESSAGE ?? result?.MSG ?? 'Invalid MatriID'
    return { chatBalance: '0', chatBalanceDetail: null, profileValidation: '1', fairUsageExceeded: false, invalidPartner: true, invalidPartnerMsg: String(msg) }
  }

  // Unrecognized shape — fail open (Angular's messageAllow defaults true and
  // nothing in this branch flips it either).
  return { chatBalance: '0', chatBalanceDetail: null, profileValidation: '1', fairUsageExceeded: false, invalidPartner: false }
}

// Angular: getSendResp()'s TYPE=2 chatCount call — fired once, right after the
// FIRST real message of a thread actually sends, to decrement the balance on
// the server. The caller always follows this with refreshChatCount() (a fresh
// getChatCount() read), so this doesn't need to cache/return the new balance
// itself.
export async function consumeChatCount(partnerId: string): Promise<void> {
  const loginId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const params  = `ID=${loginId}&PARTNERID=${partnerId}&TYPE=2`
  await apiCall(Endpoints.communication.chatCount, 'POST', params)
}

// ─── checkChatLimit ───────────────────────────────────────────────────────────
// Pure logic — no API call. chatData = a getChatCount() result's chatBalanceDetail,
// messageDetails = the socket thread's per-partner message counters (TOTALMSGCNT).

export function checkChatLimit(chatData: any, messageDetails: any): ChatLimitResult {
  if (!chatData || !messageDetails) return 'allowed'

  const { MONTHCNT, WEEKCNT, DAYCNT, MESALLOW } = messageDetails
  const { CHATMONTHLYCOUNT, CHATWEEKLYCOUNT, CHATDAILYCOUNT } = chatData

  if (MONTHCNT && MONTHCNT !== '0' && Number(MONTHCNT) >= Number(CHATMONTHLYCOUNT)) return 'monthlyLimitExceeded'
  if (WEEKCNT  && WEEKCNT  !== '0' && Number(WEEKCNT)  >= Number(CHATWEEKLYCOUNT))  return 'weeklyLimitExceeded'
  if (DAYCNT   && DAYCNT   !== '0' && Number(DAYCNT)   >= Number(CHATDAILYCOUNT))   return 'dailyLimitExceeded'
  if (MESALLOW && MESALLOW !== '0' && Number(MESALLOW)  > 1)                        return 'oneConversationOnly'

  return 'allowed'
}

// ─── Suggestion / template messages ────────────────────────────────────────
// Angular: getSuggestion() — canned conversation-starter messages shown once,
// the first time a thread has no messages yet (see ChatScreen.tsx's
// showSuggestions()). Angular's own placeholder substitution
// (`data.replace(reg, this.userName).replace('<City>', city)`, called inside
// a .map() callback that discards the return value) is a no-op in production
// since strings are immutable — this port does the substitution correctly
// instead of replicating that bug, since the whole point of the feature is a
// personalized message.

export async function fetchChatSuggestions(params: {
  createdBy: string
  memberCode: string
  lang: string
  name: string
  city: string
  gender: string
}): Promise<string[]> {
  const query = `type=chattemplate&ProfileCreatedBy=${encodeURIComponent(params.createdBy)}` +
    `&ccode=${encodeURIComponent(params.memberCode)}&LANG=${encodeURIComponent(params.lang)}` +
    `&name=${encodeURIComponent(params.name)}&location=${encodeURIComponent(params.city)}` +
    `&Gender=${encodeURIComponent(params.gender)}`
  const result = await apiCall(Endpoints.registration.initialFetch, 'POST', query)
  if (String(result?.RESPONSECODE) !== '1' || String(result?.ERRCODE) !== '0') return []

  const list = result?.RESPONSE?.CHATTEMPLATE
  if (!Array.isArray(list)) return []
  return list.map((s: any) =>
    decodeEntities(String(s).replace(/<Name>/g, params.name).replace(/<City>/g, params.city)),
  )
}

// ─── "Become a paid member" promo (chat-specific) ──────────────────────────────
// Angular: becomePaidMemberPopUp() — a different nbpaybanner request (TYPE=CHAT)
// than paymentService.ts's getPaymentConfig() (TYPE=PAYCONFIG), same endpoint.
// Field names on the RESPONSE are unverified against a real capture — logged so
// they can be corrected once tested.

export interface ChatPaymentPromo {
  title:     string
  content:   string
  ctaLabel:  string
  image?:    string
}

export async function fetchChatPaymentPromo(partnerName: string): Promise<ChatPaymentPromo | null> {
  const loginId   = (await getItem(SK.Auth.USER_ID)) ?? ''
  const entryType = (await getSessionValue('ENTRYTYPE')) ?? ''
  const params    = `ID=${loginId}&TYPE=CHAT&MEMBERSHIPTYPE=${entryType}&PRODUCTID=1&NAME=${encodeURIComponent(partnerName)}`
  const result    = await apiCall(Endpoints.payment.banner, 'POST', params)

  if (String(result?.ERRCODE ?? '') !== '0' || !result?.RESPONSE) return null
  const r = result.RESPONSE
  return {
    title:    String(r.TITLE ?? r.title ?? ''),
    content:  String(r.SUBTITLE ?? r.CONTENT ?? r.content ?? ''),
    ctaLabel: String(r.CTA ?? r.BUTTONTEXT ?? ''),
    ...(r.IMAGE || r.IMG ? { image: r.IMAGE ?? r.IMG } : {}),
  }
}

// ─── Paid-blocker / free-trial-expired banner (replaces the composer) ─────────
// Angular: getFestivalBannerData()/reDirectToMembership() — ALL THREE gates
// (paid-non-verified-ID, paid-verified-no-photo, free-trial-expired) render
// through the SAME banner block (messages.component.html:593-603), just with
// different content-source keys. subtitleTemplate is returned with its
// "##NAME##" placeholder intact — Angular substitutes it live at render time
// off basicViewDetail.VIEW.NAME (the partner's name, read fresh at render, not
// baked in at fetch time), so the caller should do the same substitution when
// rendering rather than here.

export type ChatBlockerBannerKind = 'non_verify_id' | 'verified_no_photo' | 'free_trial_expired'

export interface ChatBlockerBanner {
  title:            string
  subtitleTemplate: string
  ctaLabel:         string
}

export async function fetchChatBlockerBanner(kind: ChatBlockerBannerKind): Promise<ChatBlockerBanner | null> {
  if (kind === 'free_trial_expired') {
    const promo = await getMenuPromo(false)
    const page = promo?.MESSAGEPAGE
    if (!page) return null
    return {
      title:            String(page.TITLE ?? ''),
      subtitleTemplate: String(page.SUBTITLE ?? ''),
      ctaLabel:         String(page.CTA ?? ''),
    }
  }

  const arrays = await getRegistrationArrays()
  const cfg = kind === 'non_verify_id' ? arrays?.PROFILEVERIFYPAID?.Chat : arrays?.PHOTOPUBLISHPAID?.Chat
  if (!cfg) return null

  // Angular: getFestivalBannerData() — the CTA's own ##CSNUM## placeholder
  // (customer-support callback number) is substituted here, at fetch time,
  // unlike ##NAME## — it never changes for the life of the session.
  let ctaLabel = String(cfg.CTA ?? '')
  if (ctaLabel.includes('##CSNUM##')) {
    const callNum = (await getItem('VERIFIEDBYCALLNUM')) ?? ''
    ctaLabel = ctaLabel.replace(/##CSNUM##/g, callNum).replace('+91', '')
  }

  return {
    title:            String(cfg.TITLE ?? ''),
    subtitleTemplate: String(cfg.BODY ?? ''),
    ctaLabel,
  }
}
