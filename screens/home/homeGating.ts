// Pure gating/decision helpers for the Home screen — no I/O, no React. Each
// function mirrors one piece of business logic from Angular's ExploreComponent
// (nbpwa/src/app/pages/explore/explore.component.ts) so the rules can be reasoned
// about (and, if ever needed, tested) independently of the screen's JSX/fetching.
import type { CompleteProfileCard } from '../../service/homeService'
import type { SwiperItem } from '../../components/swiper-card/SwiperCard'

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
// Angular: <app-home-banner *ngIf="heroBannerData && !assistFlag && showHeroBanner()">
// (explore.component.html:13) — EVERY variant, including payment-failed, is
// additionally gated on showHeroBanner() at render time; a paid member with no
// pending renewal (and, if male, not non-ID-verified/paid-verified-no-photo)
// never sees the hero banner slot at all, payment failure notwithstanding.
export function computeHeroBannerVariant(input: HeroBannerVariantInput): HeroBannerVariant {
  // Angular: getPPSETData() RETURNS immediately once PAYMENTFAILTYPE=='1' is
  // detected (explore.component.ts:493-498) — the photo-promo/default chain
  // below never even runs in that case, so an unmet showHeroBanner() here
  // means no banner at all, not a fall-through to the next variant.
  if (input.paymentFailedActive) return input.showHeroBanner ? 'payment_failed' : null
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
// Angular: explore.component.ts's SHOWFLAG calc also requires `!showPhotoPromotion`
// — the force-update sticky is suppressed while the free-female add-photo hero
// banner is showing, so the two prompts never stack.
export function computeForceUpdateInfo(
  appForceUpdate: { APPVERSION?: string } | undefined,
  psUpdateFlag: string | null,
  appVersion: string,
  suppressForPhotoPromo: boolean,
): ForceUpdateInfo | null {
  if (suppressForPhotoPromo) return null
  if (appForceUpdate?.APPVERSION && psUpdateFlag !== '1' && appVersion < appForceUpdate.APPVERSION) {
    return { minVersion: appForceUpdate.APPVERSION }
  }
  return null
}

// ─── WhatsApp photo-request nudge ────────────────────────────────────────────────
// Angular: core/functions/common-funtions.ts's whatsAppPhotoFlag() +
// showWhatsAppPhotoRequest()/getWhatsAppViewHiddenPhotoRequest() — a per-card
// overlay prompting a free member to ask a match to add/unlock a photo via
// WhatsApp. Both getters depend only on the OTHER profile's photo fields plus
// one SESSION-level eligibility flag (WAPHOTOFLAG, copied from the login
// response — see registrationService.ts's storeWebURLData) — never the
// viewer's own gender/photo status, never membership type (that's checked at
// TAP time instead, inside communicationService.ts's showCallOrWhatsApp()).
//
// showReqAddPhotoElement() (profile-card.component.ts:234-239) gates ALL of a
// card's photo-request blocks on `whatsAppAddPhotoRequestFlag ||
// whatsAppViewHiddenPhotoRequest` — since the two flags' own preconditions
// (!isPhotoAvailable vs isPhotoAvailable&&isPhotoProtect) are mutually
// exclusive per profile, one combined showReqPhotoElement boolean reproduces
// this exactly without needing to know which specific block will render.
// ProfileCard.tsx's own showReqPhotoElement param defaults to `true` (most of
// its OTHER callers — e.g. the dev showcase screen — rely on that default to
// keep working without threading this flag through), so an ineligible item
// must explicitly get `false` here — leaving the field untouched would fall
// through to that default and show the overlay unconditionally regardless of
// WAPHOTOFLAG, which was the actual bug this function fixes.
export function applyWhatsAppPhotoRequestFlags(items: SwiperItem[], waPhotoFlag: string): SwiperItem[] {
  return items.map(item => {
    const whatsAppAddPhotoRequestFlag    = waPhotoFlag === '1' && !item.isPhotoAvailable && !item.isAddPhotoRequest
    const whatsAppViewHiddenPhotoRequest = waPhotoFlag === '1' && !!item.isPhotoAvailable && !!item.isPhotoProtect
    return { ...item, showReqPhotoElement: whatsAppAddPhotoRequestFlag || whatsAppViewHiddenPhotoRequest }
  })
}
