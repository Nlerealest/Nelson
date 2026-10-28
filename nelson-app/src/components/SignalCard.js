import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Pill, T } from './ui';
import { C, TONE } from '../theme';
import { price, signalResult, signalStatus, timeAgo, utcClock, wouldBe } from '../format';

// One setup: levels, status, what it would have done if not traded, and the steps that found it
export default function SignalCard({ sig }) {
  const [open, setOpen] = useState(false);
  const st = signalStatus(sig.status);
  const result = signalResult(sig);
  const would = wouldBe(sig);
  const skipped = sig.kind === 'skipped';
  return (
    <Card style={skipped ? { opacity: 0.85 } : null}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button">
        <View style={styles.between}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Pill tone={sig.side === 'BUY' ? 'good' : 'bad'}>{sig.side}</Pill>
            <Pill tone={st.tone}>{skipped && sig.offline ? 'Skipped' : st.label}</Pill>
          </View>
          {result ? <T bold mono color={result.startsWith('-') ? C.red : C.green}>{result}</T> : (
            <T small muted>{timeAgo(sig.confirmed)}</T>
          )}
        </View>
        <T mono style={{ marginTop: 8 }}>
          Entry {price(sig.entry)} · SL {price(sig.sl)} · TP {price(sig.tp)}
        </T>
        <View style={[styles.between, { marginTop: 4 }]}>
          <T small muted>{utcClock(sig.confirmed)}{sig.level ? ` · swept ${sig.level}` : ''}</T>
          <T small color={C.gold}>{open ? 'Hide steps' : 'How it was found'}</T>
        </View>
        {sig.note && !sig.offline ? <T small muted style={{ marginTop: 4 }}>{skipped ? 'Skipped: ' : 'Note: '}{sig.note}</T> : null}
        {skipped && sig.offline ? <T small muted style={{ marginTop: 4 }}>Skipped: {sig.note}</T> : null}
        {would ? (
          <View style={[styles.would, { backgroundColor: TONE[would.tone].bg }]}>
            <T small bold color={TONE[would.tone].fg}>{would.label}</T>
            {would.result ? <T small bold mono color={TONE[would.tone].fg}>{would.result}</T> : null}
          </View>
        ) : null}
        {(sig.experience || []).length ? (
          <View style={{ marginTop: 6 }}>
            <T small muted>Nelson&apos;s record on setups like this:</T>
            {sig.experience.map((line) => <T key={line} small muted>• {line}</T>)}
          </View>
        ) : null}
      </Pressable>
      {open ? (
        <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
          {(sig.steps || []).map((step, i) => (
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 6 }}>
              <Ionicons name={step.off ? 'remove-circle-outline' : step.ok ? 'checkmark-circle' : 'close-circle'} size={20}
                color={step.off ? C.muted : step.ok ? C.green : C.red} style={{ marginRight: 10, marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <T bold>{step.title}</T>
                <T small muted>{step.detail}</T>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  would: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
});
