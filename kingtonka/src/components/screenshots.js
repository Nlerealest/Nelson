// Campaign rules from screenshots: pick them from the gallery, upload them, and
// King Tonka (Claude) reads them and fills in the campaign.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../supabase';
import { ago, ask, BUCKET, useRows } from '../data';
import { Thumb } from './media';
import { Body, Button, Card, Row } from './ui';
import { useTheme } from '../theme';

const folder = (campaignId) => `campaigns/${campaignId}`;

// Opens the gallery. Returns the chosen pictures, or [] if none.
export async function pickScreenshots() {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.85 });
  return res.canceled ? [] : res.assets || [];
}

export async function uploadScreenshots(campaignId, assets, onProgress = () => {}) {
  const stamp = Date.now();
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    const type = a.mimeType || 'image/jpeg';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const body = Platform.OS === 'web' ? await (await fetch(a.uri)).blob() : await new File(a.uri).arrayBuffer();
    const { error } = await db().storage.from(BUCKET).upload(`${folder(campaignId)}/${stamp}-${String(i + 1).padStart(2, '0')}.${ext}`, body, { contentType: type });
    if (error) throw error;
    onProgress(i + 1, assets.length);
  }
}

// Asks King Tonka to read the screenshots (wakes the agent on GitHub).
export const readScreenshots = (campaign) => ask('campaign', `Read the rules screenshots for “${campaign.name}” and fill in the campaign.`, { projectId: campaign.id });

export async function removeAllScreenshots(campaignId) {
  const { data } = await db().storage.from(BUCKET).list(folder(campaignId), { limit: 100 });
  const paths = (data || []).filter((f) => f.id).map((f) => `${folder(campaignId)}/${f.name}`);
  if (paths.length) await db().storage.from(BUCKET).remove(paths);
}

function useScreenshots(campaignId) {
  const [paths, setPaths] = useState(null);
  const refresh = useCallback(() => db().storage.from(BUCKET).list(folder(campaignId), { limit: 100, sortBy: { column: 'name', order: 'asc' } })
    .then(({ data }) => setPaths((data || []).filter((f) => f.id).map((f) => `${folder(campaignId)}/${f.name}`)))
    .catch(() => setPaths([])), [campaignId]);
  useEffect(() => { refresh(); }, [refresh]);
  return { paths, refresh };
}

const STATE = { queued: 'Waiting for King Tonka to start…', working: 'King Tonka is reading your screenshots…' };

// The "Rules from screenshots" card on a campaign.
export function RulesScreenshots({ campaign, toast }) {
  const t = useTheme();
  const { paths, refresh } = useScreenshots(campaign.id);
  const [busy, setBusy] = useState(null);
  const job = (useRows('kt_commands').rows || []).find((c) => c.kind === 'campaign' && c.project_id === campaign.id);
  const reading = job && ['queued', 'working'].includes(job.status);

  const add = async () => {
    const picked = await pickScreenshots();
    if (!picked.length) return;
    try {
      setBusy('Uploading…');
      await uploadScreenshots(campaign.id, picked, (n, of) => setBusy(`Uploading ${n} of ${of}…`));
      await refresh();
      await readScreenshots(campaign);
      toast('Uploaded. King Tonka reads them and fills in this campaign in a few minutes.');
    } catch (e) {
      toast('Upload failed: ' + (e.message || e));
    } finally {
      setBusy(null);
    }
  };
  const removeOne = async (path) => {
    const { error } = await db().storage.from(BUCKET).remove([path]);
    if (error) return toast('Couldn’t remove it: ' + error.message);
    refresh();
  };

  return (
    <Card>
      <Row><Ionicons name="images-outline" size={18} color={t.primary} /><Body bold style={{ flex: 1 }}>Rules from screenshots</Body></Row>
      <Body small muted>Screenshot the campaign’s page (rules, requirements, pay) and add the pictures. King Tonka reads them and fills in everything below.</Body>
      {paths?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {paths.map((p) => (
            <View key={p}>
              <Thumb path={p} style={{ width: 70, aspectRatio: 9 / 18, borderRadius: 8 }} />
              <Pressable accessibilityLabel="Remove screenshot" hitSlop={8} onPress={() => removeOne(p)}
                style={{ position: 'absolute', top: 3, right: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,.65)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
      {busy ? <Row><ActivityIndicator color={t.primary} /><Body small muted>{busy}</Body></Row> : null}
      {reading ? (
        <Row><ActivityIndicator color={t.primary} /><Body small muted style={{ flex: 1 }}>{STATE[job.status]} The details appear below in a few minutes.</Body></Row>
      ) : job?.status === 'done' ? (
        <Body small color={t.ok}>✓ {job.result || 'Filled in from your screenshots.'} <Body small muted>({ago(job.updated_at)})</Body></Body>
      ) : job?.status === 'failed' ? (
        <Body small color={t.danger}>{job.result || 'King Tonka couldn’t read them.'}</Body>
      ) : null}
      <Row>
        <Button small icon="add" title={paths?.length ? 'Add more screenshots' : 'Add screenshots'} disabled={!!busy} onPress={add} />
        {paths?.length && !reading ? (
          <Button small kind="plain" icon="refresh" title="Read them again" disabled={!!busy} onPress={async () => {
            await readScreenshots(campaign);
            toast('King Tonka will read them again.');
          }} />
        ) : null}
      </Row>
    </Card>
  );
}
