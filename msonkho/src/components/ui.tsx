// Shared building blocks, so every screen looks and behaves the same.

import type { ComponentProps, ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTyping } from '../lib/format.ts';
import { toneColors, useTheme } from '../theme.ts';
import type { Tone } from '../theme.ts';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------- Layout

export function Screen({
  children,
  contentStyle,
  scroll = true,
}: {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
}) {
  const t = useTheme();
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: t.bg }, contentStyle]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={[styles.screen, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const base = [styles.card, { backgroundColor: t.card, borderColor: t.line, shadowColor: t.shadow }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

export function Gap({ size = 12 }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.line, marginVertical: 4 }} />;
}

// ---------------------------------------------------------------- Text

type Variant = 'display' | 'title' | 'heading' | 'body' | 'small' | 'label' | 'number';

export function Txt({
  children,
  variant = 'body',
  color,
  muted,
  align,
  style,
  numberOfLines,
  selectable,
}: {
  children: ReactNode;
  variant?: Variant;
  color?: string;
  muted?: boolean;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[styles[variant], { color: color ?? (muted ? t.muted : t.text), textAlign: align }, style]}
    >
      {children}
    </Text>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  const t = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Txt variant="heading" style={{ flex: 1 }}>
        {title}
      </Txt>
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={10}>
          <Txt variant="small" color={t.primary} style={{ fontWeight: '700' }}>
            {action.label}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Controls

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  small,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const colors: Record<ButtonKind, { bg: string; fg: string; border: string }> = {
    primary: { bg: t.primary, fg: t.onPrimary, border: t.primary },
    secondary: { bg: t.primarySoft, fg: t.primary, border: t.primarySoft },
    ghost: { bg: 'transparent', fg: t.primary, border: t.line },
    danger: { bg: t.dangerSoft, fg: t.danger, border: t.dangerSoft },
  };
  const c = colors[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: c.bg, borderColor: c.border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={c.fg} /> : null}
      <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: c.fg }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.cardAlt, borderColor: t.line }]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && { backgroundColor: t.card, shadowColor: t.shadow, ...styles.segmentShadow }]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.segmentText, { color: selected ? t.primary : t.muted, fontWeight: selected ? '800' : '600' }]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? t.primarySoft : t.card,
          borderColor: selected ? t.primary : t.line,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={15} color={selected ? t.primary : t.muted} /> : null}
      <Text style={[styles.chipText, { color: selected ? t.primary : t.text }]}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={15} color={t.primary} /> : null}
    </Pressable>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.fieldLabel, { color: t.muted }]}>{children}</Text>;
}

/** A kwacha amount: digits only, with thousands separators as you type. */
export function MoneyInput({
  label,
  value,
  onChange,
  hint,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  hint?: string;
  autoFocus?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      <View style={[styles.moneyBox, { backgroundColor: t.cardAlt, borderColor: t.line }]}>
        <Text style={[styles.moneyPrefix, { color: t.muted }]}>K</Text>
        <TextInput
          value={value}
          onChangeText={(text) => onChange(formatTyping(text))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="0"
          placeholderTextColor={t.faint}
          autoFocus={autoFocus}
          accessibilityLabel={label}
          style={[styles.moneyInput, { color: t.text }, Platform.OS === 'web' && { outlineWidth: 0 }]}
        />
      </View>
      {hint ? (
        <Txt variant="small" muted>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  maxLength,
}: {
  label?: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: ComponentProps<typeof TextInput>['keyboardType'];
  autoCapitalize?: ComponentProps<typeof TextInput>['autoCapitalize'];
  maxLength?: number;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.faint}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        maxLength={maxLength}
        accessibilityLabel={label ?? placeholder}
        style={[
          styles.field,
          { backgroundColor: t.cardAlt, borderColor: t.line, color: t.text },
          multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
          Platform.OS === 'web' && { outlineWidth: 0 },
        ]}
      />
    </View>
  );
}

export function SwitchRow({
  title,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontWeight: '700' }}>{title}</Txt>
        {subtitle ? (
          <Txt variant="small" muted>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: t.primary, false: t.line }}
        thumbColor="#ffffff"
        accessibilityLabel={title}
      />
    </View>
  );
}

// ---------------------------------------------------------------- Display

export function IconBubble({ name, tone = 'primary', size = 40 }: { name: IconName; tone?: Tone; size?: number }) {
  const t = useTheme();
  const c = toneColors(t, tone);
  return (
    <View style={[styles.bubble, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: c.bg }]}>
      <Ionicons name={name} size={size * 0.52} color={c.fg} />
    </View>
  );
}

export function ListRow({
  icon,
  tone,
  title,
  subtitle,
  onPress,
  right,
}: {
  icon?: IconName;
  tone?: Tone;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const t = useTheme();
  const body = (
    <>
      {icon ? <IconBubble name={icon} tone={tone} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontWeight: '700' }}>{title}</Txt>
        {subtitle ? (
          <Txt variant="small" muted>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={t.faint} /> : null)}
    </>
  );
  if (!onPress) return <View style={styles.listRow}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
}

export function Badge({ label, tone = 'primary' }: { label: string; tone?: Tone }) {
  const t = useTheme();
  const c = toneColors(t, tone);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function Callout({
  tone = 'info',
  icon,
  title,
  children,
}: {
  tone?: Tone;
  icon?: IconName;
  title?: string;
  children?: ReactNode;
}) {
  const t = useTheme();
  const c = toneColors(t, tone);
  return (
    <View style={[styles.callout, { backgroundColor: c.bg }]}>
      <Ionicons name={icon ?? 'information-circle'} size={20} color={c.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 4 }}>
        {title ? <Txt style={{ fontWeight: '800', color: c.fg }}>{title}</Txt> : null}
        {typeof children === 'string' ? (
          <Txt variant="small" color={t.text}>
            {children}
          </Txt>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

/** The big answer at the top of a calculator. */
export function ResultHero({ label, value, sub, tone = 'primary' }: { label: string; value: string; sub?: string; tone?: Tone }) {
  const t = useTheme();
  const c = toneColors(t, tone);
  return (
    <View style={[styles.hero, { backgroundColor: c.bg }]} accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.label, { color: c.fg }]}>{label}</Text>
      <Text style={[styles.heroValue, { color: c.fg }]} adjustsFontSizeToFit numberOfLines={1} selectable>
        {value}
      </Text>
      {sub ? <Txt variant="small" color={t.text}>{sub}</Txt> : null}
    </View>
  );
}

/** A label and an amount on one line. */
export function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: Tone }) {
  const t = useTheme();
  const color = tone ? toneColors(t, tone).fg : t.text;
  return (
    <View style={styles.row}>
      <Txt variant={strong ? 'body' : 'small'} muted={!strong} style={[{ flex: 1 }, strong && { fontWeight: '800' }]}>
        {label}
      </Txt>
      <Txt variant={strong ? 'body' : 'small'} color={color} style={{ fontWeight: strong ? '800' : '700', fontVariant: ['tabular-nums'] }} selectable>
        {value}
      </Txt>
    </View>
  );
}

export function Progress({ value, tone = 'primary' }: { value: number; tone?: Tone }) {
  const t = useTheme();
  const c = toneColors(t, tone);
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={[styles.progress, { backgroundColor: t.cardAlt, borderColor: t.line }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
      <View style={{ width: `${pct}%`, backgroundColor: c.fg, borderRadius: 999, height: '100%' }} />
    </View>
  );
}

export function Bullets({ items }: { items: string[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {items.map((item) => (
        <View key={item} style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[styles.dot, { backgroundColor: t.primary }]} />
          <Txt variant="small" style={{ flex: 1, lineHeight: 20 }}>
            {item}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 14, paddingBottom: 40 },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  display: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  number: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  button: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  buttonSmall: { minHeight: 40, paddingHorizontal: 14, borderRadius: 12 },
  buttonText: { fontSize: 16, fontWeight: '800' },
  segmented: { flexDirection: 'row', borderRadius: 14, padding: 4, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentShadow: { shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  segmentText: { fontSize: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 40,
  },
  chipText: { fontSize: 14, fontWeight: '700' },
  fieldLabel: { fontSize: 13, fontWeight: '700' },
  moneyBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 58 },
  moneyPrefix: { fontSize: 22, fontWeight: '800', marginRight: 6 },
  moneyInput: { flex: 1, fontSize: 24, fontWeight: '800', paddingVertical: 10, fontVariant: ['tabular-nums'] },
  field: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 50, fontSize: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bubble: { alignItems: 'center', justifyContent: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6, minHeight: 52 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  callout: { flexDirection: 'row', gap: 10, borderRadius: 16, padding: 14 },
  hero: { borderRadius: 18, padding: 16, gap: 4 },
  heroValue: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 },
  progress: { height: 12, borderRadius: 999, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
});
