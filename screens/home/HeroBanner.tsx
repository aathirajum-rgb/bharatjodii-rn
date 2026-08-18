// Home screen's top promo banner — Angular: components/home-banner/home-banner.component.
// One presentational shell reused across every precedence-chain variant computed by
// homeGating.ts's computeHeroBannerVariant(); only the content object and the
// presence of a countdown differ per variant (same "one component, many data
// sources" shape MatchesScreen.tsx's PhotoPromotionBanner/applyHeroBanner already
// uses for its own 3-variant subset).
import { useEffect, useState, type ReactNode } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '../../constants/colors'
import { CdnImage } from '../../components/cdn-svg/CdnSvg'

// Angular: home-banner.component.scss's .jodii-membership-banner-block —
// min-height: 42vmin !important — the OLD banner's outer row, not a fixed px
// value. vmin→px anchor (140px ≈ 38vmin) already validated against this same
// live app by MatchesScreen.tsx's PhotoPromotionBanner (free-trial-height:
// 38vmin). Scaled proportionally: 42 * (140/38).
const SW = Dimensions.get('window').width
const BANNER_ROW_MIN_HEIGHT = Math.round(42 * (140 / 38))
// Angular: ion-col size="4.5" of 12 (English) for the image column, inside a
// row with pl-24 (24px) padding — this shell's own paddingHorizontal (16 * 2)
// approximates that outer gutter closely enough for a fraction-of-width calc.
const BANNER_IMAGE_WIDTH  = Math.round((SW - 32) * (4.5 / 12))
const BANNER_IMAGE_HEIGHT = BANNER_ROW_MIN_HEIGHT

// Angular: matches.page.ts:2317 / home-banner.component.ts:108 / recharge.page.ts:739 —
// the real PAYMENTFAILEDCONTENT string uses this literal token for its live countdown.
const TIMER_TOKEN = '##TIMER##'
// Angular: home-banner.component.html's own-timer CONTENT block — the tm/ml
// languages embed the timer inline via this token; other languages append it
// as a separately-styled trailing span instead. Applied uniformly here rather
// than branching per-language — same information, one code path.
const OWN_TIMER_TOKEN = '<TIMER>'

// Angular: home-banner.component.ts's showPayFailedTimer() — pad2(minutes) +
// ':' + pad2(seconds). MM:SS, not HH:MM:SS (confirmed against source; the
// previous version here was a guess and wrong).
function formatRemaining(deadlineMs: number): string {
  const remainingMs = Math.max(0, deadlineMs - Date.now())
  const totalSec    = Math.floor(remainingMs / 1000)
  const mm          = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss          = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

// Angular: home-banner.component.ts's showTimer() — the generic hero banner's
// OWN countdown (independent of the payment-failed one above), rendered next
// to heroBannerData?.CONTENT for old-style (PROMOTYPE=='0') banners only.
// Angular formats this HH:MM:SS (splitValue[0]+'h', [1]+'m', [2]+'s').
function formatOwnTimer(deadlineMs: number): string {
  const remainingMs = Math.max(0, deadlineMs - Date.now())
  const totalSec    = Math.floor(remainingMs / 1000)
  const hh          = String(Math.floor(totalSec / 3600)).padStart(2, '0')
  const mm          = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
  const ss          = String(totalSec % 60).padStart(2, '0')
  return `${hh}h ${mm}m ${ss}s`
}

export interface HeroBannerContent {
  title:               string
  title1?:             string | undefined  // Angular: TITLE1 — old-banner-style sub-line (e.g. "on Jodii")
  title2?:             string | undefined  // Angular: TITLE2 — old-banner-style second sub-line
  body:                string
  validText?:          string | undefined  // Angular: VALID — validity note shown under the CTA
  ctaLabel:            string
  imageUrl?:           string | undefined  // Angular: BANNERIMG / BRIDEIMG
  bgColor?:            string | undefined  // Angular: BANNERBG / BRIDEBGCOLOR
  // Angular: home-banner.component.html's old-banner block colors TITLE via
  // heroBannerData.TITLECOLOR and BODY via CONTENTCOLOR independently — two
  // separate server fields, not necessarily the same value. title1/title2
  // similarly read NOTECOLOR / CTABGCOLOR (yes, TITLE2 literally reuses the
  // CTA background color as its own text color in the live template).
  // Each falls back to the shared `textColor` below when the server doesn't
  // send its own field, matching every OTHER variant's single-color usage.
  titleColor?:         string | undefined
  title1Color?:        string | undefined
  title2Color?:        string | undefined
  bodyColor?:          string | undefined
  // Angular: the CONTENT+TIMER countdown line's container has
  // {border: TIMERBORDER, background: TIMERBG} (both server fields) — its
  // text itself is the "black-color" utility class (#000, hardcoded, NOT
  // server-driven) regardless of what's behind it.
  ownTimerBg?:         string | undefined
  ownTimerBorderColor?: string | undefined
  // Angular: the addPhotoPromotion/nonIdVerifyPromotion/addPhotoPromotionPaid
  // grid's "free-trial-bg" CSS class — a FIXED gradient (#FFDDDD → white), not
  // server-driven like bgColor above. Takes precedence over bgColor when set.
  gradient?:           [string, string] | undefined
  // Color-stop positions (0-1) for `gradient` above, e.g. Figma's
  // "linear-gradient(180deg, #D9E7FF 12.59%, #FFF 137.6%)" → [0.1259, 1]
  // (137.6% clamped to 1 — LinearGradient's locations can't exceed the box).
  // Omit for an even 0/1 spread.
  gradientLocations?:  [number, number] | undefined
  // Angular: the photo-promo grid's text is black-color on its light pink
  // gradient, unlike every other variant's white-on-dark text. Defaults to
  // white (this component's original, still-correct default for every other
  // variant) when not set.
  textColor?:          string | undefined
  ctaBgColor?:         string | undefined
  ctaBorderColor?:     string | undefined
  ctaColor?:           string | undefined
  arrowIconUrl?:       string | undefined  // Angular: ARROWICON, shown after the CTA label
  countdownDeadlineMs?: number | undefined // replaces ##TIMER## inside `body`
  ownTimerContent?:    string | undefined  // Angular: CONTENT — a separate line, own countdown appended/embedded
  ownTimerDeadlineMs?: number | undefined
}

// Angular binds TITLE/BODY/TITLE1/TITLE2/VALID via [innerHTML] — the CMS's
// "Pay <del>₹1690</del> ₹1190" renders as real strikethrough there. RN's
// plain <Text> doesn't interpret HTML, so without this it showed the raw
// "<del>...</del>" tag text instead of striking through the old price.
const DEL_TAG_RE = /<del>([\s\S]*?)<\/del>/gi
function renderRichText(text: string, key: string): ReactNode {
  if (!text.includes('<del')) return text
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0
  DEL_TAG_RE.lastIndex = 0
  while ((match = DEL_TAG_RE.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    nodes.push(<Text key={`${key}-${i++}`} style={s.strike}>{match[1]}</Text>)
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export interface HeroBannerProps {
  content:    HeroBannerContent
  onPress:    () => void
  onDismiss?: (() => void) | undefined
}

export default function HeroBanner({ content, onPress, onDismiss }: HeroBannerProps) {
  const [remaining, setRemaining] = useState(() =>
    content.countdownDeadlineMs != null ? formatRemaining(content.countdownDeadlineMs) : ''
  )
  const [ownRemaining, setOwnRemaining] = useState(() =>
    content.ownTimerDeadlineMs != null ? formatOwnTimer(content.ownTimerDeadlineMs) : ''
  )

  useEffect(() => {
    if (content.countdownDeadlineMs == null) return
    setRemaining(formatRemaining(content.countdownDeadlineMs))
    const id = setInterval(() => setRemaining(formatRemaining(content.countdownDeadlineMs!)), 1000)
    return () => clearInterval(id)
  }, [content.countdownDeadlineMs])

  useEffect(() => {
    if (content.ownTimerDeadlineMs == null) return
    setOwnRemaining(formatOwnTimer(content.ownTimerDeadlineMs))
    const id = setInterval(() => setOwnRemaining(formatOwnTimer(content.ownTimerDeadlineMs!)), 1000)
    return () => clearInterval(id)
  }, [content.ownTimerDeadlineMs])

  const body = content.countdownDeadlineMs != null ? content.body.replace(TIMER_TOKEN, remaining) : content.body

  const ownTimerLine = content.ownTimerDeadlineMs != null && content.ownTimerContent
    ? (content.ownTimerContent.includes(OWN_TIMER_TOKEN)
        ? content.ownTimerContent.replace(OWN_TIMER_TOKEN, ownRemaining)
        : `${content.ownTimerContent} ${ownRemaining}`)
    : null

  const Wrap: any = content.gradient ? LinearGradient : View
  const gradientProps = content.gradient
    ? {
        colors: content.gradient,
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        ...(content.gradientLocations ? { locations: content.gradientLocations } : {}),
      }
    : {}
  const wrapStyle = content.gradient
    ? s.wrap
    : [s.wrap, content.bgColor ? { backgroundColor: content.bgColor } : null]

  return (
    <Wrap {...gradientProps} style={wrapStyle}>
      {!!onDismiss && (
        <Pressable style={s.close} onPress={onDismiss} hitSlop={8}>
          <Text style={s.closeText}>✕</Text>
        </Pressable>
      )}
      <Pressable style={s.row} onPress={onPress}>
        {!!content.imageUrl && (
          <CdnImage
            uri={content.imageUrl}
            width={BANNER_IMAGE_WIDTH}
            height={BANNER_IMAGE_HEIGHT}
            style={s.image}
            resizeMode="cover"
          />
        )}
        <View style={s.textCol}>
          {!!content.title && <Text style={[s.title, (content.titleColor ?? content.textColor) ? { color: content.titleColor ?? content.textColor } : null]}>{renderRichText(content.title, 'title')}</Text>}
          {!!content.title1 && <Text style={[s.title1, (content.title1Color ?? content.textColor) ? { color: content.title1Color ?? content.textColor } : null]}>{renderRichText(content.title1, 'title1')}</Text>}
          {!!content.title2 && <Text style={[s.title2, (content.title2Color ?? content.textColor) ? { color: content.title2Color ?? content.textColor } : null]}>{renderRichText(content.title2, 'title2')}</Text>}
          {!!body && <Text style={[s.body, (content.bodyColor ?? content.textColor) ? { color: content.bodyColor ?? content.textColor, opacity: 1 } : null]}>{renderRichText(body, 'body')}</Text>}
          {!!ownTimerLine && (
            <View
              style={[
                s.ownTimerBox,
                content.ownTimerBg ? { backgroundColor: content.ownTimerBg } : null,
                content.ownTimerBorderColor ? { borderWidth: 1, borderColor: content.ownTimerBorderColor } : null,
              ]}
            >
              <Text style={s.ownTimer}>{ownTimerLine}</Text>
            </View>
          )}
          <View
            style={[
              s.cta,
              content.ctaBgColor ? { backgroundColor: content.ctaBgColor } : null,
              content.ctaBorderColor ? { borderWidth: 1, borderColor: content.ctaBorderColor } : null,
            ]}
          >
            <Text style={[s.ctaText, content.ctaColor ? { color: content.ctaColor } : null]}>{content.ctaLabel}</Text>
            {!!content.arrowIconUrl && <CdnImage uri={content.arrowIconUrl} width={14} height={14} style={s.ctaArrow} />}
          </View>
          {!!content.validText && <Text style={s.validText}>{renderRichText(content.validText, 'valid')}</Text>}
        </View>
      </Pressable>
    </Wrap>
  )
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor:   '#29339B',
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  close: {
    position: 'absolute',
    top:      10,
    right:    12,
    zIndex:   1,
  },
  closeText: {
    fontSize: 16,
    color:    Colors.white,
  },
  // Angular: .jodii-membership-banner-block { min-height: 42vmin !important }
  // — see BANNER_ROW_MIN_HEIGHT's derivation above.
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    minHeight:     BANNER_ROW_MIN_HEIGHT,
  },
  // Angular: img.object-fit-cover in a size="4.5"/12 column — fills its
  // column's full box, cropped to cover, not a small fixed icon.
  image: {
    borderRadius: 8,
  },
  textCol: {
    flex: 1,
    gap:  4,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   15,
    color:      Colors.white,
    paddingRight: 20,
  },
  // Angular's [innerHTML] renders a literal <del> as real strikethrough —
  // renderRichText() strips the tag and applies this to just its contents.
  strike: {
    textDecorationLine: 'line-through',
  },
  title1: {
    fontFamily: 'Poppins-Medium',
    fontSize:   13,
    color:      Colors.white,
  },
  title2: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   16,
    color:      Colors.white,
  },
  body: {
    fontFamily: 'Poppins-Regular',
    fontSize:   12,
    color:      Colors.white,
    opacity:    0.9,
  },
  // Angular: this line's own container carries the "black-color" utility
  // class — its text is always #000, independent of ownTimerBg/border below
  // and of every other line's textColor. .timer-block-banner: padding: 4px 6px.
  ownTimerBox: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    borderRadius:      4,
    paddingHorizontal: 6,
    paddingVertical:   4,
    marginTop:         2,
  },
  ownTimer: {
    fontFamily: 'Poppins-Medium',
    fontSize:   12,
    color:      '#000000',
  },
  // Angular: .upgrade-now-btn-revamp — border-radius: 16px; padding: 8px top/
  // bottom, 16px start/end (ion-button's --padding-* vars).
  cta: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    alignSelf:         'flex-start',
    backgroundColor:   Colors.white,
    borderRadius:      16,
    paddingVertical:   8,
    paddingHorizontal: 16,
    marginTop:         6,
  },
  ctaText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   13,
    color:      '#29339B',
  },
  ctaArrow: {},
  validText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   11,
    color:      Colors.white,
    opacity:    0.85,
    marginTop:  4,
  },
})
