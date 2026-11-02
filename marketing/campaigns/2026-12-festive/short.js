// "December budget challenge": a 4-week challenge (the K10,000 is the challenge's target, not an app result).
window.SHORT = {
  bpm: 100, mood: 'bright',
  scenes: [
    { type: 'title', beats: 8, kicker: 'December budget challenge', lines: ['Survive December', 'without going', '<bad>broke in January.</bad>'], size: 108 },
    { type: 'title', beats: 7, lines: ['Gifts. Travel.', 'Fees. Food.', '<em>Every kwacha</em> goes fast.'], size: 100, transition: 'slide' },
    { type: 'title', beats: 6, lines: ['Then January', 'arrives…', '<bad>and the wallet is empty.</bad>'], size: 100, transition: 'circle' },
    { type: 'steps', beats: 12, drop: true, title: '4 weeks.<br><em>4 goals.</em>', step: 0.6, gap: 240,
      items: [{ k: '1', text: 'Set a budget from<br>what you really earn' }, { k: '2', text: 'Track every kwacha<br>you spend' },
              { k: '3', text: 'Save K10,000<br>for January' }, { k: '4', text: 'One no-spend<br>weekend' }] },
    { type: 'title', beats: 5, kicker: 'Week 1', lines: ['Know what', 'you <em>earn.</em>'], size: 120, transition: 'slide' },
    { type: 'phone', beats: 8, img: 'screen-budget', caption: 'Ndalama <em>suggests<br>your budget</em>', size: 76, top: 440 },
    { type: 'phone', beats: 8, img: 'screen-add', caption: 'Week 2: record every<br>spend in <em>seconds</em>', size: 76, top: 440, transition: 'circle' },
    { type: 'title', beats: 7, lines: ['No data? <em>No problem.</em>', 'No account.', 'No ads.'], size: 100, transition: 'slide' },
    { type: 'cards', beats: 8, cards: ['card-goal'], heights: [764], caption: 'Week 3: watch your<br><em>savings grow</em>', top: 560 },
    { type: 'cards', beats: 8, cards: ['card-bills'], heights: [764], caption: 'Bill reminders<br>the <em>day before</em>', top: 560, transition: 'circle' },
    { type: 'title', beats: 6, kicker: 'Week 4', lines: ['A <em>no-spend</em>', 'weekend.'], size: 120 },
    { type: 'title', beats: 6, lines: ['January comes.', '<em>You are ready.</em>'], size: 112, transition: 'slide' },
    { type: 'title', beats: 7, lines: ['Join in.', 'Post your progress', 'with <em>#NdalamaChallenge</em>'], size: 96 },
    { type: 'end', beats: 9, bg: 'green' },
  ],
};
