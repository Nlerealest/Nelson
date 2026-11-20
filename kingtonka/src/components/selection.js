// Picking several clips or videos at once (for deleting).
import { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Row } from './ui';
import { useTheme } from '../theme';

// selected is null when not selecting, else a list of ids.
export function useSelection() {
  const [selected, setSelected] = useState(null);
  const selecting = selected !== null;
  const start = useCallback((ids = []) => setSelected(ids), []);
  const stop = useCallback(() => setSelected(null), []);
  const toggle = useCallback((id) => setSelected((s) => (s || []).includes(id) ? s.filter((x) => x !== id) : [...(s || []), id]), []);
  const isSelected = useCallback((id) => !!selected && selected.includes(id), [selected]);
  // The phone's back button leaves selecting first.
  useEffect(() => {
    if (!selecting) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setSelected(null); return true; });
    return () => sub.remove();
  }, [selecting]);
  return { selected: selected || [], selecting, start, stop, toggle, isSelected, set: setSelected };
}

export function confirmDelete(title, body, go) {
  if (Platform.OS === 'web') return go();
  Alert.alert(title, body, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
}

// The check mark on a tile or card while selecting.
export function Check({ on, style }) {
  const t = useTheme();
  return (
    <View style={[styles.check, { backgroundColor: on ? t.primary : 'rgba(0,0,0,.45)', borderColor: on ? t.primary : '#fff' }, style]}>
      {on ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
    </View>
  );
}

// Floating bar at the bottom while selecting.
export function SelectionBar({ count, noun, onAll, allLabel = 'Select all', onDelete, onDone }) {
  const t = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: t.card, borderColor: t.line }]}>
      <Row style={{ justifyContent: 'space-between' }} wrap={false}>
        <Body bold>{count ? `${count} ${noun}${count === 1 ? '' : 's'} selected` : `Tap ${noun}s to select`}</Body>
        <Button small kind="plain" title="Done" onPress={onDone} />
      </Row>
      <Row>
        {onAll ? <Button small kind="soft" icon="checkmark-done" title={allLabel} onPress={onAll} /> : null}
        <Button small kind="danger" icon="trash-outline" title={count ? `Delete ${count}` : 'Delete'} disabled={!count} onPress={onDelete} />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 16, borderWidth: 1, padding: 12, gap: 10, elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
});
