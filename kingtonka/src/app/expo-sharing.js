// Opens when you share a video to King Tonka (YouTube → Share → King Tonka).
// expo-sharing opens the app at kingtonka://expo-sharing and holds what was shared.
import { useState } from 'react';
import { Image, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useIncomingShare } from 'expo-sharing';
import { newProject, useConfig, useToast } from '../data';
import { Body, Button, Card, Empty, Field, Loading, Row, Screen } from '../components/ui';
import { FALLBACK, label, ProjectForm } from '../components/settings';
import { findLink, youtubeId } from '../links';
import { useTheme } from '../theme';

export default function SharedLink() {
  const t = useTheme();
  const toast = useToast();
  const { config, loaded } = useConfig();
  const { sharedPayloads, clearSharedPayloads } = useIncomingShare();
  const link = findLink(sharedPayloads.map((p) => p.value).join(' '));
  const ytId = youtubeId(link);
  const [edited, setOpts] = useState(null);
  const opts = edited || (loaded ? { ...FALLBACK, ...(config.defaults || {}) } : null);
  const [showOpts, setShowOpts] = useState(false);
  const [prompt, setPrompt] = useState('');

  const leave = () => {
    clearSharedPayloads();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const go = async () => {
    try {
      const p = await newProject({ url: link, settings: { ...opts, ...(prompt.trim() ? { prompt: prompt.trim() } : {}) } });
      clearSharedPayloads();
      toast('Got it. King Tonka starts within a minute.');
      router.replace(`/project/${p.id}`);
    } catch (e) {
      toast('Couldn’t start: ' + (e.message || e));
    }
  };

  if (!opts) return <Loading />;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Clip a video' }} />
      {!link ? (
        <>
          <Empty icon="link-outline" title="No video link in what you shared">
            Share the video itself: in YouTube, open the video, tap Share, then King Tonka.
          </Empty>
          <Button kind="plain" title="Go to King Tonka" onPress={leave} />
        </>
      ) : (
        <Card>
          <Body bold style={{ fontSize: 18 }}>Turn this video into clips?</Body>
          {ytId ? (
            <Image source={{ uri: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` }}
              style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: t.input }} />
          ) : null}
          <Body small muted numberOfLines={2}>{link}</Body>
          <Field value={prompt} onChangeText={setPrompt} placeholder="What to look for (optional): funny moments, money tips…" />
          <Button small kind="plain" icon="options-outline"
            title={showOpts ? 'Hide options' : [opts.clips === 'auto' ? 'Auto clips' : `${opts.clips} clips`, label('length', opts.length), opts.aspect, `${label('captions', opts.captions)} captions`].join(' · ')}
            onPress={() => setShowOpts(!showOpts)} />
          {showOpts ? <View style={{ gap: 12 }}><ProjectForm value={opts} onChange={setOpts} /></View> : null}
          <Row>
            <Button icon="flash" title="Get clips" onPress={go} />
            <Button kind="plain" title="Not now" onPress={leave} />
          </Row>
        </Card>
      )}
    </Screen>
  );
}
