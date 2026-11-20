// Every clip from every video, best first. Tap Select (or long-press a clip) to
// pick several, for example everything you've already posted, and delete them.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { submitMinutesLeft, useRows, useToast } from '../../data';
import { Button, Chips, Empty, Loading, Row, Screen } from '../../components/ui';
import { ClipTile, Grid } from '../../components/cards';
import { confirmDelete, SelectionBar, useSelection } from '../../components/selection';
import { deleteClips } from '../../deleting';

const FILTERS = [['all', 'All'], ['submit', 'To submit'], ['top', 'Score 80+'], ['liked', 'Liked'], ['todo', 'Not posted'], ['posted', 'Posted'], ['submitted', 'Submitted']];
const BUSY = ['planned', 'rendering', 'rerender', 'editing'];

export default function Library() {
  const toast = useToast();
  const clips = useRows('kt_clips');
  const projects = useRows('kt_projects');
  const [filter, setFilter] = useState('all');
  const sel = useSelection();
  const titles = useMemo(() => Object.fromEntries((projects.rows || []).map((p) => [p.id, p.title || 'Video'])), [projects.rows]);
  const list = useMemo(() => (clips.rows || [])
    .filter((c) => ({ all: true, submit: submitMinutesLeft(c) !== null, top: (c.score || 0) >= 80, liked: c.liked, todo: !c.posted_at && c.status === 'ready',
      posted: !!c.posted_at, submitted: !!c.submitted_at }[filter]))
    .sort((a, b) => (filter === 'submit' ? (submitMinutesLeft(a) ?? 0) - (submitMinutesLeft(b) ?? 0) : (b.score || 0) - (a.score || 0))), [clips.rows, filter]);
  const posted = useMemo(() => (clips.rows || []).filter((c) => c.posted_at), [clips.rows]);

  if (!clips.rows) return <Loading error={clips.error} />;

  const chosen = (clips.rows || []).filter((c) => sel.isSelected(c.id));
  const remove = () => {
    const n = chosen.length;
    const working = chosen.filter((c) => BUSY.includes(c.status)).length;
    confirmDelete(`Delete ${n} clip${n === 1 ? '' : 's'}?`,
      'They’re removed from King Tonka and free up space. Copies you saved to your phone or posted online stay.'
      + (working ? `\n\n${working} of them ${working === 1 ? 'is' : 'are'} still being made.` : ''),
      async () => {
        try {
          await deleteClips(chosen);
          sel.stop();
          toast(`Deleted ${n} clip${n === 1 ? '' : 's'}.`);
        } catch (e) {
          toast('Couldn’t delete: ' + (e.message || e));
        }
      });
  };
  // "Select all" picks everything in the current filter; on All it offers the posted ones.
  const allIds = list.map((c) => c.id);
  const allPicked = allIds.length > 0 && allIds.every((id) => sel.isSelected(id));
  const onAll = filter === 'all' && posted.length && !allPicked
    ? () => { setFilter('posted'); sel.set(posted.map((c) => c.id)); }
    : () => sel.set(allPicked ? [] : allIds);
  const allLabel = filter === 'all' && posted.length && !allPicked ? `All posted (${posted.length})` : allPicked ? 'Select none' : 'Select all';

  return (
    <View style={{ flex: 1 }}>
      <Screen onRefresh={clips.reload}>
        <Chips options={FILTERS} value={filter} onChange={setFilter} />
        {list.length && !sel.selecting ? (
          <Row>
            <Button small kind="plain" icon="checkmark-circle-outline" title="Select" onPress={() => sel.start()} />
            {posted.length ? <Button small kind="plain" icon="trash-outline" title={`Clean up posted (${posted.length})`}
              onPress={() => { setFilter('posted'); sel.start(posted.map((c) => c.id)); }} /> : null}
          </Row>
        ) : null}
        {list.length ? (
          <Grid>{list.map((c) => (
            <ClipTile key={c.id} clip={c} showProject={titles[c.project_id]}
              selecting={sel.selecting} selected={sel.isSelected(c.id)} onToggle={sel.toggle}
              onLongPress={sel.selecting ? undefined : (id) => sel.start([id])} />
          ))}</Grid>
        ) : (
          <Empty icon="albums-outline" title={filter === 'all' ? 'No clips yet' : 'Nothing here'}>
            {filter === 'all' ? 'Paste a video link on the Create tab. Your clips collect here.'
            : filter === 'submit' ? 'Nothing waiting. After you post a campaign clip, save its link on the clip and it shows here until you submit it.'
              : 'Try another filter.'}
          </Empty>
        )}
        {sel.selecting ? <View style={{ height: 110 }} /> : null}
      </Screen>
      {sel.selecting ? (
        <SelectionBar count={chosen.length} noun="clip" onAll={list.length ? onAll : null} allLabel={allLabel} onDelete={remove} onDone={sel.stop} />
      ) : null}
    </View>
  );
}
