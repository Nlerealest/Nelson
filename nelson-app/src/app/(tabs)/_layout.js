import { ActivityIndicator, Pressable, View } from 'react-native';
import { Redirect, Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNelson } from '../../nelson';
import { C } from '../../theme';

const TABS = [
  ['index', 'Nelson', 'speedometer'],
  ['signals', 'Signals', 'flash'],
  ['missed', 'Missed', 'moon'],
  ['learn', 'Learn', 'school'],
  ['chart', 'Chart', 'stats-chart'],
  ['market', 'Market', 'compass'],
  ['journal', 'Journal', 'list'],
];

export default function TabsLayout() {
  const { conn } = useNelson();
  if (conn === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }
  if (conn === null) return <Redirect href="/connect" />;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.bg, borderBottomColor: C.line },
        headerTitleStyle: { color: C.text, fontWeight: '800' },
        headerRight: () => (
          <Pressable onPress={() => router.push('/connect')} hitSlop={12} style={{ marginRight: 16 }}
            accessibilityLabel="Connection settings">
            <Ionicons name="settings-outline" size={22} color={C.gold} />
          </Pressable>
        ),
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.line },
        tabBarActiveTintColor: C.gold,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 10 },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      {TABS.map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            headerTitle: name === 'index' ? 'Nelson · XAUUSD' : name === 'missed' ? 'Missed while off'
              : name === 'learn' ? 'Learning' : title,
            tabBarIcon: ({ color, size }) => <Ionicons name={icon} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
