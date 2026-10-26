import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { Banner, Button, T } from '../components/ui';
import { C } from '../theme';
import { parseConnectionQr } from '../format';

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const done = useRef(false);

  if (!permission) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <T style={{ textAlign: 'center', marginBottom: 16 }}>
          Nelson needs the camera to read the connection QR code. Nothing is recorded or saved.
        </T>
        <Button title="Allow camera" icon="camera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (done.current) return;
          const parsed = parseConnectionQr(data);
          if (!parsed) {
            setError("That QR code isn't a Nelson connection code.");
            return;
          }
          done.current = true;
          router.dismissTo({ pathname: '/connect', params: parsed });
        }}
      />
      <View style={styles.frame} pointerEvents="none" />
      <View style={styles.bottom}>
        {error ? <Banner tone="bad" icon="alert-circle">{error}</Banner> : (
          <T style={{ textAlign: 'center' }}>Point at the QR code shown by app-setup on the VPS</T>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', padding: 24 },
  frame: {
    position: 'absolute', top: '22%', left: '12%', right: '12%', aspectRatio: 1,
    borderWidth: 3, borderColor: C.gold, borderRadius: 20,
  },
  bottom: { position: 'absolute', bottom: 40, left: 16, right: 16 },
});
