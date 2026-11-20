// Add or edit a paid clipping campaign, and see its clips.
import { useMemo, useState } from 'react';
import { Alert, Linking, Platform, Switch, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { insert, logYou, needsDbUpdate, remove, submitMinutesLeft, update, useRow, useRows, useToast } from '../../data';
import { Body, Button, Card, Chips, Field, Label, Loading, Row, Screen, Section } from '../../components/ui';
import { OPTIONS } from '../../components/settings';
import { DbUpdateNeeded, MultiChips, useCampaignStats } from '../../components/campaigns';
import { ClipTile, Grid } from '../../components/cards';
import { findLink } from '../../links';
import { useTheme } from '../../theme';

const PLATFORMS = [['tiktok', 'TikTok'], ['youtube', 'YouTube Shorts'], ['instagram', 'Instagram Reels'], ['x', 'X']];
const EMPTY = { name: '', url: '', creator: '', rate: '', min_views: '', platforms: [], hashtags: '', mentions: '', rules: '', length: 'auto', needs_face: false, active: true };

function Form({ campaign, onSaved }) {
  const t = useTheme();
  const toast = useToast();
  const [f, setF] = useState(() => ({
    ...EMPTY, ...(campaign || {}),
    rate: campaign?.rate != null ? String(campaign.rate) : '', min_views: campaign?.min_views != null ? String(campaign.min_views) : '',
    platforms: campaign?.platforms || [],
  }));
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const rate = f.rate.trim() ? Number(f.rate.replace(/[$,]/g, '')) : null;
  const minViews = f.min_views.trim() ? parseInt(f.min_views.replace(/[,\s]/g, ''), 10) : null;
  const bad = !f.name.trim() || (rate !== null && Number.isNaN(rate)) || (minViews !== null && Number.isNaN(minViews));

  const save = async () => {
    const row = {
      name: f.name.trim(), url: findLink(f.url) || f.url.trim() || null, creator: f.creator.trim() || null, rate, min_views: minViews,
      platforms: f.platforms, hashtags: f.hashtags.trim() || null, mentions: f.mentions.trim() || null, rules: f.rules.trim() || null,
      length: f.length || 'auto', needs_face: !!f.needs_face, active: f.active !== false,
    };
    try {
      if (campaign) await update('kt_campaigns', campaign.id, row);
      else {
        const saved = await insert('kt_campaigns', row);
        logYou(`You added the campaign “${row.name}”`);
        onSaved?.(saved);
      }
      toast('Campaign saved.');
    } catch (e) {
      toast(needsDbUpdate(e) ? 'Run the one-time database update first (see the yellow box).' : 'Couldn’t save: ' + e.message);
    }
  };

  return (
    <Card>
      <Field label="Name" value={f.name} onChangeText={set('name')} placeholder="e.g. Lacy 30 Day Campaign" />
      <View style={{ gap: 6 }}>
        <Label>Campaign link (where you submit clips)</Label>
        <Row wrap={false}>
          <View style={{ flex: 1 }}><Field value={f.url} onChangeText={set('url')} placeholder="https://contentrewards.com/…" autoCapitalize="none" keyboardType="url" /></View>
          <Button kind="plain" icon="clipboard-outline" title="Paste" onPress={async () => set('url')((await Clipboard.getStringAsync()).trim())} />
        </Row>
      </View>
      <Field label="Whose content you clip" value={f.creator} onChangeText={set('creator')} placeholder="e.g. Lacy" />
      <Row wrap={false}>
        <View style={{ flex: 1 }}><Field label="Pay per 1,000 views ($)" value={f.rate} onChangeText={set('rate')} placeholder="1.00" keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Views needed to get paid" value={f.min_views} onChangeText={set('min_views')} placeholder="1000" keyboardType="number-pad" /></View>
      </Row>
      <View style={{ gap: 6 }}><Label>Where you post</Label><MultiChips options={PLATFORMS} value={f.platforms} onChange={set('platforms')} /></View>
      <Field label="Hashtags every post must have" value={f.hashtags} onChangeText={set('hashtags')} placeholder="#lacy #reachclipping" autoCapitalize="none" />
      <Field label="Accounts to tag" value={f.mentions} onChangeText={set('mentions')} placeholder="@lacy" autoCapitalize="none" />
      <Field label="The campaign’s rules (paste its Content requirements)" value={f.rules} onChangeText={set('rules')} multiline
        placeholder="e.g. Only clips from Lacy’s streams. His face must be on screen. 15–60 seconds. No other streamers. Add captions." />
      <Body small muted>Claude reads these rules before picking clips for this campaign.</Body>
      <View style={{ gap: 6 }}><Label>Clip length</Label><Chips options={OPTIONS.length} value={f.length || 'auto'} onChange={set('length')} /></View>
      <Row style={{ justifyContent: 'space-between' }} wrap={false}>
        <View style={{ flex: 1 }}><Body>The creator must be on screen</Body><Body small muted>Only moments where they’re visible, framed on their face or webcam</Body></View>
        <Switch value={!!f.needs_face} onValueChange={set('needs_face')} trackColor={{ true: t.primary }} />
      </Row>
      <Row style={{ justifyContent: 'space-between' }} wrap={false}>
        <View style={{ flex: 1 }}><Body>Still running</Body><Body small muted>Turn off when the campaign ends or its budget runs out</Body></View>
        <Switch value={f.active !== false} onValueChange={set('active')} trackColor={{ true: t.primary }} />
      </Row>
      <Row><Button icon="save-outline" title={campaign ? 'Save changes' : 'Save campaign'} disabled={bad} onPress={save} /></Row>
      {bad && f.name.trim() ? <Body small color={t.danger}>Use plain numbers for pay and views, like 1.50 and 1000.</Body> : null}
    </Card>
  );
}

export default function Campaign() {
  const t = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';
  const { row: campaign, error } = useRow('kt_campaigns', isNew ? null : id);
  const projects = useRows('kt_projects').rows;
  const allClips = useRows('kt_clips').rows;
  const stats = useCampaignStats()[id];
  const clips = useMemo(() => {
    const mine = new Set((projects || []).filter((p) => p.settings?.campaign?.id === id).map((p) => p.id));
    return (allClips || []).filter((c) => mine.has(c.project_id))
      .sort((a, b) => (submitMinutesLeft(b) !== null) - (submitMinutesLeft(a) !== null) || (b.score || 0) - (a.score || 0));
  }, [projects, allClips, id]);

  if (needsDbUpdate(error)) return <Screen><DbUpdateNeeded /></Screen>;
  if (!isNew && campaign === undefined) return <Loading error={error} />;
  if (!isNew && !campaign) return <Screen><Body muted>This campaign was deleted.</Body></Screen>;

  const del = () => {
    const go = async () => {
      await remove('kt_campaigns', campaign.id);
      logYou(`You deleted the campaign “${campaign.name}”`);
      toast('Campaign deleted. Its clips stay in My clips.');
      router.back();
    };
    if (Platform.OS === 'web') return go();
    Alert.alert('Delete this campaign?', 'Its clips stay in My clips.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Add campaign' : (campaign.name || 'Campaign').slice(0, 28) }} />
      {!isNew ? (
        <Card>
          <Body bold>{stats ? `${stats.clips} clips · ${stats.posted} posted · ${stats.submitted} submitted` : 'No clips for this campaign yet'}</Body>
          {stats?.toSubmit ? <Body small bold color={t.warn}>{stats.toSubmit} posted clip{stats.toSubmit === 1 ? '' : 's'} still need submitting.</Body> : null}
          <Row>
            <Button icon="flash" title="Clip a video for it" onPress={() => router.push({ pathname: '/', params: { campaign: campaign.id } })} />
            {campaign.url ? <Button kind="plain" icon="open-outline" title="Open campaign" onPress={() => Linking.openURL(campaign.url)} /> : null}
          </Row>
        </Card>
      ) : (
        <Body small muted>Join the campaign on its website first. Then copy its details here, so King Tonka can follow them.</Body>
      )}
      <Form key={campaign?.id || 'new'} campaign={isNew ? null : campaign} onSaved={(saved) => router.replace(`/campaign/${saved.id}`)} />
      {!isNew && clips.length ? (
        <>
          <Section>Clips for this campaign</Section>
          <Grid>{clips.map((c) => <ClipTile key={c.id} clip={c} />)}</Grid>
        </>
      ) : null}
      {!isNew ? <Button kind="danger" icon="trash-outline" title="Delete campaign" onPress={del} /> : null}
    </Screen>
  );
}
