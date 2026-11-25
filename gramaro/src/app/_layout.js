import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { connect, forgetConnection, loadConnection, saveConnection } from '../supabase';
import { DataProvider, ToastProvider } from '../data';
import { BRAND, useTheme } from '../theme';
import { Body, Button, Card, Chips, Field, Row } from '../components/ui';
import { Logo } from '../components/brand';

function Gate({ title, children }) {
  const t = useTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 70, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Logo />
          <Text style={{ fontSize: 26, fontWeight: '800', color: t.text }}>Gramaro Travel</Text>
          <Body muted style={{ textAlign: 'center' }}>{title}</Body>
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ConnectScreen({ onDone }) {
  const [url, setUrl] = useState('');
  const [anon, setAnon] = useState('');
  return (
    <Gate title="One-time setup: connect to the Gramaro Supabase project">
      <Card>
        <Body small muted>In Supabase: Project Settings → API. Copy the Project URL and the anon / publishable key.</Body>
        <Field label="Project URL" value={url} onChangeText={setUrl} placeholder="https://xxxx.supabase.co" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Field label="anon public key" value={anon} onChangeText={setAnon} placeholder="eyJhbGciOi…" autoCapitalize="none" autoCorrect={false} multiline style={{ minHeight: 70 }} />
        <Button title="Connect" disabled={!url.startsWith('https://') || anon.length < 20} onPress={async () => onDone(await saveConnection(url, anon))} />
      </Card>
    </Gate>
  );
}

const friendly = (m) => (m === 'Invalid login credentials' ? 'Wrong email or password.'
  : /fetch|network/i.test(m) ? 'No internet connection. Check your data or Wi-Fi and try again.' : m);

function LoginScreen({ client, onReset }) {
  const t = useTheme();
  const [mode, setMode] = useState('in');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const signUp = mode === 'up';
  return (
    <Gate title="Flights, visas and trip planning. Get fares, pay with mobile money and track your ticket live.">
      <Chips options={[['in', 'Sign in'], ['up', 'Create account']]} value={mode} onChange={(m) => { setMode(m); setMsg(null); }} />
      <Card>
        {signUp ? <Field label="Full name (as on passport)" value={name} onChangeText={setName} autoComplete="name" /> : null}
        {signUp ? <Field label="Phone / WhatsApp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0999 123 456" /> : null}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={signUp ? 'new-password' : 'password'} placeholder={signUp ? 'At least 6 characters' : ''} />
        {msg ? <Body small color={msg.ok ? t.ok : t.danger}>{msg.text}</Body> : null}
        <Button
          title={signUp ? 'Create account' : 'Sign in'}
          disabled={!email || password.length < 6 || (signUp && (!name.trim() || !phone.trim()))}
          onPress={async () => {
            setMsg(null);
            if (!signUp) {
              const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
              if (error) setMsg({ text: friendly(error.message) });
              return;
            }
            const { data, error } = await client.auth.signUp({
              email: email.trim(), password, options: { data: { full_name: name.trim(), phone: phone.trim() } },
            });
            if (error) setMsg({ text: friendly(error.message) });
            else if (!data.session) setMsg({ ok: true, text: 'Account created. Open the email we sent you to confirm it, then sign in.' });
          }}
        />
        {!signUp ? (
          <Button kind="plain" small title="Forgot password?" disabled={!email} onPress={async () => {
            const { error } = await client.auth.resetPasswordForEmail(email.trim());
            setMsg(error ? { text: friendly(error.message) } : { ok: true, text: 'We sent a reset link to your email.' });
          }} />
        ) : null}
      </Card>
      <Card>
        <Body small muted>Prefer to talk? Call or WhatsApp Gramaro Travel Agency:</Body>
        <Row>
          <Button small kind="soft" icon="call" title="0884 099 227" onPress={() => Linking.openURL('tel:0884099227')} />
          <Button small kind="soft" icon="logo-whatsapp" title="WhatsApp" onPress={() => Linking.openURL('https://wa.me/265884099227')} />
        </Row>
      </Card>
      {onReset ? <Button kind="plain" small title="Enter the Supabase URL and key again" onPress={onReset} /> : null}
    </Gate>
  );
}

export default function RootLayout() {
  const t = useTheme();
  const [conn, setConn] = useState(undefined);
  const [session, setSession] = useState(undefined);
  const [toast, setToast] = useState('');
  const timer = useRef(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 3200);
  }, []);

  useEffect(() => { loadConnection().then(setConn); }, []);
  useEffect(() => {
    if (!conn) return;
    const client = connect(conn);
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [conn]);

  let body;
  if (conn === undefined || (conn && session === undefined)) body = <View style={{ flex: 1, justifyContent: 'center', backgroundColor: t.bg }}><ActivityIndicator color={t.primary} /></View>;
  else if (!conn) body = <ConnectScreen onDone={setConn} />;
  else if (!session) body = <LoginScreen client={connect(conn)} onReset={conn.builtIn ? null : async () => { await forgetConnection(); setSession(undefined); setConn(null); }} />;
  else body = (
    <DataProvider key={session.user.id} user={session.user}>
      <Stack screenOptions={{ headerStyle: { backgroundColor: BRAND }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '800' }, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="request/[id]" options={{ title: 'Trip' }} />
      </Stack>
    </DataProvider>
  );

  return (
    <SafeAreaProvider>
      <ToastProvider value={showToast}>
        {body}
        {toast ? <View pointerEvents="none" style={styles.toastWrap}><Text style={styles.toast}>{toast}</Text></View> : null}
        <StatusBar style={session ? 'light' : 'auto'} />
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', left: 16, right: 16, bottom: 100, alignItems: 'center' },
  toast: { backgroundColor: '#1b2238', color: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, overflow: 'hidden', fontSize: 14 },
});
