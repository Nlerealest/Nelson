import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../state/store.tsx';
import { BRAND, useTheme } from '../../theme.ts';
import type { IconName } from '../../components/ui.tsx';
import type { TKey } from '../../i18n/index.ts';

const TABS: { name: string; label: TKey; icon: IconName; header?: TKey }[] = [
  { name: 'index', label: 'tabs.home', icon: 'home' },
  { name: 'tools', label: 'tabs.tools', icon: 'calculator', header: 'tools.title' },
  { name: 'scan', label: 'tabs.scan', icon: 'scan', header: 'scan.title' },
  { name: 'calendar', label: 'tabs.calendar', icon: 'calendar', header: 'cal.title' },
  { name: 'more', label: 'tabs.more', icon: 'grid', header: 'more.title' },
];

export default function TabsLayout() {
  const { data, t, open } = useApp();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (!data.onboarded) return <Redirect href="/welcome" />;

  const urgent = open.filter((d) => !d.informational && d.daysLeft <= 7).length;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: BRAND },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.faint,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.line,
          height: 62 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarBadgeStyle: { backgroundColor: theme.danger, color: '#ffffff', fontSize: 11, fontWeight: '800' },
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.label),
            headerShown: tab.name !== 'index',
            headerTitle: tab.header ? t(tab.header) : undefined,
            tabBarBadge: tab.name === 'calendar' && urgent > 0 ? urgent : undefined,
            tabBarIcon: ({ color, focused, size }) =>
              tab.name === 'scan' ? (
                <View style={[styles.scanIcon, { backgroundColor: focused ? theme.primary : theme.primarySoft }]}>
                  <Ionicons name="qr-code" size={20} color={focused ? theme.onPrimary : theme.primary} />
                </View>
              ) : (
                <Ionicons name={focused ? tab.icon : (`${tab.icon}-outline` as IconName)} size={size - 2} color={color} />
              ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scanIcon: { width: 40, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
