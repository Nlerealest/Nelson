// "Groceries cost more every week". Numbers: budgetStatus on sample-data.mjs at 2026-10-13 (Groceries K31,000 of K70,000, projected K73,923).
window.SHORT = {
  bpm: 108, mood: 'tense',
  scenes: [
    { type: 'title', beats: 6, kicker: 'Food prices keep climbing', lines: ['Will your grocery', 'money last', '<bad>the month?</bad>'], size: 116 },
    { type: 'counter', beats: 6, drop: true, label: 'Groceries by the 13th', value: 31000, note: 'of a K70,000 budget' },
    { type: 'counter', beats: 7, label: 'At this pace you’ll reach', value: 73923, color: 'var(--bad)', note: 'above your K70,000 budget' },
    { type: 'phone', beats: 7, img: 'screen-home', caption: 'Ndalama warns you<br><em>mid-month,</em> not day 28', size: 76, top: 440 },
    { type: 'title', beats: 5, lines: ['See it early.', '<em>Adjust in time.</em>'], size: 120 },
    { type: 'end', beats: 8, bg: 'green' },
  ],
};
