// Report-profile reasons-picker form — Angular: pages/report-profile/report-profile.component.ts.
// A routed page there; a modal here (ReportProfileModal.tsx) — same two API calls.
import { apiCall, uploadFile } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { getSessionValue } from './registrationService'

export interface ReportReason {
  key: string
  title: string
  body: string
  // Angular's showRecordFiles() (report-profile.component.ts:351-360): keys '1'/'2'
  // never show the comment/attachment UI regardless of the reason's own UPLOAD flag.
  needsEvidence: boolean
}

export interface ReportReasonsResult {
  reasons: ReportReason[]
  disabledKeys: string[]
}

// Angular: report-profile.component.ts:159-161 — POST reportprofileform,
// ID (logged-in user) / OPPSIDEID (viewed profile) / PTYPE (logged-in user's entry type).
export async function fetchReportReasons(partnerId: string): Promise<ReportReasonsResult> {
  const [userId, entryType] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getSessionValue('ENTRYTYPE'),
  ])
  const params = `ID=${userId ?? ''}&OPPSIDEID=${partnerId}&PTYPE=${entryType ?? ''}`
  const result = await apiCall(Endpoints.profile.reportProfileForm, 'POST', params)
  const ok = (result?.RESPONSECODE === '1' || result?.RESPONSECODE == 1)
    && (result?.ERRCODE === '0' || result?.ERRCODE == 0)
  if (!ok) return { reasons: [], disabledKeys: [] }

  const rawReasons: any[] = result?.RESPONSE?.RESARRAY ?? []
  const disableKeyRaw: string = result?.RESPONSE?.DISABLEKEY ?? ''
  return {
    reasons: rawReasons.map(r => {
      const key = String(r.KEY ?? '')
      return {
        key,
        title: String(r.TITLE ?? ''),
        body: String(r.BODY ?? ''),
        needsEvidence: key !== '1' && key !== '2' && String(r.UPLOAD ?? '0') === '1',
      }
    }),
    disabledKeys: disableKeyRaw ? disableKeyRaw.split(',') : [],
  }
}

// Angular: report-profile.component.ts:289-296 — on success, response.MESSAGE
// (TITLE/CONTENT/CTA) is handed straight to the shared BottomSheetComponent
// as componentData for action='reportProfile' — the success sheet's text is
// API-driven, not a static i18n string.
export interface ReportSubmitResult {
  ok:      boolean
  title?:  string | undefined
  content?: string | undefined
  cta?:    string | undefined
}

// Angular: report-profile.component.ts:258-270 — multipart POST to
// 'reportoppositeprofile', which resolves (httpservice.service.ts:155) to the
// exact same image-CDN PHP endpoint already wired here as Endpoints.media.reportProfile.
export async function submitReport(
  partnerId: string,
  opts: { key: string; title: string; comments?: string | undefined; photoUri?: string | undefined },
): Promise<ReportSubmitResult> {
  const userId = await getItem(SK.Auth.USER_ID)
  const formData = new FormData()
  formData.append('ID', userId ?? '')
  formData.append('REPORTEDID', partnerId)
  formData.append('Comments', opts.comments ?? '')
  formData.append('Key', opts.key)
  formData.append('TITLE', opts.title)
  if (opts.photoUri) {
    formData.append('UPLOADPHOTO[]', {
      uri: opts.photoUri,
      type: 'image/jpeg',
      name: 'report-evidence.jpg',
    } as any)
  }
  const result = await uploadFile(Endpoints.media.reportProfile, formData)
  const ok = result?.RESPONSECODE === '1' || result?.RESPONSECODE == 1
  if (!ok) return { ok: false }
  const msg = result?.MESSAGE ?? {}
  return {
    ok: true,
    title: msg?.TITLE ? String(msg.TITLE) : undefined,
    content: msg?.CONTENT ? String(msg.CONTENT) : undefined,
    cta: msg?.CTA ? String(msg.CTA) : undefined,
  }
}
