import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';
import { useApp, useRows } from '../../data';
import { BRAND, ORANGE, useTheme } from '../../theme';

// Customers and staff use the same app with different tabs.
const TABS = [
  // name, customer title, staff title, icon
  ['index', 'Home', 'Today', 'home'],
  ['trips', 'My trips', 'Requests', 'airplane'],
  ['new', 'Book', null, 'add-circle'],
  ['payments', null, 'Payments', 'wallet'],
  ['deals', null, 'Deals', 'pricetags'],
  ['profile', 'Profile', 'Settings', 'person-circle'],
];

const count = (rows) => (rows?.length ? rows.length : undefined);

export default function TabLayout() {
  const t = useTheme();
  const { role } = useApp();
  const staff = role === 'staff';
  const { rows: waiting } = useRows('requests', { filter: { status: staff ? ['new', 'quoting'] : ['quoted', 'accepted'] } });
  const { rows: toCheck } = useRows('payments', { filter: { status: 'submitted' } });
  if (!role) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: t.bg }}><ActivityIndicator color={t.primary} /></View>;
  const badges = { trips: count(waiting), payments: staff ? count(toCheck) : undefined };
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: BRAND },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.line },
        tabBarLabelStyle: { fontSize: 11 },
        tabBarBadgeStyle: { backgroundColor: ORANGE, color: '#fff', fontWeight: '800' },
      }}
    >
      {TABS.map(([name, cTitle, sTitle, icon]) => {
        const title = staff ? sTitle : cTitle;
        return (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              href: title ? undefined : null,
              title: title || name,
              headerTitle: name === 'index' ? (staff ? 'Gramaro · Staff' : 'Gramaro Travel') : title,
              tabBarBadge: badges[name],
              tabBarIcon: ({ color, focused, size }) => <Ionicons name={focused ? icon : `${icon}-outline`} size={size - 2} color={color} />,
            }}
          />
        );
      })}
    </Tabs>
  );
}
