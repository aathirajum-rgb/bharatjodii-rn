import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as Network from 'expo-network';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { Alert, Image, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from './constants/colors';
import { useOTAInfo, useOTAStatus, useOTAUpdate } from './hooks/useOTAUpdate';
import LoginScreen from './screens/auth/LoginScreen';
import OTPScreen from './screens/auth/OTPScreen';
import ComponentShowcaseScreen from './screens/dev/ComponentShowcaseScreen';
import GalleryScreen from './screens/GalleryScreen';
import LanguageSelectionScreen from './screens/LanguageSelectionScreen';
import PermissionDemoScreen from './screens/PermissionDemoScreen';
import SplashAnimationScreen from './screens/SplashAnimationScreen';
import PaymentSuccessScreen from './screens/payment/PaymentSuccessScreen';
import RechargeScreen from './screens/payment/RechargeScreen';
import { setupNotificationHandlers } from './service/notificationService';
import { getItem, setItem } from './service/storageService';
import { StorageKeys } from './constants/storage.keys';
import { navigationRef } from './utils/navigationRef';

// Keep native splash visible until SplashAnimationScreen mounts and calls hideAsync()
SplashScreen.preventAutoHideAsync();

type RootStackParamList = {
  Splash:            undefined;
  LanguageSelection: undefined;
  login:              undefined;
  otp:                { mobile: string; countryCode: string; matriId: string };
  Home:               undefined;
  Permissions:        undefined;
  Gallery:            undefined;
  recharge:           { from?: string; paymentId?: string; type?: string } | undefined;
  'payment-success':  undefined;
  dashboard:          undefined;
  onboarding:         { pageNo: string } | undefined;
  ComponentShowcase:  undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type FlavorKey = 'jodii' | 'tamil' | 'malayalam';

const FLAVOR_INFO: Record<FlavorKey, { welcome: string; logo: ReturnType<typeof require>; domain: string }> = {
  jodii: {
    welcome: 'Welcome to Jodii',
    logo: require('./assets/icon.png'),
    domain: 'https://jodii.app',
  },
  tamil: {
    welcome: 'Welcome to Tamil Jodii',
    logo: require('./assets/icons/logos/tamil_jodii.png'),
    domain: 'https://tamil.jodii.app',
  },
  malayalam: {
    welcome: 'Welcome to Malayalam Jodii',
    logo: require('./assets/icons/logos/malayalam_jodii.png'),
    domain: 'https://malayalam.jodii.app',
  },
};

const appFlavor = (Constants.expoConfig?.extra?.appFlavor ?? process.env.EXPO_PUBLIC_APP_FLAVOR ?? 'jodii') as FlavorKey;
const appType = Constants.expoConfig?.extra?.appType ?? process.env.EXPO_PUBLIC_APP_TYPE ?? '115';
const info = FLAVOR_INFO[appFlavor] ?? FLAVOR_INFO.jodii;

function getLinkingPrefixes() {
  const base = ['https://jodii.app', 'https://tamil.jodii.app', 'https://malayalam.jodii.app'];
  try { base.unshift(Linking.createURL('/')); } catch {}
  return base;
}

const linking = {
  prefixes: getLinkingPrefixes(),
  config: {
    screens: {
      login:             'login',
      otp:               'otp',
      Home:              'home',
      Permissions:       'permissions',
      Gallery:           'gallery',
      recharge:          'recharge',
      'payment-success': 'payment-success',
      ComponentShowcase: 'components',
    },
  },
};

function HomeScreen({ navigation }: { navigation: any }) {
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const otaInfo = useOTAInfo();
  const otaStatus = useOTAStatus();

  const handleShare = async () => {
    const url = `${info.domain}/home`;
    await Share.share({
      message: `Check out Jodii! ${url}`,
      url,
    });
  };

  const handleGetIp = async () => {
    try {
      const ip = await Network.getIpAddressAsync();
      setIpAddress(ip);
      Alert.alert('Device IP Address', ip);
    } catch {
      Alert.alert('Error', 'Could not retrieve IP address');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Image source={info.logo} style={styles.logo} resizeMode="contain" />

      <View style={[styles.badge, otaStatus === 'EMBEDDED' ? { backgroundColor: '#FF3B30' } : { backgroundColor: Colors.success }]}>
        <Text style={styles.badgeText}>{otaStatus === 'EMBEDDED' ? '⚠️ EMBEDDED' : `✅ OTA LIVE — ${otaStatus}`}</Text>
      </View>

      <Text style={[styles.welcome, { color: '#ffffff' }]}>{info.welcome}</Text>
      <Text style={[styles.appType, { color: '#cce5ff' }]}>App Type: {appType}</Text>
      <Text style={[styles.appType, { color: '#a8d8ff', fontSize: 11 }]}>{otaInfo}</Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#6200EA' }]}
        onPress={() => Alert.alert('OTA Works!', 'Red theme live via OTA!\nNo app store needed!')}
      >
        <Text style={styles.buttonText}>OTA Red Update</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: Colors.success }]}
        onPress={() => navigation.navigate('Gallery')}
      >
        <Text style={styles.buttonText}>Open Gallery</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#FF9F0A' }]}
        onPress={handleShare}
      >
        <Text style={styles.buttonText}>Share App</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#BF5AF2' }]}
        onPress={handleGetIp}
      >
        <Text style={styles.buttonText}>Get Device IP</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: Colors.primary }]}
        onPress={() => navigation.navigate('recharge')}
      >
        <Text style={styles.buttonText}>💳 Payment</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: Colors.devAccent }]}
        onPress={() => navigation.navigate('ComponentShowcase')}
      >
        <Text style={styles.buttonText}>🧩 Component Library</Text>
      </TouchableOpacity>

      {ipAddress ? <Text style={[styles.appType, { color: '#a8d8ff' }]}>IP: {ipAddress}</Text> : null}

      <StatusBar style="light" />
    </ScrollView>
  );
}

// Mirrors what the old native app injected into the WebView URL on launch:
// {"APPTYPE":"115","WEBLOGIN":0,"APPVERSION":"x.x","GLASSBOXFLAG":0,"LANG":"en"}
// Must run before any API call so buildCommonParams reads correct values.
async function initializeAppConfig(): Promise<void> {
  const version = Constants.expoConfig?.version ?? '1.0.0'
  await Promise.all([
    setItem(StorageKeys.Auth.APP_TYPE, appType),   // 115 / 116 / 118 per flavor
    setItem(StorageKeys.Auth.WEB_LOGIN, '0'),       // 0 = native app (not web PWA)
    setItem('APPVERSION', version),
    setItem('GLASSBOXFLAG', '0'),
    // Only set LANG if it hasn't been set by a previous language selection
    getItem(StorageKeys.Auth.LANG).then(lang => {
      if (!lang) return setItem(StorageKeys.Auth.LANG, 'en')
    }),
  ])
}

export default function App() {
  useOTAUpdate();
  const [initialRoute, setInitialRoute] = useState<'login' | 'Home'>('login');
  const [authChecked, setAuthChecked]   = useState(false);

  useEffect(() => {
    const cleanup = setupNotificationHandlers();
    return cleanup;
  }, []);

  useEffect(() => {
    // Init config first, then check auth — order matters
    initializeAppConfig().then(() =>
      getItem(StorageKeys.Auth.TOKEN).then(token => {
        setInitialRoute(token ? 'Home' : 'login')
        setAuthChecked(true)
      })
    )
  }, [])

  if (!authChecked) return null

  return (
    <SafeAreaProvider>
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" options={{ animation: 'none' }}>
          {({ navigation }) => (
            <SplashAnimationScreen onFinish={() => navigation.replace('LanguageSelection')} />
          )}
        </Stack.Screen>

        <Stack.Screen name="LanguageSelection" options={{ animation: 'none' }}>
          {({ navigation }) => (
            <LanguageSelectionScreen onSelect={() => navigation.replace('Home')} />
          )}
        </Stack.Screen>
         <Stack.Screen name="login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="otp"
          component={OTPScreen}
          options={{ title: 'Verify OTP', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: Colors.white }}
        />
        <Stack.Screen name="Home" component={HomeScreen} />

        <Stack.Screen
          name="Permissions"
          component={PermissionDemoScreen}
          options={{ headerShown: true, title: 'Permissions' }}
        />
        <Stack.Screen
          name="Gallery"
          component={GalleryScreen}
          options={{  headerShown: true, title: 'Gallery', headerStyle: { backgroundColor: '#111' }, headerTintColor: Colors.white }}
        />
        <Stack.Screen
          name="recharge"
          component={RechargeScreen}
          options={{  headerShown: true, title: 'Membership Plans', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: Colors.white }}
        />
        <Stack.Screen
          name="payment-success"
          component={PaymentSuccessScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ComponentShowcase"
          component={ComponentShowcaseScreen}
          options={{ title: 'Component Library', headerStyle: { backgroundColor: Colors.devAccent }, headerTintColor: Colors.white }}
        />
      </Stack.Navigator>
    </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  logo: {
    width: 120,
    height: 120,
  },
  welcome: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  appType: {
    fontSize: 16,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
});
