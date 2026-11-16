import { useColorScheme } from 'react-native';

// King Tonka: royal purple with a gold crown.
export const BRAND = '#4b1fb8';
export const GOLD = '#ffc531';

const light = {
  dark: false, bg: '#f5f3fb', card: '#ffffff', text: '#1a1530', muted: '#6a6483', line: '#e4e0f2',
  primary: BRAND, primarySoft: '#ece6fb', danger: '#c62828', dangerSoft: '#fdecea',
  warn: '#9a5b00', warnSoft: '#fff3dc', info: '#2f6db3', infoSoft: '#e8f0fb', ok: '#137a43', okSoft: '#e2f5ea', input: '#f8f7fd',
};
const dark = {
  dark: true, bg: '#0e0b18', card: '#191426', text: '#efeaff', muted: '#a49cc0', line: '#2a2340',
  primary: '#9d7bff', primarySoft: '#2a1f4d', danger: '#ff7b7b', dangerSoft: '#3a1c1c',
  warn: '#f0b04a', warnSoft: '#3a2c14', info: '#7fb2ee', infoSoft: '#1a2633', ok: '#5fd394', okSoft: '#163626', input: '#130f20',
};

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}

// Score colours: green for great, gold for good, grey below.
export function scoreColor(score, t) {
  if (score >= 80) return t.ok;
  if (score >= 65) return t.warn;
  return t.muted;
}
