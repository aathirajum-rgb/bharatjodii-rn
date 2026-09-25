// Angular equivalent: pages/matches/matches.page.ts + matches-card.component
// Landing page for existing users after login (WEBVIEWURL page_id = 60)
// Card layout mirrors matches-card.component.html exactly.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  ListRenderItem,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  Easing, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated'
import CdnSvg, { CdnImage } from '../../components/cdn-svg/CdnSvg'
import { NewlyJoinedBadge } from '../../components/profile-photo/ProfilePhoto'
import { withRupeeFont } from '../../utils/rupeeFont'
import CdnLottie from '../../components/CdnLottie'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { useFooterBadges } from '../../contexts/FooterBadgesContext'
import MatchesHeader from '../../components/matches-header/MatchesHeader'
import {
  WhatsAppIcon, WhatsAppUnlockButton, CallIcon, MessageIcon, CloseIcon, ViewLaterIcon, LikeIcon,
  buildBasicViewParts, showLikeCTA, showAfterLikeCTA,
  BlurPhotoPlaceholder, RIGHT_ARROW_ANIMATION_URI, ProfileBadge,
  MALE_AVATAR_URI, FEMALE_AVATAR_URI,
  PhotoSwiper,
  getAfterLikeCtaLabel, getAfterLikeCtaIcon, getAfterLikeContentText, showContactsLeftBanner, showFreeBadge,
  showAfterLikeContentLine, showAfterLikeMessageCta, getMessageBtnText,
  disableDontShow, disableViewLater,
  type AfterLikeCtx,
} from '../../components/matches/matchesCard.shared'
import MatchesDesktopLayout from './MatchesDesktopLayout'
import LanguagePillSheet from '../../components/language-pill/LanguagePillSheet'
import MembershipBanner from '../../components/matches/MembershipBanner'
import JobsPromoBanner from '../../components/matches/JobsPromoBanner'
import { useNetwork } from '../../contexts/NetworkContext'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { Colors } from '../../constants/colors'
import { FontSize } from '../../src/theme/fonts'
import { CDN_SVG, CDN_LOTTIE } from '../../constants/cdn'
import { matchProfileAdapter } from '../../adapters/matches.adapter'
import { isBanner, type MatchProfile, type BannerItem, type MatchListItem } from '../../types/interfaces/matches.interface'
import { EEndCardText } from '../../types/enums/common.enum'
import {
  fetchMatches,
  fetchExplore,
  fetchSearchResults,
  type ExploreFacet,
  fetchExtendedMatchesCount, type ExtendedMatchesCountResult,
  fetchExtendedMatches,
  fetchAndStorePPSetData,
  fetchMenuPromo,
  fetchNotifCount,
  deriveExploreCount,
  checkLimitFlowStatus,
} from '../../service/homeService'
import {
  communicationBtnOnClick,
  fetchContactDetails,
  shouldSkipPhoneConfirm,
  shouldShowPhoneNoLimit,
  consumePhoneViewedId,
  checkPaidBlockerGate,
  buildVerifyIdSheet,
  getContactConfirmContent as getSharedContactConfirmContent,
} from '../../service/communicationService'
import { fetchBulkLikeMatches, getPPSetData } from '../../service/profileService'
import { redirectToViewProfile } from '../../service/buttonService'
import {
  setFilterEventType, getFilterEventType, buildSearchParams,
  getActiveQuickFilters, toggleQuickFilter, getFilterEditedCount,
  setMatchTotals, decrementMatchTotals, getPreferenceMatchCount,
  type QuickFilterChip,
} from '../../service/filterService'
import { fetchQuickFilterChips } from '../../service/registrationService'
import { FILTER_CHIP, type ChipConfig } from '../../components/matches-header/FilterChipsRow'
import {
  getHeroBannerDetails, openMembershipTab, fetchUpgradePaymentPromo, redirectToIntermediatePage, paymentTrack,
  type UpgradePaymentPromo,
} from '../../service/paymentService'
import { useAppRating } from '../../hooks/useAppRating'
import { requestPushNotificationPermission } from '../../service/permissionService'
import { fetchSurveyPopup, type SurveyPopupData } from '../../service/surveyService'
import { shouldShowIncomeSheet, saveIncome, snoozeIncomeSheet } from '../../service/incomeSheetService'
import { checkProfileValidation, type ProfileValidationInfo } from '../../service/profileValidationService'
import { fetchMonthlyIncomeOptions } from '../../service/registrationService'
import { subscribeIdVerified, subscribeVpNeedMoreProfiles, emitVpProfileListUpdated } from '../../service/eventBus'
import { getItem, setItem, getJson, removeItem } from '../../service/storageService'
import { enablePaywall, getPaymentWallType } from '../../service/payWallService'
import { getSessionValue, getRegistrationArrays } from '../../service/registrationService'
import { useAddPhotoPicker } from '../../hooks/useAddPhotoPicker'
import WebPhotoInput from '../../components/add-photo/WebPhotoInput'
import AddPhotoVerdictSheets from '../../components/add-photo/AddPhotoVerdictSheets'
import SearchablePicker, { type PickerOption } from '../../components/searchable-picker/SearchablePicker'
import { StorageKeys } from '../../constants/storage.keys'
import Constants from 'expo-constants'
import { APP_VERSION } from '../../constants/appVersion'
import GamBanner from '../../components/gam-banner/GamBanner'
import BulkLikeModal from '../../components/bulk-like/BulkLikeModal'
import BulkLikeDesktopModal from '../../components/bulk-like/BulkLikeDesktopModal'
import ContactDetailsSheet from '../../components/matches/ContactDetailsSheet'
import StickyBanner from '../../components/sticky-banner/StickyBanner'
import AppRatingModal from '../../components/app-rating/AppRatingModal'
import BottomSheet, { whatsAppPhotoRequestSheet } from '../../components/bottom-sheet/BottomSheet'
import NotificationPermissionSheet from '../../components/notification-permission-sheet/NotificationPermissionSheet'
import SurveyPopup from '../../components/survey-popup/SurveyPopup'
import Toast, { type ToastRequest } from '../../components/toast/Toast'
import ActivateMembershipBanner from '../../components/matches/ActivateMembershipBanner'

const CDN = CDN_SVG

const { width: SW } = Dimensions.get('window')
// Angular: photoHeight = (scrWidth - 32) + 'px' — matches-card left+right 16px margin each
const PHOTO_H = SW - 32

// Types imported from types/interfaces/matches.interface.ts

// Interleave banner items at their API-reported positions.
// bannerSlots[].insertAfter = number of profile items that appear before this banner.
function buildMergedList(
  profs:       MatchProfile[],
  bannerSlots: Array<{ slot: string; insertAfter: number }>,
): MatchListItem[] {
  if (bannerSlots.length === 0) return profs
  const merged: MatchListItem[] = []
  let slotIdx = 0
  for (let i = 0; i <= profs.length; i++) {
    while (slotIdx < bannerSlots.length && bannerSlots[slotIdx].insertAfter === i) {
      const bs = bannerSlots[slotIdx]
      merged.push({ _isBanner: true, bannerSlot: bs.slot, uid: `banner-${bs.slot}-${i}` })
      slotIdx++
    }
    if (i < profs.length) merged.push(profs[i])
  }
  return merged
}

// ─── Match Card ───────────────────────────────────────────────────────────────
// Mirrors matches-card.component.html structure exactly.

// Wrapped in memo() so unrelated MatchesScreen re-renders (popup timers, sticky
// countdowns, etc.) don't force every visible card to re-render during scroll —
// a card only re-renders when its own props actually change.
export const MatchCard = memo(function MatchCard({
  profile, oppGender, ownEntryType, femaleFreeEligible, indNumbersLeft,
  onPress, onLike, onDontShow, onViewLater, onCall, onWhatsApp, onWhatsAppNudge, onMessage,
  showLikedBadge, singlePhoto, hideVerifiedBadge, photoHeight, waPhotoFlag = '0',
  showExtendedIntro,
}: {
  profile:    MatchProfile
  oppGender:  'M' | 'F'
  ownEntryType:       string
  femaleFreeEligible: boolean
  indNumbersLeft:     string
  onPress:    () => void
  onLike:     () => void
  onDontShow: () => void
  onViewLater:() => void
  onCall:     () => void
  onWhatsApp: () => void
  // The photo overlay's WhatsApp button — Angular's 'whatsappNudge' action,
  // distinct from the action row's plain 'whatsapp' (a free member gets the
  // WhatsApp photo-request sheet, not the generic promo). Falls back to
  // onWhatsApp for the screens that reuse this card without wiring it.
  onWhatsAppNudge?: (() => void) | undefined
  // Optional — only the Matches list wires this up so far; Activity/ViewLater/
  // DailyRecommendation (which also reuse this card) are untouched by this fix.
  onMessage?: () => void
  // Angular's real gate is showLikedLbl (true for BOTH liked tabs on Activity,
  // regardless of the viewer's own likedStatus toward that profile) — the
  // COMTEXTDATE text itself already carries the correct direction/wording
  // ("You liked X on..." vs "X liked you on..."). Matches' own listing never
  // passes this, so its stricter likedStatus==='1' gate (this profile is one
  // you've already liked) stays exactly as-is; only ActivityScreen opts in.
  showLikedBadge?: boolean | undefined
  // Angular: daily-recommendation.component.ts's getImageArry() passes just
  // [profile.PHOTO[0]] (or the avatar) into app-matches-card, never the full
  // PHOTO array Matches itself passes — DR's card has no swipe-through-photos
  // affordance at all. Only DailyRecommendationScreen opts in.
  singlePhoto?: boolean | undefined
  // Angular: daily-recommendation.component.html hardcodes [isIdVerifiedMember]="false"
  // — DR cards never show the verified badge, unlike Matches' own
  // FUNC.IsIDVerifiedMember(profile). Only DailyRecommendationScreen opts in.
  hideVerifiedBadge?: boolean | undefined
  // Angular: DR's own photoHeight = (scrWidth - 56) + 'px' vs Matches'
  // (scrWidth - 32) + 'px' — DR's photo is shorter by the extra 24px of
  // horizontal card padding its stacked-card layout reserves. Defaults to
  // PHOTO_H (Matches' own height) when not passed.
  photoHeight?: number | undefined
  // Session-level WAPHOTOFLAG (registrationService.ts's storeWebURLData copies
  // it off the login response). Angular reads it inside
  // FUNC.getWhatsAppViewHiddenPhotoRequest(profile) —
  //   whatsAppPhotoFlag() == '1' && IsPhotoAvailable(p) && getPhotoProtect(p)
  // — and every screen that renders this card passes that getter's result
  // (matches.page.html:173, activity.component.html:205,
  // daily-recommendation.component.html:45, app-swiper.component.html:91).
  // Threaded as a prop rather than read here because it is an async session
  // read and this card renders once per list row.
  //
  // Defaults to '0' (the same default whatsAppPhotoFlag() itself returns when
  // the key is absent), so a caller that does not pass it keeps the
  // shortlist-based hidden-photo overlay rather than silently switching to the
  // WhatsApp one — the same "don't let the default turn the overlay on"
  // reasoning homeGating.ts's applyWhatsAppPhotoRequestFlags() documents.
  waPhotoFlag?: string | undefined
  // Angular: [extendedMatchesFirstId]="profile?.ISEXTENDEDMATCHES" — set on the
  // FIRST extended-matches profile only (matches.page.ts:1296). Turns this card
  // into the section opener for "matches recommended by BharatJodii": the
  // heading plus the backdrop behind it (matches-card.component.html:9-13).
  showExtendedIntro?: boolean | undefined
}) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
  const { LinearGradient } = require('expo-linear-gradient')
  // NOTE: no like-tap burst animation here, by product decision — a deliberate
  // divergence from Angular, which DOES play like-matches-post-click.json over
  // the Like CTA (button.component.html:7, gated `!data?.ONLOAD &&
  // data?.PROFILE?.LIKED in ('1','3')`). The Like tap now updates state only.
  const photoH = photoHeight ?? PHOTO_H
  const hasRealPhoto      = profile.isPhotoAvailable && !profile.isPhotoProtect && profile.photos.length > 0
  const isHiddenPhoto     = profile.isPhotoAvailable && profile.isPhotoProtect
  // Angular: photo-new.component.ts getHiddenPhotoContent() — once liked/shortlisted,
  // the "request" is considered sent and only the waiting text remains (no CTA).
  const hiddenPhotoPending = profile.likedStatus === '1' || profile.likedStatus === '3'
  // Angular: FUNC.getWhatsAppViewHiddenPhotoRequest(profile) — when the session
  // WAPHOTOFLAG is on, a hidden-photo card shows the "Get #HER_HIS# Photos on
  // WhatsApp" prompt INSTEAD of the shortlist one, and its CTA is WhatsApp, not
  // Like (photo-new.component.html:103's
  // `whatsAppViewHiddenPhotoRequest ? 'GENERAL.WHATSAPP' : 'GENERAL.SHORTLIST'`,
  // and getHiddenPhotoContent()'s own first branch). This card only ever
  // rendered the shortlist variant. The other two conditions Angular's getter
  // checks — PHOTOAVAILABLE=='Y' and PHOTOPROTECTED=='Y' — are exactly
  // isHiddenPhoto, already computed above, so only the flag is left to test.
  const whatsAppViewHiddenPhoto = waPhotoFlag === '1'
  const dontShowDisabled  = disableDontShow(profile.dontShowStatus)
  const viewLaterDisabled = disableViewLater(profile.viewLaterStatus)

  const ctaCtx: AfterLikeCtx = {
    entryType:   ownEntryType,
    likedStatus: profile.likedStatus,
    phoneViewed: profile.phoneViewed,
    femaleFreeEligible,
    indNumbersLeft,
    oppGender,
  }

  return (
    <View style={c.card}>

      {/* ── Extended-matches section opener (JODII-226) ─────────────────────
          Angular: `.recommended-jodii-position` is a recommended-jodii-bg.svg
          painted absolutely from the card's top edge, 100% wide and 100vmin
          tall, with the heading sitting over it (z-index 99) — so the wash runs
          behind the heading AND the photo below it. 100vmin on a portrait phone
          is the screen width, which is also this square asset's natural box. */}
      {showExtendedIntro && (
        <>
          <View style={c.extendedIntroBg} pointerEvents="none">
            <CdnSvg uri={CDN + 'revamp/recommended-jodii-bg.svg'} width={SW} height={SW} />
          </View>
          <Text style={[c.extendedIntroText, { fontFamily: langFonts.semiBold }]}>
            {t('MATCHES.SEEINGMATCHES')}
          </Text>
        </>
      )}

      {/* ── Photo section ──────────────────────────────────────────────────── */}
      {/* Angular: app-photo-new — top border radius 16px */}
      <View style={[c.photoBox, { height: photoH }]}>
        {hasRealPhoto ? (
          // Normal: actual photo(s) — swiper when >1, single Pressable image otherwise.
          // Angular: matches-card.component's Swiper. No lock/restriction on swiping
          // through a match's photos — confirmed against the real Angular app; a
          // previous pass here mistakenly gated photo 2+ behind an "add your own
          // photo" card, misattributing femaleFreeContactRestrict() (which actually
          // restricts CONTACT actions, not photo viewing — see femaleFreeEligible).
          // `singlePhoto` (DR only) restricts this to just the first photo — see
          // its own doc comment above.
          <PhotoSwiper
            images={singlePhoto ? profile.photos.slice(0, 1) : profile.photos}
            width={SW - 32}
            height={photoH}
            oppGender={oppGender}
            onPress={onPress}
          />
        ) : isHiddenPhoto ? (
          // Photo exists but is protected/hidden — distinct from "no photo at all".
          // Angular: photo-new.component's viewPhotoRequest block, HORO_HIDDEN_LIKE/
          // HORO_HIDDEN_PHOTO text driven by likedStatus (not a separate request flag).
          // photo-new.component.ts's `profileImage` is a plain @Input set by the
          // parent, and photo-new.component.html only ever applies `.blur-photo`
          // (filter: blur(4px)) to it — the REAL photo, same as
          // viewprofile.page.html:171-186. This used getBlurPhotoUri()'s generic
          // gender-silhouette placeholder instead, same gap ViewProfileScreen.tsx
          // had (now fixed there too).
          <View style={c.singlePhotoPressable}>
            <PhotoSwiper
              images={singlePhoto ? profile.photos.slice(0, 1) : profile.photos}
              width={SW - 32}
              height={photoH}
              oppGender={oppGender}
              onPress={onPress}
              blur
            />
            <View style={c.photoOverlay}>
              <View style={c.overlayCard}>
                {/* Angular: photo-new.component.html:4-6 — the padlock badge
                    shows whenever isPhotoProtect, unconditionally on which CTA
                    (WhatsApp-link or Shortlist/Like) renders below it. Was
                    missing entirely here, same gap ProfilePhoto.tsx had. */}
                <CdnSvg uri={CDN + 'revamp/hidden-lock.svg'} width={28} height={28} />
                {whatsAppViewHiddenPhoto ? (
                  /* Angular: getHiddenPhotoContent() → getHiddenPhotoRequestText().
                     Unlike the shortlist variant below, this one is NOT gated on
                     likedStatus — photo-new.component.html:98 renders it for every
                     protected photo, and photo-request.component.html:8 keeps the
                     CTA row visible whenever whatsAppViewHiddenPhotoRequest is set.
                     Uses the same string + PRONOUN replacement ProfilePhoto.tsx:508
                     already renders for this case; Angular reaches for
                     getGenderPrefix_Him_Her ('him'/'her') rather than the
                     his/her used here, which differs only for a male profile. */
                  // Product decision: same copy as ViewProfile's overlay for this
                  // profile ("Contact and Get #HER_HIS# Photos on WhatsApp") rather
                  // than Angular's shorter REQUEST_HIDDEN_PHOTO_WHATSAPP, so the
                  // Matches card and View Profile read identically.
                  <Text style={[c.overlayText, { fontFamily: langFonts.regular }]}>
                    {t('GENERAL.REQUEST_ADD_PHOTO_WHATSAPP')
                      .replace('#HER_HIS#', t(`PRONOUN.${oppGender}.hisher`))}
                  </Text>
                ) : (
                  <Text style={[c.overlayText, { fontFamily: langFonts.regular }]}>
                    {t(hiddenPhotoPending ? 'VIEWPROFILE.HORO_HIDDEN_PHOTO' : 'VIEWPROFILE.HORO_HIDDEN_LIKE')
                      .replace(/##HE_SHE##/g, t(`PRONOUN.${oppGender}.heshe`))
                      .replace(/##HIS_HER##/g, t(`PRONOUN.${oppGender}.hisher`))
                      .replace(/##he_she##/g, t(`PRONOUN.${oppGender}.heshe`).toLowerCase())}
                  </Text>
                )}
                {whatsAppViewHiddenPhoto && (
                  /* Angular routes this through the SAME handler as the no-photo
                     WhatsApp overlay below (communication.service.ts:202-254's
                     whatsAppPhotoRequestBtnClickOn) — there is no separate
                     "request sent" state for the hidden-photo variant. The CTA
                     ITSELF is a different design though, per photo-request.
                     component.html:34-46 — a plain green underlined text link
                     with a trailing chevron (buttonType link, background
                     transparent), not the solid WhatsApp-branded button the
                     no-photo-at-all case below uses. Same fix already applied
                     to ProfilePhoto.tsx's equivalent overlay. */
                  <Pressable
                    style={c.whatsappLinkBtn}
                    onPress={onWhatsAppNudge ?? onWhatsApp}
                  >
                    <Text style={[c.whatsappLinkText, { fontFamily: langFonts.regular }]}>
                      {t('GENERAL.WHATSAPP')}
                    </Text>
                    <CdnSvg uri={CDN + 'revamp/forward-icon-green.svg'} width={7} height={10} />
                  </Pressable>
                )}
                {!whatsAppViewHiddenPhoto && !hiddenPhotoPending && (
                  <Pressable onPress={onLike}>
                    {/* Angular: EButtonBackground.whatsApp = --ion-color-whatsapp-bg =
                        linear-gradient(180deg, #4AC14B 0%, #06853A 100%) (theme/variables
                        .scss:63) — a gradient, not the flat WhatsApp-brand green (#25D366)
                        this used before. */}
                    <LinearGradient
                      colors={['#4AC14B', '#06853A']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={c.waBtn}
                    >
                      <LikeIcon width={16} height={16} />
                      <Text style={[c.waBtnText, { fontFamily: langFonts.medium }]}>{t('GENERAL.LIKE_CTA').replace('#HER_HIM#', '').trim()}</Text>
                    </LinearGradient>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        ) : (
          // No photo at all: blur placeholder + WhatsApp overlay
          // Angular: getWhatsAppAvatarImg() + request-photo-vp overlay
          <Pressable style={c.singlePhotoPressable} onPress={onPress}>
            {/* BlurPhotoPlaceholder: the card-stack blur artwork (side-cards +
                bottom fade) the web SVG draws — see that component. */}
            <BlurPhotoPlaceholder
              oppGender={oppGender}
              width="100%" height="100%"
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <View style={c.photoOverlay}>
              <View style={c.overlayCard}>
                <Text style={c.overlayText}>
                  {t('GENERAL.REQUEST_ADD_PHOTO_WHATSAPP').replace('#HER_HIS#', t(`PRONOUN.${oppGender}.hisher`))}
                </Text>
                <WhatsAppUnlockButton label={t('GENERAL.WHATSAPP')} onPress={onWhatsAppNudge ?? onWhatsApp} />
              </View>
            </View>
          </Pressable>
        )}

        {/* Angular: .newly-joined posabsolute — the same "Newly Joined" badge
            (newly-joined.svg bg + star + MATCHES.NEW_BADGE) ProfilePhoto shows. */}
        {profile.isNewlyJoined && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <NewlyJoinedBadge />
          </View>
        )}
      </View>

      {/* ── Paid + Verified badges ─────────────────────────────────────────── */}
      {/* Angular: ion-row isProfileBadge — BELOW the photo, not overlaid.
          Verified badge is gated to female viewers only (matches-card.component.html:
          *ngIf="isIdVerifiedMember && FUNC.getLogInGender() == 'F'"). oppGender is the
          viewer's opposite gender, so oppGender === 'M' means the viewer herself is female. */}
      {(profile.isPaidMember || (profile.isIdVerified && oppGender === 'M' && !hideVerifiedBadge)) && (
        <View style={c.badges}>
          {profile.isPaidMember && (
            <ProfileBadge variant="paid" text={t('MENU.PAID_BADGE')} />
          )}
          {profile.isIdVerified && oppGender === 'M' && !hideVerifiedBadge && (
            <ProfileBadge variant="verified" text={t('MATCHES.VERIFIED_ID')} />
          )}
        </View>
      )}

      {/* ── Liked strip ────────────────────────────────────────────────────── */}
      {/* Angular: .liked-profile { border-radius:50px; background: linear-gradient(
          90deg, #FFEAF7 0%, #FFF 100%); padding: 4px 8px } (matches-card.component
          .scss:175-179) — an actual pink→white GRADIENT, not the flat color this
          previously used, and alignSelf:'flex-start' so it hugs its content like
          Angular's flex div (was stretching full-width before). */}
      {!!profile.likedDateText && (showLikedBadge || profile.likedStatus === '1') && (
        <LinearGradient
          colors={['#FFEAF7', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={c.likedStrip}
        >
          <CdnSvg uri={CDN + 'liked-new.svg'} width={20} height={20} />
          <Text style={[c.likedText, { fontFamily: langFonts.regular }]} numberOfLines={1}>{profile.likedDateText}</Text>
        </LinearGradient>
      )}

      {/* ── Activity label row ────────────────────────────────────────────── */}
      {/* Angular: isActivityLabel — "Viewed on …" / "Shortlisted on …" with icon */}
      {profile.isNewLabel && !!profile.labelContent && (
        <View style={c.activityRow}>
          <CdnSvg uri={CDN + 'revamp/viewed-icon-updated.svg'} width={16} height={16} style={{ marginTop: 2, flexShrink: 0 }} />
          <Text style={[c.activityText, { fontFamily: langFonts.medium }]}>{profile.labelContent}</Text>
        </View>
      )}

      {/* ── Name + Message icon + Call icon + WhatsApp icon ────────────────── */}
      {/* Angular: d-flex row: heading2-semibold-18 name + phone-icon (message) + phone-icon (call) + matches-whatsapp */}
      <View style={c.nameRow}>
        {/* flexShrink (not flex:1) — the name sits at its own width so the icons land
            right next to it, not pushed to the far edge of the row. Still truncates
            via numberOfLines if the name itself is too long for the row. */}
        <Pressable style={{ flexShrink: 1 }} onPress={onPress}>
          <Text style={[c.name, { fontFamily: langFonts.semiBold }]} numberOfLines={1}>{profile.name}</Text>
        </Pressable>
        {/* Angular: .phone-icon — plain 24x24 image, no circle/border */}
        {onMessage && (
          <Pressable style={c.iconBtn} onPress={onMessage} hitSlop={8}>
            <MessageIcon width={24} height={24} />
          </Pressable>
        )}
        <Pressable style={c.iconBtn} onPress={onCall} hitSlop={8}>
          <CallIcon width={24} height={24} />
        </Pressable>
        <Pressable style={c.iconBtn} onPress={onWhatsApp} hitSlop={8}>
          <WhatsAppIcon width={28} height={28} />
        </Pressable>
      </View>

      {/* ── Basic view text ────────────────────────────────────────────────── */}
      {/* Angular: bindBasicView() — "27 yrs | 5'5" | Brahmin | B.Tech | Engineer | Chennai, TN" —
          solid black segments, "|" separators alone drop to 20% opacity. */}
      <Pressable onPress={onPress}>
        {/* Angular clamps this block with .text-space (max-height 144px) at
            .line-height-20, i.e. 7 lines — not 4. Cutting it at 4 dropped the
            tail of any lengthy basic-view string (long education/occupation/
            city values, and vernacular text, which runs longer than English). */}
        <Text style={[c.basicView, { fontFamily: langFonts.regular }]} numberOfLines={7}>
          {buildBasicViewParts(profile, oppGender === 'M').map((part, i) => (
            <Text key={i}>
              {i > 0 && <Text style={c.basicViewSep}> | </Text>}
              {withRupeeFont(part)}
            </Text>
          ))}
        </Text>
      </Pressable>

      {/* ── View profile link ──────────────────────────────────────────────── */}
      {/* Angular: app-button-revamp [iconType]="forwardAnimation" — swaps the plain
          chevron for this animated GIF (button-revamp.component.html IsShowAnimation()). */}
      <Pressable onPress={onPress} style={c.viewProfileBtn}>
        <Text style={[c.viewProfileText, { fontFamily: langFonts.medium }]}>{t('MATCHES.VIEW_PROFILE_CTA')}</Text>
        <Image source={{ uri: RIGHT_ARROW_ANIMATION_URI }} style={c.viewProfileArrow} />
      </Pressable>

      {/* ── CTA section ────────────────────────────────────────────────────── */}
      {/* Angular: showLikeCTA → Don't Show | View Later | Like
                  showAfterLikeCTA → Send Interest / after-like state */}
      {showLikeCTA(profile.likedStatus) && (
        // Angular: Row 1 = tertiary (Don't show) + secondary (View later), Row 2 = primary (Like) full-width
        <View style={c.ctaSection}>
          <View style={c.ctaSecRow}>
            <Pressable
              style={[c.ctaDontShow, dontShowDisabled && c.ctaDisabled]}
              onPress={onDontShow}
              disabled={dontShowDisabled}
            >
              <CloseIcon width={24} height={24} />
              <Text style={[c.ctaDontShowText, { fontFamily: langFonts.regular }, dontShowDisabled && c.ctaDisabledText]}>
                {t('GENERAL.DONTSHOWCTA')}
              </Text>
            </Pressable>
            <Pressable
              style={[c.ctaViewLater, viewLaterDisabled && c.ctaDisabled]}
              onPress={onViewLater}
              disabled={viewLaterDisabled}
            >
              <ViewLaterIcon width={24} height={24} />
              <Text style={[c.ctaViewLaterText, { fontFamily: langFonts.regular }, viewLaterDisabled && c.ctaDisabledText]}>
                {t('GENERAL.VIEWLATER')}
              </Text>
            </Pressable>
          </View>
          <Pressable style={c.ctaLike} onPress={onLike}>
            <LikeIcon width={24} height={24} />
            <Text style={[c.ctaLikeText, { fontFamily: langFonts.semiBold }]}>{t('GENERAL.LIKE_CTA').replace('#HER_HIM#', '').trim()}</Text>
          </Pressable>
        </View>
      )}

      {showAfterLikeCTA(profile.likedStatus) && (
        // Angular: matches-cta-bg-color (pink gradient bg) + getContentAfterLike() text +
        // Call Now/Pay Now CTA (#22) + FREE badge (#24) + contacts-left line (#23).
        <View style={c.afterLikeRow}>
          {/* Angular hides this line for a paid member — the contact CTAs right
              below already say it (matches-card.component.html:174-176). */}
          {showAfterLikeContentLine(ctaCtx) && (
            <Text style={[c.afterLikeText, { fontFamily: langFonts.medium }]}>
              {getAfterLikeContentText(ctaCtx, t)}
            </Text>
          )}
          <View style={c.ctaSendInterestWrap}>
            {showFreeBadge(ctaCtx) && (
              <View style={c.freeBadge} pointerEvents="none">
                <Text style={[c.freeBadgeText, { fontFamily: langFonts.semiBold }]}>{t('GENERAL.FREE')}</Text>
              </View>
            )}
            <Pressable style={c.ctaSendInterest} onPress={onCall}>
              <View style={c.ctaSendInterestIconBox}>
                <CdnSvg uri={getAfterLikeCtaIcon(ctaCtx)} width={18} height={18} />
              </View>
              <Text style={[c.ctaSendInterestText, { fontFamily: langFonts.medium }]}>{getAfterLikeCtaLabel(ctaCtx, t)}</Text>
            </Pressable>
          </View>
          {/* JODII-499: paid members get a second "Message him/her" CTA below the
              primary one — outlined, brand-red label + message_red.svg icon
              (CONFIG.MESSAGE_BTN). Free members get the Pay Now CTA alone. */}
          {showAfterLikeMessageCta(ctaCtx) && !!onMessage && (
            <Pressable style={c.ctaMessage} onPress={onMessage}>
              {/* 24x24: MESSAGE_BTN (button.config.ts:75) sets no iconSize, so
                  button-revamp falls back to its default `EIconSize.large` — a
                  24x24 box — and the icon is a CSS background with no
                  background-size, so message_red.svg draws at its own intrinsic
                  24x24. 18 here rendered it visibly smaller than Angular. */}
              <CdnSvg uri={CDN + 'message_red.svg'} width={24} height={24} />
              <Text style={[c.ctaMessageText, { fontFamily: langFonts.medium }]}>{getMessageBtnText(ctaCtx, t)}</Text>
            </Pressable>
          )}
          {showContactsLeftBanner(ctaCtx) && (
            <Text style={[c.contactsLeftText, { fontFamily: langFonts.regular }]}>{t('VIEWPROFILE.CONTACT_SEEN_INFO')}</Text>
          )}
        </View>
      )}

    </View>
  )
})

// Mapping moved to adapters/matches.adapter.ts — use singleton adapter


// ─── Photo Promotion Banner ───────────────────────────────────────────────────
// Angular: home-banner.component.html addPhotoPromotion action (lines 213-237)
// Shows when PROFILEPUBLISHEDFLAG=0 + PROFILEPUBLISHEDTYPE in 1|2 + ENTRYTYPE=F
// Layout: image left (4/12) + title/body/CTA right (8/12), bg rgba(181,0,51,0.05)

function PhotoPromotionBanner({ data, onPress }: { data: any; onPress: () => void }) {
  const { LinearGradient } = require('expo-linear-gradient')
  const stripHtml = (s: string) => s?.replace(/<[^>]*>/g, '') ?? ''
  const langFonts = useLanguageFonts()
  return (
    // Angular: free-trial-height min-height:38vmin, BGCOLOR gradient #FFDDDD→#FFF
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={[Colors.photoPromoGradientStart, Colors.white]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={pb.container}
      >
        {/* Left: banner image — Angular ion-col size="4", padd0, img fills col.
            CDN icon assets here are SVG — plain RN <Image> can't decode SVG on
            native (only web's <img> can), which is why this rendered fine in a
            browser preview but showed nothing on a real device install. */}
        <View style={pb.imageCol}>
          {!!data.BANNERIMG && (
            <CdnSvg uri={data.BANNERIMG} width="100%" height={140} />
          )}
        </View>

        {/* Right: title + body + CTA — Angular ion-col size="8", pt-6 */}
        <View style={pb.textCol}>
          {!!data.TITLE && <Text style={[pb.title, { fontFamily: langFonts.semiBold }]}>{stripHtml(data.TITLE)}</Text>}
          {!!data.BODY  && <Text style={[pb.body, { fontFamily: langFonts.regular }]}>{stripHtml(String(data.BODY))}</Text>}
          {!!data.CTA   && (
            <Pressable
              style={[pb.ctaBtn, { backgroundColor: data.CTABGCOLOR || Colors.primaryDark }]}
              onPress={onPress}
            >
              <Text style={[pb.ctaText, { fontFamily: langFonts.semiBold, color: data.CTACOLOR || Colors.white }]}>{stripHtml(data.CTA)}</Text>
            </Pressable>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  )
}

// ─── PCS banner (BANNERSLOTs 1011 "add photo" + 1012 "add horoscope") ─────────
// Angular: breather.component's breatherType==='PCS' — 1011 and 1012 are verified
// to share this EXACT template (breather.component.ts:57-69/html:1-17), differing
// only in icon/copy/button-color/background-gradient, not layout. Centered vertical
// stack: square icon (44.444vmin ≈ 44% of screen width) → 16px gap → centered 18px
// Poppins-Semibold black title → 24px gap → full-width 44px/8px-radius colored button.
function PcsBanner({
  imageUri, title, cta, ctaBg, gradientColors, onPress,
}: {
  imageUri:        string
  title:           string
  cta:             string
  ctaBg:           string
  gradientColors: [string, string]
  onPress:         () => void
}) {
  const { LinearGradient } = require('expo-linear-gradient')
  const iconSize = Math.round(SW * 0.4444)
  const langFonts = useLanguageFonts()
  return (
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={pcs.container}>
      <View style={{ width: iconSize, height: iconSize }}>
        <CdnSvg uri={imageUri} width="100%" height="100%" />
      </View>
      <Text style={[pcs.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>
      <Pressable style={[pcs.cta, { backgroundColor: ctaBg }]} onPress={onPress}>
        <Text style={[pcs.ctaText, { fontFamily: langFonts.regular }]}>{cta}</Text>
      </Pressable>
    </LinearGradient>
  )
}

const pcs = StyleSheet.create({
  container: {
    alignItems:        'center',
    paddingHorizontal: 24,
    paddingTop:         24,
    paddingBottom:      24,
    // Same 8px #E6E6E6 divider as the profile cards (c.card) around it, so the
    // banner reads as its own slide instead of running into the next card.
    borderBottomWidth: 8,
    borderBottomColor: Colors.borderSubtle,
  },
  // Angular: breather.component.html's PCS block — heading2-semibold-18 black-color
  // fontFamily applied inline (langFonts.semiBold) — see PcsBanner's Text usage.
  title: {
    marginTop:  16,
    fontSize:   FontSize.font18,
    color:      Colors.black,
    textAlign:  'center',
    marginBottom: 24,
  },
  cta: {
    marginTop:      24,
    width:          '100%',
    height:         44,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  // Angular: app-button-revamp default ctaFontSize = EButtonFontSize.regular14
  // fontFamily applied inline (langFonts.regular) — see PcsBanner's Text usage.
  ctaText: {
    fontSize:   FontSize.font14,
    color:      Colors.white,
  },
})

// ─── Simple promo banner (1014's static fallback + 1015) ──────────────────────
// NOTE: research confirms 1014's fallback and 1015 ("PAYMENT" breatherType — ribbon,
// benefits list, timer chip) each have their OWN distinct Angular layout, neither
// matching this generic row. This is a known, flagged simplification — not yet
// redesigned to match Angular exactly the way PcsBanner above now does for 1011/1012.

function SimplePromoBanner({
  imageUri, title, cta, ctaBg, onPress,
}: { imageUri?: string | undefined; title: string; cta: string; ctaBg?: string | undefined; onPress: () => void }) {
  const langFonts = useLanguageFonts()
  return (
    <Pressable style={spb.card} onPress={onPress}>
      {!!imageUri && <Image source={{ uri: imageUri }} style={spb.image} resizeMode="contain" />}
      <Text style={[spb.title, { fontFamily: langFonts.medium }]} numberOfLines={2}>{title}</Text>
      <View style={[spb.cta, ctaBg ? { backgroundColor: ctaBg } : null]}>
        <Text style={[spb.ctaText, { fontFamily: langFonts.semiBold }]}>{cta}</Text>
      </View>
    </Pressable>
  )
}

// FLAGGED — no matching Angular visual. These promo banners come from
// <app-breather>, whose PAYMENT / IDVERIFY / ADDPHOTO branches are all
// full-bleed banners with `min-height: 387px` (breather.component.scss's
// .matches-breather-block / .breather-block). This port renders a compact
// 12px-padded card with a 40px icon instead, so none of the sizes below map
// onto an Angular rule — they are tokenised for consistency only, not verified.
const spb = StyleSheet.create({
  card: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.surface,
    borderRadius:      12,
    marginHorizontal:  16,
    marginBottom:      16,
    padding:           12,
    gap:               12,
    shadowColor:       Colors.shadow,
    shadowOpacity:     0.08,
    shadowRadius:      8,
    shadowOffset:      { width: 0, height: 2 },
    elevation:         2,
  },
  image: { width: 40, height: 40 },
  // fontFamily applied inline (langFonts.medium) — see SimplePromoBanner's Text usage.
  title: {
    flex:       1,
    fontSize:   FontSize.font13,
    color:      Colors.textDark,
  },
  cta: {
    // Fallback only — ctaBg prop overrides this when the server provides a color.
    // Angular's own fallback CTA color is primaryBg (#B50033 = Colors.primaryDark).
    backgroundColor:   Colors.primaryDark,
    borderRadius:      8,
    paddingVertical:   8,
    paddingHorizontal: 12,
  },
  // fontFamily applied inline (langFonts.semiBold) — see SimplePromoBanner's Text usage.
  ctaText: {
    fontSize:   FontSize.font12,
    color:      Colors.white,
  },
})

// ─── Add Photo Banner (BANNERSLOT 1013) ──────────────────────────────────────
// Angular: app-breather ADDPHOTO type — data from REGISTRATIONARRAYS.PHOTOPUBLISHED.Matches
// Layout: image left (4/12) + text right (8/12): TITLE + SUBHEADER + BODY.CONTENT1/CONTENT2 + CTA

function AddPhotoBanner({ data, onPress }: { data: any; onPress: () => void }) {
  const langFonts = useLanguageFonts()
  if (!data) return null
  // Angular: breather ADDPHOTO — single column, linear-gradient(133deg, #F2F4FF → #DCFFF0)
  const { LinearGradient } = require('expo-linear-gradient')
  const stripHtml = (s: string) => s?.replace(/<[^>]*>/g, '') ?? ''
  const title   = stripHtml(data.TITLE    ?? 'Add photo to activate your profile')
  const subhead = stripHtml(data.SUBHEADER ?? 'Only if you add photo:')
  const line1   = stripHtml(data.BODY?.CONTENT1 ?? 'You will be able to like matches.')
  const line2   = stripHtml(data.BODY?.CONTENT2 ?? 'Your profile will be visible to matches')
  const cta     = stripHtml(data.CTA ?? 'Add photo now')
  const ctaBg   = data.CTABGCOLOR || Colors.addPhotoCtaBg

  return (
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={[Colors.addPhotoGradientStart, Colors.addPhotoGradientEnd]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={ap.container}
      >
        {/* Image — Angular: add-photo-height = 13vh ≈ 87px, align-items flex-start.
            SVG icon — CdnSvg so it decodes on native (plain Image can't render SVG there). */}
        {!!data.BANNERIMG && (
          <CdnSvg uri={data.BANNERIMG} width={87} height={87} />
        )}

        {/* Title — Angular: heading1-semibold-22 black-color line-height-32 */}
        <Text style={[ap.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        {/* Subheader — Angular: body1-medium-14 black-color */}
        <Text style={[ap.subheader, { fontFamily: langFonts.medium }]}>{subhead}</Text>

        {/* Bullets — Angular: ul pl-24, li body2-regular-14, benefits-container gap:12 */}
        <View style={ap.bullets}>
          {!!line1 && (
            <View style={ap.bulletRow}>
              <Text style={ap.bullet}>{'•'}</Text>
              <Text style={[ap.bulletText, { fontFamily: langFonts.regular }]}>{line1}</Text>
            </View>
          )}
          {!!line2 && (
            <View style={ap.bulletRow}>
              <Text style={ap.bullet}>{'•'}</Text>
              <Text style={[ap.bulletText, { fontFamily: langFonts.regular }]}>{line2}</Text>
            </View>
          )}
        </View>

        {/* CTA — Angular: hasFullWidth, mt-6 */}
        <Pressable style={[ap.ctaBtn, { backgroundColor: ctaBg }]} onPress={onPress}>
          <Text style={[ap.ctaText, { fontFamily: langFonts.semiBold }]}>{cta}</Text>
        </Pressable>
      </LinearGradient>
    </Pressable>
  )
}

// ─── Extended Matches End Card ────────────────────────────────────────────────
// Angular: app-end-card [cardType]="'view-more'" (end-card.component.ts:35-46).
// NOT a button: a ~3.5s progress bar fills (progress += 0.01 every 35ms), then
// 1000ms later it emits 'extendedPage' by itself and the extended feed loads.
// This port had it as a Pressable with a static bar, so the flow stalled until
// the member happened to tap the card.

// Angular end-card.component.ts: 0.01 per 35ms tick, fire 1000ms after it passes 1.
const EXT_PROGRESS_STEP    = 0.01
const EXT_PROGRESS_TICK_MS = 35
const EXT_ADVANCE_DELAY_MS = 1000

// Shared "nothing to offer" result, so every skipped branch of the count gate
// returns the same shape fetchExtendedMatchesCount() does.
const EMPTY_EXTENDED_COUNT: ExtendedMatchesCountResult = { count: 0, previewPhotos: [] }

// Contact CTAs routed through communicationBtnOnClick(). 'whatsappNudge' is the
// photo overlay's WhatsApp button (see MatchCard's onWhatsAppNudge).
type ContactAction = 'call' | 'whatsapp' | 'whatsappNudge'

function ExtendedMatchesCard({
  count, previewPhotos, oppGender, onAdvance,
}: {
  count:         number
  previewPhotos: string[]
  oppGender:     'M' | 'F'
  onAdvance:     () => void
}) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
  const { LinearGradient } = require('expo-linear-gradient')
  const { height: winH } = useWindowDimensions()
  const [progress, setProgress] = useState(0)

  // Angular sizes these in vh: `.avatar-images { width: 9vh; height: 9vh }`, and
  // each next circle starts 6vh along, so they overlap by a third
  // (end-card.component.scss:6-42). A hardcoded 52px left the row small and
  // tight next to the Angular screen.
  const avatarSize = Math.round(winH * 0.09)
  const overlap    = -Math.round(avatarSize / 3)

  // Angular ngOnInit(): the interval drives the bar, and the first time it passes
  // 1 it schedules the one-shot advance. `fired` is Angular's own emitHappened
  // guard — the interval keeps ticking past 1, so without it every later tick
  // would schedule another advance. Through a ref so the effect can stay
  // mount-only while still calling the current handler.
  const onAdvanceRef = useRef(onAdvance)
  onAdvanceRef.current = onAdvance
  useEffect(() => {
    let value = 0
    let fired = false
    let advanceTimer: ReturnType<typeof setTimeout> | undefined
    const tick = setInterval(() => {
      value += EXT_PROGRESS_STEP
      setProgress(value)
      if (value > 1 && !fired) {
        fired = true
        advanceTimer = setTimeout(() => onAdvanceRef.current(), EXT_ADVANCE_DELAY_MS)
      }
    }, EXT_PROGRESS_TICK_MS)
    return () => { clearInterval(tick); clearTimeout(advanceTimer) }
  }, [])

  // Angular showPhotoCard(): `parseInt(matchesCount) > 3` — with 3 or fewer
  // profiles behind it the card is just the "Please wait" copy and the loader,
  // no photo slots. And each slot uses a REAL photo only once there are 4+ of
  // them (end-card.component.html:14's `length >= 4 ? THUMBIMG : avatarImg`),
  // so a short preview list shows the generic avatar rather than one stray face.
  const showPhotos = count > 3
  const useRealPhotos = previewPhotos.length >= 4
  const slots = showPhotos ? previewPhotos.slice(0, 3) : []

  // Angular: common.getAvatarImg(true, 120) — the OPPOSITE gender silhouette,
  // not a hardcoded female one.
  const avatarUri = oppGender === 'M' ? MALE_AVATAR_URI : FEMALE_AVATAR_URI
  const circle    = { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }

  return (
    // Angular: this end card IS a full slide (`height100 d-flex
    // ion-align-items-center`) on the plain white page — no rounded panel, no
    // shadow, no side margins, content centred in the viewport. 56 is the app
    // footer, so the centre lands on the visible middle rather than behind it.
    <View style={[e.card, { minHeight: winH - 56 }]}>
      <View style={e.avatarRow}>
        {slots.map((photo, i) => (
          <View key={i} style={[e.avatarCircle, circle, { marginLeft: i === 0 ? 0 : overlap }]}>
            {useRealPhotos
              ? <Image source={{ uri: photo }} style={e.avatarImg} resizeMode="cover" />
              : <CdnSvg uri={avatarUri} width={avatarSize} height={avatarSize} />}
          </View>
        ))}
        <View style={[e.countCircle, circle, slots.length > 0 && { marginLeft: overlap }]}>
          <Text style={[e.countNum, { fontFamily: langFonts.medium }]}>+{count}</Text>
          <Text style={[e.countLabel, { fontFamily: langFonts.regular }]}>{t('MATCHES.MORE')}</Text>
        </View>
      </View>

      {/* Angular passes MATCHES.PLEASEWAIT / MATCHES.VIEWMATCHES here
          (matches.page.html:202-203) — this card is a wait state, not the
          "Continue seeing profile" prompt those other two keys describe. */}
      <Text style={[e.title, { fontFamily: langFonts.semiBold }]}>{t('MATCHES.PLEASEWAIT')}</Text>
      <Text style={[e.desc, { fontFamily: langFonts.regular }]}>
        {t('MATCHES.VIEWMATCHES')}
      </Text>

      {/* Angular: ion-progress-bar — 10px tall, 20px radius, white track and a
          `linear-gradient(to right, #ffffff 5%, #B30033)` fill
          (end-card.component.scss:57-63), so it fades in from the left rather
          than being a flat 4px crimson strip. */}
      <View style={e.progressTrack}>
        <LinearGradient
          colors={[Colors.white, Colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[e.progressFill, { width: `${Math.min(progress, 1) * 100}%` }]}
        />
      </View>
    </View>
  )
}

// ─── No Matches (empty state) ──────────────────────────────────────────────────
// Angular: app-end-card [cardType]="'no-data'" — shown when contentLoaded &&
// profiles.length === 0 (matches.page.html:209-215). CTA navigates to the
// filter/preferences screen (endCardEventEmit('search') → reDirectSearchPage()).

function NoMatchesCard({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
  return (
    <View style={n.card}>
      <CdnLottie uri={CDN_LOTTIE + 'no-matches-animation.json'} width={100} height={100} />
      <Text style={[n.title, { fontFamily: langFonts.semiBold }]}>{t(EEndCardText.noMatches)}</Text>
      <Text style={[n.desc, { fontFamily: langFonts.regular }]}>{t(EEndCardText.modifyPreference)}</Text>
      <Pressable style={n.cta} onPress={onPress}>
        <Text style={[n.ctaText, { fontFamily: langFonts.medium }]}>{t(EEndCardText.ctaModifyPreference)}</Text>
      </Pressable>
    </View>
  )
}

const n = StyleSheet.create({
  card: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 24,
    gap:               6,
  },
  // Angular: end-card.component.html cardType='no-data' — heading3-semibold-16 black-color
  // fontFamily applied inline (langFonts.semiBold) — see NoMatchesCard's Text usage.
  title: {
    fontSize:   FontSize.font16,
    color:      Colors.black,
    textAlign:  'center',
  },
  // Angular: body2-regular-14 black-color
  // fontFamily applied inline (langFonts.regular) — see NoMatchesCard's Text usage.
  desc: {
    fontSize:   FontSize.font14,
    color:      Colors.black,
    textAlign:  'center',
  },
  cta: {
    marginTop:         16,
    borderWidth:       1,
    // Matches ButtonRevamp's own 'secondary' variant convention (outline buttons
    // border/text on Colors.primaryDark, not the unrelated general Colors.primary).
    borderColor:       Colors.primaryDark,
    borderRadius:      8,
    paddingHorizontal: 20,
    paddingVertical:   10,
  },
  // Angular: ion-button class="body1-medium-14 secondary-cta-jodii" — color #B50033 = Colors.primaryDark
  // fontFamily applied inline (langFonts.medium) — see NoMatchesCard's Text usage.
  ctaText: {
    fontSize:   FontSize.font14,
    color:      Colors.primaryDark,
  },
})

// BANNERSLOT 1010 — "get ID verified" promo (Angular: matches.page.ts:1208-1210, sent
// via EKYCFLAG=1 for non-verified male users). Removed live by subscribeIdVerified().
// FLAGGED: no confirmed 1:1 Angular template found for this exact compact-row layout
// (unlike PcsBanner/AddPhotoBanner above, whose breather.component.html source is
// confirmed) — matches.page.ts routes 1010 through app-breather too, but none of its
// breatherType blocks (PCS/PAYMENT/ADDPHOTO/ADDPHOTOPAID/IDVERIFY) match this icon+
// textCol+pill shape. Typography left as-is pending that source; not touched here.
function IdVerifyBanner({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()
  return (
    <Pressable style={iv.card} onPress={onPress}>
      <CdnSvg uri={CDN + 'id-verify-promo.svg'} width={40} height={40} />
      <View style={iv.textCol}>
        <Text style={[iv.title, { fontFamily: langFonts.semiBold }]}>{t('VERIFY_ID.VERIFY_PROFILE_TXT')}</Text>
        <Text style={[iv.body, { fontFamily: langFonts.regular }]}>{t('VERIFY_ID.VERIFY_PROFILE_TXT_1')}</Text>
      </View>
      <View style={iv.cta}>
        <Text style={[iv.ctaText, { fontFamily: langFonts.semiBold }]}>{t('VERIFY_ID.VERIFY_NOW_CTA')}</Text>
      </View>
    </Pressable>
  )
}

// FLAGGED — same as spb above: Angular's IDVERIFY breather (bannerSlot 1010)
// is a 387px full-bleed banner, not this compact card. Sizes tokenised only.
const iv = StyleSheet.create({
  card: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.badgeVerifiedBg,
    borderRadius:      12,
    marginHorizontal:  16,
    marginBottom:      16,
    padding:           12,
    gap:               12,
  },
  textCol: { flex: 1 },
  // fontFamily applied inline (langFonts.semiBold) — see IdVerifyBanner's Text usage.
  title: {
    fontSize:   FontSize.font14,
    color:      Colors.textDark,
  },
  // fontFamily applied inline (langFonts.regular) — see IdVerifyBanner's Text usage.
  body: {
    fontSize:   FontSize.font12,
    color:      Colors.textSecondary,
    marginTop:  2,
  },
  cta: {
    backgroundColor:   Colors.badgeVerifiedText,
    borderRadius:      8,
    paddingVertical:   8,
    paddingHorizontal: 12,
  },
  // fontFamily applied inline (langFonts.semiBold) — see IdVerifyBanner's Text usage.
  ctaText: {
    fontSize:   FontSize.font12,
    color:      Colors.white,
  },
})

// "Edit preferences" / "No matches" entry points into Search must force PP
// mode — otherwise a stale 'filter' flag left over from the "Filter" chip
// above (same getFilterEventType() flag, only ever reset back to 'pp' by
// this call) makes Partner Preferences show the "Filters" header with no
// Strict Filters banner, since that banner is gated to PP mode only.
async function goToEditPreferences(navigation: any) {
  await setFilterEventType('pp')
  navigation.navigate('Search')
}

// ─── MatchesScreen ────────────────────────────────────────────────────────────

export default function MatchesScreen({ navigation, route }: { navigation: any; route?: any }) {
  const { t, i18n } = useTranslation()
  const isDesktop = useIsDesktopWeb()
  const { isOffline } = useNetwork()

  // Android: HomeScreenActivity's ExitPopup — now registered centrally in
  // RootNavigation.tsx as handleBack()'s root fallback (fires whenever
  // there's nothing left to pop back to, which in practice is only when the
  // user is on this root/landing screen).

  // ── Explore-by-category mode (#6) ───────────────────────────────────────────
  // Angular: callMatchesApi() explorePage branch — set when navigated here from a
  // Home "Explore matches based on" category tile instead of the bottom-nav tab.
  const exploreType   = route?.params?.exploreType as string | undefined
  const exploreLabel  = route?.params?.exploreLabel as string | undefined
  // Set by SearchScreen's "Show matches" CTA (filterService.buildSearchParams()) —
  // Angular: search.component.ts applyFilter() → router.navigate(['matches'], {state:{SEARCH_URL}})
  const routeSearchParams = route?.params?.searchParams as string | undefined
  const [facets,  setFacets]  = useState<ExploreFacet[]>([])
  const [qSearch, setQSearch] = useState('')

  // `extended` overrides the extendedLoaded STATE read below — needed by callers
  // that just called setExtendedLoaded(false) in the same tick (a plain state
  // read here would still see the pre-update value, since the setState hasn't
  // committed yet within this synchronous call chain).
  // No quickFilters argument any more: a quick-filter chip is now a persisted
  // filter edit that re-queries through the SEARCH path (see applyQuickFilter),
  // exactly as Angular does, so the plain matches branch below is always the
  // unfiltered list.
  async function fetchList(start: number, limit: number, opts?: { extended?: boolean }) {
    // Angular getExtendedMatches() → routepage='extendedPage' → callMatchesApi()
    // keeps hitting extendedmatches/v1 (not the regular matches/search/explore
    // endpoint) for every subsequent page once "Continue seeing profiles" has
    // been tapped — see extendedLoaded below and loadMore()'s matching branch.
    if (opts?.extended ?? extendedLoaded) return fetchExtendedMatches(start, limit)
    // A quick-filter chip puts this screen on the same search path the "Show
    // matches" CTA uses, so pagination past page 0 keeps the chip's filter on.
    const searchParams = quickFilterParams ?? routeSearchParams
    if (searchParams) {
      // Angular matches.page.ts:999-1003 — the searchPage route paginates just
      // like plain matches, reusing the same filter selection with an
      // incrementing START. `searchParams` (page 0) comes pre-built from
      // SearchScreen's navigation params; buildSearchParams() reads the exact
      // same persisted filter/PP/strict-filter storage it was built from, so
      // rebuilding it here for start>0 with a fresh START/LIMIT reproduces the
      // same query, not a different one.
      if (start === 0) return fetchSearchResults(searchParams)
      const userId = await getItem(StorageKeys.Auth.USER_ID)
      const nextPageParams = await buildSearchParams(userId ?? '', start, limit)
      return fetchSearchResults(nextPageParams)
    }
    return exploreType
      ? fetchExplore(exploreType, start, limit, qSearch)
      : fetchMatches(start, limit)
  }

  // ── State ───────────────────────────────────────────────────────────────────
  const [profiles,     setProfiles]     = useState<MatchProfile[]>([])
  // Feature-2 prev/next-profile-swipe on ViewProfileScreen — passed as the list
  // it can swipe within, RN's lightweight stand-in for Angular's localStorage
  // prefetch cache (see redirectToViewProfile's profileIds param).
  const profileIds = useMemo(() => profiles.map(p => p.profileId), [profiles])
  const [totalCount,   setTotalCount]   = useState(0)
  // Angular's getPPContent() count — the saved Partner Preference total, which
  // deliberately does NOT follow a temporary quick filter (see setMatchTotals).
  // Separate from totalCount, which is the current result set and drives the
  // page title.
  const [preferenceCount, setPreferenceCount] = useState(0)

  // Angular guards EVERY count write with `routepage ∈ matches | matchesPage |
  // searchPage` (matches.page.ts:1281) — an explore-by-category listing is a
  // different result set entirely and must not touch either stored count.
  // Going through one helper keeps that guard in a single place; wiring the
  // calls in one-by-one had put them on the explore load and the facet-refine
  // path too, which let a category browse overwrite the preference count.
  function recordMatchTotals(total: number) {
    if (exploreType) return
    setMatchTotals(total).then(setPreferenceCount).catch(() => {})
  }

  // Angular: matches.page.ts:1543/1576 — a profile left the list, so both
  // counts drop by one (the PP one only outside filter mode).
  function recordMatchRemoval() {
    if (exploreType) return
    decrementMatchTotals().then(setPreferenceCount).catch(() => {})
  }
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [extendedCount,  setExtendedCount]  = useState(0)
  // Angular: matches.page.ts's hdrSearchList — the static FILTER chip plus the
  // fields the API's QUICKFILTER block describes, labels included. Built here
  // (not inside the header) for the same reason Angular builds it in
  // matches.page.ts and passes it down as `[filterDataFromMatches]`.
  const [quickFilterChips, setQuickFilterChips] = useState<QuickFilterChip[]>([])
  const chips = useMemo<ChipConfig[]>(
    () => (quickFilterChips.length === 0
      ? []
      : [FILTER_CHIP, ...quickFilterChips.map(c => ({ key: c.key, label: c.label }))]),
    [quickFilterChips],
  )
  // Angular: quickFilterSearchList — every chip carries its own `isSelected`,
  // so several can be on at once. Seeded from the persisted selection on focus
  // (see the effect below), because a chip tap is a real, saved filter edit.
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  // Angular: filterService.updateFilterEditCount — the Filters chip's badge.
  const [filterCount,   setFilterCount]   = useState(0)
  // Set once a chip has been toggled: from then on the list comes from the
  // SEARCH endpoint with the full persisted preference set, exactly as Angular's
  // clickOnFilterChip() -> applyFilter() -> emit({SEARCH_URL}) does, rather than
  // from the plain matches endpoint with three ad-hoc flags.
  const [quickFilterParams, setQuickFilterParams] = useState<string | null>(null)
  const [showPhotoPromotion, setShowPhotoPromotion] = useState(false)
  const [photoBannerData,    setPhotoBannerData]    = useState<any>(null)
  const [bannerSlots,          setBannerSlots]          = useState<Array<{ slot: string; insertAfter: number }>>([])
  const [menuPromo,            setMenuPromo]            = useState<any>(null)
  const [addPhotoBannerMatches, setAddPhotoBannerMatches] = useState<any>(null)
  // oppGender = gender of profiles being viewed (opposite of logged-in user)
  const [oppGender, setOppGender] = useState<'M' | 'F'>('F')
  // Logged-in user's own gender (opposite of oppGender) — needed for the bulk-like
  // post-send branch (#1): male users mid photo-promotion see a different follow-up.
  const [loginGender, setLoginGender] = useState<'M' | 'F'>('F')

  // ── GAM ad banner (BANNERSLOT 1020) ────────────────────────────────────────
  const [gamParams, setGamParams] = useState<{ gender: string; caste: string; domain: string } | null>(null)

  // ── Bulk-like modal ─────────────────────────────────────────────────────────
  const [showBulkLike,        setShowBulkLike]        = useState(false)
  const [bulkLikeCandidates,  setBulkLikeCandidates]  = useState<Record<string, any>[]>([])
  // Angular: fullpage-modalpopup.component.ts sendLikes() — male users mid photo
  // promotion see a photo-upsell prompt instead of the plain success confirmation.
  const [showPhotoBulkLikePrompt, setShowPhotoBulkLikePrompt] = useState(false)

  // Angular: the header language pill here opens LanguageSelectionComponent
  // with actionType='mothertongue' — a 2-language bottom sheet (English +
  // this domain's one regional language), NOT the full-page language list
  // menu/settings/signin use.
  const [showLanguageSheet, setShowLanguageSheet] = useState(false)

  // ── Extended matches ("Continue seeing profiles" end-card) ─────────────────
  const [loadingExtended, setLoadingExtended] = useState(false)
  const [extendedLoaded,  setExtendedLoaded]  = useState(false)
  // Angular: extendedMatchesProfile / moreMatchesArray — the count call's own
  // RESPONSE, shown as the end card's avatar circles.
  const [extendedPreviews, setExtendedPreviews] = useState<string[]>([])
  // Angular: profileList[0]['ISEXTENDEDMATCHES'] = "1" (matches.page.ts:1296) —
  // the ONE profile that carries the "recommended by BharatJodii" intro.
  const [extendedFirstId, setExtendedFirstId] = useState<string | null>(null)
  // Angular appends the end card as a LIST ITEM once the preference feed is
  // spent (matches.page.ts:1356), so cdk-virtual-scroll only instantiates it —
  // and only then starts its countdown — when the member scrolls that far.
  // ListFooterComponent has no such gate: it mounts with the list, so without
  // this the countdown would start at the top of the page and the extended feed
  // would load itself before the member had seen a single preference match.
  const [regularExhausted, setRegularExhausted] = useState(false)

  // ── Sticky bottom banner (profile-validation / payment-failed retry / force-update) ──
  const [forceUpdateInfo,   setForceUpdateInfo]   = useState<{ minVersion: string } | null>(null)
  const [paymentStickyInfo, setPaymentStickyInfo] = useState<{ content: string; ctaLabel: string; deadlineMs: number } | null>(null)
  // Angular: matches.page.ts:2515-2557 checkProfileStatus() — "First Priority" sticky,
  // shown ahead of payment-failed when the member's own profile was rejected/put on hold.
  const [profileValidationInfo, setProfileValidationInfo] = useState<ProfileValidationInfo | null>(null)
  const [showProfileValidationSheet, setShowProfileValidationSheet] = useState(false)
  // Per-OCCURRENCE dismissal key — see stickyKeyFor()/activeSticky below for why
  // this replaced a single blanket "was any sticky ever dismissed" boolean.
  const [dismissedStickyKey, setDismissedStickyKey] = useState<string | null>(null)

  // ── Notification permission popup (~40s after landing on Matches) ──────────
  const [showNotificationPopup, setShowNotificationPopup] = useState(false)

  // ── "Rate our app" popup ────────────────────────────────────────────────────
  // Angular: app-rating.service.ts hands the popup an actionNo (its SOURCE
  // param, 1-5) identifying which rule opened it — so the trigger object, not a
  // bare boolean, is what drives visibility here.
  // Angular: the like a member SENDS is an ACTIVE trigger
  // (communication.service.ts:441 activeRatingPopup('like'), skipped for Daily
  // Recommendation), and the likes/views they RECEIVED are the passive one
  // checked once per session on this page. Both live in this hook.
  const appRating = useAppRating()

  // ── BharatJodii rename announcement (one-time) ──────────────────────────────
  // Angular: matches.page.ts's checkBharatJodiiRenameSheet() / BHARATJODII_RENAME
  // bottom-sheet config. Angular gates on apptype=="115" AND version=="7.5"; this
  // port gates on apptype only (see checkOnFocusPopups below) since RN's own
  // version string isn't tied to that PWA-specific release.
  const [showBharatJodiiRename, setShowBharatJodiiRename] = useState(false)

  // ── Survey popup ─────────────────────────────────────────────────────────────
  const [surveyData, setSurveyData] = useState<SurveyPopupData | null>(null)

  // ── Income disclosure prompt (~1.2s after landing, once per 7-day snooze) ───
  const [showIncomeSheet, setShowIncomeSheet] = useState(false)
  const [incomeOptions,   setIncomeOptions]   = useState<PickerOption[]>([])

  // ── "Add your photo" action gate (Like/Don't-show) ──────────────────────────
  // Angular: button.service.ts checkAddPhotoPromotion() — blocks these two actions
  // (not Call/WhatsApp/View-later) when PROFILEPUBLISHEDFLAG=='0' and one of three
  // sub-conditions applies. Content is server-driven (REGISTRATIONARRAYS.PHOTOPUBLISHED.Call).
  const [addPhotoGateActive, setAddPhotoGateActive] = useState(false)
  const [addPhotoActionPromoContent, setAddPhotoActionPromoContent] = useState<any>(null)
  const [showAddPhotoActionPrompt, setShowAddPhotoActionPrompt] = useState(false)

  // ── Toast (View Later / Don't Show confirmation, Like's Undo toast) ──────────
  const [toastRequest, setToastRequest] = useState<ToastRequest | null>(null)
  // onUndo/duration are optional — ONLY the Like toast passes them (Angular:
  // communication.service.ts's showCustomToaster(), 1500ms + Undo button;
  // every other toast in this screen uses the 2000ms default with no button).
  function showToast(message: string, onUndo?: () => void, duration?: number) {
    setToastRequest({ message, key: Date.now(), onUndo, duration })
  }

  // ── Live footer like-count badge ────────────────────────────────────────────
  const [likesCount, setLikesCount] = useState(0)
  // The persistent tab bar (MainTabs.tsx) renders AppFooter now, not this
  // screen — publish into the shared context instead of a local prop.
  const { setLikesCount: setFooterLikesCount, setExploreCount: setFooterExploreCount } = useFooterBadges()
  useEffect(() => { setFooterLikesCount(likesCount) }, [likesCount, setFooterLikesCount])

  // Angular: paymentPromoPopUp() → bottom-sheet.component's `paymentPromo` block —
  // the real upgrade sheet shown for Call/WhatsApp/Message when the viewer is a
  // free (entryType 'F') member. Previously WhatsApp used a bespoke "pay now"
  // modal borrowed from Angular's unrelated whatsappNudge (photo-hidden) copy,
  // and Call/Message just navigated to `recharge` with no popup at all — neither
  // matches Angular, which shows this same sheet for all three actions.
  const [paymentPromo, setPaymentPromo] = useState<UpgradePaymentPromo | null>(null)

  // ── Contact-reveal flow (Angular button.component.ts's two-step confirm →
  // phoneviewed API → Contact Details sheet) — previously this port skipped
  // straight to dialing on 'show_contact', no confirmation or details sheet. ──
  const [contactConfirm, setContactConfirm] = useState<{ profile: MatchProfile; action: ContactAction } | null>(null)
  // The WhatsApp photo-request paywall sheet (BottomSheet 'whatsAppPhotoRequest').
  const [waPhotoRequest, setWaPhotoRequest] = useState<MatchProfile | null>(null)
  const [contactDetails, setContactDetails] = useState<{
    name: string; mobile?: string | undefined; dialNumber?: string | undefined; whatsappNumber?: string | undefined
    showCounter?: boolean | undefined; viewedCount?: string | undefined; totalCount?: string | undefined
    idVerified?: boolean | undefined
  } | null>(null)
  // Angular button.component.ts:551-579 — the CONFIRMATION popup's own quota
  // footer line, read purely from the local CONTACT_DETAIL cache (no API
  // call). #VAR1#=phoneNumbersLeft, #VAR2#=expiryTextValue. #VAR# (phoneViewCnt)
  // is NOT simply phoneNumbersViewed — when CONTACT_DETAIL has
  // totalProfileCountData, Angular computes it as totalProfileCountData -
  // phoneNumbersLeft instead, falling back to raw phoneNumbersViewed only
  // when totalProfileCountData is absent. total is kept separately (not
  // folded into `viewed`) because it also decides WHICH template string to
  // use — see getContactConfirmContent(). Defaults to 0 until the first real
  // reveal, same as Angular (nbcontacts's own response has no viewed-count
  // field before that).
  const [contactQuota, setContactQuota] = useState({ viewed: '0', left: '', expiry: '', total: '' })

  // The other phoneviewed/pre-flight scenarios (communicationService.ts's
  // showContactDetails + showCallOrWhatsApp's verify_id/female_free gates) —
  // all mutually exclusive with each other and with contactDetails, so one slot works.
  type PhoneInfoSheet =
    | { kind: 'phone_protected' }
    | { kind: 'under_validation'; message: string }
    | { kind: 'phone_limit_exceeded'; body: string; cta: string }
    | { kind: 'fup_limit'; header: string; body: string; cta: string; cta1: string }
    | { kind: 'profile_validation'; title: string; content: string; cta: string; image?: string | undefined }
    | { kind: 'phone_number_left' }
    // Angular common-funtions.ts's check_Paid_NonVerifyIdUser() — paid male,
    // not eKYC-verified. Content is server-driven (REGISTRATIONARRAYS.
    // PROFILEVERIFYPAID.Shortlist), read at the point this is set (see
    // handleContactConfirmYes) rather than passed through CommActionResult.
    | { kind: 'verify_id'; title: string; content: string; ctaLabel: string; image?: string | undefined; ctaIcon?: string | undefined; pinkWash?: boolean | undefined }
    // Angular communication.service.ts's femaleFreeContactFunc() — 4 reachable
    // outcomes for a female free-3-contact user (the 5th, femaleFree-PhotoAdded,
    // is only produced with isRedirect=true, not on this tap-to-call path).
    | { kind: 'female_free_photo_add' }
    | { kind: 'female_free_photo_pending' }
    | { kind: 'female_free_photo_fail' }
    | { kind: 'female_free_call_verification' }
    | { kind: 'female_free_limit_over' }
  const [phoneInfoSheet, setPhoneInfoSheet] = useState<PhoneInfoSheet | null>(null)

  // ── After-like CTA state (#22-24) — read once per mount, same pattern as gamParams ──
  const [ownEntryType,      setOwnEntryType]      = useState('')
  const [femaleFreeEligible, setFemaleFreeEligible] = useState(false)
  const [indNumbersLeft,    setIndNumbersLeft]    = useState('0')
  // Angular: FUNC.whatsAppPhotoFlag() — session WAPHOTOFLAG, '0' when absent.
  // Drives MatchCard's hidden-photo overlay (WhatsApp prompt vs shortlist one);
  // matches.page.html:173 passes the same flag via
  // getWhatsAppViewHiddenPhotoRequest(profile).
  const [waPhotoFlag,       setWaPhotoFlag]       = useState('0')

  // ── Extra promo banners (#26: 1011/1012/1014/1015 + hero-banner extension) ──────
  const [addPhotoPromoActive, setAddPhotoPromoActive] = useState(false)
  const [addHoroActive,       setAddHoroActive]       = useState(false)
  const [paidNoPhotoBanner,   setPaidNoPhotoBanner]   = useState<any>(null)   // reg.PHOTOPUBLISHPAID.Matches, or {} for the static ADDPROPERTYS fallback
  const [idVerifyPromoMatches, setIdVerifyPromoMatches] = useState<any>(null) // reg.PROFILEVERIFYPAID.Matches (BANNERSLOT 1010)

  // Hero banner header (ListHeaderComponent) — extends the existing photo-promo
  // banner to Angular's other two variants. 'target' picks the onPress destination.
  const [heroBannerTarget, setHeroBannerTarget] = useState<'Gallery' | 'verifyid'>('Gallery')

  // Web/PWA "Add photo" CTAs — see hooks/useAddPhotoPicker.ts for why this can't
  // just navigate to the native-only 'Gallery' screen. onUploaded refreshes the
  // PROFILEPUBLISHEDFLAG-driven banners/gates the same way a language change
  // does (loadMatches is a hoisted function declaration, defined below — fine to
  // reference here since this callback only runs after a full render completes).
  const addPhoto = useAddPhotoPicker({
    onUploaded: () => loadMatches({ cancelled: false, notifTimer: undefined }, false),
    onRejected: showToast,
    onError: () => showToast('Upload failed. Please try again.'),
  })

  // ── Header height ────────────────────────────────────────────────────────────
  // MatchesHeader is absolutely positioned over the FlatList (its own SafeAreaView
  // handles the status-bar inset), so the list needs its measured height reserved
  // as top padding or the first row would render underneath it.
  const headerHRef   = useRef(0)   // full header height — used for FlatList paddingTop
  // Only so a re-entry reload can put the member back at the top of the fresh
  // list — a reload that left the old scroll offset in place would drop them
  // into the middle of profiles they have not seen yet. Null on desktop,
  // which renders MatchesDesktopLayout instead of this FlatList.
  const listRef = useRef<FlatList<any> | null>(null)
  const [headerH, setHeaderH] = useState(0)

  function handleHeaderLayout(h: number) {
    if (h > 0 && h !== headerHRef.current) {
      headerHRef.current = h
      setHeaderH(h)
    }
  }

  // ── Hide-on-scroll title row ─────────────────────────────────────────────────
  // The "Matches (N) [English]" row hides while ppRow/chips/facets below it
  // ride up to take its place (MatchesHeader translates its whole content
  // block by this same value, not just the title). The list is translated by
  // the identical amount so its first visible row always lines up flush
  // against the header's new, visually shorter bottom edge — no gap opens up
  // between them at any point during the animation. Driven entirely on the UI
  // thread (worklet + shared values, no setState) so scrolling never triggers
  // a JS render. titleRowH is measured by MatchesHeader itself (its layout
  // height never changes — only its paint position does — so this has no
  // effect on headerH/list paddingTop above).
  const titleTranslateY = useSharedValue(0)
  const titleRowH        = useSharedValue(0)
  const isHeaderHidden    = useSharedValue(false)
  // Accumulated scroll delta since the last direction reversal — this is the
  // dead-zone: small back-and-forth movements (momentum bounce, a shaky
  // finger) never reach HIDE_THRESHOLD, so they can't flip the header state.
  const scrollAccum       = useSharedValue(0)
  const lastScrollY       = useSharedValue(0)
  const HIDE_THRESHOLD    = 12
  // Android in particular can settle a fling with the last reported offset a
  // few px shy of a true 0 (rounding in the deceleration curve, not a bounce),
  // so a strict `y <= 0` check can miss "at the top" entirely and leave the
  // header stuck in whatever state the last real scroll event left it in.
  const TOP_EPSILON       = 4

  const handleListScroll = useAnimatedScrollHandler({
    onScroll: e => {
      const y = e.contentOffset.y

      // At/near the top (covers Android's fling-settle rounding, its clamp to
      // 0, and iOS's elastic negative overscroll) — always force the header
      // shown and drop any accumulated progress so a bounce at the top can't
      // carry into a hide.
      if (y <= TOP_EPSILON) {
        scrollAccum.value = 0
        lastScrollY.value = y
        if (isHeaderHidden.value) {
          isHeaderHidden.value = false
          titleTranslateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) })
        }
        return
      }

      const dy = y - lastScrollY.value
      lastScrollY.value = y

      // A reversal (sign flip) discards whatever had built up in the other
      // direction — a scroll-down-then-slightly-up doesn't get a head start
      // toward showing the header from residual downward accumulation.
      if ((dy > 0 && scrollAccum.value < 0) || (dy < 0 && scrollAccum.value > 0)) {
        scrollAccum.value = 0
      }
      scrollAccum.value += dy

      if (scrollAccum.value > HIDE_THRESHOLD && !isHeaderHidden.value) {
        isHeaderHidden.value = true
        titleTranslateY.value = withTiming(-titleRowH.value, { duration: 220, easing: Easing.out(Easing.cubic) })
        scrollAccum.value = 0
      } else if (scrollAccum.value < -HIDE_THRESHOLD && isHeaderHidden.value) {
        isHeaderHidden.value = false
        titleTranslateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) })
        scrollAccum.value = 0
      }
    },
    // Safety net for the same "settled a few px shy of 0" case: if a fling's
    // deceleration ends without ever dispatching an onScroll at/near the top
    // (event under-sampling), this still catches the final rest position and
    // corrects the header state instead of leaving it stuck hidden.
    onMomentumEnd: e => {
      if (e.contentOffset.y <= TOP_EPSILON && isHeaderHidden.value) {
        isHeaderHidden.value = false
        scrollAccum.value = 0
        titleTranslateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) })
      }
    },
  })

  // The list rides up in lockstep with the header's collapse (see comment on
  // titleTranslateY above) — same shared value, same frame, so there's never a
  // moment where the header has visually shrunk but the list hasn't caught up
  // (or vice versa).
  const listAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: titleTranslateY.value }],
  }))

  // apiStart tracks the cursor for pagination (how many profiles we've fetched from API)
  const apiStartRef = useRef(0)
  // Angular getExtendedMatches() resets `start` to 0 and repoints doInfinite()'s
  // bound at extendedMatchesCount instead of totalCount once the user taps
  // "Continue seeing profiles" — a SEPARATE cursor from apiStartRef (regular
  // matches), not a continuation of it (extendedmatches/v1 is its own 0-based feed).
  const extendedApiStartRef = useRef(0)
  // Guards loadMore against re-entrant calls — onEndReached can fire again before the
  // `loadingMore` state update from the first call has committed, re-fetching the same
  // page and appending duplicate profiles (duplicate FlatList keys).
  const loadingMoreRef = useRef(false)

  // ── Angular sequence: ionViewDidEnter → API calls ───────────────────────────
  // 1. fetchMatches()     → listing/matches/v1        (main matches list)
  // 2. fetchNotifCount()  → communication/newcount/v1 (badge count)
  // (login/autologin/v1 is NOT part of this screen — see the note in loadMatches.)
  //
  // Pulled out of the effect so a language change can re-run just the data-fetching
  // core — Angular: changeLanguage() (matches.page.ts:3179-3202) tears down and
  // rebuilds the ENTIRE page so every server-rendered string (banner copy, promo
  // text) re-fetches in the new language. includePopups=false skips re-arming the
  // one-time rating/survey/notification-permission popups — those aren't
  // language-dependent, and re-firing them on every switch would be a new bug.
  async function loadMatches(ctrl: { cancelled: boolean; notifTimer?: ReturnType<typeof setTimeout> | undefined }, includePopups: boolean) {
      try {
        // Read login gender once — determines which blur placeholder to show on photo cards,
        // and gates the opposite profile's Verified badge (oppGender === 'M'). Only commit it
        // on a successful, still-current read — a transient/empty storage read must never
        // clobber an already-correct oppGender with the wrong default (this was previously
        // unconditional, unlike every other setter below, and could flip the Verified badge
        // off on a reload where this particular read raced or came back empty).
        const lg = await getItem(StorageKeys.User.LOGIN_GENDER)
        if (!ctrl.cancelled && lg) {
          setOppGender(lg === 'F' ? 'M' : 'F')
          setLoginGender(lg === 'M' ? 'M' : 'F')
        }

        // NO refreshSession() here. Angular calls autoLogin from exactly ONE
        // place — authguarduser.service.ts's canActivate(), gated on
        // `_diffHours >= 1`; matches.page.ts never calls it. RootNavigation's
        // guardCheck() is that same guard and already runs on every navigation
        // (onStateChange), so arriving on this screen has re-established the
        // session when it was actually stale.
        //
        // Calling it unconditionally here re-ran login/autologin/v1 on EVERY
        // visit — including each "Show matches" from the filter, which
        // navigates straight to this screen.

        // Angular: callMatchesApi() → listing/matches/v1 (or explore/v1 in explore mode).
        // Angular's changeLanguage() fully rebuilds the page (routepage reinitializes fresh),
        // so a re-run of this (language change) must not still be pointed at the
        // extendedmatches/v1 branch from a "Continue seeing profiles" tap before the switch.
        extendedApiStartRef.current = 0
        setExtendedLoaded(false)
        // The extended flow restarts with it: the end card is offered again only
        // once this fresh feed is exhausted, and no profile carries the intro yet.
        setRegularExhausted(false)
        setExtendedFirstId(null)
        const result = await fetchList(0, 20, { extended: false })
        if (ctrl.cancelled) return

        setProfiles(result.items.map(matchProfileAdapter.adapt))
        setBannerSlots(result.bannerSlots)
        setTotalCount(result.totalCount)
        recordMatchTotals(result.totalCount)
        setFacets(result.facets ?? [])
        apiStartRef.current = result.items.length  // cursor for next page

        // Angular: bulkLike() reads/consumes 'bulklikechk' (set once, right after
        // registration, by registrationService.ts's submitFullRegistration()) —
        // only THIS check fetches matches / shows the modal, not every load.
        const bulkLikeArmed = (await getItem('bulklikechk')) === '1'

        // Step 3 — Angular: parallel post-matches calls
        // newcount + extendedmatches + ppSetData + dailyRecommendations + menuPromo
        const [extCount, , promo, bulkLikeResult] = await Promise.all([
          // Angular matches.page.ts:1089-1091 — skip the extended-matches-count
          // check entirely once the free-match paywall is active for this user.
          // getExtendedMatchesCount() bails on two more conditions this port was
          // missing: Filters mode (`if (this.filterService.checkFilterEventType())
          // { extendeMatchesFlag = false; return }`, matches.page.ts:1704-1710) and
          // explore mode, which endCardBtnEmit() excludes via `!isExploreMatches`
          // (:2623). Both list something other than the preference feed, so
          // "you've seen all your preference matches" is not true of either.
          (async () => {
            if (exploreType) return EMPTY_EXTENDED_COUNT
            const [limited, evType] = await Promise.all([checkLimitFlowStatus(), getFilterEventType()])
            if (limited || evType === 'filter') return EMPTY_EXTENDED_COUNT
            return fetchExtendedMatchesCount()
          })(),
          fetchAndStorePPSetData().then(async (ppSetData) => {
            // Populates CONTACT_DETAIL (Angular: common.ts's getContactDetails(),
            // called on every Matches-page load) BEFORE reading it below — this
            // was previously never called anywhere, so indNumbersLeft always
            // read the '0' fallback.
            await fetchContactDetails().catch(() => {})
            const [entryType, reg, femaleFreeRaw, horoAvailable, contactDetail, ekycStatus, paidFlag, waFlag] = await Promise.all([
              getSessionValue('ENTRYTYPE'),
              getRegistrationArrays(),
              getSessionValue('FEMALEFREECONACT'),
              getSessionValue('HOROSCOPEAVAILABLE'),
              getJson<Record<string, any>>('CONTACT_DETAIL'),
              // Angular: localStorage 'EKYCSTATUS'. 'PI_EKYCSTATUS' is written
              // nowhere in this codebase, so BANNERSLOT 1014 / the add-photo gate
              // treated every ID-verified member as unverified.
              getItem(StorageKeys.Verification.EKYC_STATUS),
              getItem(StorageKeys.Payment.PAY_P_FLAG),
              getSessionValue(StorageKeys.App.WA_PHOTO_FLAG),
            ])
            // Angular: getPPsetValue('PI_PHOTOSTATUS') returns `ppSetData?.[key] || ''`
            // (common-funtions.ts:947-950) — an absent/empty status is '', NOT 'N'.
            // Defaulting to 'N' made check_Paid_Verified_Nophoto() below pass for a
            // paid verified male whose PPSET omitted the field, showing the
            // PHOTOPUBLISHPAID hero banner / BANNERSLOT 1014 / add-photo gate where
            // Angular shows none. BANNERSLOT 1011's `!['P','Y'].includes()` reads
            // '' and 'N' identically, so it is unaffected.
            const photoStatus = String(ppSetData?.PI_PHOTOSTATUS || '')

            if (!ctrl.cancelled) {
              setOwnEntryType(entryType ?? '')
              // Angular: whatsAppPhotoFlag() defaults to '0' when the key is absent.
              setWaPhotoFlag(String(waFlag ?? '0'))

              // Free-female-contact eligibility (#24) — Angular: getFree3Contact() && !getfreephoneviewOver()
              const femaleFree: any = femaleFreeRaw
              setFemaleFreeEligible(
                String(femaleFree?.FLAG) === '1' && lg === 'F' && String(femaleFree?.Left ?? '0') !== '0'
              )

              // Remaining-contacts count (#23) — Angular: getIndNumbersLeft(). CONTACT_DETAIL
              // is now populated above via fetchContactDetails() (nbcontacts) and updated
              // again after each phoneviewed call (communicationService.ts's showContactDetails).
              setIndNumbersLeft(String(contactDetail?.IndNumbersLeft ?? '0'))
              setContactQuota({
                viewed: String(contactDetail?.phoneNumbersViewed ?? '0'),
                left:   String(contactDetail?.phoneNumbersLeft ?? ''),
                expiry: String(contactDetail?.expiryTextValue ?? ''),
                total:  String(contactDetail?.totalProfileCountData ?? ''),
              })

              // BANNERSLOT 1011 — add-photo generic promo (#26)
              setAddPhotoPromoActive(!['P', 'Y'].includes(photoStatus))

              // BANNERSLOT 1012 — add-horoscope promo (#26)
              setAddHoroActive(horoAvailable !== '1')
            }

            // BANNERSLOT 1014 — paid-verified-no-photo promo, or legacy ADDPROPERTYS
            // fallback (#26); also feeds the add-photo action gate and the hero-banner
            // selection below. Angular: check_Paid_Verified_Nophoto() (common-funtions.ts:
            // 385-387) is the ONE real condition behind all three — confirmed via
            // matches.page.ts:1239 (server-list filtering strips BANNERSLOT 1014 unless
            // this exact check passes) and :735 (hero banner). A previous pass here used a
            // looser "not P or Y" photoStatus check with no PAYPFLAG requirement at all —
            // rationalized at the time as "must match BANNERSLOT 1011's own definition",
            // but that reasoning doesn't hold: 1011's own condition is a SEPARATE, simpler
            // Angular flag (unrelated to this function) that only ever drives 1011's own
            // banner, not 1014/the gate/the hero banner. The real condition requires the
            // EXACT ['P','N','R'] whitelist (not everything outside {P,Y}) AND PAYPFLAG=='1'.
            const isPaidVerifiedMale = entryType === 'P' && ekycStatus === '1' && lg === 'M'
              && ['P', 'N', 'R'].includes(photoStatus) && paidFlag === '1'
            // Always recompute (never just set-and-leave) — otherwise a reload where this
            // account no longer qualifies can't clear a banner a PREVIOUS load already set,
            // since useState<any>(null) has no reset path other than an explicit null here.
            if (!ctrl.cancelled) {
              setPaidNoPhotoBanner(
                isPaidVerifiedMale
                  ? (reg?.PHOTOPUBLISHPAID?.Matches
                      ? { dynamic: true, data: reg.PHOTOPUBLISHPAID.Matches }
                      : { dynamic: false })
                  : null
              )
            }

            // GAM ad banner params (BANNERSLOT 1020) — Angular: loadGambanner()
            // reads ppSetData.PIINFO.{GENDER,CASTE,DOMAINID}; fall back to the
            // login gender if PIINFO isn't present in this API's response yet.
            if (!ctrl.cancelled) {
              const piInfo = ppSetData?.PIINFO
              setGamParams({
                gender: piInfo?.GENDER ?? lg ?? '',
                caste:  piInfo?.CASTE  ?? '',
                domain: piInfo?.DOMAINID ?? '',
              })
            }

            // Force-update sticky (#10) — Angular: matches.page.ts:719-728, using
            // explore.component's actual wiring as the reference (Angular's own Matches
            // page computes this but never renders it). Same naive string/number `<`
            // comparison as Angular — not "fixed" here, to match source behavior.
            // appVersion must be the app's own real version (APP_VERSION), not
            // Constants.expoConfig?.version (app.json's still-"1.0.0" Expo
            // scaffolding default) — that read made this fire almost
            // unconditionally, since "1.0.0" < almost any real APPVERSION string.
            if (!ctrl.cancelled) {
              const forceUpdate  = ppSetData?.APPFORCEUPDATE
              const psUpdateFlag = await getItem('PLAYSTOREUPDATE')
              if (forceUpdate?.APPVERSION && psUpdateFlag !== '1' && APP_VERSION < forceUpdate.APPVERSION) {
                setForceUpdateInfo({ minVersion: forceUpdate.APPVERSION })
              }
            }

            // Angular matches.page.ts:705 — show add-photo banner when:
            // PROFILEPUBLISHEDFLAG=0 (photo not added) + PROFILEPUBLISHEDTYPE 1|2 (promotion active) + ENTRYTYPE=F (free user)
            try {
              // BANNERSLOT 1013 inline banner — PHOTOPUBLISHED.Matches. Always recomputed
              // (not just set-when-present) so a reload where this account no longer
              // qualifies actually clears a banner a previous load already set.
              setAddPhotoBannerMatches(reg?.PHOTOPUBLISHED?.Matches ?? null)

              // BANNERSLOT 1010 — "get ID verified" promo, reg.PROFILEVERIFYPAID.Matches.
              // Same ##CSNUM## → VERIFIEDBYCALLNUM placeholder substitution as the
              // Shortlist variant handleMessage() reads above — getRegistrationArrays()
              // and getItem() are both async, so (unlike renderBannerItem, a sync render
              // callback) this must run here, where `reg` was already awaited, and be
              // cached into state for renderBannerItem to read synchronously.
              const idVerifyPromo = reg?.PROFILEVERIFYPAID?.Matches
              if (idVerifyPromo) {
                let idVerifyCta = String(idVerifyPromo.CTA ?? '')
                if (idVerifyCta.includes('##CSNUM##')) {
                  const callNum = (await getItem('VERIFIEDBYCALLNUM')) ?? ''
                  idVerifyCta = idVerifyCta.replace(/##CSNUM##/g, callNum).replace('+91', '')
                }
                if (!ctrl.cancelled) {
                  setIdVerifyPromoMatches({ ...idVerifyPromo, CTA: idVerifyCta, CTABGCOLOR: '#B50033', SVGCOLOR: '#B50033' })
                }
              } else if (!ctrl.cancelled) {
                setIdVerifyPromoMatches(null)
              }
              // Header hero banner — Angular: matches.page.ts:705-717, checked in this exact
              // if/else-if order (free-photo promo, then non-ID-verify promo, then
              // paid-verified-no-photo promo). Same PhotoPromotionBanner component throughout —
              // only the data source and onPress destination (heroBannerTarget) differ.
              // API sends Angular CSS class names — resolve to real hex colors.
              const resolveBg = (v: string) =>
                (!v || v === 'primaryBg') ? Colors.primaryDark : (v.startsWith('#') ? v : Colors.primaryDark)
              const resolveColor = (v: string) =>
                (!v || v === 'whiteColor') ? Colors.white : (v.startsWith('#') ? v : Colors.white)
              const applyHeroBanner = (banner: Record<string, any>, target: 'Gallery' | 'verifyid') => {
                setShowPhotoPromotion(true)
                setHeroBannerTarget(target)
                setPhotoBannerData({
                  TITLE:     banner.TITLE     || 'Profile not active yet!',
                  BODY:      banner.BODY      || 'Upload your photo to activate profile and let matches see you',
                  CTA:       banner.CTA       || 'Add photo now',
                  BANNERIMG: banner.BANNERIMG || '',
                  CTABGCOLOR: resolveBg(banner.CTABGCOLOR),
                  CTACOLOR:   resolveColor(banner.CTACOLOR),
                  BGCOLOR:    Colors.photoPromoTint,
                })
              }

              const flagOk = String(ppSetData?.PROFILEPUBLISHEDFLAG) === '0'
              const typeOk = ['1', '2'].includes(String(ppSetData?.PROFILEPUBLISHEDTYPE))
              const freeOk = entryType === 'F'

              // "Add your photo" action gate (Like/Don't-show) — Angular:
              // checkAddPhotoPromotion() = PROFILEPUBLISHEDFLAG=='0' && (checkPhotoPromotion()
              // || check_Paid_Verified_Nophoto() || isNonIdVerifyUser()).
              // isNonIdVerifyUser() (common.ts:2009-2013) is entryType=='P' && gender=='M'
              // && ekycStatus!='1' — NO PAYPFLAG check. A previous pass here added one,
              // apparently confusing this with the DIFFERENT check_Paid_NonVerifyIdUser()
              // (common-funtions.ts:382-384, PAYPFLAG=='1' IS part of that one) — the
              // gate communicationService.ts's showCallOrWhatsApp correctly uses for
              // contact-reveal, not this add-photo promotion gate. Net effect of the
              // bug: a paid, unverified male whose PAYPFLAG isn't '1' could Like/
              // Don't-show freely here, where Angular's real isNonIdVerifyUser()
              // condition (no PAYPFLAG involved at all) would still block him.
              const nonIdVerifyUserGate = entryType === 'P' && lg === 'M' && ekycStatus !== '1'
              if (!ctrl.cancelled) {
                setAddPhotoGateActive(flagOk && ((typeOk && freeOk) || isPaidVerifiedMale || nonIdVerifyUserGate))
                setAddPhotoActionPromoContent(reg?.PHOTOPUBLISHED?.Call ?? null)
              }

              if (flagOk && typeOk && freeOk) {
                applyHeroBanner(reg?.PHOTOPUBLISHED?.Banner ?? {}, 'Gallery')
              } else if (reg?.PROFILEVERIFYPAID?.Banner && nonIdVerifyUserGate) {
                applyHeroBanner(reg.PROFILEVERIFYPAID.Banner, 'verifyid')
              } else if (reg?.PHOTOPUBLISHPAID?.Banner && isPaidVerifiedMale) {
                applyHeroBanner(reg.PHOTOPUBLISHPAID.Banner, 'Gallery')
              } else if (!ctrl.cancelled) {
                // None of the 3 hero-banner conditions hold this load — must actually clear
                // it, not leave whatever a PREVIOUS load set. setShowPhotoPromotion(true) had
                // no corresponding false-path anywhere in this file before this.
                setShowPhotoPromotion(false)
              }
            } catch {
              // banner check failed — hero banner just stays cleared for this load
            }
          }),
          fetchMenuPromo(),
          bulkLikeArmed ? fetchBulkLikeMatches() : Promise.resolve([]),
        ])

        if (!ctrl.cancelled) {
          setExtendedCount(extCount.count)
          setExtendedPreviews(extCount.previewPhotos)
          if (promo) setMenuPromo(promo)
        }

        // Angular: bulkLike() — checked on every ionViewDidEnter(), but the
        // 'bulklikechk' flag is consumed (removed) here regardless of outcome,
        // so in practice this only ever fires once, right after registration.
        let bulkLikeShown = false
        if (bulkLikeArmed) {
          if (!ctrl.cancelled && bulkLikeResult.length >= 4 && result.totalCount >= 20) {
            setBulkLikeCandidates(bulkLikeResult)
            setShowBulkLike(true)
            bulkLikeShown = true
          } else if (!ctrl.cancelled) {
            enablePaywall().catch(() => {})
          }
          await removeItem('bulklikechk')
        }

        // One-time-per-mount bits + every-visit popups/stickies — see
        // checkOnFocusPopups() below, shared with the useFocusEffect further down
        // so a return visit (not just the very first landing) re-checks these,
        // matching Angular's ionViewDidEnter() re-firing on every real re-entry.
        if (includePopups) {
          await checkOnFocusPopups(ctrl, bulkLikeShown)
        }

      } catch (e) {
        if (__DEV__) console.error('[Matches] load error:', e)
      } finally {
        if (!ctrl.cancelled) setLoading(false)
      }
  }

  // Angular: ionViewDidEnter() (matches.page.ts:808-891) — bulkLike(), checkProfileStatus(),
  // getNotificationCount()→passiveRatingPopup(), checkIncomeSheet(), notificationStatus()'s
  // 40s timer. Re-runs on EVERY entry to Matches, not just the first (Ionic fires this
  // lifecycle hook on every re-entry; a plain RN mount-only effect wouldn't, since pushing/
  // popping ViewProfile etc. never unmounts Matches — see the useFocusEffect below). Split
  // out from loadMatches() so the full list refetch stays mount/language-change-only while
  // this piece re-arms every visit. `bulkLikeShown` defaults false for a refocus call — the
  // 'bulklikechk' flag it gates on is consumed on its first (mount) read, so it can never be
  // true again for the lifetime of this screen instance.
  async function checkOnFocusPopups(
    ctrl: { cancelled: boolean; notifTimer?: ReturnType<typeof setTimeout> | undefined },
    bulkLikeShown = false,
  ) {
    // Profile-validation sticky — Angular's own "First Priority" (matches.page.ts:
    // 3234-3235), checked ahead of payment-failed below; activeSticky's priority
    // order (not this call order) is what actually enforces the precedence.
    if (!ctrl.cancelled) {
      const validation = await checkProfileValidation()
      if (!ctrl.cancelled && validation) setProfileValidationInfo(validation)
    }

    // Payment-failed sticky (#6) — Angular: getContactsData() (matches.page.ts:2254-2310).
    if (!ctrl.cancelled && (await getItem('PAYMENTFAILTYPE')) === '1') {
      const banner  = await getHeroBannerDetails(true, 1)
      const content = banner?.PAYMENTFAILEDCONTENT
      const cta     = banner?.PAYMENTFAILEDCTA
      if (!ctrl.cancelled && content && cta) {
        const startMs = Date.parse(banner?.OFFSTTIME ?? '')
        const endMs   = Date.parse(banner?.OFFEDTIME ?? '')
        const deadlineMs = !Number.isNaN(startMs) && !Number.isNaN(endMs)
          ? Date.now() + Math.max(0, endMs - startMs)
          : Date.now() + 10 * 60 * 1000   // fallback: 10 min if OFFSTTIME/OFFEDTIME are missing
        setPaymentStickyInfo({ content, ctaLabel: cta, deadlineMs })
      }
    }

    // BharatJodii rename announcement — Angular: matches.page.ts's
    // checkBharatJodiiRenameSheet(), gated on apptype (this port drops the
    // version half of Angular's gate — see the state declaration above) and a
    // persisted once-only flag. The flag is set BEFORE showing the sheet, not
    // after dismiss — this check re-fires on every return to Matches (back
    // nav from explore/filter/profile), so a re-entry must find it already set.
    let renameShown = false
    if (!ctrl.cancelled && !bulkLikeShown) {
      const [appType, renameAlreadyShown] = await Promise.all([
        getItem(StorageKeys.Auth.APP_TYPE),
        getItem(StorageKeys.App.BHARATJODII_RENAME_SHOWN),
      ])
      if (!ctrl.cancelled && appType === '115' && renameAlreadyShown !== '1') {
        await setItem(StorageKeys.App.BHARATJODII_RENAME_SHOWN, '1')
        renameShown = true
        setShowBharatJodiiRename(true)
      }
    }

    // Angular: ionViewDidEnter() → getNotificationCount(). Feeds both the footer's
    // live like-count badge (#12) and the rating-popup trigger (#9) below.
    if (!ctrl.cancelled) {
      const { comCount } = await fetchNotifCount()
      if (!ctrl.cancelled) {
        const likedYou = comCount.find(c => c.comtype === 'likedyou')
        setLikesCount(Number(likedYou?.newcount ?? 0))
        // Same COMCOUNT payload also carries the footer's Home bubble
        // ("viewed you"), which Angular derives on every getNotificationCount().
        deriveExploreCount(comCount)
          .then(n => { if (!ctrl.cancelled) setFooterExploreCount(n) })
          .catch(() => {})
      }

      // "Rate our app" popup (#9) — Angular: passiveRatingPopup(). Skipped when the
      // bulk-like modal or the rename announcement already claimed this mount's one
      // popup slot (no modal-stacking), mirroring Angular's SHOW_RATING_POPUP mutual-exclusion.
      // passiveRatingPopup() itself only evaluates once per app session and
      // honours the cooldown, so re-focusing Matches can't re-ask.
      if (!ctrl.cancelled && !bulkLikeShown && !renameShown) {
        appRating.onPassiveCounts(comCount)
      }
    }

    // Survey popup (#11) — Angular: matches.page.ts:740-743, getSurveydetails():2167-2178.
    // One-time-consume: clear SURVEYPOPUP immediately so it won't fire again without a
    // fresh server flag on a future login (Angular: removeStorageValue('1','SURVEYPOPUP','')).
    if (!ctrl.cancelled && !bulkLikeShown && !renameShown) {
      const [loginCount, surveyFlag, paywallType] = await Promise.all([
        getItem(StorageKeys.Auth.LOGIN_COUNT),
        getItem('SURVEYPOPUP'),
        getItem('PAYWALLTYPE'),
      ])
      if (Number(loginCount ?? '0') > 3 && surveyFlag === '1' && paywallType === '0') {
        await setItem('SURVEYPOPUP', '')
        const survey = await fetchSurveyPopup()
        if (!ctrl.cancelled && survey) setSurveyData(survey)
      }
    }

    // Income disclosure prompt — Angular: checkIncomeSheet() (matches.page.ts:
    // 2432-2456), its own 1.2s setTimeout ahead of showing. Gated the same way
    // as survey/rating above (skip if the bulk-like modal or rename announcement
    // already claimed this mount's one popup slot).
    if (!bulkLikeShown && !renameShown) {
      setTimeout(async () => {
        if (ctrl.cancelled) return
        if (!(await shouldShowIncomeSheet())) return
        const options = await fetchMonthlyIncomeOptions()
        if (ctrl.cancelled || options.length === 0) return
        setIncomeOptions(options)
        setShowIncomeSheet(true)
      }, 1200)
    }

    // Notification permission popup (#8) — Angular: notificationStatus(), 40s after
    // ionViewDidEnter, gated to once per calendar day and stopped once NALLOW='1'.
    ctrl.notifTimer = setTimeout(async () => {
      if (ctrl.cancelled || bulkLikeShown) return
      const [nallow, lastShown] = await Promise.all([
        getItem(StorageKeys.App.NALLOW),
        getItem('PN_LAST_SHOWN_DATE'),
      ])
      const today = new Date().toISOString().slice(0, 10)
      if (ctrl.cancelled || nallow === '1' || lastShown === today) return
      setShowNotificationPopup(true)
      await setItem('PN_LAST_SHOWN_DATE', today)
    }, 40000)
  }

  useEffect(() => {
    const ctrl = { cancelled: false, notifTimer: undefined as ReturnType<typeof setTimeout> | undefined }
    loadMatches(ctrl, true)
    return () => { ctrl.cancelled = true; clearTimeout(ctrl.notifTimer) }
  }, [])

  // Angular: ionViewDidEnter() re-fires on every real re-entry to Matches (Ionic's
  // navigation lifecycle), not just the first — pushing ViewProfile/Search/etc. and
  // coming back never unmounts this screen in React Navigation's stack, so a plain
  // mount-only effect (above) only ever ran this once. `hasFocusedOnceRef` skips the
  // very first focus (the mount effect above already covers it via includePopups=true)
  // and re-runs checkOnFocusPopups() on every subsequent focus.
  const hasFocusedOnceRef = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true
        return
      }
      const ctrl = { cancelled: false, notifTimer: undefined as ReturnType<typeof setTimeout> | undefined }
      checkOnFocusPopups(ctrl).catch(e => { if (__DEV__) console.error('[Matches] focus popup check error:', e) })
      return () => { ctrl.cancelled = true; clearTimeout(ctrl.notifTimer) }
    }, []),
  )

  // Angular: leaving Matches for another section and coming back re-enters the
  // page, so callMatchesApi() runs again. React Navigation keeps this screen
  // mounted (MainTabs.tsx switches between mounted tabs on purpose), so without
  // this it kept showing whatever was fetched minutes ago — stale counts, stale
  // banners, profiles already acted on elsewhere — at the offset it was left at.
  //
  // ViewProfile is the deliberate exception. It is a drill-down INTO a card of
  // this very list and pages through it via profileIds/subscribeVpNeedMoreProfiles,
  // so coming back from it has to leave the list, the cursor and the scroll
  // position exactly as they were. Everything else — the other three tabs, Menu,
  // Search, the liked/viewed lists — reloads.
  //
  // Through a ref for the same reason loadMoreRef exists below: loadMatches is
  // re-created every render and closes over exploreType/routeSearchParams/
  // quickFilterParams, so a [] useCallback would pin the FIRST render's copy and
  // reload with filters the member has since changed.
  const loadMatchesRef = useRef(loadMatches)
  loadMatchesRef.current = loadMatches
  const reloadOnFocusRef = useRef(false)
  useFocusEffect(
    useCallback(() => {
      const ctrl = { cancelled: false, notifTimer: undefined as ReturnType<typeof setTimeout> | undefined }
      if (reloadOnFocusRef.current) {
        reloadOnFocusRef.current = false
        setLoading(true)
        listRef.current?.scrollToOffset({ offset: 0, animated: false })
        loadMatchesRef.current(ctrl, false).catch(e => { if (__DEV__) console.error('[Matches] re-entry reload error:', e) })
      }
      return () => {
        ctrl.cancelled = true
        // Where the member went decides whether the NEXT focus reloads. Read off
        // the parent stack: still on MainTabs means they only switched tabs;
        // anything else means a screen was pushed over it.
        const parentState = navigation.getParent()?.getState()
        const top = parentState?.routes?.[parentState.index]?.name
        reloadOnFocusRef.current = top !== 'viewProfile'
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigation]),
  )

  // Chip state is derived from storage, not owned here — Angular reads it back
  // the same way (getStorageValues(), and SELECTEDFILTERS is persisted
  // specifically "for the filter swiper chip number [not to get hidden] when the
  // page got refreshed"). Re-read on every focus so the row also reflects edits
  // made on the Search screen and a Reset performed there.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      ;(async () => {
        // Angular's updateQuickFilterList(): hydrate the row from the API first,
        // THEN derive each chip's on/off state against the codes it came back
        // with — the selection is only meaningful relative to QUICKFILTER.key.
        const loaded = await fetchQuickFilterChips()
        const [active, count, ppCount] = await Promise.all([
          getActiveQuickFilters(loaded),
          getFilterEditedCount(),
          // Seeded from storage so the preferences line shows the cached PP
          // count on the first paint, before the listing call comes back —
          // Angular reads the same key straight out of localStorage.
          getPreferenceMatchCount(),
        ])
        if (cancelled) return
        setQuickFilterChips(loaded)
        setSelectedChips(active)
        setFilterCount(count)
        if (ppCount > 0) setPreferenceCount(ppCount)
      })().catch(e => { if (__DEV__) console.error('[Matches] quick filter state error:', e) })
      return () => { cancelled = true }
    }, []),
  )

  // Angular: matches.page.ts ngOnInit() calls getPPSETData(1) unconditionally
  // — matches is the default landing page after login, so this is the
  // earliest point in a normal session where MOTHERTONGUE (from
  // RESPONSE.PI_MOTHERTONGUE) becomes available in storage, which the
  // mothertongue language pill/sheet depends on. Previously only wired up in
  // MenuContactsScreen, so users who hadn't visited Menu yet always fell
  // through to the wrong static language-pill fallback. Fire-and-forget —
  // doesn't block or gate the main matches load above.
  useEffect(() => {
    getPPSetData().catch(() => {})
  }, [])

  // Angular: changeLanguage() (matches.page.ts:3179-3202) — switching language tears
  // down and rebuilds the whole page so every server-rendered string re-fetches in
  // the new language. mountedLangRef skips the initial mount (already covered above)
  // and only reloads on a REAL change, so this doesn't double-fetch on first render.
  const mountedLangRef = useRef(i18n.language)
  useEffect(() => {
    if (i18n.language === mountedLangRef.current) return
    mountedLangRef.current = i18n.language
    const ctrl = { cancelled: false, notifTimer: undefined as ReturnType<typeof setTimeout> | undefined }
    setLoading(true)
    loadMatches(ctrl, false)
    return () => { ctrl.cancelled = true }
  }, [i18n.language])

  // ID-verify banner removal (#13) — Angular: IDVerifyStatusObserver subscription
  // (matches.page.ts:588-594). Strips the BANNERSLOT 1010 promo card the instant the
  // logged-in user's own ID verification completes, no refetch needed.
  useEffect(() => {
    return subscribeIdVerified(() => {
      setBannerSlots(prev => prev.filter(b => b.slot !== '1010'))
    })
  }, [])

  // ── ViewProfile prev/next paging ────────────────────────────────────────────
  // Angular: viewprofile.page.ts:1073's emitVPNextProfileList({module, start}),
  // which the LIST page answers by fetching the next page — the ViewProfile
  // screen never pages by itself, because this screen is the one that owns the
  // cursor, the active filters and the free-match paywall bound.
  //
  // Through a ref, not a dep: loadMore() is re-created every render (it closes
  // over totalCount/extendedLoaded/…), and re-subscribing on each of those would
  // churn the listener; an empty dep list without the ref would instead pin the
  // FIRST render's stale closure and page from a frozen cursor forever.
  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore
  useEffect(() => subscribeVpNeedMoreProfiles(() => { void loadMoreRef.current() }), [])

  // ...and hand the grown list straight back. profileIds is a useMemo over
  // `profiles`, so this fires exactly once per appended page.
  useEffect(() => {
    if (profileIds.length > 0) emitVpProfileListUpdated(profileIds)
  }, [profileIds])

  // ── Pagination ──────────────────────────────────────────────────────────────
  // Angular: doInfinite() → calls callMatchesApi() when scroll reaches end.
  // Once extended-matches mode is active (extendedLoaded), doInfinite() compares
  // `start` against extendedMatchesCount instead of totalCount (matches.page.ts:
  // 1449-1454) — same infinite-scroll mechanism, different cursor/bound/source.
  // Hero-banner CTA — Angular: matches.page.html:143's
  // (homeBannerEventEmit)="onclickPayNowCTA(heroBannerActionType)", whose body
  // (matches.page.ts:2936-2942) is only two branches:
  //
  //   addPhotoPromotion    -> callNative('Add_photo')
  //   nonIdVerifyPromotion -> callNative('missed_verify', 'verifyId')
  //
  // and that second one (common.ts:1780-1785) PLACES A CALL:
  //
  //   let verifybyCall = localStorage.getItem('VERIFIEDBYCALLNUM') || '';
  //   if (isValidparam(verifybyCall)) appNativeEvent({event_name:'missed_verify', PHONENO: verifybyCall})
  //
  // It does not open a verification screen — the CTA literally reads "Call us
  // to verify". This used to do navigation.navigate('verifyid'), which is not a
  // registered route name either (AppStack registers 'verify-id', with the
  // hyphen), so the tap silently did nothing at all.
  async function handleHeroBannerPress() {
    if (heroBannerTarget === 'Gallery') {
      addPhoto.openAddPhoto(navigation)
      return
    }
    const callNum = ((await getItem('VERIFIEDBYCALLNUM')) ?? '').trim()
    // Angular guards on isValidparam() — no number, no action, rather than
    // opening the dialer empty.
    if (!callNum) return
    Linking.openURL(`tel:${callNum}`).catch(e => {
      if (__DEV__) console.error('[Matches] verify-call dial error:', e)
    })
  }

  async function loadMore() {
    if (loadingMoreRef.current) return
    // Defense-in-depth alongside the global OfflineScreen overlay — don't fire
    // the next-page call while offline.
    if (isOffline) { showToast(t('GENERAL.NOINTERNET')); return }
    const cursorRef = extendedLoaded ? extendedApiStartRef : apiStartRef
    const bound      = extendedLoaded ? extendedCount : totalCount
    if (cursorRef.current >= bound) {
      // onEndReached fired with no page left to fetch: the member is at the end
      // of the preference feed, which is Angular's cue to show the end card.
      if (!extendedLoaded) setRegularExhausted(true)
      return
    }
    // Angular doInfinite() (matches.page.ts:1458) — a hard stop once the
    // free-match paywall has kicked in, on top of the totalCount comparison
    // above (totalCount itself also gets frozen once this is true — see
    // homeService.ts's applyFreeMatchLimit — this is belt-and-suspenders,
    // matching Angular's own redundant guard). Angular's own check is
    // unconditional across every routepage, extendedPage included.
    if (await checkLimitFlowStatus()) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const result = await fetchList(cursorRef.current, 20)
      if (result.items.length > 0) {
        setProfiles(prev => {
          const seen = new Set(prev.map(p => p.profileId))
          const fresh = result.items.map(matchProfileAdapter.adapt).filter(p => !seen.has(p.profileId))
          if (fresh.length === 0) return prev
          const offset = prev.length
          if (result.bannerSlots.length > 0) {
            setBannerSlots(existing => [
              ...existing,
              ...result.bannerSlots.map(bs => ({ slot: bs.slot, insertAfter: bs.insertAfter + offset })),
            ])
          }
          return [...prev, ...fresh] as MatchProfile[]
        })
        cursorRef.current += result.items.length
      }
    } catch (e) {
      if (__DEV__) console.error('[Matches] load more error:', e)
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }

  // ── Profile action handlers ─────────────────────────────────────────────────
  // All use communicationBtnOnClick → same params as Angular communicationBtnOnClick

  // Angular communication.service.ts's showCustomToaster() Undo button handler
  // — tapping Undo fires a plain `dislike` call (button-role 'cancel' dismisses
  // the toast immediately, independent of whether this call succeeds).
  async function handleUndoLike(profile: MatchProfile) {
    setProfiles(prev => prev.map(p =>
      p.profileId === profile.profileId ? { ...p, likedStatus: '0' as const } : p
    ))
    try {
      await communicationBtnOnClick('matches', 'dislike', { MATRIID: profile.profileId })
    } catch (e) {
      if (__DEV__) console.error('[Matches] undo-like error:', e)
    }
  }

  async function handleLike(profile: MatchProfile) {
    // Angular: button.service.ts checkAddPhotoPromotion() — blocks Like/Don't-show
    // (not Call/WhatsApp/View-later) when the logged-in user has no published photo.
    if (addPhotoGateActive) { setShowAddPhotoActionPrompt(true); return }
    // Optimistic UI: flip card to "liked" state immediately
    setProfiles(prev => prev.map(p =>
      p.profileId === profile.profileId ? { ...p, likedStatus: '1' as const } : p
    ))
    try {
      const result = await communicationBtnOnClick('matches', 'like', { MATRIID: profile.profileId })
      if (result.type === 'error') {
        // Revert on failure
        setProfiles(prev => prev.map(p =>
          p.profileId === profile.profileId ? { ...p, likedStatus: '0' as const } : p
        ))
        // Angular communication.service.ts's showCustomToaster() — this fires
        // on the SAME toast (with the SAME Undo button) for both success and
        // failure-with-message (e.g. a real response: {RESPONSECODE:"2",
        // ERRCODE:"1", MSG:"You have already liked ."}) — 1500ms, not the
        // 2000ms default used by every other toast in this screen.
        showToast(result.message, () => handleUndoLike(profile), 1500)
      } else if (result.type === 'api_success' && result.message) {
        showToast(result.message, () => handleUndoLike(profile), 1500)
      }
      // Angular: communication.service.ts fires this on every like EXCEPT one
      // sent from Daily Recommendation. The matches card is not DR, so every
      // like here counts towards the active threshold.
      appRating.onLikeSent()
    } catch (e) {
      if (__DEV__) console.error('[Matches] like error:', e)
    }
  }

  // Angular matches.page.ts re-derives banner positions from the live list on
  // every render. This port instead stores them as absolute indices
  // (bannerSlots[].insertAfter = how many profiles precede the banner), so every
  // removal has to shift the banners that sit after it. Without this the
  // intermediate nudges drift one slot further down per skipped/view-later
  // profile and then disappear entirely: buildMergedList() only walks i up to
  // profs.length, so any slot whose insertAfter has run past the end of the
  // shrunken array is never emitted at all.
  function removeProfileAndShiftBanners(profileId: string) {
    const idx = profiles.findIndex(p => p.profileId === profileId)
    if (idx === -1) return
    setProfiles(prev => prev.filter(p => p.profileId !== profileId))
    setBannerSlots(prev => prev.map(bs =>
      bs.insertAfter > idx ? { ...bs, insertAfter: bs.insertAfter - 1 } : bs,
    ))
  }

  async function handleDontShow(profile: MatchProfile) {
    if (addPhotoGateActive) { setShowAddPhotoActionPrompt(true); return }
    // Optimistic UI: remove card immediately (matches Angular removeProfile)
    removeProfileAndShiftBanners(profile.profileId)
    setTotalCount(prev => Math.max(0, prev - 1))
    recordMatchRemoval()
    apiStartRef.current = Math.max(0, apiStartRef.current - 1)
    try {
      await communicationBtnOnClick('matches', 'skip', { MATRIID: profile.profileId })
      // Angular: communication.service.ts afterHttpServiceResponse() → presentToast(msg, 2000)
      showToast(t('VIEWPROFILE.SKIP_PROFILE'))
    } catch (e) {
      if (__DEV__) console.error('[Matches] dont show error:', e)
    }
  }

  async function handleViewLater(profile: MatchProfile) {
    // Optimistic UI: remove card immediately (matches Angular removeProfile)
    removeProfileAndShiftBanners(profile.profileId)
    setTotalCount(prev => Math.max(0, prev - 1))
    recordMatchRemoval()
    apiStartRef.current = Math.max(0, apiStartRef.current - 1)
    try {
      await communicationBtnOnClick('matches', 'viewlater', { MATRIID: profile.profileId })
      showToast(t('GENERAL.PROFILE_LATER'))
    } catch (e) {
      if (__DEV__) console.error('[Matches] view later error:', e)
    }
  }

  // Angular button.component.ts's showContactDetails() (communication.service.ts:
  // 253-271) — the confirm popup is only shown when NEITHER direct-reveal
  // condition is met (already viewed this profile before, or mutual-like+paid+
  // quota-left) — it's not unconditional. A previous version of this port
  // always showed the confirm step regardless.
  //
  // Angular communication.service.ts's showCallAndWhatsAppPromo(): the "view
  // phone number?" CONFIRM popup lives INSIDE showContactDetails(), which is
  // only reached at all once entryType=='P', this profile's number was already
  // viewed, or the female-free promo applies — a free member who's never viewed
  // this profile goes straight to paymentPromoPopUp(), no confirm step first.
  // A previous version of this port ran shouldSkipPhoneConfirm() unconditionally
  // here, so a free member who'd never viewed this profile saw a spurious "Would
  // you like to continue?" sheet before landing on the paywall anyway — a sheet
  // Angular never shows in that state. handleContactConfirmYes() is called
  // directly (not showPaymentPromo()) so the service still owns the decision —
  // its female-free branches (photo pending / call verification / limit over)
  // must keep winning over the paywall for a free female member who qualifies.

  // Angular communication.service.ts:632 — the in-memory half of the two-part
  // already-viewed record: the list row itself is flipped to PHONEVIEWED='1' so a
  // second tap while still on this screen skips the confirm sheet outright.
  // Returns '1' so callers can use the new value in the same tick.
  function markPhoneViewed(profileId: string): string {
    setProfiles(prev => prev.map(p =>
      p.profileId === profileId ? { ...p, phoneViewed: '1' } : p,
    ))
    return '1'
  }

  // Angular communication.service.ts's showContactDetails() FIRST check — a
  // paid user whose mutual-like AND overall phone-view quotas are both
  // exhausted sees the PHONENOLIMIT sheet instead of the confirm popup.
  function checkPhoneNoLimit(profile: MatchProfile): boolean {
    if (shouldShowPhoneNoLimit(profile.phoneViewed, profile.likedStatus, indNumbersLeft, contactQuota.left, ownEntryType)) {
      setPhoneInfoSheet({ kind: 'female_free_limit_over' })
      return true
    }
    return false
  }

  async function handleCall(profile: MatchProfile) {
    // Angular communication.service.ts:181-186 — check_Paid_NonVerifyIdUser()
    // / check_Paid_Verified_Nophoto() run BEFORE showContactDetails() (the
    // PHONENOLIMIT + "view number?" confirm), so an unverified paid male goes
    // straight to the verify-profile sheet, never a contact prompt. The service
    // returns verify_id for exactly these gates.
    if (await checkPaidBlockerGate()) {
      handleContactConfirmYes({ profile, action: 'call' })
      return
    }
    if (checkPhoneNoLimit(profile)) return
    // Angular communication.service.ts:175-179 — promote a PHONEVIEWEDID match to
    // phoneViewed==='1' before deciding, so a number revealed earlier in this
    // session never asks for confirmation a second time.
    const phoneViewed = (await consumePhoneViewedId(profile.phoneViewed, profile.profileId))
      ? markPhoneViewed(profile.profileId)
      : profile.phoneViewed
    const alreadyViewed = ['1', '3'].includes(String(phoneViewed ?? '0'))
    if (ownEntryType !== 'P' && !alreadyViewed) {
      handleContactConfirmYes({ profile, action: 'call' })
      return
    }
    if (shouldSkipPhoneConfirm(phoneViewed, profile.likedStatus, indNumbersLeft, ownEntryType, profile.phoneProtected)) {
      handleContactConfirmYes({ profile, action: 'call' })
    } else {
      setContactConfirm({ profile, action: 'call' })
    }
  }

  // `nudge` = the photo overlay's WhatsApp button (Angular's 'whatsappNudge'),
  // not the action row's icon — same gating, different free-member sheet.
  async function handleWhatsApp(profile: MatchProfile, nudge = false) {
    const action: ContactAction = nudge ? 'whatsappNudge' : 'whatsapp'
    // Same verify-first order as handleCall above.
    if (await checkPaidBlockerGate()) {
      handleContactConfirmYes({ profile, action })
      return
    }
    if (checkPhoneNoLimit(profile)) return
    // Same PHONEVIEWEDID promotion as handleCall above.
    const phoneViewed = (await consumePhoneViewedId(profile.phoneViewed, profile.profileId))
      ? markPhoneViewed(profile.profileId)
      : profile.phoneViewed
    const alreadyViewed = ['1', '3'].includes(String(phoneViewed ?? '0'))
    if (ownEntryType !== 'P' && !alreadyViewed) {
      handleContactConfirmYes({ profile, action })
      return
    }
    if (shouldSkipPhoneConfirm(phoneViewed, profile.likedStatus, indNumbersLeft, ownEntryType, profile.phoneProtected)) {
      handleContactConfirmYes({ profile, action })
    } else {
      setContactConfirm({ profile, action })
    }
  }

  // Hidden photo → the partner's blurred photo + "has hidden" copy; no photo →
  // the placeholder (see whatsAppPhotoRequestSheet()).
  const waPhotoSheet = useMemo(() => whatsAppPhotoRequestSheet(
    t,
    oppGender,
    !!waPhotoRequest?.isPhotoAvailable,
    waPhotoRequest?.profileImg ?? waPhotoRequest?.photos?.[0],
  ), [waPhotoRequest, oppGender, t])

  // Angular showWhatsAppPhotoRequestPaymentPopup(): the open beacon fires as
  // the sheet is created.
  useEffect(() => {
    if (waPhotoRequest) paymentTrack(waPhotoSheet.tracking.open).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waPhotoRequest])

  // Angular onDidDismiss 'upgradeNow': pay beacon, then
  // redirectToIntermediatePage(this.router.url, '', '7', true).
  function handleWaPhotoRequestPayNow() {
    setWaPhotoRequest(null)
    paymentTrack(waPhotoSheet.tracking.pay).catch(() => {})
    redirectToIntermediatePage('matches', '', '7').catch(() => {})
  }

  // Angular: matches-card.component.html's message icon → clickingOnBtn(..., 'jodimessages', ...)
  // → communication.service.ts's jodimessages branch — no confirm popup (unlike call/whatsapp),
  // goes straight through gating: unverified paid male → verify_id, verified-no-photo → verify_id
  // (photoUpload), free member → payment promo, else → straight into the chat window.
  async function handleMessage(profile: MatchProfile) {
    try {
      const result = await communicationBtnOnClick('matches', 'jodimessages', { MATRIID: profile.profileId })
      if (result.type === 'payment_promo') {
        await showPaymentPromo(profile, false)
      } else if (result.type === 'verify_id') {
        // photoUpload=true (verified male, no photo yet) reads a DIFFERENT
        // registration-array config than the plain not-yet-verified case —
        // see communicationService.ts's CommActionResult 'verify_id' doc.
        const verifySheet = await buildVerifyIdSheet(!!result.photoUpload)
        setPhoneInfoSheet({ kind: 'verify_id', ...verifySheet })
      } else if (result.type === 'female_free') {
        const kindByAction: Record<string, PhoneInfoSheet['kind'] | undefined> = {
          'femaleFree-PhotoAdd':     'female_free_photo_add',
          'femaleFree-PhotoPending': 'female_free_photo_pending',
          'femaleFree-PhotoFail':    'female_free_photo_fail',
          'callVerification':        'female_free_call_verification',
          'femaleFree-LimitOver':    'female_free_limit_over',
        }
        const kind = kindByAction[result.action]
        if (kind) setPhoneInfoSheet({ kind } as PhoneInfoSheet)
      } else if (result.type === 'error') {
        showToast(result.message)
      }
      // result.type === 'api_success' — handleChat() already navigated to chat-window.
    } catch (e) {
      if (__DEV__) console.error('[Matches] message error:', e)
    }
  }

  function handleContactConfirmClose() {
    setContactConfirm(null)
  }

  // Angular button.component.ts:524-583 — see communicationService.ts's
  // getContactConfirmContent() for the full template-selection logic (shared
  // by all 6 screens that show this popup, so it can't drift out of sync).
  function getContactConfirmContent(): string {
    return getSharedContactConfirmContent(t, oppGender, contactQuota)
  }

  function handlePhoneInfoClose() {
    setPhoneInfoSheet(null)
  }

  // Maps each of the 6 phoneviewed scenarios (besides success) onto the generic
  // BottomSheet's flexible data shape — no bespoke component needed since these
  // vary between "just a close-X and raw text" (under_validation) and "two CTAs
  // with an OR separator" (fup_limit), both of which BottomSheetData already
  // supports directly.
  function getPhoneInfoSheetData(): {
    image?: string | undefined; title?: string | undefined; content?: string | undefined
    ctaLabel?: string | undefined; linkCtaLabel?: string | undefined; orCtaText?: string | undefined
    secondaryCtaLabel?: string | undefined; showSecondaryCta?: boolean | undefined; sideBySideCtas?: boolean | undefined
    ctaIcon?: string | undefined; pinkWash?: boolean | undefined
  } {
    if (!phoneInfoSheet) return {}
    switch (phoneInfoSheet.kind) {
      case 'phone_protected':
        // Angular en.json: GENERAL.PROTECT_NUMBER/_SUB/_NOTE — fixed strings, not
        // server-driven. Title has a literal <br> in Angular; stripped to a space
        // here since this sheet renders plain Text, not HTML.
        return {
          image:   CDN + 'protected-phoneno.svg',
          title:   t('GENERAL.PROTECT_NUMBER').replace(/<br\s*\/?>/gi, ' '),
          content: `${t('GENERAL.PROTECT_NUMBER_SUB')}\n\n${t('GENERAL.PROTECT_NUMBER_NOTE')}`,
          ctaLabel: t('GENERAL.OK_CTA', 'OK'),
        }
      case 'under_validation':
        // Angular: bare modal, just a close-X and the raw API message — no
        // title, no CTA button at all.
        return { content: phoneInfoSheet.message }
      case 'phone_limit_exceeded':
        return {
          image:    CDN + 'reached-limit-phone-number-img.svg',
          content:  phoneInfoSheet.body,
          ctaLabel: phoneInfoSheet.cta,
        }
      case 'fup_limit':
        return {
          image:        CDN + 'maximum-limit-reached-img.svg',
          title:        phoneInfoSheet.header,
          content:      phoneInfoSheet.body,
          ctaLabel:     phoneInfoSheet.cta,
          orCtaText:    t('GENERAL.OR', 'OR'),
          linkCtaLabel: phoneInfoSheet.cta1,
        }
      case 'profile_validation':
        return {
          image:    phoneInfoSheet.image,
          title:    phoneInfoSheet.title,
          content:  phoneInfoSheet.content,
          ctaLabel: phoneInfoSheet.cta,
        }
      case 'phone_number_left':
        // Angular's real behavior here is a whole renewal/upgrade-promo sub-flow
        // (a second API call + a distinct screen) that doesn't exist in this
        // port yet — this is an honest placeholder, not the real feature.
        return {
          title:    t('GENERAL.SORRY', 'Sorry'),
          content:  'Full renewal verification isn’t available in this app yet — please try again from a different profile for now.',
          ctaLabel: t('GENERAL.OK_CTA', 'OK'),
        }
      case 'verify_id':
        return {
          title:    phoneInfoSheet.title,
          content:  phoneInfoSheet.content,
          ctaLabel: phoneInfoSheet.ctaLabel,
          image:    phoneInfoSheet.image,
          ctaIcon:  phoneInfoSheet.ctaIcon,
          pinkWash: phoneInfoSheet.pinkWash,
        }
      // Angular botton-sheet.config.ts's UNDERVALIDSHEET/ADDPHOTOTEXT/
      // VERIFIEDBTMSHEET/PHONENOLIMIT — English text confirmed via source, not
      // exact i18n key lookups (these configs build the string inline rather
      // than through a translation key), so used here as literal strings.
      case 'female_free_photo_pending':
        return {
          title:    'Your photo is under validation!',
          content:  'This may take up to 2 hours. You can view phone numbers after that',
          ctaLabel: t('GENERAL.OK_CTA', 'OK'),
        }
      case 'female_free_photo_add':
        return {
          title:    `Add your photo to get 5 free contacts or get a paid membership to view ${t(`PRONOUN.${oppGender}.hisher`)} phone number`,
          ctaLabel: 'Become a paid member',
          secondaryCtaLabel: 'Add photo now',
          showSecondaryCta:  true,
        }
      case 'female_free_photo_fail':
        // No distinct Angular copy confirmed for the rejected-photo case —
        // treated the same as "no photo" (re-prompt to add one), since a
        // rejected photo isn't a usable one either.
        return {
          title:    `Add your photo to get 5 free contacts or get a paid membership to view ${t(`PRONOUN.${oppGender}.hisher`)} phone number`,
          ctaLabel: 'Become a paid member',
          secondaryCtaLabel: 'Add photo now',
          showSecondaryCta:  true,
        }
      case 'female_free_call_verification':
        return {
          title:    `Contact us to get 5 more free contacts or get a paid membership to view ${t(`PRONOUN.${oppGender}.hisher`)} phone number`,
          ctaLabel: 'Become a paid member',
          secondaryCtaLabel: 'Call now',
          showSecondaryCta:  true,
        }
      case 'female_free_limit_over':
        return {
          title:    'You have reached the maximum free phone number views limit!',
          content:  'Become a paid member to view more phone numbers of matches',
          ctaLabel: 'Become paid member',
        }
    }
  }

  function handlePhoneInfoPrimaryPress() {
    const kind = phoneInfoSheet?.kind
    setPhoneInfoSheet(null)
    // "Become a paid member" across the female-free variants, and verify_id's
    // own CTA, both point at the same upgrade path already used elsewhere here.
    if (kind === 'female_free_photo_add' || kind === 'female_free_photo_fail'
      || kind === 'female_free_call_verification' || kind === 'female_free_limit_over') {
      navigation.navigate('recharge')
    }
    // fup_limit's primary CTA is "Complete full verification" → Angular
    // navigates to /fup-verify, which isn't built — closing is the honest
    // behavior until that screen exists, rather than pretending to navigate.
  }

  function handlePhoneInfoSecondaryPress() {
    const kind = phoneInfoSheet?.kind
    setPhoneInfoSheet(null)
    if (kind === 'female_free_photo_add' || kind === 'female_free_photo_fail') {
      addPhoto.openAddPhoto(navigation)
    }
    // "Call now" (female_free_call_verification) would dial app support in
    // Angular — no confirmed support number source exists in this port yet,
    // so this honestly just closes rather than pretending to place a call.
  }

  // Angular's confirm step, when shown, calls PhoneViewProfileFunc() on "Yes";
  // the direct-reveal path (shouldSkipPhoneConfirm) calls the exact same
  // function immediately instead — same underlying action either way, this
  // just lets handleCall/handleWhatsApp invoke it without first round-
  // tripping through contactConfirm state.
  async function handleContactConfirmYes(override?: { profile: MatchProfile; action: ContactAction }) {
    const pending = override ?? contactConfirm
    if (!pending) return
    const { profile, action } = pending
    setContactConfirm(null)
    try {
      const result = await communicationBtnOnClick('matches', action, { MATRIID: profile.profileId })
      if (result.type === 'show_contact') {
        // Angular's Contact Details popup shows Name/Mobile/WhatsApp/Call
        // together regardless of which CTA was tapped — not one-or-the-other.
        markPhoneViewed(profile.profileId)
        setContactDetails({
          name:           profile.name,
          mobile:         result.mobile,
          dialNumber:     result.dialNumber,
          whatsappNumber: result.whatsappNumber,
          showCounter:    result.showCounter,
          viewedCount:    result.viewedCount,
          totalCount:     result.totalCount,
          idVerified:     profile.isIdVerified,
        })
        // Keep the confirmation sheet's own quota footer fresh for next time,
        // without waiting for a full screen reload.
        if (result.viewedCount !== undefined || result.remainingCount !== undefined) {
          setContactQuota(prev => ({
            ...prev,
            viewed: result.viewedCount ?? prev.viewed,
            left:   result.remainingCount ?? prev.left,
            // Angular's phoneviewed response has no totalProfileCountData field
            // (that only comes from nbcontacts) — `total` intentionally isn't
            // touched here, same as Angular leaves CONTACT_DETAIL.totalProfileCountData
            // untouched across a phoneviewed call.
          }))
        }
      } else if (result.type === 'payment_promo') {
        // Angular communication.service.ts's whatsappNudge branch: a free
        // member tapping the photo overlay's WhatsApp gets the
        // whatsAppPhotoRequestPayment sheet instead of the generic promo.
        if (action === 'whatsappNudge') setWaPhotoRequest(profile)
        else await showPaymentPromo(profile, action === 'whatsapp')
      } else if (result.type === 'phone_protected') {
        setPhoneInfoSheet({ kind: 'phone_protected' })
      } else if (result.type === 'under_validation') {
        setPhoneInfoSheet({ kind: 'under_validation', message: result.message })
      } else if (result.type === 'phone_limit_exceeded') {
        setPhoneInfoSheet({ kind: 'phone_limit_exceeded', body: result.body, cta: result.cta })
      } else if (result.type === 'fup_limit') {
        setPhoneInfoSheet({ kind: 'fup_limit', header: result.header, body: result.body, cta: result.cta, cta1: result.cta1 })
      } else if (result.type === 'profile_validation') {
        setPhoneInfoSheet({ kind: 'profile_validation', title: result.title, content: result.content, cta: result.cta, image: result.image })
      } else if (result.type === 'phone_number_left') {
        setPhoneInfoSheet({ kind: 'phone_number_left' })
      } else if (result.type === 'verify_id') {
        // Angular communication.service.ts's navigateToVerify() — content is
        // server-driven, from ONE of two registration-array configs depending
        // on which gate fired: PROFILEVERIFYPAID.Shortlist for the plain
        // not-yet-verified case, PHOTOPUBLISHPAID.Shortlist for the
        // verified-but-no-photo case (result.photoUpload — check_Paid_Verified_
        // Nophoto() in Angular). The support-number placeholder is `##CSNUM##`
        // (double-hash, confirmed against 5+ call sites) and it only ever
        // appears in CTA, not CONTENT — communication.service.ts:640-642:
        //   if (data.CTA.includes('##CSNUM##')) data.CTA = data.CTA
        //     .replace(/##CSNUM##/g, localStorage['VERIFIEDBYCALLNUM'] || '')
        //     .replace('+91', '')
        // (An earlier version of this code wrongly applied a replace to
        // CONTENT instead of CTA, using a nonexistent cfg.CSNUM field instead
        // of the real VERIFIEDBYCALLNUM session value.)
        const verifySheet = await buildVerifyIdSheet(!!result.photoUpload)
        setPhoneInfoSheet({ kind: 'verify_id', ...verifySheet })
      } else if (result.type === 'female_free') {
        const kindByAction: Record<string, PhoneInfoSheet['kind'] | undefined> = {
          'femaleFree-PhotoAdd':     'female_free_photo_add',
          'femaleFree-PhotoPending': 'female_free_photo_pending',
          'femaleFree-PhotoFail':    'female_free_photo_fail',
          'callVerification':        'female_free_call_verification',
          'femaleFree-LimitOver':    'female_free_limit_over',
        }
        const kind = kindByAction[result.action]
        if (kind) setPhoneInfoSheet({ kind } as PhoneInfoSheet)
      } else if (result.type === 'error') {
        showToast(result.message)
      }
    } catch (e) {
      if (__DEV__) console.error('[Matches] contact-reveal error:', e)
    }
  }

  function handleContactDetailsClose() {
    setContactDetails(null)
  }

  function handleContactDetailsCall() {
    // Angular: callNative('dial_pad') dials data.phoneNo (country-code
    // prefixed), not data.mobileNo (the bare on-screen display value).
    if (contactDetails?.dialNumber) Linking.openURL(`tel:${contactDetails.dialNumber}`)
  }

  function handleContactDetailsWhatsApp() {
    const num = contactDetails?.whatsappNumber?.replace(/\D/g, '')
    if (num) Linking.openURL(`https://wa.me/${num}`)
  }

  // Angular: button.component.ts's paymentPromoPopUp() — every paywalled action
  // (Call, WhatsApp, Message) lands here. A FREE member (ENTRYTYPE 'F') gets the
  // `paymentPromo` bottom sheet built from payment/nbcustomer/v1's content;
  // anyone else falls through to the payment page as before.
  async function showPaymentPromo(profile: MatchProfile, _isWhatsApp: boolean) {
    if (ownEntryType !== 'F') {
      navigation.navigate('recharge')
      return
    }
    const promo = await fetchUpgradePaymentPromo(profile.name).catch(() => null)
    // No content served → don't strand the tap on a dead end; fall back to the
    // payment page, which is where the sheet's own CTA goes anyway.
    // Angular routes PROMOTYPE 7/11 to phnoLeftPopup() (the renewal /
    // numbers-left popup) instead of this sheet — that popup isn't built in this
    // port, so those land on the payment page rather than the wrong sheet.
    if (!promo || ['7', '11'].includes(promo.promoType)) { navigation.navigate('recharge'); return }
    setPaymentPromo(promo)
  }

  // Angular: dismissModal('upgradeNow') → paymentService.redirectToIntermediatePage(
  // fromPage, PAYMENTID, type, true).
  function handlePaymentPromoUpgrade() {
    const promo = paymentPromo
    setPaymentPromo(null)
    if (!promo) return
    redirectToIntermediatePage('matches', promo.paymentId, promo.type, true)
  }

  // ── Bulk-like modal ──────────────────────────────────────────────────────────
  // Angular: openFullpageModal()'s onDidDismiss — reload the matches list from
  // start=0 only when likes were actually sent; a plain close/skip doesn't reload.

  // Angular: openFullpageModal()'s onDidDismiss (matches.page.ts:1800-1804) —
  // once the bulk-like modal closes, the paywall armed for this member fires.
  // After registration that is PAYWALLTYPE '1~2' (the welcome payment page), set
  // by drService's navigateToMatchesAfterRegistration(), which is what puts the
  // welcome offer AFTER Daily recommendations and the bulk-like prompt rather
  // than in front of them. Angular reads its cached this.PAYMENTWALL here; this
  // reads storage live, since the bulkLike() branch below may have consumed it.
  //
  // Angular's own guard skips it for types '0'/'3'/'4' ('3' and '4' are the
  // mid-session and expired walls, which have their own triggers) and when
  // another ion-modal is still open — the latter is why the add-photo upsell
  // path passes openWelcomePaywall=false: it hands straight over to another
  // sheet plus the photo picker.
  async function openWelcomePaywallAfterBulkLike() {
    const type = await getPaymentWallType()
    if (!type || ['0', '3', '4'].includes(type)) return
    await enablePaywall()
  }

  function handleBulkLikeClose() {
    setShowBulkLike(false)
    openWelcomePaywallAfterBulkLike().catch(() => {})
  }

  async function handleBulkLikeSent(openWelcomePaywall = true) {
    setShowBulkLike(false)
    if (openWelcomePaywall) openWelcomePaywallAfterBulkLike().catch(() => {})
    apiStartRef.current = 0
    // A full reload restarts the regular matches feed from page 0 — don't leave
    // fetchList()/loadMore() pointed at the extendedmatches/v1 branch with a
    // now-stale cursor from before this reload.
    extendedApiStartRef.current = 0
    setExtendedLoaded(false)
    // The extended flow restarts with it: the end card is offered again only
    // once this fresh feed is exhausted, and no profile carries the intro yet.
    setRegularExhausted(false)
    setExtendedFirstId(null)
    try {
      const result = await fetchList(0, 20, { extended: false })
      setProfiles(result.items.map(matchProfileAdapter.adapt))
      setBannerSlots(result.bannerSlots)
      setTotalCount(result.totalCount)
      recordMatchTotals(result.totalCount)
      apiStartRef.current = result.items.length
    } catch (e) {
      if (__DEV__) console.error('[Matches] reload after bulk-like error:', e)
    }
  }

  function handleBulkLikeNeedsPhoto() {
    setShowBulkLike(false)
    setShowPhotoBulkLikePrompt(true)
  }

  // Angular's photo-upsell sheet has two exits (add photo now / do it later) that
  // both eventually reload the matches list — simplified here to always reload
  // regardless of which button closed it (Angular's own "added a photo" exit has
  // a genuine dismiss-payload race in the source, so this is a deliberate cleanup,
  // not a missed edge case).
  function handleBulkLikePhotoPromptDismiss() {
    setShowPhotoBulkLikePrompt(false)
    handleBulkLikeSent()
  }

  // ── Extended matches (the "Please wait" end card) ───────────────────────────
  // Angular: the end card's own timer emits 'extendedPage' → endCardBtnEmit()
  // (matches.page.ts:2621) drops the card and calls getExtendedMatches(), which
  // appends the extended feed and tags its first profile so that card renders
  // the "recommended by BharatJodii" intro.

  async function handleLoadExtendedMatches() {
    if (loadingExtended || extendedLoaded) return
    setLoadingExtended(true)
    try {
      const result = await fetchExtendedMatches(0, 20)
      if (result.items.length > 0) {
        const adapted = result.items.map(matchProfileAdapter.adapt)
        // Angular tags the FIRST extended profile with ISEXTENDEDMATCHES="1" and
        // lets the card itself render the intro (matches-card.component.html:9),
        // so the heading sits inside that card over its own backdrop. This port
        // used a synthetic EXTENDED_INTRO banner row instead — a detached line of
        // centred text with no backdrop, above the card rather than part of it.
        setExtendedFirstId(adapted[0]?.profileId ?? null)
        setProfiles(prev => [...prev, ...adapted])
        // Angular matches.page.ts:1296 — on the FIRST extended page the header
        // count becomes preference total + extended total (`parseInt(totalCount)
        // + parseInt(resultData["TOTAL"])`), so the header stops reading as the
        // now-exhausted preference number. Local state only: Angular persists
        // MATCHESTOTALCOUNT for matchesPage/searchResult/explorePage but never
        // for extendedPage (:1584), so recordMatchTotals() is deliberately not
        // called here — the stored preference total must stay what it was.
        setTotalCount(prev => prev + (result.totalCount || 0))
        // Own 0-based cursor, separate from apiStartRef (regular matches) — see
        // extendedApiStartRef's declaration. Setting extendedLoaded switches
        // fetchList()/loadMore() over to the extendedmatches/v1 pagination branch.
        extendedApiStartRef.current = result.items.length
        setExtendedLoaded(true)
      }
    } catch (e) {
      if (__DEV__) console.error('[Matches] extended matches error:', e)
    } finally {
      setLoadingExtended(false)
    }
  }

  // ── Income disclosure prompt ─────────────────────────────────────────────────
  // Angular: modalResponse() — 'update' saves the picked income and drops the
  // snooze; any other dismissal (close-X, backdrop) re-arms the 7-day snooze.
  async function handleIncomeSelect(opt: PickerOption) {
    setShowIncomeSheet(false)
    await saveIncome(opt.key)
  }

  async function handleIncomeSheetClose() {
    setShowIncomeSheet(false)
    await snoozeIncomeSheet()
  }

  // ── Sticky bottom banner — profileValidation is Angular's own "First Priority"
  // (matches.page.ts:3234-3235); forceUpdate over paymentFailed below that is a
  // judgment call, since Angular's own two sticky slots don't establish a shared
  // precedence to copy for those two. ─────────────────────────────────────────
  //
  // Dismissal is keyed per OCCURRENCE, not a single blanket "any sticky was ever
  // closed this session" flag — Angular's own ionViewWillLeave() (matches.page.ts:
  // 910-937) lets a dismissed payment-failed sticky reappear once its
  // PAYMENTFAILURE_STICKY_UNTIL deadline passes and a genuinely NEW occurrence
  // starts (fresh deadline), rather than suppressing every future sticky —
  // including a different TYPE of sticky — for the rest of the screen's
  // lifetime. This matters now that checkOnFocusPopups() (see useFocusEffect)
  // re-derives paymentStickyInfo/profileValidationInfo on every return visit,
  // not just the first mount — a blanket one-way flag would have permanently
  // hidden every sticky after the very first dismissal, including a real new
  // profile-validation issue that only appeared on a later visit.
  function stickyKeyFor(kind: 'profileValidation' | 'forceUpdate' | 'paymentFailed'): string {
    return kind === 'paymentFailed' && paymentStickyInfo ? `paymentFailed:${paymentStickyInfo.deadlineMs}` : kind
  }

  const activeSticky: 'profileValidation' | 'forceUpdate' | 'paymentFailed' | null =
    profileValidationInfo && stickyKeyFor('profileValidation') !== dismissedStickyKey ? 'profileValidation'
    : forceUpdateInfo && stickyKeyFor('forceUpdate') !== dismissedStickyKey ? 'forceUpdate'
    : paymentStickyInfo && stickyKeyFor('paymentFailed') !== dismissedStickyKey ? 'paymentFailed'
    : null

  function handleStickyPress() {
    if (activeSticky === 'profileValidation') {
      setShowProfileValidationSheet(true)
    } else if (activeSticky === 'forceUpdate') {
      const url = String(Constants.expoConfig?.extra?.['playStoreUrl'] ?? 'https://play.google.com/store/apps/details?id=jodii.app')
      Linking.openURL(url)
    } else {
      navigation.navigate('recharge')
    }
  }

  function handleStickyClose() {
    if (activeSticky === 'forceUpdate') {
      setItem('PLAYSTOREUPDATE', '2')   // Angular: "show again next login"
    }
    if (activeSticky) setDismissedStickyKey(stickyKeyFor(activeSticky))
  }

  // Angular: bottom-sheet.service.ts's showBtmSheet() overwrites the sheet's
  // CTA with the CUSTOMER-CARE number when present, and its own onDidDismiss
  // dials it (common.callNative('dial_pad', 'NeedHelp')) — tapping the CTA
  // both closes the sheet and places the call, not one or the other.
  async function handleProfileValidationCtaPress() {
    setShowProfileValidationSheet(false)
    const phone = await getItem(StorageKeys.App.CUSTOMER_CARE)
    if (phone) Linking.openURL(`tel:${phone}`)
  }

  async function handleNotificationCta() {
    setShowNotificationPopup(false)
    await requestPushNotificationPermission()
  }

  // Angular: clickOnFilterChip() — toggle THIS chip (the others keep their own
  // state), persist the change into the shared filter selection, flip the app
  // into Filters mode, refresh the Filters-chip badge count, then applyFilter().
  // applyFilter() builds filterService.getUrlParams() and hands the matches page
  // a SEARCH_URL, so the refreshed list comes from the search endpoint with the
  // member's WHOLE preference set — not from the plain matches endpoint with
  // three ad-hoc flags bolted on, which is what this used to do (and which also
  // meant the chips silently dropped every other preference the member had set).
  //
  // 'FILTER' is not a togglable flag: it opens the full filter screen
  // (Angular: `type: 'searchPage'` → filterBtnEventEmit).
  async function applyQuickFilter(key: string) {
    // SearchScreen.tsx's header title/Reset-link/subheader all key off this
    // SAME eventType flag (getFilterEventType()) — without setting it here,
    // it stayed whatever it was last left at (defaulting to 'pp'), so tapping
    // "Filter" from Matches showed the "Partner preferences" header instead of
    // "Filters", even though this tap is the Filter-mode entry point, not PP.
    if (key === 'FILTER') { await setFilterEventType('filter'); navigation.navigate('Search'); return }
    // Anything the API didn't describe — desktop's React-only 'NEARBY' chip, or
    // a field this build doesn't know — is ignored rather than written into the
    // selection under a name the params builder knows nothing about.
    if (!quickFilterChips.some(c => c.key === key)) return

    const active = await toggleQuickFilter(key, quickFilterChips)
    setSelectedChips(active)
    setFilterCount(await getFilterEditedCount())
    await refreshWithCurrentFilters()
  }

  // Reset inside the desktop filter panel — clears every quick filter, then
  // re-queries ONCE at the end rather than per chip (which is why it doesn't
  // just call applyQuickFilter in a loop).
  async function resetQuickFilters() {
    let active: string[] = []
    for (const field of await getActiveQuickFilters(quickFilterChips)) {
      active = await toggleQuickFilter(field, quickFilterChips)
    }
    setSelectedChips(active)
    setFilterCount(await getFilterEditedCount())
    await refreshWithCurrentFilters()
  }

  // Re-runs the search from page 0 against whatever is currently persisted.
  // Shared by every chip toggle, the panel's Reset and its Apply.
  async function refreshWithCurrentFilters() {
    setLoading(true)
    apiStartRef.current = 0
    extendedApiStartRef.current = 0
    setExtendedLoaded(false)
    // The extended flow restarts with it: the end card is offered again only
    // once this fresh feed is exhausted, and no profile carries the intro yet.
    setRegularExhausted(false)
    setExtendedFirstId(null)
    try {
      const userId = await getItem(StorageKeys.Auth.USER_ID)
      const params = await buildSearchParams(userId ?? '', 0, 20)
      setQuickFilterParams(params)
      const result = await fetchSearchResults(params)
      setProfiles(result.items.map(matchProfileAdapter.adapt))
      setBannerSlots(result.bannerSlots)
      setTotalCount(result.totalCount)
      recordMatchTotals(result.totalCount)
      apiStartRef.current = result.items.length
    } catch (e) {
      if (__DEV__) console.error('[Matches] quick filter error:', e)
    } finally {
      setLoading(false)
    }
  }

  // Angular: pillFilter() — facet refinement, explore mode only (#5). Rejoins all
  // checked KEYs with '~' into QSEARCH and re-queries the same FILTERTYPE from page 0
  // (matches.page.ts:1990-2026). Shared by both the single-tap inline chip and the
  // "View more" modal's bulk Apply.
  async function applyFacetKeys(nextFacets: typeof facets) {
    if (!exploreType) return
    const nextQSearch = nextFacets.filter(f => f.checked).map(f => f.key).join('~')
    setFacets(nextFacets)
    setQSearch(nextQSearch)
    setLoading(true)
    apiStartRef.current = 0
    try {
      const result = await fetchExplore(exploreType, 0, 20, nextQSearch)
      setProfiles(result.items.map(matchProfileAdapter.adapt))
      setBannerSlots(result.bannerSlots)
      setTotalCount(result.totalCount)
      // No recordMatchTotals() here: this path is explore-only (it returns
      // early without an exploreType), and Angular's count write is gated to
      // the matches/search routes. The facet count is not the PP count.
      if (result.facets) {
        // Server re-sorts/recomputes counts per new QSEARCH — but keep the just-applied
        // checked state instead of trusting the fresh (unchecked) response.
        setFacets(result.facets.map(f => ({ ...f, checked: nextFacets.some(nf => nf.key === f.key && nf.checked) })))
      }
      apiStartRef.current = result.items.length
    } catch (e) {
      if (__DEV__) console.error('[Matches] facet filter error:', e)
    } finally {
      setLoading(false)
    }
  }

  function toggleFacet(key: string) {
    applyFacetKeys(facets.map(f => f.key === key ? { ...f, checked: !f.checked } : f))
  }

  function applyFacetSelection(checkedKeys: string[]) {
    applyFacetKeys(facets.map(f => ({ ...f, checked: checkedKeys.includes(f.key) })))
  }

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 2: navigation.navigate('Activity'); break
      // Angular: footer.component.ts — paymentTrack(31) fires right before
      // routing a free member to the payment intermediate page.
      case 3: openMembershipTab(); break
      case 4: navigation.navigate('MessagerList'); break
    }
  }

  // Shared by mobile's own FlatList (below) and the desktop layout (as a render-prop) —
  // one source of truth for which banner shows under which condition, at whatever
  // position `buildMergedList` placed it from the real API `bannerSlots` data.
  const renderBannerItem = useCallback((item: BannerItem) => {
      // BANNERSLOT 1001 — festival/membership offer (e.g. "Muhurtham Day Offer!")
      if (item.bannerSlot === '1001' && menuPromo?.MATCHESSLOT) {
        return (
          <MembershipBanner
            data={menuPromo.MATCHESSLOT}
            onPress={() => navigation.navigate('recharge')}
          />
        )
      }
      // BANNERSLOT 1013 — add photo to activate profile (free user, no photo)
      if (item.bannerSlot === '1013' && addPhotoBannerMatches) {
        return (
          <AddPhotoBanner
            data={addPhotoBannerMatches}
            onPress={() => addPhoto.openAddPhoto(navigation)}
          />
        )
      }
      // BANNERSLOT 1020 — GAM ad banner (Angular: <iframe [src]="gamBannerUrl">)
      if (item.bannerSlot === '1020' && gamParams) {
        return <GamBanner {...gamParams} />
      }
      // BANNERSLOT 1010 — "get ID verified" promo (removed live on ID-verify event).
      // idVerifyPromoMatches is precomputed in the load effect above (reg.PROFILEVERIFYPAID.Matches
      // + ##CSNUM## substitution) since both getRegistrationArrays() and getItem() are async and
      // this render callback must return synchronously.
      if (item.bannerSlot === '1010' && idVerifyPromoMatches) {
        return <ActivateMembershipBanner data={idVerifyPromoMatches} onPress={() => navigation.navigate('verifyid')} />
      }
      // BANNERSLOT 1011 — add-photo generic promo (#26)
      if (item.bannerSlot === '1011' && addPhotoPromoActive) {
        return (
          <PcsBanner
            imageUri={CDN + 'revamp/add-photo-banner-revamp.svg'}
            title={t('MATCHES.ADDPHOTO')}
            cta={t('MATCHES.ADDPHOTOCTA')}
            ctaBg="#802000"
            gradientColors={['#FFF6F2', '#FFFFFF']}
            onPress={() => addPhoto.openAddPhoto(navigation)}
          />
        )
      }
      // BANNERSLOT 1012 — add-horoscope promo (#26)
      if (item.bannerSlot === '1012' && addHoroActive) {
        return (
          <PcsBanner
            imageUri={CDN + 'revamp/horoscope-revamp.svg'}
            title={t('MATCHES.ADDHORO')}
            cta={t('MATCHES.ADDHOROCTA')}
            ctaBg="#2A4FA5"
            gradientColors={['#F3F7FF', '#FFFFFF']}
            onPress={() => navigation.navigate('onboarding', { pageNo: '29' })}
          />
        )
      }
      // BANNERSLOT 1014 — paid-verified-no-photo promo (dynamic), else legacy
      // ADDPROPERTYS fallback (#26) — Angular reuses this slot for two different concepts.
      if (item.bannerSlot === '1014' && paidNoPhotoBanner) {
        return  (
          <AddPhotoBanner
            data={paidNoPhotoBanner.data}
            onPress={() => addPhoto.openAddPhoto(navigation)}
          />
        ) 
      }
      // BANNERSLOT 1015 — Many Jobs cross-promo (#26). Angular's tap action is a native-bridge
      // call to an internal app code (common.redirectPlayStore('507')), not a known Play
      // Store URL — no such mapping exists anywhere in this port, so this opens whatever URL
      // the promo payload itself provides rather than inventing one.
      if (item.bannerSlot === '1015' && menuPromo?.MANYJOBSPROMO) {
        const jobsPromo = menuPromo.MANYJOBSPROMO
        const jobsUrl   = jobsPromo.URL ?? jobsPromo.LINK
        return (
          <JobsPromoBanner
            data={jobsPromo}
            onPress={() => { if (jobsUrl) Linking.openURL(jobsUrl) }}
          />
        )
      }
      return null
  }, [
    menuPromo, addPhotoBannerMatches, gamParams, addPhotoPromoActive, addHoroActive,
    paidNoPhotoBanner, idVerifyPromoMatches, navigation, t,
  ])

  // Merged list of profiles + inline banner slots (e.g. BANNERSLOT 1001 = membership
  // promo). A banner whose data hasn't loaded yet (e.g. 1020's GAM gamParams still
  // null) makes renderBannerItem return null for that row — but on react-native-web,
  // a FlatList/VirtualizedList cell whose renderItem returns null still commits a
  // real, non-zero-height row in the DOM instead of collapsing, showing up as a
  // blank gap before whatever card follows it. Filtering those rows out here, using
  // renderBannerItem itself (the actual single source of truth for what each slot
  // renders) instead of a separately-duplicated condition list, keeps this from
  // drifting out of sync with renderBannerItem's own per-slot conditions.
  const listData = useMemo<MatchListItem[]>(
    () => buildMergedList(profiles, bannerSlots).filter(
      item => !isBanner(item) || renderBannerItem(item) !== null
    ),
    [profiles, bannerSlots, renderBannerItem]
  )

  const renderItem: ListRenderItem<MatchListItem> = useCallback(({ item }) => {
    if (isBanner(item)) return renderBannerItem(item)
    return (
      <MatchCard
        profile={item}
        showExtendedIntro={item.profileId === extendedFirstId}
        oppGender={oppGender}
        ownEntryType={ownEntryType}
        femaleFreeEligible={femaleFreeEligible}
        indNumbersLeft={indNumbersLeft}
        onPress={() => redirectToViewProfile('', item.profileId, 'matches', profileIds)}
        onLike={() => handleLike(item)}
        onDontShow={() => handleDontShow(item)}
        onViewLater={() => handleViewLater(item)}
        onCall={() => handleCall(item)}
        onWhatsApp={() => handleWhatsApp(item)}
        onWhatsAppNudge={() => handleWhatsApp(item, true)}
        onMessage={() => handleMessage(item)}
        waPhotoFlag={waPhotoFlag}
      />
    )
  }, [
    renderBannerItem, oppGender, ownEntryType, femaleFreeEligible,
    indNumbersLeft, navigation, handleLike, handleDontShow, handleViewLater, handleCall,
    handleWhatsApp, handleMessage, profileIds, waPhotoFlag,
  ])

  // ── Desktop web layout (Figma "Jodii Desktop") ──────────────────────────────
  // Wide browser window only — mobile/native/narrow-web keep the JSX below,
  // untouched, sharing all the same state/handlers defined above.
  if (isDesktop) {
    return (
      <>
        <MatchesDesktopLayout
          langCode={i18n.language}
          onTabPress={handleTabPress}
          onLanguagePress={() => setShowLanguageSheet(true)}
          loading={loading}
          totalCount={totalCount}
          listData={listData}
          renderBanner={renderBannerItem}
          oppGender={oppGender}
          ownEntryType={ownEntryType}
          femaleFreeEligible={femaleFreeEligible}
          indNumbersLeft={indNumbersLeft}
          onProfilePress={p => redirectToViewProfile('', p.profileId, 'matches', profileIds)}
          onLike={handleLike}
          onDontShow={handleDontShow}
          onViewLater={handleViewLater}
          onCall={handleCall}
          onWhatsApp={handleWhatsApp}
          onMessage={handleMessage}
          onEditPreferences={() => goToEditPreferences(navigation)}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          selectedChips={selectedChips}
          onChipSelect={applyQuickFilter}
          onResetFilters={resetQuickFilters}
          onApplyFilters={refreshWithCurrentFilters}
          addPhotoBannerMatches={addPhotoBannerMatches}
          onActivateProfile={() => addPhoto.openAddPhoto(navigation)}
        />
        {activeSticky && (
          <StickyBanner
            text={
              activeSticky === 'profileValidation' ? profileValidationInfo!.stickyContent
              : activeSticky === 'forceUpdate'     ? t('APP_UPDATE.NOTE')
              : paymentStickyInfo!.content
            }
            ctaLabel={
              activeSticky === 'profileValidation' ? profileValidationInfo!.stickyCta
              : activeSticky === 'forceUpdate'     ? t('APP_UPDATE.CTA')
              : paymentStickyInfo!.ctaLabel
            }
            onPress={handleStickyPress}
            onClose={handleStickyClose}
            {...(activeSticky === 'paymentFailed' ? { countdownDeadlineMs: paymentStickyInfo!.deadlineMs } : {})}
          />
        )}
        <BulkLikeDesktopModal
          visible={showBulkLike}
          candidates={bulkLikeCandidates}
          showPhotoPromo={loginGender === 'M' && showPhotoPromotion}
          onClose={handleBulkLikeClose}
          onSent={handleBulkLikeSent}
          onSentNeedsPhoto={handleBulkLikeNeedsPhoto}
        />
        <BottomSheet
          visible={showPhotoBulkLikePrompt}
          type="photoBulkLike"
          data={{
            title:         t('MATCHES.BULK_LIKE_TITLE_1').replace(/<br\s*\/?>/gi, ' '),
            ctaLabel:      t('MATCHES.ADD_PHOTO'),
            linkCtaLabel:  t('MATCHES.LATER_CTA'),
            // Angular: PHOTO_BULK_LIKE config sets showClose:false/showCross:false —
            // this promo has no close button at all, only the "later" link.
            showClose:     false,
          }}
          onClose={handleBulkLikePhotoPromptDismiss}
          onPrimaryPress={() => { setShowPhotoBulkLikePrompt(false); addPhoto.openAddPhoto(navigation); handleBulkLikeSent(false) }}
          onLinkPress={handleBulkLikePhotoPromptDismiss}
        />
        <NotificationPermissionSheet
          visible={showNotificationPopup}
          onEnable={handleNotificationCta}
          onClose={() => setShowNotificationPopup(false)}
        />
        <AppRatingModal
          visible={!!appRating.trigger}
          source={appRating.trigger?.source ?? '1'}
          onClose={appRating.close}
        />
        <BottomSheet
          visible={showBharatJodiiRename}
          type="bharatJodiiRename"
          data={{
            title:    t('MATCHES.BJ_TITLE'),
            content:  t('MATCHES.BJ_SUBTXT'),
            ctaLabel: t('MATCHES.BJ_CTA'),
          }}
          onClose={() => setShowBharatJodiiRename(false)}
          onPrimaryPress={() => setShowBharatJodiiRename(false)}
        />
        <SurveyPopup visible={!!surveyData} data={surveyData} onClose={() => setSurveyData(null)} />
        <SearchablePicker
          visible={showIncomeSheet}
          title={t('GENERAL.MONTHLYINCOME', 'Monthly income')}
          placeholder={t('REGISTRATION.SELECTINCOME', 'Select income')}
          options={incomeOptions}
          selectedKey={null}
          onSelect={handleIncomeSelect}
          onClose={handleIncomeSheetClose}
        />
        <BottomSheet
          visible={showAddPhotoActionPrompt}
          type="photoPopUp"
          data={{
            image:    addPhotoActionPromoContent?.IMG || (CDN + 'revamp/alert-circle.svg'),
            title:    (addPhotoActionPromoContent?.TITLE ?? '').replace(/<[^>]*>/g, '') || t('GENERAL.ADD_PHOTO_TXT'),
            content:  (addPhotoActionPromoContent?.CONTENT ?? '').replace(/<[^>]*>/g, ''),
            ctaLabel: (addPhotoActionPromoContent?.CTA ?? '').replace(/<[^>]*>/g, '') || t('GENERAL.ADD_PHOTO_TXT'),
          }}
          onClose={() => setShowAddPhotoActionPrompt(false)}
          onPrimaryPress={() => { setShowAddPhotoActionPrompt(false); addPhoto.openAddPhoto(navigation) }}
        />
        {/* Angular: bottom-sheet.component's `action == 'paymentPromo'` block —
            the same real upgrade sheet Angular shows for Call/WhatsApp/Message. */}
        <BottomSheet
          visible={!!paymentPromo}
          type="paymentPromo"
          data={{
            title:      paymentPromo?.title,
            content:    paymentPromo?.content,
            subContent: paymentPromo?.subContent,
            benefits:   paymentPromo?.benefits,
            ctaLabel:   paymentPromo?.ctaLabel || t('GENERAL.BECOME_PAID'),
          }}
          onClose={() => setPaymentPromo(null)}
          onPrimaryPress={handlePaymentPromoUpgrade}
        />
        {/* Angular button.component.ts's two-step contact reveal: confirm → phoneviewed
            API → Contact Details sheet — see handleCall/handleWhatsApp above. */}
        <BottomSheet
          visible={!!contactConfirm}
          type="viewPhoneConfirm"
          data={{
            content: getContactConfirmContent(),
            ctaLabel: t('ACCOUNT.YES', 'Yes'),
          }}
          onClose={handleContactConfirmClose}
          onPrimaryPress={handleContactConfirmYes}
        />
        <ContactDetailsSheet
          visible={!!contactDetails}
          name={contactDetails?.name ?? ''}
          mobile={contactDetails?.mobile}
          whatsappNumber={contactDetails?.whatsappNumber}
          showCounter={contactDetails?.showCounter}
          viewedCount={contactDetails?.viewedCount}
          totalCount={contactDetails?.totalCount}
          showNotVerifiedNote={!contactDetails?.idVerified && loginGender === 'F'}
          onClose={handleContactDetailsClose}
          onCall={handleContactDetailsCall}
          onWhatsApp={handleContactDetailsWhatsApp}
        />
        {/* The other 6 phoneviewed scenarios (protected number / under validation /
            limit exceeded / FUP limit / profile validation / phone-number-left) —
            see getPhoneInfoSheetData() for how each maps onto this generic sheet. */}
        <BottomSheet
          visible={!!phoneInfoSheet}
          type="phonePrivacyInfo"
          data={getPhoneInfoSheetData()}
          onClose={handlePhoneInfoClose}
          onPrimaryPress={handlePhoneInfoPrimaryPress}
          onSecondaryPress={handlePhoneInfoSecondaryPress}
          onLinkPress={handlePhoneInfoClose}
        />
        <BottomSheet
          visible={showProfileValidationSheet}
          type="profileValidation"
          data={{
            image:    profileValidationInfo?.sheet.img,
            title:    profileValidationInfo?.sheet.title,
            content:  profileValidationInfo?.sheet.content,
            ctaLabel: profileValidationInfo?.sheet.cta,
          }}
          onClose={() => setShowProfileValidationSheet(false)}
          onPrimaryPress={handleProfileValidationCtaPress}
        />
        <LanguagePillSheet visible={showLanguageSheet} onClose={() => setShowLanguageSheet(false)} />
        <WebPhotoInput inputRef={addPhoto.webInputRef} onChange={addPhoto.handleWebFiles} />
        <AddPhotoVerdictSheets addPhoto={addPhoto} />
        <Toast request={toastRequest} />
      </>
    )
  }

  return (
    // top/bottom insets are already applied inside MatchesHeader/AppFooter —
    // only guard the side edges here (landscape notch/rounded-corner devices).
                                                                                                                                                                                                                                    <View style={s.screen}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {/* Separated component — SafeAreaView edges={["top"]} handles status bar internally */}
      <MatchesHeader
        loading={loading}
        totalCount={totalCount}
        langCode={i18n.language}
        chips={chips}
        selectedChips={selectedChips}
        onChipSelect={applyQuickFilter}
        filterCount={filterCount}
        preferenceCount={preferenceCount}
        onEditPreferences={() => goToEditPreferences(navigation)}
        onHeaderLayout={handleHeaderLayout}
        facets={facets}
        onFacetToggle={toggleFacet}
        onFacetsApply={applyFacetSelection}
        titleOverride={exploreLabel}
        isExploreMode={!!exploreType}
        titleTranslateY={titleTranslateY}
        titleRowHeight={titleRowH}
      />

      {/* ── Profile list / loader ──────────────────────────────────────────── */}
      {/* Angular: app-loader while !contentLoaded, cdk-virtual-scroll-viewport when loaded */}
      {loading ? (
        <View style={[s.loaderBox, { paddingTop: headerH }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : totalCount === 0 ? (
        <View style={{ flex: 1, paddingTop: headerH }}>
          <NoMatchesCard onPress={() => goToEditPreferences(navigation)} />
        </View>
      ) : (
        <Animated.FlatList
          ref={listRef}
          style={[{ flex: 1 }, listAnimStyle]}
          data={listData}
          keyExtractor={item => isBanner(item) ? item.uid : item.profileId}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: headerH, paddingBottom: 8 }}
          // Hide-on-scroll title row — UI-thread worklet, see handleListScroll above.
          onScroll={handleListScroll}
          scrollEventThrottle={16}
          // Angular: doInfinite() on scroll end — load next 20 when within 50% of end
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          // Virtualization tuning for smoother scroll — render a small window around
          // the visible area instead of the default (larger) window, and batch new
          // rows in smaller groups so mounting them doesn't cause a frame drop.
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS !== 'web'}
          ListHeaderComponent={
            showPhotoPromotion && photoBannerData ? (
              <PhotoPromotionBanner
                data={photoBannerData}
                onPress={handleHeroBannerPress}
              />
          ) : null
          }
          ListFooterComponent={
            loadingMore || loadingExtended
              ? <ActivityIndicator size="small" color={Colors.primary} style={s.footerLoader} />
              : extendedCount > 0 && !extendedLoaded && regularExhausted
                ? (
                  <ExtendedMatchesCard
                    count={extendedCount}
                    previewPhotos={extendedPreviews}
                    oppGender={oppGender}
                    onAdvance={handleLoadExtendedMatches}
                  />
                )
                : null
          }
        />
      )}

      {/* ── Sticky bottom banner (payment-failed retry / force-update) ──────── */}
      {activeSticky && (
        <StickyBanner
          text={
            activeSticky === 'profileValidation' ? profileValidationInfo!.stickyContent
            : activeSticky === 'forceUpdate'     ? t('APP_UPDATE.NOTE')
            : paymentStickyInfo!.content
          }
          ctaLabel={
            activeSticky === 'profileValidation' ? profileValidationInfo!.stickyCta
            : activeSticky === 'forceUpdate'     ? t('APP_UPDATE.CTA')
            : paymentStickyInfo!.ctaLabel
          }
          onPress={handleStickyPress}
          onClose={handleStickyClose}
          {...(activeSticky === 'paymentFailed' ? { countdownDeadlineMs: paymentStickyInfo!.deadlineMs } : {})}
        />
      )}

      <BulkLikeModal
        visible={showBulkLike}
        candidates={bulkLikeCandidates}
        showPhotoPromo={loginGender === 'M' && showPhotoPromotion}
        onClose={handleBulkLikeClose}
        onSent={handleBulkLikeSent}
        onSentNeedsPhoto={handleBulkLikeNeedsPhoto}
      />
      <BottomSheet
        visible={!!waPhotoRequest}
        type="whatsAppPhotoRequest"
        data={waPhotoRequest ? waPhotoSheet.data : undefined}
        // Angular opens this modal with backdropDismiss:false.
        dismissOnBackdrop={false}
        onClose={() => setWaPhotoRequest(null)}
        onPrimaryPress={handleWaPhotoRequestPayNow}
      />
      <BottomSheet
        visible={showPhotoBulkLikePrompt}
        type="photoBulkLike"
        data={{
          title:         t('MATCHES.BULK_LIKE_TITLE_1').replace(/<br\s*\/?>/gi, ' '),
          ctaLabel:      t('MATCHES.ADD_PHOTO'),
          linkCtaLabel:  t('MATCHES.LATER_CTA'),
        }}
        onClose={handleBulkLikePhotoPromptDismiss}
        onPrimaryPress={() => { setShowPhotoBulkLikePrompt(false); addPhoto.openAddPhoto(navigation); handleBulkLikeSent(false) }}
        onLinkPress={handleBulkLikePhotoPromptDismiss}
      />
      <NotificationPermissionSheet
        visible={showNotificationPopup}
        onEnable={handleNotificationCta}
        onClose={() => setShowNotificationPopup(false)}
      />
      <AppRatingModal
        visible={!!appRating.trigger}
        source={appRating.trigger?.source ?? '1'}
        onClose={appRating.close}
      />
      <BottomSheet
        visible={showBharatJodiiRename}
        type="bharatJodiiRename"
        data={{
          title:    t('MATCHES.BJ_TITLE'),
          content:  t('MATCHES.BJ_SUBTXT'),
          ctaLabel: t('MATCHES.BJ_CTA'),
        }}
        onClose={() => setShowBharatJodiiRename(false)}
        onPrimaryPress={() => setShowBharatJodiiRename(false)}
      />
      <SurveyPopup visible={!!surveyData} data={surveyData} onClose={() => setSurveyData(null)} />
      <SearchablePicker
        visible={showIncomeSheet}
        title={t('GENERAL.MONTHLYINCOME', 'Monthly income')}
        placeholder={t('REGISTRATION.SELECTINCOME', 'Select income')}
        options={incomeOptions}
        selectedKey={null}
        onSelect={handleIncomeSelect}
        onClose={handleIncomeSheetClose}
      />
      <BottomSheet
        visible={showAddPhotoActionPrompt}
        type="photoPopUp"
        data={{
          image:    addPhotoActionPromoContent?.IMG || (CDN + 'revamp/alert-circle.svg'),
          title:    (addPhotoActionPromoContent?.TITLE ?? '').replace(/<[^>]*>/g, '') || t('GENERAL.ADD_PHOTO_TXT'),
          content:  (addPhotoActionPromoContent?.CONTENT ?? '').replace(/<[^>]*>/g, ''),
          ctaLabel: (addPhotoActionPromoContent?.CTA ?? '').replace(/<[^>]*>/g, '') || t('GENERAL.ADD_PHOTO_TXT'),
        }}
        onClose={() => setShowAddPhotoActionPrompt(false)}
        onPrimaryPress={() => { setShowAddPhotoActionPrompt(false); addPhoto.openAddPhoto(navigation) }}
      />
      {/* Angular: bottom-sheet.component's `action == 'paymentPromo'` block —
          the same real upgrade sheet Angular shows for Call/WhatsApp/Message. */}
      <BottomSheet
        visible={!!paymentPromo}
        type="paymentPromo"
        data={{
          title:      paymentPromo?.title,
          content:    paymentPromo?.content,
          subContent: paymentPromo?.subContent,
          benefits:   paymentPromo?.benefits,
          ctaLabel:   paymentPromo?.ctaLabel || t('GENERAL.BECOME_PAID'),
        }}
        onClose={() => setPaymentPromo(null)}
        onPrimaryPress={handlePaymentPromoUpgrade}
      />
      {/* Angular button.component.ts's two-step contact reveal: confirm → phoneviewed
          API → Contact Details sheet — see handleCall/handleWhatsApp above. */}
      <BottomSheet
        visible={!!contactConfirm}
        type="viewPhoneConfirm"
        data={{
          content: getContactConfirmContent(),
          ctaLabel: t('ACCOUNT.YES', 'Yes'),
        }}
        onClose={handleContactConfirmClose}
        onPrimaryPress={handleContactConfirmYes}
      />
      <ContactDetailsSheet
        visible={!!contactDetails}
        name={contactDetails?.name ?? ''}
        mobile={contactDetails?.mobile}
        whatsappNumber={contactDetails?.whatsappNumber}
        showCounter={contactDetails?.showCounter}
        viewedCount={contactDetails?.viewedCount}
        totalCount={contactDetails?.totalCount}
        showNotVerifiedNote={!contactDetails?.idVerified && loginGender === 'F'}
        onClose={handleContactDetailsClose}
        onCall={handleContactDetailsCall}
        onWhatsApp={handleContactDetailsWhatsApp}
      />
      {/* The other 6 phoneviewed scenarios (protected number / under validation /
          limit exceeded / FUP limit / profile validation / phone-number-left) —
          see getPhoneInfoSheetData() for how each maps onto this generic sheet. */}
      <BottomSheet
        visible={!!phoneInfoSheet}
        type="phonePrivacyInfo"
        data={getPhoneInfoSheetData()}
        onClose={handlePhoneInfoClose}
        onPrimaryPress={handlePhoneInfoPrimaryPress}
        onSecondaryPress={handlePhoneInfoSecondaryPress}
        onLinkPress={handlePhoneInfoClose}
      />
      <BottomSheet
        visible={showProfileValidationSheet}
        type="profileValidation"
        data={{
          image:    profileValidationInfo?.sheet.img,
          title:    profileValidationInfo?.sheet.title,
          content:  profileValidationInfo?.sheet.content,
          ctaLabel: profileValidationInfo?.sheet.cta,
        }}
        onClose={() => setShowProfileValidationSheet(false)}
        onPrimaryPress={handleProfileValidationCtaPress}
      />
      {/* AppFooter's tab bar is 56px tall (+ its own safe-area padding) — the
          Toast's default 24px clearance alone left it overlapping the footer. */}
      <WebPhotoInput inputRef={addPhoto.webInputRef} onChange={addPhoto.handleWebFiles} />
      <AddPhotoVerdictSheets addPhoto={addPhoto} />
      <Toast request={toastRequest} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: Colors.white },
  loaderBox:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footerLoader: { marginVertical: 16 },

})

// Angular card styles — matches-card.component.scss
const c = StyleSheet.create({
  // Angular: vs-item pt-16 pb-24 matches-card-border (border-bottom: 8px solid #E6E6E6)
  card: {
    backgroundColor:   Colors.white,
    paddingTop:        16,
    borderBottomWidth: 8,
    borderBottomColor: Colors.borderSubtle,
  },
  // Angular: .recommended-jodii-position (matches-card.component.scss:166) —
  // absolute, top/left 0, width 100%, height 100vmin, behind the content.
  extendedIntroBg: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    height:   SW,
    overflow: 'hidden',
  },
  // Angular: heading2-semibold-18 black-color mb-24 pl-16 pr-16 — left-aligned,
  // over the backdrop.
  extendedIntroText: {
    fontSize:          FontSize.font18,
    lineHeight:        26,
    color:             Colors.black,
    paddingHorizontal: 16,
    marginBottom:      24,
  },

  // Angular: img-holder pl-16 pr-16 with brdr-radius (top-left + top-right radius 16)
  photoBox: {
    marginHorizontal: 16,
    borderTopLeftRadius:  16,
    borderTopRightRadius: 16,
    overflow:         'hidden',
    backgroundColor:  Colors.divider,
  },
  singlePhotoPressable: { width: '100%', height: '100%' },

  // Angular no-photo placeholder — currently unused (no JSX renders these;
  // hasRealPhoto/isHiddenPhoto cover every branch MatchCard actually takes).
  noPhoto:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  noPhotoIcon: { width: 56, height: 56, opacity: 0.35 },
  noPhotoText: { fontSize: FontSize.font14, color: Colors.textMuted },

  // Angular: isActivityLabel row — viewed-icon + LabelText below liked strip
  activityRow: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    marginTop:        16,
    paddingHorizontal: 16,
    gap:              8,
  },
  // fontFamily applied inline (langFonts.medium) — see MatchCard's Text usage.
  activityText: {
    fontSize:   FontSize.font14,
    color:      Colors.black,
    flex:       1,
  },

  // Angular: getContentAfterLike() text above Send Interest CTA
  // fontFamily applied inline (langFonts.medium) — see MatchCard's Text usage.
  afterLikeText: {
    fontSize:   FontSize.font14,
    color:      Colors.black,
    textAlign:  'center',
    marginBottom: 8,
  },

  // Angular: request-photo-now-vp + request-photo-vp — centered dark card overlay on photo
  photoOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems:     'center',
    justifyContent: 'center',
  },
  overlayCard: {
    backgroundColor:   Colors.scrimStrong,
    marginHorizontal:  24,
    paddingVertical:   8,
    paddingHorizontal: 16,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       Colors.overlayBorder,
    alignItems:        'center',
    width:             '70%',
    gap:               12,
  },
  // fontFamily applied inline (langFonts.regular) — see MatchCard's Text usage.
  overlayText: {
    fontSize:   FontSize.font13,
    color:      Colors.white,
    textAlign:  'center',
    lineHeight: 18,
  },
  // Angular: EButtonBackground.whatsApp — theme/variables.scss:63's
  // linear-gradient(180deg, #4AC14B 0%, #06853A 100%), applied via LinearGradient
  // at the call site — not a flat backgroundColor here.
  waBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    borderRadius:      8,
    paddingVertical:   8,
    paddingHorizontal: 16,
    marginTop:         8,
    gap:               6,
  },
  // fontFamily applied inline (langFonts.medium) — see MatchCard's Text usage.
  waBtnText: {
    fontSize:   FontSize.font12,
    color:      Colors.white,
  },
  // Angular: photo-request.component.html's "view hidden photo" CTA — link
  // style, not the solid waBtn/waBtnText the no-photo-at-all case above uses.
  whatsappLinkBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     8,
  },
  // fontFamily applied inline (langFonts.regular) — see MatchCard's Text usage.
  whatsappLinkText: {
    fontSize:           FontSize.font14,
    color:              Colors.whatsappGreen,
    textDecorationLine: 'underline',
  },

  // Angular: ion-row isProfileBadge d-flex pl-24 mt-16 — BELOW the photo
  badges: {
    flexDirection:    'row',
    flexWrap:         'wrap',
    alignItems:       'center',
    gap:              4,
    paddingHorizontal: 24,
    marginTop:        16,
  },
  paidBadge:     { width: 80, height: 24 },
  verifiedBadge: { width: 100, height: 24 },

  // Angular: .liked-profile { border-radius:50px; padding:4px 8px } +
  // "ml-16 mr-24 mt-8" on the div itself (matches-card.component.scss:175-179,
  // .html:135) — asymmetric margins (not a symmetric marginHorizontal:16), and
  // alignSelf:'flex-start' so this hugs its content like Angular's flex div
  // instead of stretching to the card's full width.
  likedStrip: {
    flexDirection:    'row',
    alignItems:       'center',
    alignSelf:        'flex-start',
    marginLeft:       16,
    marginRight:      24,
    marginTop:        8,
    borderRadius:     50,
    paddingHorizontal: 8,
    paddingVertical:   4,
    gap:              4,
  },
  likedIcon: { width: 20, height: 20, flexShrink: 0 },
  // fontFamily applied inline (langFonts.regular) — see MatchCard's Text usage.
  likedText: { fontSize: FontSize.font12, color: Colors.likedStripText },

  // Angular: d-flex align-center-item mt-12 pl-16 pr-16
  nameRow: {
    flexDirection:    'row',
    alignItems:       'center',
    marginTop:        12,
    paddingHorizontal: 16,
    gap:              12,
  },
  // Figma: #000000 — fontFamily applied inline (langFonts.semiBold) — see MatchCard's Text usage.
  name:       { fontSize: FontSize.font18, color: '#000000' },
  iconBtn:    { flexShrink: 0 },
  nameRowIcon:  { width: 24, height: 24 },
  nameRowIconWa:{ width: 28, height: 28 },

  // Angular: body2-regular-14 mt-2 pl-16 pr-16 bv-minht text-space
  // Figma: solid #000000; the "|" separators alone drop to 20% opacity
  // fontFamily applied inline (langFonts.regular) — see MatchCard's Text usage.
  basicView: {
    fontSize:         FontSize.font14,
    color:            '#000000',
    lineHeight:       20,
    marginTop:        4,
    paddingHorizontal: 16,
    // Angular applies BOTH .bv-minht (min-height 40) and .text-space
    // (min-height 45) to this block — 45 is the one that wins in CSS.
    minHeight:        45,
    // Angular: .align-content-center — with a min-height taller than a single
    // line, short content is centred in the box rather than pinned to the top,
    // which is what kept the name/basic-view/View-profile rows evenly spaced.
    textAlignVertical: 'center' as const,
  },
  basicViewSep: { color: 'rgba(0,0,0,0.2)' },

  // Angular: app-button-revamp [buttonSize]="link" — "View profile"
  viewProfileBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   8,
    gap:               2,
  },
  // fontFamily applied inline (langFonts.medium) — see MatchCard's Text usage.
  viewProfileText: {
    fontSize:   FontSize.font14,
    color:      Colors.link,
  },
  viewProfileArrow: { width: 20, height: 16 },

  // Angular: Row 1 = tertiary (Don't show) + secondary (View later), Row 2 = primary (Like)
  // Angular: pb-24 on the card container — bottom of last CTA to border
  // Figma: 12px gap between the secondary row and the Like button below it
  ctaSection: {
    marginTop:        8,
    marginBottom:     24,
    paddingHorizontal: 16,
    gap:              12,
  },
  // Figma: fixed 158px buttons + 12px gap at the 360px reference width — kept as an
  // even flex:1 split here instead of a literal 158px so it stays correct at any
  // device width, not just exactly 360px; the 12px gap is the real fix.
  ctaSecRow: {
    flexDirection: 'row',
    gap:           12,
  },
  // Keep ctaRow for backwards compat in case anything else references it
  ctaRow: {
    flexDirection:    'row',
    alignItems:       'center',
    marginTop:        8,
    marginBottom:     16,
    paddingHorizontal: 16,
    gap:              8,
  },

  // Figma: height 44, border 1px #545454, label Poppins-Regular 14 #545454
  ctaDontShow: {
    flex:           1,
    height:         44,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    borderWidth:    1,
    borderColor:    '#545454',
    borderRadius:   8,
  },
  // fontFamily applied inline (langFonts.regular) — see MatchCard's Text usage.
  // The three CTA labels sit in a `flexDirection:'row'` + `alignItems:'center'`
  // button beside a 24x24 icon, so what gets centred is the Text's LINE BOX, not
  // the glyphs inside it. With no explicit lineHeight, RN sizes that box from the
  // font's own ascent/descent — and on Android adds `includeFontPadding` space on
  // top of that — both of which are asymmetric, so the label settled visibly
  // lower than the icon it was supposed to be centred against.
  //
  // lineHeight 20 is the 14px body line-height used everywhere else in this port
  // (Angular's own .line-height-20); includeFontPadding:false drops Android's
  // extra metric padding (same fix OTPScreen.tsx:561 already uses); and
  // textAlignVertical centres the glyphs within whatever box remains.
  ctaDontShowText: { fontSize: FontSize.font14, color: '#545454', lineHeight: 20, includeFontPadding: false, textAlignVertical: 'center' as const },

  ctaViewLater: {
    flex:           1,
    height:         44,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    borderWidth:    1,
    borderColor:    '#545454',
    borderRadius:   8,
  },
  // fontFamily applied inline (langFonts.regular) — see MatchCard's Text usage.
  ctaViewLaterText: { fontSize: FontSize.font14, color: '#545454', lineHeight: 20, includeFontPadding: false, textAlignVertical: 'center' as const },

  // Angular: button-revamp.component.scss:13-21 — `ion-button[disabled]` only
  // overrides background (#e6e6e6) and text (#8A8A8A) via `--background`/
  // `--color`, `opacity: unset !important` (explicitly NOT dimmed) — the
  // greyBorder class's own #545454 1px border (setButtonBorder mixin) is left
  // untouched, so the border still shows on a disabled button, same as enabled.
  ctaDisabled: { backgroundColor: '#e6e6e6' },
  ctaDisabledText: { color: '#8A8A8A' },

  // Figma: height 44, bg #b50033 (Colors.primaryDark, not the app's general primary red),
  // label Poppins-SemiBold 14 white
  ctaLike: {
    height:          44,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: Colors.primaryDark,
    borderRadius:    8,
    gap:             6,
  },
  ctaLikeIcon: { width: 24, height: 24 },
  // fontFamily applied inline (langFonts.semiBold) — see MatchCard's Text usage.
  ctaLikeText: { fontSize: FontSize.font14, color: Colors.white, lineHeight: 20, includeFontPadding: false, textAlignVertical: 'center' as const },

  // Angular: matches-cta-bg-color (pink gradient) + "Send Interest" primary CTA
  afterLikeRow: {
    paddingHorizontal: 16,
    paddingVertical:   16,
    backgroundColor:  Colors.afterLikeBg,
    borderTopWidth:   1,
    borderTopColor:   Colors.afterLikeBorder,
  },
  ctaSendInterestWrap: {
    position: 'relative',
  },
  ctaSendInterest: {
    flexDirection:   'row',
    backgroundColor: Colors.primaryDark,
    borderRadius:    8,
    paddingVertical: 12,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
  },
  // Angular CONFIG.MESSAGE_BTN: white background, primary border + primary text,
  // full width, standard (44px) height, sat 12px below the primary CTA.
  ctaMessage: {
    flexDirection:   'row',
    marginTop:       12,
    height:          44,
    backgroundColor: Colors.white,
    borderWidth:     1,
    borderColor:     Colors.primaryDark,
    borderRadius:    8,
    alignItems:      'center',
    justifyContent:  'center',
    // Angular: `ion-icon.large { margin-right: 3px }`
    // (button-revamp.component.scss:395-398) — the icon sits almost against its
    // label. 8 was noticeably loose once the icon went to its real 24x24.
    gap:             3,
  },
  ctaMessageText: {
    fontSize: FontSize.font14,
    color:    Colors.primaryDark,
  },
  ctaSendInterestIconBox: {
    width:          20,
    height:         20,
    flexShrink:     0,
    alignItems:     'center',
    justifyContent: 'center',
  },
  // fontFamily applied inline (langFonts.medium) — see MatchCard's Text usage.
  ctaSendInterestText: {
    fontSize:   FontSize.font14,
    color:      Colors.white,
    lineHeight: 20,
  },
  freeBadge: {
    position:          'absolute',
    top:               -10,
    right:             12,
    zIndex:            1,
    backgroundColor:   Colors.badgeNewBg,
    borderRadius:      10,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  // Angular: matches-card.component.html:227 `free textcta-medium-12
  // black-color` — global.scss:2270 = var(--font12) + --english-medium-poppins.
  // Size was 10.
  //
  // FLAGGED, colour + container left alone: Angular's `.free` is not a chip at
  // all — it's a background-image ribbon (free-rectangle.svg, positioned
  // absolute at top:-1vmin/right:-1.9vmin) plus a `.free-extra` black CSS
  // triangle (matches-card.component.scss:192-215). This port renders a green
  // rounded pill (badgeNewBg/badgeNewText) instead, so Angular's `black-color`
  // text isn't transferable without porting the ribbon too.
  // fontFamily applied inline (langFonts.semiBold) — see MatchCard's Text usage.
  freeBadgeText: {
    fontSize:   FontSize.font12,
    color:      Colors.badgeNewText,
  },
  // Angular: matches-card.component.html:269 `body3-regular-12 black-color
  // contacts-count-reduce` — global.scss:2264 = var(--font12) +
  // --english-regular-poppins, and black-color = #000000. Was 11px/#666666.
  //
  // FLAGGED, not added: `.contacts-count-reduce`
  // (matches-card.component.scss:230-238) also gives this line a container —
  // width 100%, max-width 328px, height 24px, a horizontal
  // linear-gradient(90deg, transparent, #FFF9E6 50%, transparent) and 1px
  // top/bottom borders. This port renders bare centred text with no such band.
  // fontFamily applied inline (langFonts.regular) — see MatchCard's Text usage.
  contactsLeftText: {
    fontSize:   FontSize.font12,
    color:      '#000000',
    textAlign:  'center',
    marginTop:  8,
  },
})


// Angular: app-end-card [cardType]="'view-more'" styles
const e = StyleSheet.create({
  card: {
    backgroundColor:   Colors.white,
    paddingHorizontal: 24,
    paddingVertical:   24,
    alignItems:        'center',
    justifyContent:    'center',
  },
  // 3 overlapping avatar circles + 1 count badge
  avatarRow: {
    flexDirection: 'row',
    alignItems:    'center',
    // No bottom margin: the title below carries Angular's own mt-16, and
    // keeping both put 32 between the circles and "Please wait...".
  },
  // Angular `.avatar-images`: a 2px white ring on a #e5e5e5 plate. The size
  // itself is passed in from the component (9vh).
  avatarCircle: {
    overflow:        'hidden',
    borderWidth:     2,
    borderColor:     Colors.white,
    backgroundColor: Colors.extendedCardPlate,
  },
  avatarImg: { width: '100%', height: '100%' },
  // Angular: the count sits on the SAME grey plate as the photos and carries
  // black text — not a brand-red disc with white text, which is what this port
  // had (and flagged in a comment as its own deviation).
  countCircle: {
    borderWidth:     2,
    borderColor:     Colors.white,
    backgroundColor: Colors.extendedCardPlate,
    alignItems:      'center',
    justifyContent:  'center',
  },
  // Angular: body1-medium-14 black-color, over body3-regular-12 for "more".
  // fontFamily applied inline (langFonts.medium/.regular) — see ExtendedMatchesCard's Text usage.
  countNum:   { fontSize: FontSize.font14, color: Colors.black, lineHeight: 18 },
  countLabel: { fontSize: FontSize.font12, color: Colors.black, lineHeight: 16 },
  // Angular: end-card.component.html — heading1-semibold-20 color-4c4c4c (was
  // mistakenly ported as 18px; Angular's own class is the 20px size).
  title: {
    fontSize:   FontSize.font20,
    color:      Colors.extendedCardTitle,
    textAlign:  'center',
    // Angular: mt-16 on the title row, and mt-16 again on the content row.
    marginTop:  16,
  },
  // Angular: end-card.component.html — body2-regular-14 color-666666
  desc: {
    fontSize:   FontSize.font14,
    color:      Colors.textSecondary,
    textAlign:  'center',
    lineHeight: 22,
    marginTop:  16,
    // Angular: the content row is pl-24/pr-24 inside the already-padded grid.
    paddingHorizontal: 24,
  },
  // Angular: height 10, border-radius 20, white track (end-card.component.scss:57).
  progressTrack: {
    width:           '100%',
    height:          10,
    borderRadius:    20,
    backgroundColor: Colors.white,
    overflow:        'hidden',
    marginTop:       24,
  },
  progressFill: {
    height:          '100%',
    borderRadius:    20,
  },
})

// ─── Photo promotion banner styles ───────────────────────────────────────────
// Angular: home-banner addPhotoPromotion — free-trial-height (38vmin ≈ 150px on mobile)
// Layout: 2-column row — image col (33%) + text col (67%) with title + body + CTA

const pb = StyleSheet.create({
  // Angular: free-trial-height min-height:38vmin + pb-8 + pr-8 row
  container: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingRight:      8,
    paddingBottom:     8,
    minHeight:         140,
    borderBottomWidth: 8,
    borderBottomColor: Colors.borderSubtle,
    overflow:          'hidden',
  },
  // Angular: ion-col size="4", padd0 — image fills full col width/height
  imageCol: {
    width:      '33%',
    alignSelf:  'stretch',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  image: {
    width:  '100%',
    height: 140,
  },
  // Angular: ion-col size="8", pt-6 pl-0 pr-0 pb-0
  textCol: {
    flex:           1,
    paddingTop:     6,
    paddingBottom:  8,
    justifyContent: 'center',
  },
  // Angular: heading3-semibold-16 black-color
  // fontFamily applied inline (langFonts.semiBold) — see PhotoPromotionBanner's Text usage.
  title: {
    fontSize:   FontSize.font16,
    color:      Colors.black,
    lineHeight: 22,
  },
  // Angular: mt-8 body3-regular-12 black-color
  // fontFamily applied inline (langFonts.regular) — see PhotoPromotionBanner's Text usage.
  body: {
    fontSize:   FontSize.font12,
    color:      Colors.black,
    marginTop:  8,
    lineHeight: 18,
  },
  // Angular: mt-12, EButtonSize.medium, padding-16, alignSelf NOT full-width
  ctaBtn: {
    marginTop:         12,
    borderRadius:      8,
    paddingVertical:   10,
    paddingHorizontal: 16,
    alignSelf:         'flex-start',
    alignItems:        'center',
  },
  // Angular: app-button-revamp default ctaFontSize = EButtonFontSize.regular14
  // fontFamily applied inline (langFonts.semiBold) — see PhotoPromotionBanner's Text usage.
  ctaText: {
    fontSize:   FontSize.font14,
  },
})

// ─── Add photo banner styles (BANNERSLOT 1013) ───────────────────────────────
// Angular: breather-block ADDPHOTO type — 2-column: image left (33%) + text right (67%)

const ap = StyleSheet.create({
  // Angular: breather-block pl-20 pr-20, breather-container gap:12, min-height ~387px
  container: {
    paddingHorizontal: 20,
    paddingVertical:   24,
    gap:               12,
    borderBottomWidth: 8,
    borderBottomColor: Colors.borderSubtle,
    overflow:          'hidden',
  },
  // Angular: add-photo-height = 13vh ≈ 87px, auto width, align-items flex-start
  image: {
    height:      87,
    width:       87,
    resizeMode: 'contain',
  },
  // Angular: heading1-semibold-22 black-color line-height-32
  // fontFamily applied inline (langFonts.semiBold) — see AddPhotoBanner's Text usage.
  title: {
    fontSize:   FontSize.font22,
    color:      Colors.black,
    lineHeight: 32,
  },
  // Angular: body1-medium-14 black-color
  // fontFamily applied inline (langFonts.medium) — see AddPhotoBanner's Text usage.
  subheader: {
    fontSize:   FontSize.font14,
    color:      Colors.black,
  },
  // Angular: pl-24, benefits-container gap:12
  bullets: {
    paddingLeft: 24,
    gap:         12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           6,
  },
  // Angular: li::marker color #8A8A8A
  bullet: {
    fontSize:   FontSize.font14,
    color:      Colors.borderNeutral,
    lineHeight: 22,
    flexShrink: 0,
  },
  // Angular: body2-regular-14 black-color
  // fontFamily applied inline (langFonts.regular) — see AddPhotoBanner's Text usage.
  bulletText: {
    fontSize:   FontSize.font14,
    color:      Colors.black,
    flex:       1,
    lineHeight: 22,
  },
  // Angular: hasFullWidth, mt-6
  ctaBtn: {
    marginTop:       6,
    borderRadius:    8,
    paddingVertical: 14,
    alignItems:      'center',
  },
  // Angular: app-button-revamp default ctaFontSize = EButtonFontSize.regular14
  // fontFamily applied inline (langFonts.semiBold) — see AddPhotoBanner's Text usage.
  ctaText: {
    fontSize:   FontSize.font14,
    color:      Colors.white,
  },
})

// Membership banner (MembershipBanner) and its styles now live in
// components/matches/MembershipBanner.tsx — extracted for reuse by ViewProfileScreen.

