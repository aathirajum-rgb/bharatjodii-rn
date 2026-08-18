import { registerRootComponent } from 'expo';

import App from './App';
import { registerBackgroundHandler } from './service/notificationService';

// Must run before registerRootComponent, at module-load time — this is what
// lets @react-native-firebase/messaging's background handler fire even when
// the app is killed on Android (a headless JS task registered natively).
registerBackgroundHandler();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
