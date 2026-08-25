// Angular: pages/webview/webview.page.ts — lets the native app's webview (or an
// SMS/WhatsApp deep link) hand a session to the web build via a hash route:
//   #/webview/:type/:param/:page_id/:token                     (login handoff)
//   #/webview/:type/:param/:page_id/:buildparam/:token         (fresh-registration handoff)
//   #/webview/:type/:param/:page_id                            (no token — not
//     actionable on a fresh page load with no existing session; parsed but unused)
// Route defs: app-routing.module.ts:70-80.

import { Platform } from 'react-native'
import { getItem, setItem, setMultiple } from './storageService'
import { StorageKeys } from '../constants/storage.keys'
import { clearSession } from './apiClient'
import { storeWebURLData, setRegValues, resetRegValues } from './registrationService'

export interface WebviewHandoff {
  type: string
  param: Record<string, any>
  pageId: string
  buildparam?: Record<string, any> | undefined
  token?: Record<string, any> | undefined
}

// ─── URL parsing ────────────────────────────────────────────────────────────
// Not a naive `.split('/')` — an embedded value (e.g. a photo URL) can contain
// a literal '/', which would mis-segment a plain split. Walk the string
// instead, brace-matching JSON segments the same way registrationService.ts's
// parseAndStoreWebViewURL() already does for the WEBVIEWURL payload.

function readScalarSegment(s: string, i: number): [string, number] {
  const start = i
  while (i < s.length && s[i] !== '/') i++
  return [s.slice(start, i), i]
}

function readJsonSegment(s: string, i: number): [string, number] | null {
  if (s[i] !== '{') return null
  let depth = 0
  let inQuotes = false
  const start = i
  for (; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '\\') { i++; continue } // skip escaped char
      if (c === '"') inQuotes = false
      continue
    }
    if (c === '"') inQuotes = true
    else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return [s.slice(start, i + 1), i + 1]
    }
  }
  return null // unterminated — malformed URL
}

function parseJson(segment: string): Record<string, any> | null {
  try { return JSON.parse(decodeURIComponent(segment)) } catch {}
  try { return JSON.parse(segment) } catch {}
  return null
}

export function parseWebviewHandoffUrl(href: string): WebviewHandoff | null {
  const hashIdx = href.indexOf('#')
  if (hashIdx === -1) return null
  const hash = href.slice(hashIdx + 1)
  const marker = '/webview/'
  const markerIdx = hash.indexOf(marker)
  if (markerIdx === -1) return null

  let i = markerIdx + marker.length

  const [typeSeg, afterType] = readScalarSegment(hash, i)
  if (!typeSeg) return null
  i = afterType + 1 // skip '/'

  const paramMatch = readJsonSegment(hash, i)
  if (!paramMatch) return null
  const [paramRaw, afterParam] = paramMatch
  const param = parseJson(paramRaw)
  if (!param) return null
  i = afterParam + 1 // skip '/'

  const [pageIdSeg, afterPageId] = readScalarSegment(hash, i)
  if (!pageIdSeg) return null
  i = afterPageId + 1 // skip '/'

  // Collect whatever trailing JSON segments remain (0, 1, or 2 of them).
  const extras: string[] = []
  while (i < hash.length) {
    const match = readJsonSegment(hash, i)
    if (!match) break
    extras.push(match[0])
    i = match[1] + 1 // skip '/'
  }

  const [buildparamRaw, tokenRaw] = extras.length === 2 ? extras : [undefined, extras[0]]

  return {
    type: typeSeg,
    param,
    pageId: pageIdSeg,
    buildparam: buildparamRaw ? (parseJson(buildparamRaw) ?? undefined) : undefined,
    token: tokenRaw ? (parseJson(tokenRaw) ?? undefined) : undefined,
  }
}

export function getInitialWebviewHandoff(): WebviewHandoff | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null
  return parseWebviewHandoffUrl(window.location.href)
}

// ─── Apply ──────────────────────────────────────────────────────────────────
// Returns the resolved userId/pageId once storage is seeded, or null if no
// usable user could be resolved (malformed/partial handoff) — callers should
// fall through to their normal session-check logic in that case.

export interface AppliedHandoff {
  userId: string
  pageId?: string
}

export async function applyWebviewHandoff(handoff: WebviewHandoff): Promise<AppliedHandoff | null> {
  const { param, token, buildparam, pageId } = handoff
  const merged: Record<string, any> = { ...param, ...(token ?? {}) }

  if (buildparam?.REGISTER === '1') {
    await clearSession()
    await resetRegValues()

    const draft: Record<string, string> = {}
    if (buildparam.MOBILENO !== undefined) draft.MOBILENO = String(buildparam.MOBILENO)
    if (buildparam.CCODE !== undefined)    draft.COUNTRYCODE = String(buildparam.CCODE)
    if (buildparam.COUNTRY !== undefined)  draft.COUNTRY = String(buildparam.COUNTRY)
    if (buildparam.CREATEDBY !== undefined) draft.CREATEDBY = String(buildparam.CREATEDBY)
    if (buildparam.NAME !== undefined)     draft.NAME = String(buildparam.NAME)
    if (buildparam.GENDER !== undefined)   draft.GENDER = String(buildparam.GENDER)
    if (buildparam.countryKey !== undefined && buildparam.countryKey !== '98') draft.NATIVECOUNTRY = '98'
    if (Object.keys(draft).length > 0) await setRegValues(draft)

    if (buildparam.CCODE !== undefined) {
      await setMultiple({
        [StorageKeys.User.MEMBER_CODE]: String(buildparam.CCODE),
        [StorageKeys.User.COUNTRY_CODE]: String(buildparam.CCODE),
      })
    }
    if (buildparam.MOBILENO !== undefined) await setItem('MOBILENO', String(buildparam.MOBILENO))
    // REGISTERURL itself is NOT set here — AppStack.tsx's OnboardingRouter
    // writes it centrally on every step mount, and the caller navigates
    // straight to pageNo '2' (NameScreen, RN's equivalent of Angular's
    // /onboarding/2) rather than relying on this service to pre-seed it.
  }

  await storeWebURLData(merged)
  if (merged.APPTYPE !== undefined)  await setItem(StorageKeys.Auth.APP_TYPE, String(merged.APPTYPE))
  if (merged.LANG !== undefined)     await setItem(StorageKeys.Auth.LANG, String(merged.LANG))
  if (merged.WEBLOGIN !== undefined) await setItem(StorageKeys.Auth.WEB_LOGIN, String(merged.WEBLOGIN))

  const userId = await getItem(StorageKeys.Auth.USER_ID)
  return userId ? { userId, pageId } : null
}
