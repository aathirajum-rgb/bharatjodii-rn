// Android: HomeScreenActivity's "ExitPopup" JS-bridge event → Constants.showExitAlert()
// — a plain native AlertDialog (message + No/Yes buttons, no title), shown when
// the back button is pressed on the app's root/home screen instead of letting
// Android exit immediately. RN's Alert.alert() renders a real native
// AlertDialog on Android too, so it's a more faithful port than a custom JS
// modal would be. Android-only, matching the original (iOS has no hardware
// back button to intercept).
import { useEffect } from 'react'
import { Alert, BackHandler, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'

// Only fires when the screen has nothing left to pop back to (canGoBack()
// false) — anywhere else, back should behave normally (pop the stack).
export function useExitConfirm(canGoBack: boolean) {
  const { t } = useTranslation()

  useEffect(() => {
    if (Platform.OS !== 'android') return

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) return false   // let the default pop happen

      Alert.alert(
        '',
        t('GENERAL.EXIT_CONFIRM_TITLE', 'Do you want to exit?'),
        [
          { text: t('GENERAL.EXIT_NO', 'No'), style: 'cancel' },
          { text: t('GENERAL.EXIT_YES', 'Yes'), onPress: () => BackHandler.exitApp() },
        ],
      )
      return true   // we handled it — don't let the OS exit on its own
    })

    return () => sub.remove()
  }, [canGoBack, t])
}
