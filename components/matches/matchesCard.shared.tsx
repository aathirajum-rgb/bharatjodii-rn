// Shared between the mobile MatchCard (screens/matches/MatchesScreen.tsx) and the
// desktop MatchCardDesktop (components/matches/MatchCardDesktop.tsx) — icons, HTML
// renderer, and basic-view/CTA-visibility helpers, so both layouts stay in sync.
//
// Angular (matches-card.component.html): Call + WhatsApp are <img src="CDN/...svg">
// (server fetch); Don't-show/View-later/Like render via <ion-icon class="{{iconType}}">
// — a locally registered/bundled icon, never networked. We mirror that:
// Call/WhatsApp = SvgUri (always calls the server, no caching), the rest = SvgXml
// (bundled strings).

import { useRef, useState } from 'react'
import {
  Pressable, StyleSheet, Text, View,
} from 'react-native'
import { Image } from 'expo-image'
import Carousel, { type ICarouselInstance } from 'react-native-reanimated-carousel'
import { SvgXml } from 'react-native-svg'
import CdnSvg from '../cdn-svg/CdnSvg'
import { CDN_SVG } from '../../constants/cdn'
import { Colors } from '../../constants/colors'
import type { MatchProfile } from '../../types/interfaces/matches.interface'

// ─── Shared card badge/photo CDN URLs ──────────────────────────────────────────
// Both MatchCard (mobile) and MatchCardDesktop point at the same CDN assets —
// kept in one place so the two layouts can't silently drift apart.

export function getBlurPhotoUri(oppGender: 'M' | 'F'): string {
  return CDN_SVG + (oppGender === 'F' ? 'revamp/profile-photo-blur.svg' : 'profile-blur-male.svg')
}

export const NEWLY_JOINED_STAR_URI = CDN_SVG + 'revamp/newly-joined-star.svg'
export const PAID_TAG_URI          = CDN_SVG + 'revamp/paid-tag-revamp.svg'
export const VERIFIED_TAG_URI      = CDN_SVG + 'viewprofile/verified-tag-img.svg'

const CDN = CDN_SVG

// ─── Card icons ────────────────────────────────────────────────────────────────

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

export type IconProps = { width?: number; height?: number }

export function WhatsAppIcon({ width = 27, height = 27 }: IconProps) {
  return <CdnSvg uri={CDN + 'whatsapp-revamp.svg'} width={width} height={height} />
}

// Figma "Jodii Desktop" node 606:6251 — WhatsApp-unlock overlay CTA. 160x40 pill,
// gradient #4AC14B→#06853A, radius 8, 24x24 icon, Poppins-Medium 14 white label.
// Shared by mobile MatchCard's and desktop MatchCardDesktop's no-photo overlay.
export function WhatsAppUnlockButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { LinearGradient } = require('expo-linear-gradient')
  return (
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={['#4AC14B', '#06853A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={waButtonStyles.btn}
      >
        <WhatsAppIcon width={24} height={24} />
        <Text style={waButtonStyles.text}>{label}</Text>
      </LinearGradient>
    </Pressable>
  )
}

const waButtonStyles = StyleSheet.create({
  btn: {
    width:           160,
    height:          40,
    borderRadius:    8,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             4,
  },
  text: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      Colors.white,
  },
})

export function CallIcon({ width = 24, height = 25 }: IconProps) {
  return <CdnSvg uri={CDN + 'revamp/call-revamp.svg'} width={width} height={height} />
}

export function CloseIcon({ width = 25, height = 24 }: IconProps) {
  return <SvgXml xml={XML_CLOSE} width={width} height={height} />
}

export function ViewLaterIcon({ width = 24, height = 24 }: IconProps) {
  return <SvgXml xml={XML_VIEW_LATER} width={width} height={height} />
}

export function LikeIcon({ width = 18, height = 19 }: IconProps) {
  return <SvgXml xml={XML_LIKE} width={width} height={height} />
}

// ─── HTML inline renderer ─────────────────────────────────────────────────────
// Angular uses [innerHTML] for dynamic server HTML. This handles the common cases:
// <span style="color:#xx">text</span> → colored Text node
// <b>/<strong> → bold Text node
// <br> → newline character

// Renders server HTML as styled React Native Text.
// Handles <span style="color:...;font-size:...px"> and <span class="..."> (any
// span, styled or not) plus <br> (newline). spanStyle is a baseline applied to
// EVERY span segment (e.g. bumping a discount amount to a bigger/bolder look,
// matching Angular's convention of giving that span its own CSS class rather
// than an inline style) — an inline color/font-size on the span itself, when
// present, overrides spanStyle for that property.
export function HtmlText({ html, style, spanStyle }: { html: string; style?: any; spanStyle?: any }) {
  if (!html) return null
  const cleaned = html.replace(/<br\s*\/?>/gi, '\n')
  const segs: Array<{ text: string; segStyle: Record<string, any> | null }> = []
  const spanRe = /<span([^>]*)>([\s\S]*?)<\/span>/gi
  let last = 0
  let sm: RegExpExecArray | null
  while ((sm = spanRe.exec(cleaned)) !== null) {
    if (sm.index > last) {
      segs.push({ text: cleaned.slice(last, sm.index).replace(/<[^>]*>/g, ''), segStyle: null })
    }
    const inline    = sm[1].match(/style="([^"]*)"/)?.[1] ?? ''
    const colorM    = inline.match(/color:\s*([^;]+)/)
    const fontSizeM = inline.match(/font-size:\s*([\d.]+)px/)
    const segStyle: Record<string, any> = { ...spanStyle }
    if (colorM)    segStyle.color    = colorM[1].trim()
    if (fontSizeM) segStyle.fontSize = Number(fontSizeM[1])
    segs.push({ text: sm[2].replace(/<[^>]*>/g, ''), segStyle: Object.keys(segStyle).length ? segStyle : null })
    last = sm.index + sm[0].length
  }
  if (last < cleaned.length) {
    segs.push({ text: cleaned.slice(last).replace(/<[^>]*>/g, ''), segStyle: null })
  }
  if (segs.length === 0) segs.push({ text: cleaned.replace(/<[^>]*>/g, ''), segStyle: null })
  return (
    <Text style={style}>
      {segs.map((seg, i) =>
        seg.segStyle
          ? <Text key={i} style={seg.segStyle}>{seg.text}</Text>
          : <Text key={i}>{seg.text}</Text>
      )}
    </Text>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// The API returns caste/education/occupation/etc. HTML-entity-encoded for non-English
// locales (e.g. "&#xbb5;&#xbaf;&#xba4;&#xbc1;" for a Tamil word). Angular renders these
// via [innerHtml], so the browser decodes entities for free; React Native's plain <Text>
// never parses HTML, so without this the raw entity codes show up on screen verbatim.
const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
}

export function decodeHtmlEntities(input: string): string {
  if (!input || input.indexOf('&') === -1) return input
  return input.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1]?.toLowerCase() === 'x'
      const code  = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return Number.isNaN(code) ? match : String.fromCodePoint(code)
    }
    return NAMED_HTML_ENTITIES[entity] ?? match
  })
}

// Angular: bindBasicView() — order: age | height | caste | education | occupation | location
// (mirrors matches-card.component.ts bindBasicView exactly)
export function buildBasicViewParts(p: MatchProfile): string[] {
  const parts: string[] = []
  if (p.age)        parts.push(`${p.age} yrs`)
  if (p.height)     parts.push(p.height)
  if (p.caste)      parts.push(p.caste)
  if (p.education)  parts.push(p.education)
  if (p.occupation) parts.push(p.occupation)
  if (p.location)   parts.push(p.location)   // location at END (Angular)
  return parts.map(decodeHtmlEntities)
}

export function buildBasicView(p: MatchProfile): string {
  return buildBasicViewParts(p).join(' | ')
}

// Angular: FUNC.showLikeCTA(likedStatus) — show Like/Don't Show/View Later when not yet liked/declined
export function showLikeCTA(status: MatchProfile['likedStatus']): boolean {
  return status === '0'
}

// Angular: FUNC.showAfterLikeContent(likedStatus) — show Send Interest / chat CTA after like
export function showAfterLikeCTA(status: MatchProfile['likedStatus']): boolean {
  return status === '1' || status === '2' || status === '3'
}

// Angular: FUNC.disableDontShow()/disableViewLater() — '1' = action taken from our
// side, '3' = action taken from both sides; already-actioned profiles that reappear
// in a re-fetched list (e.g. explore/extended) render with the button disabled
// rather than tappable again.
export function disableDontShow(status: string): boolean {
  return status === '1' || status === '3'
}

export function disableViewLater(status: string): boolean {
  return status === '1' || status === '3'
}

// ─── After-like CTA state (#22-24) ──────────────────────────────────────────────
// Angular: core/functions/common-funtions.ts getButtonInfo()/getContentAfterLike()/
// showIndirectContact(). The underlying click-time logic (paywall/free-contact
// resolution) already lives in service/communicationService.ts — these helpers only
// decide what the card *displays* before the tap; both CTA states below still call
// the same existing onCall handler.

export interface AfterLikeCtx {
  entryType:          string                       // logged-in user's own ENTRYTYPE ('P'=paid, 'F'=free, ...)
  likedStatus:        MatchProfile['likedStatus']
  phoneViewed:        string                        // raw '0'|'1'|'2'|'3'
  femaleFreeEligible: boolean
  indNumbersLeft:     string
  oppGender:          'M' | 'F'                     // gender of the profile being viewed — drives #HIMHER#/##HE_SHE##
}

function isPhoneAlreadyViewedFree(phoneViewed: string): boolean {
  return phoneViewed === '1' || phoneViewed === '3'
}

function showIndirectContact(ctx: AfterLikeCtx): boolean {
  return ctx.entryType === 'P'
    && (ctx.likedStatus === '2' || ctx.phoneViewed === '2')
    && !isPhoneAlreadyViewedFree(ctx.phoneViewed)
}

function isCallNowState(ctx: AfterLikeCtx): boolean {
  return ctx.entryType === 'P' || isPhoneAlreadyViewedFree(ctx.phoneViewed) || ctx.femaleFreeEligible
}

export function getAfterLikeCtaLabel(ctx: AfterLikeCtx, t: (key: string) => string): string {
  return isCallNowState(ctx) ? t('HOME.CALL_NOW') : t('GENERAL.PAY_NOW')
}

// Angular: common-funtions.ts getButtonInfo() — iconType = callIconWhite (Call Now)
// or paidMembership (Pay Now), rendered before the label via ion-icon slot="start".
export function getAfterLikeCtaIcon(ctx: AfterLikeCtx): string {
  return isCallNowState(ctx)
    ? CDN + 'revamp/call-icon-white.svg'
    : CDN + 'get-paid-membership.svg'
}

// Angular's own TALK_TEXT/TALK_TEXT_1 strings carry raw ##HE_SHE##/#HIMHER# placeholder
// tokens (see locales/en.json) that were never being substituted here — the previous
// version returned t()'s output as-is, so the literal token showed up on screen instead
// of "him"/"her". Same convention used everywhere else in this file for gendered copy.
export function getAfterLikeContentText(ctx: AfterLikeCtx, t: (key: string) => string): string {
  const heShe  = ctx.oppGender === 'F' ? 'She' : 'He'
  const himHer = ctx.oppGender === 'F' ? 'her' : 'him'
  const raw = showIndirectContact(ctx)
    ? t('MATCHES.TALK_TEXT')
    : ctx.entryType === 'P' || isPhoneAlreadyViewedFree(ctx.phoneViewed)
      ? t('MATCHES.TALK_TEXT_1')
      : t('GENERAL.CONTACT')
  return raw.replace(/##HE_SHE##/g, heShe).replace(/#HIMHER#/g, himHer)
}

export function showContactsLeftBanner(ctx: AfterLikeCtx): boolean {
  return showIndirectContact(ctx) && ctx.indNumbersLeft !== '0' && !isPhoneAlreadyViewedFree(ctx.phoneViewed)
}

export function showFreeBadge(ctx: AfterLikeCtx): boolean {
  return showAfterLikeCTA(ctx.likedStatus) && ctx.femaleFreeEligible && ctx.entryType === 'F'
}

// ─── Paid/Verified profile badge ────────────────────────────────────────────────
// Angular: components/badge — icon overlapping the pill's rounded left cap
// (left:-10px) + a translated text label on a 10%-opacity tinted pill
// (paid-member-block color-006C48 / verified-member-block color-0069CA).

export type ProfileBadgeVariant = 'paid' | 'verified'

const BADGE_ICON: Record<ProfileBadgeVariant, string> = {
  paid:     PAID_TAG_URI,
  verified: VERIFIED_TAG_URI,
}

const BADGE_COLOR: Record<ProfileBadgeVariant, string> = {
  paid:     '#006C48',
  verified: '#0069CA',
}

export function ProfileBadge({ variant, text }: { variant: ProfileBadgeVariant; text: string }) {
  const color = BADGE_COLOR[variant]
  return (
    <View style={[badgeStyles.pill, { backgroundColor: color + '1A' }]}>
      <CdnSvg uri={BADGE_ICON[variant]} width={24} height={24} style={badgeStyles.icon} />
      <Text style={[badgeStyles.text, { color }]} numberOfLines={1}>{text}</Text>
    </View>
  )
}

const badgeStyles = StyleSheet.create({
  pill: {
    flexDirection:   'row',
    alignItems:      'center',
    alignSelf:       'flex-start',   // content-sized pill, NOT full-width (same fix as MatchesScreen.tsx's ctaBtn)
    borderRadius:    12,
    paddingLeft:     20,
    paddingRight:    16,
    paddingVertical: 4,
    minHeight:       24,
  },
  icon: {
    position: 'absolute',
    left:     -10,
    top:      0,
  },
  text: {
    fontFamily: 'Poppins-Medium',
    fontSize:   12,
  },
})

// ─── Photo swiper with dots ────────────────────────────────────────────────────
// Angular: matches-card.component's Swiper (photosSwiperOpt: dynamicBullets pagination).
// Shared by the mobile MatchCard (MatchesScreen.tsx) and components/matches-card/MatchesCard.tsx.
// No lock/restriction on swiping through a match's photos — confirmed against the real
// Angular app. A previous pass here had a `renderLockSlide` escape hatch for exactly
// that (misattributed to femaleFreeContactRestrict(), which actually gates CONTACT
// actions, not photo viewing) — removed since nothing legitimate needs it.
//
// The actual drag/swipe mechanics are react-native-reanimated-carousel (built on
// react-native-gesture-handler + react-native-reanimated) — several rounds of a
// hand-rolled PanResponder/window-listener implementation kept re-surfacing new
// gesture-disambiguation bugs (mouse-drag unreliable on RNW, then a scroll-vs-swipe
// conflict once that was patched). A dedicated gesture library solves the same
// touch/mouse/scroll-conflict problem Swiper.js itself solves for Angular, instead of
// re-solving it by hand. Only the dot/arrow UI below is still custom — that part was
// never the problem.

// Swiper.js's dynamicBullets caps the dot row at a fixed number of visible bullets and
// slides that window as the active slide moves, rather than growing the row with photo
// count — this is that cap. Not yet confirmed against the real Figma spec (pending
// re-auth on the Figma connection); 5 is a reasonable, commonly-used Swiper default.
const DYNAMIC_BULLET_WINDOW = 5

export interface PhotoSwiperProps {
  images:       string[]
  width:        number
  height:       number
  onPress?:     (() => void) | undefined
  // Desktop-only, opt-in — mobile stays swipe-only (matches Angular). Gives desktop a
  // click-based alternative to dragging, alongside it, not instead of it.
  showArrows?:  boolean | undefined
}

export function PhotoSwiper({ images, width, height, onPress, showArrows }: PhotoSwiperProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const carouselRef = useRef<ICarouselInstance>(null)

  return (
    // overflow:'hidden' here too, not just on the parent photoBox — on Android, the
    // carousel's own native scroll surface could escape an ancestor's borderRadius clip
    // (a well-known RN/Android quirk).
    <View style={[swiperStyles.clip, { width, height }]}>
      <Carousel
        ref={carouselRef}
        data={images}
        width={width}
        height={height}
        loop={false}
        onSnapToItem={setActiveIndex}
        renderItem={({ item }) => (
          <Pressable style={{ width, height }} onPress={onPress}>
            <Image
              source={{ uri: item }}
              style={swiperStyles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={item}
              transition={150}
            />
          </Pressable>
        )}
      />

      {/* Dynamic bullets — Angular's Swiper.js `dynamicBullets` pagination scales the
          active dot up and shrinks neighbors by distance, AND caps the visible dot count
          to a sliding window (it never lets the dot row grow wider than a fixed size,
          however many photos there are) — both parts replicated here, not just the scale.
          Positioned as an absolute overlay INSIDE the photo bounds (Swiper.js's own real
          default: `.swiper-pagination` sits `position:absolute; bottom:10px` over the
          slide, not as extra content below it) — a previous version rendered this as a
          plain sibling below the photo, which the parent card's fixed-height+overflow:
          hidden photoBox was silently clipping off entirely. */}
      {images.length > 1 && (() => {
        const WINDOW_SIZE = Math.min(DYNAMIC_BULLET_WINDOW, images.length)
        const half = Math.floor(WINDOW_SIZE / 2)
        const windowStart = Math.max(0, Math.min(activeIndex - half, images.length - WINDOW_SIZE))
        const windowEnd = windowStart + WINDOW_SIZE
        const hasMoreBefore = windowStart > 0
        const hasMoreAfter  = windowEnd < images.length

        return (
          <View style={swiperStyles.dotsRow} pointerEvents="none">
            {images.slice(windowStart, windowEnd).map((_, wi) => {
              const i = windowStart + wi
              const distance = Math.abs(i - activeIndex)
              // Edge dot of the visible window, with more photos beyond it, shrinks
              // further still — Swiper's own hint that the row continues off-screen.
              const atShrunkEdge = (wi === 0 && hasMoreBefore) || (wi === WINDOW_SIZE - 1 && hasMoreAfter)
              const scale = atShrunkEdge ? 0.3 : distance === 0 ? 1 : distance === 1 ? 0.7 : 0.45
              return (
                <View
                  key={i}
                  style={[
                    swiperStyles.dot,
                    i === activeIndex ? swiperStyles.dotActive : swiperStyles.dotInactive,
                    { transform: [{ scale }] },
                  ]}
                />
              )
            })}
          </View>
        )
      })()}

      {/* Desktop-only click fallback (see `showArrows` doc comment above) — sits
          alongside the dots, not instead of them, matching how a real Swiper.js
          `navigation` module coexists with its `pagination` module. */}
      {showArrows && images.length > 1 && activeIndex > 0 && (
        <Pressable
          style={[swiperStyles.arrowBtn, swiperStyles.arrowLeft]}
          onPress={() => carouselRef.current?.prev()}
          hitSlop={8}
        >
          <Text style={swiperStyles.arrowText}>{'‹'}</Text>
        </Pressable>
      )}
      {showArrows && images.length > 1 && activeIndex < images.length - 1 && (
        <Pressable
          style={[swiperStyles.arrowBtn, swiperStyles.arrowRight]}
          onPress={() => carouselRef.current?.next()}
          hitSlop={8}
        >
          <Text style={swiperStyles.arrowText}>{'›'}</Text>
        </Pressable>
      )}
    </View>
  )
}

const swiperStyles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  image: {
    width:  '100%',
    height: '100%',
  },
  // Absolute overlay at the bottom of the photo — matches Swiper.js's own default
  // `.swiper-pagination` positioning (over the slide, not flow content below it).
  dotsRow: {
    position:       'absolute',
    bottom:         8,
    left:           0,
    right:          0,
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            6,
  },
  // Uniform circular base — dynamicBullets sizing comes entirely from the transform:scale
  // applied per-dot at render time (active=1, neighbors shrink by distance), not fixed widths.
  // White/translucent-white, not a brand color — this overlays a photo of unknown
  // background color, not a plain white card surface.
  dot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  // Active bullet is a wider pill/rounded-rect, not just a bigger circle — confirmed
  // against the real Angular app (its active bullet is visibly "square-like"/elongated,
  // inactive ones stay small round dots). Overrides `dot`'s width; height/radius inherited.
  dotActive: {
    width:           16,
    backgroundColor: Colors.white,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  arrowBtn: {
    position:        'absolute',
    top:             '50%',
    marginTop:       -16,
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  arrowLeft:  { left:  8 },
  arrowRight: { right: 8 },
  arrowText: {
    color:      Colors.white,
    fontSize:   20,
    lineHeight: 20,
  },
})
