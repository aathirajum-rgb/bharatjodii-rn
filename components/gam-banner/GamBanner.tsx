// Native (Android/iOS) ad banner — Angular embeds the ad-serving page in an
// <iframe>; WebView is the native equivalent. See gamBanner.shared.ts for the
// URL-building logic and GamBanner.web.tsx for the web counterpart.
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { buildGamBannerUrl, type GamBannerParams } from './gamBanner.shared'

const BANNER_HEIGHT = 90

export default function GamBanner(params: GamBannerParams) {
  return (
    <View style={s.container}>
      <WebView source={{ uri: buildGamBannerUrl(params) }} style={s.webview} scrollEnabled={false} />
    </View>
  )
}

const s = StyleSheet.create({
  container: { height: BANNER_HEIGHT, width: '100%' },
  webview:   { flex: 1, backgroundColor: 'transparent' },
})
