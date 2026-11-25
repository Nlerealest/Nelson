import { useState } from 'react';
import { db } from '../supabase';
import { run, useApp, useToast } from '../data';
import { useTheme } from '../theme';
import { mk, payLabel, when } from '../format';
import { Body, Button, Card, Field, Pill, Row } from './ui';

export function PaymentRow({ p, staff }) {
  const t = useTheme();
  const toast = useToast();
  const { user } = useApp();
  const [note, setNote] = useState('');
  const tone = { submitted: 'warn', verified: 'ok', rejected: 'bad' }[p.status];
  const label = { submitted: 'Checking', verified: 'Confirmed', rejected: 'Not found' }[p.status];
  return (
    <Card style={{ gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Body bold>{mk(p.amount_mwk)}</Body>
        <Pill label={label} tone={tone} />
      </Row>
      <Body small muted>{payLabel(p.method)}{p.reference ? ` · ${p.reference}` : ''} · {when(p.created_at)}</Body>
      {p.note ? <Body small color={t.danger}>{p.note}</Body> : null}
      {staff && p.status === 'submitted' ? (
        <>
          <Field value={note} onChangeText={setNote} placeholder="Reason if rejecting (customer sees this)" />
          <Row>
            <Button small icon="checkmark" title="Money received" onPress={() => run(toast, db().from('payments').update({ status: 'verified', verified_at: new Date().toISOString(), verified_by: user.email }).eq('id', p.id), 'Payment confirmed')} />
            <Button small kind="danger" title="Not received" onPress={() => run(toast, db().from('payments').update({ status: 'rejected', note: note.trim() || 'We could not find this payment. Check the transaction ID.', verified_by: user.email }).eq('id', p.id), 'Customer told')} />
          </Row>
        </>
      ) : null}
    </Card>
  );
}

