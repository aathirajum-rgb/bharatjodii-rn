// Survey popup — Angular: matches.page.ts:740-743 (trigger), getSurveydetails()/:2167-2178
// (fetch), surveySubmit()/:2761-2766 (submit).
import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'

export interface SurveyPopupData {
  title:     string
  subtitle1: string
  subtitle2: string
  cta:       string
  link:      string
  surveyId:  string
}

export async function fetchSurveyPopup(): Promise<SurveyPopupData | null> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  const result = await apiCall(Endpoints.support.surveyPopup, 'POST', `ID=${userId}`)
  if (result?.ERRCODE != 0 || !result?.RESPONSE) return null

  const res = result.RESPONSE
  if (!res?.title || !res?.CTA) return null

  return {
    title:     res.title,
    subtitle1: res.subtitle1 ?? '',
    subtitle2: res.subtitle2 ?? '',
    cta:       res.CTA,
    link:      res.LINK ?? '',
    surveyId:  res.SURVEYID ?? '',
  }
}

export async function submitSurvey(surveyId: string): Promise<void> {
  const userId = (await getItem(SK.Auth.USER_ID)) ?? ''
  await apiCall(Endpoints.support.surveySubmit, 'POST', `ID=${userId}&SURVEYID=${surveyId}`)
}
