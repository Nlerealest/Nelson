// "8 weeks to Christmas". Numbers: goalPlan for a K40,000 goal due 2026-12-24, on 2026-11-01 (K20,000 a month for 2 months, about K667 a day).
window.SHORT = {
  bpm: 112, mood: 'bright',
  scenes: [
    { type: 'title', beats: 6, kicker: '8 weeks to go', lines: ['Christmas is', '<em>closer</em> than', 'you think.'], size: 120 },
    { type: 'title', beats: 4, lines: ['Start a small', 'goal <em>tonight.</em>'], size: 120 },
    { type: 'counter', beats: 7, drop: true, label: 'Christmas goal', value: 40000, note: 'by 24 December' },
    { type: 'counter', beats: 7, label: 'Ndalama works it out', value: 20000, note: 'a month for 2 months<br>about K667 a day' },
    { type: 'cards', beats: 7, cards: ['card-goal'], heights: [764], caption: 'It warns you early<br>if you <em>fall behind</em>', top: 560 },
    { type: 'title', beats: 5, lines: ['Merry Christmas.', '<em>No January panic.</em>'], size: 110 },
    { type: 'end', beats: 8, bg: 'green' },
  ],
};
