import { View } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Card, Divider, ListRow, Screen, SectionTitle, Txt } from '../../components/ui.tsx';
import type { IconName } from '../../components/ui.tsx';
import { RATES_CHECKED } from '../../data/rates.ts';
import { mediumDate } from '../../i18n/index.ts';
import type { TKey } from '../../i18n/index.ts';
import { useApp } from '../../state/store.tsx';
import { useTheme } from '../../theme.ts';
import type { Tone } from '../../theme.ts';

type Tool = { title: TKey; desc: TKey; icon: IconName; tone: Tone; href: Href };

const GROUPS: { title: TKey; tools: Tool[] }[] = [
  {
    title: 'tools.employees',
    tools: [
      { title: 'tools.paye', desc: 'tools.paye.desc', icon: 'people', tone: 'info', href: '/calc/paye' },
      { title: 'tools.gross', desc: 'tools.gross.desc', icon: 'swap-vertical', tone: 'info', href: '/calc/paye?mode=net' },
    ],
  },
  {
    title: 'tools.business',
    tools: [
      { title: 'tools.vat', desc: 'tools.vat.desc', icon: 'receipt', tone: 'orange', href: '/calc/vat' },
      { title: 'tools.receipt', desc: 'tools.receipt.desc', icon: 'search', tone: 'orange', href: '/calc/vat?mode=check' },
      { title: 'tools.wht', desc: 'tools.wht.desc', icon: 'cut', tone: 'purple', href: '/calc/wht' },
      { title: 'tools.presumptive', desc: 'tools.presumptive.desc', icon: 'storefront', tone: 'primary', href: '/calc/presumptive' },
      { title: 'tools.vatRegister', desc: 'tools.vatRegister.desc', icon: 'stats-chart', tone: 'primary', href: '/calc/vat-register' },
    ],
  },
  {
    title: 'tools.everyday',
    tools: [
      { title: 'tools.imports', desc: 'tools.imports.desc', icon: 'boat', tone: 'info', href: '/calc/imports' },
      { title: 'tools.levy', desc: 'tools.levy.desc', icon: 'swap-horizontal', tone: 'purple', href: '/calc/levy' },
    ],
  },
];

export default function Tools() {
  const { t } = useApp();
  const theme = useTheme();
  return (
    <Screen>
      {GROUPS.map((g) => (
        <Card key={g.title} style={{ gap: 4 }}>
          <SectionTitle title={t(g.title)} />
          {g.tools.map((tool, i) => (
            <View key={tool.title}>
              {i > 0 ? <Divider /> : null}
              <ListRow icon={tool.icon} tone={tool.tone} title={t(tool.title)} subtitle={t(tool.desc)} onPress={() => router.push(tool.href)} />
            </View>
          ))}
        </Card>
      ))}
      <Card onPress={() => router.push('/about')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Txt variant="small" color={theme.primary} style={{ flex: 1, fontWeight: '700' }}>
          {t('tools.footer', { date: mediumDate(t, RATES_CHECKED) })}
        </Txt>
      </Card>
    </Screen>
  );
}
