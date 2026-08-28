// Biodata screen data + logic — ported from Angular's download-biodata.component.ts
// and services/common.ts's getBioDataLink(). This is a DEDICATED screen (unlike
// ViewProfileScreen's own-profile mode), so it fetches the raw viewprofile
// response directly rather than going through ViewProfileAdapter, which was
// built for a different screen and normalizes away fields this page needs in
// their raw form (e.g. ANNUALINCOME=='0' as a literal sentinel, not `undefined`).

import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { getRegistrationArrays } from './registrationService'
import { stripAndDecodeHtml } from '../utils/htmlEntities'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BiodataTheme {
  value:   string
  bgColor: string
  topImg:  string
}

// Raw viewprofile?TYPE=BIODATA payload — deliberately loose (`any` sub-objects)
// since the screen reads dozens of scattered fields directly, mirroring
// Angular's own `userBioData?.X?.Y` access pattern rather than re-modeling
// the whole shape up front.
export interface BiodataProfile {
  PERSONALINFO:     any
  PROFESSIONALINFO: any
  HABITSINFO:       any
  RELIGIOUSINFO:    any
  FAMILYINFO:       any
  HOROINFO:         any
  PHOTOINFO:        any
  LOCATIONINFO:     any
  BIODATATHEME:     any[]
  QRCODE?:          string
  RELIGION?:        string  // top-level numeric code — gates showReligiousDetails()
  CASTE?:            string  // top-level numeric code — gates SHOWGOTHRA
  SHOWGOTHRA:       boolean
  doshamText:       string
}

function resolveImageUrl(url: string): string {
  if (!url) return ''
  return /^https?:\/\//.test(url) ? url : `https://${url}`
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
// Angular: download-biodata.component.ts getuserBioData() — ID/VIEWEDID are
// both the logged-in user's own id; TYPE=BIODATA additionally unlocks
// BIODATATHEME (the swipeable color templates) and QRCODE on the SAME response.

// Walks a decoded-JSON value and runs every string through Angular's
// innerHTML-equivalent (strip markup, then decode entities). Arrays and nested
// objects are rebuilt rather than mutated, so the caller's input is untouched.
//
// Safe over the whole payload including URLs and colours: decodeEntities only
// rewrites a `&...;` sequence, and neither the CDN image URLs nor the theme's
// "#011443" hex contain one.
function decodeDeep(value: unknown): unknown {
  if (typeof value === 'string') return stripAndDecodeHtml(value)
  if (Array.isArray(value)) return value.map(decodeDeep)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = decodeDeep(v)
    return out
  }
  return value
}

export async function getBiodataProfile(): Promise<BiodataProfile | null> {
  const userId = await getItem(SK.Auth.USER_ID)
  const params = `ID=${userId ?? ''}&VIEWEDID=${userId ?? ''}&TYPE=BIODATA`
  const result = await apiCall(Endpoints.profile.view, 'POST', params)
  // Confirmed live elsewhere in this app (viewProfileService.ts) — this
  // endpoint's envelope uses numeric RESPONSECODE/ERRCODE and the real API's
  // typo'd REPONSE key, not RESPONSE.
  if (!(result?.RESPONSECODE == 1 && result?.ERRCODE == 0)) return null

  const rawResponse = result?.REPONSE
  if (!rawResponse || typeof rawResponse !== 'object') return null

  // This endpoint returns non-Latin text as HTML numeric character references,
  // not UTF-8 — Tamil "திருமண" arrives as "&#x0BA4;&#x0BBF;&#x0BB0;&#x0BC1;...".
  // Angular renders every one of these through [innerHTML], which decodes the
  // references (and strips markup) as a side effect. An RN <Text> does neither,
  // so the escapes reached the screen verbatim in the Indic locales.
  //
  // Decoded once here, over the whole payload, rather than at the ~40 individual
  // read sites in BiodataScreen — that way any field added later is covered too,
  // including the ones feeding doshamText and the theme list below.
  const raw = decodeDeep(rawResponse) as Record<string, any>

  const themes: BiodataTheme[] = Array.isArray(raw.BIODATATHEME)
    ? raw.BIODATATHEME
      .map((t: any) => ({
        value:   String(t?.VALUE ?? ''),
        bgColor: t?.BGCOLOR ? String(t.BGCOLOR) : '#011443',
        topImg:  resolveImageUrl(String(t?.TOP_IMG ?? '')),
      }))
      .filter((t: BiodataTheme) => t.value !== '')
    : []

  // Angular: getuserBioData() — SHOWGOTHRA is set when the profile's CASTE
  // code appears in REGISTRATIONARRAYS.GOTHRAAVAILCASTE.
  const registrationArrays = await getRegistrationArrays()
  const gothraAvailList = registrationArrays?.GOTHRAAVAILCASTE
  const caste = raw.CASTE != null ? String(raw.CASTE) : ''
  const showGothra = Array.isArray(gothraAvailList) && caste !== ''
    ? gothraAvailList.map(String).includes(caste)
    : false

  // Angular: getuserBioData() — viewDoshamTypes, each RELIGIOUSINFO.DOSHAM
  // array item carries its text under its own DOSHAM sub-key.
  const doshamList = raw.RELIGIOUSINFO?.DOSHAM
  const doshamText = Array.isArray(doshamList)
    ? doshamList.map((d: any) => d?.DOSHAM).filter(Boolean).join(', ')
    : ''

  return { ...raw, BIODATATHEME: themes, SHOWGOTHRA: showGothra, doshamText } as BiodataProfile
}

// ─── Section-visibility / derived-field helpers ────────────────────────────────
// Angular: showHideReligiousDetails() — religion codes 3/4/5 (Muslim variants)
// hide the whole Religious Details + Horoscope sections.
export function showReligiousDetails(religionCode?: string): boolean {
  return !['3', '4', '5'].includes(String(religionCode ?? ''))
}

// Angular: checkPropertyCondition() — "has property info" if either property
// or vehicle is filled (not necessarily both).
export function hasPropertyDetails(familyInfo: any): boolean {
  const property = familyInfo?.PROPERTY
  const vehicle  = familyInfo?.VECHILE
  return !!property || !!vehicle
}

// Angular: updatePropertyContent() — combined "Has own house, Has four
// wheeler"-style text from whichever of property/vehicle is present.
export function propertyContentText(familyInfo: any): string {
  const parts: string[] = []
  if (familyInfo?.PROPERTY) parts.push(String(familyInfo.PROPERTY))
  if (familyInfo?.VECHILE) parts.push(String(familyInfo.VECHILE))
  return parts.join(', ')
}

// Angular: registrationArray['BOTHER'][BROTHERS] / ['SISTER'][SISTERS] — a
// direct code→label object lookup from the same REGISTRATIONARRAYS blob
// GOTHRAAVAILCASTE lives in (not the separate familyinfo options endpoint).
export async function resolveFamilyCountLabel(
  kind: 'BOTHER' | 'SISTER', code?: string,
): Promise<string> {
  if (!code) return ''
  const arrays = await getRegistrationArrays()
  const map = arrays?.[kind]
  if (!map) return code
  if (Array.isArray(map)) {
    const match = map.find((item: any) => String(item?.KEY ?? item?.key) === String(code))
    return match ? String(match.VALUE ?? match.value ?? code) : code
  }
  if (typeof map === 'object') return String(map[code] ?? code)
  return code
}

// ─── Missing-field cascade ──────────────────────────────────────────────────────
// Angular: redirectToMissingPage() — first missing field wins, in this exact
// priority order. Angular's own cascade also checks photo/physical-status/
// gothram/horoscope, but none of those have a real edit destination in this
// port yet, so they're left out rather than pointing "Add Now" at a dead route.
export type MissingBiodataField = { screen: string }

// occupationCode: Angular reads this from localStorage.getItem('OCCUPATION') —
// the logged-in user's own cached occupation CODE (e.g. '8' = not working),
// a separate value from PROFESSIONALINFO.OCCUPATION (the biodata's own
// display text, e.g. "Self employed"). '8'/'0' hide the income row entirely
// rather than ever prompting to add it.
export function getFirstMissingBiodataField(
  p: BiodataProfile, occupationCode: string,
): MissingBiodataField | null {
  const income = p.PROFESSIONALINFO?.ANNUALINCOME
  if (!['8', '0'].includes(occupationCode) && (!income || income === '0')) {
    return { screen: 'EditProfileProfessional' }
  }
  if (!p.HABITSINFO?.EATINGHABITS) return { screen: 'EditProfileLifestyle' }
  if (!p.HABITSINFO?.DRINKING)     return { screen: 'EditProfileLifestyle' }
  if (!p.HABITSINFO?.SMOKING)      return { screen: 'EditProfileLifestyle' }
  if (showReligiousDetails(p.RELIGION)) {
    if (!p.RELIGIOUSINFO?.RAASI)        return { screen: 'EditProfileReligious' }
    if (!p.doshamText)                  return { screen: 'EditProfileReligious' }
    if (!p.RELIGIOUSINFO?.STAR)         return { screen: 'EditProfileReligious' }
  }
  if (!p.FAMILYINFO?.BROTHERS) return { screen: 'EditProfileFamily' }
  if (!p.FAMILYINFO?.SISTERS)  return { screen: 'EditProfileFamily' }
  if (!hasPropertyDetails(p.FAMILYINFO)) return { screen: 'EditProfileProperty' }
  return null
}

// ─── Theme selection persistence ───────────────────────────────────────────────

export async function saveBiodataThemeId(themeValue: string): Promise<void> {
  await setItem(SK.App.BIODATA_THEME_ID, themeValue)
}

export async function getSavedBiodataThemeId(): Promise<string | null> {
  return getItem(SK.App.BIODATA_THEME_ID)
}

// ─── Download link ──────────────────────────────────────────────────────────────
// Angular: Nbcommon.getBioDataLink() — `${DOMAIN}biodata/v1?MATRIID=&LANG=&ATN=&RTN=&THEME=`.

export async function getBioDataDownloadLink(matriId: string, themeValue: string): Promise<string> {
  const [atn, rtn, lang] = await Promise.all([
    getItem(SK.Auth.TOKEN),
    getItem(SK.Auth.REFRESH_TOKEN),
    getItem(SK.Auth.LANG),
  ])
  const params = `MATRIID=${matriId}&LANG=${lang ?? 'en'}&ATN=${atn ?? ''}&RTN=${rtn ?? ''}&THEME=${themeValue}`
  return `${Endpoints.profile.bioData}?${params}`
}
