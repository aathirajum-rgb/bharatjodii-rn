import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'

export type ChatLimitResult =
  | 'monthlyLimitExceeded'
  | 'weeklyLimitExceeded'
  | 'dailyLimitExceeded'
  | 'oneConversationOnly'
  | 'allowed'

// ─── getChatCount ─────────────────────────────────────────────────────────────
// Fetches remaining chat balance for the session. Cached — cleared on new session.

export async function getChatCount(partnerId: string): Promise<string> {
  const cached = await getItem('CHATBALANCE')
  if (cached) return cached

  const loginId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const params  = `ID=${loginId}&PARTNERID=${partnerId}&TYPE=1`
  const result  = await apiCall(Endpoints.communication.chatCount, 'POST', params)

  let chatBalance = '0'

  if (result?.RESPONSECODE === '1' && result?.ERRCODE === '0') {
    const resp = result.RESPONSE
    await setItem('CHATBALANCEDETAIL', JSON.stringify(resp))
    chatBalance = String(resp?.CHATBALANCE ?? '0')

    // Paid user with zero balance → surface renewal prompt
    if (chatBalance === '0') {
      const entryType = await getItem(SK.Auth.ENTRY_TYPE)
      if (entryType === 'P') await setItem('RENEWALENABLEKEY', '1')
    }
  }

  await setItem('CHATBALANCE', chatBalance)
  return chatBalance
}

// ─── checkChatLimit ───────────────────────────────────────────────────────────
// Pure logic — no API call. chatData = CHATBALANCEDETAIL, messageDetails = per-profile message counts.

export function checkChatLimit(
  chatData: any,
  messageDetails: any,
): ChatLimitResult {
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

export async function clearChatBalanceCache(): Promise<void> {
  await setItem('CHATBALANCE', '')
  await setItem('CHATBALANCEDETAIL', '')
}
