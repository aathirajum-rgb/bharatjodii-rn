import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, Dimensions, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { FontSize } from '../../src/theme/fonts'

// Angular: auto-start.component.html's close icon — same as GalleryAccessSheet.
const CLOSE_ICON_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144M368 144L144 368"/></svg>`

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_H = Dimensions.get('window').height
const CDN_ICON = CDN_SVG + 'add-photos-popup.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean
  onClose: () => void
  // Angular: common.ts's callNative() swaps HEADER/BODY to HORO_STORAGE_SETTINGS
  // when eventName == 'horoscope_from_phone' — same icon/CONTENT/CTAs, different copy.
  variant?: 'photo' | 'horoscope'
}

// ─── GallerySettingsSheet ──────────────────────────────────────────────────────
// Matches Angular's AutoStartComponent action='enableStorage', type '5' — the
// escalated STORAGE_SETTINGS variant Angular shows on the 3rd+ "Add photo"
// tap while permission is still not granted (same HEADER/BODY/icon as the
// type '6' GalleryAccessSheet, plus a CONTENT instructions list and two
// buttons: CTA_1 "Settings" / CTA_2 "Not now"). Angular's escalation is a
// native-bridge click counter with no equivalent here; the faithful trigger
// on this platform is showing this once permission comes back genuinely
// blocked (canAskAgain === false) — i.e. exactly when "ask again" no longer
// works and sending the user to Settings is the only real option, which is
// also exactly what Angular's CTA_1 does.

export default function GallerySettingsSheet({ visible, onClose, variant = 'photo' }: Props) {
  const insets    = useSafeAreaInsets()
  const { t }     = useTranslation()
  const langFonts = useLanguageFonts()

  const [modalVisible, setModalVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current
  const scrimAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return

    slideAnim.setValue(SCREEN_H)
    scrimAnim.setValue(0)
    setModalVisible(true)

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0, tension: 55, friction: 11, useNativeDriver: true,
      }),
      Animated.timing(scrimAnim, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }),
    ]).start()
  }, [visible])

  function dismiss(after: () => void) {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_H, duration: 220, useNativeDriver: true,
      }),
      Animated.timing(scrimAnim, {
        toValue: 0, duration: 180, useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setModalVisible(false)
        after()
      }
    })
  }

  // Angular: CTA_1 ("Settings") → appNativeEvent('settingsPermission') opens
  // the native OS app-settings screen. RN's direct equivalent is
  // Linking.openSettings() (no-op on web, where there's no such screen).
  function handleOpenSettings() {
    dismiss(() => {
      if (Platform.OS !== 'web') Linking.openSettings()
      onClose()
    })
  }

  const contentLines = t('STORAGE_SETTINGS.CONTENT', { returnObjects: true })
  const lines: string[] = Array.isArray(contentLines) ? contentLines : []

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => dismiss(onClose)}
    >
      {/* Scrim */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss(onClose)}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: Colors.black,
              opacity: scrimAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.90] }),
            },
          ]}
        />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 24 : 32 },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Close — Angular: ion-col "text-align-right pr-16 pt-16" */}
        <Pressable
          style={styles.closeBtn}
          onPress={() => dismiss(onClose)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <SvgXml xml={CLOSE_ICON_XML} width={27} height={27} />
        </Pressable>

        {/* Icon — same add-photos-popup.svg as GalleryAccessSheet */}
        <View style={styles.iconWrapper}>
          <CdnSvg uri={CDN_ICON} width={56} height={56} />
        </View>

        {/* Header/Body — same STORAGE_SETTINGS.HEADER/BODY as type '6', swapped
            to HORO_STORAGE_SETTINGS.HEADER/BODY for the horoscope upload flow
            (common.ts's callNative, eventName == 'horoscope_from_phone'). */}
        <Text style={[styles.title, { fontFamily: langFonts.semiBold }]}>
          {variant === 'horoscope'
            ? t('HORO_STORAGE_SETTINGS.HEADER', 'Upload your horoscope photos')
            : t('STORAGE_SETTINGS.HEADER', "Let's add your photos")}
        </Text>
        <Text style={[styles.body, { fontFamily: langFonts.regular }]}>
          {variant === 'horoscope'
            ? t('HORO_STORAGE_SETTINGS.BODY', 'Please allow us access to your gallery to upload your horoscope photos')
            : t('STORAGE_SETTINGS.BODY', 'Allow us to upload photos from your phone by giving access to your gallery')}
        </Text>

        {/* Instructions — Angular: content.CONTENT, one line per array item,
            plain stacked text (no bullet/number marker in Angular's own
            rendering either — see GallerySettingsSheet's Angular source note). */}
        {lines.map((line, i) => (
          <Text
            key={i}
            style={[styles.instructionLine, i === 0 && styles.instructionLineFirst, { fontFamily: langFonts.medium }]}
          >
            {line}
          </Text>
        ))}

        {/* CTA_1 "Settings" — Angular: primary-cta-jodii (background #B50033, white text) */}
        <Pressable style={[styles.ctaBtn, styles.ctaPrimary]} onPress={handleOpenSettings}>
          <Text style={[styles.ctaPrimaryLabel, { fontFamily: langFonts.regular }]}>
            {t('STORAGE_SETTINGS.CTA_1', 'Settings')}
          </Text>
        </Pressable>

        {/* CTA_2 "Not now" — Angular: secondary-cta-jodii (white bg, #B50033 border/text) */}
        <Pressable
          style={[styles.ctaBtn, styles.ctaSecondary]}
          onPress={() => dismiss(onClose)}
        >
          <Text style={[styles.ctaSecondaryLabel, { fontFamily: langFonts.regular }]}>
            {t('STORAGE_SETTINGS.CTA_2', 'Not now')}
          </Text>
        </Pressable>
      </Animated.View>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    maxHeight:            '95%',
    backgroundColor:      Colors.surface,
    borderTopLeftRadius:  16,
    borderTopRightRadius: 16,
    paddingHorizontal:    24,
    alignItems:           'flex-start',
    shadowColor:          Colors.black,
    shadowOpacity:        0.15,
    shadowRadius:         16,
    shadowOffset:         { width: 0, height: -4 },
    elevation:            16,
  },

  closeBtn: {
    alignSelf:    'flex-end',
    paddingTop:   16,
    paddingRight: 4,
    marginBottom: 8,
  },

  // Angular: icon row, then header row with "ion-cust-padding-top" (24px).
  iconWrapper: {
    width:        56,
    height:       56,
    marginBottom: 24,
  },

  // Angular: heading1-semibold-22 — var(--font22) = 22px, no explicit
  // line-height set (browser default "normal" for Poppins ≈ 1.2×) — 26,
  // not the 28/18 both used before.
  title: {
    fontSize:     FontSize.font22,
    fontWeight:   '600',
    color:        '#1f1e1b',
    lineHeight:   26,
    textAlign:    'left',
  },
  // Angular: body2-regular-14 inside its own ion-row "mt-8" — 8px gap below
  // the title that was missing here (body sat flush against it). No explicit
  // line-height in Angular either — 18 (≈1.3×14), not 20.
  body: {
    fontSize:     FontSize.font14,
    fontWeight:   '400',
    color:        '#1f1e1b',
    lineHeight:   18,
    textAlign:    'left',
    marginTop:    8,
  },

  // Angular: the whole CONTENT list sits in one ion-row "mt-24 pl-16 pr-16"
  // (gap from body), individual <ol> items have no extra per-item margin —
  // only the first line needs that 24px top gap, not every line.
  instructionLine: {
    fontSize:   FontSize.font14,
    fontWeight: '500',
    color:      '#1f1e1b',
    lineHeight: 18,
    textAlign:  'left',
  },
  instructionLineFirst: {
    marginTop: 24,
  },

  // Angular: primary-btn-ht — height: 44px !important (overrides
  // primary-cta-jodii's own 40px min-height).
  ctaBtn: {
    width:          '100%',
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   8,
    height:         44,
  },
  ctaPrimary: {
    backgroundColor: '#B50033',
    marginTop:       24,
  },
  ctaPrimaryLabel: {
    fontSize: FontSize.font14,
    color:    Colors.white,
  },
  ctaSecondary: {
    backgroundColor: Colors.surface,
    borderWidth:     1,
    borderColor:     '#B50033',
    marginTop:       12,
  },
  ctaSecondaryLabel: {
    fontSize: FontSize.font14,
    color:    '#B50033',
  },
})
