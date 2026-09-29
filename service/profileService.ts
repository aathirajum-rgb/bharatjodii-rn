import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem, getJson, setJson } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { getSessionValue } from './registrationService'
import { isAiValidationEnabled } from './photoValidationService'
import { setStrictFilterStateFromPP } from './filterService'

// ─── getPPSetData ─────────────────────────────────────────────────────────────
// Angular's getPPSETData — single source of truth for profile + paywall state.
// Cached in storage; force=true bypasses cache.
// errcode 61 → retry once silently. errcode 13 → set PI_VALIDATION flag.

export async function getPPSetData(force = false): Promise<any> {
  if (!force) {
    const cached = await getJson<any>(SK.App.PP_SET_DATA)
    if (cached) {
      // Angular: filter.service.ts's getPPSetData() — seeds the strict toggles
      // from a CACHED preference payload only when nothing is stored yet, so
      // toggles the member changed but hasn't applied survive.
      await setStrictFilterStateFromPP(cached?.STRICKPP, true)
      return cached
    }
  }

  const userId = await getItem(SK.Auth.USER_ID)
  if (!userId) return null

  let result = await apiCall(Endpoints.profile.getPreference, 'POST', `ID=${userId}&TYPE=getmemberPreference`)

  // errcode 61 = server side session expiry — one silent retry
  if (result?.ERRCODE === '61') {
    result = await apiCall(Endpoints.profile.getPreference, 'POST', `ID=${userId}&TYPE=getmemberPreference`)
  }

  if (result?.RESPONSECODE !== '1' || result?.ERRCODE !== '0') return null

  const data = result.RESPONSE
  if (!data) return null

  // Angular: profile.service.ts — "Keep the strict filter toggles of the PP page
  // in sync with the STRICKPP of the response". A LIVE response overwrites
  // (no onlyWhenMissing), so the server's saved strict prefs win on a real fetch.
  await setStrictFilterStateFromPP(data.STRICKPP)

  // PAYMENTWALL lives in its own storage key
  if (data.PAYMENTWALL !== undefined) {
    await setItem(SK.Payment.PAYMENT_WALL, JSON.stringify(data.PAYMENTWALL))
  }

  // PI_VALIDATION flag for identity check
  if (result.ERRCODE === '13') {
    await setItem('PI_VALIDATION', '1')
  }

  const photoCount = data.PHOTOCOUNT ?? '0'
  const photoStatus = data.PI_PHOTOSTATUS ?? 'N'
  const hasPhoto = Number(photoCount) > 0 && (photoStatus === 'Y' || photoStatus === 'P')

  await Promise.all([
    setJson(SK.App.PP_SET_DATA, data),
    setItem('PHOTOCOUNT', String(photoCount)),
    setItem('PHOTOAVAILABLE', hasPhoto ? 'Y' : 'N'),
    data.FAQENABLEFLAG     ? setItem('FAQENABLEFLAG', data.FAQENABLEFLAG)         : Promise.resolve(),
    data.PI_MOTHERTONGUE   ? setItem('MOTHERTONGUE', data.PI_MOTHERTONGUE)        : Promise.resolve(),
    data.NUMBEROFPAYMENTS  ? setItem('NUMBEROFPAYMENTS', data.NUMBEROFPAYMENTS)   : Promise.resolve(),
    data.VERIFIEDBYCALLNUM ? setItem('VERIFIEDBYCALLNUM', data.VERIFIEDBYCALLNUM) : Promise.resolve(),
    data.PAYFAILOFFFLAG === '1'
      ? Promise.all([setItem('PAYMENT_FAILED', '1'), setItem('PAYMENTFAILTYPE', '1')])
      : Promise.resolve(),
  ])

  return data
}

// ─── updateProfile ────────────────────────────────────────────────────────────
// Sends a single field update. Components handle any UI feedback after the call.

export async function updateProfile(
  type: string,
  selectedValue: any,
  existingValue?: any,
  extraParams?: string,
): Promise<any> {
  const userId = await getItem(SK.Auth.USER_ID)
  if (!userId) return null

  // Angular: registration.page.ts's editform save — "ID=..&TYPE=..&VALUE=..&EXISTINGVALUE=..".
  // Confirmed against a live network capture of this exact call. extraParams is
  // appended verbatim (e.g. "&INCOMETYPE=INR" for the INCOME update).
  const params = `ID=${userId}&TYPE=${type}&VALUE=${selectedValue}&EXISTINGVALUE=${existingValue ?? ''}${extraParams ?? ''}`

  const result = await apiCall(Endpoints.profile.updateInfo, 'POST', params)
  return result
}

// ─── managePhotos ─────────────────────────────────────────────────────────────

export async function managePhotos(): Promise<{ count: string; photos: any[] }> {
  const userId = await getItem(SK.Auth.USER_ID)
  const result = await apiCall(Endpoints.profile.managePhoto, 'POST', `ID=${userId}`)

  if (result?.RESPONSECODE == 1 && result?.ERRCODE == 0 && result?.RESPONSE?.PHOTOS) {
    const photos: any[] = result.RESPONSE.PHOTOS
    const count = String(result.RESPONSE.PHOTOCOUNT ?? '0')
    // Angular: common.ts getuserphotos() —
    //   _photourl = photos.length ? photos[0].PHOTOTHUMB : ''
    //   _photo    = photos.filter(x => x.MAINPHOTO == 1)
    //   photourl  = _photo.length ? _photo[0].PHOTOTHUMB : _photourl
    //   if (photourl) localStorage.setItem('PHOTOURL', photourl)
    //
    // Two safeguards this port had dropped, both of which caused a freshly
    // uploaded photo to vanish from Home and Menu:
    //  1. FALL BACK to photos[0] when nothing is flagged MAINPHOTO == 1. A new
    //     upload isn't the main photo until it's explicitly promoted (see
    //     setMainPhoto), so `find(MAINPHOTO == 1)` is routinely undefined.
    //  2. NEVER write an empty string. The old `main?.PHOTOTHUMB ?? ''` did, so
    //     managePhotos() — which EditProfileScreen calls on every focus, right
    //     after the upload had stored the real URL — immediately blanked
    //     PHOTO_URL again. Home/Menu then read '' and fell back to the avatar.
    const main     = photos.find(p => p.MAINPHOTO == 1)
    const photoUrl = main?.PHOTOTHUMB ?? photos[0]?.PHOTOTHUMB ?? ''

    await Promise.all([
      setItem('PHOTOCOUNT', count),
      ...(photoUrl ? [setItem(SK.User.PHOTO_URL, photoUrl)] : []),
      setJson('USERPHOTOS', photos),
      setItem('PHOTOAVAILABLE', 'Y'),
    ])

    return { count, photos }
  }

  await setItem('PHOTOCOUNT', '0')
  return { count: '0', photos: [] }
}

// ─── deletePhoto ──────────────────────────────────────────────────────────────

export async function deletePhoto(photoId: string): Promise<any> {
  const userId = await getItem(SK.Auth.USER_ID)
  // Angular: api-params-functions.ts's ERegQueryModuleName.deletephoto case
  // (added alongside managephoto.page.ts's deletePhoto()) now sends this same
  // session flag on delete, not just add/upload.
  const aiValidate = await isAiValidationEnabled() ? '1' : '0'
  return apiCall(Endpoints.profile.deletePhoto, 'POST', `ID=${userId}&PHOTOID=${photoId}&AIVALIDATE=${aiValidate}`)
}

// ─── setMainPhoto ─────────────────────────────────────────────────────────────

export async function setMainPhoto(photoId: string): Promise<any> {
  const userId = await getItem(SK.Auth.USER_ID)
  return apiCall(Endpoints.profile.setMainPhoto, 'POST', `ID=${userId}&PHOTOID=${photoId}`)
}

// ─── fetchBulkLikeMatches ─────────────────────────────────────────────────────

export async function fetchBulkLikeMatches(start = 0, limit = 20): Promise<any[]> {
  const userId = await getItem(SK.Auth.USER_ID) ?? ''
  const params = `ID=${userId}&START=${start}&LIMIT=${limit}&LIKED=1&VIEWED=1&REPORTED=1&BLOCKED=1&REMOVED=1&SKIPED=1&PHOTOAVAILABLE=1&TYPE=BULKLIKE`
  const result = await apiCall(Endpoints.listing.bulkLike, 'POST', params)

  if (result?.RESPONSECODE == 1 && result?.ERRCODE == 0) {
    return result.RESPONSE ?? []
  }
  return []
}

// ─── sendBulkLikes ────────────────────────────────────────────────────────────
// Angular: CommunicationService.sendBulkLikes(ids) → communication/bulklike/v1
// Params mirror communicationService.ts's getCommParams(), except PARTNERID is
// a '~'-joined list of profile IDs instead of a single one.

export async function sendBulkLikes(ids: string[]): Promise<boolean> {
  const loginId   = (await getItem(SK.Auth.USER_ID)) ?? ''
  const gender    = (await getItem(SK.User.LOGIN_GENDER)) ?? 'M'
  const entryType = (await getSessionValue('ENTRYTYPE')) ?? 'F'
  const params = `ID=${loginId}&PARTNERID=${ids.join('~')}&LOGINGENDER=${gender}&ENTRYTYPE=${entryType}`
  const result = await apiCall(Endpoints.communication.sendBulkLike, 'POST', params)
  return result?.RESPONSECODE == 1 && result?.ERRCODE == 0
}
