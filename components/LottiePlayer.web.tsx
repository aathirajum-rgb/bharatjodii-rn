// Web counterpart to LottiePlayer.tsx — lottie-web was removed from the
// project on request, and this component is currently unused (nothing
// imports LottiePlayer yet), so there's no case to preserve an actual
// animation for on web. Renders the splash background color and calls
// onFinish immediately, so the contract still holds if this ever gets wired
// up — the app won't hang waiting for an animation-complete event that will
// never fire on this platform.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = { onFinish: () => void };

export default function LottiePlayer({ onFinish }: Props) {
  useEffect(() => {
    onFinish();
  }, [onFinish]);

  return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#ffffff' }]} />;
}
