// "Payday vs Day 25". Numbers: sample-data.mjs on 2026-10-01 (K3,987/day) and 2026-10-25 (K1,655/day, 7 days left).
window.SHORT = {
  bpm: 104, mood: 'warm',
  scenes: [
    { type: 'split', beats: 8, bottomAt: 2.3,
      top: { label: 'Day 1 · Payday me', text: 'K250,000', note: 'This money will last forever.' },
      bottom: { label: 'Day 25 me', text: 'Where did it all go?', tone: 'bad', size: 96, note: 'Rent. Food. Transport. Airtime. Family.' } },
    { type: 'title', beats: 4, kicker: 'Same month', lines: ['Same K250,000.', '<em>With Ndalama.</em>'], size: 120 },
    { type: 'counter', beats: 6, drop: true, label: 'Day 1: safe to spend', value: 3987, note: 'a day, after bills and savings<br>are set aside' },
    { type: 'phone', beats: 7, img: 'screen-home', caption: 'It shows what’s <em>safe</em><br>every single day', size: 76 },
    { type: 'counter', beats: 6, label: 'Day 25: still on track', value: 1655, note: 'a day for the last 7 days.<br>Rent paid. Savings kept.' },
    { type: 'title', beats: 4, lines: ['Payday me', '<em>=</em> Day 25 me'], size: 130 },
    { type: 'end', beats: 8, bg: 'green' },
  ],
};
