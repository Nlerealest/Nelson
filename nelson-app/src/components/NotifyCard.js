// Switches on phone alerts: opens the free ntfy app subscribed to this Nelson's private channel.
import { Linking } from 'react-native';
import { Button, Card, T } from './ui';
import { NTFY_PLAY_STORE, ntfyLinks } from '../format';
import { tell } from '../confirm';

export default function NotifyCard({ notify }) {
  if (!notify?.enabled || !notify.topic) {
    return (
      <Card title="Phone alerts">
        <T muted>
          Alerts are off. On the PC, run app-setup again (Part 5 of the guide) and restart Nelson: it creates your
          private alert channel.
        </T>
      </Card>
    );
  }
  const links = ntfyLinks(notify.server, notify.topic);
  const open = async () => {
    try {
      await Linking.openURL(links.app);
    } catch {
      tell('Install ntfy first', 'Alerts arrive through the free ntfy app. Install it, then tap this button again.');
      Linking.openURL(NTFY_PLAY_STORE);
    }
  };
  return (
    <Card title="Phone alerts">
      <T muted>
        Get a notification for every new signal, entry, take profit and stop loss, even when this app is closed.
        Alerts come through the free ntfy app.
      </T>
      <Button title="Turn on alerts" icon="notifications" style={{ marginTop: 12 }} onPress={open} />
      <Button title="Get the ntfy app" icon="logo-google-playstore" tone="gold" outline style={{ marginTop: 8 }}
        onPress={() => Linking.openURL(NTFY_PLAY_STORE)} />
      <T small muted style={{ marginTop: 10 }}>
        In ntfy, tap Subscribe when asked. Your private channel: {notify.topic}
      </T>
    </Card>
  );
}
