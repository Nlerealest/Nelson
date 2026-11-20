// Shared pieces for paid clipping campaigns.
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { submitMinutesLeft, useRows } from '../data';
import { Body, Card, Chips, Label, Row } from './ui';
import { useTheme } from '../theme';

export function DbUpdateNeeded() {
  const t = useTheme();
  return (
    <Card style={{ backgroundColor: t.warnSoft, borderColor: t.warnSoft }}>
      <Row><Ionicons name="construct-outline" size={18} color={t.warn} /><Body bold color={t.warn}>One-time update needed</Body></Row>
      <Body small>
        Campaigns need two new things in your database. In Supabase, open SQL Editor → New query, paste the file
        kingtonka/supabase/schema.sql from GitHub and click Run. It’s safe to run again. Then pull down here to refresh.
      </Body>
    </Card>
  );
}

// How each campaign's clips are doing, by campaign id.
export function useCampaignStats() {
  const projects = useRows('kt_projects').rows;
  const clips = useRows('kt_clips').rows;
  return useMemo(() => {
    const campaignOfProject = Object.fromEntries((projects || []).map((p) => [p.id, p.settings?.campaign?.id]));
    const stats = {};
    for (const c of clips || []) {
      const id = campaignOfProject[c.project_id];
      if (!id) continue;
      const s = (stats[id] ||= { clips: 0, ready: 0, posted: 0, submitted: 0, toSubmit: 0 });
      s.clips += 1;
      if (c.status === 'ready') s.ready += 1;
      if (c.posted_at) s.posted += 1;
      if (c.submitted_at) s.submitted += 1;
      if (submitMinutesLeft(c) !== null) s.toSubmit += 1;
    }
    return stats;
  }, [projects, clips]);
}

// Several choices at once (e.g. the platforms a campaign pays for).
export function MultiChips({ options, value = [], onChange }) {
  const t = useTheme();
  return (
    <Row>
      {options.map(([v, label]) => {
        const on = value.includes(v);
        return (
          <Pressable key={v} onPress={() => onChange(on ? value.filter((x) => x !== v) : [...value, v])}
            style={{ borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, borderColor: on ? t.primary : t.line, backgroundColor: on ? t.primarySoft : 'transparent' }}>
            <Text style={{ color: on ? t.primary : t.text, fontWeight: on ? '700' : '500', fontSize: 14 }}>{on ? '✓ ' : ''}{label}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

// "Which campaign is this video for?" on the Create and Share screens.
export function CampaignPicker({ value, onChange }) {
  const t = useTheme();
  const { rows } = useRows('kt_campaigns');
  const active = (rows || []).filter((c) => c.active !== false);
  if (!active.length) {
    return (
      <Pressable onPress={() => router.push('/campaigns')}>
        <Body small muted>Clipping for a paid campaign? <Text style={{ color: t.primary, fontWeight: '700' }}>Add it in Campaigns</Text> and King Tonka follows its rules.</Body>
      </Pressable>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      <Label>For a campaign?</Label>
      <Chips options={[['', 'None'], ...active.map((c) => [c.id, c.name])]} value={value || ''} onChange={(v) => onChange(v || null)} />
    </View>
  );
}
