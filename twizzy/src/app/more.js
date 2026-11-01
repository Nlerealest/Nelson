import { useEffect, useState } from 'react';
import { Alert, Platform, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';
import { db, forgetConnection } from '../supabase';
import { ago, insert, logYou, nowIso, saveConfig, tellTwizzy, update, useConfig, useRows, useToast } from '../data';
import { Body, Button, Card, Chips, Empty, Field, Loading, Pill, Row, Screen, Section } from '../components/ui';
import { useTheme } from '../theme';

const REF_TONE = { new: ['Studying…', 'warn'], studied: ['Studied', 'ok'], used: ['Used', 'ok'] };

function References({ toast }) {
  const { rows, error } = useRows('refs');
  const commands = useRows('commands', { filter: { kind: 'study_ref' } });
  // Takes back a reference added by mistake: the file, the row, and Twizzy's
  // job to study it if it hasn't started yet.
  const removeRef = (r) => {
    const go = async () => {
      if (r.media_path) await db().storage.from('media').remove([r.media_path]);
      for (const c of (commands.rows || []).filter((x) => x.ref_id === r.id && ['queued', 'working'].includes(x.status))) {
        await update('commands', c.id, { status: 'done', result: 'Cancelled: you removed this reference.' });
      }
      const { error: e } = await db().from('refs').delete().eq('id', r.id);
      if (e) return toast('Couldn’t remove it: ' + e.message);
      logYou(`You removed the reference “${r.title || r.url}”`);
      toast('Reference removed.');
    };
    if (Platform.OS === 'web') return go();
    Alert.alert('Remove this reference?', 'Twizzy won’t study or use it.', [{ text: 'Keep it', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: go }]);
  };
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const add = async (row) => {
    const r = await insert('refs', { ...row, note: note.trim() || null, status: 'new' });
    await tellTwizzy(`Study the new reference "${r.title || r.url || 'video'}" and use its style in the next videos.`, 'study_ref', r.id);
    setUrl(''); setNote('');
    toast('Twizzy will study it.');
  };
  return (
    <>
      <Card>
        <Body bold>Add a video you like</Body>
        <Body small muted>Paste a TikTok/Instagram/YouTube link, or upload the video file. Twizzy studies the style (pace, text, music, transitions) and uses it.</Body>
        <Field value={url} onChangeText={setUrl} placeholder="https://www.tiktok.com/@…/video/…" autoCapitalize="none" keyboardType="url" />
        <Field value={note} onChangeText={setNote} placeholder="What do you like about it? (optional)" />
        <Row>
          <Button icon="link" title="Add link" disabled={!/^https?:\/\//.test(url.trim())} onPress={() => add({ kind: 'link', url: url.trim(), title: url.trim().replace(/^https?:\/\/(www\.)?/, '').slice(0, 60) })} />
          <Button kind="plain" icon="cloud-upload-outline" title="Upload video" onPress={async () => {
            const res = await DocumentPicker.getDocumentAsync({ type: ['video/*', 'image/*'], copyToCacheDirectory: true });
            if (res.canceled) return;
            const a = res.assets[0];
            if (a.size && a.size > 50 * 1024 * 1024) return toast('That file is over 50 MB. Try a shorter clip.');
            toast('Uploading…');
            const body = Platform.OS === 'web' ? a.file : await new File(a.uri).arrayBuffer();
            const path = `refs/${Date.now()}-${(a.name || 'reference').replace(/[^\w.-]+/g, '_')}`;
            const { error: e } = await db().storage.from('media').upload(path, body, { contentType: a.mimeType || 'video/mp4' });
            if (e) return toast('Upload failed: ' + e.message);
            await add({ kind: 'file', media_path: path, title: a.name || 'Uploaded video' });
          }} />
        </Row>
      </Card>
      {!rows ? <Loading error={error} /> : rows.map((r) => (
        <Card key={r.id} style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body bold style={{ flex: 1 }}>{r.title || r.url}</Body>
            <Pill label={REF_TONE[r.status]?.[0] || r.status} tone={REF_TONE[r.status]?.[1]} />
          </Row>
          {r.note ? <Body small muted>You: {r.note}</Body> : null}
          {r.learned ? <Body small>Twizzy learned: {r.learned}</Body> : null}
          <Row style={{ justifyContent: 'space-between' }}>
            <Body small muted>{ago(r.created_at)}</Body>
            <Button small kind="danger" icon="trash-outline" title={r.status === 'new' ? 'Cancel' : 'Remove'} onPress={() => removeRef(r)} />
          </Row>
        </Card>
      ))}
    </>
  );
}

function Replies({ toast }) {
  const t = useTheme();
  const { rows, error } = useRows('inbox', { filter: { status: ['pending', 'flagged'] } });
  const [edits, setEdits] = useState({});
  if (!rows) return <Loading error={error} />;
  if (!rows.length) return <Empty title="No comments to answer" icon="chatbubbles-outline">When Twizzy finds comments or reviews, drafted replies wait here.</Empty>;
  return rows.map((x) => {
    const reply = edits[x.id] ?? x.draft_reply ?? '';
    return (
      <Card key={x.id}>
        <Row><Pill label={x.platform || 'comment'} tone="info" />{x.status === 'flagged' ? <Pill label="Needs you" tone="bad" /> : null}<Body small muted>{x.author}</Body></Row>
        <Body>“{x.text}”</Body>
        {x.flag_reason ? <Body small color={t.danger}>{x.flag_reason}</Body> : null}
        <Field label="Reply" value={reply} onChangeText={(v) => setEdits({ ...edits, [x.id]: v })} multiline />
        <Row>
          {x.needs_manual ? (
            <>
              <Button small icon="copy-outline" title="Copy reply" onPress={async () => { await Clipboard.setStringAsync(reply); toast('Reply copied. Paste it on ' + (x.platform || 'the app') + '.'); }} />
              <Button small kind="plain" title="I posted it" onPress={async () => { await update('inbox', x.id, { status: 'sent', final_reply: reply, decided_at: nowIso() }); toast('Marked as replied.'); }} />
            </>
          ) : (
            <Button small title="Approve reply" onPress={async () => {
              await update('inbox', x.id, { status: 'approved', final_reply: reply, decided_at: nowIso() });
              await tellTwizzy(`Send the approved reply to ${x.author}.`, 'reply', x.id);
              toast('Approved. Twizzy will reply.');
            }} />
          )}
          <Button small kind="danger" title="Don’t reply" onPress={async () => { await update('inbox', x.id, { status: 'skipped', decided_at: nowIso() }); }} />
        </Row>
      </Card>
    );
  });
}

function Activity() {
  const t = useTheme();
  const { rows, error } = useRows('activity', { limit: 100 });
  if (!rows) return <Loading error={error} />;
  return (
    <Card style={{ gap: 12 }}>
      {rows.map((a) => (
        <Row key={a.id} wrap={false} style={{ alignItems: 'flex-start' }}>
          <Body small color={a.kind === 'you' ? t.muted : t.primary}>{a.kind === 'you' ? 'You' : 'Twizzy'}</Body>
          <Body small style={{ flex: 1 }}>{a.text} <Body small muted>· {ago(a.at)}</Body></Body>
        </Row>
      ))}
    </Card>
  );
}

function Settings({ toast }) {
  const { config, loaded } = useConfig();
  return loaded ? <SettingsForm toast={toast} s={config.settings || {}} /> : <Loading />;
}

function SettingsForm({ toast, s }) {
  const t = useTheme();
  const [form, setForm] = useState({ tone: s.tone || '', hashtags: s.hashtags || '', avoid: s.avoid || '', apkpure: s.links?.apkpure || '', uptodown: s.links?.uptodown || '' });
  const [email, setEmail] = useState('');
  useEffect(() => { db().auth.getUser().then(({ data }) => setEmail(data.user?.email || '')); }, []);
  const set = async (patch, msg = 'Saved.') => { await saveConfig('settings', patch); toast(msg); };
  return (
    <>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body bold>Twizzy is {s.paused ? 'paused' : 'on'}</Body>
          <Switch value={!s.paused} onValueChange={(on) => { set({ paused: !on }, on ? 'Twizzy is on.' : 'Twizzy is paused.'); logYou(on ? 'You turned Twizzy on' : 'You paused Twizzy'); }} trackColor={{ true: t.primary }} />
        </Row>
        <Body small muted>When paused, Twizzy reads your commands but makes nothing until you turn it back on.</Body>
      </Card>
      <Card>
        <Body bold>Replies to comments</Body>
        <Chips value={s.reply_mode || 'approve'} onChange={(v) => set({ reply_mode: v })} options={[['approve', 'I approve each one'], ['auto_simple', 'Auto-reply to simple ones']]} />
        <Body bold>Music</Body>
        <Chips value={s.music || 'ask'} onChange={(v) => set({ music: v })} options={[['ask', 'Ask me for each video'], ['original', 'Twizzy makes the music']]} />
      </Card>
      <Card>
        <Field label="Tone" value={form.tone} onChangeText={(v) => setForm({ ...form, tone: v })} />
        <Field label="Hashtags" value={form.hashtags} onChangeText={(v) => setForm({ ...form, hashtags: v })} />
        <Field label="Never mention" value={form.avoid} onChangeText={(v) => setForm({ ...form, avoid: v })} />
        <Field label="APKPure link" value={form.apkpure} onChangeText={(v) => setForm({ ...form, apkpure: v })} autoCapitalize="none" />
        <Field label="Uptodown link" value={form.uptodown} onChangeText={(v) => setForm({ ...form, uptodown: v })} autoCapitalize="none" placeholder="Paste when Uptodown approves the app" />
        <Row><Button title="Save" onPress={() => set({ tone: form.tone, hashtags: form.hashtags, avoid: form.avoid, links: { ...(s.links || {}), apkpure: form.apkpure.trim(), uptodown: form.uptodown.trim() } })} /></Row>
      </Card>
      <Card>
        <Body bold>Account</Body>
        <Body small muted>Signed in as {email}</Body>
        <Row>
          <Button small kind="plain" title="Sign out" onPress={() => db().auth.signOut()} />
          <Button small kind="danger" title="Change Supabase project" onPress={async () => { await db().auth.signOut(); await forgetConnection(); toast('Close and reopen Twizzy to connect again.'); }} />
        </Row>
      </Card>
    </>
  );
}

const TABS = [['refs', 'References'], ['replies', 'Replies'], ['activity', 'Activity'], ['settings', 'Settings']];

export default function More() {
  const toast = useToast();
  const params = useLocalSearchParams();
  const tab = params.tab || 'refs';
  const setTab = (v) => router.setParams({ tab: v });
  return (
    <Screen>
      <Chips value={tab} onChange={setTab} options={TABS} />
      <Section>{TABS.find(([k]) => k === tab)?.[1]}</Section>
      {tab === 'refs' && <References toast={toast} />}
      {tab === 'replies' && <Replies toast={toast} />}
      {tab === 'activity' && <Activity />}
      {tab === 'settings' && <Settings toast={toast} />}
    </Screen>
  );
}
