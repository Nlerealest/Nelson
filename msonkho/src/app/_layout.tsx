import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../state/store.tsx';
import { onReminderTap } from '../reminders.ts';
import { BRAND, useTheme } from '../theme.ts';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Navigator() {
  const { loaded } = useApp();
  const theme = useTheme();

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  // Tapping a deadline reminder opens the calendar.
  useEffect(() => onReminderTap((url) => router.push(url as '/calendar')), []);

  if (!loaded) return null;
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: BRAND },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '800' },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Navigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
