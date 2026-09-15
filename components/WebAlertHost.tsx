// Renders whatever utils/webAlertBridge.ts's Alert.alert patch queues up —
// mounted once near the app root (App.tsx). Visual convention follows this
// codebase's existing confirm-modal pattern (see
// components/edit-profile/DeletePhotoConfirmModal.tsx) since there's no
// Figma spec for a generic alert (native OS chrome has none to match either).
import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../src/theme/fonts'
import { subscribeWebAlerts, popWebAlert, type WebAlertRequest } from '../utils/webAlertBridge'

export default function WebAlertHost() {
  const [queue, setQueue] = useState<WebAlertRequest[]>([])

  useEffect(() => subscribeWebAlerts(setQueue), [])

  const current = queue[0]
  if (!current) return null

  function choose(onPress?: (value?: string) => any) {
    popWebAlert()
    onPress?.()
  }

  // Android's own Alert.alert defaults `cancelable` to false (tapping outside
  // does nothing) unless the caller opts in — mirrored here rather than
  // always allowing a scrim-tap dismiss, since some callers rely on the user
  // having picked one of the buttons before anything proceeds.
  function handleScrimPress() {
    if (!current.options?.cancelable) return
    popWebAlert()
    current.options.onDismiss?.()
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleScrimPress}>
      <Pressable style={s.scrim} onPress={handleScrimPress}>
        <Pressable style={s.card} onPress={() => {}}>
          {!!current.title && <Text style={s.title}>{current.title}</Text>}
          {!!current.message && <Text style={s.message}>{current.message}</Text>}
          <View style={s.buttonList}>
            {current.buttons.map((btn, i) => (
              <Pressable
                key={i}
                style={[s.button, i > 0 && s.buttonDivider]}
                onPress={() => choose(btn.onPress)}
              >
                <Text
                  style={[
                    s.buttonText,
                    btn.style === 'destructive' && s.buttonTextDestructive,
                    btn.style === 'cancel' && s.buttonTextCancel,
                  ]}
                >
                  {btn.text || 'OK'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: 340, maxWidth: '100%', backgroundColor: Colors.white, borderRadius: 14,
    paddingTop: 20, paddingHorizontal: 20, overflow: 'hidden',
  },
  title: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, textAlign: 'center' },
  message: {
    fontFamily: SemanticFontsEnglish.subheadingEnglishRegular, fontSize: 14, color: Colors.textDark,
    textAlign: 'center', marginTop: 8,
  },
  buttonList: { marginTop: 20, marginHorizontal: -20 },
  button: { height: 46, alignItems: 'center', justifyContent: 'center' },
  buttonDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  buttonText: { fontFamily: Fonts.poppinsMedium, fontSize: 15, color: Colors.primaryDark },
  buttonTextDestructive: { color: Colors.inputError },
  buttonTextCancel: { color: Colors.textSecondary, fontFamily: Fonts.poppinsRegular },
})
