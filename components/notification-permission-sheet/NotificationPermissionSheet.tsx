import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, Dimensions, Modal, Platform, Pressable, StyleSheet, Text } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnLottie from '../CdnLottie'
import { Colors } from '../../constants/colors'
import { CDN_LOTTIE } from '../../constants/cdn'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { FontSize } from '../../src/theme/fonts'

// Angular: auto-start.component.html's action='enableNotification' branch —
// same AutoStartComponent as GalleryAccessSheet.tsx's 'enableStorage' sibling
// (notification-service.service.ts's notificationEnablePopup(), opened via
// ModalController, NOT the generic bottom-sheet.component that every other
// BottomSheet `type` maps to). Mirrors GalleryAccessSheet.tsx's structure/
// styling exactly, since both come from the same Angular source component.
const CLOSE_ICON_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368L144 144M368 144L144 368"/></svg>`

const SCREEN_H = Dimensions.get('window').height

type Props = {
  visible:  boolean
  onEnable: () => void
  onClose:  () => void
}

export default function NotificationPermissionSheet({ visible, onEnable, onClose }: Props) {
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
      {/* Scrim — tap to dismiss, same as Angular's backdrop */}
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

        {/* Icon — Angular: notification-bell-popup.json lottie,
            style="width: 45px; height: 40px;", inside a `ml-16` div — left-
            aligned like everything else in this sheet (no ion-text-center). */}
        <CdnLottie
          uri={CDN_LOTTIE + 'notification-bell-popup.json'}
          width={45}
          height={40}
          style={styles.iconWrapper}
        />

        {/* Header/Body — Angular: PN_SETTINGS.HEADER/BODY */}
        <Text style={[styles.title, { fontFamily: langFonts.semiBold }]}>
          {t('PN_SETTINGS.HEADER', 'Turn on notifications!')}
        </Text>
        <Text style={[styles.body, { fontFamily: langFonts.regular }]}>
          {t('PN_SETTINGS.BODY', 'Get instant updates when members contact you and when we send new match recommendations')}
        </Text>

        {/* Primary CTA — Angular: PN_SETTINGS.CTA. Single button only, same as
            enableStorage's GalleryAccessSheet (CTA_1/CTA_2's "Settings"/"Not
            now" pair is gated to a later trigger variant, not this one). */}
        <Pressable style={styles.ctaBtn} onPress={() => { onEnable(); dismiss(() => {}) }}>
          <Text style={[styles.ctaLabel, { fontFamily: langFonts.regular }]}>
            {t('PN_SETTINGS.CTA', 'Enable notifications now')}
          </Text>
        </Pressable>
      </Animated.View>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Identical to GalleryAccessSheet.tsx's — both render the same Angular
// AutoStartComponent shell, just different action branches.

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

  iconWrapper: {
    marginBottom: 24,
  },

  title: {
    fontSize:   FontSize.font22,
    fontWeight: '600',
    color:      '#1f1e1b',
    lineHeight: 26,
    textAlign:  'left',
  },
  body: {
    fontSize:     FontSize.font14,
    fontWeight:   '400',
    color:        '#1f1e1b',
    lineHeight:   18,
    textAlign:    'left',
    marginTop:    8,
    marginBottom: 24,
  },

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
    fontSize:  FontSize.font14,
    fontWeight: '400',
    color:     Colors.white,
    textAlign: 'center',
  },
})
