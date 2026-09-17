// AI photo validation — pre-upload client-side gate + post-upload AI verdict poll.
// Android: PhotoUtils.kt (config fetch + validatePhoto), FaceValidator.kt (ML Kit face
// check), PhotoUploadRepository.kt (AIVALIDATE upload flag + validatePhotos poll).
// Not implemented in the old Angular PWA — the JS↔native bridge only forwards an
// AIVALIDATE flag to the native photo picker, it never runs validation itself.
//
// This is the shared service only — no screen wires into it yet. See
// service/apiClient.ts's uploadFile()/apiCall() for the transport this builds on, and
// service/registrationService.ts's getRegistrationArrays() for the cache pattern this
// mirrors.
import { Platform } from 'react-native'
import type { RNMLKitFaceDetector as RNMLKitFaceDetectorType } from '@infinitered/react-native-mlkit-face-detection'
import { apiCall, uploadFile } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { EnvConfig } from '../constants/env.config'

// ─────────────────────────────────────────────────────────────
//  PHOTO CONFIG  (cached, server-driven)
//  Android: PhotoUtils.fetchPhotoConfig/getPhotoConfig, PhotoConfig.kt
// ─────────────────────────────────────────────────────────────

export interface PhotoConfig {
  maximumPhotoCount: number
  allowedFormats: string[]
  minimumPhotoHeight: number
  minimumPhotoWidth: number
  maximumPhotoSize: number
  maxUserPhotoCount: number
  isNativeFaceDetectionEnabled: boolean
}

// Android: PhotoUtils.fallbackPhotoConfig — used when there's no cache yet and the
// fetch fails, so validation never hard-blocks a first-run user on a network hiccup.
const FALLBACK_PHOTO_CONFIG: PhotoConfig = {
  maximumPhotoCount: 10,
  allowedFormats: ['JPEG', 'JPG', 'PNG', 'WEBP', 'AVIF', 'HEIC', 'HEIF', 'GIF', 'BMP'],
  minimumPhotoHeight: 320,
  minimumPhotoWidth: 320,
  maximumPhotoSize: 15728640,
  maxUserPhotoCount: 10,
  isNativeFaceDetectionEnabled: true,
}

// Plain string keys (not StorageKeys entries) — same convention getRegistrationArrays()
// uses for its own fetch-once-cache-with-force-refresh blob.
const PHOTO_CONFIG_KEY      = 'PHOTO_CONFIG'
const PHOTO_CONFIG_LANG_KEY = 'PHOTO_CONFIG_LANG'

// Reads PhotoConfig from cache (AsyncStorage) or fetches fresh from API and saves.
// Android hardcodes LANG=en on this call (ApiInterface.kt's getPhotoConfig) even
// though the payload isn't language-dependent (counts/formats/booleans) — RN uses the
// session's real language instead, consistent with every other cached-fetch here.
export async function getPhotoConfig(force = false): Promise<PhotoConfig> {
  const lang       = (await getItem(SK.Auth.LANG)) ?? 'en'
  const cachedLang = await getItem(PHOTO_CONFIG_LANG_KEY)
  const cached     = await getItem(PHOTO_CONFIG_KEY)

  if (!force && cached && cachedLang === lang) {
    try { return JSON.parse(cached) as PhotoConfig } catch {}
  }

  const res  = await apiCall(Endpoints.registration.initialFetch, 'GET', `type=PHOTOCONFIG&LANG=${lang}`)
  const data = res?.RESPONSE

  if (data && typeof data === 'object') {
    await setItem(PHOTO_CONFIG_KEY, JSON.stringify(data))
    await setItem(PHOTO_CONFIG_LANG_KEY, lang)
    return data as PhotoConfig
  }

  // Fetch failed — serve stale cache (any language) rather than the hardcoded
  // fallback if we have one at all.
  if (cached) {
    try { return JSON.parse(cached) as PhotoConfig } catch {}
  }
  return FALLBACK_PHOTO_CONFIG
}

// Android has two gates (an outer viewModel flag + this config flag). RN has no
// equivalent outer flag piped in yet, so this gates purely on the config — if a
// separate top-level feature flag turns out to exist server-side, AND it in here.
export async function isAiValidationEnabled(force = false): Promise<boolean> {
  const config = await getPhotoConfig(force)
  return config.isNativeFaceDetectionEnabled
}

// ─────────────────────────────────────────────────────────────
//  ON-DEVICE FACE DETECTION
//  Static-image ML Kit wrapper — no camera pipeline. Native-only (Android/iOS);
//  the old Angular PWA never ran this on web either (see file header).
// ─────────────────────────────────────────────────────────────

let detector: RNMLKitFaceDetectorType | null = null
let detectorUnavailable = false

function getDetector(): RNMLKitFaceDetectorType | null {
  if (Platform.OS === 'web' || detectorUnavailable) return null
  if (!detector) {
    try {
      // Lazily required, not statically imported: the package's native-module
      // binding (RNMLKitFaceDetectionModule.ts) calls Expo's
      // requireNativeModule() at that file's own top level, which throws
      // immediately if the native module isn't linked (web, an unlinked dev
      // client, Expo Go). A static `import` at the top of this file would run
      // that at app-boot time — before this try/catch ever runs — and crash
      // the whole bundle. Requiring it here, only when actually needed on
      // native, keeps that failure contained to this function.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { RNMLKitFaceDetector } = require('@infinitered/react-native-mlkit-face-detection')
      // deferInitialization: true — initialize() is awaited explicitly in
      // detectFace() instead of relying on the constructor's fire-and-forget call.
      detector = new RNMLKitFaceDetector({ performanceMode: 'fast' }, true)
    } catch {
      detectorUnavailable = true
      return null
    }
  }
  return detector
}

// Returns true/false when detection actually ran, or null when it couldn't run at
// all (web, native module not linked, init failure) — callers must treat null as
// "skip this check", not as a rejection.
async function detectFace(uri: string): Promise<boolean | null> {
  const d = getDetector()
  if (!d) return null
  try {
    if (d.status === 'init') await d.initialize()
    if (d.status === 'error') return null
    const result = await d.detectFaces(uri)
    if (!result) return null
    return (result.faces?.length ?? 0) > 0
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
//  PRE-UPLOAD VALIDATION
//  Android: PhotoUtils.validatePhoto — size → format → resolution → face, in order.
// ─────────────────────────────────────────────────────────────

// Matches the ALERT_* vocabulary PhotoUtils.validatePhoto/mapError already use, so
// the same rejection-reasons JSON (see getRejectReasons below) covers both this
// client-side gate and any future server-driven codes.
export type PhotoRejectionCode =
  | 'ALERT_FILE_SIZE_EXCEEDED'
  | 'ALERT_INCORRECT_FILE_FORMAT'
  | 'ALERT_LOW_RESOLUTION'
  | 'ALERT_NO_FACE_DETECTED'

export type PhotoValidationResult =
  | { ok: true }
  | { ok: false; code: PhotoRejectionCode }

// What's actually available at each of the RN upload call sites today: an
// expo-image-picker asset or expo-media-library Asset (uri + width/height/mimeType/
// fileSize already on the object) or a web File normalized via normalizeWebFile().
// Field types explicitly include `| undefined` (not just `?`) so callers can pass
// expo-image-picker's own `string | undefined`-typed asset fields straight through
// under exactOptionalPropertyTypes.
export interface PhotoValidationInput {
  uri: string
  mimeType?: string | null | undefined
  fileSize?: number | null | undefined
  width?: number | null | undefined
  height?: number | null | undefined
}

export async function validatePhotoAsset(
  input: PhotoValidationInput,
  config?: PhotoConfig,
): Promise<PhotoValidationResult> {
  const cfg = config ?? await getPhotoConfig()

  if (input.fileSize != null && input.fileSize > cfg.maximumPhotoSize) {
    return { ok: false, code: 'ALERT_FILE_SIZE_EXCEEDED' }
  }

  // No mimeType available → can't determine format, fail open (matches
  // chatMediaService.ts's "fail open on missing metadata" precedent). Every known
  // caller (expo-image-picker assets, web File objects) does supply mimeType.
  if (input.mimeType) {
    const format = input.mimeType.split('/')[1]?.toUpperCase()
    if (!format || !cfg.allowedFormats.includes(format)) {
      return { ok: false, code: 'ALERT_INCORRECT_FILE_FORMAT' }
    }
  }

  if (input.width != null && input.height != null) {
    if (input.width < cfg.minimumPhotoWidth || input.height < cfg.minimumPhotoHeight) {
      return { ok: false, code: 'ALERT_LOW_RESOLUTION' }
    }
  }

  if (cfg.isNativeFaceDetectionEnabled) {
    const hasFace = await detectFace(input.uri)
    if (hasFace === false) {
      return { ok: false, code: 'ALERT_NO_FACE_DETECTED' }
    }
    // hasFace === null → detector unavailable, skip rather than block upload.
  }

  return { ok: true }
}

// Normalizes a web <input type="file"> File into PhotoValidationInput — size/type
// are synchronous, pixel dimensions need an async decode via the DOM Image element.
export async function normalizeWebFile(file: File): Promise<PhotoValidationInput> {
  const uri = URL.createObjectURL(file)
  const dims = await new Promise<{ width: number; height: number } | null>(resolve => {
    if (typeof Image === 'undefined') { resolve(null); return }
    const img = new Image()
    img.onload  = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = uri
  })
  return {
    uri,
    mimeType: file.type || null,
    fileSize: file.size,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  }
}

// ─────────────────────────────────────────────────────────────
//  REJECTION-REASON COPY  (static JSON, cached)
//  Android: PhotoUtils.fetchRejectedReasons/mapError, RejectedPhotoAdapter.
// ─────────────────────────────────────────────────────────────

export interface RejectReasonCopy {
  title: string
  subtitle: string
}

const REJECT_REASONS_KEY = 'PHOTO_REJECT_REASONS'
const REJECT_REASONS_URL = `${EnvConfig.image}assets/static_array/local-reject-reasons.json`

export async function getRejectReasons(force = false): Promise<Record<string, RejectReasonCopy>> {
  const cached = await getItem(REJECT_REASONS_KEY)
  if (!force && cached) {
    try { return JSON.parse(cached) } catch {}
  }
  try {
    const res = await fetch(REJECT_REASONS_URL)
    if (res.ok) {
      const json = await res.json()
      await setItem(REJECT_REASONS_KEY, JSON.stringify(json))
      return json
    }
  } catch {}
  if (cached) {
    try { return JSON.parse(cached) } catch {}
  }
  return {}
}

// ─────────────────────────────────────────────────────────────
//  PHOTO GUIDELINES  (server copy + illustration grid)
//  Angular: pages/addphoto-intermediate/addphoto-intermediate.page.ts's
//  callphotoRejection() — POST initialfetch with
//  `type=PHOTOREJECTION&LANG=<lang>&ccode=<MCODE>`. Drives both the
//  'showguidelines' and 'photorejection' variants of that page; only
//  'showguidelines' is wired up so far (see AddPhotoIntermediateScreen.tsx).
//
//  Verified against the live staging response: RESPONSE.PHOTOGUIDELINE carries
//  TITLE / NOTE / CTA / LINK_CTA / TITLE2 / BOTTOM_SHEET_TITLE plus a GUIDELINES
//  array of six { MIMG, FIMG, REASON } entries (Blurred photo, Watermark, Side
//  face, Irrelevant photo, Contact details, Group photo). MIMG/FIMG are absolute
//  URLs on a different host than EnvConfig.image, so they are used verbatim.
// ─────────────────────────────────────────────────────────────

export interface PhotoGuidelineItem {
  maleImg:   string
  femaleImg: string
  reason:    string
}

export interface PhotoGuidelines {
  title:   string
  note:    string
  cta:     string
  linkCta: string
  items:   PhotoGuidelineItem[]
  // Angular: guideLineContent?.PHOTOGUIDELINE?.TITLE2 — the "Your photo is
  // rejected" heading, shown by the photorejection variant only.
  title2:  string
  // Angular: resultData?.RESPONSE?.PHOTOREASON — a sibling of PHOTOGUIDELINE,
  // not a field inside it. Keyed by PHOTOSTATUSARRAY.REASON (defaulting to
  // '1'), it supplies the overlay caption on the rejected photo.
  reasons: Record<string, string>
}

// Bumped from 'PHOTO_GUIDELINES' when title2/reasons were added: a cache
// written by the previous shape has neither field, and the photorejection
// variant cannot render without them.
const GUIDELINES_KEY = 'PHOTO_GUIDELINES_V2'

// Cache-then-network, same shape as getRejectReasons above: a cached copy is
// returned immediately on a later visit, and a failed fetch falls back to it
// rather than rendering an empty page. Cached per language, because the server
// localises TITLE/NOTE/REASON via the LANG param.
export async function fetchPhotoGuidelines(): Promise<PhotoGuidelines | null> {
  const [lang, mCode] = await Promise.all([
    getItem(SK.Auth.LANG),
    getItem(SK.User.MEMBER_CODE),
  ])
  const activeLang = lang ?? 'en'
  const cacheKey   = `${GUIDELINES_KEY}_${activeLang}`

  const parseCached = async (): Promise<PhotoGuidelines | null> => {
    const cached = await getItem(cacheKey)
    if (!cached) return null
    try { return JSON.parse(cached) } catch { return null }
  }

  try {
    const params = `type=PHOTOREJECTION&LANG=${activeLang}&ccode=${mCode ?? '91'}`
    const res = await apiCall(Endpoints.registration.initialFetch, 'POST', params)
    const g = res?.RESPONSE?.PHOTOGUIDELINE
    if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0 && g) {
      const rawReasons = res?.RESPONSE?.PHOTOREASON
      const parsed: PhotoGuidelines = {
        title:   String(g.TITLE    ?? ''),
        note:    String(g.NOTE     ?? ''),
        cta:     String(g.CTA      ?? ''),
        linkCta: String(g.LINK_CTA ?? ''),
        title2:  String(g.TITLE2   ?? ''),
        reasons: rawReasons && typeof rawReasons === 'object'
          ? Object.fromEntries(
              Object.entries(rawReasons).map(([k, v]) => [String(k), String(v ?? '')]),
            )
          : {},
        items: (Array.isArray(g.GUIDELINES) ? g.GUIDELINES : []).map((it: any) => ({
          maleImg:   String(it?.MIMG   ?? ''),
          femaleImg: String(it?.FIMG   ?? ''),
          reason:    String(it?.REASON ?? ''),
        })).filter((it: PhotoGuidelineItem) => !!it.reason),
      }
      await setItem(cacheKey, JSON.stringify(parsed))
      return parsed
    }
  } catch {}

  return parseCached()
}

// Android: PhotoUtils.mapError — trims the title's trailing period, joins with the
// subtitle, falls back to "UNKNOWN__" then a generic message.
export function describeRejection(
  code: PhotoRejectionCode,
  reasons: Record<string, RejectReasonCopy>,
): string {
  const data = reasons[code] ?? reasons['UNKNOWN__']
  if (!data) return 'Photo could not be verified. Please try uploading again'
  const cleanTitle = data.title.trim().replace(/\.$/, '')
  return `${cleanTitle}. ${data.subtitle.trim()}`
}

// ─────────────────────────────────────────────────────────────
//  POST-UPLOAD AI VALIDATION POLL
//  Android: PhotoUploadRepository.validatePhotos / ApiInterface.validateProfilePhotos
//  — ID/ENCID/PHOTOIDS are URL query params (not multipart fields); ENCID reuses the
//  same access token as ATN (Android: getEncId() reads KEY_ATN too).
// ─────────────────────────────────────────────────────────────

export interface PhotoAiVerdict {
  photoId: string
  photoUrl: string
  status: string
  reason?: RejectReasonCopy
}

export interface PollPhotoValidationResult {
  isSelfieRequired: boolean
  results: PhotoAiVerdict[]
}

export async function pollPhotoValidation(photoIds: string[]): Promise<PollPhotoValidationResult | null> {
  if (photoIds.length === 0) return null

  const [matriId, encId] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem(SK.Auth.TOKEN),
  ])

  const photoIdsParam = `[${photoIds.join(',')}]`
  const url = `${Endpoints.media.validatePhotos}`
    + `?ID=${encodeURIComponent(matriId ?? '')}`
    + `&ENCID=${encodeURIComponent(encId ?? '')}`
    + `&PHOTOIDS=${encodeURIComponent(photoIdsParam)}`

  const formData = new FormData()
  // Android always sends AIVALIDATE=1 for this call (getPartMap(aiValidationEnabled
  // = true) at the validatePhotos call site) regardless of the upload-time flag.
  formData.append('AIVALIDATE', '1')

  const res = await uploadFile(url, formData)
  if (!res || Number(res.RESPONSECODE) !== 1 || Number(res.ERRCODE) !== 0) return null

  const aiResponse: any[] = Array.isArray(res.AIRESPONSE) ? res.AIRESPONSE : []

  return {
    isSelfieRequired: Number(res.ISSELFIEREQUIRED) === 1,
    results: aiResponse.map((r): PhotoAiVerdict => {
      const verdict: PhotoAiVerdict = {
        photoId:  String(r.PHOTOID),
        photoUrl: String(r.PHOTOURL ?? ''),
        status:   String(r.STATUS ?? ''),
      }
      if (r.REASON) {
        verdict.reason = { title: String(r.REASON.TITLE ?? ''), subtitle: String(r.REASON.SUBTITLE ?? '') }
      }
      return verdict
    }),
  }
}
