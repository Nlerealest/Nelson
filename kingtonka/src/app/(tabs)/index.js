// Create: paste a link or upload a video, pick the options, get clips.
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../supabase';
import { ago, BUCKET, newProject, parseClock, useConfig, useRows, useToast } from '../../data';
import { Body, Button, Card, Empty, Field, Label, Loading, Row, Screen, Section } from '../../components/ui';
import { FALLBACK, label, ProjectForm } from '../../components/settings';
import { ProjectCard } from '../../components/cards';
import { GOLD, useTheme } from '../../theme';

const MAX_UPLOAD_MB = 50;

function AgentCard({ agent }) {
  const state = agent?.state || 'idle';
  return (
    <Card hero>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          {state === 'working' ? <ActivityIndicator color={GOLD} /> : <Ionicons name={state === 'error' ? 'alert-circle' : 'sparkles'} size={20} color={GOLD} />}
          <Body bold color="#fff" style={{ fontSize: 18 }}>{state === 'working' ? 'Working' : state === 'error' ? 'Needs attention' : 'Ready'}</Body>
        </Row>
        {agent?.at ? <Body small color="rgba(255,255,255,.7)">{ago(agent.at)}</Body> : null}
      </Row>
      <Body color="rgba(255,255,255,.9)">{agent?.message || 'Paste a video link to get your first clips.'}</Body>
    </Card>
  );
}

const looksLikeLink = (s) => /^https?:\/\/\S+\.\S+/i.test(s.trim());

export default function Create() {
  const t = useTheme();
  const toast = useToast();
  const { config, loaded } = useConfig();
  const projects = useRows('kt_projects', { limit: 50 });
  const clips = useRows('kt_clips');
  const [url, setUrl] = useState('');
  const [edited, setOpts] = useState(null);
  // Start from your saved defaults.
  const opts = edited || (loaded ? { ...FALLBACK, ...(config.defaults || {}) } : null);
  const [showOpts, setShowOpts] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [upload, setUpload] = useState(null); // progress text while uploading

  const counts = useMemo(() => {
    const c = {};
    for (const clip of clips.rows || []) c[clip.project_id] = (c[clip.project_id] || 0) + 1;
    return c;
  }, [clips.rows]);

  const settings = () => {
    const s = { ...opts };
    if (prompt.trim()) s.prompt = prompt.trim();
    const a = parseClock(from);
    const b = parseClock(to);
    if (a != null && !Number.isNaN(a)) s.range_start = a;
    if (b != null && !Number.isNaN(b)) s.range_end = b;
    return s;
  };
  const rangeBad = [from, to].some((v) => Number.isNaN(parseClock(v))) || (parseClock(from) != null && parseClock(to) != null && parseClock(to) <= parseClock(from));

  const start = async (src) => {
    try {
      const p = await newProject({ ...src, settings: settings() });
      setUrl(''); setPrompt(''); setFrom(''); setTo(''); setOpts(null);
      toast('Got it. King Tonka starts within a minute.');
      router.push(`/project/${p.id}`);
    } catch (e) {
      toast('Couldn’t start: ' + e.message);
    }
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['video/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0];
    if (a.size && a.size > MAX_UPLOAD_MB * 1024 * 1024) {
      return toast(`That file is over ${MAX_UPLOAD_MB} MB. Paste a link instead (YouTube, Google Drive, Dropbox…).`);
    }
    try {
      setUpload(`Uploading ${a.name || 'video'}…`);
      const body = Platform.OS === 'web' ? a.file : await new File(a.uri).arrayBuffer();
      const path = `uploads/${Date.now()}-${(a.name || 'video.mp4').replace(/[^\w.-]+/g, '_')}`;
      const { error } = await db().storage.from(BUCKET).upload(path, body, { contentType: a.mimeType || 'video/mp4' });
      if (error) throw error;
      await start({ path, title: (a.name || 'Uploaded video').replace(/\.[a-z0-9]+$/i, '') });
    } catch (e) {
      toast('Upload failed: ' + (e.message || e));
    } finally {
      setUpload(null);
    }
  };

  if (!opts) return <Loading />;
  const summary = [
    opts.clips === 'auto' ? 'Auto clips' : `${opts.clips} clips`, label('length', opts.length), opts.aspect, `${label('captions', opts.captions)} captions`,
  ].join(' · ');

  return (
    <Screen onRefresh={projects.reload}>
      <AgentCard agent={config.agent} />

      <Card>
        <Body bold style={{ fontSize: 18 }}>Turn a long video into viral clips</Body>
        <Body small muted>Paste a link from YouTube, X, TikTok, Instagram, Twitch, Vimeo, Facebook, Google Drive or Dropbox. Or upload a video from your phone.</Body>
        <Row wrap={false}>
          <View style={{ flex: 1 }}>
            <Field value={url} onChangeText={setUrl} placeholder="https://youtube.com/watch?v=…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          </View>
          <Button kind="plain" icon="clipboard-outline" title="Paste" onPress={async () => setUrl((await Clipboard.getStringAsync()).trim())} />
        </Row>

        <Pressable onPress={() => setShowOpts(!showOpts)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
          <Ionicons name="options-outline" size={16} color={t.primary} />
          <Body small bold color={t.primary} style={{ flex: 1 }}>{showOpts ? 'Hide options' : summary}</Body>
          <Ionicons name={showOpts ? 'chevron-up' : 'chevron-down'} size={16} color={t.primary} />
        </Pressable>

        {showOpts ? (
          <View style={{ gap: 12 }}>
            <ProjectForm value={opts} onChange={setOpts} />
            <Field label="What should King Tonka look for? (optional)" value={prompt} onChangeText={setPrompt} multiline
              placeholder="e.g. the funniest moments · everything about money · only the guest’s stories" />
            <View style={{ gap: 6 }}>
              <Label>Only use part of the video (optional)</Label>
              <Row wrap={false}>
                <View style={{ flex: 1 }}><Field value={from} onChangeText={setFrom} placeholder="From 0:00" keyboardType="numbers-and-punctuation" /></View>
                <View style={{ flex: 1 }}><Field value={to} onChangeText={setTo} placeholder="To 45:00" keyboardType="numbers-and-punctuation" /></View>
              </Row>
              {rangeBad ? <Body small color={t.danger}>Use minutes:seconds, like 12:30, and make “To” later than “From”.</Body> : null}
            </View>
          </View>
        ) : (
          <Field value={prompt} onChangeText={setPrompt} placeholder="What to look for (optional): funny moments, money tips…" />
        )}

        {upload ? <Row><ActivityIndicator color={t.primary} /><Body small muted>{upload}</Body></Row> : null}
        <Row>
          <Button icon="flash" title="Get clips" disabled={!looksLikeLink(url) || rangeBad || !!upload} onPress={() => start({ url: url.trim() })} />
          <Button kind="plain" icon="cloud-upload-outline" title="Upload video" disabled={!!upload || rangeBad} onPress={pickFile} />
        </Row>
      </Card>

      <Section>Your videos</Section>
      {projects.error ? <Loading error={projects.error} /> : !projects.rows ? <Loading /> : projects.rows.length ? (
        projects.rows.map((p) => <ProjectCard key={p.id} project={p} clipCount={counts[p.id]} />)
      ) : (
        <Empty icon="film-outline" title="No videos yet">Paste a link above. King Tonka downloads it, listens to every word, and Claude picks the moments most likely to go viral. Clips show up here in about 10–30 minutes.</Empty>
      )}
    </Screen>
  );
}
