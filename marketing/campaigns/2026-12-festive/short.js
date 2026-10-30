// "December budget challenge": a 4-week challenge (the K10,000 is the challenge's target, not an app result).
window.SHORT = {
  bpm: 120, mood: 'bright',
  scenes: [
    { type: 'title', beats: 8, kicker: 'December budget challenge', lines: ['Survive December', 'without going', '<bad>broke in January.</bad>'], size: 108 },
    { type: 'steps', beats: 10, drop: true, title: '4 weeks.<br><em>4 goals.</em>', step: 0.6, gap: 240,
      items: [{ k: '1', text: 'Set a budget from<br>what you really earn' }, { k: '2', text: 'Track every kwacha<br>you spend' },
              { k: '3', text: 'Save K10,000<br>for January' }, { k: '4', text: 'One no-spend<br>weekend' }] },
    { type: 'phone', beats: 7, img: 'screen-budget', caption: 'Week 1: Ndalama<br><em>suggests your budget</em>', size: 76, top: 440 },
    { type: 'phone', beats: 7, img: 'screen-add', caption: 'Week 2: record every<br>spend in <em>seconds</em>', size: 76, top: 440 },
    { type: 'cards', beats: 7, cards: ['card-goal'], heights: [764], caption: 'Week 3: watch your<br><em>savings grow</em>', top: 560 },
    { type: 'title', beats: 6, kicker: 'Week 4', lines: ['A <em>no-spend</em>', 'weekend.', 'You’ve got this.'], size: 120 },
    { type: 'title', beats: 7, lines: ['Join in.', 'Post your progress', 'with <em>#NdalamaChallenge</em>'], size: 96 },
    { type: 'end', beats: 8, bg: 'green' },
  ],
};
