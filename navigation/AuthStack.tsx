import { createNativeStackNavigator } from '@react-navigation/native-stack'
import ExternalPageScreen from '../screens/external-page/ExternalPageScreen'
import LanguageSelectionScreen from '../screens/LanguageSelectionScreen'
import LoginScreen from '../screens/auth/LoginScreen'
import OTPScreen from '../screens/auth/OTPScreen'
import SplashAnimationScreen from '../screens/SplashAnimationScreen'
import { getItem, removeItem } from '../service/storageService'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Splash:            undefined
  LanguageSelection: undefined
  login:             undefined
  otp:               { mobile: string; countryCode: string; matriId: string }
  ExternalPage:      { url: string; title: string }
}

// ─── Stack ────────────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<AuthStackParamList>()

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>

      <Stack.Screen name="Splash" options={{ animation: 'none' }}>
        {({ navigation }) => (
          <SplashAnimationScreen
            onFinish={async () => {
              // Set by DeleteProfileSuccessScreen right before it clears the
              // session — a user who just deleted their profile already has a
              // language picked, so skip straight to the login screen instead
              // of re-showing LanguageSelection. One-shot: consumed here so it
              // never affects any other route into this screen (fresh install,
              // plain logout, etc).
              const skipLanguage = await getItem('POST_DELETE_SKIP_LANGUAGE')
              if (skipLanguage) {
                await removeItem('POST_DELETE_SKIP_LANGUAGE')
                navigation.replace('login')
              } else {
                navigation.replace('LanguageSelection')
              }
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="LanguageSelection" options={{ animation: 'none' }}>
        {({ navigation }) => (
          <LanguageSelectionScreen
            navigation={navigation}
            onSelect={() => navigation.replace('login')}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="login" component={LoginScreen} />
      <Stack.Screen name="otp"   component={OTPScreen} />
      <Stack.Screen name="ExternalPage" component={ExternalPageScreen} />

    </Stack.Navigator>
  )
}
