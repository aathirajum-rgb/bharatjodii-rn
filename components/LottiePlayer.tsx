import LottieView from 'lottie-react-native';
import { StyleSheet } from 'react-native';

type Props = { onFinish: () => void };

export default function LottiePlayer({ onFinish }: Props) {
  return (
    <LottieView
      source={require('../assets/jodii-launch-lottie-with-bg.json')}
      autoPlay
      loop={false}
      onAnimationFinish={onFinish}
      style={StyleSheet.absoluteFill}
    />
  );
}
