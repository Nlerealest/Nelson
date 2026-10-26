// One dark theme: traders mostly watch charts at night, and gold on navy reads well.
export const C = {
  bg: '#0b1120',
  card: '#131c31',
  card2: '#1a2540',
  line: '#253252',
  text: '#e8edf7',
  muted: '#8e9bb5',
  gold: '#e8b84a',
  goldSoft: '#3a2f14',
  green: '#22c55e',
  greenSoft: '#12301f',
  red: '#f05252',
  redSoft: '#3a1717',
  blue: '#60a5fa',
  blueSoft: '#162a47',
  orange: '#f59e0b',
  orangeSoft: '#3a2a10',
};

export const TONE = {
  good: { fg: C.green, bg: C.greenSoft },
  bad: { fg: C.red, bg: C.redSoft },
  info: { fg: C.blue, bg: C.blueSoft },
  warn: { fg: C.orange, bg: C.orangeSoft },
  gold: { fg: C.gold, bg: C.goldSoft },
  neutral: { fg: C.muted, bg: C.card2 },
};
