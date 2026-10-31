// Small building blocks shared by every screen.
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { BRAND, useTheme } from '../theme';

export function Screen({ children, onRefresh }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={busy} onRefresh={async () => { setBusy(true); await onRefresh(); setBusy(false); }} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function H1({ children }) {
  const t = useTheme();
  return <Text style={[styles.h1, { color: t.text }]}>{children}</Text>;
}

export function Section({ children, right }) {
  const t = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.section, { color: t.muted }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Body({ children, muted, small, bold, style, color, selectable }) {
  const t = useTheme();
  return (
    <Text selectable={selectable} style={[{ color: color || (muted ? t.muted : t.text), fontSize: small ? 13 : 15, lineHeight: small ? 18 : 21 }, bold && { fontWeight: '700' }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, hero }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: hero ? BRAND : t.card, borderColor: hero ? BRAND : t.line }, style]}>{children}</View>;
}

export function Row({ children, style, wrap = true }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Button({ title, onPress, kind = 'primary', icon, disabled, small, style }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const c = {
    primary: { bg: t.primary, fg: t.dark ? '#08130d' : '#fff', bd: t.primary },
    plain: { bg: 'transparent', fg: t.text, bd: t.line },
    danger: { bg: 'transparent', fg: t.danger, bd: t.line },
    soft: { bg: t.primarySoft, fg: t.primary, bd: t.primarySoft },
  }[kind];
  const press = async () => {
    if (busy) return;
    setBusy(true);
    try { await onPress?.(); } finally { setBusy(false); }
  };
  return (
    <Pressable
      accessibilityRole="button"
      onPress={press}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.btn, small && styles.btnSmall, { backgroundColor: c.bg, borderColor: c.bd, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}
    >
      {busy ? <ActivityIndicator size="small" color={c.fg} /> : icon ? <Ionicons name={icon} size={small ? 15 : 17} color={c.fg} /> : null}
      <Text style={{ color: c.fg, fontWeight: '700', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

const TONES = { ok: 'primary', warn: 'warn', bad: 'danger', info: 'info', mute: 'muted' };
export function Pill({ label, tone = 'mute' }) {
  const t = useTheme();
  const k = TONES[tone];
  const bg = k === 'muted' ? t.line : t[`${k}Soft`];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={{ color: t[k], fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Field({ label, multiline, style, ...props }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.muted}
        multiline={multiline}
        style={[styles.input, { color: t.text, backgroundColor: t.input, borderColor: t.line }, multiline && { minHeight: 96, textAlignVertical: 'top' }, style]}
        {...props}
      />
    </View>
  );
}

export function Empty({ title, children, icon = 'sparkles-outline' }) {
  const t = useTheme();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28, gap: 6 }}>
      <Ionicons name={icon} size={28} color={t.muted} />
      <Body bold>{title}</Body>
      {children ? <Body muted small style={{ textAlign: 'center' }}>{children}</Body> : null}
    </Card>
  );
}

export function Loading({ error }) {
  const t = useTheme();
  return (
    <View style={{ padding: 32, alignItems: 'center', gap: 10 }}>
      {error ? <Body color={t.danger}>{error}</Body> : <ActivityIndicator color={t.primary} />}
    </View>
  );
}

export function Chips({ options, value, onChange }) {
  const t = useTheme();
  return (
    <Row>
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable key={v} onPress={() => onChange(v)} style={[styles.chip, { borderColor: on ? t.primary : t.line, backgroundColor: on ? t.primarySoft : 'transparent' }]}>
            <Text style={{ color: on ? t.primary : t.text, fontWeight: on ? '700' : '500', fontSize: 14 }}>{label}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12, paddingBottom: 48 },
  h1: { fontSize: 24, fontWeight: '800' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, borderWidth: 1 },
  btnSmall: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, alignSelf: 'flex-start' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  chip: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 },
});
