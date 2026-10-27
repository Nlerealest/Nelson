import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useNelson } from '../nelson';
import { Banner, Button, Card, T } from '../components/ui';
import { C } from '../theme';
import { isInsecureRemote, normaliseUrl, parseConnectionQr } from '../format';
import { confirm } from '../confirm';
import NotifyCard from '../components/NotifyCard';

export default function Connect() {
  const { conn, connect, disconnect, snap } = useNelson();
  const params = useLocalSearchParams();
  const [url, setUrl] = useState(params.url ? String(params.url) : conn?.url || '');
  const [key, setKey] = useState(params.key ? String(params.key) : conn?.key || '');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [scanned, setScanned] = useState(params.key);

  // The QR scanner returns here with new params: copy them into the form once
  if (params.key && params.key !== scanned) {
    setScanned(params.key);
    setUrl(String(params.url || ''));
    setKey(String(params.key));
  }

  // Pasting the whole connection code (from nelson_app_link.txt) into either box fills both
  const pasteAware = (setter) => (text) => {
    const code = parseConnectionQr(String(text).trim());
    if (code) {
      setUrl(code.url);
      setKey(code.key);
    } else {
      setter(text);
    }
  };

  const clean = normaliseUrl(url);
  const save = async () => {
    setError('');
    setTesting(true);
    try {
      await connect(clean, key.trim());
      router.replace('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Card>
          <T bold style={{ fontSize: 18, marginBottom: 6 }}>Link this phone to Nelson</T>
          <T muted>
            On the PC run{'\n'}
            <T mono color={C.gold}>python run_nelson.py app-setup --url https://…</T>
            {'\n'}then scan the QR code it shows, or paste the connection code below.
          </T>
          <Button title="Scan QR code" icon="qr-code" style={{ marginTop: 14 }} onPress={() => router.push('/scan')} />
        </Card>

        <Card title="Or paste / type it in">
          <T small muted style={{ marginBottom: 10 }}>
            Tip: copy the connection code from nelson_app_link.txt on the PC and paste it into Address. Both boxes fill in.
          </T>
          <T small muted>Address</T>
          <TextInput
            value={url}
            onChangeText={pasteAware(setUrl)}
            placeholder="https://my-vps.tail1234.ts.net"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
          <T small muted style={{ marginTop: 10 }}>App key</T>
          <TextInput
            value={key}
            onChangeText={pasteAware(setKey)}
            placeholder="long secret from app-setup"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={styles.input}
          />
          {isInsecureRemote(clean) ? (
            <View style={{ marginTop: 10 }}>
              <Banner tone="warn" icon="warning">
                This address uses plain http over the internet, so your key could be read on the way. Use the https
                Tailscale address instead.
              </Banner>
            </View>
          ) : null}
          {error ? <View style={{ marginTop: 10 }}><Banner tone="bad" icon="alert-circle">{error}</Banner></View> : null}
          <Button
            title={testing ? 'Checking…' : 'Test and save'}
            icon="checkmark-circle"
            style={{ marginTop: 14 }}
            disabled={!clean || key.trim().length < 16 || testing}
            onPress={save}
          />
          {testing ? <ActivityIndicator color={C.gold} style={{ marginTop: 10 }} /> : null}
        </Card>

        {conn ? <NotifyCard notify={snap?.notify} /> : null}

        {conn ? (
          <Card title="Connected">
            <T muted>{conn.url}</T>
            <Button
              title="Disconnect this phone"
              tone="bad"
              outline
              icon="log-out"
              style={{ marginTop: 12 }}
              onPress={async () => {
                if (await confirm('Disconnect?', 'The app will forget the address and key. Nelson keeps trading.', 'Disconnect', true)) {
                  await disconnect();
                }
              }}
            />
          </Card>
        ) : null}

        <T small muted style={{ textAlign: 'center', marginTop: 8 }}>
          The key is stored encrypted on this phone. Anyone with it can pause Nelson or close its trades, so keep it private.
        </T>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: C.card2, color: C.text, borderRadius: 10, borderWidth: 1, borderColor: C.line,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, marginTop: 4,
  },
});
