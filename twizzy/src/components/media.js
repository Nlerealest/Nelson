// Video and image previews from Supabase storage, and saving / sharing them.
import { useEffect, useState } from 'react';
import { Alert, Image, Platform, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { db } from '../supabase';
import { Body, Button, Row } from './ui';
import { useTheme } from '../theme';

// Not available on web, where saving opens a download link instead.
const MediaLibrary = Platform.OS === 'web' ? null : require('expo-media-library');

export function useSignedUrl(path) {
  const [signed, setSigned] = useState({});
  useEffect(() => {
    let live = true;
    if (path) db().storage.from('media').createSignedUrl(path, 3600).then(({ data }) => live && setSigned({ path, url: data?.signedUrl || null }));
    return () => { live = false; };
  }, [path]);
  return signed.path === path ? signed.url : null;
}

function Video({ url }) {
  const player = useVideoPlayer(url, (p) => { p.loop = false; });
  return <VideoView player={player} style={{ width: '100%', aspectRatio: 9 / 16, maxHeight: 520, borderRadius: 14, backgroundColor: '#000' }} contentFit="contain" nativeControls fullscreenOptions={{ enable: true }} />;
}

export function MediaPreview({ post }) {
  const t = useTheme();
  const url = useSignedUrl(post.media_path);
  if (!post.media_path) {
    return (
      <View style={{ aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: t.input, alignItems: 'center', justifyContent: 'center' }}>
        <Body muted>{post.status === 'making' ? 'Twizzy is making this video…' : 'No video yet'}</Body>
      </View>
    );
  }
  if (!url) return <View style={{ aspectRatio: 9 / 16, maxHeight: 520, borderRadius: 14, backgroundColor: '#000' }} />;
  if (post.media_kind === 'image') return <Image source={{ uri: url }} style={{ width: '100%', aspectRatio: 1, borderRadius: 14 }} resizeMode="contain" />;
  return <Video url={url} />;
}

const fileName = (post) =>
  'ndalama-' + (post.title || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) + (post.media_kind === 'image' ? '.png' : '.mp4');

async function downloadToCache(post) {
  const { data, error } = await db().storage.from('media').createSignedUrl(post.media_path, 600);
  if (error) throw error;
  const dest = new File(Paths.cache, fileName(post));
  if (dest.exists) dest.delete();
  return File.downloadFileAsync(data.signedUrl, dest);
}

export async function saveToPhone(post) {
  if (Platform.OS === 'web') {
    const { data } = await db().storage.from('media').createSignedUrl(post.media_path, 600, { download: fileName(post) });
    window.open(data.signedUrl, '_blank');
    return true;
  }
  const { granted } = await MediaLibrary.requestPermissionsAsync(true, [post.media_kind === 'image' ? 'photo' : 'video']);
  if (!granted) { Alert.alert('Allow Twizzy to save', 'Twizzy needs permission to save videos to your gallery.'); return false; }
  const file = await downloadToCache(post);
  await MediaLibrary.Asset.create(file.uri);
  return true;
}

export async function shareMedia(post) {
  if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) return saveToPhone(post);
  const file = await downloadToCache(post);
  await Sharing.shareAsync(file.uri, { mimeType: post.media_kind === 'image' ? 'image/png' : 'video/mp4', dialogTitle: 'Share to TikTok, X or WhatsApp' });
  return true;
}

export function MediaActions({ post, toast }) {
  if (!post.media_path) return null;
  return (
    <Row>
      <Button small icon="download-outline" title="Save to phone" onPress={async () => {
        try { if (await saveToPhone(post)) toast('Saved to your gallery.'); } catch (e) { toast('Couldn’t save: ' + (e.message || e)); }
      }} />
      <Button small kind="plain" icon="share-social-outline" title="Share" onPress={async () => {
        try { await shareMedia(post); } catch (e) { toast('Couldn’t share: ' + (e.message || e)); }
      }} />
    </Row>
  );
}
