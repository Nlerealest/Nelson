import { useState } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ago, logYou, nowIso, update, useRows, useToast } from '../data';
import { Body, Button, Card, Empty, Field, Loading, Pill, Row, Screen, Section } from '../components/ui';
import { MediaActions, MediaPreview } from '../components/media';
import { useTheme } from '../theme';

const PLAT = { tiktok: 'TikTok', x: 'X', facebook: 'Facebook', instagram: 'Instagram' };
const platformOf = (url) => (/tiktok/.test(url) ? 'tiktok' : /x\.com|twitter/.test(url) ? 'x' : /facebook|fb\./.test(url) ? 'facebook' : /instagram/.test(url) ? 'instagram' : 'link');

function Ready({ p, toast }) {
  const t = useTheme();
  const [link, setLink] = useState('');
  return (
    <Card>
      <MediaPreview post={p} />
      <Row>{(p.platforms || []).map((x) => <Pill key={x} label={PLAT[x] || x} tone="info" />)}{p.scheduled_for ? <Pill label={'Post on ' + p.scheduled_for} tone="warn" /> : null}</Row>
      <Body bold style={{ fontSize: 17 }}>{p.title}</Body>
      <Body small muted>1. Save or share the video  2. Copy the caption  3. Post it on TikTok  4. Mark it posted</Body>
      <MediaActions post={p} toast={toast} />
      <Card style={{ backgroundColor: t.input, gap: 8 }}>
        <Body selectable small>{p.caption}</Body>
        <Row><Button small kind="plain" icon="copy-outline" title="Copy caption" onPress={async () => { await Clipboard.setStringAsync(p.caption || ''); toast('Caption copied.'); }} /></Row>
      </Card>
      <Body small muted>If the video uses the computer voice, turn on TikTok’s “AI-generated content” label.</Body>
      <Field value={link} onChangeText={setLink} placeholder="Paste the post’s link (optional)" autoCapitalize="none" keyboardType="url" />
      <Row>
        <Button icon="checkmark-circle-outline" title="Mark as posted" onPress={async () => {
          const l = link.trim();
          await update('posts', p.id, { status: 'posted', posted_at: nowIso(), links: l ? { ...(p.links || {}), [platformOf(l)]: l } : p.links || {} });
          logYou(`You posted “${p.title}”`);
          toast('Marked as posted. Nice!');
        }} />
      </Row>
    </Card>
  );
}

export default function Post() {
  const toast = useToast();
  const ready = useRows('posts', { filter: { status: ['approved', 'scheduled'] } });
  const done = useRows('posts', { filter: { status: 'posted' }, limit: 30 });
  return (
    <Screen onRefresh={() => Promise.all([ready.reload(), done.reload()])}>
      {!ready.rows ? <Loading error={ready.error} /> : ready.rows.length
        ? ready.rows.map((p) => <Ready key={p.id} p={p} toast={toast} />)
        : <Empty title="Nothing to post yet" icon="paper-plane-outline">Approved videos appear here with their caption, ready for TikTok and X.</Empty>}
      <Section>Posted</Section>
      {(done.rows || []).map((p) => (
        <Card key={p.id} style={{ gap: 6, paddingVertical: 12 }}>
          <Body bold>{p.title}</Body>
          <Body small muted>Posted {ago(p.posted_at)}</Body>
          <Row>
            {Object.entries(p.links || {}).map(([k, u]) => <Button key={k} small kind="plain" icon="open-outline" title={'View on ' + (PLAT[k] || k)} onPress={() => Linking.openURL(u)} />)}
            <MediaActions post={p} toast={toast} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
