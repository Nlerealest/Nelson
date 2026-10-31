import { useState } from 'react';
import { ago, insert, logYou, nowIso, tellTwizzy, update, useRows, useToast } from '../data';
import { Body, Button, Card, Empty, Field, Loading, Pill, Row, Screen, Section } from '../components/ui';
import { useTheme } from '../theme';

const PLAT = { tiktok: 'TikTok', x: 'X', facebook: 'Facebook', instagram: 'Instagram' };

function Idea({ c, toast }) {
  const t = useTheme();
  const make = async () => {
    await update('concepts', c.id, { status: 'approved', decided_at: nowIso() });
    await tellTwizzy(`Make the idea "${c.title}" into a video and put it in Approvals.`, 'make_idea', c.id);
    logYou(`You asked Twizzy to make “${c.title}”`);
    toast('Twizzy is making it. It will appear in Approvals.');
  };
  const pass = async () => {
    await update('concepts', c.id, { status: 'passed', decided_at: nowIso() });
    toast('Passed.');
  };
  return (
    <Card>
      <Row>{(c.platforms || []).map((p) => <Pill key={p} label={PLAT[p] || p} tone="info" />)}{c.format ? <Body small muted>{c.format}</Body> : null}</Row>
      <Body bold style={{ fontSize: 17 }}>{c.title}</Body>
      {c.hook ? <Body style={{ fontStyle: 'italic', color: t.primary }}>“{c.hook}”</Body> : null}
      {c.pitch ? <Body muted>{c.pitch}</Body> : null}
      <Row>
        <Button icon="color-wand-outline" title="Make it" onPress={make} />
        <Button kind="plain" title="Pass" onPress={pass} />
      </Row>
    </Card>
  );
}

export default function Ideas() {
  const toast = useToast();
  const proposed = useRows('concepts', { filter: { status: 'proposed' } });
  const others = useRows('concepts', { filter: { status: ['approved', 'produced'] }, limit: 30 });
  const [own, setOwn] = useState('');

  return (
    <Screen onRefresh={() => Promise.all([proposed.reload(), others.reload()])}>
      <Body muted>Twizzy brings 4–5 fresh ideas every Monday, based on what’s happening in Malawi and online. Tap Make it and the video lands in Approvals.</Body>
      <Row>
        <Button small kind="soft" icon="refresh" title="New ideas now" onPress={async () => {
          await tellTwizzy('Come up with 4–5 fresh video ideas for this week, based on what is happening now.', 'ideas_now');
          toast('Twizzy is thinking of new ideas.');
        }} />
      </Row>

      {!proposed.rows ? <Loading error={proposed.error} /> : proposed.rows.length
        ? proposed.rows.map((c) => <Idea key={c.id} c={c} toast={toast} />)
        : <Empty title="No new ideas right now" icon="bulb-outline">New ideas arrive every Monday, or tap New ideas now.</Empty>}

      <Section>Your own idea</Section>
      <Card>
        <Field value={own} onChangeText={setOwn} multiline placeholder="e.g. A video about saving for a wedding, funny, 15 seconds" />
        <Row>
          <Button icon="color-wand-outline" title="Make my idea" disabled={own.trim().length < 5} onPress={async () => {
            const text = own.trim();
            const c = await insert('concepts', { title: text.slice(0, 80), pitch: text, status: 'approved', platforms: ['tiktok'], decided_at: nowIso() });
            await tellTwizzy(`Make the owner's own idea "${text}" into a video and put it in Approvals.`, 'make_idea', c.id);
            setOwn('');
            toast('Sent to Twizzy.');
          }} />
        </Row>
      </Card>

      <Section>Made and in progress</Section>
      {(others.rows || []).map((c) => (
        <Card key={c.id} style={{ gap: 4, paddingVertical: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body bold style={{ flex: 1 }}>{c.title}</Body>
            <Pill label={c.status === 'produced' ? 'Made' : 'Making'} tone={c.status === 'produced' ? 'ok' : 'warn'} />
          </Row>
          <Body small muted>{ago(c.decided_at || c.created_at)}</Body>
        </Card>
      ))}
    </Screen>
  );
}
