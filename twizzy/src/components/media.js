// Video and image previews from Supabase storage, and saving / sharing them.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

// Only one video plays at a time; the others show their still frame.
let stopCurrent = null;

function Video({ url }) {
  const player = useVideoPlayer(url, (p) => { p.loop = false; p.play(); });
  return <VideoView player={player} style={{ width: '100%', aspectRatio: 9 / 16, maxHeight: 520, borderRadius: 14, backgroundColor: '#000' }} contentFit="contain" nativeControls fullscreenOptions={{ enable: true }} />;
}

// The still frame Twizzy uploads next to each video (same path, .jpg).
const posterOf = (path) => (path ? path.replace(/\.[a-z0-9]+$/i, '.jpg') : null);

export function MediaPreview({ post }) {
  const t = useTheme();
  const [playing, setPlaying] = useState(false);
  const isImage = post.media_kind === 'image';
  const url = useSignedUrl(playing || isImage ? post.media_path : null);
  const poster = useSignedUrl(!isImage && !playing ? posterOf(post.media_path) : null);
  const [stop] = useState(() => () => setPlaying(false));
  useEffect(() => () => { if (stopCurrent === stop) stopCurrent = null; }, [stop]);
  if (!post.media_path) {
    return (
      <View style={{ aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: t.input, alignItems: 'center', justifyContent: 'center' }}>
        <Body muted>{post.status === 'making' ? 'Twizzy is making this video…' : 'No video yet'}</Body>
      </View>
    );
  }
  if (isImage) return url ? <Image source={{ uri: url }} style={{ width: '100%', aspectRatio: 1, borderRadius: 14 }} resizeMode="contain" /> : <View style={{ aspectRatio: 1, borderRadius: 14, backgroundColor: t.input }} />;
  if (playing && url) return <Video url={url} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Play video"
      onPress={() => { stopCurrent?.(); stopCurrent = stop; setPlaying(true); }}
      style={{ width: '100%', aspectRatio: 9 / 16, maxHeight: 420, borderRadius: 14, backgroundColor: '#0d1a13', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
    >
      {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,.55)', alignItems: 'center', justifyContent: 'center' }}>
        {playing ? <ActivityIndicator color="#fff" /> : <Ionicons name="play" size={34} color="#fff" style={{ marginLeft: 4 }} />}
      </View>
      {!poster ? <Body small color="rgba(255,255,255,.7)" style={{ marginTop: 10 }}>Tap to play</Body> : null}
    </Pressable>
  );
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
