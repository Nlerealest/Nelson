import { useState } from 'react';
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { db } from '../supabase';
import { logYou, nowIso, tellTwizzy, update, useRows, useToast } from '../data';
import { Body, Button, Card, Chips, Empty, Field, Loading, Pill, Row, Screen } from '../components/ui';
import { MediaActions, MediaPreview } from '../components/media';
import { useTheme } from '../theme';

const PLAT = { tiktok: 'TikTok', x: 'X', facebook: 'Facebook', instagram: 'Instagram' };
const STATUS = { needs_song: ['Needs a song', 'bad'], making: ['Being made', 'warn'], awaiting_approval: ['Needs your OK', 'info'], changes_requested: ['Being changed', 'warn'] };

const SONG_MODES = [['upload', 'Upload from phone'], ['link', 'Paste a link'], ['original', 'Twizzy makes music'], ['tiktok', 'I’ll add a TikTok sound']];

// Twizzy asks which song to use before it makes the video.
function SongQuestion({ p, toast }) {
  const t = useTheme();
  const [mode, setMode] = useState('upload');
  const [file, setFile] = useState(null);
  const [link, setLink] = useState('');
  const [start, setStart] = useState('');
  const [note, setNote] = useState('');
  const answer = async () => {
    let song = { mode, note: note.trim() || null };
    if (mode === 'upload') {
      if (!file) return toast('Pick the song file first.');
      toast('Uploading the song…');
      const body = Platform.OS === 'web' ? file.file : await new File(file.uri).arrayBuffer();
      const ext = (file.name || 'song.mp3').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
      const path = `songs/${p.id}-${Date.now()}.${ext}`;
      const { error } = await db().storage.from('media').upload(path, body, { contentType: file.mimeType || 'audio/mpeg' });
      if (error) return toast('Upload failed: ' + error.message);
      song = { ...song, path, name: file.name, start: Number(start) || 0 };
    }
    if (mode === 'link') {
      if (!/^https?:\/\//.test(link.trim())) return toast('Paste a link that starts with https://');
      song = { ...song, url: link.trim() };
    }
    await update('posts', p.id, { song, status: 'making', decided_at: nowIso() });
    await tellTwizzy(`Make "${p.title}" with the song I chose (${SONG_MODES.find(([k]) => k === mode)[1]}).`, 'song', p.id);
    logYou(`You chose the song for “${p.title}”`);
    toast('Thanks! Twizzy is making the video now.');
  };
  return (
    <Card style={{ borderColor: t.warn }}>
      <Row><Pill label="Twizzy asks" tone="warn" />{(p.platforms || []).map((x) => <Pill key={x} label={PLAT[x] || x} tone="info" />)}</Row>
      <Body bold style={{ fontSize: 17 }}>Which song for “{p.title}”?</Body>
      {p.question ? <Body>{p.question}</Body> : null}
      <Chips value={mode} onChange={setMode} options={SONG_MODES} />
      {mode === 'upload' ? (
        <>
          <Row>
            <Button kind="plain" icon="musical-notes-outline" title={file ? 'Change song' : 'Choose song file'} onPress={async () => {
              const res = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
              if (res.canceled) return;
              const a = res.assets[0];
              if (a.size && a.size > 25 * 1024 * 1024) return toast('That file is over 25 MB.');
              setFile(a);
            }} />
          </Row>
          {file ? <Body small>🎵 {file.name}</Body> : null}
          <Field label="Start from (seconds into the song, optional)" value={start} onChangeText={setStart} keyboardType="numeric" placeholder="e.g. 45 for the chorus" />
          <Body small muted>Only use songs you’re allowed to use in adverts. TikTok may mute videos with copyrighted music.</Body>
        </>
      ) : null}
      {mode === 'link' ? (
        <>
          <Field value={link} onChangeText={setLink} placeholder="TikTok sound or YouTube link" autoCapitalize="none" keyboardType="url" />
          <Body small muted>Twizzy makes original music in the same mood and speed (it can’t copy the song itself).</Body>
        </>
      ) : null}
      {mode === 'tiktok' ? <Body small muted>Twizzy makes the video with soft music. When you post, add the TikTok sound and turn the original sound down.</Body> : null}
      <Field label="Anything else about the music? (optional)" value={note} onChangeText={setNote} placeholder="e.g. Amapiano, upbeat, no lyrics" />
      <Row><Button icon="checkmark" title="Use this song" onPress={answer} /></Row>
    </Card>
  );
}

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
  const { rows, error, reload } = useRows('posts', { filter: { status: ['needs_song', 'making', 'awaiting_approval', 'changes_requested'] } });
  return (
    <Screen onRefresh={reload}>
      <Body muted>Watch each video, save it if you like, then approve it or tell Twizzy what to change. Nothing goes out without your OK.</Body>
      {!rows ? <Loading error={error} /> : rows.length
        ? rows.map((p) => (p.status === 'needs_song' ? <SongQuestion key={p.id} p={p} toast={toast} /> : <Approval key={p.id + (p.media_path || '')} p={p} toast={toast} />))
        : <Empty title="All caught up" icon="checkmark-done-circle-outline">New videos from Twizzy wait here for you.</Empty>}
    </Screen>
  );
}
