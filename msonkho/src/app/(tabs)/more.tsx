import { View } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import Constants from 'expo-constants';
import { Card, Divider, ListRow, Screen, Txt } from '../../components/ui.tsx';
import type { IconName } from '../../components/ui.tsx';
import { BrandMark } from '../../components/brand.tsx';
import type { TKey } from '../../i18n/index.ts';
import { useApp } from '../../state/store.tsx';
import type { Tone } from '../../theme.ts';

const ITEMS: { title: TKey; desc: TKey; icon: IconName; tone: Tone; href: Href }[][] = [
  [
    { title: 'more.account', desc: 'more.account.desc', icon: 'wallet', tone: 'primary', href: '/account' },
    { title: 'more.pay', desc: 'more.pay.desc', icon: 'card', tone: 'primary', href: '/pay' },
    { title: 'more.business', desc: 'more.business.desc', icon: 'storefront', tone: 'purple', href: '/business' },
  ],
  [
    { title: 'more.learn', desc: 'more.learn.desc', icon: 'school', tone: 'info', href: '/learn' },
    { title: 'more.help', desc: 'more.help.desc', icon: 'call', tone: 'orange', href: '/help' },
  ],
  [
    { title: 'more.settings', desc: 'more.settings.desc', icon: 'settings', tone: 'neutral', href: '/settings' },
    { title: 'more.about', desc: 'more.about.desc', icon: 'information-circle', tone: 'neutral', href: '/about' },
  ],
];

export default function More() {
  const { t } = useApp();
  const version = Constants.expoConfig?.version ?? '2.0.0';
  return (
    <Screen>
      {ITEMS.map((group) => (
        <Card key={group[0].title} style={{ gap: 4 }}>
          {group.map((item, i) => (
            <View key={item.title}>
              {i > 0 ? <Divider /> : null}
              <ListRow icon={item.icon} tone={item.tone} title={t(item.title)} subtitle={t(item.desc)} onPress={() => router.push(item.href)} />
            </View>
          ))}
        </Card>
      ))}
      <View style={{ alignItems: 'center', gap: 8, marginTop: 8 }}>
        <BrandMark size={44} />
        <Txt variant="small" muted>
          {`${t('app.name')} · ${t('more.version', { v: version })}`}
        </Txt>
        <Txt variant="small" muted align="center" style={{ paddingHorizontal: 24 }}>
          {t('app.disclaimer')}
        </Txt>
      </View>
    </Screen>
  );
}
