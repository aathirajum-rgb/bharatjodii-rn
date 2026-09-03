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
import { LinearGradient } from 'expo-linear-gradient'
import CdnSvg, { CdnImage } from '../cdn-svg/CdnSvg'
import CdnSvg from '../cdn-svg/CdnSvg'
import CdnLottie from '../CdnLottie'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const CDN = CDN_SVG

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
  // Angular bottom-sheet.component.html's paymentPromo block — each BENEFITS row
  // is `icon | value | lockicon`, the trailing padlock marking a locked perk.
  lockIcon?: string | undefined
}

// Structured data the sheet renders. Maps to Angular's `componentData` object.
export interface BottomSheetData {
  image?: string | undefined            // top illustration / icon URL
  lottie?: string | undefined           // top illustration as a looping Lottie CDN URL, takes precedence over `image`
  title?: string | undefined            // bold heading
  content?: string | undefined          // body text
  // Angular: componentData?.SUBCONTENT — the small heading directly above the
  // benefits list ("Paid membership benefits:") in the paymentPromo sheet.
  subContent?: string | undefined
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
  type,
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
  const hasLottie    = !!data?.lottie
  const hasImage     = !hasLottie && !!data?.image
  const hasPrimary   = !!data?.ctaLabel
  const hasSecondary = (data?.showSecondaryCta ?? false) && !!data?.secondaryCtaLabel
  const sideBySide   = (data?.sideBySideCtas ?? false) && hasSecondary && hasPrimary
  const hasLinkCta   = !!data?.linkCtaLabel
  const hasOr        = !!data?.orCtaText && hasLinkCta

  // modalpopup.component.html:364-399 (action 'viewProfileContactNoConfirm') —
  // this popup's layout genuinely differs from every other BottomSheet use:
  // the title sits in the SAME row as an inline close-X (10.5/1.5 col split,
  // left-aligned, not the generic centered title + separately-floating close
  // circle every other sheet uses), and the quota line below the CTA is its
  // own highlighted box (.viewed-contact-vp-revamp: #fcf4f5 bg, 12px padding),
  // not a second paragraph of plain centered body text. The caller (all 8
  // call sites, e.g. MatchesScreen's getContactConfirmContent()) still just
  // passes one `content` string with the question and quota joined by
  // '\n\n' — split back apart here so every call site stays untouched.
  const isViewPhoneConfirm = type === 'viewPhoneConfirm'
  const [phoneConfirmQuestion, phoneConfirmQuota] = isViewPhoneConfirm
    ? (data?.content ?? '').split('\n\n')
    : []

  // Angular bottom-sheet.component.html:317-348 — the `paymentPromo` block is a
  // structurally different layout from every other sheet here, not just
  // different copy: TITLE+CONTENT sit LEFT-aligned inside a gradient
  // `.bottomsheet-header` card, the benefits sit in a bordered
  // `.paid-membership-benefits-block` fused to its bottom edge, and the whole
  // pair is inset only 8px (`pl-8 pr-8 pt-8 pb-8`) instead of the shared 24px.
  const isPaymentPromo = type === 'paymentPromo'

  // Close button — Angular: mobile's `.bottomsheet-cross` is a bare
  // bottomsheet-cross.svg image floating ABOVE the sheet (top:-40px, left:45%)
  // with NO circular background behind it — bottomsheet.component.html/scss
  // and language-selection.component.html's `mothertongue` variant both use
  // this exact same icon/position. Desktop sits INSIDE the card's own
  // top-right corner instead (same convention WhatsAppPaywallModal already
  // uses, not an Angular-mobile pattern) — no drag handle exists anywhere in
  // Angular's bottom-sheet component, so this port has none either.
  // Desktop: a real in-flow row (not absolutely positioned) so it always
  // reserves its own space above the title/content — an earlier version
  // floated it absolutely over the top-right corner, which overlapped the
  // body text whenever a sheet had no title/image to naturally push content
  // down first (most of them — many BottomSheet uses are content-only).
  const closeButton = showClose && !isViewPhoneConfirm && (
    <Pressable onPress={onClose} hitSlop={10} style={isDesktop ? styles.desktopCloseBtn : styles.closeBtn}>
      {isDesktop ? (
        <View style={styles.desktopCloseCircle}>
          <Text style={styles.closeX}>✕</Text>
        </View>
      ) : (
        <CdnSvg uri={CDN + 'revamp/bottomsheet-cross.svg'} width={32} height={32} />
      )}
    </Pressable>
  )

  const cardContent = (
    <>
      {closeButton}

      {isViewPhoneConfirm ? (
        <>
          {/* modalpopup.component.html:369-377 — title row: question text (10.5
              cols) + inline close-X (1.5 cols), left-aligned, NOT the generic
              centered title + separately-floating close circle. */}
          <View style={styles.phoneConfirmTitleRow}>
            <Text style={styles.phoneConfirmTitle}>{phoneConfirmQuestion}</Text>
            {showClose && (
              <Pressable onPress={onClose} hitSlop={10} style={styles.phoneConfirmCloseBtn}>
                <Text style={styles.phoneConfirmCloseX}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* modalpopup.component.html:380-383 — full-width primary-cta-jodii button */}
          {hasPrimary && (
            <ButtonRevamp
              label={data!.ctaLabel!}
              variant="primary"
              fullWidth
              style={[styles.primaryBtn, { marginTop: 20, backgroundColor: Colors.primaryDark }]}
              onPress={onPrimaryPress}
            />
          )}

          {/* modalpopup.component.html:386-391 — .viewed-contact-vp-revamp: its
              own highlighted box below the button, not a second paragraph of
              plain centered body text. */}
          {!!phoneConfirmQuota && (
            <Text style={styles.phoneConfirmQuota}>{phoneConfirmQuota}</Text>
          )}
        </>
      ) : isPaymentPromo ? (
        /* Angular: <div class="pl-8 pr-8 pt-8 pb-8" *ngIf="action == 'paymentPromo'"> */
        <>
          {/* .bottomsheet-header — linear-gradient(#E6E8FF → #FFF0FC), 12px top
              radius, pt-24 pb-24 pl-12 pr-12. TITLE is heading3-semibold-16 and
              CONTENT is mt-6 body2-regular-14, both left-aligned. */}
          <LinearGradient
            colors={['#E6E8FF', '#FFF0FC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.promoHeader}
          >
            {!!data?.title   && <Text style={styles.promoTitle}>{data.title}</Text>}
            {!!data?.content && <Text style={styles.promoContent}>{data.content}</Text>}
          </LinearGradient>

          {/* .paid-membership-benefits-block — 1px #E6E6E6 border with NO top
              border (it fuses to the header above), 12px bottom radius, 12px
              padding. SUBCONTENT is the body1-medium-14 heading; each BENEFITS
              row is icon | value | lockicon with a divider on every row except
              the last. */}
          <View style={styles.promoBenefitsBlock}>
            {!!data?.subContent && <Text style={styles.benefitsHeading}>{data.subContent}</Text>}
            {data?.benefits?.map((b, i) => (
              <View
                key={i}
                style={[
                  styles.promoBenefitRow,
                  i < (data.benefits!.length - 1) && styles.promoBenefitRowBorder,
                ]}
              >
                {/* CdnImage, not CdnSvg — these icon URLs come straight from the
                    API and aren't guaranteed to be SVGs. */}
                {!!b.icon && <CdnImage uri={b.icon} width={24} height={24} />}
                <Text style={styles.promoBenefitText}>{b.value}</Text>
                {!!b.lockIcon && <CdnImage uri={b.lockIcon} width={20} height={20} />}
              </View>
            ))}
          </View>

          {/* Angular: app-button-revamp with iconType 'white-crown-icon'
              (revamp/crown-white.svg), full width, inside a pl-24 pr-24 pt-24
              pb-24 row. */}
          {hasPrimary && (
            // The inset MUST come from a padded wrapper row, not from margins on
            // the button: ButtonRevamp's `fullWidth` is `width: '100%'`, and in
            // RN a horizontal margin adds to that 100% instead of eating into
            // it — so margins here made the button wider than the sheet and
            // pushed it off the right edge.
            <View style={styles.promoCtaRow}>
              <ButtonRevamp
                label={data!.ctaLabel!}
                variant="primary"
                // Angular PRIMARY_BTN.buttonSize = EButtonSize.standard → 44px
                // tall / 8px radius. ButtonRevamp's own default ('large') is the
                // 40px token, which rendered this CTA visibly short.
                size="standard"
                icon="crown-white"
                iconPosition="start"
                fullWidth
                style={{ backgroundColor: Colors.primaryDark }}
                onPress={onPrimaryPress}
              />
            </View>
          )}
        </>
      ) : children ? children : (
        <>
          {/* Top image — CdnSvg so CDN-hosted SVG icons (e.g. the "add your photo"
              alert icon) render correctly on native, not just web. Angular sets no
              explicit size on this image (it's the source asset's natural size) —
              64x64 here is a reasonable fixed stand-in. */}
          {hasLottie && (
            <CdnLottie
              uri={data!.lottie!}
              width={64}
              height={64}
              style={styles.sheetImage}
            />
          )}

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
              {/* Angular: the SUBCONTENT heading sits inside the same bordered
                  benefits block, above the first row. */}
              {!!data?.subContent && <Text style={styles.benefitsHeading}>{data.subContent}</Text>}
              {data.benefits.map((b, i) => (
                <View key={i}>
                  {i > 0 && <View style={styles.benefitDivider} />}
                  <View style={styles.benefitRow}>
                    <CdnSvg uri={b.icon} width={20} height={20} style={styles.benefitIcon} />
                    <Text style={styles.benefitText}>
                      {b.value}
                      {b.info && <Text style={styles.benefitInfo}>{'  ⓘ'}</Text>}
                    </Text>
                    {/* Angular: the row's trailing lockicon column. */}
                    {!!b.lockIcon && <CdnSvg uri={b.lockIcon} width={16} height={16} />}
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
      {/* Animated scrim — pointer-events none so it doesn't block the Pressable.
          Angular: global.scss's `.sc-ion-modal-md-h:first-of-type,
          .sc-ion-modal-ios-h:first-of-type { --backdrop-opacity: var(--ion-backdrop-opacity, 0.8); }`
          — Ionic's own base ion-modal backdrop (every bottom sheet is one), 0.8 not 0.5. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: Colors.black,
            opacity: scrimAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
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
                isPaymentPromo && styles.desktopCardPaymentPromo,
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
              // Angular: the paymentPromo block is wrapped in pl-8/pr-8/pt-8/pb-8,
              // not the 24px side padding every other sheet body uses.
              isPaymentPromo && styles.sheetPaymentPromo,
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
  sheetPaymentPromo: {
    paddingHorizontal: 8,
    paddingTop:        8,
  },
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
  // Same 8px inset the mobile sheet uses for this layout (see sheetPaymentPromo);
  // the close-X row above it keeps its own spacing.
  desktopCardPaymentPromo: {
    paddingHorizontal: 8,
    // 16 + promoCta's own 8 = Angular's pb-24 below the button (desktop has no
    // safe-area inset to contribute the rest, unlike the mobile sheet).
    paddingBottom:     16,
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
  // Angular: `.bottomsheet-cross { position: absolute; top: -40px; left: 45%; }`
  // — a bare floating icon, not centered via a full-width flex row.
  closeBtn: {
    position: 'absolute',
    top:      -40,
    left:     '45%',
    zIndex:   10,
  },
  closeX: {
    fontSize:   12,
    color:      Colors.textMedium,
    fontWeight: '600',
  },
  // viewPhoneConfirm — modalpopup.component.html:369-391 / global.scss's
  // .viewprofile-popup-title (16px bold, #000) + .viewed-contact-vp-revamp
  // (#fcf4f5 bg, 12px padding, 12px font). --ion-cust-padding (24px) drives
  // the row's own top padding, matched here via title's marginTop.
  phoneConfirmTitleRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    marginTop:     4,
  },
  phoneConfirmTitle: {
    flex:       1,
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   16,
    lineHeight: 22,
    color:      '#000',
    textAlign:  'left',
  },
  // 28x28 tap target — Angular's cross-img-vp-revamp is font-size-driven
  // (6.67vmin, no fixed box), but every other BottomSheet close icon in this
  // port uses a fixed 28x28 circle (closeCircle/desktopCloseCircle) — matched
  // here for a consistent tap target instead of a bare, unsized glyph.
  phoneConfirmCloseBtn: {
    width:          28,
    height:         28,
    marginLeft:     8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  phoneConfirmCloseX: {
    fontSize:   16,
    color:      '#000',
    fontWeight: '600',
  },
  phoneConfirmQuota: {
    fontFamily:      SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:        12,
    color:           '#000',
    backgroundColor: '#fcf4f5',
    padding:         12,
    borderRadius:    8,
    marginTop:       16,
    marginBottom:    8,
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
  // ── paymentPromo (Angular bottom-sheet.component.scss) ──────────────────────
  // .bottomsheet-header: gradient + 12px top radius + hairline white border.
  promoHeader: {
    borderTopLeftRadius:  12,
    borderTopRightRadius: 12,
    borderWidth:          1,
    borderColor:          'rgba(255,255,255,0.1)',
    paddingVertical:      24,
    paddingHorizontal:    12,
  },
  // heading3-semibold-16 / body2-regular-14 — left-aligned, unlike the shared
  // centered title/content used by every other sheet type.
  promoTitle: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   16,
    lineHeight: 22,
    color:      '#1f1e1b',
  },
  promoContent: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   14,
    lineHeight: 20,
    color:      '#1f1e1b',
    marginTop:  6,
  },
  promoBenefitsBlock: {
    borderWidth:             1,
    borderTopWidth:          0,
    borderColor:             '#E6E6E6',
    borderBottomLeftRadius:  12,
    borderBottomRightRadius: 12,
    padding:                 12,
  },
  promoBenefitRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    paddingVertical: 12,
  },
  promoBenefitRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6E6',
  },
  promoBenefitText: {
    flex:       1,
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   14,
    lineHeight: 20,
    color:      '#1f1e1b',
    paddingLeft: 4,
  },
  // Angular: the CTA sits in its own `pl-24 pr-24 pt-24 pb-24` row — 16px more
  // side inset than this sheet's own 8px padding in paymentPromo mode, so the
  // button lands 24px in from the sheet edge. The rest of the bottom gap comes
  // from the sheet's own safe-area padding.
  promoCtaRow: {
    paddingHorizontal: 16,
    paddingTop:        24,
    paddingBottom:     8,
  },

  // Angular: .paid-membership-benefits-block's body1-medium-14 heading.
  benefitsHeading: {
    fontFamily:   Fonts.poppinsMedium,
    fontSize:     14,
    color:        '#1f1e1b',
    marginBottom: 4,
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
