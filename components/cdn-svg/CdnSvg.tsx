// Drop-in replacement for react-native-svg's <SvgUri> for CDN-hosted icons.
//
// SvgUri works by fetch()-ing the SVG file's raw text, then parsing it as XML.
// On native that fetch goes through the OS networking layer, which doesn't
// enforce CORS. On web it goes through the browser's fetch(), which DOES
// enforce CORS — and our CDN doesn't send Access-Control-Allow-Origin, so
// every SvgUri icon silently fails to load on web (visible as "CORS error"
// in the Network tab).
//
// Angular never hit this because it renders these same CDN icons as plain
// <img src="..."> tags — a browser <img> just displays a resource, it never
// reads the file into JS, so CORS doesn't apply to it at all. We mirror that
// on web via React Native's <Image>, which becomes a real <img> tag there.
// Native keeps using <SvgUri>, since native <Image> can't decode remote SVGs
// without extra native libraries, and native has no CORS restriction anyway.
import { useState } from 'react'
import { Image, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { SvgUri } from 'react-native-svg'

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
  return <SvgUri uri={uri} width={width} height={height} style={style} />
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
// ImageBackground-style wrapper, but SVG-aware. Native SvgUri needs an
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
    <View style={style} onLayout={handleLayout}>
      {!!size && (
        Platform.OS === 'web'
          // react-native-web's <Image> compiles to a plain <img> tag — no
          // CORS-blocked fetch, and resizeMode="cover" matches background-size:cover.
          ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <SvgUri uri={uri} width={size.width} height={size.height} style={StyleSheet.absoluteFill} />
      )}
      {children}
    </View>
  )
}
