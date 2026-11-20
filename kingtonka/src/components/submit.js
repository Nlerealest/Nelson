// The "get paid" checklist on a campaign clip: post it, save the post's link,
// submit that link on the campaign within 30 minutes (with a phone reminder).
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { logYou, needsDbUpdate, submitMinutesLeft, SUBMIT_WINDOW_MIN, update } from '../data';
import { findLink } from '../links';
import { cancelSubmitReminder, remindToSubmit } from '../submitReminder';
import { Body, Button, Card, Field, Row } from './ui';
import { useTheme } from '../theme';

const SOCIAL = /tiktok\.com|youtube\.com|youtu\.be|instagram\.com|(^|\/\/|\.)x\.com|twitter\.com|facebook\.com|fb\.watch/i;
const PLATFORM_NAMES = { tiktok: 'TikTok', youtube: 'YouTube Shorts', instagram: 'Instagram Reels', x: 'X' };
const time = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function Step({ n, done, title, children }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? t.ok : t.primarySoft }}>
        {done ? <Ionicons name="checkmark" size={16} color="#fff" /> : <Body small bold color={t.primary}>{n}</Body>}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Body bold>{title}</Body>
        {children}
      </View>
    </View>
  );
}

export function SubmitSteps({ clip, campaign, toast }) {
  const t = useTheme();
  const [link, setLink] = useState(clip.post_url || '');
  const [now, setNow] = useState(() => Date.now());
  const [showRules, setShowRules] = useState(false);
  // Keep the countdown fresh while this screen is open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(timer);
  }, []);

  const found = findLink(link);
  const changed = (found || '') !== (clip.post_url || '');
  const left = submitMinutesLeft(clip, now);
  const where = (campaign.platforms || []).map((p) => PLATFORM_NAMES[p] || p).join(', ') || 'TikTok, YouTube Shorts, Reels or X';

  const fail = (e) => toast(needsDbUpdate(e) ? 'Run the one-time database update first (the Campaigns tab shows how).' : 'Couldn’t save: ' + (e.message || e));
  const savePosted = async () => {
    const posted_at = clip.posted_at || new Date().toISOString();
    try {
      await update('kt_clips', clip.id, { post_url: found, posted_at });
    } catch (e) {
      return fail(e);
    }
    if (clip.submitted_at) return toast('Link updated.');
    const reminded = await remindToSubmit({ ...clip, posted_at }, campaign.name);
    toast(reminded ? 'Saved. Now submit it. I’ll remind you in 20 minutes.' : `Saved. Now submit it within ${SUBMIT_WINDOW_MIN} minutes.`);
  };
  const openCampaign = async () => {
    await Clipboard.setStringAsync(clip.post_url);
    if (campaign.url) {
      await Linking.openURL(campaign.url);
      toast('Post link copied. Tap Submit clip there and paste it.');
    } else {
      toast('Post link copied. (Add the campaign’s link in Campaigns to open it from here.)');
    }
  };
  const markSubmitted = async (on) => {
    try {
      await update('kt_clips', clip.id, { submitted_at: on ? new Date().toISOString() : null });
    } catch (e) {
      return fail(e);
    }
    if (on) {
      cancelSubmitReminder(clip.id);
      logYou(`You submitted “${clip.title}” to ${campaign.name}`);
      toast('Submitted. Nice!');
    }
  };

  return (
    <Card>
      <Row><Ionicons name="cash-outline" size={18} color={t.ok} /><Body bold style={{ flex: 1 }}>Get paid: {campaign.name}</Body></Row>
      {campaign.rate || campaign.min_views ? (
        <Body small muted>
          {[campaign.rate ? `$${Number(campaign.rate).toFixed(2)} per 1,000 views` : null,
            campaign.min_views ? `paid once a clip reaches ${Number(campaign.min_views).toLocaleString()} views` : null].filter(Boolean).join(', ')}.
        </Body>
      ) : null}

      <Step n={1} done={!!clip.post_url} title="Post it">
        <Body small muted>Save to phone or Share (above), tap Copy caption, and post it on {where}. On YouTube, tick “Includes paid promotion”.</Body>
      </Step>

      <Step n={2} done={!!clip.post_url && !changed} title="Paste your post’s link">
        <Body small muted>In TikTok or YouTube, tap Share → Copy link on your post, then Paste here.</Body>
        <Row wrap={false}>
          <View style={{ flex: 1 }}><Field value={link} onChangeText={setLink} placeholder="https://www.tiktok.com/@you/video/…" autoCapitalize="none" keyboardType="url" /></View>
          <Button kind="plain" icon="clipboard-outline" title="Paste" onPress={async () => {
            const text = await Clipboard.getStringAsync();
            const got = findLink(text);
            if (got) setLink(got);
            else toast('Nothing to paste. Copy your post’s link first.');
          }} />
        </Row>
        {link.trim() && !found ? <Body small color={t.danger}>That isn’t a link.</Body> : null}
        {found && !SOCIAL.test(found) ? <Body small color={t.warn}>That doesn’t look like a TikTok, YouTube, Instagram or X post. Check it’s your post’s link.</Body> : null}
        {changed && found ? <Row><Button small icon="checkmark" title={clip.post_url ? 'Update link' : 'I posted it'} onPress={savePosted} /></Row> : null}
      </Step>

      <Step n={3} done={!!clip.submitted_at} title={`Submit it on the campaign within ${SUBMIT_WINDOW_MIN} minutes`}>
        {clip.submitted_at ? (
          <Row>
            <Body small color={t.ok}>Submitted at {time(clip.submitted_at)}. Views count from then.</Body>
            <Button small kind="plain" title="Undo" onPress={() => markSubmitted(false)} />
          </Row>
        ) : !clip.post_url ? (
          <Body small muted>Save your post’s link first.</Body>
        ) : (
          <>
            {left >= 0
              ? <Body small bold color={t.warn}>⏰ {left} minute{left === 1 ? '' : 's'} left (posted at {time(clip.posted_at)})</Body>
              : <Body small color={t.danger}>The {SUBMIT_WINDOW_MIN} minutes have passed. Submit anyway: some campaigns still accept it. Next time, submit right after posting.</Body>}
            <Row>
              <Button small icon="open-outline" title="Copy link & open campaign" onPress={openCampaign} />
              <Button small kind="soft" icon="checkmark-done" title="I submitted it" onPress={() => markSubmitted(true)} />
            </Row>
          </>
        )}
      </Step>

      {campaign.rules ? (
        <>
          <Button small kind="plain" icon={showRules ? 'chevron-up' : 'document-text-outline'} title={showRules ? 'Hide the campaign’s rules' : 'Show the campaign’s rules'} onPress={() => setShowRules(!showRules)} />
          {showRules ? <Body small selectable>{campaign.rules}</Body> : null}
        </>
      ) : null}
    </Card>
  );
}
