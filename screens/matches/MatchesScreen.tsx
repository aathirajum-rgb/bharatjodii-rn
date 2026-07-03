// Angular equivalent: pages/matches/matches.page.ts + matches-card.component
// Landing page for existing users after login (WEBVIEWURL page_id = 60)
// Card layout mirrors matches-card.component.html exactly.

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { SvgUri, SvgXml } from 'react-native-svg'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import MatchesHeader from '../../components/matches-header/MatchesHeader'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { matchProfileAdapter } from '../../adapters/matches.adapter'
import type { MatchProfile, BannerItem, MatchListItem } from '../../types/interfaces/matches.interface'
import {
  fetchMatches,
  fetchExtendedMatchesCount,
  fetchNotifCount,
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

// ─── Card icons ────────────────────────────────────────────────────────────────
// Angular (matches-card.component.html): Call + WhatsApp are <img src="CDN/...svg">
// (server fetch); Don't-show/View-later/Like render via <ion-icon class="{{iconType}}">
// — a locally registered/bundled icon, never networked. We mirror that:
// Call/WhatsApp = SvgUri (always calls the server, no caching), the rest = SvgXml
// (bundled strings).

const XML_CLOSE = `<svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<mask id="mask0_7130_3376" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="4" y="4" width="17" height="16">
<rect x="4.5" y="4" width="16" height="16" fill="#D9D9D9"/>
</mask>
<g mask="url(#mask0_7130_3376)">
<path d="M18.5 6L6.5 18" stroke="#545454" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M6.5 6L18.5 18" stroke="#545454" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
</g>
</svg>`

const XML_VIEW_LATER = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M17.5765 6.34158C14.3389 3.21947 9.07045 3.21947 5.83915 6.34158L5.27719 6.87732V4.88213C5.27719 4.54344 4.98982 4.26633 4.63859 4.26633C4.28737 4.26633 4 4.54344 4 4.88213V8.57693C4 8.91562 4.28737 9.19273 4.63859 9.19273H8.47017C8.82139 9.19273 9.10876 8.91562 9.10876 8.57693C9.10876 8.23824 8.82139 7.96113 8.47017 7.96113H5.96049L6.73957 7.20985C9.47915 4.56808 13.9365 4.56808 16.6761 7.20985C19.4157 9.85163 19.4157 14.1499 16.6761 16.7917C13.9365 19.4335 9.47915 19.4335 6.73957 16.7917C6.49052 16.5515 6.08821 16.5515 5.83915 16.7917C5.5901 17.0318 5.5901 17.4198 5.83915 17.66C7.4548 19.2179 9.58132 20 11.7078 20C13.8344 20 15.9609 19.2179 17.5765 17.66C20.8078 14.5379 20.8078 9.46368 17.5765 6.34158Z" fill="#545454" stroke="#545454" stroke-width="0.505263"/>
<path d="M12.0527 7.69019C11.7014 7.69019 11.4141 7.9673 11.4141 8.30598V12.0008C11.4141 12.1855 11.5035 12.3641 11.6567 12.4811L14.8497 14.9443C14.9647 15.0367 15.1051 15.0798 15.2456 15.0798C15.4308 15.0798 15.616 14.9997 15.7437 14.8458C15.9609 14.581 15.9162 14.193 15.6416 13.9775L12.6913 11.7052V8.30598C12.6913 7.9673 12.4039 7.69019 12.0527 7.69019Z" fill="#545454" stroke="#545454" stroke-width="0.505263"/>
</svg>`

const XML_LIKE = `<svg width="18" height="19" viewBox="0 0 18 19" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M18 10.9354C18 10.3361 17.7268 9.76202 17.3047 9.38748C17.6027 8.98799 17.7268 8.48862 17.6772 7.98946C17.5779 6.94089 16.6344 6.09212 15.5421 6.09212H12.3145L12.5132 4.54423C12.5627 4.07 12.5627 3.67052 12.4636 3.27105C12.0911 1.64841 10.6513 0.5 8.98777 0.5C8.61526 0.5 8.24296 0.649701 7.96978 0.924402C7.6966 1.1991 7.54771 1.54855 7.54771 1.92289V3.96994C7.54771 4.86879 7.29951 5.71757 6.82771 6.49143L5.95882 7.88945C5.83472 8.08919 5.66086 8.23889 5.46221 8.33876C5.28835 7.78957 4.79196 7.39009 4.19604 7.39009L1.34072 7.3903C0.595915 7.3903 0 7.98952 0 8.73845V17.1519C0 17.9008 0.595915 18.5 1.34072 18.5H4.24558C4.99039 18.5 5.5863 17.9008 5.5863 17.1519V16.9521C6.23176 17.5262 7.0759 17.8758 7.9946 17.8758H14.3008C14.8718 17.8758 15.4429 17.6263 15.8402 17.2268C16.2374 16.8274 16.4361 16.3031 16.4111 15.7539C16.4111 15.5541 16.3863 15.3793 16.3118 15.1798C16.9821 14.8303 17.4291 14.1312 17.4291 13.3322C17.4291 13.0575 17.3795 12.783 17.2802 12.5333C17.7268 12.1089 18 11.5348 18 10.9355L18 10.9354ZM4.3202 17.1268C4.3202 17.1766 4.27064 17.2267 4.22088 17.2267H1.34075C1.2912 17.2267 1.24143 17.1768 1.24143 17.1268V8.7134C1.24143 8.66357 1.29099 8.61353 1.34075 8.61353H4.24562C4.29518 8.61353 4.34494 8.66337 4.34494 8.7134V17.1268H4.3202ZM16.2873 11.6845C16.0886 11.7843 15.9397 11.9591 15.89 12.1838C15.8404 12.4085 15.89 12.6331 16.0388 12.808C16.1629 12.9577 16.2127 13.1325 16.2127 13.3073C16.2127 13.7068 15.9147 14.0563 15.5174 14.1312C15.2692 14.181 15.0458 14.331 14.9465 14.5805C14.8471 14.8301 14.8719 15.0799 15.021 15.3045C15.1203 15.4293 15.1699 15.6041 15.1699 15.7788C15.1699 15.9785 15.0954 16.2032 14.9465 16.3529C14.7726 16.5277 14.5244 16.6276 14.2762 16.6276H7.97003C6.65406 16.6276 5.56173 15.5541 5.56173 14.2059V9.61245C6.18244 9.46275 6.70381 9.08818 7.05133 8.53901L7.92023 7.14099C8.51614 6.19232 8.83887 5.09394 8.83887 3.97041V1.92336C8.83887 1.87353 8.86365 1.82349 8.88843 1.79857C8.91321 1.77366 8.96297 1.74874 9.01253 1.74874C10.1049 1.74874 11.0235 2.49767 11.2719 3.54624C11.3215 3.7709 11.3465 4.0456 11.2967 4.37013L11.0733 6.11776C11.0237 6.41737 11.1229 6.71697 11.3215 6.96658C11.5201 7.19124 11.8181 7.34115 12.1161 7.34115H15.5423C15.9644 7.34115 16.3864 7.6906 16.4362 8.09008C16.461 8.3897 16.3121 8.6893 16.0637 8.86395C15.8403 9.01365 15.7162 9.28835 15.7409 9.56306C15.7657 9.83776 15.9396 10.0624 16.2126 10.1623C16.5353 10.2871 16.7339 10.5867 16.7339 10.9361C16.7589 11.2601 16.5853 11.5347 16.2873 11.6844L16.2873 11.6845Z" fill="white"/>
</svg>`

type IconProps = { width?: number; height?: number }

function WhatsAppIcon({ width = 27, height = 27 }: IconProps) {
  return <SvgUri uri={CDN + 'whatsapp-revamp.svg'} width={width} height={height} />
}

function CallIcon({ width = 24, height = 25 }: IconProps) {
  return <SvgUri uri={CDN + 'revamp/call-revamp.svg'} width={width} height={height} />
}

function CloseIcon({ width = 25, height = 24 }: IconProps) {
  return <SvgXml xml={XML_CLOSE} width={width} height={height} />
}

function ViewLaterIcon({ width = 24, height = 24 }: IconProps) {
  return <SvgXml xml={XML_VIEW_LATER} width={width} height={height} />
}

function LikeIcon({ width = 18, height = 19 }: IconProps) {
  return <SvgXml xml={XML_LIKE} width={width} height={height} />
}

const { width: SW } = Dimensions.get('window')
// Angular: photoHeight = (scrWidth - 32) + 'px' — matches-card left+right 16px margin each
const PHOTO_H = SW - 32

// Types imported from types/interfaces/matches.interface.ts

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
// (mirrors matches-card.component.ts bindBasicView exactly)
function buildBasicView(p: MatchProfile): string {
  const parts: string[] = []
  if (p.age)        parts.push(`${p.age} yrs`)
  if (p.height)     parts.push(p.height)
  if (p.caste)      parts.push(p.caste)
  if (p.education)  parts.push(p.education)
  if (p.occupation) parts.push(p.occupation)
  if (p.location)   parts.push(p.location)   // location at END (Angular)
  return parts.join(' | ')
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
                  <WhatsAppIcon width={18} height={18} />
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
        <Text style={c.viewProfileText}>View profile</Text>
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
              <Text style={c.ctaDontShowText}>Don't Show</Text>
            </Pressable>
            <Pressable style={c.ctaViewLater} onPress={onViewLater}>
              <ViewLaterIcon width={16} height={16} />
              <Text style={c.ctaViewLaterText}>View Later</Text>
            </Pressable>
          </View>
          <Pressable style={c.ctaLike} onPress={onLike}>
            <LikeIcon width={20} height={20} />
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
  // ── State ───────────────────────────────────────────────────────────────────
  const [profiles,     setProfiles]     = useState<MatchProfile[]>([])
  const [totalCount,   setTotalCount]   = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [extendedCount,  setExtendedCount]  = useState(0)
  const [notifyCount,    setNotifyCount]    = useState(0)
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
        const [extCount, notifCount, , promo] = await Promise.all([
          fetchExtendedMatchesCount(),
          fetchNotifCount(),
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
          setExtendedCount(extCount)
          setNotifyCount(notifCount)
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
    <View style={s.screen}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {/* Separated component — SafeAreaView edges={["top"]} handles status bar internally */}
      <MatchesHeader
        headerAnim={headerAnim}
        loading={loading}
        totalCount={totalCount}
        notifyCount={notifyCount}
        selectedChip={selectedChip}
        onChipSelect={setSelectedChip}
        onNotificationPress={() => navigation.navigate('notification')}
        onChatPress={() => navigation.navigate('Messages')}
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
  name:       { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: '#333333' },
  iconBtn:    { flexShrink: 0 },
  nameRowIcon:  { width: 24, height: 24 },
  nameRowIconWa:{ width: 28, height: 28 },

  // Angular: body2-regular-14 mt-2 pl-16 pr-16 bv-minht text-space
  basicView: {
    fontFamily:       'Poppins-Regular',
    fontSize:         14,
    color:            '#333333',
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

