import { Linking, Text, View } from 'react-native';
import { useApp, useSettings } from '../data';
import { BRAND, ORANGE, useTheme } from '../theme';
import { phoneDigits } from '../format';
import { Body, Button, Row } from './ui';
import { Ionicons } from '@expo/vector-icons';

export function Logo({ size = 76 }) {
  return (
    <View style={[{ backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }, { width: size, height: size, borderRadius: size * 0.26 }]}>
      <Text style={[{ color: '#fff', fontWeight: '900' }, { fontSize: size * 0.56 }]}>G</Text>
      <Ionicons name="airplane" size={size * 0.28} color={ORANGE} style={{ position: 'absolute', top: size * 0.1, right: size * 0.08, transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}


export function LiveDot() {
  const t = useTheme();
  const { live } = useApp();
  return (
    <Row style={{ gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live ? t.ok : t.warn }} />
      <Body small muted>{live ? 'Live' : 'Connecting…'}</Body>
    </Row>
  );
}

export function ContactButtons() {
  const s = useSettings();
  const phones = s.contacts?.phones || ['0884 099 227', '0881 737 157', '099 925 349'];
  const wa = s.contacts?.whatsapp || '265884099227';
  return (
    <Row>
      {phones.map((p) => <Button key={p} small kind="plain" icon="call" title={p} onPress={() => Linking.openURL(`tel:${phoneDigits(p)}`)} />)}
      <Button small kind="soft" icon="logo-whatsapp" title="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${wa}`)} />
    </Row>
  );
}

