// iOS-style toggle, used everywhere in place of React Native's <Switch>.
//
// Angular renders every one of these as <ion-toggle mode="ios">, which is the
// pill track + inset round handle on ALL platforms. RN's <Switch> only looks
// like that on iOS/web — on Android it falls back to the Material switch (thin
// track with an overhanging thumb), so the same screen looked different per
// platform. Drawing it ourselves keeps it identical everywhere.
//
// Geometry is Ionic's own toggle.ios.css `:host` block, verbatim:
//   width: 51px; height: 32px; --border-radius: 16px
//   --background: rgba(var(--ion-text-color-rgb, 0,0,0), 0.088)
//   --background-checked: var(--ion-color-primary)  → #B50033 (Colors.primaryDark)
//   --handle-width/height: calc(32px - (2px * 2))   → 28
//   --handle-spacing: 2px; --handle-background: #ffffff
//   --handle-box-shadow: 0 3px 12px rgba(0,0,0,0.16), 0 3px 1px rgba(0,0,0,0.1)
//   --handle-transition: transform 300ms
import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, type ViewStyle } from 'react-native'
import { Colors } from '../../constants/colors'

const TRACK_W = 51
const TRACK_H = 32
const SPACING = 2
const HANDLE  = TRACK_H - SPACING * 2          // 28
const TRAVEL  = TRACK_W - HANDLE - SPACING * 2 // 19

// Ionic's off-state track is a text-colour alpha, not a solid grey — on the
// default black text colour that resolves to rgba(0,0,0,0.088).
const TRACK_OFF = 'rgba(0, 0, 0, 0.088)'
const TRACK_ON  = Colors.primaryDark

export interface ToggleProps {
  value:          boolean
  onValueChange:  (value: boolean) => void
  disabled?:      boolean | undefined
  style?:         ViewStyle | undefined
}

export default function Toggle({ value, onValueChange, disabled = false, style }: ToggleProps) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue:  value ? 1 : 0,
      duration: 300,
      // backgroundColor can't be driven natively, and the handle has to stay in
      // step with the track, so both run on the JS driver.
      useNativeDriver: false,
    }).start()
  }, [value, anim])

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] })
  const backgroundColor = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [TRACK_OFF, TRACK_ON],
  })

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[disabled && s.disabled, style]}
    >
      <Animated.View style={[s.track, { backgroundColor }]}>
        <Animated.View style={[s.handle, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  track: {
    width:         TRACK_W,
    height:        TRACK_H,
    borderRadius:  16,
    padding:       SPACING,
    justifyContent: 'center',
  },
  handle: {
    width:        HANDLE,
    height:       HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: Colors.white,
    // Ionic: 0 3px 12px rgba(0,0,0,.16) — RN takes a single shadow, so the
    // second, tighter 0 3px 1px rgba(0,0,0,.1) layer is dropped.
    shadowColor:   '#000000',
    shadowOpacity: 0.16,
    shadowRadius:  12,
    shadowOffset:  { width: 0, height: 3 },
    elevation:     3,
  },
  disabled: { opacity: 0.5 },
})
