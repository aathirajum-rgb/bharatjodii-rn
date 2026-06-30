import Constants from 'expo-constants'
import * as Network from 'expo-network'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { Alert, Image, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Colors } from '../constants/colors'
import { useAuth } from '../contexts/AuthContext'
import { useOTAInfo, useOTAStatus } from '../hooks/useOTAUpdate'
import ComponentShowcaseScreen from '../screens/dev/ComponentShowcaseScreen'
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

// ─── Flavor config (same as before) ──────────────────────────────────────────

type FlavorKey = 'jodii' | 'tamil' | 'malayalam'

const FLAVOR_INFO: Record<FlavorKey, { welcome: string; logo: ReturnType<typeof require>; domain: string }> = {
  jodii:     { welcome: 'Welcome to Jodii',           logo: require('../assets/icon.png'),                          domain: 'https://jodii.app' },
  tamil:     { welcome: 'Welcome to Tamil Jodii',     logo: require('../assets/icons/logos/tamil_jodii.png'),       domain: 'https://tamil.jodii.app' },
  malayalam: { welcome: 'Welcome to Malayalam Jodii', logo: require('../assets/icons/logos/malayalam_jodii.png'),   domain: 'https://malayalam.jodii.app' },
}

const appFlavor = (Constants.expoConfig?.extra?.appFlavor ?? process.env.EXPO_PUBLIC_APP_FLAVOR ?? 'jodii') as FlavorKey
const appType   = Constants.expoConfig?.extra?.appType ?? process.env.EXPO_PUBLIC_APP_TYPE ?? '115'
const info      = FLAVOR_INFO[appFlavor] ?? FLAVOR_INFO.jodii

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

// ─── Dev home screen ──────────────────────────────────────────────────────────

function HomeScreen({ navigation }: { navigation: any }) {
  const [ipAddress, setIpAddress] = useState<string | null>(null)
  const { logoutUpdate } = useAuth()
  const otaInfo   = useOTAInfo()
  const otaStatus = useOTAStatus()

  const handleShare = async () => {
    const url = `${info.domain}/home`
    await Share.share({ message: `Check out Jodii! ${url}`, url })
  }

  const handleGetIp = async () => {
    try {
      const ip = await Network.getIpAddressAsync()
      setIpAddress(ip)
      Alert.alert('Device IP Address', ip)
    } catch {
      Alert.alert('Error', 'Could not retrieve IP address')
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Image source={info.logo} style={styles.logo} resizeMode="contain" />

      <View style={[styles.badge, otaStatus === 'EMBEDDED' ? { backgroundColor: '#FF3B30' } : { backgroundColor: Colors.success }]}>
        <Text style={styles.badgeText}>{otaStatus === 'EMBEDDED' ? '⚠️ EMBEDDED' : `✅ OTA LIVE — ${otaStatus}`}</Text>
      </View>

      <Text style={[styles.welcome, { color: '#ffffff' }]}>{info.welcome}</Text>
      <Text style={[styles.appType,  { color: '#cce5ff' }]}>App Type: {appType}</Text>
      <Text style={[styles.appType,  { color: '#a8d8ff', fontSize: 11 }]}>{otaInfo}</Text>

      <TouchableOpacity style={[styles.button, { backgroundColor: '#6200EA' }]} onPress={() => Alert.alert('OTA Works!', 'Red theme live via OTA!\nNo app store needed!')}>
        <Text style={styles.buttonText}>OTA Red Update</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: Colors.success }]} onPress={() => navigation.navigate('Gallery')}>
        <Text style={styles.buttonText}>Open Gallery</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: '#FF9F0A' }]} onPress={handleShare}>
        <Text style={styles.buttonText}>Share App</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: '#BF5AF2' }]} onPress={handleGetIp}>
        <Text style={styles.buttonText}>Get Device IP</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: Colors.primary }]} onPress={() => navigation.navigate('recharge')}>
        <Text style={styles.buttonText}>💳 Payment</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: Colors.devAccent }]} onPress={() => navigation.navigate('ComponentShowcase')}>
        <Text style={styles.buttonText}>🧩 Component Library</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: '#FF3B30' }]} onPress={logoutUpdate}>
        <Text style={styles.buttonText}>🚪 Logout</Text>
      </TouchableOpacity>

      {ipAddress ? <Text style={[styles.appType, { color: '#a8d8ff' }]}>IP: {ipAddress}</Text> : null}
      <StatusBar style="light" />
    </ScrollView>
  )
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

// ─── Styles (HomeScreen) ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  logo:        { width: 120, height: 120 },
  welcome:     { fontSize: 22, fontWeight: '600', color: '#1a1a1a' },
  appType:     { fontSize: 16, color: '#666' },
  button:      { backgroundColor: '#007AFF', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10, marginTop: 8 },
  buttonText:  { color: '#fff', fontSize: 16, fontWeight: '600' },
  badge:       { backgroundColor: '#FFD700', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  badgeText:   { color: '#000', fontSize: 14, fontWeight: '700' },
})
