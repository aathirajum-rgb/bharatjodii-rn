// "Do you want to exit?" confirm sheet — same slide-up bottom-sheet chrome and
// side-by-side Yes/No ButtonRevamp layout as MenuScreen's LogoutSheet, so the
// two confirm-before-leaving flows in the app look identical. Replaces the
// native Alert.alert() previously fired by useExitConfirm.
import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { FontSize } from '../../src/theme/fonts'

const SCREEN_H = Dimensions.get('window').height

export interface ExitConfirmSheetProps {
  visible: boolean
  onYes:   () => void
  onNo:    () => void
}

export default function ExitConfirmSheet({ visible, onYes, onNo }: ExitConfirmSheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [modalVisible, setModalVisible] = useState(visible)
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current
  const scrimAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 55, friction: 11 }),
        Animated.timing(scrimAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
        Animated.timing(scrimAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setModalVisible(false) })
    }
  }, [visible, slideAnim, scrimAnim])

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onNo} statusBarTranslucent>
      {/* Scrim */}
      <Animated.View
        style={[StyleSheet.absoluteFill, {
          backgroundColor: Colors.black,
          opacity: scrimAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
        }]}
        pointerEvents="none"
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={onNo} />

      {/* Sheet */}
      <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 20 }, { transform: [{ translateY: slideAnim }] }]}>
        <Text style={s.title}>{t('GENERAL.EXIT_CONFIRM_TITLE')}</Text>

        {/* Side-by-side: Yes (secondary) | No (primary) — same order as LogoutSheet */}
        <View style={s.btnRow}>
          <ButtonRevamp
            label={t('GENERAL.EXIT_YES')}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={onYes}
          />
          <ButtonRevamp
            label={t('GENERAL.EXIT_NO')}
            variant="primary"
            style={{ flex: 1 }}
            onPress={onNo}
          />
        </View>
      </Animated.View>
    </Modal>
  )
}

const s = StyleSheet.create({
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      Colors.white,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingHorizontal:    24,
    paddingTop:           28,
    shadowColor:          '#000',
    shadowOpacity:        0.15,
    shadowRadius:         16,
    shadowOffset:         { width: 0, height: -4 },
    elevation:            16,
  },
  title: {
    fontSize:     FontSize.font18,
    fontWeight:   '700',
    color:        Colors.textPrimary,
    marginBottom: 40,
  },
  btnRow: {
    flexDirection: 'row',
    gap:           12,
  },
})
