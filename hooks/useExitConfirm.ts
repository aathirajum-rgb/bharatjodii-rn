// Android: HomeScreenActivity's "ExitPopup" JS-bridge event → Constants.showExitAlert()
// — shown when the back button is pressed on the app's root/home screen
// instead of letting Android exit immediately. Now rendered as a custom
// bottom sheet (ExitConfirmSheet) matching MenuScreen's LogoutSheet design,
// rather than a native Alert.alert() dialog. Android-only, matching the
// original (iOS has no hardware back button to intercept).
//
// Registers itself as handleBack()'s root fallback (utils/navigationRef.ts)
// instead of running its own hardwareBackPress listener, so the centralized
// handler — shared by the Android back button AND every custom back icon —
// is the only place that ever decides "pop, or hit the root?".
import { useCallback, useEffect, useState } from 'react'
import { BackHandler, Platform } from 'react-native'
import { registerRootBackHandler } from '../utils/navigationRef'

// `enabled` gates this to the authenticated app (AppStack) only — AuthStack's
// root (Splash/Login) keeps the OS default back behavior, matching the
// original hook which only ever ran from MatchesScreen.
export function useExitConfirm(enabled: boolean) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return

    const confirmExit = () => {
      setVisible(true)
      return true   // handled — don't let the OS exit on its own
    }

    registerRootBackHandler(confirmExit)
    return () => registerRootBackHandler(null)
  }, [enabled])

  const onYes = useCallback(() => {
    setVisible(false)
    BackHandler.exitApp()
  }, [])

  const onNo = useCallback(() => setVisible(false), [])

  return { visible, onYes, onNo }
}
