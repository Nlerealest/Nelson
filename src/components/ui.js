// Small building blocks shared by every screen and form.

import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { BRAND, useTheme } from '../theme';
import { formatKwacha as K, shortDate, toDateKey } from '../logic';
import { useData } from '../data';

export function Screen({ children, fab = true }) {
  const t = useTheme();
  const { openSheet } = useData();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {fab && (
        <Pressable
          accessibilityLabel="Add income or expense"
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
          onPress={() => openSheet('transaction')}
        >
          <Ionicons name="add" size={32} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

export function H1({ children, style }) {
  const t = useTheme();
  return <Text style={[styles.h1, { color: t.text }, style]}>{children}</Text>;
}

export function H2({ children, style }) {
  const t = useTheme();
  return <Text style={[styles.h2, { color: t.text }, style]}>{children}</Text>;
}

export function Section({ children }) {
  const t = useTheme();
  return <Text style={[styles.section, { color: t.muted }]}>{children}</Text>;
}

export function Body({ children, muted, small, bold, style, color }) {
  const t = useTheme();
  return (
    <Text
      style={[
        { color: color || (muted ? t.muted : t.text), fontSize: small ? 13 : 15, lineHeight: small ? 18 : 21 },
        bold && { fontWeight: '700' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Card({ children, style, hero, tone }) {
  const t = useTheme();
  const bg = hero ? (tone === 'danger' ? '#b3261e' : BRAND) : t.card;
  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: hero ? bg : t.line }, style]}>{children}</View>
  );
}

export function Tiles({ items }) {
  const t = useTheme();
  return (
    <View style={styles.tiles}>
      {items.map(({ label, value, tone, sub }) => (
        <View key={label} style={[styles.tile, { backgroundColor: t.card, borderColor: t.line }]}>
          <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
          <Text style={{ color: tone ? t[tone] : t.text, fontWeight: '700', fontSize: 15, marginTop: 2 }}>{value}</Text>
          {sub ? <Text style={{ color: t.muted, fontSize: 11, marginTop: 2 }}>{sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function Alert({ level = 'info', children }) {
  const t = useTheme();
  const map = {
    danger: [t.dangerSoft, t.danger],
    warning: [t.warnSoft, t.warn],
    tip: [t.infoSoft, t.info],
    info: [t.infoSoft, t.info],
  };
  const [bg, border] = map[level] || map.info;
  return (
    <View style={[styles.alert, { backgroundColor: bg, borderLeftColor: border }]}>
      {typeof children === 'string' ? <Body>{children}</Body> : children}
    </View>
  );
}

export function Alerts({ list }) {
  return list.map((a, i) => (
    <Alert key={i} level={a.level}>
      {a.message}
    </Alert>
  ));
}

export function Bar({ fraction, tone }) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, fraction || 0)) * 100;
  const color = tone === 'over' ? t.danger : tone === 'pace' ? t.warn : t.primary;
  return (
    <View style={[styles.bar, { backgroundColor: t.line }]}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 99 }} />
    </View>
  );
}

export function Chip({ label, tone = 'ok' }) {
  const t = useTheme();
  const map = {
    ok: [t.primarySoft, t.primary],
    paid: [t.primarySoft, t.primary],
    over: [t.dangerSoft, t.danger],
    overdue: [t.dangerSoft, t.danger],
    pace: [t.warnSoft, t.warn],
    'due-soon': [t.warnSoft, t.warn],
    upcoming: [t.infoSoft, t.info],
  };
  const [bg, fg] = map[tone] || map.ok;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Button({ title, onPress, kind = 'primary', small, block, icon, disabled, style }) {
  const t = useTheme();
  const colors = {
    primary: [BRAND, '#fff'],
    secondary: [t.primarySoft, t.primary],
    danger: [t.dangerSoft, t.danger],
    ghost: ['transparent', t.muted],
    light: ['rgba(255,255,255,0.18)', '#fff'],
  }[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        block && { alignSelf: 'stretch' },
        { backgroundColor: colors[0], opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={colors[1]} style={{ marginRight: 6 }} /> : null}
      <Text style={{ color: colors[1], fontWeight: '700', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Actions({ children, style }) {
  return <View style={[styles.actions, style]}>{children}</View>;
}

export function Row({ title, meta, right, onPress, children, last }) {
  const t = useTheme();
  const content = (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {title ? (
          <Text numberOfLines={1} style={{ color: t.text, fontWeight: '600', fontSize: 15 }}>
            {title}
          </Text>
        ) : null}
        {meta ? (
          typeof meta === 'string' ? <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{meta}</Text> : meta
        ) : null}
        {children}
      </View>
      {right}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Amount({ value, tone, sign = '', size = 15 }) {
  const t = useTheme();
  return (
    <Text style={{ color: tone ? t[tone] : t.text, fontWeight: '700', fontSize: size }}>
      {sign}
      {K(value)}
    </Text>
  );
}

export function Empty({ children }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, textAlign: 'center', paddingVertical: 20, lineHeight: 21 }}>{children}</Text>;
}

export function TransactionRow({ tx, today, onPress, last }) {
  const income = tx.type === 'income';
  return (
    <Row
      title={tx.note || tx.category}
      meta={`${tx.category} · ${shortDate(tx.date, today)} · ${tx.method || 'Cash'}`}
      right={<Amount value={tx.amount} sign={income ? '+' : '−'} tone={income ? 'primary' : undefined} />}
      onPress={onPress}
      last={last}
    />
  );
}

// ---------- form fields ----------

export function Label({ children }) {
  const t = useTheme();
  return <Text style={[styles.label, { color: t.muted }]}>{children}</Text>;
}

export function Field({ label, style, ...props }) {
  const t = useTheme();
  return (
    <View style={style}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text, backgroundColor: t.bg, borderColor: t.line }]}
        {...props}
      />
    </View>
  );
}

export function AmountField({ label = 'Amount (MWK)', value, onChangeText, autoFocus }) {
  return (
    <Field
      label={label}
      value={String(value ?? '')}
      onChangeText={(v) => onChangeText(v.replace(/[^0-9,.]/g, ''))}
      keyboardType="numeric"
      placeholder="K0"
      autoFocus={autoFocus}
    />
  );
}

export function amountValue(raw) {
  const n = Number(String(raw ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function Segmented({ options, value, onChange }) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.bg, borderColor: t.line }]}>
      {options.map(([key, label, tone]) => {
        const active = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && { backgroundColor: t.card }]}
          >
            <Text style={{ fontWeight: '700', color: active ? (tone ? t[tone] : t.primary) : t.muted }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A dropdown that expands in place. Nested modals misbehave on iOS, so the
// options open inside the current sheet instead.
export function Select({ label, value, options, onChange }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        style={[styles.input, styles.select, { backgroundColor: t.bg, borderColor: open ? t.primary : t.line }]}
      >
        <Text style={{ color: t.text, flex: 1 }}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={t.muted} />
      </Pressable>
      {open && (
        <View style={[styles.options, { borderColor: t.line, backgroundColor: t.card }]}>
          {options.map((o) => (
            <Pressable
              key={o}
              onPress={() => {
                onChange(o);
                setOpen(false);
              }}
              style={({ pressed }) => [styles.option, (pressed || o === value) && { backgroundColor: t.primarySoft }]}
            >
              <Text style={{ color: o === value ? t.primary : t.text, fontWeight: o === value ? '700' : '400' }}>{o}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export function DateField({ label = 'Date', value, onChange, maximumDate, minimumDate, optional }) {
  const t = useTheme();
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
  const pick = (_e, d) => d && onChange(toDateKey(d));

  if (Platform.OS === 'web') {
    return (
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        maxLength={10}
      />
    );
  }
  if (Platform.OS === 'ios') {
    return (
      <View>
        <Label>{label}</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {value || !optional ? (
            <DateTimePicker
              value={date}
              mode="date"
              display="compact"
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              onValueChange={pick}
              themeVariant={t.dark ? 'dark' : 'light'}
              style={{ alignSelf: 'flex-start' }}
            />
          ) : (
            <Button kind="secondary" small title="Choose date" onPress={() => onChange(toDateKey(minimumDate || new Date()))} />
          )}
          {optional && value ? <Button kind="ghost" small title="Clear" onPress={() => onChange('')} /> : null}
        </View>
      </View>
    );
  }
  return (
    <View>
      <Label>{label}</Label>
      <Pressable
        onPress={() =>
          DateTimePickerAndroid.open({ value: date, mode: 'date', maximumDate, minimumDate, onValueChange: pick })
        }
        style={[styles.input, styles.select, { backgroundColor: t.bg, borderColor: t.line }]}
      >
        <Text style={{ color: value ? t.text : t.muted, flex: 1 }}>{value ? shortDate(value) : 'Choose date'}</Text>
        <Ionicons name="calendar-outline" size={18} color={t.muted} />
      </Pressable>
      {optional && value ? <Button kind="ghost" small title="Clear date" onPress={() => onChange('')} /> : null}
    </View>
  );
}

export function Checkbox({ label, value, onChange }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}
    >
      <Ionicons name={value ? 'checkbox' : 'square-outline'} size={22} color={value ? t.primary : t.muted} />
      <Text style={{ color: t.text, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

export function Grid2({ children }) {
  return <View style={{ flexDirection: 'row', gap: 10 }}>{children.map((c, i) => <View key={i} style={{ flex: 1 }}>{c}</View>)}</View>;
}

const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 110 },
  h1: { fontSize: 22, fontWeight: '800', marginTop: 2, marginBottom: 12 },
  h2: { fontSize: 17, fontWeight: '700' },
  section: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  tiles: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tile: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10 },
  alert: { borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 4 },
  bar: { height: 8, borderRadius: 99, overflow: 'hidden', marginTop: 6, marginBottom: 4 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, alignSelf: 'flex-start' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  btnSmall: { minHeight: 34, paddingHorizontal: 10, borderRadius: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  label: { fontSize: 13, marginTop: 12, marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 46, fontSize: 16 },
  select: { flexDirection: 'row', alignItems: 'center' },
  options: { borderWidth: 1, borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  option: { paddingHorizontal: 12, paddingVertical: 11 },
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, padding: 3, gap: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8 },
});
