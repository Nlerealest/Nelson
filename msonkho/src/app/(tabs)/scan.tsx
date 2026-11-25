import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { buzz, copy, dial, openWeb } from '../../actions.ts';
import { Badge, Bullets, Button, Callout, Card, Divider, Field, Row, Screen, SectionTitle, Segmented, Txt } from '../../components/ui.tsx';
import type { IconName } from '../../components/ui.tsx';
import { DEMO_LINKS, MRA } from '../../data/content.ts';
import { checkLink } from '../../lib/verify.ts';
import type { LinkCheck, Verdict } from '../../lib/verify.ts';
import { key } from '../../i18n/index.ts';
import type { T } from '../../i18n/index.ts';
import { useApp } from '../../state/store.tsx';
import { useTheme } from '../../theme.ts';
import type { Tone } from '../../theme.ts';

type Mode = 'scan' | 'check';

const VERDICT_VIEW: Record<Verdict, { tone: Tone; icon: IconName }> = {
  mra: { tone: 'primary', icon: 'shield-checkmark' },
  mraInsecure: { tone: 'warn', icon: 'shield-half' },
  lookalike: { tone: 'danger', icon: 'warning' },
  other: { tone: 'warn', icon: 'alert-circle' },
  notLink: { tone: 'neutral', icon: 'help-circle' },
  empty: { tone: 'neutral', icon: 'help-circle' },
};

function verdictTitle(t: T, v: Verdict): string {
  return v === 'empty' ? '' : t(key(`verdict.${v}.title`));
}

export default function Scan() {
  const { t, data, update } = useApp();
  const params = useLocalSearchParams<{ mode?: string }>();
  const canScan = Platform.OS !== 'web';
  const [mode, setMode] = useState<Mode>(params.mode === 'check' || !canScan ? 'check' : 'scan');
  const [result, setResult] = useState<LinkCheck | null>(null);
  const [text, setText] = useState('');

  // Opening /scan?mode=check while this tab is already open switches to the link checker.
  const [seenMode, setSeenMode] = useState(params.mode);
  if (params.mode !== seenMode) {
    setSeenMode(params.mode);
    if (params.mode === 'check') setMode('check');
  }

  const record = (r: LinkCheck) => {
    setResult(r);
    if (r.verdict === 'empty') return;
    buzz(r.verdict === 'mra' ? 'success' : r.verdict === 'lookalike' ? 'error' : 'warning');
    update((d) => ({
      ...d,
      scans: [{ at: Date.now(), input: r.input.slice(0, 500), verdict: r.verdict, host: r.host }, ...d.scans].slice(0, 20),
    }));
  };

  return (
    <Screen>
      <Segmented
        options={[
          { value: 'scan', label: t('scan.modeScan') },
          { value: 'check', label: t('scan.modeCheck') },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setResult(null);
        }}
      />

      {mode === 'scan' ? (
        canScan ? (
          <Scanner active={!result} onScanned={(data) => record(checkLink(data))} />
        ) : (
          <Callout tone="info" icon="phone-portrait">
            {t('scan.web')}
          </Callout>
        )
      ) : (
        <Card>
          <Field label={t('scan.paste')} value={text} onChange={setText} multiline placeholder="https://…" autoCapitalize="none" />
          <Button title={t('scan.check')} icon="shield-checkmark" disabled={!text.trim()} onPress={() => record(checkLink(text))} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              small
              kind="ghost"
              style={{ flex: 1 }}
              title={t('scan.tryGood')}
              onPress={() => {
                setText(DEMO_LINKS.genuine);
                record(checkLink(DEMO_LINKS.genuine));
              }}
            />
            <Button
              small
              kind="ghost"
              style={{ flex: 1 }}
              title={t('scan.tryBad')}
              onPress={() => {
                setText(DEMO_LINKS.fake);
                record(checkLink(DEMO_LINKS.fake));
              }}
            />
          </View>
        </Card>
      )}

      {result && result.verdict !== 'empty' ? (
        <ResultCard result={result} onAgain={mode === 'scan' ? () => setResult(null) : undefined} />
      ) : null}

      {data.scans.length > 0 ? (
        <Card style={{ gap: 6 }}>
          <SectionTitle title={t('scan.recent')} action={{ label: t('scan.clear'), onPress: () => update((d) => ({ ...d, scans: [] })) }} />
          {data.scans.slice(0, 5).map((s) => (
            <Pressable
              key={s.at}
              onPress={() => {
                setMode('check');
                setText(s.input);
                setResult(checkLink(s.input));
              }}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
            >
              <Badge label={verdictTitle(t, s.verdict)} tone={VERDICT_VIEW[s.verdict].tone} />
              <Txt variant="small" muted numberOfLines={1} style={{ flex: 1 }}>
                {s.host ?? s.input}
              </Txt>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionTitle title={t('scan.tips')} />
        <Bullets items={[t('scan.tip1'), t('scan.tip2'), t('scan.tip3'), t('scan.tip4')]} />
      </Card>
    </Screen>
  );
}

function Scanner({ active, onScanned }: { active: boolean; onScanned: (data: string) => void }) {
  const { t } = useApp();
  const theme = useTheme();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  // The camera reports the same code many times a second; take the first.
  const busy = useRef(false);
  useEffect(() => {
    if (active) busy.current = false;
  }, [active]);

  if (!permission) return <Card style={{ height: 120 }}>{null}</Card>;
  if (!permission.granted) {
    return (
      <Card style={{ alignItems: 'center' }}>
        <Ionicons name="camera" size={40} color={theme.primary} />
        <Txt align="center" muted>
          {t('scan.permission')}
        </Txt>
        <Button title={t('scan.allow')} icon="camera" onPress={requestPermission} />
      </Card>
    );
  }
  if (!active) return null;
  return (
    <View style={styles.cameraWrap}>
      {focused ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (busy.current || !data) return;
            busy.current = true;
            onScanned(data);
          }}
        />
      ) : null}
      <View style={styles.frame} pointerEvents="none">
        {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
          <View key={c} style={[styles.corner, styles[c]]} />
        ))}
      </View>
      <View style={styles.cameraFooter}>
        <Txt variant="small" color="#ffffff" style={{ flex: 1, fontWeight: '700' }}>
          {t('scan.hint')}
        </Txt>
        <Pressable
          onPress={() => setTorch((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: torch }}
          accessibilityLabel={t('scan.torch')}
          style={[styles.torch, torch && { backgroundColor: '#ffffff' }]}
        >
          <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={20} color={torch ? '#0d5e3a' : '#ffffff'} />
        </Pressable>
      </View>
    </View>
  );
}

function ResultCard({ result, onAgain }: { result: LinkCheck; onAgain?: () => void }) {
  const { t, toast } = useApp();
  const view = VERDICT_VIEW[result.verdict];
  const isMra = result.verdict === 'mra' || result.verdict === 'mraInsecure';
  const body =
    result.verdict === 'mra' && result.isDocumentLink
      ? t('verdict.mraDoc.body')
      : t(key(`verdict.${result.verdict}.body`), { host: result.host ?? '' });
  const dangerWarnings = result.warnings.filter((w) => w !== 'noScheme');

  return (
    <Card>
      <Callout tone={view.tone} icon={view.icon} title={verdictTitle(t, result.verdict)}>
        {body}
      </Callout>
      {result.host ? <Row label={t('scan.address')} value={result.host} /> : null}
      {result.documentCode ? <Row label={t('scan.code')} value={result.documentCode} /> : null}
      {result.verdict === 'notLink' ? (
        <Txt variant="small" muted selectable numberOfLines={4}>
          {`${t('scan.content')}: ${result.input}`}
        </Txt>
      ) : null}
      {dangerWarnings.length ? <Bullets items={dangerWarnings.map((w) => t(key(`warn.${w}`)))} /> : null}
      <Divider />
      <View style={{ gap: 8 }}>
        {isMra && result.openUrl ? <Button title={t('scan.openMra')} icon="open" onPress={() => openWeb(result.openUrl!)} /> : null}
        {!isMra && result.verdict !== 'notLink' ? (
          <Button title={t('scan.report')} icon="call" kind="danger" onPress={() => dial(MRA.callCentre)} />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {result.url ? (
            <Button
              small
              kind="ghost"
              style={{ flex: 1 }}
              icon="copy"
              title={t('scan.copyLink')}
              onPress={async () => {
                if (await copy(result.url!)) toast(t('common.copied'));
              }}
            />
          ) : null}
          {onAgain ? <Button small kind="secondary" style={{ flex: 1 }} icon="scan" title={t('scan.again')} onPress={onAgain} /> : null}
        </View>
      </View>
    </Card>
  );
}

const CORNER = 28;
const styles = StyleSheet.create({
  cameraWrap: { height: 360, borderRadius: 22, overflow: 'hidden', backgroundColor: '#0b1410' },
  frame: { position: 'absolute', top: 50, bottom: 90, left: 50, right: 50 },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#c8ec6a' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  cameraFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  torch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
});
