// Bottom snackbar — Angular: Nbcommon.presentToast() (services/common.ts), wraps
// Ionic's ToastController with cssClass 'greybg-toaster' (dark grey/black bg, no
// icon, single message line, auto-dismiss). Used for the View Later / Don't Show
// confirmation messages on the Matches card.
//
// The Like action's own toast (communication.service.ts's showCustomToaster(),
// cssClass 'liked-toast') is the ONE case that also carries an "Undo" button —
// confirmed via source: same dark #333333/white styling, no special button
// color, tapping it dismisses immediately and fires a `dislike` call. No other
// toast in the app (dislike's own, view-later, etc.) has this button — its
// `buttons` array is commented out there — so `onUndo` must stay optional and
// only ever be passed by the Like flow.
import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'

export interface ToastRequest {
  message:  string
  key:      number   // increments on every show() call so repeat messages still re-trigger the effect
  duration?: number | undefined  // Angular: 1500 for the Like toast, 2000 elsewhere (default)
  onUndo?:   (() => void) | undefined
}

export default function Toast({
  request, duration = 2000, bottomOffset = 24,
}: {
  request: ToastRequest | null; duration?: number
  // Extra clearance ABOVE the safe-area inset, so the toast doesn't overlap a
  // fixed bottom tab bar on screens that have one (e.g. MatchesScreen's
  // AppFooter, 56px tall — the default 24 alone left the toast's bottom edge
  // sitting inside the footer's own space). Screens with no bottom tab bar
  // (e.g. IgnoredProfilesScreen) keep the plain default.
  bottomOffset?: number
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [onUndo, setOnUndo] = useState<(() => void) | null>(null)
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!request) return
    setMessage(request.message)
    setOnUndo(() => request.onUndo ?? null)
    setVisible(true)
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start()

    const hideTimer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true })
        .start(({ finished }) => { if (finished) setVisible(false) })
    }, request.duration ?? duration)

    return () => clearTimeout(hideTimer)
  }, [request, duration, opacity])

  if (!visible) return null

  function dismiss() {
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true })
      .start(({ finished }) => { if (finished) setVisible(false) })
  }

  function handleUndoPress() {
    // Angular: role 'cancel' — Ionic dismisses the toast immediately on tap,
    // independent of whatever the undo action's own API call does.
    dismiss()
    onUndo?.()
  }

  return (
    <Animated.View
      style={[s.toast, { opacity, bottom: insets.bottom + bottomOffset }]}
      pointerEvents={onUndo ? 'box-none' : 'none'}
    >
      <Text style={s.text}>{message}</Text>
      {!!onUndo && (
        <Pressable onPress={handleUndoPress} hitSlop={8}>
          <Text style={s.undoText}>{t('GENERAL.UNDO_TXT', 'Undo')}</Text>
        </Pressable>
      )}
    </Animated.View>
  )
}

const s = StyleSheet.create({
  toast: {
    position:          'absolute',
    left:               24,
    right:              24,
    alignSelf:         'center',
    // Angular global.scss:2644-2657 .liked-toast — #333333 bg, white text,
    // font-weight 500 — this already matched; now shared with the Undo button.
    backgroundColor:   '#333333',
    borderRadius:      8,
    paddingVertical:   12,
    paddingHorizontal: 16,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               16,
  },
  text: {
    flexShrink: 1,
    fontFamily: 'Poppins-Regular',
    fontSize:   13,
    fontWeight: '500',
    color:      Colors.white,
  },
  undoText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   13,
    fontWeight: '500',
    color:      Colors.white,
  },
})
