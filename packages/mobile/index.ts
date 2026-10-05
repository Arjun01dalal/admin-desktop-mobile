import { registerRootComponent } from 'expo';

require('./src/security/bridgeRejectionGuard');
// Hermes has no crypto.getRandomValues — crypto-js AES needs it for secure
// random (throws "Native crypto module could not be used..."). Polyfill on
// native; browsers already provide it.
const { Platform } = require('react-native');
if (Platform.OS !== 'web') require('react-native-get-random-values');
require('react-native-gesture-handler');
require('react-native-safe-area-context');
require('react-native-screens');
require('react-native-reanimated');
require('@react-navigation/native');
require('@react-navigation/drawer');
require('@react-native-async-storage/async-storage');
require('expo-secure-store');
require('expo-location');
require('expo-screen-capture');
require('expo-constants');
require('crypto-js');
require('./src/lib/webShim');

const App = require('./App').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
let Root = App;
if (Platform.OS !== 'web') {
  try {
    const Constants = require('expo-constants');
    const inExpoGo =
      Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
    if (!inExpoGo) {
      const { withStallion } = require('react-native-stallion');
      Root = withStallion(App);
    }
  } catch {
    /* Stallion native module missing in Expo Go / old binaries */
  }
}
registerRootComponent(Root);
