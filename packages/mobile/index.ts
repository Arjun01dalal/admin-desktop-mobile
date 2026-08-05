import { registerRootComponent } from 'expo';

/* eslint-disable @typescript-eslint/no-var-requires */
// TEMPORARY boot tracing: the app crashed on some devices with
// "Exception in HostFunction" during module load ("App entry not found").
// These breadcrumbs pinpoint which module throws — remove once diagnosed.
console.log('[boot] index start');
// Hermes has no crypto.getRandomValues — crypto-js AES needs it for secure
// random (throws "Native crypto module could not be used..."). Polyfill on
// native; browsers already provide it.
const { Platform } = require('react-native');
if (Platform.OS !== 'web') require('react-native-get-random-values');
console.log('[boot] crypto polyfill ok');
require('react-native-gesture-handler');
console.log('[boot] gesture-handler ok');
require('react-native-safe-area-context');
console.log('[boot] safe-area ok');
require('react-native-screens');
console.log('[boot] screens ok');
require('react-native-reanimated');
console.log('[boot] reanimated ok');
require('@react-navigation/native');
console.log('[boot] navigation-native ok');
require('@react-navigation/drawer');
console.log('[boot] navigation-drawer ok');
require('@react-native-async-storage/async-storage');
console.log('[boot] async-storage ok');
require('expo-secure-store');
console.log('[boot] secure-store ok');
require('expo-location');
console.log('[boot] location ok');
require('expo-screen-capture');
console.log('[boot] screen-capture ok');
require('expo-constants');
console.log('[boot] constants ok');
require('crypto-js');
console.log('[boot] crypto-js ok');
require('./src/lib/webShim');
console.log('[boot] webShim ok');

const App = require('./App').default;
console.log('[boot] App module ok');

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
console.log('[boot] registered');
