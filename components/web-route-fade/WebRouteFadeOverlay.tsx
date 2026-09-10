import { useEffect, useRef } from 'react'
import { Animated, Platform, StyleSheet } from 'react-native'
import { Colors } from '../../constants/colors'

const FADE_DURATION_MS = 160

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// Native-stack renders zero transition on web — react-native-screens' web
// ScreenStack is a plain View that just toggles display:none (see
// node_modules/react-native-screens/src/components/Screen.web.tsx), so a
// push/pop there is an instant hard cut. This plays a brief opacity fade
// over the newly-revealed screen to soften that cut on web only; iOS/Android
// already get a real native transition from native-stack and never render
// this (it returns null there).
//
// `routeKey` is the AppStack/AuthStack-level current route's unique `key`
// (see RootNavigation.tsx) — NOT its name, and NOT the deepest focused
// route. Using `key` (not `name`) matters because the registration wizard
// re-pushes the SAME route name ('onboarding') for every step; using `key`
// still tells each step apart. Using the top-level entry (not the deepest
// route) means switching tabs inside MainTabs never triggers this, matching
// the "keep tab transitions subtle, no push-style animation" requirement.
export default function WebRouteFadeOverlay({ routeKey }: { routeKey: string | undefined }) {
  const opacity = useRef(new Animated.Value(0)).current
  const firstRunRef = useRef(true)

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (firstRunRef.current) {
      firstRunRef.current = false
      return
    }
    if (prefersReducedMotion()) return
    opacity.setValue(1)
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_DURATION_MS,
      useNativeDriver: true,
    }).start()
  }, [routeKey, opacity])

  if (Platform.OS !== 'web') return null

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]}
    />
  )
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: Colors.background,
  },
})
