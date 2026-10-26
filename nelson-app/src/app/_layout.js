import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NelsonProvider } from '../nelson';
import { C } from '../theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <NelsonProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: C.bg },
            headerTintColor: C.gold,
            headerTitleStyle: { fontWeight: '800', color: C.text },
            contentStyle: { backgroundColor: C.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="connect" options={{ title: 'Connect to Nelson' }} />
          <Stack.Screen name="scan" options={{ title: 'Scan QR code', presentation: 'modal' }} />
        </Stack>
      </NelsonProvider>
    </SafeAreaProvider>
  );
}
