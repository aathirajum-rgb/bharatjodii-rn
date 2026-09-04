// Native (Android/iOS) ad banner — Angular embeds the ad-serving page in an
// <iframe>; WebView is the native equivalent. See gamBanner.shared.ts for the
// URL-building logic and GamBanner.web.tsx for the web counterpart.
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import type { ShouldStartLoadRequest, WebViewErrorEvent, WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes'
import { buildGamBannerUrl, type GamBannerParams } from './gamBanner.shared'

const BANNER_HEIGHT = 90

// Ad creative and click-through destinations legitimately come from
// unpredictable third-party advertiser domains — that's how ad networks
// work — so navigation can't be host-restricted the way the payment WebView
// is. Only the scheme is restricted, blocking a hijack to intent://,
// market://, or other non-http(s) schemes an aggressive/compromised ad
// script could otherwise trigger.
function handleShouldStartLoad(request: ShouldStartLoadRequest): boolean {
  try {
    return new URL(request.url).protocol === 'https:'
  } catch {
    return false
  }
}

export default function GamBanner(params: GamBannerParams) {
  const uri = buildGamBannerUrl(params)
  const [failed, setFailed] = useState(false)

  // Reset if the ad slot is ever re-targeted with different params, so a
  // stale failure doesn't permanently hide a since-fixed/different ad.
  useEffect(() => { setFailed(false) }, [uri])

  // A failed ad load (network error, ad server down, cert error) would
  // otherwise show the WebView's native error page inline in the banner
  // slot — collapse the banner entirely instead.
  if (failed) return null

  function handleError(_event: WebViewErrorEvent | WebViewHttpErrorEvent) {
    setFailed(true)
  }

  return (
    <View style={s.container}>
      <WebView
        source={{ uri }}
        style={s.webview}
        scrollEnabled={false}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onError={handleError}
        onHttpError={handleError}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { height: BANNER_HEIGHT, width: '100%' },
  webview:   { flex: 1, backgroundColor: 'transparent' },
})
