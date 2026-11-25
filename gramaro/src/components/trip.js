// A trip (request) as a tappable card, used in lists on every tab.
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { balance, day, kindLabel, mk, pax, statusOf, STEPS, tripTitle, when } from '../format';
import { Body, Card, Pill, Row } from './ui';

export function TripCard({ r, staff, unread }) {
  const st = statusOf(r.status);
  const due = balance(r);
  return (
    <Pressable onPress={() => router.push(`/request/${r.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }} wrap={false}>
          <Body bold style={{ flex: 1 }}>{tripTitle(r)}</Body>
          <Pill label={st.label} tone={st.tone} />
        </Row>
        <Body small muted>
          {[r.kind !== 'flight' && kindLabel(r.kind), r.depart_on && day(r.depart_on), r.return_on && `back ${day(r.return_on)}`, pax(r)].filter(Boolean).join(' · ')}
        </Body>
        {staff ? <Body small>{r.customer_name || 'Customer'}{r.customer_phone ? ` · ${r.customer_phone}` : ''}{r.assigned_to ? ` · ${r.assigned_to.split('@')[0]}` : ' · unassigned'}</Body> : null}
        <Row style={{ justifyContent: 'space-between' }}>
          <Body small muted>{r.ref} · {when(r.updated_at)}</Body>
          <Row>
            {unread ? <Pill label={`${unread} new`} tone="accent" /> : null}
            {due > 0 && ['accepted', 'paid'].includes(r.status) ? <Pill label={`${mk(due)} due`} tone="warn" /> : null}
          </Row>
        </Row>
      </Card>
    </Pressable>
  );
}

export function Steps({ status }) {
  const t = useTheme();
  const at = statusOf(status).step;
  if (at < 0) return null;
  return (
    <Row wrap={false} style={{ gap: 0 }}>
      {STEPS.map((s, i) => {
        const done = i < at || status === 'completed' || (status === 'ticketed' && i <= at);
        const now = i === at && !done;
        const c = done ? t.ok : now ? t.accent : t.line;
        return (
          <View key={s} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Row wrap={false} style={{ gap: 0, width: '100%' }}>
              <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : i <= at ? t.ok : t.line }} />
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }}>
                {done ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Body small bold color={now ? '#fff' : t.muted}>{i + 1}</Body>}
              </View>
              <View style={{ flex: 1, height: 2, backgroundColor: i === STEPS.length - 1 ? 'transparent' : i < at ? t.ok : t.line }} />
            </Row>
            <Body small color={now ? t.accent : done ? t.text : t.muted} style={{ fontSize: 11 }}>{s}</Body>
          </View>
        );
      })}
    </Row>
  );
}
