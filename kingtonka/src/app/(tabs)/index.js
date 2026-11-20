// Create: paste a link or upload a video, pick the options, get clips.
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ago, newProject, parseClock, useConfig, useRows, useToast, withCampaign } from '../../data';
import { Body, Button, Card, Empty, Field, Label, Loading, Row, Screen, Section } from '../../components/ui';
import { FALLBACK, label, ProjectForm } from '../../components/settings';
import { ProjectCard } from '../../components/cards';
import { confirmDelete, SelectionBar, useSelection } from '../../components/selection';
import { pickVideo, uploadVideo } from '../../upload';
import { deleteProjects } from '../../deleting';
import { findLink, youtubeId } from '../../links';
import { CampaignPicker } from '../../components/campaigns';
import { GOLD, useTheme } from '../../theme';


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
  const sel = useSelection();
  // The campaign this video is for: picked here, or passed in from a campaign's screen.
  const params = useLocalSearchParams();
  const [pick, setPick] = useState(undefined);
  const campaigns = useRows('kt_campaigns').rows;
  const campaignId = pick !== undefined ? pick : (params.campaign || null);
  const campaign = (campaigns || []).find((c) => c.id === campaignId) || null;
  // The video link in whatever was typed or pasted (YouTube share links, a title with a link…).
  const link = findLink(url);
  const ytId = youtubeId(link);

  const counts = useMemo(() => {
    const c = {};
    for (const clip of clips.rows || []) {
      const k = (c[clip.project_id] ||= { all: 0, posted: 0 });
      k.all += 1;
      if (clip.posted_at) k.posted += 1;
    }
    return c;
  }, [clips.rows]);

  const settings = () => {
    const s = { ...opts };
    if (prompt.trim()) s.prompt = prompt.trim();
    const a = parseClock(from);
    const b = parseClock(to);
    if (a != null && !Number.isNaN(a)) s.range_start = a;
    if (b != null && !Number.isNaN(b)) s.range_end = b;
    return withCampaign(s, campaign);
  };
  const rangeBad = [from, to].some((v) => Number.isNaN(parseClock(v))) || (parseClock(from) != null && parseClock(to) != null && parseClock(to) <= parseClock(from));

  const start = async (src) => {
    try {
      const { parts, ...rest } = src;
      const p = await newProject({ ...rest, settings: { ...settings(), ...(parts ? { parts } : {}) } });
      setUrl(''); setPrompt(''); setFrom(''); setTo(''); setOpts(null);
      toast(campaign ? `Got it. Clipping for ${campaign.name}.` : 'Got it. King Tonka starts within a minute.');
      router.push(`/project/${p.id}`);
    } catch (e) {
      toast('Couldn’t start: ' + e.message);
    }
  };

  const pickFile = async () => {
    const a = await pickVideo();
    if (!a) return;
    try {
      setUpload(`Uploading ${a.name || 'video'}…`);
      const up = await uploadVideo(a, (pct) => setUpload(`Uploading ${a.name || 'video'}… ${pct}%`));
      await start({ path: up.path, title: up.title, parts: up.parts });
    } catch (e) {
      toast('Upload failed: ' + (e.message || e));
    } finally {
      setUpload(null);
    }
  };

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    const found = findLink(text);
    if (found) setUrl(found);
    else toast(text.trim() ? 'What you copied has no video link in it. In YouTube, tap Share → Copy link.' : 'Nothing copied yet. In YouTube, tap Share → Copy link.');
  };
  const chosen = (projects.rows || []).filter((p) => sel.isSelected(p.id));
  const removeVideos = () => {
    const n = chosen.length;
    const nClips = chosen.reduce((a, p) => a + (counts[p.id]?.all || 0), 0);
    confirmDelete(`Delete ${n} video${n === 1 ? '' : 's'}?`,
      `${nClips ? `Their ${nClips} clip${nClips === 1 ? '' : 's'} go too. ` : ''}This frees up space. Copies you saved to your phone or posted online stay.`,
      async () => {
        try {
          await deleteProjects(chosen, clips.rows);
          sel.stop();
          toast(`Deleted ${n} video${n === 1 ? '' : 's'}.`);
        } catch (e) {
          toast('Couldn’t delete: ' + (e.message || e));
        }
      });
  };

  if (!opts) return <Loading />;
  const summary = [
    opts.clips === 'auto' ? 'Auto clips' : `${opts.clips} clips`, label('length', opts.length), opts.aspect, `${label('captions', opts.captions)} captions`,
  ].join(' · ');

  return (
    <View style={{ flex: 1 }}>
    <Screen onRefresh={projects.reload}>
      <AgentCard agent={config.agent} />

      <Card>
        <Body bold style={{ fontSize: 18 }}>Turn a long video into viral clips</Body>
        <Body small muted>Paste a link from YouTube, X, TikTok, Instagram, Twitch, Vimeo, Facebook, Google Drive or Dropbox. Videos up to 10 hours, like full streams. Or upload a video from your phone (up to 800 MB).</Body>
        <Row wrap={false}>
          <View style={{ flex: 1 }}>
            <Field value={url} onChangeText={setUrl} placeholder="Paste a video link here" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          </View>
          <Button kind="plain" icon="clipboard-outline" title="Paste" onPress={paste} />
        </Row>
        {url.trim() && !link ? (
          <Body small color={t.danger}>That isn’t a video link. In YouTube, tap Share → Copy link, then tap Paste.</Body>
        ) : ytId ? (
          <Row wrap={false} style={{ gap: 10 }}>
            <Image source={{ uri: `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg` }} style={{ width: 96, aspectRatio: 16 / 9, borderRadius: 8, backgroundColor: t.input }} />
            <Body small muted style={{ flex: 1 }}>YouTube video ready. Tap Get clips.</Body>
          </Row>
        ) : link && link !== url.trim() ? <Body small muted numberOfLines={1}>Will clip: {link}</Body> : null}

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

        <CampaignPicker value={campaignId} onChange={setPick} />
        {campaign ? (
          <Body small muted>
            Follows {campaign.name}’s rules{campaign.needs_face ? `, keeps ${campaign.creator || 'the creator'} on screen` : ''}
            {campaign.hashtags ? `, adds ${campaign.hashtags} to captions` : ''}.
          </Body>
        ) : null}
        {upload ? <Row><ActivityIndicator color={t.primary} /><Body small muted>{upload}</Body></Row> : null}
        <Row>
          <Button icon="flash" title="Get clips" disabled={!link || rangeBad || !!upload} onPress={() => start({ url: link })} />
          <Button kind="plain" icon="cloud-upload-outline" title="Upload video" disabled={!!upload || rangeBad} onPress={pickFile} />
        </Row>
        <Body small muted>Tip: in the YouTube app, tap Share → King Tonka to send a video here in one tap.</Body>
      </Card>

      <Section right={projects.rows?.length && !sel.selecting
        ? <Button small kind="plain" icon="checkmark-circle-outline" title="Select" onPress={() => sel.start()} /> : null}>Your videos</Section>
      {projects.error ? <Loading error={projects.error} /> : !projects.rows ? <Loading /> : projects.rows.length ? (
        projects.rows.map((p) => (
          <ProjectCard key={p.id} project={p} clipCount={counts[p.id]?.all} postedCount={counts[p.id]?.posted}
            selecting={sel.selecting} selected={sel.isSelected(p.id)} onToggle={sel.toggle}
            onLongPress={sel.selecting ? undefined : (id) => sel.start([id])} />
        ))
      ) : (
        <Empty icon="film-outline" title="No videos yet">Paste a link above. King Tonka downloads it, listens to every word, and Claude picks the moments most likely to go viral. Clips show up in about 10–30 minutes, or 1½–3 hours for a 10-hour stream.</Empty>
      )}
      {sel.selecting ? <View style={{ height: 110 }} /> : null}
    </Screen>
    {sel.selecting ? (
      <SelectionBar count={chosen.length} noun="video" onDone={sel.stop} onDelete={removeVideos}
        allLabel={chosen.length === (projects.rows || []).length ? 'Select none' : 'Select all'}
        onAll={() => sel.set(chosen.length === (projects.rows || []).length ? [] : (projects.rows || []).map((p) => p.id))} />
    ) : null}
    </View>
  );
}
