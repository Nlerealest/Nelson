// "Rainy season costs: roof, seed, school term" (about 49 s). Reference r-d3ece952, beat by beat (marketing/references/r-d3ece952.md).
// Numbers: family persona (parents of three, tailoring business), assets/app/personas/family/numbers.txt + screens of 5 Nov 2026:
// goal Children's school fees needs K100,000 a month; income K1,750,000 a month; safe to spend K31,976 a day. The owner's uploaded song, about 89 bpm.
window.SHORT = {
  bpm: 86, mood: 'warm',
  style: { reveal: 'blur' },
  scenes: [
    { id: 'b1', type: 'prompt', beats: 4, caption: 'The rains are<br><em>coming.</em>', text: 'Roof. Seed. School term.', placeholder: 'What will it cost…', size: 80 },
    { id: 'b2', type: 'phone', beats: 6, transition: 'circle', img: 'personas/family/screen-goals', caption: 'All the costs<br><em>land together.</em>', size: 80, top: 470 },
    { id: 'b3', type: 'bento', beats: 4, transition: 'whip', word: 'Rains', cards: ['personas/family/card-goal', 'personas/family/card-bills'], caption: 'Roof. Seed.<br>School fees.', size: 64 },
    { id: 'b4', type: 'morph', beats: 4, transition: 'slide', caption: 'Borrow later?<br><em>Or plan it now.</em>', size: 64, label: 'saved', saved: 2600000, goal: 3000000 },
    { id: 'b5', type: 'namereveal', beats: 4, drop: true, name: 'Ndalama', sub: 'Plan it early.' },
    { id: 'b6', type: 'prompt', beats: 6, transition: 'glitch', caption: 'Set the goal.<br><em>See the monthly amount.</em>', text: "Children's school fees", placeholder: 'New goal…', cards: ['personas/family/card-goal'], size: 72, top: 520 },
    { id: 'b7', type: 'steps', beats: 10, transition: 'whip-right', title: 'Ready <em>before</em> the rains', size: 92, top: 520, gap: 230,
      items: [{ k: '1', text: 'Make a savings goal' }, { k: '2', text: 'See what to set aside' }, { k: '3', text: 'Bills reminded the day before' }, { k: '4', text: 'Early warning if at risk' }] },
    { id: 'b8', type: 'title', beats: 5, transition: 'flash', kicker: 'Habits slipping?', lines: ['Your goal at risk?', '<em>You get a warning.</em>'], size: 92 },
    { id: 'b9', type: 'showcase', beats: 11, transition: 'slide', dir: 'up', imgs: ['personas/family/screen-goals', 'personas/family/screen-budget', 'personas/family/screen-bills'], captions: ['Savings <em>goals</em>', 'A budget from <em>what you earn</em>', 'Reminders <em>the day before</em>'], size: 72, top: 450 },
    { id: 'b10', type: 'cards', beats: 6, transition: 'circle', cards: ['personas/family/card-hero'], heights: [520], caption: 'Safe to spend<br><em>today</em>', top: 620 },
    { id: 'b11', type: 'counter', beats: 6, transition: 'whip', label: 'Set aside each month', value: 100000, note: "for the children's school fees.<br>No borrowing panic." },
    { id: 'end', type: 'end', beats: 6, transition: 'circle', bg: 'green' },
  ],
};
