// Deleting clips and whole videos, files included, so storage space comes back.
// Copies already saved on the phone or posted online are not touched.
import { db } from './supabase';
import { BUCKET, logYou, previewOf } from './data';
import { sourceFiles } from './upload';

async function removeAll(paths) {
  const list = [...new Set(paths.filter(Boolean))];
  for (let i = 0; i < list.length; i += 100) {
    const { error } = await db().storage.from(BUCKET).remove(list.slice(i, i + 100));
    if (error) throw error;
  }
}

export async function deleteClips(clips) {
  if (!clips.length) return;
  await removeAll(clips.flatMap((c) => [c.media_path, c.thumb_path, previewOf(c.media_path)]));
  const { error } = await db().from('kt_clips').delete().in('id', clips.map((c) => c.id));
  if (error) throw error;
  logYou(clips.length === 1 ? `You deleted the clip “${clips[0].title}”` : `You deleted ${clips.length} clips`);
}

// Deletes videos with all their clips. allClips: every clip you have (to find theirs).
export async function deleteProjects(projects, allClips) {
  if (!projects.length) return;
  const ids = new Set(projects.map((p) => p.id));
  const theirClips = (allClips || []).filter((c) => ids.has(c.project_id));
  await removeAll([
    ...projects.flatMap((p) => [...sourceFiles(p), p.thumb_path, `projects/${p.id}/thumb.jpg`, `projects/${p.id}/transcript.txt`, `projects/${p.id}/words.json`]),
    ...theirClips.flatMap((c) => [c.media_path, c.thumb_path, previewOf(c.media_path)]),
  ]);
  const { error } = await db().from('kt_projects').delete().in('id', [...ids]); // their clips go with them
  if (error) throw error;
  const p = projects[0];
  logYou(projects.length === 1 ? `You deleted “${p.title || p.source_url || 'a video'}”` : `You deleted ${projects.length} videos`);
}
