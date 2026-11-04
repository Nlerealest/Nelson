// "Payday, in motion": the owner's motion-design reference (ref-motion) rebuilt
// for Ndalama, in the dark green look. Persona: corporate (numbers.txt, 4 Nov 2026):
// K1,450,000 salary, K15,703 a day for 27 days, savings this month K234,018,
// car goal K4,000,000 of K9,000,000. October balance from the persona's month.
window.SHORT = {
  bpm: 100, mood: 'warm',
  scenes: [
    { type: 'chrome', beats: 8, word: 'NDALAMA', sub: 'Your money, in motion.' },
    { type: 'bounce', beats: 10, transition: 'drop', captions: ['Payday. <em>K1,450,000.</em>', 'Rent. Fuel. Fees. <bad>Gone?</bad>'] },
    { type: 'pullback', beats: 10, transition: 'pull', img: 'screen-home', focusY: 0.18, caption: 'Every kwacha,<br><em>in one place.</em>', label: 'Balance in October', value: 'K370,000 left',
      curve: [1450000, 800000, 730000, 673000, 589000, 529000, 429000, 384000, 334000, 319000, 599000, 554000, 445000, 410000, 370000] },
    { type: 'counter', beats: 7, transition: 'whip', label: 'Safe to spend today', value: 15703, note: 'a day for the next 27 days' },
    { type: 'morph', beats: 9, transition: 'circle', caption: 'New car:<br><em>44% there.</em>', goal: 9000000, saved: 4000000, label: 'of K9,000,000' },
    { type: 'bento', beats: 10, transition: 'fill', drop: true, word: 'Budget', cards: ['card-hero', 'card-goal'], caption: 'Budgets. Bills.<br>Goals. <em>Loans.</em>', curveLabel: 'Savings', bars: [60, 45, 72, 50, 84, 66, 90] },
    { type: 'showcase', beats: 14, transition: 'slide', imgs: ['screen-budget', 'screen-goals', 'screen-bills', 'screen-loans'], dir: 'alternate',
      captions: ['A budget from<br><em>what you earn</em>', 'Goals with<br><em>early warnings</em>', 'Bills reminded<br><em>before they’re due</em>', 'Every loan<br><em>tracked</em>'] },
    { type: 'counter', beats: 7, transition: 'whip', label: 'Set aside for goals', value: 234018, note: 'before you spend a kwacha' },
    { type: 'namereveal', beats: 8, transition: 'fill', name: 'Ndalama', sub: 'Know where your kwacha goes.' },
    { type: 'end', beats: 10, transition: 'drop' },
  ],
};
