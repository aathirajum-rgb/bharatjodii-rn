// Pure gating/decision helpers for the Home screen — no I/O, no React. Each
// function mirrors one piece of business logic from Angular's ExploreComponent
// (nbpwa/src/app/pages/explore/explore.component.ts) so the rules can be reasoned
// about (and, if ever needed, tested) independently of the screen's JSX/fetching.
import type { CompleteProfileCard } from '../../service/homeService'

// ─── Shared sub-gates (Angular: common-funtions.ts / communicationService.ts's
// showCallOrWhatsApp — same two expressions MatchesScreen.tsx already uses at
// lines 1081/1164, copied here rather than shared since MatchesScreen isn't
// being touched by this rewrite) ────────────────────────────────────────────────

export function isPaidVerifiedNoPhotoMale(
  entryType: string, ekycStatus: string, gender: string, photoStatus: string,
): boolean {
  return entryType === 'P' && ekycStatus === '1' && gender === 'M' && !['P', 'Y'].includes(photoStatus)
}

export function isNonIdVerifiedPaidMale(
  entryType: string, gender: string, ekycStatus: string, paidFlag: string,
): boolean {
  return entryType === 'P' && gender === 'M' && ekycStatus !== '1' && paidFlag === '1'
}

// ─── Hero banner ────────────────────────────────────────────────────────────────

export interface ShowHeroBannerInput {
  entryType:                 string
  payRenewalFlag:            string
  gender:                    'M' | 'F'
  isNonIdVerifiedPaidMale:   boolean
  isPaidVerifiedNoPhotoMale: boolean
}

// Angular: explore.component.ts's showHeroBanner().
export function computeShowHeroBanner(input: ShowHeroBannerInput): boolean {
  const isShow = input.entryType === 'F' || (input.entryType === 'P' && input.payRenewalFlag !== '0')
  if (input.gender === 'M') {
    return isShow || input.isNonIdVerifiedPaidMale || input.isPaidVerifiedNoPhotoMale
  }
  return isShow
}

export type HeroBannerVariant =
  | 'payment_failed'
  | 'photo_promo_free_female'
  | 'non_id_verify_male'
  | 'paid_verified_no_photo'
  | 'default'
  | null

export interface HeroBannerVariantInput {
  // Session-dismissible + not-expired payment-failure state — caller resolves this
  // async (getPaymentFailedContext/getRetryRemainingMs) before calling in, since
  // this function itself does no I/O.
  paymentFailedActive:       boolean
  showHeroBanner:            boolean
  // Angular: flagOk && typeOk && freeOk — PROFILEPUBLISHEDFLAG=='0' &&
  // PROFILEPUBLISHEDTYPE in [1,2] && entryType=='F'.
  isFreeFemalePhotoPromo:    boolean
  isNonIdVerifiedPaidMale:   boolean
  isPaidVerifiedNoPhotoMale: boolean
}

// Angular: explore.component.ts's hero-banner precedence chain inside getPPSETData()
// (payment-failed → free-female photo promo → non-ID-verified paid male → paid
// verified no-photo → default), same order MatchesScreen.tsx's applyHeroBanner
// if/else-if chain (lines 1170-1181) already uses for its own 3-way subset.
export function computeHeroBannerVariant(input: HeroBannerVariantInput): HeroBannerVariant {
  if (input.paymentFailedActive) return 'payment_failed'
  if (input.isFreeFemalePhotoPromo) return 'photo_promo_free_female'
  if (input.isNonIdVerifiedPaidMale) return 'non_id_verify_male'
  if (input.isPaidVerifiedNoPhotoMale) return 'paid_verified_no_photo'
  return input.showHeroBanner ? 'default' : null
}

// ─── Assist ("breather") banner ─────────────────────────────────────────────────

// Angular: assistFlag = ppSetData.ASSISTEDFLAG=='1' && ASSISTEDPROMO(local)!='1'.
export function computeShowAssistBanner(assistedFlag: string | undefined, locallyDismissed: boolean): boolean {
  return assistedFlag === '1' && !locallyDismissed
}

// ─── Header paid badge ───────────────────────────────────────────────────────────

// Angular: paidBatch = entryType=='P' && payRenewalFlag=='0' && !check_Paid_Verified_Nophoto().
export function computeHasPaidBadge(
  entryType: string, payRenewalFlag: string, isPaidVerifiedNoPhotoMaleFlag: boolean,
): boolean {
  return entryType === 'P' && payRenewalFlag === '0' && !isPaidVerifiedNoPhotoMaleFlag
}

// ─── Complete Your Profile (PCS) cards ──────────────────────────────────────────

// Angular: getPPSETData()'s completeCard filter — drops the PHOTO card once a
// photo is approved/uploaded, drops HOROSCOPE once horoscope details are available.
export function filterCompleteProfileCards(
  cards: CompleteProfileCard[], horoAvailable: boolean, photoApproved: boolean,
): CompleteProfileCard[] {
  return cards.filter(c => {
    if (c.type === 'HOROSCOPE' && horoAvailable) return false
    if (c.type === 'PHOTO' && photoApproved) return false
    return true
  })
}

// ─── Self-help / FAQ videos ──────────────────────────────────────────────────────

// Angular: *ngIf="lang !== 'en'" — this section is hidden entirely for English UI.
export function computeSelfHelpVideosVisible(lang: string): boolean {
  return lang !== 'en'
}

// ─── Liked-profiles default tab ──────────────────────────────────────────────────

export type LikedTab = 'likedyou' | 'likedbyme'

// Angular: default tab is gender-based ('likedyou' for female else 'likedbyme'),
// but if only one side has data ("singlelikedlist"), force-select that side
// regardless of the gender default.
export function computeDefaultLikedTab(
  gender: 'M' | 'F', likedYouCount: number, likedByMeCount: number,
): LikedTab {
  if (likedYouCount > 0 && likedByMeCount === 0) return 'likedyou'
  if (likedByMeCount > 0 && likedYouCount === 0) return 'likedbyme'
  return gender === 'F' ? 'likedyou' : 'likedbyme'
}

// ─── Force-update popup ──────────────────────────────────────────────────────────

export interface ForceUpdateInfo { minVersion: string }

// Angular/MatchesScreen.tsx line 1115 — same naive string/number `<` comparison,
// copied verbatim (bug-compatible with the source, not "fixed") for parity.
export function computeForceUpdateInfo(
  appForceUpdate: { APPVERSION?: string } | undefined,
  psUpdateFlag: string | null,
  appVersion: string,
): ForceUpdateInfo | null {
  if (appForceUpdate?.APPVERSION && psUpdateFlag !== '1' && appVersion < appForceUpdate.APPVERSION) {
    return { minVersion: appForceUpdate.APPVERSION }
  }
  return null
}
