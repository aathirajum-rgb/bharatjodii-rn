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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SvgUri } from 'react-native-svg'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import { Colors } from '../../constants/colors'
import type { SwiperItem } from '../../components/swiper-card/SwiperCard'
import {
  fetchMatches,
  fetchNotifCount,
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

const CDN = 'https://imgs.jodii.app/assets/images/svg/'

const LANG_LABELS: Record<string, string> = {
  en: 'English', tm: 'Tamil', tl: 'Telugu', hi: 'Hindi',
  ml: 'Malayalam', kn: 'Kannada', bn: 'Bengali', mt: 'Marathi',
  or: 'Odia', gj: 'Gujarati', pa: 'Punjabi',
}

// ─── Filter chips data ────────────────────────────────────────────────────────
// Angular: quickFilterList in filter.config.ts — 4 chips in horizontal scroll row.
// FILTER chip always shows icon on left. Others show icon only when selected (close icon).
const FILTER_CHIPS = [
  { key: 'FILTER',             label: 'Filters',         icon: CDN + 'revamp/filter-revamp.svg' },
  { key: 'PROFILECREATED',     label: 'Recently Joined', icon: CDN + 'menu/filter-profile-created.svg' },
  { key: 'PHOTOAVAILABLE',     label: 'With photos',     icon: CDN + 'menu/filter-with-photos.svg' },
  { key: 'HOROSCOPEAVAILABLE', label: 'With Horoscope',  icon: CDN + 'menu/filter-horoscope.svg' },
] as const

const { width: SW } = Dimensions.get('window')
// Angular: photoHeight = (scrWidth - 32) + 'px' — matches-card left+right 16px margin each
const PHOTO_H = SW - 32

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchProfile {
  profileId:    string
  name:         string
  age:          string     // "27"
  location:     string     // city, state
  height?:      string
  education?:   string
  occupation?:  string
  income?:      string
  caste?:       string
  profileImg?:  string
  isPaidMember:      boolean
  isIdVerified:      boolean
  isPhotoAvailable:  boolean  // PHOTOSTATUS=1
  isPhotoProtect:    boolean  // PHOTOPRIVACY=1
  likedStatus:      '0' | '1' | '2' | '3'  // 0=none 1=liked 2=shortlisted 3=declined
  isNewlyJoined:    boolean
  isNewLabel:       boolean   // activity label row visible
  labelContent:     string    // "Viewed on 15 Jan" / "Shortlisted on …"
  likedDateText?:   string   // "You liked this profile on 16-Jan-2026"
}

// ─── HTML inline renderer ─────────────────────────────────────────────────────
// Angular uses [innerHTML] for dynamic server HTML. This handles the common cases:
// <span style="color:#xx">text</span> → colored Text node
// <b>/<strong> → bold Text node
// <br> → newline character

// Renders server HTML as styled React Native Text.
// Handles <span style="color:..."> (colored text) and <br> (newline).
function HtmlText({ html, style }: { html: string; style?: any }) {
  if (!html) return null
  const cleaned = html.replace(/<br\s*\/?>/gi, '\n')
  const segs: Array<{ text: string; color: string | null }> = []
  const spanRe = /<span[^>]*?style="([^"]*)"[^>]*>([\s\S]*?)<\/span>/gi
  let last = 0
  let sm: RegExpExecArray | null
  while ((sm = spanRe.exec(cleaned)) !== null) {
    if (sm.index > last) {
      segs.push({ text: cleaned.slice(last, sm.index).replace(/<[^>]*>/g, ''), color: null })
    }
    const colorM = sm[1].match(/color:\s*([^;]+)/)
    segs.push({ text: sm[2].replace(/<[^>]*>/g, ''), color: colorM ? colorM[1].trim() : null })
    last = sm.index + sm[0].length
  }
  if (last < cleaned.length) {
    segs.push({ text: cleaned.slice(last).replace(/<[^>]*>/g, ''), color: null })
  }
  if (segs.length === 0) segs.push({ text: cleaned.replace(/<[^>]*>/g, ''), color: null })
  return (
    <Text style={style}>
      {segs.map((seg, i) =>
        seg.color
          ? <Text key={i} style={{ color: seg.color }}>{seg.text}</Text>
          : <Text key={i}>{seg.text}</Text>
      )}
    </Text>
  )
}

// Banner item (STATUS=599 items injected by API, e.g. BANNERSLOT='1001' = membership)
interface BannerItem {
  _isBanner: true
  bannerSlot: string
  uid:        string
}

type MatchListItem = MatchProfile | BannerItem

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Angular: bindBasicView() — order: age | height | caste | education | occupation | location
function buildBasicViewParts(p: MatchProfile): string[] {
  const parts: string[] = []
  if (p.age)        parts.push(`${p.age} yrs`)
  if (p.height)     parts.push(p.height)
  if (p.caste)      parts.push(p.caste)
  if (p.education)  parts.push(p.education)
  if (p.occupation) parts.push(p.occupation)
  if (p.location)   parts.push(p.location)
  return parts
}

// Angular: FUNC.showLikeCTA(likedStatus) — show Like/Don't Show/View Later when not yet liked/declined
function showLikeCTA(status: MatchProfile['likedStatus']): boolean {
  return status === '0'
}

// Angular: FUNC.showAfterLikeContent(likedStatus) — show Send Interest / chat CTA after like
function showAfterLikeCTA(status: MatchProfile['likedStatus']): boolean {
  return status === '1' || status === '2'
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
              uri={CDN + (oppGender === 'F' ? 'revamp/profile-photo-blur.svg' : 'profile-blur-male.svg')}
              width="100%" height="100%"
              style={StyleSheet.absoluteFill}
            />
            <View style={c.photoOverlay}>
              <View style={c.overlayCard}>
                <Text style={c.overlayText}>
                  {`Contact and Get ${oppGender === 'F' ? 'her' : 'his'} Photos on WhatsApp`}
                </Text>
                <Pressable style={c.waBtn} onPress={onWhatsApp}>
                  <SvgUri uri={CDN + 'whatsapp-revamp.svg'} width={18} height={18} />
                  <Text style={c.waBtnText}>WhatsApp</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* Angular: .newly-joined posabsolute — star SVG + "New" text, top-left of photo */}
        {profile.isNewlyJoined && (
          <View style={c.newBadge} pointerEvents="none">
            <SvgUri uri={CDN + 'revamp/newly-joined-star.svg'} width={14} height={14} />
            <Text style={c.newBadgeText}>New</Text>
          </View>
        )}
      </Pressable>

      {/* ── Paid + Verified badges ─────────────────────────────────────────── */}
      {/* Angular: ion-row isProfileBadge — BELOW the photo, not overlaid */}
      {(profile.isPaidMember || profile.isIdVerified) && (
        <View style={c.badges}>
          {profile.isPaidMember && (
            <SvgUri uri={CDN + 'revamp/paid-tag-revamp.svg'} width={80} height={24} />
          )}
          {profile.isIdVerified && (
            <SvgUri uri={CDN + 'viewprofile/verified-tag-img.svg'} width={100} height={24} />
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
          <SvgUri uri={CDN + 'revamp/call-revamp.svg'} width={24} height={24} />
        </Pressable>
        <Pressable style={c.iconBtn} onPress={onWhatsApp} hitSlop={8}>
          <SvgUri uri={CDN + 'whatsapp-revamp.svg'} width={28} height={28} />
        </Pressable>
      </View>

      {/* ── Basic view text ────────────────────────────────────────────────── */}
      {/* Figma: Poppins-Regular 14px black, | separators at rgba(0,0,0,0.2), gap 12px below nameRow */}
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
      {/* Figma: "View full profile", #29339B, gap 16px above */}
      <Pressable onPress={onPress} style={c.viewProfileBtn}>
        <Text style={c.viewProfileText}>View full profile</Text>
      </Pressable>

      {/* ── CTA section ────────────────────────────────────────────────────── */}
      {/* Angular: showLikeCTA → Don't Show | View Later | Like
                  showAfterLikeCTA → Send Interest / after-like state */}
      {showLikeCTA(profile.likedStatus) && (
        // Angular: Row 1 = tertiary (Don't show) + secondary (View later), Row 2 = primary (Like) full-width
        <View style={c.ctaSection}>
          <View style={c.ctaSecRow}>
            <Pressable style={c.ctaDontShow} onPress={onDontShow}>
              <SvgUri uri={CDN + 'revamp/close-icon.svg'} width={16} height={16} />
              <Text style={c.ctaDontShowText}>Don't Show</Text>
            </Pressable>
            <Pressable style={c.ctaViewLater} onPress={onViewLater}>
              <SvgUri uri={CDN + 'view-later.svg'} width={16} height={16} />
              <Text style={c.ctaViewLaterText}>View Later</Text>
            </Pressable>
          </View>
          <Pressable style={c.ctaLike} onPress={onLike}>
            <SvgUri uri={CDN + 'revamp/like-white-revamp.svg'} width={20} height={20} />
            <Text style={c.ctaLikeText}>Like</Text>
          </Pressable>
        </View>
      )}

      {showAfterLikeCTA(profile.likedStatus) && (
        // Angular: matches-cta-bg-color (pink gradient bg) + getContentAfterLike() text + "Send interest" CTA
        <View style={c.afterLikeRow}>
          <Text style={c.afterLikeText}>
            {`Contact ${oppGender === 'F' ? 'her' : 'him'} to connect`}
          </Text>
          <Pressable style={c.ctaSendInterest} onPress={onPress}>
            <Text style={c.ctaSendInterestText}>Send Interest</Text>
          </Pressable>
        </View>
      )}

    </View>
  )
}

// ─── SwiperItem → MatchProfile mapper ────────────────────────────────────────

function toMatchProfile(item: SwiperItem): MatchProfile {
  // exactOptionalPropertyTypes: assign optional strings only when defined
  const p: MatchProfile = {
    profileId:        item.profileId        ?? '',
    name:             item.name             ?? '',
    age:              item.age?.replace(/\s*(yrs|years)/i, '').trim() ?? '',
    location:         item.location         ?? '',
    isPaidMember:     item.isPaidMember      ?? false,
    isIdVerified:     item.isIdVerified      ?? false,
    isPhotoAvailable: item.isPhotoAvailable  ?? false,
    isPhotoProtect:   item.isPhotoProtect    ?? false,
    likedStatus:      item.likedStatus       ?? '0',
    isNewlyJoined:    item.isNewlyJoined     ?? false,
    isNewLabel:       item.isNewLabel        ?? false,
    labelContent:     item.labelContent      ?? '',
  }
  if (item.height)              p.height       = item.height
  if (item.education)           p.education    = item.education
  if (item.occupation)          p.occupation   = item.occupation
  if (item.income)              p.income       = item.income
  if (item.caste)               p.caste        = item.caste
  if (item.profileImg)          p.profileImg   = item.profileImg
  if (item.likedViewedDateText) p.likedDateText = item.likedViewedDateText
  return p
}

// ─── Filter Chips Row ─────────────────────────────────────────────────────────
// Angular: quickFilterList in filter.config.ts — horizontal swiper row below header.
// Chip height 40px, border-radius 20px, border #B0B0B0.
// Selected state: border rgba(181,0,51,0.4), bg #FAE7ED.
// FILTER chip always shows icon on left. Others show close icon on right when selected.

function FilterChipsRow({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (key: string) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={f.row}
      style={f.scroll}
    >
      {FILTER_CHIPS.map(chip => {
        const isSelected = selected === chip.key
        const isFilterChip = chip.key === 'FILTER'
        return (
          <Pressable
            key={chip.key}
            style={[f.chip, isSelected && f.chipSelected]}
            onPress={() => onSelect(isSelected && !isFilterChip ? '' : chip.key)}
          >
            {/* FILTER chip: icon always on left */}
            {isFilterChip && (
              <SvgUri uri={chip.icon} width={16} height={16} style={{ marginRight: 4 }} />
            )}
            <Text style={[f.chipText, isSelected && f.chipTextSelected]}>
              {chip.label}
            </Text>
            {/* Other chips: icon on right when selected (close/check) */}
            {!isFilterChip && isSelected && (
              <SvgUri uri={chip.icon} width={14} height={14} style={{ marginLeft: 4 }} />
            )}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

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
        colors={['#FFDDDD', '#FFFFFF']}
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
  const textColor = isWhite ? '#FFFFFF' : '#1A1A1A'

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
  const ctaBg   = data.CTABGCOLOR || '#1C644C'

  return (
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={['#F2F4FF', '#DCFFF0']}
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
          <Text style={e.countLabel}>more</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={e.title}>Continue seeing profiles</Text>

      {/* Description */}
      <Text style={e.desc}>
        You have seen all the matches based on your preferences.
        View matches as per Jodii recommendation
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
  const insets = useSafeAreaInsets()
  const { i18n } = useTranslation()

  // ── State ───────────────────────────────────────────────────────────────────
  const [profiles,     setProfiles]     = useState<MatchProfile[]>([])
  const [totalCount,   setTotalCount]   = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [notifCount,     setNotifCount]     = useState(0)
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

  function handleTitleLayout(e: any) {
    const h = e.nativeEvent.layout.height
    if (h > 0) titleHRef.current = h
  }

  function handleHeaderLayout(e: any) {
    const h = e.nativeEvent.layout.height
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

        setProfiles(result.items.map(toMatchProfile))
        setBannerSlots(result.bannerSlots)
        setTotalCount(result.totalCount)
        apiStartRef.current = result.items.length  // cursor for next page

        // Step 3 — Angular: parallel post-matches calls
        // newcount + extendedmatches + ppSetData + dailyRecommendations + menuPromo
        const [count, extCount, , promo] = await Promise.all([
          fetchNotifCount(),
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
                  (!v || v === 'primaryBg') ? '#B50033' : (v.startsWith('#') ? v : '#B50033')
                const resolveColor = (v: string) =>
                  (!v || v === 'whiteColor') ? '#FFFFFF' : (v.startsWith('#') ? v : '#FFFFFF')
                setShowPhotoPromotion(true)
                setPhotoBannerData({
                  TITLE:     banner.TITLE     || 'Profile not active yet!',
                  BODY:      banner.BODY      || 'Upload your photo to activate profile and let matches see you',
                  CTA:       banner.CTA       || 'Add photo now',
                  BANNERIMG: banner.BANNERIMG || '',
                  CTABGCOLOR: resolveBg(banner.CTABGCOLOR),
                  CTACOLOR:   resolveColor(banner.CTACOLOR),
                  BGCOLOR:    'rgba(181, 0, 51, 0.05)',
                })
              }
            } catch (err) {
              console.log('[PhotoBanner] error in banner check:', err)
            }
          }),
          fetchMenuPromo(),
        ])
        if (!cancelled) {
          setNotifCount(count)
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
          return [...prev, ...result.items.map(toMatchProfile)]
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

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {/* Angular: ion-header header-shadow (0 8px 16px rgba(0,0,0,0.08)) */}
      {/* Absolutely positioned so translateY slides it off-screen without shifting list */}
      <Animated.View
        style={[s.header, s.headerAbsolute, { transform: [{ translateY: headerAnim }] }]}
        onLayout={handleHeaderLayout}
      >

        {/* Title section — Angular: ion-grid pl-24, bottom-border-e5e5e5 */}
        {/* onLayout measures titleH = Angular offsetHt (only the title row that gets hidden) */}
        <View style={s.titleSection} onLayout={handleTitleLayout}>
          {/* Title row — Angular: ion-row mt-16 mb-16 pr-16 */}
          <View style={s.titleRow}>
            <Text style={s.title}>{loading ? 'Matches' : `Matches (${totalCount})`}</Text>
            <View style={s.headerRight}>
              <Pressable style={s.bellBtn} onPress={() => {}} hitSlop={8}>
                <SvgUri uri={CDN + 'revamp/home-notification.svg'} width={22} height={22} />
                {notifCount > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{notifCount > 99 ? '99+' : notifCount}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable style={s.langBtn} onPress={() => navigation.navigate('LanguageSelection')} hitSlop={8}>
                <SvgUri uri={CDN + 'revamp/lang-change-img.svg'} width={18} height={18} />
                <Text style={s.langText}>{LANG_LABELS[i18n.language] ?? 'English'}</Text>
                <Text style={s.langChevron}>{'›'}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Pref row — Angular: ion-grid padd0 → div pl-16 mt-4 */}
        <View style={s.prefSection}>
          <View style={s.prefRow}>
            <Text style={s.prefText}>{totalCount} profiles based on your preferences. </Text>
            <Pressable style={s.editPref} onPress={() => {}} hitSlop={8}>
              <Text style={s.editPrefText}>Edit preferences</Text>
              <SvgUri uri={CDN + 'registration-new/edit-pencil.svg'} width={14} height={14} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
        </View>

        {/* Filter chips — Angular: ion-cust-padding-start = paddingLeft 24 */}
        <FilterChipsRow selected={selectedChip} onSelect={setSelectedChip} />
      </Animated.View>

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

  // Floats over the list so translateY slides header off without reflowing list
  headerAbsolute: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    zIndex:   10,
  },

  // Angular: ion-header header-shadow = box-shadow 0 8px 16px rgba(0,0,0,0.08)
  header: {
    backgroundColor: Colors.white,
    shadowColor:     '#000000',
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.08,
    shadowRadius:    16,
    elevation:       4,
  },
  // Angular: first ion-grid pl-24 + bottom-border-e5e5e5
  titleSection: {
    paddingLeft:       24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  // Angular: ion-row mt-16 mb-16 pr-16
  titleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      16,
    marginBottom:   16,
    paddingRight:   16,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   18,
    color:      '#333333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  // Notification bell + badge — Angular: notificationService badge count
  bellBtn: { position: 'relative', padding: 4 },
  bellIcon: { width: 22, height: 22 },
  badge: {
    position:        'absolute',
    top:             0,
    right:           0,
    minWidth:        16,
    height:          16,
    borderRadius:    8,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontFamily: 'Poppins-SemiBold', fontSize: 9, color: Colors.white },
  // Angular: app-dropdown languageChanges — lang icon + label + chevron
  langBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  langIcon:    { width: 18, height: 18 },
  langText:    { fontFamily: 'Poppins-Medium', fontSize: 12, color: '#333333' },
  langChevron: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#333333', transform: [{ rotate: '90deg' }] },

  // Angular: second ion-grid padd0 → div pl-16 mt-4
  prefSection: {
    paddingLeft: 16,
    marginTop:   4,
  },
  prefRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    alignItems:    'center',
  },
  prefText:    { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#333333' },
  editPref:    { flexDirection: 'row', alignItems: 'center' },
  editPrefText:{ fontFamily: 'Poppins-Regular', fontSize: 14, color: '#29339B' },
  editPrefIcon:{ width: 14, height: 14, marginLeft: 4 },
})

// Angular card styles — matches-card.component.scss
const c = StyleSheet.create({
  // Angular: vs-item pt-16 pb-24 matches-card-border (border-bottom: 8px solid #E6E6E6)
  card: {
    backgroundColor:   Colors.white,
    paddingTop:        16,
    borderBottomWidth: 8,
    borderBottomColor: '#E6E6E6',
  },

  // Angular: img-holder pl-16 pr-16 with brdr-radius (top-left + top-right radius 16)
  photoBox: {
    marginHorizontal: 16,
    borderTopLeftRadius:  16,
    borderTopRightRadius: 16,
    overflow:         'hidden',
    backgroundColor:  '#F0F0F0',
  },
  photo: { width: '100%', height: '100%' },

  // Angular no-photo placeholder
  noPhoto:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  noPhotoIcon: { width: 56, height: 56, opacity: 0.35 },
  noPhotoText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#AAAAAA' },

  // Angular: .newly-joined posabsolute — uses newly-joined.svg as bg, top-left of photo
  newBadge: {
    position:      'absolute',
    top:           0,
    left:          0,
    flexDirection: 'row',
    alignItems:    'center',
    backgroundColor: '#B50033',
    paddingVertical:   4,
    paddingLeft:       12,
    paddingRight:      20,
    borderBottomRightRadius: 12,
    gap: 4,
  },
  newBadgeText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   12,
    color:      '#FFFFFF',
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
    color:      '#000000',
    flex:       1,
  },

  // Angular: getContentAfterLike() text above Send Interest CTA
  afterLikeText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      '#000000',
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
    backgroundColor:   'rgba(0,0,0,0.7)',
    marginHorizontal:  24,
    paddingVertical:   8,
    paddingHorizontal: 16,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.4)',
    alignItems:        'center',
    width:             '80%',
  },
  overlayText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   13,
    color:      '#FFFFFF',
    textAlign:  'center',
    lineHeight: 18,
  },
  // Angular: EButtonBackground.whatsApp — green WhatsApp CTA
  waBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   '#25D366',
    borderRadius:      8,
    paddingVertical:   8,
    paddingHorizontal: 16,
    marginTop:         8,
    gap:               6,
  },
  waBtnText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   13,
    color:      '#FFFFFF',
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
    backgroundColor:  '#FFEAF7',
    paddingHorizontal: 8,
    paddingVertical:   4,
    gap:              4,
  },
  likedIcon: { width: 20, height: 20, flexShrink: 0 },
  likedText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#96286E', flex: 1 },

  // Angular: d-flex align-center-item mt-12 pl-16 pr-16
  nameRow: {
    flexDirection:    'row',
    alignItems:       'center',
    marginTop:        12,
    paddingHorizontal: 16,
    gap:              12,
  },
  name:       { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: '#000000' },
  iconBtn:    { flexShrink: 0 },
  nameRowIcon:  { width: 24, height: 24 },
  nameRowIconWa:{ width: 28, height: 28 },

  // Figma: Poppins-Regular 14px, black text, gap 12px below nameRow
  basicView: {
    fontFamily:        'Poppins-Regular',
    fontSize:          14,
    color:             '#000000',
    lineHeight:        20,
    marginTop:         12,
    paddingHorizontal: 16,
  },
  // Figma: | separators at rgba(0,0,0,0.2)
  basicViewSep: { color: 'rgba(0,0,0,0.2)' },

  // Figma: "View full profile", #29339B, 16px gap above
  viewProfileBtn: {
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:     8,
  },
  viewProfileText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      '#29339B',
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
    borderColor:    '#CCCCCC',
    borderRadius:   8,
    paddingVertical: 12,
  },
  ctaDontShowText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: '#333333' },

  ctaViewLater: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    borderWidth:    1,
    borderColor:    '#CCCCCC',
    borderRadius:   8,
    paddingVertical: 12,
  },
  ctaViewLaterText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: '#333333' },

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
    backgroundColor:  '#FCEAF0',
    borderTopWidth:   1,
    borderTopColor:   '#F5BDD0',
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
    shadowColor:      '#000',
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
    backgroundColor: '#F0F0F0',
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
    color:      '#4C4C4C',
    textAlign:  'center',
    marginBottom: 8,
  },
  desc: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      '#666666',
    textAlign:  'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  progressTrack: {
    width:           '100%',
    height:          4,
    borderRadius:    2,
    backgroundColor: '#E6E6E6',
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
    borderBottomColor: '#E6E6E6',
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
    color:      '#000000',
    lineHeight: 22,
  },
  // Angular: mt-8 body3-regular-12 black-color
  body: {
    fontFamily: 'Poppins-Regular',
    fontSize:   12,
    color:      '#000000',
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
    borderBottomColor: '#E6E6E6',
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
    color:      '#000000',
    lineHeight: 32,
  },
  // Angular: body1-medium-14 black-color
  subheader: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      '#000000',
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
    color:      '#8A8A8A',
    lineHeight: 22,
    flexShrink: 0,
  },
  // Angular: body2-regular-14 black-color
  bulletText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      '#000000',
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
    color:      '#FFFFFF',
  },
})

// ─── Membership banner styles ────────────────────────────────────────────────
// Angular: app-breather PAYMENT type — matches-breather-block with BGIMG background

const mb = StyleSheet.create({
  // Angular: matches-breather-block — full card with BGIMG as right-side image
  card: {
    backgroundColor:   '#FFFBF0',
    borderBottomWidth: 8,
    borderBottomColor: '#E6E6E6',
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
    color:      '#1A1A1A',
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      '#333333',
    marginTop:  4,
    lineHeight: 22,
  },
  valid: {
    fontFamily:      'Poppins-Regular',
    fontSize:        12,
    color:           '#2E7D32',
    marginTop:       6,
    backgroundColor: '#E8F5E9',
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
    color:      '#333333',
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

// ─── Filter chips styles ──────────────────────────────────────────────────────
// Angular chip.component.scss: height 40, padding 8x16, border-radius 20,
// border #B0B0B0 default, border rgba(181,0,51,0.4) + bg #FAE7ED selected.

const f = StyleSheet.create({
  scroll: {
    flexShrink: 0,
    height:     58,  // chip 40px + paddingTop 12 + paddingBottom 6 — explicit so parent measures correctly
  },
  row: {
    paddingLeft:   16,
    paddingRight:  16,
    paddingTop:    12,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  chip: {
    height:          40,
    paddingHorizontal: 16,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     '#B0B0B0',
    backgroundColor: '#FFFFFF',
    flexDirection:   'row',
    alignItems:      'center',
    flexShrink:      0,
  },
  chipSelected: {
    borderColor:     'rgba(181,0,51,0.4)',
    backgroundColor: '#FAE7ED',
  },
  chipText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      '#1F1E1B',
  },
  chipTextSelected: {
    color: Colors.primary,
  },
})
