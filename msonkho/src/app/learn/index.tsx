import { View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Card, Divider, ListRow, Screen } from '../../components/ui.tsx';
import { ARTICLES } from '../../data/content.ts';
import { useApp } from '../../state/store.tsx';

export default function Learn() {
  const { t, lang } = useApp();
  return (
    <Screen>
      <Stack.Screen options={{ title: t('learn.title') }} />
      <Card style={{ gap: 4 }}>
        {ARTICLES.map((a, i) => (
          <View key={a.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow icon={a.icon} tone={a.tone} title={a.title[lang]} subtitle={a.summary[lang]} onPress={() => router.push(`/learn/${a.id}`)} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
