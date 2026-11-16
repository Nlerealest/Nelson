// Every clip from every video, best first.
import { useMemo, useState } from 'react';
import { useRows } from '../../data';
import { Chips, Empty, Loading, Screen } from '../../components/ui';
import { ClipTile, Grid } from '../../components/cards';

const FILTERS = [['all', 'All'], ['top', 'Score 80+'], ['liked', 'Liked'], ['todo', 'Not posted'], ['posted', 'Posted']];

export default function Library() {
  const clips = useRows('kt_clips');
  const projects = useRows('kt_projects');
  const [filter, setFilter] = useState('all');
  const titles = useMemo(() => Object.fromEntries((projects.rows || []).map((p) => [p.id, p.title || 'Video'])), [projects.rows]);
  const list = useMemo(() => (clips.rows || [])
    .filter((c) => ({ all: true, top: (c.score || 0) >= 80, liked: c.liked, todo: !c.posted_at && c.status === 'ready', posted: !!c.posted_at }[filter]))
    .sort((a, b) => (b.score || 0) - (a.score || 0)), [clips.rows, filter]);

  if (!clips.rows) return <Loading error={clips.error} />;
  return (
    <Screen onRefresh={clips.reload}>
      <Chips options={FILTERS} value={filter} onChange={setFilter} />
      {list.length ? (
        <Grid>{list.map((c) => <ClipTile key={c.id} clip={c} showProject={titles[c.project_id]} />)}</Grid>
      ) : (
        <Empty icon="albums-outline" title={filter === 'all' ? 'No clips yet' : 'Nothing here'}>
          {filter === 'all' ? 'Paste a video link on the Create tab. Your clips collect here.' : 'Try another filter.'}
        </Empty>
      )}
    </Screen>
  );
}
