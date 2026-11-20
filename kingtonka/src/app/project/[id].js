// One video: progress while King Tonka works, then its clips, best first.
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ask, clock, closeCommands, logYou, remove, removeFiles, STATUS, update, useRow, useRows, useToast, WORKING } from '../../data';
import { Body, Button, Card, Chips, Empty, Loading, Pill, Progress, Row, Screen, Section } from '../../components/ui';
import { Thumb } from '../../components/media';
import { ClipTile, Grid } from '../../components/cards';
import { label } from '../../components/settings';
import { useTheme } from '../../theme';
import { pickVideo, sourceFiles, uploadVideo } from '../../upload';

const STEPS = [['downloading', 'Download'], ['transcribing', 'Transcribe'], ['finding', 'Find moments'], ['rendering', 'Edit clips'], ['done', 'Ready']];

function Steps({ status }) {
  const t = useTheme();
  const at = STEPS.findIndex(([s]) => s === status);
  return (
    <Row wrap={false} style={{ justifyContent: 'space-between' }}>
      {STEPS.map(([s, name], i) => {
        const done = status === 'done' || (at >= 0 && i < at);
        const now = i === at && status !== 'done';
        return (
          <View key={s} style={{ alignItems: 'center', flex: 1, gap: 4 }}>
            <Ionicons name={done ? 'checkmark-circle' : now ? 'ellipse' : 'ellipse-outline'} size={18} color={done ? t.ok : now ? t.primary : t.muted} />
            <Body small muted={!now} bold={now} style={{ fontSize: 11, textAlign: 'center' }}>{name}</Body>
          </View>
        );
      })}
    </Row>
  );
}

const confirm = (title, body, yes, go) => {
  if (Platform.OS === 'web') return go();
  Alert.alert(title, body, [{ text: 'Cancel', style: 'cancel' }, { text: yes, style: 'destructive', onPress: go }]);
};

export default function Project() {
  const t = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams();
  const { row: p, error } = useRow('kt_projects', id);
  const clipRows = useRows('kt_clips', { filter: { project_id: id } }).rows;
  const [sort, setSort] = useState('score');
  const [upload, setUpload] = useState(null);

  const clips = useMemo(() => {
    const list = [...(clipRows || [])];
    return sort === 'score' ? list.sort((a, b) => (b.score || 0) - (a.score || 0)) : list.sort((a, b) => a.start_s - b.start_s);
  }, [clipRows, sort]);

  if (p === undefined) return <Loading error={error} />;
  if (!p) return <Screen><Empty icon="trash-outline" title="This video was deleted" /></Screen>;

  const busy = WORKING.includes(p.status);
  const s = p.settings || {};
  const pending = (clipRows || []).filter((c) => ['planned', 'rendering', 'rerender', 'editing'].includes(c.status));
  const ready = (clipRows || []).filter((c) => c.status === 'ready');
  // Looking for more clips in a finished video: cancelling just goes back to the clips you have.
  const findingMore = p.status === 'finding' && ready.length > 0 && !pending.length;
  const cancel = () => confirm(findingMore ? 'Stop looking for more clips?' : 'Stop working on this video?',
    findingMore ? 'Your clips stay.' : 'King Tonka stops downloading and clipping it within a few seconds. You can start it again later.',
    'Stop', async () => {
      await update('kt_projects', p.id, findingMore
        ? { status: 'done', step: `${ready.length} clips ready`, percent: 100 }
        : { status: 'cancelled', step: 'Cancelled', percent: 0 });
      await closeCommands(p.id, 'Cancelled by you.');
      logYou(`You cancelled “${p.title || p.source_url || 'a video'}”`);
      toast('Stopped. King Tonka lets go of it within a few seconds.');
    });
  const resume = async () => {
    if (!pending.length) return retry();
    await update('kt_projects', p.id, { status: 'rendering', step: `Rendering ${pending.length} clips…`, percent: 70, error: null });
    await ask('process', `Finish the clips of ${p.title || p.source_url}`, { projectId: p.id });
    toast('Finishing the clips. King Tonka starts within a minute.');
  };
  const retry = async () => {
    await update('kt_projects', p.id, { status: 'queued', step: 'Waiting for King Tonka to start…', percent: 0, error: null });
    await ask('process', `Try again: ${p.title || p.source_url}`, { projectId: p.id });
    toast('Trying again. King Tonka starts within a minute.');
  };
  // A link that couldn't be downloaded: send the file from the phone instead, same options.
  const uploadInstead = async () => {
    const a = await pickVideo();
    if (!a) return;
    try {
      setUpload('Uploading… 0%');
      const up = await uploadVideo(a, (pct) => setUpload(`Uploading… ${pct}%`));
      await removeFiles(sourceFiles(p));
      await update('kt_projects', p.id, {
        source_path: up.path, settings: { ...(p.settings || {}), parts: up.parts }, title: p.title || up.title,
        status: 'queued', step: 'Waiting for King Tonka to start…', percent: 0, error: null,
      });
      await ask('process', `Clip the uploaded file for ${p.title || p.source_url}`, { projectId: p.id });
      toast('Uploaded. King Tonka starts within a minute.');
    } catch (e) {
      toast('Upload failed: ' + (e.message || e));
    } finally {
      setUpload(null);
    }
  };
  const more = async () => {
    await ask('more', `Find more clips in “${p.title}”, different from the ones already made.`, { projectId: p.id });
    await update('kt_projects', p.id, { status: 'finding', step: 'Waiting for King Tonka to look for more…', percent: 60 });
    toast('King Tonka will look for more moments.');
  };
  const del = () => confirm('Delete this video and its clips?', 'The clips are removed from the app. Clips you saved to your phone stay there.', 'Delete', async () => {
    await removeFiles([...sourceFiles(p), p.thumb_path, `projects/${p.id}/transcript.txt`, `projects/${p.id}/words.json`,
      ...(clipRows || []).flatMap((c) => [c.media_path, c.thumb_path])]);
    await remove('kt_projects', p.id);
    logYou(`You deleted “${p.title || p.source_url}”`);
    toast('Deleted.');
    router.back();
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: p.title ? p.title.slice(0, 32) : 'Clips' }} />
      <Card style={{ padding: 12 }}>
        <Row wrap={false} style={{ gap: 12, alignItems: 'flex-start' }}>
          <Thumb path={p.thumb_path} style={{ width: 120, aspectRatio: 16 / 9, borderRadius: 10 }} />
          <View style={{ flex: 1, gap: 4 }}>
            <Body bold numberOfLines={3}>{p.title || p.source_url || 'Uploaded video'}</Body>
            <Row>
              <Pill label={(STATUS[p.status] || [p.status])[0]} tone={(STATUS[p.status] || [])[1]} />
              {p.duration_s ? <Body small muted>{clock(p.duration_s)}</Body> : null}
            </Row>
          </View>
        </Row>
        <Body small muted>
          {[s.clips === 'auto' || !s.clips ? 'Auto clips' : `${s.clips} clips`, label('length', s.length || 'auto'), s.aspect || '9:16', `${label('captions', s.captions || 'bold')} captions`].join(' · ')}
          {s.campaign ? `\nFor the campaign: ${s.campaign.name}` : ''}
          {s.prompt ? `\nLooking for: ${s.prompt}` : ''}
          {s.range_start != null || s.range_end != null ? `\nOnly ${clock(s.range_start || 0)}–${s.range_end != null ? clock(s.range_end) : 'end'}` : ''}
        </Body>
        {busy ? (
          <View style={{ gap: 10 }}>
            <Steps status={p.status} />
            <Progress percent={p.percent || 2} />
            <Body small muted>{p.step || 'Waiting…'}</Body>
            <Row><Button small kind="danger" icon="stop-circle-outline" title={findingMore ? 'Stop looking' : 'Cancel'} onPress={cancel} /></Row>
          </View>
        ) : null}
        {p.status === 'cancelled' ? (
          <View style={{ gap: 8 }}>
            <Body small muted>You cancelled this video{pending.length ? ` before ${pending.length} clips were finished` : ''}.</Body>
            <Row><Button small icon="play-outline" title={pending.length ? 'Finish the clips' : 'Start again'} onPress={resume} /></Row>
          </View>
        ) : null}
        {p.status === 'failed' ? (
          <View style={{ gap: 8 }}>
            <Body small color={t.danger}>{p.error || 'Something went wrong.'}</Body>
            {upload ? <Row><ActivityIndicator color={t.primary} /><Body small muted>{upload}</Body></Row> : (
              <Row>
                {p.source_url ? <Button small icon="cloud-upload-outline" title="Upload the file instead" onPress={uploadInstead} /> : null}
                <Button small kind={p.source_url ? 'plain' : 'primary'} icon="refresh" title="Try again" onPress={retry} />
              </Row>
            )}
          </View>
        ) : null}
        <Row>
          {p.source_url ? <Button small kind="plain" icon="open-outline" title="Original" onPress={() => Linking.openURL(p.source_url)} /> : null}
          {p.status === 'done' ? <Button small kind="soft" icon="add" title="Find more clips" onPress={more} /> : null}
          <Button small kind="danger" icon="trash-outline" title="Delete" onPress={del} />
        </Row>
      </Card>

      {clips.length ? (
        <>
          <Section right={<Chips options={[['score', 'Best first'], ['time', 'In order']]} value={sort} onChange={setSort} />}>{clips.length} clips</Section>
          <Grid>{clips.map((c) => <ClipTile key={c.id} clip={c} />)}</Grid>
        </>
      ) : !busy ? null : (
        <Empty icon="hourglass-outline" title="Your clips are on the way">
          Long videos take longer: about 10 minutes, plus about 1 minute for every 8 minutes of video (a 10-hour stream takes 1½–3 hours). You can close the app; the clips appear here when they’re ready.
        </Empty>
      )}
    </Screen>
  );
}
