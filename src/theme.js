import { useColorScheme } from 'react-native';

// Brand green stays dark in both themes so white text on it is always readable.
export const BRAND = '#0b6b3a';

const light = {
  dark: false,
  bg: '#f4f6f3',
  card: '#ffffff',
  text: '#17201b',
  muted: '#5d6b63',
  line: '#e1e7e2',
  primary: BRAND,
  primarySoft: '#e3f2e9',
  danger: '#c62828',
  dangerSoft: '#fdecea',
  warn: '#a35f00',
  warnSoft: '#fff4e0',
  info: '#2f6db3',
  infoSoft: '#e8f0fb',
};

const dark = {
  dark: true,
  bg: '#0f1412',
  card: '#18201c',
  text: '#e8efe9',
  muted: '#9aa9a0',
  line: '#27322c',
  primary: '#4cc985',
  primarySoft: '#183526',
  danger: '#ff7b7b',
  dangerSoft: '#3a1c1c',
  warn: '#f0b04a',
  warnSoft: '#3a2c14',
  info: '#7fb2ee',
  infoSoft: '#1a2633',
};

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}
