import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'

export type ScreenTopInsetVariant = 'chrome' | 'transparent' | 'none'

interface ScreenTopInsetProps {
  // "chrome"      — paints Colors.background (gray), matching AppHeader.tsx's
  //                  h1SafeArea / ActivityScreen.tsx's top SafeAreaView. Use on
  //                  a screen whose own local header/content below is a plain
  //                  white/surface box — the same two-layer gray-strip +
  //                  colored-content split those already use.
  // "transparent" — reserves the same inset height but paints nothing, so a
  //                  full-bleed gradient/background the screen renders behind
  //                  this (DailyRecommendationScreen-style) shows through
  //                  unchanged instead of being covered by gray.
  // "none"        — renders nothing; the screen intentionally draws edge-to-
  //                  edge under the status bar/notch.
  variant?: ScreenTopInsetVariant
  style?:   StyleProp<ViewStyle>
}

// Shared top-inset strip for screens that render their own local header
// (rather than going through components/app-header/AppHeader.tsx or
// components/matches-header/MatchesHeader.tsx, which already handle this
// internally). Replaces the old per-screen pattern of a single outer View
// combining `paddingTop: insets.top` with that screen's own content
// background — which made the inset strip's color an accident of whatever
// that screen's body background happened to be, rather than a deliberate
// choice. Render this as the FIRST child of the screen, above everything
// else, with no padding/insets applied anywhere else in that screen's own
// tree (see each migrated screen's own comment for what was removed).
export default function ScreenTopInset({ variant = 'chrome', style }: ScreenTopInsetProps) {
  const insets = useSafeAreaInsets()
  if (variant === 'none' || insets.top === 0) return null
  return (
    <View
      style={[
        { height: insets.top },
        variant === 'chrome' ? { backgroundColor: Colors.background } : null,
        style,
      ]}
    />
  )
}
