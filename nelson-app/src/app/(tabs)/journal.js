import { View } from 'react-native';
import { useNelson } from '../../nelson';
import { Card, Empty, Screen, T } from '../../components/ui';
import { C, TONE } from '../../theme';
import { journalText, journalTone, timeAgo } from '../../format';

export default function Journal() {
  const { snap: s } = useNelson();
  const rows = s?.journal || [];
  return (
    <Screen>
      <Card title="Every decision Nelson made">
        {!rows.length ? <Empty icon="document-text">Nothing yet.</Empty> : null}
        {rows.map((r, i) => {
          const tone = TONE[journalTone(r.event, r.pnl)];
          const showDetails = r.details && !['skipped', 'blocked', 'cancel', 'flatten', 'risk', 'start', 'pause', 'resume', 'closeall'].includes(r.event);
          return (
            <View key={`${r.logged_utc}-${i}`} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <View style={{ width: 4, borderRadius: 2, backgroundColor: tone.fg, marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <T>{journalText(r)}</T>
                {showDetails ? <T small muted style={{ marginTop: 2 }}>{r.details}</T> : null}
                <T small muted style={{ marginTop: 2 }}>{timeAgo(r.logged_utc.replace(' ', 'T'))}</T>
              </View>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
