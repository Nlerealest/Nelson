// "Fuel at K5,660 a litre" (c-fuelstable). Reference r-b111f257 (marketing/references/r-b111f257.md), pattern played three times.
// Business persona numbers (assets/app/personas/business/numbers.txt, 12 Nov 2026): fuel 20 litres = K112,000 a fill (days 4, 12, 22),
// three fills K336,000 (3 x K112,000), Transport budget K350,000, K238,000 left.
window.SHORT = {
  bpm: 108, mood: 'warm',
  style: { reveal: 'blur' },
  scenes: [
    { id: 'hook', type: 'phone', beats: 4, img: 'screen-budget', caption: '20 litres.<br><em>Three times a month.</em>', size: 80, top: 470 },
    { id: 'q', type: 'prompt', beats: 4, transition: 'flash', caption: 'Where does fuel <em>go?</em>', size: 88, text: 'What does fuel cost me?', top: 760 },
    { id: 'f1', type: 'title', beats: 4, transition: 'flash', kicker: 'Day 4, Bank', lines: ['One fill<br><em>K112,000</em>'], size: 110 },
    { id: 'f2', type: 'title', beats: 4, transition: 'blinds', kicker: 'Day 12, Bank', lines: ['Again<br><em>K112,000</em>'], size: 110 },
    { id: 'f3', type: 'title', beats: 4, transition: 'whip', kicker: 'Day 22, Bank', lines: ['And again<br><em>K112,000</em>'], size: 110 },
    { id: 'sum', type: 'counter', beats: 6, transition: 'glitch', label: 'Fuel, three fills', value: 336000, note: 'of a K350,000<br>transport budget' },
    { id: 'lost', type: 'title', beats: 4, transition: 'glitch', lines: ['Transport', '<bad>creeping up.</bad>'], size: 130 },
    { id: 'add', type: 'phone', beats: 6, transition: 'slide', img: 'screen-add', caption: 'Log every fill<br><em>in seconds</em>', size: 72, top: 470 },
    { id: 'bud', type: 'cards', beats: 6, transition: 'whip-right', cards: ['card-budget'], heights: [700], caption: 'Every category,<br><em>on pace</em>', top: 520 },
    { id: 'left', type: 'counter', beats: 6, transition: 'fill', label: 'Transport left this month', value: 238000, note: 'of K350,000' },
    { id: 'warn', type: 'phone', beats: 6, transition: 'circle', img: 'screen-home', caption: 'Warned when spending<br><em>runs too fast</em>', size: 70, top: 470 },
    { id: 'bills', type: 'cards', beats: 6, transition: 'band', cards: ['card-bills'], heights: [700], caption: 'Bills set aside<br><em>first</em>', top: 540 },
    { id: 'show', type: 'showcase', beats: 10, transition: 'fill', dir: 'up', imgs: ['screen-home', 'screen-budget', 'screen-goals'], captions: ['Today at a <em>glance</em>', 'A budget that <em>fits</em>', 'Goals on <em>track</em>'], size: 72, top: 450 },
    { id: 'name', type: 'namereveal', beats: 4, drop: true, transition: 'flash', name: 'Ndalama', sub: 'Every kwacha, counted.' },
    { id: 'dec', type: 'title', beats: 4, transition: 'slide', kicker: 'December is close', lines: ['Plan the<br><em>month early</em>'], size: 110 },
    { id: 'calm', type: 'title', beats: 6, transition: 'circle', kicker: 'Fuel, bills, goals', lines: ['Adjust', '<em>early.</em>'], size: 150 },
    { id: 'end', type: 'end', beats: 8, transition: 'fill', bg: 'green' },
  ],
};
