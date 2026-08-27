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
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

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
  | 'viewPhoneConfirm'
  | 'photoPrivacy'

// A single bulleted row for BottomSheetData.benefits (icon + text).
export interface BottomSheetBenefit {
  icon:  string
  value: string
  info?: boolean  // Figma: trailing (i) marker, e.g. auto-renewal's "carry forward" row
}

// Structured data the sheet renders. Maps to Angular's `componentData` object.
export interface BottomSheetData {
  image?: string | undefined            // top illustration / icon URL
  title?: string | undefined            // bold heading
  content?: string | undefined          // body text
  benefits?: BottomSheetBenefit[] | undefined // bulleted icon+text list (e.g. auto-renewal benefits)
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
  // Escape hatch for sheets whose content doesn't fit the data-driven shape
  // above (e.g. a scrollable list + sticky footer, like Angular's
  // editPackPopUp "View other packages" sheet) — renders instead of the
  // image/title/content/benefits/CTA block, keeping the same Modal/scrim/
  // slide-animation/close-button shell.
  children?: React.ReactNode | undefined
  showClose?: boolean | undefined  // only used with `children`; `data.showClose` is used otherwise
  // Angular's modalCtrl.create({ backdropDismiss }) — a few popups (e.g. the
  // edit-profile "field cannot be changed" one) are opened with it false, so a
  // tap on the scrim must not dismiss them. Defaults to true, matching every
  // other sheet in this app.
  dismissOnBackdrop?: boolean | undefined
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
  children,
  showClose: showCloseProp,
  dismissOnBackdrop = true,
  style,
  onClose,
  onPrimaryPress,
  onSecondaryPress,
  onLinkPress,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets()
  // Desktop/laptop web: Angular's real modal is a centered dialog, not a
  // mobile bottom sheet sliding up off the bottom edge of a phone screen —
  // that slide-up treatment only makes sense on a narrow mobile viewport.
  // See WhatsAppPaywallModal (Figma "Jodii Desktop" node 867:16315) for the
  // same centered-card convention already established for this exact kind
  // of confirm-before-continuing dialog on desktop.
  const isDesktop = useIsDesktopWeb()

  // Keep Modal mounted until the close animation finishes
  const [modalVisible, setModalVisible] = useState(visible)
  const slideAnim   = useRef(new Animated.Value(SCREEN_H)).current
  const scaleAnim   = useRef(new Animated.Value(0.92)).current
  const scrimAnim   = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
      Animated.parallel([
        isDesktop
          ? Animated.spring(scaleAnim, {
              toValue: 1, useNativeDriver: true, tension: 60, friction: 9,
            })
          : Animated.spring(slideAnim, {
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
        isDesktop
          ? Animated.timing(scaleAnim, { toValue: 0.92, duration: 160, useNativeDriver: true })
          : Animated.timing(slideAnim, {
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
  }, [visible, isDesktop, slideAnim, scaleAnim, scrimAnim])

  const showClose    = children ? (showCloseProp ?? true) : (data?.showClose ?? true)
  const hasImage     = !!data?.image
  const hasPrimary   = !!data?.ctaLabel
  const hasSecondary = (data?.showSecondaryCta ?? false) && !!data?.secondaryCtaLabel
  const sideBySide   = (data?.sideBySideCtas ?? false) && hasSecondary && hasPrimary
  const hasLinkCta   = !!data?.linkCtaLabel
  const hasOr        = !!data?.orCtaText && hasLinkCta

  // Close button — Angular: mobile's bottomsheet-cross floats ABOVE the sheet
  // (top:-48px, centered); desktop's sits INSIDE the card's own top-right
  // corner instead (same convention WhatsAppPaywallModal already uses) — no
  // drag handle exists anywhere in Angular's bottom-sheet component, so this
  // port has none either.
  // Desktop: a real in-flow row (not absolutely positioned) so it always
  // reserves its own space above the title/content — an earlier version
  // floated it absolutely over the top-right corner, which overlapped the
  // body text whenever a sheet had no title/image to naturally push content
  // down first (most of them — many BottomSheet uses are content-only).
  const closeButton = showClose && (
    <Pressable onPress={onClose} hitSlop={10} style={isDesktop ? styles.desktopCloseBtn : styles.closeBtn}>
      <View style={isDesktop ? styles.desktopCloseCircle : styles.closeCircle}>
        <Text style={styles.closeX}>✕</Text>
      </View>
    </Pressable>
  )

  const cardContent = (
    <>
      {closeButton}

      {children ? children : (
        <>
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

          {/* Benefits list (e.g. auto-renewal incentives) — icon + text rows,
              divided by hairlines (Figma: a Line between each row, none after
              the last) */}
          {!!data?.benefits?.length && (
            <View style={styles.benefitsList}>
              {data.benefits.map((b, i) => (
                <View key={i}>
                  {i > 0 && <View style={styles.benefitDivider} />}
                  <View style={styles.benefitRow}>
                    <CdnSvg uri={b.icon} width={20} height={20} style={styles.benefitIcon} />
                    <Text style={styles.benefitText}>
                      {b.value}
                      {b.info && <Text style={styles.benefitInfo}>{'  ⓘ'}</Text>}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

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
        </>
      )}
    </>
  )

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

      {isDesktop ? (
        // Tap-outside-to-close, tap-on-card-does-nothing — same nested-Pressable
        // pattern WhatsAppPaywallModal already uses: the outer Pressable centers
        // the card and closes on background taps; the inner no-op Pressable
        // claims any tap landing on the card itself (including blank padding),
        // so it never bubbles up to the outer one.
        <Pressable style={styles.desktopOverlay} onPress={dismissOnBackdrop ? onClose : undefined}>
          <Pressable onPress={() => {}}>
            <Animated.View
              style={[
                styles.desktopCard,
                { opacity: scrimAnim, transform: [{ scale: scaleAnim }] },
                style,
              ]}
            >
              {cardContent}
            </Animated.View>
          </Pressable>
        </Pressable>
      ) : (
        <>
          {/* Full-screen tap area to close (skipped when backdrop dismissal is off) */}
          {dismissOnBackdrop && <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />}

          {/* Sheet — rendered after Pressable so it sits on top and captures its own touches */}
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + 20 },
              { transform: [{ translateY: slideAnim }] },
              style,
            ]}
          >
            {cardContent}
          </Animated.View>
        </>
      )}
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
  // Desktop/laptop — centered dialog card, same convention WhatsAppPaywallModal
  // (Figma "Jodii Desktop" node 867:16315) already uses for this exact kind of
  // confirm-before-continuing popup, instead of a mobile slide-up bottom sheet.
  desktopOverlay: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  desktopCard: {
    width:            400,
    maxWidth:         '90%',
    maxHeight:        '85%',
    backgroundColor:  Colors.white,
    borderRadius:     16,
    paddingHorizontal: 24,
    paddingTop:        24,
    paddingBottom:     24,
    shadowColor:       Colors.shadow,
    shadowOpacity:     0.15,
    shadowRadius:      16,
    shadowOffset:      { width: 0, height: 4 },
    elevation:         16,
  },
  // In-flow (not absolute) — reserves its own row above whatever comes next,
  // so it never overlaps title/content regardless of what a given sheet renders.
  desktopCloseBtn: {
    alignSelf:    'flex-end',
    marginBottom: 8,
  },
  desktopCloseCircle: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: Colors.surfaceInput,
    alignItems:      'center',
    justifyContent:  'center',
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
    fontFamily:   Fonts.poppinsSemiBold,
    fontSize:     18,
    color:        '#1f1e1b',
    textAlign:    'center',
    marginBottom: 8,
  },
  content: {
    fontFamily:   SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:     14,
    color:        '#1f1e1b',
    textAlign:    'center',
    lineHeight:   20,
    marginBottom: 20,
  },
  benefitsList: {
    width:        '100%',
    marginBottom: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingVertical: 8,
  },
  benefitDivider: {
    height:          1,
    backgroundColor: Colors.divider,
  },
  benefitIcon: {
    marginRight: 8,
  },
  benefitText: {
    flex:       1,
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   14,
    color:      '#1f1e1b',
    lineHeight: 20,
  },
  benefitInfo: {
    fontSize: 12,
    color:    Colors.textTertiary,
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
