// "Salary + side income: one clear picture" (concept c-doublesalary). Reference r-b111f257 (marketing/references/r-b111f257.md),
// pattern played three times: problem, Ndalama, payoff. Corporate persona numbers (assets/app/personas/corporate/numbers.txt, 8 Nov 2026):
// salary K1,450,000 (Bank), broiler sales K280,000 (Airtel Money), income K1,730,000, safe to spend today K4,912 for 23 days.
window.SHORT = {
  bpm: 100, mood: 'warm',
  style: { reveal: 'blur' },
  scenes: [
    { id: 'hook', type: 'phone', beats: 4, img: 'screen-home', caption: 'Two incomes.<br><em>One mystery.</em>', size: 84, top: 470 },
    { id: 'q', type: 'prompt', beats: 4, transition: 'flash', caption: 'Where did it <em>go?</em>', size: 92, text: 'Where did my salary go?', top: 760 },
    { id: 'sal', type: 'title', beats: 4, transition: 'flash', kicker: 'Day 1, Bank', lines: ['Salary<br><em>K1,450,000</em>'], size: 110 },
    { id: 'biz', type: 'title', beats: 4, transition: 'blinds', kicker: 'Day 15, Airtel Money', lines: ['Broilers<br><em>K280,000</em>'], size: 110 },
    { id: 'mix', type: 'cards', beats: 4, transition: 'whip', cards: ['card-recent'], heights: [700], caption: 'Cash, Airtel Money,<br><em>Bank.</em>', top: 520 },
    { id: 'lost', type: 'title', beats: 4, transition: 'glitch', lines: ['Nothing', '<bad>adds up.</bad>'], size: 150 },
    { id: 'add', type: 'phone', beats: 6, transition: 'slide', img: 'screen-add', caption: 'Record each income<br><em>how it was paid</em>', size: 72, top: 470 },
    { id: 'tiles', type: 'cards', beats: 6, transition: 'whip-right', cards: ['card-tiles'], heights: [620], caption: 'The month,<br><em>in one place</em>', top: 540 },
    { id: 'total', type: 'counter', beats: 6, transition: 'fill', label: 'Income a month', value: 1730000, note: 'salary and broilers<br>together' },
    { id: 'safe', type: 'counter', beats: 6, transition: 'band', label: 'Safe to spend today', value: 4912, note: 'for 23 days,<br>after bills and savings' },
    { id: 'bills', type: 'cards', beats: 6, transition: 'circle', cards: ['card-bills'], heights: [700], caption: 'Bills set aside<br><em>first</em>', top: 540 },
    { id: 'show', type: 'showcase', beats: 10, transition: 'fill', dir: 'up', imgs: ['screen-home', 'screen-budget', 'screen-goals'], captions: ['Today at a <em>glance</em>', 'A budget that <em>fits</em>', 'Goals on <em>track</em>'], size: 72, top: 450 },
    { id: 'name', type: 'namereveal', beats: 4, drop: true, transition: 'flash', name: 'Ndalama', sub: 'Every kwacha, counted.' },
    { id: 'calm', type: 'title', beats: 6, transition: 'circle', kicker: 'Salary and side income', lines: ['One <em>calm</em>', 'number.'], size: 140 },
    { id: 'end', type: 'end', beats: 8, transition: 'fill', bg: 'green' },
  ],
};
