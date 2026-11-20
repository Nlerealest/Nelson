import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { connect, forgetConnection, loadConnection, saveConnection } from '../supabase';
import { DataProvider, ToastProvider } from '../data';
import { BRAND, GOLD, useTheme } from '../theme';
import { Body, Button, Card, Field } from '../components/ui';

function Gate({ title, children }) {
  const t = useTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 80, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <View style={styles.logo}><Ionicons name="cut" size={40} color="#fff" /><Ionicons name="star" size={16} color={GOLD} style={{ position: 'absolute', top: 9, right: 9 }} /></View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: t.text }}>King Tonka</Text>
          <Body muted>{title}</Body>
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
    <Gate title="Connect to your Supabase project">
      <Card>
        <Body small muted>In Supabase: Project Settings → API. Copy the Project URL and the anon public key.</Body>
        <Field label="Project URL" value={url} onChangeText={setUrl} placeholder="https://xxxx.supabase.co" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Field label="anon public key" value={anon} onChangeText={setAnon} placeholder="eyJhbGciOi…" autoCapitalize="none" autoCorrect={false} multiline style={{ minHeight: 70 }} />
        <Button title="Connect" disabled={!url.startsWith('https://') || anon.length < 20} onPress={async () => onDone(await saveConnection(url, anon))} />
      </Card>
    </Gate>
  );
}

function LoginScreen({ client, onReset }) {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  return (
    <Gate title="Sign in to start clipping">
      <Card>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
        {error ? <Body small color={t.danger}>{error}</Body> : null}
        <Button title="Sign in" disabled={!email || !password} onPress={async () => {
          setError('');
          const { error: e } = await client.auth.signInWithPassword({ email: email.trim(), password });
          if (e) setError(e.message === 'Invalid login credentials' ? 'Wrong email or password.'
            : /invalid path|fetch|network/i.test(e.message) ? 'Can’t reach Supabase. Check the Project URL (tap “Enter the Supabase URL and key again” below).' : e.message);
        }} />
      </Card>
      <Body small muted style={{ textAlign: 'center' }}>Use the same email and password as Twizzy.</Body>
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
    timer.current = setTimeout(() => setToast(''), 2800);
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
    <DataProvider>
      <Stack screenOptions={{ headerStyle: { backgroundColor: BRAND }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '800' }, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="project/[id]" options={{ title: 'Clips' }} />
        <Stack.Screen name="clip/[id]" options={{ title: 'Clip' }} />
        <Stack.Screen name="expo-sharing" options={{ title: 'Clip a video' }} />
        <Stack.Screen name="campaign/[id]" options={{ title: 'Campaign' }} />
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
  logo: { width: 76, height: 76, borderRadius: 20, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  logoT: { color: '#fff', fontSize: 44, fontWeight: '900' },
  toastWrap: { position: 'absolute', left: 16, right: 16, bottom: 110, alignItems: 'center' },
  toast: { backgroundColor: '#222', color: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, overflow: 'hidden', fontSize: 14 },
});
