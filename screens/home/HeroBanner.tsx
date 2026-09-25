// Home screen's top promo banner — Angular: components/home-banner/home-banner.component.
// One presentational shell reused across every precedence-chain variant computed by
// homeGating.ts's computeHeroBannerVariant(); only the content object and the
// presence of a countdown differ per variant (same "one component, many data
// sources" shape MatchesScreen.tsx's PhotoPromotionBanner/applyHeroBanner already
// uses for its own 3-variant subset).
import { useEffect, useState, type ReactNode } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '../../constants/colors'
import { CdnImage } from '../../components/cdn-svg/CdnSvg'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'
import { type ParsedCssBackground } from '../../utils/cssGradient'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

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
// Angular: the paymentFailedPromotion grid's icon column is size="1.3" of 12
// (not the main grid's 4.5/12) — a small square alert icon, not a big tile
// image. Square, since the real column has no independent height rule beyond
// filling its own (icon-sized) width.
const INSET_ICON_SIZE = Math.round((SW - 32) * (1.3 / 12))

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
  // Angular: home-banner.component.html's #heroBanner TITLE/BODY classes
  // differ per banner sub-variant, not just "old" vs "bride" — 'photoPromo'
  // (the addPhotoPromotion/nonIdVerifyPromotion/addPhotoPromotionPaid grid)
  // and 'paymentFailed' (paymentFailedPromotion) each use their own distinct
  // classes too. Required so every call site has to pick the right one
  // explicitly rather than silently falling through to 'old' by omission.
  bannerStyle:         'old' | 'bride' | 'photoPromo' | 'paymentFailed'
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
  // server-driven) regardless of what's behind it. TIMERBG is bound to the raw
  // CSS `background` (same as BANNERBG/BRIDEBGCOLOR above), so it's commonly a
  // `linear-gradient(...)` string, not a plain color — parsed the same way via
  // utils/cssGradient.ts's parseCssBackground(), whose result this stores
  // directly rather than re-flattening it to a single color.
  ownTimerBg?:         { solid: string } | { gradient: ParsedCssBackground } | undefined
  // TIMERBORDER is the raw CSS `border` shorthand ("1px solid #CFDBF0"), so
  // this is only the COLOR extracted out of it (utils/cssGradient.ts's
  // extractCssColor()) — RN's borderColor/borderWidth are separate props.
  // Used only as a same-color fallback border when `ownTimerBorderGradient`
  // below isn't present.
  ownTimerBorderColor?: string | undefined
  // Angular additionally applies a TIMERBORDERIMAGE — a border-image built
  // from the SAME left-to-right gradient as its border-color, fading to
  // transparent partway along — on top of the plain border above. RN's View
  // has no border-image primitive, so this is approximated with the standard
  // "gradient ring" trick instead: an outer LinearGradient sized to the box,
  // padded by the border width, with the real background/content sitting in
  // an inner View on top — see HeroBanner's ownTimerBox render.
  ownTimerBorderGradient?: ParsedCssBackground | undefined
  // Angular: the addPhotoPromotion/nonIdVerifyPromotion/addPhotoPromotionPaid
  // grid's "free-trial-bg" CSS class — a FIXED gradient (#FFDDDD → white), not
  // server-driven like bgColor above. Takes precedence over bgColor when set.
  // Also used for the 'old'/'bride' variants when BANNERBG/BRIDEBGCOLOR itself
  // comes back as a `linear-gradient(...)` CSS string (Angular binds that field
  // straight into a raw CSS `background`, so the CMS can send either a plain
  // color or a full gradient there) — see utils/cssGradient.ts's
  // parseCssBackground(), not just the two fixed literals above.
  gradient?:           string[] | undefined
  // Color-stop positions (0-1) for `gradient` above, e.g. Figma's
  // "linear-gradient(180deg, #D9E7FF 12.59%, #FFF 137.6%)" → [0.1259, 1]
  // (137.6% clamped to 1 — LinearGradient's locations can't exceed the box).
  // Omit for an even spread across all stops.
  gradientLocations?:  number[] | undefined
  // Direction for `gradient` above — defaults to top-to-bottom (matching the
  // two fixed-literal gradients' own implicit direction) when the CMS's
  // BANNERBG/BRIDEBGCOLOR carries no angle/keyword of its own.
  gradientStart?:      { x: number; y: number } | undefined
  gradientEnd?:        { x: number; y: number } | undefined
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
  // Angular: the paymentFailedPromotion grid's own .payment-failed-banner
  // class — a small rounded/bordered card with a 24px outer margin, unlike
  // every other variant's full-bleed banner. `borderColor` only applies when
  // this is set.
  insetCard?:  boolean | undefined
  borderColor?: string | undefined
}

// Angular binds TITLE/BODY/TITLE1/TITLE2/VALID via [innerHTML] — the CMS's
// "Pay <del>₹1690</del> ₹1190" renders as real strikethrough there. RN's
// plain <Text> doesn't interpret HTML, so without this it showed the raw
// "<del>...</del>" tag text instead of striking through the old price.
const DEL_TAG_RE = /<del>([\s\S]*?)<\/del>/gi
// Angular: global.scss:26651 `.del del { color: #717175 !important; }` — TITLE's
// own wrapping div is the only one of the five rich-text fields carrying the
// "del" class (home-banner.component.html:23), so a struck-through <del> segment
// inside TITLE specifically gets this muted gray, overriding TITLECOLOR/
// textColor for just that segment — BODY/TITLE1/TITLE2/VALID have no such
// wrapper and so keep inheriting their own line's color, undimmed.
function renderRichText(text: string, key: string, strikeColor?: string): ReactNode {
  if (!text.includes('<del')) return text
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0
  DEL_TAG_RE.lastIndex = 0
  while ((match = DEL_TAG_RE.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    nodes.push(
      <Text key={`${key}-${i++}`} style={[s.strike, strikeColor ? { color: strikeColor } : null]}>
        {match[1]}
      </Text>,
    )
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
  const { i18n } = useTranslation()
  // Same pattern HomeScreen.tsx uses everywhere: a static StyleSheet fontFamily
  // (Poppins) covers the English look, and this hook's per-language family is
  // applied inline on top at each Text below — the static Poppins alone would
  // render vernacular scripts (Tamil/Telugu/etc.) as tofu boxes.
  const langFonts = useLanguageFonts()
  // Angular: the bride-banner TITLE class is `berkshire` (BerkshireSwash,
  // a decorative script font) for English specifically, `regular-16`
  // (Poppins-Regular) for every other language — the OTHER 3 bannerStyle
  // variants have no such per-language split. The decorative English case is
  // deliberately NOT run through langFonts below (Berkshire Swash is the
  // intended English-only look, not a stand-in for "regular" weight); only
  // titleBrideOther's plain Poppins-Regular needs the per-language swap.
  const titleStyle =
    content.bannerStyle === 'bride'      ? [s.titleBride, i18n.language === 'en' ? s.titleBrideEn : s.titleBrideOther] :
    content.bannerStyle === 'photoPromo' ? s.titlePhotoPromo :
    s.title
  const titleFontFamily = content.bannerStyle === 'bride'
    ? (i18n.language === 'en' ? undefined : langFonts.regular)
    : langFonts.semiBold // 'old' and 'photoPromo' are both semiBold in their static styles
  // Angular: home-banner.component.html:23's TITLE div (bannerStyle 'old'/
  // 'bride' only — this exact div, shared by both) carries a plain `class=
  // "del"`, which global.scss:26651's `.del del { color: #717175 !important; }`
  // targets. The 'photoPromo'/'paymentFailed' TITLE markup (lines 204/135/177)
  // has no such wrapper, so a <del> there (if it ever occurs) keeps inheriting
  // its own line's ordinary color instead.
  const titleDelColor = content.bannerStyle === 'old' || content.bannerStyle === 'bride' ? '#717175' : undefined
  const bodyStyle =
    content.bannerStyle === 'bride'         ? s.bodyBride :
    content.bannerStyle === 'photoPromo'    ? s.bodyPhotoPromo :
    content.bannerStyle === 'paymentFailed' ? s.bodyPaymentFailed :
    s.body
  const bodyFontFamily =
    content.bannerStyle === 'bride' ? langFonts.semiBold :
    content.bannerStyle === 'old'   ? langFonts.medium :
    langFonts.regular // 'photoPromo' and 'paymentFailed' are both regular in their static styles

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

  // Angular: this line's markup genuinely differs by language, not just by
  // token-substitution style — tm/ml render ONE run (CONTENT with <TIMER>
  // substituted inline, all at body3-regular-12/Regular weight); every other
  // language renders TWO runs (CONTENT at body3-regular-12/Regular, then the
  // digits themselves at textcta-medium-12/Medium weight, appended after a
  // space) — never substituted inline. RN CAN mix two Text weights within one
  // paragraph (nested Text, same trick renderRichText() above already uses
  // for <del> strikethrough), so this splits into two real runs instead of
  // collapsing everything to the digits' Medium weight.
  const isTmMl = ['tm', 'ml'].includes(i18n.language)
  const ownTimerLabel = content.ownTimerDeadlineMs != null && content.ownTimerContent
    ? (isTmMl ? content.ownTimerContent.replace(OWN_TIMER_TOKEN, ownRemaining) : content.ownTimerContent)
    : null

  const Wrap: any = content.gradient ? LinearGradient : View
  const gradientProps = content.gradient
    ? {
        colors: content.gradient,
        start: content.gradientStart ?? { x: 0, y: 0 },
        end: content.gradientEnd ?? { x: 0, y: 1 },
        ...(content.gradientLocations ? { locations: content.gradientLocations } : {}),
      }
    : {}
  const wrapStyle = [
    s.wrap,
    content.gradient ? null : (content.bgColor ? { backgroundColor: content.bgColor } : null),
    content.insetCard ? [s.insetCard, content.borderColor ? { borderColor: content.borderColor } : null] : null,
  ]
  const imageSize = content.insetCard
    ? { width: INSET_ICON_SIZE, height: INSET_ICON_SIZE }
    : { width: BANNER_IMAGE_WIDTH, height: BANNER_IMAGE_HEIGHT }

  return (
    <Wrap {...gradientProps} style={wrapStyle}>
      {!!onDismiss && (
        <Pressable style={s.close} onPress={onDismiss} hitSlop={8}>
          <Text style={s.closeText}>✕</Text>
        </Pressable>
      )}
      <Pressable style={[s.row, content.insetCard ? s.insetRow : null]} onPress={onPress}>
        {!!content.imageUrl && (
          <CdnImage
            uri={content.imageUrl}
            width={imageSize.width}
            height={imageSize.height}
            style={s.image}
            resizeMode="cover"
          />
        )}
        <View style={s.textCol}>
          {!!content.title && (
            <Text style={[titleStyle, titleFontFamily ? { fontFamily: titleFontFamily } : null, (content.titleColor ?? content.textColor) ? { color: content.titleColor ?? content.textColor } : null]}>
              {renderRichText(content.title, 'title', titleDelColor)}
            </Text>
          )}
          {!!content.title1 && (
            <Text style={[s.title1, { fontFamily: langFonts.medium }, (content.title1Color ?? content.textColor) ? { color: content.title1Color ?? content.textColor } : null]}>
              {renderRichText(content.title1, 'title1')}
            </Text>
          )}
          {!!content.title2 && (
            <Text style={[s.title2, { fontFamily: langFonts.semiBold }, (content.title2Color ?? content.textColor) ? { color: content.title2Color ?? content.textColor } : null]}>
              {renderRichText(content.title2, 'title2')}
            </Text>
          )}
          {!!body && (
            <Text style={[bodyStyle, { fontFamily: bodyFontFamily }, (content.bodyColor ?? content.textColor) ? { color: content.bodyColor ?? content.textColor, opacity: 1 } : null]}>
              {renderRichText(body, 'body')}
            </Text>
          )}
          {!!ownTimerLabel && (() => {
            const bg = content.ownTimerBg
            const isBgGradient = !!bg && 'gradient' in bg
            const InnerWrap: any = isBgGradient ? LinearGradient : View
            const innerWrapProps = isBgGradient
              ? {
                  colors: (bg as { gradient: ParsedCssBackground }).gradient.colors,
                  start: (bg as { gradient: ParsedCssBackground }).gradient.start,
                  end:   (bg as { gradient: ParsedCssBackground }).gradient.end,
                  ...((bg as { gradient: ParsedCssBackground }).gradient.locations
                    ? { locations: (bg as { gradient: ParsedCssBackground }).gradient.locations }
                    : {}),
                }
              : {}
            const borderGrad = content.ownTimerBorderGradient

            const inner = (
              <InnerWrap
                {...innerWrapProps}
                style={[
                  s.ownTimerBox,
                  borderGrad ? s.ownTimerBoxInnerWithRing : null,
                  bg && 'solid' in bg ? { backgroundColor: bg.solid } : null,
                  // A flat borderColor is only used when there's no gradient
                  // ring below — the ring itself (1px LinearGradient padding)
                  // takes over as the visible border once it's present.
                  !borderGrad && content.ownTimerBorderColor ? { borderWidth: 1, borderColor: content.ownTimerBorderColor } : null,
                ]}
              >
                {isTmMl ? (
                  <Text style={[s.ownTimerLabel, { fontFamily: langFonts.regular }]}>{ownTimerLabel}</Text>
                ) : (
                  <Text style={[s.ownTimerLabel, { fontFamily: langFonts.regular }]}>
                    {ownTimerLabel}{' '}
                    <Text style={[s.ownTimer, { fontFamily: langFonts.medium }]}>{ownRemaining}</Text>
                  </Text>
                )}
              </InnerWrap>
            )

            if (!borderGrad) return inner

            // Angular's TIMERBORDERIMAGE fades this box's border from solid to
            // transparent left-to-right (border-image has no RN equivalent) —
            // approximated with the standard "gradient ring" trick: an outer
            // LinearGradient sized to the box, padded by the border's own 1px,
            // with the real box (background + content) sitting on top in
            // `inner`, covering all but that 1px ring around the edge.
            const BorderRing: any = LinearGradient
            return (
              <BorderRing
                colors={borderGrad.colors}
                start={borderGrad.start}
                end={borderGrad.end}
                {...(borderGrad.locations ? { locations: borderGrad.locations } : {})}
                style={s.ownTimerBorderRing}
              >
                {inner}
              </BorderRing>
            )
          })()}
          <View
            style={[
              s.cta,
              content.ctaBgColor ? { backgroundColor: content.ctaBgColor } : null,
              content.ctaBorderColor ? { borderWidth: 1, borderColor: content.ctaBorderColor } : null,
            ]}
          >
            <Text style={[s.ctaText, { fontFamily: langFonts.medium }, content.ctaColor ? { color: content.ctaColor } : null]}>{content.ctaLabel}</Text>
            {!!content.arrowIconUrl && <CdnImage uri={content.arrowIconUrl} width={14} height={14} style={s.ctaArrow} />}
          </View>
          {!!content.validText && <Text style={[s.validText, { fontFamily: langFonts.regular }]}>{renderRichText(content.validText, 'valid')}</Text>}
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
  // Angular: .payment-failed-banner — border-radius: 8px; border: 1px solid
  // #F5BDD0; plus the template's own mt-24 ml-24 mr-24 margins (a rounded,
  // bordered inset card, not the full-bleed banner every other variant is).
  insetCard: {
    marginTop:         24,
    marginHorizontal:  24,
    paddingHorizontal: 12,
    paddingVertical:   12,
    borderRadius:      8,
    borderWidth:        1,
  },
  insetRow: {
    minHeight: 0,
  },
  // A '✕' text glyph standing in for Angular's own close <ion-img> asset, so
  // no Angular typography class governs it — size tokenised only, unchanged.
  closeText: {
    fontSize: FontSize.font16,
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
  // Angular: home-banner.component.html's #heroBanner TITLE, isOldBanner()
  // path — `heading2-semibold-18 poppins-family` — font-size var(--font18)
  // (1.125rem, scales with device width — see FontSize's header comment);
  // family already matched (Poppins-SemiBold — poppins-family's font-family
  // override is ignored here per the same established convention as
  // HomeScreen.tsx's helpBanner BODY, which reserves --english-poppins for
  // the Rupee-symbol use case, not a general override). TITLECOLOR is
  // server-driven via [attr.style], not a fixed class — RN default color
  // left alone. Used when bannerStyle==='old' (and 'paymentFailed', whose
  // title is always '' so this never actually renders for it).
  title: {
   
    fontSize:   FontSize.font18,
    color:      Colors.white,
    paddingRight: 20,
  },
  // Angular: the !isOldBanner ("bride") TITLE class — `berkshire line-height-16`
  // for English, `regular-16 line-height-16` for every other language — both
  // font-size var(--font16) (1rem, dynamic — see FontSize's header comment)
  // and a flat 16px line-height (not rem-based). titleBrideEn/Other supply the
  // per-language font-family half of the split.
  titleBride: {
    fontSize:     FontSize.font16,
    lineHeight:   16,
    color:        Colors.white,
    paddingRight: 20,
  },
  titleBrideEn:    { fontFamily: Fonts.berkshireSwashRegular },
  titleBrideOther: { fontFamily: Fonts.poppinsRegular },
  // Angular: the addPhotoPromotion/nonIdVerifyPromotion/addPhotoPromotionPaid
  // grid's TITLE — `heading3-semibold-16 black-color` — font-size
  // var(--font16) (1rem, dynamic), Poppins-SemiBold. No TITLECOLOR binding on
  // this grid at all (unlike 'old'/'bride') — color is always black-color,
  // already supplied by this variant's own call site via `textColor`.
  titlePhotoPromo: {
  
    fontSize:     FontSize.font16,
    color:        Colors.white,
    paddingRight: 20,
  },
  // Angular's [innerHTML] renders a literal <del> as real strikethrough —
  // renderRichText() strips the tag and applies this to just its contents.
  strike: {
    textDecorationLine: 'line-through',
  },
  // Angular: home-banner.component.html's TITLE1 (isOldBanner()-only field) —
  // `heading4-medium-16 mt-4` — font-size var(--font16) (1rem, scales with
  // device width — see FontSize's header comment); family already matched
  // (Poppins-Medium). NOTECOLOR is server-driven via [ngStyle] — RN default
  // color left alone.
  title1: {
   
    fontSize:   FontSize.font16,
    color:      Colors.white,
  },
  // Angular: home-banner.component.html's TITLE2 (isOldBanner()-only field) —
  // `heading1-semibold-22 poppins-family mt-4` — font-size var(--font22)
  // (1.375rem, scales with device width — see FontSize's header comment);
  // family already matched (Poppins-SemiBold; poppins-family ignored, same
  // convention as `title` above). CTABGCOLOR is server-driven via [ngStyle]
  // (yes, TITLE2 really does reuse the CTA background color as its own text
  // color) — RN default color left alone.
  title2: {
    
    fontSize:   FontSize.font22,
    color:      Colors.white,
  },
  // Angular: home-banner.component.html's BODY, isOldBanner() path —
  // `textcta-medium-12 mt-8 poppins-family f-600` — font-size var(--font12)
  // (0.75rem, scales with device width — see FontSize's header comment),
  // family Poppins-Medium (poppins-family ignored, same convention as
  // `title` above) — was Poppins-Regular, wrong weight. CONTENTCOLOR is
  // server-driven via [attr.style] — RN default color left alone. Used when
  // bannerStyle==='old'.
  // Angular: this div's color is driven entirely by [attr.style]="'color: ' +
  // CONTENTCOLOR + ' !important;'" — when the API sends no CONTENTCOLOR at
  // all, that becomes invalid CSS ("color:  !important;"), which the browser
  // discards outright, so the div falls back to its ordinary inherited color
  // (black, off the page's own default) rather than any white the OLD banner's
  // typically-dark background might suggest. RN has no such "invalid style is
  // dropped" behavior, so this default has to be set explicitly to match.
  body: {
    
    fontSize:   FontSize.font12,
    color:      Colors.black,
    opacity:    0.9,
  },
  // Angular: the !isOldBanner ("bride") BODY class — `heading2-semibold-18
  // mt-8 line-height-20` — font-size var(--font18) (1.125rem, dynamic — see
  // FontSize's header comment), Poppins-SemiBold, flat 20px line-height (not
  // rem-based).
  // Same "invalid CONTENTCOLOR style is silently dropped, falls back to black"
  // reasoning as `body` above — this is the !isOldBanner ("bride") variant's
  // own BODY div, same [attr.style] binding, just a different typography class.
  bodyBride: {
   
    fontSize:   FontSize.font18,
    lineHeight: 20,
    color:      Colors.black,
    marginTop:  8,
  },
  // Angular: the addPhotoPromotion/nonIdVerifyPromotion/addPhotoPromotionPaid
  // grid's BODY — `body3-regular-12 black-color mt-8` — font-size
  // var(--font12), Poppins-REGULAR (not Medium like 'old'/`textcta-medium-12`
  // above). No CONTENTCOLOR binding on this grid — color is always
  // black-color, already supplied via this variant's own `textColor`.
  bodyPhotoPromo: {
   
    fontSize:   FontSize.font12,
    color:      Colors.white,
    marginTop:  8,
  },
  // Angular: paymentFailedPromotion's content div — `black-color line-height-20`
  // wrapping a `body3-regular-12` span (the PAGETYPE 4/5 case, `body2-regular-14
  // pr-16 mt-8`, is handled by a separate screen — AutoRenewalFailureSheet —
  // never reached via this Home banner). font-size var(--font12), Poppins-
  // Regular, flat 20px line-height, no top margin (unlike the other 3
  // variants, none of which have their own mt-8 in this specific branch).
  bodyPaymentFailed: {
    
    fontSize:   FontSize.font12,
    lineHeight: 20,
    color:      Colors.white,
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
  // Applied on top of `ownTimerBox` only when a gradient border ring wraps it
  // (see ownTimerBorderRing below) — the ring itself now owns marginTop and a
  // slightly larger borderRadius, so the inner box's own copies would double up.
  ownTimerBoxInnerWithRing: {
    marginTop:    0,
    borderRadius: 3,
  },
  // The gradient-border-ring wrapper — `padding` here IS the border's width
  // (1px, matching content.ownTimerBorderColor's own borderWidth above), so
  // only a 1px ring of this LinearGradient shows around ownTimerBox's edges.
  ownTimerBorderRing: {
    alignSelf:    'flex-start',
    borderRadius: 4,
    padding:      1,
    marginTop:    2,
  },
  // Angular: this line's CONTENT-text span — `body3-regular-12` — font-size
  // var(--font12) (0.75rem, scales with device width — see FontSize's header
  // comment), Poppins-Regular. Used for the whole line on tm/ml (CONTENT with
  // <TIMER> substituted inline, no separate weight for the digits); the label
  // portion only on every other language, where `ownTimer` below nests inside
  // for just the digits.
  ownTimerLabel: {
   
    fontSize:   FontSize.font12,
    color:      '#000000',
  },
  // Angular: the timer-digits span (non-tm/ml only) — `textcta-medium-12` —
  // same font-size var(--font12), but Poppins-MEDIUM, not Regular like the
  // label it's nested inside.
  ownTimer: {
    
    fontSize:   FontSize.font12,
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
  // Angular: home-banner.component.html's CTA span — `textcta-medium-12` —
  // font-size var(--font12) (0.75rem, scales with device width — see
  // FontSize's header comment), family Poppins-Medium — was Poppins-SemiBold,
  // wrong weight. CTATEXTCOLOR is server-driven via [attr.style] — RN default
  // color left alone.
  ctaText: {
  
    fontSize:   FontSize.font12,
    color:      '#29339B',
  },
  ctaArrow: {},
  // Angular: home-banner.component.html's VALID line (!isOldBanner()-only
  // field, so no old-banner class to reconcile against) — `body3-regular-12`
  // — font-size var(--font12) (0.75rem, scales with device width — see
  // FontSize's header comment); family already matched (Poppins-Regular).
  // C2COLOR is server-driven via [attr.style] — RN default color left alone.
  validText: {
   
    fontSize:   FontSize.font12,
    color:      Colors.white,
    opacity:    0.85,
    marginTop:  4,
  },
})
