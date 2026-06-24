import * as SplashScreen from 'expo-splash-screen';
import LottieView from 'lottie-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

type Props = {
  onFinish: () => void;
};

export default function SplashAnimationScreen({ onFinish }: Props) {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <LottieView
        source={require('../assets/jodii-launch-lottie-with-bg.json')}
        autoPlay
        loop={false}
        onAnimationFinish={onFinish}
        style={styles.animation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#d40c49',
  },
  animation: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
