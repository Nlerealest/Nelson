import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp, useRows } from '../../data';
import { Button, Chips, Empty, Field, Loading, Row, Screen } from '../../components/ui';
import { TripCard } from '../../components/trip';
import { LiveDot } from '../../components/brand';

const STAFF_FILTERS = [
  ['open', 'Open'], ['new', 'New'], ['waiting', 'Waiting on customer'], ['paid', 'Check payment'],
  ['confirmed', 'To ticket'], ['ticketed', 'Ticketed'], ['closed', 'Closed'],
];
const GROUPS = {
  open: ['new', 'quoting', 'quoted', 'accepted', 'paid', 'confirmed'],
  new: ['new', 'quoting'], waiting: ['quoted', 'accepted'], paid: ['paid'], confirmed: ['confirmed'],
  ticketed: ['ticketed'], closed: ['completed', 'cancelled'],
};

// Unread = customer (or staff) messages newer than the other side's last reply.
function useUnread(staff) {
  const { rows } = useRows('messages');
  return useMemo(() => {
    const last = {};
    for (const m of [...(rows || [])].reverse()) {
      const mineSide = m.from_staff === staff;
      if (mineSide) last[m.request_id] = 0;
      else last[m.request_id] = (last[m.request_id] || 0) + 1;
    }
    return last;
  }, [rows, staff]);
}

export default function Trips() {
  const { role } = useApp();
  const staff = role === 'staff';
  const params = useLocalSearchParams();
  const [filter, setFilter] = useState(params.f && GROUPS[params.f] ? params.f : 'open');
  const [q, setQ] = useState('');
  const { rows, error, reload } = useRows('requests');
  const unread = useUnread(staff);

  const list = useMemo(() => {
    let l = rows || [];
    if (staff) l = l.filter((r) => GROUPS[filter].includes(r.status));
    const s = q.trim().toLowerCase();
    if (s) l = l.filter((r) => [r.ref, r.customer_name, r.customer_phone, r.origin, r.destination, r.pnr].some((v) => String(v || '').toLowerCase().includes(s)));
    // Most urgent first for staff: unread messages, then oldest waiting.
    return staff ? [...l].sort((a, b) => (unread[b.id] || 0) - (unread[a.id] || 0)) : l;
  }, [rows, staff, filter, q, unread]);

  return (
    <Screen onRefresh={reload}>
      <Row style={{ justifyContent: 'space-between' }}><LiveDot />{!staff ? <Button small icon="add" title="New request" onPress={() => router.push('/new')} /> : null}</Row>
      {staff ? <Chips options={STAFF_FILTERS} value={filter} onChange={setFilter} /> : null}
      {staff || (rows?.length || 0) > 4 ? <Field value={q} onChangeText={setQ} placeholder="Search name, phone, ref, PNR, city" autoCapitalize="none" /> : null}
      {error ? <Loading error={error} /> : !rows ? <Loading /> : list.length ? (
        list.map((r) => <TripCard key={r.id} r={r} staff={staff} unread={unread[r.id]} />)
      ) : (
        <Empty icon="airplane-outline" title={staff ? 'Nothing here' : 'No trips yet'}>
          {staff ? 'New requests appear here the moment customers send them.' : 'Tap “New request” and tell us where you want to go. We reply with fares right here.'}
        </Empty>
      )}
    </Screen>
  );
}
