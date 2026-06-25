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

const SCREEN_W = Dimensions.get('window').width
const SCREEN_H = Dimensions.get('window').height
const POPOVER_W = Math.min(SCREEN_W - 32, 280)

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
    // Prefer below anchor; clamp horizontally to screen edges
    const anchorMidX = anchor.x + anchor.width / 2
    let left = anchorMidX - POPOVER_W / 2
    left = Math.max(16, Math.min(left, SCREEN_W - POPOVER_W - 16))
    const top = anchor.y + anchor.height + 8
    return { position: 'absolute', top, left, width: POPOVER_W }
  }

  const position = getPosition()

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
        // verifiedPopup — inline tooltip text, no button
        <Animated.View style={[styles.tooltip, position, { opacity: fadeAnim }]}>
          {!!content && <Text style={styles.tooltipText}>{content}</Text>}
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
    fontSize:     16,
    fontWeight:   '700',
    color:        Colors.textPrimary,
    marginBottom: 8,
  },
  attentionContent: {
    fontSize:  14,
    color:     Colors.textSecondary,
    lineHeight: 20,
  },
  gotItBtn: {
    marginTop: 16,
  },
  tooltip: {
    backgroundColor: Colors.surface,
    borderRadius:    10,
    paddingHorizontal: 14,
    paddingVertical:   10,
    shadowColor:     Colors.shadow,
    shadowOpacity:   0.12,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       8,
  },
  tooltipText: {
    fontSize:  14,
    color:     Colors.textPrimary,
    lineHeight: 20,
  },
})
