import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DataProvider, useData } from '../data';
import { SheetHost } from '../components/forms';
import { BRAND, useTheme } from '../theme';

const TABS = [
  ['index', 'Home', 'home'],
  ['budget', 'Budget', 'pie-chart'],
  ['goals', 'Goals', 'flag'],
  ['bills', 'Bills', 'receipt'],
  ['loans', 'Loans', 'people'],
  ['report', 'Report', 'calendar'],
];

function SettingsButton() {
  const { openSheet } = useData();
  return (
    <Pressable onPress={() => openSheet('settings')} hitSlop={12} style={{ marginRight: 16 }} accessibilityLabel="Settings">
      <Ionicons name="settings-outline" size={22} color="#fff" />
    </Pressable>
  );
}

function Toast() {
  const { toastMessage } = useData();
  if (!toastMessage) return null;
  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <Text style={styles.toast}>{toastMessage}</Text>
    </View>
  );
}

function AppTabs() {
  const t = useTheme();
  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: BRAND },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '800' },
          headerRight: () => <SettingsButton />,
          tabBarActiveTintColor: t.primary,
          tabBarInactiveTintColor: t.muted,
          tabBarStyle: { backgroundColor: t.card, borderTopColor: t.line },
          tabBarLabelStyle: { fontSize: 11 },
        }}
      >
        {TABS.map(([name, title, icon]) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title,
              headerTitle: name === 'index' ? 'Ndalama' : title,
              tabBarIcon: ({ color, focused, size }) => (
                <Ionicons name={focused ? icon : `${icon}-outline`} size={size - 2} color={color} />
              ),
            }}
          />
        ))}
      </Tabs>
      <SheetHost />
      <Toast />
      <StatusBar style="light" />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DataProvider>
        <AppTabs />
      </DataProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', left: 16, right: 16, bottom: 150, alignItems: 'center' },
  toast: {
    backgroundColor: '#222',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
    fontSize: 14,
  },
});
