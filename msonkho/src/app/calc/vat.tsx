import { useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Button, Callout, Card, Divider, MoneyInput, ResultHero, Row, Screen, Segmented } from '../../components/ui.tsx';
import { RatesFooter } from '../../components/calc.tsx';
import { formatK, parseAmount } from '../../lib/format.ts';
import { addVat, checkReceiptVat, extractVat } from '../../lib/tax.ts';
import { useApp } from '../../state/store.tsx';

type Mode = 'add' | 'remove' | 'check';

export default function VatCalculator() {
  const { t } = useApp();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'check' ? 'check' : params.mode === 'remove' ? 'remove' : 'add');
  const [price, setPrice] = useState('100,000');
  // A receipt still charging the old 16.5% rate: a common mistake worth showing.
  const [total, setTotal] = useState('116,500');
  const [shown, setShown] = useState('16,500');

  return (
    <Screen>
      <Stack.Screen options={{ title: t('vat.title') }} />
      <Card>
        <Segmented
          options={[
            { value: 'add', label: t('vat.add') },
            { value: 'remove', label: t('vat.remove') },
            { value: 'check', label: t('vat.check') },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'add' ? <MoneyInput label={t('vat.priceBefore')} value={price} onChange={setPrice} /> : null}
        {mode === 'remove' ? <MoneyInput label={t('vat.priceWith')} value={price} onChange={setPrice} /> : null}
        {mode === 'check' ? (
          <>
            <MoneyInput label={t('vat.receiptTotal')} value={total} onChange={setTotal} />
            <MoneyInput label={t('vat.receiptVat')} value={shown} onChange={setShown} />
          </>
        ) : null}
      </Card>

      {mode === 'add' ? <AddResult amount={parseAmount(price)} /> : null}
      {mode === 'remove' ? <RemoveResult amount={parseAmount(price)} /> : null}
      {mode === 'check' ? <CheckResult total={parseAmount(total)} shown={parseAmount(shown)} /> : null}

      <Callout tone="purple" icon="qr-code">
        {t('vat.note')}
      </Callout>
      <RatesFooter />
    </Screen>
  );
}

function AddResult({ amount }: { amount: number }) {
  const { t } = useApp();
  const r = addVat(amount);
  return (
    <Card>
      <ResultHero label={t('vat.grossAmount')} value={formatK(r.gross)} tone="orange" />
      <Row label={t('vat.netAmount')} value={formatK(r.net)} />
      <Row label={t('vat.vatAmount')} value={formatK(r.vat)} />
      <Divider />
      <Row label={t('vat.grossAmount')} value={formatK(r.gross)} strong />
    </Card>
  );
}

function RemoveResult({ amount }: { amount: number }) {
  const { t } = useApp();
  const r = extractVat(amount);
  return (
    <Card>
      <ResultHero label={t('vat.vatAmount')} value={formatK(r.vat)} tone="orange" />
      <Row label={t('vat.grossAmount')} value={formatK(r.gross)} />
      <Row label={t('vat.vatAmount')} value={formatK(r.vat)} />
      <Divider />
      <Row label={t('vat.netAmount')} value={formatK(r.net)} strong />
    </Card>
  );
}

function CheckResult({ total, shown }: { total: number; shown: number }) {
  const { t } = useApp();
  if (total <= 0) return null;
  const r = checkReceiptVat(total, shown);
  const view = {
    ok: { tone: 'primary' as const, icon: 'checkmark-circle' as const, title: t('vat.ok.title'), body: t('vat.ok.body') },
    oldRate: { tone: 'warn' as const, icon: 'alert-circle' as const, title: t('vat.old.title'), body: t('vat.old.body') },
    noVat: { tone: 'info' as const, icon: 'information-circle' as const, title: t('vat.none.title'), body: t('vat.none.body') },
    mismatch: {
      tone: 'danger' as const,
      icon: 'close-circle' as const,
      title: t('vat.bad.title'),
      body: t('vat.bad.body', { expected: formatK(r.expected), shown: formatK(shown) }),
    },
  }[r.status];
  return (
    <Card>
      <Callout tone={view.tone} icon={view.icon} title={view.title}>
        {view.body}
      </Callout>
      <Row label={t('vat.expected')} value={formatK(r.expected)} strong />
      <Row label={t('vat.receiptVat')} value={formatK(shown)} />
      {r.status !== 'ok' ? <Button small kind="secondary" icon="qr-code" title={t('quick.scan')} onPress={() => router.push('/scan')} /> : null}
    </Card>
  );
}
