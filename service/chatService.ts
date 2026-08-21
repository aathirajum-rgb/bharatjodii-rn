// Message-quota gating for the one-to-one chat screen — Angular: messages.component.ts's
// getChatCount()/checkSetLimitValue()/becomePaidMemberPopUp(). Split from a prior version
// of this file that only covered the plain-success path; extended to cover every branch
// Angular's chatCount handler has (fair-usage exceeded, profile validation, invalid partner).
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, getJson, setItem, setJson, removeItem } from './storageService'
import { getSessionValue } from './registrationService'
import { StorageKeys as SK } from '../constants/storage.keys'

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
// Angular: getChatCount() — TYPE=1 read call. Cached per-PARTNER (the previous
// version of this file cached under one flat key shared across every chat,
// which would silently show one partner's balance while chatting with another).

export async function getChatCount(partnerId: string): Promise<ChatCountResult> {
  const balanceKey = `CHATBALANCE_${partnerId}`
  const detailKey  = `CHATBALANCEDETAIL_${partnerId}`

  const cachedBalance = await getItem(balanceKey)
  if (cachedBalance) {
    const cachedDetail = await getJson<any>(detailKey)
    return { chatBalance: cachedBalance, chatBalanceDetail: cachedDetail, profileValidation: '1', fairUsageExceeded: false, invalidPartner: false }
  }

  const loginId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const params  = `ID=${loginId}&PARTNERID=${partnerId}&TYPE=1`
  const result  = await apiCall(Endpoints.communication.chatCount, 'POST', params)
  console.log('[chatService] getChatCount raw response', result)

  const responseCode = String(result?.RESPONSECODE ?? '')
  const errCode       = String(result?.ERRCODE ?? '')

  if (responseCode === '1' && errCode === '0') {
    const resp = result.RESPONSE ?? {}
    const chatBalance = String(resp?.CHATBALANCE ?? '0')
    await setItem(balanceKey, chatBalance)
    await setJson(detailKey, resp)
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
// FIRST real message of a thread actually sends, to decrement the balance.
export async function consumeChatCount(partnerId: string): Promise<void> {
  const loginId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const params  = `ID=${loginId}&PARTNERID=${partnerId}&TYPE=2`
  const result  = await apiCall(Endpoints.communication.chatCount, 'POST', params)
  console.log('[chatService] consumeChatCount raw response', result)
  if (String(result?.RESPONSECODE) === '1' && String(result?.ERRCODE) === '0') {
    const resp = result.RESPONSE ?? {}
    await setItem(`CHATBALANCE_${partnerId}`, String(resp?.CHATBALANCE ?? '0'))
    await setJson(`CHATBALANCEDETAIL_${partnerId}`, resp)
  }
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

// ─── clearChatBalanceCache ────────────────────────────────────────────────────

export async function clearChatBalanceCache(partnerId: string): Promise<void> {
  await removeItem(`CHATBALANCE_${partnerId}`)
  await removeItem(`CHATBALANCEDETAIL_${partnerId}`)
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
  console.log('[chatService] fetchChatPaymentPromo raw response', result)

  if (String(result?.ERRCODE ?? '') !== '0' || !result?.RESPONSE) return null
  const r = result.RESPONSE
  return {
    title:    String(r.TITLE ?? r.title ?? ''),
    content:  String(r.SUBTITLE ?? r.CONTENT ?? r.content ?? ''),
    ctaLabel: String(r.CTA ?? r.BUTTONTEXT ?? ''),
    ...(r.IMAGE || r.IMG ? { image: r.IMAGE ?? r.IMG } : {}),
  }
}
