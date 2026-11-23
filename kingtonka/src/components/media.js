// Clip previews from Supabase storage, and saving / sharing them.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useEvent } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { db } from '../supabase';
import { BUCKET, previewOf } from '../data';
import { Body, Button, Row } from './ui';
import { useTheme } from '../theme';

// Not available on web, where saving opens a download link instead.
const MediaLibrary = Platform.OS === 'web' ? null : require('expo-media-library');

export function useSignedUrl(path) {
  const [signed, setSigned] = useState({});
  useEffect(() => {
    let live = true;
    if (path) {
      db().storage.from(BUCKET).createSignedUrl(path, 3600)
        .then(({ data, error }) => live && setSigned({ path, url: data?.signedUrl || null, error: error ? error.message || 'not found' : null }))
        .catch((e) => live && setSigned({ path, url: null, error: e.message || 'network error' }));
    }
    return () => { live = false; };
  }, [path]);
  return signed.path === path ? signed : { url: null, error: null };
}

export function Thumb({ path, style, children }) {
  const t = useTheme();
  const { url } = useSignedUrl(path);
  return (
    <View style={[{ backgroundColor: t.dark ? '#211a35' : '#ddd6f3', overflow: 'hidden' }, style]}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      {children}
    </View>
  );
}

const ratioOf = (aspect) => ({ '1:1': 1, '4:5': 4 / 5, '16:9': 16 / 9 }[aspect] || 9 / 16);

// Only one clip plays at a time; the others show their still frame.
let stopCurrent = null;

function Player({ url, aspect, poster }) {
  // Loaded first, started after: the sound never runs ahead of a picture that isn't there yet.
  const player = useVideoPlayer(url, (p) => { p.loop = true; });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status, error: null });
  const [drawn, setDrawn] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (status === 'readyToPlay' && !started.current) {
      started.current = true;
      player.play();
    }
  }, [status, player]);
  if (status === 'error') {
    return (
      <View style={{ gap: 8 }}>
        <Body small>{error?.message || 'The phone could not play this clip.'}</Body>
        <Button small kind="plain" icon="open-outline" title="Open in browser" onPress={() => Linking.openURL(url)} />
      </View>
    );
  }
  return (
    <View style={{ width: '100%', aspectRatio: ratioOf(aspect), maxHeight: 560, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' }}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls fullscreenOptions={{ enable: true }}
        onFirstFrameRender={() => setDrawn(true)} />
      {drawn ? null : (
        // The still frame stays on top until the video has drawn its first picture.
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Thumb path={poster} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator color="#fff" />
          </Thumb>
        </View>
      )}
    </View>
  );
}

export function ClipPlayer({ clip }) {
  const t = useTheme();
  // Remembers which file is playing, so a re-rendered clip starts on its still frame.
  const [playingPath, setPlayingPath] = useState(null);
  const playing = !!clip.media_path && playingPath === clip.media_path;
  // Watch the light copy (smooth on a phone connection); older clips without one play the full clip.
  const light = useSignedUrl(playing ? previewOf(clip.media_path) : null);
  const full = useSignedUrl(playing && light.error ? clip.media_path : null);
  const url = light.url || full.url;
  const error = light.error && full.error;
  const [stop] = useState(() => () => setPlayingPath(null));
  useEffect(() => () => { if (stopCurrent === stop) stopCurrent = null; }, [stop]);
  const aspect = clip.style?.aspect || '9:16';
  if (!clip.media_path) {
    return (
      <View style={{ width: '100%', aspectRatio: ratioOf(aspect), maxHeight: 420, borderRadius: 14, backgroundColor: t.input, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {clip.status === 'failed' ? <Ionicons name="alert-circle-outline" size={28} color={t.danger} /> : <ActivityIndicator color={t.primary} />}
        <Body muted small>{clip.status === 'failed' ? 'This clip didn’t render.' : 'Rendering this clip…'}</Body>
      </View>
    );
  }
  if (playing && error) return <Body small color={t.danger}>Couldn’t load the clip: {error}</Body>;
  if (playing && url) return <Player url={url} aspect={aspect} poster={clip.thumb_path} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Play clip"
      onPress={() => { stopCurrent?.(); stopCurrent = stop; setPlayingPath(clip.media_path); }}
    >
      <Thumb path={clip.thumb_path} style={{ width: '100%', aspectRatio: ratioOf(aspect), maxHeight: 560, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,.55)', alignItems: 'center', justifyContent: 'center' }}>
          {playing ? <ActivityIndicator color="#fff" /> : <Ionicons name="play" size={34} color="#fff" style={{ marginLeft: 4 }} />}
        </View>
      </Thumb>
    </Pressable>
  );
}

const fileName = (clip) =>
  'kingtonka-' + (clip.title || 'clip').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) + '.mp4';

async function downloadToCache(clip) {
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(clip.media_path, 600);
  if (error) throw error;
  const dest = new File(Paths.cache, fileName(clip));
  if (dest.exists) dest.delete();
  return File.downloadFileAsync(data.signedUrl, dest);
}

async function openInBrowser(clip) {
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(clip.media_path, 3600, { download: fileName(clip) });
  if (error) throw error;
  await Linking.openURL(data.signedUrl);
}

export async function saveToPhone(clip) {
  if (Platform.OS === 'web') {
    await openInBrowser(clip);
    return true;
  }
  const { granted } = await MediaLibrary.requestPermissionsAsync(true, ['video']);
  if (!granted) { Alert.alert('Allow King Tonka to save', 'King Tonka needs permission to save clips to your gallery.'); return false; }
  const file = await downloadToCache(clip);
  await MediaLibrary.Asset.create(file.uri);
  return true;
}

export async function shareClip(clip) {
  if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) return saveToPhone(clip);
  const file = await downloadToCache(clip);
  await Sharing.shareAsync(file.uri, { mimeType: 'video/mp4', dialogTitle: 'Share to TikTok, X, Instagram or YouTube' });
  return true;
}

export function ClipActions({ clip, toast }) {
  if (!clip.media_path) return null;
  return (
    <Row>
      <Button small icon="download-outline" title="Save to phone" onPress={async () => {
        try {
          if (await saveToPhone(clip)) toast('Saved to your gallery.');
        } catch (e) {
          try { await openInBrowser(clip); toast('Opening the download in your browser…'); } catch (e2) { toast('Couldn’t download: ' + (e2.message || e.message || e)); }
        }
      }} />
      <Button small kind="plain" icon="share-social-outline" title="Share" onPress={async () => {
        try { await shareClip(clip); } catch (e) { toast('Couldn’t share: ' + (e.message || e)); }
      }} />
    </Row>
  );
}
