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
import { Image, Platform } from 'react-native'
import { SvgUri } from 'react-native-svg'

type Props = {
  uri:    string
  width:  number | string
  height: number | string
  style?: object
}

export default function CdnSvg({ uri, width, height, style }: Props) {
  if (Platform.OS === 'web') {
    // react-native-web's <Image> compiles to a plain <img> tag for remote
    // sources — no fetch/blob step, so no CORS involved, matching Angular.
    return <Image source={{ uri }} style={[{ width, height }, style]} resizeMode="contain" />
  }
  return <SvgUri uri={uri} width={width} height={height} style={style} />
}
