// Small pieces shared by the calculator screens.

import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { shareText } from '../actions.ts';
import { RATES_CHECKED } from '../data/rates.ts';
import { mediumDate } from '../i18n/index.ts';
import { useApp } from '../state/store.tsx';
import { useTheme } from '../theme.ts';
import { Button, Txt } from './ui.tsx';

/** "Rates checked 25 Nov 2026 · Sources →" */
export function RatesFooter() {
  const { t } = useApp();
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push('/about')}
      accessibilityRole="link"
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 }}
    >
      <Ionicons name="shield-checkmark" size={14} color={theme.muted} />
      <Txt variant="small" muted>
        {`${t('about.checked', { date: mediumDate(t, RATES_CHECKED) })} · `}
      </Txt>
      <Txt variant="small" color={theme.primary} style={{ fontWeight: '800' }}>
        {t('common.sources')}
      </Txt>
    </Pressable>
  );
}

export function ShareButton({ text }: { text: string }) {
  const { t, toast } = useApp();
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Button
        small
        kind="ghost"
        icon="share-social"
        title={t('common.share')}
        onPress={async () => {
          const result = await shareText(text);
          if (result === 'copied') toast(t('common.copied'));
        }}
      />
    </View>
  );
}
