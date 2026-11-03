import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ago, tellTwizzy, useConfig, useRows, useToast } from '../data';
import { Body, Button, Card, Field, Pill, Row, Screen, Section } from '../components/ui';
import { GOLD, useTheme } from '../theme';

const CMD_TONE = { queued: ['Waiting', 'info'], working: ['Working', 'warn'], done: ['Done', 'ok'], failed: ['Problem', 'bad'] };
const QUICK = [
  ['New ideas now', 'ideas_now', 'Come up with 4–5 fresh video ideas for this week, based on what is happening now.'],
  ['Make a TikTok today', 'message', 'Pick the best idea that has not been made yet, make it as a vertical TikTok video of 45 s to 1:45 and put it in Approvals.'],
];

function AgentCard({ agent, paused }) {
  const state = paused ? 'paused' : agent?.state || 'idle';
  const label = { working: 'Working', idle: 'Ready', error: 'Needs attention', paused: 'Paused' }[state] || state;
  return (
    <Card hero>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          {state === 'working' ? <ActivityIndicator color={GOLD} /> : <Ionicons name={state === 'error' ? 'alert-circle' : state === 'paused' ? 'pause-circle' : 'sparkles'} size={20} color={GOLD} />}
          <Body bold color="#fff" style={{ fontSize: 18 }}>Twizzy · {label}</Body>
        </Row>
        {agent?.at ? <Body small color="rgba(255,255,255,.7)">{ago(agent.at)}</Body> : null}
      </Row>
      <Body color="rgba(255,255,255,.9)">{paused ? 'Twizzy is paused. Turn it back on in More → Settings.' : agent?.message || 'Waiting for your first command.'}</Body>
    </Card>
  );
}

function Tile({ label, count, icon, to }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => router.push(to)} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.8 : 1 })}>
      <Card style={{ alignItems: 'flex-start', gap: 4, padding: 14 }}>
        <Ionicons name={icon} size={20} color={count ? t.primary : t.muted} />
        <Body bold style={{ fontSize: 22 }}>{count ?? '–'}</Body>
        <Body small muted>{label}</Body>
      </Card>
    </Pressable>
  );
}

export default function Home() {
  const t = useTheme();
  const toast = useToast();
  const { config, reload } = useConfig();
  const commands = useRows('commands', { limit: 6 });
  const activity = useRows('activity', { limit: 8 });
  const approvals = useRows('posts', { filter: { status: ['awaiting_approval', 'needs_song'] }, limit: 50 });
  const songs = (approvals.rows || []).filter((p) => p.status === 'needs_song');
  const ready = useRows('posts', { filter: { status: 'approved' }, limit: 50 });
  const ideas = useRows('concepts', { filter: { status: 'proposed' }, limit: 50 });
  const [text, setText] = useState('');

  const send = async (msg, kind = 'message') => {
    try {
      await tellTwizzy(msg, kind);
      toast('Sent. Twizzy starts within a minute.');
      return true;
    } catch (e) {
      toast('Couldn’t send: ' + e.message);
      return false;
    }
  };

  return (
    <Screen onRefresh={() => Promise.all([reload(), commands.reload(), activity.reload()])}>
      <AgentCard agent={config.agent} paused={config.settings?.paused} />

      <Row wrap={false} style={{ gap: 10 }}>
        <Tile label="To approve" count={approvals.rows?.length} icon="checkmark-done-circle-outline" to="/approvals" />
        <Tile label="Ready to post" count={ready.rows?.length} icon="paper-plane-outline" to="/post" />
        <Tile label="New ideas" count={ideas.rows?.length} icon="bulb-outline" to="/ideas" />
      </Row>

      <Card>
        <Body bold>Tell Twizzy</Body>
        <Field value={text} onChangeText={setText} multiline placeholder="e.g. Make a 1-minute TikTok about saving for Christmas, with a Chichewa line" />
        <Row>
          <Button icon="send" title="Send" disabled={!text.trim()} onPress={async () => { if (await send(text.trim())) setText(''); }} />
        </Row>
        <Row>
          {QUICK.map(([label, kind, msg]) => <Button key={label} small kind="soft" title={label} onPress={() => send(msg, kind)} />)}
        </Row>
      </Card>

      {songs.length ? (
        <Card style={{ backgroundColor: t.warnSoft, borderColor: t.warnSoft }}>
          <Row><Ionicons name="musical-notes" size={18} color={t.warn} /><Body bold color={t.warn}>Twizzy needs your choices</Body></Row>
          <Body>{songs.length === 1 ? `Pick the voice and song for “${songs[0].title}”.` : `${songs.length} videos are waiting for you to pick a voice and song.`}</Body>
          <Row><Button small title="Choose voice and song" icon="arrow-forward" onPress={() => router.push('/approvals')} /></Row>
        </Card>
      ) : null}

      {config.request?.open ? (
        <Card style={{ backgroundColor: t.warnSoft, borderColor: t.warnSoft }}>
          <Row><Ionicons name="hand-left-outline" size={18} color={t.warn} /><Body bold color={t.warn}>Twizzy asks</Body></Row>
          <Body>{config.request.text}</Body>
          <Row><Button small kind="plain" title="Add a reference" icon="add" onPress={() => router.push('/more?tab=refs')} /></Row>
        </Card>
      ) : null}

      <Section>Your commands</Section>
      {(commands.rows || []).length ? commands.rows.map((c) => (
        <Card key={c.id} style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Pill label={CMD_TONE[c.status]?.[0] || c.status} tone={CMD_TONE[c.status]?.[1]} />
            <Body small muted>{ago(c.created_at)}</Body>
          </Row>
          <Body numberOfLines={3}>{c.text}</Body>
          {c.result ? <Body small muted>↳ {c.result}</Body> : null}
        </Card>
      )) : <Body muted small>Nothing yet. Type above, or tap Make it on an idea.</Body>}

      <Section>Activity</Section>
      <Card style={{ gap: 12 }}>
        {(activity.rows || []).length ? activity.rows.map((a) => (
          <View key={a.id} style={{ flexDirection: 'row', gap: 10 }}>
            <Ionicons name={a.kind === 'you' ? 'person-circle-outline' : 'sparkles-outline'} size={18} color={a.kind === 'you' ? t.muted : t.primary} />
            <View style={{ flex: 1 }}>
              <Body small>{a.text}</Body>
              <Body small muted>{ago(a.at)}</Body>
            </View>
          </View>
        )) : <Body muted small>Twizzy’s work shows up here.</Body>}
      </Card>
    </Screen>
  );
}
