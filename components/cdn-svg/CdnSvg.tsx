// Drop-in replacement for react-native-svg's <SvgUri> for CDN-hosted icons.
//
// SvgUri/SvgCssUri work by fetch()-ing the SVG file's raw text, then parsing
// it as XML. On native that fetch goes through the OS networking layer, which
// doesn't enforce CORS. On web it goes through the browser's fetch(), which
// DOES enforce CORS — and our CDN doesn't send Access-Control-Allow-Origin,
// so every SvgCssUri icon silently fails to load on web (visible as "CORS
// error" in the Network tab).
//
// Angular never hit this because it renders these same CDN icons as plain
// <img src="..."> tags — a browser <img> just displays a resource, it never
// reads the file into JS, so CORS doesn't apply to it at all. We mirror that
// on web via React Native's <Image>, which becomes a real <img> tag there.
// Native keeps using <SvgCssUri>, since native <Image> can't decode remote
// SVGs without extra native libraries, and native has no CORS restriction
// anyway. SvgCssUri specifically (not the plain SvgUri) because several CDN
// icons (e.g. whatsapp-green-icon.svg, and the Net Banking/NEFT payment-
// method icons) are exported with a <style> block + class="x" selectors
// rather than inline fill attributes — plain SvgUri's XML parser only
// renames class->className (a no-op on native) and never applies the
// <style> rules, so every classed shape — including "fill:none" background
// rects — falls back to SVG's default black fill, rendering as a solid
// black box. SvgCssUri pulls in css-tree/css-select to actually resolve
// those rules, matching what a browser's <img> does on web.
import { useEffect, useState } from 'react'
import { Image, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { fetchText } from 'react-native-svg'
import { SvgCss, SvgCssUri } from 'react-native-svg/css'

type Props = {
  uri:    string
  width:  number | string
  height: number | string
  style?: object | undefined
  // Crop-to-fill instead of the default fit-within-bounds — for an SVG used
  // as a stand-in for a photo (e.g. the male/female avatar silhouette filling
  // the same box a real photo would), matching Angular's object-fit-cover on
  // that <img> (photo-new.component.html's .object-fit-cover class applies
  // to the avatar fallback exactly the same as a real photo — same <img>
  // tag, src just swaps on error). Default (false/omitted) keeps every other
  // CdnSvg icon usage (chevrons, badges, …) showing in full, uncropped.
  cover?: boolean | undefined
}

export default function CdnSvg({ uri, width, height, style, cover }: Props) {
  if (Platform.OS === 'web') {
    // react-native-web's <Image> compiles to a plain <img> tag for remote
    // sources — no fetch/blob step, so no CORS involved, matching Angular.
    return <Image source={{ uri }} style={[{ width, height }, style]} resizeMode={cover ? 'cover' : 'contain'} />
  }
  // react-native-svg's own default ("meet") is contain/letterbox; "slice" is
  // its cover equivalent — scale to fill, crop overflow, centered. Same
  // preserveAspectRatio CdnSvgBackground below already uses for the same
  // reason. exactOptionalPropertyTypes forbids passing `undefined` for this
  // prop explicitly, so it's only included in the spread when `cover` is set.
  return (
    <SvgCssUri
      uri={uri}
      width={width}
      height={height}
      style={style}
      {...(cover ? { preserveAspectRatio: 'xMidYMid slice' } : {})}
    />
  )
}

// For server-supplied icon URLs whose file format isn't guaranteed (e.g. PCS
// THUMBIMG, explore category ICON) — Angular renders these with a plain <img>,
// which displays either raster or SVG fine, so the real source data doesn't
// pin down which one it'll send. Branching on the extension keeps this correct
// either way instead of guessing.
export function CdnImage({
  uri, width, height, style, onError, resizeMode = 'contain',
}: Props & { onError?: () => void; resizeMode?: 'contain' | 'cover' | 'stretch' }) {
  if (/\.svg(\?|$)/i.test(uri)) {
    return <CdnSvg uri={uri} width={width} height={height} style={style} cover={resizeMode === 'cover'} />
  }
  return <Image source={{ uri }} style={[{ width, height }, style]} resizeMode={resizeMode} onError={onError} />
}

// Figma exports a raster image used as a shape fill (e.g. a photo dropped
// into a rect) as a <pattern patternContentUnits="objectBoundingBox"> whose
// content is a <use> wrapping an <image>, with a transform="scale(...)" on
// the <use> that converts the image's own pixel-sized width/height down into
// the pattern's required 0..1 coordinate space (e.g. .../nbpromotion/
// payment-male.svg — the "Become a paid member" banner's photo). Browsers
// (web <img>) and a spec-compliant rasterizer both render this correctly,
// but react-native-svg's pattern engine does not honor that <use> transform
// on native — the embedded photo comes out tiled and wildly overscaled
// instead of a single clean crop. There's no known react-native-svg fix/
// version bump for this, so instead of feeding the whole SVG through
// SvgCss(Uri), CdnSvgBackground below fetches the raw XML itself, strips out
// just the pattern-filled shape (the vector background/gradient around it —
// which reliably renders fine — is untouched), and re-draws the extracted
// photo as a plain <Image> positioned/sized using the exact same cover-scale
// math as the background SVG, so it lines up pixel-for-pixel.
type PatternPhoto = { href: string; x: number; y: number; width: number; height: number }

function extractViewBox(xml: string): [number, number, number, number] | null {
  const raw = xml.match(/<svg\b[^>]*\bviewBox="([-\d.\s]+)"/)?.[1]
  if (!raw) return null
  const parts = raw.trim().split(/\s+/).map(Number)
  return parts.length === 4 && parts.every((n) => !Number.isNaN(n)) ? (parts as [number, number, number, number]) : null
}

function extractPatternPhotos(xml: string): { xml: string; photos: PatternPhoto[] } {
  const photos: PatternPhoto[] = []
  let patched = xml
  const patternRe = /<pattern\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/pattern>/g
  let m: RegExpExecArray | null
  while ((m = patternRe.exec(xml))) {
    const [, patternId, inner] = m
    // The pattern's content is normally a <use xlink:href="#imageId"/> pointing
    // at an <image> defined separately in <defs> (Figma's export shape), not
    // an <image> inlined inside the pattern itself — fall back to an inline
    // <image> in case some asset does embed it directly.
    const useRefId = inner.match(/<use\b[^>]*\b(?:xlink:href|href)="#([^"]+)"/)?.[1]
    const href = useRefId
      ? xml.match(new RegExp(`<image\\b[^>]*\\bid="${useRefId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*\\b(?:xlink:href|href)="([^"]+)"`))?.[1]
      : inner.match(/<image\b[^>]*\b(?:xlink:href|href)="([^"]+)"/)?.[1]
    if (!href) continue
    const escapedId = patternId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const rectTag = patched.match(new RegExp(`<(?:rect|path|circle|ellipse)\\b[^>]*\\bfill="url\\(#${escapedId}\\)"[^>]*\\/?>`))?.[0]
    if (!rectTag) continue
    const x = Number(rectTag.match(/\bx="(-?[\d.]+)"/)?.[1] ?? 0)
    const y = Number(rectTag.match(/\by="(-?[\d.]+)"/)?.[1] ?? 0)
    const width = Number(rectTag.match(/\bwidth="(-?[\d.]+)"/)?.[1] ?? 0)
    const height = Number(rectTag.match(/\bheight="(-?[\d.]+)"/)?.[1] ?? 0)
    if (!width || !height) continue
    photos.push({ href, x, y, width, height })
    patched = patched.replace(rectTag, '')
  }
  return { xml: patched, photos }
}

// Fetches + patches the SVG once per uri (native only — web never renders
// this XML directly, see the Platform.OS==='web' branch below), so the
// pattern-photo workaround above only costs an extra text fetch on native.
function usePatchedSvg(uri: string) {
  const [state, setState] = useState<{ xml: string | null; photos: PatternPhoto[]; viewBox: [number, number, number, number] | null }>({
    xml: null, photos: [], viewBox: null,
  })
  useEffect(() => {
    if (Platform.OS === 'web') return
    let cancelled = false
    fetchText(uri)
      .then((text) => {
        if (cancelled || !text) return
        const { xml, photos } = extractPatternPhotos(text)
        setState({ xml, photos, viewBox: extractViewBox(text) })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [uri])
  return state
}

// For an SVG used the way CSS `background-image` would (Angular: e.g.
// .liked-profile-bg { background:url(...); background-size:cover }) — an
// ImageBackground-style wrapper, but SVG-aware. Native SvgCssUri needs an
// explicit width/height (no "auto-fill the parent" mode), so this measures
// the container via onLayout before drawing the SVG behind `children`.
export function CdnSvgBackground({
  uri, children, style, anchor = 'center', viewBox,
}: {
  uri: string
  children?: React.ReactNode
  style?: object
  // Where the cover-scaled background is anchored once it overflows, i.e. CSS
  // `background-position`. 'center' matches Angular's explicit `center center`
  // (e.g. .paid-member-block); 'top-left' matches the CSS DEFAULT (0% 0%) that
  // a rule with no background-position gets — .liked-profile-bg is one of those,
  // and centering it cropped the artwork's top off. 'bottom' matches Angular's
  // `background-position: bottom` (.matches-breather-block, the membership/
  // festival banner) — horizontally centered, anchored to the bottom edge.
  anchor?: 'center' | 'top-left' | 'bottom'
  // Overrides the source SVG's own viewBox before the cover/slice scaling
  // below runs — e.g. "0 6 110 104" treats only that sub-rectangle as the
  // source, cropping out a dead strip baked into one specific CDN asset
  // (see MatchesScreen.tsx's female blur placeholder) instead of showing it.
  // Space-separated "minX minY width height", same syntax as the SVG
  // viewBox attribute. Omit to use the asset's own viewBox unchanged.
  viewBox?: string
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const patched = usePatchedSvg(uri)

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout
    setSize({ width, height })
  }

  // Same "minX minY w h" the viewBox prop/SVG's own viewBox uses — the
  // coordinate space extractPatternPhotos' x/y/width/height are measured in.
  const effectiveViewBox = viewBox
    ? (viewBox.trim().split(/\s+/).map(Number) as [number, number, number, number])
    : patched.viewBox
  // Cover-scale math mirroring the "slice" preserveAspectRatio below, so an
  // extracted photo lines up exactly with where the background SVG would
  // have drawn it. anchor governs the crop origin exactly like the
  // preserveAspectRatio prefix and CSS backgroundPosition do elsewhere here.
  const photoOverlays =
    size && effectiveViewBox
      ? (() => {
          const [minX, minY, vbW, vbH] = effectiveViewBox
          const scale = Math.max(size.width / vbW, size.height / vbH)
          const shiftX = anchor === 'top-left' ? 0 : (size.width - vbW * scale) / 2
          const shiftY = anchor === 'center' ? (size.height - vbH * scale) / 2 : anchor === 'bottom' ? size.height - vbH * scale : 0
          return patched.photos.map((p) => ({
            ...p,
            left:   shiftX + (p.x - minX) * scale,
            top:    shiftY + (p.y - minY) * scale,
            width:  p.width * scale,
            height: p.height * scale,
          }))
        })()
      : []

  return (
    // overflow: 'hidden' clips whatever the "slice"/"cover" scaling below
    // pushes past the container box — background-size:cover crops, it
    // doesn't letterbox, and without this the overflow would just spill out.
    <View style={[style, { overflow: 'hidden' }]} onLayout={handleLayout}>
      {!!size && (
        Platform.OS === 'web'
          // Angular: background: url(...); background-repeat: no-repeat;
          // background-size: cover — a real CSS background, with NO
          // background-position override (so it defaults to the browser's
          // native top-left anchor). RN's <Image resizeMode="cover"> compiles
          // (in react-native-web) to that same backgroundImage/backgroundSize
          // CSS under the hood, but it also force-sets background-position:
          // center — which this SVG's Angular original never had, so the
          // crop was centered instead of top-left-anchored ("not aligned
          // good"). Setting backgroundImage directly here matches Angular's
          // CSS exactly instead of going through Image's own opinionated
          // resizeMode mapping. (`as any` — backgroundImage/backgroundSize/
          // backgroundRepeat are react-native-web-only style keys, not in
          // React Native's own ViewStyle type.)
          ? <View style={[StyleSheet.absoluteFill, {
              // #svgView(viewBox(...)) is a standard SVG fragment identifier
              // that browsers honor on an <img>/background-image source —
              // lets the web path crop the same sub-rectangle as the native
              // branch's `viewBox` override below, with no second asset.
              // The url() value MUST be quoted here: unquoted CSS url()
              // can't contain literal parentheses/commas, both of which
              // #svgView(viewBox(...)) is made of — without quotes the
              // browser fails to parse the fragment and silently falls back
              // to the full, uncropped image.
              backgroundImage: `url("${uri}${viewBox ? `#svgView(viewBox(${viewBox.trim().split(/\s+/).join(',')}))` : ''}")`,
              backgroundSize:     'cover',
              backgroundRepeat:   'no-repeat',
              backgroundPosition: anchor === 'center' ? 'center' : anchor === 'bottom' ? '50% 100%' : '0% 0%',
            } as any]} />
          // "xMidYMid slice" is the SVG spec's own equivalent of CSS
          // background-size:cover (scale to fill, crop overflow, centered) —
          // react-native-svg's default ("meet") is closer to contain/
          // letterbox, and would leave gaps instead of covering.
          : !!patched.xml && (
            <>
              <SvgCss
                xml={patched.xml}
                width={size.width}
                height={size.height}
                {...(viewBox ? { viewBox } : {})}
                // "slice" is the SVG spec's background-size:cover; the xMin/xMid/
                // yMin/yMax prefix is its background-position — xMinYMin pins the
                // top-left corner (CSS's 0% 0% default), xMidYMid centers, xMidYMax
                // pins the bottom edge (CSS background-position: bottom).
                preserveAspectRatio={
                  anchor === 'center' ? 'xMidYMid slice' : anchor === 'bottom' ? 'xMidYMax slice' : 'xMinYMin slice'
                }
                style={StyleSheet.absoluteFill}
              />
              {/* Any photo(s) extractPatternPhotos pulled out of a <pattern>
                  fill — react-native-svg can't draw these itself (see the
                  comment above usePatchedSvg), so they're redrawn here as
                  plain <Image>s, positioned with the same cover-scale math
                  the SVG above was just drawn with. resizeMode="stretch"
                  matches the source's own preserveAspectRatio="none" on its
                  <image> (the design stretches to exactly fill its rect). */}
              {photoOverlays.map((p, i) => (
                <Image
                  key={i}
                  source={{ uri: p.href }}
                  resizeMode="stretch"
                  style={{ position: 'absolute', left: p.left, top: p.top, width: p.width, height: p.height }}
                />
              ))}
            </>
          )
      )}
      {children}
    </View>
  )
}
