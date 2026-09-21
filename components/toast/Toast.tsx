// Bottom snackbar — Angular: Nbcommon.presentToast() (services/common.ts), wraps
// Ionic's ToastController with cssClass 'greybg-toaster' (dark grey/black bg, no
// icon, single message line, auto-dismiss). Used for the View Later / Don't Show
// confirmation messages on the Matches card.
//
// The Like action's own toast (communication.service.ts's showCustomToaster(),
// cssClass 'liked-toast') was the FIRST case that carried an "Undo" button —
// confirmed via source: same dark #333333/white styling, no special button
// color, tapping it dismisses immediately and fires a `dislike` call. Since
// then, EditProfileDesktopScreen.tsx's own delete-photo/make-main-photo toasts
// reuse the same optional `onUndo` for their own (real, not decorative) undo
// actions — so this prop is no longer Like-exclusive, just optional.
import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'

// Angular: presentToast() (common.ts:558) creates an ion-toast with NO `position`,
// so it takes Ionic's default — 'bottom', rendered in the app's overlay portal at
// the very bottom of the VIEWPORT. Ionic does not lift it above ion-tabs, so it
// sits right at the footer.
//
// Screens here used to pass bottomOffset={56 + 16} to clear AppFooter, which
// floated the toast well above the footer and — since only four screens did it —
// put it in a different place depending on which screen you were on. One margin
// above the safe-area inset for every toast, matching Ionic.
const TOAST_BOTTOM_MARGIN = 16

export interface ToastRequest {
  message:  string
  key:      number   // increments on every show() call so repeat messages still re-trigger the effect
  duration?: number | undefined  // Angular: 1500 for the Like toast, 2000 elsewhere (default)
  onUndo?:   (() => void) | undefined
}

export default function Toast({
  request, duration = 2000, bottomOffset = TOAST_BOTTOM_MARGIN,
}: {
  request: ToastRequest | null; duration?: number
  // Clearance above the safe-area inset. Overriding this is the exception now,
  // not the rule — see TOAST_BOTTOM_MARGIN. Kept for a screen that genuinely
  // needs the toast lifted; none currently do.
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
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   FontSize.font13,
    fontWeight: '500',
    color:      Colors.white,
  },
  undoText: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   FontSize.font13,
    fontWeight: '500',
    color:      Colors.white,
  },
})
