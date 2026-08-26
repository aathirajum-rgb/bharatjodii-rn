import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, Dimensions, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// Angular: auto-start.component.html's close icon — Ionic's "close-outline",
// top-right of the sheet (ion-col class="text-align-right pr-16 pt-16").
const CLOSE_ICON_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144M368 144L144 368"/></svg>`

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_H  = Dimensions.get('window').height
const CDN_ICON  = CDN_SVG + 'add-photos-popup.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  visible:    boolean
  onAllow:    () => void
  onClose:    () => void
  // Angular: common.ts's callNative() swaps HEADER/BODY to HORO_STORAGE_SETTINGS
  // when eventName == 'horoscope_from_phone' — same icon/CTA, different copy.
  variant?:   'photo' | 'horoscope'
}

// ─── GalleryAccessSheet ────────────────────────────────────────────────────────
// Matches Angular's AutoStartComponent action='enableStorage' (type '6') —
// the STORAGE_SETTINGS bottom sheet shown before requesting gallery/storage
// access: icon + "Let's add your photos" + explainer body + single
// "Allow gallery access" CTA. Angular drives this off a native permission
// bridge (appNativeEvent/STG_PERMISSION_COUNT escalation) that has no
// equivalent on this platform; here the CTA triggers RN's own real gallery
// permission request directly, which is the closest faithful equivalent to
// "the user taps Allow and the OS permission flow proceeds".

export default function GalleryAccessSheet({ visible, onAllow, onClose, variant = 'photo' }: Props) {
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

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => dismiss(onClose)}
    >
      {/* Scrim — tap to dismiss, same as Angular's backdrop (backdropDismiss
          isn't disabled for this popup, unlike the registration success sheet) */}
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
        {/* Close — Angular: ion-col "text-align-right pr-16 pt-16" +
            ion-icon name="close-outline", calls dismissModal(0). */}
        <Pressable
          style={styles.closeBtn}
          onPress={() => dismiss(onClose)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <SvgXml xml={CLOSE_ICON_XML} width={27} height={27} />
        </Pressable>

        {/* Icon — Angular: add-photos-popup.svg, shown only for action='enableStorage' */}
        <View style={styles.iconWrapper}>
          <Image source={{ uri: CDN_ICON }} style={styles.icon} contentFit="contain" />
        </View>

        {/* Header/Body — Angular: STORAGE_SETTINGS.HEADER/BODY, swapped to
            HORO_STORAGE_SETTINGS.HEADER/BODY when opened from the horoscope
            upload flow (common.ts's callNative, eventName == 'horoscope_from_phone'). */}
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

        {/* Primary CTA — Angular: STORAGE_SETTINGS.CTA. Single button only —
            CTA_1/CTA_2 ("Settings"/"Not now") are gated to Angular's 3rd+
            trigger variant (type '5'), not this one.
            onAllow fires synchronously on press (not after the dismiss
            animation) — on web it may open a hidden file input via .click(),
            which browsers only allow inside a direct, untouched user-gesture
            call stack; delaying it past an animation callback silently
            breaks that and the file dialog never opens. The sheet still
            animates itself closed right after. */}
        <Pressable style={styles.ctaBtn} onPress={() => { onAllow(); dismiss(() => {}) }}>
          <Text style={[styles.ctaLabel, { fontFamily: langFonts.regular }]}>
            {t('STORAGE_SETTINGS.CTA', 'Allow gallery access')}
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
    // Angular: .viewprofile-revamp-popup — height: auto, max-height: 95%
    // with scroll if content overflows, not a fixed/short sheet height.
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

  // Angular: ion-col "text-align-right pr-16 pt-16" — top-right corner
  closeBtn: {
    alignSelf: 'flex-end',
    paddingTop:    16,
    paddingRight:  4,
    marginBottom:  8,
  },

  // Angular: icon row, then header row with "ion-cust-padding-top" (24px).
  iconWrapper: {
    width:        56,
    height:       56,
    marginBottom: 24,
  },
  icon: {
    width:  '100%',
    height: '100%',
  },

  // Angular: heading1-semibold-22 — var(--font22) = 22px, no explicit
  // line-height set (browser default "normal" for Poppins ≈ 1.2×) — 26,
  // not the 28/18 both used before.
  title: {
    fontSize:     22,
    fontWeight:   '600',
    color:        '#1f1e1b',
    lineHeight:   26,
    textAlign:    'left',
  },
  // Angular: body2-regular-14 inside its own ion-row "mt-8" — 8px gap below
  // the title, then "mt-24" before the CTA. No explicit line-height in
  // Angular either — 18 (≈1.3×14), not 20.
  body: {
    fontSize:     14,
    fontWeight:   '400',
    color:        '#1f1e1b',
    lineHeight:   18,
    textAlign:    'left',
    marginTop:    8,
    marginBottom: 24,
  },

  // Angular: primary-btn-ht — height: 44px !important.
  ctaBtn: {
    width:           '100%',
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#B50033',
    borderRadius:    8,
    height:          44,
  },
  ctaLabel: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.white,
    textAlign:  'center',
  },
})
