// Android: HomeScreenActivity's "ExitPopup" JS-bridge event → Constants.showExitAlert()
// — a plain native AlertDialog (message + No/Yes buttons, no title), shown when
// the back button is pressed on the app's root/home screen instead of letting
// Android exit immediately. RN's Alert.alert() renders a real native
// AlertDialog on Android too, so it's a more faithful port than a custom JS
// modal would be. Android-only, matching the original (iOS has no hardware
// back button to intercept).
//
// Registers itself as handleBack()'s root fallback (utils/navigationRef.ts)
// instead of running its own hardwareBackPress listener, so the centralized
// handler — shared by the Android back button AND every custom back icon —
// is the only place that ever decides "pop, or hit the root?".
import { useEffect } from 'react'
import { Alert, BackHandler, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { registerRootBackHandler } from '../utils/navigationRef'

// `enabled` gates this to the authenticated app (AppStack) only — AuthStack's
// root (Splash/Login) keeps the OS default back behavior, matching the
// original hook which only ever ran from MatchesScreen.
export function useExitConfirm(enabled: boolean) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return

    const confirmExit = () => {
      Alert.alert(
        '',
        t('GENERAL.EXIT_CONFIRM_TITLE', 'Do you want to exit?'),
        [
          { text: t('GENERAL.EXIT_NO', 'No'), style: 'cancel' },
          { text: t('GENERAL.EXIT_YES', 'Yes'), onPress: () => BackHandler.exitApp() },
        ],
      )
      return true   // handled — don't let the OS exit on its own
    }

    registerRootBackHandler(confirmExit)
    return () => registerRootBackHandler(null)
  }, [enabled, t])
}
