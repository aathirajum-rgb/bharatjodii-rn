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

  const [isPhotoPromo, photoCount, ekycStatus, entryType, gender, paidFlag] = await Promise.all([
    checkPhotoPromotion(),
    getItem('PHOTOCOUNT'),
    // Angular reads localStorage 'EKYCSTATUS' (app-swiper.component.ts:109,
    // button.component's check_Paid_NonVerifyIdUser/check_Paid_Verified_Nophoto).
    // 'PI_EKYCSTATUS' is written by nothing in this codebase, so it always read
    // null and every ID-verified member looked unverified here.
    getItem(SK.Verification.EKYC_STATUS),
    getItem(SK.Auth.ENTRY_TYPE),
    getItem(SK.User.LOGIN_GENDER),
    getItem(SK.Payment.PAY_P_FLAG),
  ])

  if (isPhotoPromo) return true

  // Paid + ID-verified + no photo
  const isPaidVerifiedNoPhoto = entryType === 'P' && ekycStatus === '1' && (!photoCount || photoCount === '0')
  if (isPaidVerifiedNoPhoto) return true

  // Non-ID verified user — Angular common-funtions.ts:362-364
  // check_Paid_NonVerifyIdUser() = entryType=='P' && ekycStatus=='0' &&
  // gender=='M' && PAYPFLAG=='1'. This previously matched entryType+ekycStatus
  // only — missing BOTH the gender check and the PAYPFLAG check (the same
  // PAYPFLAG bug found and fixed in communicationService.ts and
  // MatchesScreen.tsx's own local copy of this same condition).
  const isNonIdVerify = ekycStatus !== '1' && entryType === 'P' && gender === 'M' && paidFlag === '1'
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
