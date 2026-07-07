// Web ad banner — a plain <iframe>, exactly matching Angular's
// `<iframe [src]="gamBannerUrl">` (matches.page.html). Metro/Expo picks this
// file automatically for web builds; GamBanner.tsx (WebView) is used for
// native. See gamBanner.shared.ts for the shared URL-building logic.
//
// Uses React.createElement('iframe', ...) instead of JSX <iframe> — this
// project's tsconfig targets React Native's JSX.IntrinsicElements (View/Text/
// etc.), which doesn't declare DOM elements like <iframe>, so plain JSX would
// fail to type-check even though it only ever runs on web.
import { createElement } from 'react'
import { StyleSheet, View } from 'react-native'
import { buildGamBannerUrl, type GamBannerParams } from './gamBanner.shared'

const BANNER_HEIGHT = 90

export default function GamBanner(params: GamBannerParams) {
  return (
    <View style={s.container}>
      {createElement('iframe', {
        src:         buildGamBannerUrl(params),
        style:       { width: '100%', height: BANNER_HEIGHT, border: 'none' },
        scrolling:   'no',
      })}
    </View>
  )
}

const s = StyleSheet.create({
  container: { height: BANNER_HEIGHT, width: '100%' },
})
