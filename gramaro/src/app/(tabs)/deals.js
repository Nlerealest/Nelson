// Staff: special deals and seasonal offers. Customers see active ones on
// their home screen the moment they're saved.
import { useState } from 'react';
import { Switch } from 'react-native';
import { db } from '../../supabase';
import { run, useRows, useToast } from '../../data';
import { useTheme } from '../../theme';
import { day, mk, parseAmount, parseDate } from '../../format';
import { Body, Button, Card, Empty, Field, Loading, Pill, Row, Screen, Section } from '../../components/ui';

export default function Deals() {
  const t = useTheme();
  const toast = useToast();
  const { rows, error, reload } = useRows('deals');
  const blank = { title: '', route: '', price: '', until: '', details: '' };
  const [f, setF] = useState(blank);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const until = f.until ? parseDate(f.until) : null;
  return (
    <Screen onRefresh={reload}>
      <Card>
        <Body bold>New deal</Body>
        <Field label="Title" value={f.title} onChangeText={set('title')} placeholder="December special: Lilongwe to Johannesburg" />
        <Field label="Route / airline" value={f.route} onChangeText={set('route')} placeholder="LLW ⇄ JNB with Airlink" />
        <Field label="Price from (MK)" value={f.price} onChangeText={set('price')} keyboardType="numeric" />
        <Field label="Valid until" value={f.until} onChangeText={set('until')} placeholder="DD/MM/YYYY" />
        <Field label="Details" value={f.details} onChangeText={set('details')} multiline placeholder="Return fare incl. taxes, 23 kg bag, travel 1–20 Dec…" />
        <Button title="Publish to customers" icon="megaphone" disabled={!f.title.trim() || (f.until && !until)} onPress={async () => {
          const ok = await run(toast, db().from('deals').insert({
            title: f.title.trim(), route: f.route.trim() || null, price_mwk: parseAmount(f.price), valid_until: until, details: f.details.trim() || null,
          }), 'Published. Customers see it now.');
          if (ok) setF(blank);
        }} />
      </Card>
      <Section>All deals</Section>
      {error ? <Loading error={error} /> : !rows ? <Loading /> : rows.length ? rows.map((d) => (
        <Card key={d.id} style={{ gap: 6, opacity: d.active ? 1 : 0.6 }}>
          <Row style={{ justifyContent: 'space-between' }} wrap={false}>
            <Body bold style={{ flex: 1 }}>{d.title}</Body>
            {d.price_mwk ? <Pill label={mk(d.price_mwk)} tone="accent" /> : null}
          </Row>
          {d.route ? <Body small>{d.route}</Body> : null}
          {d.details ? <Body small muted>{d.details}</Body> : null}
          <Row style={{ justifyContent: 'space-between' }}>
            <Body small muted>{d.valid_until ? `Until ${day(d.valid_until)}` : 'No end date'}</Body>
            <Row>
              <Body small>{d.active ? 'Showing' : 'Hidden'}</Body>
              <Switch value={d.active} trackColor={{ true: t.primary }} onValueChange={(v) => run(toast, db().from('deals').update({ active: v }).eq('id', d.id))} />
              <Button small kind="danger" title="Delete" onPress={() => run(toast, db().from('deals').delete().eq('id', d.id), 'Deleted')} />
            </Row>
          </Row>
        </Card>
      )) : <Empty icon="pricetags-outline" title="No deals yet" />}
    </Screen>
  );
}
