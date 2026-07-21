// Desktop/laptop layout for ViewProfile (Figma "Jodii Desktop - Registration",
// file UaPAN9aG6MfZf6CRpwXf1L, nodes 86:2167 / 154:307 / 141:36781). Purely
// presentational — ViewProfileScreen.tsx owns all data-loading/state/handler
// logic (same split MatchesDesktopLayout.tsx/MatchCardDesktop.tsx already use
// for the Matches screen) and passes it down as props; this file only arranges
// that data into the desktop two-column grid + sticky-on-scroll condensed bar.
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FlatList, NativeScrollEvent, NativeSyntheticEvent,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { LANG_LABELS } from '../../components/matches-header/MatchesHeader'
import {
  WhatsAppIcon, CallIcon, CloseIcon, ViewLaterIcon, LikeIcon, PhotoSwiper,
  showLikeCTA, showAfterLikeCTA, disableDontShow, disableViewLater, HtmlText,
  buildBasicView, getBlurPhotoUri, ProfileBadge,
  getAfterLikeCtaLabel, getAfterLikeCtaIcon, getAfterLikeContentText, showContactsLeftBanner, showFreeBadge,
  type AfterLikeCtx,
} from '../../components/matches/matchesCard.shared'
import MembershipBanner from '../../components/matches/MembershipBanner'
import {
  ICON, familyCountText, SimilarProfileCardItem,
} from './ViewProfileScreen'
import type { ViewProfileModel } from '../../types/interfaces/viewProfile.interface'
import type { SimilarProfileCard, StarMatchResult } from '../../service/viewProfileService'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'

// Same back-icon asset ViewProfileScreen's own mobile header uses.
const BACK_ICON_URI = CDN_REACT + '/arrowleft.svg'

const HERO_PHOTO_SIZE = 180
const SIDEBAR_WIDTH = 260
// Figma node 310:11916 — square similar-profile cards, explicitly sized (see
// SimilarProfileCardItem's `size` prop doc comment for why this can't be left
// to default — mobile's own default reads the browser's full window width).
const SIMILAR_CARD_SIZE = 180
// Angular: <app-swiper>'s navigation-module arrows advance the "Other/Similar
// profiles" row exactly one card at a time (see ViewProfileScreen.tsx's mobile
// scrollSimilarBy) — desktop was left as a bare draggable FlatList with no
// arrows, which felt like the mobile/native free-scroll instead of matching
// this same click-to-advance behavior. Same gap value `similarListContent`
// already uses below.
const SIMILAR_CARD_GAP = 16
// Must match `similarListContent`'s own paddingHorizontal below — only the
// LEFT side matters here since that's the only padding visible at rest
// (scrollX 0); the right-side padding is only seen once scrolled to the end.
const SIMILAR_LIST_PADDING = 24

export interface NeighborPreview {
  name: string
  photoUri?: string | undefined
}

export interface ViewProfileDesktopLayoutProps {
  profile:            ViewProfileModel
  oppGender:          'M' | 'F'
  sameGender:          boolean
  ownProfile:          boolean
  loginGender:        'M' | 'F'
  hasReligiousInfo:    boolean
  ownEntryType:        string
  femaleFreeEligible:  boolean
  indNumbersLeft:      string
  loginHoroAvail:      string
  starMatch:           StarMatchResult | null
  similarProfiles:     SimilarProfileCard[]
  menuPromo:           any

  hasPrevProfile: boolean
  hasNextProfile: boolean
  profileIndex:   number
  totalProfiles:  number
  prevPreview?:   NeighborPreview | undefined
  nextPreview?:   NeighborPreview | undefined

  langCode: string
  onBack:           () => void
  onGoToPrev:       () => void
  onGoToNext:       () => void
  onLanguagePress:  () => void

  onLike:      () => void
  onDontShow:  () => void
  onViewLater: () => void
  onCall:      () => void
  onWhatsApp:  () => void

  onOpenPhotoViewer:        (index: number) => void
  onSimilarProfilePress:    (card: SimilarProfileCard) => void
  onMembershipBannerPress:  () => void

  onAddHoroscope:      () => void
  onViewHoroscope:     () => void
  onAddFamilyDetails:  () => void
  onAddPropertyDetails: () => void
  onDownloadBiodata:    () => void
  onViewStarMatchDetails: () => void
  onReportProfile:      () => void
}

// Figma (86:2167): icon(24) → 12px gap → label(170w) → 8px gap → value(flex) — a
// single inline row, unlike mobile's DetailRow (ViewProfileScreen.tsx) which
// stacks label above value. Same data/gating, different presentation only.
function DesktopDetailRow({ icon, label, value }: { icon: string; label: string; value?: string | undefined }) {
  if (!value) return null
  return (
    <View style={ds.row}>
      <CdnSvg uri={icon} width={24} height={24} />
      <View style={ds.rowLabelValue}>
        <Text style={ds.label}>{label}</Text>
        <HtmlText html={value} style={ds.value} />
      </View>
    </View>
  )
}

function DesktopSectionHeader({ title, first }: { title: string; first?: boolean }) {
  return <Text style={[ds.sectionHeader, first && ds.sectionHeaderFirst]}>{title}</Text>
}

// Hoisted to module scope — these used to be defined INSIDE ViewProfileDesktopLayout's
// function body, which gives them a brand-new function identity on every single render
// of that component (e.g. every profile switch via Next/Prev). React then sees a
// different component type than last render and fully unmounts+remounts the whole
// subtree — including the Image/CdnSvg inside — instead of just updating props. That
// unmount/remount was the actual cause of the flicker (the "View phone number" button
// lives in CtaRow, the neighbor avatars live in NeighborButton — Call/WhatsApp sit
// directly in the stable parent JSX and were never affected). Being module-level
// functions now, their identity is stable across renders, so React only re-renders
// their contents like any other component.

// Shared by both the inline hero-card CTA and the condensed sticky bar's CTA —
// same underlying showLikeCTA/showAfterLikeCTA gating & handlers the mobile
// screen's renderCtaBlock() uses, just laid out as one compact row instead of
// mobile's two-row stacked block.
function CtaRow({
  compact, sameGender, ownProfile, likedStatus, dontShowStatus, viewLaterStatus,
  onDontShow, onViewLater, onLike, onCall, ctaCtx, t,
}: {
  compact?: boolean
  sameGender: boolean
  ownProfile: boolean
  likedStatus: ViewProfileModel['likedStatus']
  dontShowStatus: string
  viewLaterStatus: string
  onDontShow: () => void
  onViewLater: () => void
  onLike: () => void
  onCall: () => void
  ctaCtx: AfterLikeCtx
  t: (key: string) => string
}) {
  if (sameGender || ownProfile) return null
  if (showLikeCTA(likedStatus)) {
    return (
      <View style={ds.ctaRow}>
        <Pressable
          style={[ds.ctaDontShow, compact && ds.ctaCompact, disableDontShow(dontShowStatus) && ds.ctaDisabled]}
          onPress={onDontShow}
          disabled={disableDontShow(dontShowStatus)}
        >
          <CloseIcon width={16} height={16} />
          <Text style={ds.ctaDontShowText}>{t('GENERAL.DONTSHOWCTA')}</Text>
        </Pressable>
        <Pressable
          style={[ds.ctaViewLater, compact && ds.ctaCompact, disableViewLater(viewLaterStatus) && ds.ctaDisabled]}
          onPress={onViewLater}
          disabled={disableViewLater(viewLaterStatus)}
        >
          <ViewLaterIcon width={16} height={16} />
          <Text style={ds.ctaViewLaterText}>{t('GENERAL.VIEWLATER')}</Text>
        </Pressable>
        <Pressable style={[ds.ctaLike, compact && ds.ctaCompact]} onPress={onLike}>
          <LikeIcon width={16} height={17} />
          <Text style={ds.ctaLikeText}>{t('GENERAL.LIKE_CTA').replace('#HER_HIM#', '').trim()}</Text>
        </Pressable>
      </View>
    )
  }
  if (showAfterLikeCTA(likedStatus)) {
    return (
      <View style={ds.afterLikeRow}>
        <Text style={ds.afterLikeText} numberOfLines={1}>{getAfterLikeContentText(ctaCtx, t)}</Text>
        <View style={ds.ctaSendInterestWrap}>
          {showFreeBadge(ctaCtx) && (
            <View style={ds.freeBadge} pointerEvents="none">
              <Text style={ds.freeBadgeText}>{t('GENERAL.FREE')}</Text>
            </View>
          )}
          <Pressable style={ds.ctaSendInterest} onPress={onCall}>
            <CdnSvg uri={getAfterLikeCtaIcon(ctaCtx)} width={16} height={16} />
            <Text style={ds.ctaSendInterestText}>{getAfterLikeCtaLabel(ctaCtx, t)}</Text>
          </Pressable>
        </View>
        {showContactsLeftBanner(ctaCtx) && !compact && (
          <Text style={ds.contactsLeftText}>{t('VIEWPROFILE.CONTACT_SEEN_INFO')}</Text>
        )}
      </View>
    )
  }
  return null
}

function NeighborButton({
  side, enabled, preview, onPress, t,
}: {
  side: 'prev' | 'next'
  enabled: boolean
  preview: NeighborPreview | undefined
  onPress: () => void
  t: (key: string) => string
}) {
  if (!enabled) return null
  // Angular has no localized "Previous" string anywhere in locales/en.json for
  // this desktop-only control (mobile's equivalent is a bare ‹/› chevron, no
  // label) — "Next" reuses the existing GENERAL.NEXT key, "Previous" is plain
  // English to match, same convention MatchesDesktopNav.tsx already uses for
  // its own un-keyed "Upgrade" label.
  const label = side === 'prev' ? 'Previous' : t('GENERAL.NEXT')
  return (
    <Pressable style={s.neighborBtn} onPress={onPress}>
      {side === 'next' && !!preview?.photoUri && (
        <Image source={{ uri: preview.photoUri }} style={s.neighborAvatar} contentFit="cover" />
      )}
      <Text style={s.neighborBtnText}>{label}</Text>
      {side === 'prev' && !!preview?.photoUri && (
        <Image source={{ uri: preview.photoUri }} style={s.neighborAvatar} contentFit="cover" />
      )}
    </Pressable>
  )
}

export default function ViewProfileDesktopLayout({
  profile, oppGender, sameGender, ownProfile, loginGender, hasReligiousInfo,
  ownEntryType, femaleFreeEligible, indNumbersLeft, loginHoroAvail, starMatch,
  similarProfiles, menuPromo,
  hasPrevProfile, hasNextProfile, profileIndex, totalProfiles, prevPreview, nextPreview,
  langCode, onBack, onGoToPrev, onGoToNext, onLanguagePress,
  onLike, onDontShow, onViewLater, onCall, onWhatsApp,
  onOpenPhotoViewer, onSimilarProfilePress, onMembershipBannerPress,
  onAddHoroscope, onViewHoroscope,
  onAddFamilyDetails, onAddPropertyDetails, onDownloadBiodata, onViewStarMatchDetails, onReportProfile,
}: ViewProfileDesktopLayoutProps) {
  const { t } = useTranslation()
  const [showMenu, setShowMenu] = useState(false)
  // Figma node 141:36781 — a condensed bar (avatar+name / CTA / Previous-Next)
  // that replaces the normal top bar+pagination once scrolled past the hero
  // card. heroBottomY is measured off the hero card's own onLayout, same
  // "measure once, compare to live scroll position" approach ViewProfileScreen's
  // mobile floating-CTA (topCtaVisible) already uses.
  const [heroBottomY, setHeroBottomY] = useState<number | null>(null)
  const [showStickyBar, setShowStickyBar] = useState(false)
  // "Similar profiles" needs to end at the exact same right edge as "Basic
  // details"/leftCol — but leftCol's rendered width isn't a fixed number: it's
  // whatever's left over after the flex row divides space with rightCol (which
  // itself only exists, and only reserves width, when there's a membership
  // promo to show — see rightCol below). Measuring it directly is the only way
  // to match it exactly in both cases instead of guessing at flex arithmetic.
  const [leftColWidth, setLeftColWidth] = useState<number | null>(null)
  // Figma (93:4277's hero card): the photo fills the FULL height of the hero
  // card, ending flush with the CTA row below it — it isn't a fixed 180px
  // square. Since the card's own height is driven by heroContent's natural
  // content height (name/badges/info/CTA — heroPhoto has no intrinsic height
  // of its own once unpinned from HERO_PHOTO_SIZE), measuring heroContent and
  // feeding that back into heroPhoto/PhotoSwiper is what keeps them level —
  // a fixed square left empty space below the CTA row whenever that content
  // was shorter than 180px.
  const [heroContentHeight, setHeroContentHeight] = useState<number | null>(null)

  // Buffer around heroBottomY so the sticky bar's mount/unmount doesn't flip on
  // every scroll tick when scrollY hovers right at the boundary (common with
  // wheel/trackpad scrolling) — without it, the bar (and the CTA/nav buttons
  // inside it) visibly flickered in and out on small back-and-forth scroll.
  const STICKY_BAR_HYSTERESIS = 30

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (heroBottomY === null) return
    const y = e.nativeEvent.contentOffset.y
    setShowStickyBar(prev => {
      if (!prev && y > heroBottomY + STICKY_BAR_HYSTERESIS) return true
      if (prev && y < heroBottomY - STICKY_BAR_HYSTERESIS) return false
      return prev
    })
  }

  // Arrow-button navigation for the Similar Profiles row — mirrors
  // ViewProfileScreen.tsx's mobile scrollSimilarBy/onSimilarScroll exactly,
  // advancing one card at a time instead of leaving it a free-drag list.
  // Card size is derived from leftColWidth (this section is exactly that wide —
  // see similarSection's style below) so the row divides into exactly 4 slots
  // that fill the section flush to its right edge, with no leftover gap and no
  // 5th card peeking — a fixed 180px (Figma's own size) left a gap here
  // whenever leftColWidth didn't happen to divide evenly into 4×180+3×16.
  const [similarIndex, setSimilarIndex] = useState(0)
  const similarListRef = useRef<FlatList<SimilarProfileCard>>(null)
  const similarCardSize = leftColWidth
    ? Math.max(120, Math.floor((leftColWidth - SIMILAR_LIST_PADDING - SIMILAR_CARD_GAP * 3) / 4))
    : SIMILAR_CARD_SIZE
  const similarCardStride = similarCardSize + SIMILAR_CARD_GAP

  function scrollSimilarBy(delta: number) {
    const nextIndex = Math.max(0, Math.min(similarProfiles.length - 1, similarIndex + delta))
    similarListRef.current?.scrollToOffset({ offset: nextIndex * similarCardStride, animated: true })
    setSimilarIndex(nextIndex)
  }

  function onSimilarScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setSimilarIndex(Math.round(e.nativeEvent.contentOffset.x / similarCardStride))
  }

  const ctaCtx: AfterLikeCtx = {
    entryType:   ownEntryType,
    likedStatus: profile.likedStatus,
    phoneViewed: profile.phoneViewed,
    femaleFreeEligible,
    indNumbersLeft,
    oppGender,
  }

  return (
    <View style={s.screen}>
      {/* ── Top bar — Logo + language only (Figma 86:2167: no Home/Matches/Liked
          tabs on this page, unlike MatchesDesktopNav, and no back button here
          either — the back control lives in the pagination row below, next to
          the "N / Total Profiles" text, confirmed against node 290:2220). */}
      <View style={s.topBar}>
        <Text style={s.logo}>Jodii</Text>
        <Pressable style={s.langBtn} onPress={onLanguagePress}>
          <Text style={s.langText}>{LANG_LABELS[langCode] ?? 'English'}</Text>
          <Text style={s.langChevron}>{'▾'}</Text>
        </Pressable>
      </View>

      {/* ── Sticky condensed bar (Figma 141:36781) — overlays the top bar once
          scrolled past the hero card. */}
      {showStickyBar && !sameGender && (
        <View style={s.stickyBar}>
          <View style={s.stickyLeft}>
            {!!profile.photos[0] && (
              <Image source={{ uri: profile.photos[0] }} style={s.stickyAvatar} contentFit="cover" />
            )}
            <Text style={s.stickyName} numberOfLines={1}>{profile.name}</Text>
          </View>
          <CtaRow
            compact
            sameGender={sameGender}
            ownProfile={ownProfile}
            likedStatus={profile.likedStatus}
            dontShowStatus={profile.dontShowStatus}
            viewLaterStatus={profile.viewLaterStatus}
            onDontShow={onDontShow}
            onViewLater={onViewLater}
            onLike={onLike}
            onCall={onCall}
            ctaCtx={ctaCtx}
            t={t}
          />
          <View style={s.stickyNav}>
            <NeighborButton side="prev" enabled={hasPrevProfile} preview={prevPreview} onPress={onGoToPrev} t={t} />
            <NeighborButton side="next" enabled={hasNextProfile} preview={nextPreview} onPress={onGoToNext} t={t} />
          </View>
        </View>
      )}

      <ScrollView
        style={s.scroll}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={s.content}
      >
        {/* ── Pagination row — Figma node 290:2220: back icon (24×24) directly
            beside the "N / Total Profiles" text (Poppins-SemiBold 18), not a
            separate control in the top bar. */}
        {!ownProfile && totalProfiles > 0 && (
          <View style={s.paginationRow}>
            <Pressable style={s.paginationBack} onPress={onBack} hitSlop={8}>
              <CdnSvg uri={BACK_ICON_URI} width={24} height={24} />
              <Text style={s.paginationText}>
                {profileIndex + 1} / {totalProfiles} {t('PROFILES.PROFILES')}
              </Text>
            </Pressable>
            <View style={s.paginationNav}>
              <NeighborButton side="prev" enabled={hasPrevProfile} preview={prevPreview} onPress={onGoToPrev} t={t} />
              <NeighborButton side="next" enabled={hasNextProfile} preview={nextPreview} onPress={onGoToNext} t={t} />
            </View>
          </View>
        )}

        {/* ── Hero card — photo (left) + name/badges/icons/CTA (right) ────────── */}
        <View style={s.heroCard} onLayout={e => setHeroBottomY(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
          <View style={[s.heroPhoto, heroContentHeight ? { height: heroContentHeight } : null]}>
            {profile.isPhotoAvailable && !profile.isPhotoProtect && profile.photos.length > 0 ? (
              // Figma (282:1919/282:2030) — same dynamicBullets dot pagination
              // the Matches screen's card photo already uses when a profile has
              // more than one photo (dots-only here, no arrow overlay). Reusing
              // PhotoSwiper directly instead of a static single <Image> so this
              // hero photo gets the same swipe-through-photos + dot indicator
              // behavior, not just its first photo.
              <PhotoSwiper
                images={profile.photos}
                width={HERO_PHOTO_SIZE}
                height={heroContentHeight ?? HERO_PHOTO_SIZE}
                onPress={onOpenPhotoViewer}
              />
            ) : (
              <CdnSvg uri={getBlurPhotoUri(oppGender)} width="100%" height="100%" />
            )}
          </View>

          <View style={s.heroContent} onLayout={e => setHeroContentHeight(e.nativeEvent.layout.height)}>
            <View style={s.heroTopRow}>
              <View style={s.badgeRow}>
                {profile.isPaidMember && <ProfileBadge variant="paid" text={t('MENU.PAID_BADGE')} />}
                {profile.isIdVerified && loginGender === 'F' && (
                  <ProfileBadge variant="verified" text={t('MATCHES.VERIFIED_ID')} />
                )}
              </View>
              {!ownProfile && (
                <View style={s.heroIcons}>
                  {!sameGender && (
                    <>
                      <Pressable onPress={onCall} hitSlop={8}><CallIcon width={22} height={22} /></Pressable>
                      <Pressable onPress={onWhatsApp} hitSlop={8}><WhatsAppIcon width={24} height={24} /></Pressable>
                    </>
                  )}
                  <View>
                    <Pressable style={s.menuBtn} onPress={() => setShowMenu(v => !v)} hitSlop={8}>
                      <Text style={s.menuDots}>⋮</Text>
                    </Pressable>
                    {showMenu && (
                      <View style={s.menuDropdown}>
                        <Pressable style={s.menuItem} onPress={() => { setShowMenu(false); onDontShow() }}>
                          <Text style={s.menuItemText}>{t('MATCHES.MORE_OPT_1')}</Text>
                        </Pressable>
                        <Pressable style={s.menuItem} onPress={() => { setShowMenu(false); onReportProfile() }}>
                          <Text style={[s.menuItemText, s.menuItemDanger]}>{t('MATCHES.MORE_OPT_2')}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>

            <Text style={s.name} numberOfLines={1}>{profile.name}</Text>
            <Text style={s.jodiId}>{t('EDITPROFILE.JODIIID')} : {profile.profileId}</Text>
            {/* Angular sends some parts (e.g. HEIGHTCATEGORY) as raw server HTML —
                a `<span class="height-revamp-text-small">...</span>` around the
                cm/ft range — a plain Text showed that literal markup on screen;
                HtmlText (same helper the mobile DetailRow uses) strips/renders it.
                numberOfLines=2 (not 1) so longer combos wrap instead of getting
                cut off mid-word. */}
            <HtmlText html={buildBasicView(profile)} style={s.basicInfo} numberOfLines={2} />

            {ownProfile ? (
              <Pressable style={s.biodataCta} onPress={onDownloadBiodata}>
                <Text style={s.biodataCtaText}>{t('BIO_DATA.BIODATA_DOWNLOAD_FREE')}</Text>
              </Pressable>
            ) : (
              <CtaRow
                sameGender={sameGender}
                ownProfile={ownProfile}
                likedStatus={profile.likedStatus}
                dontShowStatus={profile.dontShowStatus}
                viewLaterStatus={profile.viewLaterStatus}
                onDontShow={onDontShow}
                onViewLater={onViewLater}
                onLike={onLike}
                onCall={onCall}
                ctaCtx={ctaCtx}
                t={t}
              />
            )}
          </View>
        </View>

        {/* ── Two-column body ──────────────────────────────────────────────── */}
        <View style={s.twoColumn}>
          <View style={s.leftCol} onLayout={e => setLeftColWidth(e.nativeEvent.layout.width)}>
            <DesktopSectionHeader title={t('VIEWPROFILE.BASIC_DETAILS')} first />
            <View style={ds.rowsGroup}>
              <DesktopDetailRow icon={ICON.createdFor} label={t('VIEWPROFILE.CREATEDFOR')} value={profile.profileFor} />
              <DesktopDetailRow icon={ICON.age} label={t('VIEWPROFILE.AGEIS')} value={profile.age ? `${profile.age} ${t('VIEWPROFILE.YEARS')}` : undefined} />
              <DesktopDetailRow icon={ICON.height} label={t('VIEWPROFILE.HEIGHT')} value={profile.height} />
              <DesktopDetailRow icon={ICON.maritalStatus} label={t('REG.MARITAL_STATUS')} value={profile.maritalStatus} />
              <DesktopDetailRow icon={ICON.children} label={t('VIEWPROFILE.NOOFCHILDREN')} value={profile.noOfChildren} />
              <DesktopDetailRow icon={ICON.physicalStatus} label={t('REG.PHYSICAL_STATUS')} value={profile.physicalStatus} />
              <DesktopDetailRow icon={ICON.motherTongue} label={t('VIEWPROFILE.MOTHERTONGUE')} value={profile.motherTongue} />
              <DesktopDetailRow icon={ICON.location} label={t('VIEWPROFILE.CURRENTLOCATION')} value={profile.location} />
            </View>

            {(profile.education || profile.occupation || profile.income) && (
              <>
                <DesktopSectionHeader title={t('VIEWPROFILE.PROFESS_DETAILS')} />
                <View style={ds.rowsGroup}>
                  <DesktopDetailRow icon={ICON.education} label={t('VIEWPROFILE.EDUCATION')} value={profile.education} />
                  <DesktopDetailRow icon={ICON.occupation} label={t('VIEWPROFILE.OCCUPATION')} value={profile.occupation} />
                  <DesktopDetailRow icon={ICON.salary} label={t('VIEWPROFILE.MONTHLYINCOME')} value={profile.income} />
                </View>
              </>
            )}

            {hasReligiousInfo && (
              <>
                <DesktopSectionHeader title={t('VIEWPROFILE.RELIGIOUSDETAIL')} />
                <View style={ds.rowsGroup}>
                  <DesktopDetailRow
                    icon={ICON.caste}
                    label={t('VIEWPROFILE.CASTE')}
                    value={[profile.religion, profile.caste, profile.subCaste].filter(Boolean).join(', ') || undefined}
                  />
                  <DesktopDetailRow icon={ICON.raasi} label={t('VIEWPROFILE.RAASIIS')} value={profile.raasi} />
                  <DesktopDetailRow icon={ICON.star} label={t('VIEWPROFILE.STARIS')} value={profile.star} />
                  <DesktopDetailRow icon={ICON.dosham} label={t('VIEWPROFILE.DOSHAMIS')} value={profile.dosham?.join(', ')} />
                </View>
                {profile.hasStarMatchInputs && (
                  ownEntryType === 'P' ? (
                    starMatch && (
                      <Pressable onPress={onViewStarMatchDetails}>
                        <Text style={ds.starMatchText}>
                          {starMatch.displayText}{t('STARMATCHING.STAR_MATCHING_TXT')}
                        </Text>
                        <Text style={ds.starMatchTeaser}>{t('VIEWPROFILE.PAID_MEMBER_REPORT')}</Text>
                      </Pressable>
                    )
                  ) : (
                    <>
                      <Text style={ds.starMatchText}>9/10{t('STARMATCHING.STAR_MATCHING_TXT')}</Text>
                      <Text style={ds.starMatchTeaser}>{t('VIEWPROFILE.FREE_MEMBER_REPORT')}</Text>
                    </>
                  )
                )}
              </>
            )}

            {/* Angular's full visibility gate (viewprofile.page.html:821) hides this
                whole section when you've already added your own horoscope but this
                profile hasn't added theirs — see ViewProfileScreen.tsx's matching
                comment for the full explanation. */}
            {profile.showHoroSection && !sameGender &&
             ((profile.horoscopeAvailable && loginHoroAvail === '1') || loginHoroAvail === '0') && (
              <>
                <DesktopSectionHeader title={t('VIEWPROFILE.HORO_DETAILS')} />
                <View style={ds.row}>
                  <CdnSvg uri={ICON.horoscope} width={24} height={24} />
                  <View style={ds.rowLabelValue}>
                    <Text style={ds.label}>{t('VIEWPROFILE.HOROSCOPE')}</Text>
                    <View style={{ flex: 1 }}>
                      {loginHoroAvail === '0' ? (
                        <>
                          <Text style={ds.value}>{t('VIEWPROFILE.ADDYOURHORO').replace('#HIMHER#', t(`PRONOUN.${oppGender}.himhers`))}</Text>
                          <Pressable onPress={onAddHoroscope}><Text style={ds.actionLink}>{t('GENERAL.ADD_HOROSCOPE')}</Text></Pressable>
                        </>
                      ) : (
                        <Pressable onPress={onViewHoroscope}><Text style={ds.actionLink}>{t('GENERAL.VIEW_HOROSCOPE')}</Text></Pressable>
                      )}
                    </View>
                  </View>
                </View>
              </>
            )}

            {(profile.drinking || profile.smoking || profile.eatingHabits) && (
              <>
                <DesktopSectionHeader title={t('VIEWPROFILE.LIFE_STYLE')} />
                <View style={ds.rowsGroup}>
                  <DesktopDetailRow icon={ICON.drinking} label={t('VIEWPROFILE.DRINKINGHABIT')} value={profile.drinking} />
                  <DesktopDetailRow icon={ICON.smoking} label={t('VIEWPROFILE.SMOKINGHABIT')} value={profile.smoking} />
                  <DesktopDetailRow icon={ICON.eating} label={t('VIEWPROFILE.EATINGHABIT')} value={profile.eatingHabits} />
                </View>
              </>
            )}

            {(profile.brothers !== undefined || profile.sisters !== undefined) ? (
              <>
                <DesktopSectionHeader title={t('VIEWPROFILE.FAMILYDETAIL')} />
                <View style={ds.rowsGroup}>
                  <DesktopDetailRow
                    icon={ICON.brother}
                    label={t('VIEWPROFILE.BROTHERS')}
                    value={familyCountText(profile.brothers, t, {
                      none: 'VIEWPROFILE.NOBROTHERS', one: 'VIEWPROFILE.BROTHER',
                      many: 'VIEWPROFILE.BROTHERSS', moreThan: 'VIEWPROFILE.MORETHANBROTHER',
                    })}
                  />
                  <DesktopDetailRow
                    icon={ICON.sister}
                    label={t('VIEWPROFILE.SISTERS')}
                    value={familyCountText(profile.sisters, t, {
                      none: 'VIEWPROFILE.NOSISTERS', one: 'VIEWPROFILE.SISTER',
                      many: 'VIEWPROFILE.SISTERSS', moreThan: 'VIEWPROFILE.MORETHANSISTER',
                    })}
                  />
                </View>
              </>
            ) : ownProfile && (
              <>
                <DesktopSectionHeader title={t('VIEWPROFILE.FAMILYDETAIL')} />
                <Pressable style={ds.addDetailPrompt} onPress={onAddFamilyDetails}>
                  <CdnSvg uri={ICON.brother} width={20} height={20} />
                  <Text style={ds.addDetailPromptText}>{t('GENERAL.ADD_FAMILY_DETAILS')}</Text>
                </Pressable>
              </>
            )}

            {(profile.property.length > 0 || profile.vehicle.length > 0) ? (
              <>
                <DesktopSectionHeader title={t('VIEWPROFILE.PROPERTY_DETAILS')} />
                <View style={ds.rowsGroup}>
                  <DesktopDetailRow
                    icon={ICON.property}
                    label={t('VIEWPROFILE.PROPERTY_DETAILS')}
                    value={profile.property.map(p => p.label).join(', ') || undefined}
                  />
                  <DesktopDetailRow
                    icon={ICON.vehicle}
                    label={t('VIEWPROFILE.OWN_VEHICLE')}
                    value={profile.vehicle.map(v => v.label).join(', ') || undefined}
                  />
                </View>
              </>
            ) : ownProfile && (
              <>
                <DesktopSectionHeader title={t('VIEWPROFILE.PROPERTY_DETAILS')} />
                <Pressable style={ds.addDetailPrompt} onPress={onAddPropertyDetails}>
                  <CdnSvg uri={ICON.property} width={20} height={20} />
                  <Text style={ds.addDetailPromptText}>{t('BIO_DATA.ADD_PROPERTY_DETAILS')}</Text>
                </Pressable>
              </>
            )}
          </View>

          {!sameGender && menuPromo?.MATCHESSLOT && (
            // Only rendered — and only reserving its column width — when there's
            // an actual promo to show. An always-present empty rightCol reserved
            // 260px of dead space next to "Basic details" whenever there was no
            // promo, which made leftCol stop well short of the page's right edge
            // while the full-width "Similar profiles" section below it kept
            // spanning the whole row, so the two no longer lined up.
            //
            // Figma node 290:2854 wraps this same "become a paid member" content
            // in its OWN rounded-16 card (cream/gold gradient, soft shadow) — the
            // mobile MembershipBanner component underneath is reused as-is for its
            // content (server-driven TITLE/BENEFITS/CTA), just given the desktop
            // card's outer chrome instead of mobile's flat full-bleed banner look.
            <View style={s.rightCol}>
              <View style={s.sidebarCard}>
                <MembershipBanner data={menuPromo.MATCHESSLOT} onPress={onMembershipBannerPress} />
              </View>
            </View>
          )}
        </View>

        {/* ── Similar profiles ─────────────────────────────────────────────── */}
        {similarProfiles.length > 0 && (
          <LinearGradient
            colors={['#E6F5F0', 'rgba(230,245,240,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.similarSection, leftColWidth ? { width: leftColWidth } : null]}
          >
            <View style={s.similarHeaderRow}>
              <Text style={s.similarHeader}>
                {t('VIEWPROFILE.SIMILARPROFILES').replace('#NAME#', profile.name)}
              </Text>
            </View>
            <View style={s.similarListViewport}>
              <FlatList
                ref={similarListRef}
                data={similarProfiles}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={similarCardStride}
                decelerationRate="fast"
                onScroll={onSimilarScroll}
                scrollEventThrottle={32}
                keyExtractor={item => item.matriId}
                contentContainerStyle={s.similarListContent}
                renderItem={({ item }) => (
                  <SimilarProfileCardItem
                    card={item}
                    oppGender={oppGender}
                    t={t}
                    onPress={() => onSimilarProfilePress(item)}
                    size={similarCardSize}
                  />
                )}
              />
              {/* Angular: <app-swiper>'s navigation-module arrows — same dark
                  circular button look ViewProfileScreen.tsx's mobile version
                  and the hero photo swiper's desktop arrows already use. */}
              {similarIndex > 0 && (
                <Pressable style={[s.similarArrowBtn, s.similarArrowLeft]} onPress={() => scrollSimilarBy(-1)} hitSlop={8}>
                  <Text style={s.similarArrowText}>{'‹'}</Text>
                </Pressable>
              )}
              {similarIndex < similarProfiles.length - 1 && (
                <Pressable style={[s.similarArrowBtn, s.similarArrowRight]} onPress={() => scrollSimilarBy(1)} hitSlop={8}>
                  <Text style={s.similarArrowText}>{'›'}</Text>
                </Pressable>
              )}
            </View>
          </LinearGradient>
        )}
      </ScrollView>
    </View>
  )
}

// ─── Layout/nav/hero styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 32, paddingVertical: 14,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  logo: { fontFamily: 'Poppins-SemiBold', fontSize: 22, color: Colors.primary },
  langBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 8,
  },
  langText: { fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textDark },
  langChevron: { fontSize: 10, color: Colors.textSecondary },

  // Figma 141:36781 — condensed sticky bar (avatar+name / CTA / prev-next).
  stickyBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
    paddingHorizontal: 32, paddingVertical: 10, gap: 16,
    shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  stickyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 160 },
  stickyAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.divider },
  stickyName: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.black, maxWidth: 140 },
  stickyNav: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 160, justifyContent: 'flex-end' },

  scroll: { flex: 1 },
  content: { maxWidth: 1200, width: '100%', alignSelf: 'center', paddingHorizontal: 32, paddingVertical: 24 },

  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  paginationBack: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paginationText: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.black },
  paginationNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  neighborBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 40, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.borderNeutral, backgroundColor: Colors.white,
  },
  neighborAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.divider },
  neighborBtnText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.textDark },

  heroCard: {
    flexDirection: 'row', gap: 24, backgroundColor: Colors.white,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle,
    padding: 20, marginBottom: 24,
  },
  heroPhoto: {
    width: HERO_PHOTO_SIZE, height: HERO_PHOTO_SIZE, borderRadius: 10,
    overflow: 'hidden', backgroundColor: Colors.divider, flexShrink: 0,
  },
  heroContent: { flex: 1 },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  menuBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  menuDots: { fontSize: 20, lineHeight: 20, color: '#333333', fontWeight: '700' },
  menuDropdown: {
    position: 'absolute', top: 30, right: 0, minWidth: 200,
    backgroundColor: Colors.white, borderRadius: 8, paddingVertical: 4,
    shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6, zIndex: 10,
  },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  menuItemText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.textDark },
  menuItemDanger: { color: Colors.primary },

  name: { fontFamily: 'Poppins-SemiBold', fontSize: 22, color: Colors.black, marginTop: 12 },
  jodiId: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black, marginTop: 4 },
  basicInfo: { fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textSecondary, marginTop: 6, lineHeight: 18 },

  biodataCta: {
    height: 40, alignSelf: 'flex-start', paddingHorizontal: 20, marginTop: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryDark, borderRadius: 8,
  },
  biodataCtaText: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.white },

  twoColumn: { flexDirection: 'row', gap: 24 },
  // Figma node 310:11679 — the whole detail-sections column sits on its own
  // white rounded-24 card (soft shadow, no border), not flush against the page
  // background the way the earlier flat-sections version rendered it.
  leftCol: {
    flex: 804, backgroundColor: Colors.white, borderRadius: 24, padding: 40,
    shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  rightCol: { flex: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH },
  // Figma node 290:2855 — rounded-16, same soft shadow, cream→gold gradient
  // background under MembershipBanner's own (mobile-flat) content.
  sidebarCard: {
    borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFDF6',
    shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },

  // width:'100%' + overflow:'hidden' — expo-linear-gradient's web output doesn't
  // reliably inherit the parent column's default stretch-to-full-width sizing,
  // so without an explicit width the horizontal card row could push this section
  // wider than the rest of the page content (spilling past where the "Basic
  // details"/"Family details" card ends, all the way toward the raw browser
  // edge) instead of closing at the same right edge as everything above it.
  similarSection: { width: '100%', overflow: 'hidden', marginTop: 32, paddingVertical: 24, borderRadius: 12 },
  similarHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIMILAR_LIST_PADDING },
  similarHeader: { fontFamily: 'Poppins-SemiBold', fontSize: 20, color: Colors.black, marginBottom: 12 },
  similarListContent: { paddingHorizontal: SIMILAR_LIST_PADDING, gap: SIMILAR_CARD_GAP },
  // No explicit width needed — this stretches to fill similarSection, which is
  // itself already pinned to leftColWidth (see the inline style override on
  // the LinearGradient above). overflow:'hidden' just clips the arrows/cards
  // to that same boundary.
  similarListViewport: { overflow: 'hidden' },
  // Same dark circular button look ViewProfileScreen.tsx's mobile Similar
  // Profiles arrows and the hero photo swiper's desktop arrows already use.
  similarArrowBtn: {
    position: 'absolute', top: '50%', marginTop: -16,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  similarArrowLeft:  { left: 8 },
  similarArrowRight: { right: 8 },
  similarArrowText: { color: Colors.white, fontSize: 20, lineHeight: 20 },
})

// ─── CTA + detail-row styles ───────────────────────────────────────────────────
const ds = StyleSheet.create({
  rowsGroup: { gap: 16, marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  rowLabelValue: { flex: 1, flexDirection: 'row', gap: 8 },
  label: { width: 170, fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black },
  value: { flex: 1, fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.black },
  actionLink: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.link, marginTop: 4 },
  addDetailPrompt: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  addDetailPromptText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.link },

  sectionHeader: { fontFamily: 'Poppins-SemiBold', fontSize: 20, color: Colors.black, marginTop: 48 },
  sectionHeaderFirst: { marginTop: 0 },

  starMatchText:   { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.textDark, marginTop: 8 },
  starMatchTeaser: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.link, marginTop: 8 },

  ctaRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  ctaDontShow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, paddingHorizontal: 16, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: '#545454', borderRadius: 8,
  },
  ctaDontShowText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#545454' },
  ctaViewLater: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, paddingHorizontal: 16, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: '#545454', borderRadius: 8,
  },
  ctaViewLaterText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#545454' },
  ctaDisabled: { opacity: 0.4 },
  ctaLike: {
    height: 44, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primaryDark, borderRadius: 8,
  },
  ctaLikeText: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.white },
  ctaCompact: { height: 36, paddingHorizontal: 12 },

  afterLikeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16,
    backgroundColor: Colors.afterLikeBg, borderRadius: 8, borderWidth: 1, borderColor: Colors.afterLikeBorder,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  afterLikeText: { flex: 1, fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.black },
  ctaSendInterestWrap: { position: 'relative', flexShrink: 0 },
  ctaSendInterest: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 40, backgroundColor: Colors.primaryDark, borderRadius: 8, paddingHorizontal: 16,
  },
  ctaSendInterestText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.white },
  freeBadge: {
    position: 'absolute', top: -10, right: 8, zIndex: 1,
    backgroundColor: Colors.badgeNewBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  freeBadgeText: { fontFamily: 'Poppins-SemiBold', fontSize: 10, color: Colors.badgeNewText },
  contactsLeftText: { fontFamily: 'Poppins-Regular', fontSize: 11, color: Colors.textSecondary },
})
