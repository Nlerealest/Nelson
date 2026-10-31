import { useState } from 'react';
import { logYou, nowIso, tellTwizzy, update, useRows, useToast } from '../data';
import { Body, Button, Card, Empty, Field, Loading, Pill, Row, Screen } from '../components/ui';
import { MediaActions, MediaPreview } from '../components/media';
import { useTheme } from '../theme';

const PLAT = { tiktok: 'TikTok', x: 'X', facebook: 'Facebook', instagram: 'Instagram' };
const STATUS = { making: ['Being made', 'warn'], awaiting_approval: ['Needs your OK', 'info'], changes_requested: ['Being changed', 'warn'] };

function Approval({ p, toast }) {
  const t = useTheme();
  const [caption, setCaption] = useState(p.caption || '');
  const [note, setNote] = useState('');
  const waiting = p.status === 'awaiting_approval';
  return (
    <Card>
      <MediaPreview post={p} />
      <MediaActions post={p} toast={toast} />
      <Row>{(p.platforms || []).map((x) => <Pill key={x} label={PLAT[x] || x} tone="info" />)}<Pill label={STATUS[p.status]?.[0] || p.status} tone={STATUS[p.status]?.[1]} /></Row>
      <Body bold style={{ fontSize: 17 }}>{p.title}</Body>
      {p.why ? <Body small muted>{p.why}</Body> : null}
      {p.note ? <Body small color={t.warn}>Your last note: {p.note}</Body> : null}
      {waiting ? (
        <>
          <Field label="Caption" value={caption} onChangeText={setCaption} multiline />
          <Field label="Note to Twizzy (for changes)" value={note} onChangeText={setNote} placeholder="e.g. Shorter, add a Chichewa line, brighter music" />
          <Row>
            <Button icon="checkmark" title="Approve" onPress={async () => {
              await update('posts', p.id, { status: 'approved', caption, decided_at: nowIso() });
              logYou(`You approved “${p.title}”`);
              toast('Approved. It’s in Post, ready for TikTok.');
            }} />
            <Button kind="plain" icon="create-outline" title="Ask for changes" onPress={async () => {
              if (!note.trim()) return toast('Write a short note so Twizzy knows what to change.');
              await update('posts', p.id, { status: 'changes_requested', caption, note: note.trim(), decided_at: nowIso() });
              await tellTwizzy(`Remake "${p.title}". Note: ${note.trim()}`, 'remake_post', p.id);
              toast('Sent to Twizzy for changes.');
            }} />
            <Button kind="danger" title="Reject" onPress={async () => {
              await update('posts', p.id, { status: 'rejected', decided_at: nowIso() });
              logYou(`You rejected “${p.title}”`);
              toast('Rejected.');
            }} />
          </Row>
        </>
      ) : null}
    </Card>
  );
}

export default function Approvals() {
  const toast = useToast();
  const { rows, error, reload } = useRows('posts', { filter: { status: ['making', 'awaiting_approval', 'changes_requested'] } });
  return (
    <Screen onRefresh={reload}>
      <Body muted>Watch each video, save it if you like, then approve it or tell Twizzy what to change. Nothing goes out without your OK.</Body>
      {!rows ? <Loading error={error} /> : rows.length
        ? rows.map((p) => <Approval key={p.id + (p.media_path || '')} p={p} toast={toast} />)
        : <Empty title="All caught up" icon="checkmark-done-circle-outline">New videos from Twizzy wait here for you.</Empty>}
    </Screen>
  );
}
