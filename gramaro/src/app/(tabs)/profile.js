import { useState } from 'react';
import { db } from '../../supabase';
import { run, useApp, useMyProfile, useRows, useSettings, useToast } from '../../data';
import { useTheme } from '../../theme';
import { day, mk, parseAmount, parseDate, passportCheck } from '../../format';
import { Body, Button, Card, Field, Loading, Row, Screen, Section } from '../../components/ui';
import { ContactButtons } from '../../components/brand';

const CHECKLIST = [
  'Passport valid for at least 6 months after you return, with 2 blank pages.',
  'Visa or e-Visa for your destination (and for transit countries if needed). We can help.',
  'Yellow fever certificate if your route needs one.',
  'Printed or saved copy of your e-ticket and booking reference.',
  'Some US dollars for the trip: banks limit how much forex you can buy, so ask early.',
  'Arrive at the airport 3 hours before international flights.',
];

function CustomerProfile() {
  const { user } = useApp();
  const p = useMyProfile();
  return <CustomerForm key={p ? p.id : 'none'} p={p} user={user} />;
}

function CustomerForm({ p, user }) {
  const t = useTheme();
  const toast = useToast();
  const [f, setF] = useState({ full_name: p?.full_name || '', phone: p?.phone || '', passport_number: p?.passport_number || '', passport_expiry: p?.passport_expiry ? day(p.passport_expiry) : '', nationality: p?.nationality || '' });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const exp = f.passport_expiry ? parseDate(f.passport_expiry) || (p?.passport_expiry && day(p.passport_expiry) === f.passport_expiry ? p.passport_expiry : null) : null;
  const pass = passportCheck(exp);
  return (
    <Screen>
      <Card>
        <Body small muted>{user.email}</Body>
        <Field label="Full name (as on passport)" value={f.full_name} onChangeText={set('full_name')} />
        <Field label="Phone / WhatsApp" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Field label="Nationality" value={f.nationality} onChangeText={set('nationality')} />
        <Field label="Passport number" value={f.passport_number} onChangeText={set('passport_number')} autoCapitalize="characters" />
        <Field label="Passport expiry date" value={f.passport_expiry} onChangeText={set('passport_expiry')} placeholder="DD/MM/YYYY" />
        <Body small color={pass.tone === 'bad' ? t.danger : pass.tone === 'warn' ? t.warn : t.ok}>{pass.text}</Body>
        <Button title="Save" disabled={!!f.passport_expiry && !exp} onPress={() => run(toast, db().from('profiles').upsert({
          id: user.id, full_name: f.full_name.trim() || null, phone: f.phone.trim() || null, nationality: f.nationality.trim() || null,
          passport_number: f.passport_number.trim() || null, passport_expiry: exp,
        }), 'Saved')} />
        <Body small muted>Only you and Gramaro’s agents can see these details. We use them to book your tickets with the right name.</Body>
      </Card>
      <Section>Before you fly</Section>
      <Card style={{ gap: 8 }}>
        {CHECKLIST.map((c) => <Row key={c} wrap={false} style={{ alignItems: 'flex-start' }}><Body color={t.ok}>✓</Body><Body small style={{ flex: 1 }}>{c}</Body></Row>)}
      </Card>
      <Section>Contact Gramaro</Section>
      <Card><ContactButtons /></Card>
      <Button kind="plain" icon="log-out-outline" title="Sign out" onPress={() => db().auth.signOut()} />
    </Screen>
  );
}

function StaffSettings() {
  const toast = useToast();
  const { user } = useApp();
  const s = useSettings();
  const { rows } = useRows('settings');
  if (!rows) return <Loading />;
  return <StaffForm key={rows.map((r) => r.updated_at).join()} s={s} user={user} toast={toast} />;
}

function StaffForm({ s, user, toast }) {
  const [rate, setRate] = useState(String(s.rate?.usd_mwk || ''));
  const [pay, setPay] = useState({ airtel: s.payment?.airtel || '', mpamba: s.payment?.mpamba || '', bank: s.payment?.bank || '' });
  const [phones, setPhones] = useState((s.contacts?.phones || []).join(', '));
  const save = (id, data, msg) => run(toast, db().from('settings').upsert({ id, data, updated_at: new Date().toISOString() }), msg);
  return (
    <Screen>
      <Body small muted>Signed in as staff: {user.email}</Body>
      <Section>Dollar rate</Section>
      <Card>
        <Body small muted>Customers see this on their home screen, and new fares in US$ are converted with it.</Body>
        <Field label="US$ 1 = MK" value={rate} onChangeText={setRate} keyboardType="numeric" />
        <Button title="Update rate" disabled={!parseAmount(rate)} onPress={() => save('rate', { ...(s.rate || {}), usd_mwk: parseAmount(rate) }, `Rate updated: ${mk(parseAmount(rate))}`)} />
      </Card>
      <Section>Where customers pay</Section>
      <Card>
        <Field label="Airtel Money number and name" value={pay.airtel} onChangeText={(v) => setPay((x) => ({ ...x, airtel: v }))} />
        <Field label="TNM Mpamba number and name" value={pay.mpamba} onChangeText={(v) => setPay((x) => ({ ...x, mpamba: v }))} />
        <Field label="Bank account details" value={pay.bank} onChangeText={(v) => setPay((x) => ({ ...x, bank: v }))} multiline style={{ minHeight: 70 }} />
        <Button title="Save payment details" onPress={() => save('payment', pay, 'Saved')} />
      </Card>
      <Section>Phone numbers shown to customers</Section>
      <Card>
        <Field value={phones} onChangeText={setPhones} placeholder="0884 099 227, 0881 737 157" />
        <Button title="Save numbers" onPress={() => save('contacts', { ...(s.contacts || {}), phones: phones.split(',').map((x) => x.trim()).filter(Boolean) }, 'Saved')} />
      </Card>
      <Button kind="plain" icon="log-out-outline" title="Sign out" onPress={() => db().auth.signOut()} />
    </Screen>
  );
}

export default function Profile() {
  const { role } = useApp();
  return role === 'staff' ? <StaffSettings /> : <CustomerProfile />;
}
