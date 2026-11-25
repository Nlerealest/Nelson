import { useState } from 'react';
import { Pressable, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { db } from '../../supabase';
import { useMyProfile, useRows, useToast } from '../../data';
import { useTheme } from '../../theme';
import { KINDS, parseDate, passportCheck, PLACES } from '../../format';
import { Body, Button, Card, Chips, Field, Row, Screen, Section } from '../../components/ui';

function Counter({ label, hint, value, onChange, min = 0 }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between' }} wrap={false}>
      <Body style={{ flex: 1 }}>{label} <Body small muted>{hint}</Body></Body>
      <Row wrap={false}>
        <Button small kind="plain" title="−" disabled={value <= min} onPress={() => onChange(value - 1)} />
        <Body bold style={{ minWidth: 22, textAlign: 'center' }} color={t.text}>{value}</Body>
        <Button small kind="plain" title="+" disabled={value >= 9} onPress={() => onChange(value + 1)} />
      </Row>
    </Row>
  );
}

function PlaceField({ label, value, onChange }) {
  const t = useTheme();
  const s = value.trim().toLowerCase();
  const hits = s.length >= 1 ? PLACES.filter((p) => p.toLowerCase().includes(s) && p !== value).slice(0, 4) : [];
  return (
    <>
      <Field label={label} value={value} onChangeText={onChange} placeholder="City or airport" />
      {hits.length ? (
        <Row>
          {hits.map((p) => (
            <Pressable key={p} onPress={() => onChange(p)} style={{ borderWidth: 1, borderColor: t.line, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Body small>{p}</Body>
            </Pressable>
          ))}
        </Row>
      ) : null}
    </>
  );
}

function RequestForm({ initialKind, deal }) {
  const t = useTheme();
  const toast = useToast();
  const profile = useMyProfile();
  const [kind, setKind] = useState(deal ? 'flight' : initialKind || 'flight');
  const [tripType, setTripType] = useState('return');
  const [origin, setOrigin] = useState('Lilongwe (LLW)');
  const [destination, setDestination] = useState('');
  const [depart, setDepart] = useState('');
  const [ret, setRet] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [cabin, setCabin] = useState('economy');
  const [flexible, setFlexible] = useState(false);
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState(deal ? `I’m interested in the deal: ${deal.title}${deal.route ? ` (${deal.route})` : ''}` : '');

  const flight = kind === 'flight';
  const departISO = parseDate(depart);
  const returnISO = parseDate(ret);
  const today = new Date().toISOString().slice(0, 10);
  const problems = [];
  if (flight) {
    if (!origin.trim() || !destination.trim()) problems.push('Enter where you fly from and to.');
    if (!departISO) problems.push('Enter the departure date, e.g. 20/12/2026.');
    else if (departISO < today) problems.push('The departure date is in the past.');
    if (tripType === 'return' && !returnISO) problems.push('Enter the return date, or choose One way.');
    if (departISO && returnISO && returnISO < departISO) problems.push('The return date is before the departure date.');
    if (infants > adults) problems.push('Each infant must travel with an adult.');
  } else if (!notes.trim() && !destination.trim()) problems.push('Tell us what you need.');
  const pass = flight && departISO ? passportCheck(profile?.passport_expiry, departISO) : null;

  const send = async () => {
    const row = {
      kind, trip_type: flight ? tripType : null, origin: flight ? origin.trim() : null, destination: destination.trim() || null,
      depart_on: departISO, return_on: flight && tripType === 'return' ? returnISO : null,
      adults, children, infants, cabin: flight ? cabin : null, flexible, budget: budget.trim() || null, notes: notes.trim() || null,
      customer_name: profile?.full_name || null, customer_phone: profile?.phone || null,
    };
    const { data, error } = await db().from('requests').insert(row).select('id').single();
    if (error) { toast(error.message); return; }
    toast('Sent! An agent will reply with fares here.');
    setDestination(''); setDepart(''); setRet(''); setNotes(''); setBudget('');
    router.push(`/request/${data.id}`);
  };

  return (
    <Screen>
      <Chips options={KINDS} value={kind} onChange={setKind} />
      {flight ? (
        <>
          <Card>
            <Chips options={[['return', 'Return'], ['oneway', 'One way']]} value={tripType} onChange={setTripType} />
            <PlaceField label="From" value={origin} onChange={setOrigin} />
            <PlaceField label="To" value={destination} onChange={setDestination} />
            <Field label="Departure date" value={depart} onChangeText={setDepart} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" />
            {tripType === 'return' ? <Field label="Return date" value={ret} onChangeText={setRet} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" /> : null}
            <Row style={{ justifyContent: 'space-between' }}>
              <Body>My dates are flexible (± 3 days)</Body>
              <Switch value={flexible} onValueChange={setFlexible} trackColor={{ true: t.primary }} />
            </Row>
          </Card>
          <Section>Travellers</Section>
          <Card>
            <Counter label="Adults" hint="12+" value={adults} onChange={setAdults} min={1} />
            <Counter label="Children" hint="2–11" value={children} onChange={setChildren} />
            <Counter label="Infants" hint="under 2" value={infants} onChange={setInfants} />
            <Chips options={[['economy', 'Economy'], ['premium', 'Premium'], ['business', 'Business']]} value={cabin} onChange={setCabin} />
          </Card>
        </>
      ) : (
        <Card>
          <Field label={kind === 'visa' ? 'Which country is the visa for?' : 'Destination'} value={destination} onChangeText={setDestination} />
          <Field label="Travel date (if you know it)" value={depart} onChangeText={setDepart} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" />
          <Counter label="People" value={adults} onChange={setAdults} min={1} />
        </Card>
      )}
      <Card>
        <Field label="Budget (optional)" value={budget} onChangeText={setBudget} placeholder="e.g. MK 2,000,000" />
        <Field label={flight ? 'Anything else? (optional)' : 'Tell us what you need'} value={notes} onChangeText={setNotes} multiline
          placeholder={kind === 'visa' ? 'Purpose of travel, your nationality, any visa you had before…' : flight ? 'Preferred airline, extra bags, wheelchair, student fare…' : 'Where, when, hotels, transfers…'} />
      </Card>
      {pass && pass.tone !== 'ok' ? (
        <Card style={{ backgroundColor: pass.tone === 'bad' ? t.dangerSoft : t.warnSoft, borderColor: 'transparent' }}>
          <Body small>{pass.text}</Body>
        </Card>
      ) : null}
      {problems.length ? <Body small muted>{problems[0]}</Body> : null}
      <Button title="Send to Gramaro" icon="paper-plane" disabled={problems.length > 0} onPress={send} />
      <Body small muted style={{ textAlign: 'center' }}>Free to ask. You only pay after you choose a fare.</Body>
    </Screen>
  );
}

// Opened from the home screen's buttons or from a deal: start the form with that.
export default function NewRequest() {
  const params = useLocalSearchParams();
  const { rows: deals } = useRows('deals');
  const deal = params.deal ? (deals || []).find((d) => d.id === params.deal) : null;
  const kind = params.kind ? String(params.kind) : null;
  return <RequestForm key={`${kind}-${deal?.id || ''}`} initialKind={kind} deal={deal} />;
}
