// "Where did my kwacha go?" Numbers: monthlyReport for 2026-09 on sample-data.mjs (K250,000 in, K180,000 out, K70,000 kept).
window.SHORT = {
  bpm: 112, mood: 'tense',
  scenes: [
    { type: 'title', beats: 6, kicker: 'One month · every kwacha', lines: ['I tracked every', 'kwacha I spent', 'for a month.'], size: 112 },
    { type: 'title', beats: 4, lines: ['This is where', '<em>it went.</em>'], size: 130 },
    { type: 'list', beats: 8, max: 60000, drop: true, title: 'K180,000 out.<br>The small ones…', step: 0.5,
      items: [{ label: 'Eating out', amount: 5000 }, { label: 'Church & giving', amount: 5000 }, { label: 'Airtime & data', amount: 5000 }, { label: 'Water', amount: 6000 }, { label: 'Electricity', amount: 15000 }] },
    { type: 'list', beats: 6, max: 60000, title: 'The big ones…', step: 0.6,
      items: [{ label: 'Transport', amount: 16000, note: 'Minibus, K4,000 at a time' }, { label: 'Family support', amount: 20000 }, { label: 'Rent', amount: 60000 }] },
    { type: 'counter', beats: 7, label: 'The surprise: <bad>groceries</bad>', value: 48000, color: 'var(--bad)', note: 'in just 4 shop trips<br>K22,000 + K9,000 + K9,000 + K8,000' },
    { type: 'phone', beats: 7, img: 'screen-report', caption: 'Ndalama shows it <em>all</em><br>at month end', size: 80 },
    { type: 'counter', beats: 5, label: 'And I still kept', value: 70000, note: '28% of my income' },
    { type: 'title', beats: 5, lines: ['What’s <em>your</em>', 'biggest leak?'], size: 130, sub: 'Tell us in the comments' },
    { type: 'end', beats: 8, bg: 'green' },
  ],
};
