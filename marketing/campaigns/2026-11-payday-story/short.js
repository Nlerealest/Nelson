// "Payday vs Day 25", the full story (about 75 s). Numbers: sample-data.mjs on 2026-10-01
// (K3,987 a day), 2026-10-13 (K2,189 a day, 19 days) and 2026-10-25 (K1,655 a day, 7 days);
// September report: K250,000 in, K180,000 out, K70,000 kept.
window.SHORT = {
  bpm: 104, mood: 'warm',
  scenes: [
    { type: 'title', beats: 6, kicker: 'Payday me vs Day 25 me', lines: ['Same salary.', '<em>Different ending.</em>'], size: 120 },
    { type: 'counter', beats: 6, label: 'Day 1 · Payday', value: 250000, note: 'This money will last forever.' },
    { type: 'list', beats: 8, max: 60000, title: 'Then the month<br>starts happening…', step: 0.55,
      items: [{ label: 'Rent', amount: 60000 }, { label: 'Groceries', amount: 22000 }, { label: 'Family support', amount: 20000 }, { label: 'ESCOM units', amount: 15000 }, { label: 'Minibus', amount: 4000 }] },
    { type: 'title', beats: 5, kicker: 'Day 25', lines: ['Where did it', '<bad>all go?</bad>'], size: 130 },
    { type: 'split', beats: 8, bottomAt: 2.3,
      top: { label: 'Day 1 · Payday me', text: 'K250,000', note: 'Chips with friends? Sure!' },
      bottom: { label: 'Day 25 me', text: 'Nothing left.', tone: 'bad', size: 104, note: 'Borrowing for transport…' } },
    { type: 'title', beats: 4, lines: ['Same month.', '<em>With Ndalama.</em>'], size: 124 },
    { type: 'counter', beats: 7, drop: true, label: 'Day 1: safe to spend', value: 3987, note: 'a day, after bills and savings<br>are set aside' },
    { type: 'phone', beats: 8, img: 'screen-home', caption: 'Every morning it shows<br>what’s <em>safe</em> today', size: 74 },
    { type: 'phone', beats: 8, img: 'screen-add', caption: 'Every kwacha recorded<br>in <em>seconds</em>', size: 76 },
    { type: 'cards', beats: 7, cards: ['card-bills'], heights: [796], caption: 'Bills reminded<br><em>before</em> they’re due', top: 560 },
    { type: 'counter', beats: 7, label: 'Day 13: still on track', value: 2189, note: 'a day for 19 days' },
    { type: 'cards', beats: 7, cards: ['card-goal2'], heights: [780], caption: 'Savings goal slipping?<br><em>It warns you early.</em>', top: 560 },
    { type: 'counter', beats: 7, label: 'Day 25: still fine', value: 1655, note: 'a day for the last 7 days.<br>Rent paid. Savings kept.' },
    { type: 'counter', beats: 6, label: 'Month end: kept', value: 70000, note: '28% of the salary' },
    { type: 'title', beats: 5, lines: ['Payday me', '<em>=</em> Day 25 me'], size: 130 },
    { type: 'end', beats: 10, bg: 'green' },
  ],
};
