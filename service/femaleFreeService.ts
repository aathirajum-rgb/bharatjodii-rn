import { getItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'

// Female free 3-contact promo — replaces Angular's female-free.service.ts.
// Angular showed an Ionic modal; in RN this service returns an action descriptor
// and the component renders the appropriate bottom sheet.

export type FemaleFreeAction =
  | 'femaleFree-PhotoAdd'
  | 'femaleFree-PhotoPending'
  | 'femaleFree-PhotoAdded'
  | 'femaleFree-PhotoFail'
  | 'callVerification'
  | null

// photoStatus: N=no photo, P=pending, Y=approved, R=rejected
// ekycStatus:  '0'=unverified, '1'=verified
export async function resolveFemaleFreeAction(
  photoStatus: string,
  ekycStatus: string,
  isRedirect = false,
): Promise<FemaleFreeAction> {
  // Already ID-verified — nothing to do
  if (ekycStatus === '1') return null

  switch (photoStatus) {
    case 'N': return 'femaleFree-PhotoAdd'
    case 'P': return 'femaleFree-PhotoPending'
    case 'Y': return isRedirect ? 'femaleFree-PhotoAdded' : 'callVerification'
    case 'R': return 'femaleFree-PhotoFail'
    default:  return null
  }
}

export async function getFemaleContactStatus(): Promise<{
  contactUsed: number
  contactTotal: number
  canViewContact: boolean
}> {
  const raw = await getItem(SK.Promotions.FEMALE_FREE_CONTACT)
  if (!raw) return { contactUsed: 0, contactTotal: 3, canViewContact: true }

  const data = JSON.parse(raw)
  const used  = Number(data.CONTACTUSED  ?? 0)
  const total = Number(data.CONTACTTOTAL ?? 3)

  return { contactUsed: used, contactTotal: total, canViewContact: used < total }
}
