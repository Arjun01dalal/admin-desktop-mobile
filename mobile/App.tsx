import 'react-native-gesture-handler';
import './src/lib/webShim';
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { CalculatorScreen } from './src/screens/CalculatorScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { colors } from './src/theme';

function Root() {
  const { ready, token } = useAuth();
  const [unlocked, setUnlocked] = useState(false);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (token) return <AppNavigator />;
  if (unlocked) return <LoginScreen onBack={() => setUnlocked(false)} />;
  return <CalculatorScreen onUnlock={() => setUnlocked(true)} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
