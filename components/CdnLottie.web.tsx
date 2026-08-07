// Web counterpart to CdnLottie.tsx — lottie-react-native doesn't render on
// web, and the project doesn't carry a web Lottie library (lottie-web was
// removed on request), so these purely decorative animations (background
// flourishes behind section headers, not core content) just render nothing
// on web rather than pull that dependency back in. Native keeps the real
// animation via CdnLottie.tsx.
import { View } from 'react-native'

type Props = { uri: string; width: number; height: number; loop?: boolean; style?: object }

export default function CdnLottie({ width, height, style }: Props) {
  return <View style={[{ width, height }, style]} />
}
