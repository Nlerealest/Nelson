// The voices Twizzy can speak with (Kokoro, free and open), with a sample of each.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { Body } from './ui';
import { useTheme } from '../theme';

const SAMPLES = 'https://raw.githubusercontent.com/Nlerealest/Nelson/claude/malawi-money-management-knal4c/marketing/voices/';

export const VOICES = [
  { id: 'af_heart', name: 'Grace', gender: 'Woman', accent: 'American', style: 'Warm and friendly' },
  { id: 'af_bella', name: 'Bella', gender: 'Woman', accent: 'American', style: 'Bright and energetic' },
  { id: 'af_nicole', name: 'Nicole', gender: 'Woman', accent: 'American', style: 'Soft and close, like a voice note' },
  { id: 'af_kore', name: 'Kore', gender: 'Woman', accent: 'American', style: 'Confident and clear' },
  { id: 'bf_emma', name: 'Emma', gender: 'Woman', accent: 'British', style: 'Calm and polished' },
  { id: 'am_michael', name: 'Michael', gender: 'Man', accent: 'American', style: 'Friendly and easy-going' },
  { id: 'am_fenrir', name: 'Fenrir', gender: 'Man', accent: 'American', style: 'Deep and strong' },
  { id: 'am_puck', name: 'Puck', gender: 'Man', accent: 'American', style: 'Upbeat and playful' },
  { id: 'bm_george', name: 'George', gender: 'Man', accent: 'British', style: 'Mature and trustworthy' },
  { id: 'bm_fable', name: 'Fable', gender: 'Man', accent: 'British', style: 'Storyteller' },
];

export const voiceName = (id) => VOICES.find((v) => v.id === id)?.name || id;

// A list of voices: tap ▶ to hear a sample, tap the row to choose it.
export function VoicePicker({ value, onChange }) {
  const t = useTheme();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [playing, setPlaying] = useState(null);
  const toggle = (id) => {
    if (playing === id && status.playing) { player.pause(); return; }
    if (playing === id) { player.seekTo(0); player.play(); return; }
    player.replace({ uri: `${SAMPLES}${id}.mp3` });
    player.play();
    setPlaying(id);
  };
  return (
    <View style={{ gap: 8 }}>
      {VOICES.map((v) => {
        const on = value === v.id;
        return (
          <Pressable key={v.id} onPress={() => onChange(v.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: on ? t.primary : t.line, backgroundColor: on ? t.primarySoft : 'transparent' }}>
            <Pressable onPress={() => toggle(v.id)} hitSlop={8} accessibilityLabel={`Play ${v.name}`}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={playing === v.id && status.playing ? 'pause' : 'play'} size={18} color={t.dark ? '#08130d' : '#fff'} style={{ marginLeft: playing === v.id && status.playing ? 0 : 2 }} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Body bold>{v.name} <Body small muted>· {v.gender}, {v.accent}</Body></Body>
              <Body small muted>{v.style}</Body>
            </View>
            <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? t.primary : t.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}
