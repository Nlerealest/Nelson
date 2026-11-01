// "Fuel queues, minibus fares". Numbers: budgetStatus on sample-data.mjs at 2026-10-13 (Transport K8,000 of K25,000, on course for K19,077).
window.SHORT = {
  bpm: 104, mood: 'tense',
  scenes: [
    { type: 'title', beats: 6, kicker: 'Transport this month', lines: ['Fuel costs more.', 'Does your budget', '<em>know?</em>'], size: 116 },
    { type: 'phone', beats: 7, drop: true, img: 'screen-add', caption: 'Log every minibus<br>trip in <em>seconds</em>', size: 76, top: 440 },
    { type: 'counter', beats: 7, label: 'Transport so far', value: 8000, note: 'of your K25,000 budget<br>K17,000 left' },
    { type: 'counter', beats: 7, label: 'On course for', value: 19077, note: 'this month. If fares go up,<br>you see it <em>early.</em>' },
    { type: 'phone', beats: 7, img: 'screen-budget', caption: 'Every budget,<br><em>one screen</em>', size: 80, top: 440 },
    { type: 'end', beats: 8, bg: 'green' },
  ],
};
