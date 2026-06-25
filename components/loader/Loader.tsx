import { useEffect, useRef } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Colors } from '../../constants/colors'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoaderVariant =
  | 'spinner'             // small/medium inline spinner — general purpose
  | 'matchloader'         // full-height large spinner for matches list
  | 'skeleton-dashboard'  // shimmer skeleton for daily-recommendation layout
  | 'skeleton-matches'    // shimmer skeleton for matches grid layout

export interface LoaderProps {
  variant?:   LoaderVariant | undefined
  message?:   string | undefined   // optional text shown below spinner
  fullPage?:  boolean | undefined  // fills the parent container (flex: 1)
}

export interface ModalLoaderProps {
  visible:  boolean
  message?: string | undefined
  onDismiss?: (() => void) | undefined
}

// ─── Constants ────────────────────────────────────────────────────────────────

const W = Dimensions.get('window').width

// Skeleton bone color — matches Angular ion-skeleton-text default
const BONE_COLOR = '#E8E8E8'

// ─── useShimmer ───────────────────────────────────────────────────────────────
// Shared shimmer hook — single Animated.Value drives all bones in a skeleton.
// Mirrors Angular's ion-skeleton-text [animated] pulsing effect.

function useShimmer(): Animated.Value {
  const opacity = useRef(new Animated.Value(0.35)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  return opacity
}

// ─── Bone ─────────────────────────────────────────────────────────────────────
// A single shimmer rectangle. Accepts all the same dimensions you'd set on a View.

interface BoneProps {
  width:    number | `${number}%`
  height:   number
  opacity:  Animated.Value
  borderRadius?:            number
  borderTopLeftRadius?:     number
  borderTopRightRadius?:    number
  borderBottomLeftRadius?:  number
  borderBottomRightRadius?: number
  style?:   object
}

function Bone({ opacity, style, ...dims }: BoneProps) {
  return (
    <Animated.View
      style={[{ backgroundColor: BONE_COLOR, opacity }, dims, style]}
    />
  )
}

// ─── SkeletonDashboard ────────────────────────────────────────────────────────
// Mirrors Angular dashboardSkull — title bar + two-card row + bottom text row.
// SCSS values converted: vw → W * fraction.

function SkeletonDashboard() {
  const opacity = useShimmer()

  return (
    <View style={sk.wrap}>
      {/* Title bar — 75vw × 40px */}
      <Bone opacity={opacity} width={W * 0.75} height={40} borderRadius={8} style={sk.title} />

      {/* Two-card row: main square + narrow side strip */}
      <View style={sk.cardRow}>
        <Bone opacity={opacity} width={W * 0.72} height={W * 0.72} borderRadius={12} />
        <Bone
          opacity={opacity}
          width={W * 0.09}
          height={W * 0.72}
          borderTopLeftRadius={16}
          borderBottomLeftRadius={16}
          borderTopRightRadius={0}
          borderBottomRightRadius={0}
        />
      </View>

      {/* Bottom text row: left label + right label */}
      <View style={sk.bottomRow}>
        <Bone opacity={opacity} width={W * 0.20} height={20} borderRadius={40} />
        <Bone opacity={opacity} width={W * 0.33} height={20} borderRadius={40} />
      </View>
    </View>
  )
}

// ─── SkeletonMatches ──────────────────────────────────────────────────────────
// Matches list variant of the skeleton — slightly smaller cards (55.55vw).

function SkeletonMatches() {
  const opacity = useShimmer()

  return (
    <View style={sk.wrap}>
      <Bone opacity={opacity} width={W * 0.75} height={40} borderRadius={8} style={sk.title} />

      <View style={sk.cardRow}>
        <Bone opacity={opacity} width={W * 0.5555} height={W * 0.5555} borderRadius={12} />
        <Bone
          opacity={opacity}
          width={W * 0.28}
          height={W * 0.5555}
          borderTopLeftRadius={16}
          borderBottomLeftRadius={16}
          borderTopRightRadius={0}
          borderBottomRightRadius={0}
        />
      </View>

      <View style={sk.bottomRow}>
        <Bone opacity={opacity} width={W * 0.20} height={20} borderRadius={40} />
        <Bone opacity={opacity} width={W * 0.33} height={20} borderRadius={40} />
      </View>
    </View>
  )
}

// ─── Loader ───────────────────────────────────────────────────────────────────
// Inline loader — embeds directly into any screen or list.
// Parent controls sizing; use fullPage to fill available space.

export default function Loader({ variant = 'spinner', message, fullPage = false }: LoaderProps) {
  if (variant === 'skeleton-dashboard') return <SkeletonDashboard />
  if (variant === 'skeleton-matches')  return <SkeletonMatches />

  const isMatch = variant === 'matchloader'

  return (
    <View style={[styles.spinnerWrap, fullPage && styles.fullPage, isMatch && styles.matchWrap]}>
      <ActivityIndicator
        size="large"
        color={Colors.primary}
        style={isMatch ? styles.largeSpinner : undefined}
      />
      {!!message && <Text style={styles.message}>{message}</Text>}
    </View>
  )
}

// ─── ModalLoader ──────────────────────────────────────────────────────────────
// Full-screen modal loader — replaces Angular's loader.component shown via ModalController.
// Renders a centered spinner with optional message at ~33% from top (matches Angular CSS).

export function ModalLoader({ visible, message = 'Just a moment…', onDismiss }: ModalLoaderProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <ActivityIndicator size="large" color={Colors.primary} />
          {!!message && <Text style={styles.message}>{message}</Text>}
        </View>
      </View>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  spinnerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  fullPage: {
    flex: 1,
  },
  // Angular .matches-loader { position: relative; bottom: 86px }
  // Achieved here by giving the spinner more top space so content appears slightly raised.
  matchWrap: {
    flex: 1,
    paddingBottom: 86,
  },
  largeSpinner: {
    transform: [{ scale: 1.5 }],
  },
  message: {
    marginTop: 18,
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },

  // ── ModalLoader ─────────────────────────────────────────────────────────────
  // Angular: .full-popup { height: 100vh } + .loader-div { margin-top: 33vh }
  overlay: {
    flex: 1,
    backgroundColor: Colors.surface,
    justifyContent: 'flex-start',
    paddingTop: '33%',
    alignItems: 'center',
  },
  modalCard: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
})

const sk = StyleSheet.create({
  wrap: {
    marginHorizontal: 24,
    marginVertical: 16,
  },
  title: {
    marginTop: 18,
    marginBottom: 18,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 16,
    gap: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
})
