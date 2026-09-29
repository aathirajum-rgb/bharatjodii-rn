// "Add horoscope" route (EditProfileHoroscope).
// Desktop keeps its own AddHoroscopeDesktopScreen. On mobile the old bespoke
// form is gone — this route now forwards to the same "Generate horoscope"
// step registration uses (onboarding 29) in edit-profile mode, which returns
// to Edit Profile when finished.
import { useEffect } from 'react'
import { View } from 'react-native'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import AddHoroscopeDesktopScreen from './AddHoroscopeDesktopScreen'

type Props = { navigation: any }

export default function AddHoroscopeScreen({ navigation }: Props) {
  const isDesktop = useIsDesktopWeb()

  useEffect(() => {
    if (isDesktop) return
    navigation.replace('onboarding', { pageNo: '29', standalone: true, fromEditProfile: true })
  }, [isDesktop, navigation])

  if (isDesktop) return <AddHoroscopeDesktopScreen navigation={navigation} />
  return <View style={{ flex: 1, backgroundColor: '#ffffff' }} />
}
