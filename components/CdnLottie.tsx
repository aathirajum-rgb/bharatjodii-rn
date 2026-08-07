// Remote-URL counterpart to LottiePlayer.tsx (which only plays a bundled
// local asset) — for CDN-hosted animation JSON, e.g. Angular's
// <lottie-player src="{{common.ImgDomain() + '...'}}"> usages (success-heart-
// animation.json, today-matches-animation.json, new-tag-animation.json).
import LottieView from 'lottie-react-native'

type Props = { uri: string; width: number; height: number; loop?: boolean; style?: object }

export default function CdnLottie({ uri, width, height, loop = true, style }: Props) {
  return (
    <LottieView
      source={{ uri }}
      autoPlay
      loop={loop}
      style={[{ width, height }, style]}
    />
  )
}
