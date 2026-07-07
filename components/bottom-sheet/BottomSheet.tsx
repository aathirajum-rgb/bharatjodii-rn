import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import ButtonRevamp from '../button-revamp/ButtonRevamp'

const SCREEN_H = Dimensions.get('window').height

// ─── Types ────────────────────────────────────────────────────────────────────

// Maps to Angular's bottom-sheet `action` prop — used by the parent for routing
// callbacks; the component itself doesn't render differently per type.
export type BottomSheetType =
  | 'payment'
  | 'whatsAppPhotoRequest'
  | 'editPack'
  | 'profileValidation'
  | 'likePromotion'
  | 'getFreePlan'
  | 'reportProfile'
  | 'photoPopUp'
  | 'infoPromo'
  | 'limitReachInfo'
  | 'phonePrivacyInfo'
  | 'photoBulkLike'
  | 'skipBulk'
  | 'assistedPromo'
  | 'microphonePermission'
  | 'microphonePermissionSetting'
  | 'waitingResponse'
  | 'paymentLikePromotion'
  | 'paymentPromo'
  | 'profileRegisterTips'
  | 'successPopup'
  | 'blockProfile'
  | 'enableNotification'
  | 'addPhotoPrompt'

// Structured data the sheet renders. Maps to Angular's `componentData` object.
export interface BottomSheetData {
  image?: string | undefined            // top illustration / icon URL
  title?: string | undefined            // bold heading
  content?: string | undefined          // body text
  ctaLabel?: string | undefined         // primary button label
  secondaryCtaLabel?: string | undefined // secondary button label
  linkCtaLabel?: string | undefined      // link text below buttons
  orCtaText?: string | undefined         // separator text between primary and link (e.g. "OR")
  showSecondaryCta?: boolean | undefined  // whether to show the secondary button
  sideBySideCtas?: boolean | undefined    // primary + secondary side by side (e.g. Cancel | Block)
  showClose?: boolean | undefined         // show ✕ close button (default: true)
}

export interface BottomSheetProps {
  visible: boolean
  type?: BottomSheetType | undefined
  data?: BottomSheetData | undefined
  style?: StyleProp<ViewStyle> | undefined
  onClose?: (() => void) | undefined
  onPrimaryPress?: (() => void) | undefined
  onSecondaryPress?: (() => void) | undefined
  onLinkPress?: (() => void) | undefined
}

// ─── BottomSheet ──────────────────────────────────────────────────────────────
// Unified React Native bottom sheet — replaces Angular's two separate components
// (bottomsheet.component + bottom-sheet.component).
// Slide-in/out is handled with Animated so the scrim fades while the sheet springs up.

export default function BottomSheet({
  visible,
  type: _type,
  data,
  style,
  onClose,
  onPrimaryPress,
  onSecondaryPress,
  onLinkPress,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets()

  // Keep Modal mounted until the slide-out animation finishes
  const [modalVisible, setModalVisible] = useState(visible)
  const slideAnim   = useRef(new Animated.Value(SCREEN_H)).current
  const scrimAnim   = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue:      0,
          useNativeDriver: true,
          tension:      55,
          friction:     11,
        }),
        Animated.timing(scrimAnim, {
          toValue:         1,
          duration:        200,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue:         SCREEN_H,
          duration:        220,
          useNativeDriver: true,
        }),
        Animated.timing(scrimAnim, {
          toValue:         0,
          duration:        180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setModalVisible(false)
      })
    }
  }, [visible, slideAnim, scrimAnim])

  const showClose    = data?.showClose ?? true
  const hasImage     = !!data?.image
  const hasPrimary   = !!data?.ctaLabel
  const hasSecondary = (data?.showSecondaryCta ?? false) && !!data?.secondaryCtaLabel
  const sideBySide   = (data?.sideBySideCtas ?? false) && hasSecondary && hasPrimary
  const hasLinkCta   = !!data?.linkCtaLabel
  const hasOr        = !!data?.orCtaText && hasLinkCta

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Animated scrim — pointer-events none so it doesn't block the Pressable */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: Colors.black,
            opacity: scrimAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
          },
        ]}
        pointerEvents="none"
      />

      {/* Full-screen tap area to close */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Sheet — rendered after Pressable so it sits on top and captures its own touches */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 20 },
          { transform: [{ translateY: slideAnim }] },
          style,
        ]}
      >
        {/* Close button — Angular: bottomsheet-cross floats ABOVE the sheet
            (top:-48px, centered), not inside it — no drag handle exists anywhere
            in Angular's bottom-sheet component, so this port has none either. */}
        {showClose && (
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
            <View style={styles.closeCircle}>
              <Text style={styles.closeX}>✕</Text>
            </View>
          </Pressable>
        )}

        {/* Top image — CdnSvg so CDN-hosted SVG icons (e.g. the "add your photo"
            alert icon) render correctly on native, not just web. Angular sets no
            explicit size on this image (it's the source asset's natural size) —
            64x64 here is a reasonable fixed stand-in. */}
        {hasImage && (
          <CdnSvg
            uri={data!.image!}
            width={64}
            height={64}
            style={styles.sheetImage}
          />
        )}

        {/* Title */}
        {!!data?.title && <Text style={styles.title}>{data.title}</Text>}

        {/* Content */}
        {!!data?.content && <Text style={styles.content}>{data.content}</Text>}

        {/* Side-by-side CTAs (e.g. Cancel | Block) */}
        {sideBySide && (
          <View style={styles.sideBySideRow}>
            <ButtonRevamp
              label={data!.secondaryCtaLabel!}
              variant="ghost"
              style={{ flex: 1 }}
              onPress={onSecondaryPress}
            />
            <ButtonRevamp
              label={data!.ctaLabel!}
              variant="primary"
              style={{ flex: 1 }}
              onPress={onPrimaryPress}
            />
          </View>
        )}

        {/* Primary (stacked) — Angular: .primary-cta-jodii uses #B50033, a darker
            red than the app's general Colors.primary (#C62828) used elsewhere */}
        {hasPrimary && !sideBySide && (
          <ButtonRevamp
            label={data!.ctaLabel!}
            variant="primary"
            fullWidth
            style={[styles.primaryBtn, { backgroundColor: Colors.primaryDark }]}
            onPress={onPrimaryPress}
          />
        )}

        {/* Secondary (stacked) */}
        {hasSecondary && !sideBySide && (
          <ButtonRevamp
            label={data!.secondaryCtaLabel!}
            variant="secondary"
            fullWidth
            style={styles.secondaryBtn}
            onPress={onSecondaryPress}
          />
        )}

        {/* OR separator */}
        {hasOr && <Text style={styles.orText}>{data!.orCtaText}</Text>}

        {/* Link CTA */}
        {hasLinkCta && (
          <Pressable onPress={onLinkPress} style={styles.linkCtaBtn} hitSlop={6}>
            <Text style={styles.linkCtaText}>{data!.linkCtaLabel}</Text>
          </Pressable>
        )}
      </Animated.View>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

// Numeric values sourced from Angular's bottom-sheet.component.scss / global.scss
// (the shared block used by photoPopUp, profileValidation, likePromotion, etc.):
// card radius 16px (top only), side padding 24px, icon→title/title→CTA gap 16px,
// title 18px Poppins-Semibold #1f1e1b, CTA #B50033 bg / 8px radius / 44px height.
const styles = StyleSheet.create({
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    maxHeight:            '95%',
    backgroundColor:      Colors.white,
    borderTopLeftRadius:  16,
    borderTopRightRadius: 16,
    paddingHorizontal:    24,
    paddingTop:           24,
    shadowColor:          Colors.shadow,
    shadowOpacity:        0.15,
    shadowRadius:         16,
    shadowOffset:         { width: 0, height: -4 },
    elevation:            16,
  },
  closeBtn: {
    position:  'absolute',
    top:       -48,
    left:      0,
    right:     0,
    alignItems: 'center',
    zIndex:    10,
  },
  closeCircle: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: Colors.surfaceInput,
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeX: {
    fontSize:   12,
    color:      Colors.textMedium,
    fontWeight: '600',
  },
  sheetImage: {
    alignSelf:    'center',
    marginBottom: 16,
  },
  title: {
    fontFamily:   'Poppins-SemiBold',
    fontSize:     18,
    color:        '#1f1e1b',
    textAlign:    'center',
    marginBottom: 8,
  },
  content: {
    fontFamily:   'Poppins-Regular',
    fontSize:     14,
    color:        '#1f1e1b',
    textAlign:    'center',
    lineHeight:   20,
    marginBottom: 20,
  },
  primaryBtn: {
    marginTop:    16,
    marginBottom: 8,
  },
  secondaryBtn: {
    marginBottom: 8,
  },
  sideBySideRow: {
    flexDirection: 'row',
    gap:           12,
    marginTop:     4,
    marginBottom:  8,
  },
  orText: {
    fontSize:      13,
    color:         Colors.textTertiary,
    textAlign:     'center',
    marginVertical: 8,
  },
  linkCtaBtn: {
    alignItems:     'center',
    paddingVertical: 8,
  },
  linkCtaText: {
    fontSize:          14,
    color:             Colors.link,
    fontWeight:        '600',
    textDecorationLine: 'underline',
  },
})
