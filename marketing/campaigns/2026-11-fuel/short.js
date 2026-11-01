// "Fuel queues, minibus fares" (long version, owner's song). Numbers: budgetStatus on sample-data.mjs at 2026-10-13 (Transport K8,000 of K25,000, on course for K19,077).
window.SHORT = {
  bpm: 76, mood: 'tense',
  scenes: [
    { type: 'title', beats: 8, kicker: 'Transport this month', lines: ['Fuel costs more.', 'Does your budget', '<em>know?</em>'], size: 116 },
    { type: 'title', beats: 8, kicker: 'Every trip counts', lines: ['Minibus here.', 'Minibus there.', '<em>It adds up.</em>'], size: 116 },
    { type: 'phone', beats: 9, drop: true, img: 'screen-add', caption: 'Log every minibus<br>trip in <em>seconds</em>', size: 76, top: 440 },
    { type: 'counter', beats: 8, label: 'Transport so far', value: 8000, note: 'of your K25,000 budget<br>K17,000 left' },
    { type: 'counter', beats: 8, label: 'On course for', value: 19077, note: 'this month, from how<br>you are spending now' },
    { type: 'title', beats: 8, lines: ['Fares go up?', 'You see it <em>early.</em>', 'Not on day 28.'], size: 112 },
    { type: 'phone', beats: 9, img: 'screen-budget', caption: 'Every budget,<br><em>one screen</em>', size: 80, top: 440 },
    { type: 'phone', beats: 8, img: 'screen-home', caption: 'It shows what’s <em>safe</em><br>every single day', size: 76 },
    { type: 'title', beats: 8, lines: ['Fuel moves.', 'Your plan', '<em>keeps up.</em>'], size: 120 },
    { type: 'end', beats: 9, bg: 'green' },
  ],
};
