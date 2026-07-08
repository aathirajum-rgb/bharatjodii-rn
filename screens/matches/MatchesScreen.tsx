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
  WhatsAppIcon, CallIcon, CloseIcon, ViewLaterIcon, LikeIcon,
  HtmlText, buildBasicViewParts, showLikeCTA, showAfterLikeCTA,
  getBlurPhotoUri, NEWLY_JOINED_STAR_URI, ProfileBadge,
  PhotoSwiper,
  getAfterLikeCtaLabel, getAfterLikeCtaIcon, getAfterLikeContentText, showContactsLeftBanner, showFreeBadge,
  disableDontShow, disableViewLater,
  type AfterLikeCtx,
} from '../../components/matches/matchesCard.shared'
import MatchesDesktopLayout from './MatchesDesktopLayout'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { matchProfileAdapter } from '../../adapters/matches.adapter'
import type { MatchProfile, BannerItem, MatchListItem } from '../../types/interfaces/matches.interface'
import { EEndCardText } from '../../types/enums/common.enum'
import {
  fetchMatches,
  fetchExplore,
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
} from '../../service/communicationService'
import { fetchBulkLikeMatches } from '../../service/profileService'
import { getHeroBannerDetails } from '../../service/paymentService'
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

function isBanner(item: MatchListItem): item is BannerItem {
  return (item as BannerItem)._isBanner === true
}

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
const MatchCard = memo(function MatchCard({
  profile, oppGender, photoLockActive, ownEntryType, femaleFreeEligible, indNumbersLeft,
  onPress, onLike, onDontShow, onViewLater, onCall, onWhatsApp, onAddPhotoPrompt,
}: {
  profile:    MatchProfile
  oppGender:  'M' | 'F'
  photoLockActive: boolean
  ownEntryType:       string
  femaleFreeEligible: boolean
  indNumbersLeft:     string
  onPress:    () => void
  onLike:     () => void
  onDontShow: () => void
  onViewLater:() => void
  onCall:     () => void
  onWhatsApp: () => void
  onAddPhotoPrompt: () => void
}) {
  const { t } = useTranslation()
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
  }

  return (
    <View style={c.card}>

      {/* ── Photo section ──────────────────────────────────────────────────── */}
      {/* Angular: app-photo-new — top border radius 16px */}
      <View style={[c.photoBox, { height: PHOTO_H }]}>
        {hasRealPhoto ? (
          // Normal: actual photo(s) — swiper when >1, single Pressable image otherwise.
          // Angular: matches-card.component's Swiper, femaleFreeContactRestrict() lock slide.
          <PhotoSwiper
            images={profile.photos}
            width={SW - 32}
            height={PHOTO_H}
            onPress={onPress}
            renderLockSlide={photoLockActive ? (index) => index !== 0 ? (
              <Pressable style={c.lockCard} onPress={onAddPhotoPrompt}>
                <CdnSvg uri={CDN + 'add-photo-lock.svg'} width={48} height={48} />
                <Text style={c.lockText}>
                  {t('MATCHES.ADD_PHOTO_TO_VIEW').replace('##HIS_HER##', oppGender === 'F' ? 'her' : 'his')}
                </Text>
                <View style={c.lockCta}>
                  <CdnSvg uri={CDN + 'add-photo-gallery.svg'} width={16} height={16} />
                  <Text style={c.lockCtaText}>{t('GENERAL.ADD_PHOTO_TXT')}</Text>
                </View>
              </Pressable>
            ) : null : undefined}
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
                    .replace(/##HE_SHE##/g, oppGender === 'F' ? 'She' : 'He')
                    .replace(/##HIS_HER##/g, oppGender === 'F' ? 'her' : 'his')
                    .replace(/##he_she##/g, oppGender === 'F' ? 'she' : 'he')}
                </Text>
                {!hiddenPhotoPending && (
                  <Pressable style={c.waBtn} onPress={onLike}>
                    <LikeIcon width={16} height={16} />
                    <Text style={c.waBtnText}>{t('GENERAL.LIKE_CTA').replace('#HER_HIM#', '').trim()}</Text>
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
                  {t('GENERAL.REQUEST_ADD_PHOTO_WHATSAPP').replace('#HER_HIS#', oppGender === 'F' ? 'her' : 'his')}
                </Text>
                <Pressable style={c.waBtn} onPress={onWhatsApp}>
                  <WhatsAppIcon width={18} height={18} />
                  <Text style={c.waBtnText}>{t('GENERAL.WHATSAPP')}</Text>
                </Pressable>
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
      {/* Angular: .liked-profile — pink gradient strip below badges */}
      {!!profile.likedDateText && profile.likedStatus === '1' && (
        <View style={c.likedStrip}>
          <CdnSvg uri={CDN + 'liked-new.svg'} width={20} height={20} />
          <Text style={c.likedText} numberOfLines={1}>{profile.likedDateText}</Text>
        </View>
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
      {/* Angular: app-button-revamp [buttonType]="link" — "View profile →" */}
      <Pressable onPress={onPress} style={c.viewProfileBtn}>
        <Text style={c.viewProfileText}>{t('MATCHES.VIEW_PROFILE_CTA')}</Text>
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

// ─── Membership Banner (BANNERSLOT 1001) ─────────────────────────────────────
// Angular: app-breather [bannerContent]="payBannerContent.MATCHESSLOT"
// Renders the festival/membership offer card mid-list (e.g. "Muhurtham Day Offer!")
// Layout: background image (BGIMG), title, subtitle/offer tag, benefits list, CTA button

// Angular: app-breather PAYMENT type (BANNERSLOT 1001) — festival/membership offer card.
// Figma (file GqYHfj2jHlbhNFKoYQ0W8H, node 9737:16600 "Jodii - Festival Offer Banner")
// confirms this card is themed per-campaign (Ramadan green, generic pink/red, etc.) —
// background art, CTA color, pill border/fill all vary by campaign and are server-driven
// (BGIMG/CTABGCOLOR/OFFERTAG); only the LAYOUT below (sizes/weights/gaps/radii) is fixed
// across campaigns and is what this component hardcodes.
//
// Angular: [ngStyle]="{'background': bannerContent?.BGIMG ? 'url(...)' : ''}" on the
// WHOLE card — BGIMG is a full-bleed background (the campaign artwork, e.g. the
// moon+mosque illustration), not a small right-anchored inset image.
function parseCssColor(style: string | undefined, prop: string): string | undefined {
  if (!style) return undefined
  return style.match(new RegExp(`${prop}[^:;]*:[^;]*?(#[0-9a-fA-F]{3,8})`, 'i'))?.[1]
}

// Angular sometimes sends a CSS class-name token ('primaryBg'/'whiteColor') instead of
// a real hex for CTABGCOLOR/CTACOLOR — RN can't resolve a class name, so it silently
// fails to apply it (the text/button just falls back to its inherited default color
// instead of the intended one). Anything that isn't a real #hex is treated as unresolved.
function resolveCtaBg(v: string | undefined): string {
  return v && v.startsWith('#') ? v : Colors.primaryDark
}
function resolveCtaTextColor(v: string | undefined): string {
  return v && v.startsWith('#') ? v : Colors.white
}

function MembershipBanner({ data, onPress }: { data: any; onPress: () => void }) {
  if (!data) return null

  const stripHtml = (s: string) => s?.replace(/<[^>]*>/g, '') ?? ''
  const cta = stripHtml(data.CTA ?? 'Get Membership')
  const valid = stripHtml(data.VALID ?? data.FCONTENT ?? '')
  const benefits: Array<{ IMG?: string; VALUE?: string }> = Array.isArray(data.BENEFITS) ? data.BENEFITS : []
  const isWhite = data.FONTCOLOR === 'white-color'
  const textColor = isWhite ? Colors.white : Colors.textStrong
  // Figma: pill is a light gradient fill + 1px border, both campaign-colored (Ramadan:
  // #218441/mint-green) — RN can't do the two-stop gradient cheaply here, so we take a
  // flat approximation from OFFERTAG's background color instead (accepted simplification).
  const validBg     = parseCssColor(data.OFFERTAG, 'background') ?? '#FFF3CD'
  const validBorder = parseCssColor(data.OFFERTAG, 'border') ?? validBg

  return (
    <Pressable style={mb.card} onPress={onPress}>
      {/* Full-bleed campaign background art (Angular: background: url(BGIMG) on the whole card) */}
      {!!data.BGIMG && (
        <Image source={{ uri: data.BGIMG }} style={mb.bgImg} resizeMode="cover" />
      )}

      <View style={mb.content}>
        {/* TITLEIMG is an SVG logo/icon — CdnSvg (not plain Image) so it decodes on native */}
        {!!data.TITLEIMG && (
          <CdnSvg uri={data.TITLEIMG} width={140} height={28} style={mb.titleImg} />
        )}

        {/* Title — plain text. Angular's [innerHTML] title has no forced single-line/
            ellipsis styling — it just wraps naturally if genuinely too narrow, so we
            don't force numberOfLines here either. (adjustsFontSizeToFit was tried but
            doesn't work on React Native Web — it silently no-ops there, so numberOfLines={1}
            alone just truncated the text with "..." instead of shrinking to fit.) */}
        {!!data.TITLE && (
          <Text style={[mb.title, { color: textColor }]}>
            {stripHtml(data.TITLE)}
          </Text>
        )}

        {/* Festival subtitle */}
        {!!data.FESTIVALSUBTITLE && (
          <HtmlText html={data.FESTIVALSUBTITLE} style={[mb.subtitle, { color: textColor }]} />
        )}

        {/* Subtitle — "Get up to <span>₹200 OFF</span> on paid membership!" — Angular gives
            the amount span its own CSS class (heading-semibold, bigger size) rather than an
            inline style; spanStyle reproduces that visual emphasis regardless of markup. */}
        {!!data.SUBTITLE && (
          <HtmlText
            html={data.SUBTITLE}
            style={[mb.subtitle, { color: textColor }]}
            spanStyle={mb.subtitleAmount}
          />
        )}

        {/* Validity / timer pill — ribbon shape: rounded left corners only, no right border
            (Angular: border-t/border-b/border-l but no border-r, rounded-tl/rounded-bl only) */}
        {!!valid && (
          <Text style={[mb.valid, { backgroundColor: validBg, borderColor: validBorder, color: isWhite ? Colors.white : '#000000' }]}>
            {valid}
          </Text>
        )}

        {/* Benefits list with icons */}
        {benefits.length > 0 && (
          <View style={mb.benefitsList}>
            {benefits.slice(0, 4).map((b, i) => (
              <View key={i} style={mb.benefitRow}>
                {/* Tick icon is an SVG (Figma "Tick" node) — CdnSvg so it decodes on native */}
                {!!b.IMG && (
                  <CdnSvg uri={b.IMG} width={20} height={20} style={mb.benefitIcon} />
                )}
                <Text style={[mb.benefitText, { color: textColor }]} numberOfLines={2}>
                  {stripHtml(b.VALUE ?? '')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* CTA button */}
        <Pressable
          style={[mb.ctaBtn, { backgroundColor: resolveCtaBg(data.CTABGCOLOR) }]}
          onPress={onPress}
        >
          <Text style={[mb.ctaText, { color: resolveCtaTextColor(data.CTACOLOR) }]}>{cta}</Text>
        </Pressable>
      </View>
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
  const exploreType  = route?.params?.exploreType as string | undefined
  const exploreLabel = route?.params?.exploreLabel as string | undefined
  const [facets,  setFacets]  = useState<ExploreFacet[]>([])
  const [qSearch, setQSearch] = useState('')

  async function fetchList(start: number, limit: number, quickFilters?: QuickFilters) {
    return exploreType
      ? fetchExplore(exploreType, start, limit, qSearch)
      : fetchMatches(start, limit, quickFilters)
  }

  // ── State ───────────────────────────────────────────────────────────────────
  const [profiles,     setProfiles]     = useState<MatchProfile[]>([])
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

  // ── Photo carousel lock screen (female, zero own photos) ────────────────────
  const [ownPhotoLockActive, setOwnPhotoLockActive] = useState(false)
  const [showAddPhotoPrompt, setShowAddPhotoPrompt] = useState(false)

  // ── "Add your photo" action gate (Like/Don't-show) ──────────────────────────
  // Angular: button.service.ts checkAddPhotoPromotion() — blocks these two actions
  // (not Call/WhatsApp/View-later) when PROFILEPUBLISHEDFLAG=='0' and one of three
  // sub-conditions applies. Content is server-driven (REGISTRATIONARRAYS.PHOTOPUBLISHED.Call).
  const [addPhotoGateActive, setAddPhotoGateActive] = useState(false)
  const [addPhotoActionPromoContent, setAddPhotoActionPromoContent] = useState<any>(null)
  const [showAddPhotoActionPrompt, setShowAddPhotoActionPrompt] = useState(false)

  // ── Toast (View Later / Don't Show confirmation) ─────────────────────────────
  const [toastRequest, setToastRequest] = useState<ToastRequest | null>(null)
  function showToast(message: string) {
    setToastRequest({ message, key: Date.now() })
  }

  // ── Live footer like-count badge ────────────────────────────────────────────
  const [likesCount, setLikesCount] = useState(0)

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
        // Read login gender once — determines which blur placeholder to show on photo cards
        const lg = await getItem(StorageKeys.User.LOGIN_GENDER)
        setOppGender(lg === 'F' ? 'M' : 'F')
        setLoginGender(lg === 'M' ? 'M' : 'F')

        // Photo lock screen (#15) — Angular: femaleFreeContactRestrict() (matches-card.component.ts:424-428)
        const ownPhotoCount = Number((await getItem('PHOTOCOUNT')) ?? '0')
        if (!ctrl.cancelled) setOwnPhotoLockActive(lg === 'F' && ownPhotoCount === 0)

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
            const [entryType, reg, femaleFreeRaw, horoAvailable, contactDetail, ekycStatus] = await Promise.all([
              getSessionValue('ENTRYTYPE'),
              getRegistrationArrays(),
              getSessionValue('FEMALEFREECONACT'),
              getSessionValue('HOROSCOPEAVAILABLE'),
              getJson<Record<string, any>>('CONTACT_DETAIL'),
              getItem('PI_EKYCSTATUS'),
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
              // isn't written anywhere in this port yet (no phone-view-details flow ported),
              // so this reads '0' until that's built — wired correctly, dormant for now.
              setIndNumbersLeft(String(contactDetail?.IndNumbersLeft ?? '0'))

              // BANNERSLOT 1011 — add-photo generic promo (#26)
              setAddPhotoPromoActive(!['P', 'Y'].includes(photoStatus))

              // BANNERSLOT 1012 — add-horoscope promo (#26)
              setAddHoroActive(horoAvailable !== '1')
            }

            // BANNERSLOT 1014 — paid-verified-no-photo promo, or legacy ADDPROPERTYS
            // fallback (#26). Angular: check_Paid_Verified_Nophoto().
            const isPaidVerifiedMale = entryType === 'P' && ekycStatus === '1' && lg === 'M' && photoStatus !== 'Y'
            if (!ctrl.cancelled && isPaidVerifiedMale) {
              setPaidNoPhotoBanner(
                reg?.PHOTOPUBLISHPAID?.Matches
                  ? { dynamic: true, data: reg.PHOTOPUBLISHPAID.Matches }
                  : { dynamic: false }
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
              // BANNERSLOT 1013 inline banner — PHOTOPUBLISHED.Matches
              if (reg?.PHOTOPUBLISHED?.Matches) {
                setAddPhotoBannerMatches(reg.PHOTOPUBLISHED.Matches)
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
              const nonIdVerifyUserGate = entryType === 'P' && lg === 'M' && ekycStatus !== '1'
              if (!ctrl.cancelled) {
                setAddPhotoGateActive(flagOk && ((typeOk && freeOk) || isPaidVerifiedMale || nonIdVerifyUserGate))
                setAddPhotoActionPromoContent(reg?.PHOTOPUBLISHED?.Call ?? null)
              }

              if (flagOk && typeOk && freeOk) {
                applyHeroBanner(reg?.PHOTOPUBLISHED?.Banner ?? {}, 'Gallery')
              } else if (reg?.PROFILEVERIFYPAID?.Banner && ekycStatus !== '1') {
                applyHeroBanner(reg.PROFILEVERIFYPAID.Banner, 'verifyid')
              } else if (reg?.PHOTOPUBLISHPAID?.Banner && isPaidVerifiedMale) {
                applyHeroBanner(reg.PHOTOPUBLISHPAID.Banner, 'Gallery')
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
    if (loadingMore || apiStartRef.current >= totalCount) return
    setLoadingMore(true)
    try {
      const result = await fetchList(apiStartRef.current, 20)
      if (result.items.length > 0) {
        setProfiles(prev => {
          const offset = prev.length
          if (result.bannerSlots.length > 0) {
            setBannerSlots(existing => [
              ...existing,
              ...result.bannerSlots.map(bs => ({ slot: bs.slot, insertAfter: bs.insertAfter + offset })),
            ])
          }
          return [...prev, ...result.items.map(matchProfileAdapter.adapt)] as MatchProfile[]
        })
        apiStartRef.current += result.items.length
      }
    } catch (e) {
      if (__DEV__) console.error('[Matches] load more error:', e)
    } finally {
      setLoadingMore(false)
    }
  }

  // ── Profile action handlers ─────────────────────────────────────────────────
  // All use communicationBtnOnClick → same params as Angular communicationBtnOnClick

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

  async function handleCall(profile: MatchProfile) {
    try {
      const result = await communicationBtnOnClick('matches', 'call', { MATRIID: profile.profileId })
      if (result.type === 'show_contact' && result.contact) {
        Linking.openURL(`tel:${result.contact}`)
      } else if (result.type === 'payment_promo') {
        navigation.navigate('recharge')
      }
      // verify_id / female_free → future bottom sheet
    } catch (e) {
      if (__DEV__) console.error('[Matches] call error:', e)
    }
  }

  async function handleWhatsApp(profile: MatchProfile) {
    try {
      const result = await communicationBtnOnClick('matches', 'whatsapp', { MATRIID: profile.profileId })
      if (result.type === 'show_contact' && result.contact) {
        const num = result.contact.replace(/\D/g, '')
        if (num) Linking.openURL(`https://wa.me/${num}`)
      } else if (result.type === 'payment_promo') {
        navigation.navigate('recharge')
      }
    } catch (e) {
      if (__DEV__) console.error('[Matches] whatsapp error:', e)
    }
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
    if (key === 'FILTER') { navigation.navigate('Search'); return }
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
      case 3: navigation.navigate('recharge'); break
      case 4: navigation.navigate('Search');   break
    }
  }

  const renderItem: ListRenderItem<MatchListItem> = useCallback(({ item }) => {
    if (isBanner(item)) {
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
    }
    return (
      <MatchCard
        profile={item}
        oppGender={oppGender}
        photoLockActive={ownPhotoLockActive}
        ownEntryType={ownEntryType}
        femaleFreeEligible={femaleFreeEligible}
        indNumbersLeft={indNumbersLeft}
        onPress={() => navigation.navigate('viewprofile', { id: item.profileId })}
        onLike={() => handleLike(item)}
        onDontShow={() => handleDontShow(item)}
        onViewLater={() => handleViewLater(item)}
        onCall={() => handleCall(item)}
        onWhatsApp={() => handleWhatsApp(item)}
        onAddPhotoPrompt={() => setShowAddPhotoPrompt(true)}
      />
    )
  }, [
    menuPromo, addPhotoBannerMatches, gamParams, addPhotoPromoActive, addHoroActive,
    paidNoPhotoBanner, oppGender, ownPhotoLockActive, ownEntryType, femaleFreeEligible,
    indNumbersLeft, navigation, handleLike, handleDontShow, handleViewLater, handleCall,
    handleWhatsApp, t,
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
          profiles={profiles}
          oppGender={oppGender}
          onProfilePress={p => navigation.navigate('viewprofile', { id: p.profileId })}
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
        <BottomSheet
          visible={showAddPhotoPrompt}
          type="addPhotoPrompt"
          data={{
            title:    t('MATCHES.ADD_PHOTO_TO_VIEW').replace('##HIS_HER##', oppGender === 'F' ? 'her' : 'his'),
            ctaLabel: t('GENERAL.ADD_PHOTO_TXT'),
          }}
          onClose={() => setShowAddPhotoPrompt(false)}
          onPrimaryPress={() => { setShowAddPhotoPrompt(false); navigation.navigate('Gallery') }}
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
      <BottomSheet
        visible={showAddPhotoPrompt}
        type="addPhotoPrompt"
        data={{
          title:    t('MATCHES.ADD_PHOTO_TO_VIEW').replace('##HIS_HER##', oppGender === 'F' ? 'her' : 'his'),
          ctaLabel: t('GENERAL.ADD_PHOTO_TXT'),
        }}
        onClose={() => setShowAddPhotoPrompt(false)}
        onPrimaryPress={() => { setShowAddPhotoPrompt(false); navigation.navigate('Gallery') }}
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
      <Toast request={toastRequest} />
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

  // ── Female-free-photo-restrict lock slide (Angular: femaleFreeContactRestrict) ──
  lockCard: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    backgroundColor:   Colors.surfaceDim,
    paddingHorizontal: 24,
    gap:               10,
  },
  lockText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      Colors.textDark,
    textAlign:  'center',
  },
  lockCta: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   Colors.primaryDark,
    borderRadius:      8,
    paddingVertical:   8,
    paddingHorizontal: 16,
    marginTop:         4,
  },
  lockCtaText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   13,
    color:      Colors.white,
  },

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
  },
  overlayText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   13,
    color:      Colors.white,
    textAlign:  'center',
    lineHeight: 18,
  },
  // Angular: EButtonBackground.whatsApp — green WhatsApp CTA
  waBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.whatsappGreen,
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

  // Angular: .liked-profile — pink gradient strip with heart icon + date text
  likedStrip: {
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: 16,
    marginTop:        8,
    borderRadius:     50,
    backgroundColor:  Colors.likedStripBg,
    paddingHorizontal: 8,
    paddingVertical:   4,
    gap:              4,
  },
  likedIcon: { width: 20, height: 20, flexShrink: 0 },
  likedText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.likedStripText, flex: 1 },

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
    paddingHorizontal: 16,
    paddingVertical:   8,
  },
  viewProfileText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      Colors.primary,
  },

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

// ─── Membership banner styles ────────────────────────────────────────────────
// Angular: app-breather PAYMENT type — matches-breather-block with BGIMG background

const mb = StyleSheet.create({
  // Angular: matches-breather-block — background: url(BGIMG) covers the WHOLE card
  card: {
    backgroundColor:   Colors.membershipCardBg,
    borderBottomWidth: 8,
    borderBottomColor: Colors.borderSubtle,
    minHeight:         220,
    overflow:          'hidden',
  },
  bgImg: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    bottom:   0,
  },
  // Figma content top/padding — but NOT a maxWidth: that 283 figure came from measuring
  // one screenshot ("Ramadan Offer", 13 chars) and was too tight for longer titles like
  // "Become a paid member" (21 chars), wrapping it to 2 lines. bgImg is a full-bleed
  // background (the campaign art), not a competing right column, so text can use the
  // full card width minus padding.
  content: {
    paddingHorizontal: 24,
    paddingTop:        38,
    paddingBottom:     24,
  },
  titleImg: {
    width:        140,
    height:       28,
    marginBottom: 8,
  },
  // Angular: breather.component.html:38 — heading1-semibold-22 (English/most languages),
  // heading2-semibold-18 for tm/ml. 22px, not 24 — that was from a different Figma node.
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   22,
    color:      Colors.textStrong,
    lineHeight: 24,
  },
  // Figma: "on paid membership!" line — 14px Poppins-Medium, tracking 0.28
  subtitle: {
    fontFamily:    'Poppins-Medium',
    fontSize:      14,
    color:         Colors.textDark,
    marginTop:     8,
    lineHeight:    20,
    letterSpacing: 0.28,
  },
  // Figma: the "₹200 OFF" span specifically — 24px Poppins-SemiBold (vs. the 14/16px
  // surrounding copy) — applied via HtmlText's spanStyle regardless of server markup
  subtitleAmount: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   24,
  },
  // Figma: ribbon pill — 14px Poppins-Regular, h-24 (py-4), rounded left corners only,
  // border on top/bottom/left but NOT right (open ribbon edge, not a closed pill).
  // Angular: breather.component.scss .offerTag { margin-top: 10px } (English)
  valid: {
    fontFamily:              'Poppins-Regular',
    fontSize:                14,
    lineHeight:              20,
    marginTop:               10,
    paddingHorizontal:       8,
    paddingVertical:         4,
    borderWidth:             1,
    borderRightWidth:        0,
    borderTopLeftRadius:     4,
    borderBottomLeftRadius:  4,
    alignSelf:               'flex-start',
  },
  // Angular: breather.component.scss .benefits { margin-top: 16px } (English);
  // gap-[12px] between individual rows matches Figma + Angular's .benefitItem margin-top
  benefitsList: {
    marginTop: 16,
    gap:       12,
  },
  // Figma: gap-[8px] between tick and text
  benefitRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
  },
  // Figma: Tick is 20×20
  benefitIcon: {
    width:      20,
    height:     20,
    flexShrink: 0,
  },
  // Figma: 14px Poppins-Medium (not Regular/13)
  benefitText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      Colors.textDark,
    flex:       1,
    lineHeight: 20,
  },
  // Angular: breather.component.scss .get-paid-membership { height:40px; width:100% }
  // — 100% of its OWN column, which is ion-col size="7.2" (7.2/12 = 60% of the row).
  // The Figma mockup's compact/content-sized look doesn't match the real Angular CSS —
  // this follows the actual implementation, not the mockup.
  ctaBtn: {
    marginTop:         16,
    height:            40,
    width:             '60%',
    borderRadius:      8,
    paddingHorizontal: 16,
    alignItems:        'center',
    justifyContent:    'center',
  },
  ctaText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
  },
})

