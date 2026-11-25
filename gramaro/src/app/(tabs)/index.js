import { useMemo } from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp, useMyProfile, useNow, useRows, useSettings } from '../../data';
import { useTheme } from '../../theme';
import { day, holdLeft, mk, passportCheck, tripTitle } from '../../format';
import { Body, Button, Card, Empty, H1, Loading, Pill, Row, Screen, Section } from '../../components/ui';
import { Steps, TripCard } from '../../components/trip';
import { ContactButtons, LiveDot } from '../../components/brand';

function Deals() {
  const t = useTheme();
  const { rows } = useRows('deals', { filter: { active: true } });
  if (!rows?.length) return null;
  return (
    <>
      <Section>Special deals</Section>
      {rows.map((d) => (
        <Pressable key={d.id} onPress={() => router.push({ pathname: '/new', params: { deal: d.id } })}>
          <Card style={{ borderColor: t.accent, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }} wrap={false}>
              <Body bold style={{ flex: 1 }}>{d.title}</Body>
              {d.price_mwk ? <Pill label={`from ${mk(d.price_mwk)}`} tone="accent" /> : null}
            </Row>
            {d.route ? <Body small>{d.route}</Body> : null}
            {d.details ? <Body small muted>{d.details}</Body> : null}
            <Row style={{ justifyContent: 'space-between' }}>
              <Body small muted>{d.valid_until ? `Until ${day(d.valid_until)}` : 'Limited time'}</Body>
              <Body small bold color={t.accent}>Ask for this deal →</Body>
            </Row>
          </Card>
        </Pressable>
      ))}
    </>
  );
}

function Action({ icon, label, onPress }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.8 : 1 })}>
      <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 6 }}>
        <Ionicons name={icon} size={24} color={t.primary} />
        <Body small bold style={{ textAlign: 'center' }}>{label}</Body>
      </Card>
    </Pressable>
  );
}

function CustomerHome() {
  const t = useTheme();
  const profile = useMyProfile();
  const settings = useSettings();
  const { rows, error, reload } = useRows('requests');
  const active = (rows || []).filter((r) => !['completed', 'cancelled'].includes(r.status));
  const next = active[0];
  const first = (profile?.full_name || '').split(' ')[0];
  const pass = passportCheck(profile?.passport_expiry, next?.depart_on);
  return (
    <Screen onRefresh={reload}>
      <Card hero>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body bold color="#fff" style={{ fontSize: 20 }}>{first ? `Moni, ${first}!` : 'Moni!'}</Body>
          <Ionicons name="airplane" size={22} color="#fff" />
        </Row>
        <Body color="#dfe6ff">Where are you flying next? Send us your trip and an agent replies with the best fares, live in this app.</Body>
        <Button kind="accent" icon="search" title="Get flight prices" onPress={() => router.push('/new')} />
      </Card>
      <Row wrap={false}>
        <Action icon="airplane-outline" label="Flights" onPress={() => router.push({ pathname: '/new', params: { kind: 'flight' } })} />
        <Action icon="document-text-outline" label="Visa help" onPress={() => router.push({ pathname: '/new', params: { kind: 'visa' } })} />
        <Action icon="map-outline" label="Plan a trip" onPress={() => router.push({ pathname: '/new', params: { kind: 'planning' } })} />
      </Row>

      {error ? <Loading error={error} /> : !rows ? <Loading /> : next ? (
        <>
          <Section right={<LiveDot />}>Your trip</Section>
          <Card style={{ gap: 12 }}>
            <Steps status={next.status} />
          </Card>
          <TripCard r={next} />
          {active.length > 1 ? <Button small kind="plain" title={`See all ${active.length} trips`} onPress={() => router.push('/trips')} /> : null}
        </>
      ) : null}

      {profile && pass.tone !== 'ok' ? (
        <Pressable onPress={() => router.push('/profile')}>
          <Card style={{ backgroundColor: pass.tone === 'bad' ? t.dangerSoft : t.warnSoft, borderColor: 'transparent' }}>
            <Row wrap={false}><Ionicons name="id-card-outline" size={20} color={pass.tone === 'bad' ? t.danger : t.warn} /><Body small style={{ flex: 1 }}>{pass.text}</Body></Row>
          </Card>
        </Pressable>
      ) : null}

      <Deals />

      {settings.rate?.usd_mwk ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body small muted>Today’s rate at Gramaro</Body>
            <Body bold>US$ 1 = {mk(settings.rate.usd_mwk)}</Body>
          </Row>
          <Body small muted>Airlines price in dollars. Lock your fare by paying before the hold time runs out.</Body>
        </Card>
      ) : null}

      <Section>Talk to us</Section>
      <Card>
        <Body small muted>Gramaro Travel Agency{settings.contacts?.office ? ` · ${settings.contacts.office}` : ''}</Body>
        <ContactButtons />
      </Card>
    </Screen>
  );
}

function Stat({ n, label, tone, onPress }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexBasis: '47%', flexGrow: 1 }}>
      <Card style={{ gap: 2 }}>
        <Body bold style={{ fontSize: 28 }} color={n ? t[tone] : t.muted}>{n}</Body>
        <Body small muted>{label}</Body>
      </Card>
    </Pressable>
  );
}

function StaffHome() {
  const t = useTheme();
  const now = useNow(30000);
  const { user } = useApp();
  const { rows: reqs, reload } = useRows('requests');
  const { rows: pays } = useRows('payments', { filter: { status: 'submitted' } });
  const { rows: quotes } = useRows('quotes');
  const all = useMemo(() => reqs || [], [reqs]);
  const by = (st) => all.filter((r) => st.includes(r.status));
  const todayStr = new Date(now).toISOString().slice(0, 10);
  const ticketedToday = all.filter((r) => r.status === 'ticketed' && String(r.updated_at).slice(0, 10) === todayStr).length;

  // Fares a customer still has to act on, whose airline hold runs out soon.
  const expiring = useMemo(() => {
    const open = new Map(all.filter((r) => ['quoted', 'accepted', 'paid'].includes(r.status)).map((r) => [r.id, r]));
    return (quotes || [])
      .filter((q) => open.has(q.request_id) && q.status !== 'declined' && q.hold_until)
      .filter((q) => { const r = open.get(q.request_id); return r.status === 'quoted' || r.chosen_quote_id === q.id; })
      .map((q) => ({ q, r: open.get(q.request_id), left: holdLeft(q.hold_until, now) }))
      .filter((x) => x.left && x.left.urgent)
      .sort((a, b) => new Date(a.q.hold_until) - new Date(b.q.hold_until));
  }, [all, quotes, now]);

  const mine = all.filter((r) => r.assigned_to === user.email && !['completed', 'cancelled', 'ticketed'].includes(r.status));
  return (
    <Screen onRefresh={reload}>
      <Row style={{ justifyContent: 'space-between' }}><H1>Today</H1><LiveDot /></Row>
      <Row>
        <Stat n={by(['new']).length} label="New requests" tone="info" onPress={() => router.push({ pathname: '/trips', params: { f: 'new' } })} />
        <Stat n={pays?.length || 0} label="Payments to check" tone="warn" onPress={() => router.push('/payments')} />
        <Stat n={by(['quoted', 'accepted']).length} label="Waiting on customer" tone="accent" onPress={() => router.push({ pathname: '/trips', params: { f: 'waiting' } })} />
        <Stat n={by(['confirmed']).length} label="Ready to ticket" tone="primary" onPress={() => router.push({ pathname: '/trips', params: { f: 'confirmed' } })} />
      </Row>
      <Body small muted>{ticketedToday} ticket{ticketedToday === 1 ? '' : 's'} issued today.</Body>

      <Section>Fare holds running out</Section>
      {expiring.length ? expiring.map(({ q, r, left }) => (
        <Pressable key={q.id} onPress={() => router.push(`/request/${r.id}`)}>
          <Card style={{ borderColor: left.expired ? t.danger : t.warn, gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body bold>{tripTitle(r)}</Body>
              <Pill label={left.text} tone={left.expired ? 'bad' : 'warn'} />
            </Row>
            <Body small muted>{q.airline} · {mk(q.price_mwk)} · {r.customer_name || 'Customer'}{r.customer_phone ? ` · ${r.customer_phone}` : ''}</Body>
          </Card>
        </Pressable>
      )) : <Empty icon="time-outline" title="No holds expiring in the next 6 hours" />}

      <Section>Assigned to you</Section>
      {mine.length ? mine.map((r) => <TripCard key={r.id} r={r} staff />) : <Empty icon="person-outline" title="Nothing assigned to you">Open a new request and tap “Take it”.</Empty>}
    </Screen>
  );
}

export default function Home() {
  const { role } = useApp();
  return role === 'staff' ? <StaffHome /> : <CustomerHome />;
}
