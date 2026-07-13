// Button service — migrated from Angular button.service.ts.
// Handles profile card button clicks: a thin routing layer over communicationService.
// Angular showed native bottom sheets directly; in RN this returns descriptors.

import { getItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { navigate } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'
import {
  communicationBtnOnClick,
  CommActionResult,
  CommunicationAction,
} from './communicationService'

// ─── Button click entry point ─────────────────────────────────────────────────

export async function clickingOnBtn(
  action: CommunicationAction,
  oppProfile: any,
  _profileId: string,
  fromPage: string,
): Promise<CommActionResult> {
  switch (action) {
    case 'call':
    case 'whatsapp':
    case 'jodimessages':
    case 'paynow': {
      const shouldShowPhotoPromo = await checkAddPhotoPromotion()
      if (shouldShowPhotoPromo) {
        return { type: 'api_success', data: { showPhotoPromo: true }, action: 'photo_promo' }
      }
      break
    }
    default:
      break
  }

  return communicationBtnOnClick(fromPage, action, oppProfile)
}

// ─── Photo promotion checks ───────────────────────────────────────────────────
// Female users without a published photo should be prompted before key actions.

export async function checkPhotoPromotion(): Promise<boolean> {
  const [publishedFlag, entryType] = await Promise.all([
    getItem('PROFILEPUBLISHEDFLAG'),
    getItem(SK.Auth.ENTRY_TYPE),
  ])
  return publishedFlag === '0' && (entryType === 'F' || entryType === '1' || entryType === '2')
}

export async function checkAddPhotoPromotion(): Promise<boolean> {
  const publishedFlag = await getItem('PROFILEPUBLISHEDFLAG')
  if (publishedFlag !== '0') return false

  const [isPhotoPromo, photoCount, ekycStatus, entryType] = await Promise.all([
    checkPhotoPromotion(),
    getItem('PHOTOCOUNT'),
    getItem('PI_EKYCSTATUS'),
    getItem(SK.Auth.ENTRY_TYPE),
  ])

  if (isPhotoPromo) return true

  // Paid + ID-verified + no photo
  const isPaidVerifiedNoPhoto = entryType === 'P' && ekycStatus === '1' && (!photoCount || photoCount === '0')
  if (isPaidVerifiedNoPhoto) return true

  // Non-ID verified user
  const isNonIdVerify = ekycStatus !== '1' && entryType === 'P'
  return isNonIdVerify
}

// ─── View profile navigation ──────────────────────────────────────────────────

export async function redirectToViewProfile(
  profileStatus: string,
  matriId: string,
  fromPage = 'matches',
  // Angular: the whole prev/next-profile-swipe cache is keyed off the list the
  // user came from — the RN equivalent is passing that list's ids along so
  // ViewProfileScreen can swipe within the same ordering, without needing
  // Angular's full localStorage-persisted cache.
  profileIds?: string[],
): Promise<void> {
  navigate(ENavigation.VIEW_PROFILE, {
    matriId,
    fromPage,
    showRating: profileStatus === 'active',
    profileIds,
  })
}
