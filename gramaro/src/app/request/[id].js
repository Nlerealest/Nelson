// One trip, live: progress, fare options with hold countdowns, payment,
// ticket, chat with the agent and the full timeline. Staff see extra controls
// to take the request, add fares, check payments and issue the ticket.
import { useMemo, useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../supabase';
import { run, useApp, useNow, useRows, useSettings, useToast } from '../../data';
import { useTheme } from '../../theme';
import { at, balance, day, holdLeft, kindLabel, mk, parseAmount, passportCheck, pax, PAY_METHODS, phoneDigits, statusOf, tripTitle, usd, when } from '../../format';
import { Body, Button, Card, Chips, Empty, Field, Loading, Pill, Row, Screen, Section } from '../../components/ui';
import { Steps } from '../../components/trip';
import { LiveDot } from '../../components/brand';
import { PaymentRow } from '../../components/payment';

function confirm(title, message, onYes) {
  if (Platform.OS === 'web') { if (globalThis.confirm?.(`${title}\n\n${message}`)) onYes(); return; }
  Alert.alert(title, message, [{ text: 'No', style: 'cancel' }, { text: 'Yes', style: 'destructive', onPress: onYes }]);
}

function Line({ label, value }) {
  if (!value) return null;
  return (
    <Row wrap={false} style={{ alignItems: 'flex-start' }}>
      <Body small muted style={{ width: 92 }}>{label}</Body>
      <Body small style={{ flex: 1 }} selectable>{value}</Body>
    </Row>
  );
}

// ───────── Fare options ─────────
function Quote({ q, r, staff, now }) {
  const t = useTheme();
  const toast = useToast();
  const left = holdLeft(q.hold_until, now);
  const chosen = r.chosen_quote_id === q.id;
  const canChoose = !staff && ['quoted', 'accepted'].includes(r.status) && !chosen && !(left && left.expired);
  return (
    <Card style={{ borderColor: chosen ? t.ok : q.status === 'declined' ? t.line : t.primary, borderWidth: chosen ? 2 : 1, opacity: q.status === 'declined' && !chosen ? 0.6 : 1 }}>
      <Row style={{ justifyContent: 'space-between' }} wrap={false}>
        <Row wrap={false} style={{ flex: 1 }}><Ionicons name="airplane" size={18} color={t.primary} /><Body bold style={{ flex: 1 }}>{q.airline}</Body></Row>
        {chosen ? <Pill label="Your choice" tone="ok" /> : left ? <Pill label={left.text} tone={left.expired ? 'bad' : left.urgent ? 'warn' : 'info'} /> : null}
      </Row>
      <Line label="Route" value={q.route} />
      <Line label="Going" value={q.outbound} />
      <Line label="Return" value={q.inbound} />
      <Line label="Baggage" value={q.baggage} />
      <Line label="Notes" value={q.details} />
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Body bold style={{ fontSize: 20 }} color={t.primary}>{mk(q.price_mwk)}</Body>
          {q.price_usd ? <Body small muted>{usd(q.price_usd)} total</Body> : <Body small muted>total for {pax(r) || 'all travellers'}</Body>}
        </View>
        {canChoose ? (
          <Button kind="accent" icon="checkmark" title="Choose this fare" onPress={() => run(toast, db().rpc('accept_quote', { qid: q.id }), 'Fare chosen. Pay to lock it in.')} />
        ) : null}
        {staff && q.status === 'offered' && r.status !== 'cancelled' ? (
          <Button small kind="danger" title="Remove" onPress={() => confirm('Remove this fare?', q.airline, () => run(toast, db().from('quotes').delete().eq('id', q.id), 'Removed'))} />
        ) : null}
      </Row>
      {left && !left.expired && !chosen && !staff ? <Body small muted>The airline holds this price until {at(q.hold_until)}. After that it may change.</Body> : null}
      {left && left.expired && !staff && !chosen ? <Body small color={t.danger}>This price has expired. Message us and we’ll re-check it.</Body> : null}
    </Card>
  );
}

// ───────── Payment (customer) ─────────
function PayBox({ r, payments }) {
  const t = useTheme();
  const toast = useToast();
  const settings = useSettings();
  const due = balance(r);
  const [method, setMethod] = useState('airtel');
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const howTo = {
    airtel: `Send to Airtel Money: ${settings.payment?.airtel || 'ask us for the number'}. Then type the transaction ID from the SMS below.`,
    mpamba: `Send to TNM Mpamba: ${settings.payment?.mpamba || 'ask us for the number'}. Then type the transaction ID from the SMS below.`,
    bank: `${settings.payment?.bank || 'Deposit to our bank account'}. Type the deposit slip or transfer reference below.`,
    cash: 'Pay at our office in Zomba and get a receipt. Type the receipt number below (optional).',
  }[method];
  const amt = parseAmount(amount) || (amount.trim() ? null : due || null);
  const pending = payments.filter((p) => p.status === 'submitted');
  return (
    <>
      <Section>Payment</Section>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}><Body muted>Total</Body><Body bold>{mk(r.amount_due_mwk)}</Body></Row>
        <Row style={{ justifyContent: 'space-between' }}><Body muted>Paid (confirmed)</Body><Body bold color={t.ok}>{mk(r.amount_paid_mwk)}</Body></Row>
        <Row style={{ justifyContent: 'space-between' }}><Body muted>Balance</Body><Body bold color={due ? t.warn : t.ok}>{mk(due)}</Body></Row>
        {pending.length ? <Body small color={t.warn}>We are checking {pending.length} payment{pending.length > 1 ? 's' : ''}. This screen updates by itself.</Body> : null}
      </Card>
      {due > 0 && ['accepted', 'paid', 'confirmed'].includes(r.status) ? (
        <Card>
          <Body bold>Pay now</Body>
          <Chips options={PAY_METHODS} value={method} onChange={setMethod} />
          <Body small muted>{howTo}</Body>
          <Field label="Amount (MK)" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder={due ? `${due} (full balance)` : ""} />
          <Body small muted>You can pay in parts, for example a deposit now and the rest later, as long as it’s all paid before the fare hold ends.</Body>
          <Field label={method === 'cash' ? 'Receipt number (optional)' : 'Transaction ID'} value={ref} onChangeText={setRef} autoCapitalize="characters" placeholder={method === 'airtel' ? 'e.g. CI251125.1530.H12345' : ''} />
          <Button title="I have paid" icon="checkmark-done" disabled={!amt || (method !== 'cash' && ref.trim().length < 4)} onPress={async () => {
            if (await run(toast, db().rpc('submit_payment', { rid: r.id, pay_method: method, amount: amt, ref }), 'Sent. We’ll confirm it shortly.')) setRef('');
          }} />
        </Card>
      ) : null}
    </>
  );
}

// ───────── Chat ─────────
function Chat({ r, staff }) {
  const t = useTheme();
  const toast = useToast();
  const { rows } = useRows('messages', { filter: { request_id: r.id } });
  const [text, setText] = useState('');
  const list = useMemo(() => [...(rows || [])].reverse(), [rows]);
  const closed = ['completed', 'cancelled'].includes(r.status);
  return (
    <>
      <Section right={<LiveDot />}>Messages</Section>
      <Card style={{ gap: 8 }}>
        {list.length ? list.map((m) => {
          const mine = m.from_staff === staff;
          return (
            <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: mine ? t.primary : t.input, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
              {!mine ? <Body small bold color={t.accent}>{m.from_staff ? 'Gramaro' : r.customer_name || 'Customer'}</Body> : null}
              <Body color={mine ? '#fff' : t.text} selectable>{m.body}</Body>
              <Body small color={mine ? '#cdd6ff' : t.muted} style={{ fontSize: 11, alignSelf: 'flex-end' }}>{when(m.created_at)}</Body>
            </View>
          );
        }) : <Body small muted>{staff ? 'No messages yet.' : 'Questions about your trip? Ask here. An agent replies in this chat.'}</Body>}
        {!closed || staff ? (
          <Row wrap={false} style={{ alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><Field value={text} onChangeText={setText} placeholder="Type a message" multiline style={{ minHeight: 44 }} /></View>
            <Button icon="send" title="" disabled={!text.trim()} onPress={async () => {
              const body = text.trim();
              setText('');
              if (!(await run(toast, db().from('messages').insert({ request_id: r.id, body, from_staff: staff })))) setText(body);
            }} />
          </Row>
        ) : null}
      </Card>
    </>
  );
}

// ───────── Staff controls ─────────
function AddQuote({ r }) {
  const toast = useToast();
  const settings = useSettings();
  const rate = Number(settings.rate?.usd_mwk) || null;
  const blank = { airline: '', route: '', outbound: '', inbound: '', baggage: '', details: '', usd: '', mwk: '', hours: '24' };
  const [f, setF] = useState(blank);
  const [open, setOpen] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const usdN = parseAmount(f.usd);
  const mwkN = parseAmount(f.mwk) || (usdN && rate ? Math.round(usdN * rate) : null);
  if (!open) return <Button kind="soft" icon="add" title="Add a fare option" onPress={() => setOpen(true)} />;
  return (
    <Card>
      <Body bold>New fare option</Body>
      <Field label="Airline" value={f.airline} onChangeText={set('airline')} placeholder="Ethiopian, Kenya Airways, Airlink, Malawi Airlines…" />
      <Field label="Route" value={f.route} onChangeText={set('route')} placeholder="LLW → ADD → DXB" />
      <Field label="Going" value={f.outbound} onChangeText={set('outbound')} placeholder="20 Dec 13:45 → 21 Dec 06:10, 1 stop" />
      {r.trip_type === 'return' ? <Field label="Return" value={f.inbound} onChangeText={set('inbound')} placeholder="5 Jan 09:30 → 5 Jan 18:20" /> : null}
      <Field label="Baggage" value={f.baggage} onChangeText={set('baggage')} placeholder="2 × 23 kg" />
      <Field label="Notes" value={f.details} onChangeText={set('details')} placeholder="Refundable with fee, change fee US$ 50…" />
      <Field label={`Price in US$ (optional${rate ? `, × ${rate}` : ''})`} value={f.usd} onChangeText={set('usd')} keyboardType="numeric" />
      <Field label="Price in MK (total for all travellers)" value={f.mwk} onChangeText={set('mwk')} keyboardType="numeric" placeholder={mwkN ? String(mwkN) : ''} />
      <Field label="Airline holds this price for (hours)" value={f.hours} onChangeText={set('hours')} keyboardType="numeric" />
      <Row>
        <Button title="Send to customer" icon="paper-plane" disabled={!f.airline.trim() || !mwkN} onPress={async () => {
          const hours = parseAmount(f.hours);
          const ok = await run(toast, db().from('quotes').insert({
            request_id: r.id, airline: f.airline.trim(), route: f.route.trim() || null, outbound: f.outbound.trim() || null,
            inbound: f.inbound.trim() || null, baggage: f.baggage.trim() || null, details: f.details.trim() || null,
            price_usd: usdN, price_mwk: mwkN, hold_until: hours ? new Date(Date.now() + hours * 3600e3).toISOString() : null,
          }), 'Fare sent. The customer sees it now.');
          if (ok) { setF(blank); setOpen(false); }
        }} />
        <Button kind="plain" title="Cancel" onPress={() => setOpen(false)} />
      </Row>
    </Card>
  );
}

function StaffPanel({ r }) {
  const t = useTheme();
  const toast = useToast();
  const { user } = useApp();
  const [pnr, setPnr] = useState(r.pnr || '');
  const [tickets, setTickets] = useState(r.ticket_numbers || '');
  const { rows: prof } = useRows('profiles', { filter: { id: r.customer_id } });
  const p = prof?.[0];
  const pass = passportCheck(p?.passport_expiry, r.depart_on);
  const update = (patch, msg) => run(toast, db().from('requests').update(patch).eq('id', r.id), msg);
  const phone = phoneDigits(r.customer_phone || p?.phone);
  const wa = phone.startsWith('0') ? '265' + phone.slice(1) : phone.replace('+', '');
  return (
    <>
      <Section>Customer</Section>
      <Card>
        <Body bold>{r.customer_name || p?.full_name || 'Customer'}</Body>
        <Line label="Phone" value={r.customer_phone || p?.phone} />
        <Line label="Passport" value={p?.passport_number ? `${p.passport_number}${p.passport_expiry ? `, expires ${day(p.passport_expiry)}` : ''}` : null} />
        <Body small color={pass.tone === 'bad' ? t.danger : pass.tone === 'warn' ? t.warn : t.ok}>{pass.text}</Body>
        {phone ? (
          <Row>
            <Button small kind="plain" icon="call" title="Call" onPress={() => Linking.openURL(`tel:${phone}`)} />
            <Button small kind="soft" icon="logo-whatsapp" title="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${wa}`)} />
          </Row>
        ) : null}
      </Card>
      <Section>Work on it</Section>
      <Card>
        <Body small muted>{r.assigned_to ? `Handled by ${r.assigned_to}` : 'Nobody has taken this yet.'}</Body>
        <Row>
          {r.assigned_to !== user.email ? <Button small icon="hand-left" title="Take it" onPress={() => update({ assigned_to: user.email, ...(r.status === 'new' ? { status: 'quoting' } : {}) }, 'It’s yours. The customer sees “Finding fares”.')} /> : null}
          {r.status === 'new' ? <Button small kind="plain" title="Mark: finding fares" onPress={() => update({ status: 'quoting' })} /> : null}
          {['accepted', 'paid'].includes(r.status) ? <Button small kind="plain" title="Confirm without full payment" onPress={() => confirm('Confirm this booking?', 'Only do this if the customer has an agreed credit arrangement.', () => update({ status: 'confirmed' }, 'Confirmed'))} /> : null}
          {r.status === 'ticketed' ? <Button small kind="plain" icon="flag" title="Trip completed" onPress={() => update({ status: 'completed' })} /> : null}
          {!['cancelled', 'completed'].includes(r.status) ? <Button small kind="danger" title="Cancel request" onPress={() => confirm('Cancel this request?', 'The customer will see it as cancelled.', () => run(toast, db().rpc('cancel_request', { rid: r.id }), 'Cancelled'))} /> : null}
          {r.status === 'cancelled' ? <Button small kind="plain" title="Reopen" onPress={() => update({ status: 'quoting' }, 'Reopened')} /> : null}
        </Row>
      </Card>
      {['new', 'quoting', 'quoted', 'accepted'].includes(r.status) ? <AddQuote r={r} /> : null}
      {['confirmed', 'ticketed', 'paid', 'accepted'].includes(r.status) ? (
        <Card>
          <Body bold>Ticket</Body>
          <Field label="Airline booking reference (PNR)" value={pnr} onChangeText={setPnr} autoCapitalize="characters" placeholder="e.g. K7Q2ZP" />
          <Field label="E-ticket number(s)" value={tickets} onChangeText={setTickets} placeholder="071-2345678901, 071-2345678902" multiline style={{ minHeight: 60 }} />
          <Button icon="airplane" title={r.status === 'ticketed' ? 'Save ticket details' : 'Mark as ticketed'} disabled={!pnr.trim()}
            onPress={() => update({ pnr: pnr.trim().toUpperCase(), ticket_numbers: tickets.trim() || null, status: 'ticketed' }, 'Ticket sent to the customer’s app')} />
          {balance(r) > 0 ? <Body small color={t.warn}>Balance still due: {mk(balance(r))}</Body> : null}
        </Card>
      ) : null}
    </>
  );
}

// ───────── Screen ─────────
export default function RequestScreen() {
  const t = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams();
  const { role } = useApp();
  const staff = role === 'staff';
  const now = useNow(20000);
  const { rows, error } = useRows('requests', { filter: { id } });
  const { rows: quotes } = useRows('quotes', { filter: { request_id: id } });
  const { rows: payments } = useRows('payments', { filter: { request_id: id } });
  const { rows: events } = useRows('events', { filter: { request_id: id } });
  const r = rows?.[0];
  if (error) return <Loading error={error} />;
  if (!rows) return <Loading />;
  if (!r) return <Screen><Empty icon="help-circle-outline" title="Trip not found">It may have been removed.</Empty></Screen>;
  const st = statusOf(r.status);
  const showPay = r.amount_due_mwk && ['accepted', 'paid', 'confirmed', 'ticketed', 'completed'].includes(r.status);
  const sortedQuotes = [...(quotes || [])].sort((a, b) => Number(a.price_mwk) - Number(b.price_mwk));
  return (
    <Screen>
      <Stack.Screen options={{ title: r.ref || 'Trip' }} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }} wrap={false}>
          <Body bold style={{ fontSize: 18, flex: 1 }}>{tripTitle(r)}</Body>
          <Pill label={st.label} tone={st.tone} />
        </Row>
        <Steps status={r.status} />
        <Line label="Type" value={r.kind !== 'flight' ? kindLabel(r.kind) : r.trip_type === 'oneway' ? 'One way' : 'Return'} />
        <Line label="Dates" value={[r.depart_on && day(r.depart_on), r.return_on && day(r.return_on)].filter(Boolean).join(' → ') + (r.flexible ? ' (flexible)' : '')} />
        <Line label="Travellers" value={`${pax(r)}${r.cabin ? ` · ${r.cabin}` : ''}`} />
        <Line label="Budget" value={r.budget} />
        <Line label="Notes" value={r.notes} />
        <Line label="Reference" value={r.ref} />
      </Card>

      {r.status === 'ticketed' || r.status === 'completed' ? (
        <Card hero>
          <Row><Ionicons name="airplane" size={20} color="#fff" /><Body bold color="#fff" style={{ fontSize: 18 }}>Your ticket is issued</Body></Row>
          <Body color="#dfe6ff">Booking reference (PNR)</Body>
          <Body bold color="#fff" style={{ fontSize: 30, letterSpacing: 3 }} selectable>{r.pnr || '—'}</Body>
          {r.ticket_numbers ? <Body color="#fff" selectable>E-ticket: {r.ticket_numbers}</Body> : null}
          <Body small color="#dfe6ff">Use this reference to check in online or at the airport. Bring your passport. Arrive 3 hours early for international flights.</Body>
        </Card>
      ) : null}

      {staff ? <StaffPanel r={r} /> : null}

      {r.kind === 'flight' || (quotes || []).length ? (
        <>
          <Section>{staff ? 'Fare options sent' : 'Your fare options'}</Section>
          {sortedQuotes.length ? sortedQuotes.map((q) => <Quote key={q.id} q={q} r={r} staff={staff} now={now} />) : (
            <Empty icon="search-outline" title={staff ? 'No fares sent yet' : 'Finding the best fares for you'}>
              {staff ? 'Add a fare option above.' : 'An agent is checking the airlines. Fares appear here the moment they’re sent. No need to refresh.'}
            </Empty>
          )}
        </>
      ) : null}

      {showPay && !staff ? <PayBox r={r} payments={payments || []} /> : null}
      {(payments || []).length ? (
        <>
          {staff ? <Section>Payments · {mk(r.amount_paid_mwk)} of {mk(r.amount_due_mwk)}</Section> : <Section>Your payments</Section>}
          {payments.map((p) => <PaymentRow key={p.id} p={p} staff={staff} />)}
        </>
      ) : null}

      <Chat r={r} staff={staff} />

      <Section>Timeline</Section>
      <Card style={{ gap: 8 }}>
        {(events || []).map((e) => (
          <Row key={e.id} wrap={false} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent, marginTop: 6 }} />
            <View style={{ flex: 1 }}>
              <Body small>{e.text}</Body>
              <Body small muted style={{ fontSize: 11 }}>{when(e.created_at, now)}</Body>
            </View>
          </Row>
        ))}
      </Card>

      {!staff && !['ticketed', 'completed', 'cancelled'].includes(r.status) ? (
        <Button kind="danger" small title="Cancel this request" onPress={() => confirm('Cancel this request?', 'You can always send a new one.', () => run(toast, db().rpc('cancel_request', { rid: r.id }), 'Cancelled'))} />
      ) : null}
    </Screen>
  );
}
