import { useColorScheme } from 'react-native';

// Brand green stays dark in both themes so white text on it is always readable.
export const BRAND = '#0d5e3a';
export const BRAND_DEEP = '#0a4a2e';
export const LIME = '#c8ec6a';

export type Theme = {
  dark: boolean;
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  muted: string;
  faint: string;
  line: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  danger: string;
  dangerSoft: string;
  warn: string;
  warnSoft: string;
  info: string;
  infoSoft: string;
  purple: string;
  purpleSoft: string;
  orange: string;
  orangeSoft: string;
  shadow: string;
};

const light: Theme = {
  dark: false,
  bg: '#f2f5f1',
  card: '#ffffff',
  cardAlt: '#f7f9f6',
  text: '#13201a',
  muted: '#56665d',
  faint: '#8a978f',
  line: '#e0e7e1',
  primary: '#0f6b42',
  primarySoft: '#e2f2e8',
  onPrimary: '#ffffff',
  danger: '#b3261e',
  dangerSoft: '#fdeceb',
  warn: '#8f5300',
  warnSoft: '#fff3dd',
  info: '#2a5fa8',
  infoSoft: '#e7effa',
  purple: '#6a46c2',
  purpleSoft: '#efe9fb',
  orange: '#b65a10',
  orangeSoft: '#fdeedf',
  shadow: '#0d2a1c',
};

const dark: Theme = {
  dark: true,
  bg: '#0d1310',
  card: '#161f1a',
  cardAlt: '#1b2520',
  text: '#e8f0ea',
  muted: '#a2b1a8',
  faint: '#728077',
  line: '#26322b',
  primary: '#5fd394',
  primarySoft: '#16352a',
  onPrimary: '#05210f',
  danger: '#ff8a80',
  dangerSoft: '#3b1c1a',
  warn: '#f3b453',
  warnSoft: '#3a2b12',
  info: '#8ab6f0',
  infoSoft: '#1a2738',
  purple: '#b39cf2',
  purpleSoft: '#261f3a',
  orange: '#f2a565',
  orangeSoft: '#3a2616',
  shadow: '#000000',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export type Tone = 'primary' | 'info' | 'warn' | 'danger' | 'purple' | 'orange' | 'neutral';

/** Foreground and background colours for a tone. */
export function toneColors(t: Theme, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'primary':
      return { fg: t.primary, bg: t.primarySoft };
    case 'info':
      return { fg: t.info, bg: t.infoSoft };
    case 'warn':
      return { fg: t.warn, bg: t.warnSoft };
    case 'danger':
      return { fg: t.danger, bg: t.dangerSoft };
    case 'purple':
      return { fg: t.purple, bg: t.purpleSoft };
    case 'orange':
      return { fg: t.orange, bg: t.orangeSoft };
    default:
      return { fg: t.muted, bg: t.cardAlt };
  }
}
