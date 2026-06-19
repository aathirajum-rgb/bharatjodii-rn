import { apiCall } from './apiClient'
import { Endpoints } from './api.endpoints'
import { getItem, setItem, getJson, setJson } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'

// ─── getPPSetData ─────────────────────────────────────────────────────────────
// Angular's getPPSETData — single source of truth for profile + paywall state.
// Cached in storage; force=true bypasses cache.
// errcode 61 → retry once silently. errcode 13 → set PI_VALIDATION flag.

export async function getPPSetData(force = false): Promise<any> {
  if (!force) {
    const cached = await getJson(SK.App.PP_SET_DATA)
    if (cached) return cached
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
  oldValue?: any,
): Promise<any> {
  const userId = await getItem(SK.Auth.USER_ID)
  if (!userId) return null

  let params = `ID=${userId}&TYPE=${type}&VALUE=${selectedValue}`
  if (oldValue !== undefined) params += `&OLDVALUE=${oldValue}`

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
    const main  = photos.find(p => p.MAINPHOTO == 1)

    await Promise.all([
      setItem('PHOTOCOUNT', count),
      setItem(SK.User.PHOTO_URL, main?.PHOTOTHUMB ?? ''),
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
  return apiCall(Endpoints.profile.deletePhoto, 'POST', `ID=${userId}&PHOTOID=${photoId}`)
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
