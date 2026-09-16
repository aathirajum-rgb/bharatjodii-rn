import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CDN_SPLASH_STATIC } from '../constants/cdn';

type Props = {
  onFinish: () => void;
};

// BharatJodii rebrand dropped the per-flavor Lottie splash animation in favor
// of a static image, matching the native Android app's same migration
// (activity_splash.xml: LottieAnimationView -> plain ImageView). A static
// image has no "finished" event, so this just holds the art on screen for a
// fixed dwell — long enough to register, short of "looks frozen" — then lets
// the app continue.
const SPLASH_DISPLAY_MS = 1500;

// Real per-flavor splash art ported from the native Android app's
// drawable-xxxhdpi/splash_screen.png — bundled locally (not CDN-fetched) for
// the 9 flavors that migration actually redesigned. require() needs a static
// literal path per call for Metro to bundle the asset, so this can't be built
// from a dynamic flavor string — every flavor gets its own explicit entry.
const BUNDLED_SPLASH: Record<string, ReturnType<typeof require>> = {
  jodii:     require('../assets/splash-bharatjodii.png'),
  tamil:     require('../assets/splash-tamil.png'),
  malayalam: require('../assets/splash-malayalam.png'),
  telugu:    require('../assets/splash-telugu.png'),
  kannada:   require('../assets/splash-kannada.png'),
  oriya:     require('../assets/splash-oriya.png'),
  bengali:   require('../assets/splash-bengali.png'),
  marathi:   require('../assets/splash-marathi.png'),
  gujarati:  require('../assets/splash-gujarati.png'),
  punjabi:   require('../assets/splash-punjabi.png'),
};

export default function SplashAnimationScreen({ onFinish }: Props) {
  const finished = useRef(false);
  const [cdnImageFailed, setCdnImageFailed] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const finishOnce = () => {
      if (finished.current) return;
      finished.current = true;
      onFinish();
    };
    const timer = setTimeout(finishOnce, SPLASH_DISPLAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same field deepLinkService.ts reads for the active flavor (app.config.js's
  // `extra.appFlavor`).
  const flavor = String(Constants.expoConfig?.extra?.appFlavor ?? 'jodii');
  const bundledSplash = BUNDLED_SPLASH[flavor];
  const splashUri = `${CDN_SPLASH_STATIC}${flavor}.png`;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {bundledSplash ? (
        <Image source={bundledSplash} style={styles.image} resizeMode="cover" />
      ) : !cdnImageFailed ? (
        // Remaining ~50 community/caste flavors: no rebranded asset exists
        // even in the native Android app (only the 9 above were redesigned),
        // so this falls back to a CDN fetch — a failed/missing image just
        // leaves the plain brand-color background instead of crashing boot.
        <Image
          source={{ uri: splashUri }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setCdnImageFailed(true)}
        />
      ) : null}
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
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
