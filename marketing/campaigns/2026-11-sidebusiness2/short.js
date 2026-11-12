// "Shop money vs home money" (concept c-sidebusiness2). Reference r-b111f257 (marketing/references/r-b111f257.md),
// pattern played three times: problem, Ndalama, payoff. Business persona numbers (assets/app/personas/business/numbers.txt, 12 Nov 2026):
// shop profits K2,400,000 (Bank), minibus K600,000 (Airtel Money), income K3,000,000, rent K900,000 (38% of spending),
// kept 20% (K614,000), K11,000,000 towards goals, Second shop needs K360,000 a month.
window.SHORT = {
  bpm: 100, mood: 'warm',
  style: { reveal: 'blur' },
  scenes: [
    { id: 'hook', type: 'phone', beats: 4, img: 'screen-home', caption: 'Shop money.<br><em>Home money.</em>', size: 84, top: 470 },
    { id: 'q', type: 'prompt', beats: 4, transition: 'flash', caption: 'Which is <em>which?</em>', size: 92, text: 'Is this the shop money?', top: 760 },
    { id: 'shop', type: 'title', beats: 4, transition: 'flash', kicker: 'Day 1, Bank', lines: ['Shop profits<br><em>K2,400,000</em>'], size: 100 },
    { id: 'bus', type: 'title', beats: 4, transition: 'blinds', kicker: 'Day 15, Airtel Money', lines: ['Minibus<br><em>K600,000</em>'], size: 110 },
    { id: 'mix', type: 'cards', beats: 4, transition: 'whip', cards: ['card-recent'], heights: [700], caption: 'Cash, Airtel Money,<br>Mpamba, <em>Bank.</em>', top: 520 },
    { id: 'lost', type: 'title', beats: 4, transition: 'glitch', lines: ['Shop and house', '<bad>mixed up.</bad>'], size: 120 },
    { id: 'add', type: 'phone', beats: 6, transition: 'slide', img: 'screen-add', caption: 'Record each income<br><em>how it was paid</em>', size: 72, top: 470 },
    { id: 'total', type: 'counter', beats: 6, transition: 'fill', label: 'Income a month', value: 3000000, note: 'shops and minibus<br>together' },
    { id: 'cats', type: 'cards', beats: 6, transition: 'whip-right', cards: ['card-report-cats'], heights: [700], caption: 'Rent, family, fuel:<br><em>by category</em>', top: 540 },
    { id: 'kept', type: 'counter', beats: 6, transition: 'band', label: 'Kept this month', value: 614000, note: '20% of your income' },
    { id: 'goal', type: 'cards', beats: 6, transition: 'circle', cards: ['card-goal-alert'], heights: [700], caption: 'The second shop,<br><em>warned early</em>', top: 540 },
    { id: 'show', type: 'showcase', beats: 10, transition: 'fill', dir: 'up', imgs: ['screen-home', 'screen-report', 'screen-goals'], captions: ['Today at a <em>glance</em>', 'The monthly <em>report</em>', 'Goals on <em>track</em>'], size: 72, top: 450 },
    { id: 'name', type: 'namereveal', beats: 4, drop: true, transition: 'flash', name: 'Ndalama', sub: 'Every kwacha, counted.' },
    { id: 'calm', type: 'title', beats: 6, transition: 'circle', kicker: 'Shop and home', lines: ['One <em>clear</em>', 'picture.'], size: 140 },
    { id: 'end', type: 'end', beats: 8, transition: 'fill', bg: 'green' },
  ],
};
