import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ago, clock, CLIP_STATUS, STATUS } from '../data';
import { Thumb } from './media';
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

const WORKING = ['queued', 'downloading', 'transcribing', 'finding', 'rendering'];

export function ProjectCard({ project, clipCount }) {
  const t = useTheme();
  const [label, tone] = STATUS[project.status] || [project.status, 'mute'];
  const busy = WORKING.includes(project.status);
  return (
    <Pressable onPress={() => router.push(`/project/${project.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={{ padding: 12 }}>
        <Row wrap={false} style={{ gap: 12, alignItems: 'flex-start' }}>
          <Thumb path={project.thumb_path} style={{ width: 96, aspectRatio: 16 / 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
            {!project.thumb_path ? <Ionicons name={project.source_path ? 'film-outline' : 'link-outline'} size={22} color={t.muted} /> : null}
          </Thumb>
          <View style={{ flex: 1, gap: 4 }}>
            <Body bold numberOfLines={2}>{project.title || project.source_url || 'Uploaded video'}</Body>
            <Row>
              <Pill label={label} tone={tone} />
              {project.duration_s ? <Body small muted>{clock(project.duration_s)}</Body> : null}
              {clipCount ? <Body small muted>· {clipCount} clips</Body> : null}
              <Body small muted>· {ago(project.created_at)}</Body>
            </Row>
          </View>
        </Row>
        {busy ? (
          <View style={{ gap: 6 }}>
            <Progress percent={project.percent || 2} />
            <Body small muted numberOfLines={2}>{project.step || 'Working…'}</Body>
          </View>
        ) : project.status === 'failed' ? <Body small color={t.danger} numberOfLines={3}>{project.error || 'Something went wrong.'}</Body> : null}
      </Card>
    </Pressable>
  );
}

// A clip as a poster in a grid.
export function ClipTile({ clip, showProject }) {
  const t = useTheme();
  const [label, tone] = CLIP_STATUS[clip.status] || [clip.status, 'mute'];
  return (
    <Pressable onPress={() => router.push(`/clip/${clip.id}`)} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ gap: 6 }}>
        <Thumb path={clip.thumb_path} style={{ width: '100%', aspectRatio: 9 / 14, borderRadius: 14, padding: 8, justifyContent: 'space-between' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <ScoreBadge score={clip.score} />
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
        {clip.posted_at ? <Body small color={t.ok}>Posted</Body> : showProject ? <Body small muted numberOfLines={1}>{showProject}</Body> : null}
      </View>
    </Pressable>
  );
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
