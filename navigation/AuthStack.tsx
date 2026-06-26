import { createNativeStackNavigator } from '@react-navigation/native-stack'
import LanguageSelectionScreen from '../screens/LanguageSelectionScreen'
import LoginScreen from '../screens/auth/LoginScreen'
import OTPScreen from '../screens/auth/OTPScreen'
import SplashAnimationScreen from '../screens/SplashAnimationScreen'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Splash:            undefined
  LanguageSelection: undefined
  login:             undefined
  otp:               { mobile: string; countryCode: string; matriId: string }
}

// ─── Stack ────────────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<AuthStackParamList>()

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>

      <Stack.Screen name="Splash" options={{ animation: 'none' }}>
        {({ navigation }) => (
          <SplashAnimationScreen onFinish={() => navigation.replace('LanguageSelection')} />
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

    </Stack.Navigator>
  )
}
