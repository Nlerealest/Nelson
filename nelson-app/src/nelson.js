// App-wide state: the saved connection and the latest snapshot from Nelson,
// refreshed every 5 seconds while the app is open.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as api from './api';
import { clearConnection, loadConnection, saveConnection } from './storage';

const Ctx = createContext(null);
const REFRESH_MS = 5000;

export function NelsonProvider({ children }) {
  const [conn, setConn] = useState(undefined);   // undefined = still loading, null = not set up
  const [snap, setSnap] = useState(null);
  const [error, setError] = useState('');
  const [lastOk, setLastOk] = useState(0);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    loadConnection().then((c) => setConn(c || null));
  }, []);

  const refresh = useCallback(async () => {
    if (!conn || inFlight.current) return;
    inFlight.current = true;
    try {
      const s = await api.getSnapshot(conn);
      setSnap(s);
      setError('');
      setLastOk(Date.now());
    } catch (e) {
      setError(e.message);
    } finally {
      inFlight.current = false;
    }
  }, [conn]);

  useEffect(() => {
    if (!conn) return undefined;
    const first = setTimeout(refresh, 0);
    let timer = setInterval(refresh, REFRESH_MS);
    const sub = AppState.addEventListener('change', (state) => {
      clearInterval(timer);
      if (state === 'active') {
        refresh();
        timer = setInterval(refresh, REFRESH_MS);
      }
    });
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      sub.remove();
    };
  }, [conn, refresh]);

  const connect = useCallback(async (url, key) => {
    const c = { url, key };
    await api.ping(c);            // throws with a readable message if wrong
    await saveConnection(c);
    setSnap(null);
    setConn(c);
  }, []);

  const disconnect = useCallback(async () => {
    await clearConnection();
    setSnap(null);
    setConn(null);
  }, []);

  // Runs a control action, then refreshes. Returns Nelson's message.
  const act = useCallback(async (fn, ...args) => {
    setBusy(true);
    try {
      const res = await fn(conn, ...args);
      await refresh();
      return { ok: res.ok !== false, message: res.message || 'Done' };
    } catch (e) {
      return { ok: false, message: e.message };
    } finally {
      setBusy(false);
    }
  }, [conn, refresh]);

  const value = {
    conn, snap, error, lastOk, busy, refresh, connect, disconnect,
    pause: () => act(api.pause),
    resume: () => act(api.resume),
    closeAll: () => act(api.closeAll),
    setRisk: (v) => act(api.setRisk, v),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNelson() {
  return useContext(Ctx);
}
