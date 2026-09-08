import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import LottieView from 'lottie-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CDN_SPLASH_LOTTIE } from '../constants/cdn';

type Props = {
  onFinish: () => void;
};

// How long to wait for the splash Lottie before giving up and letting the
// app continue anyway — this screen gates app boot (onFinish navigates
// onward), so a slow/failed network fetch must never leave the user stuck
// here. Comfortably above a slow-network load time, well under "looks frozen".
const SPLASH_TIMEOUT_MS = 6000;

export default function SplashAnimationScreen({ onFinish }: Props) {
  const finished = useRef(false);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const finishOnce = () => {
      if (finished.current) return;
      finished.current = true;
      onFinish();
    };
    const timer = setTimeout(finishOnce, SPLASH_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishOnce = () => {
    if (finished.current) return;
    finished.current = true;
    onFinish();
  };

  // Same field deepLinkService.ts reads for the active flavor (app.config.js's
  // `extra.appFlavor`) — each flavor's splash Lottie carries its own localized
  // "Matrimony.com" text/branding, matching the legacy Android app's per-flavor
  // res/raw/splash_anim.json (QA #2). CDN-hosted like every other Lottie in
  // this app (see constants/cdn.ts), not bundled locally.
  const flavor = String(Constants.expoConfig?.extra?.appFlavor ?? 'jodii');
  const splashUri = `${CDN_SPLASH_LOTTIE}${flavor}.json`;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <LottieView
        source={{ uri: splashUri }}
        autoPlay
        loop={false}
        onAnimationFinish={finishOnce}
        onAnimationFailure={finishOnce}
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
