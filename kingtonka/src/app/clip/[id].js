// One clip: watch it, see why it scored what it did, post it, and edit it
// (trim, captions, framing, caption words, or ask Claude for any change).
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ask, clock, CLIP_STATUS, logYou, remove, removeFiles, update, useRow, useToast } from '../../data';
import { Body, Button, Card, Chips, Empty, Field, Label, Loading, Pill, Progress, Row, Screen, Section } from '../../components/ui';
import { ClipActions, ClipPlayer } from '../../components/media';
import { ScoreBadge } from '../../components/cards';
import { FALLBACK, StyleForm } from '../../components/settings';
import { scoreColor, useTheme } from '../../theme';

const SCORE_NAMES = [['hook', 'Hook', 'Grabs attention in the first 3 seconds'], ['flow', 'Flow', 'A complete thought that makes sense alone'],
  ['value', 'Value', 'A laugh, a tip, a story or a quotable line'], ['trend', 'Trend', 'Relatable and worth sharing right now']];

function Scores({ clip }) {
  const t = useTheme();
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Body bold style={{ fontSize: 18 }}>Viral score</Body>
        <ScoreBadge score={clip.score} big />
      </Row>
      {SCORE_NAMES.map(([k, name, hint]) => {
        const v = clip.scores?.[k];
        if (v == null) return null;
        return (
          <View key={k} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body small bold>{name}</Body>
              <Body small bold color={scoreColor(v, t)}>{v}</Body>
            </Row>
            <Progress percent={v} color={scoreColor(v, t)} />
            <Body small muted style={{ fontSize: 12 }}>{hint}</Body>
          </View>
        );
      })}
      {clip.why ? <Body small>{clip.why}</Body> : null}
    </Card>
  );
}

// Splits words into short caption lines for editing.
function toLines(words) {
  const lines = [];
  let cur = [];
  for (const w of words || []) {
    cur.push(w);
    if (cur.length >= 7 || /[.?!,]$/.test(w[2])) { lines.push(cur); cur = []; }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

// Puts edited text back on the original timing of each line.
function fromLines(lines, texts) {
  const out = [];
  lines.forEach((line, i) => {
    const tokens = (texts[i] ?? line.map((w) => w[2]).join(' ')).split(/\s+/).filter(Boolean);
    if (!tokens.length) return;
    if (tokens.length === line.length) {
      tokens.forEach((tok, k) => out.push([line[k][0], line[k][1], tok]));
      return;
    }
    const s = line[0][0];
    const e = line[line.length - 1][1];
    const step = (e - s) / tokens.length;
    tokens.forEach((tok, k) => out.push([+(s + k * step).toFixed(2), +(s + (k + 1) * step).toFixed(2), tok]));
  });
  return out;
}

function TrimSide({ title, value, onChange }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Label>{title}</Label>
      <Body bold style={{ fontSize: 20 }}>{clock(value)}</Body>
      <Row>
        {[-5, -1, 1, 5].map((d) => <Button key={d} small kind="plain" title={`${d > 0 ? '+' : ''}${d}s`} onPress={() => onChange(Math.max(0, +(value + d).toFixed(1)))} />)}
      </Row>
    </View>
  );
}

function Trim({ start, end, setStart, setEnd, original }) {
  return (
    <View style={{ gap: 10 }}>
      <Row wrap={false} style={{ alignItems: 'flex-start', gap: 12 }}>
        <TrimSide title="Starts at" value={start} onChange={setStart} />
        <TrimSide title="Ends at" value={end} onChange={setEnd} />
      </Row>
      <Body small muted>
        Length {clock(end - start)}
        {original && (Math.abs(original[0] - start) > 0.05 || Math.abs(original[1] - end) > 0.05) ? ` (was ${clock(original[1] - original[0])})` : ''}
      </Body>
    </View>
  );
}

const confirm = (title, body, yes, go) => {
  if (Platform.OS === 'web') return go();
  Alert.alert(title, body, [{ text: 'Cancel', style: 'cancel' }, { text: yes, style: 'destructive', onPress: go }]);
};

export default function Clip() {
  const { id } = useLocalSearchParams();
  const { row: clip, error } = useRow('kt_clips', id);
  const [tab, setTab] = useState('post');
  if (clip === undefined) return <Loading error={error} />;
  if (!clip) return <Screen><Empty icon="trash-outline" title="This clip was deleted" /></Screen>;
  // Remount the editors whenever the clip changes (for example after a re-render).
  return <ClipScreen key={`${clip.id}|${clip.updated_at}`} clip={clip} tab={tab} setTab={setTab} />;
}

function ClipScreen({ clip, tab, setTab }) {
  const t = useTheme();
  const toast = useToast();
  const { row: project } = useRow('kt_projects', clip.project_id);
  const [postText, setPostText] = useState(clip.post_text || '');
  const [tags, setTags] = useState(clip.hashtags || '');
  const [start, setStart] = useState(Number(clip.start_s));
  const [end, setEnd] = useState(Number(clip.end_s));
  const [style, setStyle] = useState({ ...FALLBACK, ...(clip.style || {}) });
  const [hook, setHook] = useState(clip.hook || '');
  const [texts, setTexts] = useState({});
  const [request, setRequest] = useState('');
  const lines = useMemo(() => toLines(clip.words), [clip.words]);

  const busy = ['planned', 'rendering', 'rerender', 'editing'].includes(clip.status);
  const [statusLabel, statusTone] = CLIP_STATUS[clip.status] || [clip.status, 'mute'];
  const rangeChanged = Math.abs(start - clip.start_s) > 0.05 || Math.abs(end - clip.end_s) > 0.05;
  const styleChanged = JSON.stringify({ ...FALLBACK, ...(clip.style || {}) }) !== JSON.stringify(style) || hook !== (clip.hook || '');
  const wordsChanged = Object.keys(texts).length > 0;
  const tooShort = end - start < 5;
  const pd = Number(project?.duration_s) || Infinity;

  const rerender = async () => {
    const patch = { style, hook: hook.trim() || null, status: 'rerender', error: null };
    if (rangeChanged) Object.assign(patch, { start_s: Math.max(0, start), end_s: Math.min(pd, end), words: null });
    else if (wordsChanged) patch.words = fromLines(lines, texts);
    await update('kt_clips', clip.id, patch);
    await ask('rerender', `Re-render “${clip.title}” with my changes.`, { projectId: clip.project_id, clipId: clip.id });
    logYou(`You edited “${clip.title}”`);
    toast('Updating the clip. It’s ready in a few minutes.');
  };
  const askClaude = async () => {
    await update('kt_clips', clip.id, { status: 'editing' });
    await ask('edit', request.trim(), { projectId: clip.project_id, clipId: clip.id });
    setRequest('');
    toast('Sent to Claude. The new version appears here in a few minutes.');
  };
  const savePost = async () => {
    await update('kt_clips', clip.id, { post_text: postText, hashtags: tags });
    toast('Saved.');
  };
  const del = () => confirm('Delete this clip?', 'It is removed from the app. A copy you saved to your phone stays there.', 'Delete', async () => {
    await removeFiles([clip.media_path, clip.thumb_path]);
    await remove('kt_clips', clip.id);
    toast('Clip deleted.');
    router.back();
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: `#${clip.score ?? '–'} · ${clock(clip.end_s - clip.start_s)}` }} />
      <ClipPlayer clip={clip} />
      <View style={{ gap: 4 }}>
        <Row style={{ justifyContent: 'space-between' }} wrap={false}>
          <Body bold style={{ fontSize: 20, flex: 1 }}>{clip.title}</Body>
          <Pressable accessibilityLabel={clip.liked ? 'Unlike' : 'Like'} hitSlop={10} onPress={() => update('kt_clips', clip.id, { liked: !clip.liked })}>
            <Ionicons name={clip.liked ? 'heart' : 'heart-outline'} size={26} color={clip.liked ? '#ff4d6d' : t.muted} />
          </Pressable>
        </Row>
        <Row>
          {clip.status !== 'ready' ? <Pill label={statusLabel} tone={statusTone} /> : null}
          <Body small muted>{clock(clip.start_s)}–{clock(clip.end_s)} in “{(project?.title || 'the video').slice(0, 40)}”</Body>
        </Row>
        {clip.status === 'failed' && clip.error ? <Body small color={t.danger}>{clip.error}</Body> : null}
        {busy ? <Body small muted>{clip.status === 'editing' ? 'Claude is making your change…' : 'Rendering…'} The new version shows up here by itself.</Body> : null}
      </View>

      <ClipActions clip={clip} toast={toast} />

      <Chips options={[['post', 'Post'], ['edit', 'Edit'], ['captions', 'Caption text'], ['score', 'Score']]} value={tab} onChange={setTab} />

      {tab === 'post' ? (
        <Card>
          <Field label="Caption for your post" value={postText} onChangeText={setPostText} multiline />
          <Field label="Hashtags" value={tags} onChangeText={setTags} autoCapitalize="none" />
          <Row>
            <Button small icon="copy-outline" title="Copy caption" onPress={async () => {
              await Clipboard.setStringAsync([postText.trim(), tags.trim()].filter(Boolean).join('\n\n'));
              toast('Copied. Paste it when you post.');
            }} />
            {postText !== (clip.post_text || '') || tags !== (clip.hashtags || '') ? <Button small kind="soft" title="Save" onPress={savePost} /> : null}
          </Row>
          <Body small muted>Save to phone or Share, then post it on TikTok, Reels, Shorts or X and paste the caption.</Body>
          <Row>
            {clip.posted_at
              ? <Button small kind="plain" icon="checkmark-done" title={`Posted · undo`} onPress={() => update('kt_clips', clip.id, { posted_at: null })} />
              : <Button small kind="plain" icon="checkmark" title="Mark as posted" onPress={() => update('kt_clips', clip.id, { posted_at: new Date().toISOString() })} />}
          </Row>
        </Card>
      ) : null}

      {tab === 'edit' ? (
        <>
          <Card>
            <Body bold>Trim</Body>
            <Trim start={start} end={end} setStart={setStart} setEnd={setEnd} original={[clip.start_s, clip.end_s]} />
            {tooShort ? <Body small color={t.danger}>A clip must be at least 5 seconds.</Body> : null}
          </Card>
          <Card>
            <Body bold>Look</Body>
            <Field label="Hook title (first 3 seconds)" value={hook} onChangeText={setHook} />
            <StyleForm value={style} onChange={setStyle} />
          </Card>
          <Row>
            <Button icon="color-wand-outline" title="Save and update clip" disabled={busy || tooShort || !(rangeChanged || styleChanged)} onPress={rerender} />
            {rangeChanged || styleChanged ? <Button kind="plain" title="Undo changes" onPress={() => {
              setStart(Number(clip.start_s)); setEnd(Number(clip.end_s)); setStyle({ ...FALLBACK, ...(clip.style || {}) }); setHook(clip.hook || '');
            }} /> : null}
          </Row>
          <Card>
            <Row><Ionicons name="sparkles" size={18} color={t.primary} /><Body bold>Ask Claude to change it</Body></Row>
            <Field value={request} onChangeText={setRequest} multiline
              placeholder="e.g. Start on the question instead · end right after the joke · make the hook more dramatic · frame the guest" />
            <Row><Button small icon="send" title="Send" disabled={!request.trim() || busy} onPress={askClaude} /></Row>
          </Card>
          <Button kind="danger" icon="trash-outline" title="Delete clip" onPress={del} />
        </>
      ) : null}

      {tab === 'captions' ? (
        <Card>
          <Body bold>Fix the caption words</Body>
          <Body small muted>Correct names or misheard words. The timing stays the same.</Body>
          {lines.length ? lines.map((line, i) => (
            <Field key={i} value={texts[i] ?? line.map((w) => w[2]).join(' ')} onChangeText={(v) => setTexts({ ...texts, [i]: v })}
              label={clock(line[0][0])} />
          )) : <Body small muted>The caption words appear once the clip is rendered.</Body>}
          {wordsChanged ? <Body small color={t.warn}>Trim changes start the captions from the transcript again, so fix words after trimming.</Body> : null}
          <Row>
            <Button icon="color-wand-outline" title="Save and update clip" disabled={busy || !wordsChanged || rangeChanged} onPress={rerender} />
            {wordsChanged ? <Button kind="plain" title="Undo" onPress={() => setTexts({})} /> : null}
          </Row>
        </Card>
      ) : null}

      {tab === 'score' ? (
        <>
          <Scores clip={clip} />
          {clip.transcript ? (
            <>
              <Section>Transcript</Section>
              <Card><Body small selectable>{clip.transcript}</Body></Card>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
