import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { Image, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GalleryScreen from './screens/GalleryScreen';
import PermissionDemoScreen from './screens/PermissionDemoScreen';

type RootStackParamList = {
  Home: undefined;
  Permissions: undefined;
  Gallery: undefined;
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

const appFlavor = (process.env.EXPO_PUBLIC_APP_FLAVOR || 'jodii') as FlavorKey;
const appType = process.env.EXPO_PUBLIC_APP_TYPE || '115';
const info = FLAVOR_INFO[appFlavor] ?? FLAVOR_INFO.jodii;

const linking = {
  prefixes: [
    Linking.createURL('/'),
    'https://jodii.app',
    'https://tamil.jodii.app',
    'https://malayalam.jodii.app',
  ],
  config: {
    screens: {
      Home: 'home',
      Permissions: 'permissions',
      Gallery: 'gallery',
    },
  },
};

function HomeScreen({ navigation }: { navigation: any }) {
  const handleShare = async () => {
    const url = `${info.domain}/home`;
    await Share.share({
      message: `Check out Jodii! ${url}`,
      url,
    });
  };

  return (
    <View style={styles.container}>
      <Image source={info.logo} style={styles.logo} resizeMode="contain" />
      <Text style={styles.welcome}>{info.welcome}</Text>
      <Text style={styles.appType}>App Type: {appType}</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Permissions')}
      >
        <Text style={styles.buttonText}>Manage Permissions</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#34C759' }]}
        onPress={() => navigation.navigate('Gallery')}
      >
        <Text style={styles.buttonText}>Open Gallery</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#FF9500' }]}
        onPress={handleShare}
      >
        <Text style={styles.buttonText}>Share App</Text>
      </TouchableOpacity>

      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Permissions"
          component={PermissionDemoScreen}
          options={{ title: 'Permissions' }}
        />
        <Stack.Screen
          name="Gallery"
          component={GalleryScreen}
          options={{ title: 'Gallery', headerStyle: { backgroundColor: '#111' }, headerTintColor: '#fff' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
});
