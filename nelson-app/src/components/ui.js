import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { C, TONE } from '../theme';
import { useNelson } from '../nelson';
import { timeAgo } from '../format';

export function Screen({ children }) {
  const { refresh, error, lastOk } = useNelson();
  const [pulling, setPulling] = useState(false);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={styles.screen}
      refreshControl={
        <RefreshControl
          refreshing={pulling}
          tintColor={C.gold}
          colors={[C.gold]}
          onRefresh={async () => {
            setPulling(true);
            await refresh();
            setPulling(false);
          }}
        />
      }
    >
      {error ? (
        <Banner tone="bad" icon="cloud-offline">
          {error}
          {lastOk ? `  (last update ${timeAgo(new Date(lastOk).toISOString())})` : ''}
        </Banner>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, title, right }) {
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function T({ children, muted, small, bold, big, color, style, mono, ...rest }) {
  return (
    <Text
      style={[
        { color: color || (muted ? C.muted : C.text), fontSize: big ? 28 : small ? 12 : 15 },
        bold && { fontWeight: '700' },
        big && { fontWeight: '800' },
        mono && { fontVariant: ['tabular-nums'] },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

export function Row({ label, value, color, sub }) {
  return (
    <View style={styles.row}>
      <T muted style={{ flex: 1 }}>{label}</T>
      <View style={{ alignItems: 'flex-end' }}>
        <T bold mono color={color}>{value}</T>
        {sub ? <T small muted>{sub}</T> : null}
      </View>
    </View>
  );
}

export function Pill({ children, tone = 'neutral', icon }) {
  const t = TONE[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={t.fg} style={{ marginRight: 4 }} /> : null}
      <Text style={{ color: t.fg, fontSize: 12, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}

export function Banner({ children, tone = 'info', icon = 'information-circle' }) {
  const t = TONE[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg, borderColor: t.fg }]}>
      <Ionicons name={icon} size={18} color={t.fg} style={{ marginRight: 8, marginTop: 1 }} />
      <Text style={{ color: t.fg, flex: 1, fontSize: 14 }}>{children}</Text>
    </View>
  );
}

export function Button({ title, onPress, tone = 'gold', icon, disabled, outline, style }) {
  const t = TONE[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        outline ? { borderWidth: 1.5, borderColor: t.fg, backgroundColor: 'transparent' } : { backgroundColor: t.fg },
        (pressed || disabled) && { opacity: 0.6 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={outline ? t.fg : C.bg} style={{ marginRight: 8 }} /> : null}
      <Text style={{ color: outline ? t.fg : C.bg, fontWeight: '800', fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Empty({ icon = 'hourglass-outline', children }) {
  return (
    <View style={{ alignItems: 'center', padding: 24 }}>
      <Ionicons name={icon} size={30} color={C.muted} />
      <T muted style={{ marginTop: 8, textAlign: 'center' }}>{children}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 40, gap: 12 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { color: C.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  banner: { flexDirection: 'row', padding: 12, borderRadius: 12, borderWidth: 1 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12 },
});
