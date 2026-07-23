// Angular equivalent: pages/matches/matches.page.ts + matches-card.component
// Landing page for existing users after login (WEBVIEWURL page_id = 60)
// Card layout mirrors matches-card.component.html exactly.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Linking,
  ListRenderItem,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import MatchesHeader from '../../components/matches-header/MatchesHeader'
import {
  WhatsAppIcon, WhatsAppUnlockButton, CallIcon, CloseIcon, ViewLaterIcon, LikeIcon,
  buildBasicViewParts, showLikeCTA, showAfterLikeCTA,
  getBlurPhotoUri, NEWLY_JOINED_STAR_URI, RIGHT_ARROW_ANIMATION_URI, ProfileBadge,
  PhotoSwiper,
  getAfterLikeCtaLabel, getAfterLikeCtaIcon, getAfterLikeContentText, showContactsLeftBanner, showFreeBadge,
  disableDontShow, disableViewLater,
  type AfterLikeCtx,
} from '../../components/matches/matchesCard.shared'
import MatchesDesktopLayout from './MatchesDesktopLayout'
import WhatsAppPaywallModal from '../../components/matches/WhatsAppPaywallModal'
import MembershipBanner from '../../components/matches/MembershipBanner'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { matchProfileAdapter } from '../../adapters/matches.adapter'
import { isBanner, type MatchProfile, type BannerItem, type MatchListItem } from '../../types/interfaces/matches.interface'
import { EEndCardText } from '../../types/enums/common.enum'
import {
  fetchMatches,
  fetchExplore,
  fetchSearchResults,
  type QuickFilters,
  type ExploreFacet,
  fetchExtendedMatchesCount,
  fetchExtendedMatches,
  fetchAndStorePPSetData,
  fetchMenuPromo,
  fetchNotifCount,
  refreshSession,
} from '../../service/homeService'
import {
  communicationBtnOnClick,
  fetchContactDetails,
  shouldSkipPhoneConfirm,
} from '../../service/communicationService'
import { fetchBulkLikeMatches } from '../../service/profileService'
import { redirectToViewProfile } from '../../service/buttonService'
import { setFilterEventType } from '../../service/filterService'
import { getHeroBannerDetails, paymentTrack } from '../../service/paymentService'
import { shouldShowRatingPopup, markRatingPopupShown } from '../../service/appRatingService'
import { requestPushNotificationPermission } from '../../service/permissionService'
import { fetchSurveyPopup, type SurveyPopupData } from '../../service/surveyService'
import { subscribeIdVerified } from '../../service/eventBus'
import { getItem, setItem, getJson } from '../../service/storageService'
import { getSessionValue, getRegistrationArrays } from '../../service/registrationService'
import { StorageKeys } from '../../constants/storage.keys'
import Constants from 'expo-constants'
import GamBanner from '../../components/gam-banner/GamBanner'
import BulkLikeModal from '../../components/bulk-like/BulkLikeModal'
import ContactDetailsSheet from '../../components/matches/ContactDetailsSheet'
import StickyBanner from '../../components/sticky-banner/StickyBanner'
import AppRatingModal from '../../components/app-rating/AppRatingModal'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import SurveyPopup from '../../components/survey-popup/SurveyPopup'
import Toast, { type ToastRequest } from '../../components/toast/Toast'

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
  onPress, onLike, onDontShow, onViewLater, onCall, onWhatsApp,
  showLikedBadge,
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
  // Angular's real gate is showLikedLbl (true for BOTH liked tabs on Activity,
  // regardless of the viewer's own likedStatus toward that profile) — the
  // COMTEXTDATE text itself already carries the correct direction/wording
  // ("You liked X on..." vs "X liked you on..."). Matches' own listing never
  // passes this, so its stricter likedStatus==='1' gate (this profile is one
  // you've already liked) stays exactly as-is; only ActivityScreen opts in.
  showLikedBadge?: boolean | undefined
}) {
  const { t } = useTranslation()
  const { LinearGradient } = require('expo-linear-gradient')
  const hasRealPhoto      = profile.isPhotoAvailable && !profile.isPhotoProtect && profile.photos.length > 0
  const isHiddenPhoto     = profile.isPhotoAvailable && profile.isPhotoProtect
  // Angular: photo-new.component.ts getHiddenPhotoContent() — once liked/shortlisted,
  // the "request" is considered sent and only the waiting text remains (no CTA).
  const hiddenPhotoPending = profile.likedStatus === '1' || profile.likedStatus === '3'
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

      {/* ── Photo section ──────────────────────────────────────────────────── */}
      {/* Angular: app-photo-new — top border radius 16px */}
      <View style={[c.photoBox, { height: PHOTO_H }]}>
        {hasRealPhoto ? (
          // Normal: actual photo(s) — swiper when >1, single Pressable image otherwise.
          // Angular: matches-card.component's Swiper. No lock/restriction on swiping
          // through a match's photos — confirmed against the real Angular app; a
          // previous pass here mistakenly gated photo 2+ behind an "add your own
          // photo" card, misattributing femaleFreeContactRestrict() (which actually
          // restricts CONTACT actions, not photo viewing — see femaleFreeEligible).
          <PhotoSwiper
            images={profile.photos}
            width={SW - 32}
            height={PHOTO_H}
            onPress={onPress}
          />
        ) : isHiddenPhoto ? (
          // Photo exists but is protected/hidden — distinct from "no photo at all".
          // Angular: photo-new.component's viewPhotoRequest block, HORO_HIDDEN_LIKE/
          // HORO_HIDDEN_PHOTO text driven by likedStatus (not a separate request flag).
          <Pressable style={c.singlePhotoPressable} onPress={onPress}>
            <CdnSvg
              uri={getBlurPhotoUri(oppGender)}
              width="100%" height="100%"
              style={StyleSheet.absoluteFill}
            />
            <View style={c.photoOverlay}>
              <View style={c.overlayCard}>
                <Text style={c.overlayText}>
                  {t(hiddenPhotoPending ? 'VIEWPROFILE.HORO_HIDDEN_PHOTO' : 'VIEWPROFILE.HORO_HIDDEN_LIKE')
                    .replace(/##HE_SHE##/g, t(`PRONOUN.${oppGender}.heshe`))
                    .replace(/##HIS_HER##/g, t(`PRONOUN.${oppGender}.hisher`))
                    .replace(/##he_she##/g, t(`PRONOUN.${oppGender}.heshe`).toLowerCase())}
                </Text>
                {!hiddenPhotoPending && (
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
                      <Text style={c.waBtnText}>{t('GENERAL.LIKE_CTA').replace('#HER_HIM#', '').trim()}</Text>
                    </LinearGradient>
                  </Pressable>
                )}
              </View>
            </View>
          </Pressable>
        ) : (
          // No photo at all: blur placeholder + WhatsApp overlay
          // Angular: getWhatsAppAvatarImg() + request-photo-vp overlay
          <Pressable style={c.singlePhotoPressable} onPress={onPress}>
            <CdnSvg
              uri={getBlurPhotoUri(oppGender)}
              width="100%" height="100%"
              style={StyleSheet.absoluteFill}
            />
            <View style={c.photoOverlay}>
              <View style={c.overlayCard}>
                <Text style={c.overlayText}>
                  {t('GENERAL.REQUEST_ADD_PHOTO_WHATSAPP').replace('#HER_HIS#', t(`PRONOUN.${oppGender}.hisher`))}
                </Text>
                <WhatsAppUnlockButton label={t('GENERAL.WHATSAPP')} onPress={onWhatsApp} />
              </View>
            </View>
          </Pressable>
        )}

        {/* Angular: .newly-joined posabsolute — star SVG + "New" text, top-left of photo */}
        {profile.isNewlyJoined && (
          <View style={c.newBadge} pointerEvents="none">
            <CdnSvg uri={NEWLY_JOINED_STAR_URI} width={14} height={14} />
            <Text style={c.newBadgeText}>{t('MATCHES.NEW')}</Text>
          </View>
        )}
      </View>

      {/* ── Paid + Verified badges ─────────────────────────────────────────── */}
      {/* Angular: ion-row isProfileBadge — BELOW the photo, not overlaid.
          Verified badge is gated to female viewers only (matches-card.component.html:
          *ngIf="isIdVerifiedMember && FUNC.getLogInGender() == 'F'"). oppGender is the
          viewer's opposite gender, so oppGender === 'M' means the viewer herself is female. */}
      {(profile.isPaidMember || (profile.isIdVerified && oppGender === 'M')) && (
        <View style={c.badges}>
          {profile.isPaidMember && (
            <ProfileBadge variant="paid" text={t('MENU.PAID_BADGE')} />
          )}
          {profile.isIdVerified && oppGender === 'M' && (
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
          <Text style={c.likedText} numberOfLines={1}>{profile.likedDateText}</Text>
        </LinearGradient>
      )}

      {/* ── Activity label row ────────────────────────────────────────────── */}
      {/* Angular: isActivityLabel — "Viewed on …" / "Shortlisted on …" with icon */}
      {profile.isNewLabel && !!profile.labelContent && (
        <View style={c.activityRow}>
          <CdnSvg uri={CDN + 'revamp/viewed-icon-updated.svg'} width={16} height={16} style={{ marginTop: 2, flexShrink: 0 }} />
          <Text style={c.activityText}>{profile.labelContent}</Text>
        </View>
      )}

      {/* ── Name + Call icon + WhatsApp icon ───────────────────────────────── */}
      {/* Angular: d-flex row: heading2-semibold-18 name + phone-icon + matches-whatsapp */}
      <View style={c.nameRow}>
        {/* flexShrink (not flex:1) — the name sits at its own width so the icons land
            right next to it, not pushed to the far edge of the row. Still truncates
            via numberOfLines if the name itself is too long for the row. */}
        <Pressable style={{ flexShrink: 1 }} onPress={onPress}>
          <Text style={c.name} numberOfLines={1}>{profile.name}</Text>
        </Pressable>
        {/* Figma: 24x24 circle, white fill, 1px #006c48 border, 20x20 icon centered inside */}
        <Pressable style={[c.iconBtn, c.callIconCircle]} onPress={onCall} hitSlop={8}>
          <CallIcon width={20} height={20} />
        </Pressable>
        <Pressable style={c.iconBtn} onPress={onWhatsApp} hitSlop={8}>
          <WhatsAppIcon width={28} height={28} />
        </Pressable>
      </View>

      {/* ── Basic view text ────────────────────────────────────────────────── */}
      {/* Angular: bindBasicView() — "27 yrs | 5'5" | Brahmin | B.Tech | Engineer | Chennai, TN" —
          solid black segments, "|" separators alone drop to 20% opacity. */}
      <Pressable onPress={onPress}>
        <Text style={c.basicView} numberOfLines={4}>
          {buildBasicViewParts(profile).map((part, i) => (
            <Text key={i}>
              {i > 0 && <Text style={c.basicViewSep}> | </Text>}
              {part}
            </Text>
          ))}
        </Text>
      </Pressable>

      {/* ── View profile link ──────────────────────────────────────────────── */}
      {/* Angular: app-button-revamp [iconType]="forwardAnimation" — swaps the plain
          chevron for this animated GIF (button-revamp.component.html IsShowAnimation()). */}
      <Pressable onPress={onPress} style={c.viewProfileBtn}>
        <Text style={c.viewProfileText}>{t('MATCHES.VIEW_PROFILE_CTA')}</Text>
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
              <Text style={c.ctaDontShowText}>{t('GENERAL.DONTSHOWCTA')}</Text>
            </Pressable>
            <Pressable
              style={[c.ctaViewLater, viewLaterDisabled && c.ctaDisabled]}
              onPress={onViewLater}
              disabled={viewLaterDisabled}
            >
              <ViewLaterIcon width={24} height={24} />
              <Text style={c.ctaViewLaterText}>{t('GENERAL.VIEWLATER')}</Text>
            </Pressable>
          </View>
          <Pressable style={c.ctaLike} onPress={onLike}>
            <LikeIcon width={24} height={24} />
            <Text style={c.ctaLikeText}>{t('GENERAL.LIKE_CTA').replace('#HER_HIM#', '').trim()}</Text>
          </Pressable>
        </View>
      )}

      {showAfterLikeCTA(profile.likedStatus) && (
        // Angular: matches-cta-bg-color (pink gradient bg) + getContentAfterLike() text +
        // Call Now/Pay Now CTA (#22) + FREE badge (#24) + contacts-left line (#23).
        <View style={c.afterLikeRow}>
          <Text style={c.afterLikeText}>
            {getAfterLikeContentText(ctaCtx, t)}
          </Text>
          <View style={c.ctaSendInterestWrap}>
            {showFreeBadge(ctaCtx) && (
              <View style={c.freeBadge} pointerEvents="none">
                <Text style={c.freeBadgeText}>{t('GENERAL.FREE')}</Text>
              </View>
            )}
            <Pressable style={c.ctaSendInterest} onPress={onCall}>
              <View style={c.ctaSendInterestIconBox}>
                <CdnSvg uri={getAfterLikeCtaIcon(ctaCtx)} width={18} height={18} />
              </View>
              <Text style={c.ctaSendInterestText}>{getAfterLikeCtaLabel(ctaCtx, t)}</Text>
            </Pressable>
          </View>
          {showContactsLeftBanner(ctaCtx) && (
            <Text style={c.contactsLeftText}>{t('VIEWPROFILE.CONTACT_SEEN_INFO')}</Text>
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
          {!!data.TITLE && <Text style={pb.title}>{stripHtml(data.TITLE)}</Text>}
          {!!data.BODY  && <Text style={pb.body}>{stripHtml(String(data.BODY))}</Text>}
          {!!data.CTA   && (
            <Pressable
              style={[pb.ctaBtn, { backgroundColor: data.CTABGCOLOR || Colors.primaryDark }]}
              onPress={onPress}
            >
              <Text style={[pb.ctaText, { color: data.CTACOLOR || Colors.white }]}>{stripHtml(data.CTA)}</Text>
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
  return (
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={pcs.container}>
      <View style={{ width: iconSize, height: iconSize }}>
        <CdnSvg uri={imageUri} width="100%" height="100%" />
      </View>
      <Text style={pcs.title}>{title}</Text>
      <Pressable style={[pcs.cta, { backgroundColor: ctaBg }]} onPress={onPress}>
        <Text style={pcs.ctaText}>{cta}</Text>
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
  },
  title: {
    marginTop:  16,
    fontFamily: 'Poppins-SemiBold',
    fontSize:   18,
    color:      '#000000',
    textAlign:  'center',
  },
  cta: {
    marginTop:      24,
    width:          '100%',
    height:         44,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
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
  return (
    <Pressable style={spb.card} onPress={onPress}>
      {!!imageUri && <Image source={{ uri: imageUri }} style={spb.image} resizeMode="contain" />}
      <Text style={spb.title} numberOfLines={2}>{title}</Text>
      <View style={[spb.cta, ctaBg ? { backgroundColor: ctaBg } : null]}>
        <Text style={spb.ctaText}>{cta}</Text>
      </View>
    </Pressable>
  )
}

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
  title: {
    flex:       1,
    fontFamily: 'Poppins-Medium',
    fontSize:   13,
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
  ctaText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   12,
    color:      Colors.white,
  },
})

// ─── Add Photo Banner (BANNERSLOT 1013) ──────────────────────────────────────
// Angular: app-breather ADDPHOTO type — data from REGISTRATIONARRAYS.PHOTOPUBLISHED.Matches
// Layout: image left (4/12) + text right (8/12): TITLE + SUBHEADER + BODY.CONTENT1/CONTENT2 + CTA

function AddPhotoBanner({ data, onPress }: { data: any; onPress: () => void }) {
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
        <Text style={ap.title}>{title}</Text>

        {/* Subheader — Angular: body1-medium-14 black-color */}
        <Text style={ap.subheader}>{subhead}</Text>

        {/* Bullets — Angular: ul pl-24, li body2-regular-14, benefits-container gap:12 */}
        <View style={ap.bullets}>
          {!!line1 && (
            <View style={ap.bulletRow}>
              <Text style={ap.bullet}>{'•'}</Text>
              <Text style={ap.bulletText}>{line1}</Text>
            </View>
          )}
          {!!line2 && (
            <View style={ap.bulletRow}>
              <Text style={ap.bullet}>{'•'}</Text>
              <Text style={ap.bulletText}>{line2}</Text>
            </View>
          )}
        </View>

        {/* CTA — Angular: hasFullWidth, mt-6 */}
        <Pressable style={[ap.ctaBtn, { backgroundColor: ctaBg }]} onPress={onPress}>
          <Text style={ap.ctaText}>{cta}</Text>
        </Pressable>
      </LinearGradient>
    </Pressable>
  )
}

// ─── Extended Matches End Card ────────────────────────────────────────────────
// Angular: app-end-card [cardType]="'view-more'" — shown at bottom of list when
// extendedMatchesCount > 0. Layout: 3 avatar circles + count badge + title + desc.

const FEMALE_AVATAR = CDN + 'female_avatar_new.svg'

function ExtendedMatchesCard({ count, onPress }: { count: number; onPress: () => void }) {
  const { t } = useTranslation()
  return (
    <Pressable style={e.card} onPress={onPress}>
      {/* 3 overlapping avatars + count badge */}
      <View style={e.avatarRow}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[e.avatarCircle, { marginLeft: i === 0 ? 0 : -12 }]}>
            <CdnSvg uri={FEMALE_AVATAR} width={52} height={52} />
          </View>
        ))}
        <View style={[e.countCircle, { marginLeft: -12 }]}>
          <Text style={e.countNum}>+{count}</Text>
          <Text style={e.countLabel}>{t('MATCHES.MORE')}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={e.title}>{t('MATCHES.CONTINUE_TITLE')}</Text>

      {/* Description */}
      <Text style={e.desc}>
        {t('MATCHES.CONTINUE_CONT')}
      </Text>

      {/* Progress bar — Angular: ion-progress-bar */}
      <View style={e.progressTrack}>
        <View style={e.progressFill} />
      </View>
    </Pressable>
  )
}

// ─── No Matches (empty state) ──────────────────────────────────────────────────
// Angular: app-end-card [cardType]="'no-data'" — shown when contentLoaded &&
// profiles.length === 0 (matches.page.html:209-215). CTA navigates to the
// filter/preferences screen (endCardEventEmit('search') → reDirectSearchPage()).

function NoMatchesCard({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation()
  return (
    <View style={n.card}>
      <Text style={n.title}>{t(EEndCardText.noMatches)}</Text>
      <Text style={n.desc}>{t(EEndCardText.modifyPreference)}</Text>
      <Pressable style={n.cta} onPress={onPress}>
        <Text style={n.ctaText}>{t(EEndCardText.ctaModifyPreference)}</Text>
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
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   16,
    color:      '#000000',
    textAlign:  'center',
  },
  desc: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      '#000000',
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
  ctaText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      Colors.primaryDark,
  },
})

// BANNERSLOT 1010 — "get ID verified" promo (Angular: matches.page.ts:1208-1210, sent
// via EKYCFLAG=1 for non-verified male users). Removed live by subscribeIdVerified().
function IdVerifyBanner({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation()
  return (
    <Pressable style={iv.card} onPress={onPress}>
      <CdnSvg uri={CDN + 'id-verify-promo.svg'} width={40} height={40} />
      <View style={iv.textCol}>
        <Text style={iv.title}>{t('VERIFY_ID.VERIFY_PROFILE_TXT')}</Text>
        <Text style={iv.body}>{t('VERIFY_ID.VERIFY_PROFILE_TXT_1')}</Text>
      </View>
      <View style={iv.cta}>
        <Text style={iv.ctaText}>{t('VERIFY_ID.VERIFY_NOW_CTA')}</Text>
      </View>
    </Pressable>
  )
}

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
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   14,
    color:      Colors.textDark,
  },
  body: {
    fontFamily: 'Poppins-Regular',
    fontSize:   12,
    color:      Colors.textSecondary,
    marginTop:  2,
  },
  cta: {
    backgroundColor:   Colors.badgeVerifiedText,
    borderRadius:      8,
    paddingVertical:   8,
    paddingHorizontal: 12,
  },
  ctaText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   12,
    color:      Colors.white,
  },
})

// ─── MatchesScreen ────────────────────────────────────────────────────────────

export default function MatchesScreen({ navigation, route }: { navigation: any; route?: any }) {
  const { t, i18n } = useTranslation()
  const isDesktop = useIsDesktopWeb()

  // ── Explore-by-category mode (#6) ───────────────────────────────────────────
  // Angular: callMatchesApi() explorePage branch — set when navigated here from a
  // Home "Explore matches based on" category tile instead of the bottom-nav tab.
  const exploreType   = route?.params?.exploreType as string | undefined
  const exploreLabel  = route?.params?.exploreLabel as string | undefined
  // Set by SearchScreen's "Show matches" CTA (filterService.buildSearchParams()) —
  // Angular: search.component.ts applyFilter() → router.navigate(['matches'], {state:{SEARCH_URL}})
  const searchParams  = route?.params?.searchParams as string | undefined
  const [facets,  setFacets]  = useState<ExploreFacet[]>([])
  const [qSearch, setQSearch] = useState('')

  async function fetchList(start: number, limit: number, quickFilters?: QuickFilters) {
    if (searchParams) {
      // Filtered search results aren't paginated past the first page yet — the
      // params string is pre-built with its own START/LIMIT by SearchScreen.
      if (start > 0) return { items: [], bannerSlots: [], totalCount: 0, newCount: 0 }
      return fetchSearchResults(searchParams)
    }
    return exploreType
      ? fetchExplore(exploreType, start, limit, qSearch)
      : fetchMatches(start, limit, quickFilters)
  }

  // ── State ───────────────────────────────────────────────────────────────────
  const [profiles,     setProfiles]     = useState<MatchProfile[]>([])
  // Feature-2 prev/next-profile-swipe on ViewProfileScreen — passed as the list
  // it can swipe within, RN's lightweight stand-in for Angular's localStorage
  // prefetch cache (see redirectToViewProfile's profileIds param).
  const profileIds = useMemo(() => profiles.map(p => p.profileId), [profiles])
  const [totalCount,   setTotalCount]   = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [extendedCount,  setExtendedCount]  = useState(0)
const [selectedChip,   setSelectedChip]   = useState<string>('')
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

  // ── Extended matches ("Continue seeing profiles" end-card) ─────────────────
  const [loadingExtended, setLoadingExtended] = useState(false)
  const [extendedLoaded,  setExtendedLoaded]  = useState(false)

  // ── Sticky bottom banner (payment-failed retry / force-update) ─────────────
  const [forceUpdateInfo,   setForceUpdateInfo]   = useState<{ minVersion: string } | null>(null)
  const [paymentStickyInfo, setPaymentStickyInfo] = useState<{ content: string; ctaLabel: string; deadlineMs: number } | null>(null)
  const [stickyDismissed,   setStickyDismissed]   = useState(false)

  // ── Notification permission popup (~40s after landing on Matches) ──────────
  const [showNotificationPopup, setShowNotificationPopup] = useState(false)

  // ── "Rate our app" popup ────────────────────────────────────────────────────
  const [showRatingPopup, setShowRatingPopup] = useState(false)

  // ── Survey popup ─────────────────────────────────────────────────────────────
  const [surveyData, setSurveyData] = useState<SurveyPopupData | null>(null)

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

  // ── WhatsApp "pay now" paywall modal (free/non-paid user tapped WhatsApp) ──
  const [whatsappPaywallProfile, setWhatsappPaywallProfile] = useState<MatchProfile | null>(null)

  // ── Contact-reveal flow (Angular button.component.ts's two-step confirm →
  // phoneviewed API → Contact Details sheet) — previously this port skipped
  // straight to dialing on 'show_contact', no confirmation or details sheet. ──
  const [contactConfirm, setContactConfirm] = useState<{ profile: MatchProfile; action: 'call' | 'whatsapp' } | null>(null)
  const [contactDetails, setContactDetails] = useState<{
    name: string; mobile?: string | undefined; dialNumber?: string | undefined; whatsappNumber?: string | undefined
    showCounter?: boolean | undefined; viewedCount?: string | undefined; totalCount?: string | undefined
    idVerified?: boolean | undefined
  } | null>(null)
  // Angular button.component.ts:551-579 — the CONFIRMATION popup's own quota
  // footer line ("You have viewed contact numbers of #VAR# profiles. #VAR1#
  // remaining till #VAR2#"), read purely from the local CONTACT_DETAIL cache
  // (no API call) — #VAR#=phoneNumbersViewed, #VAR1#=phoneNumbersLeft,
  // #VAR2#=expiryTextValue. Defaults to 0 until the first real reveal, same as
  // Angular (nbcontacts's own response has no viewed-count field).
  const [contactQuota, setContactQuota] = useState({ viewed: '0', left: '', expiry: '' })

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
    | { kind: 'verify_id'; title: string; content: string; ctaLabel: string }
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

  // ── Extra promo banners (#26: 1011/1012/1014/1015 + hero-banner extension) ──────
  const [addPhotoPromoActive, setAddPhotoPromoActive] = useState(false)
  const [addHoroActive,       setAddHoroActive]       = useState(false)
  const [paidNoPhotoBanner,   setPaidNoPhotoBanner]   = useState<any>(null)   // reg.PHOTOPUBLISHPAID.Matches, or {} for the static ADDPROPERTYS fallback
  // Hero banner header (ListHeaderComponent) — extends the existing photo-promo
  // banner to Angular's other two variants. 'target' picks the onPress destination.
  const [heroBannerTarget, setHeroBannerTarget] = useState<'Gallery' | 'verifyid'>('Gallery')

  // ── Header hide-on-scroll ────────────────────────────────────────────────────
  // Angular: offsetHt = this.header?.el?.offsetHeight where #header = the TITLE ion-row only.
  // The entire ion-header translates by offsetHt (title row height), so the title disappears
  // above the screen and the pref+chips section slides up to become the new sticky top bar.
  const headerAnim   = useRef(new Animated.Value(0)).current
  const titleHRef    = useRef(0)   // height of title row only — amount to slide (Angular offsetHt)
  const headerHRef   = useRef(0)   // full header height — used for FlatList paddingTop
  const [headerH, setHeaderH] = useState(0)
  const scrollYRef   = useRef(0)
  const isHiddenRef  = useRef(false)

  function handleTitleLayout(h: number) {
    if (h > 0) titleHRef.current = h
  }

  function handleHeaderLayout(h: number) {
    if (h > 0 && h !== headerHRef.current) {
      headerHRef.current = h
      setHeaderH(h)
    }
  }

  function handleScroll(e: any) {
    // Header hide-on-scroll animation disabled per request — header now stays fixed.
    // (Original Angular-mirroring slide logic kept here, commented out, in case it's revisited.)
    // const current = e.nativeEvent.contentOffset.y | 0
    // const delta   = current - scrollYRef.current
    // if (Math.abs(delta) < 10) return
    // scrollYRef.current = current
    //
    // // Angular: hide when scrollY > 100 && scrolling down, show when delta < -15 || scrollY < 50
    // const shouldHide = current > 100 && delta > 0
    // const shouldShow = delta < -15 || current < 50
    //
    // if (shouldHide && !isHiddenRef.current) {
    //   isHiddenRef.current = true
    //   Animated.timing(headerAnim, {
    //     toValue:         -(titleHRef.current || 56),  // slide by title row height only
    //     duration:        300,
    //     easing:          Easing.ease,
    //     useNativeDriver: true,
    //   }).start()
    // } else if (shouldShow && isHiddenRef.current) {
    //   isHiddenRef.current = false
    //   Animated.timing(headerAnim, {
    //     toValue:         0,
    //     duration:        300,
    //     easing:          Easing.ease,
    //     useNativeDriver: true,
    //   }).start()
    // }
  }

  // Merged list of profiles + inline banner slots (e.g. BANNERSLOT 1001 = membership promo)
  const listData = useMemo<MatchListItem[]>(
    () => buildMergedList(profiles, bannerSlots),
    [profiles, bannerSlots]
  )

  // apiStart tracks the cursor for pagination (how many profiles we've fetched from API)
  const apiStartRef = useRef(0)
  // Guards loadMore against re-entrant calls — onEndReached can fire again before the
  // `loadingMore` state update from the first call has committed, re-fetching the same
  // page and appending duplicate profiles (duplicate FlatList keys).
  const loadingMoreRef = useRef(false)

  // ── Angular sequence: ionViewDidEnter → API calls ───────────────────────────
  // 1. refreshSession()   → login/autologin/v1        (upgrades OTP token to Level-2)
  // 2. fetchMatches()     → listing/matches/v1        (main matches list)
  // 3. fetchNotifCount()  → communication/newcount/v1 (badge count)
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

        // Step 1 — refreshSession() ensures Level-2 tokens before any listing API call.
        // The 1hr gate lives in RootNavigation.tsx (centralized guard) — here we always
        // call it so fetchMatches() is guaranteed to have a valid ATN.
        await refreshSession()
        if (ctrl.cancelled) return

        // Step 2 — Angular: callMatchesApi() → listing/matches/v1 (or explore/v1 in explore mode)
        const result = await fetchList(0, 20)
        if (ctrl.cancelled) return

        setProfiles(result.items.map(matchProfileAdapter.adapt))
        setBannerSlots(result.bannerSlots)
        setTotalCount(result.totalCount)
        setFacets(result.facets ?? [])
        apiStartRef.current = result.items.length  // cursor for next page

        // Step 3 — Angular: parallel post-matches calls
        // newcount + extendedmatches + ppSetData + dailyRecommendations + menuPromo
        const [extCount, , promo, bulkLikeResult] = await Promise.all([
          fetchExtendedMatchesCount(),
          fetchAndStorePPSetData().then(async (ppSetData) => {
            // Populates CONTACT_DETAIL (Angular: common.ts's getContactDetails(),
            // called on every Matches-page load) BEFORE reading it below — this
            // was previously never called anywhere, so indNumbersLeft always
            // read the '0' fallback.
            await fetchContactDetails().catch(() => {})
            const [entryType, reg, femaleFreeRaw, horoAvailable, contactDetail, ekycStatus, paidFlag] = await Promise.all([
              getSessionValue('ENTRYTYPE'),
              getRegistrationArrays(),
              getSessionValue('FEMALEFREECONACT'),
              getSessionValue('HOROSCOPEAVAILABLE'),
              getJson<Record<string, any>>('CONTACT_DETAIL'),
              getItem('PI_EKYCSTATUS'),
              getItem(StorageKeys.Payment.PAY_P_FLAG),
            ])
            const photoStatus = ppSetData?.PI_PHOTOSTATUS ?? 'N'

            if (!ctrl.cancelled) {
              setOwnEntryType(entryType ?? '')

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
              })

              // BANNERSLOT 1011 — add-photo generic promo (#26)
              setAddPhotoPromoActive(!['P', 'Y'].includes(photoStatus))

              // BANNERSLOT 1012 — add-horoscope promo (#26)
              setAddHoroActive(horoAvailable !== '1')
            }

            // BANNERSLOT 1014 — paid-verified-no-photo promo, or legacy ADDPROPERTYS
            // fallback (#26). Angular: check_Paid_Verified_Nophoto(). "No photo" here must
            // match BANNERSLOT 1011's own definition of it two lines above — a photo pending
            // approval ('P') already counts as having one, not just an approved one ('Y').
            const isPaidVerifiedMale = entryType === 'P' && ekycStatus === '1' && lg === 'M' && !['P', 'Y'].includes(photoStatus)
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
            if (!ctrl.cancelled) {
              const forceUpdate  = ppSetData?.APPFORCEUPDATE
              const psUpdateFlag = await getItem('PLAYSTOREUPDATE')
              const appVersion   = Constants.expoConfig?.version ?? '1.0.0'
              if (forceUpdate?.APPVERSION && psUpdateFlag !== '1' && appVersion < forceUpdate.APPVERSION) {
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
              // Angular common-funtions.ts:362-364 check_Paid_NonVerifyIdUser() requires
              // PAYPFLAG=='1' too — a separate feature-enablement flag from ENTRYTYPE,
              // not redundant with it. Missing this was a confirmed real bug (found via
              // the identical gate in communicationService.ts's showCallOrWhatsApp):
              // it made this fire — and the "Activate your paid membership / Call us to
              // verify" hero banner below show — for real accounts whose PAYPFLAG isn't
              // '1', where Angular's own condition doesn't trigger it at all.
              const nonIdVerifyUserGate = entryType === 'P' && lg === 'M' && ekycStatus !== '1' && paidFlag === '1'
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
            } catch (err) {
              console.log('[PhotoBanner] error in banner check:', err)
            }
          }),
          fetchMenuPromo(),
          fetchBulkLikeMatches(),
        ])
        // Angular: bulkLike() — show the modal once, only when there are
        // enough candidates and enough total matches (matches.page.ts:3204).
        const bulkLikeShown = includePopups && bulkLikeResult.length >= 4 && result.totalCount >= 20

        if (!ctrl.cancelled) {
          setExtendedCount(extCount)
          if (promo) setMenuPromo(promo)
          if (bulkLikeShown) {
            setBulkLikeCandidates(bulkLikeResult)
            setShowBulkLike(true)
          }
        }

        // One-time popups/stickies (rating, survey, notification-permission, payment-failed) —
        // only on the initial mount, never re-armed by a language-change reload.
        if (includePopups) {
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

          // Angular: ionViewDidEnter() → getNotificationCount(). Feeds both the footer's
          // live like-count badge (#12) and the rating-popup trigger (#9) below.
          if (!ctrl.cancelled) {
            const { comCount } = await fetchNotifCount()
            if (!ctrl.cancelled) {
              const likedYou = comCount.find(c => c.comtype === 'likedyou')
              setLikesCount(Number(likedYou?.newcount ?? 0))
            }

            // "Rate our app" popup (#9) — Angular: passiveRatingPopup(). Skipped when the
            // bulk-like modal already claimed this mount's one popup slot (no modal-stacking),
            // mirroring Angular's SHOW_RATING_POPUP mutual-exclusion.
            if (!ctrl.cancelled && !bulkLikeShown && await shouldShowRatingPopup(comCount)) {
              setShowRatingPopup(true)
              await markRatingPopupShown()
            }
          }

          // Survey popup (#11) — Angular: matches.page.ts:740-743, getSurveydetails():2167-2178.
          // One-time-consume: clear SURVEYPOPUP immediately so it won't fire again without a
          // fresh server flag on a future login (Angular: removeStorageValue('1','SURVEYPOPUP','')).
          if (!ctrl.cancelled && !bulkLikeShown) {
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

      } catch (e) {
        if (__DEV__) console.error('[Matches] load error:', e)
      } finally {
        if (!ctrl.cancelled) setLoading(false)
      }
  }

  useEffect(() => {
    const ctrl = { cancelled: false, notifTimer: undefined as ReturnType<typeof setTimeout> | undefined }
    loadMatches(ctrl, true)
    return () => { ctrl.cancelled = true; clearTimeout(ctrl.notifTimer) }
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

  // ── Pagination ──────────────────────────────────────────────────────────────
  // Angular: doInfinite() → calls callMatchesApi() when scroll reaches end
  async function loadMore() {
    if (loadingMoreRef.current || apiStartRef.current >= totalCount) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const result = await fetchList(apiStartRef.current, 20)
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
        apiStartRef.current += result.items.length
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
    } catch (e) {
      if (__DEV__) console.error('[Matches] like error:', e)
    }
  }

  async function handleDontShow(profile: MatchProfile) {
    if (addPhotoGateActive) { setShowAddPhotoActionPrompt(true); return }
    // Optimistic UI: remove card immediately (matches Angular removeProfile)
    setProfiles(prev => prev.filter(p => p.profileId !== profile.profileId))
    setTotalCount(prev => Math.max(0, prev - 1))
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
    setProfiles(prev => prev.filter(p => p.profileId !== profile.profileId))
    setTotalCount(prev => Math.max(0, prev - 1))
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
  function handleCall(profile: MatchProfile) {
    if (shouldSkipPhoneConfirm(profile.phoneViewed, profile.likedStatus, indNumbersLeft, ownEntryType)) {
      handleContactConfirmYes({ profile, action: 'call' })
    } else {
      setContactConfirm({ profile, action: 'call' })
    }
  }

  function handleWhatsApp(profile: MatchProfile) {
    if (shouldSkipPhoneConfirm(profile.phoneViewed, profile.likedStatus, indNumbersLeft, ownEntryType)) {
      handleContactConfirmYes({ profile, action: 'whatsapp' })
    } else {
      setContactConfirm({ profile, action: 'whatsapp' })
    }
  }

  function handleContactConfirmClose() {
    setContactConfirm(null)
  }

  // Angular button.component.ts:551-583 — the confirmation popup's TostMsg is
  // built from VIEWPHONECONFIRM (the question) + VIEWPHONEDETAIL (the quota
  // footer) concatenated into ONE body, not two separate texts.
  function getContactConfirmContent(): string {
    const question = t('VIEWPROFILE.VIEWPHONECONFIRM')
      .replace('#HISHER#', t(`PRONOUN.${oppGender}.hisher`))
      .replace('#HIMHER#', t(`PRONOUN.${oppGender}.himher`))
    const quota = t('VIEWPROFILE.VIEWPHONEDETAIL')
      .replace('#VAR#', contactQuota.viewed)
      .replace('#VAR1#', contactQuota.left)
      .replace('#VAR2#', contactQuota.expiry)
    return `${question}\n\n${quota}`
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
      navigation.navigate('Gallery')
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
  async function handleContactConfirmYes(override?: { profile: MatchProfile; action: 'call' | 'whatsapp' }) {
    const pending = override ?? contactConfirm
    if (!pending) return
    const { profile, action } = pending
    setContactConfirm(null)
    try {
      const result = await communicationBtnOnClick('matches', action, { MATRIID: profile.profileId })
      if (result.type === 'show_contact') {
        // Angular's Contact Details popup shows Name/Mobile/WhatsApp/Call
        // together regardless of which CTA was tapped — not one-or-the-other.
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
          }))
        }
      } else if (result.type === 'payment_promo') {
        if (action === 'whatsapp') {
          // Confirmation modal first (Figma "Jodii Desktop" node 867:12515) — "Pay now"
          // inside it is what actually navigates to recharge, not this tap.
          setWhatsappPaywallProfile(profile)
        } else {
          navigation.navigate('recharge')
        }
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
        // server-driven from REGISTRATIONARRAYS.PROFILEVERIFYPAID.Shortlist
        // (a cached registration payload). The support-number placeholder is
        // `##CSNUM##` (double-hash, confirmed against 5+ call sites) and it
        // only ever appears in CTA, not CONTENT — communication.service.ts:640-642:
        //   if (data.CTA.includes('##CSNUM##')) data.CTA = data.CTA
        //     .replace(/##CSNUM##/g, localStorage['VERIFIEDBYCALLNUM'] || '')
        //     .replace('+91', '')
        // (An earlier version of this code wrongly applied a replace to
        // CONTENT instead of CTA, using a nonexistent cfg.CSNUM field instead
        // of the real VERIFIEDBYCALLNUM session value.)
        const arrays = await getRegistrationArrays()
        const cfg = arrays?.PROFILEVERIFYPAID?.Shortlist ?? {}
        let cta = String(cfg.CTA ?? 'OK')
        if (cta.includes('##CSNUM##')) {
          const callNum = (await getItem('VERIFIEDBYCALLNUM')) ?? ''
          cta = cta.replace(/##CSNUM##/g, callNum).replace('+91', '')
        }
        setPhoneInfoSheet({
          kind:    'verify_id',
          title:   String(cfg.TITLE ?? 'Verify your profile'),
          content: String(cfg.CONTENT ?? 'Please complete ID verification to view phone numbers.'),
          ctaLabel: cta,
        })
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

  function handleWhatsappPaywallPayNow() {
    setWhatsappPaywallProfile(null)
    navigation.navigate('recharge')
  }

  // ── Bulk-like modal ──────────────────────────────────────────────────────────
  // Angular: openFullpageModal()'s onDidDismiss — reload the matches list from
  // start=0 only when likes were actually sent; a plain close/skip doesn't reload.

  function handleBulkLikeClose() {
    setShowBulkLike(false)
  }

  async function handleBulkLikeSent() {
    setShowBulkLike(false)
    apiStartRef.current = 0
    try {
      const result = await fetchList(0, 20)
      setProfiles(result.items.map(matchProfileAdapter.adapt))
      setBannerSlots(result.bannerSlots)
      setTotalCount(result.totalCount)
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

  // ── Extended matches ("Continue seeing profiles" end-card) ──────────────────
  // Angular: endCardBtnEmit() → getExtendedMatches() → appends profiles +
  // shows the "You are now seeing matches recommended by Jodii" intro banner
  // on the first extended profile (rendered here via a synthetic bannerSlot).

  async function handleLoadExtendedMatches() {
    if (loadingExtended || extendedLoaded) return
    setLoadingExtended(true)
    try {
      const result = await fetchExtendedMatches(0, 20)
      if (result.items.length > 0) {
        const introInsertAt = profiles.length
        setBannerSlots(existing => [...existing, { slot: 'EXTENDED_INTRO', insertAfter: introInsertAt }])
        setProfiles(prev => [...prev, ...result.items.map(matchProfileAdapter.adapt)])
        apiStartRef.current += result.items.length
        setExtendedLoaded(true)
      }
    } catch (e) {
      if (__DEV__) console.error('[Matches] extended matches error:', e)
    } finally {
      setLoadingExtended(false)
    }
  }

  // ── Sticky bottom banner (force-update takes priority over payment-failed —
  // a judgment call, since Angular's two sticky slots don't establish a shared
  // precedence to copy) ───────────────────────────────────────────────────────
  const activeSticky: 'forceUpdate' | 'paymentFailed' | null =
    stickyDismissed ? null : forceUpdateInfo ? 'forceUpdate' : paymentStickyInfo ? 'paymentFailed' : null

  function handleStickyPress() {
    if (activeSticky === 'forceUpdate') {
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
    setStickyDismissed(true)
  }

  async function handleNotificationCta() {
    setShowNotificationPopup(false)
    await requestPushNotificationPermission()
  }

  // Angular: clickOnFilterChip() → applyFilter()/callMatchesApi() — re-queries
  // the list with the toggled quick-filter flag(s), reset to page 0. 'FILTER'
  // isn't a togglable flag itself — it opens the full filter/preferences screen
  // (Angular: type:'searchPage' navigation). Desktop's 'NEARBY' chip has no
  // Angular Matches-quick-filter equivalent (that's the separate explore-by-
  // category flow) — toggling it just clears back to the unfiltered list.
  function quickFilterFor(key: string): QuickFilters | undefined {
    switch (key) {
      case 'PROFILECREATED':     return { profileCreated: true }
      case 'PHOTOAVAILABLE':     return { photoAvailable: true }
      case 'HOROSCOPEAVAILABLE': return { horoscopeAvailable: true }
      default:                   return undefined
    }
  }

  async function applyQuickFilter(key: string) {
    // SearchScreen.tsx's header title/Reset-link/subheader all key off this
    // SAME eventType flag (getFilterEventType()) — without setting it here,
    // it stayed whatever it was last left at (defaulting to 'pp'), so tapping
    // "Filter" from Matches showed the "Partner preferences" header instead of
    // "Filters", even though this tap is the Filter-mode entry point, not PP.
    if (key === 'FILTER') { await setFilterEventType('filter'); navigation.navigate('Search'); return }
    const next = selectedChip === key ? '' : key
    setSelectedChip(next)
    setLoading(true)
    apiStartRef.current = 0
    try {
      const result = await fetchList(0, 20, quickFilterFor(next))
      setProfiles(result.items.map(matchProfileAdapter.adapt))
      setBannerSlots(result.bannerSlots)
      setTotalCount(result.totalCount)
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
      case 3: paymentTrack('31'); navigation.navigate('recharge'); break
      case 4: navigation.navigate('Search');   break
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
            onPress={() => navigation.navigate('Gallery')}
          />
        )
      }
      // BANNERSLOT 1020 — GAM ad banner (Angular: <iframe [src]="gamBannerUrl">)
      if (item.bannerSlot === '1020' && gamParams) {
        return <GamBanner {...gamParams} />
      }
      // BANNERSLOT 1010 — "get ID verified" promo (removed live on ID-verify event)
      if (item.bannerSlot === '1010') {
        return <IdVerifyBanner onPress={() => navigation.navigate('verifyid')} />
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
            onPress={() => navigation.navigate('Gallery')}
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
            onPress={() => navigation.navigate('onboarding', { pageNo: '22' })}
          />
        )
      }
      // BANNERSLOT 1014 — paid-verified-no-photo promo (dynamic), else legacy
      // ADDPROPERTYS fallback (#26) — Angular reuses this slot for two different concepts.
      if (item.bannerSlot === '1014' && paidNoPhotoBanner) {
        return paidNoPhotoBanner.dynamic ? (
          <AddPhotoBanner
            data={paidNoPhotoBanner.data}
            onPress={() => navigation.navigate('Gallery')}
          />
        ) : (
          <SimplePromoBanner
            title={t('MATCHES.ADDPROPERTYS')}
            cta={t('MATCHES.ADDPROPERTYS_CTA')}
            onPress={() => navigation.navigate('onboarding', { pageNo: '28' })}
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
          <SimplePromoBanner
            imageUri={jobsPromo.BANNERIMG}
            title={jobsPromo.TITLE ?? ''}
            cta={jobsPromo.CTA ?? ''}
            onPress={() => { if (jobsUrl) Linking.openURL(jobsUrl) }}
          />
        )
      }
      // Synthetic banner (not a real BANNERSLOT) — inserted locally right where
      // extended-matches profiles begin. Angular: card html ISEXTENDEDMATCHES
      // flag shows this text on the first extended profile.
      if (item.bannerSlot === 'EXTENDED_INTRO') {
        return (
          <Text style={s.extendedIntroText}>{t('MATCHES.SEEINGMATCHES')}</Text>
        )
      }
      return null
  }, [
    menuPromo, addPhotoBannerMatches, gamParams, addPhotoPromoActive, addHoroActive,
    paidNoPhotoBanner, navigation, t,
  ])

  const renderItem: ListRenderItem<MatchListItem> = useCallback(({ item }) => {
    if (isBanner(item)) return renderBannerItem(item)
    return (
      <MatchCard
        profile={item}
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
      />
    )
  }, [
    renderBannerItem, oppGender, ownEntryType, femaleFreeEligible,
    indNumbersLeft, navigation, handleLike, handleDontShow, handleViewLater, handleCall,
    handleWhatsApp, profileIds,
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
          onLanguagePress={() => navigation.navigate('LanguageSelection')}
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
          onEditPreferences={() => navigation.navigate('Search')}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          selectedChip={selectedChip}
          onChipSelect={applyQuickFilter}
          addPhotoBannerMatches={addPhotoBannerMatches}
          onActivateProfile={() => navigation.navigate('Gallery')}
        />
        {activeSticky && (
          <StickyBanner
            text={activeSticky === 'forceUpdate' ? t('APP_UPDATE.NOTE') : paymentStickyInfo!.content}
            ctaLabel={activeSticky === 'forceUpdate' ? t('APP_UPDATE.CTA') : paymentStickyInfo!.ctaLabel}
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
          visible={showPhotoBulkLikePrompt}
          type="photoBulkLike"
          data={{
            title:         t('MATCHES.BULK_LIKE_TITLE_1').replace(/<br\s*\/?>/gi, ' '),
            ctaLabel:      t('MATCHES.ADD_PHOTO'),
            linkCtaLabel:  t('MATCHES.LATER_CTA'),
            showClose:     false,
          }}
          onClose={handleBulkLikePhotoPromptDismiss}
          onPrimaryPress={() => { setShowPhotoBulkLikePrompt(false); navigation.navigate('Gallery'); handleBulkLikeSent() }}
          onLinkPress={handleBulkLikePhotoPromptDismiss}
        />
        <BottomSheet
          visible={showNotificationPopup}
          type="enableNotification"
          data={{
            title:    t('PN_SETTINGS.HEADER'),
            content:  t('PN_SETTINGS.BODY'),
            ctaLabel: t('PN_SETTINGS.CTA'),
          }}
          onClose={() => setShowNotificationPopup(false)}
          onPrimaryPress={handleNotificationCta}
        />
        <AppRatingModal visible={showRatingPopup} onClose={() => setShowRatingPopup(false)} />
        <SurveyPopup visible={!!surveyData} data={surveyData} onClose={() => setSurveyData(null)} />
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
          onPrimaryPress={() => { setShowAddPhotoActionPrompt(false); navigation.navigate('Gallery') }}
        />
        <WhatsAppPaywallModal
          visible={!!whatsappPaywallProfile}
          profile={whatsappPaywallProfile}
          oppGender={oppGender}
          onClose={() => setWhatsappPaywallProfile(null)}
          onPayNow={handleWhatsappPaywallPayNow}
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
        headerAnim={headerAnim}
        loading={loading}
        totalCount={totalCount}
        langCode={i18n.language}
        selectedChip={selectedChip}
        onChipSelect={applyQuickFilter}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
        onEditPreferences={() => navigation.navigate('Search')}
        onHeaderLayout={handleHeaderLayout}
        onTitleLayout={handleTitleLayout}
        facets={facets}
        onFacetToggle={toggleFacet}
        onFacetsApply={applyFacetSelection}
        titleOverride={exploreLabel}
        isExploreMode={!!exploreType}
      />

      {/* ── Profile list / loader ──────────────────────────────────────────── */}
      {/* Angular: app-loader while !contentLoaded, cdk-virtual-scroll-viewport when loaded */}
      {loading ? (
        <View style={[s.loaderBox, { paddingTop: headerH }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : totalCount === 0 ? (
        <View style={{ flex: 1, paddingTop: headerH }}>
          <NoMatchesCard onPress={() => navigation.navigate('Search')} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={listData}
          keyExtractor={item => isBanner(item) ? item.uid : item.profileId}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: headerH, paddingBottom: 8 }}
          onScroll={handleScroll}
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
                onPress={() => navigation.navigate(heroBannerTarget)}
              />
            ) : null
          }
          ListFooterComponent={
            loadingMore || loadingExtended
              ? <ActivityIndicator size="small" color={Colors.primary} style={s.footerLoader} />
              : extendedCount > 0 && !extendedLoaded
                ? <ExtendedMatchesCard count={extendedCount} onPress={handleLoadExtendedMatches} />
                : null
          }
        />
      )}

      {/* ── Sticky bottom banner (payment-failed retry / force-update) ──────── */}
      {activeSticky && (
        <StickyBanner
          text={activeSticky === 'forceUpdate' ? t('APP_UPDATE.NOTE') : paymentStickyInfo!.content}
          ctaLabel={activeSticky === 'forceUpdate' ? t('APP_UPDATE.CTA') : paymentStickyInfo!.ctaLabel}
          onPress={handleStickyPress}
          onClose={handleStickyClose}
          {...(activeSticky === 'paymentFailed' ? { countdownDeadlineMs: paymentStickyInfo!.deadlineMs } : {})}
        />
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <AppFooter
        activeTab={1}
        likesCount={likesCount}
        upgradeTag="₹200 OFF"
        onTabPress={handleTabPress}
      />

      <BulkLikeModal
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
          showClose:     false,
        }}
        onClose={handleBulkLikePhotoPromptDismiss}
        onPrimaryPress={() => { setShowPhotoBulkLikePrompt(false); navigation.navigate('Gallery'); handleBulkLikeSent() }}
        onLinkPress={handleBulkLikePhotoPromptDismiss}
      />
      <BottomSheet
        visible={showNotificationPopup}
        type="enableNotification"
        data={{
          title:    t('PN_SETTINGS.HEADER'),
          content:  t('PN_SETTINGS.BODY'),
          ctaLabel: t('PN_SETTINGS.CTA'),
        }}
        onClose={() => setShowNotificationPopup(false)}
        onPrimaryPress={handleNotificationCta}
      />
      <AppRatingModal visible={showRatingPopup} onClose={() => setShowRatingPopup(false)} />
      <SurveyPopup visible={!!surveyData} data={surveyData} onClose={() => setSurveyData(null)} />
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
        onPrimaryPress={() => { setShowAddPhotoActionPrompt(false); navigation.navigate('Gallery') }}
      />
      <WhatsAppPaywallModal
        visible={!!whatsappPaywallProfile}
        profile={whatsappPaywallProfile}
        oppGender={oppGender}
        onClose={() => setWhatsappPaywallProfile(null)}
        onPayNow={handleWhatsappPaywallPayNow}
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
      {/* AppFooter's tab bar is 56px tall (+ its own safe-area padding) — the
          Toast's default 24px clearance alone left it overlapping the footer. */}
      <Toast request={toastRequest} bottomOffset={56 + 16} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: Colors.white },
  loaderBox:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footerLoader: { marginVertical: 16 },
  extendedIntroText: {
    fontFamily:        'Poppins-SemiBold',
    fontSize:          18,
    color:             Colors.black,
    textAlign:         'center',
    paddingHorizontal: 16,
    paddingVertical:   24,
  },
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

  // Angular: img-holder pl-16 pr-16 with brdr-radius (top-left + top-right radius 16)
  photoBox: {
    marginHorizontal: 16,
    borderTopLeftRadius:  16,
    borderTopRightRadius: 16,
    overflow:         'hidden',
    backgroundColor:  Colors.divider,
  },
  singlePhotoPressable: { width: '100%', height: '100%' },

  // Angular no-photo placeholder
  noPhoto:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  noPhotoIcon: { width: 56, height: 56, opacity: 0.35 },
  noPhotoText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.textMuted },

  // Angular: .newly-joined posabsolute — uses newly-joined.svg as bg, top-left of photo
  newBadge: {
    position:      'absolute',
    top:           0,
    left:          0,
    flexDirection: 'row',
    alignItems:    'center',
    backgroundColor: Colors.primaryDark,
    paddingVertical:   4,
    paddingLeft:       12,
    paddingRight:      20,
    borderBottomRightRadius: 12,
    gap: 4,
  },
  newBadgeText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   12,
    color:      Colors.white,
  },

  // Angular: isActivityLabel row — viewed-icon + LabelText below liked strip
  activityRow: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    marginTop:        16,
    paddingHorizontal: 16,
    gap:              8,
  },
  activityText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      Colors.black,
    flex:       1,
  },

  // Angular: getContentAfterLike() text above Send Interest CTA
  afterLikeText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
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
    width:             '80%',
    gap:               12,
  },
  overlayText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   13,
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
  waBtnText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   13,
    color:      Colors.white,
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
  likedText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.likedStripText },

  // Angular: d-flex align-center-item mt-12 pl-16 pr-16
  nameRow: {
    flexDirection:    'row',
    alignItems:       'center',
    marginTop:        12,
    paddingHorizontal: 16,
    gap:              12,
  },
  // Figma: #000000
  name:       { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: '#000000' },
  iconBtn:    { flexShrink: 0 },
  nameRowIcon:  { width: 24, height: 24 },
  nameRowIconWa:{ width: 28, height: 28 },
  // Figma: 24x24 circle, white fill, 1px #006c48 border
  callIconCircle: {
    width:           24,
    height:          24,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     '#006c48',
    backgroundColor: Colors.white,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Angular: body2-regular-14 mt-2 pl-16 pr-16 bv-minht text-space
  // Figma: solid #000000; the "|" separators alone drop to 20% opacity
  basicView: {
    fontFamily:       'Poppins-Regular',
    fontSize:         14,
    color:            '#000000',
    lineHeight:       20,
    marginTop:        4,
    paddingHorizontal: 16,
    minHeight:        40,
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
  viewProfileText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
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
  ctaDontShowText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#545454' },

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
  ctaViewLaterText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#545454' },

  // Angular: FUNC.disableDontShow()/disableViewLater() — dimmed, non-tappable once
  // the action was already taken on a profile that reappears in a re-fetched list.
  ctaDisabled: { opacity: 0.4 },

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
  ctaLikeText: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.white },

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
  ctaSendInterestIconBox: {
    width:          20,
    height:         20,
    flexShrink:     0,
    alignItems:     'center',
    justifyContent: 'center',
  },
  ctaSendInterestText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
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
  freeBadgeText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   10,
    color:      Colors.badgeNewText,
  },
  contactsLeftText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   11,
    color:      Colors.textSecondary,
    textAlign:  'center',
    marginTop:  8,
  },
})


// Angular: app-end-card [cardType]="'view-more'" styles
const e = StyleSheet.create({
  card: {
    backgroundColor:  Colors.white,
    marginHorizontal: 16,
    marginVertical:   24,
    borderRadius:     16,
    padding:          24,
    alignItems:       'center',
    shadowColor:      Colors.shadow,
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.08,
    shadowRadius:     8,
    elevation:        3,
  },
  // 3 overlapping avatar circles + 1 count badge
  avatarRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  16,
  },
  avatarCircle: {
    width:        52,
    height:       52,
    borderRadius: 26,
    overflow:     'hidden',
    borderWidth:  2,
    borderColor:  Colors.white,
    backgroundColor: Colors.divider,
  },
  avatarImg: { width: '100%', height: '100%' },
  countCircle: {
    width:           52,
    height:          52,
    borderRadius:    26,
    borderWidth:     2,
    borderColor:     Colors.white,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  countNum:   { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: Colors.white, lineHeight: 16 },
  countLabel: { fontFamily: 'Poppins-Regular',  fontSize: 10, color: Colors.white, lineHeight: 13 },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   18,
    color:      Colors.extendedCardTitle,
    textAlign:  'center',
    marginBottom: 8,
  },
  desc: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      Colors.textSecondary,
    textAlign:  'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  progressTrack: {
    width:           '100%',
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.borderSubtle,
    overflow:        'hidden',
  },
  progressFill: {
    width:           '60%',
    height:          '100%',
    borderRadius:    2,
    backgroundColor: Colors.primary,
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
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   16,
    color:      Colors.black,
    lineHeight: 22,
  },
  // Angular: mt-8 body3-regular-12 black-color
  body: {
    fontFamily: 'Poppins-Regular',
    fontSize:   12,
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
  ctaText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   14,
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
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   22,
    color:      Colors.black,
    lineHeight: 32,
  },
  // Angular: body1-medium-14 black-color
  subheader: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
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
    fontSize:   14,
    color:      Colors.borderNeutral,
    lineHeight: 22,
    flexShrink: 0,
  },
  // Angular: body2-regular-14 black-color
  bulletText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
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
  ctaText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   14,
    color:      Colors.white,
  },
})

// Membership banner (MembershipBanner) and its styles now live in
// components/matches/MembershipBanner.tsx — extracted for reuse by ViewProfileScreen.

