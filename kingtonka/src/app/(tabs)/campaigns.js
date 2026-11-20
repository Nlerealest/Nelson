// Paid clipping campaigns (Content Rewards, Reach, Whop…): what each one pays,
// how your clips for it are doing, and which ones still need submitting.
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { needsDbUpdate, useRows } from '../../data';
import { Body, Button, Card, Empty, Loading, Pill, Row, Screen, Section } from '../../components/ui';
import { DbUpdateNeeded, useCampaignStats } from '../../components/campaigns';
import { useTheme } from '../../theme';

function CampaignCard({ c, s }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => router.push(`/campaign/${c.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }} wrap={false}>
          <Body bold style={{ flex: 1, fontSize: 17 }} numberOfLines={2}>{c.name}</Body>
          {c.rate ? <Pill label={`$${Number(c.rate).toFixed(2)} / 1K`} tone="ok" /> : null}
        </Row>
        <Body small muted>
          {[c.creator, c.min_views ? `paid from ${Number(c.min_views).toLocaleString()} views` : null,
            (c.platforms || []).length ? (c.platforms || []).join(', ') : null].filter(Boolean).join(' · ') || 'Tap to add the details'}
        </Body>
        <Body small>
          {s ? `${s.clips} clips · ${s.posted} posted · ${s.submitted} submitted` : 'No clips yet'}
        </Body>
        {s?.toSubmit ? (
          <Row><Ionicons name="alarm-outline" size={16} color={t.warn} /><Body small bold color={t.warn}>{s.toSubmit} posted clip{s.toSubmit === 1 ? '' : 's'} not submitted yet</Body></Row>
        ) : null}
      </Card>
    </Pressable>
  );
}

export default function Campaigns() {
  const campaigns = useRows('kt_campaigns');
  const stats = useCampaignStats();
  const active = (campaigns.rows || []).filter((c) => c.active !== false);
  const ended = (campaigns.rows || []).filter((c) => c.active === false);

  return (
    <Screen onRefresh={campaigns.reload}>
      {needsDbUpdate(campaigns.error) ? <DbUpdateNeeded /> : campaigns.error ? <Loading error={campaigns.error} /> : null}
      <Card>
        <Body bold style={{ fontSize: 18 }}>Get paid for your clips</Body>
        <Body small muted>
          Save each campaign you join (Content Rewards, Reach, Whop…). Link a video to it, and King Tonka follows its rules,
          adds its hashtags to your captions, and reminds you to submit each post within 30 minutes.
        </Body>
        <Row><Button icon="add" title="Add campaign" disabled={needsDbUpdate(campaigns.error)} onPress={() => router.push('/campaign/new')} /></Row>
      </Card>
      {!campaigns.rows && !campaigns.error ? <Loading /> : null}
      {campaigns.rows && !campaigns.rows.length ? (
        <Empty icon="cash-outline" title="No campaigns yet">Join a campaign on Content Rewards, then tap Add campaign and paste its link and rules.</Empty>
      ) : null}
      {active.map((c) => <CampaignCard key={c.id} c={c} s={stats[c.id]} />)}
      {ended.length ? (
        <>
          <Section>Ended</Section>
          <View style={{ gap: 12, opacity: 0.7 }}>{ended.map((c) => <CampaignCard key={c.id} c={c} s={stats[c.id]} />)}</View>
        </>
      ) : null}
    </Screen>
  );
}
