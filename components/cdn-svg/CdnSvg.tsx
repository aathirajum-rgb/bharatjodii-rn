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
import { useState } from 'react'
import { Image, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { SvgCssUri } from 'react-native-svg/css'

type Props = {
  uri:    string
  width:  number | string
  height: number | string
  style?: object | undefined
}

export default function CdnSvg({ uri, width, height, style }: Props) {
  if (Platform.OS === 'web') {
    // react-native-web's <Image> compiles to a plain <img> tag for remote
    // sources — no fetch/blob step, so no CORS involved, matching Angular.
    return <Image source={{ uri }} style={[{ width, height }, style]} resizeMode="contain" />
  }
  return <SvgCssUri uri={uri} width={width} height={height} style={style} />
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
    return <CdnSvg uri={uri} width={width} height={height} style={style} />
  }
  return <Image source={{ uri }} style={[{ width, height }, style]} resizeMode={resizeMode} onError={onError} />
}

// For an SVG used the way CSS `background-image` would (Angular: e.g.
// .liked-profile-bg { background:url(...); background-size:cover }) — an
// ImageBackground-style wrapper, but SVG-aware. Native SvgCssUri needs an
// explicit width/height (no "auto-fill the parent" mode), so this measures
// the container via onLayout before drawing the SVG behind `children`.
export function CdnSvgBackground({
  uri, children, style,
}: { uri: string; children?: React.ReactNode; style?: object }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout
    setSize({ width, height })
  }

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
              backgroundImage:  `url(${uri})`,
              backgroundSize:   'cover',
              backgroundRepeat: 'no-repeat',
            } as any]} />
          // "xMidYMid slice" is the SVG spec's own equivalent of CSS
          // background-size:cover (scale to fill, crop overflow, centered) —
          // react-native-svg's default ("meet") is closer to contain/
          // letterbox, and would leave gaps instead of covering.
          : (
            <SvgCssUri
              uri={uri}
              width={size.width}
              height={size.height}
              preserveAspectRatio="xMidYMid slice"
              style={StyleSheet.absoluteFill}
            />
          )
      )}
      {children}
    </View>
  )
}
