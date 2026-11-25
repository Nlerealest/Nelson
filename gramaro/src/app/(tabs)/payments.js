// Staff: every payment customers report, newest first. "Money received"
// updates the customer's trip instantly.
import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { useRows } from '../../data';
import { mk, tripTitle } from '../../format';
import { Body, Chips, Empty, Loading, Screen, Section } from '../../components/ui';
import { LiveDot } from '../../components/brand';
import { PaymentRow } from '../../components/payment';

export default function Payments() {
  const [f, setF] = useState('submitted');
  const { rows, error, reload } = useRows('payments');
  const { rows: reqs } = useRows('requests');
  const byId = useMemo(() => new Map((reqs || []).map((r) => [r.id, r])), [reqs]);
  const list = (rows || []).filter((p) => f === 'all' || p.status === f);
  const today = new Date().toISOString().slice(0, 10);
  const todayTotal = (rows || []).filter((p) => p.status === 'verified' && String(p.verified_at || '').slice(0, 10) === today).reduce((s, p) => s + Number(p.amount_mwk), 0);
  return (
    <Screen onRefresh={reload}>
      <LiveDot />
      <Body small muted>Confirmed today: <Body small bold>{mk(todayTotal)}</Body>. Check each transaction ID against your Airtel Money / Mpamba / bank statement before tapping “Money received”.</Body>
      <Chips options={[['submitted', 'To check'], ['verified', 'Confirmed'], ['rejected', 'Rejected'], ['all', 'All']]} value={f} onChange={setF} />
      {error ? <Loading error={error} /> : !rows ? <Loading /> : list.length ? list.map((p) => {
        const r = byId.get(p.request_id);
        return (
          <Pressable key={p.id} onPress={() => router.push(`/request/${p.request_id}`)}>
            {r ? <Section>{r.customer_name || 'Customer'} · {tripTitle(r)} · {r.ref}</Section> : null}
            <PaymentRow p={p} staff />
          </Pressable>
        );
      }) : <Empty icon="wallet-outline" title="Nothing to check">Payments appear here the moment a customer taps “I have paid”.</Empty>}
    </Screen>
  );
}
