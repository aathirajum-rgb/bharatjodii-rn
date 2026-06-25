import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

const animationData = require('../assets/jodii-launch-lottie-with-bg.json');

// Require the CJS build directly — Metro's default `import lottie from 'lottie-web'`
// resolves to the ESM build which has an EventEmitter class-inheritance error in
// the Metro web bundle. The CJS light build is self-contained and avoids that.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lottieModule = require('lottie-web/build/player/lottie_light.js');
const lottieLib = (lottieModule.default ?? lottieModule) as any;

type Props = { onFinish: () => void };

export default function LottiePlayer({ onFinish }: Props) {
  const containerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const anim = lottieLib.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: false,
      autoplay: true,
      animationData,
    });
    anim.addEventListener('complete', onFinish);
    return () => anim.destroy();
  }, []);

  return <View ref={containerRef} style={StyleSheet.absoluteFillObject} />;
}
