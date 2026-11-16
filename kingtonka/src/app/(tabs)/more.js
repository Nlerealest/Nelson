// Defaults, talking to King Tonka, activity, and account.
import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../supabase';
import { ago, ask, saveConfig, useConfig, useRows, useToast } from '../../data';
import { Body, Button, Card, Chips, Field, Loading, Pill, Row, Screen, Section } from '../../components/ui';
import { FALLBACK, ProjectForm } from '../../components/settings';
import { useTheme } from '../../theme';

const CMD_TONE = { queued: ['Waiting', 'info'], working: ['Working', 'warn'], done: ['Done', 'ok'], failed: ['Problem', 'bad'] };

function Defaults({ toast }) {
  const { config, loaded } = useConfig();
  const [edited, setValue] = useState(null);
  const value = edited || (loaded ? { ...FALLBACK, ...(config.defaults || {}) } : null);
  if (!value) return <Loading />;
  return (
    <Card>
      <Body bold>Your default options</Body>
      <Body small muted>Every new video starts with these. You can still change them for each video.</Body>
      <ProjectForm value={value} onChange={setValue} />
      <Row><Button icon="save-outline" title="Save defaults" onPress={async () => { await saveConfig('defaults', value); toast('Defaults saved.'); }} /></Row>
    </Card>
  );
}

function Talk({ toast }) {
  const commands = useRows('kt_commands', { limit: 8 });
  const [text, setText] = useState('');
  return (
    <>
      <Card>
        <Row><Ionicons name="sparkles" size={18} color={useTheme().primary} /><Body bold>Ask King Tonka</Body></Row>
        <Field value={text} onChangeText={setText} multiline placeholder="e.g. Which of my clips should I post first today? · Write 3 other hooks for my best clip" />
        <Row><Button icon="send" title="Send" disabled={!text.trim()} onPress={async () => {
          try { await ask('message', text.trim()); setText(''); toast('Sent. The answer shows below in a few minutes.'); } catch (e) { toast('Couldn’t send: ' + e.message); }
        }} /></Row>
      </Card>
      {(commands.rows || []).map((c) => (
        <Card key={c.id} style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Pill label={CMD_TONE[c.status]?.[0] || c.status} tone={CMD_TONE[c.status]?.[1]} />
            <Body small muted>{ago(c.created_at)}</Body>
          </Row>
          <Body numberOfLines={3}>{c.text}</Body>
          {c.result ? <Body small muted>↳ {c.result}</Body> : null}
        </Card>
      ))}
    </>
  );
}

function Activity() {
  const t = useTheme();
  const { rows } = useRows('kt_activity', { limit: 30 });
  return (
    <Card style={{ gap: 12 }}>
      {(rows || []).length ? rows.map((a) => (
        <View key={a.id} style={{ flexDirection: 'row', gap: 10 }}>
          <Ionicons name={a.kind === 'you' ? 'person-circle-outline' : 'sparkles-outline'} size={18} color={a.kind === 'you' ? t.muted : t.primary} />
          <View style={{ flex: 1 }}>
            <Body small>{a.text}</Body>
            <Body small muted>{ago(a.at)}</Body>
          </View>
        </View>
      )) : <Body muted small>King Tonka’s work shows up here.</Body>}
    </Card>
  );
}

export default function More() {
  const toast = useToast();
  const [tab, setTab] = useState('talk');
  return (
    <Screen>
      <Chips options={[['talk', 'Ask'], ['defaults', 'Defaults'], ['activity', 'Activity'], ['account', 'Account']]} value={tab} onChange={setTab} />
      {tab === 'talk' ? <Talk toast={toast} /> : null}
      {tab === 'defaults' ? <Defaults toast={toast} /> : null}
      {tab === 'activity' ? <Activity /> : null}
      {tab === 'account' ? (
        <>
          <Card>
            <Body bold>How King Tonka works</Body>
            <Body small>1. You paste a link or upload a video.{'\n'}2. King Tonka downloads it and writes down every word with its timing.{'\n'}3. Claude reads the whole thing and picks the moments most likely to go viral, scoring each for hook, flow, value and trend.{'\n'}4. Each clip is cut, reframed to follow the speaker, captioned word by word, and sent back to your phone.</Body>
            <Body small muted>It runs on GitHub’s servers with your Claude plan, so it keeps working when your phone is off.</Body>
          </Card>
          <Section>Account</Section>
          <Row>
            <Button kind="plain" icon="log-out-outline" title="Sign out" onPress={() => db().auth.signOut()} />
          </Row>
        </>
      ) : null}
    </Screen>
  );
}
