import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ago, clock, CLIP_STATUS, STATUS, submitMinutesLeft, WORKING } from '../data';
import { Thumb } from './media';
import { Check } from './selection';
import { Body, Card, Pill, Progress, Row } from './ui';
import { scoreColor, useTheme } from '../theme';

export function ScoreBadge({ score, big }) {
  const t = useTheme();
  if (score == null) return null;
  const c = scoreColor(score, t);
  return (
    <View style={{ backgroundColor: 'rgba(0,0,0,.72)', borderRadius: 99, paddingHorizontal: big ? 12 : 8, paddingVertical: big ? 5 : 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="flame" size={big ? 16 : 12} color={c} />
      <Body bold color="#fff" style={{ fontSize: big ? 16 : 12 }}>{score}</Body>
    </View>
  );
}

// selecting / selected / onToggle: picking several videos; onLongPress starts it.
export function ProjectCard({ project, clipCount, postedCount, selecting, selected, onToggle, onLongPress }) {
  const t = useTheme();
  const [label, tone] = STATUS[project.status] || [project.status, 'mute'];
  const busy = WORKING.includes(project.status);
  return (
    <Pressable
      onPress={() => (selecting ? onToggle?.(project.id) : router.push(`/project/${project.id}`))}
      onLongPress={onLongPress ? () => onLongPress(project.id) : undefined}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card style={[{ padding: 12 }, selected && { borderColor: t.primary, borderWidth: 2 }]}>
        <Row wrap={false} style={{ gap: 12, alignItems: 'flex-start' }}>
          {selecting ? <Check on={selected} style={{ alignSelf: 'center' }} /> : null}
          <Thumb path={project.thumb_path} style={{ width: 96, aspectRatio: 16 / 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
            {!project.thumb_path ? <Ionicons name={project.source_path ? 'film-outline' : 'link-outline'} size={22} color={t.muted} /> : null}
          </Thumb>
          <View style={{ flex: 1, gap: 4 }}>
            <Body bold numberOfLines={2}>{project.title || project.source_url || 'Uploaded video'}</Body>
            <Row>
              <Pill label={label} tone={tone} />
              {project.duration_s ? <Body small muted>{clock(project.duration_s)}</Body> : null}
              {clipCount ? <Body small muted>· {clipCount} clips{postedCount ? `, ${postedCount} posted` : ''}</Body> : null}
              <Body small muted>· {ago(project.created_at)}</Body>
            </Row>
          </View>
        </Row>
        {busy ? (
          <View style={{ gap: 6 }}>
            {project.status !== 'live' ? <Progress percent={project.percent || 2} /> : null}
            <Body small muted numberOfLines={2}>{project.step || 'Working…'}</Body>
          </View>
        ) : project.status === 'failed' ? <Body small color={t.danger} numberOfLines={3}>{project.error || 'Something went wrong.'}</Body> : null}
      </Card>
    </Pressable>
  );
}

// A clip as a poster in a grid. selecting / selected / onToggle: picking several clips.
export function ClipTile({ clip, showProject, selecting, selected, onToggle, onLongPress }) {
  const t = useTheme();
  const [label, tone] = CLIP_STATUS[clip.status] || [clip.status, 'mute'];
  return (
    <Pressable
      onPress={() => (selecting ? onToggle?.(clip.id) : router.push(`/clip/${clip.id}`))}
      onLongPress={onLongPress ? () => onLongPress(clip.id) : undefined}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ gap: 6 }}>
        <Thumb path={clip.thumb_path} style={[{ width: '100%', aspectRatio: 9 / 14, borderRadius: 14, padding: 8, justifyContent: 'space-between' },
          selected && { borderWidth: 3, borderColor: t.primary }, selecting && !selected && { opacity: 0.75 }]}>
          <Row style={{ justifyContent: 'space-between' }}>
            {selecting ? <Check on={selected} /> : <ScoreBadge score={clip.score} />}
            {clip.liked ? <Ionicons name="heart" size={18} color="#ff4d6d" /> : null}
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            {clip.status !== 'ready' ? <Pill label={label} tone={tone} /> : <View />}
            <View style={{ backgroundColor: 'rgba(0,0,0,.65)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Body small bold color="#fff">{clock(clip.end_s - clip.start_s)}</Body>
            </View>
          </Row>
          {!clip.thumb_path && clip.status !== 'ready' ? (
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
              <Ionicons name={clip.status === 'failed' ? 'alert-circle-outline' : 'hourglass-outline'} size={26} color={t.muted} />
            </View>
          ) : null}
        </Thumb>
        <Body bold small numberOfLines={2}>{clip.title}</Body>
        <ClipPostState clip={clip} showProject={showProject} />
      </View>
    </Pressable>
  );
}

function ClipPostState({ clip, showProject }) {
  const t = useTheme();
  const left = submitMinutesLeft(clip);
  if (clip.submitted_at) return <Body small color={t.ok}>Posted · submitted ✓</Body>;
  if (left !== null) return <Body small bold color={left >= 0 ? t.warn : t.danger}>{left >= 0 ? `⏰ Submit: ${left} min left` : 'Submit it (time passed)'}</Body>;
  if (clip.posted_at) return <Body small color={t.ok}>Posted</Body>;
  return showProject ? <Body small muted numberOfLines={1}>{showProject}</Body> : null;
}

// Lays tiles out two per row.
export function Grid({ children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  const rows = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={{ gap: 14 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
          {r[0]}
          {r[1] || <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}
