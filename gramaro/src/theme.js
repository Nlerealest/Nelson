import { useColorScheme } from 'react-native';

// Gramaro's navy and the orange of the plane on their sign.
export const BRAND = '#1d3a8f';
export const ORANGE = '#f07c2a';

const light = {
  dark: false, bg: '#f3f5fa', card: '#ffffff', text: '#141b2e', muted: '#5b6479', line: '#e0e5ef',
  primary: BRAND, primarySoft: '#e4eafa', accent: ORANGE, accentSoft: '#fdeee2',
  danger: '#c62828', dangerSoft: '#fdecea', warn: '#a35f00', warnSoft: '#fff4e0',
  ok: '#1b7a43', okSoft: '#e3f4ea', info: '#2f6db3', infoSoft: '#e8f0fb', input: '#f7f8fc',
};
const dark = {
  dark: true, bg: '#0d1120', card: '#161c2f', text: '#e9edf7', muted: '#9aa3b8', line: '#262e45',
  primary: '#8fa8ff', primarySoft: '#1d2747', accent: '#ff9a55', accentSoft: '#3a2617',
  danger: '#ff7b7b', dangerSoft: '#3a1c1c', warn: '#f0b04a', warnSoft: '#3a2c14',
  ok: '#5fd38f', okSoft: '#16301f', info: '#7fb2ee', infoSoft: '#1a2633', input: '#11172a',
};

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}
