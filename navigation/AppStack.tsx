import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Colors } from '../constants/colors'
import { useAuth } from '../contexts/AuthContext'
import ComponentShowcaseScreen from '../screens/dev/ComponentShowcaseScreen'
import HomeScreen from '../screens/home/HomeScreen'
import GalleryScreen from '../screens/GalleryScreen'
import CreatedByScreen from '../screens/onboarding/CreatedByScreen'
import DOBScreen from '../screens/onboarding/DOBScreen'
import EatingHabitScreen from '../screens/onboarding/EatingHabitScreen'
import GenderScreen from '../screens/onboarding/GenderScreen'
import HeightScreen from '../screens/onboarding/HeightScreen'
import MaritalStatusScreen from '../screens/onboarding/MaritalStatusScreen'
import HomeTownScreen from '../screens/onboarding/HomeTownScreen'
import LocationScreen from '../screens/onboarding/LocationScreen'
import MotherTongueScreen from '../screens/onboarding/MotherTongueScreen'
import AddPhotoScreen from '../screens/onboarding/AddPhotoScreen'
import FamilyDetailsScreen from '../screens/onboarding/FamilyDetailsScreen'
import PropertyDetailsScreen from '../screens/onboarding/PropertyDetailsScreen'
import CasteScreen from '../screens/onboarding/CasteScreen'
import GothraScreen from '../screens/onboarding/GothraScreen'
import MonthlyIncomeScreen from '../screens/onboarding/MonthlyIncomeScreen'
import ReligionScreen from '../screens/onboarding/ReligionScreen'
import OccupationScreen from '../screens/onboarding/OccupationScreen'
import QualificationScreen from '../screens/onboarding/QualificationScreen'
import NameScreen from '../screens/onboarding/NameScreen'
import PaymentSuccessScreen from '../screens/payment/PaymentSuccessScreen'
import RechargeScreen from '../screens/payment/RechargeScreen'
import PermissionDemoScreen from '../screens/PermissionDemoScreen'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppStackParamList = {
  Home:              undefined
  dashboard:         undefined
  onboarding:        { pageNo: string } | undefined
  Permissions:       undefined
  Gallery:           undefined
  recharge:          { from?: string; paymentId?: string; type?: string } | undefined
  'payment-success': undefined
  ComponentShowcase: undefined
}


// ─── Onboarding router ────────────────────────────────────────────────────────

function OnboardingRouter({ navigation, route }: { navigation: any; route: any }) {
  const pageNo = route.params?.pageNo ?? '1'
  switch (pageNo) {
    case '1':  return <CreatedByScreen    navigation={navigation} route={route} />
    case '2':  return <NameScreen         navigation={navigation} route={route} />
    case '3':  return <GenderScreen       navigation={navigation} route={route} />
    case '4':  return <MaritalStatusScreen navigation={navigation} route={route} />
    case '5':  return <DOBScreen          navigation={navigation} route={route} />
    case '43': return <HeightScreen       navigation={navigation} route={route} />
    case '38': return <EatingHabitScreen  navigation={navigation} route={route} />
    case '39': return <MotherTongueScreen navigation={navigation} route={route} />
    case '9':  return <LocationScreen       navigation={navigation} route={route} />
    case '44': return <HomeTownScreen      navigation={navigation} route={route} />
    case '10': return <QualificationScreen navigation={navigation} route={route} />
    case '11': return <OccupationScreen      navigation={navigation} route={route} />
    case '12': return <MonthlyIncomeScreen  navigation={navigation} route={route} />
    case '13': return <ReligionScreen       navigation={navigation} route={route} />
    case '14': return <CasteScreen         navigation={navigation} route={route} />
    case '16': return <GothraScreen        navigation={navigation} route={route} />
    case '20': return <AddPhotoScreen      navigation={navigation} route={route} />
    case '27': return <FamilyDetailsScreen navigation={navigation} route={route} />
    case '28': return <PropertyDetailsScreen navigation={navigation} route={route} />
    default:   return <HomeScreen navigation={navigation} />
  }
}

// ─── Stack ────────────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<AppStackParamList>()

export default function AppStack() {
  const { isNewUser } = useAuth()

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={isNewUser ? 'onboarding' : 'Home'}
    >
      <Stack.Screen name="Home"      component={HomeScreen} />
      <Stack.Screen name="dashboard" component={HomeScreen} />
      {/* HomeScreen is in screens/home/HomeScreen.tsx — AppHeader + FlatList + AppFooter */}
      <Stack.Screen name="onboarding" component={OnboardingRouter} />
      <Stack.Screen
        name="Permissions"
        component={PermissionDemoScreen}
        options={{ headerShown: true, title: 'Permissions' }}
      />
      <Stack.Screen
        name="Gallery"
        component={GalleryScreen}
        options={{ headerShown: true, title: 'Gallery', headerStyle: { backgroundColor: '#111' }, headerTintColor: Colors.white }}
      />
      <Stack.Screen
        name="recharge"
        component={RechargeScreen}
        options={{ headerShown: true, title: 'Membership Plans', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: Colors.white }}
      />
      <Stack.Screen name="payment-success" component={PaymentSuccessScreen} />
      <Stack.Screen
        name="ComponentShowcase"
        component={ComponentShowcaseScreen}
        options={{ title: 'Component Library', headerStyle: { backgroundColor: Colors.devAccent }, headerTintColor: Colors.white }}
      />
    </Stack.Navigator>
  )
}

