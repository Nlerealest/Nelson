import { Pressable, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { openWeb } from '../../actions.ts';
import { Bullets, Button, Callout, Card, IconBubble, Screen, SectionTitle, Txt } from '../../components/ui.tsx';
import { findArticle } from '../../data/content.ts';
import { RATES_CHECKED, SOURCES } from '../../data/rates.ts';
import { mediumDate } from '../../i18n/index.ts';
import { useApp } from '../../state/store.tsx';
import { useTheme } from '../../theme.ts';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useApp();
  const theme = useTheme();
  const article = findArticle(String(id));

  if (!article) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('learn.title') }} />
        <Button title={t('learn.title')} onPress={() => router.replace('/learn')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: article.title[lang] }} />
      <Card>
        <IconBubble name={article.icon} tone={article.tone} size={48} />
        <Txt variant="title">{article.title[lang]}</Txt>
        <Txt muted>{article.summary[lang]}</Txt>
        <Txt variant="small" muted>
          {t('learn.checked', { date: mediumDate(t, RATES_CHECKED) })}
        </Txt>
      </Card>

      {lang === 'ny' ? (
        <Callout tone="info" icon="language">
          {t('learn.englishOnly')}
        </Callout>
      ) : null}

      {article.sections.map((s, i) => (
        <Card key={s.heading ?? i}>
          {s.heading ? <SectionTitle title={s.heading} /> : null}
          {s.body ? <Txt style={{ lineHeight: 23 }}>{s.body}</Txt> : null}
          {s.bullets ? <Bullets items={s.bullets} /> : null}
        </Card>
      ))}

      {article.related ? <Button title={t('learn.related')} icon="arrow-forward" kind="secondary" onPress={() => router.push(article.related as '/pay')} /> : null}

      <Card style={{ gap: 8 }}>
        <SectionTitle title={t('common.sources')} />
        {article.sources.map((sid) => {
          const s = SOURCES[sid];
          return (
            <Pressable key={sid} onPress={() => openWeb(s.url)} accessibilityRole="link">
              <View style={{ gap: 2 }}>
                <Txt variant="small" color={theme.primary} style={{ fontWeight: '700' }}>
                  {s.title}
                </Txt>
                <Txt variant="small" muted>
                  {`${s.publisher} · ${s.date}`}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}
