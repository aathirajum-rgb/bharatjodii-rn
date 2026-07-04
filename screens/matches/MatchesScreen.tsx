// Angular equivalent: pages/matches/matches.page.ts + matches-card.component
// Landing page for existing users after login (WEBVIEWURL page_id = 60)
// Card layout mirrors matches-card.component.html exactly.

import { useEffect, useMemo, useRef, useState } from 'react'
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
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SvgUri } from 'react-native-svg'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import MatchesHeader from '../../components/matches-header/MatchesHeader'
import {
  WhatsAppIcon, CallIcon, CloseIcon, ViewLaterIcon, LikeIcon,
  HtmlText, buildBasicView, showLikeCTA, showAfterLikeCTA,
  getBlurPhotoUri, NEWLY_JOINED_STAR_URI, PAID_TAG_URI, VERIFIED_TAG_URI,
} from '../../components/matches/matchesCard.shared'
import MatchesDesktopLayout from './MatchesDesktopLayout'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { matchProfileAdapter } from '../../adapters/matches.adapter'
import type { MatchProfile, BannerItem, MatchListItem } from '../../types/interfaces/matches.interface'
import {
  fetchMatches,
  fetchExtendedMatchesCount,
  fetchAndStorePPSetData,
  fetchMenuPromo,
  refreshSession,
} from '../../service/homeService'
import {
  communicationBtnOnClick,
} from '../../service/communicationService'
import { getItem } from '../../service/storageService'
import { getSessionValue, getRegistrationArrays } from '../../service/registrationService'
import { StorageKeys } from '../../constants/storage.keys'

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

function MatchCard({
  profile, oppGender, onPress, onLike, onDontShow, onViewLater, onCall, onWhatsApp,
}: {
  profile:    MatchProfile
  oppGender:  'M' | 'F'
  onPress:    () => void
  onLike:     () => void
  onDontShow: () => void
  onViewLater:() => void
  onCall:     () => void
  onWhatsApp: () => void
}) {
  const { t } = useTranslation()
  return (
    <View style={c.card}>

      {/* ── Photo section ──────────────────────────────────────────────────── */}
      {/* Angular: app-photo-new — top border radius 16px */}
      <Pressable style={[c.photoBox, { height: PHOTO_H }]} onPress={onPress}>
        {profile.isPhotoAvailable && !profile.isPhotoProtect && profile.profileImg ? (
          // Normal: actual photo
          <Image source={{ uri: profile.profileImg }} style={c.photo} resizeMode="cover" />
        ) : (
          // No photo or protected: blur placeholder + WhatsApp overlay
          // Angular: getWhatsAppAvatarImg() + request-photo-vp overlay
          <>
            <SvgUri
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
          </>
        )}

        {/* Angular: .newly-joined posabsolute — star SVG + "New" text, top-left of photo */}
        {profile.isNewlyJoined && (
          <View style={c.newBadge} pointerEvents="none">
            <SvgUri uri={NEWLY_JOINED_STAR_URI} width={14} height={14} />
            <Text style={c.newBadgeText}>{t('MATCHES.NEW')}</Text>
          </View>
        )}
      </Pressable>

      {/* ── Paid + Verified badges ─────────────────────────────────────────── */}
      {/* Angular: ion-row isProfileBadge — BELOW the photo, not overlaid */}
      {(profile.isPaidMember || profile.isIdVerified) && (
        <View style={c.badges}>
          {profile.isPaidMember && (
            <SvgUri uri={PAID_TAG_URI} width={80} height={24} />
          )}
          {profile.isIdVerified && (
            <SvgUri uri={VERIFIED_TAG_URI} width={100} height={24} />
          )}
        </View>
      )}

      {/* ── Liked strip ────────────────────────────────────────────────────── */}
      {/* Angular: .liked-profile — pink gradient strip below badges */}
      {!!profile.likedDateText && profile.likedStatus === '1' && (
        <View style={c.likedStrip}>
          <SvgUri uri={CDN + 'liked-new.svg'} width={20} height={20} />
          <Text style={c.likedText} numberOfLines={1}>{profile.likedDateText}</Text>
        </View>
      )}

      {/* ── Activity label row ────────────────────────────────────────────── */}
      {/* Angular: isActivityLabel — "Viewed on …" / "Shortlisted on …" with icon */}
      {profile.isNewLabel && !!profile.labelContent && (
        <View style={c.activityRow}>
          <SvgUri uri={CDN + 'revamp/viewed-icon-updated.svg'} width={16} height={16} style={{ marginTop: 2, flexShrink: 0 }} />
          <Text style={c.activityText}>{profile.labelContent}</Text>
        </View>
      )}

      {/* ── Name + Call icon + WhatsApp icon ───────────────────────────────── */}
      {/* Angular: d-flex row: heading2-semibold-18 name + phone-icon + matches-whatsapp */}
      <View style={c.nameRow}>
        <Pressable style={{ flex: 1 }} onPress={onPress}>
          <Text style={c.name} numberOfLines={1}>{profile.name}</Text>
        </Pressable>
        <Pressable style={c.iconBtn} onPress={onCall} hitSlop={8}>
          <CallIcon width={24} height={24} />
        </Pressable>
        <Pressable style={c.iconBtn} onPress={onWhatsApp} hitSlop={8}>
          <WhatsAppIcon width={28} height={28} />
        </Pressable>
      </View>

      {/* ── Basic view text ────────────────────────────────────────────────── */}
      {/* Angular: bindBasicView() — "27 yrs | 5'5" | Brahmin | B.Tech | Engineer | Chennai, TN" */}
      <Pressable onPress={onPress}>
        <Text style={c.basicView} numberOfLines={4}>
          {buildBasicView(profile)}
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
            <Pressable style={c.ctaDontShow} onPress={onDontShow}>
              <CloseIcon width={16} height={16} />
              <Text style={c.ctaDontShowText}>{t('GENERAL.DONTSHOWCTA')}</Text>
            </Pressable>
            <Pressable style={c.ctaViewLater} onPress={onViewLater}>
              <ViewLaterIcon width={16} height={16} />
              <Text style={c.ctaViewLaterText}>{t('GENERAL.VIEWLATER')}</Text>
            </Pressable>
          </View>
          <Pressable style={c.ctaLike} onPress={onLike}>
            <LikeIcon width={20} height={20} />
            <Text style={c.ctaLikeText}>{t('GENERAL.LIKE_CTA').replace('#HER_HIM#', '').trim()}</Text>
          </Pressable>
        </View>
      )}

      {showAfterLikeCTA(profile.likedStatus) && (
        // Angular: matches-cta-bg-color (pink gradient bg) + getContentAfterLike() text + "Send interest" CTA
        <View style={c.afterLikeRow}>
          <Text style={c.afterLikeText}>
            {t('GENERAL.CONTACT')}
          </Text>
          <Pressable style={c.ctaSendInterest} onPress={onPress}>
            <Text style={c.ctaSendInterestText}>{t('GENERAL.SEND_INTEREST_CTA')}</Text>
          </Pressable>
        </View>
      )}

    </View>
  )
}

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
        {/* Left: banner image — Angular ion-col size="4", padd0, img fills col */}
        <View style={pb.imageCol}>
          {!!data.BANNERIMG && (
            <Image source={{ uri: data.BANNERIMG }} style={pb.image} resizeMode="contain" />
          )}
        </View>

        {/* Right: title + body + CTA — Angular ion-col size="8", pt-6 */}
        <View style={pb.textCol}>
          {!!data.TITLE && <Text style={pb.title}>{stripHtml(data.TITLE)}</Text>}
          {!!data.BODY  && <Text style={pb.body}>{stripHtml(String(data.BODY))}</Text>}
          {!!data.CTA   && (
            <Pressable
              style={[pb.ctaBtn, { backgroundColor: data.CTABGCOLOR || Colors.primary }]}
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

// Angular: app-breather PAYMENT type (BANNERSLOT 1001) — festival/membership offer card
// BGIMG is positioned on the right side (background-position: right in Angular CSS)
function MembershipBanner({ data, onPress }: { data: any; onPress: () => void }) {
  if (!data) return null

  const stripHtml = (s: string) => s?.replace(/<[^>]*>/g, '') ?? ''
  const cta = stripHtml(data.CTA ?? 'Get Membership')
  const valid = stripHtml(data.VALID ?? data.FCONTENT ?? '')
  const benefits: Array<{ IMG?: string; VALUE?: string }> = Array.isArray(data.BENEFITS) ? data.BENEFITS : []
  const isWhite = data.FONTCOLOR === 'white-color'
  const textColor = isWhite ? Colors.white : Colors.textStrong

  return (
    <Pressable style={mb.card} onPress={onPress}>
      {/* Right-side couple image — Angular: BGIMG positioned right via CSS */}
      {!!data.BGIMG && (
        <Image source={{ uri: data.BGIMG }} style={mb.rightImg} resizeMode="contain" />
      )}

      {/* Content occupies left ~65% */}
      <View style={mb.content}>
        {!!data.TITLEIMG && (
          <Image source={{ uri: data.TITLEIMG }} style={mb.titleImg} resizeMode="contain" />
        )}

        {/* Title — plain text */}
        {!!data.TITLE && (
          <Text style={[mb.title, { color: textColor }]}>
            {stripHtml(data.TITLE)}
          </Text>
        )}

        {/* Festival subtitle */}
        {!!data.FESTIVALSUBTITLE && (
          <HtmlText html={data.FESTIVALSUBTITLE} style={[mb.subtitle, { color: textColor }]} />
        )}

        {/* Subtitle — may contain colored <span> (e.g. "₹101 OFF" in red) */}
        {!!data.SUBTITLE && (
          <HtmlText html={data.SUBTITLE} style={[mb.subtitle, { color: textColor }]} />
        )}

        {/* Validity / timer */}
        {!!valid && <Text style={mb.valid}>{valid}</Text>}

        {/* Benefits list with icons */}
        {benefits.length > 0 && (
          <View style={mb.benefitsList}>
            {benefits.slice(0, 4).map((b, i) => (
              <View key={i} style={mb.benefitRow}>
                {!!b.IMG && (
                  <Image source={{ uri: b.IMG }} style={mb.benefitIcon} resizeMode="contain" />
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
          style={[mb.ctaBtn, { backgroundColor: data.CTABGCOLOR || Colors.primary }]}
          onPress={onPress}
        >
          <Text style={[mb.ctaText, { color: data.CTACOLOR || Colors.white }]}>{cta}</Text>
        </Pressable>
      </View>
    </Pressable>
  )
}

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
        {/* Image — Angular: add-photo-height = 13vh ≈ 87px, align-items flex-start */}
        {!!data.BANNERIMG && (
          <Image source={{ uri: data.BANNERIMG }} style={ap.image} resizeMode="contain" />
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
            <SvgUri uri={FEMALE_AVATAR} width={52} height={52} />
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

// ─── MatchesScreen ────────────────────────────────────────────────────────────

export default function MatchesScreen({ navigation }: { navigation: any }) {
  const { i18n } = useTranslation()
  const isDesktop = useIsDesktopWeb()

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
    const current = e.nativeEvent.contentOffset.y | 0
    const delta   = current - scrollYRef.current
    if (Math.abs(delta) < 10) return
    scrollYRef.current = current

    // Angular: hide when scrollY > 100 && scrolling down, show when delta < -15 || scrollY < 50
    const shouldHide = current > 100 && delta > 0
    const shouldShow = delta < -15 || current < 50

    if (shouldHide && !isHiddenRef.current) {
      isHiddenRef.current = true
      Animated.timing(headerAnim, {
        toValue:         -(titleHRef.current || 56),  // slide by title row height only
        duration:        300,
        easing:          Easing.ease,
        useNativeDriver: true,
      }).start()
    } else if (shouldShow && isHiddenRef.current) {
      isHiddenRef.current = false
      Animated.timing(headerAnim, {
        toValue:         0,
        duration:        300,
        easing:          Easing.ease,
        useNativeDriver: true,
      }).start()
    }
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
  useEffect(() => {
    let cancelled = false

    async function loadMatches() {
      try {
        // Read login gender once — determines which blur placeholder to show on photo cards
        const lg = await getItem(StorageKeys.User.LOGIN_GENDER)
        setOppGender(lg === 'F' ? 'M' : 'F')

        // Step 1 — refreshSession() ensures Level-2 tokens before any listing API call.
        // The 1hr gate lives in RootNavigation.tsx (centralized guard) — here we always
        // call it so fetchMatches() is guaranteed to have a valid ATN.
        await refreshSession()
        if (cancelled) return

        // Step 2 — Angular: callMatchesApi() → listing/matches/v1
        const result = await fetchMatches(0, 20)
        if (cancelled) return

        setProfiles(result.items.map(matchProfileAdapter.adapt))
        setBannerSlots(result.bannerSlots)
        setTotalCount(result.totalCount)
        apiStartRef.current = result.items.length  // cursor for next page

        // Step 3 — Angular: parallel post-matches calls
        // newcount + extendedmatches + ppSetData + dailyRecommendations + menuPromo
        const [extCount, , promo] = await Promise.all([
          fetchExtendedMatchesCount(),
          fetchAndStorePPSetData().then(async (ppSetData) => {
            const [entryType, reg] = await Promise.all([
              getSessionValue('ENTRYTYPE'),
              getRegistrationArrays(),
            ])
            // Angular matches.page.ts:705 — show add-photo banner when:
            // PROFILEPUBLISHEDFLAG=0 (photo not added) + PROFILEPUBLISHEDTYPE 1|2 (promotion active) + ENTRYTYPE=F (free user)
            try {
              // BANNERSLOT 1013 inline banner — PHOTOPUBLISHED.Matches
              if (reg?.PHOTOPUBLISHED?.Matches) {
                setAddPhotoBannerMatches(reg.PHOTOPUBLISHED.Matches)
              }
              // Header photo promo banner — PHOTOPUBLISHED.Banner (free users only)
              const flagOk = String(ppSetData?.PROFILEPUBLISHEDFLAG) === '0'
              const typeOk = ['1', '2'].includes(String(ppSetData?.PROFILEPUBLISHEDTYPE))
              const freeOk = entryType === 'F'
              if (flagOk && typeOk && freeOk) {
                const banner = reg?.PHOTOPUBLISHED?.Banner ?? {}
                // API sends Angular CSS class names — resolve to real hex colors
                const resolveBg = (v: string) =>
                  (!v || v === 'primaryBg') ? Colors.primaryDark : (v.startsWith('#') ? v : Colors.primaryDark)
                const resolveColor = (v: string) =>
                  (!v || v === 'whiteColor') ? Colors.white : (v.startsWith('#') ? v : Colors.white)
                setShowPhotoPromotion(true)
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
            } catch (err) {
              console.log('[PhotoBanner] error in banner check:', err)
            }
          }),
          fetchMenuPromo(),
        ])
        if (!cancelled) {
          setExtendedCount(extCount)
          if (promo) setMenuPromo(promo)
        }

      } catch (e) {
        if (__DEV__) console.error('[Matches] load error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadMatches()
    return () => { cancelled = true }
  }, [])

  // ── Pagination ──────────────────────────────────────────────────────────────
  // Angular: doInfinite() → calls callMatchesApi() when scroll reaches end
  async function loadMore() {
    if (loadingMore || apiStartRef.current >= totalCount) return
    setLoadingMore(true)
    try {
      const result = await fetchMatches(apiStartRef.current, 20)
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
    // Optimistic UI: remove card immediately (matches Angular removeProfile)
    setProfiles(prev => prev.filter(p => p.profileId !== profile.profileId))
    setTotalCount(prev => Math.max(0, prev - 1))
    apiStartRef.current = Math.max(0, apiStartRef.current - 1)
    try {
      await communicationBtnOnClick('matches', 'skip', { MATRIID: profile.profileId })
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

  // Desktop quick-filter chips are visual-only (no real filtering), matching
  // the mobile FilterChipsRow's existing behavior — just toggles which chip
  // is highlighted.
  function handleDesktopChipSelect(key: string) {
    setSelectedChip(prev => (prev === key ? '' : key))
  }

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 2: navigation.navigate('Activity'); break
      case 3: navigation.navigate('recharge'); break
      case 4: navigation.navigate('Search');   break
    }
  }

  const renderItem: ListRenderItem<MatchListItem> = ({ item }) => {
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
      return null
    }
    return (
      <MatchCard
        profile={item}
        oppGender={oppGender}
        onPress={() => navigation.navigate('viewprofile', { id: item.profileId })}
        onLike={() => handleLike(item)}
        onDontShow={() => handleDontShow(item)}
        onViewLater={() => handleViewLater(item)}
        onCall={() => handleCall(item)}
        onWhatsApp={() => handleWhatsApp(item)}
      />
    )
  }

  // ── Desktop web layout (Figma "Jodii Desktop") ──────────────────────────────
  // Wide browser window only — mobile/native/narrow-web keep the JSX below,
  // untouched, sharing all the same state/handlers defined above.
  if (isDesktop) {
    return (
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
        onChipSelect={handleDesktopChipSelect}
      />
    )
  }

  return (
    <View style={s.screen}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {/* Separated component — SafeAreaView edges={["top"]} handles status bar internally */}
      <MatchesHeader
        headerAnim={headerAnim}
        loading={loading}
        totalCount={totalCount}
        langCode={i18n.language}
        selectedChip={selectedChip}
        onChipSelect={setSelectedChip}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
        onEditPreferences={() => navigation.navigate('Search')}
        onHeaderLayout={handleHeaderLayout}
        onTitleLayout={handleTitleLayout}
      />

      {/* ── Profile list / loader ──────────────────────────────────────────── */}
      {/* Angular: app-loader while !contentLoaded, cdk-virtual-scroll-viewport when loaded */}
      {loading ? (
        <View style={[s.loaderBox, { paddingTop: headerH }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
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
          ListHeaderComponent={
            showPhotoPromotion && photoBannerData ? (
              <PhotoPromotionBanner
                data={photoBannerData}
                onPress={() => navigation.navigate('Gallery')}
              />
            ) : null
          }
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator size="small" color={Colors.primary} style={s.footerLoader} />
              : extendedCount > 0
                ? <ExtendedMatchesCard count={extendedCount} onPress={() => {}} />
                : null
          }
        />
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <AppFooter
        activeTab={1}
        likesCount={37}
        upgradeTag="₹200 OFF"
        onTabPress={handleTabPress}
      />
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

  // Angular: img-holder pl-16 pr-16 with brdr-radius (top-left + top-right radius 16)
  photoBox: {
    marginHorizontal: 16,
    borderTopLeftRadius:  16,
    borderTopRightRadius: 16,
    overflow:         'hidden',
    backgroundColor:  Colors.divider,
  },
  photo: { width: '100%', height: '100%' },

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
  name:       { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.textDark },
  iconBtn:    { flexShrink: 0 },
  nameRowIcon:  { width: 24, height: 24 },
  nameRowIconWa:{ width: 28, height: 28 },

  // Angular: body2-regular-14 mt-2 pl-16 pr-16 bv-minht text-space
  basicView: {
    fontFamily:       'Poppins-Regular',
    fontSize:         14,
    color:            Colors.textDark,
    lineHeight:       22,
    marginTop:        4,
    paddingHorizontal: 16,
    minHeight:        40,
  },

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
  ctaSection: {
    marginTop:        8,
    marginBottom:     24,
    paddingHorizontal: 16,
    gap:              8,
  },
  ctaSecRow: {
    flexDirection: 'row',
    gap:           8,
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

  ctaDontShow: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    borderWidth:    1,
    borderColor:    Colors.borderLight,
    borderRadius:   8,
    paddingVertical: 12,
  },
  ctaDontShowText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.textDark },

  ctaViewLater: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    borderWidth:    1,
    borderColor:    Colors.borderLight,
    borderRadius:   8,
    paddingVertical: 12,
  },
  ctaViewLaterText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.textDark },

  ctaLike: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: Colors.primary,
    borderRadius:    8,
    paddingVertical: 12,
    gap:             6,
  },
  ctaLikeIcon: { width: 20, height: 20 },
  ctaLikeText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.white },

  // Angular: matches-cta-bg-color (pink gradient) + "Send Interest" primary CTA
  afterLikeRow: {
    paddingHorizontal: 16,
    paddingVertical:   16,
    backgroundColor:  Colors.afterLikeBg,
    borderTopWidth:   1,
    borderTopColor:   Colors.afterLikeBorder,
  },
  ctaSendInterest: {
    backgroundColor: Colors.primary,
    borderRadius:    8,
    paddingVertical: 12,
    alignItems:      'center',
  },
  ctaSendInterestText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.white },
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
  // Angular: matches-breather-block — full card with BGIMG as right-side image
  card: {
    backgroundColor:   Colors.membershipCardBg,
    borderBottomWidth: 8,
    borderBottomColor: Colors.borderSubtle,
    minHeight:         220,
    overflow:          'hidden',
  },
  // BGIMG from API positioned to right side (Angular: background-position right)
  rightImg: {
    position: 'absolute',
    right:    0,
    top:      0,
    bottom:   0,
    width:    '45%',
  },
  // Content sits in the left ~65% so it doesn't overlap the right image
  content: {
    paddingHorizontal: 20,
    paddingVertical:   20,
    width:             '62%',
  },
  titleImg: {
    width:        140,
    height:       28,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   20,
    color:      Colors.textStrong,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      Colors.textDark,
    marginTop:  4,
    lineHeight: 22,
  },
  valid: {
    fontFamily:      'Poppins-Regular',
    fontSize:        12,
    color:           Colors.badgeNewText,
    marginTop:       6,
    backgroundColor: Colors.badgeNewBg,
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderRadius:    4,
    alignSelf:       'flex-start',
  },
  benefitsList: {
    marginTop: 10,
    gap:       4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           6,
  },
  benefitIcon: {
    width:      18,
    height:     18,
    flexShrink: 0,
    marginTop:  2,
  },
  benefitText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   13,
    color:      Colors.textDark,
    flex:       1,
    lineHeight: 18,
  },
  ctaBtn: {
    marginTop:       16,
    borderRadius:    8,
    paddingVertical: 12,
    alignItems:      'center',
  },
  ctaText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
  },
})

