// Bottom snackbar — Angular: Nbcommon.presentToast() (services/common.ts), wraps
// Ionic's ToastController with cssClass 'greybg-toaster' (dark grey/black bg, no
// icon, single message line, auto-dismiss). Used for the View Later / Don't Show
// confirmation messages on the Matches card.
import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'

export interface ToastRequest {
  message: string
  key:     number   // increments on every show() call so repeat messages still re-trigger the effect
}

export default function Toast({ request, duration = 2000 }: { request: ToastRequest | null; duration?: number }) {
  const insets = useSafeAreaInsets()
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!request) return
    setMessage(request.message)
    setVisible(true)
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start()

    const hideTimer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true })
        .start(({ finished }) => { if (finished) setVisible(false) })
    }, duration)

    return () => clearTimeout(hideTimer)
  }, [request, duration, opacity])

  if (!visible) return null

  return (
    <Animated.View style={[s.toast, { opacity, bottom: insets.bottom + 24 }]} pointerEvents="none">
      <Text style={s.text}>{message}</Text>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  toast: {
    position:          'absolute',
    left:               24,
    right:              24,
    alignSelf:         'center',
    backgroundColor:   'rgba(60,60,60,0.95)',
    borderRadius:      8,
    paddingVertical:   12,
    paddingHorizontal: 16,
  },
  text: {
    fontFamily: 'Poppins-Regular',
    fontSize:   13,
    color:      Colors.white,
    textAlign:  'center',
  },
})
