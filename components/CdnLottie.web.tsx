// Web counterpart to CdnLottie.tsx. lottie-react-native does not render on web
// at all (it has no web implementation), which is why this file exists.
//
// It previously rendered an EMPTY sized <View> — the comment said the project
// carried no web Lottie library because "lottie-web was removed on request".
// That is no longer true: @lottiefiles/dotlottie-react (0.13.5) is in
// package.json and installed, and `npm run web` / `build:web` are real targets.
// So every CdnLottie on web was silently a blank box — visible as the empty gap
// above the caption in the ignored-profiles empty state.
//
// Now renders the animation for real via DotLottieReact, which paints to a
// <canvas>. Same props as the native component, so callers need no change.
//
// TRADE-OFF worth knowing: dotlottie-web fetches its ~1.8MB WASM player at
// runtime from jsDelivr (falling back to unpkg) the first time any animation
// mounts. A copy also ships locally at
// node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm — if the
// third-party fetch is unacceptable, serve that file yourself and call
// `setWasmUrl('<your-url>')` once at app start instead.
//
// This affects EVERY CdnLottie caller on web, not just one screen:
// CoverflowSwiper, NotificationScreen, HomeScreen, DiscoverMatchesScreen and
// IgnoredProfilesScreen. Reverting is a one-file change back to the empty View.
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { View } from 'react-native'

type Props = { uri: string; width: number; height: number; loop?: boolean; style?: object }

export default function CdnLottie({ uri, width, height, loop = true, style }: Props) {
  return (
    // Outer View keeps the RN layout contract (fixed box, caller-supplied
    // style) identical to CdnLottie.tsx; the canvas just fills it.
    <View style={[{ width, height }, style]}>
      <DotLottieReact
        src={uri}
        autoplay
        loop={loop}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  )
}
