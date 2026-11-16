// The clip options: used for a new video, for your defaults, and when editing one clip.
import { Pressable, Switch, View } from 'react-native';
import { Body, Chips, Field, Label, Row } from './ui';
import { useTheme } from '../theme';

export const FALLBACK = {
  clips: 'auto', length: 'auto', aspect: '9:16', captions: 'bold', position: 'middle',
  framing: 'auto', hook_title: true, color: '#FFD400', language: 'auto', watermark: '',
};

export const OPTIONS = {
  clips: [['auto', 'Auto'], [3, '3'], [5, '5'], [10, '10'], [15, '15']],
  length: [['auto', 'Auto (30–90 s)'], ['short', '15–30 s'], ['medium', '30–60 s'], ['long', '60–90 s'], ['xl', '90 s–3 min']],
  aspect: [['9:16', '9:16 Vertical'], ['1:1', '1:1 Square'], ['4:5', '4:5 Portrait'], ['16:9', '16:9 Wide']],
  captions: [['bold', 'Bold'], ['pop', 'Pop'], ['karaoke', 'Karaoke'], ['clean', 'Clean'], ['none', 'None']],
  position: [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']],
  framing: [['auto', 'Follow speaker'], ['fit', 'Fit (blur)'], ['left', 'Left'], ['center', 'Center'], ['right', 'Right']],
  language: [['auto', 'Auto'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['pt', 'Portuguese'], ['ny', 'Chichewa'], ['sw', 'Swahili']],
};
const COLORS = ['#FFD400', '#00E676', '#FF3D71', '#3DA5FF', '#FFFFFF', '#FF8A00', '#B388FF'];

export const label = (key, value) => (OPTIONS[key]?.find(([v]) => v === value) || [, String(value)])[1];

function Swatches({ value, onChange }) {
  const t = useTheme();
  return (
    <Row>
      {COLORS.map((c) => (
        <Pressable key={c} accessibilityLabel={`Highlight colour ${c}`} onPress={() => onChange(c)}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, borderWidth: value?.toUpperCase() === c ? 3 : 1, borderColor: value?.toUpperCase() === c ? t.primary : t.line }} />
      ))}
    </Row>
  );
}

// Look of the clip: shared by new videos, defaults and the clip editor.
export function StyleForm({ value, onChange, hideAspect }) {
  const t = useTheme();
  const set = (k) => (v) => onChange({ ...value, [k]: v });
  return (
    <View style={{ gap: 12 }}>
      {!hideAspect ? <View style={{ gap: 6 }}><Label>Shape</Label><Chips options={OPTIONS.aspect} value={value.aspect} onChange={set('aspect')} /></View> : null}
      <View style={{ gap: 6 }}><Label>Captions</Label><Chips options={OPTIONS.captions} value={value.captions} onChange={set('captions')} /></View>
      {value.captions !== 'none' ? (
        <>
          <View style={{ gap: 6 }}><Label>Caption position</Label><Chips options={OPTIONS.position} value={value.position || 'middle'} onChange={set('position')} /></View>
          <View style={{ gap: 6 }}><Label>Highlight colour</Label><Swatches value={value.color} onChange={set('color')} /></View>
        </>
      ) : null}
      <View style={{ gap: 6 }}><Label>Framing</Label><Chips options={OPTIONS.framing} value={value.framing} onChange={set('framing')} /></View>
      <Row style={{ justifyContent: 'space-between' }} wrap={false}>
        <View style={{ flex: 1 }}>
          <Body>Hook title</Body>
          <Body small muted>The hook as a title for the first 3 seconds</Body>
        </View>
        <Switch value={value.hook_title !== false} onValueChange={set('hook_title')} trackColor={{ true: t.primary }} />
      </Row>
      <Field label="Watermark (optional)" value={value.watermark || ''} onChangeText={set('watermark')} placeholder="@yourhandle" autoCapitalize="none" />
    </View>
  );
}

// Everything for a new video.
export function ProjectForm({ value, onChange }) {
  const set = (k) => (v) => onChange({ ...value, [k]: v });
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}><Label>Number of clips</Label><Chips options={OPTIONS.clips} value={value.clips} onChange={set('clips')} /></View>
      <View style={{ gap: 6 }}><Label>Clip length</Label><Chips options={OPTIONS.length} value={value.length} onChange={set('length')} /></View>
      <View style={{ gap: 6 }}><Label>Language spoken</Label><Chips options={OPTIONS.language} value={value.language || 'auto'} onChange={set('language')} /></View>
      <StyleForm value={value} onChange={onChange} />
    </View>
  );
}
