// "3 things to do on payday". Screens from sample-data.mjs at 2026-10-13 (K2,189 a day).
window.SHORT = {
  bpm: 120, mood: 'bright',
  scenes: [
    { type: 'title', beats: 6, kicker: 'Salary just landed?', lines: ['Do these 3 things', 'before you spend', '<em>a kwacha.</em>'], size: 108 },
    { type: 'cards', beats: 7, drop: true, cards: ['card-bills'], heights: [796], caption: '1. Mark your bills', top: 560 },
    { type: 'cards', beats: 7, cards: ['card-goal2'], heights: [780], caption: '2. Set your savings<br><em>aside first</em>', top: 560 },
    { type: 'cards', beats: 7, cards: ['card-hero'], heights: [534], caption: '3. Check what’s<br><em>safe to spend</em>', top: 640 },
    { type: 'title', beats: 5, lines: ['Save this.', 'Do it <em>every payday.</em>'], size: 116 },
    { type: 'end', beats: 8, bg: 'green' },
  ],
};
