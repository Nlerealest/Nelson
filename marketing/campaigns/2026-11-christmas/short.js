// "8 weeks to Christmas" (long version, owner's song). Numbers: goalPlan for a K500,000 goal due 2026-12-24, on 2026-11-01 (K250,000 a month for 2 months, about K8,333 a day).
window.SHORT = {
  bpm: 72, mood: 'bright',
  scenes: [
    { type: 'title', beats: 7, kicker: '8 weeks to go', lines: ['Christmas is', '<em>closer</em> than', 'you think.'], size: 120 },
    { type: 'title', beats: 6, lines: ['Start a small', 'goal <em>tonight.</em>'], size: 120 },
    { type: 'counter', beats: 8, drop: true, label: 'Christmas goal', value: 500000, note: 'by 24 December' },
    { type: 'counter', beats: 8, label: 'Ndalama works it out', value: 250000, note: 'a month for 2 months<br>about K8,333 a day' },
    { type: 'phone', beats: 8, img: 'screen-goals', caption: 'Your goals,<br><em>all in one place</em>', size: 80, top: 440 },
    { type: 'cards', beats: 8, cards: ['card-goal'], heights: [764], caption: 'It warns you early<br>if you <em>fall behind</em>', top: 560 },
    { type: 'phone', beats: 8, img: 'screen-add', caption: 'Log your spending<br>in <em>seconds</em>', size: 76, top: 440 },
    { type: 'title', beats: 7, lines: ['Merry Christmas.', '<em>No January panic.</em>'], size: 110 },
    { type: 'end', beats: 9, bg: 'green' },
  ],
};
