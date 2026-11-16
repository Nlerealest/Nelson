// One video: progress while King Tonka works, then its clips, best first.
import { useMemo, useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ask, clock, logYou, remove, removeFiles, STATUS, update, useRow, useRows, useToast } from '../../data';
import { Body, Button, Card, Chips, Empty, Loading, Pill, Progress, Row, Screen, Section } from '../../components/ui';
import { Thumb } from '../../components/media';
import { ClipTile, Grid } from '../../components/cards';
import { label } from '../../components/settings';
import { useTheme } from '../../theme';

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

  const clips = useMemo(() => {
    const list = [...(clipRows || [])];
    return sort === 'score' ? list.sort((a, b) => (b.score || 0) - (a.score || 0)) : list.sort((a, b) => a.start_s - b.start_s);
  }, [clipRows, sort]);

  if (p === undefined) return <Loading error={error} />;
  if (!p) return <Screen><Empty icon="trash-outline" title="This video was deleted" /></Screen>;

  const busy = !['done', 'failed'].includes(p.status);
  const s = p.settings || {};
  const retry = async () => {
    await update('kt_projects', p.id, { status: 'queued', step: 'Waiting for King Tonka to start…', percent: 0, error: null });
    await ask('process', `Try again: ${p.title || p.source_url}`, { projectId: p.id });
    toast('Trying again. King Tonka starts within a minute.');
  };
  const more = async () => {
    await ask('more', `Find more clips in “${p.title}”, different from the ones already made.`, { projectId: p.id });
    await update('kt_projects', p.id, { status: 'finding', step: 'Waiting for King Tonka to look for more…', percent: 60 });
    toast('King Tonka will look for more moments.');
  };
  const del = () => confirm('Delete this video and its clips?', 'The clips are removed from the app. Clips you saved to your phone stay there.', 'Delete', async () => {
    await removeFiles([p.source_path, p.thumb_path, `projects/${p.id}/transcript.txt`, `projects/${p.id}/words.json`,
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
          {s.prompt ? `\nLooking for: ${s.prompt}` : ''}
          {s.range_start != null || s.range_end != null ? `\nOnly ${clock(s.range_start || 0)}–${s.range_end != null ? clock(s.range_end) : 'end'}` : ''}
        </Body>
        {busy ? (
          <View style={{ gap: 10 }}>
            <Steps status={p.status} />
            <Progress percent={p.percent || 2} />
            <Body small muted>{p.step || 'Waiting…'}</Body>
          </View>
        ) : null}
        {p.status === 'failed' ? (
          <View style={{ gap: 8 }}>
            <Body small color={t.danger}>{p.error || 'Something went wrong.'}</Body>
            <Row><Button small icon="refresh" title="Try again" onPress={retry} /></Row>
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
          Long videos take longer: about 10 minutes plus 1 minute for every 5 minutes of video. You can close the app; the clips appear here when they’re ready.
        </Empty>
      )}
    </Screen>
  );
}
