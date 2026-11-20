import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { submitMinutesLeft, useRows } from '../../data';
import { BRAND, GOLD, useTheme } from '../../theme';
import { useReminderTaps } from '../../submitReminder';

const TABS = [
  ['index', 'Create', 'add-circle', 'King Tonka'],
  ['library', 'My clips', 'albums', 'My clips'],
  ['campaigns', 'Campaigns', 'cash', 'Campaigns'],
  ['more', 'More', 'ellipsis-horizontal-circle', 'More'],
];

export default function TabsLayout() {
  const t = useTheme();
  useReminderTaps(); // tapping a "submit your clip" reminder opens that clip
  const working = useRows('kt_projects', { filter: { status: ['queued', 'downloading', 'transcribing', 'finding', 'rendering'] } }).rows?.length;
  // Posted campaign clips still waiting to be submitted (within their 30 minutes).
  const toSubmit = (useRows('kt_clips').rows || []).filter((c) => (submitMinutesLeft(c) ?? -1) >= 0).length;
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
        tabBarBadgeStyle: { backgroundColor: GOLD, color: '#3a2a00', fontWeight: '800' },
      }}
    >
      {TABS.map(([name, title, icon, header]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            headerTitle: header,
            tabBarBadge: name === 'index' && working ? working : name === 'library' && toSubmit ? toSubmit : undefined,
            tabBarIcon: ({ color, focused, size }) => <Ionicons name={focused ? icon : `${icon}-outline`} size={size - 2} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
