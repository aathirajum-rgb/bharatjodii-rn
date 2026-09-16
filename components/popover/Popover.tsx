import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native'
import { Colors } from '../../constants/colors'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import { FontSize } from '../../src/theme/fonts'

const SCREEN_W = Dimensions.get('window').width
const SCREEN_H = Dimensions.get('window').height
const POPOVER_W = Math.min(SCREEN_W - 32, 280)
// Angular: global.scss's `ion-popover::part(arrow) { height: 15px !important }` —
// Ionic's built-in popover pointer, a rotated square, 15px in this app's override.
const ARROW_SIZE = 15

// ─── Types ────────────────────────────────────────────────────────────────────

// Maps to Angular's popover `action` prop.
export type PopoverType = 'attentionPopup' | 'verifiedPopup'

// Screen-space bounding box of the trigger element.
// Get it by calling ref.current.measure((fx, fy, w, h, px, py) => ...) on a View ref.
export interface PopoverAnchor {
  x:      number
  y:      number
  width:  number
  height: number
}

export interface PopoverProps {
  visible:      boolean
  type:         PopoverType
  title?:       string | undefined   // attentionPopup: ATTENTION content
  content?:     string | undefined   // attentionPopup: SUBCONTENT / verifiedPopup: body text
  gotItLabel?:  string | undefined   // attentionPopup confirm button label (default: "Got It")
  anchor?:      PopoverAnchor | undefined  // position the popover near this element
  onClose?:     (() => void) | undefined
}

// ─── Popover ──────────────────────────────────────────────────────────────────
// Replaces Angular's app-popover (Ionic PopoverController).
// Two types:
//   attentionPopup — small card with title + body + "Got It" button
//   verifiedPopup  — small tooltip (e.g. "Verified via Call") anchored near a badge

export default function Popover({
  visible,
  type,
  title,
  content,
  gotItLabel = 'Got It',
  anchor,
  onClose,
}: PopoverProps) {
  const [modalVisible, setModalVisible] = useState(visible)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
      Animated.timing(fadeAnim, {
        toValue:         1,
        duration:        150,
        useNativeDriver: true,
      }).start()
    } else {
      Animated.timing(fadeAnim, {
        toValue:         0,
        duration:        120,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setModalVisible(false)
      })
    }
  }, [visible, fadeAnim])

  function getPosition(): ViewStyle {
    if (!anchor) {
      // Default: center the popover horizontally, 35% from top
      return {
        position: 'absolute',
        top:      SCREEN_H * 0.35,
        left:     16,
        right:    16,
      }
    }
    // Prefer below anchor; clamp horizontally to screen edges.
    // Angular's verifiedPopup tooltip is `width: fit-content` (hugs its short
    // text, e.g. "Name verified through UPI"), not a fixed card width like
    // attentionPopup's own confirm-button layout needs — so only attentionPopup
    // gets the fixed POPOVER_W; verifiedPopup is left unconstrained (content-sized)
    // and just clamped so it can't run off the right edge.
    // ARROW_TOP_MARGIN (verifiedPopup only) leaves room above the tooltip for the
    // pointer triangle rendered below — Angular: `ion-popover { margin-top: 6px }`.
    const top = anchor.y + anchor.height + (type === 'attentionPopup' ? 8 : 8 + ARROW_SIZE / 2)
    if (type === 'attentionPopup') {
      const anchorMidX = anchor.x + anchor.width / 2
      let left = anchorMidX - POPOVER_W / 2
      left = Math.max(16, Math.min(left, SCREEN_W - POPOVER_W - 16))
      return { position: 'absolute', top, left, width: POPOVER_W }
    }
    const left = Math.max(16, Math.min(anchor.x, SCREEN_W - 16))
    return { position: 'absolute', top, left, maxWidth: SCREEN_W - left - 16 }
  }

  const position = getPosition()
  // Arrow horizontal offset, relative to the tooltip box's own left edge — points
  // up toward the anchor's horizontal center, clamped so it can't render outside
  // the tooltip's own rounded corners.
  const arrowLeft = anchor
    ? Math.max(12, Math.min(
        (anchor.x + anchor.width / 2) - (position.left as number) - ARROW_SIZE / 2,
        (POPOVER_W) - ARROW_SIZE - 12,
      ))
    : 0

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Tapping anywhere outside closes the popover */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {type === 'attentionPopup' ? (
        <Animated.View style={[styles.attentionCard, position, { opacity: fadeAnim }]}>
          {!!title   && <Text style={styles.attentionTitle}>{title}</Text>}
          {!!content && <Text style={styles.attentionContent}>{content}</Text>}
          <ButtonRevamp
            label={gotItLabel}
            variant="primary"
            fullWidth
            style={styles.gotItBtn}
            onPress={onClose}
          />
        </Animated.View>
      ) : (
        // verifiedPopup — inline tooltip text, no button. Angular: Ionic's own
        // ion-popover arrow (a rotated 15px square, top+left edges bordered,
        // global.scss's ::part(arrow) override) — reproduced here as a sibling
        // View positioned just above the tooltip box, rotated 45°, pointing up
        // toward the tapped badge.
        <Animated.View style={{ opacity: fadeAnim }}>
          {!!anchor && (
            <Animated.View
              style={[
                styles.arrow,
                { top: (position.top as number) - ARROW_SIZE / 2 - 1, left: (position.left as number) + arrowLeft },
              ]}
            />
          )}
          <Animated.View style={[styles.tooltip, position]}>
            {!!content && <Text style={styles.tooltipText}>{content}</Text>}
          </Animated.View>
        </Animated.View>
      )}
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  attentionCard: {
    backgroundColor: Colors.surface,
    borderRadius:    14,
    padding:         20,
    shadowColor:     Colors.shadow,
    shadowOpacity:   0.15,
    shadowRadius:    12,
    shadowOffset:    { width: 0, height: 4 },
    elevation:       12,
  },
  attentionTitle: {
    fontSize:     FontSize.font16,
    fontWeight:   '700',
    color:        Colors.textPrimary,
    marginBottom: 8,
  },
  attentionContent: {
    fontSize:  FontSize.font14,
    color:     Colors.textSecondary,
    lineHeight: 20,
  },
  gotItBtn: {
    marginTop: 16,
  },
  // Angular: popover.component.scss .tooltip — background #FEF6DB, border
  // 1px solid rgba(247,190,87,1), borderRadius 8px, padding 16px 12px.
  tooltip: {
    backgroundColor: Colors.verifiedPopoverBg,
    borderWidth:     1,
    borderColor:     Colors.verifiedPopoverBorder,
    borderRadius:    8,
    paddingHorizontal: 12,
    paddingVertical:   16,
  },
  // Angular: span.body2-regular-14.black-color — 14px regular, black.
  tooltipText: {
    fontSize:  FontSize.font14,
    color:     Colors.black,
    lineHeight: 20,
  },
  // Angular: global.scss's ion-popover::part(arrow)/::part(arrow)::after — a
  // rotated square, filled #FEF6DB (same as .tooltip's own background), with a
  // border only on its top+left edges (rgba(247,190,87,1)/#f7be57, the same
  // amber as .tooltip's border) — on a 45°-rotated square, only those two edges
  // face upward, so this reproduces the clean triangle-point-up look without
  // needing a separate clip-path/SVG.
  arrow: {
    position: 'absolute',
    width:  ARROW_SIZE,
    height: ARROW_SIZE,
    backgroundColor: Colors.verifiedPopoverBg,
    borderTopWidth:  1,
    borderLeftWidth: 1,
    borderColor:     Colors.verifiedPopoverBorder,
    transform: [{ rotate: '45deg' }],
    zIndex: 1,
  },
})
