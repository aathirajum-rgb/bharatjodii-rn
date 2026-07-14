import { getItem } from './storageService'
import { StorageKeys } from '../constants/storage.keys'
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'

// Angular: communication/faqhelp/v1 — same endpoint as the Help Center hub
// (TYPE=ALL), scoped per FAQ category via TYPE=PROFILE / CONTACTMATCHES / PAYMENT.
// profile-related-faq.component.ts / contacting-matches-faq.component.ts /
// payment-faq.component.ts all call this identically.

export type FaqType = 'PROFILE' | 'CONTACTMATCHES' | 'PAYMENT'

export interface FaqContentItem {
  TITLE?:    string
  BODY?:     string
  CTA?:      string
  CTA1?:     string
  CONTENT1?: string
  CONTENT2?: string
  CONTENT3?: string
  CONTENT4?: string
  CONTENT5?: string
  CONTENT6?: string
  VIDEO?:    string
}

export interface FaqData {
  content: FaqContentItem[]
  payCs:   string   // customer-support phone number for this category's "Contact support" modal
}

export async function fetchFaqContent(type: FaqType): Promise<FaqData> {
  const userId = await getItem(StorageKeys.Auth.USER_ID)
  const res = await apiCall(Endpoints.communication.faqHelp, 'POST', `ID=${userId ?? ''}&TYPE=${type}`)
  if (res['RESPONSECODE'] == 1 && res['ERRCODE'] == 0 && res['RESPONSE']) {
    return {
      content: res['RESPONSE']['CONTENT'] ?? [],
      payCs:   res['RESPONSE']['PAYCS'] ?? '',
    }
  }
  return { content: [], payCs: '' }
}

// Angular binds FAQ copy via [innerHTML] — strip tags for RN <Text>, which can't
// render markup. Loses inline formatting (bold/links) but keeps the text intact.
export function stripHtml(raw: string | undefined): string {
  if (!raw) return ''
  return raw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
}
